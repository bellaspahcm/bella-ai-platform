import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { DailyCareService } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.service';
import type { DailyCareRosterItem } from '@/products/bella-education/care-wellbeing/daily-care/daily-care.contract';

export const CARE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

export class CareAccessError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 503, readonly code: string) { super(code); }
}

export interface CareRequestContext {
  client: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  actorId: string;
}

function assertSelector(value: unknown, expected: string): void {
  if (value !== expected) throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
}

export function assertCareBodyContext(value: unknown, context: CareRequestContext, branchId?: string): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const child of value) assertCareBodyContext(child, context, branchId);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'tenantId' || key === 'tenant_id') assertSelector(child, context.tenantId);
    else if (['actorId', 'actor_id', 'userId', 'user_id'].includes(key)) assertSelector(child, context.actorId);
    else if (branchId && (key === 'branchId' || key === 'branch_id')) assertSelector(child, branchId);
    else if (key === 'role') throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
    else assertCareBodyContext(child, context, branchId);
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
  const context = { client, actorId: user.id, tenantId };
  const query = new URL(request.url).searchParams;
  for (const key of ['tenantId', 'tenant_id']) for (const value of query.getAll(key)) assertSelector(value, tenantId);
  for (const key of ['actorId', 'actor_id', 'userId', 'user_id']) for (const value of query.getAll(key)) assertSelector(value, user.id);
  for (const [header, expected] of [['x-tenant-id', tenantId], ['x-actor-id', user.id]] as const) {
    if (request.headers.has(header)) assertSelector(request.headers.get(header), expected);
  }

  const role = profile.role?.trim().toLowerCase();
  if (role !== 'admin' && role !== 'admin_staff') throw new CareAccessError(403, 'CARE_ROLE_DENIED');
  const tenantResult = await client.from('tenants').select('id, status, product_key').eq('id', tenantId).maybeSingle();
  if (tenantResult.error) throw new CareAccessError(503, 'CARE_IDENTITY_UNAVAILABLE');
  if (!tenantResult.data || tenantResult.data.id !== tenantId || tenantResult.data.status !== 'active' || tenantResult.data.product_key !== 'bella_preschool') {
    throw new CareAccessError(403, 'CARE_PRODUCT_ACCESS_DENIED');
  }
  // Auth User, Person and Party IDs are not interchangeable; no mapping producer is proven yet.
  if (role === 'admin_staff') throw new CareAccessError(503, 'CARE_TEACHER_IDENTITY_UNAVAILABLE');
  return context;
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
  const { client, tenantId, actorId } = context;
  const assignment = await client.from('preschool_chain_course_branch_assignments')
    .select('tenant_id, course_id, branch_id').eq('tenant_id', tenantId).eq('course_id', courseId);
  if (assignment.error || !assignment.data || assignment.data.length !== 1) {
    throw new CareAccessError(503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
  }
  const target = assignment.data[0];
  if (target.tenant_id !== tenantId || target.course_id !== courseId || !target.branch_id) {
    throw new CareAccessError(403, 'CARE_BRANCH_ACCESS_DENIED');
  }
  const branchId = target.branch_id;
  for (const key of ['branchId', 'branch_id']) {
    for (const value of new URL(request.url).searchParams.getAll(key)) assertSelector(value, branchId);
  }
  assertCareBodyContext(body, context, branchId);

  const branch = await client.from('org_units').select('id, tenant_id, unit_type, is_active')
    .eq('tenant_id', tenantId).eq('id', branchId).maybeSingle();
  if (branch.error) throw new CareAccessError(503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
  if (!branch.data || branch.data.id !== branchId || branch.data.tenant_id !== tenantId || branch.data.unit_type !== 'branch' || branch.data.is_active !== true) {
    throw new CareAccessError(403, 'CARE_BRANCH_ACCESS_DENIED');
  }

  const access = await client.from('user_org_unit_access').select('user_id, tenant_id, org_unit_id')
    .eq('tenant_id', tenantId).eq('user_id', actorId).eq('org_unit_id', branchId);
  if (access.error) throw new CareAccessError(503, 'CARE_BRANCH_SCOPE_UNAVAILABLE');
  if (!access.data?.some(row => row.user_id === actorId && row.tenant_id === tenantId && row.org_unit_id === branchId)) {
    throw new CareAccessError(403, 'CARE_BRANCH_ACCESS_DENIED');
  }

  const service = new DailyCareService(client);
  try {
    const roster = await service.getDailyCareRoster(tenantId, courseId, date);
    const enrollments = new EnrollmentContractImpl(client);
    const eligible = await Promise.all(roster.map(async item => {
      const enrollment = await enrollments.getEnrollment(tenantId, item.enrollmentId);
      const enrolledAt = enrollment ? Date.parse(enrollment.enrolledAt) : NaN;
      return enrollment?.id === item.enrollmentId && enrollment.tenantId === tenantId && enrollment.courseId === courseId
        && enrollment.studentPartyId === item.studentPartyId && enrollment.status === 'active'
        && Number.isFinite(enrolledAt) && enrolledAt <= Date.parse(`${date}T23:59:59.999+07:00`) ? item : null;
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
