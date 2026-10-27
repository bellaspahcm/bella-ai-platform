import type { EducationAttendanceStatus, EducationDailyAttendanceStateDTO } from './attendance.contract';

/** Trusted server only. Product must authorize the action and reconcile its
 * branch mapping; Education rechecks current identity/access after write locks. */
export interface ScopedDailyAttendanceInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly expectedRole: string;
  readonly branchId: string;
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly requestId: string;
  readonly status: EducationAttendanceStatus;
  readonly rollCallTime: string;
  readonly schoolDay: string;
}

export interface IEducationScopedAttendanceCommand {
  setDailyAttendance(input: ScopedDailyAttendanceInput): Promise<EducationDailyAttendanceStateDTO>;
}

/** Preschool's Product transaction locks and reconciles branch assignments;
 * its request ID is read under those locks rather than supplied by the caller. */
export type PreschoolScopedDailyAttendanceInput = Omit<ScopedDailyAttendanceInput, 'requestId'>;

export interface IEducationPreschoolAttendanceCommand {
  setPreschoolDailyAttendance(input: PreschoolScopedDailyAttendanceInput): Promise<EducationDailyAttendanceStateDTO>;
}

export class EducationAttendanceCommandError extends Error {
  public constructor(readonly code: string, readonly status: number) {
    super(code); this.name = 'EducationAttendanceCommandError';
  }
}

/** SQL/permission failures must never be converted into missing attendance. */
export function assertAttendanceCommandSuccess(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === '42501') throw new EducationAttendanceCommandError('ATTENDANCE_CURRENT_ACCESS_DENIED', 403);
  if (error.code === '23505') throw new EducationAttendanceCommandError('ATTENDANCE_CANONICAL_CONFLICT', 409);
  if (['22023', '22007', '22008', '22P02'].includes(error.code ?? '')) throw new EducationAttendanceCommandError('ATTENDANCE_INPUT_INVALID', 400);
  throw new Error(`ATTENDANCE_COMMAND_FAILED [${error.code ?? 'UNKNOWN'}]: ${error.message}`);
}

/** Validate the public SQL result before it reaches Product/UI callers. */
export function parseAttendanceCommandResult(value: unknown, expected: Pick<ScopedDailyAttendanceInput,
  'tenantId' | 'enrollmentId' | 'schoolDay' | 'status' | 'rollCallTime'>): EducationDailyAttendanceStateDTO {
  if (!Array.isArray(value) || value.length !== 1) throw new Error('ATTENDANCE_COMMAND_READBACK_INVALID');
  const row: unknown = value[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('ATTENDANCE_COMMAND_READBACK_INVALID');
  const data = row as Record<string, unknown>;
  const validUuid = (item: unknown): item is string => typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item);
  const validTime = (item: unknown): item is string => typeof item === 'string' && !Number.isNaN(Date.parse(item));
  if (!validUuid(data.tenant_id) || !validUuid(data.enrollment_id)
    || data.tenant_id.toLowerCase() !== expected.tenantId.toLowerCase()
    || data.enrollment_id.toLowerCase() !== expected.enrollmentId.toLowerCase()
    || data.school_day !== expected.schoolDay || data.status !== expected.status
    || !validTime(data.roll_call_time) || Date.parse(data.roll_call_time) !== Date.parse(expected.rollCallTime)) {
    throw new EducationAttendanceCommandError('ATTENDANCE_CANONICAL_CONFLICT', 409);
  }
  if (!validUuid(data.id) || !validUuid(data.event_id) || !validTime(data.created_at) || !validTime(data.updated_at)) {
    throw new Error('ATTENDANCE_COMMAND_READBACK_INVALID');
  }
  return { id: data.id, tenantId: data.tenant_id, enrollmentId: data.enrollment_id,
    schoolDay: expected.schoolDay, status: expected.status, eventId: data.event_id,
    rollCallTime: data.roll_call_time, createdAt: data.created_at, updatedAt: data.updated_at };
}
