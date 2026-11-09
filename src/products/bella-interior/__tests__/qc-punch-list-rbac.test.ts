import { GET as listQcItems, POST as createQcItem } from '@/app/api/interior/delivery/punch-list/route';
import { GET as readQcItem, PATCH as updateQcItem } from '@/app/api/interior/delivery/punch-list/[id]/route';
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
const itemId = '123e4567-e89b-42d3-a456-426614174001';
const storedItem = {
  id: itemId,
  tenantId: 'tenant-a',
  projectId,
  roomZoneId: null,
  reportedByUserId: 'user-a',
  roomZoneName: 'Khu vực chính',
  itemName: 'Loose cabinet hinge',
  category: 'furniture_fit',
  description: 'Loose cabinet hinge',
  severity: 'major',
  photoUrl: null,
  assignedFixer: 'Chưa phân công',
  deadline: '2026-11-12',
  status: 'open',
  rectificationNote: null,
  verifiedBy: null,
  verifiedAt: null,
  createdAt: '2026-11-09T00:00:00.000Z',
};

describe('Interior QC punch-list RBAC routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      actor: { id: 'user-a' },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('lists punch items through the project-scoped QC read RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [storedItem], error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await listQcItems(new Request(`https://bella.example/api/interior/delivery/punch-list?projectId=${projectId}`));
    const body = await response.json() as { data: Array<{ id: string; roomZoneId: string | null; assignedToUserId: string | null }> };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_list_qc_items', { p_project_id: projectId });
    expect(body.data).toEqual([expect.objectContaining({ id: itemId, roomZoneId: null, assignedToUserId: null })]);
  });

  it('creates a punch item through the actor-bound QC command RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ status: 'COMMITTED', reason: 'QC_ITEM_CREATED', item: storedItem }], error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await createQcItem(new Request('https://bella.example/api/interior/delivery/punch-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        description: 'Loose cabinet hinge',
        category: 'furniture_fit',
        severity: 'major',
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_create_qc_item', {
      p_project_id: projectId,
      p_room_zone_id: null,
      p_description: 'Loose cabinet hinge',
      p_category: 'furniture_fit',
      p_severity: 'major',
    });
  });

  it('reads a single punch item through its scoped resolver', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: storedItem, error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readQcItem(new Request(`https://bella.example/api/interior/delivery/punch-list/${itemId}`), {
      params: Promise.resolve({ id: itemId }),
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_read_qc_item', { p_item_id: itemId });
  });

  it('delegates verification transition enforcement to the qc:approve command boundary', async () => {
    const verifiedItem = { ...storedItem, status: 'verified', verifiedBy: 'user-a' };
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'QC_ITEM_UPDATED', item: verifiedItem }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await updateQcItem(new Request(`https://bella.example/api/interior/delivery/punch-list/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified', rectificationNote: 'Rechecked and passed' }),
    }), { params: Promise.resolve({ id: itemId }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_update_qc_item', {
      p_item_id: itemId,
      p_status: 'verified',
      p_rectification_note: 'Rechecked and passed',
    });
  });
});
