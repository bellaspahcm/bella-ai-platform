import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EnrollmentProductService } from '@/products/bella-education/services/enrollment.service';
import { PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import {
  type AuthorizedGuardianDTO,
  normalizePreschoolGuardianPhone,
  PreschoolGuardianAuthorizationService,
} from '@/products/bella-education/services/preschool-guardian-authorization.service';
import type { IAccountingContract } from '@/platform/accounting/contracts/accounting.contract';

type EducationServerClient = SupabaseClient<Database>;
type PartyInsert = Database['public']['Tables']['party_parties']['Insert'];
type CourseRow = Pick<Database['public']['Tables']['edu_courses']['Row'], 'id' | 'title'>;
type EnrollmentListRow = Pick<
  Database['public']['Tables']['edu_enrollments']['Row'],
  'id' | 'course_id' | 'student_party_id' | 'status' | 'enrolled_at'
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

function getDevMockEmail(request: Request): string {
  if (process.env.NODE_ENV !== 'development') return '';
  return request.headers.get('x-mock-user-email')?.trim() ?? '';
}

function createDevMockClient(mockEmail: string): EducationServerClient | null {
  if (!mockEmail) return null;
  return createAdminOperationClient();
}

function createAdminOperationClient(): EducationServerClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const noTuitionAccountingContract: IAccountingContract = {
  async postJournalEntry() {
    return { success: true };
  },
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeGender(value: string): 'male' | 'female' | 'other' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'nam' || normalized === 'male') return 'male';
  if (normalized === 'nữ' || normalized === 'nu' || normalized === 'female') return 'female';
  return 'other';
}

function generateStudentCode(): string {
  const year = new Date().getUTCFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `EDU-${year}-${suffix}`;
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

async function getTenantIdFromUser(
  supabase: EducationServerClient,
  user: User,
): Promise<string | null> {
  const metadataTenantId = asTrimmedString(user.user_metadata?.tenant_id);
  if (metadataTenantId) return metadataTenantId;

  if (!isUuid(user.id)) return null;

  const { data, error } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant for current user: ${error.message}`);
  }

  return data?.tenant_id ?? null;
}

async function resolveRequestContext(
  supabase: EducationServerClient,
  body: AdmissionRequestBody,
  mockEmail = '',
): Promise<{ tenantId: string; userId: string }> {
  if (mockEmail) {
    const { data: mockUser, error: mockUserError } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('email', mockEmail)
      .maybeSingle();

    if (mockUserError) {
      throw new Error(`Failed to resolve development mock user: ${mockUserError.message}`);
    }
    if (mockUser?.tenant_id && mockUser.id) {
      return { tenantId: mockUser.tenant_id, userId: mockUser.id };
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { tenantId: '', userId: '' };
  }

  const tenantId = await getTenantIdFromUser(supabase, user);
  if (tenantId) {
    return { tenantId, userId: user.id };
  }

  if (process.env.NODE_ENV === 'test') {
    return {
      tenantId: asTrimmedString(body.tenantId),
      userId: isUuid(user.id) ? user.id : '00000000-0000-0000-0000-000000000001',
    };
  }

  return { tenantId: '', userId: user.id };
}

async function createStudentParty(
  supabase: EducationServerClient,
  input: {
    readonly tenantId: string;
    readonly childName: string;
    readonly dateOfBirth: string;
    readonly gender: 'male' | 'female' | 'other';
    readonly userId: string;
  },
): Promise<string> {
  const row: PartyInsert = {
    tenant_id: input.tenantId,
    party_type: 'person',
    display_name: input.childName,
    legal_name: input.childName,
    dob: input.dateOfBirth,
    gender: input.gender,
    created_by: isUuid(input.userId) ? input.userId : null,
    updated_by: isUuid(input.userId) ? input.userId : null,
  };

  const { data, error } = await supabase
    .from('party_parties')
    .insert(row)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create canonical student Party');
  }

  return data.id;
}

async function getCourseOrThrow(
  supabase: EducationServerClient,
  tenantId: string,
  courseId: string,
): Promise<CourseRow> {
  const { data, error } = await supabase
    .from('edu_courses')
    .select('id, title')
    .eq('id', courseId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify course: ${error.message}`);
  }
  if (!data) {
    throw new Error('Active course not found for this tenant');
  }

  return data;
}

async function loadStudentRegistry(
  supabase: EducationServerClient,
  tenantId: string,
) {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('edu_enrollments')
    .select('id, course_id, student_party_id, status, enrolled_at')
    .eq('tenant_id', tenantId)
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

  return enrollmentRows.map((enrollment) => {
    const party = partiesById.get(enrollment.student_party_id);
    const student = studentsByPartyId.get(enrollment.student_party_id);
    const course = coursesById.get(enrollment.course_id);
    const guardians = guardiansByStudent.get(enrollment.student_party_id) ?? [];
    const primaryGuardian: AuthorizedGuardianDTO | undefined = guardians[0];

    if (!party?.display_name || !student?.student_code) {
      throw new Error(`Canonical student registry join failed for party ${enrollment.student_party_id}`);
    }

    const nickname = readMetadataString(student.metadata, 'nickname');
    const medicalNote = readMetadataString(student.metadata, 'medicalNote')
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
    };
  });
}

export async function GET(request: Request) {
  try {
    const mockEmail = getDevMockEmail(request);
    const supabase = createDevMockClient(mockEmail) ?? await createClient();
    const { tenantId, userId } = await resolveRequestContext(supabase, {}, mockEmail);
    const operationSupabase = createAdminOperationClient() ?? supabase;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not found for current user' }, { status: 403 });
    }

    const students = await loadStudentRegistry(operationSupabase, tenantId);
    return NextResponse.json({ success: true, students });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load student registry';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const mockEmail = getDevMockEmail(request);
    const supabase = createDevMockClient(mockEmail) ?? await createClient();
    const body = (await request.json()) as AdmissionRequestBody;
    const { tenantId, userId } = await resolveRequestContext(supabase, body, mockEmail);
    const operationSupabase = createAdminOperationClient() ?? supabase;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not found for current user' }, { status: 403 });
    }

    const childName = asTrimmedString(body.childName);
    const nickname = asTrimmedString(body.nickname);
    const dateOfBirth = asTrimmedString(body.dateOfBirth);
    const gender = normalizeGender(asTrimmedString(body.gender));
    const guardianName = asTrimmedString(body.guardianName);
    const guardianPhone = asTrimmedString(body.guardianPhone);
    const medicalNote = asTrimmedString(body.medicalNote);
    const courseId = asTrimmedString(body.courseId);
    const branchId = asTrimmedString(body.branchId);

    if (!childName || !dateOfBirth || !guardianName || !guardianPhone || !courseId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: childName, dateOfBirth, guardianName, guardianPhone, courseId',
      }, { status: 400 });
    }
    normalizePreschoolGuardianPhone(guardianPhone);

    const course = await getCourseOrThrow(operationSupabase, tenantId, courseId);
    const studentPartyId = await createStudentParty(operationSupabase, {
      tenantId,
      childName,
      dateOfBirth,
      gender,
      userId,
    });
    const guardianAuthorization = await new PreschoolGuardianAuthorizationService(operationSupabase)
      .establishForEnrollment({
        tenantId,
        studentPartyId,
        guardianName,
        guardianPhone,
        actorId: userId,
      });

    const studentCode = generateStudentCode();
    const studentContract = new StudentContractImpl(operationSupabase);
    const student = await studentContract.registerStudent({
      tenantId,
      partyId: studentPartyId,
      studentCode,
      guardianPartyId: guardianAuthorization.guardianPartyId,
    });

    const enrollmentContract = new EnrollmentContractImpl(operationSupabase);
    const enrollmentService = new EnrollmentProductService(enrollmentContract, noTuitionAccountingContract);
    const requestId = crypto.randomUUID();
    const enrollment = await enrollmentService.enrollStudent({
      tenantId,
      studentPartyId: student.partyId,
      courseId: course.id,
      requestId,
    });

    const chainService = new PreschoolChainService(operationSupabase);
    const chainAssignment = branchId
      ? await chainService.assignEnrollmentToBranch({
          tenantId,
          courseId: course.id,
          enrollmentId: enrollment.id,
          branchId,
          actorUserId: userId,
          requestId,
        })
      : null;

    const [studentReadBack, enrollmentReadBack] = await Promise.all([
      studentContract.getStudent(tenantId, student.partyId),
      enrollmentContract.getEnrollment(tenantId, enrollment.id),
    ]);

    if (!studentReadBack || studentReadBack.partyId !== student.partyId) {
      throw new Error('Student read-back failed after registration');
    }
    if (!enrollmentReadBack || enrollmentReadBack.studentPartyId !== student.partyId) {
      throw new Error('Enrollment read-back failed after persistence');
    }
    const chainReadBack = chainAssignment
      ? await chainService.getEnrollmentChain(tenantId, enrollmentReadBack.id)
      : null;
    if (chainAssignment && (!chainReadBack || chainReadBack.branchId !== chainAssignment.branchId)) {
      throw new Error('Preschool chain read-back failed after assignment persistence');
    }

    return NextResponse.json({
      success: true,
      student: {
        partyId: studentReadBack.partyId,
        studentCode: studentReadBack.studentCode,
        childName,
        nickname,
        dateOfBirth,
        gender,
        guardianName,
        guardianPhone,
        medicalNote,
        guardianPartyId: guardianAuthorization.guardianPartyId,
      },
      guardianAuthorization: {
        id: guardianAuthorization.authorizationId,
        guardianPartyId: guardianAuthorization.guardianPartyId,
        studentPartyId: guardianAuthorization.studentPartyId,
        displayName: guardianAuthorization.displayName,
        phone: guardianAuthorization.phone,
        status: guardianAuthorization.status,
      },
      enrollment: {
        id: enrollmentReadBack.id,
        courseId: enrollmentReadBack.courseId,
        courseTitle: course.title,
        status: enrollmentReadBack.status,
        enrolledAt: enrollmentReadBack.enrolledAt,
      },
      chain: chainReadBack,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrollment failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
