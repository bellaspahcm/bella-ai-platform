import { getTenantPresentation } from '@/services/tenant-actions';

const mockUser = jest.fn();
const mockRpc = jest.fn();
const mockAdmin = jest.fn();
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockUser() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ rpc: mockRpc }) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockAdmin(...args) }));
jest.mock('@/services/audit-actions', () => ({ recordAuditLog: jest.fn() }));
jest.mock('@/lib/redis-cache', () => ({ getCache: jest.fn(), setCache: jest.fn() }));

describe('minimal tenant presentation read', () => {
  const tenant = { tenant_id: 'tenant', tenant_status: 'active', name: 'Synthetic tenant', product_key: 'bella_preschool',
    enabled_modules: { bella_education: true }, brand_theme: {}, logo_url: null };
  const expectedPresentation = { id: 'tenant', name: 'Synthetic tenant', status: 'active', product_key: 'bella_preschool',
    enabled_modules: { bella_education: true }, brand_theme: {}, logo_url: null };
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockResolvedValue({ id: 'user', tenant_id: 'tenant', role: 'admin' });
    mockRpc.mockResolvedValue({ data: [tenant], error: null });
  });

  it('reads only the authenticated actor presentation through a zero-argument contract', async () => {
    expect(await getTenantPresentation()).toEqual(expectedPresentation);
    expect(mockRpc).toHaveBeenCalledWith('platform_current_actor_tenant_presentation');
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each(['42501', '42883', '08006'])('denies without service fallback on %s', async code => {
    mockRpc.mockResolvedValue({ data: null, error: { code } });
    expect(await getTenantPresentation()).toBeNull();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    [tenant, tenant],
    [{ ...tenant, tenant_status: 'suspended' }],
    [{ ...tenant, tenant_id: 'foreign' }],
    [{ ...tenant, enabled_modules: null }],
  ])('does not substitute or accept an invalid tenant projection %p', async data => {
    mockRpc.mockResolvedValue({ data, error: null });
    expect(await getTenantPresentation()).toBeNull();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it('does not read without a validated user/tenant', async () => {
    mockUser.mockResolvedValue(null);
    expect(await getTenantPresentation()).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
