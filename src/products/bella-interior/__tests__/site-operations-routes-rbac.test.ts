import { NextRequest } from 'next/server';
import { GET as getSchedule } from '@/app/api/interior/schedule/route';
import { GET as getSiteDiary, POST as createSiteDiary, PATCH as updateSiteDiary } from '@/app/api/interior/delivery/site-diary/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';

jest.mock('@/lib/supabase-service-client', () => ({
  createServiceClient: jest.fn(() => ({ storage: { from: jest.fn(() => ({
    download: jest.fn().mockResolvedValue({ data: new Blob(['image']), error: null }),
  })) } })),
}));

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
}));

jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  interiorMutationRow: (value: unknown): Record<string, unknown> | null =>
    Array.isArray(value) && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
      ? value[0] as Record<string, unknown>
      : null,
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  validInteriorUuid: (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const entryId = '123e4567-e89b-42d3-a456-426614174001';

describe('Interior site operations RBAC routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      actor: { id: 'user-a', full_name: 'Site Manager', email: 'site@example.invalid' },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('reads schedule cards from the scoped list RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ id: 'plan-a', rooms: [] }], error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await getSchedule(new NextRequest('https://bella.example/api/interior/schedule'));
    const body = await response.json() as { data: { plans: Array<{ id: string }> } };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_list_installation_plans', { p_project_id: null });
    expect(body.data.plans).toEqual([{ id: 'plan-a', rooms: [] }]);
  });

  it('records a site diary through a server-actor command RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'SITE_DIARY_CREATED', entry_id: entryId }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await createSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        date: '2026-11-09',
        workersPresent: 4,
        weatherCondition: 'cloudy',
        activitiesCompleted: ['Install cabinetry'],
        issuesEncountered: ['Material delay'],
      }),
    }));
    const body = await response.json() as { data: { id: string; supervisorName: string } };

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_create_site_diary', {
      p_project_id: projectId,
      p_entry_date: '2026-11-09',
      p_labor_headcount: 4,
      p_weather: 'cloudy',
      p_activities_completed: ['Install cabinetry'],
      p_issues_noted: 'Material delay',
    });
    expect(body.data).toEqual(expect.objectContaining({ id: entryId, supervisorName: 'Site Manager' }));
  });

  it('returns protected photo links and rejects a photo outside the diary tenant and project', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{
      id: entryId, tenantId: 'tenant-a', projectId, date: '2026-11-09', supervisorName: 'Site Manager',
      workersPresent: 1, activitiesCompleted: ['Inspect'], photoUrls: [
        `tenant-a/${projectId}/diary/photo.jpg`, 'other-tenant/private.jpg', 'https://legacy.example/private-photo.jpg?token=secret',
      ],
    }], error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);
    const base = `https://bella.example/api/interior/delivery/site-diary?projectId=${projectId}`;
    const list = await getSiteDiary(new Request(base));
    const body = await list.json() as { data: Array<{ photoUrls: string[]; legacyPhotoCount: number }> };
    expect(body.data[0].photoUrls).toHaveLength(1);
    expect(body.data[0].legacyPhotoCount).toBe(2);
    expect(JSON.stringify(body)).not.toContain('legacy.example');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body.data[0].photoUrls[0]).toContain(`diaryId=${entryId}&photoIndex=0`);
    const denied = await getSiteDiary(new Request(`${base}&diaryId=${entryId}&photoIndex=1`));
    expect(denied.status).toBe(404);
    expect(createServiceClient).not.toHaveBeenCalled();
    const allowed = await getSiteDiary(new Request(`${base}&diaryId=${entryId}&photoIndex=0`));
    expect(allowed.status).toBe(200);
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it('updates an existing site diary entry through PATCH when authorized', async () => {
    const rpc = jest.fn().mockImplementation((fn: string) => {
      if (fn === 'interior_has_permission') return Promise.resolve({ data: true, error: null });
      if (fn === 'interior_list_site_diaries') return Promise.resolve({
        data: [{
          id: entryId,
          tenantId: 'tenant-a',
          projectId,
          date: '2026-11-09',
          supervisorName: 'Site Manager',
          workersPresent: 4,
          weatherCondition: 'cloudy',
          activitiesCompleted: ['Initial framing'],
          issuesNoted: 'None',
        }],
        error: null,
      });
      return Promise.resolve({ data: null, error: null });
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      actor: { id: 'user-a', full_name: 'Site Manager', email: 'site@example.invalid' },
      supabase: {
        from: jest.fn(() => ({
          update: updateMock,
        })),
      },
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);

    const response = await updateSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diaryId: entryId,
        projectId,
        workersPresent: 6,
        weatherCondition: 'sunny',
        activitiesCompleted: ['Complete cabinetry installation'],
        issuesEncountered: ['Resolved electricity outage'],
        notes: 'Handover tomorrow',
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; data: { workersPresent: number; weatherCondition: string } };
    expect(body.success).toBe(true);
    expect(body.data.workersPresent).toBe(6);
    expect(body.data.weatherCondition).toBe('sunny');
    expect(rpc).toHaveBeenCalledWith('interior_has_permission', {
      p_permission: 'interior:installation:update',
      p_tenant: 'tenant-a',
      p_project_id: projectId,
    });
  });

  it('rejects PATCH when permission is denied', async () => {
    const rpc = jest.fn().mockImplementation((fn: string) => {
      if (fn === 'interior_has_permission') return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await updateSiteDiary(new Request('https://bella.example/api/interior/delivery/site-diary', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diaryId: entryId,
        projectId,
        workersPresent: 6,
      }),
    }));

    expect(response.status).toBe(403);
    const body = await response.json() as { success: boolean; error: string; reason: string };
    expect(body.success).toBe(false);
    expect(body.reason).toBe('SITE_DIARY_UPDATE_PERMISSION_REQUIRED');
  });
});
