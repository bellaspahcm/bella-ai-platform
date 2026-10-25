import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationEnrollmentEventsDatabase } from '@/types/education-enrollment-events.database.types';
import {
  EducationEnrollmentEventConflictError,
  type EnrollmentEventContext,
  type EnrollmentEventRecoveryReceipt,
  type IEducationEnrollmentEventRecoveryContract,
} from './enrollment-event-recovery.contract';

type EventClient = SupabaseClient<EducationEnrollmentEventsDatabase>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorCodePattern = /^[A-Z0-9_]{1,80}$/;

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('EDUCATION_EVENT_INVALID_UUID');
  return value.toLowerCase();
}

function args(input: EnrollmentEventContext) {
  if (!input || typeof input.requestId !== 'string' || !input.requestId.trim()) {
    throw new Error('EDUCATION_EVENT_CONTEXT_REQUIRED');
  }
  return {
    p_tenant_id: uuid(input.tenantId), p_request_id: input.requestId,
    p_enrollment_id: uuid(input.enrollmentId), p_student_party_id: uuid(input.studentPartyId), p_course_id: uuid(input.courseId),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('EDUCATION_EVENT_INVALID_RECEIPT');
  return value as Record<string, unknown>;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('EDUCATION_EVENT_INVALID_TIMESTAMP');
  return value;
}

function diagnostic(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !errorCodePattern.test(value)) throw new Error('EDUCATION_EVENT_INVALID_ERROR_CODE');
  return value;
}

function integer(value: unknown, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 5) throw new Error('EDUCATION_EVENT_INVALID_ATTEMPT');
  return value;
}

function parse(value: unknown, input: EnrollmentEventContext): EnrollmentEventRecoveryReceipt {
  const root = record(value), event = record(root.event), payload = record(event.payload);
  const expected = args(input);
  if (uuid(event.tenantId) !== expected.p_tenant_id || event.requestId !== input.requestId
    || uuid(event.aggregateId) !== expected.p_enrollment_id || uuid(payload.enrollmentId) !== expected.p_enrollment_id
    || uuid(payload.studentPartyId) !== expected.p_student_party_id || uuid(payload.courseId) !== expected.p_course_id) {
    throw new EducationEnrollmentEventConflictError();
  }
  if (event.eventType !== 'edu.enrollment.created.v1' || event.eventVersion !== 'v1' || event.aggregateType !== 'enrollment'
    || typeof payload.status !== 'string' || !payload.status || root.downstreamProcessing !== 'NOT_PROVEN') {
    throw new Error('EDUCATION_EVENT_INVALID_RECEIPT');
  }
  const state = root.replayState;
  if (state !== 'pending' && state !== 'leased' && state !== 'retryable' && state !== 'intervention_required') {
    throw new Error('EDUCATION_EVENT_INVALID_REPLAY_STATE');
  }
  let replay: EnrollmentEventRecoveryReceipt['replay'] = null;
  if (root.replay !== null) {
    const row = record(root.replay);
    if (row.outcome !== 'leased' && row.outcome !== 'released' && row.outcome !== 'failed') throw new Error('EDUCATION_EVENT_INVALID_REPLAY_OUTCOME');
    replay = { replayKey: uuid(row.replayKey), leaseToken: uuid(row.leaseToken), leaseUntil: timestamp(row.leaseUntil),
      attemptNumber: integer(row.attemptNumber, 1), outcome: row.outcome, errorCode: diagnostic(row.errorCode) };
  }
  return {
    event: { eventId: uuid(event.eventId), eventType: event.eventType, eventVersion: event.eventVersion,
      tenantId: expected.p_tenant_id, aggregateId: expected.p_enrollment_id, aggregateType: event.aggregateType,
      requestId: input.requestId, occurredAt: timestamp(event.occurredAt), payload: {
        enrollmentId: expected.p_enrollment_id, studentPartyId: expected.p_student_party_id,
        courseId: expected.p_course_id, status: payload.status,
      } },
    replayState: state, attempts: integer(root.attempts, 0), lastErrorCode: diagnostic(root.lastErrorCode),
    downstreamProcessing: 'NOT_PROVEN', replay,
  };
}

function checkError(error: { code?: string; message: string } | null): void {
  if (error?.code === '23505') throw new EducationEnrollmentEventConflictError();
  if (error) throw new Error(`Enrollment event recovery failed [${error.code ?? 'UNKNOWN'}]: ${error.message}`);
}

export class EnrollmentEventRecoveryContractImpl implements IEducationEnrollmentEventRecoveryContract {
  private readonly client: EventClient;
  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('Enrollment event recovery requires an explicit authorized server client');
    this.client = client as unknown as EventClient;
  }

  async getCapturedEvent(input: EnrollmentEventContext): Promise<EnrollmentEventRecoveryReceipt | null> {
    const { data, error } = await this.client.rpc('edu_get_enrollment_created_event', args(input));
    checkError(error);
    return data === null ? null : parse(data, input);
  }

  async claimReplay(input: EnrollmentEventContext & { readonly replayKey: string }): Promise<EnrollmentEventRecoveryReceipt> {
    const replayKey = uuid(input.replayKey);
    const { data, error } = await this.client.rpc('edu_claim_enrollment_event_replay', { ...args(input), p_replay_key: replayKey });
    checkError(error);
    const receipt = parse(data, input);
    if (receipt.replay !== null && receipt.replay.replayKey !== replayKey) throw new EducationEnrollmentEventConflictError();
    return receipt;
  }

  async finishReplay(input: Parameters<IEducationEnrollmentEventRecoveryContract['finishReplay']>[0]): Promise<EnrollmentEventRecoveryReceipt> {
    if (input.outcome !== 'released' && input.outcome !== 'failed') throw new Error('EDUCATION_EVENT_INVALID_REPLAY_OUTCOME');
    if ((input.outcome === 'failed' && (!input.errorCode || !errorCodePattern.test(input.errorCode)))
      || (input.outcome === 'released' && input.errorCode !== undefined)) throw new Error('EDUCATION_EVENT_INVALID_ERROR_CODE');
    const replayKey = uuid(input.replayKey), leaseToken = uuid(input.leaseToken);
    const { data, error } = await this.client.rpc('edu_finish_enrollment_event_replay', {
      ...args(input), p_replay_key: replayKey, p_lease_token: leaseToken, p_outcome: input.outcome,
      ...(input.errorCode ? { p_error_code: input.errorCode } : {}),
    });
    checkError(error);
    const receipt = parse(data, input);
    if (receipt.replay?.replayKey !== replayKey || receipt.replay.leaseToken !== leaseToken
      || receipt.replay.outcome !== input.outcome || receipt.replay.errorCode !== (input.errorCode ?? null)) {
      throw new EducationEnrollmentEventConflictError();
    }
    return receipt;
  }
}
