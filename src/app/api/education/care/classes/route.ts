import { NextResponse } from 'next/server';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { CARE_PRIVATE_HEADERS, CareAccessError, resolveCareRequestContext } from '../bulk/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { client, tenantId, actorId } = await resolveCareRequestContext(request);
    const allowedSelectors = new Set(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id']);
    for (const key of new URL(request.url).searchParams.keys()) {
      if (!allowedSelectors.has(key)) throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
    }
    const catalog = await new CanonicalCourseCatalogContractImpl(client).listCourses(tenantId);
    const courses = catalog.filter(course => course.status === 'active');
    if (!courses.length) return NextResponse.json({ success: true, classrooms: [] }, { headers: CARE_PRIVATE_HEADERS });

    const assignments = await client.from('preschool_chain_course_branch_assignments')
      .select('tenant_id, course_id, branch_id', { count: 'exact' }).eq('tenant_id', tenantId).in('course_id', courses.map(course => course.id));
    if (assignments.error || !Array.isArray(assignments.data) || assignments.count !== assignments.data.length) {
      throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
    }
    const courseIds = new Set(courses.map(course => course.id));
    const bindings = new Map<string, string>();
    for (const row of assignments.data) {
      if (row.tenant_id !== tenantId || !courseIds.has(row.course_id) || !row.branch_id || bindings.has(row.course_id)) {
        throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
      }
      bindings.set(row.course_id, row.branch_id);
    }
    if (bindings.size !== courses.length) throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');

    const branchIds = [...new Set(bindings.values())];
    const branches = await client.from('org_units').select('id, tenant_id, unit_type, is_active', { count: 'exact' })
      .eq('tenant_id', tenantId).in('id', branchIds);
    const access = await client.from('user_org_unit_access').select('user_id, tenant_id, org_unit_id', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('user_id', actorId).in('org_unit_id', branchIds);
    if (branches.error || access.error || !Array.isArray(branches.data) || !Array.isArray(access.data)
      || branches.count !== branches.data.length || access.count !== access.data.length) {
      throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
    }

    const activeBranches = new Set<string>();
    for (const row of branches.data) {
      if (row.tenant_id !== tenantId || !branchIds.includes(row.id) || row.unit_type !== 'branch' || activeBranches.has(row.id)) {
        throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
      }
      if (row.is_active === true) activeBranches.add(row.id);
    }
    const accessible = new Set<string>();
    for (const row of access.data) {
      if (row.tenant_id !== tenantId || row.user_id !== actorId || !row.org_unit_id || !branchIds.includes(row.org_unit_id)) {
        throw new CareAccessError(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
      }
      accessible.add(row.org_unit_id);
    }
    const classrooms = courses.filter(course => {
      const branchId = bindings.get(course.id);
      return branchId && activeBranches.has(branchId) && accessible.has(branchId);
    }).map(course => ({ id: course.id, name: course.title, code: course.courseCode, status: course.status }));
    return NextResponse.json({ success: true, classrooms }, { headers: CARE_PRIVATE_HEADERS });
  } catch (error) {
    const status = error instanceof CareAccessError ? error.status : 503;
    const code = error instanceof CareAccessError ? error.code : 'CARE_CLASS_CATALOG_UNAVAILABLE';
    return NextResponse.json({ success: false, error: code }, { status, headers: CARE_PRIVATE_HEADERS });
  }
}
