import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  PartyAuthLinkError, type ConfirmPartyAuthLinkInput, type IPartyAuthLinkContract,
  type PartyAuthLinkIdentity, type PartyAuthLinkReceipt,
} from './auth-link.contract';

interface PartyAuthLinkRpcClient {
  rpc(name: 'party_confirm_auth_link' | 'party_revoke_auth_link' | 'party_resolve_current_auth_link',
    input?: Record<string, string | null>): PromiseLike<{
      data: unknown; error: { code?: string; message?: string } | null;
    }>;
}
const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string'
  && Number.isFinite(Date.parse(value));
const isInputInstant = (value: unknown): value is string => isInstant(value)
  && new Date(value).toISOString() === value;
const isNote = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 1 && value.length <= 500 && value === value.trim()
  && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const invalid = () => new PartyAuthLinkError('PARTY_AUTH_LINK_INVALID_INPUT');
const unavailable = () => new PartyAuthLinkError('PARTY_AUTH_LINK_UNAVAILABLE');

function parseIdentity(data: unknown): PartyAuthLinkIdentity {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
  const row = data as Record<string, unknown>;
  if (![row.id, row.tenantId, row.authUserId, row.partyId].every(isUuid)
    || !isInstant(row.validFrom) || (row.validUntil !== null && !isInstant(row.validUntil))
    || (row.validUntil !== null && Date.parse(row.validUntil as string) <= Date.parse(row.validFrom))) throw unavailable();
  return { id: row.id as string, tenantId: row.tenantId as string, authUserId: row.authUserId as string,
    partyId: row.partyId as string, validFrom: row.validFrom,
    validUntil: row.validUntil as string | null };
}

function parseReceipt(data: unknown): PartyAuthLinkReceipt {
  const identity = parseIdentity(data);
  const row = data as Record<string, unknown>;
  if (!isUuid(row.confirmedBy) || !isInstant(row.confirmedAt) || !isNote(row.attestation)) throw unavailable();
  const live = row.revokedAt === null && row.revokedBy === null && row.revocationReason === null;
  const revoked = isInstant(row.revokedAt) && isUuid(row.revokedBy) && isNote(row.revocationReason);
  if (!live && !revoked) throw unavailable();
  return { ...identity, confirmedBy: row.confirmedBy, confirmedAt: row.confirmedAt,
    attestation: row.attestation, revokedAt: row.revokedAt as string | null,
    revokedBy: row.revokedBy as string | null, revocationReason: row.revocationReason as string | null };
}

/** Requires the caller's session client; no privileged fallback or inferred mapping. */
export class PartyAuthLinkContractImpl implements IPartyAuthLinkContract {
  private readonly client: PartyAuthLinkRpcClient;
  constructor(client: SupabaseClient<Database>) {
    if (!client) throw unavailable();
    this.client = client as unknown as PartyAuthLinkRpcClient;
  }

  private async call(name: Parameters<PartyAuthLinkRpcClient['rpc']>[0], input?: Record<string, string | null>) {
    const { data, error } = await this.client.rpc(name, input);
    if (error?.code === '42501') throw new PartyAuthLinkError('PARTY_AUTH_LINK_ACCESS_DENIED');
    if (error?.code === '22023') throw invalid();
    if (error?.code === '23505' || error?.code === 'P0001') throw new PartyAuthLinkError('PARTY_AUTH_LINK_CONFLICT');
    if (error) throw unavailable();
    return data;
  }

  async confirm(input: ConfirmPartyAuthLinkInput): Promise<PartyAuthLinkReceipt> {
    if (![input.operationKey, input.authUserId, input.partyId].every(isUuid)
      || !isInputInstant(input.validFrom) || (input.validUntil !== null && !isInputInstant(input.validUntil))
      || (input.validUntil !== null && Date.parse(input.validUntil) <= Date.parse(input.validFrom))
      || !isNote(input.attestation)) throw invalid();
    const receipt = parseReceipt(await this.call('party_confirm_auth_link', {
      p_operation_key: input.operationKey.toLowerCase(), p_auth_user_id: input.authUserId.toLowerCase(),
      p_party_id: input.partyId.toLowerCase(), p_valid_from: input.validFrom,
      p_valid_until: input.validUntil, p_attestation: input.attestation,
    }));
    if (receipt.id !== input.operationKey.toLowerCase() || receipt.authUserId !== input.authUserId.toLowerCase()
      || receipt.partyId !== input.partyId.toLowerCase() || Date.parse(receipt.validFrom) !== Date.parse(input.validFrom)
      || (receipt.validUntil === null) !== (input.validUntil === null)
      || (receipt.validUntil !== null && Date.parse(receipt.validUntil) !== Date.parse(input.validUntil as string))
      || receipt.attestation !== input.attestation) throw unavailable();
    return receipt;
  }

  async revoke(input: { linkId: string; reason: string }): Promise<PartyAuthLinkReceipt> {
    if (!isUuid(input.linkId) || !isNote(input.reason)) throw invalid();
    const receipt = parseReceipt(await this.call('party_revoke_auth_link', {
      p_link_id: input.linkId.toLowerCase(), p_reason: input.reason,
    }));
    if (receipt.id !== input.linkId.toLowerCase() || receipt.revokedAt === null
      || receipt.revocationReason !== input.reason) throw unavailable();
    return receipt;
  }

  async resolveCurrent(): Promise<PartyAuthLinkIdentity | null> {
    const data = await this.call('party_resolve_current_auth_link');
    return data === null ? null : parseIdentity(data);
  }
}
