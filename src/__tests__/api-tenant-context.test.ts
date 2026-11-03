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
import { CURRENT_ACTOR_PROFILE_RPC, CURRENT_ACTOR_TENANT_PRESENTATION_RPC } from '@/platform/security/current-actor.contract';

const user = { id: 'user-123', email: 'test@example.com' };
const profile = { ...user, tenant_id: 'tenant-123', role: 'accountant', status: 'active',
  tenant_status: 'active', full_name: null, avatar_url: null };
const tenant = { tenant_id: profile.tenant_id, tenant_status: 'active', name: 'Test School',
  product_key: 'bella_preschool', enabled_modules: { bella_education: true },
  brand_theme: { logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733' }, logo_url: null };
const legacyTenant = { id: profile.tenant_id, status: 'active', name: 'Legacy Product Tenant',
  enabled_modules: ['spa', 'babycare'], subscription_tier: 'professional',
  role_permissions: { feature_flags: { inventory_transfer: false } },
  brand_theme: { logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733' }, logo_url: null,
  salary_config: { base_salary: 5000000 }, qr_bank_code: 'VCB', qr_account_number: '1234567890',
  qr_account_name: 'Legacy Tenant', contact_phone: '0123456789', email: 'contact@example.test', address: 'Test address' };
const request = () => new NextRequest('http://localhost/api/tenant/context');

describe('GET /api/tenant/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user }, error: null });
    mockRpc.mockReset().mockImplementation((name: string) => Promise.resolve({
      data: name === CURRENT_ACTOR_PROFILE_RPC ? [profile] : [tenant], error: null,
    }));
    mockTenantSettings.mockReset().mockResolvedValue(legacyTenant);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('returns401 before profile/configuration when anonymous', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request())).status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does not fabricate a tenant for anonymous development requests or mock headers', async () => {
    const previous = process.env;
    process.env = { ...previous, NODE_ENV: 'development' };
    try {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      expect((await GET(new NextRequest('http://localhost/api/tenant/context', {
        headers: { 'x-mock-user-email': 'admin@medical.vn' },
      }))).status).toBe(401);
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
      expect(mockRpc).toHaveBeenNthCalledWith(1, CURRENT_ACTOR_PROFILE_RPC);
      expect(mockRpc).toHaveBeenNthCalledWith(2, CURRENT_ACTOR_TENANT_PRESENTATION_RPC);
      expect(await response.json()).toMatchObject({ tenantId: tenant.tenant_id, tenantName: tenant.name });
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
  });

  it('validates a Bearer token with Auth when no SSR cookie session is available', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing' } })
      .mockResolvedValueOnce({ data: { user }, error: null });
    expect((await GET(new NextRequest('http://localhost/api/tenant/context', {
      headers: { Authorization: 'Bearer validated-access-token' },
    }))).status).toBe(200);
    expect(mockGetUser).toHaveBeenNthCalledWith(2, 'validated-access-token');
    expect(mockRpc).toHaveBeenNthCalledWith(1, CURRENT_ACTOR_PROFILE_RPC);
    expect(mockRpc).toHaveBeenNthCalledWith(2, CURRENT_ACTOR_TENANT_PRESENTATION_RPC);
  });

  it.each([{ profiles: [] }, { profiles: [{ ...profile, tenant_id: null }] }, { profiles: [{ ...profile, id: 'foreign-user' }] },
    { profiles: [{ ...profile, status: 'inactive' }] }, { profiles: [{ ...profile, tenant_status: 'inactive' }] }])('denies invalid current actor profile (%j)', async ({ profiles }) => {
    mockRpc.mockResolvedValue({ data: profiles, error: null });
    expect((await GET(request())).status).toBe(403);
  });

  it.each([['42501', 403], ['08006', 500]])('fails closed on profile error %s', async (code, status) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: 'profile unavailable' } });
    expect((await GET(request())).status).toBe(status);
  });

  it.each([['42501', 403], ['08006', 500]])('fails closed when the tenant presentation contract returns %s', async (code, status) => {
    mockRpc.mockImplementation((name: string) => Promise.resolve(name === CURRENT_ACTOR_PROFILE_RPC
      ? { data: [profile], error: null }
      : { data: null, error: { code, message: 'tenant presentation unavailable' } }));
    expect((await GET(request())).status).toBe(status);
  });

  it.each([{ ...tenant, tenant_id: 'foreign-tenant' }, { ...tenant, tenant_status: 'inactive' }])('denies tenant presentation mismatched with current active actor (%j)', async (result) => {
    mockRpc.mockImplementation((name: string) => Promise.resolve({
      data: name === CURRENT_ACTOR_PROFILE_RPC ? [profile] : [result], error: null,
    }));
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty('tenantName');
  });

  it('maps the approved tenant projection without direct table reads or sensitive settings', async () => {
    const response = await GET(new NextRequest('http://localhost/api/tenant/context?tenantId=foreign-tenant'));
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenNthCalledWith(1, CURRENT_ACTOR_PROFILE_RPC);
    expect(mockRpc).toHaveBeenNthCalledWith(2, CURRENT_ACTOR_TENANT_PRESENTATION_RPC);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockTenantSettings).not.toHaveBeenCalled();
    const data = await response.json();
    expect(data).toMatchObject({ tenantId: tenant.tenant_id, tenantName: tenant.name, enabledModules: ['bella_education'],
      subscriptionPlan: 'basic', featureFlags: {}, settings: { currency: 'VND', timezone: 'Asia/Ho_Chi_Minh',
        locale: 'vi-VN', companyName: tenant.name, productKey: 'bella_preschool', brandTheme: {
          logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733' },
        logoUrl: 'https://example.com/logo.png', primaryColor: '#FF5733' } });
    expect(data.settings).not.toHaveProperty('salaryConfig');
    expect(data.settings).not.toHaveProperty('qrPayment');
    expect(data.settings).not.toHaveProperty('contact');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });

  it('does not fabricate a product module when the canonical projection has no enabled modules', async () => {
    mockRpc.mockImplementation((name: string) => Promise.resolve({
      data: name === CURRENT_ACTOR_PROFILE_RPC ? [profile] : [{ ...tenant, enabled_modules: {}, brand_theme: {} }], error: null,
    }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabledModules: [], subscriptionPlan: 'basic',
      featureFlags: {}, settings: { currency: 'VND', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', companyName: tenant.name } });
  });

  it('preserves the established full settings response for non-Preschool products', async () => {
    mockRpc.mockImplementation((name: string) => Promise.resolve({
      data: name === CURRENT_ACTOR_PROFILE_RPC ? [profile] : [{ ...tenant, product_key: 'bella_spa' }], error: null,
    }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mockTenantSettings).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      tenantId: legacyTenant.id,
      subscriptionPlan: 'professional',
      featureFlags: { inventory_transfer: false },
      settings: { salaryConfig: legacyTenant.salary_config,
        qrPayment: { bankCode: 'VCB', accountNumber: '1234567890', accountName: 'Legacy Tenant' } },
    });
  });

  it('transports canonical Product identity and only safe branding fields from the trusted tenant', async () => {
    mockRpc.mockImplementation((name: string) => Promise.resolve({
      data: name === CURRENT_ACTOR_PROFILE_RPC ? [profile] : [{ ...tenant,
        enabled_modules: { bella_education: true }, brand_theme: { brandName: 'Custom School', primaryColor: '#6D28D9',
          fontHeading: 'sans', private_field: 'not-public' } }], error: null,
    }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.productKey).toBe('bella_preschool');
    expect(data.settings.brandTheme).toEqual({ brandName: 'Custom School', primaryColor: '#6D28D9', fontHeading: 'sans' });
    expect(data.settings.brandTheme).not.toHaveProperty('private_field');
  });
});
