import {
  addLoyaltyPoints,
  createCustomer,
  deleteCustomer,
  getCustomerBookingByToken,
  getCustomerById,
  getCustomers,
  submitCustomerRating,
  updateCustomer,
} from '../services/customer-actions';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRecordAuditLog = jest.fn();

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

jest.mock('../lib/subscription', () => ({
  checkSubscriptionLimit: jest.fn().mockResolvedValue({ isBlocked: false }),
}));

class MockQueryBuilder {
  public updateSpy = jest.fn().mockReturnThis();
  public insertSpy = jest.fn().mockReturnThis();
  public deleteSpy = jest.fn().mockReturnThis();
  public rangeSpy = jest.fn().mockReturnThis();
  public filters: Array<{ column: string; value: unknown }> = [];

  constructor(private data: unknown = null, private error: unknown = null) {}

  select() { return this; }
  order() { return this; }
  limit() { return this; }
  range(...args: unknown[]) {
    this.rangeSpy(...args);
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }
  maybeSingle() { return this; }
  single() { return this; }
  insert(...args: unknown[]) {
    this.insertSpy(...args);
    return this;
  }
  delete(...args: unknown[]) {
    this.deleteSpy(...args);
    return this;
  }
  update(...args: unknown[]) {
    this.updateSpy(...args);
    return this;
  }

  then(onfulfilled: (value: { data: unknown; error: unknown }) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('customer actions fail-fast behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'customer-1', role: 'customer', tenant_id: 'tenant-1' });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('scopes customer list queries to the current tenant', async () => {
    const listQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1' }]);
    mockFrom.mockReturnValue(listQuery);

    await expect(getCustomers()).resolves.toEqual([{ id: 'cust-1', tenant_id: 'tenant-1' }]);

    expect(listQuery.filters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('filters nested bookings and revenue to the current tenant in customer lists', async () => {
    const listQuery = new MockQueryBuilder([
      {
        id: 'cust-1',
        tenant_id: 'tenant-1',
        bookings: [
          {
            id: 'booking-1',
            tenant_id: 'tenant-1',
            package_name: 'Bella package',
            revenue: [
              { amount: 200000, status: 'confirmed', revenue_type: 'deposit', tenant_id: 'tenant-1' },
              { amount: 999000, status: 'confirmed', revenue_type: 'deposit', tenant_id: 'tenant-2' },
            ],
          },
          {
            id: 'booking-2',
            tenant_id: 'tenant-2',
            package_name: 'Beauty package',
            revenue: [
              { amount: 300000, status: 'confirmed', revenue_type: 'deposit', tenant_id: 'tenant-2' },
            ],
          },
        ],
      },
    ]);
    mockFrom.mockReturnValue(listQuery);

    await expect(getCustomers()).resolves.toEqual([
      expect.objectContaining({
        id: 'cust-1',
        tenant_id: 'tenant-1',
        bookings: [
          expect.objectContaining({
            id: 'booking-1',
            tenant_id: 'tenant-1',
            package_name: 'Bella package',
            revenue: [
              expect.objectContaining({ amount: 200000, tenant_id: 'tenant-1' }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('supports offset pagination for incremental customer list loading', async () => {
    const listQuery = new MockQueryBuilder([]);
    mockFrom.mockReturnValue(listQuery);

    await expect(getCustomers({ limit: 120, offset: 80 })).resolves.toEqual([]);

    expect(listQuery.rangeSpy).toHaveBeenCalledWith(80, 199);
    expect(listQuery.filters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('scopes customer detail queries to the current tenant', async () => {
    const detailQuery = new MockQueryBuilder({ id: 'cust-1', tenant_id: 'tenant-1' });
    mockFrom.mockReturnValue(detailQuery);

    await expect(getCustomerById('cust-1')).resolves.toEqual({ id: 'cust-1', tenant_id: 'tenant-1' });

    expect(detailQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('creates customers under the current tenant instead of trusting client tenant input', async () => {
    const createQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1' }]);
    mockFrom.mockReturnValue(createQuery);

    const result = await createCustomer({
      name: 'Customer A',
      phone: '0900000000',
      tenant_id: 'tenant-2',
      loyalty_points: 999999,
    });

    expect(result.data).toEqual({ id: 'cust-1', tenant_id: 'tenant-1' });
    expect(createQuery.insertSpy).toHaveBeenCalledWith([expect.objectContaining({
      name_mother: 'Customer A',
      phone: '0900000000',
      tenant_id: 'tenant-1',
    })]);
    expect(createQuery.insertSpy.mock.calls[0][0][0]).not.toHaveProperty('loyalty_points');
  });

  it('scopes customer updates and strips client tenant changes', async () => {
    const oldCustomerQuery = new MockQueryBuilder({ id: 'cust-1', tenant_id: 'tenant-1', address: 'Old' });
    const updateQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1', name_mother: 'New' }]);
    mockFrom
      .mockReturnValueOnce(oldCustomerQuery)
      .mockReturnValueOnce(updateQuery);

    const result = await updateCustomer('cust-1', {
      name_mother: 'New',
      tenant_id: 'tenant-2',
      loyalty_points: 999999,
    });

    expect(result.data).toEqual({ id: 'cust-1', tenant_id: 'tenant-1', name_mother: 'New' });
    expect(oldCustomerQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(updateQuery.updateSpy).toHaveBeenCalledWith({ name_mother: 'New' });
    expect(updateQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('scopes customer deletes to the current tenant', async () => {
    const oldCustomerQuery = new MockQueryBuilder({ id: 'cust-1', tenant_id: 'tenant-1' });
    const deleteQuery = new MockQueryBuilder(null, null);
    mockFrom
      .mockReturnValueOnce(oldCustomerQuery)
      .mockReturnValueOnce(deleteQuery);

    await expect(deleteCustomer('cust-1')).resolves.toEqual({ success: true, error: null });

    expect(oldCustomerQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(deleteQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('propagates customer list query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'customers failed' }));

    await expect(getCustomers()).rejects.toThrow('Failed to fetch customers: customers failed');
  });

  it('propagates customer detail query failures while preserving not-found as null', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, { message: 'customer detail failed' }));
    await expect(getCustomerById('cust-1')).rejects.toThrow(
      'Failed to fetch customer cust-1: customer detail failed'
    );

    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, null));
    await expect(getCustomerById('missing-cust')).resolves.toBeNull();
  });

  it('propagates customer portal booking query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'portal query failed' }));

    await expect(getCustomerBookingByToken('token-1')).rejects.toThrow(
      'Failed to fetch customer booking: portal query failed'
    );
  });

  it.each([200000, 0, -100000])('rejects direct application loyalty increments for amount %s without calling the RPC', async amount => {
    await expect(addLoyaltyPoints('cust-1', amount)).rejects.toThrow('không thể cập nhật thủ công');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not restore a stale loyalty balance when customer-profile audit fails', async () => {
    const oldCustomerQuery = new MockQueryBuilder({ id: 'cust-1', tenant_id: 'tenant-1', name_mother: 'Old', loyalty_points: 45 });
    const updateQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1', name_mother: 'New', loyalty_points: 90 }]);
    const rollbackQuery = new MockQueryBuilder(null);
    mockFrom.mockReturnValueOnce(oldCustomerQuery).mockReturnValueOnce(updateQuery).mockReturnValueOnce(rollbackQuery);
    mockRecordAuditLog.mockRejectedValueOnce(new Error('Audit unavailable'));

    const result = await updateCustomer('cust-1', { name_mother: 'New', loyalty_points: 0 });

    expect(result.error).toBe('Audit unavailable');
    expect(updateQuery.updateSpy).toHaveBeenCalledWith({ name_mother: 'New' });
    expect(rollbackQuery.updateSpy).toHaveBeenCalledWith({ id: 'cust-1', tenant_id: 'tenant-1', name_mother: 'Old' });
    expect(rollbackQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: 'cust-1' }, { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('rolls back session rating when review lookup fails', async () => {
    const sessionQuery = new MockQueryBuilder({
      completed_by_ktv_id: 'ktv-1',
      tenant_id: 'tenant-1',
      rating: null,
      rating_comment: null,
      bookings: { customer_id: 'cust-1' },
    });
    const updateQuery = new MockQueryBuilder(null, null);
    const reviewQuery = new MockQueryBuilder(null, { message: 'review lookup failed' });
    const rollbackQuery = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(sessionQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(reviewQuery)
      .mockReturnValueOnce(rollbackQuery);

    // Use valid UUID format instead of 'session-1'
    await expect(submitCustomerRating('550e8400-e29b-41d4-a716-446655440000', 5, 'Good')).rejects.toThrow(
      'Failed to fetch existing session review: review lookup failed'
    );

    expect(rollbackQuery.updateSpy).toHaveBeenCalledWith({
      rating: null,
      rating_comment: null,
    });
    expect(updateQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: '550e8400-e29b-41d4-a716-446655440000' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(reviewQuery.filters).toEqual(expect.arrayContaining([
      { column: 'session_log_id', value: '550e8400-e29b-41d4-a716-446655440000' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
    expect(rollbackQuery.filters).toEqual(expect.arrayContaining([
      { column: 'id', value: '550e8400-e29b-41d4-a716-446655440000' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('normalizes empty string date fields to null when creating a customer', async () => {
    const createQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1' }]);
    mockFrom.mockReturnValue(createQuery);

    await createCustomer({
      name: 'Customer A',
      phone: '0900000000',
      dob_expected: '',
      dob_baby: '',
    });

    expect(createQuery.insertSpy).toHaveBeenCalledWith([expect.objectContaining({
      dob_expected: null,
      dob_baby: null,
    })]);
  });

  it('normalizes empty string date fields to null when updating a customer', async () => {
    const oldCustomerQuery = new MockQueryBuilder({ id: 'cust-1', tenant_id: 'tenant-1', dob_expected: '2026-07-18' });
    const updateQuery = new MockQueryBuilder([{ id: 'cust-1', tenant_id: 'tenant-1' }]);
    mockFrom
      .mockReturnValueOnce(oldCustomerQuery)
      .mockReturnValueOnce(updateQuery);

    await updateCustomer('cust-1', {
      dob_expected: '',
      dob_baby: '',
    });

    expect(updateQuery.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      dob_expected: null,
      dob_baby: null,
    }));
  });
});
