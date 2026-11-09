import { POST as createHandover } from '@/app/api/interior/delivery/handover/route';
import { GET as readWarranty, POST as createWarrantyTicket } from '@/app/api/interior/delivery/warranty/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

jest.mock('../lib/server-context', () => ({ resolveInteriorContext: jest.fn() }));
jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  interiorMutationRow: (value: unknown): Record<string, unknown> | null =>
    Array.isArray(value) && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
      ? value[0] as Record<string, unknown> : null,
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  validInteriorUuid: (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);
const projectId = '123e4567-e89b-42d3-a456-426614174000';
const certificateId = '123e4567-e89b-42d3-a456-426614174001';

describe('Interior handover and warranty RBAC routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-a',
      actor: { id: 'auth-user-a' },
      supabase: {},
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
  });

  it('creates handover through a project-scoped approval command', async () => {
    const dossier = { id: 'dossier-a', projectId, status: 'completed', clientAccepted: true };
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'HANDOVER_APPROVED', dossier }], error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await createHandover(new Request('https://bella.example/api/interior/delivery/handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, clientRepresentative: 'Client representative' }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_create_handover_dossier', {
      p_project_id: projectId,
      p_client_representative: 'Client representative',
    });
  });

  it('reads warranty certificates through a scoped RPC and preserves database field masking', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: certificateId, tenantId: 'tenant-a', projectId, certificateNumber: 'W-1', effectiveDate: '2026-01-01', expirationDate: '2027-01-01', termsSummary: '24 months' }],
      error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await readWarranty(new Request(`https://bella.example/api/interior/delivery/warranty?projectId=${projectId}`));
    const body = await response.json() as { data: { certificates: Array<Record<string, unknown>> } };

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('interior_list_warranty_certificates', { p_project_id: projectId });
    expect(body.data.certificates[0]?.clientName).toBeNull();
  });

  it('creates warranty tickets without accepting a caller supplied tenant or actor identity', async () => {
    const ticket = {
      id: 'ticket-a', tenantId: 'tenant-a', warrantyId: certificateId, projectId,
      reportedByUserId: 'auth-user-a', reportedByContact: 'Client', ticketNumber: 'WTK-1234567890',
      reportedDate: '2026-11-09T00:00:00.000Z', customerReport: 'Cabinet door is misaligned',
      defectCategory: 'dimensional_error', priority: 'high', status: 'submitted',
    };
    const rpc = jest.fn().mockResolvedValue({
      data: [{ status: 'COMMITTED', reason: 'WARRANTY_TICKET_CREATED', ticket }], error: null,
    });
    rpcClientFactoryMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);

    const response = await createWarrantyTicket(new Request('https://bella.example/api/interior/delivery/warranty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warrantyId: certificateId, projectId, reportedByClientContact: 'Client',
        issueCategory: 'structural', description: 'Cabinet door is misaligned', priority: 'high',
        tenantId: 'tenant-attacker', reportedByUserId: 'user-attacker',
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_create_warranty_ticket', {
      p_certificate_id: certificateId,
      p_project_id: projectId,
      p_reported_by_contact: 'Client',
      p_defect_category: 'dimensional_error',
      p_customer_report: 'Cabinet door is misaligned',
      p_priority: 'high',
    });
  });
});
