import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';
import { PreschoolFinanceRepository } from '@/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '@/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService } from '@/products/bella-education/finance/services/invoice-issuance.service';
import { TuitionServicePeriodCompletionService } from '@/products/bella-education/finance/services/tuition-service-period-completion.service';
import { PaymentReconciliationService } from '@/products/bella-education/finance/services/payment-reconciliation.service';
import { OverduePaymentScannerService } from '@/products/bella-education/finance/services/overdue-payment-scanner.service';
import { FinanceProjectionBridge } from '@/products/bella-education/parent-engagement/bridges/finance-projection.bridge';
import { CommunicationDeliveryService } from '@/products/bella-education/parent-engagement/services/communication-delivery.service';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';
import type { BillingPeriod, Invoice, Payment, TuitionServicePeriodCompletion } from '@/products/bella-education/finance/domain/finance.types';
import {
  PreschoolFinanceOperation,
  resolvePreschoolFinanceActor,
} from '@/products/bella-education/finance/services/preschool-finance-authorization.service';

type FinanceServerClient = SupabaseClient<Database>;
type PaymentRow = Database['public']['Tables']['edu_fin_payments']['Row'];
type ExceptionRow = Database['public']['Tables']['edu_comm_exceptions']['Row'];

interface FinanceStudentOption {
  enrollmentId: string;
  courseId: string;
  studentPartyId: string;
  studentId: string | null;
  studentCode: string | null;
  displayName: string;
}

interface FinanceCommandBody {
  action?: unknown;
  studentPartyId?: unknown;
  billingPeriodId?: unknown;
  invoiceId?: unknown;
  exceptionId?: unknown;
  paymentAmount?: unknown;
  paymentMethod?: unknown;
  resolutionNotes?: unknown;
}

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

function mapPayment(row: PaymentRow): Payment {
  if (!row.student_party_id) {
    throw new Error(`FINANCE_CANONICAL_PAYMENT_STUDENT_IDENTITY_MISSING: ${row.id}`);
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    payerPartyId: row.payer_party_id,
    studentPartyId: row.student_party_id,
    studentId: row.student_id,
    paymentNumber: row.payment_number,
    paymentMethod: row.payment_method as Payment['paymentMethod'],
    amount: Number(row.amount),
    allocatedAmount: Number(row.allocated_amount),
    unallocatedAmount: Number(row.unallocated_amount),
    referenceNumber: row.reference_number ?? undefined,
    paymentDate: row.payment_date,
    status: row.status as Payment['status'],
    createdBy: row.created_by,
    createdAt: row.created_at ?? undefined,
  };
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message === 'PRESCHOOL_FINANCE_NOT_READY' || message === 'FINANCE_PRODUCT_UNAVAILABLE') return 503;
  if (message.startsWith('FINANCE_UNAUTHENTICATED')) return 401;
  if (message.startsWith('AUTH_ROLE_PERMISSION_ERROR')) return 403;
  if (message.includes('TENANT_ISOLATION_VIOLATION')) return 403;
  return 400;
}

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Finance operation failed';
  return NextResponse.json({ success: false, error: message, ...(message === 'PRESCHOOL_FINANCE_NOT_READY' ? { code: message } : {}) }, { status: errorStatus(error), headers: { 'Cache-Control': 'private, no-store' } });
}

async function resolveActor(operation: PreschoolFinanceOperation) {
  const profile = await getCurrentUser();
  const actor = resolvePreschoolFinanceActor(profile, operation);
  // The MVP hold is enforced before creating any privileged/business client.
  const caller = await createClient();
  const auth = await caller.auth.getUser();
  if (auth.error || auth.data.user?.id !== actor.actorId) throw new Error('FINANCE_UNAUTHENTICATED');
  const tenant = await caller.from('tenants').select('id, status, product_key').eq('id', actor.tenantId).maybeSingle();
  if (tenant.error || tenant.data?.id !== actor.tenantId || tenant.data.status !== 'active' || !tenant.data.product_key) {
    throw new Error('FINANCE_PRODUCT_UNAVAILABLE');
  }
  if (tenant.data.product_key === 'bella_preschool') throw new Error('PRESCHOOL_FINANCE_NOT_READY');
  return actor;
}

async function loadFinanceStudents(
  client: FinanceServerClient,
  tenantId: string,
): Promise<FinanceStudentOption[]> {
  const { data: enrollmentList, error: enrollmentErr } = await client
    .from('edu_enrollments')
    .select('id, course_id, student_party_id, status')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'pending'])
    .limit(50);

  if (enrollmentErr) {
    throw new Error(`FINANCE_STUDENT_LOAD_FAILED: ${enrollmentErr.message}`);
  }

  const studentPartyIds = [
    ...new Set((enrollmentList || []).map((enrollment) => enrollment.student_party_id).filter(Boolean)),
  ];
  if (studentPartyIds.length === 0) return [];

  const [{ data: partyList, error: partyErr }, { data: studentRows, error: studentErr }] = await Promise.all([
    client
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId)
      .in('id', studentPartyIds),
    client
      .from('students')
      .select('student_id, party_id, student_code')
      .eq('tenant_id', tenantId)
      .in('party_id', studentPartyIds),
  ]);

  if (partyErr) throw new Error(`FINANCE_PARTY_LOAD_FAILED: ${partyErr.message}`);
  if (studentErr) throw new Error(`FINANCE_STUDENT_ROW_LOAD_FAILED: ${studentErr.message}`);

  const partiesById = new Map((partyList || []).map((party) => [party.id, party]));
  const studentsByPartyId = new Map((studentRows || []).map((student) => [student.party_id, student]));

  return (enrollmentList || []).map((enrollment) => {
    const party = partiesById.get(enrollment.student_party_id);
    const student = studentsByPartyId.get(enrollment.student_party_id);
    if (!party?.display_name) {
      throw new Error(`FINANCE_CANONICAL_STUDENT_JOIN_FAILED: ${enrollment.student_party_id}`);
    }
    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.course_id,
      studentPartyId: enrollment.student_party_id,
      studentId: student?.student_id ?? null,
      studentCode: student?.student_code ?? null,
      displayName: party.display_name,
    };
  });
}

async function loadPayments(client: FinanceServerClient, tenantId: string): Promise<Payment[]> {
  const { data, error } = await client
    .from('edu_fin_payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`FINANCE_PAYMENT_LOAD_FAILED: ${error.message}`);
  return (data || []).map(mapPayment);
}

async function loadExceptions(client: FinanceServerClient, tenantId: string): Promise<ExceptionRow[]> {
  const { data, error } = await client
    .from('edu_comm_exceptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`FINANCE_EXCEPTION_LOAD_FAILED: ${error.message}`);
  return data || [];
}

async function loadFinanceState(client: FinanceServerClient, tenantId: string, repo: PreschoolFinanceRepository) {
  const [students, billingPeriods, servicePeriodCompletions, invoices, payments, exceptions] = await Promise.all([
    loadFinanceStudents(client, tenantId),
    repo.listActiveBillingPeriods(tenantId),
    repo.listTuitionServicePeriodCompletions(tenantId),
    repo.listInvoices(tenantId),
    loadPayments(client, tenantId),
    loadExceptions(client, tenantId),
  ]);

  return { students, billingPeriods, servicePeriodCompletions, invoices, payments, exceptions };
}

async function resolveGuardianPartyIds(
  client: FinanceServerClient,
  tenantId: string,
  studentPartyId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('party_relationships')
    .select('source_party_id')
    .eq('tenant_id', tenantId)
    .eq('target_party_id', studentPartyId)
    .eq('relationship_type', 'guardian_of');

  if (error) throw new Error(`FINANCE_GUARDIAN_RESOLUTION_FAILED: ${error.message}`);

  const guardianPartyIds = (data || []).map((row) => row.source_party_id).filter(Boolean);
  if (guardianPartyIds.length === 0) {
    throw new Error(`FINANCE_GUARDIAN_REQUIRED: Student Party ${studentPartyId} has no canonical guardian relationship.`);
  }
  return guardianPartyIds;
}

function createServices(client: FinanceServerClient) {
  const repo = new PreschoolFinanceRepository(client);
  const commRepo = new ParentCommunicationRepository(client);
  const deliveryService = new CommunicationDeliveryService(commRepo);
  const exceptionService = new CommunicationExceptionService(commRepo);
  const projectionBridge = new FinanceProjectionBridge(client, deliveryService, commRepo);

  return {
    repo,
    billingService: new TuitionBillingService(repo),
    issuanceService: new InvoiceIssuanceService(repo),
    completionService: new TuitionServicePeriodCompletionService(repo),
    reconService: new PaymentReconciliationService(repo),
    scannerService: new OverduePaymentScannerService(client),
    exceptionService,
    projectionBridge,
  };
}

export async function GET() {
  try {
    const actor = await resolveActor('read');
    const client = createAdminOperationClient() ?? await createClient();
    const { repo } = createServices(client);
    const state = await loadFinanceState(client, actor.tenantId, repo);

    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinanceCommandBody;
    const action = asString(body.action);
    const operation: PreschoolFinanceOperation = action === 'recordAndReconcilePayment'
      ? 'reconcile-payment'
      : action === 'resolveException'
        ? 'resolve-exception'
        : action === 'completeTuitionServicePeriod'
          ? 'complete-service-period'
          : 'modify-invoice';
    const actor = await resolveActor(operation);
    const client = createAdminOperationClient() ?? await createClient();
    const {
      repo,
      billingService,
      issuanceService,
      completionService,
      reconService,
      scannerService,
      exceptionService,
      projectionBridge,
    } = createServices(client);

    if (action === 'compileDraftInvoice') {
      const studentPartyId = asString(body.studentPartyId);
      const billingPeriodId = asString(body.billingPeriodId);
      if (!studentPartyId) throw new Error('FINANCE_STUDENT_REQUIRED: studentPartyId is required.');
      if (!billingPeriodId) throw new Error('FINANCE_BILLING_PERIOD_REQUIRED: billingPeriodId is required.');

      const billingPeriod: BillingPeriod | null = await repo.getBillingPeriodById(actor.tenantId, billingPeriodId);
      if (!billingPeriod || billingPeriod.status !== 'ACTIVE') {
        throw new Error(`FINANCE_BILLING_PERIOD_NOT_FOUND: Billing period ${billingPeriodId} is not active in tenant.`);
      }

      const invoice = await billingService.compileDraftInvoice({
        tenantId: actor.tenantId,
        studentPartyId,
        billingPeriodId,
        dueDate: billingPeriod.dueDate,
        createdBy: actor.actorId,
      });

      return NextResponse.json({ success: true, invoice });
    }

    if (action === 'issueInvoice') {
      const invoiceId = asString(body.invoiceId);
      if (!invoiceId) throw new Error('FINANCE_INVOICE_REQUIRED: invoiceId is required.');
      const invoice = await issuanceService.issueInvoice(actor.tenantId, invoiceId);
      return NextResponse.json({ success: true, invoice });
    }

    if (action === 'completeTuitionServicePeriod') {
      const billingPeriodId = asString(body.billingPeriodId);
      if (!billingPeriodId) throw new Error('FINANCE_BILLING_PERIOD_REQUIRED: billingPeriodId is required.');
      const result = await completionService.completePeriod({
        tenantId: actor.tenantId,
        billingPeriodId,
        completedBy: actor.actorId,
      });
      return NextResponse.json({
        success: true,
        completion: result.completion satisfies TuitionServicePeriodCompletion,
        alreadyCompleted: result.alreadyCompleted,
      });
    }

    if (action === 'projectInvoiceNotice') {
      const invoiceId = asString(body.invoiceId);
      if (!invoiceId) throw new Error('FINANCE_INVOICE_REQUIRED: invoiceId is required.');
      const invoice = await repo.getInvoiceById(actor.tenantId, invoiceId);
      if (!invoice) throw new Error(`INVOICE_NOT_FOUND_ERROR: Invoice ${invoiceId} not found.`);
      const guardianPartyIds = await resolveGuardianPartyIds(client, actor.tenantId, invoice.studentPartyId);
      const result = await projectionBridge.projectIssuedInvoice({
        tenantId: actor.tenantId,
        studentPartyId: invoice.studentPartyId,
        studentId: invoice.studentId,
        guardianPartyIds,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        netAmount: invoice.netAmount,
        dueDate: invoice.dueDate,
        invoiceStatus: invoice.invoiceStatus,
        createdBy: actor.actorId,
      });
      return NextResponse.json({ success: true, projection: result });
    }

    if (action === 'scanOverdueInvoices') {
      const result = await scannerService.scanAndEscalateOverdueInvoices(actor.tenantId);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'recordAndReconcilePayment') {
      const invoiceId = asString(body.invoiceId);
      if (!invoiceId) throw new Error('FINANCE_INVOICE_REQUIRED: invoiceId is required.');
      const invoice = await repo.getInvoiceById(actor.tenantId, invoiceId);
      if (!invoice) throw new Error(`INVOICE_NOT_FOUND_ERROR: Invoice ${invoiceId} not found.`);
      const [payerPartyId] = await resolveGuardianPartyIds(client, actor.tenantId, invoice.studentPartyId);
      const amount = asPositiveNumber(body.paymentAmount);
      const paymentMethod = asPaymentMethod(body.paymentMethod);

      const payment = await reconService.recordInboundPayment({
        tenantId: actor.tenantId,
        payerPartyId,
        studentPartyId: invoice.studentPartyId,
        studentId: invoice.studentId,
        paymentMethod,
        amount,
        createdBy: actor.actorId,
      });

      const reconciliation = await reconService.reconcilePaymentToInvoice({
        tenantId: actor.tenantId,
        paymentId: payment.id,
        invoiceId,
        allocationAmount: amount,
        reconciledByPartyId: actor.actorId,
      });

      return NextResponse.json({ success: true, payment, ...reconciliation });
    }

    if (action === 'resolveException') {
      const exceptionId = asString(body.exceptionId);
      if (!exceptionId) throw new Error('FINANCE_EXCEPTION_REQUIRED: exceptionId is required.');
      const exception = await exceptionService.resolveException({
        tenantId: actor.tenantId,
        exceptionId,
        resolvedBy: actor.actorId,
        resolutionNotes: asString(body.resolutionNotes) || 'Resolved by Preschool Finance operator.',
      });
      return NextResponse.json({ success: true, exception });
    }

    throw new Error(`FINANCE_UNKNOWN_ACTION: ${action || 'missing'}`);
  } catch (error) {
    return jsonError(error);
  }
}
