import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { AttendanceCommandDatabase } from '@/types/education-attendance-command.database.types';
import { assertAttendanceCommandSuccess, parseAttendanceCommandResult,
  type IEducationScopedAttendanceCommand, type IEducationPreschoolAttendanceCommand,
  type PreschoolScopedDailyAttendanceInput, type ScopedDailyAttendanceInput } from './attendance-command.contract';

function assertCanonicalIds(input: PreschoolScopedDailyAttendanceInput): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![input.tenantId, input.actorId, input.branchId, input.enrollmentId, input.courseId, input.studentPartyId]
    .every(value => typeof value === 'string' && uuid.test(value))) {
    assertAttendanceCommandSuccess({ code: '22023', message: 'Canonical UUID required' });
  }
}

export class EducationScopedAttendanceCommand implements IEducationScopedAttendanceCommand, IEducationPreschoolAttendanceCommand {
  private readonly client: SupabaseClient<AttendanceCommandDatabase>;
  public constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('ATTENDANCE_EXPLICIT_TRUSTED_CLIENT_REQUIRED');
    this.client = client as unknown as SupabaseClient<AttendanceCommandDatabase>;
  }

  public async setDailyAttendance(input: ScopedDailyAttendanceInput) {
    assertCanonicalIds(input);
    const { data, error } = await this.client.rpc('edu_set_scoped_daily_attendance', {
      p_tenant_id: input.tenantId, p_actor_id: input.actorId, p_expected_role: input.expectedRole,
      p_branch_id: input.branchId, p_enrollment_id: input.enrollmentId, p_course_id: input.courseId,
      p_student_party_id: input.studentPartyId, p_request_id: input.requestId,
      p_status: input.status, p_roll_call_time: input.rollCallTime, p_school_day: input.schoolDay,
    });
    assertAttendanceCommandSuccess(error);
    return parseAttendanceCommandResult(data, input);
  }

  public async setPreschoolDailyAttendance(input: PreschoolScopedDailyAttendanceInput) {
    assertCanonicalIds(input);
    const { data, error } = await this.client.rpc('preschool_set_scoped_daily_attendance', {
      p_tenant_id: input.tenantId, p_actor_id: input.actorId, p_expected_role: input.expectedRole,
      p_branch_id: input.branchId, p_enrollment_id: input.enrollmentId, p_course_id: input.courseId,
      p_student_party_id: input.studentPartyId,
      p_status: input.status, p_roll_call_time: input.rollCallTime, p_school_day: input.schoolDay,
    });
    assertAttendanceCommandSuccess(error);
    return parseAttendanceCommandResult(data, input);
  }
}
