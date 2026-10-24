import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC,
  type ITrustedActorOrgUnitAccessContract,
  type TrustedActorOrgUnitAccessInput,
  type TrustedActorOrgUnitAccessRow,
} from './trusted-actor-access.contract';

interface TrustedActorAccessRpcClient {
  rpc(
    name: typeof TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC,
    input: TrustedActorOrgUnitAccessInput,
  ): PromiseLike<{
    data: TrustedActorOrgUnitAccessRow[] | null;
    error: { code?: string; message: string } | null;
  }>;
}

export class TrustedActorOrgUnitAccessContractImpl implements ITrustedActorOrgUnitAccessContract {
  private readonly client: TrustedActorAccessRpcClient;

  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('TRUSTED_ACTOR_ACCESS_EXPLICIT_SERVER_CLIENT_REQUIRED');
    this.client = client as unknown as TrustedActorAccessRpcClient;
  }

  async listForActor(input: TrustedActorOrgUnitAccessInput): Promise<readonly TrustedActorOrgUnitAccessRow[]> {
    const { data, error } = await this.client.rpc(TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC, input);
    if (error?.code === '42501') throw new Error('TRUSTED_ACTOR_ACCESS_DENIED');
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('TRUSTED_ACTOR_ACCESS_READBACK_INVALID');
    return data;
  }
}
