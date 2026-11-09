import { GET, POST } from '@/app/api/interior/design/revisions/route';
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
const revisionId = '123e4567-e89b-42d3-a456-426614174001';

function createRequest(method: 'GET' | 'POST', body?: unknown): Request {
  return new Request(`https://bella.example/api/interior/design/revisions${method === 'GET' ? `?projectId=${projectId}` : ''}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

describe('Interior design revision route RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      actor: { id: 'user-a' },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('reads revisions through the project-scoped RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{
        id: revisionId,
        projectId,
        title: 'Concept',
        versionNumber: 2,
        status: 'client_review',
        submittedBy: 'designer-a',
        submittedAt: '2026-11-01T00:00:00.000Z',
      }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await GET(createRequest('GET'));
    const body = await response.json() as { data: { revisions: Array<{ revisionNumber: string; status: string }> } };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_list_design_revisions', { p_project_id: projectId });
    expect(body.data.revisions).toEqual([expect.objectContaining({ revisionNumber: 'R2.0', status: 'review' })]);
  });

  it('creates a draft revision through the actor-bound command RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'DESIGN_REVISION_CREATED', revision_id: revisionId }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await POST(createRequest('POST', {
      projectId,
      revisionName: '  Kitchen v2  ',
      revisionNumber: 'R2.0',
    }));
    const body = await response.json() as { data: { revision: { id: string; designedByUserId: string } } };

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_create_design_revision', {
      p_project_id: projectId,
      p_title: 'Kitchen v2',
      p_version_number: 2,
    });
    expect(body.data.revision).toEqual(expect.objectContaining({ id: revisionId, designedByUserId: 'user-a' }));
  });
});
