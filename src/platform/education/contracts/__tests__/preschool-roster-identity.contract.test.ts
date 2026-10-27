import { AttendanceContractImpl } from '../attendance.contract.impl';

const tenantId = '10000000-0000-4000-8000-000000000001';
const courseId = '10000000-0000-4000-8000-000000000002';
const enrollmentId = '10000000-0000-4000-8000-000000000003';
const studentId = '10000000-0000-4000-8000-000000000004';
const studentPartyId = '10000000-0000-4000-8000-000000000005';
const schoolDay = '2026-10-23';
const identity = { enrollmentId, studentId, studentPartyId, studentCode: null, name: 'Child', gender: null, dob: null, enrollmentStatus: 'active' };
const envelope = { tenantId, courseId, schoolDay, roster: [identity] };
type Result = { data: unknown; error: unknown };
function client(product = 'bella_preschool') {
  const results: Record<string, Result> = {
    tenants: { data: { id: tenantId, product_key: product }, error: null },
    edu_attendance_daily_state: { data: [], error: null },
    edu_enrollments: { data: [{ id: enrollmentId, tenant_id: tenantId, course_id: courseId, student_party_id: studentPartyId, status: 'pending' }], error: null },
    students: { data: [{ student_id: studentId, party_id: studentPartyId, student_code: null }], error: null },
    party_parties: { data: [{ id: studentPartyId, display_name: 'Legacy child', gender: null, dob: null }], error: null },
  };
  const from = jest.fn((table: string) => {
    const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), maybeSingle: jest.fn(async () => results[table]),
      then: (resolve: (result: Result) => void) => Promise.resolve(results[table]).then(resolve) };
    for (const method of [query.select, query.eq, query.in]) method.mockReturnValue(query);
    return query;
  });
  return { from, rpc: jest.fn().mockResolvedValue({ data: envelope, error: null }), results };
}
const read = (c: ReturnType<typeof client>) => new AttendanceContractImpl(c as never).getCourseDailyAttendance({ tenantId, courseId, schoolDay });

describe('approved Preschool roster identity capability', () => {
  it('uses caller RPC and daily projection without direct Student/Party reads', async () => {
    const c = client();
    expect(await read(c)).toEqual([{ ...identity, attendance: null }]);
    expect(c.rpc).toHaveBeenCalledWith('edu_preschool_roster_identity', { p_course_id: courseId, p_school_day: schoolDay });
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['tenants', 'edu_attendance_daily_state']);
  });
  it('uses the trusted current-tenant product context without selecting tenants as the caller', async () => {
    const c = client();
    const contract = new AttendanceContractImpl(c as never, 'bella_preschool');
    expect(await contract.getCourseDailyAttendance({ tenantId, courseId, schoolDay })).toEqual([{ ...identity, attendance: null }]);
    expect(c.rpc).toHaveBeenCalledWith('edu_preschool_roster_identity', { p_course_id: courseId, p_school_day: schoolDay });
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['edu_attendance_daily_state']);
  });
  it('keeps an explicit unclassified product key distinct from missing context', async () => {
    const c = client();
    const contract = new AttendanceContractImpl(c as never, null);
    await contract.getCourseDailyAttendance({ tenantId, courseId, schoolDay });
    expect(c.from.mock.calls.map(([table]) => table)).not.toContain('tenants');
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('retains existing generic pending roster path outside Preschool', async () => {
    const c = client('bella_english_center');
    expect(await read(c)).toEqual([expect.objectContaining({ name: 'Legacy child', enrollmentStatus: 'pending' })]);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['tenants', 'edu_enrollments', 'students', 'party_parties', 'edu_attendance_daily_state']);
  });
  it('fails closed on RPC authorization/transport error with no legacy fallback', async () => {
    const c = client(); c.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(read(c)).rejects.toThrow('ATTENDANCE_ROSTER_IDENTITY_UNAVAILABLE');
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['tenants']);
  });
  it.each([
    null, { ...envelope, tenantId: courseId }, { ...envelope, courseId: tenantId }, { ...envelope, schoolDay: '2026-10-22' },
    { ...envelope, roster: [identity, identity] }, { ...envelope, roster: [{ ...identity, bloodType: 'private' }] },
    { ...envelope, roster: [{ ...identity, enrollmentStatus: 'pending' }] }, { ...envelope, roster: [{ ...identity, name: ' ' }] },
  ])('rejects malformed, mismatched or overbroad RPC response %#', async data => {
    const c = client(); c.rpc.mockResolvedValue({ data, error: null });
    await expect(read(c)).rejects.toThrow('ATTENDANCE_ROSTER_IDENTITY_UNAVAILABLE');
  });
  it('does not query daily state for an empty authorized roster', async () => {
    const c = client(); c.rpc.mockResolvedValue({ data: { ...envelope, roster: [] }, error: null });
    expect(await read(c)).toEqual([]); expect(c.from).toHaveBeenCalledTimes(1);
  });
  it.each([
    { tenant_id: courseId, enrollment_id: enrollmentId, school_day: schoolDay },
    { tenant_id: tenantId, enrollment_id: courseId, school_day: schoolDay },
    { tenant_id: tenantId, enrollment_id: enrollmentId, school_day: '2026-10-22' },
  ])('rejects mismatched daily projection %#', async state => {
    const c = client(); c.results.edu_attendance_daily_state = { data: [state], error: null };
    await expect(read(c)).rejects.toThrow('ATTENDANCE_DAILY_STATE_UNAVAILABLE');
  });
});
