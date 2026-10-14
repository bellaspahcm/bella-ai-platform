import { createHash, randomUUID } from 'node:crypto';
import {
  MobilityFoundationService, PostgresMobilityRepository,
  type MobilitySqlClient, type MobilityActor, type MobilityAuthorizationPort,
} from '../../../platform/mobility';
import {
  recognizeVehicleSaleRevenue, VehicleSaleRecognitionError,
  type VehicleSaleRecognitionRepository, type VehicleSaleRecognitionLedgerInsert,
  type VehicleSaleRecognitionVehicle,
} from './VehicleSaleRecognitionService';
import { mapRecognitionRecord, toRecognitionInsertRow } from './SupabaseVehicleSaleRecognitionRepository';

type Row = Record<string, unknown>;
export interface SaleDocument { bucket: string; path: string; sha256: string }
export type DocumentDownload = (document: SaleDocument) => Promise<Uint8Array>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(code: string, message: string, status = 400): never {
  throw new VehicleSaleRecognitionError(code, message, status);
}
export function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_PAYLOAD', 'An object is required.');
  return value as Row;
}
function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_FIELD', `${key} is required.`);
  return value.trim();
}
function id(row: Row, key: string): string {
  const value = text(row, key);
  if (!uuid.test(value)) fail('INVALID_ID', `${key} must be a UUID.`);
  return value;
}
function money(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_MONEY', `${key} must be a non-negative integer VND amount.`);
  }
  return value;
}
export function parseSaleDocument(value: unknown): SaleDocument {
  const row = object(value);
  const document = { bucket: text(row, 'bucket'), path: text(row, 'path'), sha256: text(row, 'sha256') };
  if (document.bucket !== 'automove-sale-documents' || document.path.startsWith('/') ||
      document.path.split('/').some(part => !part || part === '.' || part === '..') ||
      !/^[a-f0-9]{64}$/.test(document.sha256)) {
    fail('INVALID_DOCUMENT', 'A Storage object reference and SHA-256 are required.');
  }
  return document;
}
function exact(row: Row, keys: string[]): void {
  if (Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => !(key in row))) {
    fail('INVALID_PAYLOAD', `Only ${keys.join(', ')} are accepted.`);
  }
}
function reviewedSnapshot(row: Row): Row {
  const content = {id:text(row,'id'),tenantId:text(row,'tenant_id'),bookingId:text(row,'booking_id'),
    vehicleId:text(row,'vehicle_id'),customerId:text(row,'customer_id'),salePrice:Number(row.sale_price),
    discountAmount:Number(row.discount_amount),costBasis:Number(row.cost_basis),
    saleDocument:parseSaleDocument(row.sale_document),costDocument:parseSaleDocument(row.cost_document)};
  return {...row,reviewHash:createHash('sha256').update(JSON.stringify(content)).digest('hex')};
}

// This adapter uses the same command/ledger mapper as the sealed recognition API.
class SqlRecognitionRepository implements VehicleSaleRecognitionRepository {
  constructor(private readonly db: MobilitySqlClient, private readonly vehicle: VehicleSaleRecognitionVehicle) {}
  private async one(sql: string, values: unknown[]): Promise<Row | null> {
    return (await this.db.query(sql, values)).rows[0] ?? null;
  }
  async getActorProfile(actorUserId: string) {
    const row = await this.one('select id, tenant_id, role, status from public.users where id = $1', [actorUserId]);
    return row ? { id: text(row,'id'), tenantId: text(row,'tenant_id'), role: text(row,'role'), status: text(row,'status') } : null;
  }
  async getVehicleById(vehicleId: string) {
    return vehicleId === this.vehicle.id ? this.vehicle : null;
  }
  async getCustomerById(customerId: string) {
    const row = await this.one('select id, tenant_id from public.customers where id = $1', [customerId]);
    return row ? { id: text(row,'id'), tenantId: text(row,'tenant_id') } : null;
  }
  async getBookingById(bookingId: string) {
    const row = await this.one('select id, tenant_id, customer_id, vehicle_id from public.auto_bookings where id = $1', [bookingId]);
    return row ? { id: text(row,'id'), tenantId: text(row,'tenant_id'), customerId: text(row,'customer_id'), vehicleId: text(row,'vehicle_id') } : null;
  }
  async findActiveAccountingPolicies(params: { policyId: string; effectiveDate: string }) {
    const rows = (await this.db.query(`select policy_id, version from public.policy_registry
      where policy_id = $1 and status = 'active' and is_active = true and deleted_at is null
      and effective_date <= $2::date and (expire_date is null or expire_date > $2::date) limit 2`,
    [params.policyId, params.effectiveDate])).rows;
    return rows.map(row => ({ policyId: text(row,'policy_id'), version: text(row,'version') }));
  }
  async findRecognitionByIdempotencyKey(params: { tenantId: string; idempotencyKey: string }) {
    const row = await this.one('select * from public.auto_vehicle_sale_recognitions where tenant_id = $1 and idempotency_key = $2', [params.tenantId, params.idempotencyKey]);
    return row ? mapRecognitionRecord(row) : null;
  }
  async findRecognitionBySaleTransactionId(params: { tenantId: string; saleTransactionId: string }) {
    const row = await this.one('select * from public.auto_vehicle_sale_recognitions where tenant_id = $1 and sale_transaction_id = $2', [params.tenantId, params.saleTransactionId]);
    return row ? mapRecognitionRecord(row) : null;
  }
  async insertRecognition(input: VehicleSaleRecognitionLedgerInsert) {
    const row = toRecognitionInsertRow(input);
    const columns = Object.keys(row);
    // Columns come exclusively from the repository-owned mapper, never from a request.
    const values = Object.values(row).map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    await this.db.query('set local role service_role');
    try {
      const result = await this.db.query(`insert into public.auto_vehicle_sale_recognitions
        (${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')}) returning *`, values);
      return mapRecognitionRecord(result.rows[0]);
    } finally { await this.db.query('set local role authenticated'); }
  }
}

export class AutoMoveSaleChainService {
  constructor(private readonly db: MobilitySqlClient, private readonly userId: string,
    private readonly download: DocumentDownload) {}

  async authorize(): Promise<MobilityActor> {
    if (!uuid.test(this.userId)) fail('UNAUTHORIZED', 'Authenticated identity is required.', 401);
    const row = (await this.db.query('select id, tenant_id, role, status from public.users where id = $1', [this.userId])).rows[0];
    if (!row || row.status !== 'active' || typeof row.tenant_id !== 'string' || !uuid.test(row.tenant_id) || row.role !== 'accountant') {
      fail('ACTOR_NOT_AUTHORIZED', 'An active tenant accountant is required.', 403);
    }
    return { userId: this.userId, tenantId: row.tenant_id, roles: [text(row,'role')] };
  }
  private async booking(bookingId: string, requireOpen = true): Promise<Row> {
    const actor = await this.authorize();
    const row = (await this.db.query('select * from public.auto_bookings where id = $1 and tenant_id = $2 for update', [bookingId, actor.tenantId])).rows[0];
    if (!row) fail('BOOKING_NOT_FOUND', 'Booking is unavailable for this tenant.', 404);
    if (requireOpen && (row.status === 'cancelled' || row.payment_status === 'refunded')) fail('BOOKING_INVALID', 'Cancelled/refunded bookings cannot proceed.', 409);
    id(row, 'vehicle_id'); id(row, 'customer_id');
    const customer = await this.db.query('select id from public.customers where id = $1 and tenant_id = $2', [row.customer_id, actor.tenantId]);
    if (!customer.rows.length) fail('CUSTOMER_MISMATCH', 'Booking customer is outside tenant.', 403);
    return row;
  }
  private mobility(actor: MobilityActor) {
    const authorization: MobilityAuthorizationPort = {
      ensureAllowed: async params => {
        if (params.tenantId !== actor.tenantId || params.actor.userId !== actor.userId) fail('TENANT_MISMATCH', 'Mobility actor mismatch.', 403);
      },
    };
    return new MobilityFoundationService(new PostgresMobilityRepository(this.db, true), authorization,
      { next: () => randomUUID() }, { now: () => new Date().toISOString() });
  }
  async state(bookingId: string) {
    const booking = await this.booking(bookingId);
    const actor = await this.authorize();
    const trace = await this.mobility(actor).getVehicleTrace(actor, { vehicleId: text(booking,'vehicle_id') });
    const snapshot = (await this.db.query('select * from public.auto_vehicle_sale_financial_snapshots where booking_id = $1 and tenant_id = $2', [bookingId, actor.tenantId])).rows[0] ?? null;
    const evidence = trace.lifecycleEvents.find(log => log.toStatus === 'delivered' && log.metadata.bookingId === bookingId);
    return { snapshot:snapshot ? reviewedSnapshot(snapshot) : null, handoverEvidenceId: evidence?.id ?? null, vehicleStatus: trace.vehicle.status };
  }
  async createSnapshot(value: unknown) {
    const body = object(value);
    exact(body, ['bookingId','salePrice','discountAmount','costBasis','saleDocument','costDocument']);
    const booking = await this.booking(id(body,'bookingId'));
    const actor = await this.authorize();
    const salePrice = money(body,'salePrice'), discount = money(body,'discountAmount'), cost = money(body,'costBasis');
    if (!salePrice || discount >= salePrice) fail('INVALID_MONEY', 'Net sale price must be positive.');
    const saleDocument = parseSaleDocument(body.saleDocument), costDocument = parseSaleDocument(body.costDocument);
    if ([saleDocument,costDocument].some(document => document.path.split('/')[0] !== actor.tenantId)) {
      fail('DOCUMENT_OUTSIDE_TENANT', 'Source documents must be in the snapshot tenant folder.', 403);
    }
    const existing = (await this.db.query('select * from public.auto_vehicle_sale_financial_snapshots where tenant_id = $1 and booking_id = $2 and vehicle_id = $3', [actor.tenantId, booking.id, booking.vehicle_id])).rows[0];
    if (existing) {
      if (Number(existing.sale_price) !== salePrice || Number(existing.discount_amount) !== discount || Number(existing.cost_basis) !== cost ||
          JSON.stringify(parseSaleDocument(existing.sale_document)) !== JSON.stringify(saleDocument) ||
          JSON.stringify(parseSaleDocument(existing.cost_document)) !== JSON.stringify(costDocument)) {
        fail('SNAPSHOT_CONFLICT', 'This sale already has a different immutable source snapshot.', 409);
      }
      return reviewedSnapshot(existing);
    }
    const saleId = randomUUID();
    return reviewedSnapshot((await this.db.query(`insert into public.auto_vehicle_sale_financial_snapshots
      (tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,
       sale_price,discount_amount,cost_basis,sale_document,cost_document,created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12) returning *`,
    [actor.tenantId,saleId,`vehicle-sale:${saleId}`,booking.id,booking.vehicle_id,booking.customer_id,
      salePrice,discount,cost,JSON.stringify(saleDocument),JSON.stringify(costDocument),actor.userId])).rows[0]);
  }
  async updateDraft(value: unknown) {
    const body = object(value);
    exact(body, ['snapshotId','salePrice','discountAmount','costBasis','saleDocument','costDocument']);
    const snapshot = await this.snapshot(id(body,'snapshotId'));
    if (snapshot.status !== 'draft') fail('SNAPSHOT_IMMUTABLE','Approved financial snapshots are immutable.',409);
    const actor = await this.authorize();
    const salePrice = money(body,'salePrice'), discount = money(body,'discountAmount'), cost = money(body,'costBasis');
    if (!salePrice || discount >= salePrice) fail('INVALID_MONEY','Net sale price must be positive.');
    const saleDocument = parseSaleDocument(body.saleDocument), costDocument = parseSaleDocument(body.costDocument);
    if ([saleDocument,costDocument].some(document => document.path.split('/')[0] !== actor.tenantId)) {
      fail('DOCUMENT_OUTSIDE_TENANT','Source documents must be in the snapshot tenant folder.',403);
    }
    await this.db.query('set local role service_role');
    try {
      return reviewedSnapshot((await this.db.query(`update public.auto_vehicle_sale_financial_snapshots
        set sale_price=$2, discount_amount=$3, cost_basis=$4, sale_document=$5::jsonb, cost_document=$6::jsonb
        where id=$1 and status='draft' returning *`,
      [snapshot.id,salePrice,discount,cost,JSON.stringify(saleDocument),JSON.stringify(costDocument)])).rows[0]);
    } finally { await this.db.query('set local role authenticated'); }
  }
  private async snapshot(snapshotId: string, allowHistorical = false): Promise<Row> {
    const actor = await this.authorize();
    const row = (await this.db.query('select * from public.auto_vehicle_sale_financial_snapshots where id = $1 and tenant_id = $2', [snapshotId,actor.tenantId])).rows[0];
    if (!row) fail('SNAPSHOT_NOT_FOUND', 'Snapshot is unavailable for this tenant.', 404);
    await this.booking(text(row,'booking_id'),!allowHistorical);
    // Serialize server approval/recognition without granting authenticated UPDATE.
    await this.db.query("select pg_advisory_xact_lock(hashtext('automove-sale-snapshot'),hashtext($1))",[snapshotId]);
    return (await this.db.query('select * from public.auto_vehicle_sale_financial_snapshots where id = $1 and tenant_id = $2', [snapshotId,actor.tenantId])).rows[0];
  }
  async approve(value: unknown) {
    const body = object(value); exact(body, ['snapshotId','documentsVerified','reviewHash']);
    if (body.documentsVerified !== true) fail('DOCUMENT_VERIFICATION_REQUIRED', 'The approver must explicitly verify the source documents.');
    const snapshot = await this.snapshot(id(body,'snapshotId'));
    if (text(body,'reviewHash') !== reviewedSnapshot(snapshot).reviewHash) fail('STALE_SNAPSHOT_REVIEW','The draft changed; review the current financial values and documents again.',409);
    if (snapshot.status === 'approved') return reviewedSnapshot(snapshot);
    const sale = money({salePrice:Number(snapshot.sale_price)},'salePrice');
    const discount = money({discountAmount:Number(snapshot.discount_amount)},'discountAmount');
    money({costBasis:Number(snapshot.cost_basis)},'costBasis');
    if(!sale || discount >= sale)fail('INVALID_MONEY','Approved net sale price must be positive.');
    for (const reference of [snapshot.sale_document, snapshot.cost_document]) {
      const document = parseSaleDocument(reference);
      if(document.path.split('/')[0] !== snapshot.tenant_id)fail('DOCUMENT_OUTSIDE_TENANT','Source document is outside the snapshot tenant.',403);
      const bytes = await this.download(document);
      if (!bytes.length || createHash('sha256').update(bytes).digest('hex') !== document.sha256) {
        fail('DOCUMENT_INVALID', 'Source document content is empty or does not match its checksum.', 409);
      }
    }
    await this.db.query('set local role service_role');
    try {
      return reviewedSnapshot((await this.db.query(`update public.auto_vehicle_sale_financial_snapshots
        set status = 'approved', approved_by = $2, approved_at = now() where id = $1 and status = 'draft' returning *`,
      [snapshot.id,this.userId])).rows[0]);
    } finally { await this.db.query('set local role authenticated'); }
  }
  async handover(value: unknown) {
    const body = object(value); exact(body,['bookingId']);
    const booking = await this.booking(id(body,'bookingId'));
    const actor = await this.authorize();
    const mobility = this.mobility(actor);
    const key = `automove-handover:${booking.id}:${booking.vehicle_id}`;
    const before = await mobility.getVehicleTrace(actor,{vehicleId:text(booking,'vehicle_id')});
    if (before.vehicle.allocatedToContractId !== booking.id) {
      fail('ALLOCATION_MISMATCH','Vehicle is not allocated to this booking.',409);
    }
    await mobility.transitionVehicleStatus(actor, {
      vehicleId: text(booking,'vehicle_id'), toStatus: 'delivered', idempotencyKey: key,
      deliveredToCustomerId: text(booking,'customer_id'), reason: 'Explicit AutoMove vehicle handover',
      metadata: { bookingId: booking.id, customerId: booking.customer_id, idempotencyKey: key },
    });
    const trace = await mobility.getVehicleTrace(actor,{ vehicleId: text(booking,'vehicle_id') });
    const evidence = trace.lifecycleEvents.find(log => log.toStatus === 'delivered' && log.metadata.idempotencyKey === key);
    if (!evidence) fail('HANDOVER_NOT_PERSISTED','Handover evidence was not persisted.',500);
    return { handoverEvidenceId: evidence.id, deliveredAt: trace.vehicle.deliveredAt };
  }
  async recognize(value: unknown) {
    const body = object(value); exact(body,['snapshotId','handoverEvidenceId']);
    const snapshot = await this.snapshot(id(body,'snapshotId'),true);
    if (snapshot.status !== 'approved' || !snapshot.approved_by || !snapshot.approved_at) fail('SNAPSHOT_NOT_APPROVED','An approved financial snapshot is required.',409);
    const actor = await this.authorize();
    const mobility = this.mobility(actor);
    const trace = await mobility.getVehicleTrace(actor,{ vehicleId: text(snapshot,'vehicle_id') });
    const evidence = trace.lifecycleEvents.find(log => log.id === id(body,'handoverEvidenceId'));
    if (!evidence || evidence.toStatus !== 'delivered' || !evidence.changedByUserId ||
        evidence.tenantId !== actor.tenantId || evidence.metadata.bookingId !== snapshot.booking_id ||
        evidence.metadata.customerId !== snapshot.customer_id) {
      fail('HANDOVER_INVALID','Persisted handover evidence does not match this sale.',409);
    }
    const repository = new SqlRecognitionRepository(this.db,{ id:trace.vehicle.id,tenantId:trace.vehicle.tenantId });
    const previous = await repository.findRecognitionBySaleTransactionId({tenantId: actor.tenantId,saleTransactionId: text(snapshot,'sale_transaction_id')});
    if (previous && (previous.metadata.snapshotId !== snapshot.id || previous.metadata.handoverEvidenceId !== evidence.id)) {
      fail('RECOGNITION_CONFLICT','Sale recognition is bound to different evidence.',409);
    }
    if (previous) {
      if (previous.idempotencyKey !== snapshot.idempotency_key || previous.bookingId !== snapshot.booking_id ||
          previous.vehicleId !== snapshot.vehicle_id || previous.customerId !== snapshot.customer_id) {
        fail('RECOGNITION_CONFLICT','Persisted recognition does not match the sale snapshot.',409);
      }
      return {status:'idempotent' as const,recognition:previous};
    }
    await this.booking(text(snapshot,'booking_id'));
    if (trace.vehicle.status !== 'delivered' || trace.vehicle.deliveredToCustomerId !== snapshot.customer_id) {
      fail('HANDOVER_INVALID','Vehicle is not currently delivered to this sale customer.',409);
    }
    const deposits = await this.db.query(`select coalesce(sum(amount),0) as amount from public.auto_deposits
      where tenant_id = $1 and booking_id = $2 and status = 'confirmed'`,[actor.tenantId,snapshot.booking_id]);
    const deposit = Number(deposits.rows[0].amount);
    const sale = money({salePrice:Number(snapshot.sale_price)},'salePrice');
    const discount = money({discountAmount:Number(snapshot.discount_amount)},'discountAmount');
    const cost = money({costBasis:Number(snapshot.cost_basis)},'costBasis');
    const net = sale - discount;
    if(net <= 0)fail('INVALID_MONEY','Approved net sale price must be positive.');
    if (!Number.isSafeInteger(deposit) || deposit < 0 || deposit > net) fail('PAYMENT_INVALID','Confirmed deposit exceeds the approved net sale price.',409);
    const result = await recognizeVehicleSaleRevenue({ actorUserId: this.userId, repository,
      command: {
        saleTransactionId: text(snapshot,'sale_transaction_id'), idempotencyKey: text(snapshot,'idempotency_key'),
        bookingId: text(snapshot,'booking_id'), vehicleId: text(snapshot,'vehicle_id'), customerId: text(snapshot,'customer_id'),
        recognitionBasis: 'Explicit recognition of approved financial snapshot and persisted handover',
        sourceDocumentType: 'approved_financial_snapshot', sourceDocumentId: text(snapshot,'id'),
        handoverEvidenceRef: `mobility-status-log://${evidence.id}`,
        salePriceRecognized: net, discountAmount: discount, costBasisAtSale: cost,
        costBasisSourceType: 'approved_financial_snapshot', costBasisSourceRef: text(snapshot,'id'),
        costBasisComponents: { approvedCostBasis: cost },
        depositReceivedTotal: deposit, paymentReceivedTotal: deposit, receivableAmountAtRecognition: net - deposit,
        metadata: { snapshotId: text(snapshot,'id'), handoverEvidenceId: evidence.id },
      },
    });
    return result;
  }
}
