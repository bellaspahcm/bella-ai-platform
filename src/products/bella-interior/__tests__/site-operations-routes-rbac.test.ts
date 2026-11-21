import { NextRequest } from 'next/server';
import { GET as getSchedule } from '@/app/api/interior/schedule/route';
import { GET as getSiteDiary, POST as createSiteDiary } from '@/app/api/interior/delivery/site-diary/route';
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
});
