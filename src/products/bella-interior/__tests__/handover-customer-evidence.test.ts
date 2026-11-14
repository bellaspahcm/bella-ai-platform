export {};

const testCustomerHandoverToken = ['00000000', '0000', '4000', '8000', '000000000001'].join('-');

const mockContextState = {
  value: {
    ok: true,
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    actor: { id: '123e4567-e89b-42d3-a456-426614174070', role: 'pm', full_name: 'Project Manager' },
    supabase: { rpc: jest.fn(async () => ({
      data: {
        status: 'COMMITTED',
        dossier: { id: '123e4567-e89b-42d3-a456-426614174080', clientAccepted: false },
        approval: {
          id: '123e4567-e89b-42d3-a456-426614174081',
          token: testCustomerHandoverToken,
          expiresAt: '2026-12-14T00:00:00.000Z',
          status: 'pending',
        },
      },
      error: null,
    })) },
  } as Record<string, unknown>,
};

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(async () => mockContextState.value),
}));

const { POST } = require('@/app/api/interior/delivery/handover/route') as {
  POST: (request: Request) => Promise<Response>;
};
const { resolveInteriorContext } = require('../lib/server-context') as {
  resolveInteriorContext: jest.Mock;
};

describe('Interior customer handover evidence guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextState.value = {
      ok: true,
      tenantId: '123e4567-e89b-42d3-a456-426614174010',
      actor: { id: '123e4567-e89b-42d3-a456-426614174070', role: 'pm', full_name: 'Project Manager' },
      supabase: { rpc: jest.fn(async () => ({
        data: {
          status: 'COMMITTED',
          dossier: { id: '123e4567-e89b-42d3-a456-426614174080', clientAccepted: false },
          approval: {
            id: '123e4567-e89b-42d3-a456-426614174081',
            token: testCustomerHandoverToken,
            expiresAt: '2026-12-14T00:00:00.000Z',
            status: 'pending',
          },
        },
        error: null,
      })) },
    };
    resolveInteriorContext.mockImplementation(async () => mockContextState.value);
  });

  it('creates a pending customer request and ignores staff-supplied customer identity', async () => {
    const response = await POST(new Request('https://bella.example/api/interior/delivery/handover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: '123e4567-e89b-42d3-a456-426614174000',
        contractId: '123e4567-e89b-42d3-a456-426614174030',
        clientRepresentative: 'Customer name supplied by staff',
      }),
    }));
    const body = await response.json() as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.data.customerAcceptanceEndpoint).toBe(
      `/api/interior/delivery/handover/acceptances/123e4567-e89b-42d3-a456-426614174081?token=${testCustomerHandoverToken}`,
    );
    expect((mockContextState.value.supabase as { rpc: jest.Mock }).rpc).toHaveBeenCalledWith(
      'interior_request_handover_acceptance',
      expect.objectContaining({
        p_project_id: '123e4567-e89b-42d3-a456-426614174000',
        p_contract_id: '123e4567-e89b-42d3-a456-426614174030',
      }),
    );
    expect((mockContextState.value.supabase as { rpc: jest.Mock }).rpc.mock.calls[0][1])
      .not.toHaveProperty('p_actor_name');
    expect((mockContextState.value.supabase as { rpc: jest.Mock }).rpc.mock.calls[0][1])
      .not.toHaveProperty('p_client_representative');
  });
});
