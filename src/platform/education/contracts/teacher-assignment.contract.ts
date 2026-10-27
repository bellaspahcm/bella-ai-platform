/**
 * Education OS — Teacher Assignment Public Contract Interface
 * 
 * Provides strict public contracts for assigning teachers to course/classrooms,
 * preventing lead teacher conflicts, and querying teacher rosters.
 * Canonical persistence: teacher_assignments table.
 * 
 * @module platform/education/contracts/teacher-assignment.contract
 */

import { TeacherRole, TeacherAssignmentStatus } from '../domain/teacher-assignment.entity';

export interface TeacherAssignmentDTO {
  readonly assignmentId: string;
  readonly tenantId: string;
  readonly courseId: string;
  readonly teacherPartyId: string;
  readonly role: TeacherRole;
  readonly academicYear: string;
  readonly effectiveStartDate: string;
  readonly effectiveEndDate: string | null;
  readonly status: TeacherAssignmentStatus;
}

export interface AssignTeacherInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly teacherPartyId: string;
  readonly role: TeacherRole;
  readonly academicYear: string;
  readonly effectiveStartDate?: string;
}

export interface TerminateTeacherAssignmentInput {
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly endDate?: string;
}

export interface ITeacherAssignmentContract {
  assignTeacher(input: AssignTeacherInput): Promise<TeacherAssignmentDTO>;
  terminateAssignment(input: TerminateTeacherAssignmentInput): Promise<TeacherAssignmentDTO>;
  getCourseTeachers(tenantId: string, courseId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]>;
  getTeacherAssignments(tenantId: string, teacherPartyId: string, academicYear?: string): Promise<readonly TeacherAssignmentDTO[]>;
}

/** Trusted Preschool administrator context, resolved by the API before service-only RPC dispatch. */
export interface PreschoolTeacherContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly branchId: string;
}

export interface PreschoolTeacherConfirmation {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly teacherPartyId: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly attestation: string;
  readonly confirmedBy: string;
  readonly confirmedAt: string;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revocationReason: string | null;
}

export interface PreschoolTeacherEffectiveConfirmation extends Pick<PreschoolTeacherConfirmation,
  'validFrom' | 'validTo' | 'confirmedBy' | 'confirmedAt'> {
  readonly confirmationId: string;
}

export interface PreschoolTeacherCandidate {
  readonly partyId: string;
  readonly displayName: string;
  readonly confirmations: readonly PreschoolTeacherEffectiveConfirmation[];
}

export interface PreschoolTeacherCandidatePage {
  readonly tenantId: string;
  readonly branchId: string;
  readonly onDate: string;
  readonly confirmedOnly: boolean;
  readonly offset: number;
  readonly limit: number;
  readonly filteredTotal: number;
  readonly nextOffset: number | null;
  readonly parties: readonly PreschoolTeacherCandidate[];
}

export type PreschoolTeacherEligibility = 'confirmed' | 'confirmation_revoked'
  | 'outside_confirmation_dates' | 'identity_unavailable';

export interface PreschoolCanonicalTeacherAssignmentReceipt extends TeacherAssignmentDTO {
  readonly branchId: string;
  readonly confirmationId: string;
}

export interface PreschoolCanonicalTeacherAssignment extends PreschoolCanonicalTeacherAssignmentReceipt {
  readonly teacherName: string | null;
  readonly effectiveOnDate: boolean;
  readonly eligibility: PreschoolTeacherEligibility;
}

export interface PreschoolCourseTeacherPage {
  readonly tenantId: string;
  readonly branchId: string;
  readonly courseId: string;
  readonly onDate: string;
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly nextOffset: number | null;
  readonly assignments: readonly PreschoolCanonicalTeacherAssignment[];
}

export interface PreschoolTeacherAttendanceCourse {
  readonly courseId: string;
  readonly name: string;
  readonly branchId: string;
}

export interface PreschoolTeacherAttendanceCourseScope {
  readonly tenantId: string;
  readonly actorId: string;
  readonly schoolDay: string;
  readonly courses: readonly PreschoolTeacherAttendanceCourse[];
}

export interface IPreschoolTeacherContract {
  listCandidates(context: PreschoolTeacherContext, query: string, confirmedOnly: boolean,
    onDate: string, offset: number, limit: number): Promise<PreschoolTeacherCandidatePage>;
  confirm(context: PreschoolTeacherContext, input: {
    operationKey: string; teacherPartyId: string; validFrom: string; validTo: string | null; attestation: string;
  }): Promise<PreschoolTeacherConfirmation>;
  revoke(context: PreschoolTeacherContext, input: { confirmationId: string; reason: string }): Promise<PreschoolTeacherConfirmation>;
  assign(context: PreschoolTeacherContext, input: {
    operationKey: string; courseId: string; confirmationId: string; teacherPartyId: string;
    role: TeacherRole; academicYear: string; effectiveStartDate: string; effectiveEndDate: string | null;
  }): Promise<PreschoolCanonicalTeacherAssignmentReceipt>;
  listCourseTeachers(context: PreschoolTeacherContext, courseId: string, onDate: string,
    offset: number, limit: number): Promise<PreschoolCourseTeacherPage>;
  listMyAttendanceCourses(schoolDay: string, branchId?: string): Promise<PreschoolTeacherAttendanceCourseScope>;
  terminate(context: PreschoolTeacherContext, input: {
    courseId: string; assignmentId: string; endDate: string;
  }): Promise<PreschoolCanonicalTeacherAssignmentReceipt>;
}

export class PreschoolTeacherContractError extends Error {
  constructor(readonly code: 'PRESCHOOL_TEACHER_INVALID_REQUEST' | 'PRESCHOOL_TEACHER_ACCESS_DENIED'
    | 'PRESCHOOL_TEACHER_CONFLICT' | 'PRESCHOOL_TEACHER_UNAVAILABLE', readonly status: 400 | 403 | 409 | 503) {
    super(code);
    this.name = 'PreschoolTeacherContractError';
  }
}
