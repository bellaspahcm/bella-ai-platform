import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockResolveContext = jest.fn();
const mockAssertSelectors = jest.fn();
const mockAssertDay = jest.fn();
const mockRequireSchoolDay = jest.fn((value: unknown) => value);
const mockListCourses = jest.fn();
const mockGetCourseDailyAttendance = jest.fn();
const mockAttendanceAccessError = class extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
};

jest.mock('../../attendance/request-context', () => ({
  resolveAttendanceRequestContext: mockResolveContext,
  assertAttendanceSelectors: mockAssertSelectors,
  assertAttendanceDay: mockAssertDay,
  requireSchoolDay: mockRequireSchoolDay,
  AttendanceAccessError: mockAttendanceAccessError,
}));
jest.mock('@/platform/education/contracts/canonical-course-catalog.contract.impl', () => ({
  CanonicalCourseCatalogContractImpl: class { listCourses = mockListCourses; },
}));
jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: class { getCourseDailyAttendance = mockGetCourseDailyAttendance; },
}));

const { GET } = require('../route') as typeof import('../route');
const tenantId = 'tenant-a';
const actorId = 'admin-a';
const branchA = 'branch-a';
const branchB = 'branch-b';
const courseA = 'course-a';
const tables: Record<string, unknown[]> = {};
const counts: Record<string, number | null> = {};
const errors: Record<string, unknown> = {};
const mockFrom = jest.fn((table: string) => {
  const result = { data: tables[table] ?? [], count: counts[table] ?? (tables[table] ?? []).length, error: errors[table] ?? null };
  const query = {
    select: jest.fn(() => query), eq: jest.fn(() => query), in: jest.fn(() => query), not: jest.fn(() => query),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
});
const context = { client: { from: mockFrom }, tenantId, actorId, productKey: 'bella_preschool' };
const rosterItem = (enrollmentId: string, studentPartyId: string, status: 'present' | 'absent' | 'excused' | null) => ({
  enrollmentId, studentId: `student-${enrollmentId}`, studentPartyId, studentCode: null, name: 'Canonical Student',
  gender: null, dob: null, enrollmentStatus: 'active',
  attendance: status ? { id: `daily-${enrollmentId}`, tenantId, enrollmentId, schoolDay: '2026-10-22', status,
    createdAt: '2026-10-22T00:01:00.000Z', updatedAt: '2026-10-22T00:01:00.000Z' } : null,
});
function setBaseline(branches = [branchA]) {
  tables.user_org_unit_access = branches.map(id => ({ user_id: actorId, tenant_id: tenantId, org_unit_id: id, relationship_id: `assignment-${id}` }));
  tables.org_units = branches.map(id => ({ id, tenant_id: tenantId, unit_type: 'branch', name: `Branch ${id}`, is_active: true }));
  tables.preschool_chain_course_branch_assignments = [{ tenant_id: tenantId, course_id: courseA, branch_id: branchA }];
  mockResolveContext.mockResolvedValue(context);
  mockListCourses.mockResolvedValue([{ id: courseA, tenantId, courseCode: 'C-A', title: 'Course A', status: 'active' }]);
  mockGetCourseDailyAttendance.mockResolvedValue([rosterItem('enroll-1', 'party-1', 'present'), rosterItem('enroll-2', 'party-2', null)]);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const table of Object.keys(tables)) delete tables[table];
  for (const table of Object.keys(counts)) delete counts[table];
  for (const table of Object.keys(errors)) delete errors[table];
  mockAssertDay.mockImplementation((_context: unknown, day: string) => { if (day !== '2026-10-22') throw new mockAttendanceAccessError(503, 'ATTENDANCE_HISTORICAL_SCOPE_UNAVAILABLE'); });
  setBaseline();
});

describe('/api/education/analytics branch scope', () => {
  it('uses only explicit persisted branch relationships and fails closed for an implicit projection', async () => {
    const response = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'));
    expect(response.status).toBe(200);
    const accessQuery = mockFrom.mock.results.find((result, index) => mockFrom.mock.calls[index][0] === 'user_org_unit_access')?.value;
    expect(accessQuery.not).toHaveBeenCalledWith('relationship_id', 'is', null);

    tables.user_org_unit_access = [{ user_id: actorId, tenant_id: tenantId, org_unit_id: branchA, relationship_id: null }];
    expect((await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'))).status).toBe(503);

    tables.user_org_unit_access = [];
    expect((await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'))).status).toBe(403);
  });

  it('returns only assigned active course roster counts and leaves unsupported domains null', async () => {
    const response = await GET(new Request('http://localhost/api/education/analytics?branchId=branch-a&date=2026-10-22'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, selectedBranchId: branchA, dashboard: {
      tenantId, enrollment: { totalEnrolledStudents: 2, totalClassrooms: 1, totalTeachers: null },
      attendance: { todayPresentCount: 1, todayAbsentCount: 0, todayLateCount: null, presentVsEnrolledRate: 50 },
      careAndSafety: { activeHealthIncidents: null, pendingMedicationDoses: null },
      finance: { invoicedGrossTotal: null, reconciledCashCollected: null, outstandingBalanceTotal: null, overdueAccountsCount: null },
      commandCenter: { unmarkedAttendanceCount: 1, leaveRequestsCount: null },
    } });
    expect(mockGetCourseDailyAttendance).toHaveBeenCalledWith({ tenantId, courseId: courseA, schoolDay: '2026-10-22' });
  });

  it('requires branch selection when the Admin has multiple accessible branches', async () => {
    setBaseline([branchA, branchB]);
    const response = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, selectedBranchId: null, dashboard: null, branches: [
      { id: branchA, name: `Branch ${branchA}` }, { id: branchB, name: `Branch ${branchB}` },
    ] });
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });

  it('denies a branch outside the current Platform access projection', async () => {
    const response = await GET(new Request('http://localhost/api/education/analytics?branchId=foreign&date=2026-10-22'));
    expect(response.status).toBe(403);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });

  it('fails closed when branch ACL or roster dependencies are incomplete', async () => {
    counts.user_org_unit_access = 2;
    const incompleteAcl = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'));
    expect(incompleteAcl.status).toBe(503);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();

    delete counts.user_org_unit_access;
    mockGetCourseDailyAttendance.mockRejectedValueOnce(new Error('roster denied'));
    const failedRoster = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-22'));
    expect(failedRoster.status).toBe(503);
  });

  it('rejects selector overrides and unsupported date ranges before reading roster', async () => {
    const override = await GET(new Request('http://localhost/api/education/analytics?tenantId=other&date=2026-10-22'));
    expect(override.status).toBe(403);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
    const oldDate = await GET(new Request('http://localhost/api/education/analytics?date=2026-10-21'));
    expect(oldDate.status).toBe(503);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });
});
