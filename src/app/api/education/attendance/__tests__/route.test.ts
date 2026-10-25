import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CourseDailyAttendanceRosterItem } from '@/platform/education/contracts/attendance.contract';

const mockGetUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockListCourses = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetEnrollment = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetCourseDailyAttendance = jest.fn<(...args: unknown[]) => Promise<readonly CourseDailyAttendanceRosterItem[]>>();
const mockSetDailyAttendance = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetAuthorizedGuardians = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetLatestHandovers = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFactory = jest.fn();
type Row = Record<string, unknown>;
interface QueryResult { data: Row[] | Row | null; error: { message: string } | null; count: number }
interface Query {
  select: (columns: string, options?: object) => Query;
  eq: (key: string, value: unknown) => Query;
  maybeSingle: () => Promise<QueryResult>;
  then: (resolve: (result: QueryResult) => unknown) => Promise<unknown>;
}
let mockTables: Record<string, Row[]>;
let mockFailures: Set<string>;
let mockTruncated: Set<string>;
const mockQueries: string[] = [];
function mockQuery(table: string): Query {
  mockQueries.push(table);
  let rows = [...(mockTables[table] ?? [])];
  const result = (single = false): QueryResult => ({
    data: single ? rows[0] ?? null : rows,
    error: mockFailures.has(table) ? { message: 'private database details secret-row@example.invalid' } : null,
    count: rows.length + (mockTruncated.has(table) ? 1 : 0),
  });
  const query: Query = {
    select: () => query,
    eq: (key, value) => { rows = rows.filter(row => row[key] === value); return query; },
    maybeSingle: async () => result(true),
    then: async resolve => resolve(result()),
  };
  return query;
}
const mockClient = { auth: { getUser: mockGetUser }, from: mockQuery };

jest.mock('@/lib/supabase-server', () => ({ createClient: () => { mockFactory(); return mockClient; } }));
jest.mock('@/platform/education/contracts/canonical-course-catalog.contract.impl', () => ({
  CanonicalCourseCatalogContractImpl: jest.fn().mockImplementation(() => ({ listCourses: mockListCourses })),
}));
jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({
  EnrollmentContractImpl: jest.fn().mockImplementation(() => ({ getEnrollment: mockGetEnrollment })),
}));
jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@/products/bella-education/services/attendance.service', () => ({
  AttendanceProductService: jest.fn().mockImplementation(() => ({
    getCourseDailyAttendance: mockGetCourseDailyAttendance, setDailyAttendance: mockSetDailyAttendance,
  })),
}));
jest.mock('@/products/bella-education/services/preschool-guardian-authorization.service', () => ({
  PreschoolGuardianAuthorizationService: jest.fn().mockImplementation(() => ({ getAuthorizedGuardians: mockGetAuthorizedGuardians })),
}));
jest.mock('@/products/bella-education/services/preschool-safe-pickup-handover.service', () => ({
  PreschoolSafePickupHandoverService: jest.fn().mockImplementation(() => ({ getLatestHandovers: mockGetLatestHandovers })),
}));
const { GET, POST } = require('../route') as typeof import('../route');
const { AttendanceContractImpl } = require('@/platform/education/contracts/attendance.contract.impl') as typeof import('@/platform/education/contracts/attendance.contract.impl');
const { CanonicalCourseCatalogContractImpl } = require('@/platform/education/contracts/canonical-course-catalog.contract.impl') as typeof import('@/platform/education/contracts/canonical-course-catalog.contract.impl');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const userId = '00000000-0000-0000-0000-000000000001';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const enrollmentId = '00000000-0000-0000-0000-0000000000ee';
const branchId = '00000000-0000-0000-0000-0000000000bb';
const studentPartyId = '00000000-0000-0000-0000-0000000000dd';
const foreignId = '00000000-0000-0000-0000-000000000099';
const day = '2026-10-21';
const enrollment = { id: enrollmentId, tenantId, courseId, studentPartyId, status: 'active', enrolledAt: '2026-10-20T00:00:00Z' };
const rosterItem: CourseDailyAttendanceRosterItem = {
  enrollmentId, studentId: 'student-1', studentPartyId, studentCode: 'STUDENT-1', name: 'Synthetic pupil',
  gender: null, dob: null, enrollmentStatus: 'active', attendance: null,
};
function post(body: object = {}, query = '', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/education/attendance${query}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ enrollmentId, status: 'present', date: day, ...body }) });
}
function get(query = '', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/education/attendance?courseId=${courseId}&date=${day}${query}`, { headers });
}
async function expectDenied(response: Response, status: number, code?: string): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const body = await response.json();
  expect(body.success).toBe(false);
  if (code) expect(body.error).toContain(code);
  expect(JSON.stringify(body)).not.toContain('secret-row');
  expect(mockSetDailyAttendance).not.toHaveBeenCalled();
}

describe('/api/education/attendance approved authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-10-21T06:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('NETWORK_FORBIDDEN'); });
    mockQueries.length = 0;
    mockFailures = new Set(); mockTruncated = new Set();
    mockTables = {
      users: [{ id: userId, tenant_id: tenantId, role: 'admin', status: 'active' }],
      tenants: [{ id: tenantId, product_key: 'bella_preschool', status: 'active' }],
      preschool_chain_course_branch_assignments: [{ tenant_id: tenantId, course_id: courseId, branch_id: branchId }],
      org_units: [{ id: branchId, tenant_id: tenantId, unit_type: 'branch', is_active: true }],
      user_org_unit_access: [{ user_id: userId, tenant_id: tenantId, org_unit_id: branchId }],
    };
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mockListCourses.mockResolvedValue([{ id: courseId, tenantId, courseCode: 'CLASS-1', title: 'Synthetic class', status: 'active' }]);
    mockGetEnrollment.mockResolvedValue(enrollment);
    mockGetCourseDailyAttendance.mockResolvedValue([]);
    mockSetDailyAttendance.mockResolvedValue({ id: 'state-1', tenantId, enrollmentId, schoolDay: day, status: 'present' });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map()); mockGetLatestHandovers.mockResolvedValue(new Map());
  });
  afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); jest.restoreAllMocks(); jest.useRealTimers(); });

  it('blocks parent users from reading the classroom attendance roster', async () => {
    mockTables.users[0].role = 'parent';
    await expectDenied(await GET(get()), 403, 'AUTH_ROLE_PERMISSION_ERROR');
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });
  it('reads the same authorized roster without querying pickup dependencies', async () => {
    mockGetCourseDailyAttendance.mockResolvedValue([rosterItem]);
    mockGetAuthorizedGuardians.mockRejectedValue(new Error('unrelated pickup dependency'));
    const result = await GET(get('&view=roster'));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ success: true, courseId, schoolDay: day, roster: [rosterItem] });
    expect(mockGetAuthorizedGuardians).not.toHaveBeenCalled();
    expect(mockGetLatestHandovers).not.toHaveBeenCalled();
    expect(mockSetDailyAttendance).not.toHaveBeenCalled();
  });
  it.each(['&view=roster&view=roster', '&view=invalid'])('rejects invalid roster modes before business reads: %s', async query => {
    await expectDenied(await GET(get(query)), 400, 'INVALID_ATTENDANCE_VIEW');
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });
  it('does not apply the new response mode to other Products', async () => {
    mockTables.tenants[0].product_key = 'bella_training';
    await expectDenied(await GET(get('&view=roster')), 403, 'ATTENDANCE_ROSTER_UNSUPPORTED_PRODUCT');
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });
  it('blocks accountant users from mutating daily attendance', async () => {
    mockTables.users[0].role = 'accountant';
    await expectDenied(await POST(post()), 403, 'AUTH_ROLE_PERMISSION_ERROR');
  });
  it('allows the approved Preschool admin through the same product service', async () => {
    const response = await POST(post()); const body = await response.json();
    expect(response.status).toBe(200); expect(body.success).toBe(true);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockSetDailyAttendance).toHaveBeenCalledWith({ tenantId, enrollmentId, status: 'present', rollCallTime: `${day}T05:00:00.000Z` });
    expect(AttendanceContractImpl).toHaveBeenCalledWith(mockClient);
    expect(CanonicalCourseCatalogContractImpl).toHaveBeenCalledWith(mockClient);
  });
  it('holds the former staff allowed case until authoritative teacher mapping exists', async () => {
    mockTables.users[0].role = 'admin_staff';
    await expectDenied(await POST(post()), 503, 'ATTENDANCE_TEACHER_IDENTITY_UNAVAILABLE');
    expect(mockGetEnrollment).not.toHaveBeenCalled();
  });
  it.each(['super_admin', 'student', 'hr', 'ktv', 'PRINCIPAL', 'Admin'])('does not invent Preschool alias %s', async role => {
    mockTables.users[0].role = role; await expectDenied(await POST(post()), 403);
  });
  it('verifies provider identity before profile or business access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    await expectDenied(await POST(post()), 401);
    expect(mockQueries).toEqual([]); expect(mockGetEnrollment).not.toHaveBeenCalled();
  });
  it('sanitizes provider exceptions', async () => {
    mockGetUser.mockRejectedValue(new Error('secret-row provider outage'));
    await expectDenied(await GET(get()), 503, 'ATTENDANCE_UNAVAILABLE');
  });
  it.each(['users', 'tenants'])('holds failed current identity lookup %s', async table => {
    mockFailures.add(table); await expectDenied(await POST(post()), 503, 'ATTENDANCE_IDENTITY_UNAVAILABLE');
  });
  it.each(['users', 'tenants'])('denies inactive %s', async table => {
    mockTables[table][0].status = 'inactive'; await expectDenied(await POST(post()), 403);
  });
  it('denies a missing or mismatched Auth-backed profile', async () => {
    mockTables.users[0].id = foreignId; await expectDenied(await POST(post()), 403);
  });
  it.each([
    `&tenantId=${tenantId}&tenantId=${foreignId}`, `&actorId=${foreignId}`, '&role=admin',
    `&courseId=${foreignId}`, '&date=2026-10-20',
  ])('rejects conflicting query selectors %s', async query => {
    await expectDenied(await GET(get(query)), 403);
    expect(mockGetCourseDailyAttendance).not.toHaveBeenCalled();
  });
  it.each(['x-role', 'x-mock-user-email', 'x-actor-id', 'x-tenant-id', 'x-user-id'])('rejects forged %s', async header => {
    await expectDenied(await POST(post({}, '', { [header]: foreignId })), 403);
  });
  it.each([{ tenantId: foreignId }, { actor_id: foreignId }, { role: 'admin' }, { nested: { userId: foreignId } }])('rejects body authority override %j', async body => {
    await expectDenied(await POST(post(body)), 403);
    expect(mockGetEnrollment).not.toHaveBeenCalled();
  });
  it.each(['2026-10-20', '2026-10-22'])('holds unsupported Preschool business day %s', async date => {
    await expectDenied(await POST(post({ date })), 503, 'ATTENDANCE_HISTORICAL_SCOPE_UNAVAILABLE');
    expect(mockGetEnrollment).not.toHaveBeenCalled();
  });
  it.each(['2026-02-30', 'not-a-date', '2026-13-01'])('rejects invalid date %s', async date => {
    await expectDenied(await POST(post({ date })), 400);
  });
  it.each(['invalid', '2026-10-20T16:59:59Z', '2026-10-21T17:00:00Z', ''])('rejects invalid or mismatched roll-call %s', async rollCallTime => {
    await expectDenied(await POST(post({ rollCallTime })), 400, 'INVALID_ROLL_CALL_TIME');
  });
  it('accepts the Vietnam day across its UTC boundary without rewriting the instant', async () => {
    const response = await POST(post({ rollCallTime: '2026-10-20T17:00:00Z' }));
    expect(response.status).toBe(200);
    expect(mockSetDailyAttendance).toHaveBeenCalledWith(expect.objectContaining({ rollCallTime: '2026-10-20T17:00:00.000Z' }));
  });
  it.each(['pending', 'completed', 'cancelled'])('denies non-active Preschool enrollment %s', async status => {
    mockGetEnrollment.mockResolvedValue({ ...enrollment, status }); await expectDenied(await POST(post()), 403);
  });
  it('denies enrollment created after the current business day', async () => {
    mockGetEnrollment.mockResolvedValue({ ...enrollment, enrolledAt: '2026-10-21T17:00:00Z' });
    await expectDenied(await POST(post()), 403);
  });
  it.each([null, { ...enrollment, tenantId: foreignId }, { ...enrollment, id: foreignId }])('denies absent/foreign enrollment %j', async value => {
    mockGetEnrollment.mockResolvedValue(value); await expectDenied(await POST(post()), 403);
  });
  it('holds canonical enrollment dependency failures without a privileged fallback', async () => {
    mockGetEnrollment.mockRejectedValue(new Error('secret-row RLS denied'));
    await expectDenied(await POST(post()), 503);
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });
  it('denies a foreign course selector before mutation', async () => {
    await expectDenied(await POST(post({ courseId: foreignId })), 403);
  });
  it('holds canonical catalog failures without an admin fallback', async () => {
    mockListCourses.mockRejectedValue(new Error('secret-row RLS denied'));
    await expectDenied(await POST(post()), 503);
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });
  it('denies an absent course', async () => { mockListCourses.mockResolvedValue([]); await expectDenied(await POST(post()), 403); });
  it.each(['missing', 'ambiguous', 'truncated'])('holds %s branch binding', async mode => {
    if (mode === 'missing') mockTables.preschool_chain_course_branch_assignments = [];
    else if (mode === 'ambiguous') mockTables.preschool_chain_course_branch_assignments.push({ tenant_id: tenantId, course_id: courseId, branch_id: foreignId });
    else mockTruncated.add('preschool_chain_course_branch_assignments');
    await expectDenied(await POST(post()), 503, 'ATTENDANCE_BRANCH_SCOPE_UNAVAILABLE');
  });
  it.each(['preschool_chain_course_branch_assignments', 'org_units', 'user_org_unit_access'])('holds failed scope lookup %s', async table => {
    mockFailures.add(table); await expectDenied(await POST(post()), 503);
  });
  it('denies inactive branch', async () => { mockTables.org_units[0].is_active = false; await expectDenied(await POST(post()), 403); });
  it('denies a mismatched branch selector', async () => { await expectDenied(await POST(post({ branchId: foreignId })), 403); });
  it('fails closed when the Platform projection returns no access', async () => {
    mockTables.user_org_unit_access = []; await expectDenied(await POST(post()), 403);
  });
  it('holds a truncated Platform access response', async () => { mockTruncated.add('user_org_unit_access'); await expectDenied(await POST(post()), 503); });
  it('returns only active eligible roster entries before guardian lookups', async () => {
    mockGetCourseDailyAttendance.mockResolvedValue([rosterItem, { ...rosterItem, enrollmentId: foreignId }]);
    mockGetEnrollment.mockResolvedValueOnce(enrollment).mockResolvedValueOnce({ ...enrollment, id: foreignId, status: 'pending' });
    const response = await GET(get()); const body = await response.json();
    expect(response.status).toBe(200); expect(body.roster).toHaveLength(1);
    expect(mockGetAuthorizedGuardians).toHaveBeenCalledWith(tenantId, [studentPartyId]);
    expect(mockGetLatestHandovers).toHaveBeenCalledWith(tenantId, [studentPartyId]);
  });
  it('holds inconsistent roster enrollment identity instead of returning partial data', async () => {
    mockGetCourseDailyAttendance.mockResolvedValue([rosterItem]);
    mockGetEnrollment.mockResolvedValue({ ...enrollment, studentPartyId: foreignId });
    await expectDenied(await GET(get()), 503);
    expect(mockGetAuthorizedGuardians).not.toHaveBeenCalled();
  });
  it.each(['guardians', 'handover'])('holds %s dependency failures without leaking details', async dependency => {
    (dependency === 'guardians' ? mockGetAuthorizedGuardians : mockGetLatestHandovers).mockRejectedValue(new Error('secret-row'));
    await expectDenied(await GET(get()), 503);
  });
  it('sanitizes mutation failures and never returns success', async () => {
    mockSetDailyAttendance.mockRejectedValue(new Error('secret-row SQL denied'));
    const response = await POST(post()); const body = await response.json();
    expect(response.status).toBe(503); expect(body).toEqual({ success: false, error: 'ATTENDANCE_UNAVAILABLE' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it.each(['admin_staff', 'super_admin'])('retains non-Preschool role %s and historical/pending semantics', async role => {
    mockTables.users[0].role = role; mockTables.tenants[0].product_key = 'bella_school';
    mockGetEnrollment.mockResolvedValue({ ...enrollment, status: 'pending' });
    const response = await POST(post({ date: '2026-10-06' }));
    expect(response.status).toBe(200);
    expect(mockSetDailyAttendance).toHaveBeenCalledWith(expect.objectContaining({ rollCallTime: '2026-10-06T05:00:00.000Z' }));
    expect(mockQueries).not.toContain('preschool_chain_course_branch_assignments');
  });
  it('rejects malformed authenticated JSON safely', async () => {
    await expectDenied(await POST(new Request('http://localhost/api/education/attendance', { method: 'POST', body: '{' })), 400);
  });
});
