import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { RevenueRecognitionService } from '@/services/revenue-recognition';
import { AccountingEngineService, type JournalEntryInput } from '@/services/accounting-engine';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { SemanticReceivableChargeService } from '@/platform/finance/services/semantic-receivable-charge.service';
import { SupabaseReceivableChargeGateway } from '@/platform/finance/gateways/supabase-receivable-charge.gateway';
import type { BeautyH8Database } from '@/platform/beauty/infrastructure';

export const dynamic = 'force-dynamic';

type AdminClient = ReturnType<typeof getAdminClient>;
type BeautyH8Client = SupabaseClient<BeautyH8Database>;
type OutboxEvent = Database['public']['Functions']['claim_outbox_batch']['Returns'][number];
type OutboxPayload = Record<string, Json | undefined>;
type WorkerEventResult = {
  eventId: string;
  eventType: string;
  referenceId: string;
  status: 'completed' | 'dead_lettered' | 'failed' | 'critical_failed';
  journalEntryId?: string | null;
  error?: string;
  markFailedError?: string;
};
type AccountingWorkerRunStatus = 'success' | 'partial_failure' | 'critical_failure' | 'claim_failed' | 'exception';
type AccountingWorkerRunInsert = Database['public']['Tables']['accounting_worker_runs']['Insert'];
type MarkOutboxCompletedRpc = (
  fn: 'mark_outbox_completed',
  args: { p_outbox_id: string; p_journal_entry_id: string | null }
) => ReturnType<AdminClient['rpc']>;
type WorkerJournalReferenceType = NonNullable<JournalEntryInput['reference_type']>;
type ExistingJournalReference = {
  id: string;
  status: string;
};
type InterBranchClearingRole = 'debtor' | 'creditor';
type HaircutSessionReceivableSource = Pick<
  Database['public']['Tables']['session_logs']['Row'],
  'id' | 'status' | 'booking_id' | 'completed_date' | 'created_at' | 'session_number'
>;
type HaircutBookingReceivableSource = Pick<
  Database['public']['Tables']['bookings']['Row'],
  'id' | 'customer_id' | 'booking_number' | 'package_name'
>;
type BeautySessionReceivableSource = Pick<
  BeautyH8Database['public']['Tables']['beauty_sessions']['Row'],
  'id' | 'status' | 'appointment_id' | 'actual_end_at' | 'actual_start_at' | 'actual_performer_id' | 'created_at'
>;
type BeautyAppointmentReceivableSource = Pick<
  BeautyH8Database['public']['Tables']['beauty_appointments']['Row'],
  'id' | 'customer_id' | 'service_id' | 'branch_id'
>;

const HAIRCUT_SESSION_DONE_SOURCE_TYPE = 'HAIRCUT_SESSION_DONE';
const HAIRCUT_PRODUCT_KEY = 'bella_haircut';
const BEAUTY_SESSION_REFERENCE_TYPE = 'BEAUTY_SESSION';
const BEAUTY_SESSION_DONE_SOURCE_TYPE = 'BEAUTY_SESSION_DONE';

function getAdminClient() {
  const { url, adminKey } = requireSupabaseAdminEnv();
  return createClient<Database>(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBeautyH8Client(): BeautyH8Client {
  const { url, adminKey } = requireSupabaseAdminEnv();
  return createClient<BeautyH8Database>(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  if (error === null || error === undefined) return fallback;
  return String(error);
}

function getUniqueTenantIds(events: OutboxEvent[]) {
  return Array.from(new Set(
    events
      .map((event) => event.tenant_id)
      .filter((tenantId): tenantId is string => typeof tenantId === 'string' && tenantId.length > 0)
  ));
}

function workerDetailsToJson(details: WorkerEventResult[]): Json {
  const rows: Record<string, Json | undefined>[] = details.map((detail) => ({
    eventId: detail.eventId,
    eventType: detail.eventType,
    referenceId: detail.referenceId,
    status: detail.status,
    journalEntryId: detail.journalEntryId ?? null,
    error: detail.error,
    markFailedError: detail.markFailedError,
  }));

  return rows;
}

function buildWorkerRunInsert(params: {
  status: AccountingWorkerRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  claimedCount?: number;
  successCount?: number;
  deadLetterCount?: number;
  failureCount?: number;
  criticalFailureCount?: number;
  tenantIds?: string[];
  details?: WorkerEventResult[];
  error?: string | null;
}): AccountingWorkerRunInsert {
  const finishedAt = params.finishedAt ?? new Date();

  return {
    status: params.status,
    started_at: params.startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - params.startedAt.getTime()),
    claimed_count: params.claimedCount ?? 0,
    success_count: params.successCount ?? 0,
    dead_letter_count: params.deadLetterCount ?? 0,
    failure_count: params.failureCount ?? 0,
    critical_failure_count: params.criticalFailureCount ?? 0,
    tenant_ids: params.tenantIds ?? [],
    details: workerDetailsToJson(params.details ?? []),
    error: params.error ?? null,
  };
}

async function recordWorkerRun(supabase: AdminClient, payload: AccountingWorkerRunInsert) {
  const { error } = await supabase
    .from('accounting_worker_runs')
    .insert(payload);

  return error ? getErrorMessage(error) : null;
}

async function safelyRecordWorkerRun(supabase: AdminClient, payload: AccountingWorkerRunInsert) {
  try {
    return await recordWorkerRun(supabase, payload);
  } catch (error) {
    return getErrorMessage(error);
  }
}

function withWorkerRunLogFailure<T extends Record<string, unknown>>(body: T, workerRunLogError: string) {
  return NextResponse.json(
    {
      ...body,
      success: false,
      workerRunLogged: false,
      workerRunLogError,
    },
    { status: 500 }
  );
}

function asPayloadRecord(payload: Json): OutboxPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid outbox payload: payload must be an object.');
  }
  return payload;
}

function readRequiredNumber(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Invalid outbox payload: ${key} must be a number.`);
}

function readOptionalNumber(payload: OutboxPayload, key: string, defaultValue: number | undefined = 0) {
  const value = payload[key];
  if (value === undefined || value === null) return defaultValue;
  return readRequiredNumber(payload, key);
}

function readRequiredString(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (typeof value === 'string') return value;
  throw new Error(`Invalid outbox payload: ${key} must be a string.`);
}

function readClearingRole(payload: OutboxPayload): InterBranchClearingRole {
  const role = readRequiredString(payload, 'role');
  if (role === 'debtor' || role === 'creditor') return role;
  throw new Error('Invalid outbox payload: role must be debtor or creditor.');
}

function readOptionalString(payload: OutboxPayload, key: string) {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  throw new Error(`Invalid outbox payload: ${key} must be a string.`);
}

async function resolvePackageSalePaymentMethod(
  supabase: AdminClient,
  tenantId: string,
  revenueId: string,
  payload: OutboxPayload
) {
  const payloadPaymentMethod = readOptionalString(payload, 'paymentMethod');
  if (payloadPaymentMethod) return payloadPaymentMethod;

  const { data, error } = await supabase
    .from('revenue')
    .select('payment_method')
    .eq('tenant_id', tenantId)
    .eq('id', revenueId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve PACKAGE_SALE payment method for revenue ${revenueId}: ${error.message}`);
  }

  return data?.payment_method ?? undefined;
}

function readJournalLines(payload: OutboxPayload): JournalEntryInput['lines'] {
  const lines = payload.lines;
  if (!Array.isArray(lines)) {
    throw new Error('Invalid outbox payload: lines must be an array.');
  }

  return lines.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      throw new Error(`Invalid outbox payload: lines[${index}] must be an object.`);
    }

    return {
      account_id: readRequiredString(line, 'account_id'),
      debit_amount: readRequiredNumber(line, 'debit_amount'),
      credit_amount: readRequiredNumber(line, 'credit_amount'),
      branch_id: readOptionalString(line, 'branch_id'),
      ktv_id: readOptionalString(line, 'ktv_id'),
      cost_center_id: readOptionalString(line, 'cost_center_id'),
    };
  });
}

async function markOutboxCompleted(supabase: AdminClient, outboxId: string, journalEntryId: string | null) {
  const rpcClient = supabase as unknown as { rpc: MarkOutboxCompletedRpc };
  return rpcClient.rpc('mark_outbox_completed', {
    p_outbox_id: outboxId,
    p_journal_entry_id: journalEntryId,
  });
}

async function markOutboxDead(supabase: AdminClient, outboxId: string, reason: string) {
  const updatePayload: Database['public']['Tables']['accounting_outbox']['Update'] = {
    status: 'DEAD',
    last_error: reason,
    processed_at: new Date().toISOString(),
  };

  return supabase
    .from('accounting_outbox')
    .update(updatePayload)
    .eq('id', outboxId);
}

function getJournalReferenceType(eventType: string): WorkerJournalReferenceType | null {
  switch (eventType) {
    case 'PACKAGE_SALE':
      return 'PACKAGE_SALE';
    case 'SESSION_DONE':
      return 'SESSION_DONE';
    case 'EXPENSE_RECORDED':
      return 'EXPENSE';
    case 'SALARY_PAID':
      return 'SALARY_PAYMENT';
    case 'INVENTORY_CONSUMED':
      return 'INVENTORY_CONSUMPTION';
    case 'REFUND_ISSUED':
      return 'REFUND';
    case 'INTER_BRANCH_CLEARING':
      return 'INTER_BRANCH_CLEARING';
    case 'MANUAL_ENTRY':
      return 'MANUAL';
    default:
      return null;
  }
}

async function findExistingActiveJournal(
  supabase: AdminClient,
  tenantId: string,
  referenceType: WorkerJournalReferenceType,
  referenceId: string,
): Promise<ExistingJournalReference | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id,status')
    .eq('tenant_id', tenantId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .neq('status', 'CANCELED')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing journal reference: ${error.message}`);
  }

  return data ? { id: data.id, status: data.status } : null;
}

async function assertSessionDoneStillValid(
  supabase: AdminClient,
  beautySupabase: BeautyH8Client,
  tenantId: string,
  sessionId: string,
  referenceType: string,
) {
  if (referenceType === BEAUTY_SESSION_REFERENCE_TYPE) {
    const { data, error } = await beautySupabase
      .from('beauty_sessions')
      .select('id,status')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .maybeSingle<Pick<BeautySessionReceivableSource, 'id' | 'status'>>();

    if (error) {
      throw new Error(`Failed to validate Beauty SESSION_DONE source: ${error.message}`);
    }

    if (!data) {
      return `Stale Beauty SESSION_DONE outbox: session ${sessionId} no longer exists.`;
    }

    if (data.status !== 'COMPLETED') {
      return `Stale Beauty SESSION_DONE outbox: session ${sessionId} is ${data.status}, not COMPLETED.`;
    }

    return null;
  }

  const { data, error } = await supabase
    .from('session_logs')
    .select('id,status')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate SESSION_DONE source: ${error.message}`);
  }

  if (!data) {
    return `Stale SESSION_DONE outbox: session ${sessionId} no longer exists.`;
  }

  if (data.status !== 'completed') {
    return `Stale SESSION_DONE outbox: session ${sessionId} is ${data.status}, not completed.`;
  }

  return null;
}

async function isHaircutTenant(supabase: AdminClient, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id,product_key')
    .eq('id', tenantId)
    .maybeSingle<Pick<Database['public']['Tables']['tenants']['Row'], 'id' | 'product_key'>>();

  if (error) {
    throw new Error(`Failed to resolve tenant product for Haircut receivable: ${error.message}`);
  }

  return data?.product_key === HAIRCUT_PRODUCT_KEY;
}

async function loadHaircutSessionReceivableSource(
  supabase: AdminClient,
  tenantId: string,
  sessionLogId: string,
): Promise<HaircutSessionReceivableSource> {
  const { data, error } = await supabase
    .from('session_logs')
    .select('id,status,booking_id,completed_date,created_at,session_number')
    .eq('id', sessionLogId)
    .eq('tenant_id', tenantId)
    .maybeSingle<HaircutSessionReceivableSource>();

  if (error) {
    throw new Error(`Failed to load Haircut session receivable source: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Haircut receivable source session ${sessionLogId} no longer exists.`);
  }

  if (data.status !== 'completed') {
    throw new Error(`Haircut receivable source session ${sessionLogId} is ${data.status}, not completed.`);
  }

  return data;
}

async function loadHaircutBookingReceivableSource(
  supabase: AdminClient,
  tenantId: string,
  bookingId: string,
): Promise<HaircutBookingReceivableSource> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,customer_id,booking_number,package_name')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle<HaircutBookingReceivableSource>();

  if (error) {
    throw new Error(`Failed to load Haircut booking receivable source: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Haircut receivable source booking ${bookingId} no longer exists for tenant ${tenantId}.`);
  }

  return data;
}

async function loadBeautySessionReceivableSource(
  beautySupabase: BeautyH8Client,
  tenantId: string,
  sessionId: string,
): Promise<BeautySessionReceivableSource> {
  const { data, error } = await beautySupabase
    .from('beauty_sessions')
    .select('id,status,appointment_id,actual_end_at,actual_start_at,actual_performer_id,created_at')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle<BeautySessionReceivableSource>();

  if (error) {
    throw new Error(`Failed to load Beauty session receivable source: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Beauty receivable source session ${sessionId} no longer exists.`);
  }

  if (data.status !== 'COMPLETED') {
    throw new Error(`Beauty receivable source session ${sessionId} is ${data.status}, not COMPLETED.`);
  }

  return data;
}

async function loadBeautyAppointmentReceivableSource(
  beautySupabase: BeautyH8Client,
  tenantId: string,
  appointmentId: string,
): Promise<BeautyAppointmentReceivableSource> {
  const { data, error } = await beautySupabase
    .from('beauty_appointments')
    .select('id,customer_id,service_id,branch_id')
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle<BeautyAppointmentReceivableSource>();

  if (error) {
    throw new Error(`Failed to load Beauty appointment receivable source: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Beauty receivable source appointment ${appointmentId} no longer exists for tenant ${tenantId}.`);
  }

  return data;
}

function toDateOnly(value: string | null, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Haircut receivable source is missing ${fieldName}.`);
  }

  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new Error(`Haircut receivable source has invalid ${fieldName}.`);
  }

  return dateOnly;
}

async function recognizeHaircutSessionReceivable(
  supabase: AdminClient,
  tenantId: string,
  sessionLogId: string,
  outboxId: string,
  payload: OutboxPayload,
): Promise<void> {
  const receivableAmount = readOptionalNumber(payload, 'receivableAmount', undefined);
  if (receivableAmount === undefined || receivableAmount <= 0) return;

  const haircutTenant = await isHaircutTenant(supabase, tenantId);
  if (!haircutTenant) return;

  const payloadBookingId = readOptionalString(payload, 'bookingId');
  const session = await loadHaircutSessionReceivableSource(supabase, tenantId, sessionLogId);
  const bookingId = payloadBookingId ?? session.booking_id;
  const booking = await loadHaircutBookingReceivableSource(supabase, tenantId, bookingId);
  const recognitionDate = toDateOnly(session.completed_date ?? session.created_at, 'completed_date');
  const description = readRequiredString(payload, 'description');
  const financeReceivable = new SemanticReceivableChargeService(
    new SupabaseReceivableChargeGateway(supabase, 'service_role'),
  );

  await financeReceivable.recognizeServiceReceivable({
    tenantId,
    customerId: booking.customer_id,
    amountMinor: receivableAmount,
    currency: 'VND',
    servicePeriodStart: recognitionDate,
    servicePeriodEnd: recognitionDate,
    recognitionDate,
    dueDate: recognitionDate,
    businessSourceType: HAIRCUT_SESSION_DONE_SOURCE_TYPE,
    businessSourceId: sessionLogId,
    description,
    metadata: {
      booking_id: booking.id,
      booking_number: booking.booking_number,
      package_name: booking.package_name,
      session_log_id: session.id,
      session_number: session.session_number,
      accounting_outbox_id: outboxId,
      ktv_id: readOptionalString(payload, 'ktvId') ?? null,
      branch_id: readOptionalString(payload, 'branchId') ?? null,
    },
  });
}

async function recognizeBeautySessionReceivable(
  supabase: AdminClient,
  beautySupabase: BeautyH8Client,
  tenantId: string,
  sessionId: string,
  outboxId: string,
  payload: OutboxPayload,
): Promise<void> {
  const receivableAmount = readOptionalNumber(payload, 'receivableAmount', undefined);
  if (receivableAmount === undefined || receivableAmount <= 0) return;

  const session = await loadBeautySessionReceivableSource(beautySupabase, tenantId, sessionId);
  const payloadAppointmentId = readOptionalString(payload, 'appointmentId');
  if (payloadAppointmentId && payloadAppointmentId !== session.appointment_id) {
    throw new Error(`Beauty SESSION_DONE payload appointment ${payloadAppointmentId} does not match session appointment ${session.appointment_id}.`);
  }

  const appointment = await loadBeautyAppointmentReceivableSource(beautySupabase, tenantId, session.appointment_id);
  const recognitionDate = toDateOnly(
    session.actual_end_at ?? session.actual_start_at ?? session.created_at,
    'actual_end_at',
  );
  const description = readRequiredString(payload, 'description');
  const performerId = readOptionalString(payload, 'performerId') ?? readOptionalString(payload, 'ktvId') ?? session.actual_performer_id;
  const financeReceivable = new SemanticReceivableChargeService(
    new SupabaseReceivableChargeGateway(supabase, 'service_role'),
  );

  await financeReceivable.recognizeServiceReceivable({
    tenantId,
    customerId: appointment.customer_id,
    amountMinor: receivableAmount,
    currency: 'VND',
    servicePeriodStart: recognitionDate,
    servicePeriodEnd: recognitionDate,
    recognitionDate,
    dueDate: recognitionDate,
    businessSourceType: BEAUTY_SESSION_DONE_SOURCE_TYPE,
    businessSourceId: session.id,
    description,
    metadata: {
      beauty_session_id: session.id,
      appointment_id: appointment.id,
      service_id: appointment.service_id,
      accounting_outbox_id: outboxId,
      performer_id: performerId ?? null,
      branch_id: appointment.branch_id,
      source_system: readOptionalString(payload, 'sourceSystem') ?? 'BEAUTY_V2',
    },
  });
}

async function assertInterBranchClearingStillValid(
  supabase: AdminClient,
  tenantId: string,
  clearingRecordId: string,
  payload: OutboxPayload,
) {
  const role = readClearingRole(payload);
  const debtorTenantId = readRequiredString(payload, 'debtorTenantId');
  const creditorTenantId = readRequiredString(payload, 'creditorTenantId');
  const amount = readRequiredNumber(payload, 'amount');

  const { data, error } = await supabase
    .from('inter_branch_clearing_records')
    .select('id,status,debtor_tenant_id,creditor_tenant_id,calculated_amount')
    .eq('id', clearingRecordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate INTER_BRANCH_CLEARING source: ${error.message}`);
  }

  if (!data) {
    return `Stale INTER_BRANCH_CLEARING outbox: clearing record ${clearingRecordId} no longer exists.`;
  }

  if (data.status !== 'cleared') {
    return `Stale INTER_BRANCH_CLEARING outbox: clearing record ${clearingRecordId} is ${data.status}, not cleared.`;
  }

  if (data.debtor_tenant_id !== debtorTenantId || data.creditor_tenant_id !== creditorTenantId) {
    return `Stale INTER_BRANCH_CLEARING outbox: tenant pair changed for ${clearingRecordId}.`;
  }

  const expectedTenantId = role === 'debtor' ? data.debtor_tenant_id : data.creditor_tenant_id;
  if (tenantId !== expectedTenantId) {
    return `Stale INTER_BRANCH_CLEARING outbox: tenant ${tenantId} does not match ${role} side.`;
  }

  if (Math.abs(Number(data.calculated_amount) - amount) > 0.01) {
    return `Stale INTER_BRANCH_CLEARING outbox: amount changed for ${clearingRecordId}.`;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Accounting Worker] CRON_SECRET environment variable is not configured.');
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET không được cấu hình trên server.' },
      { status: 500 }
    );
  }

  // Khớp token Authorization
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.warn('[Accounting Worker] Unauthorized trigger attempt.');
    return NextResponse.json(
      { success: false, error: 'Không được phép truy cập (Unauthorized).' },
      { status: 401 }
    );
  }

  console.log('[Accounting Worker] Started scanning outbox queue...');
  const startedAt = new Date();
  let supabase: AdminClient | null = null;

  try {
    supabase = getAdminClient();
    const beautySupabase = getBeautyH8Client();

    // 1. Claim next batch of events to process
    const { data: batch, error: claimError } = await supabase.rpc('claim_outbox_batch', {
      p_limit: 50,
    });

    if (claimError) {
      console.error('[Accounting Worker] Failed to claim outbox batch:', claimError);
      const workerRunLogError = await safelyRecordWorkerRun(supabase, buildWorkerRunInsert({
        status: 'claim_failed',
        startedAt,
        error: claimError.message,
      }));
      const body = {
        success: false,
        status: 'claim_failed',
        error: claimError.message,
        workerRunLogged: workerRunLogError === null,
      };

      if (workerRunLogError) {
        return NextResponse.json({ ...body, workerRunLogError }, { status: 500 });
      }

      return NextResponse.json(body, { status: 500 });
    }

    const typedBatch: OutboxEvent[] = batch || [];
    if (typedBatch.length === 0) {
      console.log('[Accounting Worker] No pending outbox events found.');
      const workerRunLogError = await safelyRecordWorkerRun(supabase, buildWorkerRunInsert({
        status: 'success',
        startedAt,
      }));

      if (workerRunLogError) {
        return withWorkerRunLogFailure({
          status: 'critical_failure',
          processed: 0,
          error: 'Accounting worker completed but failed to persist worker run log.',
        }, workerRunLogError);
      }

      return NextResponse.json({ success: true, processed: 0, workerRunLogged: true });
    }

    console.log(`[Accounting Worker] Claimed ${typedBatch.length} events for processing.`);

    let successCount = 0;
    let deadLetterCount = 0;
    let failureCount = 0;
    let criticalFailureCount = 0;
    const details: WorkerEventResult[] = [];

    // 2. Process each event in the batch sequentially to maintain strict transactional order
    for (const event of typedBatch) {
      try {
        const tenantId = event.tenant_id;
        const eventType = event.event_type;
        const refId = event.reference_id;
        const payload = asPayloadRecord(event.payload);
        const journalReferenceType = getJournalReferenceType(eventType);

        console.log(`[Accounting Worker] Processing event ${event.id} | Type: ${eventType} | Tenant: ${tenantId}`);

        let journalEntryId: string | null = null;

        if (!journalReferenceType) {
          throw new Error(`Unsupported outbox event type: ${eventType}`);
        }

        if (eventType === 'SESSION_DONE') {
          const staleReason = await assertSessionDoneStillValid(
            supabase,
            beautySupabase,
            tenantId,
            refId,
            event.reference_type,
          );
          if (staleReason) {
            const { error: deadErr } = await markOutboxDead(supabase, event.id, staleReason);
            if (deadErr) {
              throw new Error(`Failed to dead-letter stale SESSION_DONE outbox: ${deadErr.message}`);
            }

            console.warn(`[Accounting Worker] ${staleReason}`);
            deadLetterCount++;
            details.push({
              eventId: event.id,
              eventType,
              referenceId: refId,
              status: 'dead_lettered',
              journalEntryId: null,
              error: staleReason,
            });
            continue;
          }
        }

        if (eventType === 'INTER_BRANCH_CLEARING') {
          const staleReason = await assertInterBranchClearingStillValid(supabase, tenantId, refId, payload);
          if (staleReason) {
            const { error: deadErr } = await markOutboxDead(supabase, event.id, staleReason);
            if (deadErr) {
              throw new Error(`Failed to dead-letter stale INTER_BRANCH_CLEARING outbox: ${deadErr.message}`);
            }

            console.warn(`[Accounting Worker] ${staleReason}`);
            deadLetterCount++;
            details.push({
              eventId: event.id,
              eventType,
              referenceId: refId,
              status: 'dead_lettered',
              journalEntryId: null,
              error: staleReason,
            });
            continue;
          }
        }

        const existingJournal = await findExistingActiveJournal(supabase, tenantId, journalReferenceType, refId);
        if (existingJournal) {
          if (existingJournal.status !== 'POSTED') {
            throw new Error(
              `Existing active journal ${existingJournal.id} for ${journalReferenceType}:${refId} is ${existingJournal.status}, not POSTED.`
            );
          }

          const { error: completeErr } = await markOutboxCompleted(supabase, event.id, existingJournal.id);
          if (completeErr) {
            throw new Error(`Failed to mark outbox completed: ${completeErr.message}`);
          }

          console.log(`[Accounting Worker] Event ${event.id} completed from existing journal ${existingJournal.id}.`);
          successCount++;
          details.push({
            eventId: event.id,
            eventType,
            referenceId: refId,
            status: 'completed',
            journalEntryId: existingJournal.id,
          });
          continue;
        }

        // Định tuyến xử lý theo event_type
        switch (eventType) {
          case 'PACKAGE_SALE':
            journalEntryId = await RevenueRecognitionService.handlePackageSale({
              tenantId,
              packageSaleId: refId,
              totalAmount: readRequiredNumber(payload, 'totalAmount'),
              vatRate: readOptionalNumber(payload, 'vatRate'),
              paymentMethod: await resolvePackageSalePaymentMethod(supabase, tenantId, refId, payload),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'SESSION_DONE':
            if (event.reference_type === BEAUTY_SESSION_REFERENCE_TYPE) {
              await recognizeBeautySessionReceivable(supabase, beautySupabase, tenantId, refId, event.id, payload);
            } else {
              await recognizeHaircutSessionReceivable(supabase, tenantId, refId, event.id, payload);
            }
            journalEntryId = await RevenueRecognitionService.handleSessionDone({
              tenantId,
              sessionLogId: refId,
              earnedRevenueAmount: readRequiredNumber(payload, 'earnedRevenueAmount'),
              deferredRevenueAmount: readOptionalNumber(payload, 'deferredRevenueAmount', undefined),
              receivableAmount: readOptionalNumber(payload, 'receivableAmount', undefined),
              commissionAmount: readRequiredNumber(payload, 'commissionAmount'),
              ktvId: readRequiredString(payload, 'ktvId'),
              branchId: readOptionalString(payload, 'branchId'),
              description: readRequiredString(payload, 'description'),
            });
            break;

          case 'EXPENSE_RECORDED':
            journalEntryId = await RevenueRecognitionService.handleExpenseRecorded({
              tenantId,
              expenseId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              category: readRequiredString(payload, 'category'),
              paymentMethod: readRequiredString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'SALARY_PAID':
            journalEntryId = await RevenueRecognitionService.handleSalaryPaid({
              tenantId,
              salaryRecordId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              paymentMethod: readOptionalString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              ktvId: readRequiredString(payload, 'ktvId'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'INVENTORY_CONSUMED':
            journalEntryId = await RevenueRecognitionService.handleInventoryConsumed({
              tenantId,
              sessionLogId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'REFUND_ISSUED':
            journalEntryId = await RevenueRecognitionService.handleRefundIssued({
              tenantId,
              refundId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              deferredRefundAmount: readOptionalNumber(payload, 'deferredRefundAmount', undefined),
              revenueReductionAmount: readOptionalNumber(payload, 'revenueReductionAmount', undefined),
              paymentMethod: readOptionalString(payload, 'paymentMethod'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId'),
            });
            break;

          case 'INTER_BRANCH_CLEARING':
            journalEntryId = await RevenueRecognitionService.handleInterBranchClearing({
              tenantId,
              clearingRecordId: refId,
              amount: readRequiredNumber(payload, 'amount'),
              role: readClearingRole(payload),
              paymentMethod: readRequiredString(payload, 'paymentMethod'),
              debtorTenantId: readRequiredString(payload, 'debtorTenantId'),
              creditorTenantId: readRequiredString(payload, 'creditorTenantId'),
              description: readRequiredString(payload, 'description'),
              branchId: readOptionalString(payload, 'branchId') ?? tenantId,
            });
            break;

          case 'MANUAL_ENTRY':
            journalEntryId = await AccountingEngineService.postJournalEntry({
              tenant_id: tenantId,
              description: readRequiredString(payload, 'description'),
              lines: readJournalLines(payload),
              reference_type: 'MANUAL',
              reference_id: refId,
            });
            break;

          default:
            throw new Error(`Unsupported outbox event type: ${eventType}`);
        }

        // Cập nhật trạng thái COMPLETED
        if (journalEntryId) {
          const { error: completeErr } = await markOutboxCompleted(supabase, event.id, journalEntryId);

          if (completeErr) {
            throw new Error(`Failed to mark outbox completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} processed successfully. Entry: ${journalEntryId}`);

          // Trigger Outbound MISA sync
          try {
            const { MisaOutboundAdapter } = await import('@/plugins/outbound/misa/adapter');
            const misaAdapter = new MisaOutboundAdapter();

            let action: 'sync_invoice' | 'sync_expense' | 'sync_salary' | 'sync_journal' = 'sync_journal';
            if (eventType === 'PACKAGE_SALE') {
              action = 'sync_invoice';
            } else if (eventType === 'EXPENSE_RECORDED') {
              action = 'sync_expense';
            } else if (eventType === 'SALARY_PAID') {
              action = 'sync_salary';
            }

            const syncResult = await misaAdapter.send({
              action,
              data: {
                ...payload,
                journal_entry_id: journalEntryId,
                synced_event_id: event.id,
              },
              tenantId,
              idempotencyKey: `misa-sync-${event.id}`,
            });

            if (syncResult.success) {
              console.log(`[Accounting Worker] MISA sync successful for event ${event.id}`);
            } else {
              console.error(`[Accounting Worker] MISA sync failed for event ${event.id}: ${syncResult.error}`);
            }
          } catch (misaErr) {
            console.error(`[Accounting Worker] MISA Adapter trigger error for event ${event.id}:`, misaErr);
          }

          successCount++;
          details.push({
            eventId: event.id,
            eventType,
            referenceId: refId,
            status: 'completed',
            journalEntryId,
          });
        } else {
          // Trường hợp không phát sinh bút toán (ví dụ doanh số/hoa hồng = 0)
          // Vẫn mark completed với journal_entry_id = null
          const { error: completeErr } = await markOutboxCompleted(supabase, event.id, null);
          if (completeErr) {
            throw new Error(`Failed to mark outbox empty completed: ${completeErr.message}`);
          }
          console.log(`[Accounting Worker] Event ${event.id} completed with no journal entries generated.`);
          successCount++;
          details.push({
            eventId: event.id,
            eventType,
            referenceId: refId,
            status: 'completed',
            journalEntryId: null,
          });
        }

      } catch (err: unknown) {
        console.error('[Accounting Worker] Error processing event %s:', event.id, err);
        failureCount++;

        // Cập nhật trạng thái FAILED (exponential backoff)
        const errMsg = getErrorMessage(err);
        const { error: failErr } = await supabase.rpc('mark_outbox_failed', {
          p_outbox_id: event.id,
          p_error: errMsg,
        });

        if (failErr) {
          console.error('[Accounting Worker] Critical: Failed to mark outbox as failed for %s:', event.id, failErr);
          criticalFailureCount++;
          details.push({
            eventId: event.id,
            eventType: event.event_type,
            referenceId: event.reference_id,
            status: 'critical_failed',
            error: errMsg,
            markFailedError: failErr.message,
          });
        } else {
          details.push({
            eventId: event.id,
            eventType: event.event_type,
            referenceId: event.reference_id,
            status: 'failed',
            error: errMsg,
          });
        }
      }
    }

    console.log(`[Accounting Worker] Finished batch. Success: ${successCount}, Dead-lettered: ${deadLetterCount}, Failures: ${failureCount}`);
    const status = criticalFailureCount > 0
      ? 'critical_failure'
      : failureCount === 0 ? 'success' : 'partial_failure';
    const workerRunLogError = await safelyRecordWorkerRun(supabase, buildWorkerRunInsert({
      status,
      startedAt,
      claimedCount: typedBatch.length,
      successCount,
      deadLetterCount,
      failureCount,
      criticalFailureCount,
      tenantIds: getUniqueTenantIds(typedBatch),
      details,
    }));

    if (workerRunLogError) {
      return withWorkerRunLogFailure({
        status: 'critical_failure',
        processed: typedBatch.length,
        successCount,
        deadLetterCount,
        failureCount,
        criticalFailureCount,
        details,
        error: 'Accounting worker completed but failed to persist worker run log.',
      }, workerRunLogError);
    }

    return NextResponse.json({
      success: failureCount === 0 && criticalFailureCount === 0,
      status,
      processed: typedBatch.length,
      successCount,
      deadLetterCount,
      failureCount,
      criticalFailureCount,
      details,
      workerRunLogged: true,
    });

  } catch (globalErr: unknown) {
    console.error('[Accounting Worker] Critical exception:', globalErr);
    const errorMessage = getErrorMessage(globalErr) || 'Lỗi hệ thống khi chạy worker.';
    const workerRunLogError = supabase
      ? await safelyRecordWorkerRun(supabase, buildWorkerRunInsert({
        status: 'exception',
        startedAt,
        error: errorMessage,
      }))
      : null;

    return NextResponse.json(
      {
        success: false,
        status: 'exception',
        error: errorMessage,
        workerRunLogged: supabase ? workerRunLogError === null : false,
        ...(workerRunLogError ? { workerRunLogError } : {}),
      },
      { status: 500 }
    );
  }
}
