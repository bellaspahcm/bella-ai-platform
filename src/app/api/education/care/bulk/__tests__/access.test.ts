import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DailyCareRosterItem, IBulkCareResult } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.contract';
import type { EducationEnrollmentDTO } from '@/platform/education/contracts/enrollment.contract';

type Row = Record<string, unknown>;
interface Profile { id: string; tenant_id: string | null; status: string; role: string; }
interface Result { data: Row[] | Row | null; error: { message: string } | null; }
const actorId = '00000000-0000-4000-8000-000000000011';
const tenantId = '00000000-0000-4000-8000-000000000022';
const courseId = '00000000-0000-4000-8000-000000000033';
const branchId = '00000000-0000-4000-8000-000000000044';
const studentId = '00000000-0000-4000-8000-000000000055';
const otherId = '00000000-0000-4000-8000-000000000066';
const enrollmentId = '00000000-0000-4000-8000-000000000077';
const date = '2026-10-21';
const profile: Profile = { id: actorId, tenant_id: tenantId, status: 'active', role: 'admin' };
const rosterItem: DailyCareRosterItem = { enrollmentId, studentPartyId: studentId, studentCode: 'SYNTHETIC', name: 'Synthetic child', gender: null, dob: null, care: null };
const enrollment: EducationEnrollmentDTO = { id: enrollmentId, tenantId, courseId, studentPartyId: studentId, status: 'active', enrolledAt: '2026-10-01T00:00:00Z' };
const result: IBulkCareResult = { requested: 1, committed: 1, blocked: 0, successfulStudentPartyIds: [studentId], exceptions: [] };
let tables: Record<string, Row[]>;
let errors: Record<string, string>;
let writes: Array<{ table: string; operation: string; value: Row }>;

class Query {
  private filters: Array<readonly [string, unknown]> = [];
  private operation = 'read';
  private value: Row = {};
  constructor(private table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
  insert(value: Row) { this.operation = 'insert'; this.value = value; return this; }
  update(value: Row) { this.operation = 'update'; this.value = value; return this; }
  private execute(single: boolean): Result {
    if (errors[this.table]) return { data: null, error: { message: errors[this.table] } };
    const rows = (tables[this.table] ?? []).filter(row => this.filters.every(([key, value]) => row[key] === value));
    if (this.operation !== 'read') {
      writes.push({ table: this.table, operation: this.operation, value: this.value });
      if (this.operation === 'insert') {
        const row = { id: 'synthetic-created', ...this.value };
        (tables[this.table] ??= []).push(row);
        return { data: single ? row : [row], error: null };
      }
      for (const row of rows) Object.assign(row, this.value);
    }
    if (single && rows.length > 1) return { data: null, error: { message: 'ambiguous synthetic lookup' } };
    return { data: single ? rows[0] ?? null : rows, error: null };
  }
  maybeSingle() { return Promise.resolve(this.execute(true)); }
  single() { return Promise.resolve(this.execute(true)); }
  then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(this.execute(false)).then(resolve, reject); }
}

const mockGetUser = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockProfile = jest.fn<() => Promise<Profile | null>>();
const mockFrom = jest.fn((table: string) => new Query(table));
const mockClient = { auth: { getUser: mockGetUser }, from: mockFrom };
const mockRoster = jest.fn<() => Promise<readonly DailyCareRosterItem[]>>();
const mockEnrollment = jest.fn<() => Promise<EducationEnrollmentDTO | null>>();
const mockArrival = jest.fn<() => Promise<IBulkCareResult>>();
const mockMeal = jest.fn<() => Promise<IBulkCareResult>>();
const mockNap = jest.fn<() => Promise<IBulkCareResult>>();
const mockHygiene = jest.fn<() => Promise<IBulkCareResult>>();
const mockService = jest.fn(() => ({ getDailyCareRoster: mockRoster, recordBulkArrival: mockArrival, recordBulkMeals: mockMeal, recordBulkNap: mockNap, recordBulkHygiene: mockHygiene }));
const mockEnrollmentContract = jest.fn(() => ({ getEnrollment: mockEnrollment }));
const mockPrivilegedClient = jest.fn();

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockProfile }));
jest.mock('@/products/bella-education/care-wellbeing/daily-care/daily-care.service', () => ({ DailyCareService: mockService }));
jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({ EnrollmentContractImpl: mockEnrollmentContract }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockPrivilegedClient }));
const { GET, POST } = require('../route') as typeof import('../route');

const actionData = {
  arrival: { arrivals: [{ studentPartyId: studentId, status: 'PRESENT', condition: 'GOOD' }] },
  meal: { students: [{ studentPartyId: studentId, portion: 'HALF' }], mealType: 'LUNCH' },
  nap: { napEntries: [{ studentPartyId: studentId, quality: 'DEEP' }] },
  hygiene: { hygieneEntries: [{ studentPartyId: studentId, type: 'TOILET' }] },
  save_care: { records: [{ studentPartyId: studentId, meal: { portion: 'HALF' }, note: 'synthetic note' }] },
};
function post(action: keyof typeof actionData = 'arrival', data: unknown = actionData[action], extra: Row = {}, query = '', headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/education/care/bulk${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action, courseId, date, data, ...extra }) });
}
function get(query = '', schoolDay = date) { return new Request(`http://localhost/api/education/care/bulk?courseId=${courseId}&date=${schoolDay}${query}`); }
function expectNoMutation() {
  expect(writes).toEqual([]);
  for (const fn of [mockArrival, mockMeal, mockNap, mockHygiene, mockPrivilegedClient]) expect(fn).not.toHaveBeenCalled();
}
async function denied(request: Request, status: number, error: string) {
  const response = await (request.method === 'POST' ? POST(request) : GET(request));
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ success: false, error });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expectNoMutation();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-21T05:00:00.000Z'));
  jest.clearAllMocks();
  errors = {}; writes = [];
  tables = {
    tenants: [{ id: tenantId, status: 'active', product_key: 'bella_preschool' }],
    preschool_chain_course_branch_assignments: [{ tenant_id: tenantId, course_id: courseId, branch_id: branchId }],
    org_units: [{ id: branchId, tenant_id: tenantId, unit_type: 'branch', is_active: true }],
    user_org_unit_access: [{ user_id: actorId, tenant_id: tenantId, org_unit_id: branchId }],
    edu_attendance_daily_state: [],
    edu_daily_care_sessions: [{ id: 'session', tenant_id: tenantId, class_id: courseId, date }],
    edu_daily_care_records: [{ id: 'record', tenant_id: tenantId, session_id: 'session', student_party_id: studentId, health_checks: { status: 'historical-observation' } }],
  };
  mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockProfile.mockResolvedValue(profile);
  mockRoster.mockResolvedValue([rosterItem]);
  mockEnrollment.mockResolvedValue(enrollment);
  for (const fn of [mockArrival, mockMeal, mockNap, mockHygiene]) fn.mockResolvedValue(result);
});

afterEach(() => { jest.useRealTimers(); });

describe('Care identity and Product boundary', () => {
  it('rejects anonymous spoofing before profile, payload or data access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const request = post('arrival', undefined, {}, `?tenantId=${tenantId}`, { 'x-mock-role': 'admin', 'x-mock-user-email': 'synthetic@example.invalid', Cookie: 'mock_user_email=synthetic@example.invalid' });
    const readBody = jest.spyOn(request, 'json');
    await denied(request, 401, 'CARE_UNAUTHENTICATED');
    expect(readBody).not.toHaveBeenCalled(); expect(mockProfile).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
  });
  it('rejects invalid Auth even with a subject', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: { message: 'invalid token' } });
    await denied(get(), 401, 'CARE_UNAUTHENTICATED'); expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each([null, { ...profile, id: otherId }, { ...profile, status: 'inactive' }, { ...profile, tenant_id: null }])('rejects missing, inactive or unbound profile %#', async invalid => {
    mockProfile.mockResolvedValue(invalid); await denied(get(), 403, 'CARE_ACCESS_DENIED');
  });
  it.each(['parent', 'student', 'accountant', 'hr', 'ktv', 'super_admin', 'teacher', ''])('rejects unapproved live role %s despite admin header', async role => {
    mockProfile.mockResolvedValue({ ...profile, role }); await denied(post('arrival', undefined, {}, '', { 'x-mock-role': 'admin' }), 403, 'CARE_ROLE_DENIED');
  });
  it.each(['inactive', 'wrong product', 'missing tenant'])('rejects %s', async state => {
    if (state === 'inactive') tables.tenants[0].status = 'suspended';
    else if (state === 'wrong product') tables.tenants[0].product_key = 'bella_training';
    else tables.tenants = [];
    await denied(get(), 403, 'CARE_PRODUCT_ACCESS_DENIED');
  });
  it('keeps admin_staff unavailable instead of assuming Auth is teacher Party', async () => {
    mockProfile.mockResolvedValue({ ...profile, role: 'admin_staff' });
    await denied(post(), 503, 'CARE_TEACHER_IDENTITY_UNAVAILABLE'); expect(mockRoster).not.toHaveBeenCalled();
  });
  it.each([`?tenantId=${otherId}`, `?tenantId=${tenantId}&tenantId=${otherId}`, '?tenantId=', `?actorId=${otherId}`])('rejects identity selector %s', async query => {
    await denied(post('arrival', undefined, {}, query), 403, 'CARE_CONTEXT_OVERRIDE_DENIED');
  });
  it.each([{ tenantId: otherId }, { actorId: otherId }, { data: { ...actionData.arrival, tenant_id: otherId } }, { role: 'admin' }])('rejects body identity overrides %#', async extra => {
    await denied(post('arrival', undefined, extra), 403, 'CARE_CONTEXT_OVERRIDE_DENIED');
  });
  it('fails lookup errors closed without leaking database detail', async () => {
    errors.tenants = 'sensitive synthetic diagnostic'; await denied(post(), 503, 'CARE_IDENTITY_UNAVAILABLE');
  });
});

describe('Care branch and active enrollment resource boundary', () => {
  it.each(['2026-10-20', '2026-10-22'])('holds GET for other school day %s without service data or writes', async schoolDay => {
    await denied(get('', schoolDay), 503, 'CARE_HISTORICAL_SCOPE_UNAVAILABLE');
    expect(mockService).not.toHaveBeenCalled(); expect(mockRoster).not.toHaveBeenCalled(); expect(mockEnrollment).not.toHaveBeenCalled();
  });
  it.each(['2026-10-20', '2026-10-22'])('holds POST for other school day %s without service data or writes', async schoolDay => {
    await denied(post('arrival', undefined, { date: schoolDay }), 503, 'CARE_HISTORICAL_SCOPE_UNAVAILABLE');
    expect(mockService).not.toHaveBeenCalled(); expect(mockRoster).not.toHaveBeenCalled(); expect(mockEnrollment).not.toHaveBeenCalled();
  });
  it('uses the Vietnam school day when the UTC date is still the previous day', async () => {
    jest.setSystemTime(new Date('2026-10-20T18:00:00.000Z'));
    const response = await GET(get());
    expect(response.status).toBe(200); expect(mockRoster).toHaveBeenCalledTimes(1); expectNoMutation();
  });
  it('denies enrollment at the next Vietnam school-day boundary even while UTC is the prior day', async () => {
    mockEnrollment.mockResolvedValue({ ...enrollment, enrolledAt: '2026-10-21T17:00:00.000Z' });
    await denied(post(), 403, 'CARE_STUDENT_ACCESS_DENIED');
  });
  it('allows the final millisecond within the Vietnam school day', async () => {
    mockEnrollment.mockResolvedValue({ ...enrollment, enrolledAt: '2026-10-21T16:59:59.999Z' });
    const response = await POST(post());
    expect(response.status).toBe(200); expect(mockArrival).toHaveBeenCalledTimes(1);
  });
  it.each(['missing mapping', 'ambiguous mapping', 'foreign course'])('holds %s', async state => {
    if (state === 'missing mapping') tables.preschool_chain_course_branch_assignments = [];
    else if (state === 'ambiguous mapping') tables.preschool_chain_course_branch_assignments.push({ ...tables.preschool_chain_course_branch_assignments[0], branch_id: otherId });
    else tables.preschool_chain_course_branch_assignments[0].course_id = otherId;
    await denied(post(), 503, 'CARE_BRANCH_SCOPE_UNAVAILABLE'); expect(mockRoster).not.toHaveBeenCalled();
  });
  it.each(['inactive branch', 'foreign branch', 'not branch', 'ungranted branch'])('denies %s', async state => {
    if (state === 'inactive branch') tables.org_units[0].is_active = false;
    else if (state === 'foreign branch') tables.org_units[0].tenant_id = otherId;
    else if (state === 'not branch') tables.org_units[0].unit_type = 'department';
    else tables.user_org_unit_access = [];
    await denied(post(), 403, 'CARE_BRANCH_ACCESS_DENIED'); expect(mockRoster).not.toHaveBeenCalled();
  });
  it.each(['preschool_chain_course_branch_assignments', 'org_units', 'user_org_unit_access'])('holds failing lookup %s', async table => {
    errors[table] = 'RLS/schema synthetic denial'; await denied(post(), 503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
  });
  it('rejects caller-selected foreign branch', async () => { await denied(post('arrival', undefined, { branchId: otherId }), 403, 'CARE_CONTEXT_OVERRIDE_DENIED'); });
  it.each(['pending', 'completed', 'cancelled', 'foreign tenant', 'foreign course', 'wrong student', 'missing', 'after school day'])('denies student with %s enrollment', async state => {
    const candidate = { ...enrollment };
    if (state === 'foreign tenant') candidate.tenantId = otherId;
    else if (state === 'foreign course') candidate.courseId = otherId;
    else if (state === 'wrong student') candidate.studentPartyId = otherId;
    else if (state === 'after school day') candidate.enrolledAt = '2026-10-22T00:00:00Z';
    else if (state === 'pending' || state === 'completed' || state === 'cancelled') candidate.status = state;
    mockEnrollment.mockResolvedValue(state === 'missing' ? null : candidate);
    await denied(post(), 403, 'CARE_STUDENT_ACCESS_DENIED');
  });
  it('holds enrollment contract failure with no writes', async () => {
    mockEnrollment.mockRejectedValueOnce(new Error('RLS diagnostic')); await denied(post(), 503, 'CARE_ENROLLMENT_SCOPE_UNAVAILABLE');
  });
  it('rejects all of a mixed bulk before the first authorized student is mutated', async () => {
    await denied(post('arrival', { arrivals: [{ studentPartyId: studentId }, { studentPartyId: otherId }] }), 403, 'CARE_STUDENT_ACCESS_DENIED');
  });
  it('does not silently drop a bulk entry missing identity', async () => {
    await denied(post('arrival', { arrivals: [{ studentPartyId: studentId }, {}] }), 403, 'CARE_STUDENT_ACCESS_DENIED');
  });
  it('filters pending students from GET without changing the allowed projection', async () => {
    mockRoster.mockResolvedValue([rosterItem, { ...rosterItem, enrollmentId: otherId, studentPartyId: otherId }]);
    mockEnrollment.mockResolvedValueOnce(enrollment).mockResolvedValueOnce({ ...enrollment, id: otherId, studentPartyId: otherId, status: 'pending' });
    const response = await GET(get());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, roster: [{ ...rosterItem, attendance: null, attendanceNote: null }] });
    expect(mockService).toHaveBeenCalledWith(mockClient); expect(mockEnrollmentContract).toHaveBeenCalledWith(mockClient);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expectNoMutation();
  });
});

describe('Care permitted operations and health-policy hold', () => {
  it.each(['arrival', 'meal', 'nap', 'hygiene'] as const)('preserves permitted admin %s result via the same session client', async action => {
    const response = await POST(post(action));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, result });
    const mutation = { arrival: mockArrival, meal: mockMeal, nap: mockNap, hygiene: mockHygiene }[action];
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ tenantId, courseId, date }));
    expect(mockService).toHaveBeenCalledWith(mockClient); expect(mockPrivilegedClient).not.toHaveBeenCalled();
    expect(mockGetUser.mock.invocationCallOrder[0]).toBeLessThan(mockProfile.mock.invocationCallOrder[0]);
  });
  it.each([{ status: 'normal', isAlert: false }, {}, null])('holds any health input before resource writes %#', async health => {
    await denied(post('save_care', { records: [{ studentPartyId: studentId, meal: { portion: 'HALF' }, health }] }), 503, 'CARE_HEALTH_POLICY_UNAVAILABLE');
  });
  it('preserves historical health_checks on a nonhealth update', async () => {
    const response = await POST(post('save_care'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, savedCount: 1, total: 1 });
    expect(writes).toHaveLength(1); expect(writes[0].operation).toBe('update');
    expect(writes[0].value).not.toHaveProperty('health_checks');
    expect(tables.edu_daily_care_records[0].health_checks).toEqual({ status: 'historical-observation' });
  });
  it('omits clinical results when creating a new nonhealth record', async () => {
    tables.edu_daily_care_records = [];
    const response = await POST(post('save_care'));
    expect(response.status).toBe(200); expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: 'edu_daily_care_records', operation: 'insert' });
    expect(writes[0].value).not.toHaveProperty('health_checks');
  });
  it('fails an existing-record lookup instead of treating error as permission to insert', async () => {
    errors.edu_daily_care_records = 'RLS denied'; await denied(post('save_care'), 503, 'CARE_DATA_UNAVAILABLE');
  });
});
