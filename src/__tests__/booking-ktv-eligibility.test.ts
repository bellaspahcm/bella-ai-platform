import type { Database } from '@/types/database.types';
import { AutoAssignmentProvider } from '@/lib/decision-engine/providers/booking/auto-assignment-provider';

const mockGetCurrentUser = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateAdmin = jest.fn();
const mockGetUserById = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockGetCurrentUser() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockCreateClient() }));
jest.mock('@/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => mockCreateAdmin() }));
jest.mock('@/services/tenant-actions', () => ({ getTenantSettings: jest.fn() }));
jest.mock('@/lib/decision-engine/DecisionEngineContext', () => ({
  DecisionEngineContext: {
    create: () => ({ executeWithOutcome: (run: () => Promise<unknown>) => run() }),
  },
}));

import { getEligibleBookingKtvs } from '@/services/booking-ktv-eligibility';
import { autoAssignKtv } from '@/services/booking-decision.service';
import { getKtvSuggestions } from '@/modules/bookings/actions/ktv-suggestion-actions';

type Staff = Pick<Database['public']['Tables']['users']['Row'],
  'id' | 'full_name' | 'position_tier' | 'metadata' | 'tenant_id' | 'role' | 'status' | 'resignation_date'>;

function staff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'official-ktv', full_name: 'Official KTV', position_tier: 'senior',
    metadata: {}, tenant_id: 'tenant-a', role: 'ktv', status: 'active', resignation_date: null,
    ...overrides,
  };
}

describe('official booking KTV eligibility', () => {
  let profiles: Staff[];
  let profileError: Error | null;
  let actorProfile: Partial<Staff> | null;
  const queries = {
    users: makeQuery(() => ({ data: profiles, error: profileError })),
    bookings: makeQuery(() => ({ data: [], error: null })),
    session_logs: makeQuery(() => ({ data: [], error: null })),
    customers: makeQuery(() => ({ data: [], error: null })),
    tenants: makeQuery(() => ({ data: [], error: null })),
  };
  const mockFrom = jest.fn();

  function makeQuery(result: () => { data: unknown; error: Error | null }) {
    return {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      then: (resolve: (value: { data: unknown; error: Error | null }) => unknown) =>
        Promise.resolve(result()).then(resolve),
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    profiles = [staff()];
    profileError = null;
    actorProfile = staff({ id: 'admin', role: 'admin' });
    queries.users.maybeSingle.mockImplementation(async () => ({ data: actorProfile, error: null }));
    queries.bookings.single.mockResolvedValue({ data: {
      id: 'booking', tenant_id: 'tenant-a', customer_id: 'customer',
      packages: { module_key: 'babycare', default_duration_minutes: 60 },
    }, error: null });
    queries.customers.single.mockResolvedValue({ data: { loyalty_points: 0, metadata: {} }, error: null });
    queries.tenants.single.mockResolvedValue({ data: { metadata: {} }, error: null });
    for (const query of Object.values(queries)) {
      for (const method of [query.select, query.eq, query.in, query.is, query.not]) method.mockReturnThis();
    }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return queries.users;
      if (table === 'bookings') return queries.bookings;
      if (table === 'session_logs') return queries.session_logs;
      if (table === 'customers') return queries.customers;
      if (table === 'tenants') return queries.tenants;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockGetCurrentUser.mockResolvedValue({ id: 'admin', tenant_id: 'tenant-a', role: 'admin', status: 'active' });
    mockCreateClient.mockResolvedValue({ from: mockFrom });
    mockCreateAdmin.mockReturnValue({ auth: { admin: { getUserById: mockGetUserById } } });
    mockGetUserById.mockImplementation(async (id: string) => ({ data: { user: { id } }, error: null }));
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['ktv', 'ktv_lead'])('allows an officially assigned %s with matching Auth', async role => {
    profiles = [staff({ role })];
    expect(await getEligibleBookingKtvs('tenant-a')).toEqual(profiles);
    expect(queries.users.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(queries.users.in).toHaveBeenCalledWith('role', ['ktv', 'ktv_lead']);
    expect(queries.users.eq).toHaveBeenCalledWith('status', 'active');
    expect(queries.users.is).toHaveBeenCalledWith('resignation_date', null);
    expect(mockGetUserById).toHaveBeenCalledWith('official-ktv');
  });

  it.each([
    { role: 'admin' }, { role: 'user' }, { tenant_id: 'tenant-b' },
    { status: 'inactive' }, { status: null }, { resignation_date: '2026-10-01' },
  ])('rejects unauthorized profile %j before Auth access', async invalid => {
    profiles = [staff(invalid)];
    expect(await getEligibleBookingKtvs('tenant-a')).toEqual([]);
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: { status: 404, code: 'user_not_found' } },
    { data: { user: null }, error: null },
    { data: { user: { id: 'wrong-id' } }, error: null },
    { data: { user: { id: 'official-ktv', deleted_at: '2026-10-01' } }, error: null },
    { data: { user: { id: 'official-ktv', is_anonymous: true } }, error: null },
    { data: { user: { id: 'official-ktv', banned_until: '2999-01-01T00:00:00Z' } }, error: null },
    { data: { user: { id: 'official-ktv', banned_until: 'invalid' } }, error: null },
  ])('rejects a non-login-capable Auth identity %#', async response => {
    mockGetUserById.mockResolvedValue(response);
    expect(await getEligibleBookingKtvs('tenant-a')).toEqual([]);
  });

  it('allows a restored account after its ban has expired', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { id: 'official-ktv', banned_until: '2020-01-01T00:00:00Z' } }, error: null,
    });
    expect(await getEligibleBookingKtvs('tenant-a', 'official-ktv')).toEqual(profiles);
    expect(queries.users.eq).toHaveBeenCalledWith('id', 'official-ktv');
  });

  it.each([
    null,
    { tenant_id: 'tenant-b', status: 'active' },
    { tenant_id: 'tenant-a', status: 'active', isSuspended: true },
  ])('rejects an invalid caller before querying profiles or Auth %#', async currentUser => {
    mockGetCurrentUser.mockResolvedValue(currentUser);
    await expect(getEligibleBookingKtvs('tenant-a')).rejects.toThrow('Không có quyền');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  it.each([null, { status: 'inactive' }, { resignation_date: '2026-10-01' }, { tenant_id: 'tenant-b' }])(
    'checks fresh actor authorization before Auth access %#', async invalid => {
      actorProfile = invalid === null ? null : { ...staff({ id: 'admin', role: 'admin' }), ...invalid };
      await expect(getEligibleBookingKtvs('tenant-a')).rejects.toThrow('Không có quyền');
      expect(mockCreateAdmin).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the verifier is unavailable', async () => {
    mockCreateAdmin.mockReturnValue(null);
    await expect(getEligibleBookingKtvs('tenant-a')).rejects.toThrow('chưa cấu hình');
  });

  it('fails closed on profile query failure', async () => {
    profileError = new Error('RLS denied');
    await expect(getEligibleBookingKtvs('tenant-a')).rejects.toThrow('Không thể xác minh quyền');
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  it('does not return a partial list on unexpected Auth errors', async () => {
    profiles = [staff(), staff({ id: 'second-ktv' })];
    mockGetUserById.mockResolvedValueOnce({ data: { user: { id: 'official-ktv' } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } });
    await expect(getEligibleBookingKtvs('tenant-a')).rejects.toThrow('Không thể xác minh tài khoản');
  });

  it('returns no candidates when there are no official staff profiles', async () => {
    profiles = [];
    expect(await getEligibleBookingKtvs('tenant-a')).toEqual([]);
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  const assignmentInput = {
    tenantId: 'tenant-a', customerId: 'customer', serviceId: 'package', serviceType: 'general',
    requestedDate: '2026-10-15', requestedStartTime: '08:00', durationMinutes: 60,
    customerTier: 'new' as const, preferredKtvId: 'orphan-ktv',
  };

  it('never ranks an orphan profile, even when it was the preferred KTV', async () => {
    profiles = [staff({ id: 'orphan-ktv', full_name: 'Bella Test' }), staff()];
    mockGetUserById.mockImplementation(async (id: string) => id === 'orphan-ktv'
      ? { data: { user: null }, error: { status: 404 } }
      : { data: { user: { id } }, error: null });
    const evaluate = jest.spyOn(AutoAssignmentProvider.prototype, 'evaluate');

    const result = await autoAssignKtv(assignmentInput);

    expect(result.assignedKtvId).toBe('official-ktv');
    expect(result.alternatives ?? []).not.toContainEqual(expect.objectContaining({ ktvId: 'orphan-ktv' }));
    expect(evaluate.mock.calls[0][1].map(candidate => candidate.id)).toEqual(['official-ktv']);
    expect(queries.session_logs.in).toHaveBeenCalledWith('completed_by_ktv_id', ['official-ktv']);
  });

  it('cannot rank candidates when all Auth identities are missing', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: { status: 404 } });
    const evaluate = jest.spyOn(AutoAssignmentProvider.prototype, 'evaluate');
    expect((await autoAssignKtv(assignmentInput)).assignedKtvId).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('exposes only official identities through the actual suggestion action and ranking service', async () => {
    profiles = [staff({ id: 'orphan-ktv', full_name: 'Bella Test' }), staff()];
    mockGetUserById.mockImplementation(async (id: string) => id === 'orphan-ktv'
      ? { data: { user: null }, error: { status: 404 } }
      : { data: { user: { id } }, error: null });
    const result = await getKtvSuggestions({
      bookingId: 'booking', tenantId: 'tenant-a', requestedDate: '2026-10-15',
      requestedStartTime: '08:00', durationMinutes: 60,
    });
    expect(result.success).toBe(true);
    expect(result.suggestions.map(suggestion => suggestion.ktvId)).toEqual(['official-ktv']);
  });
});
