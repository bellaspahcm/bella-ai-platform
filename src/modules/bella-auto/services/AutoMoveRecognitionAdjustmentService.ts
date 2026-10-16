import { createHash } from 'node:crypto';
import { lockOpenAccountingPeriods } from '../../../core/services/accounting/period-guards';
import { parseSaleDocument, type DocumentDownload } from './AutoMoveSaleChainService';
import { paymentId } from './AutoMoveSalePaymentService';
import { adjustmentProducer, recognitionAdjustmentEntrySchema, recognitionAdjustmentIntentSchema,
  recognitionAdjustmentStateSchema, type RecognitionAdjustmentState } from './AutoMoveRecognitionAdjustmentContract';

type Row = Record<string, unknown>;
export class RecognitionAdjustmentError extends Error {
  constructor(public readonly code: string, public readonly httpStatus = 409) { super(code); }
}
function fail(code: string, status = 409): never { throw new RecognitionAdjustmentError(code, status); }
function integer(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+$/.test(value))) fail('ADJUSTMENT_INVALID_AMOUNT');
  const result = Number(value); if (!Number.isSafeInteger(result)) fail('ADJUSTMENT_INVALID_AMOUNT'); return result;
}
function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('ADJUSTMENT_UNKNOWN_HISTORY');
  return value as Row;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function entry(row: Row) {
  const metadata = record(row.metadata);
  if (metadata.contract !== adjustmentProducer) fail('ADJUSTMENT_UNKNOWN_HISTORY');
  return recognitionAdjustmentEntrySchema.parse({ id: row.id, type: row.adjustment_type,
    saleDelta: integer(row.sale_price_delta), costDelta: integer(row.cost_basis_delta), reason: row.reason,
    document: metadata.document, periodId: row.affected_period_ref, createdBy: row.created_by_user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at });
}

export class AutoMoveRecognitionAdjustmentService {
  constructor(private readonly db: Parameters<typeof lockOpenAccountingPeriods>[0], private readonly actorId: string, private readonly download: DocumentDownload) {}
  private async context(bookingId: string) {
    const actorId = paymentId(this.actorId), booking = paymentId(bookingId);
    const actor = (await this.db.query(`select u.tenant_id from public.users u join public.tenants t on t.id=u.tenant_id
      where u.id=$1 and u.status='active' and u.role='accountant' and t.status='active'`, [actorId])).rows[0];
    if (!actor || typeof actor.tenant_id !== 'string') fail('ADJUSTMENT_FORBIDDEN', 403);
    const tenant = actor.tenant_id;
    const linked = (await this.db.query('select * from public.auto_bookings where id=$1 and tenant_id=$2 for update', [booking, tenant])).rows[0];
    if (!linked) fail('ADJUSTMENT_NOT_FOUND', 404);
    const rows = (await this.db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1 and tenant_id=$2 order by id limit 2', [booking, tenant])).rows;
    if (rows.length === 0) fail('ADJUSTMENT_RECOGNITION_REQUIRED');
    if (rows.length !== 1) fail('ADJUSTMENT_AMBIGUOUS_RECOGNITION');
    const original = rows[0], metadata = record(original.metadata);
    if (original.customer_id !== linked.customer_id || original.vehicle_id !== linked.vehicle_id ||
      original.source_document_type !== 'approved_financial_snapshot' || metadata.command !== 'recognize_vehicle_sale_revenue' ||
      metadata.snapshotId !== original.source_document_id || typeof metadata.handoverEvidenceId !== 'string' ||
      original.handover_evidence_ref !== `mobility-status-log://${metadata.handoverEvidenceId}` ||
      Object.keys(metadata).some(key => !['command', 'snapshotId', 'handoverEvidenceId'].includes(key))) fail('ADJUSTMENT_UNPOSTED_SOURCE_NOT_PROVEN');
    return { original, actorId, tenant, booking };
  }
  private async read(context: Awaited<ReturnType<AutoMoveRecognitionAdjustmentService['context']>>): Promise<RecognitionAdjustmentState> {
    const { original, tenant } = context;
    const rows = (await this.db.query(`select * from public.auto_vehicle_sale_recognition_adjustments
      where recognition_id=$1 and tenant_id=$2 order by created_at,id limit 1001`, [original.id, tenant])).rows;
    if (rows.length > 1000) fail('ADJUSTMENT_HISTORY_LIMIT');
    let salePrice = integer(original.sale_price_recognized), costBasis = integer(original.cost_basis_at_sale), reversed = false;
    const entries = rows.map(row => {
      const current = entry(row);
      if (reversed || row.accounting_policy_id !== original.accounting_policy_id || row.accounting_policy_version !== original.accounting_policy_version ||
        integer(row.refund_amount) !== 0 || integer(row.receivable_delta) !== current.saleDelta ||
        (current.type === 'cost_basis_adjusted' && current.saleDelta !== 0) ||
        (current.type === 'sale_revenue_adjusted' && current.costDelta !== 0)) fail('ADJUSTMENT_UNKNOWN_HISTORY');
      salePrice = integer(salePrice + current.saleDelta); costBasis = integer(costBasis + current.costDelta);
      if (salePrice < 0 || costBasis < 0) fail('ADJUSTMENT_NEGATIVE_TOTAL');
      reversed = current.type === 'sale_revenue_reversed';
      if (reversed && (salePrice !== 0 || costBasis !== 0)) fail('ADJUSTMENT_UNKNOWN_HISTORY');
      return current;
    });
    return recognitionAdjustmentStateSchema.parse({ recognitionId: original.id, revision: hash({ id: original.id, entries }),
      salePrice, costBasis, reversed, policyId: original.accounting_policy_id, policyVersion: original.accounting_policy_version, entries });
  }
  async state(bookingId: string) { return this.read(await this.context(bookingId)); }
  async execute(bookingId: string, key: string, value: unknown) {
    const idempotencyKey = paymentId(key), parsed = recognitionAdjustmentIntentSchema.safeParse(value);
    if (!parsed.success) fail('ADJUSTMENT_INVALID_INTENT', 400);
    const intent = parsed.data, context = await this.context(bookingId), { original, tenant, actorId } = context;
    const document = parseSaleDocument(intent.document);
    if (document.path.split('/')[0] !== tenant) fail('ADJUSTMENT_DOCUMENT_TENANT', 403);
    const requestHash = hash({ recognitionId: original.id, ...intent });
    const previous = (await this.db.query('select * from public.auto_vehicle_sale_recognition_adjustments where tenant_id=$1 and idempotency_key=$2', [tenant, idempotencyKey])).rows[0];
    if (previous) {
      if (previous.recognition_id !== original.id || record(previous.metadata).requestHash !== requestHash) fail('ADJUSTMENT_KEY_CONFLICT');
      return { duplicate: true, entry: entry(previous), state: await this.read(context) };
    }
    const before = await this.read(context);
    if (before.reversed) fail('ADJUSTMENT_ALREADY_REVERSED');
    if (intent.revision !== before.revision) fail('ADJUSTMENT_STALE_REVIEW');
    const saleDelta = intent.action === 'reverse' ? -before.salePrice : intent.action === 'price' ? intent.delta : 0;
    const costDelta = intent.action === 'reverse' ? -before.costBasis : intent.action === 'cost' ? intent.delta : 0;
    if (integer(before.salePrice + saleDelta) < 0 || integer(before.costBasis + costDelta) < 0) fail('ADJUSTMENT_NEGATIVE_TOTAL', 400);
    const bytes = await this.download(document);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== document.sha256) fail('ADJUSTMENT_DOCUMENT_INVALID');
    const recognizedAt = original.recognized_at instanceof Date ? original.recognized_at : new Date(String(original.recognized_at));
    if (!Number.isFinite(recognizedAt.getTime())) fail('ADJUSTMENT_SOURCE_DATE_INVALID');
    const period = await lockOpenAccountingPeriods(this.db, { actorId, tenantId: tenant, sourceDate: recognizedAt.toISOString().slice(0, 10) });
    const metadata = { contract: adjustmentProducer, requestHash, document, reviewedRevision: intent.revision,
      effectiveDate: period.effectiveDate, effectivePeriodId: period.effectivePeriodId };
    await this.db.query('set local role service_role');
    const stored = (await this.db.query(`insert into public.auto_vehicle_sale_recognition_adjustments
      (tenant_id,recognition_id,adjustment_type,idempotency_key,reason,evidence_ref,affected_period_ref,created_by_user_id,
       accounting_policy_id,accounting_policy_version,sale_price_delta,cost_basis_delta,receivable_delta,refund_amount,metadata,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,0,$13::jsonb,statement_timestamp()) returning *`,
    [tenant, original.id, intent.action === 'reverse' ? 'sale_revenue_reversed' : intent.action === 'price' ? 'sale_revenue_adjusted' : 'cost_basis_adjusted', idempotencyKey,
      intent.reason, `storage://${document.bucket}/${document.path}`, period.sourcePeriodId, actorId,
      original.accounting_policy_id, original.accounting_policy_version, saleDelta, costDelta, JSON.stringify(metadata)])).rows[0];
    await this.db.query('set local role authenticated');
    if (!stored) fail('ADJUSTMENT_NOT_PERSISTED');
    const after = await this.read(context);
    if (!after.entries.some(row => row.id === stored.id) || after.salePrice !== before.salePrice + saleDelta || after.costBasis !== before.costBasis + costDelta) fail('ADJUSTMENT_READBACK_MISMATCH');
    return { duplicate: false, entry: entry(stored), state: after };
  }
}
