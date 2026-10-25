/**
 * Education OS — Enrollment public contract interface
 */
export interface EducationEnrollmentDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly status: 'pending' | 'active' | 'completed' | 'cancelled';
  readonly enrolledAt: string;
}

export interface EnrollStudentInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly requestId: string; // for idempotency de-duplication
  readonly overrideJustification?: string; // justification if prerequisites block overridden
}

export interface IEducationEnrollmentContract {
  enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO>;
  getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null>;
}

/** Explicit Preschool admission capability; generic consumers remain unchanged. */
export interface EnrollPreschoolStudentInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly requestId: string;
}

export interface IEducationPreschoolEnrollmentContract {
  enrollPreschoolStudent(input: EnrollPreschoolStudentInput): Promise<EducationEnrollmentDTO>;
}

export class EducationPreschoolEnrollmentError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'DENIED' | 'STUDENT_DENIED' | 'GUARDIAN_REQUIRED' | 'CONFLICT' | 'UNAVAILABLE') {
    super('EDUCATION_PRESCHOOL_ENROLLMENT_' + code);
    this.name = 'EducationPreschoolEnrollmentError';
  }
}
