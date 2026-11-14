export {};

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000';
const TENANT_ID = '123e4567-e89b-42d3-a456-426614174010';
const CONTRACT_ID = '123e4567-e89b-42d3-a456-426614174020';
const ADDENDUM_ID = '123e4567-e89b-42d3-a456-426614174030';
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

  it('shows canonical addendum rows only through the finance-scoped contract read model', async () => {
    mockRpc.mockResolvedValue({
      data: {
        hasContract: true,
        financeAccess: true,
        project: { id: PROJECT_ID, code: 'INT-001', name: 'Project 1' },
        contract: {
          id: CONTRACT_ID,
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: '123e4567-e89b-42d3-a456-426614174040',
          quotationVersionNumber: 1,
          contractNumber: 'CTR-001',
          title: 'Contract 1',
          status: 'active',
          baselineContractValue: 100000,
          currentContractValue: 110000,
          signedDate: '2026-11-01',
          contractorRepresentative: 'Bella Interior',
          clientRepresentative: 'Customer 1',
          milestones: [],
          addenda: [{
            id: ADDENDUM_ID,
            tenantId: TENANT_ID,
            contractId: CONTRACT_ID,
            addendumNumber: 'ADD-001',
            title: 'Thay đổi vật liệu',
            valueDelta: 10000,
            reason: 'Khách hàng chọn vật liệu mới',
            status: 'approved',
            approvalEvidenceStatus: 'unverified',
            proposedPaymentSchedule: [],
            createdAt: '2026-11-02T00:00:00.000Z',
          }],
        },
      },
      error: null,
    });

    const response = await GET(new Request(`https://bella.example/api/interior/contracts?projectId=${PROJECT_ID}`));
    const body = await response.json() as {
      success: boolean;
      data: { overview: { detailedTabs: { addenda: Array<Record<string, unknown>> } } };
    };

    expect(response.status).toBe(200);
    expect(body.data.overview.detailedTabs.addenda).toEqual([expect.objectContaining({
      id: ADDENDUM_ID,
      title: 'Thay đổi vật liệu',
      reason: 'Khách hàng chọn vật liệu mới',
      status: 'legacy_unverified',
      statusLabel: 'Chưa xác minh chấp thuận',
    })]);
    expect(mockRpc).toHaveBeenCalledWith('interior_read_contract_project', { p_project_id: PROJECT_ID });
  });

  it('does not return addendum or finance details to an actor without project Finance Read', async () => {
    mockAuthorize.mockImplementation(async ({ permissionId }: { permissionId: string }) => ({
      status: permissionId === 'interior:finance:read' ? 'DENY' : 'ALLOW',
      reason: permissionId === 'interior:finance:read' ? 'NO_GRANT' : 'AUTHORIZED',
    }));
    mockRpc.mockResolvedValue({
      data: {
        hasContract: true,
        financeAccess: false,
        project: { id: PROJECT_ID, code: 'INT-001', name: 'Project 1' },
        contract: {
          id: CONTRACT_ID,
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: '123e4567-e89b-42d3-a456-426614174040',
          quotationVersionNumber: 1,
          contractNumber: 'CTR-001',
          title: 'Contract 1',
          status: 'active',
          signedDate: null,
          clientRepresentative: 'Customer 1',
        },
      },
      error: null,
    });

    const response = await GET(new Request(`https://bella.example/api/interior/contracts?projectId=${PROJECT_ID}`));
    const body = await response.json() as { data: { overview: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(body.data.overview.financeAccess).toBe(false);
    expect(body.data.overview).not.toHaveProperty('detailedTabs');
    expect(body.data.overview).not.toHaveProperty('addenda');
  });
});
