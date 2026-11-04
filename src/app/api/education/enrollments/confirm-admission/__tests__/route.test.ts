import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

type AuthResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};
type ProfileResult = { data: unknown; error: { code?: string; message: string } | null };

const mockGetUser = jest.fn<(token?: string) => Promise<AuthResult>>();
const mockGetSession = jest.fn<() => Promise<{
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
}>>();
const mockRpc = jest.fn<(name: string, args?: unknown) => Promise<ProfileResult>>();

const callerClient = {
  auth: { getUser: mockGetUser, getSession: mockGetSession },
  rpc: mockRpc,
};

const mockCreateClient = jest.fn<() => Promise<typeof callerClient>>();
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-role-key',
  requireSupabaseAdminEnv: () => ({ url: 'https://mock.supabase.co', adminKey: 'mock-service-role-key' }),
}));

const mockAdminFrom = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
  })),
}));

const { POST } = require('../route') as typeof import('../route');

const tenantId = 'ed100000-0000-4000-8000-000000000001';
const adminActorId = 'ad6899c2-4b9d-49af-acb3-69e2e1d11447';
const teacherActorId = 'tea6899c2-4b9d-49af-acb3-69e2e1d11448';
const enrollmentId = 'ea000001-0000-4000-8000-000000000001';
const courseId = 'ca000001-0000-4000-8000-000000000001';
const studentPartyId = 'fa000001-0000-4000-8000-000000000001';

const adminActor: CurrentActorProfileRow = {
  id: adminActorId,
  tenant_id: tenantId,
  tenant_status: 'active',
  status: 'active',
  role: 'admin',
  email: 'admin@example.test',
  full_name: 'Admin User',
  avatar_url: null,
};

const teacherActor: CurrentActorProfileRow = {
  id: teacherActorId,
  tenant_id: tenantId,
  tenant_status: 'active',
  status: 'active',
  role: 'teacher',
  email: 'teacher@example.test',
  full_name: 'Teacher User',
  avatar_url: null,
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/education/enrollments/confirm-admission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/education/enrollments/confirm-admission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockResolvedValue(callerClient);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'synthetic-token' } },
      error: null,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: adminActorId } }, error: null });
    mockRpc.mockResolvedValue({ data: [adminActor], error: null });

    mockAdminFrom.mockImplementation((tableName: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockResolvedValue({ error: null });
      chain.update = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.or = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      chain.limit = jest.fn().mockReturnValue(chain);
      chain.maybeSingle = jest.fn().mockImplementation(() => {
        if (tableName === 'edu_enrollments') {
          return Promise.resolve({
            data: { id: enrollmentId, tenant_id: tenantId, student_party_id: studentPartyId, course_id: courseId, status: 'pending' },
            error: null,
          });
        }
        if (tableName === 'students') {
          return Promise.resolve({
            data: { student_id: 'stu-1', party_id: studentPartyId, student_code: 'HS0165' },
            error: null,
          });
        }
        if (tableName === 'edu_fin_billing_periods') {
          return Promise.resolve({
            data: { id: 'per-1' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
      chain.then = (resolve: (val: unknown) => void) => {
        if (tableName === 'edu_fin_invoices') {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      };
      return chain;
    });
  });

  it('rejects teacher role with 403 ADMIN_ROLE_REQUIRED', async () => {
    mockRpc.mockResolvedValueOnce({ data: [teacherActor], error: null });
    const res = await POST(postRequest({ enrollmentId, admissionMode: 'PAID' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('rejects invalid enrollmentId with 400', async () => {
    const res = await POST(postRequest({ enrollmentId: 'invalid-uuid', admissionMode: 'PAID' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_ENROLLMENT_ID');
  });

  it('rejects PAID without payment evidence before any persistence', async () => {
    const res = await POST(postRequest({ enrollmentId, admissionMode: 'PAID' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: 'PAYMENT_EVIDENCE_REQUIRED' });
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it.each([
    { method: 'CASH', amount: 100, receivedAt: '2026-11-02T09:00:00+07:00' },
    { method: 'BANK_TRANSFER_MANUAL', amount: 100, receivedAt: '2026-11-02T09:00:00+07:00', transactionId: 'bank-ref-1' },
  ])('keeps valid manual evidence fail-closed until atomic persistence exists: $method', async paymentConfirmation => {
    const res = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false, error: 'ADMISSION_CONFIRMATION_UNAVAILABLE' });
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects an untrusted automated actor and a forged manual collector', async () => {
    const automatic = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation: { method: 'BANK_TRANSFER_AUTO' } }));
    expect(automatic.status).toBe(403);
    const forged = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation: {
      method: 'CASH', amount: 100, receivedAt: '2026-11-02T09:00:00+07:00', collectorId: 'another-user',
    } }));
    expect(forged.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects a manual transfer without a transaction reference', async () => {
    const res = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation: {
      method: 'BANK_TRANSFER_MANUAL', amount: 100, receivedAt: '2026-11-02T09:00:00+07:00', transactionId: ' ',
    } }));
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('rejects a non-string method and payment data attached to DEBT', async () => {
    const method = await POST(postRequest({ enrollmentId, admissionMode: 'PAID', paymentConfirmation: {
      method: ['CASH'], amount: 100, receivedAt: '2026-11-02T09:00:00+07:00',
    } }));
    expect(method.status).toBe(400);
    const debt = await POST(postRequest({ enrollmentId, paymentConfirmation: { method: 'CASH' } }));
    expect(debt.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it('fails closed for DEBT without any financial or enrollment writes', async () => {
    const res = await POST(postRequest({ enrollmentId, admissionMode: 'DEBT' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: 'ADMISSION_CONFIRMATION_UNAVAILABLE' });
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });
});
