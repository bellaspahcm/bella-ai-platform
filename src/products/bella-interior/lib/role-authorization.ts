import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export type InteriorAuthorizationDecision =
  | { readonly status: 'ALLOW'; readonly reason: 'AUTHORIZED' | 'SCOPED_PROJECT_LIST' | 'SCOPED_CUSTOMER_LIST' }
  | { readonly status: 'DENY'; readonly reason: string }
  | { readonly status: 'UNAVAILABLE'; readonly reason: 'RESOLVER_UNAVAILABLE' };

export type InteriorAuthorizationInput = {
  readonly permissionId: string;
  readonly tenantId: string;
  readonly projectId?: string;
  readonly branchId?: string;
};

interface RpcError {
  readonly message?: string;
}

interface RpcResult {
  readonly data: unknown;
  readonly error: RpcError | null;
}

interface RbacRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

interface AuthorizationRow {
  readonly status: string;
  readonly reason: string;
}

function authorizationRow(value: unknown): AuthorizationRow | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const first = value[0];
  if (typeof first !== 'object' || first === null || Array.isArray(first)) return null;
  const row = first as Record<string, unknown>;
  if (typeof row.status !== 'string' || typeof row.reason !== 'string') return null;
  return { status: row.status, reason: row.reason };
}

export class SupabaseInteriorRoleAuthorization {
  private readonly client: RbacRpcClient;

  constructor(client: SupabaseClient<Database>) {
    if (!client) throw new Error('INTERIOR_RBAC_AUTHENTICATED_CLIENT_REQUIRED');
    this.client = client as unknown as RbacRpcClient;
  }

  async authorize(input: InteriorAuthorizationInput): Promise<InteriorAuthorizationDecision> {
    if (!input.permissionId.trim() || !input.tenantId.trim()) {
      return { status: 'DENY', reason: 'INVALID_CONTEXT' };
    }

    try {
      const response = await this.client.rpc('interior_authorize_action', {
        p_permission_id: input.permissionId,
        p_tenant_id: input.tenantId,
        p_project_id: input.projectId ?? null,
        p_branch_id: input.branchId ?? null,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      const row = authorizationRow(response.data);
      if (!row) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      if (row.status === 'ALLOW' && row.reason === 'AUTHORIZED') {
        return { status: 'ALLOW', reason: 'AUTHORIZED' };
      }
      if (row.status === 'DENY') return { status: 'DENY', reason: row.reason };
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    } catch {
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    }
  }

  async authorizeProjectList(tenantId: string): Promise<InteriorAuthorizationDecision> {
    if (!tenantId.trim()) return { status: 'DENY', reason: 'INVALID_CONTEXT' };
    try {
      const response = await this.client.rpc('interior_authorize_project_list', {
        p_tenant_id: tenantId,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      const row = authorizationRow(response.data);
      if (!row) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      if (row.status === 'ALLOW' && row.reason === 'SCOPED_PROJECT_LIST') {
        return { status: 'ALLOW', reason: 'SCOPED_PROJECT_LIST' };
      }
      if (row.status === 'DENY') return { status: 'DENY', reason: row.reason };
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    } catch {
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    }
  }

  async authorizeCustomerList(tenantId: string): Promise<InteriorAuthorizationDecision> {
    if (!tenantId.trim()) return { status: 'DENY', reason: 'INVALID_CONTEXT' };
    try {
      const response = await this.client.rpc('interior_authorize_customer_list', {
        p_tenant_id: tenantId,
      });
      if (response.error) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      const row = authorizationRow(response.data);
      if (!row) return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
      if (row.status === 'ALLOW' && row.reason === 'SCOPED_CUSTOMER_LIST') {
        return { status: 'ALLOW', reason: 'SCOPED_CUSTOMER_LIST' };
      }
      if (row.status === 'DENY') return { status: 'DENY', reason: row.reason };
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    } catch {
      return { status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' };
    }
  }
}
