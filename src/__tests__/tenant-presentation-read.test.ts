import { getTenantPresentation } from '@/services/tenant-actions';

const mockUser = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockAdmin = jest.fn();
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockUser() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => ({ from: () => ({ select: mockSelect }) }) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockAdmin(...args) }));
jest.mock('@/services/audit-actions', () => ({ recordAuditLog: jest.fn() }));
jest.mock('@/lib/redis-cache', () => ({ getCache: jest.fn(), setCache: jest.fn() }));

describe('minimal tenant presentation read', () => {
  const tenant = { id: 'tenant', name: 'Synthetic tenant', status: 'active', product_key: 'bella_preschool',
    enabled_modules: { bella_education: true }, brand_theme: {}, logo_url: null };
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockResolvedValue({ id: 'user', tenant_id: 'tenant', role: 'admin' });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: tenant, error: null });
  });

  it('reads exact presentation fields with live own-tenant selector', async () => {
    expect(await getTenantPresentation()).toEqual(tenant);
    expect(mockSelect).toHaveBeenCalledWith('id, name, status, product_key, enabled_modules, brand_theme, logo_url');
    expect(mockEq).toHaveBeenCalledWith('id', 'tenant');
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each(['42501', '42703', '08006'])('denies without service fallback on %s', async code => {
    mockSingle.mockResolvedValue({ data: null, error: { code } });
    expect(await getTenantPresentation()).toBeNull();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each([null, { ...tenant, status: 'suspended' }, { ...tenant, id: 'foreign' }])('does not substitute a tenant for %p', async data => {
    mockSingle.mockResolvedValue({ data, error: null });
    expect(await getTenantPresentation()).toBeNull();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it('does not read without a validated user/tenant', async () => {
    mockUser.mockResolvedValue(null);
    expect(await getTenantPresentation()).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
