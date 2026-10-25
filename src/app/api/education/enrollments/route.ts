import { NextResponse } from 'next/server';
import { getLocalDateString } from '@bella/shared';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EducationPreschoolEnrollmentError } from '@/platform/education/contracts/enrollment.contract';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import { EducationCandidateReadError } from '@/platform/education/contracts/student.contract';
import {
  assertAttendanceSelectors,
  authorizeAttendanceCourse,
  resolveAttendanceRequestContext,
  AttendanceAccessError,
} from '../attendance/request-context';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const INPUT_KEYS = new Set(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'branchId', 'branch_id', 'courseId', 'course_id', 'studentPartyId', 'student_party_id', 'guardianPartyId', 'guardian_party_id', 'requestId', 'request_id']);

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}
function unavailable(): NextResponse {
  return json({ success: false, error: 'ENROLLMENT_WORKFLOW_UNAVAILABLE' }, 503);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requiredUuid(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null;
    return value.toLowerCase();
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') throw new AttendanceAccessError(403, 'ENROLLMENT_PRODUCT_FORBIDDEN');
    const params = new URL(request.url).searchParams;
    const allowed = new Set(['view', 'courseId', 'query', 'limit', 'cursor', 'branchId',
      'tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id']);
    if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1)) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    const courseId = requiredUuid(params.get('courseId'));
    const query = params.get('query')?.trim() ?? '';
    const limitValue = params.get('limit') ?? '20';
    const limit = Number(limitValue);
    const cursor = params.get('cursor') ?? undefined;
    if (params.get('view') !== 'candidates' || !courseId || query.length < 2 || query.length > 80
      || /[\u0000-\u001f\u007f*]/.test(query) || !/^\d{1,2}$/.test(limitValue) || limit < 1 || limit > 20
      || (cursor !== undefined && !requiredUuid(cursor))
      || (params.has('branchId') && !requiredUuid(params.get('branchId')))) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    await authorizeAttendanceCourse(context, request, courseId, getLocalDateString(new Date()));
    const result = await new StudentContractImpl(context.client).searchEnrollmentCandidates({ courseId, query, limit, cursor });
    if (result.tenantId !== context.tenantId || result.courseId !== courseId) return unavailable();
    return json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AttendanceAccessError) return json({ success: false, error: error.code }, error.status);
    if (error instanceof EducationCandidateReadError && error.code === 'INVALID_REQUEST') {
      return json({ success: false, error: 'ENROLLMENT_INVALID_REQUEST' }, 400);
    }
    return unavailable();
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') throw new AttendanceAccessError(403, 'ENROLLMENT_PRODUCT_FORBIDDEN');
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(key => !INPUT_KEYS.has(key))) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    const courseId = requiredUuid(body.courseId ?? body.course_id);
    const studentPartyId = requiredUuid(body.studentPartyId ?? body.student_party_id);
    const guardianPartyId = requiredUuid(body.guardianPartyId ?? body.guardian_party_id);
    const requestId = requiredUuid(body.requestId ?? body.request_id);
    const branchIdValue = body.branchId ?? body.branch_id;
    const branchId = branchIdValue === undefined ? undefined : requiredUuid(branchIdValue);
    if ((body.courseId !== undefined && body.course_id !== undefined) || (body.studentPartyId !== undefined && body.student_party_id !== undefined)
      || (body.guardianPartyId !== undefined && body.guardian_party_id !== undefined) || (body.requestId !== undefined && body.request_id !== undefined)
      || (body.branchId !== undefined && body.branch_id !== undefined)
      || !courseId || !studentPartyId || !guardianPartyId || !requestId || (branchIdValue !== undefined && !branchId)) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    assertAttendanceSelectors(request, context, {
      courseId, branchId: branchId ?? undefined,
    }, body);
    const day = getLocalDateString(new Date());
    await authorizeAttendanceCourse(context, request, courseId, day, body);

    const enrollment = await new EnrollmentContractImpl(context.client).enrollPreschoolStudent({
      tenantId: context.tenantId, studentPartyId, guardianPartyId, courseId, requestId,
    });
    if (enrollment.tenantId !== context.tenantId || enrollment.studentPartyId !== studentPartyId
      || enrollment.courseId !== courseId || enrollment.status !== 'active') return unavailable();
    return json({ success: true, enrollment: { id: enrollment.id, tenantId: enrollment.tenantId,
      studentPartyId: enrollment.studentPartyId, courseId: enrollment.courseId, status: enrollment.status,
      enrolledAt: enrollment.enrolledAt } });
  } catch (error) {
    if (error instanceof AttendanceAccessError) return json({ success: false, error: error.code }, error.status);
    if (error instanceof EducationPreschoolEnrollmentError) {
      if (error.code === 'INVALID_REQUEST') return json({ success: false, error: 'ENROLLMENT_INVALID_REQUEST' }, 400);
      if (error.code === 'STUDENT_DENIED') return json({ success: false, error: 'ENROLLMENT_STUDENT_ACCESS_DENIED' }, 403);
      if (error.code === 'GUARDIAN_REQUIRED') return json({ success: false, error: 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' }, 403);
      if (error.code === 'DENIED') return json({ success: false, error: 'ENROLLMENT_ACCESS_DENIED' }, 403);
    }
    return unavailable();
  }
}
