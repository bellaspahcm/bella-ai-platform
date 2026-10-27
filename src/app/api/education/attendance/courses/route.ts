import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getLocalDateString } from '@bella/shared';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { TrustedActorOrgUnitAccessContractImpl } from '@/platform/org-unit/trusted-actor-access.contract.impl';
import { PreschoolAttendanceAccessService } from '@/products/bella-education/services/preschool-attendance-access.service';
import { PreschoolChainError, PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';
import { COURSE_PRIVATE_HEADERS, resolveCourseReadContext } from '../../courses/request-context';
import { admissionCourseReader } from '../../enrollments/admission-course-reader';
import { PreschoolTeacherAttendanceService } from '@/products/bella-education/services/preschool-teacher-attendance.service';
import { AttendanceAccessError, assertAttendanceDay, assertAttendanceSelectors, requireSchoolDay, resolveAttendanceRequestContext } from '../request-context';

export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: COURSE_PRIVATE_HEADERS });
  try {
    // Auth and canonical active profile are resolved before creating a privileged client.
    const context = await resolveCourseReadContext(request);
    if (!context.allowed) return context.response;
    const { actor, tenantId } = context;
    if (actor.role === 'admin_staff') {
      const caller = await resolveAttendanceRequestContext(request, true);
      if (caller.productKey !== 'bella_preschool' || caller.tenantId !== tenantId || caller.actorId !== actor.id) {
        return reply({ success: false, error: 'ATTENDANCE_ACCESS_DENIED' }, 403);
      }
      const params = new URL(request.url).searchParams;
      const keys = ['date', 'branchId', 'tenantId', 'tenant_id', 'userId', 'user_id', 'actorId', 'actor_id'];
      if ([...params.keys()].some(key => !keys.includes(key))
        || request.headers.has('x-course-id') || request.headers.has('x-enrollment-id')) {
        return reply({ success: false, error: 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED' }, 403);
      }
      const schoolDay = requireSchoolDay(params.get('date') ?? getLocalDateString(new Date()));
      assertAttendanceDay(caller, schoolDay);
      if (params.getAll('branchId').length > 1 || params.getAll('date').length > 1) {
        return reply({ success: false, error: 'INVALID_ATTENDANCE_CONTEXT' }, 400);
      }
      const branchId = params.get('branchId') ?? request.headers.get('x-branch-id') ?? undefined;
      if (branchId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
        return reply({ success: false, error: 'INVALID_ATTENDANCE_CONTEXT' }, 400);
      }
      assertAttendanceSelectors(request, caller, { branchId, date: schoolDay });
      const courses = await new PreschoolTeacherAttendanceService(caller.client)
        .listCourses(tenantId, actor.id, schoolDay, branchId);
      const attendance = new AttendanceContractImpl(caller.client);
      const classrooms = [];
      for (const course of courses) {
        const roster = await attendance.getCourseDailyAttendance({ tenantId, courseId: course.courseId, schoolDay });
        const todayStatus = { present: 0, absent: 0, excused: 0, unmarked: 0 };
        for (const row of roster) todayStatus[row.attendance?.status ?? 'unmarked'] += 1;
        classrooms.push({ id: course.courseId, name: course.name, branchId: course.branchId,
          students: roster.length, maxStudents: null, gradeKey: null, todayStatus });
      }
      return reply({ success: true, tenantId, schoolDay, classrooms });
    }
    if (actor.role !== 'admin') {
      return reply({ success: false, error: 'ATTENDANCE_ACTION_DENIED' }, 403);
    }
    const params = new URL(request.url).searchParams;
    const schoolDay = params.get('date') ?? getLocalDateString(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(schoolDay)
      || !Number.isFinite(Date.parse(`${schoolDay}T00:00:00Z`))
      || new Date(`${schoolDay}T00:00:00Z`).toISOString().slice(0, 10) !== schoolDay
      || params.getAll('branchId').length > 1) {
      return reply({ success: false, error: 'INVALID_ATTENDANCE_CONTEXT' }, 400);
    }
    const url = getSupabaseAdminUrl(), key = getSupabaseAdminKey();
    const client = url && key ? createSupabaseClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) : context.supabase;
    const accessRows = await new TrustedActorOrgUnitAccessContractImpl(client).listForActor({
      p_tenant_id: tenantId, p_actor_id: actor.id,
    });
    if (accessRows.some(row => row.tenant_id !== tenantId || row.user_id !== actor.id)) {
      return reply({ success: false, error: 'ATTENDANCE_BRANCH_ACCESS_DENIED' }, 403);
    }
    const branches = new Set(accessRows.filter(row => row.relationship_id
      && ['belongs_to', 'manages', 'participates_in'].includes(row.access_source)).map(row => row.org_unit_id));
    const branchId = params.get('branchId') ?? undefined;
    if (branchId !== undefined && !branches.has(branchId)) {
      return reply({ success: false, error: 'ATTENDANCE_BRANCH_ACCESS_DENIED' }, 403);
    }
    const chain = new PreschoolChainService(client);
    const assignments = await chain.listCourseAssignments(tenantId, actor.id, branchId);
    if (assignments.some(row => row.tenant_id !== tenantId || !row.course_id || !row.branch_id)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }
    const scope = new PreschoolAttendanceAccessService(client);
    // Reuse the existing canonical read adapter; the general courses projection
    // belongs to another model and must not supply Attendance identities.
    const reader = admissionCourseReader(client);
    // The identity RPC and daily-state RLS must see the authenticated caller.
    // The trusted client above is limited to explicit actor/branch preflight.
    const attendance = new AttendanceContractImpl(context.supabase);
    const classrooms = [];
    for (const assignment of assignments.filter(row => branches.has(row.branch_id))) {
      const courseId = assignment.course_id;
      await scope.assertCourseAccess(tenantId, actor.id, courseId);
      const course = await reader.readCourse(tenantId, courseId);
      if (!course || course.id !== courseId) throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
      if (course.status !== 'active') continue;
      const roster = await attendance.getCourseDailyAttendance({ tenantId, courseId, schoolDay });
      const todayStatus = { present: 0, absent: 0, excused: 0, unmarked: 0 };
      for (const row of roster) {
        await scope.assertEnrollmentAccess(tenantId, actor.id, row.enrollmentId, row.studentPartyId, courseId);
        todayStatus[row.attendance?.status ?? 'unmarked'] += 1;
      }
      await scope.assertCourseAccess(tenantId, actor.id, courseId);
      classrooms.push({
        id: courseId, name: course.title, branchId: assignment.branch_id,
        students: roster.length, maxStudents: null, gradeKey: null, todayStatus,
      });
    }
    return reply({ success: true, tenantId, schoolDay, classrooms });
  } catch (error) {
    const denied = error instanceof Error && error.message === 'TRUSTED_ACTOR_ACCESS_DENIED';
    const status = error instanceof PreschoolChainError || error instanceof AttendanceAccessError ? error.status : denied ? 403 : 500;
    return reply({ success: false, error: status === 500 ? 'ATTENDANCE_COURSES_READ_FAILED'
      : error instanceof Error ? error.message : 'ATTENDANCE_ACCESS_DENIED' }, status);
  }
}
