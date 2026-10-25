import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

// Acceptance derives from the approved admin-only canonical catalog read matrix.
const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const courseId = '00000000-0000-4000-8000-000000000003';
const actor: CurrentActorProfileRow = {
  id: actorId, tenant_id: tenantId, email: 'synthetic@example.invalid', full_name: null,
  avatar_url: null, role: 'admin', status: 'active', tenant_status: 'active',
};
const course = { id: courseId, tenant_id: tenantId, course_code: 'SYN-01', title: 'Synthetic class', status: 'active' };
type ProviderError = { message: string } | null;
const mockAuth = jest.fn<(jwt?: string) => Promise<{ data: { user: { id: string } | null }; error: ProviderError }>>();
const mockProfile = jest.fn<() => Promise<{ data: CurrentActorProfileRow[] | null; error: ProviderError }>>();
const mockTenant = jest.fn<() => Promise<{ data: { id: string; status: string; product_key: string } | null; error: ProviderError }>>();
const mockCatalog = jest.fn<() => Promise<{ data: typeof course[] | null; error: ProviderError; count: number | null }>>();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn((table: string) => ({ select: (projection: string, options?: { count: string }) => {
  mockSelect(table, projection, options);
  return { eq: (key: string, value: string) => {
    mockEq(table, key, value);
    if (table === 'tenants') return { maybeSingle: mockTenant };
    if (table === 'edu_courses') return { order: mockCatalog };
    throw new Error('Unapproved table');
  } };
} }));
const mockCreateClient = jest.fn(() => ({ auth: { getUser: mockAuth }, rpc: mockProfile, from: mockFrom }));
jest.mock('@/lib/supabase-server', () => ({ createClient: mockCreateClient }));
const route = require('../route') as typeof import('../route');
const request = (suffix = '', headers: Record<string, string> = {}) => new Request(`http://localhost/api/education/courses/catalog${suffix}`, { headers });
async function denied(status: number, code: string, req = request()) {
  const response = await route.GET(req);
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ success: false, error: code });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mockCatalog).not.toHaveBeenCalled();
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  mockProfile.mockResolvedValue({ data: [actor], error: null });
  mockTenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_preschool' }, error: null });
  mockCatalog.mockResolvedValue({ data: [course], count: 1, error: null });
});

describe('Caller-only canonical class catalog', () => {
  it('reads only permitted tenant and five catalog columns, with the real contract implementation', async () => {
    const response = await route.GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, tenantId, courses: [
      { id: courseId, tenantId, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active' },
    ] });
    expect(mockSelect.mock.calls).toEqual([
      ['tenants', 'id,status,product_key', undefined],
      ['edu_courses', 'id, tenant_id, course_code, title, status', { count: 'exact' }],
    ]);
    expect(mockEq.mock.calls).toEqual([['tenants', 'id', tenantId], ['edu_courses', 'tenant_id', tenantId]]);
    expect(mockProfile).toHaveBeenCalledWith('platform_current_actor_profile');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('accepts a genuinely empty complete catalog', async () => {
    mockCatalog.mockResolvedValue({ data: [], count: 0, error: null });
    expect(await (await route.GET(request())).json()).toEqual({ success: true, tenantId, courses: [] });
  });
  it('validates the exact supplied bearer on the same caller client', async () => {
    await route.GET(request('', { Authorization: 'Bearer synthetic-test-token' }));
    expect(mockAuth).toHaveBeenCalledWith('synthetic-test-token');
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
  it.each(['Basic opaque', 'Bearer', 'Bearer one two'])('rejects malformed Authorization %s before clients', async authorization => {
    await denied(401, 'COURSE_CATALOG_UNAUTHENTICATED', request('', { authorization }));
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
  it.each(['x-role', 'x-user-role', 'x-mock-user-email', 'x-tenant-id', 'x-user-id', 'x-actor-id'])('rejects forged %s before dependencies', async key => {
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED', request('', { [key]: 'forged' }));
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
  it.each(['?tenantId=foreign', '?role=admin', '?courseId=one&courseId=two'])('rejects caller selectors %s', async suffix => {
    await denied(400, 'COURSE_CATALOG_INVALID_REQUEST', request(suffix));
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
  it.each([null, { id: actorId }])('rejects Auth provider error even if user exists %#', async user => {
    mockAuth.mockResolvedValue({ data: { user }, error: { message: 'private detail' } });
    await denied(401, 'COURSE_CATALOG_UNAUTHENTICATED');
    expect(mockProfile).not.toHaveBeenCalled();
  });
  it('rejects a missing Auth subject', async () => {
    mockAuth.mockResolvedValue({ data: { user: null }, error: null });
    await denied(401, 'COURSE_CATALOG_UNAUTHENTICATED');
  });
  it.each([
    { data: [] }, { data: [{ ...actor, id: 'foreign' }] }, { data: [actor, actor] },
    { data: [{ ...actor, tenant_id: '' }] }, { data: [{ ...actor, status: 'inactive' }] },
    { data: [{ ...actor, tenant_status: 'suspended' }] },
  ])('rejects unreconciled current actor %#', async ({ data }) => {
    mockProfile.mockResolvedValue({ data, error: null });
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED'); expect(mockFrom).not.toHaveBeenCalled();
  });
  it.each(['admin_staff', 'teacher', 'tenant_admin', 'super_admin', 'parent'])('denies %s without role widening', async role => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, role }], error: null });
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED');
  });
  it.each([null, { id: 'foreign', status: 'active', product_key: 'bella_preschool' },
    { id: tenantId, status: 'suspended', product_key: 'bella_preschool' },
    { id: tenantId, status: 'active', product_key: '' }])('denies invalid tenant %#', async data => {
    mockTenant.mockResolvedValue({ data, error: null });
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED');
  });
  it('signals non-Preschool only after trusted tenant resolution', async () => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, role: 'teacher' }], error: null });
    mockTenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_english_center' }, error: null });
    await denied(403, 'COURSE_CATALOG_UNSUPPORTED_PRODUCT');
  });
  it.each(['profile', 'tenant'])('sanitizes %s provider failure', async dependency => {
    if (dependency === 'profile') mockProfile.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    else mockTenant.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    await denied(503, 'COURSE_CATALOG_UNAVAILABLE');
  });
  it.each([
    { data: null, error: { message: '42501 private detail' }, count: null },
    { data: [], error: null, count: 1 },
    { data: [{ ...course, tenant_id: 'foreign' }], error: null, count: 1 },
    { data: [course, course], error: null, count: 2 },
    { data: [{ ...course, status: 'unexpected' }], error: null, count: 1 },
  ])('rejects unavailable, truncated, foreign or malformed catalog %#', async result => {
    mockCatalog.mockResolvedValue(result);
    const response = await route.GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' });
  });
  it('fails closed on thrown transport errors', async () => {
    mockAuth.mockRejectedValueOnce(new Error('private detail'));
    await denied(503, 'COURSE_CATALOG_UNAVAILABLE');
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('%s has zero dependency or mutation side effects', method => {
    const response = route[method]();
    expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('GET');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
