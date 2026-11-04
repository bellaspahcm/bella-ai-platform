import { NextResponse } from 'next/server';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { PreschoolAdminBranchCatalogContractImpl } from '@/platform/education/contracts/preschool-admin-branch-catalog.contract.impl';
import { getLocalDateString } from '@bella/shared';
import { PreschoolTeacherAttendanceService } from '@/products/bella-education/services/preschool-teacher-attendance.service';
import { PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import { CARE_PRIVATE_HEADERS, CareAccessError, resolveCareRequestContext } from '../bulk/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { client, tenantId, actorId, actorRole } = await resolveCareRequestContext(request);
    const allowedSelectors = new Set(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id']);
    for (const key of new URL(request.url).searchParams.keys()) {
      if (!allowedSelectors.has(key)) throw new CareAccessError(403, 'CARE_CONTEXT_OVERRIDE_DENIED');
    }
    if (actorRole === 'admin_staff') {
      const schoolDay = getLocalDateString(new Date());
      const courses = await new PreschoolTeacherAttendanceService(client)
        .listCourses(tenantId, actorId, schoolDay);
      const classrooms = courses.map(course => ({
        id: course.courseId,
        name: course.name,
        // The existing Care view requires a nonempty code field but never renders or uses it.
        // Keep the opaque canonical course identifier as that machine-only value.
        code: course.courseId,
        status: 'active' as const,
      }));
      return NextResponse.json({ success: true, classrooms }, { headers: CARE_PRIVATE_HEADERS });
    }
    const catalog = await new CanonicalCourseCatalogContractImpl(client).listPreschoolAdminCourses(tenantId);
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

    const branches = await new PreschoolAdminBranchCatalogContractImpl(client).listCurrentPreschoolAdminBranches();
    const accessible = new Set(branches.map(branch => branch.id));
    const classrooms = courses.filter(course => {
      const branchId = bindings.get(course.id);
      return branchId && accessible.has(branchId);
    }).map(course => ({ id: course.id, name: course.title, code: course.courseCode, status: course.status }));
    return NextResponse.json({ success: true, classrooms }, { headers: CARE_PRIVATE_HEADERS });
  } catch (error) {
    const status = error instanceof CareAccessError ? error.status
      : error instanceof PreschoolChainError && error.status === 403 ? 403 : 503;
    const code = error instanceof CareAccessError ? error.code
      : error instanceof PreschoolChainError && error.status === 403 ? 'CARE_TEACHER_ACCESS_DENIED' : 'CARE_CLASS_CATALOG_UNAVAILABLE';
    return NextResponse.json({ success: false, error: code }, { status, headers: CARE_PRIVATE_HEADERS });
  }
}
