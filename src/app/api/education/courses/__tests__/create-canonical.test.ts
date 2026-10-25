import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';
const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const branchId = '00000000-0000-4000-8000-000000000003';
const operationKey = '00000000-0000-4000-8000-000000000004';
const id = '00000000-0000-4000-8000-000000000005';
const actor: CurrentActorProfileRow = { id: actorId, tenant_id: tenantId, email: 'synthetic@example.invalid', full_name: null, avatar_url: null, role: 'admin', status: 'active', tenant_status: 'active' };
const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockProfile = jest.fn<() => Promise<{ data: CurrentActorProfileRow[] | null; error: { message: string; code?: string } | null }>>();
const mockTenant = jest.fn<() => Promise<{ data: { id: string; product_key: string; status: string }; error: null }>>();
const mockRpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
const mockFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: mockTenant }) }) }));
const mockCreateClient = jest.fn(() => ({ auth: { getUser: mockAuth }, rpc: mockProfile, from: mockFrom }));
const mockPrivileged = jest.fn(() => ({ rpc: mockRpc }));
const mockAdminKey = jest.fn<() => string | undefined>();
jest.mock('@/lib/supabase-server', () => ({ createClient: mockCreateClient }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockPrivileged }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminUrl: () => 'https://synthetic.invalid', getSupabaseAdminKey: mockAdminKey }));
const { POST } = require('../route') as typeof import('../route');
const body = { operationKey, branchId, code: ' syn-01 ', title: ' Synthetic class ' };
const identity = { id, tenantId, branchId, operationKey, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active' };
const request = (value: unknown = body, headers: Record<string, string> = {}, suffix = '') => new Request(`http://localhost/api/education/courses${suffix}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value),
});
function streamedRequest(chunks: readonly Uint8Array[], cancel: () => void = () => {}) {
  let read = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (read < chunks.length) controller.enqueue(chunks[read++]);
      else controller.close();
    }, cancel,
  }, { highWaterMark: 0 });
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  };
  return { request: new Request('http://localhost/api/education/courses', init), reads: () => read };
}
beforeEach(() => {
  jest.clearAllMocks(); mockAdminKey.mockReturnValue('synthetic-service-key');
  mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockProfile.mockResolvedValue({ data: [actor], error: null });
  mockTenant.mockResolvedValue({ data: { id: tenantId, product_key: 'bella_preschool', status: 'active' }, error: null });
  mockRpc.mockResolvedValue({ data: identity, error: null });
});
describe('approved canonical class POST boundary', () => {
  it('authenticates caller before service writer and passes only live actor/tenant', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ success: true, course: identity });
    expect(mockProfile).toHaveBeenCalledWith('platform_current_actor_profile');
    expect(mockRpc).toHaveBeenCalledWith('edu_create_preschool_course', expect.objectContaining({ p_tenant_id: tenantId, p_actor_id: actorId, p_operation_key: operationKey, p_branch_id: branchId, p_course_code: 'SYN-01', p_title: 'Synthetic class' }));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it.each(['x-role', 'x-user-role', 'x-mock-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'])('denies forged %s before clients', async key => {
    expect((await POST(request(body, { [key]: 'forged' }))).status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('denies query selectors before clients', async () => {
    expect((await POST(request(body, {}, '?tenantId=foreign'))).status).toBe(400);
    expect(mockCreateClient).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('denies a revoked live actor before creating the trusted writer', async () => {
    mockProfile.mockResolvedValue({ data: null, error: { code: '42501', message: 'private identity denial' } });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'CANONICAL_COURSE_ACCESS_DENIED' });
    expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('denies anonymous callers before privileged dependencies', async () => {
    mockAuth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mockProfile).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each(['Basic opaque', 'Bearer', 'Bearer one two'])('rejects malformed bearer %s before clients', async authorization => {
    expect((await POST(request(body, { authorization }))).status).toBe(401);
    expect(mockCreateClient).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each(['teacher', 'super_admin', 'admin_staff', 'parent'])('does not widen %s role', async role => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, role }], error: null });
    expect((await POST(request())).status).toBe(403); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([{ id: 'foreign' }, { id: actorId }])('denies missing or erroneous live Auth %#', async user => {
    mockAuth.mockResolvedValue({ data: { user }, error: { message: 'private' } });
    expect((await POST(request())).status).toBe(401); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([{ id: 'foreign' }, { status: 'inactive' }, { tenant_status: 'suspended' }])('denies mismatched/inactive actor %#', async patch => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, ...patch }], error: null });
    expect((await POST(request())).status).toBe(403); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('denies other Product', async () => {
    mockTenant.mockResolvedValue({ data: { id: tenantId, product_key: 'bella_english_center', status: 'active' }, error: null });
    expect((await POST(request())).status).toBe(403); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { ...body, tenantId }, { ...body, actorId }, { ...body, branchId: 'bad' }, { ...body, operationKey: 'bad' }, { ...body, code: '' }, { ...body, title: 'x'.repeat(201) }])('rejects malformed/forged body before privileged dependencies %#', async value => {
    expect((await POST(request(value))).status).toBe(400); expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('fails closed with missing service config', async () => {
    mockAdminKey.mockReturnValue(undefined);
    expect((await POST(request())).status).toBe(503); expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([
    ['text/plain', JSON.stringify(body)], ['application/json', '{malformed'],
    ['application/json', JSON.stringify({ ...body, title: 'x'.repeat(8192) })],
  ])('rejects invalid transport %# before writer construction', async (contentType, text) => {
    const response = await POST(new Request('http://localhost/api/education/courses', {
      method: 'POST', headers: { 'Content-Type': contentType }, body: text,
    }));
    expect(response.status).toBe(400); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('accepts a valid body at exactly 8192 bytes without buffering beyond the cap', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(body).padEnd(8192, ' '));
    const stream = streamedRequest([bytes.subarray(0, 4096), bytes.subarray(4096)]);
    expect((await POST(stream.request)).status).toBe(201);
  });
  it.each(['ascii', 'multibyte'])('cancels oversized %s bytes immediately and never reads the next chunk', async encoding => {
    const text = encoding === 'ascii' ? JSON.stringify(body).padEnd(8193, ' ') : JSON.stringify({ ...body, title: 'é'.repeat(4096) });
    const bytes = new TextEncoder().encode(text);
    if (encoding === 'multibyte') expect(text.length).toBeLessThan(8192);
    const cancel = jest.fn();
    const stream = streamedRequest([bytes.subarray(0, 8192), bytes.subarray(8192), new Uint8Array([32])], cancel);
    const response = await POST(stream.request);
    expect(response.status).toBe(400); expect(cancel).toHaveBeenCalledTimes(1); expect(stream.reads()).toBe(2);
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('decodes valid multibyte UTF-8 split between chunks', async () => {
    const title = 'Lớp mẫu giáo';
    const bytes = new TextEncoder().encode(JSON.stringify({ ...body, title }));
    const split = bytes.findIndex(value => value > 127) + 1;
    mockRpc.mockResolvedValue({ data: { ...identity, title }, error: null });
    expect((await POST(streamedRequest([bytes.subarray(0, split), bytes.subarray(split)]).request)).status).toBe(201);
  });
  it.each([new Uint8Array([0xc3, 0x28]), new Uint8Array([0xc3])])('rejects malformed or truncated UTF-8 %#', async bytes => {
    expect((await POST(streamedRequest([bytes]).request)).status).toBe(400);
    expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it('rejects a missing body before writer creation', async () => {
    const response = await POST(new Request('http://localhost/api/education/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    expect(response.status).toBe(400); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it('sanitizes stream read failures before writer creation', async () => {
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error('private read detail')); } });
    const init: RequestInit & { duplex: 'half' } = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' };
    const response = await POST(new Request('http://localhost/api/education/courses', init));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ success: false, error: 'CANONICAL_COURSE_INVALID_REQUEST' });
    expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([['PGRST202', 503], ['42501', 403], ['23505', 409]])('keeps %s transaction failure sanitized', async (code, status) => {
    mockRpc.mockResolvedValue({ data: null, error: { code: String(code), message: 'private detail' } });
    const response = await POST(request()); expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain('private detail');
  });
  it('rejects foreign/mismatched success identity', async () => {
    mockRpc.mockResolvedValue({ data: { ...identity, tenantId: 'foreign' }, error: null });
    expect((await POST(request())).status).toBe(503);
  });
});
