import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../../types/database.types';
import type {
  PaymentReceivableAllocationInput,
  PaymentReceivableAllocationResult,
  ReceivableMatchCriteria,
} from '../contracts/receivable-charge.contract';
import { CashProjectionWorker } from '../engines/cash-engine/cash-projection-worker';
import { LedgerEngineService } from '../engines/ledger-engine/ledger.service';
import { OutboxDispatcher } from '../engines/ledger-engine/outbox-dispatcher';
import {
  FinanceChargeReadModel,
  FinanceCashMovementSnapshot,
  FinanceCashReceiptSnapshot,
  FinanceInvoiceSnapshot,
  FinanceOpenReceivable,
  FinancePostingLine,
  FinanceReceivableAllocationSnapshot,
  FinanceReceivableChargeGateway,
  FinanceReceivableChargeMetadata,
  FinanceSemanticAccountMapping,
} from '../services/semantic-receivable-charge.service';

type FinanceInvoiceRow = Pick<
  Database['public']['Tables']['finance_invoices']['Row'],
  'id' | 'invoice_number' | 'status' | 'posting_attempt_id' | 'f1_transaction_id'
>;

type FinancePositionRow = Pick<
  Database['public']['Tables']['finance_receivable_positions']['Row'],
  'id'
>;

type FinanceOpenInvoiceRow = Pick<
  Database['public']['Tables']['finance_invoices']['Row'],
  'id' | 'issue_date' | 'created_at' | 'currency'
>;

type FinanceOpenPositionRow = Pick<
  Database['public']['Tables']['finance_receivable_positions']['Row'],
  'id' | 'invoice_id' | 'outstanding_amount_minor' | 'currency'
>;

type FinanceCashMovementRow = Pick<
  Database['public']['Tables']['finance_cash_movements']['Row'],
  'id' | 'amount_minor' | 'direction'
>;

type FinanceAllocationRow = Pick<
  Database['public']['Tables']['finance_receivable_allocations']['Row'],
  'id' | 'invoice_id' | 'allocated_amount_minor'
>;

type FinanceTransactionRow = Pick<
  Database['public']['Tables']['finance_transactions']['Row'],
  'id'
>;

export type FinanceReceivableChargeExecutionMode = 'authenticated' | 'service_role';

export class SupabaseReceivableChargeGateway implements FinanceReceivableChargeGateway {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly executionMode: FinanceReceivableChargeExecutionMode,
  ) {}

  async resolveSemanticAccount(input: {
    readonly tenantId: string;
    readonly semanticKey: string;
    readonly asOf: string;
  }): Promise<FinanceSemanticAccountMapping | null> {
    const { data, error } = await this.client.rpc('finance_get_accounting_semantic_gl_map_as_of', {
      p_tenant_id: input.tenantId,
      p_semantic_key: input.semanticKey,
      p_as_of: input.asOf,
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      semanticKey: row.semantic_key,
      accountCode: row.gl_account_code,
      authorityVersion: row.authority_version,
    };
  }

  async findInvoiceByNumber(input: {
    readonly tenantId: string;
    readonly invoiceNumber: string;
  }): Promise<FinanceInvoiceSnapshot | null> {
    const { data, error } = await this.client
      .from('finance_invoices')
      .select('id, invoice_number, status, posting_attempt_id, f1_transaction_id')
      .eq('tenant_id', input.tenantId)
      .eq('invoice_number', input.invoiceNumber)
      .maybeSingle<FinanceInvoiceRow>();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      status: data.status,
      postingAttemptId: data.posting_attempt_id,
      f1TransactionId: data.f1_transaction_id,
    };
  }

  async createDraftInvoice(input: {
    readonly tenantId: string;
    readonly customerId: string;
    readonly invoiceNumber: string;
    readonly currency: string;
    readonly issueDate: string;
    readonly dueDate: string;
  }): Promise<string> {
    const { data, error } = this.executionMode === 'authenticated'
      ? await this.client.rpc('finance_authenticated_create_draft_invoice', {
        p_tenant_id: input.tenantId,
        p_customer_id: input.customerId,
        p_invoice_number: input.invoiceNumber,
        p_currency: input.currency,
        p_issue_date: input.issueDate,
        p_due_date: input.dueDate,
      })
      : await this.client.rpc('finance_create_draft_invoice', {
        p_tenant_id: input.tenantId,
        p_customer_id: input.customerId,
        p_invoice_number: input.invoiceNumber,
        p_currency: input.currency,
        p_issue_date: input.issueDate,
        p_due_date: input.dueDate,
      });
    if (error) throw new Error(error.message);
    return data;
  }

  async saveInvoiceMetadata(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly metadata: FinanceReceivableChargeMetadata;
  }): Promise<void> {
    const { error } = await this.client
      .from('finance_invoices')
      .update({ metadata: input.metadata as unknown as Json })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId);
    if (error) throw new Error(error.message);
  }

  async invoiceHasLines(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<boolean> {
    const { data, error } = await this.client
      .from('finance_invoice_lines')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('invoice_id', input.invoiceId)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async addInvoiceLine(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly serviceId: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly taxRate: number;
    readonly revenueAccountCode: string;
  }): Promise<string> {
    const { data, error } = this.executionMode === 'authenticated'
      ? await this.client.rpc('finance_authenticated_add_invoice_line', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_service_id: input.serviceId,
        p_description: input.description,
        p_quantity: input.quantity,
        p_unit_price_minor: input.unitPriceMinor,
        p_tax_rate: input.taxRate,
        p_revenue_account_code: input.revenueAccountCode,
      })
      : await this.client.rpc('finance_add_invoice_line', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_service_id: input.serviceId,
        p_description: input.description,
        p_quantity: input.quantity,
        p_unit_price_minor: input.unitPriceMinor,
        p_tax_rate: input.taxRate,
        p_revenue_account_code: input.revenueAccountCode,
      });
    if (error) throw new Error(error.message);
    return data;
  }

  async finalizeInvoice(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly lines: readonly FinancePostingLine[];
  }): Promise<{ readonly transactionId: string; readonly duplicate: boolean }> {
    const { data, error } = this.executionMode === 'authenticated'
      ? await this.client.rpc('finance_authenticated_finalize_invoice', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: input.requestHash,
        p_lines_jsonb: input.lines as unknown as Json,
      })
      : await this.client.rpc('finance_finalize_invoice', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: input.requestHash,
        p_lines_jsonb: input.lines as unknown as Json,
      });
    if (error) throw new Error(error.message);
    if (!this.isFinalizeResult(data)) {
      throw new Error('Invalid finance_finalize_invoice response.');
    }
    return {
      transactionId: data.transaction_id,
      duplicate: data.is_duplicate,
    };
  }

  async readCharge(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<FinanceChargeReadModel> {
    const invoice = await this.findInvoiceById(input.tenantId, input.invoiceId);
    const position = await this.findReceivablePosition(input.tenantId, input.invoiceId);
    const ledgerCount = await this.countReceivableLedger(input.tenantId, input.invoiceId);
    const transactionLineCount = invoice.f1TransactionId
      ? await this.countTransactionLines(input.tenantId, invoice.f1TransactionId)
      : 0;

    if (!invoice.f1TransactionId) {
      throw new Error('Finalized receivable charge is missing F1 transaction id.');
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      transactionId: invoice.f1TransactionId,
      receivableLedgerEntryCount: ledgerCount,
      receivablePositionId: position.id,
      transactionLineCount,
    };
  }

  async allocatePayment(input: PaymentReceivableAllocationInput): Promise<PaymentReceivableAllocationResult> {
    const { data, error } = this.executionMode === 'authenticated'
      ? await this.client.rpc('finance_authenticated_allocate_payment', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_cash_movement_id: input.cashMovementId,
        p_allocated_amount_minor: input.allocatedAmountMinor,
        p_exchange_rate: input.exchangeRate,
        p_rate_source: input.rateSource,
        p_rate_timestamp: input.rateTimestamp,
      })
      : await this.client.rpc('finance_allocate_payment', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_cash_movement_id: input.cashMovementId,
        p_allocated_amount_minor: input.allocatedAmountMinor,
        p_exchange_rate: input.exchangeRate,
        p_rate_source: input.rateSource,
        p_rate_timestamp: input.rateTimestamp,
      });
    if (error) throw new Error(error.message);
    return { allocationId: data };
  }

  async findOpenReceivables(input: {
    readonly tenantId: string;
    readonly match: ReceivableMatchCriteria;
  }): Promise<readonly FinanceOpenReceivable[]> {
    let invoiceQuery = this.client
      .from('finance_invoices')
      .select('id, issue_date, created_at, currency')
      .eq('tenant_id', input.tenantId)
      .eq('status', 'FINALIZED');

    if (input.match.invoiceId) {
      invoiceQuery = invoiceQuery.eq('id', input.match.invoiceId);
    }
    if (input.match.bookingId) {
      invoiceQuery = invoiceQuery.eq('metadata->>booking_id', input.match.bookingId);
    }
    if (input.match.businessSourceType) {
      invoiceQuery = invoiceQuery.eq('metadata->>business_source_type', input.match.businessSourceType);
    }
    if (input.match.businessSourceId) {
      invoiceQuery = invoiceQuery.eq('metadata->>business_source_id', input.match.businessSourceId);
    }

    const { data: invoices, error: invoiceError } = await invoiceQuery
      .order('issue_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (invoiceError) throw new Error(invoiceError.message);
    if (!invoices || invoices.length === 0) return [];

    const invoiceRows = invoices as FinanceOpenInvoiceRow[];
    const invoiceIds = invoiceRows.map((invoice) => invoice.id);
    const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
    const { data: positions, error: positionError } = await this.client
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, currency')
      .eq('tenant_id', input.tenantId)
      .in('invoice_id', invoiceIds)
      .gt('outstanding_amount_minor', 0);
    if (positionError) throw new Error(positionError.message);

    return ((positions as FinanceOpenPositionRow[] | null) ?? [])
      .map((position) => {
        const invoice = invoiceById.get(position.invoice_id);
        if (!invoice) return null;
        return {
          invoiceId: position.invoice_id,
          receivablePositionId: position.id,
          outstandingAmountMinor: Number(position.outstanding_amount_minor ?? 0),
          currency: position.currency,
          issueDate: invoice.issue_date,
          createdAt: invoice.created_at,
        };
      })
      .filter((row): row is FinanceOpenReceivable => row !== null)
      .sort((left, right) =>
        left.issueDate.localeCompare(right.issueDate)
        || left.createdAt.localeCompare(right.createdAt)
        || left.invoiceId.localeCompare(right.invoiceId)
      );
  }

  async findCashReceiptByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
  }): Promise<FinanceCashReceiptSnapshot | null> {
    const { data, error } = await this.client
      .from('finance_transactions')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle<FinanceTransactionRow>();
    if (error) throw new Error(error.message);
    return data ? { transactionId: data.id } : null;
  }

  async postCashReceipt(input: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
    readonly paymentSourceType: string;
    readonly paymentSourceId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly paymentAccountCode: string;
    readonly receivableAccountCode: string;
    readonly postedAt: Date;
    readonly description: string;
  }): Promise<FinanceCashReceiptSnapshot> {
    const ledger = new LedgerEngineService(this.client);
    const response = await ledger.postTransaction({
      tenant_id: input.tenantId,
      idempotency_key: input.idempotencyKey,
      source_type: input.paymentSourceType,
      source_id: input.paymentSourceId,
      transaction_type: 'CASH',
      posted_at: input.postedAt,
      transaction_currency: input.currency,
      functional_currency: input.currency,
      description: input.description,
      reference_type: input.paymentSourceType,
      reference_id: input.paymentSourceId,
      lines: [
        {
          account_code: input.paymentAccountCode,
          debit_amount_minor: String(input.amountMinor),
          credit_amount_minor: '0',
          memo: 'Confirmed payment cash receipt',
        },
        {
          account_code: input.receivableAccountCode,
          debit_amount_minor: '0',
          credit_amount_minor: String(input.amountMinor),
          memo: 'Settle trade receivable',
        },
      ],
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to post confirmed payment cash receipt.');
    }

    return { transactionId: response.data.id };
  }

  async projectCashReceipt(input: {
    readonly tenantId: string;
    readonly transactionId: string;
  }): Promise<void> {
    const worker = new CashProjectionWorker(this.client);
    const stopWorker = worker.start();
    try {
      await new OutboxDispatcher(this.client).dispatchPendingEventsForAggregate(
        input.tenantId,
        input.transactionId,
      );
    } finally {
      stopWorker();
    }
  }

  async findCashMovementsByTransaction(input: {
    readonly tenantId: string;
    readonly transactionId: string;
  }): Promise<readonly FinanceCashMovementSnapshot[]> {
    const { data, error } = await this.client
      .from('finance_cash_movements')
      .select('id, amount_minor, direction')
      .eq('tenant_id', input.tenantId)
      .eq('f1_transaction_id', input.transactionId);
    if (error) throw new Error(error.message);
    return ((data as FinanceCashMovementRow[] | null) ?? []).map((movement) => ({
      id: movement.id,
      amountMinor: Number(movement.amount_minor),
      direction: movement.direction,
    }));
  }

  async findAllocationsByCashMovement(input: {
    readonly tenantId: string;
    readonly cashMovementId: string;
  }): Promise<readonly FinanceReceivableAllocationSnapshot[]> {
    const { data, error } = await this.client
      .from('finance_receivable_allocations')
      .select('id, invoice_id, allocated_amount_minor')
      .eq('tenant_id', input.tenantId)
      .eq('cash_movement_id', input.cashMovementId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return this.attachReceivablePositionIds(input.tenantId, (data as FinanceAllocationRow[] | null) ?? []);
  }

  async findExistingAllocation(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly cashMovementId: string;
  }): Promise<FinanceReceivableAllocationSnapshot | null> {
    const allocations = await this.findAllocationsByCashMovement({
      tenantId: input.tenantId,
      cashMovementId: input.cashMovementId,
    });
    return allocations.find((allocation) => allocation.invoiceId === input.invoiceId) ?? null;
  }

  private async findInvoiceById(tenantId: string, invoiceId: string): Promise<FinanceInvoiceSnapshot> {
    const { data, error } = await this.client
      .from('finance_invoices')
      .select('id, invoice_number, status, posting_attempt_id, f1_transaction_id')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .single<FinanceInvoiceRow>();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      status: data.status,
      postingAttemptId: data.posting_attempt_id,
      f1TransactionId: data.f1_transaction_id,
    };
  }

  private async findReceivablePosition(tenantId: string, invoiceId: string): Promise<FinancePositionRow> {
    const { data, error } = await this.client
      .from('finance_receivable_positions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .single<FinancePositionRow>();
    if (error) throw new Error(error.message);
    return data;
  }

  private async countReceivableLedger(tenantId: string, invoiceId: string): Promise<number> {
    const { count, error } = await this.client
      .from('finance_receivable_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .eq('entry_type', 'DEBIT_ACCRUAL');
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  private async countTransactionLines(tenantId: string, transactionId: string): Promise<number> {
    const { count, error } = await this.client
      .from('finance_transaction_lines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('transaction_id', transactionId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  private async attachReceivablePositionIds(
    tenantId: string,
    allocations: readonly FinanceAllocationRow[],
  ): Promise<readonly FinanceReceivableAllocationSnapshot[]> {
    if (allocations.length === 0) return [];

    const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoice_id))];
    const { data: positions, error } = await this.client
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, currency')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds);
    if (error) throw new Error(error.message);

    const positionByInvoice = new Map(
      ((positions as FinanceOpenPositionRow[] | null) ?? []).map((position) => [position.invoice_id, position.id]),
    );

    return allocations.map((allocation) => {
      const receivablePositionId = positionByInvoice.get(allocation.invoice_id);
      if (!receivablePositionId) {
        throw new Error(`Receivable position not found for invoice ${allocation.invoice_id}.`);
      }
      return {
        invoiceId: allocation.invoice_id,
        receivablePositionId,
        allocationId: allocation.id,
        allocatedAmountMinor: Number(allocation.allocated_amount_minor),
      };
    });
  }

  private isFinalizeResult(value: Json): value is { transaction_id: string; is_duplicate: boolean } {
    return typeof value === 'object'
      && value !== null
      && !Array.isArray(value)
      && typeof value.transaction_id === 'string'
      && typeof value.is_duplicate === 'boolean';
  }
}
