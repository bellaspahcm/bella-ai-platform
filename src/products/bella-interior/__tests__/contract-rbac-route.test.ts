import { GET as readContract } from '@/app/api/interior/contracts/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

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
jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  validInteriorUuid: (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);
const authorizationAuthorizeMock = jest.fn(async ({ permissionId }: { permissionId: string }) => ({
  status: 'ALLOW',
  reason: 'AUTHORIZED',
}));
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const contract = {
  id: '123e4567-e89b-42d3-a456-426614174001', tenantId: 'tenant-a', projectId,
  quotationId: '123e4567-e89b-42d3-a456-426614174002', quotationVersionNumber: 1, contractNumber: 'C-001',
  title: 'Interior fitout', status: 'signed', baselineContractValue: 100000,
  currentContractValue: 100000, signedDate: '2026-11-01T00:00:00.000Z',
  clientRepresentative: 'Client', contractorRepresentative: 'Owner',
  milestones: [{ id: 'milestone-1', tenantId: 'tenant-a', contractId: '123e4567-e89b-42d3-a456-426614174001',
    milestoneOrder: 1, name: 'Deposit', percentage: 30, amount: 30000,
    triggerCondition: 'On signature', status: 'paid', dueDate: null, paidAt: null }],
  addenda: [],
};

describe('Interior contract read RBAC route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authorizationAuthorizeMock.mockImplementation(async () => ({ status: 'ALLOW', reason: 'AUTHORIZED' }));
    resolveContextMock.mockResolvedValue({
      ok: true, tenantId: 'tenant-a', actor: { id: 'auth-user-a' }, supabase: {},
      authorization: { authorize: authorizationAuthorizeMock },
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('returns financial overview only when the scoped RPC confirms finance access and keeps release fail-closed', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: {
      hasContract: true, financeAccess: true,
      project: { id: projectId, code: 'INT-001', name: 'Project 1' },
      contract,
    }, error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readContract(new Request(`https://bella.example/api/interior/contracts?projectId=${projectId}`));
    const body = await response.json() as { data: { overview: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_read_contract_project', { p_project_id: projectId });
    expect(body.data.overview).toEqual(expect.objectContaining({ hasContract: true, financeAccess: true }));
    expect((body.data.overview['workflowCommands'] as Record<string, unknown>).releaseProductionAvailable).toBe(false);
    expect(((body.data.overview['workshopReleaseGating'] as Record<string, unknown>).isEligible)).toBe(false);
  });

  it('returns only non-financial contract summary when the RPC masks finance fields', async () => {
    authorizationAuthorizeMock.mockImplementation(async ({ permissionId }) => ({
      status: permissionId === 'interior:finance:read' ? 'DENY' : 'ALLOW',
      reason: permissionId === 'interior:finance:read' ? 'NO_GRANT' : 'AUTHORIZED',
    }));
    const rpc = jest.fn().mockResolvedValue({ data: {
      hasContract: true, financeAccess: false,
      project: { id: projectId, code: 'INT-001', name: 'Project 1' },
      contract: { ...contract, baselineContractValue: undefined, currentContractValue: undefined, milestones: [], clientRepresentative: null },
    }, error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readContract(new Request(`https://bella.example/api/interior/contracts?projectId=${projectId}`));
    const body = await response.json() as { data: { overview: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(body.data.overview).toEqual(expect.objectContaining({
      hasContract: true,
      financeAccess: false,
      contractSummary: expect.objectContaining({ contractNumber: 'C-001', clientRepresentative: null }),
    }));
    expect(body.data.overview).not.toHaveProperty('kpis');
    expect((body.data.overview['workflowCommands'] as Record<string, unknown>).createQuotationAvailable).toBe(false);
  });

  it('supports unsigned contracts with no finance fields and keeps the UI release gate closed', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: {
      hasContract: true, financeAccess: true,
      project: { id: projectId, code: 'INT-001', name: 'Project 1' },
      contract: {
        ...contract, status: 'draft', signedDate: null,
        baselineContractValue: '0', currentContractValue: '0', milestones: [],
      },
    }, error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readContract(new Request(`https://bella.example/api/interior/contracts?projectId=${projectId}`));
    const body = await response.json() as { data: { overview: Record<string, unknown> } };

    expect(response.status).toBe(200);
    expect(body.data.overview).toEqual(expect.objectContaining({ hasContract: true, financeAccess: true }));
    expect((body.data.overview['workflowCommands'] as Record<string, unknown>).releaseProductionAvailable).toBe(false);
    expect((body.data.overview['detailedTabs'] as { info: { signedDateFormatted: string } }).info.signedDateFormatted).toBe('Chưa ký');
  });

  it('rejects missing financial values instead of coercing null to zero', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: {
      hasContract: true, financeAccess: true,
      project: { id: projectId, code: 'INT-001', name: 'Project 1' },
      contract: { ...contract, baselineContractValue: null },
    }, error: null });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readContract(new Request(`https://bella.example/api/interior/contracts?projectId=${projectId}`));

    expect(response.status).toBe(503);
  });
});
