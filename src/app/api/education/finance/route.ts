import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { FinanceAtomicDatabaseError, PreschoolFinanceRepository } from '@/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '@/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService } from '@/products/bella-education/finance/services/invoice-issuance.service';
import { PaymentReconciliationService } from '@/products/bella-education/finance/services/payment-reconciliation.service';
import type { Payment } from '@/products/bella-education/finance/domain/finance.types';
import { resolvePreschoolFinanceActor, type PreschoolFinanceOperation } from '@/products/bella-education/finance/services/preschool-finance-authorization.service';
type FinanceServerClient = SupabaseClient<Database>;
interface FinanceCommandBody { action?: unknown; branchId?: unknown; studentPartyId?: unknown; billingPeriodId?: unknown; invoiceId?: unknown; exceptionId?: unknown; paymentAmount?: unknown; paymentMethod?: unknown; operationKey?: unknown; resolutionNotes?: unknown; }

function createAdminOperationClient(): FinanceServerClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveNumber(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('INVALID_PAYMENT_AMOUNT_ERROR: Numeric payment amount required.');
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT_ERROR: Payment amount must be greater than zero.');
  }
  return parsed;
}

function asPaymentMethod(value: unknown): Payment['paymentMethod'] {
  if (value === 'BANK_TRANSFER' || value === 'QR_CODE' || value === 'CASH') {
    return value;
  }
  throw new Error('INVALID_PAYMENT_METHOD_ERROR: Unsupported payment method.');
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('FINANCE_UNAUTHENTICATED')) return 401;
  if (message.startsWith('AUTH_ROLE_PERMISSION_ERROR')) return 403;
  if (message.startsWith('FINANCE_OPERATION_CONFLICT') || message.startsWith('FINANCE_CANONICAL_CONFLICT')
      || message.startsWith('DUPLICATE_RECONCILIATION_ERROR')) return 409;
  if (error instanceof FinanceAtomicDatabaseError) {
    if (error.code === '42501') return 403;
    if (error.code === '22P02') return 400;
    const domainErrors = ['INVOICE_', 'UNISSUED_INVOICE_', 'PAYMENT_', 'ALLOCATION_', 'INVALID_', 'FINANCE_INVALID_',
      'FINANCE_GUARDIAN_REQUIRED', 'FINANCE_STUDENT_ENROLLMENT_REQUIRED', 'STUDENT_PARTY_', 'PAYER_PARTY_', 'FINANCE_PAYMENT_STATUS_ERROR'];
    return error.code === 'P0001' && domainErrors.some((prefix) => message.startsWith(prefix)) ? 400 : 500;
  }
  if (message.includes('TENANT_ISOLATION_VIOLATION')) return 403;
  return 400;
}

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Finance operation failed';
  return NextResponse.json({ success: false, error: message,
    ...(error instanceof FinanceAtomicDatabaseError && error.paymentNotCommitted ? { paymentNotCommitted: true } : {}),
  }, { status: errorStatus(error) });
}

async function resolveActor(operation: PreschoolFinanceOperation) {
  const profile = await getCurrentUser();
  return resolvePreschoolFinanceActor(profile, operation);
}

export async function GET(request?: Request) {
  try {
    const actor = await resolveActor('read');
    const branchId = request ? new URL(request.url).searchParams.get('branchId')?.trim() || null : null;
    const client = createAdminOperationClient() ?? await createClient();
    const state = await new PreschoolFinanceRepository(client).readBranchState(actor.tenantId, actor.actorId, branchId);
    return NextResponse.json({ success: true, ...state });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinanceCommandBody;
    const action = asString(body.action);
    const operation: PreschoolFinanceOperation = action === 'recordAndReconcilePayment' ? 'reconcile-payment'
      : action === 'resolveException' ? 'resolve-exception' : action === 'completeTuitionServicePeriod' ? 'complete-service-period' : 'modify-invoice';
    const actor = await resolveActor(operation);
    const branchId = asString(body.branchId);
    if (!branchId) throw new Error('AUTH_ROLE_PERMISSION_ERROR: Explicit Finance branch selection required.');
    if (action === 'completeTuitionServicePeriod') throw new Error('AUTH_ROLE_PERMISSION_ERROR: Tenant-wide completion is unavailable in branch Finance.');
    const client = createAdminOperationClient() ?? await createClient();
    const repo = new PreschoolFinanceRepository(client, { tenantId: actor.tenantId, actorId: actor.actorId, branchId });

    if (action === 'recordAndReconcilePayment') {
      const invoiceId = asString(body.invoiceId);
      if (!invoiceId) throw new Error('FINANCE_INVOICE_REQUIRED: invoiceId is required.');
      const operationKey = typeof body.operationKey === 'string' ? body.operationKey : '';
      if (!operationKey.trim() || operationKey.length > 200) throw new Error('FINANCE_OPERATION_KEY_REQUIRED: Stable operationKey of at most 200 characters required.');
      const result = await new PaymentReconciliationService(repo).recordAndReconcilePayment({
        tenantId: actor.tenantId, actorId: actor.actorId, branchId, operationKey, invoiceId,
        paymentAmount: asPositiveNumber(body.paymentAmount), paymentMethod: asPaymentMethod(body.paymentMethod),
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === 'resolveException') {
      const exceptionId = asString(body.exceptionId);
      if (!exceptionId) throw new Error('FINANCE_EXCEPTION_REQUIRED: exceptionId is required.');
      const exception = await repo.branchCommand(action, { exceptionId, resolutionNotes: asString(body.resolutionNotes) || 'Resolved by Preschool Finance operator.' });
      return NextResponse.json({ success: true, exception });
    }
    if (action === 'scanOverdueInvoices') {
      const result = await repo.branchCommand(action, {});
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('FINANCE_CANONICAL_CONFLICT: Expected scanner result.');
      return NextResponse.json({ success: true, ...result });
    }
    // Existing calculation/issuance services stay in Product. The selected scope
    // gates their read inputs and the RPC rechecks live access before final writes.
    const state = await repo.readBranchState(actor.tenantId, actor.actorId, branchId);
    if (action === 'compileDraftInvoice') {
      const studentPartyId = asString(body.studentPartyId), billingPeriodId = asString(body.billingPeriodId);
      if (!studentPartyId) throw new Error('FINANCE_STUDENT_REQUIRED: studentPartyId is required.');
      if (!billingPeriodId) throw new Error('FINANCE_BILLING_PERIOD_REQUIRED: billingPeriodId is required.');
      if (!state.students.some(student => student.studentPartyId === studentPartyId)) throw new Error('AUTH_ROLE_PERMISSION_ERROR: Student outside current branch scope.');
      const period = state.billingPeriods.find(period => period.id === billingPeriodId);
      if (!period) throw new Error('FINANCE_BILLING_PERIOD_NOT_FOUND: Active tenant billing period required.');
      const invoice = await new TuitionBillingService(repo).compileDraftInvoice({ tenantId: actor.tenantId, studentPartyId, billingPeriodId, dueDate: period.dueDate, createdBy: actor.actorId });
      return NextResponse.json({ success: true, invoice });
    }
    const invoiceId = asString(body.invoiceId);
    const invoice = state.invoices.find(invoice => invoice.id === invoiceId);
    if (!invoice) throw new Error('AUTH_ROLE_PERMISSION_ERROR: Invoice outside current branch scope.');
    if (action === 'issueInvoice') {
      return NextResponse.json({ success: true, invoice: await new InvoiceIssuanceService(repo).issueInvoice(actor.tenantId, invoiceId) });
    }
    if (action === 'projectInvoiceNotice') {
      const projection = await repo.branchCommand(action, {
        invoiceId, title: 'Thông báo học phí & Phí dịch vụ: Hóa đơn ' + invoice.invoiceNumber,
        bodyText: 'Kính gửi Phụ huynh, tổng số tiền cần thanh toán cho kỳ học là ' + invoice.netAmount.toLocaleString('vi-VN') + ' VNĐ. Hạn chót thanh toán: ' + invoice.dueDate + '.',
      });
      return NextResponse.json({ success: true, projection });
    }
    throw new Error('FINANCE_UNKNOWN_ACTION: ' + (action || 'missing'));
  } catch (error) { return jsonError(error); }
}
