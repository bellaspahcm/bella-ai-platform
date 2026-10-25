import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLocalDateString } from '@bella/shared';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EducationPreschoolEnrollmentError } from '@/platform/education/contracts/enrollment.contract';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import { EducationCandidateReadError } from '@/platform/education/contracts/student.contract';
import {
  type AuthorizedGuardianDTO,
  PreschoolGuardianAuthorizationService,
} from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { getCurrentUser } from '@/services/user-actions';
import { PreschoolAdmissionError, PreschoolAdmissionService, isAdmissionUuid } from '@/products/bella-education/services/preschool-admission.service';
import { admissionCourseReader } from './admission-course-reader';
import { PreschoolChainService, PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import {
  assertAttendanceSelectors,
  authorizeAttendanceCourse,
  resolveAttendanceRequestContext,
  AttendanceAccessError,
} from '../attendance/request-context';

type EducationServerClient = SupabaseClient<Database>;
type EnrollmentListRow = Pick<
  Database['public']['Tables']['edu_enrollments']['Row'],
  'id' | 'course_id' | 'student_party_id' | 'status' | 'enrolled_at' | 'request_id'
>;
type StudentListRow = Pick<
  Database['public']['Tables']['students']['Row'],
  'student_id' | 'party_id' | 'student_code' | 'metadata'
>;
type PartyListRow = Pick<
  Database['public']['Tables']['party_parties']['Row'],
  'id' | 'display_name' | 'dob' | 'gender'
>;
type CourseListRow = Pick<Database['public']['Tables']['edu_courses']['Row'], 'id' | 'title'>;

const STUDENT_REGISTRY_STATUSES = ['active', 'pending'] as const;
const CANDIDATE_ENROLLMENT_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const CANDIDATE_ENROLLMENT_INPUT_KEYS = new Set([
  'tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id', 'role', 'branchId', 'branch_id',
  'courseId', 'course_id', 'studentPartyId', 'student_party_id', 'guardianPartyId', 'guardian_party_id',
  'requestId', 'request_id',
]);

interface AdmissionRequestBody {
  readonly operationKey?: unknown;
  readonly childName?: unknown;
  readonly nickname?: unknown;
  readonly dateOfBirth?: unknown;
  readonly gender?: unknown;
  readonly guardianName?: unknown;
  readonly guardianPhone?: unknown;
  readonly medicalNote?: unknown;
  readonly courseId?: unknown;
  readonly branchId?: unknown;
  readonly tenantId?: unknown;
}

function createAdminOperationClient(): EducationServerClient | null {
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readMetadataString(
  metadata: Database['public']['Tables']['students']['Row']['metadata'],
  key: string,
): string {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    return '';
  }

  const record = metadata as Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function displayGender(gender: string | null): string {
  if (gender === 'male') return 'Nam';
  if (gender === 'female') return 'Nữ';
  if (gender === 'other') return 'Khác';
  return 'Chưa rõ';
}

function displayStatus(status: string): 'Đang Học' | 'Chờ Nhập Học' | 'Đã Nghỉ Học' {
  if (status === 'active') return 'Đang Học';
  if (status === 'pending') return 'Chờ Nhập Học';
  return 'Đã Nghỉ Học';
}

function displayStatusKey(status: string): 'active' | 'pending' | 'inactive' {
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  return 'inactive';
}

function candidateEnrollmentJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CANDIDATE_ENROLLMENT_PRIVATE_HEADERS });
}

function candidateEnrollmentUnavailable(): NextResponse {
  return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_WORKFLOW_UNAVAILABLE' }, 503);
}

function isCandidateEnrollmentRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asCandidateEnrollmentUuid(value: unknown): string | null {
  if (typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null;
  return value.toLowerCase();
}

async function getEnrollmentCandidates(request: Request): Promise<NextResponse> {
  try {
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') throw new AttendanceAccessError(403, 'ENROLLMENT_PRODUCT_FORBIDDEN');
    const params = new URL(request.url).searchParams;
    const allowed = new Set(['view', 'courseId', 'query', 'limit', 'cursor', 'branchId',
      'tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id']);
    if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1)) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    const courseId = asCandidateEnrollmentUuid(params.get('courseId'));
    const query = params.get('query')?.trim() ?? '';
    const limitValue = params.get('limit') ?? '20';
    const limit = Number(limitValue);
    const cursor = params.get('cursor') ?? undefined;
    if (params.get('view') !== 'candidates' || !courseId || query.length < 2 || query.length > 80
      || /[\u0000-\u001f\u007f*]/.test(query) || !/^\d{1,2}$/.test(limitValue) || limit < 1 || limit > 20
      || (cursor !== undefined && !asCandidateEnrollmentUuid(cursor))
      || (params.has('branchId') && !asCandidateEnrollmentUuid(params.get('branchId')))) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    await authorizeAttendanceCourse(context, request, courseId, getLocalDateString(new Date()));
    const result = await new StudentContractImpl(context.client).searchEnrollmentCandidates({ courseId, query, limit, cursor });
    if (result.tenantId !== context.tenantId || result.courseId !== courseId) return candidateEnrollmentUnavailable();
    return candidateEnrollmentJson({ success: true, ...result });
  } catch (error) {
    if (error instanceof AttendanceAccessError) return candidateEnrollmentJson({ success: false, error: error.code }, error.status);
    if (error instanceof EducationCandidateReadError && error.code === 'INVALID_REQUEST') {
      return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_INVALID_REQUEST' }, 400);
    }
    return candidateEnrollmentUnavailable();
  }
}

async function createExistingStudentEnrollment(request: Request): Promise<NextResponse> {
  try {
    const context = await resolveAttendanceRequestContext(request);
    if (context.productKey !== 'bella_preschool') throw new AttendanceAccessError(403, 'ENROLLMENT_PRODUCT_FORBIDDEN');
    const body: unknown = await request.json().catch(() => null);
    if (!isCandidateEnrollmentRecord(body)
      || Object.keys(body).some(key => !CANDIDATE_ENROLLMENT_INPUT_KEYS.has(key))) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    const courseId = asCandidateEnrollmentUuid(body.courseId ?? body.course_id);
    const studentPartyId = asCandidateEnrollmentUuid(body.studentPartyId ?? body.student_party_id);
    const guardianPartyId = asCandidateEnrollmentUuid(body.guardianPartyId ?? body.guardian_party_id);
    const requestId = asCandidateEnrollmentUuid(body.requestId ?? body.request_id);
    const branchIdValue = body.branchId ?? body.branch_id;
    const branchId = branchIdValue === undefined ? undefined : asCandidateEnrollmentUuid(branchIdValue);
    if ((body.courseId !== undefined && body.course_id !== undefined)
      || (body.studentPartyId !== undefined && body.student_party_id !== undefined)
      || (body.guardianPartyId !== undefined && body.guardian_party_id !== undefined)
      || (body.requestId !== undefined && body.request_id !== undefined)
      || (body.branchId !== undefined && body.branch_id !== undefined)
      || !courseId || !studentPartyId || !guardianPartyId || !requestId
      || (branchIdValue !== undefined && !branchId)) {
      throw new AttendanceAccessError(400, 'ENROLLMENT_INVALID_REQUEST');
    }
    assertAttendanceSelectors(request, context, { courseId, branchId: branchId ?? undefined }, body);
    await authorizeAttendanceCourse(context, request, courseId, getLocalDateString(new Date()), body);
    const enrollment = await new EnrollmentContractImpl(context.client).enrollPreschoolStudent({
      tenantId: context.tenantId, studentPartyId, guardianPartyId, courseId, requestId,
    });
    if (enrollment.tenantId !== context.tenantId || enrollment.studentPartyId !== studentPartyId
      || enrollment.courseId !== courseId || enrollment.status !== 'active') return candidateEnrollmentUnavailable();
    return candidateEnrollmentJson({ success: true, enrollment: {
      id: enrollment.id, tenantId: enrollment.tenantId, studentPartyId: enrollment.studentPartyId,
      courseId: enrollment.courseId, status: enrollment.status, enrolledAt: enrollment.enrolledAt,
    } });
  } catch (error) {
    if (error instanceof AttendanceAccessError) return candidateEnrollmentJson({ success: false, error: error.code }, error.status);
    if (error instanceof EducationPreschoolEnrollmentError) {
      if (error.code === 'INVALID_REQUEST') return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_INVALID_REQUEST' }, 400);
      if (error.code === 'STUDENT_DENIED') return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_STUDENT_ACCESS_DENIED' }, 403);
      if (error.code === 'GUARDIAN_REQUIRED') return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' }, 403);
      if (error.code === 'DENIED') return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_ACCESS_DENIED' }, 403);
    }
    return candidateEnrollmentUnavailable();
  }
}

async function loadStudentRegistry(
  supabase: EducationServerClient,
  tenantId: string,
  actorId: string,
  branchId?: string,
) {
  const assignments = await new PreschoolChainService(supabase).listEnrollmentAssignments(tenantId,actorId,branchId);
  if (!assignments.length) return [];
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('edu_enrollments')
    .select('id, course_id, student_party_id, status, enrolled_at, request_id')
    .eq('tenant_id', tenantId)
    .in('id', assignments.map((row) => row.enrollmentId))
    .in('status', [...STUDENT_REGISTRY_STATUSES])
    .order('enrolled_at', { ascending: false })
    .limit(1000);

  if (enrollmentError) {
    throw new Error(`Failed to load canonical enrollments: ${enrollmentError.message}`);
  }

  const enrollmentRows = (enrollments ?? []) as EnrollmentListRow[];
  const studentPartyIds = [...new Set(enrollmentRows.map((row) => row.student_party_id).filter(Boolean))];
  const courseIds = [...new Set(enrollmentRows.map((row) => row.course_id).filter(Boolean))];

  if (studentPartyIds.length === 0) {
    return [];
  }

  const [
    { data: parties, error: partyError },
    { data: students, error: studentError },
    { data: courses, error: courseError },
    guardiansByStudent,
  ] = await Promise.all([
    supabase
      .from('party_parties')
      .select('id, display_name, dob, gender')
      .eq('tenant_id', tenantId)
      .in('id', studentPartyIds),
    supabase
      .from('students')
      .select('student_id, party_id, student_code, metadata')
      .eq('tenant_id', tenantId)
      .in('party_id', studentPartyIds),
    courseIds.length > 0
      ? supabase
        .from('edu_courses')
        .select('id, title')
        .eq('tenant_id', tenantId)
        .in('id', courseIds)
      : Promise.resolve({ data: [] as CourseListRow[], error: null }),
    new PreschoolGuardianAuthorizationService(supabase).getAuthorizedGuardians(tenantId, studentPartyIds),
  ]);

  if (partyError) throw new Error(`Failed to load canonical student parties: ${partyError.message}`);
  if (studentError) throw new Error(`Failed to load canonical student rows: ${studentError.message}`);
  if (courseError) throw new Error(`Failed to load canonical courses: ${courseError.message}`);

  const partiesById = new Map(((parties ?? []) as PartyListRow[]).map((row) => [row.id, row]));
  const studentsByPartyId = new Map(((students ?? []) as StudentListRow[]).map((row) => [row.party_id, row]));
  const coursesById = new Map(((courses ?? []) as CourseListRow[]).map((row) => [row.id, row]));

  const durable = supabase as unknown as SupabaseClient<DurableDatabase>;
  const { data: intakeRows,error:intakeError } = await durable.from('preschool_admission_operations')
    .select('enrollment_request_id,student_code,branch_id,payload').eq('tenant_id',tenantId)
    .in('enrollment_request_id',assignments.map((row)=>row.requestId));
  if (intakeError) throw new Error(`Failed to reconcile Preschool intake: ${intakeError.message}`);
  return enrollmentRows.map((enrollment) => {
    const party = partiesById.get(enrollment.student_party_id);
    const student = studentsByPartyId.get(enrollment.student_party_id);
    const course = coursesById.get(enrollment.course_id);
    const guardians = guardiansByStudent.get(enrollment.student_party_id) ?? [];
    const primaryGuardian: AuthorizedGuardianDTO | undefined = guardians[0];

    if (!party?.display_name || !student?.student_code) {
      throw new Error(`Canonical student registry join failed for party ${enrollment.student_party_id}`);
    }

    const assignment = assignments.find((row)=>row.enrollmentId===enrollment.id);
    if (!assignment || assignment.courseId!==enrollment.course_id || assignment.requestId!==enrollment.request_id) throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    const intake = intakeRows?.find((row)=>row.enrollment_request_id===enrollment.request_id && row.student_code===student.student_code && row.branch_id===assignment.branchId);
    const intakePayload = intake?.payload && typeof intake.payload==='object' && !Array.isArray(intake.payload) ? intake.payload : null;
    const verifiedIntake = intakePayload?.courseId===enrollment.course_id && intakePayload?.branchId===assignment.branchId ? intakePayload : null;
    const nickname = readMetadataString(verifiedIntake ?? student.metadata, 'nickname');
    const medicalNote = readMetadataString(verifiedIntake ?? student.metadata, 'medicalNote')
      || readMetadataString(student.metadata, 'medical_note');

    return {
      id: student.student_code,
      enrollmentId: enrollment.id,
      studentId: student.student_id,
      partyId: enrollment.student_party_id,
      name: party.display_name,
      nickname,
      dateOfBirth: party.dob ?? '',
      gender: displayGender(party.gender),
      className: course?.title ?? 'Chưa xếp lớp',
      parentName: primaryGuardian?.displayName ?? 'Chưa ghi nhận',
      parentPhone: primaryGuardian?.phone ?? '',
      hasHealthAlert: Boolean(medicalNote),
      medicalNote,
      status: displayStatus(enrollment.status),
      statusKey: displayStatusKey(enrollment.status),
      enrolledAt: enrollment.enrolled_at,
      branchId: assignment.branchId,
    };
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.has('view')) {
    if (params.getAll('view').length !== 1 || params.get('view') !== 'candidates') {
      return candidateEnrollmentJson({ success: false, error: 'ENROLLMENT_INVALID_REQUEST' }, 400);
    }
    return getEnrollmentCandidates(request);
  }
  try {
    if (new URL(request.url).searchParams.get('admissionContext') === '1') {
      const actor = await getCurrentUser();
      if (!actor?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      if (!actor.tenant_id || !['admin', 'super_admin'].includes(actor.role.toLowerCase())) {
        return NextResponse.json({ success: false, error: 'PRESCHOOL_ADMISSION_ACTOR_DENIED' }, { status: 403 });
      }
      return NextResponse.json({ success: true, admissionContext: { actorId: actor.id, tenantId: actor.tenant_id } }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const actor = await getCurrentUser();
    if (!actor?.id) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if (!actor.tenant_id || !['admin','super_admin','admin_staff'].includes(actor.role.toLowerCase())) return NextResponse.json({success:false,error:'PRESCHOOL_CHAIN_ACTOR_DENIED'},{status:403});
    const params = new URL(request.url).searchParams;
    if (params.has('tenantId') && params.get('tenantId')!==actor.tenant_id) return NextResponse.json({success:false,error:'Tenant access denied'},{status:403});
    const supabase = createAdminOperationClient() ?? await createClient();
    const students = await loadStudentRegistry(supabase,actor.tenant_id,actor.id,params.get('branchId') ?? undefined);
    return NextResponse.json({ success: true, students });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load student registry';
    return NextResponse.json({ success: false, error: message }, { status: error instanceof PreschoolChainError ? error.status : 500 });
  }
}

export async function POST(request: Request) {
  const candidateProbe: unknown = await request.clone().json().catch(() => null);
  if (isCandidateEnrollmentRecord(candidateProbe)
    && ['requestId', 'request_id', 'studentPartyId', 'student_party_id', 'guardianPartyId', 'guardian_party_id']
      .some(key => Object.prototype.hasOwnProperty.call(candidateProbe, key))) {
    return createExistingStudentEnrollment(request);
  }
  try {
    // Live canonical Auth/public-user/tenant validation precedes privileged clients.
    const actor = await getCurrentUser();
    if (!actor?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!actor.tenant_id || !['admin', 'super_admin'].includes(actor.role.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'PRESCHOOL_ADMISSION_ACTOR_DENIED' }, { status: 403 });
    }
    let body: AdmissionRequestBody;
    try {
      const value: unknown = await request.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body');
      body = value as AdmissionRequestBody;
    } catch {
      return NextResponse.json({ success: false, error: 'PRESCHOOL_ADMISSION_INVALID_PAYLOAD' }, { status: 400 });
    }
    if (body.tenantId !== undefined && body.tenantId !== actor.tenant_id) {
      return NextResponse.json({ success: false, error: 'PRESCHOOL_ADMISSION_TENANT_DENIED' }, { status: 403 });
    }
    const operationKey = asTrimmedString(body.operationKey);
    if (!isAdmissionUuid(operationKey)) {
      return NextResponse.json({ success: false, error: 'PRESCHOOL_ADMISSION_INVALID_KEY' }, { status: 400 });
    }
    const client = createAdminOperationClient() ?? await createClient();
    const hasPayload = Object.keys(body).some((key) => key !== 'operationKey' && key !== 'tenantId');
    const result = await new PreschoolAdmissionService(client,{ courseReader:admissionCourseReader(client) }).admit({
      tenantId: actor.tenant_id, actorId: actor.id, operationKey,
      ...(hasPayload ? { payload: body } : {}),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrollment failed';
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    const status = error instanceof PreschoolAdmissionError || error instanceof PreschoolChainError ? error.status
      : code === 'PARTY_REGISTRATION_PAYLOAD_CONFLICT' || code === 'EDUCATION_ENROLLMENT_RECOVERY_CONFLICT' ? 409
      : message.includes('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED') ? 403
      : message.includes('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT') ? 409
      : message.includes('PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
