import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const projectId = '00000000-0000-4000-8000-000000000003';
const siteId = '00000000-0000-4000-8000-000000000004';
const orgUnitId = '00000000-0000-4000-8000-000000000005';
const workPackageId = '00000000-0000-4000-8000-000000000006';
const itemId = '00000000-0000-4000-8000-000000000007';
const assigneeId = '00000000-0000-4000-8000-000000000008';

const profile = [{
  id: actorId,
  tenant_id: tenantId,
  email: 'actor@example.invalid',
  full_name: 'Construction Actor',
  avatar_url: null,
  role: 'member',
  status: 'active',
  tenant_status: 'active',
}];
const scheduleItem = {
  id: itemId,
  tenant_id: tenantId,
  project_id: projectId,
  site_id: siteId,
  work_package_id: workPackageId,
  org_unit_id: orgUnitId,
  title: 'Install wiring',
  baseline_start_date: '2026-11-06',
  baseline_end_date: '2026-11-08',
  forecast_start_date: '2026-11-06',
  forecast_end_date: '2026-11-08',
  actual_start_date: null,
  actual_end_date: null,
  progress_percent: 0,
  delay_reason: null,
  responsible_user_id: null,
  predecessor_schedule_item_id: null,
};
const workPackage = {
  id: workPackageId,
  project_id: projectId,
  site_id: siteId,
  org_unit_id: orgUnitId,
  work_package_code: 'WP-01',
  name: 'Electrical',
};

const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockRpc = jest.fn<(name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>>();
const mockUsersOrder = jest.fn<() => Promise<{ data: { id: string; full_name: string }[]; error: { message: string } | null }>>();
const mockUsersEq = jest.fn();
const mockUsersSelect = jest.fn();
const mockFrom = jest.fn();
const mockClient = {
  auth: { getUser: mockAuth },
  rpc: mockRpc,
  from: mockFrom,
};

jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => mockClient) }));

const route = require('../route') as typeof import('../route');

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost/api/construction/schedule${path}`, init);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockUsersOrder.mockResolvedValue({ data: [{ id: assigneeId, full_name: 'Site Lead' }], error: null });
  mockUsersEq.mockImplementation(() => ({ eq: mockUsersEq, order: mockUsersOrder }));
  mockUsersSelect.mockImplementation(() => ({ eq: mockUsersEq }));
  mockFrom.mockImplementation(() => ({ select: mockUsersSelect }));
  mockRpc.mockImplementation(async (name, args) => {
    if (name === 'platform_current_actor_profile') return { data: profile, error: null };
    if (name === 'platform_authorize_action') {
      return { data: [{ status: 'ALLOW', reason: 'DIRECT_GRANT' }], error: null };
    }
    if (name === 'construction_list_projects') return { data: [{ id: projectId, project_code: 'P-01', name: 'Project One' }], error: null };
    if (name === 'construction_list_work_packages') return { data: [workPackage], error: null };
    if (name === 'construction_list_schedule_items') return { data: [scheduleItem], error: null };
    if (name === 'construction_create_schedule_item_with_details') return { data: scheduleItem, error: null };
    return { data: [], error: null };
  });
});

describe('Construction Schedule API', () => {
  it('reads projects only after checking the authenticated tenant grant', async () => {
    const response = await route.GET(request(''));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, projects: [{ id: projectId, project_code: 'P-01', name: 'Project One' }] });
    expect(mockRpc).toHaveBeenCalledWith('construction_list_projects', { p_project_id: null });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('reads back schedule rows and same-tenant active assignees through scoped APIs', async () => {
    const response = await route.GET(request(`?site_id=${siteId}&work_package_id=${workPackageId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      canWrite: true,
      scheduleItems: [scheduleItem],
      assignees: [{ id: assigneeId, full_name: 'Site Lead' }],
    });
    expect(mockRpc).toHaveBeenCalledWith('construction_list_work_packages', { p_site_id: siteId });
    expect(mockRpc).toHaveBeenCalledWith('construction_list_schedule_items', { p_work_package_id: workPackageId });
    expect(mockUsersEq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(mockUsersEq).toHaveBeenCalledWith('status', 'active');
  });

  it('keeps a read-only user from receiving assignment choices or write controls', async () => {
    mockRpc.mockImplementation(async (name, args) => {
      if (name === 'platform_current_actor_profile') return { data: profile, error: null };
      if (name === 'platform_authorize_action') {
        const permission = args?.p_permission_id;
        return { data: [{ status: permission === 'construction:work_package:write' ? 'DENY' : 'ALLOW', reason: permission === 'construction:work_package:write' ? 'NO_GRANT' : 'DIRECT_GRANT' }], error: null };
      }
      if (name === 'construction_list_work_packages') return { data: [workPackage], error: null };
      if (name === 'construction_list_schedule_items') return { data: [scheduleItem], error: null };
      return { data: [], error: null };
    });
    const response = await route.GET(request(`?site_id=${siteId}&work_package_id=${workPackageId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, canWrite: false, assignees: [], scheduleItems: [scheduleItem] });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied tenant identity before resolving the session', async () => {
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ workPackageId }),
    }));
    expect(response.status).toBe(403);
    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects extra authority fields and does not call a mutation RPC', async () => {
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workPackageId, title: 'Task', baselineStartDate: '2026-11-06', baselineEndDate: '2026-11-07', tenantId }),
    }));
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalledWith('construction_create_schedule_item_with_details', expect.anything());
  });

  it('calls the authenticated create RPC without actor or tenant supplied by the browser', async () => {
    const response = await route.POST(request('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workPackageId, title: 'Install wiring', baselineStartDate: '2026-11-06', baselineEndDate: '2026-11-08' }),
    }));
    expect(response.status).toBe(201);
    const mutation = mockRpc.mock.calls.find((call) => call[0] === 'construction_create_schedule_item_with_details');
    expect(mutation?.[1]).toEqual({
      p_work_package_id: workPackageId,
      p_title: 'Install wiring',
      p_baseline_start_date: '2026-11-06',
      p_baseline_end_date: '2026-11-08',
      p_responsible_user_id: null,
      p_predecessor_schedule_item_id: null,
    });
    expect(mutation?.[1]).not.toHaveProperty('tenant_id');
    expect(mutation?.[1]).not.toHaveProperty('actor_id');
  });

  it('persists forecast, actual progress, responsibility and dependency through one update RPC', async () => {
    const updated = { ...scheduleItem, progress_percent: 42.5, forecast_end_date: '2026-11-09', responsible_user_id: assigneeId };
    mockRpc.mockImplementation(async (name) => {
      if (name === 'platform_current_actor_profile') return { data: profile, error: null };
      if (name === 'construction_update_schedule_item_with_details') return { data: updated, error: null };
      return { data: [], error: null };
    });
    const response = await route.PATCH(request('', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scheduleItemId: itemId,
        forecastStartDate: '2026-11-06',
        forecastEndDate: '2026-11-09',
        actualStartDate: '2026-11-06',
        actualEndDate: null,
        progressPercent: 42.5,
        delayReason: 'Material delivery',
        responsibleUserId: assigneeId,
        predecessorScheduleItemId: null,
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, scheduleItem: updated });
    expect(mockRpc).toHaveBeenCalledWith('construction_update_schedule_item_with_details', {
      p_schedule_item_id: itemId,
      p_forecast_start_date: '2026-11-06',
      p_forecast_end_date: '2026-11-09',
      p_actual_start_date: '2026-11-06',
      p_actual_end_date: null,
      p_progress_percent: 42.5,
      p_delay_reason: 'Material delivery',
      p_responsible_user_id: assigneeId,
      p_predecessor_schedule_item_id: null,
    });
  });
});
