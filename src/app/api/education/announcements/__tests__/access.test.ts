import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Independent expectations: owner-approved AUTHORIZATION_CONTRACT.md sections2–6.
const actorId = '00000000-0000-4000-8000-000000000011';
const tenantId = '00000000-0000-4000-8000-000000000022';
const otherId = '00000000-0000-4000-8000-000000000033';
interface Profile { id: string; tenant_id: string | null; status: string; role: string; }
const profile: Profile = { id: actorId, tenant_id: tenantId, status: 'active', role: 'admin' };
const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockProfile = jest.fn<() => Promise<Profile | null>>();
const mockRpc = jest.fn();
const mockClient = { auth: { getUser: mockAuth }, rpc: mockRpc };
const mockPrivileged = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockProfile }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockPrivileged }));
const { GET, POST } = require('../route') as typeof import('../route');

function request(query = '', headers: Record<string, string> = {}, body = '{malformed', method = 'POST') {
  return new Request(`http://localhost/api/education/announcements${query}`, { method, headers, ...(method === 'GET' ? {} : { body }) });
}
async function check(req: Request, status: number, error: string) {
  const json = jest.spyOn(req, 'json');
  const result = await POST(req);
  expect(result.status).toBe(status);
  expect(await result.json()).toEqual({ success: false, error });
  expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  expect(json).not.toHaveBeenCalled();
  expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockProfile.mockResolvedValue(profile);
  mockRpc.mockResolvedValue({ data: { id: otherId, title: 'Notice', bodyText: 'Body', publishedAt: '2026-10-23T00:00:00.000Z', duplicate: false }, error: null });
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Announcements publication boundary and dependency hold', () => {
  it('denies forged anonymous before profile/body/database capability', async () => {
    mockAuth.mockResolvedValue({ data: { user: null }, error: null });
    await check(request(`?tenantId=${tenantId}`, { 'x-mock-role': 'admin', Cookie: 'mock_user_email=synthetic@example.invalid' }), 401, 'ANNOUNCEMENT_UNAUTHENTICATED');
    expect(mockProfile).not.toHaveBeenCalled();
  });
  it('rejects provider rejection even with a subject', async () => {
    mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: { message: 'synthetic private detail' } });
    await check(request(), 401, 'ANNOUNCEMENT_UNAUTHENTICATED'); expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each([null, { ...profile, id: otherId }, { ...profile, status: 'inactive' }, { ...profile, tenant_id: null }])('denies inactive or unbound profile %#', async value => {
    mockProfile.mockResolvedValue(value); await check(request(), 403, 'ANNOUNCEMENT_ACCESS_DENIED');
  });
  it.each(['admin_staff', 'parent', 'student', 'accountant', 'super_admin', 'teacher', ''])('rejects live role %s despite admin header', async role => {
    mockProfile.mockResolvedValue({ ...profile, role }); await check(request('', { 'x-mock-role': 'admin' }), 403, 'ANNOUNCEMENT_ACCESS_DENIED');
  });
  it.each(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id'])('rejects foreign duplicate %s selectors', async key => {
    const own = key.startsWith('tenant') ? tenantId : actorId;
    await check(request(`?${key}=${own}&${key}=${otherId}`), 403, 'ANNOUNCEMENT_CONTEXT_OVERRIDE_DENIED');
  });
  it.each(['x-tenant-id', 'x-actor-id'])('rejects foreign %s header', async name => {
    await check(request('', { [name]: otherId }), 403, 'ANNOUNCEMENT_CONTEXT_OVERRIDE_DENIED');
  });
  it.each(['auth', 'profile'])('fails closed on thrown %s dependency', async dependency => {
    const error = new Error('synthetic private dependency detail');
    if (dependency === 'auth') mockAuth.mockRejectedValue(error);
    if (dependency === 'profile') mockProfile.mockRejectedValue(error);
    await check(request(), 503, 'ANNOUNCEMENT_ACCESS_UNAVAILABLE');
  });
  it('publishes a tenant-wide bulletin using only the caller-supplied request id and content', async () => {
    mockProfile.mockResolvedValue({ ...profile, role: ' ADMIN ' });
    const body = { requestId: actorId, title: ' School notice ', bodyText: 'Notice body' };
    const response = await POST(request('', { 'Content-Type': 'application/json' }, JSON.stringify(body)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { id: otherId, duplicate: false } });
    expect(mockAuth.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
    expect(mockRpc).toHaveBeenCalledWith('preschool_publish_school_announcement', {
      p_request_id: actorId, p_title: body.title, p_body_text: body.bodyText,
    });
    expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([
    JSON.stringify({ requestId: actorId, title: 'Title', bodyText: 'Body', tenantId }),
    JSON.stringify({ requestId: 'not-a-uuid', title: 'Title', bodyText: 'Body' }),
    JSON.stringify({ requestId: actorId, title: '', bodyText: 'Body' }),
  ])('rejects malformed or caller-scoped publish payload before the database capability', async body => {
    const response = await POST(request('', { 'Content-Type': 'application/json' }, body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'ANNOUNCEMENT_INVALID_REQUEST' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('returns 400 for invalid JSON after authorization and before the capability call', async () => {
    const response = await POST(request('', { 'Content-Type': 'application/json' }, '{invalid'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'ANNOUNCEMENT_INVALID_REQUEST' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([
    { code: '42501', status: 403, error: 'ANNOUNCEMENT_ACCESS_DENIED' },
    { code: '23505', status: 409, error: 'ANNOUNCEMENT_REQUEST_CONFLICT' },
    { code: 'XX000', status: 503, error: 'ANNOUNCEMENT_PUBLISH_UNAVAILABLE' },
  ])('maps RPC outcome $code without exposing database details', async ({ code, status, error }) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: 'synthetic private detail' } });
    const response = await POST(request('', { 'Content-Type': 'application/json' }, JSON.stringify({ requestId: actorId, title: 'Title', bodyText: 'Body' })));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error });
  });
  it('reads only the server-derived tenant feed', async () => {
    mockRpc.mockResolvedValue({ data: { tenantId, announcements: [{ id: otherId, title: 'Notice', bodyText: 'Body', publishedAt: '2026-10-23T00:00:00.000Z' }] }, error: null });
    const response = await GET(request('', {}, '', 'GET'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { tenantId, announcements: [{ id: otherId }] } });
    expect(mockRpc).toHaveBeenCalledWith('preschool_list_school_announcements');
  });
  it('rejects a cross-tenant result returned by the read capability', async () => {
    mockRpc.mockResolvedValue({ data: { tenantId: otherId, announcements: [] }, error: null });
    const response = await GET(request('', {}, '', 'GET'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: 'ANNOUNCEMENT_ACCESS_UNAVAILABLE' });
  });
  it('rejects caller tenant selectors on feed reads', async () => {
    const response = await GET(request(`?tenantId=${tenantId}`, {}, '', 'GET'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'ANNOUNCEMENT_CONTEXT_OVERRIDE_DENIED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
