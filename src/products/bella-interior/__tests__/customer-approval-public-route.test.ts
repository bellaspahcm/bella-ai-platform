export {};

const mockApprovalView: Record<string, unknown> = {
  approvalId: '123e4567-e89b-42d3-a456-426614174050',
  tenantId: '123e4567-e89b-42d3-a456-426614174010',
  subjectType: 'quotation',
  status: 'pending',
  expiresAt: '2026-12-01T00:00:00.000Z',
  canRespond: true,
  clientRepresentative: 'Client One',
  subject: { quotationNumber: 'QT-001', grandTotal: 1200000, items: [] },
};

const mockAnonymousRpc = jest.fn();
const mockServiceRpc = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateServiceClient = jest.fn();

const mockAnonymousClient = { rpc: mockAnonymousRpc };
const mockStorageBucket = { upload: mockUpload, remove: mockRemove };
const mockServiceClient = {
  rpc: mockServiceRpc,
  storage: { from: jest.fn(() => mockStorageBucket) },
};

jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));
jest.mock('@/lib/supabase-service-client', () => ({ createServiceClient: () => mockCreateServiceClient() }));
jest.mock('@/lib/supabase-public-env', () => ({
  getSupabasePublicKey: () => 'test-anon-key',
  getSupabasePublicUrl: () => 'https://supabase.example.test',
}));

const { GET, POST } = require('@/app/api/interior/customer-approvals/[approvalId]/route') as {
  GET: (request: Request, context: { params: Promise<{ approvalId: string }> }) => Promise<Response>;
  POST: (request: Request, context: { params: Promise<{ approvalId: string }> }) => Promise<Response>;
};

const APPROVAL_ID = '123e4567-e89b-42d3-a456-426614174050';
const APPROVAL_TOKEN = ['00000000', '0000', '4000', '8000', '000000000002'].join('-');
const APPROVAL_URL = `https://bella.example/api/interior/customer-approvals/${APPROVAL_ID}?token=${APPROVAL_TOKEN}`;
const context = { params: Promise.resolve({ approvalId: APPROVAL_ID }) };

describe('Interior public customer approval API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockApprovalView, {
      tenantId: '123e4567-e89b-42d3-a456-426614174010',
      subjectType: 'quotation',
      canRespond: true,
      subject: { quotationNumber: 'QT-001', grandTotal: 1200000, items: [] },
    });
    mockCreateClient.mockReturnValue(mockAnonymousClient);
    mockCreateServiceClient.mockReturnValue(mockServiceClient);
    mockAnonymousRpc.mockImplementation(async (name: string) => {
      if (name === 'interior_read_public_customer_approval') return { data: mockApprovalView, error: null };
      if (name === 'interior_transition_public_customer_approval') return { data: true, error: null };
      return { data: null, error: { message: 'unexpected anon RPC' } };
    });
    mockServiceRpc.mockResolvedValue({ data: true, error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
  });

  it('returns only customer-safe approval data and prevents caching/referrer leakage', async () => {
    const response = await GET(new Request(APPROVAL_URL), context);
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({
      approvalId: APPROVAL_ID,
      subjectType: 'quotation',
      subject: mockApprovalView.subject,
    }));
    expect(body.data).not.toHaveProperty('tenantId');
    expect(body.data).not.toHaveProperty('approvalToken');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('records a quotation decision through the single-use anonymous capability RPC', async () => {
    const form = new FormData();
    form.set('decision', 'approved');
    form.set('customerNotes', 'Đồng ý báo giá phiên bản này');
    const response = await POST(new Request(APPROVAL_URL, { method: 'POST', body: form }), context);
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ approvalId: APPROVAL_ID, status: 'approved' });
    expect(mockAnonymousRpc).toHaveBeenCalledWith('interior_transition_public_customer_approval', expect.objectContaining({
      p_approval_id: APPROVAL_ID,
      p_approval_token: APPROVAL_TOKEN,
      p_target_status: 'approved',
      p_customer_notes: 'Đồng ý báo giá phiên bản này',
      p_signature_storage_path: null,
    }));
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it('hashes and privately uploads contract signature bytes before asking the database to sign', async () => {
    Object.assign(mockApprovalView, { subjectType: 'contract' });
    const signatureBytes = Buffer.from('%PDF-1.7\ncustomer signature evidence');
    const form = new FormData();
    form.set('decision', 'approved');
    form.set('signature', new File([signatureBytes], 'signed-contract.pdf', { type: 'application/pdf' }));

    const response = await POST(new Request(APPROVAL_URL, { method: 'POST', body: form }), context);
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };
    const uploadCall = mockUpload.mock.calls[0] as [string, Buffer, { contentType: string; upsert: boolean }];

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ approvalId: APPROVAL_ID, status: 'approved' });
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
    expect(mockServiceClient.storage.from).toHaveBeenCalledWith('interior-customer-signatures');
    expect(uploadCall[0]).toMatch(/^123e4567-e89b-42d3-a456-426614174010\/123e4567-e89b-42d3-a456-426614174050\/[0-9a-f-]+\.pdf$/);
    expect(uploadCall[1]).toEqual(signatureBytes);
    expect(uploadCall[2]).toEqual({ contentType: 'application/pdf', upsert: false });
    expect(mockServiceRpc).toHaveBeenCalledWith('interior_transition_public_customer_approval', expect.objectContaining({
      p_target_status: 'approved',
      p_signature_storage_path: uploadCall[0],
      p_signature_mime_type: 'application/pdf',
      p_signature_file_size_bytes: signatureBytes.length,
      p_signature_sha256_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('rejects a contract signature whose bytes do not match its declared media type', async () => {
    Object.assign(mockApprovalView, { subjectType: 'contract' });
    const form = new FormData();
    form.set('decision', 'approved');
    form.set('signature', new File(['not a PDF'], 'signed-contract.pdf', { type: 'application/pdf' }));

    const response = await POST(new Request(APPROVAL_URL, { method: 'POST', body: form }), context);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('INTERIOR_SIGNATURE_FILE_INVALID');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockServiceRpc).not.toHaveBeenCalled();
  });

  it('caps streamed request bytes even when Content-Length is absent', async () => {
    const oversizedBody = new Uint8Array((5 * 1024 * 1024) + (64 * 1024) + 1);
    const response = await POST(new Request(APPROVAL_URL, {
      method: 'POST',
      body: oversizedBody,
    }), context);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(413);
    expect(body.error).toBe('INTERIOR_SIGNATURE_FILE_TOO_LARGE');
    expect(mockAnonymousRpc).not.toHaveBeenCalled();
  });

  it('removes a signature upload if the atomic database transition fails', async () => {
    Object.assign(mockApprovalView, { subjectType: 'contract' });
    mockServiceRpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
    const signatureBytes = Buffer.from('%PDF-1.7\ncustomer signature evidence');
    const form = new FormData();
    form.set('decision', 'approved');
    form.set('signature', new File([signatureBytes], 'signed-contract.pdf', { type: 'application/pdf' }));

    const response = await POST(new Request(APPROVAL_URL, { method: 'POST', body: form }), context);
    const body = await response.json() as { error: string };
    const uploadCall = mockUpload.mock.calls[0] as [string];

    expect(response.status).toBe(503);
    expect(body.error).toBe('INTERIOR_CUSTOMER_APPROVAL_PERSISTENCE_FAILED');
    expect(mockRemove).toHaveBeenCalledWith([uploadCall[0]]);
  });
});
