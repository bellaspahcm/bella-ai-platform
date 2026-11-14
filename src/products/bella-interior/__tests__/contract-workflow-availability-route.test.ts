export {};

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000';
const TENANT_ID = '123e4567-e89b-42d3-a456-426614174010';
const mockAuthorize = jest.fn();
const mockRpc = jest.fn();

jest.mock('../lib/server-context', () => ({
  INTERIOR_PERMISSIONS: {
    boqRead: 'interior:boq:read',
    financeRead: 'interior:finance:read',
    contractCreate: 'interior:contract:create',
    contractWrite: 'interior:contract:write',
    paymentRecord: 'interior:payment:record',
    contractAmend: 'interior:contract:amend',
  },
  resolveInteriorContext: jest.fn(),
}));

const { resolveInteriorContext } = require('../lib/server-context') as {
  resolveInteriorContext: jest.Mock;
};
const { GET } = require('@/app/api/interior/contracts/route') as {
  GET: (request: Request) => Promise<Response>;
};

describe('Interior contract workflow availability API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: {
        hasContract: false,
        financeAccess: true,
        project: { id: PROJECT_ID, code: 'INT-001', name: 'Project 1' },
      },
      error: null,
    });
    mockAuthorize.mockImplementation(async ({ permissionId, projectId }: { permissionId: string; projectId: string }) => ({
      status: projectId === PROJECT_ID && permissionId !== 'interior:contract:amend' ? 'ALLOW' : 'DENY',
      reason: permissionId === 'interior:contract:amend' ? 'NO_GRANT' : 'AUTHORIZED',
    }));
    resolveInteriorContext.mockResolvedValue({
      ok: true,
      tenantId: TENANT_ID,
      actor: { id: '123e4567-e89b-42d3-a456-426614174070', role: 'sales', full_name: 'Sales User' },
      supabase: { rpc: mockRpc },
      authorization: { authorize: mockAuthorize },
    });
  });

  it('exposes only project-scoped capabilities granted to the current actor', async () => {
    const response = await GET(new Request(`https://bella.example/api/interior/contracts?projectId=${PROJECT_ID}`));
    const body = await response.json() as { success: boolean; data: { overview: { workflowCommands: Record<string, boolean> } } };

    expect(response.status).toBe(200);
    expect(body.data.overview.workflowCommands).toEqual({
      createQuotationAvailable: true,
      requestCustomerApprovalAvailable: true,
      createContractAvailable: true,
      recordPaymentAvailable: true,
      createAddendumAvailable: false,
      releaseProductionAvailable: false,
    });
    expect(mockAuthorize).toHaveBeenCalledTimes(6);
    expect(mockAuthorize.mock.calls.every(([input]) => input.projectId === PROJECT_ID && input.tenantId === TENANT_ID)).toBe(true);
  });

  it('fails closed when the authorization resolver cannot prove permission', async () => {
    mockAuthorize.mockResolvedValue({ status: 'UNAVAILABLE', reason: 'RESOLVER_UNAVAILABLE' });

    const response = await GET(new Request(`https://bella.example/api/interior/contracts?projectId=${PROJECT_ID}`));
    const body = await response.json() as { data: { overview: { workflowCommands: Record<string, boolean> } } };

    expect(response.status).toBe(200);
    expect(body.data.overview.workflowCommands.createQuotationAvailable).toBe(false);
    expect(body.data.overview.workflowCommands.requestCustomerApprovalAvailable).toBe(false);
    expect(body.data.overview.workflowCommands.createContractAvailable).toBe(false);
    expect(body.data.overview.workflowCommands.recordPaymentAvailable).toBe(false);
  });
});
