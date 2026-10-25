import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetUser = jest.fn<() => Promise<{
  data: { user: { id: string } | null }; error: { message: string } | null;
}>>();
const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn<(table: string) => unknown>();
const mockClient = { auth: { getUser: mockGetUser }, from: mockFrom };
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));

const { resolveCourseCatalogReadContext, resolveCourseReadMode } = require('../request-context') as typeof import('../request-context');
const userId = 'caller-auth-id';
const tenantId = 'own-tenant';
const profile = { id: userId, tenant_id: tenantId, role: 'admin', status: 'active' };
const tenant = { id: tenantId, status: 'active', product_key: 'bella_preschool' };
let currentProfile: unknown;
let currentTenant: unknown;
let profileError: { message: string } | null;
let tenantError: { message: string } | null;
let reads: Array<{ table: string; columns: string; column: string; value: string }>;

const request = (query = 'view=catalog') => new Request(`http://localhost/api/education/courses?${query}`);

beforeEach(() => {
  jest.clearAllMocks();
  currentProfile = { ...profile };
  currentTenant = { ...tenant };
  profileError = null;
  tenantError = null;
  reads = [];
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockFrom.mockImplementation(table => ({
    select: (columns: string) => ({ eq: (column: string, value: string) => {
      reads.push({ table, columns, column, value });
      return { maybeSingle: async () => {
        if (table === 'users') return { data: currentProfile, error: profileError };
        if (table === 'tenants') return { data: currentTenant, error: tenantError };
        throw new Error(`Unexpected catalog identity dependency ${table}`);
      } };
    } }),
  }));
});

describe('catalog request mode', () => {
  it('keeps default mode and its operational selectors compatible', () => {
    expect(resolveCourseReadMode(request('date=2026-10-22&tenantId=own-tenant'))).toEqual({ allowed: true, mode: 'default' });
  });
  it.each([
    'view=', 'view=classrooms', 'view=CATALOG', 'view=catalog&view=catalog', 'view=catalog&view=default',
    'view=catalog&tenantId=own-tenant&tenantId=own-tenant', 'view=catalog&tenantId=',
    'view=catalog&tenantId=%20own-tenant', 'view=catalog&date=2026-10-22',
    'view=catalog&branchId=branch-a', 'view=catalog&tenant_id=own-tenant', 'view=catalog&courseId=id',
  ])('rejects an ambiguous or unsupported selector: %s', async query => {
    const mode = resolveCourseReadMode(request(query));
    expect(mode.allowed).toBe(false);
    if (mode.allowed) throw new Error('Expected invalid catalog request');
    expect(mode.response.status).toBe(400);
    expect(mode.response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await mode.response.json()).toEqual({ success: false, error: 'COURSE_INVALID_CATALOG_REQUEST' });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('current caller catalog context', () => {
  async function denied(status: number, error = 'COURSE_ACCESS_DENIED', query = 'view=catalog') {
    const context = await resolveCourseCatalogReadContext(request(query));
    expect(context.allowed).toBe(false);
    if (context.allowed) throw new Error('Expected catalog denial');
    expect(context.response.status).toBe(status);
    expect(context.response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await context.response.json()).toEqual({ success: false, error });
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  }

  it('allows an own active Preschool admin without a branch binding using only the minimal caller projections', async () => {
    const context = await resolveCourseCatalogReadContext(request(`view=catalog&tenantId=${tenantId}`));
    expect(context.allowed).toBe(true);
    if (!context.allowed) throw new Error('Expected allowed context');
    expect(context.supabase).toBe(mockClient);
    expect(context.tenantId).toBe(tenantId);
    expect(reads).toEqual([
      { table: 'users', columns: 'id,tenant_id,role,status', column: 'id', value: userId },
      { table: 'tenants', columns: 'id,status,product_key', column: 'id', value: tenantId },
    ]);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetUser.mock.invocationCallOrder[0]).toBeLessThan(mockFrom.mock.invocationCallOrder[0]);
  });

  it.each(['missing', 'error'])('verifies Auth before identity reads: %s', async outcome => {
    mockGetUser.mockResolvedValue(outcome === 'missing'
      ? { data: { user: null }, error: null }
      : { data: { user: { id: userId } }, error: { message: 'private auth failure' } });
    await denied(401, 'COURSE_UNAUTHENTICATED');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null], ['inactive', { ...profile, status: 'inactive' }],
    ['foreign Auth subject', { ...profile, id: 'other-user' }],
    ['missing tenant', { ...profile, tenant_id: null }], ['blank tenant', { ...profile, tenant_id: ' ' }],
    ['tenant whitespace', { ...profile, tenant_id: ' own-tenant' }],
  ] as const)('rejects a %s profile before a tenant read', async (_label, value) => {
    currentProfile = value;
    await denied(403);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('denies a failed minimal profile query without exposing its diagnostic', async () => {
    profileError = { message: 'private column ACL diagnostic' };
    await denied(403);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
  it('rejects the foreign tenant selector before its tenant lookup', async () => {
    await denied(403, 'TENANT_ISOLATION_VIOLATION', 'view=catalog&tenantId=foreign');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['missing', null], ['inactive', { ...tenant, status: 'inactive' }],
    ['foreign tenant row', { ...tenant, id: 'foreign' }],
  ] as const)('rejects a %s tenant', async (_label, value) => {
    currentTenant = value;
    await denied(403);
  });
  it('denies a failed tenant query without declaring the Product unsupported', async () => {
    tenantError = { message: 'private RLS failure' };
    await denied(403);
  });
  it.each(['teacher', 'manager', 'owner', 'ADMIN', '', null])('does not alias role %s to admin', async role => {
    currentProfile = { ...profile, role };
    await denied(403);
  });
  it('returns the specific unsupported-Product code only after a valid current session and active own tenant', async () => {
    currentTenant = { ...tenant, product_key: 'bella_training' };
    await denied(403, 'COURSE_CATALOG_UNSUPPORTED_PRODUCT');
    expect(reads).toHaveLength(2);
    currentTenant = { ...tenant, product_key: 'bella_training', status: 'inactive' };
    await denied(403);
  });
  it('rechecks changed role, user status, tenant status, and tenant membership on every call in the same session', async () => {
    expect((await resolveCourseCatalogReadContext(request())).allowed).toBe(true);
    currentProfile = { ...profile, role: 'teacher' };
    await denied(403);
    currentProfile = { ...profile, status: 'inactive' };
    await denied(403);
    currentProfile = { ...profile };
    currentTenant = { ...tenant, status: 'inactive' };
    await denied(403);
    currentProfile = { ...profile, tenant_id: 'other-tenant' };
    await denied(403, 'TENANT_ISOLATION_VIOLATION', `view=catalog&tenantId=${tenantId}`);
    expect(mockGetUser).toHaveBeenCalledTimes(5);
  });
});
