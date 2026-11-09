import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/interior/customers/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
}));

jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);

function request(): NextRequest {
  return new Request('https://bella.example/api/interior/customers') as NextRequest;
}

describe('Interior customers route RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('aggregates only customer fields returned by the scoped authenticated RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        { customerId: 'customer-a', customerName: 'Alice', id: 'project-a' },
        { customerId: 'customer-a', customerName: 'Alice', id: 'project-b' },
        { customerId: null, customerName: null, id: 'project-c' },
        null,
      ],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await GET(request());
    const body = await response.json() as { data: { customers: Array<{ id: string; projectCount: number }> } };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_list_projects');
    expect(body.data.customers).toEqual([{ id: 'customer-a', name: 'Alice', projectCount: 2 }]);
  });

  it('fails closed when the scoped project RPC is unavailable', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'offline' } });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await GET(request());
    expect(response.status).toBe(503);
  });
});
