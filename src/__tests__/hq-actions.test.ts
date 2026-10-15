jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const updatePayloads: Array<Record<string, unknown> | undefined> = [];

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

const mockRecordAuditLog = jest.fn();
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

type MockQueryResult = {
  data: unknown;
  error: unknown;
  count: number | null;
};

class MockQueryBuilder {
  constructor(
    private data: unknown = null,
    private error: unknown = null,
    private count: number | null = null
  ) {}

  select() { return this; }
  eq() { return this; }
  order() { return this; }
  update(payload?: Record<string, unknown>) {
    updatePayloads.push(payload);
    return this;
  }
  insert() { return this; }
  single() { return this; }

  then(onfulfilled: (value: MockQueryResult) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
  }
}

import { checkHqAuth, getAllTenants, getHqDashboardStats, toggleTenantStatus } from '@/services/hq-actions';

describe('HQ actions data loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'hq-admin',
      role: 'admin',
      tenant_id: 'hq-tenant',
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    updatePayloads.length = 0;
  });

  it('propagates HQ tenant verification query failures', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, { message: 'tenant lookup failed' }));

    await expect(checkHqAuth()).rejects.toThrow(
      'Failed to verify HQ tenant: tenant lookup failed'
    );
  });

  it('authorizes HQ admins by bella_hq product_key instead of tenant name', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status: 'active' }, null));

    await expect(checkHqAuth()).resolves.toEqual({
      authorized: true,
      user: expect.objectContaining({ id: 'hq-admin' }),
    });
  });

  it('denies BabyCare admins even when they have admin role', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_babycare', status: 'active' }, null));

    await expect(checkHqAuth()).resolves.toEqual({
      authorized: false,
      error: 'Trang này chỉ dành cho quản trị viên Tổng bộ.',
    });
  });

  it.each(['suspended', 'terminated', null])('denies HQ tenant with status %s', async (status) => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status }, null));
    expect((await checkHqAuth()).authorized).toBe(false);
  });

  it.each([null, { role: 'accountant', tenant_id: 'hq-tenant' }])('denies missing/non-admin authority %j', async (user) => {
    mockGetCurrentUser.mockResolvedValue(user);
    expect((await checkHqAuth()).authorized).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('denies canonical RLS permission errors', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, { code: '42501', message: 'denied' }));
    expect((await checkHqAuth()).authorized).toBe(false);
  });

  it('counts the same tenant set returned to the HQ branch table', async () => {
    const hqTenant = { id: 'hq-tenant', name: 'Bella HQ Renamed', product_key: 'bella_hq', status: 'active', created_at: '2026-05-01' };
    const branchTenant = { id: 'branch-1', name: 'Bella Spa HCM', product_key: 'bella_spa', status: 'suspended', created_at: '2026-05-02' };

    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status: 'active' }, null))
      .mockReturnValueOnce(new MockQueryBuilder([hqTenant, branchTenant], null))
      .mockReturnValueOnce(new MockQueryBuilder([{ tenant_id: 'branch-1' }], null))
      .mockReturnValueOnce(new MockQueryBuilder([{ tenant_id: 'branch-1' }], null))
      .mockReturnValueOnce(new MockQueryBuilder([{ tenant_id: 'branch-1', amount: 1000000 }], null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null, 7))
      .mockReturnValueOnce(new MockQueryBuilder(null, null, 3));

    const stats = await getHqDashboardStats();

    expect(stats.totalSpas).toBe(2);
    expect(stats.activeSpas).toBe(1);
    expect(stats.suspendedSpas).toBe(1);
    expect(stats.totalRevenue).toBe(1000000);
    expect(stats.totalSessions).toBe(7);
  });

  it('handles aggregate failures gracefully instead of throwing', async () => {
    const hqTenant = { id: 'hq-tenant', name: 'Bella HQ Renamed', product_key: 'bella_hq', status: 'active', created_at: '2026-05-01' };

    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status: 'active' }, null))
      .mockReturnValueOnce(new MockQueryBuilder([hqTenant], null))
      .mockReturnValueOnce(new MockQueryBuilder(null, { message: 'staff count failed' }))
      .mockReturnValueOnce(new MockQueryBuilder([
        { tenant_id: 'hq-tenant' },
        { tenant_id: 'hq-tenant' },
        { tenant_id: 'hq-tenant' },
        { tenant_id: 'hq-tenant' },
        { tenant_id: 'hq-tenant' },
      ], null))
      .mockReturnValueOnce(new MockQueryBuilder([{ tenant_id: 'hq-tenant', amount: 1000000 }], null));

    const tenants = await getAllTenants();
    expect(tenants[0].staffCount).toBe(0);
    expect(tenants[0].customerCount).toBe(5);
    expect(tenants[0].revenueSum).toBe(1000000);
  });

  it('rolls back tenant status update when audit logging fails', async () => {
    const tenant = {
      id: 'branch-1',
      name: 'Bella Spa HCM',
      status: 'active',
      updated_at: 'old-date',
    };

    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status: 'active' }, null))
      .mockReturnValueOnce(new MockQueryBuilder(tenant, null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null));

    const res = await toggleTenantStatus('branch-1', 'suspended');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after tenant status update: audit unavailable');
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: 'branch-1',
      old_data: expect.objectContaining({ status: 'active', updated_at: 'old-date' }),
      new_data: expect.objectContaining({ status: 'suspended' }),
    });
    expect(updatePayloads).toEqual([
      expect.objectContaining({ status: 'suspended' }),
      { status: 'active', updated_at: 'old-date' },
    ]);
  });

  it('does not allow suspending the HQ tenant', async () => {
    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ product_key: 'bella_hq', status: 'active' }, null))
      .mockReturnValueOnce(new MockQueryBuilder({
        id: 'hq-tenant',
        name: 'Bella HQ',
        product_key: 'bella_hq',
        status: 'active',
        updated_at: 'old-date',
      }, null));

    const res = await toggleTenantStatus('hq-tenant', 'suspended');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Không thể khóa tenant Tổng bộ.');
    expect(updatePayloads).toEqual([]);
  });
});
