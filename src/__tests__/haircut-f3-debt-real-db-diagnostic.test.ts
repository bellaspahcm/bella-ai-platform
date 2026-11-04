import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import { FINANCE_RECEIVABLE_SEMANTICS } from '@/platform/finance/contracts/receivable-charge.contract';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeWithRealDb = supabaseUrl && serviceRoleKey ? describe : describe.skip;

describeWithRealDb('Haircut P4.7 F3 debt real DB diagnostic', () => {
  jest.setTimeout(120_000);

  const runId = `haircut-p47-${Date.now()}`;
  const receivedAt = '2026-09-30';
  const createdTenantIds: string[] = [];
  let supabase: ReturnType<typeof createClient<Database>>;
  let gateway: SupabaseReceivableChargeGateway;
  let service: SemanticReceivableChargeService;

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    gateway = new SupabaseReceivableChargeGateway(supabase, 'service_role');
    service = new SemanticReceivableChargeService(gateway);
  });

  afterAll(async () => {
    for (const tenantId of createdTenantIds.reverse()) {
      await supabase.from('tenants').delete().eq('id', tenantId);
    }
  });

  async function insertTenant(label: string) {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        name: `${runId}-${label}`,
        product_key: 'bella_haircut',
        status: 'active',
        enabled_modules: {
          beauty_spa: true,
          payroll: true,
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    createdTenantIds.push(data!.id);
    return data!.id;
  }

  async function insertCustomer(tenantId: string, label: string) {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name_mother: `${runId} ${label}`,
        phone: `09${Math.floor(Math.random() * 90_000_000 + 10_000_000)}`,
        status: 'active',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!.id;
  }

  async function seedFinanceFoundation(tenantId: string) {
    const { error: periodError } = await supabase
      .from('finance_accounting_periods')
      .insert({
        tenant_id: tenantId,
        name: `${runId}-FY2026`,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        status: 'OPEN',
      });
    expect(periodError).toBeNull();

    const { data: accounts, error: accountError } = await supabase
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
          code: '112',
          name: 'Tien gui ngan hang',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
      ])
      .select('id, code');
    expect(accountError).toBeNull();

    const bankAccount = accounts?.find((account) => account.code === '112');
    expect(bankAccount?.id).toBeTruthy();

    const { error: bankError } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantId,
        account_number: `${runId}-${tenantId.slice(0, 8)}-112`,
        account_name: `${runId} bank`,
        bank_name: 'Diagnostic Bank',
        currency: 'VND',
        linked_finance_account_id: bankAccount!.id,
        is_active: true,
      });
    expect(bankError).toBeNull();

    for (const [semanticKey, accountCode] of [
      [FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE, '131'],
      [FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE, '511'],
    ] as const) {
      const deleteResult = await supabase
        .from('finance_control_account_mappings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('control_type', semanticKey);
      expect(deleteResult.error).toBeNull();

      const { error } = await supabase
        .from('finance_control_account_mappings')
        .insert({
          tenant_id: tenantId,
          control_type: semanticKey,
          account_code: accountCode,
          effective_from: '2026-01-01',
          effective_to: null,
          authority_version: 'VI_TT99_2025|99/2025/TT-BTC|PROVEN',
        });
      expect(error).toBeNull();
    }
  }

  async function createHaircutReceivable(input: {
    tenantId: string;
    customerId: string;
    amountMinor: number;
    label: string;
  }) {
    const bookingId = randomUUID();
    const sessionLogId = randomUUID();

    return service.recognizeServiceReceivable({
      tenantId: input.tenantId,
      customerId: input.customerId,
      amountMinor: input.amountMinor,
      currency: 'VND',
      servicePeriodStart: receivedAt,
      servicePeriodEnd: receivedAt,
      recognitionDate: receivedAt,
      dueDate: '2026-10-07',
      businessSourceType: 'HAIRCUT_SESSION_DONE',
      businessSourceId: sessionLogId,
      description: `${runId} Haircut F3 diagnostic receivable`,
      metadata: {
        booking_id: bookingId,
        booking_number: `${runId}-${input.label}-booking-no`,
        package_name: `${runId} package`,
        session_log_id: sessionLogId,
      },
    });
  }

  async function readPosition(tenantId: string, invoiceId: string) {
    const { data, error } = await supabase
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, allocated_amount_minor')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!;
  }

  async function countRows(table: 'finance_transactions' | 'finance_cash_movements' | 'finance_receivable_allocations', tenantId: string) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    expect(error).toBeNull();
    return count ?? 0;
  }

  it('reads and collects exact Haircut F3 receivables with read-back, idempotency, overpayment, and tenant isolation', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    await seedFinanceFoundation(tenantA);
    await seedFinanceFoundation(tenantB);
    const customerA = await insertCustomer(tenantA, 'customer-a');
    const customerB = await insertCustomer(tenantB, 'customer-b');

    const receivableA = await createHaircutReceivable({
      tenantId: tenantA,
      customerId: customerA,
      amountMinor: 100_000,
      label: 'tenant-a',
    });
    const receivableB = await createHaircutReceivable({
      tenantId: tenantB,
      customerId: customerB,
      amountMinor: 100_000,
      label: 'tenant-b',
    });

    const openForA = await gateway.findOpenReceivables({
      tenantId: tenantA,
      match: {
        invoiceId: receivableA.invoiceId,
        businessSourceType: 'HAIRCUT_SESSION_DONE',
      },
    });
    expect(openForA).toHaveLength(1);
    expect(openForA[0]).toEqual(expect.objectContaining({
      invoiceId: receivableA.invoiceId,
      receivablePositionId: receivableA.receivablePositionId,
      outstandingAmountMinor: 100_000,
    }));

    const crossTenantOpen = await gateway.findOpenReceivables({
      tenantId: tenantA,
      match: { invoiceId: receivableB.invoiceId },
    });
    expect(crossTenantOpen).toHaveLength(0);

    const beforeCounts = {
      transactions: await countRows('finance_transactions', tenantA),
      movements: await countRows('finance_cash_movements', tenantA),
      allocations: await countRows('finance_receivable_allocations', tenantA),
    };

    const partial = await service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: tenantA,
      invoiceId: receivableA.invoiceId,
      paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
      paymentSourceId: receivableA.invoiceId,
      amountMinor: 40_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt,
      idempotencyKey: `${runId}:tenant-a:partial`,
      description: `${runId} partial F3 collection`,
    });
    expect(partial.duplicate).toBe(false);
    expect(partial.allocations).toHaveLength(1);
    expect(partial.allocations[0]).toEqual(expect.objectContaining({
      invoiceId: receivableA.invoiceId,
      receivablePositionId: receivableA.receivablePositionId,
      allocatedAmountMinor: 40_000,
    }));

    const afterPartial = await readPosition(tenantA, receivableA.invoiceId);
    expect(Number(afterPartial.outstanding_amount_minor)).toBe(60_000);

    const retryPartial = await service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: tenantA,
      invoiceId: receivableA.invoiceId,
      paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
      paymentSourceId: receivableA.invoiceId,
      amountMinor: 40_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt,
      idempotencyKey: `${runId}:tenant-a:partial`,
      description: `${runId} partial F3 collection retry`,
    });
    expect(retryPartial.duplicate).toBe(true);
    expect(retryPartial.transactionId).toBe(partial.transactionId);
    expect(retryPartial.cashMovementId).toBe(partial.cashMovementId);
    expect(retryPartial.allocations[0].allocationId).toBe(partial.allocations[0].allocationId);
    const afterRetry = await readPosition(tenantA, receivableA.invoiceId);
    expect(Number(afterRetry.outstanding_amount_minor)).toBe(60_000);

    await expect(service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: tenantA,
      invoiceId: receivableA.invoiceId,
      paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
      paymentSourceId: receivableA.invoiceId,
      amountMinor: 70_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt,
      idempotencyKey: `${runId}:tenant-a:overpay`,
      description: `${runId} overpay F3 collection`,
    })).rejects.toThrow('Open receivables do not cover');

    await expect(service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: tenantA,
      invoiceId: receivableB.invoiceId,
      paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
      paymentSourceId: receivableB.invoiceId,
      amountMinor: 10_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt,
      idempotencyKey: `${runId}:cross-tenant`,
      description: `${runId} cross tenant F3 collection`,
    })).rejects.toThrow('Open receivables do not cover');

    const full = await service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: tenantA,
      invoiceId: receivableA.invoiceId,
      paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
      paymentSourceId: receivableA.invoiceId,
      amountMinor: 60_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt,
      idempotencyKey: `${runId}:tenant-a:full`,
      description: `${runId} full F3 collection`,
    });
    expect(full.duplicate).toBe(false);
    expect(full.allocations[0]).toEqual(expect.objectContaining({
      invoiceId: receivableA.invoiceId,
      receivablePositionId: receivableA.receivablePositionId,
      allocatedAmountMinor: 60_000,
    }));
    const afterFull = await readPosition(tenantA, receivableA.invoiceId);
    expect(Number(afterFull.outstanding_amount_minor)).toBe(0);

    expect(await countRows('finance_transactions', tenantA)).toBe(beforeCounts.transactions + 2);
    expect(await countRows('finance_cash_movements', tenantA)).toBe(beforeCounts.movements + 2);
    expect(await countRows('finance_receivable_allocations', tenantA)).toBe(beforeCounts.allocations + 2);
  });
});
