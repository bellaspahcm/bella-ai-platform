import type { Json } from '@/types/preschool-durable.database.types';

export interface OpenPreschoolAdmissionInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly operationKey: string;
  readonly payload?: Json;
}

export interface PreschoolAdmissionOperation {
  readonly actor_id: string;
  readonly branch_id: string;
  readonly created_at: string;
  readonly enrollment_request_id: string;
  readonly operation_key: string;
  readonly payload: Json;
  readonly student_code: string;
  readonly tenant_id: string;
}

export interface AssignPreschoolEnrollmentInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly courseId: string;
  readonly enrollmentId: string;
  readonly branchId: string;
  readonly requestId: string;
}

export interface PreschoolEnrollmentBranchAssignment {
  readonly assigned_by: string | null;
  readonly branch_id: string;
  readonly course_id: string;
  readonly created_at: string;
  readonly enrollment_id: string;
  readonly id: string;
  readonly request_id: string;
  readonly tenant_id: string;
  readonly updated_at: string;
}

export interface IEducationPreschoolOperationsContract {
  openAdmission(input: OpenPreschoolAdmissionInput): Promise<PreschoolAdmissionOperation | null>;
  assignEnrollment(input: AssignPreschoolEnrollmentInput): Promise<PreschoolEnrollmentBranchAssignment>;
}

export class EducationPreschoolOperationError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
    this.name = 'EducationPreschoolOperationError';
  }
}
