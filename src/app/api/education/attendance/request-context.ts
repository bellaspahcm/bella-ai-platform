import { createClient } from '@/lib/supabase-server';
import { getLocalDateString as vietnamSchoolDay } from '@bella/shared';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import type { CourseDailyAttendanceRosterItem } from '@/platform/education/contracts/attendance.contract';
import { PreschoolTeacherAttendanceService } from '@/products/bella-education/services/preschool-teacher-attendance.service';
import { getCurrentUser } from '@/services/user-actions';
import { getTenantPresentation } from '@/services/tenant-actions';

export const ATTENDANCE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
export class AttendanceAccessError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 503, readonly code: string) { super(code); }
}
export interface AttendanceRequestContext {
  client: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  actorId: string;
  actorRole: string;
  productKey: string;
}
interface AttendanceTargets { courseId?: string; enrollmentId?: string; branchId?: string; date?: string }
function assertEqual(value: unknown, expected: string): void {
  if (value !== expected) throw new AttendanceAccessError(403, 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED');
}
/** Selectors narrow a resolved resource; they never grant identity or scope. */
export function assertAttendanceSelectors(
  request: Request, context: AttendanceRequestContext, targets: AttendanceTargets = {}, body?: unknown,
): void {
  const expected: Record<string, string | undefined> = {
    tenantId: context.tenantId, tenant_id: context.tenantId,
    userId: context.actorId, user_id: context.actorId, actorId: context.actorId, actor_id: context.actorId,
    courseId: targets.courseId, course_id: targets.courseId,
    enrollmentId: targets.enrollmentId, enrollment_id: targets.enrollmentId,
    branchId: targets.branchId, branch_id: targets.branchId, date: targets.date,
  };
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key === 'role') throw new AttendanceAccessError(403, 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED');
    if (expected[key] !== undefined) assertEqual(value, expected[key]);
  }
  for (const header of ['x-role', 'x-user-role', 'x-mock-user-email']) {
    if (request.headers.has(header)) throw new AttendanceAccessError(403, 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED');
  }
  for (const [header, value] of [
    ['x-tenant-id', context.tenantId], ['x-actor-id', context.actorId], ['x-user-id', context.actorId],
    ['x-course-id', targets.courseId], ['x-enrollment-id', targets.enrollmentId], ['x-branch-id', targets.branchId],
  ] as const) {
    if (value !== undefined && request.headers.has(header)) assertEqual(request.headers.get(header), value);
  }
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'role') throw new AttendanceAccessError(403, 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED');
      if (expected[key] !== undefined) assertEqual(child, expected[key]);
      else visit(child);
    }
  };
  visit(body);
}
export async function resolveAttendanceRequestContext(request: Request, teacherAttendance = false): Promise<AttendanceRequestContext> {
  const client = await createClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) throw new AttendanceAccessError(401, 'ATTENDANCE_UNAUTHENTICATED');
  const actorId = auth.data.user.id;
  const user = await getCurrentUser();
  if (!user || user.id !== actorId || user.status !== 'active' || !user.tenant_id || !user.role) {
    throw new AttendanceAccessError(403, 'ATTENDANCE_ACCESS_DENIED');
  }
  const tenant = await getTenantPresentation();
  if (!tenant || tenant.id !== user.tenant_id || tenant.status !== 'active' || !tenant.product_key) {
    throw new AttendanceAccessError(503, 'ATTENDANCE_IDENTITY_UNAVAILABLE');
  }
  const context = { client, actorId, actorRole: user.role, tenantId: user.tenant_id, productKey: tenant.product_key };
  assertAttendanceSelectors(request, context);
  if (context.productKey === 'bella_preschool') {
    if (user.role === 'admin_staff') {
      if (!teacherAttendance) throw new AttendanceAccessError(503, 'ATTENDANCE_TEACHER_IDENTITY_UNAVAILABLE');
      await new PreschoolTeacherAttendanceService(client).requireIdentity(context.tenantId, actorId);
    } else if (user.role !== 'admin') throw new AttendanceAccessError(403, 'AUTH_ROLE_PERMISSION_ERROR');
  } else {
    // Preserve the existing HTTP role vocabulary outside Preschool.
    if (!['admin', 'super_admin', 'admin_staff'].includes(user.role.trim().toLowerCase())) {
      throw new AttendanceAccessError(403, 'AUTH_ROLE_PERMISSION_ERROR');
    }
  }
  return context;
}
export function requireSchoolDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T05:00:00Z`))
    || new Date(`${value}T05:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new AttendanceAccessError(400, 'date must be YYYY-MM-DD');
  }
  return value;
}
export function assertAttendanceDay(context: AttendanceRequestContext, day: string): void {
  if (context.productKey === 'bella_preschool' && day !== vietnamSchoolDay(new Date())) {
    throw new AttendanceAccessError(503, 'ATTENDANCE_HISTORICAL_SCOPE_UNAVAILABLE');
  }
}
export function resolveAttendanceRollCallTime(day: string, value: unknown): string {
  if (value === undefined) return `${day}T05:00:00.000Z`;
  if (typeof value !== 'string' || !value.trim()) throw new AttendanceAccessError(400, 'INVALID_ROLL_CALL_TIME');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || vietnamSchoolDay(date) !== day) {
    throw new AttendanceAccessError(400, 'INVALID_ROLL_CALL_TIME');
  }
  return date.toISOString();
}
export async function authorizeAttendanceCourse(
  context: AttendanceRequestContext, request: Request, courseId: string, day: string, body?: unknown,
): Promise<void> {
  assertAttendanceDay(context, day);
  assertAttendanceSelectors(request, context, { courseId, date: day }, body);
  if (context.productKey === 'bella_preschool' && context.actorRole === 'admin_staff') {
    const courses = await new PreschoolTeacherAttendanceService(context.client)
      .listCourses(context.tenantId, context.actorId, day);
    const course = courses.find(item => item.courseId === courseId);
    if (!course) throw new AttendanceAccessError(403, 'ATTENDANCE_COURSE_ACCESS_DENIED');
    assertAttendanceSelectors(request, context, { courseId, branchId: course.branchId, date: day }, body);
    return;
  }
  const catalog = await new CanonicalCourseCatalogContractImpl(context.client).listCourses(context.tenantId);
  const course = catalog.find(item => item.id === courseId && item.tenantId === context.tenantId);
  if (!course) throw new AttendanceAccessError(403, 'ATTENDANCE_COURSE_ACCESS_DENIED');
  if (context.productKey !== 'bella_preschool') return;
  if (course.status !== 'active') throw new AttendanceAccessError(403, 'ATTENDANCE_COURSE_ACCESS_DENIED');
  const { client, tenantId, actorId } = context;
  const assignment = await client.from('preschool_chain_course_branch_assignments')
    .select('tenant_id, course_id, branch_id', { count: 'exact' }).eq('tenant_id', tenantId).eq('course_id', courseId);
  if (assignment.error || !Array.isArray(assignment.data) || assignment.count !== 1 || assignment.data.length !== 1) {
    throw new AttendanceAccessError(503, 'ATTENDANCE_BRANCH_SCOPE_UNAVAILABLE');
  }
  const target = assignment.data[0];
  if (target.tenant_id !== tenantId || target.course_id !== courseId || !target.branch_id) {
    throw new AttendanceAccessError(403, 'ATTENDANCE_BRANCH_ACCESS_DENIED');
  }
  assertAttendanceSelectors(request, context, { courseId, branchId: target.branch_id, date: day }, body);
  const branch = await client.from('org_units').select('id, tenant_id, unit_type, is_active')
    .eq('tenant_id', tenantId).eq('id', target.branch_id).maybeSingle();
  if (branch.error) throw new AttendanceAccessError(503, 'ATTENDANCE_BRANCH_SCOPE_UNAVAILABLE');
  if (!branch.data || branch.data.id !== target.branch_id || branch.data.tenant_id !== tenantId
    || branch.data.unit_type !== 'branch' || branch.data.is_active !== true) {
    throw new AttendanceAccessError(403, 'ATTENDANCE_BRANCH_ACCESS_DENIED');
  }
  const access = await client.from('user_org_unit_access').select('user_id, tenant_id, org_unit_id', { count: 'exact' })
    .eq('tenant_id', tenantId).eq('user_id', actorId).eq('org_unit_id', target.branch_id);
  if (access.error || !Array.isArray(access.data) || access.count !== access.data.length) {
    throw new AttendanceAccessError(503, 'ATTENDANCE_BRANCH_SCOPE_UNAVAILABLE');
  }
  if (!access.data.length || access.data.some(row => row.user_id !== actorId
    || row.tenant_id !== tenantId || row.org_unit_id !== target.branch_id)) {
    throw new AttendanceAccessError(403, 'ATTENDANCE_BRANCH_ACCESS_DENIED');
  }
}
export async function requireAttendanceEnrollment(context: AttendanceRequestContext, enrollmentId: string, day: string) {
  const enrollment = await new EnrollmentContractImpl(context.client).getEnrollment(context.tenantId, enrollmentId);
  if (!enrollment || enrollment.id !== enrollmentId || enrollment.tenantId !== context.tenantId) {
    throw new AttendanceAccessError(403, 'ATTENDANCE_ENROLLMENT_ACCESS_DENIED');
  }
  if (context.productKey === 'bella_preschool') {
    const enrolledAt = Date.parse(enrollment.enrolledAt);
    if (enrollment.status !== 'active' || !Number.isFinite(enrolledAt)
      || enrolledAt > Date.parse(`${day}T23:59:59.999+07:00`)) {
      throw new AttendanceAccessError(403, 'ATTENDANCE_ENROLLMENT_ACCESS_DENIED');
    }
  }
  return enrollment;
}
export async function filterAttendanceRoster(
  context: AttendanceRequestContext, roster: readonly CourseDailyAttendanceRosterItem[], courseId: string, day: string,
): Promise<readonly CourseDailyAttendanceRosterItem[]> {
  if (context.productKey !== 'bella_preschool') return roster;
  const eligible: CourseDailyAttendanceRosterItem[] = [];
  for (const item of roster) {
    const enrollment = await new EnrollmentContractImpl(context.client).getEnrollment(context.tenantId, item.enrollmentId);
    if (!enrollment || enrollment.id !== item.enrollmentId || enrollment.tenantId !== context.tenantId
      || enrollment.courseId !== courseId || enrollment.studentPartyId !== item.studentPartyId) {
      throw new AttendanceAccessError(503, 'ATTENDANCE_ENROLLMENT_SCOPE_UNAVAILABLE');
    }
    const enrolledAt = Date.parse(enrollment.enrolledAt);
    if (!Number.isFinite(enrolledAt)) throw new AttendanceAccessError(503, 'ATTENDANCE_ENROLLMENT_SCOPE_UNAVAILABLE');
    if (enrollment.status === 'active' && enrolledAt <= Date.parse(`${day}T23:59:59.999+07:00`)) eligible.push(item);
  }
  return eligible;
}
