import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import {
  type AuthorizedGuardianDTO,
  PreschoolGuardianAuthorizationService,
} from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { getCurrentUser } from '@/services/user-actions';
import { PreschoolAdmissionError, PreschoolAdmissionService, isAdmissionUuid } from '@/products/bella-education/services/preschool-admission.service';
import { admissionCourseReader } from './admission-course-reader';
import { PreschoolChainService, PreschoolChainError } from '@/products/bella-education/services/preschool-chain.service';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';

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
