import { NextResponse } from 'next/server';
import { getLocalDateString } from '@bella/shared';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { ExecutiveDashboardDTO } from '@/products/bella-education/analytics/domain/preschool-analytics.types';
import { assertAttendanceDay, assertAttendanceSelectors, resolveAttendanceRequestContext, requireSchoolDay, AttendanceAccessError } from '../attendance/request-context';

export const dynamic = 'force-dynamic';
const PRIVATE_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };
const ALLOWED_QUERY_KEYS = new Set(['branchId', 'branch_id', 'date']);

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE_HEADERS });
}

function unavailable() {
  return json({ success: false, error: 'ANALYTICS_BRANCH_DATA_UNAVAILABLE' }, 503);
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    for (const key of query.keys()) {
      if (!ALLOWED_QUERY_KEYS.has(key)) throw new AttendanceAccessError(403, 'ANALYTICS_CONTEXT_OVERRIDE_DENIED');
      if (query.getAll(key).length > 1) throw new AttendanceAccessError(403, 'ANALYTICS_CONTEXT_OVERRIDE_DENIED');
    }

    if (query.has('branchId') && query.has('branch_id')) throw new AttendanceAccessError(403, 'ANALYTICS_CONTEXT_OVERRIDE_DENIED');
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') throw new AttendanceAccessError(403, 'ANALYTICS_PRODUCT_FORBIDDEN');
    const today = getLocalDateString(new Date());
    const date = query.get('date') === null ? today : requireSchoolDay(query.get('date'));
    assertAttendanceDay(context, date);
    const requestedBranchId = query.get('branchId') ?? query.get('branch_id') ?? undefined;
    assertAttendanceSelectors(request, context, { branchId: requestedBranchId, date });

    const { client, tenantId, actorId } = context;
    const access = await client.from('user_org_unit_access')
      .select('user_id, tenant_id, org_unit_id, relationship_id', { count: 'exact' })
      .eq('tenant_id', tenantId).eq('user_id', actorId).not('relationship_id', 'is', null);
    if (access.error || !Array.isArray(access.data) || access.count !== access.data.length) return unavailable();
    const accessibleUnitIds = new Set<string>();
    for (const row of access.data) {
      if (row.tenant_id !== tenantId || row.user_id !== actorId || !row.org_unit_id
        || !row.relationship_id || accessibleUnitIds.has(row.org_unit_id)) return unavailable();
      accessibleUnitIds.add(row.org_unit_id);
    }
    if (accessibleUnitIds.size === 0) throw new AttendanceAccessError(403, 'ANALYTICS_BRANCH_ACCESS_DENIED');

    const units = await client.from('org_units')
      .select('id, tenant_id, unit_type, name, is_active', { count: 'exact' })
      .eq('tenant_id', tenantId).in('id', [...accessibleUnitIds]);
    if (units.error || !Array.isArray(units.data) || units.count !== units.data.length
      || units.data.length !== accessibleUnitIds.size) return unavailable();
    const branches = units.data.filter((unit) => {
      if (unit.tenant_id !== tenantId || !accessibleUnitIds.has(unit.id)) return false;
      return unit.unit_type === 'branch' && unit.is_active === true;
    }).map((unit) => ({ id: unit.id, name: unit.name }));

    const catalog = await new CanonicalCourseCatalogContractImpl(client).listCourses(tenantId);
    const activeCourseIds = catalog.filter((course) => course.status === 'active').map((course) => course.id);
    const assignmentResult = activeCourseIds.length && branches.length
      ? await client.from('preschool_chain_course_branch_assignments')
        .select('tenant_id, course_id, branch_id', { count: 'exact' })
        .eq('tenant_id', tenantId).in('course_id', activeCourseIds).in('branch_id', branches.map((branch) => branch.id))
      : { data: [], error: null, count: 0 };
    if (assignmentResult.error || !Array.isArray(assignmentResult.data) || assignmentResult.count !== assignmentResult.data.length) return unavailable();

    const activeCourseIdsSet = new Set(activeCourseIds);
    const branchIds = new Set(branches.map((branch) => branch.id));
    const branchByCourse = new Map<string, string>();
    for (const row of assignmentResult.data) {
      if (row.tenant_id !== tenantId || !activeCourseIdsSet.has(row.course_id) || !branchIds.has(row.branch_id)
        || branchByCourse.has(row.course_id)) return unavailable();
      branchByCourse.set(row.course_id, row.branch_id);
    }

    if (requestedBranchId && !branches.some((branch) => branch.id === requestedBranchId)) {
      throw new AttendanceAccessError(403, 'ANALYTICS_BRANCH_ACCESS_DENIED');
    }
    if (!requestedBranchId && branches.length > 1) {
      return json({ success: true, branches, selectedBranchId: null, dashboard: null });
    }
    const selectedBranchId = requestedBranchId ?? branches[0]?.id;
    if (!selectedBranchId) throw new AttendanceAccessError(403, 'ANALYTICS_BRANCH_ACCESS_DENIED');

    const selectedCourseIds = [...branchByCourse.entries()]
      .filter(([, branchId]) => branchId === selectedBranchId)
      .map(([courseId]) => courseId);
    const coursesById = new Map(catalog.filter((course) => selectedCourseIds.includes(course.id)).map((course) => [course.id, course]));
    const attendance = new AttendanceContractImpl(client, context.productKey);
    const courseRosters = await Promise.all(selectedCourseIds.map((courseId) =>
      attendance.getCourseDailyAttendance({ tenantId, courseId, schoolDay: date })
    ));
    const classroomUtilization: ExecutiveDashboardDTO['enrollment']['classroomUtilization'] = [];
    const rosterRows = new Map<string, { studentPartyId: string; status: string | null }>();
    for (let index = 0; index < selectedCourseIds.length; index += 1) {
      const courseId = selectedCourseIds[index];
      const course = coursesById.get(courseId);
      const roster = courseRosters[index];
      if (!course || !Array.isArray(roster)) return unavailable();
      let currentEnrollment = 0;
      for (const item of roster) {
        if (item.enrollmentStatus !== 'active') continue;
        if (!item.enrollmentId || !item.studentPartyId || rosterRows.has(item.enrollmentId)) return unavailable();
        const daily = item.attendance;
        if (daily && (daily.tenantId !== tenantId || daily.enrollmentId !== item.enrollmentId || daily.schoolDay !== date)) return unavailable();
        const status = daily?.status ?? null;
        if (status !== null && !['present', 'absent', 'excused'].includes(status)) return unavailable();
        rosterRows.set(item.enrollmentId, { studentPartyId: item.studentPartyId, status });
        currentEnrollment += 1;
      }
      classroomUtilization.push({ classId: course.id, className: course.title, currentEnrollment, maxCapacity: null, utilizationRate: null });
    }

    const activeEnrollments = [...rosterRows.values()];
    const presentCount = activeEnrollments.filter((item) => item.status === 'present').length;
    const absentCount = activeEnrollments.filter((item) => item.status === 'absent').length;
    const unmarkedCount = activeEnrollments.filter((item) => item.status === null).length;
    const totalStudents = new Set(activeEnrollments.map((item) => item.studentPartyId)).size;
    const dashboard: ExecutiveDashboardDTO = {
      tenantId,
      evaluatedAt: new Date().toISOString(),
      enrollment: { totalEnrolledStudents: totalStudents, totalClassrooms: selectedCourseIds.length, totalTeachers: null, classroomUtilization },
      attendance: {
        todayPresentCount: presentCount,
        todayAbsentCount: absentCount,
        todayLateCount: null,
        presentVsEnrolledRate: activeEnrollments.length ? Math.round((presentCount / activeEnrollments.length) * 100) : 0,
      },
      careAndSafety: { activeHealthIncidents: null, pendingMedicationDoses: null },
      learning: { draftPortfoliosCount: null, pendingMilestoneReviews: null },
      parentEngagement: { unacknowledgedNotices: null, pendingConsentRequests: null },
      finance: { invoicedGrossTotal: null, reconciledCashCollected: null, outstandingBalanceTotal: null, overdueAccountsCount: null },
      workforce: { activeStaffingViolations: null, openStaffingExceptions: null },
      facilities: { outOfServiceAssetsCount: null, outOfServiceZonesCount: null, overdueScheduleCount: null, openSafetyExceptions: null },
      commandCenter: { unmarkedAttendanceCount: unmarkedCount, leaveRequestsCount: null, overdueInvoicesCount: null, healthIncidentsCount: null, parentRequestsCount: null, totalParentsCount: null },
    };
    return json({ success: true, branches, selectedBranchId, dashboard });
  } catch (error) {
    if (error instanceof AttendanceAccessError) return json({ success: false, error: error.message }, error.status);
    return unavailable();
  }
}
