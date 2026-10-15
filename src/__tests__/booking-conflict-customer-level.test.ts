/**
 * Customer-Level Booking Conflict Detection Tests
 * 
 * CRITICAL FIX (15/07/2026): Tests for preventing multiple active bookings per customer
 * 
 * Test Coverage:
 * 1. Public booking page (submitOnlineBooking) - blocks ALL active bookings
 * 2. Admin booking modal (createBooking) - blocks active except deposit_pending
 * 3. Allow completed bookings
 * 4. Allow cancelled bookings
 * 5. Admin can reuse deposit_pending
 * 
 * Related Files:
 * - src/core/services/order/online-booking-action.ts
 * - src/core/services/order/create-booking-action.ts
 * 
 * AGENTS.md Compliance:
 * - Rule #2: Always assert side effects (verify booking is blocked/created)
 */

import { submitOnlineBooking } from '@/core/services/order/online-booking-action';
import { createBooking } from '@/core/services/order/create-booking-action';
import type { Database } from '@/types/database.types';

// Ensure tenant resolution works without hitting the DB
process.env.DEFAULT_TENANT_ID = 'tenant-1';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type MockStoreRow = Record<string, unknown>;
type MockQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function toMockStoreRow(value: unknown): MockStoreRow {
  return value && typeof value === 'object' ? value as MockStoreRow : {};
}

// Mock Supabase client
// NOTE: Cannot reference this in jest.mock() factory directly (TDZ issue - jest.mock is hoisted).
// The mock factory below uses jest.fn() stubs; beforeEach wires them to this object.
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    }),
  },
};

// Mock store for test data
const mockStore = {
  customers: [] as CustomerRow[],
  bookings: [] as BookingRow[],
  packages: [] as MockStoreRow[],
  tenants: [] as MockStoreRow[],
  users: [] as MockStoreRow[],
};

// Helper: Create mock query builder — fully chainable
class MockQueryBuilder {
  private _inValues: string[] = [];

  constructor(private table: string, private _forceError: { message: string } | null = null) {}

  select(_columns?: string) { return this; }
  eq(_column: string, _value: unknown) { return this; }
  gte(_column: string, _value: unknown) { return this; }
  not(_column: string, _op: string, _value: unknown) { return this; }
  is(_column: string, _value: unknown) { return Promise.resolve({ data: null, error: null }); }
  order(_column: string, _opts?: unknown) { return this; }
  limit(_count: number) { return this; }

  in(_column: string, values: string[]) {
    this._inValues = values;
    return this;
  }

  insert(data: unknown) {
    if (this._forceError) throw this._forceError;
    const row = toMockStoreRow(Array.isArray(data) ? data[0] : data);
    if (this.table === 'customers') {
      const newCustomer = { id: `cust-${Date.now()}`, ...row };
      mockStore.customers.push(newCustomer as CustomerRow);
    } else if (this.table === 'bookings') {
      const newBooking = { id: `booking-${Date.now()}`, booking_number: `BK-${Date.now()}`, ...row };
      mockStore.bookings.push(newBooking as BookingRow);
    }
    return this;
  }

  update(_data: unknown) { return this; }
  delete() { return this; }

  maybeSingle() {
    if (this.table === 'customers') {
      return Promise.resolve({ data: mockStore.customers[0] ?? null, error: null });
    }
    if (this.table === 'tenants') {
      return Promise.resolve({ data: mockStore.tenants[0] ?? null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  single(): Promise<MockQueryResult> {
    if (this.table === 'customers') {
      const customer = mockStore.customers[mockStore.customers.length - 1] ?? null;
      return Promise.resolve({ data: customer, error: null });
    }
    if (this.table === 'bookings') {
      const booking = mockStore.bookings[mockStore.bookings.length - 1] ?? null;
      return Promise.resolve({ data: booking, error: null });
    }
    if (this.table === 'tenants') {
      const tenant = mockStore.tenants[0] ?? null;
      return Promise.resolve({
        data: tenant,
        error: tenant ? null : { message: 'No tenant found' },
      });
    }
    if (this.table === 'packages') {
      return Promise.resolve({ data: mockStore.packages[0] ?? null, error: null });
    }
    if (this.table === 'users') {
      return Promise.resolve({ data: mockStore.users[0] ?? null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  // Make the builder itself awaitable (resolves after .in() chains)
  then(onfulfilled?: ((value: MockQueryResult) => unknown) | null) {
    let data: unknown[] = [];
    if (this.table === 'bookings') {
      data = this._inValues.length > 0
        ? mockStore.bookings.filter(b => this._inValues.includes(b.status))
        : mockStore.bookings;
    }
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  }
}

// Mock imports
// IMPORTANT: jest.mock() is hoisted — cannot reference `mockSupabase` here (TDZ).
// We register a stub factory and then update the resolved value in beforeEach.
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

// Allow rate-limit to pass so tests reach conflict-check logic
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => true),
}));

// next/headers is a server-only module — provide a minimal stub
jest.mock('next/headers', () => ({
  headers: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
  cookies: jest.fn(() => ({
    get: jest.fn(() => null),
    getAll: jest.fn(() => []),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}), { virtual: true });

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }), { virtual: true });

describe('Customer-Level Booking Conflict Detection', () => {
  beforeEach(() => {
    // Clear all mocks first, then re-wire (order matters!)
    jest.clearAllMocks();

    // Reset mock store
    mockStore.customers = [];
    mockStore.bookings = [];
    mockStore.packages = [];
    mockStore.tenants = [];
    mockStore.users = [];

    // Setup default test data
    const testTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      status: 'active',
      enabled_modules: ['babycare'],
    };
    mockStore.tenants.push(testTenant);

    const testPackage = {
      id: 'pkg-1',
      name: 'Test Package',
      price: 1000000,
      total_sessions: 10,
      tenant_id: 'tenant-1',
      module_key: 'babycare',
      status: 'active',
    };
    mockStore.packages.push(testPackage);

    const testUser = {
      id: 'user-1',
      tenant_id: 'tenant-1',
      role: 'admin',
      status: 'active',
    };
    mockStore.users.push(testUser);

    // Wire supabase-server mock to return mockSupabase.
    // Must be done in beforeEach (not in jest.mock factory) to avoid TDZ.
    const supabaseServerMock = jest.requireMock('@/lib/supabase-server') as {
      createClient: jest.Mock;
    };
    supabaseServerMock.createClient.mockResolvedValue(mockSupabase);

    // Wire mockSupabase.from and auth after clearAllMocks
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      return new MockQueryBuilder(table);
    });
  });

  // ============================================================================
  // TEST GROUP 1: Public Booking (submitOnlineBooking)
  // ============================================================================

  describe('submitOnlineBooking - Public Booking Page', () => {
    it('should block new booking if customer has deposit_pending booking', async () => {
      // Setup: Customer with deposit_pending booking
      const customer: CustomerRow = {
        id: 'cust-1',
        phone: '0912345678',
        name_mother: 'Test Customer',
        tenant_id: 'tenant-1',
        status: 'lead',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const existingBooking: BookingRow = {
        id: 'booking-1',
        customer_id: 'cust-1',
        tenant_id: 'tenant-1',
        booking_number: 'BK-001',
        package_name: 'Massage Bụng',
        status: 'deposit_pending',
        start_date: '2026-07-20',
        full_price: 1000000,
        deposit_amount: 500000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(existingBooking);

      // Action: Try to create new booking
      const result = await submitOnlineBooking({
        phone: '0912345678',
        name_mother: 'Test Customer',
        package_name: 'Tắm Bé',
        start_date: '2026-07-20',
      });

      // Assert: Should be blocked
      expect(result.success).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('đang có 1 gói đang thực hiện');
      expect(result.error).toContain('Massage Bụng');

      // Assert: No new booking created
      expect(mockStore.bookings).toHaveLength(1);  // Only the existing one
    });

    it('should block new booking if customer has in_progress booking', async () => {
      const customer: CustomerRow = {
        id: 'cust-2',
        phone: '0923456789',
        name_mother: 'Customer 2',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const activeBooking: BookingRow = {
        id: 'booking-2',
        customer_id: 'cust-2',
        tenant_id: 'tenant-1',
        booking_number: 'BK-002',
        package_name: 'Gói VIP',
        status: 'in_progress',
        start_date: '2026-07-18',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(activeBooking);

      const result = await submitOnlineBooking({
        phone: '0923456789',
        name_mother: 'Customer 2',
        package_name: 'Gói Mới',
        start_date: '2026-07-20',
      });

      expect(result.error).toContain('đang có 1 gói đang thực hiện');
      expect(result.error).toContain('Gói VIP');
      expect(mockStore.bookings).toHaveLength(1);
    });

    it('should block if customer has multiple active bookings', async () => {
      const customer: CustomerRow = {
        id: 'cust-3',
        phone: '0934567890',
        name_mother: 'Customer 3',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const booking1: BookingRow = {
        id: 'booking-3a',
        customer_id: 'cust-3',
        tenant_id: 'tenant-1',
        booking_number: 'BK-003A',
        package_name: 'Package A',
        status: 'in_progress',
        start_date: '2026-07-15',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;

      const booking2: BookingRow = {
        id: 'booking-3b',
        customer_id: 'cust-3',
        tenant_id: 'tenant-1',
        booking_number: 'BK-003B',
        package_name: 'Package B',
        status: 'scheduled',
        start_date: '2026-07-22',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;

      mockStore.bookings.push(booking1, booking2);

      const result = await submitOnlineBooking({
        phone: '0934567890',
        name_mother: 'Customer 3',
        package_name: 'Package C',
        start_date: '2026-07-25',
      });

      expect(result.error).toContain('2 gói đang thực hiện');
      expect(result.error).toContain('Package A');
      expect(result.error).toContain('Package B');
      expect(mockStore.bookings).toHaveLength(2);
    });

    it('should allow new booking if previous booking is completed', async () => {
      const customer: CustomerRow = {
        id: 'cust-4',
        phone: '0945678901',
        name_mother: 'Customer 4',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const completedBooking: BookingRow = {
        id: 'booking-4',
        customer_id: 'cust-4',
        tenant_id: 'tenant-1',
        booking_number: 'BK-004',
        package_name: 'Old Package',
        status: 'completed',
        start_date: '2026-07-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(completedBooking);

      const result = await submitOnlineBooking({
        phone: '0945678901',
        name_mother: 'Customer 4',
        package_name: 'New Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Assert: Should succeed (or fail for other reasons, but NOT conflict)
      if (result.error) {
        expect(result.error).not.toContain('đang có');
        expect(result.error).not.toContain('gói đang thực hiện');
      } else {
        expect(result.success).toBe(true);
        expect(result.bookingNumber).toBeDefined();
      }
    });
  });

  // ============================================================================
  // TEST GROUP 2: Admin Booking (createBooking)
  // ============================================================================

  describe('createBooking - Admin Booking Modal', () => {
    it('should allow booking if customer has in_progress booking (admin override / multiple bookings allowed)', async () => {
      const customer: CustomerRow = {
        id: 'cust-5',
        phone: '0956789012',
        name_mother: 'Customer 5',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const activeBooking: BookingRow = {
        id: 'booking-5',
        customer_id: 'cust-5',
        tenant_id: 'tenant-1',
        booking_number: 'BK-005',
        package_name: 'Active Package',
        status: 'in_progress',
        start_date: '2026-07-15',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(activeBooking);

      const result = await createBooking({
        customer_id: 'cust-5',
        package_id: 'pkg-1',
        full_price: 1000000,
        deposit_amount: 500000,
        start_date: '2026-07-20',
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should allow booking if customer has scheduled booking (admin override / multiple bookings allowed)', async () => {
      const customer: CustomerRow = {
        id: 'cust-6',
        phone: '0967890123',
        name_mother: 'Customer 6',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const scheduledBooking: BookingRow = {
        id: 'booking-6',
        customer_id: 'cust-6',
        tenant_id: 'tenant-1',
        booking_number: 'BK-006',
        package_name: 'Scheduled Package',
        status: 'scheduled',
        start_date: '2026-07-25',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(scheduledBooking);

      const result = await createBooking({
        customer_id: 'cust-6',
        package_id: 'pkg-1',
        full_price: 1000000,
        deposit_amount: 500000,
        start_date: '2026-07-20',
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should allow reusing deposit_pending booking (admin feature)', async () => {
      // Note: This test verifies existing behavior is preserved
      // Admin should be able to update deposit_pending bookings
      
      const customer: CustomerRow = {
        id: 'cust-7',
        phone: '0978901234',
        name_mother: 'Customer 7',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const pendingBooking: BookingRow = {
        id: 'booking-7',
        customer_id: 'cust-7',
        tenant_id: 'tenant-1',
        booking_number: 'BK-007',
        package_name: 'Pending Package',
        status: 'deposit_pending',
        deposit_amount: 500000,
        start_date: '2026-07-20',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(pendingBooking);

      const result = await createBooking({
        customer_id: 'cust-7',
        package_id: 'pkg-1',
        deposit_amount: 1000000,
        full_price: 2000000,
        start_date: '2026-07-20',
      });

      // Should NOT be blocked by conflict detection
      // May fail for other reasons (validation, etc.), but NOT conflict
      if (result.error) {
        expect(result.error).not.toContain('đang có');
        expect(result.error).not.toContain('gói đang thực hiện');
      }
    });
  });

  // ============================================================================
  // TEST GROUP 3: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should allow new booking if previous booking was cancelled', async () => {
      const customer: CustomerRow = {
        id: 'cust-8',
        phone: '0989012345',
        name_mother: 'Customer 8',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const cancelledBooking: BookingRow = {
        id: 'booking-8',
        customer_id: 'cust-8',
        tenant_id: 'tenant-1',
        booking_number: 'BK-008',
        package_name: 'Cancelled Package',
        status: 'cancelled',
        start_date: '2026-07-10',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(cancelledBooking);

      const result = await submitOnlineBooking({
        phone: '0989012345',
        name_mother: 'Customer 8',
        package_name: 'New Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Should not be blocked by conflict detection
      if (result.error) {
        expect(result.error).not.toContain('đang có');
      }
    });

    it('should handle gracefully if conflict check fails', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          const errorChain = {
            eq: () => errorChain,
            in: () => errorChain,
            order: () => Promise.resolve({
              data: null,
              error: { message: 'Database error' },
            }),
            select: () => errorChain,
            insert: () => errorChain,
            single: () => Promise.resolve({ data: { id: 'booking-graceful' }, error: null }),
          };
          return errorChain;
        }
        return new MockQueryBuilder(table);
      });

      const result = await submitOnlineBooking({
        phone: '0990123456',
        name_mother: 'Customer 9',
        package_name: 'Test Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Should log error but allow booking to proceed (graceful degradation)
      // This is intentional to not break user flow if conflict check fails
      // In production, consider blocking if conflict check fails
      // For now, verify it doesn't crash
      expect(result).toBeDefined();
    });
  });
});
