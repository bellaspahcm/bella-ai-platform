/**
 * BELLA INTERIOR OS — Warranty Certificate Issuance Route Tests
 *
 * Tests validation, D13 guards, and RPC integration for POST /api/interior/warranty/issue.
 */

import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { POST } from '@/app/api/interior/warranty/issue/route';
import { resolveInteriorContext } from '../lib/server-context';
import { interiorRbacRpcClient } from '../lib/rbac-api';

jest.mock('../lib/server-context', () => ({
  resolveInteriorContext: jest.fn(),
}));

jest.mock('../lib/rbac-api', () => ({
  interiorRbacRpcClient: jest.fn(),
  isInteriorRbacRecord: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  validInteriorUuid: (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
}));

const resolveContextMock = jest.mocked(resolveInteriorContext);
const rpcClientFactoryMock = jest.mocked(interiorRbacRpcClient);

const VALID_CERT_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID = 'tenant-bella-interior-001';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/interior/warranty/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/interior/warranty/issue', () => {
  const mockRpc = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resolveContextMock.mockResolvedValue({
      ok: true,
      tenantId: TENANT_ID,
      actor: { id: 'user-001', full_name: 'Interior Manager', email: 'manager@example.invalid' },
      supabase: {} as unknown as SupabaseClient<Database>,
    } as unknown as Awaited<ReturnType<typeof resolveInteriorContext>>);
    rpcClientFactoryMock.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof interiorRbacRpcClient>);
  });

  it('rejects missing certificateId', async () => {
    const req = makeRequest({ warrantySnapshot: { terms: 'standard' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/certificateId/i);
  });

  it('rejects non-UUID certificateId', async () => {
    const req = makeRequest({ certificateId: 'not-a-uuid', warrantySnapshot: { terms: 'ok' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
  });

  it('rejects empty warrantySnapshot', async () => {
    const req = makeRequest({ certificateId: VALID_CERT_ID, warrantySnapshot: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/warrantySnapshot/i);
  });

  it('rejects missing warrantySnapshot', async () => {
    const req = makeRequest({ certificateId: VALID_CERT_ID });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('calls rpc_issue_interior_warranty with correct params on valid input', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        id: VALID_CERT_ID,
        certificate_number: 'WC-2024-999',
        warranty_terms_status: 'ISSUED',
        issued_at: '2026-11-22T00:00:00Z',
        issued_by_id: 'user-001',
      }],
      error: null,
    });

    const req = makeRequest({
      certificateId: VALID_CERT_ID,
      warrantySnapshot: { contractId: 'cid-001', issuedVia: 'test', issuedAt: '2026-11-22T00:00:00Z' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { certificateNumber: string } };
    expect(json.success).toBe(true);
    expect(json.data.certificateNumber).toBe('WC-2024-999');

    expect(mockRpc).toHaveBeenCalledWith('rpc_issue_interior_warranty', {
      p_tenant_id: TENANT_ID,
      p_certificate_id: VALID_CERT_ID,
      p_warranty_snapshot: expect.objectContaining({ contractId: 'cid-001' }),
    });
  });

  it('returns 403 when RPC returns AuthorizationViolation', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'AuthorizationViolation: insufficient permission' },
    });

    const req = makeRequest({
      certificateId: VALID_CERT_ID,
      warrantySnapshot: { terms: 'ok', issuedAt: new Date().toISOString() },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('INTERIOR_PERMISSION_DENIED');
  });

  it('returns 422 when D13 guard blocks issuance', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'guard_interior_warranty_certificate_issuance: handover not completed' },
    });

    const req = makeRequest({
      certificateId: VALID_CERT_ID,
      warrantySnapshot: { terms: 'ok', issuedAt: new Date().toISOString() },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe('INTERIOR_WARRANTY_ISSUANCE_GUARD_FAILED');
  });

  it('returns 503 when RPC returns no data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const req = makeRequest({
      certificateId: VALID_CERT_ID,
      warrantySnapshot: { terms: 'standard', issuedAt: new Date().toISOString() },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
  });
});
