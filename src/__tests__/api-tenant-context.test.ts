/** Tenant-context consumer uses installed self-profile and current-tenant contracts. */
const mockGetUser = jest.fn();
const mockRpc = jest.fn();
const mockTenantSettings = jest.fn();
const mockFrom = jest.fn(() => { throw new Error('Unexpected direct table read'); });

jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ getAll: () => [], set: jest.fn() })) }));
jest.mock('@/services/tenant-actions', () => ({ getTenantSettings: () => mockTenantSettings() }));
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({ auth: { getUser: mockGetUser }, rpc: mockRpc, from: mockFrom })),
  combineChunks: jest.fn(async (key: string, retrieve: (name: string) => string | null | undefined | Promise<string | null | undefined>) => {
    const whole = await retrieve(key);
    if (whole) return whole;
    const chunks: string[] = [];
    for (let index = 0; ; index += 1) {
      const chunk = await retrieve(`${key}.${index}`);
      if (!chunk) break;
      chunks.push(chunk);
    }
    return chunks.length ? chunks.join('') : null;
  }),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { getUser: mockGetUser }, rpc: mockRpc, from: mockFrom })),
}));

import { GET } from '@/app/api/tenant/context/route';
import { NextRequest } from 'next/server';

const user = { id: 'user-123', email: 'test@example.com' };
const profile = { ...user, tenant_id: 'tenant-123', role: 'accountant', status: 'active',
  tenant_status: 'active', full_name: null, avatar_url: null };
const tenant = { id: profile.tenant_id, status: 'active', name: 'Test Spa', enabled_modules: ['spa', 'babycare'],
  subscription_tier: 'professional', role_permissions: { feature_flags: { inventory_transfer: false } },
  brand_theme: { logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733' },
  logo_url: null, salary_config: { base_salary: 5000000 }, qr_bank_code: 'VCB',
  qr_account_number: '1234567890', qr_account_name: 'Test Spa', contact_phone: '0123456789',
  email: 'contact@testspa.com', address: '123 Test Street' };
const request = () => new NextRequest('http://localhost/api/tenant/context');

describe('GET /api/tenant/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user }, error: null });
    mockRpc.mockReset().mockResolvedValue({ data: [profile], error: null });
    mockTenantSettings.mockReset().mockResolvedValue(tenant);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('returns401 before profile/configuration when anonymous', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request())).status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockTenantSettings).not.toHaveBeenCalled();
  });

  it('does not fabricate a tenant for anonymous development requests or mock headers', async () => {
    const previous = process.env;
    process.env = { ...previous, NODE_ENV: 'development' };
    try {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      expect((await GET(new NextRequest('http://localhost/api/tenant/context', {
        headers: { 'x-mock-user-email': 'admin@medical.vn' },
      }))).status).toBe(401);
      expect(mockTenantSettings).not.toHaveBeenCalled();
    } finally { process.env = previous; }
  });

  it.each(['whole', 'chunked', 'raw-header', 'web-runtime'])('keeps validated %s cookie recovery when SSR session is unavailable', async (mode) => {
    const accessToken = 'valid-cookie-access-token';
    const cookie = `base64-${Buffer.from(JSON.stringify({ access_token: accessToken })).toString('base64url')}`;
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing' } })
      .mockResolvedValueOnce({ data: { user }, error: null });
    const header = mode === 'chunked'
      ? `sb-project-ref-auth-token.0=${cookie.slice(0, 18)}; sb-project-ref-auth-token.1=${cookie.slice(18)}`
      : `sb-project-ref-auth-token=${mode === 'raw-header' ? encodeURIComponent(cookie) : cookie}`;
    const input = new NextRequest('http://localhost/api/tenant/context', { headers: { Cookie: header } });
    if (mode === 'raw-header') Object.defineProperty(input, 'cookies', { value: { getAll: () => [] } });
    const originalBuffer = globalThis.Buffer;
    if (mode === 'web-runtime') Object.defineProperty(globalThis, 'Buffer', { configurable: true, value: undefined });
    try {
      const response = await GET(input);
      expect(response.status).toBe(200);
      expect(mockGetUser).toHaveBeenNthCalledWith(2, accessToken);
      expect(mockRpc).toHaveBeenCalledWith('platform_current_actor_profile');
      expect(await response.json()).toMatchObject({ tenantId: tenant.id, tenantName: tenant.name });
      const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
      expect(createClient).toHaveBeenCalledWith('https://project-ref.supabase.co', 'publishable-key',
        expect.objectContaining({ global: { headers: { Authorization: `Bearer ${accessToken}` } } }));
    } finally {
      if (mode === 'web-runtime') Object.defineProperty(globalThis, 'Buffer', { configurable: true, value: originalBuffer });
    }
  });

  it('does not trust a cookie token rejected by Auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    const cookie = `base64-${Buffer.from(JSON.stringify({ access_token: 'invalid' })).toString('base64url')}`;
    expect((await GET(new NextRequest('http://localhost/api/tenant/context', {
      headers: { Cookie: `sb-project-ref-auth-token=${cookie}` },
    }))).status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockTenantSettings).not.toHaveBeenCalled();
  });

  it('validates a Bearer token with Auth when no SSR cookie session is available', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing' } })
      .mockResolvedValueOnce({ data: { user }, error: null });
    expect((await GET(new NextRequest('http://localhost/api/tenant/context', {
      headers: { Authorization: 'Bearer validated-access-token' },
    }))).status).toBe(200);
    expect(mockGetUser).toHaveBeenNthCalledWith(2, 'validated-access-token');
    expect(mockRpc).toHaveBeenCalledWith('platform_current_actor_profile');
  });

  it.each([{ profiles: [] }, { profiles: [{ ...profile, tenant_id: null }] }, { profiles: [{ ...profile, id: 'foreign-user' }] },
    { profiles: [{ ...profile, status: 'inactive' }] }, { profiles: [{ ...profile, tenant_status: 'inactive' }] }])('denies invalid current actor profile (%j)', async ({ profiles }) => {
    mockRpc.mockResolvedValue({ data: profiles, error: null });
    expect((await GET(request())).status).toBe(403);
    expect(mockTenantSettings).not.toHaveBeenCalled();
  });

  it.each([['42501', 403], ['08006', 500]])('fails closed on profile error %s', async (code, status) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: 'profile unavailable' } });
    expect((await GET(request())).status).toBe(status);
    expect(mockTenantSettings).not.toHaveBeenCalled();
  });

  it.each([null, 'throw'])('fails closed if the existing settings service cannot return data (%s)', async (result) => {
    if (result === 'throw') mockTenantSettings.mockRejectedValue(new Error('database unavailable'));
    else mockTenantSettings.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(500);
  });

  it.each([{ ...tenant, id: 'foreign-tenant' }, { ...tenant, status: 'inactive' }])('denies configuration mismatched with current active tenant (%j)', async (result) => {
    mockTenantSettings.mockResolvedValue(result);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty('tenantName');
  });

  it('preserves TenantContext mapping without table reads or private fields', async () => {
    mockTenantSettings.mockResolvedValue({ ...tenant, private_field: 'not-public' });
    const response = await GET(new NextRequest('http://localhost/api/tenant/context?tenantId=foreign-tenant'));
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('platform_current_actor_profile');
    expect(mockTenantSettings).toHaveBeenCalledWith();
    expect(mockFrom).not.toHaveBeenCalled();
    const data = await response.json();
    expect(data).toMatchObject({ tenantId: tenant.id, tenantName: tenant.name, enabledModules: tenant.enabled_modules,
      subscriptionPlan: 'professional', featureFlags: { inventory_transfer: false },
      settings: { currency: 'VND', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', companyName: tenant.name,
        logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733', salaryConfig: tenant.salary_config,
        qrPayment: { bankCode: 'VCB', accountNumber: '1234567890', accountName: 'Test Spa' },
        contact: { phone: tenant.contact_phone, email: tenant.email, address: tenant.address } } });
    expect(data).not.toHaveProperty('private_field');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });

  it('retains existing mapping defaults for minimal tenant configuration', async () => {
    mockTenantSettings.mockResolvedValue({ id: tenant.id, name: tenant.name, status: 'active' });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabledModules: ['spa'], subscriptionPlan: 'basic',
      featureFlags: {}, settings: { currency: 'VND', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', companyName: tenant.name } });
  });

  it('transports canonical Product identity and only safe branding fields from the trusted tenant', async () => {
    mockTenantSettings.mockResolvedValue({ ...tenant, product_key: 'bella_preschool',
      enabled_modules: { babycare: true }, brand_theme: { brandName: 'Custom School', primaryColor: '#6D28D9',
        fontHeading: 'sans', private_field: 'not-public' } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.productKey).toBe('bella_preschool');
    expect(data.settings.brandTheme).toEqual({ brandName: 'Custom School', primaryColor: '#6D28D9', fontHeading: 'sans' });
  });
});
