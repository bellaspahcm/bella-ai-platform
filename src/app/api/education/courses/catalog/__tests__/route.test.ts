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
const mockTenantPresentation = jest.fn<() => Promise<{ data: unknown; error: { message: string; code?: string } | null }>>();
const mockActorRpc = jest.fn<(name: string) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>>();
const mockCatalog = jest.fn<() => Promise<{ data: unknown; error: ProviderError }>>();
const mockCreateClient = jest.fn(() => ({ auth: { getUser: mockAuth }, rpc: mockActorRpc }));
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
  mockTenantPresentation.mockResolvedValue({ data: [{ tenant_id: tenantId, tenant_status: 'active', name: 'Synthetic Preschool', product_key: 'bella_preschool', enabled_modules: {}, brand_theme: {}, logo_url: null }], error: null });
  mockActorRpc.mockImplementation((name) => {
    if (name === 'platform_current_actor_profile') return mockProfile();
    if (name === 'platform_current_actor_tenant_presentation') return mockTenantPresentation();
    if (name === 'edu_preschool_admin_course_catalog') return mockCatalog();
    throw new Error('Unexpected RPC');
  });
  mockCatalog.mockResolvedValue({ data: [{ ...course, prerequisite_course_codes: [] }], error: null });
});

describe('Caller-only canonical class catalog', () => {
  it('calls the narrow admin course RPC; actor and tenant are not caller parameters', async () => {
    const response = await route.GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, tenantId, courses: [
      { id: courseId, tenantId, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active' },
    ] });
    expect(mockActorRpc).toHaveBeenNthCalledWith(1, 'platform_current_actor_profile');
    expect(mockActorRpc).toHaveBeenNthCalledWith(2, 'platform_current_actor_tenant_presentation');
    expect(mockActorRpc).toHaveBeenNthCalledWith(3, 'edu_preschool_admin_course_catalog', { p_course_id: null });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('accepts a genuinely empty complete catalog', async () => {
    mockCatalog.mockResolvedValue({ data: [], error: null });
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
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED'); expect(mockCatalog).not.toHaveBeenCalled();
  });
  it.each(['admin_staff', 'teacher', 'tenant_admin', 'super_admin', 'parent'])('denies %s without role widening', async role => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, role }], error: null });
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED');
  });
  it.each([null, [{ tenant_id: 'foreign', tenant_status: 'active', name: 'Foreign', product_key: 'bella_preschool', enabled_modules: {}, brand_theme: {}, logo_url: null }],
    [{ tenant_id: tenantId, tenant_status: 'suspended', name: 'Synthetic', product_key: 'bella_preschool', enabled_modules: {}, brand_theme: {}, logo_url: null }],
    [{ tenant_id: tenantId, tenant_status: 'active', name: 'Synthetic', product_key: '', enabled_modules: {}, brand_theme: {}, logo_url: null }]])('denies invalid tenant presentation %#', async data => {
    mockTenantPresentation.mockResolvedValue({ data, error: null });
    await denied(403, 'COURSE_CATALOG_ACCESS_DENIED');
  });
  it('signals non-Preschool only after trusted tenant resolution', async () => {
    mockProfile.mockResolvedValue({ data: [{ ...actor, role: 'teacher' }], error: null });
    mockTenantPresentation.mockResolvedValue({ data: [{ tenant_id: tenantId, tenant_status: 'active', name: 'Synthetic', product_key: 'bella_english_center', enabled_modules: {}, brand_theme: {}, logo_url: null }], error: null });
    await denied(403, 'COURSE_CATALOG_UNSUPPORTED_PRODUCT');
  });
  it.each(['profile', 'tenant'])('sanitizes %s provider failure', async dependency => {
    if (dependency === 'profile') mockProfile.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    else mockTenantPresentation.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    await denied(503, 'COURSE_CATALOG_UNAVAILABLE');
  });
  it.each([
    { data: null, error: { message: '42501 private detail' } },
    { data: [{ ...course, prerequisite_course_codes: [], tenant_id: 'foreign' }], error: null },
    { data: [{ ...course, prerequisite_course_codes: [] }, { ...course, prerequisite_course_codes: [] }], error: null },
    { data: [{ ...course, prerequisite_course_codes: [], status: 'unexpected' }], error: null },
    { data: [{ ...course, prerequisite_course_codes: null }], error: null },
  ])('rejects unavailable, truncated, foreign or malformed catalog %#', async result => {
    mockCatalog.mockResolvedValue({ data: result.data, error: result.error });
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
