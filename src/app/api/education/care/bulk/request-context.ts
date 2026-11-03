import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { getTenantPresentation } from '@/services/tenant-actions';
import { PreschoolAdminBranchCatalogContractImpl } from '@/platform/education/contracts/preschool-admin-branch-catalog.contract.impl';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';
import type { DailyCareRosterItem } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.contract';
import { PreschoolTeacherAttendanceService } from '@/products/bella-education/services/preschool-teacher-attendance.service';
import { PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';

export const CARE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

export class CareAccessError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 503, readonly code: string) { super(code); }
}

export interface CareRequestContext {
  client: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  actorId: string;
  actorRole: 'admin' | 'admin_staff';
}

interface CareEnrollmentAccessClient {
  rpc(name: 'preschool_daily_care_access_allowed', args: {
    p_tenant_id: string; p_course_id: string; p_student_party_id: string; p_school_day: string;
  }): PromiseLike<{ data: boolean | null; error: unknown }>;
}

function assertSelector(value: unknown, expected: string): void {
  if (value !== expected) throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
}

export function assertCareBodyContext(value: unknown, context: CareRequestContext, branchId?: string, courseId?: string): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const child of value) assertCareBodyContext(child, context, branchId);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'tenantId' || key === 'tenant_id') assertSelector(child, context.tenantId);
    else if (['actorId', 'actor_id', 'userId', 'user_id'].includes(key)) assertSelector(child, context.actorId);
    else if (branchId && (key === 'branchId' || key === 'branch_id')) assertSelector(child, branchId);
    else if (courseId && (key === 'courseId' || key === 'course_id')) assertSelector(child, courseId);
    else if (key === 'role') throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
    else assertCareBodyContext(child, context, branchId, courseId);
  }
}

export async function resolveCareRequestContext(request: Request): Promise<CareRequestContext> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new CareAccessError(401, 'CARE_UNAUTHENTICATED');

  const profile = await getCurrentUser();
  const tenantId = profile?.tenant_id?.trim();
  if (!profile || profile.id !== user.id || !('status' in profile) || profile.status !== 'active' || !tenantId) {
    throw new CareAccessError(403, 'CARE_ACCESS_DENIED');
  }
  const role = profile.role?.trim().toLowerCase();
  if (role !== 'admin' && role !== 'admin_staff') throw new CareAccessError(403, 'CARE_ROLE_DENIED');
  const context: CareRequestContext = { client, actorId: user.id, tenantId, actorRole: role };
  const query = new URL(request.url).searchParams;
  for (const key of ['tenantId', 'tenant_id']) for (const value of query.getAll(key)) assertSelector(value, tenantId);
  for (const key of ['actorId', 'actor_id', 'userId', 'user_id']) for (const value of query.getAll(key)) assertSelector(value, user.id);
  for (const [header, expected] of [['x-tenant-id', tenantId], ['x-actor-id', user.id]] as const) {
    if (request.headers.has(header)) assertSelector(request.headers.get(header), expected);
  }

  let tenant: Awaited<ReturnType<typeof getTenantPresentation>>;
  try {
    tenant = await getTenantPresentation();
  } catch {
    throw new CareAccessError(503, 'CARE_IDENTITY_UNAVAILABLE');
  }
  if (!tenant) throw new CareAccessError(503, 'CARE_IDENTITY_UNAVAILABLE');
  if (tenant.id !== tenantId || tenant.status !== 'active' || tenant.product_key !== 'bella_preschool') {
    throw new CareAccessError(403, 'CARE_PRODUCT_ACCESS_DENIED');
  }
  return context;
}

async function listAssignedTeacherCourses(
  context: CareRequestContext,
  date: string,
): Promise<Awaited<ReturnType<PreschoolTeacherAttendanceService['listCourses']>>> {
  try {
    return await new PreschoolTeacherAttendanceService(context.client)
      .listCourses(context.tenantId, context.actorId, date);
  } catch (error) {
    if (error instanceof PreschoolChainError && error.status === 403) {
      throw new CareAccessError(403, 'CARE_TEACHER_ACCESS_DENIED');
    }
    throw new CareAccessError(503, 'CARE_TEACHER_SCOPE_UNAVAILABLE');
  }
}

export async function authorizeCareCourse(
  context: CareRequestContext, request: Request, courseId: string, date: string, body?: unknown,
): Promise<{ branchId: string; roster: readonly DailyCareRosterItem[]; service: DailyCareService }> {
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const today = ['year', 'month', 'day'].map(type => todayParts.find(part => part.type === type)?.value).join('-');
  // The current Enrollment DTO has no effective-status history producer.
  // Keep other school days unavailable rather than infer past or future access.
  if (date !== today) throw new CareAccessError(503, 'CARE_HISTORICAL_SCOPE_UNAVAILABLE');
  const { client, tenantId } = context;
  const params = new URL(request.url).searchParams;
  const courseSelectors = params.getAll('courseId');
  const dateSelectors = params.getAll('date');
  if ((request.method === 'GET' && (courseSelectors.length !== 1 || dateSelectors.length !== 1))
    || courseSelectors.some(value => value !== courseId) || dateSelectors.some(value => value !== date)) {
    throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
  }
  let branchId: string;
  if (context.actorRole === 'admin_staff') {
    const courses = await listAssignedTeacherCourses(context, date);
    const assigned = courses.filter(course => course.courseId === courseId);
    if (assigned.length !== 1) throw new CareAccessError(403, 'CARE_COURSE_ACCESS_DENIED');
    branchId = assigned[0].branchId;
  } else {
    const assignment = await client.from('preschool_chain_course_branch_assignments')
      .select('tenant_id, course_id, branch_id').eq('tenant_id', tenantId).eq('course_id', courseId);
    if (assignment.error || !assignment.data || assignment.data.length !== 1) {
      throw new CareAccessError(503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
    }
    const target = assignment.data[0];
    if (target.tenant_id !== tenantId || target.course_id !== courseId || !target.branch_id) {
      throw new CareAccessError(403, 'CARE_BRANCH_ACCESS_DENIED');
    }
    branchId = target.branch_id;
  }
  for (const key of ['branchId', 'branch_id']) {
    for (const value of new URL(request.url).searchParams.getAll(key)) assertSelector(value, branchId);
  }
  assertCareBodyContext(body, context, branchId, courseId);

  if (context.actorRole === 'admin') {
    let branches: Awaited<ReturnType<PreschoolAdminBranchCatalogContractImpl['listCurrentPreschoolAdminBranches']>>;
    try {
      branches = await new PreschoolAdminBranchCatalogContractImpl(client).listCurrentPreschoolAdminBranches();
    } catch {
      throw new CareAccessError(503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
    }
    if (!branches.some(branch => branch.id === branchId)) {
      throw new CareAccessError(403, 'CARE_BRANCH_ACCESS_DENIED');
    }
  }

  const service = new DailyCareService(client, 'bella_preschool');
  try {
    const roster = await service.getDailyCareRoster(tenantId, courseId, date, 'bella_preschool');
    const eligible = await Promise.all(roster.map(async item => {
      const { data, error } = await (client as unknown as CareEnrollmentAccessClient).rpc('preschool_daily_care_access_allowed', {
        p_tenant_id: tenantId, p_course_id: courseId, p_student_party_id: item.studentPartyId, p_school_day: date,
      });
      if (error || typeof data !== 'boolean') throw new Error('CARE_ENROLLMENT_ACCESS_UNAVAILABLE');
      return data ? item : null;
    }));
    return { branchId, service, roster: eligible.filter((item): item is DailyCareRosterItem => item !== null) };
  } catch (error) {
    if (error instanceof Error && error.message === 'CARE_COURSE_NOT_FOUND_FOR_TENANT') {
      throw new CareAccessError(403, 'CARE_COURSE_ACCESS_DENIED');
    }
    throw new CareAccessError(503, 'CARE_ENROLLMENT_SCOPE_UNAVAILABLE');
  }
}

export function assertCareStudents(studentPartyIds: readonly string[], roster: readonly DailyCareRosterItem[]): void {
  const allowed = new Set(roster.map(item => item.studentPartyId));
  if (studentPartyIds.some(id => !id || !allowed.has(id))) throw new CareAccessError(403, 'CARE_STUDENT_ACCESS_DENIED');
}
