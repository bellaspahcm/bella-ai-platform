const mockIdentity = jest.fn();
const mockCourses = jest.fn();
const mockCurrentActor = jest.fn();
const mockTenantPresentation = jest.fn();
let mockRole = 'admin_staff';
const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const courseId = '10000000-0000-4000-8000-000000000003';
const branchId = '10000000-0000-4000-8000-000000000004';
const mockClient = {
  auth: { getUser: jest.fn(async () => ({ data: { user: { id: actorId } }, error: null })) },
  from: jest.fn((table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'users'
      ? { id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' }
      : { id: tenantId, product_key: 'bella_preschool', status: 'active' }, error: null }) };
    return query;
  }),
};
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockCurrentActor() }));
jest.mock('@/services/tenant-actions', () => ({ getTenantPresentation: () => mockTenantPresentation() }));
jest.mock('@/products/bella-education/services/preschool-teacher-attendance.service', () => ({
  PreschoolTeacherAttendanceService: jest.fn().mockImplementation(() => ({ requireIdentity: mockIdentity, listCourses: mockCourses })),
}));
import { authorizeAttendanceCourse, resolveAttendanceRequestContext } from '../request-context';
const request = () => new Request('http://localhost/api/education/attendance');
beforeEach(() => {
  jest.clearAllMocks(); mockRole = 'admin_staff';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T05:00:00.000Z'));
  mockIdentity.mockResolvedValue(undefined); mockCourses.mockResolvedValue([{ courseId, branchId, name: 'Assigned' }]);
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
it('does not make non-teacher roles eligible via opt-in', async () => {
  mockRole = 'accountant';
  mockCurrentActor.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: mockRole, status: 'active' });
  await expect(resolveAttendanceRequestContext(request(), true)).rejects.toMatchObject({ status: 403 });
  expect(mockIdentity).not.toHaveBeenCalled();
});
