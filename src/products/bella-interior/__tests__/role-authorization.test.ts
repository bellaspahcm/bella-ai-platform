import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { SupabaseInteriorRoleAuthorization } from '../lib/role-authorization';

type RpcResponse = { data: unknown; error: { message: string } | null };
type MockRpc = jest.Mock<Promise<RpcResponse>, [string, Record<string, unknown> | undefined]>;

function createAuthorization(response: RpcResponse) {
  const rpc: MockRpc = jest.fn().mockResolvedValue(response);
  const client = { rpc } as unknown as SupabaseClient<Database>;
  return { authorization: new SupabaseInteriorRoleAuthorization(client), rpc };
}

describe('SupabaseInteriorRoleAuthorization', () => {
  it('binds action resolution to the canonical tenant and requested project', async () => {
    const { authorization, rpc } = createAuthorization({
      data: [{ status: 'ALLOW', reason: 'AUTHORIZED' }],
      error: null,
    });

    await expect(authorization.authorize({
      permissionId: 'interior:design:update',
      tenantId: 'tenant-a',
      projectId: 'project-a',
    })).resolves.toEqual({ status: 'ALLOW', reason: 'AUTHORIZED' });
    expect(rpc).toHaveBeenCalledWith('interior_authorize_action', {
      p_permission_id: 'interior:design:update',
      p_tenant_id: 'tenant-a',
      p_project_id: 'project-a',
      p_branch_id: null,
    });
  });

  it('preserves deny-by-default decisions', async () => {
    const { authorization } = createAuthorization({
      data: [{ status: 'DENY', reason: 'NO_GRANT' }],
      error: null,
    });
    await expect(authorization.authorize({ permissionId: 'interior:payment:refund', tenantId: 'tenant-a' }))
      .resolves.toEqual({ status: 'DENY', reason: 'NO_GRANT' });
  });

  it('uses the scope-filtered project-list resolver', async () => {
    const { authorization, rpc } = createAuthorization({
      data: [{ status: 'ALLOW', reason: 'SCOPED_PROJECT_LIST' }],
      error: null,
    });
    await expect(authorization.authorizeProjectList('tenant-a'))
      .resolves.toEqual({ status: 'ALLOW', reason: 'SCOPED_PROJECT_LIST' });
    expect(rpc).toHaveBeenCalledWith('interior_authorize_project_list', { p_tenant_id: 'tenant-a' });
  });

  it('fails closed when the database resolver is unavailable', async () => {
    const { authorization } = createAuthorization({ data: null, error: { message: 'offline' } });
    await expect(authorization.authorize({ permissionId: 'interior:project:read', tenantId: 'tenant-a' }))
      .resolves.toEqual({ status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' });
  });
});
