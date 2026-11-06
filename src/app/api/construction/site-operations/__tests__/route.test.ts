import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const tenantId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const siteId = '00000000-0000-4000-8000-000000000003';
const projectId = '00000000-0000-4000-8000-000000000004';
const orgUnitId = '00000000-0000-4000-8000-000000000005';
const entryId = '00000000-0000-4000-8000-000000000006';

const site = {
  id: siteId,
  project_id: projectId,
  org_unit_id: orgUnitId,
  site_code: 'SITE-01',
  name: 'Pilot Site',
  can_view_diary: true,
  can_create_diary: true,
  can_update_diary: true,
  can_view_issue: true,
  can_create_issue: true,
  can_update_issue: true,
  can_resolve_issue: true,
  can_close_issue: true,
  can_reopen_issue: true,
};
const diaryEntry = {
  id: entryId,
  tenant_id: tenantId,
  project_id: projectId,
  site_id: siteId,
  org_unit_id: orgUnitId,
  work_package_id: null,
  entry_date: '2026-11-05',
  content: 'Concrete poured.',
  author_user_id: userId,
  created_by: userId,
  created_at: '2026-11-05T08:00:00.000Z',
  updated_by: userId,
  updated_at: '2026-11-05T08:00:00.000Z',
};
const profile = [{
  id: userId,
  tenant_id: tenantId,
  email: 'actor@example.invalid',
  full_name: 'Construction Actor',
  avatar_url: null,
  role: 'member',
  status: 'active',
  tenant_status: 'active',
}];

const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockRpc = jest.fn<(name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>>();
let mockPermissionStatus: 'ALLOW' | 'DENY' | 'UNAVAILABLE' = 'ALLOW';
const mockClient = { auth: { getUser: mockAuth }, rpc: mockRpc };

jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => mockClient) }));

const route = require('../route') as typeof import('../route');

function request(path: string, init: RequestInit = {}): Request {
  return new Request('http://localhost/api/construction/site-operations' + path, init);
}

describe('Construction Site Operations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissionStatus = 'ALLOW';
    mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mockRpc.mockImplementation(async (name) => {
      if (name === 'platform_current_actor_profile') return { data: profile, error: null };
      if (name === 'platform_authorize_action') {
        return { data: [{ status: mockPermissionStatus, reason: mockPermissionStatus === 'ALLOW' ? 'DIRECT_GRANT' : 'NO_GRANT' }], error: null };
      }
      if (name === 'construction_list_site_activity_sites') return { data: [site], error: null };
      if (name === 'construction_create_site_diary_entry') return { data: diaryEntry, error: null };
      return { data: [], error: null };
    });
  });

  it('rejects caller supplied actor, tenant, or scope before the mutation RPC', async () => {
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'diary',
        siteId,
        entryDate: '2026-11-05',
        workPackageId: null,
        content: 'Daily report',
        tenantId,
        actorId: userId,
      }),
    }));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalledWith('construction_create_site_diary_entry', expect.anything());
  });

  it('requires the exact action grant before calling the authenticated create RPC', async () => {
    mockPermissionStatus = 'DENY';
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'diary',
        siteId,
        entryDate: '2026-11-05',
        workPackageId: null,
        content: 'Daily report',
      }),
    }));
    expect(response.status).toBe(403);
    expect(mockRpc).toHaveBeenCalledWith('platform_authorize_action', {
      p_permission_id: 'construction.site_diary.create',
      p_tenant_id: tenantId,
      p_org_unit_id: orgUnitId,
    });
    expect(mockRpc).not.toHaveBeenCalledWith('construction_create_site_diary_entry', expect.anything());
  });

  it('persists using the server resolved Site and does not send actor or tenant authority from the browser', async () => {
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'diary',
        siteId,
        entryDate: '2026-11-05',
        workPackageId: null,
        content: 'Daily report',
      }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, diaryEntry });
    expect(mockRpc).toHaveBeenCalledWith('construction_create_site_diary_entry', {
      p_site_id: siteId,
      p_entry_date: '2026-11-05',
      p_work_package_id: null,
      p_content: 'Daily report',
    });
    expect(mockRpc.mock.calls.find(([name]) => name === 'construction_create_site_diary_entry')?.[1])
      .not.toHaveProperty('tenant_id');
    expect(mockRpc.mock.calls.find(([name]) => name === 'construction_create_site_diary_entry')?.[1])
      .not.toHaveProperty('actor_id');
  });
});
