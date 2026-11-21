import { GET, POST } from '@/app/api/interior/delivery/evidence-deletions/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';
import { createServiceClient } from '@/lib/supabase-service-client';

jest.mock('../lib/server-context', () => ({ resolveInteriorContext: jest.fn() }));
jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  isInteriorRbacRecord: (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v),
  validInteriorUuid: (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
}));
jest.mock('@/lib/supabase-service-client', () => ({ createServiceClient: jest.fn() }));

const projectId = '11111111-1111-4111-8111-111111111111';
const recordId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const payload = { projectId, recordId, kind: 'O4', reason: 'Nhầm tệp', contractReviewReference: 'Hợp đồng đã kiểm tra', contractReviewed: true };
const request = (body: unknown) => new Request('https://bella.example/api/interior/delivery/evidence-deletions', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('evidence deletion request', () => {
  const authorize = jest.fn();
  const rpc = jest.fn();
  const remove = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    authorize.mockResolvedValue({ status: 'ALLOW', reason: 'AUTHORIZED' });
    rpc.mockResolvedValue({ data: requestId, error: null });
    remove.mockResolvedValue({ error: null });
    jest.mocked(createServiceClient).mockReturnValue({ storage: { from: jest.fn(() => ({ remove })) } } as unknown as ReturnType<typeof createServiceClient>);
    jest.mocked(resolveInteriorContext).mockResolvedValue({
      ok: true, tenantId: 'trusted-tenant', actor: { id: 'trusted-actor' }, supabase: {}, authorization: { authorize },
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
    jest.mocked(interiorRbacRpcClient).mockReturnValue({ rpc });
  });

  it('records the contract review and uses the authenticated database context', async () => {
    const result = await POST(request({ ...payload, actorId: 'forged', tenantId: 'forged' }));
    expect(result.status).toBe(201);
    expect(authorize).toHaveBeenCalledWith({ tenantId: 'trusted-tenant', projectId, permissionId: 'interior:evidence:delete' });
    expect(rpc).toHaveBeenCalledWith('interior_request_evidence_deletion', {
      p_kind: 'O4', p_project: projectId, p_record: recordId, p_storage_path: null,
      p_reason: payload.reason, p_contract_review: payload.contractReviewReference, p_contract_confirm: true,
    });
  });

  it('requires an explicit contract check and reference', async () => {
    const result = await POST(request({ ...payload, contractReviewed: false }));
    expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a project-scoped denial before any write', async () => {
    authorize.mockResolvedValue({ status: 'DENY', reason: 'NO_GRANT' });
    const result = await POST(request(payload));
    expect(result.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the request RPC fails', async () => {
    rpc.mockRejectedValue(new Error('DB unavailable'));
    const result = await POST(request(payload));
    expect(result.status).toBe(503);
  });

  it('removes Storage before finalizing an authorized request', async () => {
    rpc.mockImplementation(async (name: string) => name === 'interior_prepare_evidence_deletion'
      ? { data: { requestId, status: 'DELETE_PENDING', mode: 'DELETE_OBJECT', tenantId: 'trusted-tenant', projectId,
        bucketId: 'interior-site-evidence', storagePath: `trusted-tenant/${projectId}/acceptance/file.pdf`, objectPresent: true }, error: null }
      : { data: null, error: null });
    const result = await POST(request({ action: 'execute', projectId, requestId, contractReviewed: true }));
    expect(result.status).toBe(200);
    expect(remove).toHaveBeenCalledWith([`trusted-tenant/${projectId}/acceptance/file.pdf`]);
    const finishIndex = rpc.mock.calls.findIndex((call) => call[0] === 'interior_finish_evidence_deletion');
    expect(finishIndex).toBeGreaterThanOrEqual(0);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[finishIndex]);
  });

  it('marks a Storage failure and does not finalize metadata', async () => {
    rpc.mockImplementation(async (name: string) => name === 'interior_prepare_evidence_deletion'
      ? { data: { requestId, status: 'DELETE_PENDING', mode: 'DELETE_OBJECT', tenantId: 'trusted-tenant', projectId,
        bucketId: 'interior-site-evidence', storagePath: `trusted-tenant/${projectId}/acceptance/file.pdf`, objectPresent: true }, error: null }
      : { data: null, error: null });
    remove.mockResolvedValue({ error: { message: 'Storage down' } });
    const result = await POST(request({ action: 'execute', projectId, requestId, contractReviewed: true }));
    expect(result.status).toBe(503);
    expect(rpc).toHaveBeenCalledWith('interior_fail_evidence_deletion', { p_request: requestId, p_project: projectId, p_stage: 'STORAGE' });
    expect(rpc).not.toHaveBeenCalledWith('interior_finish_evidence_deletion', expect.anything());
  });

  it('records finalization failure after Storage succeeded', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'interior_prepare_evidence_deletion') return { data: {
        requestId, status: 'DELETE_PENDING', mode: 'DELETE_OBJECT', tenantId: 'trusted-tenant', projectId,
        bucketId: 'interior-site-evidence', storagePath: `trusted-tenant/${projectId}/acceptance/file.pdf`, objectPresent: true,
      }, error: null };
      return name === 'interior_finish_evidence_deletion' ? { data: null, error: { message: 'DB down' } } : { data: null, error: null };
    });
    const result = await POST(request({ action: 'execute', projectId, requestId, contractReviewed: true }));
    expect(result.status).toBe(503);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('interior_fail_evidence_deletion', { p_request: requestId, p_project: projectId, p_stage: 'FINALIZE' });
  });

  it('preserves a shared object and completes only the reference', async () => {
    rpc.mockImplementation(async (name: string) => name === 'interior_prepare_evidence_deletion'
      ? { data: { requestId, status: 'DELETE_PENDING', mode: 'KEEP_OBJECT', tenantId: 'trusted-tenant', projectId,
        bucketId: 'interior-site-evidence', storagePath: `trusted-tenant/${projectId}/acceptance/file.pdf`, objectPresent: true }, error: null }
      : { data: null, error: null });
    const result = await POST(request({ action: 'execute', projectId, requestId, contractReviewed: true }));
    expect(result.status).toBe(200);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('interior_finish_evidence_deletion', { p_request: requestId, p_project: projectId });
  });

  it('resolves O3 photo identity from the scoped diary rather than a supplied storage path', async () => {
    rpc.mockImplementation(async (name: string) => name === 'interior_list_site_diaries'
      ? { data: [{ id: recordId, projectId, tenantId: 'trusted-tenant', photoUrls: [`trusted-tenant/${projectId}/diary/photo.jpg`] }], error: null }
      : { data: requestId, error: null });
    const result = await POST(request({ ...payload, kind: 'O3', photoIndex: 0, storagePath: 'forged/path' }));
    expect(result.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('interior_request_evidence_deletion', expect.objectContaining({
      p_storage_path: `trusted-tenant/${projectId}/diary/photo.jpg`,
    }));
  });

  it('lists pending requests only after the project permission check', async () => {
    rpc.mockResolvedValue({ data: [{ requestId, status: 'DELETE_PENDING' }], error: null });
    const result = await GET(new Request(`https://bella.example/api/interior/delivery/evidence-deletions?projectId=${projectId}`));
    expect(result.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith({ tenantId: 'trusted-tenant', projectId, permissionId: 'interior:evidence:delete' });
    expect(rpc).toHaveBeenCalledWith('interior_list_evidence_deletion_requests', { p_project: projectId });
  });
});
