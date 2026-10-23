import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import {
  PartyRegistrationConflictError,
  type IPartyRegistrationContract,
  type RegisteredPersonIdentity,
  type RegisterOrRecoverPersonInput,
} from './registration.contract';

/** Neutral Platform implementation; no Healthcare repository or global bootstrap. */
export class PartyRegistrationContractImpl implements IPartyRegistrationContract {
  private readonly client: SupabaseClient<DurableDatabase>;

  constructor(client: SupabaseClient<Database>) {
    // Same physical schema/client, with its additive shape generated from local DB.
    this.client = client as unknown as SupabaseClient<DurableDatabase>;
  }

  async registerOrRecoverPerson(input: RegisterOrRecoverPersonInput): Promise<RegisteredPersonIdentity> {
    if (!input.tenantId || !input.actorId || !input.registrationKey || !input.person.displayName.trim()) {
      throw new Error('PARTY_REGISTRATION_INVALID_INPUT');
    }
    const { data, error } = await this.client.rpc('party_register_or_recover', {
      p_tenant_id: input.tenantId,
      p_actor_id: input.actorId,
      p_registration_key: input.registrationKey,
      p_payload: {
        partyType: 'person', displayName: input.person.displayName,
        legalName: input.person.legalName ?? null,
        dob: input.person.dob ?? null, gender: input.person.gender ?? null,
      },
      p_reuse_identifier_type: input.identifier?.type,
      p_reuse_identifier_value: input.identifier?.value,
    });
    if (error?.message.includes('PARTY_REGISTRATION_PAYLOAD_CONFLICT')) throw new PartyRegistrationConflictError();
    if (error) throw new Error(`Party registration/recovery failed: ${error.message}`);
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.partyId !== 'string' || typeof data.displayName !== 'string'
      || (data.dateOfBirth !== null && typeof data.dateOfBirth !== 'string')
      || (data.gender !== null && data.gender !== 'male' && data.gender !== 'female' && data.gender !== 'other')) {
      throw new Error('PARTY_REGISTRATION_INVALID_CANONICAL_RESULT');
    }
    // RPC re-reads Party and identifier even on receipt hits; no checkpoint-only success.
    return { partyId: data.partyId, displayName: data.displayName, dateOfBirth:data.dateOfBirth, gender:data.gender };
  }
}
