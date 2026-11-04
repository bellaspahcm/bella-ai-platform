/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

type AuthResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};
type SessionResult = {
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
};
type ProfileResult = { data: unknown; error: { code?: string; message: string } | null };

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const enrollmentId = '10000000-0000-4000-8000-000000000003';
const admin: CurrentActorProfileRow = {
  id: actorId,
  tenant_id: tenantId,
  tenant_status: 'active',
  status: 'active',
  role: 'admin',
  email: 'admin@example.test',
  full_name: 'Admin User',
  avatar_url: null,
};

const mockGetSession = jest.fn<() => Promise<SessionResult>>();
const mockGetUser = jest.fn<(token?: string) => Promise<AuthResult>>();
const mockRpc = jest.fn<(name: string, args?: unknown) => Promise<ProfileResult>>();
const mockFrom = jest.fn();
const mockCreateClient = jest.fn<() => Promise<{
  auth: { getSession: typeof mockGetSession; getUser: typeof mockGetUser };
  rpc: typeof mockRpc;
  from: typeof mockFrom;
}>>();

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));

const { POST } = require('../route') as typeof import('../route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/education/enrollments/confirm-admission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Admission confirmation remains fail-closed without an atomic persistence contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-token' } }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [admin], error: null });
    mockCreateClient.mockResolvedValue({
      auth: { getSession: mockGetSession, getUser: mockGetUser },
      rpc: mockRpc,
      from: mockFrom,
    });
  });

  it.each([
    ['omitted mode', { enrollmentId }],
    ['DEBT mode', { enrollmentId, admissionMode: 'DEBT' }],
  ])('does not report %s as successful or persist partial records', async (_label, payload) => {
    const response = await POST(postRequest(payload));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'ADMISSION_CONFIRMATION_UNAVAILABLE',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    ['cash', { method: 'CASH', amount: 100, receivedAt: '2026-11-02T09:00:00+07:00' }],
    ['manual bank transfer', {
      method: 'BANK_TRANSFER_MANUAL',
      amount: 100,
      receivedAt: '2026-11-02T09:00:00+07:00',
      transactionId: 'bank-ref-1',
    }],
  ])('keeps %s PAID admission fail-closed even with syntactically valid evidence', async (_label, paymentConfirmation) => {
    const response = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'ADMISSION_CONFIRMATION_UNAVAILABLE',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects PAID without evidence and automated reconciliation submitted by an Admin', async () => {
    const missingEvidence = await POST(postRequest({ enrollmentId, admissionMode: 'PAID' }));
    expect(missingEvidence.status).toBe(400);
    expect(await missingEvidence.json()).toMatchObject({ success: false, error: 'PAYMENT_EVIDENCE_REQUIRED' });

    const automated = await POST(postRequest({
      enrollmentId,
      admissionMode: 'PAID',
      paymentConfirmation: { method: 'BANK_TRANSFER_AUTO' },
    }));
    expect(automated.status).toBe(403);
    expect(await automated.json()).toMatchObject({ success: false, error: 'AUTOMATED_RECONCILIATION_ONLY' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
