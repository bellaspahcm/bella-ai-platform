import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PartyAuthLinkContractImpl } from '@/platform/party/auth-link.contract.impl';
import { PartyAuthLinkError } from '@/platform/party/auth-link.contract';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { parseAttendanceCommandResult } from '@/platform/education/contracts/attendance-command.contract';
import { PreschoolTeacherContractError } from '@/platform/education/contracts/teacher-assignment.contract';
import type { PreschoolTeacherAttendanceCourse } from '@/platform/education/contracts/teacher-assignment.contract';
import { PreschoolTeacherContractImpl } from '@/platform/education/contracts/preschool-teacher.contract.impl';
import { AttendanceProductService } from './attendance.service';
import { PreschoolChainError } from './preschool-chain.service';
import type { PreschoolAttendanceCommandInput } from './preschool-attendance-command.service';

export type TeacherAttendanceCourse = PreschoolTeacherAttendanceCourse;
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
    try {
      const scope = await new PreschoolTeacherContractImpl(this.client).listMyAttendanceCourses(schoolDay, branchId);
      if (scope.tenantId !== tenantId || scope.actorId !== actorId || scope.schoolDay !== schoolDay) throw unavailable();
      return [...scope.courses];
    } catch (error) {
      if (error instanceof PreschoolChainError) throw error;
      if (error instanceof PreschoolTeacherContractError && error.code === 'PRESCHOOL_TEACHER_ACCESS_DENIED') throw denied();
      throw unavailable();
    }
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
