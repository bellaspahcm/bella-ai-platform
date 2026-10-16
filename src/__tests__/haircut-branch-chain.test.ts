import {
  buildBookingPayload,
} from '@/core/services/order/create-booking-helpers';
import {
  readRequestedBranchId,
  resolveHaircutBranchContext,
} from '@/core/services/order/haircut-branch-context';
import {
  buildManualPaymentIdempotencyKey,
  recordBookingPaymentRpc,
  type RecordRemainingPaymentParams,
} from '@/core/services/order/payment-helpers';
import {
  buildPackageSaleOutboxEvent,
  buildSessionDoneOutboxEvent,
} from '@/lib/business-rules/accounting-outbox';
import type { TenantContext } from '@/core/types/tenant';
import { getCurrentUser } from '@/services/user-actions';
import { createClient } from '@/lib/supabase-server';

jest.mock('@/services/user-actions', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn() }));

jest.mock('@bella/shared', () => ({
  getLocalDateString: jest.fn(() => '2026-10-05'),
}));

jest.mock('@/core/services/order/commission-actions', () => ({
  resolveKtvCommission: jest.fn().mockResolvedValue(0),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

class MockQueryBuilder {
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly table: string,
    private readonly resolver: (table: string, filters: Array<{ column: string; value: unknown }>) => QueryResult
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  single(): Promise<QueryResult> {
    return Promise.resolve(this.resolver(this.table, this.filters));
  }

  returns(): Promise<QueryResult> {
    return Promise.resolve(this.resolver(this.table, this.filters));
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.returns().then(onfulfilled, onrejected);
  }
}

function createMockSupabase(
  resolver: (table: string, filters: Array<{ column: string; value: unknown }>) => QueryResult
) {
  return {
    from: jest.fn((table: string) => new MockQueryBuilder(table, resolver)),
  };
}

function payment(overrides: Partial<RecordRemainingPaymentParams> = {}): RecordRemainingPaymentParams {
  return {
    booking_id: 'booking-1',
    customer_id: 'customer-1',
    amount: 250000,
    payment_method: 'bank_transfer',
    status: 'confirmed',
    notes: 'Thu phan con lai',
    revenue_type: 'remaining_payment',
    ...overrides,
  };
}

const tenantContext: TenantContext = {
  tenantId: 'tenant-haircut',
  tenantName: 'Haircut Shop',
  enabledModules: ['spa'],
  subscriptionPlan: 'basic',
  featureFlags: {},
  settings: {},
};

describe('Haircut Branch Chain', () => {
  it('extracts branch context from canonical booking metadata aliases', () => {
    expect(readRequestedBranchId({ metadata: { branch_id: 'branch-a' } })).toBe('branch-a');
    expect(readRequestedBranchId({ metadata: { branchId: 'branch-b' } })).toBe('branch-b');
    expect(readRequestedBranchId({ branch_id: 'branch-c', metadata: { branch_id: 'branch-a' } })).toBe('branch-c');
  });

  it('requires user_org_unit_access for Haircut requested branch', async () => {
    const supabase = createMockSupabase((table, filters) => {
      if (table === 'tenants') {
        return { data: { product_key: 'bella_haircut' }, error: null };
      }
      if (table === 'user_org_unit_access') {
        const branchFilter = filters.find((filter) => filter.column === 'org_unit_id');
        return {
          data: branchFilter?.value === 'branch-a' ? [{ org_unit_id: 'branch-a' }] : [],
          error: null,
        };
      }
      return { data: null, error: { message: `unexpected table ${table}` } };
    });

    await expect(resolveHaircutBranchContext({
      supabase: supabase as never,
      tenantId: 'tenant-haircut',
      currentUserId: 'user-1',
      requestedBranchId: 'branch-a',
    })).resolves.toEqual({
      requiresBranch: true,
      branchId: 'branch-a',
      source: 'requested',
    });

    await expect(resolveHaircutBranchContext({
      supabase: supabase as never,
      tenantId: 'tenant-haircut',
      currentUserId: 'user-1',
      requestedBranchId: 'branch-b',
    })).resolves.toEqual({
      error: 'Bạn không có quyền thao tác trên chi nhánh Haircut đã chọn.',
    });
  });

  it('persists branch ownership on Haircut booking payload and metadata', async () => {
    const payload = await buildBookingPayload({
      validatedData: {
        customer_id: 'customer-1',
        full_price: 500000,
        deposit_amount: 100000,
        total_sessions: 3,
        start_date: '2026-10-05',
        ktv_commission: 50000,
        preferred_time: '09:00',
        metadata: { source: 'test' },
      },
      customerId: 'customer-1',
      tenantId: 'tenant-haircut',
      existingBooking: null,
      tenantContext,
      branchContext: {
        requiresBranch: true,
        branchId: 'branch-a',
        source: 'requested',
      },
    });

    expect(payload).toEqual(expect.objectContaining({
      tenant_id: 'tenant-haircut',
      branch_id: 'branch-a',
      metadata: expect.objectContaining({
        source: 'test',
        branch_id: 'branch-a',
      }),
    }));
  });

  it('passes booking branch ownership through remaining payment RPC metadata and outbox', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { booking_id: 'booking-1', revenue_id: 'revenue-1', branch_id: 'branch-a' },
      error: null,
    });
    const input = payment();
    const expectedKey = buildManualPaymentIdempotencyKey(input, '2026-10-05');

    await recordBookingPaymentRpc({
      supabase: { rpc } as never,
      payment: input,
      tenantId: 'tenant-haircut',
      branchId: 'branch-a',
      actorId: 'user-1',
    });

    expect(rpc).toHaveBeenCalledWith(
      'record_remaining_payment_atomic',
      expect.objectContaining({
        p_accounting_metadata: expect.objectContaining({
          branch_id: 'branch-a',
          manual_payment_idempotency_key: expectedKey,
        }),
        p_outbox_payload: expect.objectContaining({
          branchId: 'branch-a',
          idempotencyKey: expectedKey,
        }),
      })
    );
  });

  it('uses originating branch in finance outbox payloads when supplied', () => {
    expect(buildPackageSaleOutboxEvent({
      tenantId: 'tenant-haircut',
      revenueId: 'revenue-1',
      totalAmount: 100000,
      branchId: 'branch-a',
    }).payload).toEqual(expect.objectContaining({
      branchId: 'branch-a',
    }));

    expect(buildSessionDoneOutboxEvent({
      tenantId: 'tenant-haircut',
      sessionLogId: 'session-1',
      bookingId: 'booking-1',
      earnedRevenueAmount: 100000,
      deferredRevenueAmount: 0,
      receivableAmount: 0,
      commissionAmount: 20000,
      branchId: 'branch-a',
    }).payload).toEqual(expect.objectContaining({
      branchId: 'branch-a',
    }));
  });
});

// Business authority: approved Nail pilot requires an explicit authorized branch;
// Haircut keeps its pre-existing single-accessible inference. Fixtures are inputs.
describe('Nail booking branch adoption and Haircut compatibility', () => {
  const branch = '30839580-7b7e-4da7-8b7b-16ad686c3a3e';
  const foreign = '10839580-7b7e-4da7-8b7b-16ad686c3a3e';
  const inactive = '20839580-7b7e-4da7-8b7b-16ad686c3a3e';
  const denied = '40839580-7b7e-4da7-8b7b-16ad686c3a3e';
  const company = '50839580-7b7e-4da7-8b7b-16ad686c3a3e';
  let product: string;
  let calls: Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>;
  let supabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    product = 'bella_nail';
    calls = [];
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'operator', tenant_id: 'tenant-nail', role: 'ktv' });
    const units = [
      { id: branch, tenant_id: 'tenant-nail', unit_type: 'branch', is_active: true, name: 'MAIN', parent_id: null },
      { id: foreign, tenant_id: 'tenant-other', unit_type: 'branch', is_active: true, name: 'OTHER', parent_id: null },
      { id: inactive, tenant_id: 'tenant-nail', unit_type: 'branch', is_active: false, name: 'CLOSED', parent_id: null },
      { id: denied, tenant_id: 'tenant-nail', unit_type: 'branch', is_active: true, name: 'DENIED', parent_id: null },
      { id: company, tenant_id: 'tenant-nail', unit_type: 'company', is_active: true, name: 'COMPANY', parent_id: null },
    ];
    const access = [branch, foreign, inactive, company].map(id => ({
      org_unit_id: id, root_org_unit_id: id, tenant_id: 'tenant-nail', user_id: 'operator', access_source: 'belongs_to',
    }));
    supabase = createMockSupabase((table, filters) => {
      calls.push({ table, filters });
      if (table === 'tenants') return { data: { product_key: product }, error: null };
      const rows = table === 'org_units' ? units : table === 'user_org_unit_access' ? access : null;
      if (!rows) throw new Error(`Unexpected table ${table}`);
      return { data: rows.filter(row => filters.every(f => Reflect.get(row, f.column) === f.value)), error: null };
    });
    (createClient as jest.Mock).mockResolvedValue(supabase);
  });

  function resolve(requestedBranchId?: string | null) {
    return resolveHaircutBranchContext({ supabase: supabase as never, tenantId: 'tenant-nail', currentUserId: 'operator', requestedBranchId });
  }

  it('uses existing permission policy and persists the explicit Nail branch', async () => {
    const context = await resolve(branch);
    expect(context).toEqual({ requiresBranch: true, branchId: branch, source: 'requested', strictDraftScope: true });
    expect(calls.find(c => c.table === 'org_units')?.filters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-nail' }, { column: 'is_active', value: true },
    ]));
    expect(calls.find(c => c.table === 'user_org_unit_access')?.filters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-nail' }, { column: 'user_id', value: 'operator' },
    ]));
    if ('error' in context) throw new Error(context.error);
    const payload = await buildBookingPayload({
      validatedData: { customer_id: 'customer', full_price: 300000, deposit_amount: 0, total_sessions: 2, ktv_commission: 0 },
      customerId: 'customer', tenantId: 'tenant-nail', existingBooking: null,
      tenantContext: { ...tenantContext, tenantId: 'tenant-nail' }, branchContext: context,
    });
    expect(payload).toMatchObject({ tenant_id: 'tenant-nail', branch_id: branch, metadata: { branch_id: branch } });
  });

  it.each([undefined, null, '', 'not-a-uuid', foreign, inactive, denied, company])(
    'rejects missing, invalid, foreign, inactive, inaccessible or non-branch input: %s', async requested => {
      expect(await resolve(requested)).toEqual({ error: expect.any(String) });
    },
  );

  it.each([
    null,
    { id: 'other-user', tenant_id: 'tenant-nail', role: 'admin' },
    { id: 'operator', tenant_id: 'tenant-other', role: 'admin' },
  ])('rejects absent or mismatched authoritative identity: %j', async user => {
    (getCurrentUser as jest.Mock).mockResolvedValue(user);
    expect(await resolve(branch)).toEqual({ error: expect.any(String) });
  });

  it('requires an actor even if a branch was supplied', async () => {
    expect(await resolveHaircutBranchContext({ supabase: supabase as never, tenantId: 'tenant-nail', currentUserId: null, requestedBranchId: branch }))
      .toEqual({ error: expect.any(String) });
  });

  it('keeps existing tenant-admin branch policy rather than requiring new membership', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'operator', tenant_id: 'tenant-nail', role: 'admin' });
    expect(await resolve(denied)).toEqual({ requiresBranch: true, branchId: denied, source: 'requested', strictDraftScope: true });
  });

  it('keeps Haircut single-accessible branch inference without a new explicit input requirement', async () => {
    product = 'bella_haircut';
    const hairSupabase = createMockSupabase(table => ({ data: table === 'tenants' ? { product_key: product } : [{ org_unit_id: branch }], error: null }));
    expect(await resolveHaircutBranchContext({ supabase: hairSupabase as never, tenantId: 'tenant-haircut', currentUserId: 'operator' }))
      .toEqual({ requiresBranch: true, branchId: branch, source: 'single_accessible' });
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('does not change products outside Nail/Haircut', async () => {
    product = 'beauty_spa';
    expect(await resolve(branch)).toEqual({ requiresBranch: false, branchId: null, source: 'not_haircut' });
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
