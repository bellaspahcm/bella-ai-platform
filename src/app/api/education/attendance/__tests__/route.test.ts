import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn<() => Promise<{ id: string; tenant_id: string; role: string } | null>>();
const mockGetCourseDailyAttendance = jest.fn<() => Promise<Array<{ enrollmentId: string; studentPartyId: string }>>>();
const mockSetDailyAttendance = jest.fn<(...input: unknown[]) => Promise<unknown>>();
const mockGetAuthorizedGuardians = jest.fn<() => Promise<Map<string, unknown>>>();
const mockGetLatestHandovers = jest.fn<() => Promise<Map<string, unknown>>>();

const mockBranchCheck = jest.fn(async (..._input: unknown[]) => undefined);
jest.mock('@/products/bella-education/services/preschool-attendance-access.service', () => ({
  PreschoolAttendanceAccessService: jest.fn().mockImplementation(() => ({
    assertCourseAccess: mockBranchCheck,
    assertEnrollmentAccess: mockBranchCheck,
  })),
}));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/products/bella-education/services/attendance.service', () => ({
  AttendanceProductService: jest.fn().mockImplementation(() => ({
    getCourseDailyAttendance: mockGetCourseDailyAttendance,
    setDailyAttendance: mockSetDailyAttendance,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-attendance-command.service', () => ({
  PreschoolAttendanceCommandService: jest.fn().mockImplementation(() => ({
    setDailyAttendance: async (input: { tenantId: string; actorId: string; enrollmentId: string }) => {
      await mockBranchCheck(input.tenantId, input.actorId, input.enrollmentId);
      return mockSetDailyAttendance(input);
    },
  })),
}));

jest.mock('@/products/bella-education/services/preschool-guardian-authorization.service', () => ({
  PreschoolGuardianAuthorizationService: jest.fn().mockImplementation(() => ({
    getAuthorizedGuardians: mockGetAuthorizedGuardians,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-safe-pickup-handover.service', () => ({
  PreschoolSafePickupHandoverService: jest.fn().mockImplementation(() => ({
    getLatestHandovers: mockGetLatestHandovers,
  })),
}));

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const userId = '00000000-0000-0000-0000-000000000001';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const enrollmentId = '00000000-0000-0000-0000-0000000000ee';

function attendancePostRequest(body: object): Request {
  return new Request('http://localhost/api/education/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/education/attendance route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchCheck.mockReset();
    mockBranchCheck.mockResolvedValue(undefined);
    mockGetCurrentUser.mockResolvedValue({
      id: userId,
      tenant_id: tenantId,
      role: 'admin_staff',
    });
    mockGetCourseDailyAttendance.mockResolvedValue([]);
    mockSetDailyAttendance.mockResolvedValue({
      id: 'attendance-state-1',
      tenantId,
      enrollmentId,
      schoolDay: '2026-10-06',
      status: 'present',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map<string, unknown>());
    mockGetLatestHandovers.mockResolvedValue(new Map<string, unknown>());
  });

  it('blocks parent users from reading the classroom attendance roster', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'parent-user',
      tenant_id: tenantId,
      role: 'parent',
    });

    const response = await GET(new Request(
      `http://localhost/api/education/attendance?courseId=${courseId}&date=2026-10-06`,
    ));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain('AUTH_ROLE_PERMISSION_ERROR');
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });

  it('blocks accountant users from mutating daily attendance', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'accountant-user',
      tenant_id: tenantId,
      role: 'accountant',
    });

    const response = await POST(attendancePostRequest({
      enrollmentId,
      status: 'present',
      date: '2026-10-06',
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toContain('AUTH_ROLE_PERMISSION_ERROR');
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('allows an education staff actor to set attendance through the product service', async () => {
    const response = await POST(attendancePostRequest({
      enrollmentId,
      status: 'present',
      date: '2026-10-06',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSetDailyAttendance).toHaveBeenCalledWith({
      tenantId,
      actorId: userId,
      actorRole: 'admin_staff',
      enrollmentId,
      status: 'present',
      schoolDay: '2026-10-06',
      rollCallTime: '2026-10-06T05:00:00.000Z',
    });
    expect(mockBranchCheck).toHaveBeenCalledWith(tenantId, userId, enrollmentId);
    expect(mockBranchCheck.mock.invocationCallOrder[0]).toBeLessThan(mockSetDailyAttendance.mock.invocationCallOrder[0]);
  });

  it('denies a branch before reading the roster or guardian data', async () => {
    const { PreschoolChainError } = await import('@/products/bella-education/services/preschool-chain.service');
    mockBranchCheck.mockRejectedValueOnce(new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403));
    const response = await GET(new Request(`http://localhost/api/education/attendance?courseId=${courseId}&date=2026-10-06`));
    expect(response.status).toBe(403);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
    expect(mockGetAuthorizedGuardians).not.toHaveBeenCalled();
    expect(mockGetLatestHandovers).not.toHaveBeenCalled();
  });

  it('denies a branch before writing attendance even for an admin', async () => {
    const { PreschoolChainError } = await import('@/products/bella-education/services/preschool-chain.service');
    mockGetCurrentUser.mockResolvedValue({ id: userId, tenant_id: tenantId, role: 'admin' });
    mockBranchCheck.mockRejectedValueOnce(new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403));
    const response = await POST(attendancePostRequest({ enrollmentId, status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(403);
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('rejects a mismatched roster row before revealing guardians or handovers', async () => {
    const { PreschoolChainError } = await import('@/products/bella-education/services/preschool-chain.service');
    mockGetCourseDailyAttendance.mockResolvedValue([{ enrollmentId, studentPartyId: 'canonical-party' }]);
    mockBranchCheck.mockResolvedValueOnce(undefined);
    mockBranchCheck.mockRejectedValueOnce(new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT'));
    const response = await GET(new Request(`http://localhost/api/education/attendance?courseId=${courseId}&date=2026-10-06`));
    expect(response.status).toBe(409);
    expect(mockBranchCheck).toHaveBeenLastCalledWith(tenantId, userId, enrollmentId, 'canonical-party', courseId);
    expect(mockGetAuthorizedGuardians).not.toHaveBeenCalled();
    expect(mockGetLatestHandovers).not.toHaveBeenCalled();
  });

  it('fails closed on a Platform error without writing attendance', async () => {
    mockBranchCheck.mockRejectedValueOnce(new Error('PRESCHOOL_ATTENDANCE_ACCESS_LOOKUP_FAILED'));
    const response = await POST(attendancePostRequest({ enrollmentId, status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(500);
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('does not let branch membership bypass the parent action denial', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: userId, tenant_id: tenantId, role: 'parent' });
    const response = await POST(attendancePostRequest({ enrollmentId, status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(403);
    expect(mockBranchCheck).not.toHaveBeenCalled();
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('returns 401 without reading or writing for an anonymous actor', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await POST(attendancePostRequest({ enrollmentId, status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(401);
    expect(mockBranchCheck).not.toHaveBeenCalled();
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('maps a post-lock authorization denial from the command to HTTP 403', async () => {
    const { EducationAttendanceCommandError } = await import('@/platform/education/contracts/attendance-command.contract');
    mockSetDailyAttendance.mockRejectedValueOnce(new EducationAttendanceCommandError('ATTENDANCE_CURRENT_ACCESS_DENIED', 403));
    const response = await POST(attendancePostRequest({ enrollmentId, status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(403);
    expect((await response.json()).success).toBe(false);
  });

  it('rejects malformed enrollment UUID before Product preflight can query the database', async () => {
    const response = await POST(attendancePostRequest({ enrollmentId: 'not-a-uuid', status: 'present', date: '2026-10-06' }));
    expect(response.status).toBe(400);
    expect(mockBranchCheck).not.toHaveBeenCalled();
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });

  it('normalizes a valid uppercase enrollment UUID before canonical Product preflight', async () => {
    const response = await POST(attendancePostRequest({
      enrollmentId: enrollmentId.toUpperCase(), status: 'present', date: '2026-10-06',
    }));
    expect(response.status).toBe(200);
    expect(mockBranchCheck).toHaveBeenCalledWith(tenantId, userId, enrollmentId);
    expect(mockSetDailyAttendance).toHaveBeenCalledWith(expect.objectContaining({ enrollmentId }));
  });
});
