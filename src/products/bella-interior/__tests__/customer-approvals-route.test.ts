export {};

const routeState = {
  project: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    code: 'INT-001',
    name: 'Project 1',
    customerId: '123e4567-e89b-42d3-a456-426614174020',
    customerName: 'Client One',
    customerPhone: '+84901234567',
  },
  quotation: {
    id: '123e4567-e89b-42d3-a456-426614174030',
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    projectId: '123e4567-e89b-42d3-a456-426614174000',
    versionNumber: 2,
    status: 'draft',
  },
  savedApproval: null as Record<string, unknown> | null,
};

jest.mock('../lib/server-context', () => ({ resolveInteriorContext: jest.fn() }));
jest.mock('@/products/bella-interior/repositories/supabase.repository', () => ({
  SupabaseInteriorRepository: jest.fn().mockImplementation(() => ({
    getQuotation: jest.fn(async () => routeState.quotation),
    getContractForCustomerApproval: jest.fn(async () => null),
    saveCustomerApproval: jest.fn(async (_tenantId: string, approval: Record<string, unknown>) => {
      routeState.savedApproval = approval;
    }),
    listCustomerApprovals: jest.fn(async () => []),
  })),
}));

const { resolveInteriorContext } = require('../lib/server-context') as {
  resolveInteriorContext: jest.Mock;
};
const { POST: sendCustomerApproval } = require('@/app/api/interior/customer-approvals/route') as {
  POST: (request: Request) => Promise<Response>;
};

describe('Interior customer approval request API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routeState.savedApproval = null;
    resolveInteriorContext.mockResolvedValue({
      ok: true,
      tenantId: '123e4567-e89b-42d3-a456-426614174010',
      actor: { id: '123e4567-e89b-42d3-a456-426614174070', role: 'pm', full_name: 'Project Manager' },
      supabase: {
        rpc: jest.fn(async (name: string, args: Record<string, unknown>) => {
          if (name !== 'interior_read_project_for_contract'
            || args.p_project_id !== routeState.project.id) {
            return { data: null, error: { message: 'unexpected RPC request' } };
          }
          return { data: routeState.project, error: null };
        }),
      },
    });
  });

  it('uses the persisted customer contact and exact quotation version to create a bearer endpoint', async () => {
    const response = await sendCustomerApproval(new Request('https://bella.example/api/interior/customer-approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: routeState.project.id,
        subjectType: 'quotation',
        subjectId: routeState.quotation.id,
        subjectVersionNumber: routeState.quotation.versionNumber,
        clientContact: '+84999999999',
      }),
    }));
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({
      subjectType: 'quotation',
      subjectId: routeState.quotation.id,
      subjectVersionNumber: 2,
      status: 'pending',
    }));
    expect(body.data.customerApprovalEndpoint).toEqual(expect.stringMatching(
      /^\/api\/interior\/customer-approvals\/[0-9a-f-]+\?token=[0-9a-f-]+$/,
    ));
    expect(routeState.savedApproval).toEqual(expect.objectContaining({
      projectId: routeState.project.id,
      clientRepresentative: routeState.project.customerName,
      clientContact: routeState.project.customerPhone,
      subjectVersionNumber: routeState.quotation.versionNumber,
      sentByActorId: '123e4567-e89b-42d3-a456-426614174070',
    }));
  });

  it('rejects a request scoped to a different project before persisting', async () => {
    const response = await sendCustomerApproval(new Request('https://bella.example/api/interior/customer-approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: '123e4567-e89b-42d3-a456-426614174099',
        subjectType: 'quotation',
        subjectId: routeState.quotation.id,
      }),
    }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('INTERIOR_APPROVAL_SUBJECT_VERSION_MISMATCH');
    expect(routeState.savedApproval).toBeNull();
  });
});
