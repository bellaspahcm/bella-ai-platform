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

  // G2: Magic bytes mismatch — MIME khai báo nhưng nội dung thực không khớp
  it('G2: rejects a file whose magic bytes do not match its declared MIME type', async () => {
    // Khai báo image/jpeg nhưng nội dung bắt đầu bằng PNG magic bytes
    const pngMagic = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    const fakeJpeg = new File([pngMagic], 'signature.jpg', { type: 'image/jpeg' });
    const form = new FormData();
    form.append('decision', 'approved');
    form.append('signature', fakeJpeg);

    const response = await POST(
      new Request(
        `https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`,
        { method: 'POST', body: form },
      ),
      { params: Promise.resolve({ approvalId: mockApprovalId }) },
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('INTERIOR_HANDOVER_SIGNATURE_INVALID');
    // Magic bytes check must abort before storage upload or RPC call
    expect(mockBucket.upload).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  // G2b: PDF khai báo nhưng nội dung bắt đầu bằng JPEG magic bytes
  it('G2b: rejects a file declared as PDF whose actual content starts with JPEG magic bytes', async () => {
    const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const fakePdf = new File([jpegMagic], 'signature.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.append('decision', 'approved');
    form.append('signature', fakePdf);

    const response = await POST(
      new Request(
        `https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`,
        { method: 'POST', body: form },
      ),
      { params: Promise.resolve({ approvalId: mockApprovalId }) },
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('INTERIOR_HANDOVER_SIGNATURE_INVALID');
    expect(mockBucket.upload).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  // G5: Replay POST khi approval da approved — DB tra canRespond: false
  it('G5: rejects a repeated POST when the approval has already been accepted (canRespond: false)', async () => {
    mockAnonClient.rpc.mockResolvedValueOnce({
      data: {
        approvalId: mockApprovalId,
        tenantId: mockTenantId,
        status: 'approved',
        canRespond: false,
        expiresAt: '2026-12-14T00:00:00.000Z',
        subject: { projectCode: 'INT-001', contractNumber: 'CTR-001' },
      },
      error: null,
    });

    const form = new FormData();
    form.append('decision', 'approved');
    form.append('signature', new File(['%PDF-1.7\nreplay'], 'handover.pdf', { type: 'application/pdf' }));

    const response = await POST(
      new Request(
        `https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${token}`,
        { method: 'POST', body: form },
      ),
      { params: Promise.resolve({ approvalId: mockApprovalId }) },
    );
    const body = await response.json() as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe('INTERIOR_HANDOVER_ACCEPTANCE_NOT_ACTIONABLE');
    // Must not upload signature or call RPC transition on a closed acceptance
    expect(mockBucket.upload).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });

  // G6: approvalId hop le nhung token sai — khong tiet lo thong tin
  it('G6: returns 404 when a valid approvalId is paired with a wrong token, without leaking acceptance details', async () => {
    // DB tra null khi token khong khop
    mockAnonClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    const wrongToken = ['00000000', '0000', '4000', '8000', '000000000099'].join('-');
    const form = new FormData();
    form.append('decision', 'approved');
    form.append('signature', new File(['%PDF-1.7\nwrong'], 'handover.pdf', { type: 'application/pdf' }));

    const response = await POST(
      new Request(
        `https://bella.example/api/interior/delivery/handover/acceptances/${mockApprovalId}?token=${wrongToken}`,
        { method: 'POST', body: form },
      ),
      { params: Promise.resolve({ approvalId: mockApprovalId }) },
    );
    const body = await response.json() as { error: string };

    // Must return 404 — identical to "not found", no info leak about whether approvalId exists
    expect(response.status).toBe(404);
    expect(body.error).toBe('INTERIOR_HANDOVER_ACCEPTANCE_NOT_FOUND');
    expect(mockBucket.upload).not.toHaveBeenCalled();
    expect(mockServiceClient.rpc).not.toHaveBeenCalled();
  });
});
