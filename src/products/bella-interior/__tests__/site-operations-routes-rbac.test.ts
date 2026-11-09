import { NextRequest } from 'next/server';
import { GET as getSchedule } from '@/app/api/interior/schedule/route';
import { POST as createSiteDiary } from '@/app/api/interior/delivery/site-diary/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

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
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
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
});
