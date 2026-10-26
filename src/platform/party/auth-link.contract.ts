/** Platform-owned identity evidence. A link never grants Product permissions. */
export interface PartyAuthLinkIdentity {
  readonly id: string;
  readonly tenantId: string;
  readonly authUserId: string;
  readonly partyId: string;
  readonly validFrom: string;
  readonly validUntil: string | null;
}

export interface PartyAuthLinkReceipt extends PartyAuthLinkIdentity {
  readonly confirmedBy: string;
  readonly confirmedAt: string;
  readonly attestation: string;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revocationReason: string | null;
}

export interface ConfirmPartyAuthLinkInput {
  readonly operationKey: string;
  readonly authUserId: string;
  readonly partyId: string;
  /** Canonical UTC ISO timestamps, supplied explicitly. */
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly attestation: string;
}

export interface IPartyAuthLinkContract {
  /** Actor and tenant come exclusively from the authenticated RPC session. */
  confirm(input: ConfirmPartyAuthLinkInput): Promise<PartyAuthLinkReceipt>;
  revoke(input: { readonly linkId: string; readonly reason: string }): Promise<PartyAuthLinkReceipt>;
  /** Resolves only the current provider subject; no arbitrary actor/tenant selector. */
  resolveCurrent(): Promise<PartyAuthLinkIdentity | null>;
}

export class PartyAuthLinkError extends Error {
  constructor(readonly code: 'PARTY_AUTH_LINK_INVALID_INPUT' | 'PARTY_AUTH_LINK_ACCESS_DENIED'
    | 'PARTY_AUTH_LINK_CONFLICT' | 'PARTY_AUTH_LINK_UNAVAILABLE') {
    super(code);
    this.name = 'PartyAuthLinkError';
  }
}
