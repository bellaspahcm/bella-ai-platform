import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EnrollmentEventRecoveryContractImpl } from '../contracts/enrollment-event-recovery.contract.impl';
import { EducationEnrollmentEventConflictError } from '../contracts/enrollment-event-recovery.contract';

const input = {
  tenantId: '10000000-0000-4000-8000-000000000001', requestId: 'Opaque Request Key',
  enrollmentId: '20000000-0000-4000-8000-000000000002', studentPartyId: '30000000-0000-4000-8000-000000000003',
  courseId: '40000000-0000-4000-8000-000000000004',
};
const replayKey = '50000000-0000-4000-8000-000000000005', leaseToken = '60000000-0000-4000-8000-000000000006';
const captured = () => ({
  event: { eventId: '70000000-0000-4000-8000-000000000007', eventType: 'edu.enrollment.created.v1', eventVersion: 'v1',
    tenantId: input.tenantId, aggregateId: input.enrollmentId, aggregateType: 'enrollment', requestId: input.requestId,
    occurredAt: '2026-10-23T00:00:00.000Z', payload: { enrollmentId: input.enrollmentId, studentPartyId: input.studentPartyId, courseId: input.courseId, status: 'active' } },
  replayState: 'pending', attempts: 0, lastErrorCode: null, downstreamProcessing: 'NOT_PROVEN', replay: null,
});
function harness(data: unknown = captured(), error: { code: string; message: string } | null = null) {
  const rpc = jest.fn(async () => ({ data, error }));
  return { rpc, contract: new EnrollmentEventRecoveryContractImpl({ rpc } as unknown as SupabaseClient<Database>) };
}

describe('Education public enrollment event capture/replay contract', () => {
  it('requires an explicit client without a privileged fallback', () => {
    expect(() => new EnrollmentEventRecoveryContractImpl(undefined as unknown as SupabaseClient<Database>)).toThrow('explicit authorized server client');
  });

  it('uses only the public RPC and preserves the opaque request key', async () => {
    const h = harness();
    expect(await h.contract.getCapturedEvent(input)).toEqual(captured());
    expect(h.rpc).toHaveBeenCalledWith('edu_get_enrollment_created_event', {
      p_tenant_id: input.tenantId, p_request_id: input.requestId, p_enrollment_id: input.enrollmentId,
      p_student_party_id: input.studentPartyId, p_course_id: input.courseId,
    });
  });

  it('returns null only for actual absence', async () => {
    expect(await harness(null).contract.getCapturedEvent(input)).toBeNull();
  });

  it.each(['42501', 'XX000'])('does not convert a %s error into absence', async (code) => {
    await expect(harness(null, { code, message: 'Controlled DB failure' }).contract.getCapturedEvent(input)).rejects.toThrow(code);
  });

  it('maps SQL canonical conflict to a typed conflict', async () => {
    await expect(harness(null, { code: '23505', message: 'EDUCATION_EVENT_CANONICAL_CONFLICT' }).contract.getCapturedEvent(input)).rejects.toBeInstanceOf(EducationEnrollmentEventConflictError);
  });

  it('rejects a mismatched canonical snapshot even if the producer returns success', async () => {
    const row = captured(); row.event.payload.courseId = input.studentPartyId;
    await expect(harness(row).contract.getCapturedEvent(input)).rejects.toBeInstanceOf(EducationEnrollmentEventConflictError);
  });

  it('rejects an invented delivered state or processing claim', async () => {
    const row = captured(); row.downstreamProcessing = 'PASS';
    await expect(harness(row).contract.getCapturedEvent(input)).rejects.toThrow('INVALID_RECEIPT');
  });

  it('returns intervention without inventing a lease', async () => {
    const row = { ...captured(), replayState: 'intervention_required', attempts: 5 };
    const result = await harness(row).contract.claimReplay({ ...input, replayKey });
    expect(result.replay).toBeNull(); expect(result.downstreamProcessing).toBe('NOT_PROVEN');
  });

  it('rejects a replay receipt for a different key', async () => {
    const row = { ...captured(), replayState: 'leased', attempts: 1, replay: {
      replayKey: input.enrollmentId, leaseToken, leaseUntil: '2026-10-23T00:00:30.000Z', attemptNumber: 1, outcome: 'leased', errorCode: null,
    } };
    await expect(harness(row).contract.claimReplay({ ...input, replayKey })).rejects.toBeInstanceOf(EducationEnrollmentEventConflictError);
  });

  it('rejects unsanitized diagnostic text before calling persistence', async () => {
    const h = harness();
    await expect(h.contract.finishReplay({ ...input, replayKey, leaseToken, outcome: 'failed', errorCode: 'token=secret or arbitrary text' })).rejects.toThrow('INVALID_ERROR_CODE');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('verifies the completed attempt identity and outcome', async () => {
    const row = { ...captured(), replayState: 'retryable', attempts: 1, lastErrorCode: 'CONTROLLED_FAILURE', replay: {
      replayKey, leaseToken, leaseUntil: '2026-10-23T00:00:30.000Z', attemptNumber: 1, outcome: 'failed', errorCode: 'CONTROLLED_FAILURE',
    } };
    expect((await harness(row).contract.finishReplay({ ...input, replayKey, leaseToken, outcome: 'failed', errorCode: 'CONTROLLED_FAILURE' })).replay?.outcome).toBe('failed');
    row.replay.leaseToken = input.courseId;
    await expect(harness(row).contract.finishReplay({ ...input, replayKey, leaseToken, outcome: 'failed', errorCode: 'CONTROLLED_FAILURE' })).rejects.toBeInstanceOf(EducationEnrollmentEventConflictError);
  });
});
