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

export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: COURSE_PRIVATE_HEADERS });
  try {
    // Auth and canonical active profile are resolved before creating a privileged client.
    const context = await resolveCourseReadContext(request);
    if (!context.allowed) return context.response;
    const { actor, tenantId } = context;
    if (!['admin', 'super_admin', 'admin_staff'].includes(actor.role)) {
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
    const attendance = new AttendanceContractImpl(client);
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
    return reply({ success: true, schoolDay, classrooms });
  } catch (error) {
    const denied = error instanceof Error && error.message === 'TRUSTED_ACTOR_ACCESS_DENIED';
    const status = error instanceof PreschoolChainError ? error.status : denied ? 403 : 500;
    return reply({ success: false, error: status === 500 ? 'ATTENDANCE_COURSES_READ_FAILED'
      : error instanceof Error ? error.message : 'ATTENDANCE_ACCESS_DENIED' }, status);
  }
}
