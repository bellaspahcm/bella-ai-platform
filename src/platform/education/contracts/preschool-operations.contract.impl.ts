import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import type { Database } from '@/types/database.types';
import {
  EducationPreschoolOperationError,
  type AssignPreschoolEnrollmentInput,
  type IEducationPreschoolOperationsContract,
  type OpenPreschoolAdmissionInput,
  type PreschoolAdmissionOperation,
  type PreschoolEnrollmentBranchAssignment,
} from './preschool-operations.contract';

type Client = SupabaseClient<DurableDatabase>;

function oneRow<T>(data: T[] | null, operation: string): T {
  if (!data || data.length !== 1) throw new Error(`${operation}_READBACK_INVALID`);
  return data[0];
}

function translate(error: { code?: string; message: string }, operation: string): never {
  if (error.code === '42501') {
    const code = operation === 'PRESCHOOL_CHAIN_ASSIGNMENT'
      ? 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED'
      : 'PRESCHOOL_ADMISSION_ACTOR_DENIED';
    throw new EducationPreschoolOperationError(code, 403);
  }
  if (error.code === 'P0002' && error.message === 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND') {
    throw new EducationPreschoolOperationError('PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND', 404);
  }
  if (error.message.includes('PAYLOAD_CONFLICT')) throw new EducationPreschoolOperationError('PRESCHOOL_ADMISSION_PAYLOAD_CONFLICT', 409);
  if (error.message.includes('CONFLICT')) throw new EducationPreschoolOperationError(error.message, 409);
  throw new Error(`${operation}_FAILED [${error.code ?? 'UNKNOWN'}]: ${error.message}`);
}

export class EducationPreschoolOperationsContractImpl implements IEducationPreschoolOperationsContract {
  private readonly client: Client;

  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('PRESCHOOL_OPERATIONS_EXPLICIT_SERVER_CLIENT_REQUIRED');
    this.client = client as unknown as Client;
  }

  async openAdmission(input: OpenPreschoolAdmissionInput): Promise<PreschoolAdmissionOperation | null> {
    const { data, error } = await this.client.rpc('preschool_open_admission', {
      p_tenant_id: input.tenantId,
      p_actor_id: input.actorId,
      p_operation_key: input.operationKey,
      ...(input.payload ? { p_payload: input.payload } : {}),
    });
    if (error?.code === 'P0002' && error.message === 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND') return null;
    if (error) translate(error, 'PRESCHOOL_ADMISSION_OPERATION');
    return oneRow(data, 'PRESCHOOL_ADMISSION_OPERATION');
  }

  async assignEnrollment(input: AssignPreschoolEnrollmentInput): Promise<PreschoolEnrollmentBranchAssignment> {
    const { data, error } = await this.client.rpc('preschool_assign_chain', {
      p_tenant_id: input.tenantId,
      p_actor_id: input.actorId,
      p_course_id: input.courseId,
      p_enrollment_id: input.enrollmentId,
      p_branch_id: input.branchId,
      p_request_id: input.requestId,
    });
    if (error) translate(error, 'PRESCHOOL_CHAIN_ASSIGNMENT');
    return oneRow(data, 'PRESCHOOL_CHAIN_ASSIGNMENT');
  }
}
