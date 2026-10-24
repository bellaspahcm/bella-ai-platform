import type { SupabaseClient } from '@supabase/supabase-js';
import { PreschoolHandoverError, PreschoolSafePickupHandoverService } from '../services/preschool-safe-pickup-handover.service';

const input = {
  tenantId: 'tenant-a', studentPartyId: 'student-a', guardianPartyId: 'guardian-a',
  pickupAuthorizationId: 'authorization-a', operatorUserId: 'operator-a',
};
const row = {
  id: 'handover-a', tenant_id: input.tenantId, student_party_id: input.studentPartyId,
  guardian_party_id: input.guardianPartyId, pickup_authorization_id: input.pickupAuthorizationId,
  handed_over_at: '2026-10-24T09:00:00.000Z', handed_over_by: input.operatorUserId,
  created_at: '2026-10-24T09:00:00.000Z',
};

function fixture(data: unknown = [row], error: { code: string; message: string } | null = null) {
  const rpc = jest.fn().mockResolvedValue({ data, error });
  const from = jest.fn(() => { throw new Error('Command must not fall back to table writes'); });
  const service = new PreschoolSafePickupHandoverService({ rpc, from } as unknown as SupabaseClient);
  return { rpc, from, service };
}

describe('Preschool handover atomic Product boundary', () => {
  it('returns canonical IDs from the authorized command', async () => {
    const { service, rpc, from } = fixture();
    const result = await service.recordHandover(input);
    expect(result).toEqual({ id: row.id, tenantId: input.tenantId, studentPartyId: input.studentPartyId,
      guardianPartyId: input.guardianPartyId, pickupAuthorizationId: input.pickupAuthorizationId,
      handedOverAt: row.handed_over_at, handedOverBy: input.operatorUserId });
    expect(rpc).toHaveBeenCalledWith('preschool_record_handover', {
      p_tenant_id: input.tenantId, p_actor_id: input.operatorUserId, p_student_party_id: input.studentPartyId,
      p_guardian_party_id: input.guardianPartyId, p_pickup_authorization_id: input.pickupAuthorizationId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('preserves the original event/operator on an authorized recovery', async () => {
    const { service } = fixture([{ ...row, handed_over_by: 'original-operator' }]);
    await expect(service.recordHandover(input)).resolves.toMatchObject({ id: row.id, handedOverBy: 'original-operator' });
  });

  it.each([
    ['no row', null], ['empty result', []], ['multiple events', [row, row]],
    ['foreign tenant', [{ ...row, tenant_id: 'tenant-b' }]],
    ['wrong student', [{ ...row, student_party_id: 'student-b' }]],
    ['wrong guardian', [{ ...row, guardian_party_id: 'guardian-b' }]],
    ['wrong authorization', [{ ...row, pickup_authorization_id: 'authorization-b' }]],
    ['missing ID', [{ ...row, id: '' }]], ['invalid time', [{ ...row, handed_over_at: 'invalid' }]],
  ])('fails closed on %s read-back', async (_label, data) => {
    const { service, from } = fixture(data);
    await expect(service.recordHandover(input)).rejects.toThrow('PRESCHOOL_HANDOVER_CANONICAL_READBACK_INVALID');
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ['42501', 'ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND', 403],
    ['23505', 'STUDENT_ALREADY_HANDED_OVER_TODAY', 409],
    ['40001', 'PRESCHOOL_HANDOVER_DAY_CHANGED_RETRY', 409],
    ['22023', 'PRESCHOOL_HANDOVER_INPUT_INVALID', 400],
  ])('preserves SQL denial/conflict %s without another write', async (code, message, status) => {
    const { service, rpc, from } = fixture(null, { code, message });
    await expect(service.recordHandover(input)).rejects.toMatchObject({ code: message, status });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps a missing migration or DB failure as a failure, without legacy fallback', async () => {
    const { service, from } = fixture(null, { code: 'PGRST202', message: 'RPC not installed' });
    await expect(service.recordHandover(input)).rejects.toThrow('Failed to record Preschool handover [PGRST202]');
    expect(from).not.toHaveBeenCalled();
  });

  it('does not retry an uncertain transport outcome or manufacture a success', async () => {
    const { service, rpc, from } = fixture();
    rpc.mockRejectedValueOnce(new Error('lost response'));
    await expect(service.recordHandover(input)).rejects.toThrow('lost response');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps typed errors usable by the HTTP boundary', () => {
    expect(new PreschoolHandoverError('DENIED', 403)).toBeInstanceOf(Error);
  });
});
