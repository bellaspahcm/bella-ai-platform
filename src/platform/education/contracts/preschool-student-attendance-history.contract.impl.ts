import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationAttendanceDTO, EducationAttendanceStatus } from './attendance.contract';
import type { IPreschoolStudentAttendanceHistoryContract } from './preschool-student-attendance-history.contract';

interface HistoryRpcClient {
  rpc(name: 'edu_preschool_admin_student_attendance_history', args: { p_enrollment_id: string }): PromiseLike<{
    data: unknown; error: unknown;
  }>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class PreschoolStudentAttendanceHistoryContractImpl implements IPreschoolStudentAttendanceHistoryContract {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getAuthorizedHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]> {
    if (!uuid.test(tenantId) || !uuid.test(enrollmentId)) throw new Error('PRESCHOOL_HISTORY_INVALID_REQUEST');
    let result: Awaited<ReturnType<HistoryRpcClient['rpc']>>;
    try {
      result = await (this.client as unknown as HistoryRpcClient)
        .rpc('edu_preschool_admin_student_attendance_history', { p_enrollment_id: enrollmentId });
    } catch {
      throw new Error('PRESCHOOL_HISTORY_UNAVAILABLE');
    }
    if (result.error || !Array.isArray(result.data) || result.data.length >= 1000) {
      throw new Error('PRESCHOOL_HISTORY_UNAVAILABLE');
    }
    const ids = new Set<string>();
    return result.data.map((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRESCHOOL_HISTORY_UNAVAILABLE');
      const row = value as Record<string, unknown>;
      if (typeof row.id !== 'string' || !uuid.test(row.id) || ids.has(row.id)
        || row.tenant_id !== tenantId || row.enrollment_id !== enrollmentId
        || typeof row.status !== 'string' || !['present', 'absent', 'excused'].includes(row.status)
        || typeof row.roll_call_time !== 'string' || !timestamp.test(row.roll_call_time)
        || !Number.isFinite(Date.parse(row.roll_call_time))) throw new Error('PRESCHOOL_HISTORY_UNAVAILABLE');
      ids.add(row.id);
      return { id: row.id, tenantId, enrollmentId, status: row.status as EducationAttendanceStatus, rollCallTime: row.roll_call_time };
    });
  }
}
