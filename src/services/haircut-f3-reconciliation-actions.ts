'use server';

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';
import { getCurrentUser } from '@/services/user-actions';
import type { Database, Json } from '@/types/database.types';

export interface HaircutF3DebtRow {
  readonly invoiceId: string;
  readonly receivablePositionId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly bookingId: string;
  readonly bookingNumber: string;
  readonly packageName: string;
  readonly sessionLogId: string;
  readonly invoiceNumber: string;
  readonly outstandingAmountMinor: number;
  readonly currency: string;
  readonly issueDate: string;
  readonly createdAt: string;
}

export interface HaircutF3DebtReadResult {
  readonly success: boolean;
  readonly data?: readonly HaircutF3DebtRow[];
  readonly error?: string;
}

export interface HaircutF3DebtCollectionInput {
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly paymentMethod: 'bank_transfer' | 'cash';
  readonly receivedAt?: string;
  readonly notes?: string;
}

export interface HaircutF3DebtCollectionResult {
  readonly success: boolean;
  readonly data?: {
    readonly invoiceId: string;
    readonly receivablePositionId: string;
    readonly beforeOutstandingAmountMinor: number;
    readonly afterOutstandingAmountMinor: number;
    readonly cashMovementId: string;
    readonly transactionId: string;
    readonly allocationId: string;
    readonly duplicate: boolean;
  };
  readonly error?: string;
}

type FinanceInvoiceRow = Pick<
  Database['public']['Tables']['finance_invoices']['Row'],
  'id' | 'invoice_number' | 'customer_id' | 'issue_date' | 'created_at' | 'currency' | 'metadata'
>;

type FinancePositionRow = Pick<
  Database['public']['Tables']['finance_receivable_positions']['Row'],
  'id' | 'invoice_id' | 'outstanding_amount_minor' | 'currency'
>;

type CustomerRow = Pick<
  Database['public']['Tables']['customers']['Row'],
  'id' | 'name_mother' | 'phone'
>;

const HAIRCUT_SESSION_DONE_SOURCE_TYPE = 'HAIRCUT_SESSION_DONE';
const F3_DEBT_COLLECTION_SOURCE_TYPE = 'HAIRCUT_F3_DEBT_COLLECTION';

function canWriteHaircutF3Collection(role: string | null | undefined) {
  return role === 'admin' || role === 'accountant';
}

function toRecord(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function getLocalDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildCollectionIdempotencyKey(input: {
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly paymentMethod: string;
  readonly receivedAt: string;
}) {
  return [
    'haircut-f3-collection:v1',
    input.tenantId,
    input.invoiceId,
    input.amountMinor,
    input.paymentMethod,
    input.receivedAt,
  ].join(':');
}

function toDebtRow(
  invoice: FinanceInvoiceRow,
  position: FinancePositionRow,
  customer: CustomerRow | undefined,
): HaircutF3DebtRow | null {
  const metadata = toRecord(invoice.metadata);
  if (readStringField(metadata, 'business_source_type') !== HAIRCUT_SESSION_DONE_SOURCE_TYPE) {
    return null;
  }

  const bookingId = readStringField(metadata, 'booking_id');
  const sessionLogId = readStringField(metadata, 'session_log_id');
  if (!bookingId || !sessionLogId) return null;

  const customerName = customer?.name_mother?.trim() || invoice.customer_id;
  return {
    invoiceId: invoice.id,
    receivablePositionId: position.id,
    customerId: invoice.customer_id,
    customerName,
    customerPhone: customer?.phone ?? '',
    bookingId,
    bookingNumber: readStringField(metadata, 'booking_number'),
    packageName: readStringField(metadata, 'package_name') || 'Haircut service',
    sessionLogId,
    invoiceNumber: invoice.invoice_number,
    outstandingAmountMinor: Number(position.outstanding_amount_minor ?? 0),
    currency: position.currency || invoice.currency,
    issueDate: invoice.issue_date,
    createdAt: invoice.created_at,
  };
}

async function resolveCurrentTenant() {
  const user = await getCurrentUser();
  if (!user?.tenant_id) {
    return { user: null, tenantId: null, error: 'Không tìm thấy tenant hiện tại' };
  }
  return { user, tenantId: user.tenant_id, error: null };
}

export async function getHaircutF3OpenReceivables(): Promise<HaircutF3DebtReadResult> {
  try {
    const { tenantId, error } = await resolveCurrentTenant();
    if (!tenantId) return { success: false, error: error ?? 'Không có quyền xem công nợ' };

    const supabase = await createClient();
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('finance_invoices')
      .select('id, invoice_number, customer_id, issue_date, created_at, currency, metadata')
      .eq('tenant_id', tenantId)
      .eq('status', 'FINALIZED')
      .eq('metadata->>business_source_type', HAIRCUT_SESSION_DONE_SOURCE_TYPE)
      .order('issue_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (invoiceError) return { success: false, error: invoiceError.message };
    const invoices = (invoiceData as FinanceInvoiceRow[] | null) ?? [];
    if (invoices.length === 0) return { success: true, data: [] };

    const invoiceIds = invoices.map((invoice) => invoice.id);
    const { data: positionData, error: positionError } = await supabase
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, currency')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds)
      .gt('outstanding_amount_minor', 0);
    if (positionError) return { success: false, error: positionError.message };

    const positions = (positionData as FinancePositionRow[] | null) ?? [];
    const positionByInvoice = new Map(positions.map((position) => [position.invoice_id, position]));
    const customerIds = [...new Set(invoices.map((invoice) => invoice.customer_id))];
    const customerById = new Map<string, CustomerRow>();

    if (customerIds.length > 0) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, name_mother, phone')
        .eq('tenant_id', tenantId)
        .in('id', customerIds);
      if (customerError) return { success: false, error: customerError.message };
      for (const customer of (customerData as CustomerRow[] | null) ?? []) {
        customerById.set(customer.id, customer);
      }
    }

    const rows = invoices
      .map((invoice) => {
        const position = positionByInvoice.get(invoice.id);
        if (!position) return null;
        return toDebtRow(invoice, position, customerById.get(invoice.customer_id));
      })
      .filter((row): row is HaircutF3DebtRow => row !== null)
      .sort((left, right) =>
        left.issueDate.localeCompare(right.issueDate)
        || left.createdAt.localeCompare(right.createdAt)
        || left.invoiceId.localeCompare(right.invoiceId)
      );

    return { success: true, data: rows };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Không thể tải công nợ F3 Haircut' };
  }
}

export async function collectHaircutF3ReceivablePayment(
  input: HaircutF3DebtCollectionInput,
): Promise<HaircutF3DebtCollectionResult> {
  try {
    const { user, tenantId, error } = await resolveCurrentTenant();
    if (!user || !tenantId || !canWriteHaircutF3Collection(user.role)) {
      return { success: false, error: error ?? 'Không có quyền thu công nợ F3 Haircut' };
    }
    if (!input.invoiceId.trim()) return { success: false, error: 'Thiếu invoice cần thu' };
    if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
      return { success: false, error: 'Số tiền thu không hợp lệ' };
    }

    const receivedAt = input.receivedAt || getLocalDateString();
    const supabase = await createClient();
    const { data: invoice, error: invoiceError } = await supabase
      .from('finance_invoices')
      .select('id, invoice_number, customer_id, currency, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', input.invoiceId)
      .eq('status', 'FINALIZED')
      .single();
    if (invoiceError || !invoice) {
      return { success: false, error: invoiceError?.message ?? 'Không tìm thấy F3 invoice trong tenant hiện tại' };
    }

    const metadata = toRecord(invoice.metadata);
    if (readStringField(metadata, 'business_source_type') !== HAIRCUT_SESSION_DONE_SOURCE_TYPE) {
      return { success: false, error: 'Invoice không thuộc Haircut SESSION_DONE receivable' };
    }

    const { data: position, error: positionError } = await supabase
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, currency')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', input.invoiceId)
      .single<FinancePositionRow>();
    if (positionError || !position) {
      return { success: false, error: positionError?.message ?? 'Không tìm thấy F3 receivable position' };
    }

    const beforeOutstanding = Number(position.outstanding_amount_minor ?? 0);
    if (input.amountMinor > beforeOutstanding) {
      return { success: false, error: 'Số tiền thu vượt quá công nợ F3 còn lại' };
    }

    const { url, adminKey } = requireSupabaseAdminEnv();
    const adminClient = createSupabaseJsClient<Database>(url, adminKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const service = new SemanticReceivableChargeService(
      new SupabaseReceivableChargeGateway(adminClient, 'service_role'),
    );

    const idempotencyKey = buildCollectionIdempotencyKey({
      tenantId,
      invoiceId: input.invoiceId,
      amountMinor: input.amountMinor,
      paymentMethod: input.paymentMethod,
      receivedAt,
    });

    const allocation = await service.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId,
      invoiceId: input.invoiceId,
      paymentSourceType: F3_DEBT_COLLECTION_SOURCE_TYPE,
      paymentSourceId: input.invoiceId,
      amountMinor: input.amountMinor,
      currency: invoice.currency,
      paymentMethod: input.paymentMethod,
      receivedAt,
      idempotencyKey,
      description: input.notes || `Haircut F3 receivable collection ${invoice.invoice_number}`,
    });

    const { data: readBack, error: readBackError } = await supabase
      .from('finance_receivable_positions')
      .select('id, invoice_id, outstanding_amount_minor, currency')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', input.invoiceId)
      .single<FinancePositionRow>();
    if (readBackError || !readBack) {
      return { success: false, error: readBackError?.message ?? 'Không đọc lại được F3 receivable sau thu' };
    }

    const firstAllocation = allocation.allocations[0];
    if (!firstAllocation) {
      return { success: false, error: 'F3 allocation không trả về dòng allocation' };
    }

    return {
      success: true,
      data: {
        invoiceId: input.invoiceId,
        receivablePositionId: readBack.id,
        beforeOutstandingAmountMinor: beforeOutstanding,
        afterOutstandingAmountMinor: Number(readBack.outstanding_amount_minor ?? 0),
        cashMovementId: allocation.cashMovementId,
        transactionId: allocation.transactionId,
        allocationId: firstAllocation.allocationId,
        duplicate: allocation.duplicate,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Không thể thu công nợ F3 Haircut' };
  }
}
