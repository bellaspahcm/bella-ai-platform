import type { EducationEnrollmentDTO } from './enrollment.contract';

export interface RecoverEducationEnrollmentInput {
  /** Canonical UUID identifiers; UUID letter case is equivalent in PostgreSQL. */
  readonly tenantId: string;
  /** Opaque stable request key, preserved exactly. This is not authorization. */
  readonly requestId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
}

/**
 * Read-only recovery for an already authenticated, tenant/action/branch-authorized
 * server caller. Consumers must recheck current authority before every attempt.
 * A conflict or query failure must never be interpreted as absence/create permission.
 */
export interface IEducationEnrollmentRecoveryContract {
  getEnrollmentByRequest(input: RecoverEducationEnrollmentInput): Promise<EducationEnrollmentDTO | null>;
}

export class EducationEnrollmentRecoveryConflictError extends Error {
  readonly code = 'EDUCATION_ENROLLMENT_RECOVERY_CONFLICT';

  constructor() {
    super('Enrollment recovery context conflicts with the existing request');
    this.name = 'EducationEnrollmentRecoveryConflictError';
  }
}
