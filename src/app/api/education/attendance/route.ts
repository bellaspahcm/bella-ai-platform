import { NextResponse } from 'next/server';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { AttendanceProductService } from '@/products/bella-education/services/attendance.service';
import { PreschoolGuardianAuthorizationService } from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import {
  ATTENDANCE_PRIVATE_HEADERS, AttendanceAccessError, assertAttendanceDay, assertAttendanceSelectors,
  authorizeAttendanceCourse, filterAttendanceRoster, requireAttendanceEnrollment, requireSchoolDay,
  resolveAttendanceRequestContext, resolveAttendanceRollCallTime,
} from './request-context';

export const dynamic = 'force-dynamic';
function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: ATTENDANCE_PRIVATE_HEADERS });
}
function failure(error: unknown) {
  return json({ success: false, error: error instanceof AttendanceAccessError ? error.code : 'ATTENDANCE_UNAVAILABLE' },
    error instanceof AttendanceAccessError ? error.status : 503);
}
function isAttendanceStatus(value: unknown): value is EducationAttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'excused';
}
export async function GET(request: Request) {
  try {
    const context = await resolveAttendanceRequestContext(request);
    const query = new URL(request.url).searchParams;
    const views = query.getAll('view');
    if (views.length > 1 || (views.length === 1 && views[0] !== 'roster')) {
      throw new AttendanceAccessError(400, 'INVALID_ATTENDANCE_VIEW');
    }
    if (views[0] === 'roster' && context.productKey !== 'bella_preschool') {
      throw new AttendanceAccessError(403, 'ATTENDANCE_ROSTER_UNSUPPORTED_PRODUCT');
    }
    if (query.getAll('courseId').length > 1 || query.getAll('date').length > 1) {
      throw new AttendanceAccessError(403, 'ATTENDANCE_CONTEXT_OVERRIDE_DENIED');
    }
    const courseId = query.get('courseId');
    if (!courseId?.trim()) throw new AttendanceAccessError(400, 'courseId is required');
    const schoolDay = requireSchoolDay(query.get('date'));
    await authorizeAttendanceCourse(context, request, courseId, schoolDay);
    const service = new AttendanceProductService(new AttendanceContractImpl(context.client));
    const roster = await filterAttendanceRoster(context,
      await service.getCourseDailyAttendance({ tenantId: context.tenantId, courseId, schoolDay }), courseId, schoolDay);
    // The roll-call workflow does not depend on pickup/guardian capabilities.
    // Keep the existing enriched response unchanged for its other consumers.
    if (views[0] === 'roster') return json({ success: true, courseId, schoolDay, roster });
    const guardiansByStudent = await new PreschoolGuardianAuthorizationService(context.client)
      .getAuthorizedGuardians(context.tenantId, roster.map(student => student.studentPartyId));
    const handoversByStudent = await new PreschoolSafePickupHandoverService(context.client)
      .getLatestHandovers(context.tenantId, roster.map(student => student.studentPartyId));
    return json({ success: true, roster: roster.map(student => ({
      ...student, authorizedGuardians: guardiansByStudent.get(student.studentPartyId) ?? [],
      safePickupHandover: handoversByStudent.get(student.studentPartyId) ?? null,
    })) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await resolveAttendanceRequestContext(request);
    let body: unknown;
    try { body = await request.json(); } catch { throw new AttendanceAccessError(400, 'INVALID_ATTENDANCE_REQUEST'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AttendanceAccessError(400, 'INVALID_ATTENDANCE_REQUEST');
    const input = body as Record<string, unknown>;
    assertAttendanceSelectors(request, context, {}, input);
    if (typeof input.enrollmentId !== 'string' || !input.enrollmentId.trim()) {
      throw new AttendanceAccessError(400, 'enrollmentId is required');
    }
    if (!isAttendanceStatus(input.status)) throw new AttendanceAccessError(400, 'status must be present, absent, or excused');
    const day = requireSchoolDay(input.date);
    assertAttendanceDay(context, day);
    const rollCallTime = resolveAttendanceRollCallTime(day, input.rollCallTime);
    assertAttendanceSelectors(request, context, { enrollmentId: input.enrollmentId, date: day }, input);
    const enrollment = await requireAttendanceEnrollment(context, input.enrollmentId, day);
    await authorizeAttendanceCourse(context, request, enrollment.courseId, day, input);
    const service = new AttendanceProductService(new AttendanceContractImpl(context.client));
    const attendance = await service.setDailyAttendance({ tenantId: context.tenantId,
      enrollmentId: input.enrollmentId, status: input.status, rollCallTime });
    return json({ success: true, attendance });
  } catch (error) { return failure(error); }
}
