import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PartyAuthLinkContractImpl } from '@/platform/party/auth-link.contract.impl';
import { PartyAuthLinkError } from '@/platform/party/auth-link.contract';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { parseAttendanceCommandResult } from '@/platform/education/contracts/attendance-command.contract';
import { AttendanceProductService } from './attendance.service';
import { PreschoolChainError } from './preschool-chain.service';
import type { PreschoolAttendanceCommandInput } from './preschool-attendance-command.service';

export interface TeacherAttendanceCourse { courseId: string; name: string; branchId: string }
interface TeacherCourseRpc {
  rpc(name: 'preschool_teacher_attendance_courses', input: { p_school_day: string; p_branch_id: string | null }):
    PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const denied = () => new PreschoolChainError('ATTENDANCE_TEACHER_ACCESS_DENIED', 403);
const unavailable = () => new PreschoolChainError('ATTENDANCE_TEACHER_SCOPE_UNAVAILABLE', 503);

/** Caller-session adapter. Identity alone never grants classroom permissions. */
export class PreschoolTeacherAttendanceService {
  constructor(private readonly client: SupabaseClient<Database>) {
    if (!client) throw unavailable();
  }

  async requireIdentity(tenantId: string, actorId: string): Promise<void> {
    try {
      const link = await new PartyAuthLinkContractImpl(this.client).resolveCurrent();
      if (!link || link.tenantId !== tenantId || link.authUserId !== actorId) throw denied();
    } catch (error) {
      if (error instanceof PreschoolChainError) throw error;
      if (error instanceof PartyAuthLinkError && error.code === 'PARTY_AUTH_LINK_ACCESS_DENIED') throw denied();
      throw unavailable();
    }
  }

  async listCourses(tenantId: string, actorId: string, schoolDay: string, branchId?: string): Promise<TeacherAttendanceCourse[]> {
    await this.requireIdentity(tenantId, actorId);
    const { data, error } = await (this.client as unknown as TeacherCourseRpc)
      .rpc('preschool_teacher_attendance_courses', { p_school_day: schoolDay, p_branch_id: branchId ?? null });
    if (error) { if (error.code === '42501') throw denied(); throw unavailable(); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
    const result = data as Record<string, unknown>;
    if (result.tenantId !== tenantId || result.actorId !== actorId || result.schoolDay !== schoolDay
      || !Array.isArray(result.courses)) throw unavailable();
    const courses: TeacherAttendanceCourse[] = [];
    for (const item of result.courses) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw unavailable();
      const row = item as Record<string, unknown>;
      if (!uuid(row.courseId) || !uuid(row.branchId) || typeof row.name !== 'string' || !row.name.trim()
        || (branchId !== undefined && row.branchId !== branchId)
        || courses.some(course => course.courseId === row.courseId)) throw unavailable();
      courses.push({ courseId: row.courseId, name: row.name, branchId: row.branchId });
    }
    return courses;
  }

  async setDailyAttendance(input: PreschoolAttendanceCommandInput, authorizeScope?: (course: TeacherAttendanceCourse) => void) {
    if (input.actorRole !== 'admin_staff') throw denied();
    const courses = await this.listCourses(input.tenantId, input.actorId, input.schoolDay);
    const service = new AttendanceProductService(new AttendanceContractImpl(this.client));
    // The self-scoped roster already joins canonical enrollment/student identity.
    // Do not widen general Enrollment RLS just to derive a teacher's target course.
    let assigned: TeacherAttendanceCourse | undefined;
    for (const course of courses) {
      const roster = await service.getCourseDailyAttendance({
        tenantId: input.tenantId, courseId: course.courseId, schoolDay: input.schoolDay,
      });
      if (roster.some(row => row.enrollmentId === input.enrollmentId)) { assigned = course; break; }
    }
    if (!assigned) throw denied();
    authorizeScope?.(assigned);
    // The caller-authenticated SQL writer rechecks live authority after waits.
    let saved;
    try { saved = await service.setDailyAttendance(input); }
    catch (error) {
      if (error instanceof Error && error.message === 'Failed to set daily attendance: ATTENDANCE_ACCESS_DENIED') throw denied();
      throw unavailable();
    }
    if (!saved) throw unavailable();
    return parseAttendanceCommandResult([{
      id: saved.id, tenant_id: saved.tenantId, enrollment_id: saved.enrollmentId,
      school_day: saved.schoolDay, status: saved.status, event_id: saved.eventId,
      roll_call_time: saved.rollCallTime, created_at: saved.createdAt, updated_at: saved.updatedAt,
    }], input);
  }
}
