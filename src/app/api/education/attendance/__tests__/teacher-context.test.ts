const mockIdentity = jest.fn();
const mockCourses = jest.fn();
const mockCatalogCourses = jest.fn();
const mockAdminCatalogCourses = jest.fn();
const mockAdminBranches = jest.fn();
const mockCurrentActor = jest.fn();
const mockTenantPresentation = jest.fn();
let mockRole = 'admin_staff';
const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const courseId = '10000000-0000-4000-8000-000000000003';
const branchId = '10000000-0000-4000-8000-000000000004';
function assignmentQuery() {
  const result = {
    data: [{ tenant_id: tenantId, course_id: courseId, branch_id: branchId }],
    count: 1,
    error: null,
  };
  type Query = Promise<typeof result> & {
    select: (...args: unknown[]) => Query;
    eq: (...args: unknown[]) => Query;
  };
  let query: Query;
  query = Object.assign(Promise.resolve(result), {
    select: (..._args: unknown[]) => query,
    eq: (..._args: unknown[]) => query,
  }) as Query;
  return query;
}
const mockClient = {
  auth: { getUser: jest.fn(async () => ({ data: { user: { id: actorId } }, error: null })) },
  from: jest.fn(() => assignmentQuery()),
};
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockCurrentActor() }));
jest.mock('@/services/tenant-actions', () => ({ getTenantPresentation: () => mockTenantPresentation() }));
jest.mock('@/platform/education/contracts/canonical-course-catalog.contract.impl', () => ({
  CanonicalCourseCatalogContractImpl: jest.fn().mockImplementation(() => ({
    listCourses: mockCatalogCourses,
    listPreschoolAdminCourses: mockAdminCatalogCourses,
  })),
}));
jest.mock('@/platform/education/contracts/preschool-admin-branch-catalog.contract.impl', () => ({
  PreschoolAdminBranchCatalogContractImpl: jest.fn().mockImplementation(() => ({
    listCurrentPreschoolAdminBranches: mockAdminBranches,
  })),
}));
jest.mock('@/products/bella-education/services/preschool-teacher-attendance.service', () => ({
  PreschoolTeacherAttendanceService: jest.fn().mockImplementation(() => ({ requireIdentity: mockIdentity, listCourses: mockCourses })),
}));
import { authorizeAttendanceCourse, resolveAttendanceRequestContext } from '../request-context';
const request = () => new Request('http://localhost/api/education/attendance');
beforeEach(() => {
  jest.clearAllMocks(); mockRole = 'admin_staff';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T05:00:00.000Z'));
  mockIdentity.mockResolvedValue(undefined); mockCourses.mockResolvedValue([{ courseId, branchId, name: 'Assigned' }]);
  mockCatalogCourses.mockResolvedValue([{ id: courseId, tenantId, status: 'active' }]);
  mockAdminCatalogCourses.mockResolvedValue([{ id: courseId, tenantId, status: 'active' }]);
  mockAdminBranches.mockResolvedValue([{ id: branchId, name: 'Cơ sở kiểm chứng' }]);
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  mockTenantPresentation.mockResolvedValue({ id: tenantId, status: 'active', product_key: 'bella_preschool' });
});
afterEach(() => jest.useRealTimers());
it('keeps staff held by default for Analytics/admission consumers', async () => {
  await expect(resolveAttendanceRequestContext(request())).rejects.toMatchObject({ status: 503, code: 'ATTENDANCE_TEACHER_IDENTITY_UNAVAILABLE' });
  expect(mockIdentity).not.toHaveBeenCalled();
});
it('resolves teacher identity only on explicit Attendance opt-in', async () => {
  const context = await resolveAttendanceRequestContext(request(), true);
  expect(context.actorRole).toBe('admin_staff');
  expect(mockIdentity).toHaveBeenCalledWith(tenantId, actorId);
});
it('does not swallow identity denial', async () => {
  mockIdentity.mockRejectedValue(new Error('DENIED'));
  await expect(resolveAttendanceRequestContext(request(), true)).rejects.toThrow('DENIED');
});
it('requires assigned class before continuing without branch-wide catalog reads', async () => {
  const context = await resolveAttendanceRequestContext(request(), true); mockClient.from.mockClear();
  await authorizeAttendanceCourse(context, request(), courseId, '2026-10-26');
  expect(mockClient.from).not.toHaveBeenCalled();
  mockCourses.mockResolvedValue([]);
  await expect(authorizeAttendanceCourse(context, request(), branchId, '2026-10-26')).rejects.toMatchObject({ status: 403 });
});
it('rejects a branch selector that conflicts with the teacher assignment', async () => {
  const context = await resolveAttendanceRequestContext(request(), true);
  await expect(authorizeAttendanceCourse(context,
    new Request(`http://localhost/api/education/attendance?branchId=${tenantId}`), courseId, '2026-10-26')).rejects.toMatchObject({ status: 403 });
});
it('authorizes admin attendance through the current-caller branch contract, not direct branch tables', async () => {
  mockRole = 'admin';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  const context = await resolveAttendanceRequestContext(request());

  await authorizeAttendanceCourse(context, request(), courseId, '2026-10-26');

  expect(mockAdminCatalogCourses).toHaveBeenCalledWith(tenantId);
  expect(mockCatalogCourses).not.toHaveBeenCalled();
  expect(mockAdminBranches).toHaveBeenCalledTimes(1);
  expect(mockClient.from).toHaveBeenCalledWith('preschool_chain_course_branch_assignments');
  expect(mockClient.from).not.toHaveBeenCalledWith('org_units');
  expect(mockClient.from).not.toHaveBeenCalledWith('user_org_unit_access');
});
it('denies an admin course whose branch is absent from the caller branch catalog', async () => {
  mockRole = 'admin';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  mockAdminBranches.mockResolvedValue([]);
  const context = await resolveAttendanceRequestContext(request());

  await expect(authorizeAttendanceCourse(context, request(), courseId, '2026-10-26'))
    .rejects.toMatchObject({ status: 403, code: 'ATTENDANCE_BRANCH_ACCESS_DENIED' });
});
it('fails closed when the current-caller branch catalog is unavailable', async () => {
  mockRole = 'admin';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  mockAdminBranches.mockRejectedValue(new Error('PRESCHOOL_ADMIN_BRANCH_CATALOG_UNAVAILABLE'));
  const context = await resolveAttendanceRequestContext(request());

  await expect(authorizeAttendanceCourse(context, request(), courseId, '2026-10-26'))
    .rejects.toMatchObject({ status: 503, code: 'ATTENDANCE_BRANCH_SCOPE_UNAVAILABLE' });
});
it('keeps non-Preschool admins on the existing shared course catalog', async () => {
  mockRole = 'admin';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  mockTenantPresentation.mockResolvedValue({ id: tenantId, status: 'active', product_key: 'bella_beauty' });
  const context = await resolveAttendanceRequestContext(request());

  await authorizeAttendanceCourse(context, request(), courseId, '2026-10-26');

  expect(mockCatalogCourses).toHaveBeenCalledWith(tenantId);
  expect(mockAdminCatalogCourses).not.toHaveBeenCalled();
  expect(mockClient.from).not.toHaveBeenCalled();
});
it('does not make non-teacher roles eligible via opt-in', async () => {
  mockRole = 'accountant';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  await expect(resolveAttendanceRequestContext(request(), true)).rejects.toMatchObject({ status: 403 });
  expect(mockIdentity).not.toHaveBeenCalled();
});
