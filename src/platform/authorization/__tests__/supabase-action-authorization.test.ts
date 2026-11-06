import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { SupabasePlatformActionAuthorization } from '../supabase-action-authorization';

const actorProfile = {
  id: 'user-a',
  email: 'user-a@example.test',
  full_name: 'User A',
  role: 'admin',
  avatar_url: null,
  tenant_id: 'tenant-a',
  status: 'active',
  tenant_status: 'active',
};

function makeClient(options?: {
  readonly actionData?: unknown;
  readonly actionError?: { readonly code?: string; readonly message: string } | null;
  readonly grantData?: unknown;
  readonly grantError?: { readonly code?: string; readonly message: string } | null;
  readonly userId?: string | null;
  readonly profileData?: unknown;
  readonly profileError?: { readonly code?: string; readonly message: string } | null;
}) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options?.userId === null ? null : { id: options?.userId ?? 'user-a' } },
        error: null,
      }),
    },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'platform_current_actor_profile') {
        return {
          data: options?.profileData ?? [actorProfile],
          error: options?.profileError ?? null,
        };
      }
      if (name === 'platform_authorize_action') {
        return {
          data: options?.actionData ?? [{ status: 'ALLOW', reason: 'DIRECT_GRANT' }],
          error: options?.actionError ?? null,
        };
      }
      return {
        data: options?.grantData ?? [{ status: 'COMMITTED', reason: 'GRANTED', grant_id: 'grant-a' }],
        error: options?.grantError ?? null,
      };
    },
  };

  return {
    authorization: new SupabasePlatformActionAuthorization(client as unknown as SupabaseClient<Database>),
    calls,
  };
}

describe('SupabasePlatformActionAuthorization', () => {
  it('reconciles Auth identity and active tenant before checking a direct grant', async () => {
    const harness = makeClient();

    await expect(harness.authorization.authorize({
      permissionId: 'construction:project:write',
      tenantId: 'tenant-a',
    })).resolves.toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });

    expect(harness.calls).toContainEqual({
      name: 'platform_authorize_action',
      args: {
        p_permission_id: 'construction:project:write',
        p_tenant_id: 'tenant-a',
        p_org_unit_id: null,
      },
    });
  });

  it('denies a caller-selected tenant before invoking the resolver', async () => {
    const harness = makeClient();

    await expect(harness.authorization.authorize({
      permissionId: 'construction:project:write',
      tenantId: 'tenant-b',
    })).resolves.toEqual({ status: 'DENY', reason: 'TENANT_MISMATCH' });

    expect(harness.calls.some((call) => call.name === 'platform_authorize_action')).toBe(false);
  });

  it('keeps resolver failures distinct from a business deny', async () => {
    const harness = makeClient({ actionError: { code: '57014', message: 'statement timeout' } });

    await expect(harness.authorization.authorize({
      permissionId: 'construction:foundation:read',
      tenantId: 'tenant-a',
      orgUnitId: 'org-a',
    })).resolves.toEqual({ status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' });
  });

  it('creates a direct grant without accepting actor or tenant authority from input', async () => {
    const harness = makeClient();

    await expect(harness.authorization.grantDirectUser({
      targetUserId: 'target-a',
      permissionId: 'construction:site:write',
      scope: { type: 'ORG_UNIT', orgUnitId: 'org-a' },
    })).resolves.toEqual({ status: 'COMMITTED', grantId: 'grant-a' });

    expect(harness.calls).toContainEqual({
      name: 'platform_grant_direct_user_action',
      args: {
        p_target_user_id: 'target-a',
        p_permission_id: 'construction:site:write',
        p_scope_type: 'ORG_UNIT',
        p_org_unit_id: 'org-a',
      },
    });
  });

  it('reports persistence failures without claiming a committed mutation', async () => {
    const harness = makeClient({ grantError: { code: 'P0001', message: 'audit failure' } });

    await expect(harness.authorization.revokeDirectUser({ grantId: 'grant-a' })).resolves.toEqual({
      status: 'UNAVAILABLE',
      reason: 'PERSISTENCE_FAILED',
    });
  });

  it('preserves an unavailable Org Unit check as an operational failure', async () => {
    const harness = makeClient({
      grantData: [{ status: 'UNAVAILABLE', reason: 'ORG_UNIT_UNAVAILABLE', grant_id: null }],
    });

    await expect(harness.authorization.grantDirectUser({
      targetUserId: 'target-a',
      permissionId: 'construction:site:write',
      scope: { type: 'ORG_UNIT', orgUnitId: 'org-a' },
    })).resolves.toEqual({ status: 'UNAVAILABLE', reason: 'ORG_UNIT_UNAVAILABLE' });
  });
});
