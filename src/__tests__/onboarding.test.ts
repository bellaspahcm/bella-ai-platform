/**
 * Tests for Tenant Onboarding, Product Selection, and post-onboarding updates.
 * Mocks: next/cache, @sentry/nextjs, @/lib/supabase-server, and audit actions.
 */

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

// Bypass Next.js server-only check
jest.mock('server-only', () => ({}), { virtual: true });

// Setup global spies and mocks
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSessionRpc = jest.fn();
const mockSessionFrom = jest.fn();
const mockSignUp = jest.fn();
const mockCheckHqAuth = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: mockSessionRpc,
    from: mockSessionFrom,
    auth: { signUp: mockSignUp },
  })),
}));

jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: () => mockCheckHqAuth(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

// Helper class for mock query builders
type MockQueryResult = {
  data: unknown;
  error: unknown;
};

class MockQueryBuilder {
  public data: unknown;
  public error: unknown;
  public insertSpy = jest.fn().mockReturnThis();
  public updateSpy = jest.fn().mockReturnThis();
  public eqSpy = jest.fn().mockReturnThis();

  constructor(data: unknown = null, error: unknown = null) {
    this.data = data;
    this.error = error;
  }

  select() { return this; }
  eq(...args: unknown[]) { this.eqSpy(...args); return this; }
  insert(...args: unknown[]) { this.insertSpy(...args); return this; }
  update(...args: unknown[]) { this.updateSpy(...args); return this; }

  then(onfulfilled: (value: MockQueryResult) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

import { registerNewTenant } from '../services/onboarding-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { safeRevalidatePath } from '@/lib/revalidate';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase-server';

const mockRecordAuditLog = recordAuditLog as jest.Mock;
const mockSafeRevalidatePath = safeRevalidatePath as jest.Mock;
const mockCreateSupabaseJsClient = createSupabaseJsClient as jest.Mock;
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();

describe('Tenant Onboarding System (Product Selection)', () => {
  let tenantQueryMock: MockQueryBuilder;
  let orgUnitQueryMock: MockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default setup: mock service role key for bypassing email signup
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_URL;
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'mock-auth-user-id' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
    mockCheckHqAuth.mockResolvedValue({
      authorized: true,
      user: { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant' },
    });
    mockCreateSupabaseJsClient.mockReturnValue({
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: mockDeleteUser,
        },
      },
      from: mockFrom,
      rpc: mockRpc,
    });

    tenantQueryMock = new MockQueryBuilder({ success: true });
    orgUnitQueryMock = new MockQueryBuilder({ success: true });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return tenantQueryMock;
      if (table === 'org_units') return orgUnitQueryMock;
      return new MockQueryBuilder();
    });

    // Mock successful RPC calls
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: 'mock-tenant-id-123', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    expect(createSessionClient).not.toHaveBeenCalled();
    expect(mockSessionRpc).not.toHaveBeenCalled();
    expect(mockSessionFrom).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
  });

  it.each([
    { missing: 'admin key', publicUrl: 'http://127.0.0.1:1', serverUrl: '', serviceKey: '' },
    { missing: 'admin URL', publicUrl: '', serverUrl: '', serviceKey: 'mock-service-role-key' },
    { missing: 'admin URL and key', publicUrl: '', serverUrl: '', serviceKey: '' },
  ])('fails before provisioning when $missing is missing', async ({ publicUrl, serverUrl, serviceKey }) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = publicUrl;
    process.env.SUPABASE_URL = serverUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

    const result = await registerNewTenant({
      spaName: 'BabyCare Setup Unavailable',
      contactPhone: '0900000000',
      address: 'Synthetic address',
      email: 'tenant@bella.test',
      adminName: 'Test Admin',
      adminEmail: 'admin@bella.test',
      productKey: 'bella_babycare',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('ONBOARDING_SETUP_UNAVAILABLE');
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
    expect(mockCheckHqAuth).not.toHaveBeenCalled();
  });

  it('should successfully onboard a BabyCare tenant with explicit product identity', async () => {
    const input = {
      spaName: 'Bella Spa Quận 2',
      contactPhone: '0912345678',
      address: '123 Trần Não, Quận 2',
      email: 'q2@bellaspa.vn',
      adminName: 'Vy Nguyễn',
      adminEmail: 'vy.nguyen@bellaspa.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_babycare' as const,
      businessModule: 'babycare' as const,
    };

    const result = await registerNewTenant(input);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.tenantId).toBe('mock-tenant-id-123');

    // Verify onboard_tenant RPC was called
    expect(mockRpc).toHaveBeenCalledWith('onboard_tenant', expect.objectContaining({
      p_spa_name: 'Bella Spa Quận 2',
      p_admin_name: 'Vy Nguyễn',
    }));

    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      product_key: 'bella_babycare',
      enabled_modules: expect.objectContaining({ babycare: true, beauty_spa: false, bella_education: false }),
    }));
    expect(tenantQueryMock.eqSpy).toHaveBeenCalledWith('id', 'mock-tenant-id-123');
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INSERT',
      table_name: 'tenants',
      record_id: 'mock-tenant-id-123',
      new_data: expect.objectContaining({
        product_key: 'bella_babycare',
        business_module: 'babycare',
        enabled_modules: expect.objectContaining({ babycare: true, beauty_spa: false, bella_education: false }),
      }),
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRecordAuditLog.mock.invocationCallOrder[0]).toBeLessThan(
      mockSafeRevalidatePath.mock.invocationCallOrder[0],
    );
    expect(mockCheckHqAuth).not.toHaveBeenCalled();
  });

  it('should block Beauty Spa onboarding outside Admin HQ before auth and database writes', async () => {
    mockCheckHqAuth.mockResolvedValueOnce({
      authorized: false,
      error: 'Trang này chỉ dành cho quản trị viên Tổng bộ.',
    });

    const result = await registerNewTenant({
      spaName: 'Beauty Spa External',
      contactPhone: '0912345678',
      address: '123 Beauty',
      email: 'beauty@external.vn',
      adminName: 'Beauty Admin',
      adminEmail: 'beauty.admin@external.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_spa',
      businessModule: 'beauty_spa',
    });

    expect(result).toEqual({
      success: false,
      error: 'Chỉ Admin HQ mới được setup tenant sản phẩm này.',
    });
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should block English Center onboarding outside Admin HQ before auth and database writes', async () => {
    mockCheckHqAuth.mockResolvedValueOnce({
      authorized: false,
      error: 'Trang này chỉ dành cho quản trị viên Tổng bộ.',
    });

    const result = await registerNewTenant({
      spaName: 'English Center External',
      contactPhone: '0912345678',
      address: '123 English',
      email: 'english@external.vn',
      adminName: 'English Admin',
      adminEmail: 'english.admin@external.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_english_center',
      businessModule: 'bella_education',
    });

    expect(result).toEqual({
      success: false,
      error: 'Chỉ Admin HQ mới được setup tenant sản phẩm này.',
    });
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should allow Admin HQ to onboard a Beauty Spa tenant locked to Beauty Spa only', async () => {
    const result = await registerNewTenant({
      spaName: 'Beauty Spa Premium',
      contactPhone: '0912345678',
      address: '123 Beauty',
      email: 'beauty@spa.vn',
      adminName: 'Beauty Admin',
      adminEmail: 'beauty.admin@spa.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_spa',
      businessModule: 'beauty_spa',
    });

    expect(result.success).toBe(true);
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      product_key: 'bella_spa',
      enabled_modules: expect.objectContaining({ babycare: false, beauty_spa: true, student_training: false, industrial_cleaning: false, real_estate: false }),
    }));
    expect(tenantQueryMock.updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      enabled_modules: expect.objectContaining({ babycare: true }),
    }));
    expect(tenantQueryMock.eqSpy).toHaveBeenCalledWith('id', 'mock-tenant-id-123');
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      new_data: expect.objectContaining({
        product_key: 'bella_spa',
        business_module: 'beauty_spa',
        enabled_modules: expect.objectContaining({ babycare: false, beauty_spa: true, student_training: false, industrial_cleaning: false, real_estate: false }),
      }),
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('should map Haircut, Nail, and Preschool product keys to their required modules', async () => {
    const cases = [
      {
        productKey: 'bella_haircut' as const,
        businessModule: 'beauty_spa' as const,
        enabled: { beauty_spa: true, babycare: false, bella_education: false },
      },
      {
        productKey: 'bella_nail' as const,
        businessModule: 'beauty_spa' as const,
        enabled: { beauty_spa: true, babycare: false, bella_education: false },
      },
      {
        productKey: 'bella_preschool' as const,
        businessModule: 'bella_education' as const,
        enabled: { beauty_spa: false, babycare: false, bella_education: true },
      },
      {
        productKey: 'bella_english_center' as const,
        businessModule: 'bella_education' as const,
        enabled: { beauty_spa: false, babycare: false, bella_education: true },
      },
      {
        productKey: 'bella_hospitality' as const,
        businessModule: 'hospitality' as const,
        enabled: { beauty_spa: false, babycare: false, bella_education: false },
        hospitality: {
          profileId: 'homestay',
          configuration: {
            frontDeskMode: 'self_check_in',
            housekeepingCadence: 'turnover_only',
            maintenancePriority: 'owner_approval_required',
          },
        },
      },
    ];

    for (const item of cases) {
      jest.clearAllMocks();
      tenantQueryMock = new MockQueryBuilder({ success: true });
      orgUnitQueryMock = new MockQueryBuilder({ success: true });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'tenants') return tenantQueryMock;
        if (table === 'org_units') return orgUnitQueryMock;
        return new MockQueryBuilder();
      });
      mockCheckHqAuth.mockResolvedValue({
        authorized: true,
        user: { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant' },
      });

      const result = await registerNewTenant({
        spaName: `${item.productKey} Tenant`,
        contactPhone: '0912345678',
        address: '123 Product',
        email: `${item.productKey}@tenant.vn`,
        adminName: 'Product Admin',
        adminEmail: `${item.productKey}.admin@tenant.vn`,
        adminPassword: 'Password123!',
        productKey: item.productKey,
        hospitality: item.hospitality,
      });

      expect(result.success).toBe(true);
      expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        product_key: item.productKey,
        enabled_modules: expect.objectContaining(item.enabled),
      }));
      expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        new_data: expect.objectContaining({
          product_key: item.productKey,
          business_module: item.businessModule,
          enabled_modules: expect.objectContaining(item.enabled),
        }),
      }));
    }
  });

  it('should persist validated Hospitality tenant profile config for bella_hospitality', async () => {
    const result = await registerNewTenant({
      spaName: 'Bella Hotel Saigon',
      contactPhone: '0912345678',
      address: '123 Hospitality',
      email: 'hotel@bella.vn',
      adminName: 'Hotel Admin',
      adminEmail: 'hotel.admin@bella.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_hospitality',
      hospitality: {
        profileId: 'hotel',
        configuration: {
          frontDeskMode: 'scheduled',
          housekeepingCadence: 'on_request',
          maintenancePriority: 'standard',
        },
      },
    });

    expect(result.success).toBe(true);
    expect(mockCheckHqAuth).toHaveBeenCalledTimes(1);
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      product_key: 'bella_hospitality',
      enabled_modules: expect.objectContaining({
        babycare: false,
        beauty_spa: false,
        bella_education: false,
      }),
      metadata: {
        hospitality: expect.objectContaining({
          schemaVersion: 1,
          profileId: 'hotel',
          displayName: 'Hotel',
          capabilities: expect.arrayContaining([
            'property_rooms',
            'guest_reservations',
            'front_office_stays',
            'folios',
            'housekeeping',
            'maintenance',
          ]),
          configuration: {
            frontDeskMode: 'scheduled',
            housekeepingCadence: 'on_request',
            maintenancePriority: 'standard',
          },
        }),
      },
    }));
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      new_data: expect.objectContaining({
        product_key: 'bella_hospitality',
        business_module: 'hospitality',
      }),
    }));
  });

  it('should reject unknown Hospitality profiles before auth and database writes', async () => {
    const result = await registerNewTenant({
      spaName: 'Unknown Hospitality',
      contactPhone: '0912345678',
      address: '123 Hospitality',
      email: 'unknown@bella.vn',
      adminName: 'Unknown Admin',
      adminEmail: 'unknown.admin@bella.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_hospitality',
      hospitality: {
        profileId: 'villa',
      },
    });

    expect(result).toEqual({
      success: false,
      error: 'Hospitality profile không được hỗ trợ.',
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('should reject unsupported Hospitality config settings before auth and database writes', async () => {
    const result = await registerNewTenant({
      spaName: 'Unsupported Hospitality',
      contactPhone: '0912345678',
      address: '123 Hospitality',
      email: 'unsupported@bella.vn',
      adminName: 'Unsupported Admin',
      adminEmail: 'unsupported.admin@bella.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_hospitality',
      hospitality: {
        profileId: 'hotel',
        configuration: {
          channelManagerMode: 'ota',
        },
      },
    });

    expect(result).toEqual({
      success: false,
      error: 'Hospitality config không hỗ trợ: channelManagerMode.',
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('should reject incompatible Hospitality config settings before auth and database writes', async () => {
    const result = await registerNewTenant({
      spaName: 'Incompatible Hospitality',
      contactPhone: '0912345678',
      address: '123 Hospitality',
      email: 'incompatible@bella.vn',
      adminName: 'Incompatible Admin',
      adminEmail: 'incompatible.admin@bella.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_hospitality',
      hospitality: {
        profileId: 'short_stay_rental',
        configuration: {
          frontDeskMode: 'full_service',
        },
      },
    });

    expect(result).toEqual({
      success: false,
      error: 'Hospitality frontDeskMode không tương thích với profile đã chọn.',
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('should keep non-Hospitality onboarding working without a Hospitality profile', async () => {
    const result = await registerNewTenant({
      spaName: 'Beauty Spa No Hospitality Profile',
      contactPhone: '0912345678',
      address: '123 Beauty',
      email: 'beauty.no.profile@spa.vn',
      adminName: 'Beauty Admin',
      adminEmail: 'beauty.no.profile.admin@spa.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_spa',
      businessModule: 'beauty_spa',
    });

    expect(result.success).toBe(true);
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      product_key: 'bella_spa',
      enabled_modules: expect.objectContaining({
        babycare: false,
        beauty_spa: true,
        bella_education: false,
      }),
    }));
    expect(tenantQueryMock.updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.any(Object),
    }));
  });

  it('should create a default Platform branch when Admin HQ onboards English Center', async () => {
    const result = await registerNewTenant({
      spaName: 'English Center HQ Runtime',
      contactPhone: '0912345678',
      address: '123 English Runtime',
      email: 'english.runtime@tenant.vn',
      adminName: 'English Runtime Admin',
      adminEmail: 'english.runtime.admin@tenant.vn',
      adminPassword: 'Password123!',
      productKey: 'bella_english_center',
      businessModule: 'bella_education',
    });

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('org_units');
    expect(orgUnitQueryMock.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'mock-tenant-id-123',
      unit_type: 'branch',
      name: 'English Center HQ Runtime',
      code: 'MAIN',
      is_active: true,
      metadata: expect.objectContaining({
        source: 'hq_onboarding',
        productKey: 'bella_english_center',
        address: '123 English Runtime',
        phone: '0912345678',
        email: 'english.runtime@tenant.vn',
      }),
    }));
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      new_data: expect.objectContaining({
        product_key: 'bella_english_center',
        business_module: 'bella_education',
      }),
    }));
  });

  it('should successfully onboard a Franchise branch and update agreement date and royalty type', async () => {
    const input = {
      spaName: 'Bella Spa Thủ Đức',
      contactPhone: '0987654321',
      address: '456 Võ Văn Ngân, Thủ Đức',
      email: 'thuduc@bellaspa.vn',
      adminName: 'Trang Phạm',
      adminEmail: 'trang.pham@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'franchise' as const,
    };

    const result = await registerNewTenant(input);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.tenantId).toBe('mock-tenant-id-123');

    // Verify the tenants table was queried for updates
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    
    // Verify the update contained correct franchise values
    const today = new Date().toISOString().split('T')[0];
    expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      franchise_agreement_date: today,
      royalty_type: 'percentage',
    }));

    // Verify the correct tenant ID was targeted
    expect(tenantQueryMock.eqSpy).toHaveBeenCalledWith('id', 'mock-tenant-id-123');
  });

  it('should correctly propagate errors and fail the onboarding if the franchise post-update query fails', async () => {
    const input = {
      spaName: 'Bella Spa Bình Thạnh',
      contactPhone: '0909090909',
      address: '789 Điện Biên Phủ, Bình Thạnh',
      email: 'binhthanh@bellaspa.vn',
      adminName: 'Hương Lê',
      adminEmail: 'huong.le@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'franchise' as const,
    };

    // Configure the update mock to fail
    tenantQueryMock = new MockQueryBuilder(null, { message: 'Database constraint violation' });

    const result = await registerNewTenant(input);

    // Verify failure propagation (Zero Silent Database Failures)
    expect(result.success).toBe(false);
    expect(result.error).toContain('Lỗi cập nhật cấu hình nhượng quyền: Database constraint violation');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should roll back the admin auth user when database onboarding fails after auth creation', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: null, error: { message: 'onboard tenant failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await registerNewTenant({
      spaName: 'Bella Spa Test',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'test@bellaspa.vn',
      adminName: 'Admin Test',
      adminEmail: 'admin.test@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('onboard tenant failed');
    expect(mockDeleteUser).toHaveBeenCalledWith('mock-auth-user-id');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should report auth cleanup failure when database onboarding and cleanup both fail', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'onboard_tenant') {
        return Promise.resolve({ data: null, error: { message: 'onboard tenant failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockDeleteUser.mockResolvedValueOnce({ error: { message: 'delete auth failed' } });

    const result = await registerNewTenant({
      spaName: 'Bella Spa Cleanup Fail',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'cleanup@bellaspa.vn',
      adminName: 'Admin Cleanup',
      adminEmail: 'cleanup.admin@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('onboard tenant failed');
    expect(result.error).toContain('auth cleanup failed: delete auth failed');
    expect(mockDeleteUser).toHaveBeenCalledWith('mock-auth-user-id');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('should fail onboarding explicitly when audit logging fails after tenant creation', async () => {
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await registerNewTenant({
      spaName: 'Bella Spa Audit Fail',
      contactPhone: '0912345678',
      address: '123 Test',
      email: 'audit@bellaspa.vn',
      adminName: 'Admin Audit',
      adminEmail: 'audit.admin@bellaspa.vn',
      adminPassword: 'Password123!',
      branchType: 'owned',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to record onboarding audit log: audit unavailable');
    expect(result.data).toEqual({
      tenantId: 'mock-tenant-id-123',
      userId: 'mock-auth-user-id',
      email: 'audit.admin@bellaspa.vn',
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
