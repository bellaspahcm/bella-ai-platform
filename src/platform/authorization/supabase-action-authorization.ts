import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  reconcileCurrentActorProfile,
  type ActiveCurrentActor,
  type CurrentActorProfileRow,
} from '@/platform/security/current-actor.contract';
import type {
  PlatformActionAuthorizationContract,
  PlatformAuthorizationDecision,
  PlatformDirectUserGrantInput,
  PlatformGrantAdministrationContract,
  PlatformGrantMutationResult,
} from './action-authorization.contract';

const ACTION_AUTHORIZATION_RPC = 'platform_authorize_action';
const GRANT_DIRECT_USER_RPC = 'platform_grant_direct_user_action';
const REVOKE_DIRECT_USER_RPC = 'platform_revoke_direct_user_action';

interface RpcError {
  readonly code?: string;
  readonly message?: string;
}

interface RpcResponse {
  readonly data: unknown;
  readonly error: RpcError | null;
}

interface AuthenticatedIdentityResponse {
  readonly data: { readonly user: { readonly id: string } | null };
  readonly error: RpcError | null;
}

interface ActionAuthorizationRpcClient {
  readonly auth: {
    getUser(): PromiseLike<AuthenticatedIdentityResponse>;
  };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>;
}

type ActorResolution =
  | { readonly status: 'FOUND'; readonly actor: ActiveCurrentActor }
  | { readonly status: 'DENIED' }
  | { readonly status: 'UNAVAILABLE' };

interface RpcDecisionRow {
  readonly status: string;
  readonly reason: string;
}

interface RpcGrantMutationRow {
  readonly status: string;
  readonly reason: string;
  readonly grant_id: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentActorRows(value: unknown): CurrentActorProfileRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: CurrentActorProfileRow[] = [];

  for (const valueRow of value) {
    if (!isRecord(valueRow)) return null;
    const row = valueRow;
    if (
      typeof row.id !== 'string' ||
      typeof row.email !== 'string' ||
      (row.full_name !== null && typeof row.full_name !== 'string') ||
      typeof row.role !== 'string' ||
      (row.avatar_url !== null && typeof row.avatar_url !== 'string') ||
      typeof row.tenant_id !== 'string' ||
      typeof row.status !== 'string' ||
      typeof row.tenant_status !== 'string'
    ) {
      return null;
    }

    rows.push({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      tenant_id: row.tenant_id,
      status: row.status,
      tenant_status: row.tenant_status,
    });
  }

  return rows;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return null;
  return value[0];
}

function decodeDecision(value: unknown): PlatformAuthorizationDecision | null {
  const row = firstRow(value);
  if (!row || typeof row.status !== 'string' || typeof row.reason !== 'string') return null;

  if (row.status === 'ALLOW' && row.reason === 'DIRECT_GRANT') {
    return { status: 'ALLOW', reason: 'DIRECT_GRANT' };
  }
  if (row.status === 'DENY') {
    if (row.reason === 'NO_GRANT' || row.reason === 'TENANT_MISMATCH'
      || row.reason === 'ORG_UNIT_MISMATCH' || row.reason === 'INVALID_CONTEXT') {
      return { status: 'DENY', reason: row.reason };
    }
  }
  if (row.status === 'UNAVAILABLE') {
    return {
      status: 'UNAVAILABLE',
      reason: row.reason === 'ORG_UNIT_UNAVAILABLE' ? 'ORG_UNIT_UNAVAILABLE' : 'RESOLVER_UNAVAILABLE',
    };
  }
  return null;
}

function decodeMutation(value: unknown): RpcGrantMutationRow | null {
  const row = firstRow(value);
  if (!row || typeof row.status !== 'string' || typeof row.reason !== 'string') return null;
  if (row.grant_id !== null && typeof row.grant_id !== 'string') return null;
  return {
    status: row.status,
    reason: row.reason,
    grant_id: row.grant_id,
  };
}

function mapMutation(row: RpcGrantMutationRow | null): PlatformGrantMutationResult {
  if (!row) return { status: 'UNAVAILABLE', reason: 'GRANT_STORE_UNAVAILABLE' };
  if (row.status === 'COMMITTED' && row.grant_id) {
    return { status: 'COMMITTED', grantId: row.grant_id };
  }
  if (row.status === 'DENIED') {
    if (row.reason === 'NOT_TENANT_GRANT_ADMIN' || row.reason === 'TENANT_MISMATCH'
      || row.reason === 'INVALID_TARGET_OR_SCOPE' || row.reason === 'ALREADY_GRANTED') {
      return { status: 'DENIED', reason: row.reason };
    }
    return { status: 'DENIED', reason: 'INVALID_TARGET_OR_SCOPE' };
  }
  if (row.status === 'UNAVAILABLE') {
    if (row.reason === 'AUTH_CONTEXT_UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'AUTH_CONTEXT_UNAVAILABLE' };
    }
    if (row.reason === 'AUDIT_UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'AUDIT_UNAVAILABLE' };
    }
    if (row.reason === 'ORG_UNIT_UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'ORG_UNIT_UNAVAILABLE' };
    }
    return { status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' };
  }
  return { status: 'UNAVAILABLE', reason: 'GRANT_STORE_UNAVAILABLE' };
}

export class SupabasePlatformActionAuthorization
implements PlatformActionAuthorizationContract, PlatformGrantAdministrationContract {
  private readonly client: ActionAuthorizationRpcClient;

  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('PLATFORM_ACTION_AUTHORIZATION_AUTHENTICATED_CLIENT_REQUIRED');
    this.client = client as unknown as ActionAuthorizationRpcClient;
  }

  async authorize(input: {
    readonly permissionId: string;
    readonly tenantId: string;
    readonly orgUnitId?: string;
  }): Promise<PlatformAuthorizationDecision> {
    const actorResult = await this.resolveActor();
    if (actorResult.status === 'DENIED') return { status: 'DENY', reason: 'INVALID_CONTEXT' };
    if (actorResult.status === 'UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    }
    if (actorResult.actor.tenant_id !== input.tenantId) {
      return { status: 'DENY', reason: 'TENANT_MISMATCH' };
    }
    if (!input.permissionId.trim() || !input.tenantId.trim()) {
      return { status: 'DENY', reason: 'INVALID_CONTEXT' };
    }

    try {
      const response = await this.client.rpc(ACTION_AUTHORIZATION_RPC, {
        p_permission_id: input.permissionId,
        p_tenant_id: input.tenantId,
        p_org_unit_id: input.orgUnitId ?? null,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      return decodeDecision(response.data) ?? { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    } catch {
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    }
  }

  async grantDirectUser(input: PlatformDirectUserGrantInput): Promise<PlatformGrantMutationResult> {
    const actorResult = await this.resolveActor();
    if (actorResult.status === 'DENIED') {
      return { status: 'DENIED', reason: 'NOT_TENANT_GRANT_ADMIN' };
    }
    if (actorResult.status === 'UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'AUTH_CONTEXT_UNAVAILABLE' };
    }

    try {
      const response = await this.client.rpc(GRANT_DIRECT_USER_RPC, {
        p_target_user_id: input.targetUserId,
        p_permission_id: input.permissionId,
        p_scope_type: input.scope.type,
        p_org_unit_id: input.scope.type === 'ORG_UNIT' ? input.scope.orgUnitId : null,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' };
      return mapMutation(decodeMutation(response.data));
    } catch {
      return { status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' };
    }
  }

  async revokeDirectUser(input: { readonly grantId: string }): Promise<PlatformGrantMutationResult> {
    const actorResult = await this.resolveActor();
    if (actorResult.status === 'DENIED') {
      return { status: 'DENIED', reason: 'NOT_TENANT_GRANT_ADMIN' };
    }
    if (actorResult.status === 'UNAVAILABLE') {
      return { status: 'UNAVAILABLE', reason: 'AUTH_CONTEXT_UNAVAILABLE' };
    }

    try {
      const response = await this.client.rpc(REVOKE_DIRECT_USER_RPC, {
        p_grant_id: input.grantId,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' };
      return mapMutation(decodeMutation(response.data));
    } catch {
      return { status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' };
    }
  }

  private async resolveActor(): Promise<ActorResolution> {
    try {
      const identity = await this.client.auth.getUser();
      if (identity.error) return { status: 'UNAVAILABLE' };
      if (!identity.data.user?.id) return { status: 'DENIED' };

      const profile = await this.client.rpc(CURRENT_ACTOR_PROFILE_RPC);
      if (profile.error) {
        return profile.error.code === '42501' ? { status: 'DENIED' } : { status: 'UNAVAILABLE' };
      }

      const actor = reconcileCurrentActorProfile(identity.data.user.id, currentActorRows(profile.data));
      return actor ? { status: 'FOUND', actor } : { status: 'DENIED' };
    } catch {
      return { status: 'UNAVAILABLE' };
    }
  }
}
