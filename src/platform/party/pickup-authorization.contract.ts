export interface AuthorizePickupGuardianInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly normalizedPhone: string;
}

export interface PickupGuardianAuthorization {
  readonly created_at: string;
  readonly guardian_party_id: string;
  readonly id: string;
  readonly status: string;
  readonly student_party_id: string;
  readonly tenant_id: string;
  readonly updated_at: string;
}

export interface IPickupAuthorizationContract {
  authorizePickup(input: AuthorizePickupGuardianInput): Promise<PickupGuardianAuthorization>;
}

export class PickupAuthorizationError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
    this.name = 'PickupAuthorizationError';
  }
}
