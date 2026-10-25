import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const branchId = '00000000-0000-4000-8000-000000000003';
const teacherPartyId = '00000000-0000-4000-8000-000000000004';
const confirmationId = '00000000-0000-4000-8000-000000000005';
const actor: CurrentActorProfileRow = { id: actorId, tenant_id: tenantId, email: 'synthetic@example.invalid',
  full_name: null, avatar_url: null, role: 'admin', status: 'active', tenant_status: 'active' };
const auth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: null }>>();
const profile = jest.fn<() => Promise<{ data: CurrentActorProfileRow[] | null; error: null }>>();
const tenant = jest.fn<() => Promise<{ data: { id: string; status: string; product_key: string }; error: null }>>();
const readerFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: tenant }) }) }));
const reader = jest.fn(() => ({ auth: { getUser: auth }, rpc: profile, from: readerFrom }));
const writerRpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
const writer = jest.fn(() => ({ rpc: writerRpc }));
const adminKey = jest.fn<() => string | undefined>();
jest.mock('@/lib/supabase-server', () => ({ createClient: reader }));
jest.mock('@supabase/supabase-js', () => ({ createClient: writer }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminUrl: () => 'https://synthetic.invalid', getSupabaseAdminKey: adminKey }));
const { GET, POST } = require('../route') as typeof import('../route');
const candidatePage = { tenantId, branchId, onDate: '2026-10-25', confirmedOnly: false,
  offset: 0, limit: 20, filteredTotal: 0, nextOffset: null, parties: [] };
const confirmation = { id: confirmationId, tenant_id: tenantId, branch_id: branchId,
  teacher_party_id: teacherPartyId, valid_from: '2026-10-25', valid_to: null,
  attestation: 'Đã đối chiếu hồ sơ', confirmed_by: actorId, confirmed_at: '2026-10-25T00:00:00Z',
  revoked_at: null, revoked_by: null, revocation_reason: null };
const confirmBody = { action: 'confirm', branchId, operationKey: confirmationId,
  teacherPartyId, validFrom: '2026-10-25', validTo: null, attestation: confirmation.attestation };
const post = (body: unknown = confirmBody, suffix = '', headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/education/teachers${suffix}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (suffix: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/education/teachers${suffix}`, { headers });
const candidateQuery = `?view=candidates&branchId=${branchId}&query=&confirmedOnly=false&onDate=2026-10-25&offset=0&limit=20`;
beforeEach(() => {
  jest.clearAllMocks(); adminKey.mockReturnValue('synthetic-key');
  auth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  profile.mockResolvedValue({ data: [actor], error: null });
  tenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_preschool' }, error: null });
  writerRpc.mockResolvedValue({ data: candidatePage, error: null });
});

describe('Preschool teacher API boundary', () => {
  it('uses the six-RPC public contract with live identity and private response', async () => {
    const response = await GET(get(candidateQuery));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, page: candidatePage });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(writerRpc).toHaveBeenCalledWith('preschool_teacher_candidates', expect.objectContaining({
      p_tenant_id: tenantId, p_actor_id: actorId, p_branch_id: branchId,
    }));
  });
  it('confirms existing Party through one idempotent RPC', async () => {
    writerRpc.mockResolvedValue({ data: confirmation, error: null });
    const response = await POST(post());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, confirmation: { id: confirmationId } });
    expect(writerRpc).toHaveBeenCalledWith('preschool_confirm_teacher', expect.objectContaining({
      p_operation_key: confirmationId, p_teacher_party_id: teacherPartyId,
    }));
  });
  it('denies unauthenticated and forged callers before privileged client creation', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(post())).status).toBe(401);
    expect(writer).not.toHaveBeenCalled();
    expect((await GET(get(candidateQuery, { 'x-role': 'admin' }))).status).toBe(403);
    expect(writer).not.toHaveBeenCalled();
  });
  it('denies other Product and non-admin before privileged client creation', async () => {
    profile.mockResolvedValue({ data: [{ ...actor, role: 'teacher' }], error: null });
    expect((await POST(post())).status).toBe(403);
    expect(writer).not.toHaveBeenCalled();
    profile.mockResolvedValue({ data: [actor], error: null });
    tenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_english_center' }, error: null });
    expect((await POST(post())).status).toBe(403);
    expect(writer).not.toHaveBeenCalled();
  });
  it('rejects forged actor fields and unbounded queries', async () => {
    expect((await POST(post({ ...confirmBody, actorId }))).status).toBe(400);
    expect((await GET(get(`${candidateQuery}&tenantId=${tenantId}`))).status).toBe(400);
    expect(writerRpc).not.toHaveBeenCalled();
  });
  it('maps service denial and missing RPC without exposing provider detail', async () => {
    writerRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private detail' } });
    const denial = await POST(post());
    expect(denial.status).toBe(403);
    expect(JSON.stringify(await denial.json())).not.toContain('private detail');
    writerRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'private detail' } });
    expect((await POST(post())).status).toBe(503);
  });
});
