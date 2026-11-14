export {};

const mockApprovalId = '123e4567-e89b-42d3-a456-426614174081';
const mockTenantId = '123e4567-e89b-42d3-a456-426614174010';
const mockAnonClient = { rpc: jest.fn() };
const mockBucket = { upload: jest.fn(), remove: jest.fn() };
const mockServiceClient = {
  rpc: jest.fn(),
  storage: { from: jest.fn(() => mockBucket) },
};

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockAnonClient) }));
jest.mock('@/lib/supabase-service-client', () => ({ createServiceClient: jest.fn(() => mockServiceClient) }));
jest.mock('@/lib/supabase-public-env', () => ({
  getSupabasePublicKey: jest.fn(() => 'public-key'),
  getSupabasePublicUrl: jest.fn(() => 'https://database.example'),
}));

const { POST } = require('@/app/api/interior/delivery/handover/acceptances/[approvalId]/route') as {
  POST: (request: Request, context: { params: Promise<{ approvalId: string }> }) => Promise<Response>;
};

const token = ['00000000', '0000', '4000', '8000', '000000000001'].join('-');

describe('Public customer handover acceptance API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnonClient.rpc.mockResolvedValue({
      data: {
        approvalId: mockApprovalId,
        tenantId: mockTenantId,
        status: 'pending',
        canRespond: true,
        expiresAt: '2026-12-14T00:00:00.000Z',
        subject: { projectCode: 'INT-001', contractNumber: 'CTR-001' },
      },
      error: null,
    });
    mockServiceClient.rpc.mockResolvedValue({ data: true, error: null });
    mockBucket.upload.mockResolvedValue({ error: null });
    mockBucket.remove.mockResolvedValue({ error: null });
  });

  it('requires a signature artifact before accepting a handover', async () => {
    const form = new FormData();
    form.append('decision', 'approved');
    const response = await POST(new Request(`https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`, {
      method: 'POST',
      body: form,
    }), { params: Promise.resolve({ approvalId: mockApprovalId }) });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(422);
    expect(body.error).toBe('INTERIOR_HANDOVER_SIGNATURE_REQUIRED');
  });

  it('requires a reason when the customer rejects a handover', async () => {
    const form = new FormData();
    form.append('decision', 'rejected');
    const response = await POST(new Request(`https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`, {
      method: 'POST',
      body: form,
    }), { params: Promise.resolve({ approvalId: mockApprovalId }) });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('INTERIOR_HANDOVER_RESPONSE_INVALID');
  });

  it('stores the customer signature privately and uses its server-computed hash in the transition', async () => {
    const form = new FormData();
    form.append('decision', 'approved');
    form.append('customerNotes', 'Đã nghiệm thu theo hồ sơ bàn giao.');
    form.append('signature', new File(['%PDF-1.7\ncustomer signed handover'], 'handover.pdf', {
      type: 'application/pdf',
    }));

    const response = await POST(new Request(`https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`, {
      method: 'POST',
      body: form,
    }), { params: Promise.resolve({ approvalId: mockApprovalId }) });
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockBucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${mockTenantId}/${mockApprovalId}/[0-9a-f-]+\\.pdf$`)),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
    );
    expect(mockServiceClient.rpc).toHaveBeenCalledWith(
      'interior_transition_public_handover_acceptance',
      expect.objectContaining({
        p_approval_id: mockApprovalId,
        p_approval_token: token,
        p_target_status: 'approved',
        p_signature_mime_type: 'application/pdf',
        p_signature_file_size_bytes: expect.any(Number),
        p_signature_sha256_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_signature_storage_path: expect.stringMatching(new RegExp(`^${mockTenantId}/${mockApprovalId}/`)),
      }),
    );
  });
});
