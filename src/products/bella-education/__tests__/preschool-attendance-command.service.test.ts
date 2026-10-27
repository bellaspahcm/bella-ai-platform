import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EducationScopedAttendanceCommand } from '@/platform/education/contracts/attendance-command.contract.impl';
import { EducationAttendanceCommandError } from '@/platform/education/contracts/attendance-command.contract';
import { PreschoolAttendanceAccessService } from '../services/preschool-attendance-access.service';
import { PreschoolAttendanceCommandService, type PreschoolAttendanceCommandInput } from '../services/preschool-attendance-command.service';
import { PreschoolChainService } from '../services/preschool-chain.service';

const input: PreschoolAttendanceCommandInput = {
  tenantId: 'tenant-a', actorId: 'actor-a', actorRole: 'admin', enrollmentId: 'enrollment-a',
  status: 'present', schoolDay: '2026-10-23', rollCallTime: '2026-10-23T05:00:00.000Z',
};

function setup() {
  const access = jest.spyOn(PreschoolAttendanceAccessService.prototype, 'assertEnrollmentAccess').mockResolvedValue({
    id: input.enrollmentId, tenantId: input.tenantId, courseId: 'course-a', studentPartyId: 'student-a',
    status: 'active', enrolledAt: '2026-10-23T00:00:00.000Z',
  });
  const assignment = jest.spyOn(PreschoolChainService.prototype, 'getEnrollmentChain').mockResolvedValue({
    tenantId: input.tenantId, enrollmentId: input.enrollmentId, courseId: 'course-a', branchId: 'branch-a',
    requestId: 'request-a', assignedBy: input.actorId,
  });
  const productCommand = jest.spyOn(EducationScopedAttendanceCommand.prototype, 'setPreschoolDailyAttendance').mockResolvedValue({
    id: 'state-a', tenantId: input.tenantId, enrollmentId: input.enrollmentId, eventId: 'event-a',
    schoolDay: input.schoolDay, status: input.status, rollCallTime: input.rollCallTime,
    createdAt: input.rollCallTime, updatedAt: input.rollCallTime,
  });
  const genericCommand = jest.spyOn(EducationScopedAttendanceCommand.prototype, 'setDailyAttendance');
  const service = new PreschoolAttendanceCommandService({} as SupabaseClient<Database>);
  return { access, assignment, productCommand, genericCommand, service };
}

afterEach(() => jest.restoreAllMocks());

it('uses the Product transaction after preflight so assignment locks remain inside the write boundary', async () => {
  const fixture = setup();
  await expect(fixture.service.setDailyAttendance(input)).resolves.toMatchObject({ eventId: 'event-a' });
  expect(fixture.productCommand).toHaveBeenCalledWith({
    tenantId: input.tenantId, actorId: input.actorId, expectedRole: input.actorRole,
    enrollmentId: input.enrollmentId, branchId: 'branch-a', courseId: 'course-a', studentPartyId: 'student-a',
    status: input.status, schoolDay: input.schoolDay, rollCallTime: input.rollCallTime,
  });
  expect(fixture.genericCommand).not.toHaveBeenCalled();
});

it.each(['admin_staff', 'super_admin', 'accountant'])('rejects the unproven Preschool actor role %s before data lookup or commands', async actorRole => {
  const fixture = setup();
  await expect(fixture.service.setDailyAttendance({ ...input, actorRole }))
    .rejects.toMatchObject({ status: 403 });
  expect(fixture.access).not.toHaveBeenCalled();
  expect(fixture.productCommand).not.toHaveBeenCalled();
  expect(fixture.genericCommand).not.toHaveBeenCalled();
});

it('does not write when the canonical assignment disappeared during preflight', async () => {
  const fixture = setup();
  fixture.assignment.mockResolvedValue(null);
  await expect(fixture.service.setDailyAttendance(input)).rejects.toThrow('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
  expect(fixture.productCommand).not.toHaveBeenCalled();
  expect(fixture.genericCommand).not.toHaveBeenCalled();
});

it('propagates final authority denial after lock waits without retrying through the generic command', async () => {
  const fixture = setup();
  fixture.productCommand.mockRejectedValue(new EducationAttendanceCommandError('ATTENDANCE_CURRENT_ACCESS_DENIED', 403));
  await expect(fixture.service.setDailyAttendance(input)).rejects.toMatchObject({ status: 403 });
  expect(fixture.productCommand).toHaveBeenCalledTimes(1);
  expect(fixture.genericCommand).not.toHaveBeenCalled();
});
