/**
 * Education OS — Student public contract interface
 */
export interface EducationStudentDTO {
  readonly partyId: string;
  readonly tenantId: string;
  readonly studentCode: string;
  readonly academicStatus: 'active' | 'probation' | 'suspended' | 'graduated';
  readonly guardianPartyId?: string;
}

export interface RegisterStudentInput {
  readonly tenantId: string;
  readonly partyId: string; // references generic Party profile identity
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}

/** Caller identity/tenant are derived from the injected authenticated client. */
export interface SearchEnrollmentCandidatesInput {
  readonly courseId: string;
  readonly query: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface EnrollmentStudentCandidateDTO {
  readonly studentPartyId: string;
  readonly studentLabel: string;
  readonly guardians: readonly {
    readonly guardianPartyId: string;
    readonly guardianLabel: string;
  }[];
}

export interface EnrollmentStudentCandidatePage {
  readonly tenantId: string;
  readonly courseId: string;
  readonly candidates: readonly EnrollmentStudentCandidateDTO[];
  /** Last scanned Party ID; an empty page may still have a next page. */
  readonly nextCursor: string | null;
}

export class EducationCandidateReadError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'UNAVAILABLE') {
    super(`EDUCATION_CANDIDATE_READ_${code}`);
  }
}

export interface IEducationStudentContract {
  registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
  getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null>;
  /** Read-only shortlist. Product must authorize the active Course/branch first. */
  searchEnrollmentCandidates(input: SearchEnrollmentCandidatesInput): Promise<EnrollmentStudentCandidatePage>;
}
