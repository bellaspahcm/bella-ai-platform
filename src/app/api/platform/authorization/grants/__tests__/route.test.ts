import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const tenantId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const orgUnitId = '00000000-0000-4000-8000-000000000003';
const grantId = '00000000-0000-4000-8000-000000000004';
const profile = [{
  id: userId,
  tenant_id: tenantId,
  email: 'e2e-admin@example.invalid',
  full_name: 'E2E Admin',
  avatar_url: null,
  role: 'admin',
  status: 'active',
  tenant_status: 'active',
}];

const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockRpc = jest.fn<(
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>>();
const mockClient = { auth: { getUser: mockAuth }, rpc: mockRpc };

jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => mockClient) }));

const route = require('../route') as typeof import('../route');

function request(body: string, contentType = 'application/json', origin = 'http://localhost'): Request {
  return new Request('http://localhost/api/platform/authorization/grants', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      origin,
      'sec-fetch-site': origin === 'http://localhost' ? 'same-origin' : 'cross-site',
    },
    body,
  });
}

describe('Platform direct grant authenticated API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mockRpc.mockImplementation(async (name) => {
      if (name === 'platform_current_actor_profile') return { data: profile, error: null };
      if (name === 'platform_grant_direct_user_action') {
        return { data: [{ status: 'COMMITTED', reason: 'GRANTED', grant_id: grantId }], error: null };
      }
      return { data: [], error: null };
    });
  });

  it('uses the authenticated grant RPC with the exact target and Org Unit scope', async () => {
    const response = await route.POST(request(JSON.stringify({
      targetUserId: userId,
      permissionId: 'construction.site_diary.create',
      scope: { type: 'ORG_UNIT', orgUnitId },
    })));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, grantId });
    expect(mockRpc).toHaveBeenCalledWith('platform_grant_direct_user_action', {
      p_target_user_id: userId,
      p_permission_id: 'construction.site_diary.create',
      p_scope_type: 'ORG_UNIT',
      p_org_unit_id: orgUnitId,
    });
    const grantArgs = mockRpc.mock.calls.find(([name]) => name === 'platform_grant_direct_user_action')?.[1];
    expect(grantArgs).not.toHaveProperty('actor_id');
    expect(grantArgs).not.toHaveProperty('tenant_id');
  });

  it('accepts a same-origin browser form while preserving the direct grant contract', async () => {
    const form = new URLSearchParams({
      targetUserId: userId,
      permissionId: 'construction.issue.view',
      scopeType: 'ORG_UNIT',
      orgUnitId,
    });
    const response = await route.POST(request(form.toString(), 'application/x-www-form-urlencoded'));

    expect(response.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith('platform_grant_direct_user_action', {
      p_target_user_id: userId,
      p_permission_id: 'construction.issue.view',
      p_scope_type: 'ORG_UNIT',
      p_org_unit_id: orgUnitId,
    });
  });

  it('rejects caller-supplied actor or tenant authority before resolving a session', async () => {
    const response = await route.POST(request(JSON.stringify({
      targetUserId: userId,
      permissionId: 'construction.site_diary.view',
      scope: { type: 'ORG_UNIT', orgUnitId },
      actorId: userId,
      tenantId,
    })));

    expect(response.status).toBe(400);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests before authentication or mutation', async () => {
    const response = await route.POST(request(JSON.stringify({
      targetUserId: userId,
      permissionId: 'construction.site_diary.view',
      scope: { type: 'ORG_UNIT', orgUnitId },
    }), 'application/json', 'https://outside.example'));

    expect(response.status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request without reaching the grant RPC', async () => {
    mockAuth.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });
    const response = await route.POST(request(JSON.stringify({
      targetUserId: userId,
      permissionId: 'construction.site_diary.view',
      scope: { type: 'ORG_UNIT', orgUnitId },
    })));

    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns the grant RPC denial without converting it to success', async () => {
    mockRpc.mockImplementation(async (name) => {
      if (name === 'platform_current_actor_profile') return { data: profile, error: null };
      if (name === 'platform_grant_direct_user_action') {
        return { data: [{ status: 'DENIED', reason: 'NOT_TENANT_GRANT_ADMIN', grant_id: null }], error: null };
      }
      return { data: [], error: null };
    });
    const response = await route.POST(request(JSON.stringify({
      targetUserId: userId,
      permissionId: 'construction.site_diary.view',
      scope: { type: 'ORG_UNIT', orgUnitId },
    })));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'NOT_TENANT_GRANT_ADMIN' });
  });
});
