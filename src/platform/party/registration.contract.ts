/** Additive identity-only registration. Keys identify requests, never authority. */
export interface RegisterOrRecoverPersonInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly registrationKey: string;
  readonly person: {
    readonly displayName: string;
    readonly legalName?: string;
    readonly dob?: string;
    readonly gender?: 'male' | 'female' | 'other';
  };
  /** Reuse an existing canonical identifier rather than creating a losing Party. */
  readonly identifier?: { readonly type: string; readonly value: string };
}

export interface RegisteredPersonIdentity {
  readonly partyId: string;
  readonly displayName: string;
  readonly dateOfBirth?: string | null;
  readonly gender?: 'male' | 'female' | 'other' | null;
}

export interface IPartyRegistrationContract {
  registerOrRecoverPerson(input: RegisterOrRecoverPersonInput): Promise<RegisteredPersonIdentity>;
}

export class PartyRegistrationConflictError extends Error {
  readonly code = 'PARTY_REGISTRATION_PAYLOAD_CONFLICT';
  constructor() {
    super('Party registration key conflicts with its original payload');
    this.name = 'PartyRegistrationConflictError';
  }
}
