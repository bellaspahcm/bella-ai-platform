import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { DailyCareService } from '../care-wellbeing/daily-care/daily-care.service';

describe('Preschool Care reuses the public Attendance roster', () => {
  afterEach(() => jest.restoreAllMocks());
  function client() {
    const rows: Record<string, unknown> = { edu_courses: { id: 'course' }, tenants: { id: 'tenant', product_key: 'bella_preschool' }, edu_daily_care_sessions: null };
    const from = jest.fn((table: string) => {
      if (['students', 'party_parties', 'edu_enrollments'].includes(table)) throw new Error('DIRECT_IDENTITY_READ');
      const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), maybeSingle: jest.fn(async () => ({ data: rows[table], error: null })) };
      for (const method of [query.select, query.eq, query.in]) method.mockReturnValue(query);
      return query;
    });
    return { from };
  }
  it('maps only the public roster identity and does not read shared tables', async () => {
    const spy = jest.spyOn(AttendanceContractImpl.prototype, 'getCourseDailyAttendance').mockResolvedValue([
      { enrollmentId: 'enrollment', studentId: 'student', studentPartyId: 'party', studentCode: null, name: 'Child', gender: null, dob: null, enrollmentStatus: 'active', attendance: null },
    ]);
    const c = client();
    expect(await new DailyCareService(c as never).getDailyCareRoster('tenant', 'course', '2026-10-23')).toEqual([
      { enrollmentId: 'enrollment', studentPartyId: 'party', studentCode: null, name: 'Child', gender: null, dob: null, care: null },
    ]);
    expect(spy).toHaveBeenCalledWith({ tenantId: 'tenant', courseId: 'course', schoolDay: '2026-10-23' });
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['edu_courses', 'tenants', 'edu_daily_care_sessions']);
  });
  it('propagates public-contract denial without direct-table fallback', async () => {
    jest.spyOn(AttendanceContractImpl.prototype, 'getCourseDailyAttendance').mockRejectedValue(new Error('DENIED'));
    const c = client();
    await expect(new DailyCareService(c as never).getDailyCareRoster('tenant', 'course', '2026-10-23')).rejects.toThrow('DENIED');
    expect(c.from.mock.calls.map(([table]) => table)).toEqual(['edu_courses', 'tenants']);
  });
});
