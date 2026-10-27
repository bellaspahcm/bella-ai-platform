const mockAuthGetUser = jest.fn();
const mockCreateClient = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetTenantPresentation = jest.fn();
const mockRequireIdentity = jest.fn();
const mockTeacherAttendanceService = jest.fn();

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
jest.mock('@/services/tenant-actions', () => ({ getTenantPresentation: () => mockGetTenantPresentation() }));
jest.mock('@/products/bella-education/services/preschool-teacher-attendance.service', () => ({
  PreschoolTeacherAttendanceService: class {
    requireIdentity = mockRequireIdentity;
    constructor(client: unknown) { mockTeacherAttendanceService(client); }
  },
}));

import { resolveAttendanceRequestContext } from '@/app/api/education/attendance/request-context';

describe('Education attendance request identity contract', () => {
  const actor = { id: 'teacher-auth-id', tenant_id: 'school-a', role: 'admin_staff', status: 'active' };
  const tenant = { id: 'school-a', status: 'active', product_key: 'bella_preschool' };
  const directTableRead = jest.fn(() => { throw new Error('DIRECT_USERS_OR_TENANTS_READ_FORBIDDEN'); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: actor.id } }, error: null });
    mockCreateClient.mockReturnValue({ auth: { getUser: mockAuthGetUser }, from: directTableRead });
    mockGetCurrentUser.mockResolvedValue(actor);
    mockGetTenantPresentation.mockResolvedValue(tenant);
    mockRequireIdentity.mockResolvedValue(undefined);
  });

  it('resolves the teacher through the current-actor contract and trusted tenant presentation', async () => {
    const request = new Request('http://localhost/api/education/attendance/courses');
    const context = await resolveAttendanceRequestContext(request, true);

    expect(context).toEqual({
      client: expect.any(Object), tenantId: 'school-a', actorId: actor.id,
      actorRole: 'admin_staff', productKey: 'bella_preschool',
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockGetTenantPresentation).toHaveBeenCalledTimes(1);
    expect(mockTeacherAttendanceService).toHaveBeenCalledWith(expect.any(Object));
    expect(mockRequireIdentity).toHaveBeenCalledWith('school-a', actor.id);
    expect(directTableRead).not.toHaveBeenCalled();
  });

  it('rejects a current-actor result whose id differs from the authenticated subject', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...actor, id: 'other-auth-id' });
    await expect(resolveAttendanceRequestContext(
      new Request('http://localhost/api/education/attendance/courses'), true,
    )).rejects.toMatchObject({ status: 403, code: 'ATTENDANCE_ACCESS_DENIED' });
    expect(mockGetTenantPresentation).not.toHaveBeenCalled();
  });

  it('fails closed when the trusted tenant presentation does not match the current actor', async () => {
    mockGetTenantPresentation.mockResolvedValue({ ...tenant, id: 'school-b' });
    await expect(resolveAttendanceRequestContext(
      new Request('http://localhost/api/education/attendance/courses'), true,
    )).rejects.toMatchObject({ status: 503, code: 'ATTENDANCE_IDENTITY_UNAVAILABLE' });
    expect(mockRequireIdentity).not.toHaveBeenCalled();
  });

  it('does not expose the teacher request path without its specific attendance capability', async () => {
    await expect(resolveAttendanceRequestContext(
      new Request('http://localhost/api/education/attendance/courses'), false,
    )).rejects.toMatchObject({ status: 503, code: 'ATTENDANCE_TEACHER_IDENTITY_UNAVAILABLE' });
    expect(mockRequireIdentity).not.toHaveBeenCalled();
  });
});
