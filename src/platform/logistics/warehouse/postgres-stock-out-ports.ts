import { randomUUID } from 'crypto';

import type { QueryResult, QueryResultRow } from 'pg';

import {
  LedgerEntryType,
  TransactionStatus,
  type InventoryBalance,
} from '../contracts/inventory.contract';
import {
  ActorType,
  TraceabilityEventType,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';
import type {
  CanonicalStockOutMovementRecord,
  ProductionConsumptionReference,
  WarehouseStockOutIdempotencyClaim,
  WarehouseStockOutLineEvidence,
  WarehouseStockOutPorts,
  WarehouseStockOutSuccess,
} from './stock-out-canonical.facade';

export interface WarehousePostgresStockOutExecutor {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
}

export interface WarehousePostgresStockOutPortsOptions {
  idFactory?: () => string;
}

interface InventoryRow extends QueryResultRow {
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  quantity_available: string | number;
  updated_at: Date | string;
}

interface LocationRow extends QueryResultRow {
  location_type: string;
}

interface MovementRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity: string | number;
  reason: string;
  status: string;
  created_by: string | null;
  created_at: Date | string;
}

type StockOutReason = 'disposal' | 'damage' | 'loss' | 'sale' | 'production_consumption';

interface TraceabilityRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  item_id: string;
  lot_number: string | null;
  serial_number: string | null;
  custody_events: unknown;
  compliance_status: string;
  updated_at: Date | string;
}

interface StockOutIdempotencyRow extends QueryResultRow {
  tenant_id: string;
  operation: string;
  idempotency_key: string;
  payload_hash: string;
  status: string;
  result: unknown | null;
}

export function createWarehousePostgresStockOutPorts(
  db: WarehousePostgresStockOutExecutor,
  options: WarehousePostgresStockOutPortsOptions = {}
): WarehouseStockOutPorts {
  const idFactory = options.idFactory ?? randomUUID;

  return {
    transaction: {
      run: (operation) => runInTransaction(db, operation),
    },
    balance: {
      getSourceBalance: (params) => readLocationBalance(db, params),
      applyStockOut: async (mutation) => {
        const lotNumber = readOptionalText(mutation.metadata.lot_number);
        const serialNumber = readFirstSerial(mutation.metadata.serial_numbers);

        const existing = await db.query<InventoryRow>(
          `
          SELECT tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved,
                 quantity_available, updated_at
          FROM logistics.inventory
          WHERE tenant_id = $1
            AND item_id = $2
            AND location_id = $3
            AND lot_number IS NOT DISTINCT FROM $4
            AND serial_number IS NOT DISTINCT FROM $5
          FOR UPDATE
          `,
          [mutation.tenant_id, mutation.item_id, mutation.location_id, lotNumber, serialNumber]
        );

        const current = requireRow(
          existing.rows[0],
          'stock-out source inventory row not found'
        );
        if (toNumber(current.quantity_on_hand) < mutation.quantity) {
          throw new Error('stock-out source inventory row has insufficient quantity');
        }

        const updated = await db.query<InventoryRow>(
          `
          UPDATE logistics.inventory
          SET quantity_on_hand = quantity_on_hand - $6
          WHERE tenant_id = $1
            AND item_id = $2
            AND location_id = $3
            AND lot_number IS NOT DISTINCT FROM $4
            AND serial_number IS NOT DISTINCT FROM $5
          RETURNING tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved,
                    quantity_available, updated_at
          `,
          [
            mutation.tenant_id,
            mutation.item_id,
            mutation.location_id,
            lotNumber,
            serialNumber,
            mutation.quantity,
          ]
        );

        return toInventoryBalance(requireRow(
          updated.rows[0],
          'stock-out inventory update did not return a row'
        ));
      },
    },
    movementLedger: {
      recordStockOut: async ({ mutation, balanceAfter, occurredAt }) => {
        const movementId = idFactory();
        const locationType = await getLocationType(db, mutation.tenant_id, mutation.location_id);
        const issueDocumentType = readOptionalText(mutation.metadata.issue_document_type);
        const sourceDocumentId = readUuid(mutation.reference_id);
        const sourceLineId = readUuid(readOptionalText(mutation.metadata.source_line_id));
        const unitCost = readOptionalNumber(mutation.metadata.unit_cost);
        const currency = readOptionalText(mutation.metadata.currency);
        const totalCost = unitCost === undefined ? undefined : unitCost * mutation.quantity;

        const movement = await db.query<MovementRow>(
          `
          INSERT INTO logistics.inventory_movements (
            id,
            movement_number,
            tenant_id,
            movement_date,
            created_by,
            movement_type,
            direction,
            item_id,
            from_location_id,
            from_location_type,
            quantity,
            unit_of_measure,
            lot_number,
            serial_number,
            unit_cost,
            total_cost,
            currency,
            source_document_type,
            source_document_id,
            source_document_number,
            source_line_item_id,
            reason,
            notes,
            status,
            completed_at
          )
          VALUES (
            $1, $2, $3, $4, $5, 'ISSUE', 'OUTBOUND', $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'COMPLETED', $4
          )
          RETURNING id, tenant_id, item_id, from_location_id AS location_id,
                    quantity, reason, status, created_by, created_at
          `,
          [
            movementId,
            `WH-OUT-${movementId.slice(0, 8).toUpperCase()}`,
            mutation.tenant_id,
            occurredAt,
            mutation.actor_id,
            mutation.item_id,
            mutation.location_id,
            locationType,
            mutation.quantity,
            readText(mutation.metadata.unit_of_measure, 'EA'),
            readOptionalText(mutation.metadata.lot_number),
            readFirstSerial(mutation.metadata.serial_numbers),
            unitCost,
            totalCost,
            currency,
            readMovementSourceDocumentType(issueDocumentType),
            sourceDocumentId,
            readOptionalText(mutation.metadata.issue_document_number),
            sourceLineId,
            mutation.reason,
            readOptionalText(mutation.metadata.notes),
          ]
        );

        const movementRecord = toMovementRecord(
          requireRow(movement.rows[0], 'stock-out movement insert did not return a row'),
          mutation.reason,
          mutation.actor_id
        );

        return {
          movement: movementRecord,
          ledgerEntry: {
            id: movementRecord.id,
            tenant_id: mutation.tenant_id,
            item_id: mutation.item_id,
            location_id: mutation.location_id,
            entry_type: LedgerEntryType.MOVEMENT,
            quantity_delta: -mutation.quantity,
            balance_after: balanceAfter.on_hand,
            transaction_id: movementRecord.id,
            actor_id: mutation.actor_id,
            reason: mutation.reason,
            created_at: occurredAt,
            metadata: mutation.metadata,
          },
        };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        const lotNumber = request.lot_number;
        const serialNumber = request.serial_numbers?.[0];

        if (!lotNumber && !serialNumber) {
          throw new Error('canonical traceability requires lotNumber or serialNumbers');
        }

        const eventId = idFactory();
        const custodyEvent = {
          event_id: eventId,
          timestamp: (request.occurred_at ?? new Date()).toISOString(),
          location_id: request.from_location_id ?? request.current_location_id,
          location_type: 'WAREHOUSE',
          action: request.event_type,
          user_id: request.actor_id,
          quantity: request.quantity,
          transaction_id: request.transaction_id,
          notes: request.notes,
          metadata: request.metadata,
        };

        const existing = await db.query<TraceabilityRow>(
          `
          SELECT id, tenant_id, item_id, lot_number, serial_number, custody_events,
                 compliance_status, updated_at
          FROM logistics.traceability
          WHERE tenant_id = $1
            AND item_id = $2
            AND lot_number IS NOT DISTINCT FROM $3
            AND serial_number IS NOT DISTINCT FROM $4
          FOR UPDATE
          `,
          [request.tenant_id, request.item_id, lotNumber ?? null, serialNumber ?? null]
        );

        const row = existing.rowCount && existing.rows[0]
          ? await appendTraceabilityEvent(db, existing.rows[0].id, custodyEvent)
          : await insertTraceabilityEvent(db, {
              id: eventId,
              tenantId: request.tenant_id,
              itemId: request.item_id,
              lotNumber,
              serialNumber,
              occurredAt: request.occurred_at ?? new Date(),
              custodyEvent,
            });

        return toTraceabilityEvent(row, request, eventId);
      },
    },
    events: {
      publish: async () => {
        return;
      },
    },
    idempotency: {
      claim: (params) => claimStockOutIdempotency(db, {
        tenantId: params.tenantId,
        operation: params.operation,
        idempotencyKey: params.idempotencyKey,
        payloadHash: params.payloadHash,
      }),
      complete: (record) => completeStockOutIdempotency(db, record),
    },
    readBack: {
      getStockOutEvidence: async (params) => {
        const balance = await readLocationBalance(db, {
          tenant_id: params.tenant_id,
          item_id: params.item_id,
          location_id: params.location_id,
        });

        const movement = await db.query<MovementRow>(
          `
          SELECT id, tenant_id, item_id, from_location_id AS location_id,
                 quantity, reason, status, created_by, created_at
          FROM logistics.inventory_movements
          WHERE tenant_id = $1 AND id = $2
          `,
          [params.tenant_id, params.movement_id]
        );
        if (!movement.rows[0]) throw new Error('stock-out read-back movement not found');

        const traceability = await db.query<TraceabilityRow>(
          `
          SELECT id, tenant_id, item_id, lot_number, serial_number, custody_events,
                 compliance_status, updated_at
          FROM logistics.traceability
          WHERE tenant_id = $1 AND id = $2
          `,
          [params.tenant_id, params.traceability_event_id]
        );
        if (!traceability.rows[0]) throw new Error('stock-out read-back traceability not found');

        const movementRecord = toMovementRecord(
          requireRow(movement.rows[0], 'stock-out read-back movement not found'),
          readStockOutReason(movement.rows[0].reason),
          ''
        );

        return {
          balance,
          ledgerEntry: {
            id: movementRecord.id,
            tenant_id: movementRecord.tenant_id,
            item_id: movementRecord.item_id,
            location_id: movementRecord.location_id,
            entry_type: LedgerEntryType.MOVEMENT,
            quantity_delta: -movementRecord.quantity,
            balance_after: balance.on_hand,
            transaction_id: movementRecord.id,
            actor_id: movementRecord.actor_id,
            reason: movementRecord.reason,
            created_at: movementRecord.created_at,
          },
          movement: movementRecord,
          traceability: toReadBackTraceabilityEvent(
            requireRow(traceability.rows[0], 'stock-out read-back traceability not found'),
            movementRecord
          ),
        };
      },
    },
  };
}

async function runInTransaction<TResult>(
  db: WarehousePostgresStockOutExecutor,
  operation: () => Promise<TResult>
): Promise<TResult> {
  await db.query('BEGIN');
  try {
    const result = await operation();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function claimStockOutIdempotency(
  db: WarehousePostgresStockOutExecutor,
  params: { tenantId: string; operation: string; idempotencyKey: string; payloadHash: string }
): Promise<WarehouseStockOutIdempotencyClaim> {
  const inserted = await db.query<StockOutIdempotencyRow>(
    `
    INSERT INTO logistics.stock_out_idempotency (
      tenant_id,
      operation,
      idempotency_key,
      payload_hash,
      status
    )
    VALUES ($1::uuid, $2, $3, $4, 'in_progress')
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING
    RETURNING tenant_id, operation, idempotency_key, payload_hash, status, result
    `,
    [
      params.tenantId,
      params.operation,
      params.idempotencyKey,
      params.payloadHash,
    ]
  );

  if (inserted.rows[0]) return { status: 'claimed' };

  const existing = await db.query<StockOutIdempotencyRow>(
    `
    SELECT tenant_id, operation, idempotency_key, payload_hash, status, result
    FROM logistics.stock_out_idempotency
    WHERE tenant_id = $1::uuid
      AND operation = $2
      AND idempotency_key = $3
    FOR UPDATE
    `,
    [params.tenantId, params.operation, params.idempotencyKey]
  );
  const row = requireRow(existing.rows[0], 'stock-out idempotency row not found after conflict');

  if (row.payload_hash !== params.payloadHash) return { status: 'conflict' };
  if (row.status === 'completed') {
    if (row.result === null) return { status: 'in_progress' };
    return {
      status: 'completed',
      record: {
        tenantId: row.tenant_id,
        operation: row.operation,
        idempotencyKey: row.idempotency_key,
        payloadHash: row.payload_hash,
        result: toWarehouseStockOutSuccess(row.result),
      },
    };
  }
  return { status: 'in_progress' };
}

async function completeStockOutIdempotency(
  db: WarehousePostgresStockOutExecutor,
  record: {
    tenantId: string;
    operation: string;
    idempotencyKey: string;
    payloadHash: string;
    result: WarehouseStockOutSuccess;
  }
): Promise<void> {
  const completed = await db.query<StockOutIdempotencyRow>(
    `
    UPDATE logistics.stock_out_idempotency
    SET status = 'completed',
        result = $4::jsonb,
        updated_at = NOW()
    WHERE tenant_id = $1::uuid
      AND operation = $2
      AND idempotency_key = $3
      AND payload_hash = $5
    RETURNING tenant_id, operation, idempotency_key, payload_hash, status, result
    `,
    [
      record.tenantId,
      record.operation,
      record.idempotencyKey,
      JSON.stringify(record.result),
      record.payloadHash,
    ]
  );
  requireRow(completed.rows[0], 'stock-out idempotency completion did not update a row');
}

async function readLocationBalance(
  db: WarehousePostgresStockOutExecutor,
  params: { tenant_id: string; item_id: string; location_id: string }
): Promise<InventoryBalance> {
  const result = await db.query<InventoryRow>(
    `
    SELECT
      tenant_id,
      item_id,
      location_id,
      COALESCE(SUM(quantity_on_hand), 0) AS quantity_on_hand,
      COALESCE(SUM(quantity_reserved), 0) AS quantity_reserved,
      COALESCE(SUM(quantity_available), 0) AS quantity_available,
      CURRENT_TIMESTAMP AS updated_at
    FROM logistics.inventory
    WHERE tenant_id = $1 AND item_id = $2 AND location_id = $3
    GROUP BY tenant_id, item_id, location_id
    `,
    [params.tenant_id, params.item_id, params.location_id]
  );

  if (!result.rows[0]) {
    return {
      tenant_id: params.tenant_id,
      item_id: params.item_id,
      location_id: params.location_id,
      on_hand: 0,
      allocated: 0,
      available: 0,
      updated_at: new Date(),
    };
  }

  return toInventoryBalance(result.rows[0]);
}

async function getLocationType(
  db: WarehousePostgresStockOutExecutor,
  tenantId: string,
  locationId: string
): Promise<string> {
  const result = await db.query<LocationRow>(
    `
    SELECT location_type
    FROM logistics.locations
    WHERE tenant_id = $1 AND id = $2
    `,
    [tenantId, locationId]
  );

  if (!result.rows[0]) {
    throw new Error('canonical location not found for stock-out');
  }

  return result.rows[0].location_type;
}

async function appendTraceabilityEvent(
  db: WarehousePostgresStockOutExecutor,
  traceabilityId: string,
  custodyEvent: Record<string, unknown>
): Promise<TraceabilityRow> {
  const result = await db.query<TraceabilityRow>(
    `
    UPDATE logistics.traceability
    SET custody_events = custody_events || $2::jsonb
    WHERE id = $1
    RETURNING id, tenant_id, item_id, lot_number, serial_number, custody_events,
              compliance_status, updated_at
    `,
    [traceabilityId, JSON.stringify([custodyEvent])]
  );
  return requireRow(result.rows[0], 'traceability append did not return a row');
}

async function insertTraceabilityEvent(
  db: WarehousePostgresStockOutExecutor,
  params: {
    id: string;
    tenantId: string;
    itemId: string;
    lotNumber?: string;
    serialNumber?: string;
    occurredAt: Date;
    custodyEvent: Record<string, unknown>;
  }
): Promise<TraceabilityRow> {
  const result = await db.query<TraceabilityRow>(
    `
    INSERT INTO logistics.traceability (
      id,
      tenant_id,
      item_id,
      lot_number,
      serial_number,
      received_date,
      custody_events,
      compliance_status,
      recall_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'COMPLIANT', 'NONE')
    RETURNING id, tenant_id, item_id, lot_number, serial_number, custody_events,
              compliance_status, updated_at
    `,
    [
      params.id,
      params.tenantId,
      params.itemId,
      params.lotNumber ?? null,
      params.serialNumber ?? null,
      params.occurredAt,
      JSON.stringify([params.custodyEvent]),
    ]
  );
  return requireRow(result.rows[0], 'traceability insert did not return a row');
}

function toInventoryBalance(row: InventoryRow): InventoryBalance {
  return {
    tenant_id: row.tenant_id,
    item_id: row.item_id,
    location_id: row.location_id,
    on_hand: toNumber(row.quantity_on_hand),
    allocated: toNumber(row.quantity_reserved),
    available: toNumber(row.quantity_available),
    updated_at: new Date(row.updated_at),
  };
}

function toMovementRecord(
  row: MovementRow,
  reason: StockOutReason,
  fallbackActorId: string
): CanonicalStockOutMovementRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    item_id: row.item_id,
    location_id: row.location_id,
    quantity: toNumber(row.quantity),
    reason,
    status: TransactionStatus.COMPLETED,
    actor_id: row.created_by ?? fallbackActorId,
    created_at: new Date(row.created_at),
  };
}

function readStockOutReason(value: string): StockOutReason {
  return value === 'damage' ||
    value === 'loss' ||
    value === 'sale' ||
    value === 'production_consumption'
    ? value
    : 'disposal';
}

function readMovementSourceDocumentType(issueDocumentType: string | undefined): string {
  return issueDocumentType === 'sales_order' ? 'sales_order' : 'warehouse_stock_out';
}

function toTraceabilityEvent(
  row: TraceabilityRow,
  request: {
    event_type: TraceabilityEventType;
    quantity: number;
    from_location_id?: string;
    to_location_id?: string;
    current_location_id?: string;
    actor_id: string;
    actor_type: ActorType;
    transaction_id?: string;
    transaction_type?: string;
    reference_id?: string;
    reference_type?: string;
    occurred_at?: Date;
    notes?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
  eventId: string
): TraceabilityEvent {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    event_type: request.event_type,
    item_id: row.item_id,
    lot_number: row.lot_number ?? undefined,
    serial_numbers: row.serial_number ? [row.serial_number] : undefined,
    quantity: request.quantity,
    from_location_id: request.from_location_id,
    to_location_id: request.to_location_id,
    current_location_id: request.current_location_id,
    actor_id: request.actor_id,
    actor_type: request.actor_type,
    transaction_id: request.transaction_id,
    transaction_type: request.transaction_type,
    reference_id: request.reference_id,
    reference_type: request.reference_type,
    occurred_at: request.occurred_at ?? new Date(),
    recorded_at: new Date(row.updated_at),
    notes: request.notes,
    reason: request.reason,
    metadata: {
      ...request.metadata,
      custody_event_id: eventId,
      compliance_status: row.compliance_status,
    },
  };
}

function toReadBackTraceabilityEvent(
  row: TraceabilityRow,
  movement: CanonicalStockOutMovementRecord
): TraceabilityEvent {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    event_type: TraceabilityEventType.SHIPPED,
    item_id: row.item_id,
    lot_number: row.lot_number ?? undefined,
    serial_numbers: row.serial_number ? [row.serial_number] : undefined,
    quantity: movement.quantity,
    from_location_id: movement.location_id,
    actor_id: movement.actor_id,
    actor_type: ActorType.USER,
    transaction_id: movement.id,
    transaction_type: 'warehouse_stock_out',
    occurred_at: movement.created_at,
    recorded_at: new Date(row.updated_at),
    reason: movement.reason,
    metadata: {
      compliance_status: row.compliance_status,
      custody_events: row.custody_events,
    },
  };
}

function requireRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) throw new Error(message);
  return row;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readFirstSerial(value: unknown): string | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0
    ? value[0]
    : undefined;
}

function readUuid(value: string | undefined): string | null {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value)
    ? value
    : null;
}

function toWarehouseStockOutSuccess(value: unknown): WarehouseStockOutSuccess {
  if (!isRecord(value)) throw new Error('stored stock-out idempotency result is malformed');
  const tenantId = readRequiredString(value.tenantId, 'tenantId');
  const issueDocumentId = readRequiredString(value.issueDocumentId, 'issueDocumentId');
  const linesValue = value.lines;
  if (!Array.isArray(linesValue)) {
    throw new Error('stored stock-out idempotency result lines are malformed');
  }

  return {
    tenantId,
    issueDocumentId,
    productionConsumptionReference: readProductionConsumptionReference(
      value.productionConsumptionReference
    ),
    isDuplicate: value.isDuplicate === true,
    lines: linesValue.map(toWarehouseStockOutLineEvidence),
  };
}

function toWarehouseStockOutLineEvidence(value: unknown): WarehouseStockOutLineEvidence {
  if (!isRecord(value)) throw new Error('stored stock-out idempotency line is malformed');
  return {
    itemId: readRequiredString(value.itemId, 'itemId'),
    locationId: readRequiredString(value.locationId, 'locationId'),
    quantity: readRequiredNumber(value.quantity, 'quantity'),
    balanceBefore: readStoredInventoryBalance(value.balanceBefore),
    balanceAfter: readStoredInventoryBalance(value.balanceAfter),
    movement: readStoredMovement(value.movement),
    ledgerEntry: readStoredLedgerEntry(value.ledgerEntry),
    traceabilityEvent: readStoredTraceabilityEvent(value.traceabilityEvent),
    readBack: readStoredReadBack(value.readBack),
  };
}

function readProductionConsumptionReference(value: unknown): ProductionConsumptionReference | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error('stored production consumption reference is malformed');
  return {
    productionOrderId: readRequiredString(value.productionOrderId, 'productionOrderId'),
    productionOrderLineId: readRequiredString(value.productionOrderLineId, 'productionOrderLineId'),
    idempotencyKey: readRequiredString(value.idempotencyKey, 'idempotencyKey'),
  };
}

function readStoredInventoryBalance(value: unknown): InventoryBalance {
  if (!isRecord(value)) throw new Error('stored stock-out balance is malformed');
  return {
    tenant_id: readRequiredString(value.tenant_id, 'tenant_id'),
    item_id: readRequiredString(value.item_id, 'item_id'),
    location_id: readRequiredString(value.location_id, 'location_id'),
    on_hand: readRequiredNumber(value.on_hand, 'on_hand'),
    allocated: readRequiredNumber(value.allocated, 'allocated'),
    available: readRequiredNumber(value.available, 'available'),
    updated_at: readRequiredDate(value.updated_at, 'updated_at'),
  };
}

function readStoredMovement(value: unknown): CanonicalStockOutMovementRecord {
  if (!isRecord(value)) throw new Error('stored stock-out movement is malformed');
  return {
    id: readRequiredString(value.id, 'movement.id'),
    tenant_id: readRequiredString(value.tenant_id, 'movement.tenant_id'),
    item_id: readRequiredString(value.item_id, 'movement.item_id'),
    location_id: readRequiredString(value.location_id, 'movement.location_id'),
    quantity: readRequiredNumber(value.quantity, 'movement.quantity'),
    reason: readStockOutReason(readRequiredString(value.reason, 'movement.reason')),
    status: TransactionStatus.COMPLETED,
    actor_id: readRequiredString(value.actor_id, 'movement.actor_id'),
    created_at: readRequiredDate(value.created_at, 'movement.created_at'),
  };
}

function readStoredLedgerEntry(value: unknown) {
  if (!isRecord(value)) throw new Error('stored stock-out ledger entry is malformed');
  return {
    id: readRequiredString(value.id, 'ledgerEntry.id'),
    tenant_id: readRequiredString(value.tenant_id, 'ledgerEntry.tenant_id'),
    item_id: readRequiredString(value.item_id, 'ledgerEntry.item_id'),
    location_id: readRequiredString(value.location_id, 'ledgerEntry.location_id'),
    entry_type: LedgerEntryType.MOVEMENT,
    quantity_delta: readRequiredNumber(value.quantity_delta, 'ledgerEntry.quantity_delta'),
    balance_after: readRequiredNumber(value.balance_after, 'ledgerEntry.balance_after'),
    transaction_id: readRequiredString(value.transaction_id, 'ledgerEntry.transaction_id'),
    actor_id: readRequiredString(value.actor_id, 'ledgerEntry.actor_id'),
    reason: readRequiredString(value.reason, 'ledgerEntry.reason'),
    created_at: readRequiredDate(value.created_at, 'ledgerEntry.created_at'),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function readStoredTraceabilityEvent(value: unknown): TraceabilityEvent {
  if (!isRecord(value)) throw new Error('stored stock-out traceability event is malformed');
  return {
    id: readRequiredString(value.id, 'traceabilityEvent.id'),
    tenant_id: readRequiredString(value.tenant_id, 'traceabilityEvent.tenant_id'),
    event_type: readTraceabilityEventType(value.event_type),
    item_id: readRequiredString(value.item_id, 'traceabilityEvent.item_id'),
    lot_number: readOptionalString(value.lot_number),
    serial_numbers: readOptionalStringArray(value.serial_numbers),
    quantity: readRequiredNumber(value.quantity, 'traceabilityEvent.quantity'),
    from_location_id: readOptionalString(value.from_location_id),
    to_location_id: readOptionalString(value.to_location_id),
    current_location_id: readOptionalString(value.current_location_id),
    actor_id: readRequiredString(value.actor_id, 'traceabilityEvent.actor_id'),
    actor_type: ActorType.USER,
    transaction_id: readOptionalString(value.transaction_id),
    transaction_type: readOptionalString(value.transaction_type),
    reference_id: readOptionalString(value.reference_id),
    reference_type: readOptionalString(value.reference_type),
    occurred_at: readRequiredDate(value.occurred_at, 'traceabilityEvent.occurred_at'),
    recorded_at: readRequiredDate(value.recorded_at, 'traceabilityEvent.recorded_at'),
    notes: readOptionalString(value.notes),
    reason: readOptionalString(value.reason),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function readStoredReadBack(value: unknown) {
  if (!isRecord(value)) throw new Error('stored stock-out read-back is malformed');
  return {
    balance: readStoredInventoryBalance(value.balance),
    ledgerEntry: readStoredLedgerEntry(value.ledgerEntry),
    movement: readStoredMovement(value.movement),
    traceability: readStoredTraceabilityEvent(value.traceability),
  };
}

function readTraceabilityEventType(value: unknown): TraceabilityEventType {
  if (value === TraceabilityEventType.PICKED) return TraceabilityEventType.PICKED;
  if (value === TraceabilityEventType.SHIPPED) return TraceabilityEventType.SHIPPED;
  if (value === TraceabilityEventType.DAMAGED) return TraceabilityEventType.DAMAGED;
  throw new Error('stored stock-out traceability event type is malformed');
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`stored stock-out idempotency ${field} is malformed`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readRequiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`stored stock-out idempotency ${field} is malformed`);
  }
  return value;
}

function readRequiredDate(value: unknown, field: string): Date {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') {
    throw new Error(`stored stock-out idempotency ${field} is malformed`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`stored stock-out idempotency ${field} is malformed`);
  }
  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
