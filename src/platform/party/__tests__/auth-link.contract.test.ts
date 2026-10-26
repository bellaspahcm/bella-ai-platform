import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PartyAuthLinkContractImpl } from '../auth-link.contract.impl';

const id = '00000000-0000-4000-8000-000000000001';
const user = '00000000-0000-4000-8000-000000000002';
const party = '00000000-0000-4000-8000-000000000003';
const tenant = '00000000-0000-4000-8000-000000000004';
const actor = '00000000-0000-4000-8000-000000000005';
const time = '2026-10-26T01:00:00.000Z';
const identity = { id, tenantId: tenant, authUserId: user, partyId: party, validFrom: time, validUntil: null };
const receipt = { ...identity, confirmedBy: actor, confirmedAt: time, attestation: 'Đã đối chiếu hồ sơ',
  revokedAt: null, revokedBy: null, revocationReason: null };
const input = { operationKey: id, authUserId: user, partyId: party, validFrom: time, validUntil: null,
  attestation: receipt.attestation };
function setup(data: unknown = receipt, error: { code: string; message?: string } | null = null) {
  const rpc = jest.fn().mockResolvedValue({ data, error });
  return { rpc, contract: new PartyAuthLinkContractImpl({ rpc } as unknown as SupabaseClient<Database>) };
}

describe('Party Auth link public contract', () => {
  it('confirms exact identities without accepting actor or tenant selectors', async () => {
    const { rpc, contract } = setup();
    expect(await contract.confirm(input)).toEqual(receipt);
    expect(rpc).toHaveBeenCalledWith('party_confirm_auth_link', {
      p_operation_key: id, p_auth_user_id: user, p_party_id: party, p_valid_from: time,
      p_valid_until: null, p_attestation: receipt.attestation,
    });
  });

  it.each([
    { operationKey: 'invalid' }, { authUserId: 'invalid' }, { partyId: 'invalid' },
    { validFrom: '2026-02-30T01:00:00.000Z' }, { validUntil: time },
    { attestation: ' ' }, { attestation: 'line\nbreak' },
  ])('rejects invalid confirmation before RPC: %j', async delta => {
    const { rpc, contract } = setup();
    await expect(contract.confirm({ ...input, ...delta })).rejects.toMatchObject({ code: 'PARTY_AUTH_LINK_INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['id', 'authUserId', 'partyId'] as const)('rejects receipt identity drift in %s', async key => {
    const { contract } = setup({ ...receipt, [key]: actor });
    await expect(contract.confirm(input)).rejects.toMatchObject({ code: 'PARTY_AUTH_LINK_UNAVAILABLE' });
  });

  it('rejects incomplete revocation provenance', async () => {
    const { contract } = setup({ ...receipt, revokedAt: time });
    await expect(contract.confirm(input)).rejects.toMatchObject({ code: 'PARTY_AUTH_LINK_UNAVAILABLE' });
  });

  it.each([
    ['42501', 'PARTY_AUTH_LINK_ACCESS_DENIED'], ['22023', 'PARTY_AUTH_LINK_INVALID_INPUT'],
    ['23505', 'PARTY_AUTH_LINK_CONFLICT'], ['P0001', 'PARTY_AUTH_LINK_CONFLICT'],
    ['XX000', 'PARTY_AUTH_LINK_UNAVAILABLE'],
  ])('maps SQLSTATE %s without exposing SQL messages', async (code, expected) => {
    const { contract } = setup(null, { code, message: 'private database detail' });
    await expect(contract.confirm(input)).rejects.toMatchObject({ code: expected, message: expected });
  });

  it('resolves only the current caller with no selectors', async () => {
    const { rpc, contract } = setup({ ...identity, ignoredPrivateField: 'discarded' });
    expect(await contract.resolveCurrent()).toEqual(identity);
    expect(rpc).toHaveBeenCalledWith('party_resolve_current_auth_link', undefined);
  });

  it('retains null as unavailable current binding', async () => {
    expect(await setup(null).contract.resolveCurrent()).toBeNull();
  });

  it('revokes the requested link with immutable provenance', async () => {
    const revoked = { ...receipt, revokedAt: time, revokedBy: actor, revocationReason: 'Thu hồi' };
    const { contract, rpc } = setup(revoked);
    expect(await contract.revoke({ linkId: id, reason: 'Thu hồi' })).toEqual(revoked);
    expect(rpc).toHaveBeenCalledWith('party_revoke_auth_link', { p_link_id: id, p_reason: 'Thu hồi' });
  });

  it('rejects a revoke response which still reports an active link', async () => {
    await expect(setup().contract.revoke({ linkId: id, reason: 'Thu hồi' }))
      .rejects.toMatchObject({ code: 'PARTY_AUTH_LINK_UNAVAILABLE' });
  });
});
