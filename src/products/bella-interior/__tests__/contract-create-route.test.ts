export {};

const repositoryState = {
  project: {
    id: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    code: 'INT-001',
    name: 'Project 1',
    customerId: '123e4567-e89b-42d3-a456-426614174020',
    customerName: 'Client One',
  },
  quotation: {
    id: '123e4567-e89b-42d3-a456-426614174030',
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    projectId: '123e4567-e89b-42d3-a456-426614174000',
    boqId: '123e4567-e89b-42d3-a456-426614174040',
    boqVersionNumber: 1,
    quotationNumber: 'Q-001',
    versionNumber: 1,
    status: 'accepted',
    subtotal: 1000,
    discountAmount: 0,
    vatPercent: 0,
    vatAmount: 0,
    grandTotal: 1000,
    paymentTerms: 'Milestones',
    validityDays: 30,
    createdAt: '2026-11-14T00:00:00.000Z',
  },
  approval: {
    id: '123e4567-e89b-42d3-a456-426614174050',
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    projectId: '123e4567-e89b-42d3-a456-426614174000',
    subjectType: 'quotation',
    subjectId: '123e4567-e89b-42d3-a456-426614174030',
    subjectVersionNumber: 1,
    status: 'approved',
    approvedAt: '2026-11-14T00:00:00.000Z',
  },
  paymentContract: {
    id: '123e4567-e89b-42d3-a456-426614174080',
    tenantId: '123e4567-e89b-42d3-a456-426614174010',
    projectId: '123e4567-e89b-42d3-a456-426614174000',
    status: 'signed',
    milestones: [{
      id: '123e4567-e89b-42d3-a456-426614174081',
      tenantId: '123e4567-e89b-42d3-a456-426614174010',
      contractId: '123e4567-e89b-42d3-a456-426614174080',
      milestoneOrder: 1,
      name: 'Deposit',
      percentage: 100,
      amount: 1000,
      triggerCondition: 'On signature',
      status: 'pending',
      collectedAmount: 0,
    }],
  },
  savedContract: null as unknown,
  savedPayment: null as unknown,
  acceptedQuotations: [] as Record<string, unknown>[],
};

jest.mock('../lib/server-context', () => ({ resolveInteriorContext: jest.fn() }));
jest.mock('@/products/bella-interior/repositories/supabase.repository', () => ({
  SupabaseInteriorRepository: jest.fn().mockImplementation(() => ({
    listQuotationsByProject: jest.fn(async () => repositoryState.acceptedQuotations),
    listCustomerApprovals: jest.fn(async () => [repositoryState.approval]),
    getCustomerApproval: jest.fn(async () => repositoryState.approval),
    getContract: jest.fn(async () => repositoryState.paymentContract),
    savePaymentTransaction: jest.fn(async (_tenantId: string, transaction: unknown) => {
      repositoryState.savedPayment = transaction;
    }),
    getQuotation: jest.fn(async () => repositoryState.quotation),
    getBOQ: jest.fn(async () => ({
      id: repositoryState.quotation.boqId,
      tenantId: repositoryState.quotation.tenantId,
      projectId: repositoryState.quotation.projectId,
      designRevisionId: '123e4567-e89b-42d3-a456-426614174060',
      versionNumber: 1,
    })),
    getDesignRevision: jest.fn(async () => ({
      id: '123e4567-e89b-42d3-a456-426614174060',
      tenantId: repositoryState.quotation.tenantId,
      projectId: repositoryState.quotation.projectId,
      versionNumber: 1,
      status: 'approved',
    })),
    createContractWithMilestones: jest.fn(async (_tenantId: string, contract: unknown) => {
      repositoryState.savedContract = contract;
    }),
  })),
}));

const { resolveInteriorContext } = require('../lib/server-context') as {
  resolveInteriorContext: jest.Mock;
};
const { POST: createContract } = require('@/app/api/interior/contracts/route') as {
  POST: (request: Request) => Promise<Response>;
};

function projectLookupClient() {
  return {
    rpc: jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name !== 'interior_read_project_for_contract'
        || args.p_project_id !== repositoryState.project.id) {
        return { data: null, error: { message: 'unexpected RPC request' } };
      }
      return {
        data: {
          id: repositoryState.project.id,
          code: repositoryState.project.code,
          name: repositoryState.project.name,
          customerId: repositoryState.project.customerId,
          customerName: repositoryState.project.customerName,
        },
        error: null,
      };
    }),
  };
}

describe('Interior contract creation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryState.savedContract = null;
    repositoryState.savedPayment = null;
    repositoryState.acceptedQuotations = [repositoryState.quotation];
    resolveInteriorContext.mockResolvedValue({
      ok: true,
      tenantId: repositoryState.project.tenantId,
      actor: { id: '123e4567-e89b-42d3-a456-426614174070', role: 'pm', full_name: 'Project Manager' },
      supabase: projectLookupClient(),
    });
  });

  it('creates only an unsigned draft from the exact accepted quote and approval evidence', async () => {
    const response = await createContract(new Request('https://bella.example/api/interior/contracts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-contract', projectId: repositoryState.project.id }),
    }));
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({
      quotationId: repositoryState.quotation.id,
      quotationCustomerApprovalId: repositoryState.approval.id,
      boqId: repositoryState.quotation.boqId,
      boqVersionNumber: 1,
      designRevisionId: '123e4567-e89b-42d3-a456-426614174060',
      designVersionNumber: 1,
      status: 'draft',
      signedDate: null,
    }));
    expect(repositoryState.savedContract).toEqual(body.data);
  });

  it('rejects ambiguous accepted quotes without creating a contract', async () => {
    repositoryState.acceptedQuotations = [
      repositoryState.quotation,
      { ...repositoryState.quotation, id: '123e4567-e89b-42d3-a456-426614174031' },
    ];

    const response = await createContract(new Request('https://bella.example/api/interior/contracts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create-contract', projectId: repositoryState.project.id }),
    }));
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('INTERIOR_ACCEPTED_QUOTATION_AMBIGUOUS');
    expect(repositoryState.savedContract).toBeNull();
  });

  it('records a payment as the authenticated Accountant and uses the signed contract scope', async () => {
    resolveInteriorContext.mockResolvedValue({
      ok: true,
      tenantId: repositoryState.project.tenantId,
      actor: { id: '123e4567-e89b-42d3-a456-426614174090', role: 'accountant', full_name: 'Accountant' },
      supabase: projectLookupClient(),
    });

    const response = await createContract(new Request('https://bella.example/api/interior/contracts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'record-payment',
        projectId: repositoryState.project.id,
        contractId: repositoryState.paymentContract.id,
        milestoneId: repositoryState.paymentContract.milestones[0].id,
        paymentAmount: 1000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'BANK-REF-001',
        transactionDate: '2026-11-14',
      }),
    }));
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.recordedBy).toBe('123e4567-e89b-42d3-a456-426614174090');
    expect(repositoryState.savedPayment).toEqual(body.data);
  });

  it('rejects impossible payment calendar dates before persistence', async () => {
    resolveInteriorContext.mockResolvedValue({
      ok: true,
      tenantId: repositoryState.project.tenantId,
      actor: { id: '123e4567-e89b-42d3-a456-426614174090', role: 'accountant', full_name: 'Accountant' },
      supabase: projectLookupClient(),
    });

    const response = await createContract(new Request('https://bella.example/api/interior/contracts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'record-payment',
        projectId: repositoryState.project.id,
        contractId: repositoryState.paymentContract.id,
        milestoneId: repositoryState.paymentContract.milestones[0].id,
        paymentAmount: 100,
        paymentMethod: 'bank_transfer',
        referenceCode: 'BANK-REF-002',
        transactionDate: '2026-02-30',
      }),
    }));
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('INTERIOR_PAYMENT_INPUT_INVALID');
    expect(repositoryState.savedPayment).toBeNull();
  });
});
