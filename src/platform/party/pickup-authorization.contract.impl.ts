import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import {
  PickupAuthorizationError,
  type AuthorizePickupGuardianInput,
  type IPickupAuthorizationContract,
  type PickupGuardianAuthorization,
} from './pickup-authorization.contract';

type Client = SupabaseClient<DurableDatabase>;

export class PickupAuthorizationContractImpl implements IPickupAuthorizationContract {
  private readonly client: Client;

  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('PICKUP_AUTHORIZATION_EXPLICIT_SERVER_CLIENT_REQUIRED');
    this.client = client as unknown as Client;
  }

  async authorizePickup(input: AuthorizePickupGuardianInput): Promise<PickupGuardianAuthorization> {
    const { data, error } = await this.client.rpc('preschool_admission_pickup', {
      p_tenant_id: input.tenantId,
      p_actor_id: input.actorId,
      p_student_party_id: input.studentPartyId,
      p_guardian_party_id: input.guardianPartyId,
      p_normalized_phone: input.normalizedPhone,
    });
    if (error?.code === '42501' || error?.message.includes('REVOKED') || error?.message.includes('RELATIONSHIP_NOT_ACTIVE')) {
      throw new PickupAuthorizationError(error.message, 403);
    }
    if (error?.message.includes('CONFLICT')) throw new PickupAuthorizationError(error.message, 409);
    if (error) throw new Error(`Pickup authorization persistence failed [${error.code ?? 'UNKNOWN'}]: ${error.message}`);
    if (!data || data.length !== 1) throw new Error('PRESCHOOL_GUARDIAN_AUTHORIZATION_READBACK_INVALID');
    return data[0] as PickupGuardianAuthorization;
  }
}
