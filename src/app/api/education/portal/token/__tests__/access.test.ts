import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Independent expectations: owner-approved AUTHORIZATION_CONTRACT.md sections2–6.
const actorId = '00000000-0000-4000-8000-000000000011';
const tenantId = '00000000-0000-4000-8000-000000000022';
const otherId = '00000000-0000-4000-8000-000000000033';
interface Profile { id: string; tenant_id: string | null; status: string; role: string; }
const profile: Profile = { id: actorId, tenant_id: tenantId, status: 'active', role: 'admin' };
const mockAuth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockProfile = jest.fn<() => Promise<Profile | null>>();
const mockTenant = jest.fn<() => Promise<{ data: { id: string; status: string; product_key: string } | null; error: { message: string } | null }>>();
const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: mockTenant }) }), insert: mockInsert, update: mockInsert }));
const mockClient = { auth: { getUser: mockAuth }, from: mockFrom };
const mockPrivileged = jest.fn();
const mockSigning = jest.fn();
const courseId = '00000000-0000-4000-8000-000000000044';
const guardianId = '00000000-0000-4000-8000-000000000055';
const context = { tenantId, courseId, studentPartyId: otherId, guardians: [{ guardianPartyId: guardianId, guardianLabel: 'Synthetic Guardian' }] };
const mockRpc = jest.fn<() => Promise<{ data: unknown; error: { code: string } | null }>>();
Object.assign(mockClient, { rpc: mockRpc });
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockProfile }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockPrivileged }));
jest.mock('@/products/bella-education/parent-portal/services/preschool-parent-portal.service', () => ({
  ...jest.requireActual<typeof import('@/products/bella-education/parent-portal/services/preschool-parent-portal.service')>('@/products/bella-education/parent-portal/services/preschool-parent-portal.service'),
  PreschoolParentPortalService: { generateDailyReadToken: mockSigning },
}));
const { POST, GET } = require('../route') as typeof import('../route');

function request(query = '', headers: Record<string, string> = {}, body = '{malformed') {
  return new Request(`http://localhost/api/education/portal/token${query}`, { method: 'POST', headers, body });
}
async function check(req: Request, status: number, error: string) {
  const json = jest.spyOn(req, 'json');
  const result = await POST(req);
  expect(result.status).toBe(status);
  expect(await result.json()).toEqual({ success: false, error });
  expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  expect(json).not.toHaveBeenCalled();
  expect(mockPrivileged).not.toHaveBeenCalled(); expect(mockSigning).not.toHaveBeenCalled(); expect(mockInsert).not.toHaveBeenCalled();
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockProfile.mockResolvedValue(profile);
  mockTenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_preschool' }, error: null });
  mockRpc.mockResolvedValue({ data: context, error: null });
  mockSigning.mockReturnValue('synthetic-signed-token');
});
afterEach(() => { jest.restoreAllMocks(); });

describe('Portal issuance boundary and dependency hold', () => {
  it('denies forged anonymous before profile/body/data', async () => {
    mockAuth.mockResolvedValue({ data: { user: null }, error: null });
    await check(request(`?tenantId=${tenantId}`, { 'x-mock-role': 'admin', Cookie: 'mock_user_email=synthetic@example.invalid' }), 401, 'PORTAL_UNAUTHENTICATED');
    expect(mockProfile).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
  });
  it('rejects provider rejection even with a subject', async () => {
    mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: { message: 'synthetic private detail' } });
    await check(request(), 401, 'PORTAL_UNAUTHENTICATED'); expect(mockProfile).not.toHaveBeenCalled();
  });
  it.each([null, { ...profile, id: otherId }, { ...profile, status: 'inactive' }, { ...profile, tenant_id: null }])('denies inactive or unbound profile %#', async value => {
    mockProfile.mockResolvedValue(value); await check(request(), 403, 'PORTAL_ACCESS_DENIED'); expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['admin_staff', 'parent', 'student', 'accountant', 'super_admin', 'teacher', ''])('rejects live role %s despite admin header', async role => {
    mockProfile.mockResolvedValue({ ...profile, role }); await check(request('', { 'x-mock-role': 'admin' }), 403, 'PORTAL_ACCESS_DENIED');
  });
  it.each(['tenantId', 'tenant_id', 'actorId', 'actor_id', 'userId', 'user_id'])('rejects foreign duplicate %s selectors', async key => {
    const own = key.startsWith('tenant') ? tenantId : actorId;
    await check(request(`?${key}=${own}&${key}=${otherId}`), 403, 'TENANT_ISOLATION_VIOLATION'); expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['x-tenant-id', 'x-actor-id'])('rejects foreign %s header', async name => {
    await check(request('', { [name]: otherId }), 403, 'TENANT_ISOLATION_VIOLATION'); expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['inactive', 'foreign-product', 'missing', 'wrong-id'])('rejects %s tenant', async state => {
    mockTenant.mockResolvedValue({ data: state === 'missing' ? null : { id: state === 'wrong-id' ? otherId : tenantId, status: state === 'inactive' ? 'inactive' : 'active', product_key: state === 'foreign-product' ? 'bella_training' : 'bella_preschool' }, error: null });
    await check(request(), 403, 'PORTAL_ACCESS_DENIED');
  });
  it('sanitizes lookup/RLS errors with no privileged retry', async () => {
    mockTenant.mockResolvedValue({ data: null, error: { message: 'synthetic private DB detail' } });
    await check(request(), 503, 'PORTAL_ACCESS_UNAVAILABLE'); expect(mockFrom).toHaveBeenCalledTimes(1);
  });
  it.each(['auth', 'profile', 'tenant'])('fails closed on thrown %s dependency', async dependency => {
    const error = new Error('synthetic private dependency detail');
    if (dependency === 'auth') mockAuth.mockRejectedValue(error);
    if (dependency === 'profile') mockProfile.mockRejectedValue(error);
    if (dependency === 'tenant') mockTenant.mockRejectedValue(error);
    await check(request(), 503, 'PORTAL_ACCESS_UNAVAILABLE');
  });
  it.each(['{malformed', 'null', '{}', JSON.stringify({ tenantId: otherId, guardianPartyId: otherId, validityDays: 60 })])('rejects malformed or unapproved body fields before capability/signing %#', async body => {
    const response = await POST(request('', {}, body));
    expect(response.status).toBe(400); expect(mockRpc).not.toHaveBeenCalled(); expect(mockSigning).not.toHaveBeenCalled();
  });
  it('reads guardian choices only through caller capability and never signs on GET', async () => {
    const response = await GET(new Request(`http://localhost/api/education/portal/token?courseId=${courseId}&studentPartyId=${otherId}`));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, data: context });
    expect(mockRpc).toHaveBeenCalledWith('preschool_portal_issuer_context', { p_course_id: courseId, p_student_party_id: otherId });
    expect(mockSigning).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  const validBody = () => JSON.stringify({ courseId, studentPartyId: otherId, guardianPartyId: guardianId });
  it('signs exact validated Course/Student/explicit guardian with no business write', async () => {
    const response = await POST(request('', {}, validBody()));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, expiresInSeconds: 86400 });
    expect(mockSigning).toHaveBeenCalledWith({ tenantId, courseId, studentPartyId: otherId, guardianPartyId: guardianId });
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockSigning.mock.invocationCallOrder[0]);
    expect(mockInsert).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each(['42501', 'XX000'])('does not sign or privileged-retry after capability denial %s', async code => {
    mockRpc.mockResolvedValue({ data: null, error: { code } });
    expect((await POST(request('', {}, validBody()))).status).toBe(code === '42501' ? 403 : 503);
    expect(mockSigning).not.toHaveBeenCalled(); expect(mockPrivileged).not.toHaveBeenCalled();
  });
  it.each([null, { ...context, tenantId: actorId }, { ...context, guardians: [] }, { ...context, guardians: [{ guardianPartyId: actorId, guardianLabel: 'Wrong' }] }])('rejects malformed/mismatched capability before signing %#', async data => {
    mockRpc.mockResolvedValue({ data, error: null });
    expect((await POST(request('', {}, validBody()))).status).toBe(503); expect(mockSigning).not.toHaveBeenCalled();
  });
  it('rejects duplicate GET selectors', async () => {
    const response = await GET(new Request(`http://localhost/api/education/portal/token?courseId=${courseId}&courseId=${courseId}&studentPartyId=${otherId}`));
    expect(response.status).toBe(400); expect(mockRpc).not.toHaveBeenCalled();
  });
});
