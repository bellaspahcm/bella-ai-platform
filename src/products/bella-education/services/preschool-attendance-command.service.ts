import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { EducationScopedAttendanceCommand } from '@/platform/education/contracts/attendance-command.contract.impl';
import { PreschoolAttendanceAccessService } from './preschool-attendance-access.service';
import { PreschoolChainError, PreschoolChainService } from './preschool-chain.service';

export interface PreschoolAttendanceCommandInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly enrollmentId: string;
  readonly status: EducationAttendanceStatus;
  readonly rollCallTime: string;
  readonly schoolDay: string;
}

/** Product transaction owns assignment locks and action policy. Its call to
 * the Education public SQL command performs final authority checks after waits. */
export class PreschoolAttendanceCommandService {
  public constructor(private readonly client: SupabaseClient<Database>) {
    if (!client) throw new Error('ATTENDANCE_EXPLICIT_TRUSTED_CLIENT_REQUIRED');
  }

  public async setDailyAttendance(input: PreschoolAttendanceCommandInput) {
    // Preschool has no canonical Auth-to-teacher assignment yet. Branch
    // membership alone cannot turn a staff profile into an attendance actor.
    if (input.actorRole !== 'admin') {
      throw new PreschoolChainError('PRESCHOOL_ATTENDANCE_ACTION_DENIED', 403);
    }
    const enrollment = await new PreschoolAttendanceAccessService(this.client)
      .assertEnrollmentAccess(input.tenantId, input.actorId, input.enrollmentId);
    const assignment = await new PreschoolChainService(this.client).getEnrollmentChain(input.tenantId, input.enrollmentId);
    if (!assignment || assignment.courseId !== enrollment.courseId) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }
    return new EducationScopedAttendanceCommand(this.client).setPreschoolDailyAttendance({
      tenantId: input.tenantId, actorId: input.actorId, expectedRole: input.actorRole,
      branchId: assignment.branchId, enrollmentId: enrollment.id, courseId: enrollment.courseId,
      studentPartyId: enrollment.studentPartyId,
      status: input.status, rollCallTime: input.rollCallTime, schoolDay: input.schoolDay,
    });
  }
}
