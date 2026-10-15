import type { MobilitySqlClient } from '../../../platform/mobility';
import { salePaymentIntentSchema, salePaymentReceiptSchema, type SalePaymentReceipt, type SalePaymentState } from './AutoMoveSalePaymentContract';

type Row = Record<string, unknown>;
export class SalePaymentError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
function fail(code: string, message: string, status = 409): never { throw new SalePaymentError(code, message, status); }
export function paymentId(value: string): string {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) {
    fail('INVALID_PAYMENT_ID', 'A UUID booking and idempotency key are required.', 400);
  }
  return value.toLowerCase();
}
function integer(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+$/.test(value))) fail('INVALID_PERSISTED_AMOUNT', 'Invalid persisted amount.');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail('INVALID_PERSISTED_AMOUNT', 'Persisted amount exceeds the supported VND range.');
  return number;
}
function sum(rows: Row[], field: string): number { return integer(rows.reduce((total, row) => integer(total + integer(row[field])), 0)); }
function receipt(row: Row): SalePaymentReceipt {
  return salePaymentReceiptSchema.parse({ id: row.id, idempotencyKey: row.idempotency_key,
    amount: integer(row.amount), paymentMethod: row.payment_method, transactionRef: row.transaction_ref,
    notes: row.notes, receivedBy: row.received_by,
    receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at });
}

export class AutoMoveSalePaymentService {
  constructor(private readonly db: MobilitySqlClient, private readonly actorId: string) {}
  private async context(bookingId: string) {
    const actor = paymentId(this.actorId), booking = paymentId(bookingId);
    const profile = (await this.db.query(`select u.tenant_id from public.users u join public.tenants t on t.id=u.tenant_id
      where u.id=$1 and u.role='accountant' and u.status='active' and t.status='active'`, [actor])).rows[0];
    if (!profile || typeof profile.tenant_id !== 'string') fail('PAYMENT_FORBIDDEN', 'An active tenant accountant is required.', 403);
    // Shared lock order with deposit/handover prevents competing balance mutations.
    const row = (await this.db.query('select * from public.auto_bookings where id=$1 and tenant_id=$2 for update', [booking, profile.tenant_id])).rows[0];
    if (!row) fail('PAYMENT_BOOKING_NOT_FOUND', 'Booking is unavailable for this tenant.', 404);
    return { actor, tenant: profile.tenant_id, booking: row, bookingId: booking };
  }
  private async reconcile(context: Awaited<ReturnType<AutoMoveSalePaymentService['context']>>): Promise<SalePaymentState> {
    const { bookingId, tenant, booking } = context;
    const recognitions = (await this.db.query(`select * from public.auto_vehicle_sale_recognitions
      where booking_id=$1 and tenant_id=$2 order by id limit 2`, [bookingId, tenant])).rows;
    if (recognitions.length > 1) fail('PAYMENT_RECOGNITION_AMBIGUOUS', 'More than one recognized sale is linked to this booking.');
    if (!recognitions.length) return { bookingId, recognitionId: null, status: 'NOT_RECOGNIZED', issues: [],
      saleAmount: 0, depositReceived: 0, postSaleReceived: 0, totalReceived: 0, refundedTotal: 0, outstanding: 0, canCollect: false, receipts: [] };
    const recognition = recognitions[0];
    const deposits = (await this.db.query('select id,amount,status,payment_method,transaction_ref from public.auto_deposits where booking_id=$1 and tenant_id=$2', [bookingId, tenant])).rows;
    const payments = (await this.db.query(`select * from public.auto_vehicle_sale_payments where booking_id=$1 and tenant_id=$2
      order by received_at,id limit 1001`, [bookingId, tenant])).rows;
    if (payments.length > 1000) fail('PAYMENT_HISTORY_LIMIT', 'Receipt history requires paginated reconciliation before collection.');
    const adjustments = (await this.db.query(`select adjustment_type,sale_price_delta,receivable_delta,refund_amount
      from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1 and tenant_id=$2`, [recognition.id, tenant])).rows;
    const refunds = (await this.db.query(`select source_deposit_id,source_payment_id,amount
      from public.auto_vehicle_sale_settlement_actions where booking_id=$1 and tenant_id=$2 and action_type='refund'`, [bookingId, tenant])).rows;
    const issues: string[] = [];
    const depositReceived = sum(deposits.filter(row => row.status === 'confirmed'), 'amount');
    const receipts = payments.map(receipt), postSaleReceived = sum(payments, 'amount');
    const saleAmount = integer(integer(recognition.sale_price_recognized) + sum(adjustments, 'sale_price_delta'));
    const refundedTotal = sum(refunds, 'amount');
    const totalReceived = integer(depositReceived + postSaleReceived - refundedTotal), outstanding = integer(saleAmount - totalReceived);
    if (totalReceived < 0 || [...deposits.filter(row => row.status === 'confirmed'), ...payments].some(row =>
      sum(refunds.filter(refund => refund.source_deposit_id === row.id || refund.source_payment_id === row.id), 'amount') > integer(row.amount)) ||
      refunds.some(refund => !deposits.some(row => row.status === 'confirmed' && row.id === refund.source_deposit_id) && !payments.some(row => row.id === refund.source_payment_id))) {
      issues.push('REFUND_RECEIPT_MISMATCH');
    }
    if (saleAmount < 0 || depositReceived < 0) fail('INVALID_PERSISTED_AMOUNT', 'Negative collection source amount.');
    if (recognition.customer_id !== booking.customer_id || recognition.vehicle_id !== booking.vehicle_id ||
        payments.some(row => row.recognition_id !== recognition.id)) issues.push('SALE_LINK_MISMATCH');
    if (depositReceived !== integer(booking.deposit_paid)) issues.push('DEPOSIT_RECEIPT_MISMATCH');
    if (integer(recognition.payment_received_total) !== integer(recognition.deposit_received_total) ||
        integer(recognition.receivable_amount_at_recognition) !== integer(recognition.sale_price_recognized) - integer(recognition.payment_received_total) ||
        depositReceived < integer(recognition.deposit_received_total)) issues.push('RECOGNITION_PAYMENT_MISMATCH');
    if (adjustments.some(row => integer(row.refund_amount) !== 0 || integer(row.receivable_delta) !== integer(row.sale_price_delta) ||
        ['sale_revenue_reversed', 'refund_recorded'].includes(String(row.adjustment_type)))) issues.push('REFUND_OR_ADJUSTMENT_REQUIRES_RESOLUTION');
    const references = [...deposits.filter(row => row.status === 'confirmed'), ...payments]
      .filter(row => typeof row.transaction_ref === 'string' && row.transaction_ref.trim() !== '')
      .map(row => `${row.payment_method}:${row.transaction_ref}`);
    if (new Set(references).size !== references.length || new Set(payments.map(row => row.idempotency_key)).size !== payments.length) issues.push('DUPLICATE_RECEIPT');
    if (outstanding < 0) issues.push('OVERCOLLECTED');
    const closed = booking.status === 'cancelled' || booking.payment_status === 'refunded';
    return { bookingId, recognitionId: String(recognition.id), status: issues.length ? 'MISMATCH' : 'MATCHED', issues,
      saleAmount, depositReceived, postSaleReceived, totalReceived, refundedTotal, outstanding,
      canCollect: !closed && !issues.length && outstanding > 0, receipts };
  }
  async state(bookingId: string): Promise<SalePaymentState> { return this.reconcile(await this.context(bookingId)); }
  async collect(bookingId: string, key: string, value: unknown) {
    const idempotencyKey = paymentId(key), parsed = salePaymentIntentSchema.safeParse(value);
    if (!parsed.success) fail('INVALID_PAYMENT', 'A positive integer VND amount, valid method and reference are required.', 400);
    const intent = parsed.data, context = await this.context(bookingId);
    const existing = (await this.db.query('select * from public.auto_vehicle_sale_payments where tenant_id=$1 and idempotency_key=$2',
      [context.tenant, idempotencyKey])).rows[0];
    if (existing) {
      if (existing.booking_id !== context.bookingId || integer(existing.amount) !== intent.amount || existing.payment_method !== intent.paymentMethod ||
          existing.transaction_ref !== intent.transactionRef || existing.notes !== intent.notes) fail('PAYMENT_KEY_CONFLICT', 'Payment key already belongs to another intent.');
      return { duplicate: true, receipt: receipt(existing), state: await this.reconcile(context) };
    }
    const before = await this.reconcile(context);
    if (before.status === 'NOT_RECOGNIZED') fail('PAYMENT_RECOGNITION_REQUIRED', 'Recognize the sale before collecting the post-sale balance.');
    if (before.status === 'MISMATCH') fail('PAYMENT_RECONCILIATION_MISMATCH', 'Resolve the receipt reconciliation mismatch before collection.');
    if (!before.canCollect) fail('PAYMENT_COLLECTION_CLOSED', 'This booking is closed or fully collected.');
    if (intent.amount > before.outstanding) fail('PAYMENT_EXCEEDS_OUTSTANDING', 'Payment exceeds the remaining recognized sale balance.', 400);
    if (intent.transactionRef !== null) {
      const depositReference = await this.db.query(`select id from public.auto_deposits where tenant_id=$1 and booking_id=$2
        and status='confirmed' and payment_method=$3 and transaction_ref=$4 limit 1`,
      [context.tenant, context.bookingId, intent.paymentMethod, intent.transactionRef]);
      if (depositReference.rows.length) fail('PAYMENT_REFERENCE_CONFLICT', 'This transaction reference is already a confirmed deposit.');
    }
    const inserted = (await this.db.query(`insert into public.auto_vehicle_sale_payments
      (tenant_id,booking_id,recognition_id,idempotency_key,amount,payment_method,transaction_ref,notes,received_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [context.tenant, context.bookingId, before.recognitionId, idempotencyKey, intent.amount, intent.paymentMethod, intent.transactionRef, intent.notes, context.actor])).rows[0];
    if (!inserted) fail('PAYMENT_NOT_PERSISTED', 'Receipt was not persisted.');
    const after = await this.reconcile(context);
    if (after.status !== 'MATCHED' || after.totalReceived !== before.totalReceived + intent.amount) fail('PAYMENT_NOT_RECONCILED', 'Persisted receipt read-back did not reconcile.');
    return { duplicate: false, receipt: receipt(inserted), state: after };
  }
}
