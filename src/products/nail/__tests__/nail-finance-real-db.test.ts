import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

let mockSupabaseAdminClient: SupabaseClient<Database>;

const mockGetCurrentUser = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockSupabaseAdminClient,
}));
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));
jest.mock('@/lib/subscription', () => ({
  checkSubscriptionLimit: jest.fn().mockResolvedValue({ isBlocked: false }),
}));
jest.mock('@/services/notification-helpers', () => ({
  createSystemNotification: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/app/api/bookings/check-ktv-availability/route', () => ({
  invalidateAvailabilityCache: jest.fn().mockResolvedValue(undefined),
}));

import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import { FINANCE_RECEIVABLE_SEMANTICS } from '@/platform/finance/contracts/receivable-charge.contract';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';
import { createCustomer } from '@/services/customer-actions';
import {
  completeSession,
  createBooking,
  recordRemainingPayment,
} from '@/core/services/order';

jest.setTimeout(120_000);

type TestUser = {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  full_name: string;
};

function hasRealSupabaseAdminEnv() {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Bella Nail Finance real DB proof', () => {
  const marker = `nail-finance-${Date.now()}`;
  const serviceDate = '2026-09-30';
  const created = {
    tenants: [] as string[],
    users: [] as string[],
    customers: [] as string[],
    packages: [] as string[],
    bookings: [] as string[],
  };

  beforeAll(() => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    mockSupabaseAdminClient = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(() => {
    mockGetCurrentUser.mockReset();
    mockRevalidatePath.mockReset();
  });

  async function expectCleanupSuccess(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>,
  ) {
    const { error } = await cleanup;
    if (error) {
      throw new Error(`${label} cleanup failed: ${error.message}`);
    }
  }

  async function cleanupBestEffort(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>,
  ) {
    const { error } = await cleanup;
    if (error) {
      console.warn(`[Bella Nail Finance cleanup] ${label} cleanup needs external scoped cleanup: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!mockSupabaseAdminClient) return;

    for (const tenantId of created.tenants) {
      await expectCleanupSuccess('accounting_outbox', mockSupabaseAdminClient.from('accounting_outbox').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('salary_records', mockSupabaseAdminClient.from('salary_records').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('session_reviews', mockSupabaseAdminClient.from('session_reviews').delete().eq('tenant_id', tenantId));
    }

    for (const bookingId of created.bookings) {
      await expectCleanupSuccess('session_logs', mockSupabaseAdminClient.from('session_logs').delete().eq('booking_id', bookingId));
      await expectCleanupSuccess('revenue', mockSupabaseAdminClient.from('revenue').delete().eq('booking_id', bookingId));
      await expectCleanupSuccess('bookings', mockSupabaseAdminClient.from('bookings').delete().eq('id', bookingId));
    }

    if (created.packages.length > 0) {
      await expectCleanupSuccess('packages', mockSupabaseAdminClient.from('packages').delete().in('id', created.packages));
    }
    if (created.customers.length > 0) {
      await expectCleanupSuccess('customers', mockSupabaseAdminClient.from('customers').delete().in('id', created.customers));
    }
    if (created.users.length > 0) {
      await cleanupBestEffort('users', mockSupabaseAdminClient.from('users').delete().in('id', created.users));
    }
    if (created.tenants.length > 0) {
      console.warn(
        `[Bella Nail Finance cleanup] retained Finance tenant(s) with immutable F1/F2/F3 facts: ${created.tenants.join(', ')}`,
      );
    }
  });

  async function insertTenant(): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('tenants')
      .insert({
        name: `${marker} tenant`,
        status: 'active',
        product_key: 'bella_nail',
        enabled_modules: {
          babycare: false,
          beauty_spa: true,
          payroll: false,
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.tenants.push(data!.id);
    return data!.id;
  }

  async function insertUser(tenantId: string, role: string, label: string): Promise<TestUser> {
    const { data, error } = await mockSupabaseAdminClient
      .from('users')
      .insert({
        tenant_id: tenantId,
        email: `${marker}-${label}@example.com`,
        full_name: `Nail ${label}`,
        role,
        phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
        base_salary: 0,
      })
      .select('id, email, tenant_id, role, full_name')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.users.push(data!.id);
    return data!;
  }

  async function insertPackage(input: {
    tenantId: string;
    name: string;
    price: number;
    totalSessions: number;
  }): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('packages')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        description: 'Real package for Bella Nail finance proof',
        price: input.price,
        total_sessions: input.totalSessions,
        session_multiplier: 1,
        status: 'active',
        module_key: 'beauty_spa',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.packages.push(data!.id);
    return data!.id;
  }

  async function createNailCustomer(label: string) {
    const result = await createCustomer({
      name_mother: `${marker} ${label}`,
      phone: `08${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });

    expect(result.error).toBeFalsy();
    expect(result.data?.id).toBeTruthy();
    created.customers.push(result.data!.id);
    return result.data!.id;
  }

  async function getSessionForBooking(bookingId: string) {
    const { data, error } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, tenant_id')
      .eq('booking_id', bookingId)
      .eq('session_number', 1)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!;
  }

  async function seedFinanceFoundation(tenantId: string) {
    const { error: periodError } = await mockSupabaseAdminClient
      .from('finance_accounting_periods')
      .insert({
        tenant_id: tenantId,
        name: `${marker}-FY2026`,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        status: 'OPEN',
      });
    expect(periodError).toBeNull();

    const { data: accounts, error: accountsError } = await mockSupabaseAdminClient
      .from('finance_accounts')
      .insert([
        {
          tenant_id: tenantId,
          code: '131',
          name: 'Phai thu khach hang',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: '511',
          name: 'Doanh thu dich vu',
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: '111',
          name: 'Tien mat',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
      ])
      .select('id, code');
    expect(accountsError).toBeNull();

    const cashAccount = accounts?.find((account) => account.code === '111');
    expect(cashAccount?.id).toBeTruthy();

    const { error: bankError } = await mockSupabaseAdminClient
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantId,
        bank_name: 'Bella Nail Cash Desk',
        account_number: `${marker}-${tenantId.slice(0, 8)}-111`,
        account_name: 'Nail cash on hand',
        currency: 'VND',
        linked_finance_account_id: cashAccount!.id,
        is_active: true,
      });
    expect(bankError).toBeNull();

    for (const [semanticKey, accountCode] of [
      [FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE, '131'],
      [FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE, '511'],
    ] as const) {
      const { error } = await mockSupabaseAdminClient.rpc('finance_save_accounting_semantic_gl_mapping', {
        p_tenant_id: tenantId,
        p_semantic_key: semanticKey,
        p_account_code: accountCode,
        p_effective_from: '2026-01-01',
        p_authority_version: 'VI_TT99_2025|99/2025/TT-BTC|PROVEN',
      });
      expect(error).toBeNull();
    }
  }

  async function readSingleCount(table: 'finance_invoices' | 'finance_cash_movements' | 'finance_receivable_allocations', tenantId: string) {
    const { count, error } = await mockSupabaseAdminClient
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    expect(error).toBeNull();
    return count ?? 0;
  }

  it('proves Nail receivable, confirmed payment allocation, and cash read-back through canonical Finance', async () => {
    const tenantId = await insertTenant();
    const admin = await insertUser(tenantId, 'admin', 'admin');
    const technician = await insertUser(tenantId, 'ktv', 'technician');
    mockGetCurrentUser.mockResolvedValue(admin);
    await seedFinanceFoundation(tenantId);

    const packageId = await insertPackage({
      tenantId,
      name: `${marker} Gel package`,
      price: 300_000,
      totalSessions: 2,
    });
    const customerId = await createNailCustomer('finance-customer');

    const booking = await createBooking({
      customer_id: customerId,
      package_id: packageId,
      package_name: `${marker} Gel package`,
      full_price: 300_000,
      deposit_amount: 0,
      total_sessions: 2,
      start_date: serviceDate,
      assigned_ktv_id: technician.id,
      ktv_commission: 0,
      discount_percent: 0,
      preferred_time: '14:00',
      metadata: { product_key: 'bella_nail', proof: marker },
    });

    expect(booking.error).toBeFalsy();
    const bookingId = String(booking.data!.id);
    created.bookings.push(bookingId);

    const session = await getSessionForBooking(bookingId);
    const completion = await completeSession(
      session.id,
      bookingId,
      'Bella Nail finance proof session completed',
    );
    expect(completion.error).toBeFalsy();

    const financeService = new SemanticReceivableChargeService(
      new SupabaseReceivableChargeGateway(mockSupabaseAdminClient, 'service_role'),
    );
    const receivable = await financeService.recognizeServiceReceivable({
      tenantId,
      customerId,
      amountMinor: 300_000,
      currency: 'VND',
      servicePeriodStart: serviceDate,
      servicePeriodEnd: serviceDate,
      recognitionDate: serviceDate,
      dueDate: '2026-10-07',
      businessSourceType: 'NAIL_SESSION_DONE',
      businessSourceId: session.id,
      description: `${marker} Nail service receivable`,
      metadata: {
        booking_id: bookingId,
        product_key: 'bella_nail',
        session_log_id: session.id,
      },
    });

    expect(receivable.invoiceId).toBeTruthy();
    expect(receivable.receivableLedgerEntryCount).toBe(1);
    expect(receivable.transactionLineCount).toBe(2);
    expect(receivable.policyEvidence).toMatchObject({
      legalSource: '99/2025/TT-BTC',
      applicableRegime: 'VI_TT99_2025',
      verificationStatus: 'PROVEN',
    });

    const { data: openPositionBefore, error: openPositionBeforeError } = await mockSupabaseAdminClient
      .from('finance_receivable_positions')
      .select('id, original_amount_minor, allocated_amount_minor, outstanding_amount_minor')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', receivable.invoiceId)
      .single();
    expect(openPositionBeforeError).toBeNull();
    expect(getNumber(openPositionBefore?.original_amount_minor)).toBe(300_000);
    expect(getNumber(openPositionBefore?.allocated_amount_minor)).toBe(0);
    expect(getNumber(openPositionBefore?.outstanding_amount_minor)).toBe(300_000);

    const paymentIdempotencyKey = `${marker}-remaining-payment`;
    const payment = await recordRemainingPayment({
      booking_id: bookingId,
      customer_id: customerId,
      amount: 300_000,
      payment_method: 'cash',
      status: 'confirmed',
      revenue_type: 'remaining_payment',
      notes: 'Bella Nail Finance AR allocation proof',
      idempotency_key: paymentIdempotencyKey,
    });

    expect(payment.error).toBeFalsy();
    const paymentPayload = asRecord(payment.data);
    const financeAllocation = asRecord(paymentPayload?.finance_ar_allocation);
    expect(financeAllocation).toMatchObject({
      status: 'ALLOCATED',
      allocatedAmountMinor: 300_000,
      allocationCount: 1,
    });

    const { data: invoice, error: invoiceError } = await mockSupabaseAdminClient
      .from('finance_invoices')
      .select('id, status, total_invoice_amount_minor, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', receivable.invoiceId)
      .single();
    expect(invoiceError).toBeNull();
    expect(invoice).toMatchObject({
      id: receivable.invoiceId,
      status: 'FINALIZED',
      total_invoice_amount_minor: 300_000,
    });
    expect(asRecord(invoice?.metadata)?.booking_id).toBe(bookingId);

    const { data: positionAfter, error: positionAfterError } = await mockSupabaseAdminClient
      .from('finance_receivable_positions')
      .select('id, allocated_amount_minor, outstanding_amount_minor')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', receivable.invoiceId)
      .single();
    expect(positionAfterError).toBeNull();
    expect(getNumber(positionAfter?.allocated_amount_minor)).toBe(300_000);
    expect(getNumber(positionAfter?.outstanding_amount_minor)).toBe(0);

    const { data: allocationRows, error: allocationError } = await mockSupabaseAdminClient
      .from('finance_receivable_allocations')
      .select('id, cash_movement_id, invoice_id, allocated_amount_minor')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', receivable.invoiceId);
    expect(allocationError).toBeNull();
    expect(allocationRows).toHaveLength(1);
    expect(getNumber(allocationRows?.[0]?.allocated_amount_minor)).toBe(300_000);

    const cashMovementId = String(financeAllocation?.cashMovementId);
    expect(cashMovementId).toBeTruthy();
    expect(allocationRows?.[0]?.cash_movement_id).toBe(cashMovementId);

    const { data: cashMovement, error: cashMovementError } = await mockSupabaseAdminClient
      .from('finance_cash_movements')
      .select('id, amount_minor, direction, source_type, source_id')
      .eq('tenant_id', tenantId)
      .eq('id', cashMovementId)
      .single();
    expect(cashMovementError).toBeNull();
    expect(cashMovement).toMatchObject({
      id: cashMovementId,
      amount_minor: 300_000,
      direction: 'INFLOW',
      source_type: 'REVENUE',
    });

    const { data: cashPosition, error: cashPositionError } = await mockSupabaseAdminClient
      .from('finance_cash_positions')
      .select('balance_minor, functional_balance_minor, last_movement_id')
      .eq('tenant_id', tenantId)
      .eq('last_movement_id', cashMovementId)
      .single();
    expect(cashPositionError).toBeNull();
    expect(getNumber(cashPosition?.balance_minor)).toBe(300_000);
    expect(getNumber(cashPosition?.functional_balance_minor)).toBe(300_000);

    const { data: paymentRevenue, error: paymentRevenueError } = await mockSupabaseAdminClient
      .from('revenue')
      .select('id, amount, status, revenue_type, payment_method, accounting_metadata')
      .eq('tenant_id', tenantId)
      .eq('booking_id', bookingId)
      .eq('revenue_type', 'remaining_payment')
      .single();
    expect(paymentRevenueError).toBeNull();
    expect(paymentRevenue).toMatchObject({
      amount: 300_000,
      status: 'confirmed',
      payment_method: 'cash',
    });
    expect(asRecord(paymentRevenue?.accounting_metadata)?.manual_payment_idempotency_key).toBe(paymentIdempotencyKey);

    expect(await readSingleCount('finance_invoices', tenantId)).toBe(1);
    expect(await readSingleCount('finance_cash_movements', tenantId)).toBe(1);
    expect(await readSingleCount('finance_receivable_allocations', tenantId)).toBe(1);
  });
});
