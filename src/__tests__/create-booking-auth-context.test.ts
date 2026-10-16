import { createBooking } from '@/core/services/order/create-booking-action';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { createClient } from '@/lib/supabase-server';
import {
  createCustomerForBookingIfNeeded,
  findPendingBookingForCustomer,
  resolveBookingTenant,
  upsertBookingRecord,
  recordBookingDepositRevenue,
  createInitialSessionLogs,
} from '@/core/services/order/create-booking-helpers';
import { getCurrentUser } from '@/services/user-actions';

jest.mock('@/services/user-actions', () => ({ getCurrentUser: jest.fn() }));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: jest.fn(),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(),
}));

jest.mock('@/app/api/bookings/check-ktv-availability/route', () => ({
  invalidateAvailabilityCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/core/services/order/create-booking-helpers', () => ({
  buildBookingPayload: jest.fn(async () => ({
    customer_id: 'customer-1',
    package_id: 'package-1',
    package_name: 'Cắt tóc nam cơ bản',
    full_price: 60000,
    deposit_amount: 0,
    total_sessions: 1,
    tenant_id: 'tenant-haircut',
    status: 'deposit_pending',
  })),
  createCustomerForBookingIfNeeded: jest.fn(async () => ({ customerId: 'customer-1', created: false })),
  createInitialSessionLogs: jest.fn(async () => ({ success: true })),
  enforceCreateBookingRateLimit: jest.fn(async () => ({ success: true })),
  findPendingBookingForCustomer: jest.fn(async () => null),
  recordBookingDepositRevenue: jest.fn(async () => ({ success: true })),
  resolveBookingTenant: jest.fn(async () => ({ tenantId: 'tenant-haircut' })),
  upsertBookingRecord: jest.fn(async () => ({
    booking: {
      id: 'booking-1',
      customer_id: 'customer-1',
      package_id: 'package-1',
      tenant_id: 'tenant-haircut',
      status: 'deposit_pending',
    },
  })),
  validateBookingPackageScope: jest.fn(async () => ({ success: true })),
  constructTenantContextForBooking: jest.fn(async () => ({
    context: {
      tenantId: 'tenant-haircut',
      moduleId: 'beauty_spa',
      industryModules: ['beauty_spa'],
      subscriptionPlan: 'basic',
      featureFlags: {},
      settings: {},
    },
  })),
  invokeAdapterValidation: jest.fn(async () => ({ success: true })),
}));

describe('createBooking auth context', () => {
  const mockCreateCustomerForBookingIfNeeded =
    createCustomerForBookingIfNeeded as jest.MockedFunction<typeof createCustomerForBookingIfNeeded>;
  const mockFindPendingBookingForCustomer =
    findPendingBookingForCustomer as jest.MockedFunction<typeof findPendingBookingForCustomer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateCustomerForBookingIfNeeded.mockResolvedValue({ customerId: 'customer-1', created: false });
    mockFindPendingBookingForCustomer.mockResolvedValue(null);
    const tenantProductQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({
        data: { product_key: 'beauty_spa' },
        error: null,
      })),
    };
    (createDevelopmentBypassClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'tenants') {
          return tenantProductQuery;
        }
        throw new Error(`Unexpected table query in createBooking auth-context test: ${table}`);
      }),
      auth: { getUser: jest.fn() },
    });
  });

  it('uses the existing request/dev-bypass Supabase client instead of a raw server client', async () => {
    const result = await createBooking({
      customer_id: 'customer-1',
      package_id: 'package-1',
      package_name: 'Cắt tóc nam cơ bản',
      full_price: 60000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: '2026-09-29',
      preferred_time: '10:30',
    });

    expect(result).toEqual({
      data: expect.objectContaining({
        id: 'booking-1',
        tenant_id: 'tenant-haircut',
        package_id: 'package-1',
      }),
    });
    expect(createDevelopmentBypassClient).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('skips pending booking lookup when the customer was created in the same request', async () => {
    mockCreateCustomerForBookingIfNeeded.mockResolvedValueOnce({
      customerId: 'customer-new',
      created: true,
    });

    const result = await createBooking({
      customer_id: 'new',
      newCustomer: {
        phone: '0901234567',
        name_mother: 'Nguyen Thi A',
      },
      package_id: 'package-1',
      package_name: 'Chăm sóc mẹ bé',
      full_price: 60000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: '2026-09-29',
      preferred_time: '10:30',
    });

    expect(result).toEqual({ data: expect.objectContaining({ id: 'booking-1' }) });
    expect(mockFindPendingBookingForCustomer).not.toHaveBeenCalled();
  });

  it('keeps pending booking lookup for existing customers', async () => {
    mockCreateCustomerForBookingIfNeeded.mockResolvedValueOnce({
      customerId: 'customer-existing',
      created: false,
    });

    const result = await createBooking({
      customer_id: 'customer-existing',
      package_id: 'package-1',
      package_name: 'Chăm sóc mẹ bé',
      full_price: 60000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: '2026-09-29',
      preferred_time: '10:30',
    });

    expect(result).toEqual({ data: expect.objectContaining({ id: 'booking-1' }) });
    expect(mockFindPendingBookingForCustomer).toHaveBeenCalledWith(
      expect.any(Object),
      'customer-existing',
      'tenant-haircut',
    );
  });

  it.each([undefined, null, '', 'invalid', '10839580-7b7e-4da7-8b7b-16ad686c3a3e'])(
    'rejects invalid Nail branch before any business mutation: %s', async branchId => {
      (resolveBookingTenant as jest.Mock).mockResolvedValueOnce({ tenantId: 'tenant-nail', currentUserId: 'operator' });
      (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'operator', tenant_id: 'tenant-nail', role: 'admin' });
      (createDevelopmentBypassClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table !== 'tenants') throw new Error(`Unexpected mutation/query before branch validation: ${table}`);
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn(async () => ({ data: { product_key: 'bella_nail' }, error: null })) };
        }),
      });
      (createClient as jest.Mock).mockResolvedValue({
        from: jest.fn((table: string) => {
          if (table !== 'org_units') throw new Error(`Unexpected table: ${table}`);
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve: (result: { data: never[]; error: null }) => unknown) => Promise.resolve(resolve({ data: [], error: null })) };
        }),
      });
      const result = await createBooking({
        customer_id: 'new', newCustomer: { phone: 'TEST-ONLY', name_mother: 'Synthetic' },
        full_price: 300000, deposit_amount: 0, total_sessions: 2,
        metadata: { branch_id: branchId },
      });
      expect(result).toEqual({ error: expect.any(String) });
      expect(createCustomerForBookingIfNeeded).not.toHaveBeenCalled();
      expect(upsertBookingRecord).not.toHaveBeenCalled();
      expect(recordBookingDepositRevenue).not.toHaveBeenCalled();
      expect(createInitialSessionLogs).not.toHaveBeenCalled();
    },
  );

  it('passes the resolved Nail scope to guarded upsert', async () => {
    const branch = '30839580-7b7e-4da7-8b7b-16ad686c3a3e';
    (resolveBookingTenant as jest.Mock).mockResolvedValueOnce({ tenantId: 'tenant-nail', currentUserId: 'operator' });
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'operator', tenant_id: 'tenant-nail', role: 'admin' });
    (createDevelopmentBypassClient as jest.Mock).mockResolvedValue({
      from: () => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: async () => ({ data: { product_key: 'bella_nail' }, error: null }) }),
    });
    (createClient as jest.Mock).mockResolvedValue({
      from: () => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve: (r: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: [{ id: branch, tenant_id: 'tenant-nail', unit_type: 'branch', is_active: true, parent_id: null, name: 'MAIN' }], error: null })) }),
    });
    const result = await createBooking({ customer_id: 'customer-1', full_price: 300000, deposit_amount: 0, total_sessions: 2, metadata: { branch_id: branch } });
    expect(result).toHaveProperty('data');
    expect(upsertBookingRecord).toHaveBeenCalledWith(expect.objectContaining({
      expectedDraftScope: { tenantId: 'tenant-nail', customerId: 'customer-1', branchId: branch },
    }));
  });
});
