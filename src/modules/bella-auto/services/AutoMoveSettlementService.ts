import { createHash, randomUUID } from 'node:crypto';
import { MobilityFoundationService, PostgresMobilityRepository, type MobilityActor, type MobilitySqlClient } from '../../../platform/mobility';
import { parseSaleDocument, type DocumentDownload } from './AutoMoveSaleChainService';
import { paymentId } from './AutoMoveSalePaymentService';
import { settlementActionSchema, settlementIntentSchema, settlementStateSchema, type SettlementState } from './AutoMoveSettlementContract';

type Row = Record<string, unknown>;
export class SettlementError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) { super(message); }
}
function fail(code: string, message: string, status = 409): never { throw new SettlementError(code, message, status); }
function money(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) fail('SETTLEMENT_INVALID_AMOUNT', 'Invalid persisted amount.');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) fail('SETTLEMENT_INVALID_AMOUNT', 'Invalid persisted amount.');
  return result;
}
const total = (rows: Row[]) => rows.reduce((sum, row) => money(sum + money(row.amount)), 0);
function action(row: Row) {
  return settlementActionSchema.parse({ id: row.id, action: row.action_type, amount: money(row.amount),
    receiptType: row.source_deposit_id ? 'deposit' : row.source_payment_id ? 'post_sale' : null,
    receiptId: row.source_deposit_id ?? row.source_payment_id ?? null, reason: row.reason,
    document: row.source_document, createdBy: row.created_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at });
}

export class AutoMoveSettlementService {
  constructor(private readonly db: MobilitySqlClient, private readonly actorId: string, private readonly download: DocumentDownload) {}

  private async context(bookingId: string) {
    const actorId = paymentId(this.actorId), id = paymentId(bookingId);
    const profile = (await this.db.query(`select u.tenant_id from public.users u join public.tenants t on t.id=u.tenant_id
      where u.id=$1 and u.role='accountant' and u.status='active' and t.status='active'`, [actorId])).rows[0];
    if (!profile || typeof profile.tenant_id !== 'string') fail('SETTLEMENT_FORBIDDEN', 'An active tenant accountant is required.', 403);
    const booking = (await this.db.query('select * from public.auto_bookings where id=$1 and tenant_id=$2 for update', [id, profile.tenant_id])).rows[0];
    if (!booking) fail('SETTLEMENT_NOT_FOUND', 'Booking is unavailable for this tenant.', 404);
    const actor: MobilityActor = { userId: actorId, tenantId: profile.tenant_id, roles: ['accountant'] };
    return { booking, actor };
  }

  private mobility(actor: MobilityActor) {
    return new MobilityFoundationService(new PostgresMobilityRepository(this.db, true), {
      ensureAllowed: async params => {
        if (params.actor.userId !== actor.userId || params.tenantId !== actor.tenantId) fail('SETTLEMENT_FORBIDDEN', 'Tenant mismatch.', 403);
      },
    }, { next: () => randomUUID() }, { now: () => new Date().toISOString() });
  }

  private async read(context: Awaited<ReturnType<AutoMoveSettlementService['context']>>): Promise<SettlementState> {
    const { booking, actor } = context;
    const deposits = (await this.db.query(`select id,amount from public.auto_deposits where booking_id=$1 and tenant_id=$2 and status='confirmed'`, [booking.id, actor.tenantId])).rows;
    const payments = (await this.db.query('select id,amount from public.auto_vehicle_sale_payments where booking_id=$1 and tenant_id=$2', [booking.id, actor.tenantId])).rows;
    const rows = (await this.db.query(`select * from public.auto_vehicle_sale_settlement_actions where booking_id=$1 and tenant_id=$2 order by created_at,id`, [booking.id, actor.tenantId])).rows;
    const recognitions = (await this.db.query('select id,customer_id,vehicle_id from public.auto_vehicle_sale_recognitions where booking_id=$1 and tenant_id=$2 limit 2', [booking.id, actor.tenantId])).rows;
    const issues: string[] = [];
    if (recognitions.length > 1) issues.push('AMBIGUOUS_RECOGNITION');
    if (recognitions.some(row => row.customer_id !== booking.customer_id || row.vehicle_id !== booking.vehicle_id)) issues.push('SALE_LINK_MISMATCH');
    if (total(deposits) !== money(booking.deposit_paid)) issues.push('DEPOSIT_RECEIPT_MISMATCH');
    const receipts = [...deposits.map(row => ({ id: String(row.id), amount: row.amount, type: 'deposit' as const })),
      ...payments.map(row => ({ id: String(row.id), amount: row.amount, type: 'post_sale' as const }))]
      .map(row => {
        const amount = money(row.amount);
        const refunded = total(rows.filter(entry => entry.action_type === 'refund' &&
          (row.type === 'deposit' ? entry.source_deposit_id === row.id : entry.source_payment_id === row.id)));
        if (refunded > amount) fail('SETTLEMENT_REFUND_MISMATCH', 'Refund history exceeds its receipt.');
        return { id: String(row.id), type: row.type, amount, refunded, refundable: amount - refunded };
      });
    const refunds = rows.filter(row => row.action_type === 'refund');
    if (refunds.some(row => !receipts.some(receipt => receipt.id === (row.source_deposit_id ?? row.source_payment_id)))) issues.push('REFUND_SOURCE_MISMATCH');
    const gross = money(total(deposits) + total(payments)), refunded = total(refunds);
    if (booking.payment_status === 'refunded' && gross !== refunded) issues.push('LEGACY_REFUND_REQUIRES_RECONCILIATION');
    let vehicleStatus: string | null = null;
    if (typeof booking.vehicle_id === 'string') {
      vehicleStatus = (await this.mobility(actor).getVehicleTrace(actor, { vehicleId: booking.vehicle_id })).vehicle.status;
    }
    if (rows.some(row => row.action_type === 'cancel') && booking.status !== 'cancelled') issues.push('CANCELLATION_STATE_MISMATCH');
    return settlementStateSchema.parse({ bookingId: booking.id, bookingStatus: booking.status, vehicleStatus,
      recognitionId: recognitions[0]?.id ?? null, grossReceived: gross, refunded, netReceived: money(gross - refunded),
      canCancel: booking.status !== 'cancelled' && !rows.some(row => row.action_type === 'cancel'),
      issues, receipts, actions: rows.map(action) });
  }

  async state(bookingId: string) { return this.read(await this.context(bookingId)); }

  async execute(bookingId: string, key: string, value: unknown) {
    const idempotencyKey = paymentId(key), parsed = settlementIntentSchema.safeParse(value);
    if (!parsed.success) fail('SETTLEMENT_INVALID_INTENT', 'A confirmed intent, reason and document are required.', 400);
    const intent = parsed.data, context = await this.context(bookingId), { actor, booking } = context;
    const document = parseSaleDocument(intent.document);
    if (document.path.split('/')[0] !== actor.tenantId) fail('SETTLEMENT_DOCUMENT_TENANT', 'Document is outside this tenant.', 403);
    const requestHash = createHash('sha256').update(JSON.stringify({ bookingId: booking.id, ...intent })).digest('hex');
    // Retries use the persisted fact, without requiring the document to remain in Storage.
    const previous = (await this.db.query('select * from public.auto_vehicle_sale_settlement_actions where tenant_id=$1 and idempotency_key=$2', [actor.tenantId, idempotencyKey])).rows[0];
    if (previous) {
      if (previous.request_hash !== requestHash || previous.booking_id !== booking.id) fail('SETTLEMENT_KEY_CONFLICT', 'Key belongs to another intent.');
      return { duplicate: true, action: action(previous), state: await this.read(context) };
    }
    const before = await this.read(context);
    if (before.issues.length) fail('SETTLEMENT_RECONCILIATION_MISMATCH', 'Resolve receipt/history mismatch first.');
    const bytes = await this.download(document);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== document.sha256) {
      fail('SETTLEMENT_DOCUMENT_INVALID', 'Document content does not match its checksum.');
    }
    if (intent.action === 'refund') {
      const source = before.receipts.find(row => row.type === intent.receiptType && row.id === intent.receiptId);
      if (!source) fail('SETTLEMENT_RECEIPT_NOT_FOUND', 'Confirmed original receipt is unavailable.', 404);
      if (intent.amount > source.refundable) fail('SETTLEMENT_REFUND_EXCEEDS_RECEIPT', 'Refund exceeds the unrefunded original receipt.', 400);
    } else {
      if (!before.canCancel) fail('SETTLEMENT_ALREADY_CANCELLED', 'Booking already has a cancellation.');
      if (typeof booking.vehicle_id === 'string') {
        const mobility = this.mobility(actor), trace = await mobility.getVehicleTrace(actor, { vehicleId: booking.vehicle_id });
        const handedOver = trace.lifecycleEvents.some(log => log.toStatus === 'delivered' && log.metadata.bookingId === booking.id);
        if (!handedOver && trace.vehicle.status !== 'delivered' && trace.vehicle.allocatedToContractId &&
          (trace.vehicle.allocatedToContractId !== booking.id || trace.vehicle.status !== 'allocated')) {
          fail('SETTLEMENT_ALLOCATION_MISMATCH', 'Vehicle allocation cannot be released under the current contract.');
        }
        if (!handedOver && trace.vehicle.status !== 'delivered' && trace.vehicle.status === 'allocated') {
          if (trace.vehicle.allocatedToContractId !== booking.id) fail('SETTLEMENT_ALLOCATION_MISMATCH', 'Vehicle belongs to another booking.');
          await mobility.transitionVehicleStatus(actor, { vehicleId: trace.vehicle.id, toStatus: 'showroom',
            idempotencyKey: `automove-cancel:${idempotencyKey}`, reason: intent.reason,
            metadata: { bookingId: booking.id, settlementKey: idempotencyKey } });
        }
      }
    }
    await this.db.query('set local role service_role');
    // Failed writes leave the transaction aborted. Its outer rollback clears
    // the LOCAL role; do not mask the original SQLSTATE with a reset query.
    const stored = (await this.db.query(`insert into public.auto_vehicle_sale_settlement_actions
        (tenant_id,booking_id,idempotency_key,action_type,source_deposit_id,source_payment_id,amount,reason,source_document,request_hash,created_by)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) returning *`,
      [actor.tenantId, booking.id, idempotencyKey, intent.action,
        intent.action === 'refund' && intent.receiptType === 'deposit' ? intent.receiptId : null,
        intent.action === 'refund' && intent.receiptType === 'post_sale' ? intent.receiptId : null,
        intent.action === 'refund' ? intent.amount : 0, intent.reason, JSON.stringify(document), requestHash, actor.userId])).rows[0];
    await this.db.query('set local role authenticated');
    if (!stored) fail('SETTLEMENT_NOT_PERSISTED', 'Settlement action was not persisted.');
    if (intent.action === 'cancel') {
      const changed = (await this.db.query("update public.auto_bookings set status='cancelled' where id=$1 and tenant_id=$2 returning id", [booking.id, actor.tenantId])).rows[0];
      if (!changed) fail('SETTLEMENT_NOT_PERSISTED', 'Cancellation status was not persisted.');
      booking.status = 'cancelled';
    }
    const after = await this.read(context);
    if (after.issues.length || (intent.action === 'refund' && after.refunded !== before.refunded + intent.amount) ||
      !after.actions.some(row => row.id === stored.id)) fail('SETTLEMENT_NOT_RECONCILED', 'Persisted action did not reconcile.');
    return { duplicate: false, action: action(stored), state: after };
  }
}
