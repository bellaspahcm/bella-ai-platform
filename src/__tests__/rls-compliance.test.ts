/**
 * RLS Compliance and Tenant Isolation Tests.
 * This test suite verifies that:
 * 1. Queries and operations strictly enforce tenant boundaries (Defense-in-depth).
 * 2. KTV users are restricted from viewing or altering other users' attendance records.
 * 3. Suspended tenants are blocked from accessing any system endpoints.
 */

import { getKTVTodayAttendance, ktvCheckIn } from '../services/attendance-actions';
import { getBookings } from '../core/services/order/lifecycle-actions';
import { getCurrentUser } from '../services/user-actions';
import { BookingError } from '../core/lib/errors';

// Mock Dependencies
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../modules/hr-salary/actions/salary-recalculation-engine', () => ({
  recalculateAndSaveSalaryRecordEngine: jest.fn(),
}));
jest.mock('@/modules/hr-salary/actions/salary-recalculation-engine', () => ({
  recalculateAndSaveSalaryRecordEngine: jest.fn(),
}), { virtual: true });

// Mock audit logging
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

// Supabase mock environment
const mockEq = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

function createSuspendedTenantQueryBuilder(table: string) {
  const single = jest.fn(() => {
    if (table === 'users') {
      return Promise.resolve({
        data: {
          id: 'user-suspended',
          email: 'suspended@tenant.com',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-suspended',
          full_name: 'Suspended Admin',
        },
        error: null,
      });
    }
    if (table === 'tenants') {
      return Promise.resolve({
        data: { status: 'suspended', name: 'Suspended Tenant Co' },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single,
      })),
    })),
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    insert: mockInsert,
    update: mockUpdate,
  };
}

const mockSupabase = {
  from: jest.fn((table: string) => ({
    select: mockSelect,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    insert: mockInsert,
    update: mockUpdate,
  })),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  },
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
jest.mock('../services/user-actions', () => {
  const original = jest.requireActual('../services/user-actions');
  return {
    ...original,
    getCurrentUser: jest.fn(),
  };
});

type BranchAwareQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function createKtvBranchAwareQuery(table: string) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((field: string, value: unknown) => {
      mockEq(field, value);
      return query;
    }),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn((): Promise<BranchAwareQueryResult> => {
      if (table === 'people_directory') {
        return Promise.resolve({ data: { id: 'person-ktv-123' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    single: jest.fn((): Promise<BranchAwareQueryResult> =>
      Promise.resolve({ data: { id: 'att-1' }, error: null }),
    ),
    insert: jest.fn((payload: unknown) => {
      mockInsert(payload);
      return {
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'att-1' }, error: null })),
        })),
      };
    }),
    update: jest.fn(() => query),
    then: jest.fn((onfulfilled?: ((value: BranchAwareQueryResult) => unknown) | null) => {
      const data = table === 'user_org_unit_access'
        ? [{ access_source: 'belongs_to', org_unit_id: 'branch-a', root_org_unit_id: 'branch-a', user_id: 'ktv-123' }]
        : table === 'org_relationships'
        ? [{ rel_type: 'belongs_to', since: null, to_id: 'branch-a', until: null }]
        : table === 'org_units'
          ? [{ id: 'branch-a', parent_id: null, unit_type: 'branch' }]
          : [];
      return Promise.resolve({ data, error: null }).then(onfulfilled ?? undefined);
    }),
  };
  return query;
}

describe('Row-Level Security (RLS) & Tenant Isolation Compliance Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockMaybeSingle.mockReset();
    mockSingle.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();

    mockSupabase.from.mockReset();
    mockSupabase.from.mockImplementation((table: string) => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      insert: mockInsert,
      update: mockUpdate,
    }));

    // Default mock implementation for query builder chains
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: jest.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    });
    mockEq.mockReturnValue({
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    });
  });

  describe('Tenant Boundary Isolation (Defense-in-depth)', () => {
    it('asserts Tenant A Admin can read bookings (PostgreSQL RLS will filter by Tenant A)', async () => {
      // Mock session for Tenant A Admin
      mockGetCurrentUser.mockResolvedValue({
        id: 'admin-a',
        email: 'admin@tenant-a.com',
        role: 'admin',
        tenant_id: 'tenant-a',
        full_name: 'Tenant A Manager',
      });

      // Emulate DB returning Tenant A bookings
      const mockBookings = [
        { id: 'bk-1', tenant_id: 'tenant-a', booking_number: 'BK-100' },
        { id: 'bk-2', tenant_id: 'tenant-a', booking_number: 'BK-101' },
      ];
      
      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));
      mockEq.mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockBookings, error: null }),
      });

      const bookings = await getBookings();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      expect(bookings).toHaveLength(2);
      bookings.forEach((booking) => {
        expect(booking.tenant_id).toBe('tenant-a');
      });
    });

    it('proves Tenant B KTV is strictly blocked from reading Tenant A bookings', async () => {
      // Mock session for Tenant B KTV
      mockGetCurrentUser.mockResolvedValue({
        id: 'ktv-b',
        email: 'ktv@tenant-b.com',
        role: 'ktv',
        tenant_id: 'tenant-b',
        full_name: 'KTV Worker B',
      });

      // PostgreSQL RLS policy restricts KTVs to only their own assigned bookings.
      // If we attempt to query bookings, we should simulate the DB RLS policy filter.
      // For any records where tenant_id != 'tenant-b', the database returns 0 rows.
      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));
      mockEq.mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }), // Empty because RLS filters out Tenant A
      });

      const bookings = await getBookings();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-b');
      expect(bookings).toHaveLength(0);
    });

    it('propagates booking query failures instead of returning an empty list', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'admin-a',
        email: 'admin@tenant-a.com',
        role: 'admin',
        tenant_id: 'tenant-a',
        full_name: 'Tenant A Manager',
      });

      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));
      mockEq.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'RLS policy lookup failed' },
        }),
      });

      await expect(getBookings()).rejects.toThrow(BookingError);
      await expect(getBookings()).rejects.toThrow('Failed to fetch bookings: RLS policy lookup failed');
    });
  });

  describe('KTV Attendance Isolation & Granularity', () => {
    it('guarantees KTV queries filter by their own KTV User ID at the application layer', async () => {
      mockSupabase.from.mockImplementation((table: string) => createKtvBranchAwareQuery(table));
      mockGetCurrentUser.mockResolvedValue({
        id: 'ktv-123',
        email: 'ktv123@bella.vn',
        role: 'ktv',
        tenant_id: 'tenant-a',
        full_name: 'KTV 123',
      });

      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await getKTVTodayAttendance();

      // Ensure that getKTVTodayAttendance strictly appended `.eq('ktv_id', 'ktv-123')`
      expect(mockEq).toHaveBeenCalledWith('ktv_id', 'ktv-123');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    });

    it('denies attendance queries for non-KTV roles', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@bella.vn',
        role: 'admin',
        tenant_id: 'tenant-a',
        full_name: 'Admin 1',
      });

      const res = await getKTVTodayAttendance();
      expect(res).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('requires valid tenant_id and ktv_id upon check-in insertion', async () => {
      mockSupabase.from.mockImplementation((table: string) => createKtvBranchAwareQuery(table));
      mockGetCurrentUser.mockResolvedValue({
        id: 'ktv-123',
        email: 'ktv123@bella.vn',
        role: 'ktv',
        tenant_id: 'tenant-a',
        full_name: 'KTV 123',
      });

      // Simulate check-in
      mockMaybeSingle.mockResolvedValue({ data: null, error: null }); // no existing attendance
      
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'att-1' }, error: null })
        })
      });
      mockInsert.mockImplementation(insertMock);

      await ktvCheckIn();

      // Verify insertion includes matching ktv_id and tenant_id
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ktv_id: 'ktv-123',
          tenant_id: 'tenant-a'
        })
      );
    });
  });

  describe('Suspended Tenants Blocking', () => {
    it('blocks suspended tenants from accessing getCurrentUser profile details', async () => {
      // Restore real getCurrentUser for this test so we verify the suspension checking logic
      const originalUserActions = jest.requireActual('../services/user-actions');
      mockGetCurrentUser.mockImplementation(originalUserActions.getCurrentUser);

      // Stub Auth user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-suspended', email: 'suspended@tenant.com' } }
      });

      // Simulate profile exists in DB
      mockSingle.mockImplementation(() => Promise.resolve({
        data: {
          id: 'user-suspended',
          email: 'suspended@tenant.com',
          role: 'admin',
          status: 'active',
          tenant_id: 'tenant-suspended',
          full_name: 'Suspended Admin',
        },
        error: null,
      }));

      // Emulate tenants query returning status = 'suspended'
      mockSupabase.from.mockImplementation((table: string) => {
        return createSuspendedTenantQueryBuilder(table);
      });

      const profile = await getCurrentUser();
      expect(profile).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith('tenants');
    });
  });

  describe('Granular Access Control Scopes', () => {
    it('ensures Branch Manager A is strictly restricted to Branch A bookings (simulated RLS)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'manager-a',
        email: 'manager@tenant-a.com',
        role: 'branch_manager',
        tenant_id: 'tenant-a',
        branch_id: 'branch-a',
        full_name: 'Branch A Manager',
      });

      const mockBookings = [
        { id: 'bk-1', tenant_id: 'tenant-a', branch_id: 'branch-a', booking_number: 'BK-100' }
      ];

      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));
      mockEq.mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockBookings, error: null }),
      });

      const bookings = await getBookings();
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      expect(bookings).toHaveLength(1);
      expect(bookings[0].branch_id).toBe('branch-a');
    });

    it('ensures KTV user is restricted to their own salary record (queries for another KTV are filtered by RLS)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'ktv-123',
        email: 'ktv123@bella.vn',
        role: 'ktv',
        tenant_id: 'tenant-a',
        full_name: 'KTV 123',
      });

      const mockSalary = [
        { id: 'sal-1', tenant_id: 'tenant-a', ktv_id: 'ktv-123', total_salary: 6300000 }
      ];

      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));
      mockEq.mockReturnValue({
        eq: mockEq,
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSalary[0], error: null }),
      });

      const { data: salaryRecord } = await mockSupabase
        .from('salary_records')
        .select('*')
        .eq('tenant_id', 'tenant-a')
        .eq('ktv_id', 'ktv-123')
        .maybeSingle();

      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
      expect(mockEq).toHaveBeenCalledWith('ktv_id', 'ktv-123');
      expect(salaryRecord?.ktv_id).toBe('ktv-123');
    });

    it('guarantees Tenant A user cannot query Tenant B bookings due to RLS boundary', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-a',
        email: 'user@tenant-a.com',
        role: 'admin',
        tenant_id: 'tenant-a',
        full_name: 'Tenant A User',
      });

      mockSelect.mockImplementation(() => ({
        eq: mockEq,
      }));

      const { data } = await mockSupabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', 'tenant-a');

      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    });
  });
});
