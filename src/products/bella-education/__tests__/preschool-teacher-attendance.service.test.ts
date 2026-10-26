import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PartyAuthLinkContractImpl } from '@/platform/party/auth-link.contract.impl';
import { AttendanceProductService } from '../services/attendance.service';
import { PreschoolTeacherAttendanceService } from '../services/preschool-teacher-attendance.service';

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const courseId = '10000000-0000-4000-8000-000000000003';
const branchId = '10000000-0000-4000-8000-000000000004';
const enrollmentId = '10000000-0000-4000-8000-000000000005';
const partyId = '10000000-0000-4000-8000-000000000006';
const schoolDay = '2026-10-26';
const course = { courseId, branchId, name: 'Assigned class' };
const input = { tenantId, actorId, actorRole: 'admin_staff', enrollmentId,
  schoolDay, status: 'present' as const, rollCallTime: `${schoolDay}T05:00:00.000Z` };

function setup() {
  const identity = jest.spyOn(PartyAuthLinkContractImpl.prototype, 'resolveCurrent').mockResolvedValue({
    id: partyId, tenantId, authUserId: actorId, partyId, validFrom: input.rollCallTime, validUntil: null,
  });
  const rpc = jest.fn().mockResolvedValue({ data: { tenantId, actorId, schoolDay, courses: [course] }, error: null });
  const roster = jest.spyOn(AttendanceProductService.prototype, 'getCourseDailyAttendance').mockResolvedValue([{
    enrollmentId, studentPartyId: partyId, studentId: partyId, studentCode: null, name: 'Synthetic child',
    gender: null, dob: null, enrollmentStatus: 'active', attendance: null,
  }]);
  const write = jest.spyOn(AttendanceProductService.prototype, 'setDailyAttendance').mockResolvedValue({
    id: partyId, tenantId, enrollmentId, schoolDay, status: 'present', eventId: partyId,
    rollCallTime: input.rollCallTime, createdAt: input.rollCallTime, updatedAt: input.rollCallTime,
  });
  const service = new PreschoolTeacherAttendanceService({ rpc } as unknown as SupabaseClient<Database>);
  return { identity, rpc, roster, write, service };
}
afterEach(() => jest.restoreAllMocks());
it('lists validated Product courses using only the caller identity', async () => {
  const h = setup();
  expect(await h.service.listCourses(tenantId, actorId, schoolDay, branchId)).toEqual([course]);
  expect(h.identity).toHaveBeenCalledWith();
  expect(h.rpc).toHaveBeenCalledWith('preschool_teacher_attendance_courses', { p_school_day: schoolDay, p_branch_id: branchId });
});
it.each([null, { tenantId: branchId, authUserId: actorId }, { tenantId, authUserId: branchId }])('denies missing/mismatched identity %j', async identity => {
  const h = setup(); h.identity.mockResolvedValue(identity as Awaited<ReturnType<PartyAuthLinkContractImpl['resolveCurrent']>>);
  await expect(h.service.listCourses(tenantId, actorId, schoolDay)).rejects.toMatchObject({ status: 403 });
  expect(h.rpc).not.toHaveBeenCalled();
});
it.each([{ tenantId: branchId }, { actorId: branchId }, { schoolDay: '2020-01-01' },
  { courses: [{ ...course, branchId: 'invalid' }] }, { courses: [course, course] }])('rejects invalid/cross-scope result %j', async delta => {
  const h = setup(); h.rpc.mockResolvedValue({ data: { tenantId, actorId, schoolDay, courses: [course], ...delta }, error: null });
  await expect(h.service.listCourses(tenantId, actorId, schoolDay)).rejects.toMatchObject({ status: 503 });
  expect(h.roster).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled();
});
it('writes after class and roster reconciliation', async () => {
  const h = setup(); await h.service.setDailyAttendance(input);
  expect(h.write).toHaveBeenCalledWith(input);
  expect(h.roster.mock.invocationCallOrder[0]).toBeLessThan(h.write.mock.invocationCallOrder[0]);
});
it('denies an unassigned class before reading roster or writing', async () => {
  const h = setup(); h.rpc.mockResolvedValue({ data: { tenantId, actorId, schoolDay, courses: [] }, error: null });
  await expect(h.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 403 });
  expect(h.roster).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled();
});
it('denies enrollment absent from the authorized roster', async () => {
  const h = setup(); h.roster.mockResolvedValue([]);
  await expect(h.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 403 });
  expect(h.write).not.toHaveBeenCalled();
});
it('maps post-wait revocation denial to 403', async () => {
  const h = setup(); h.write.mockRejectedValue(new Error('Failed to set daily attendance: ATTENDANCE_ACCESS_DENIED'));
  await expect(h.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 403 });
});
it('checks the resolved course/branch selector before calling the writer', async () => {
  const h = setup(); const guard = jest.fn(() => { throw new Error('SELECTOR_MISMATCH'); });
  await expect(h.service.setDailyAttendance(input, guard)).rejects.toThrow('SELECTOR_MISMATCH');
  expect(guard).toHaveBeenCalledWith(course); expect(h.write).not.toHaveBeenCalled();
});
it.each([{ tenantId: branchId }, { enrollmentId: branchId }, { schoolDay: '2020-01-01' },
  { status: 'absent' as const }, { rollCallTime: '2020-01-01T05:00:00.000Z' }])('rejects a mismatched receipt %j without retry', async delta => {
  const h = setup(); const receipt = await h.write.getMockImplementation()?.(input);
  h.write.mockResolvedValue({ ...receipt!, ...delta });
  await expect(h.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 409 });
  expect(h.write).toHaveBeenCalledTimes(1);
});
it('keeps lookup errors unavailable with no fallback write', async () => {
  const h = setup(); h.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
  await expect(h.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 503 });
  expect(h.write).not.toHaveBeenCalled();
});
