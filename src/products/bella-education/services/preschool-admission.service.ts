import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EducationPreschoolOperationError, type IEducationPreschoolOperationsContract } from '@/platform/education/contracts/preschool-operations.contract';
import { EducationPreschoolOperationsContractImpl } from '@/platform/education/contracts/preschool-operations.contract.impl';
import type { IEducationStudentContract } from '@/platform/education/contracts/student.contract';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import type { IEducationEnrollmentContract } from '@/platform/education/contracts/enrollment.contract';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import type { IEducationEnrollmentRecoveryContract } from '@/platform/education/contracts/enrollment-recovery.contract';
import { EnrollmentRecoveryContractImpl } from '@/platform/education/contracts/enrollment-recovery.contract.impl';
import type { IPartyRegistrationContract } from '@/platform/party/registration.contract';
import { PartyRegistrationContractImpl } from '@/platform/party/registration.contract.impl';
import { PreschoolChainService, PreschoolChainError } from './preschool-chain.service';
import { normalizePreschoolGuardianPhone, PreschoolGuardianAuthorizationService } from './preschool-guardian-authorization.service';

export interface PreschoolAdmissionPayload {
  readonly childName: string;
  readonly nickname: string;
  readonly dateOfBirth: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly guardianName: string;
  readonly guardianPhone: string;
  readonly medicalNote: string;
  readonly courseId: string;
  readonly branchId: string;
}

export class PreschoolAdmissionError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'PreschoolAdmissionError';
  }
}

export function isAdmissionUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeAdmissionPayload(value: unknown): PreschoolAdmissionPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_INVALID_PAYLOAD', 400);
  const record = value as Record<string, unknown>;
  const string = (key: string) => typeof record[key] === 'string' ? record[key].trim() : '';
  const rawGender = string('gender').toLowerCase();
  const gender = rawGender === 'nam' || rawGender === 'male' ? 'male'
    : rawGender === 'nữ' || rawGender === 'nu' || rawGender === 'female' ? 'female' : 'other';
  let guardianPhone: string;
  try { guardianPhone = normalizePreschoolGuardianPhone(string('guardianPhone')); }
  catch { throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_INVALID_GUARDIAN_PHONE', 400); }
  const result: PreschoolAdmissionPayload = {
    childName: string('childName'), nickname: string('nickname'), dateOfBirth: string('dateOfBirth'), gender,
    guardianName: string('guardianName'), guardianPhone,
    medicalNote: string('medicalNote'), courseId: string('courseId').toLowerCase(), branchId: string('branchId').toLowerCase(),
  };
  const date = new Date(`${result.dateOfBirth}T00:00:00.000Z`);
  if (!result.childName || !result.guardianName || !/^\d{4}-\d{2}-\d{2}$/.test(result.dateOfBirth)
    || result.dateOfBirth.startsWith('0000-') || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result.dateOfBirth
    || !isAdmissionUuid(result.courseId) || !isAdmissionUuid(result.branchId)
    || result.childName.length > 250 || result.guardianName.length > 250
    || result.nickname.length > 250 || result.medicalNote.length > 10000 || result.guardianPhone.length > 30) {
    throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_INVALID_PAYLOAD', 400);
  }
  return result;
}

export interface AdmissionCourseReader {
  readCourse(tenantId: string, courseId: string): Promise<{ id: string; title: string; status: string } | null>;
}

interface AdmissionDependencies {
  readonly courseReader: AdmissionCourseReader;
  readonly parties?: IPartyRegistrationContract;
  readonly students?: IEducationStudentContract;
  readonly enrollments?: IEducationEnrollmentContract;
  readonly recovery?: IEducationEnrollmentRecoveryContract;
  readonly operations?: IEducationPreschoolOperationsContract;
  readonly chain?: Pick<PreschoolChainService, 'preflightEnrollmentBranch' | 'assignEnrollmentToBranch' | 'getEnrollmentChain'>;
  readonly guardians?: Pick<PreschoolGuardianAuthorizationService, 'establishForCanonicalGuardian'>;
}

export class PreschoolAdmissionService {
  private readonly operations: IEducationPreschoolOperationsContract;
  private readonly parties: IPartyRegistrationContract;
  private readonly students: IEducationStudentContract;
  private readonly enrollments: IEducationEnrollmentContract;
  private readonly recovery: IEducationEnrollmentRecoveryContract;
  private readonly chain: NonNullable<AdmissionDependencies['chain']>;
  private readonly courseReader: AdmissionCourseReader;
  private readonly guardians: NonNullable<AdmissionDependencies['guardians']>;

  constructor(private readonly client: SupabaseClient<Database>, dependencies: AdmissionDependencies) {
    this.courseReader = dependencies.courseReader;
    this.operations = dependencies.operations ?? new EducationPreschoolOperationsContractImpl(client);
    this.parties = dependencies.parties ?? new PartyRegistrationContractImpl(client);
    this.students = dependencies.students ?? new StudentContractImpl(client);
    this.enrollments = dependencies.enrollments ?? new EnrollmentContractImpl(client);
    this.recovery = dependencies.recovery ?? new EnrollmentRecoveryContractImpl(client);
    this.chain = dependencies.chain ?? new PreschoolChainService(client);
    this.guardians = dependencies.guardians ?? new PreschoolGuardianAuthorizationService(client);
  }

  private async assertActor(tenantId: string, actorId: string): Promise<void> {
    const { data, error } = await this.client.from('users').select('id, role, status')
      .eq('tenant_id', tenantId).eq('id', actorId).maybeSingle();
    if (error) throw new Error(`Admission actor validation failed: ${error.message}`);
    if (!data || data.status !== 'active' || !['admin', 'super_admin'].includes(data.role.toLowerCase())) {
      throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_ACTOR_DENIED', 403);
    }
  }

  private async open(tenantId: string, actorId: string, operationKey: string, payload?: PreschoolAdmissionPayload) {
    try {
      return await this.operations.openAdmission({ tenantId, actorId, operationKey, ...(payload ? { payload: { ...payload } } : {}) });
    } catch (error) {
      if (error instanceof EducationPreschoolOperationError) {
        throw new PreschoolAdmissionError(error.code, error.status);
      }
      if (error instanceof Error && error.message === 'PRESCHOOL_ADMISSION_ACTOR_DENIED') {
        throw new PreschoolAdmissionError(error.message, 403);
      }
      if (error instanceof Error && error.message === 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT') {
        throw new PreschoolChainError(error.message);
      }
      throw error;
    }
  }

  async admit(input: { readonly tenantId: string; readonly actorId: string; readonly operationKey: string; readonly payload?: unknown }) {
    const tenantId = input.tenantId.toLowerCase();
    const actorId = input.actorId.toLowerCase();
    const operationKey = input.operationKey.toLowerCase();
    if (![tenantId, actorId, operationKey].every(isAdmissionUuid)) throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_INVALID_KEY', 400);
    await this.assertActor(tenantId, actorId);
    const submitted = input.payload === undefined ? undefined : normalizeAdmissionPayload(input.payload);
    let verifiedCourse: Awaited<ReturnType<AdmissionCourseReader['readCourse']>> | undefined;
    let operation = await this.open(tenantId, actorId, operationKey);
    if (!operation) {
      if (!submitted) throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND', 404);
      // F2 validation remains ahead of even the initial Product intent write.
      await this.chain.preflightEnrollmentBranch({ tenantId, actorUserId: actorId, branchId: submitted.branchId, courseId: submitted.courseId });
      const course = await this.courseReader.readCourse(tenantId,submitted.courseId);
      verifiedCourse = course;
      if (!course || course.status !== 'active') throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_ACTIVE_COURSE_REQUIRED', 400);
      operation = await this.open(tenantId, actorId, operationKey, submitted);
    }
    if (!operation || operation.tenant_id !== tenantId || operation.actor_id !== actorId || operation.operation_key !== operationKey) {
      throw new PreschoolChainError('PRESCHOOL_ADMISSION_OPERATION_CANONICAL_CONFLICT');
    }
    const payload = normalizeAdmissionPayload(operation.payload);
    const course = verifiedCourse === undefined ? await this.courseReader.readCourse(tenantId,payload.courseId) : verifiedCourse;
    if (!course || course.id!==payload.courseId) throw new PreschoolChainError('PRESCHOOL_ADMISSION_COURSE_CANONICAL_CONFLICT');
    if (operation.branch_id !== payload.branchId) throw new PreschoolChainError('PRESCHOOL_ADMISSION_OPERATION_BRANCH_CONFLICT');
    await this.chain.preflightEnrollmentBranch({ tenantId, actorUserId: actorId, branchId: payload.branchId, courseId: payload.courseId });
    if (submitted) await this.open(tenantId, actorId, operationKey, submitted); // immutable payload equality in DB

    const child = await this.parties.registerOrRecoverPerson({
      tenantId, actorId, registrationKey: `${operationKey}:child`,
      person: { displayName: payload.childName, legalName: payload.childName, dob: payload.dateOfBirth, gender: payload.gender },
    });
    const guardian = await this.parties.registerOrRecoverPerson({
      tenantId, actorId, registrationKey: `${operationKey}:guardian`,
      person: { displayName: payload.guardianName, legalName: payload.guardianName },
      identifier: { type: 'preschool_guardian_phone', value: payload.guardianPhone },
    });
    const guardianAuthorization = await this.guardians.establishForCanonicalGuardian({
      tenantId, actorId, studentPartyId: child.partyId, guardianPartyId: guardian.partyId,
      guardianName: guardian.displayName, guardianPhone: payload.guardianPhone,
    });
    let student = await this.students.getStudent(tenantId, child.partyId);
    if (!student) {
      try {
        await this.students.registerStudent({ tenantId, partyId: child.partyId, studentCode: operation.student_code, guardianPartyId: guardian.partyId });
      } catch (error) {
        // Covers uniqueness races and a committed registration whose response was lost.
        student = await this.students.getStudent(tenantId, child.partyId);
        if (!student) throw error;
      }
      student = await this.students.getStudent(tenantId, child.partyId);
    }
    if (!student || student.partyId !== child.partyId || student.tenantId !== tenantId || student.studentCode !== operation.student_code) {
      throw new PreschoolChainError('PRESCHOOL_ADMISSION_STUDENT_CANONICAL_CONFLICT');
    }
    const recoveryInput = { tenantId, studentPartyId: child.partyId, courseId: payload.courseId, requestId: operation.enrollment_request_id };
    // Recovery precedes mutable new-enrollment eligibility; errors/conflicts are not absence.
    let enrollment = await this.recovery.getEnrollmentByRequest(recoveryInput);
    if (!enrollment) {
      try { await this.enrollments.enrollStudent(recoveryInput); }
      catch (error) {
        enrollment = await this.recovery.getEnrollmentByRequest(recoveryInput);
        if (!enrollment) throw error;
      }
      enrollment = await this.recovery.getEnrollmentByRequest(recoveryInput);
    }
    if (!enrollment || enrollment.tenantId !== tenantId || enrollment.studentPartyId !== child.partyId || enrollment.courseId !== payload.courseId) {
      throw new PreschoolChainError('PRESCHOOL_ADMISSION_ENROLLMENT_CANONICAL_CONFLICT');
    }
    if (enrollment.status !== 'active' && enrollment.status !== 'pending') {
      throw new PreschoolAdmissionError('PRESCHOOL_ADMISSION_ENROLLMENT_LIFECYCLE_REQUIRES_REVIEW', 409);
    }
    await this.chain.assignEnrollmentToBranch({
      tenantId, courseId: payload.courseId, enrollmentId: enrollment.id, branchId: payload.branchId,
      actorUserId: actorId, requestId: operation.enrollment_request_id,
    });
    // Revalidate current actor/branch before returning any recovered payload.
    await this.assertActor(tenantId, actorId);
    await this.chain.preflightEnrollmentBranch({ tenantId, actorUserId: actorId, branchId: payload.branchId, courseId: payload.courseId });
    const [studentReadBack, enrollmentReadBack, chain, canonicalGuardian] = await Promise.all([
      this.students.getStudent(tenantId, child.partyId), this.enrollments.getEnrollment(tenantId, enrollment.id),
      this.chain.getEnrollmentChain(tenantId, enrollment.id),
      this.guardians.establishForCanonicalGuardian({ tenantId, actorId, studentPartyId: child.partyId, guardianPartyId: guardian.partyId, guardianName: guardian.displayName, guardianPhone: payload.guardianPhone }),
    ]);
    if (!studentReadBack || studentReadBack.partyId !== child.partyId || studentReadBack.studentCode !== operation.student_code
      || !enrollmentReadBack || enrollmentReadBack.id !== enrollment.id || enrollmentReadBack.tenantId !== tenantId
      || enrollmentReadBack.studentPartyId !== child.partyId || enrollmentReadBack.courseId !== payload.courseId
      || !['active', 'pending'].includes(enrollmentReadBack.status)
      || !chain || chain.branchId !== payload.branchId || chain.courseId !== payload.courseId || chain.enrollmentId !== enrollment.id
      || chain.requestId !== operation.enrollment_request_id
      || canonicalGuardian.authorizationId !== guardianAuthorization.authorizationId) {
      throw new PreschoolChainError('PRESCHOOL_ADMISSION_FINAL_READBACK_FAILED');
    }
    return {
      success: true as const, operationKey,
      student: { partyId: child.partyId, studentCode: studentReadBack.studentCode,
        ...payload, childName:child.displayName, dateOfBirth:child.dateOfBirth ?? '', gender:child.gender ?? '',
        guardianName: canonicalGuardian.displayName, guardianPartyId: guardian.partyId },
      guardianAuthorization: { id: canonicalGuardian.authorizationId, guardianPartyId: guardian.partyId,
        studentPartyId: child.partyId, displayName: canonicalGuardian.displayName,
        phone: canonicalGuardian.phone, status: canonicalGuardian.status },
      enrollment: { id: enrollmentReadBack.id, courseId: enrollmentReadBack.courseId,
        courseTitle: course.title, status: enrollmentReadBack.status, enrolledAt: enrollmentReadBack.enrolledAt },
      chain,
    };
  }
}
