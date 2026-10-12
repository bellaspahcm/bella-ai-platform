import { randomUUID } from 'crypto';

import {
  LedgerEntryType,
  TransactionStatus,
  type InventoryBalance,
  type InventoryLedgerEntry,
  type ItemId,
  type LocationId,
  type Quantity,
} from '../contracts/inventory.contract';
import {
  ValuationMethod,
  type FinancialContext,
  type IEventBus,
  type InventoryIssuedEvent,
} from '../contracts/events.contract';
import {
  ActorType,
  TraceabilityEventType,
  type ITraceabilityService,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';

export type WarehouseStockOutSourceType =
  | 'warehouse_issue'
  | 'disposal'
  | 'damage'
  | 'loss'
  | 'sales_order'
  | 'production_consumption';

export type WarehouseStockOutReason =
  | 'disposal'
  | 'damage'
  | 'loss'
  | 'sale'
  | 'production_consumption';

const traceabilityEventTypeByStockOutReason: Record<
  WarehouseStockOutReason,
  TraceabilityEventType
> = {
  disposal: TraceabilityEventType.SHIPPED,
  damage: TraceabilityEventType.DAMAGED,
  loss: TraceabilityEventType.SHIPPED,
  sale: TraceabilityEventType.SHIPPED,
  production_consumption: TraceabilityEventType.PICKED,
};

export interface ProductionConsumptionReference {
  productionOrderId: string;
  productionOrderLineId: string;
  idempotencyKey: string;
}

export interface WarehouseStockOutCommand {
  tenantId: string;
  actorId: string;
  correlationId?: string;
  issueDocument: {
    id: string;
    number?: string;
    type: WarehouseStockOutSourceType;
  };
  idempotencyKey?: string;
  productionConsumptionReference?: ProductionConsumptionReference;
  lines: WarehouseStockOutLineCommand[];
}

export interface WarehouseStockOutLineCommand {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  unitOfMeasure: string;
  reason: WarehouseStockOutReason;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  notes?: string;
  unitCost?: number;
  currency?: string;
  valuationMethod?: ValuationMethod;
  metadata?: Record<string, unknown>;
}

export interface CanonicalStockOutMutation {
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  reason: WarehouseStockOutReason;
  actor_id: string;
  reference_id: string;
  metadata: Record<string, unknown>;
}

export interface WarehouseStockOutIdempotencyRecord {
  tenantId: string;
  operation: string;
  idempotencyKey: string;
  payloadHash: string;
  result: WarehouseStockOutSuccess;
}

export type WarehouseStockOutIdempotencyClaim =
  | { status: 'claimed' }
  | { status: 'completed'; record: WarehouseStockOutIdempotencyRecord }
  | { status: 'in_progress' }
  | { status: 'conflict' };

export interface CanonicalStockOutMovementRecord {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  reason: WarehouseStockOutReason;
  status: TransactionStatus.COMPLETED;
  actor_id: string;
  created_at: Date;
}

export interface WarehouseStockOutReadBackEvidence {
  balance: InventoryBalance;
  ledgerEntry: InventoryLedgerEntry;
  movement: CanonicalStockOutMovementRecord;
  traceability: TraceabilityEvent;
}

export interface WarehouseStockOutPorts {
  transaction?: {
    run<T>(operation: () => Promise<T>): Promise<T>;
  };
  balance: {
    getSourceBalance(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
    }): Promise<InventoryBalance>;
    applyStockOut(mutation: CanonicalStockOutMutation): Promise<InventoryBalance>;
  };
  movementLedger: {
    recordStockOut(params: {
      mutation: CanonicalStockOutMutation;
      balanceBefore: InventoryBalance;
      balanceAfter: InventoryBalance;
      occurredAt: Date;
    }): Promise<{
      movement: CanonicalStockOutMovementRecord;
      ledgerEntry: InventoryLedgerEntry;
    }>;
  };
  traceability: Pick<ITraceabilityService, 'recordEvent'>;
  events: Pick<IEventBus, 'publish'>;
  idempotency?: {
    claim(params: {
      tenantId: string;
      operation: string;
      idempotencyKey: string;
      payloadHash: string;
    }): Promise<WarehouseStockOutIdempotencyClaim>;
    complete(record: WarehouseStockOutIdempotencyRecord): Promise<void>;
  };
  readBack: {
    getStockOutEvidence(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
      movement_id: string;
      traceability_event_id: string;
    }): Promise<WarehouseStockOutReadBackEvidence>;
  };
}

export type WarehouseStockOutErrorCode =
  | 'WAREHOUSE_STOCK_OUT_INVALID_COMMAND'
  | 'WAREHOUSE_STOCK_OUT_CANONICAL_SKU_MISSING'
  | 'WAREHOUSE_STOCK_OUT_LOCATION_MISSING'
  | 'WAREHOUSE_STOCK_OUT_INVALID_QUANTITY'
  | 'WAREHOUSE_STOCK_OUT_INVALID_REASON'
  | 'WAREHOUSE_STOCK_OUT_SERIAL_REQUIRES_LOT'
  | 'WAREHOUSE_STOCK_OUT_PRODUCTION_REFERENCE_REQUIRED'
  | 'WAREHOUSE_STOCK_OUT_SALES_ORDER_REFERENCE_REQUIRED'
  | 'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_REQUIRED'
  | 'WAREHOUSE_STOCK_OUT_TRANSACTION_REQUIRED'
  | 'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_CONFLICT'
  | 'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_IN_PROGRESS'
  | 'WAREHOUSE_STOCK_OUT_INSUFFICIENT_SOURCE_BALANCE'
  | 'WAREHOUSE_STOCK_OUT_RUNTIME_FAILED';

export interface WarehouseStockOutSuccess {
  tenantId: string;
  issueDocumentId: string;
  productionConsumptionReference?: ProductionConsumptionReference;
  isDuplicate?: boolean;
  lines: WarehouseStockOutLineEvidence[];
}

export type WarehouseStockOutResult =
  | {
      ok: true;
      value: WarehouseStockOutSuccess;
    }
  | {
      ok: false;
      error: {
        code: WarehouseStockOutErrorCode;
        message: string;
        lineIndex?: number;
      };
    };

export interface WarehouseStockOutLineEvidence {
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  balanceBefore: InventoryBalance;
  balanceAfter: InventoryBalance;
  movement: CanonicalStockOutMovementRecord;
  ledgerEntry: InventoryLedgerEntry;
  traceabilityEvent: TraceabilityEvent;
  readBack: WarehouseStockOutReadBackEvidence;
}

export interface WarehouseStockOutCanonicalFacadeOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class WarehouseStockOutCanonicalFacade {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly ports: WarehouseStockOutPorts,
    options: WarehouseStockOutCanonicalFacadeOptions = {}
  ) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async execute(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult> {
    const commandError = this.validateCommand(command);
    if (commandError) return commandError;

    for (let lineIndex = 0; lineIndex < command.lines.length; lineIndex += 1) {
      const lineError = this.validateLine(command.lines[lineIndex], lineIndex);
      if (lineError) return lineError;
    }

    const idempotencyKey = readStockOutIdempotencyKey(command);
    if (idempotencyKey && !this.ports.idempotency) {
      return failure(
        'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_REQUIRED',
        'idempotent stock out requires Logistics idempotency'
      );
    }
    if (idempotencyKey && !this.ports.transaction) {
      return failure(
        'WAREHOUSE_STOCK_OUT_TRANSACTION_REQUIRED',
        'idempotent stock out requires transactional Logistics persistence'
      );
    }

    if (idempotencyKey && this.ports.transaction) {
      return this.executeWithRuntimeBoundary(async () => {
        return this.ports.transaction!.run(async () => {
          const result = await this.executeValidated(command);
          if (!result.ok) throw new WarehouseStockOutKnownFailure(result);
          return result;
        });
      });
    }

    return this.executeWithRuntimeBoundary(() => this.executeValidated(command));
  }

  private async executeValidated(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult> {
    const payloadHash = stablePayloadHash(command);
    const idempotencyKey = readStockOutIdempotencyKey(command);
    const operation = readStockOutIdempotencyOperation(command);
    if (idempotencyKey) {
      if (!this.ports.idempotency) {
        return failure(
          'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_REQUIRED',
          'idempotent stock out requires Logistics idempotency'
        );
      }
      const claim = await this.ports.idempotency.claim({
        tenantId: command.tenantId,
        operation,
        idempotencyKey,
        payloadHash,
      });
      if (claim.status === 'completed') {
        if (claim.record.payloadHash !== payloadHash) {
          return failure(
            'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_CONFLICT',
            'idempotency key was already completed with a different payload'
          );
        }
        return {
          ok: true,
          value: {
            ...claim.record.result,
            isDuplicate: true,
          },
        };
      }
      if (claim.status === 'conflict') {
        return failure(
          'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_CONFLICT',
          'idempotency key was already claimed with a different payload'
        );
      }
      if (claim.status === 'in_progress') {
        return failure(
          'WAREHOUSE_STOCK_OUT_IDEMPOTENCY_IN_PROGRESS',
          'idempotent stock out is already in progress'
        );
      }
    }

    const lines: WarehouseStockOutLineEvidence[] = [];

    for (let lineIndex = 0; lineIndex < command.lines.length; lineIndex += 1) {
      const line = command.lines[lineIndex];
      const balanceBefore = await this.ports.balance.getSourceBalance({
        tenant_id: command.tenantId,
        item_id: line.itemId,
        location_id: line.locationId,
      });

      if (balanceBefore.on_hand < line.quantity) {
        return failure(
          'WAREHOUSE_STOCK_OUT_INSUFFICIENT_SOURCE_BALANCE',
          'source balance is insufficient for stock out',
          lineIndex
        );
      }

      const occurredAt = this.now();
      const mutation = this.toStockOutMutation(command, line);
      const balanceAfter = await this.ports.balance.applyStockOut(mutation);
      const { movement, ledgerEntry } = await this.ports.movementLedger.recordStockOut({
        mutation,
        balanceBefore,
        balanceAfter,
        occurredAt,
      });
      const traceabilityEvent = await this.ports.traceability.recordEvent({
        tenant_id: command.tenantId,
        event_type: traceabilityEventTypeByStockOutReason[line.reason],
        item_id: line.itemId,
        quantity: line.quantity,
        lot_number: line.lotNumber,
        serial_numbers: line.serialNumbers,
        from_location_id: line.locationId,
        actor_id: command.actorId,
        actor_type: ActorType.USER,
        transaction_id: movement.id,
        transaction_type: 'warehouse_stock_out',
        reference_id: command.issueDocument.id,
        reference_type: command.issueDocument.type,
        occurred_at: occurredAt,
        reason: line.reason,
        notes: line.notes,
        metadata: {
          warehouse_sku_id: line.warehouseSkuId,
          warehouse_bin_id: line.warehouseBinId,
          source_line_id: line.sourceLineId,
          issue_document_number: command.issueDocument.number,
          ...line.metadata,
        },
      });

      await this.ports.events.publish(this.toInventoryIssuedEvent({
        command,
        line,
        balanceBefore,
        balanceAfter,
        occurredAt,
        movementId: movement.id,
      }));

      const readBack = await this.ports.readBack.getStockOutEvidence({
        tenant_id: command.tenantId,
        item_id: line.itemId,
        location_id: line.locationId,
        movement_id: movement.id,
        traceability_event_id: traceabilityEvent.id,
      });

      lines.push({
        itemId: line.itemId,
        locationId: line.locationId,
        quantity: line.quantity,
        balanceBefore,
        balanceAfter,
        movement,
        ledgerEntry,
        traceabilityEvent,
        readBack,
      });
    }

    const value: WarehouseStockOutSuccess = {
      tenantId: command.tenantId,
      issueDocumentId: command.issueDocument.id,
      productionConsumptionReference: command.productionConsumptionReference,
      isDuplicate: false,
      lines,
    };
    if (idempotencyKey && this.ports.idempotency) {
      await this.ports.idempotency.complete({
        tenantId: command.tenantId,
        operation,
        idempotencyKey,
        payloadHash,
        result: value,
      });
    }

    return {
      ok: true,
      value,
    };
  }

  private async executeWithRuntimeBoundary(
    operation: () => Promise<WarehouseStockOutResult>
  ): Promise<WarehouseStockOutResult> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof WarehouseStockOutKnownFailure) return error.result;
      return {
        ok: false,
        error: {
          code: 'WAREHOUSE_STOCK_OUT_RUNTIME_FAILED',
          message: error instanceof Error ? error.message : 'Warehouse stock out runtime failed',
        },
      };
    }
  }

  private validateCommand(command: WarehouseStockOutCommand): WarehouseStockOutResult | null {
    if (!hasText(command.tenantId)) {
      return failure('WAREHOUSE_STOCK_OUT_INVALID_COMMAND', 'tenantId is required');
    }

    if (!hasText(command.actorId)) {
      return failure('WAREHOUSE_STOCK_OUT_INVALID_COMMAND', 'actorId is required');
    }

    if (!hasText(command.issueDocument.id)) {
      return failure('WAREHOUSE_STOCK_OUT_INVALID_COMMAND', 'issueDocument.id is required');
    }

    if (command.lines.length === 0) {
      return failure(
        'WAREHOUSE_STOCK_OUT_INVALID_COMMAND',
        'at least one stock out line is required'
      );
    }

    if (command.issueDocument.type === 'production_consumption') {
      const reference = command.productionConsumptionReference;
      if (
        !reference ||
        !hasText(reference.productionOrderId) ||
        !hasText(reference.productionOrderLineId) ||
        !hasText(reference.idempotencyKey)
      ) {
        return failure(
          'WAREHOUSE_STOCK_OUT_PRODUCTION_REFERENCE_REQUIRED',
          'production consumption requires production order, production order line, and idempotency key'
        );
      }
      if (command.lines.some((line) => line.reason !== 'production_consumption')) {
        return failure(
          'WAREHOUSE_STOCK_OUT_INVALID_REASON',
          'production consumption stock out requires production_consumption reason'
        );
      }
    } else if (command.lines.some((line) => line.reason === 'production_consumption')) {
      return failure(
        'WAREHOUSE_STOCK_OUT_PRODUCTION_REFERENCE_REQUIRED',
        'production_consumption reason requires production_consumption issue document'
      );
    }

    if (hasText(command.idempotencyKey) && command.issueDocument.type !== 'sales_order') {
      return failure(
        'WAREHOUSE_STOCK_OUT_SALES_ORDER_REFERENCE_REQUIRED',
        'stock out idempotency key is only supported for sales_order issue documents'
      );
    }

    if (command.issueDocument.type === 'sales_order') {
      if (!hasText(command.idempotencyKey)) {
        return failure(
          'WAREHOUSE_STOCK_OUT_SALES_ORDER_REFERENCE_REQUIRED',
          'sales order stock out requires an idempotency key'
        );
      }
      if (command.lines.some((line) => line.reason !== 'sale')) {
        return failure(
          'WAREHOUSE_STOCK_OUT_INVALID_REASON',
          'sales order stock out requires sale reason'
        );
      }
    } else if (command.lines.some((line) => line.reason === 'sale')) {
      return failure(
        'WAREHOUSE_STOCK_OUT_SALES_ORDER_REFERENCE_REQUIRED',
        'sale reason requires sales_order issue document'
      );
    }

    return null;
  }

  private validateLine(
    line: WarehouseStockOutLineCommand,
    lineIndex: number
  ): WarehouseStockOutResult | null {
    if (!hasText(line.warehouseSkuId)) {
      return failure('WAREHOUSE_STOCK_OUT_INVALID_COMMAND', 'warehouseSkuId is required', lineIndex);
    }

    if (!hasText(line.warehouseBinId)) {
      return failure('WAREHOUSE_STOCK_OUT_INVALID_COMMAND', 'warehouseBinId is required', lineIndex);
    }

    if (!hasText(line.itemId)) {
      return failure(
        'WAREHOUSE_STOCK_OUT_CANONICAL_SKU_MISSING',
        'canonical itemId is required before stock out',
        lineIndex
      );
    }

    if (!hasText(line.locationId)) {
      return failure(
        'WAREHOUSE_STOCK_OUT_LOCATION_MISSING',
        'canonical locationId is required before stock out',
        lineIndex
      );
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return failure(
        'WAREHOUSE_STOCK_OUT_INVALID_QUANTITY',
        'quantity must be a positive finite number',
        lineIndex
      );
    }

    if (!isWarehouseStockOutReason(line.reason)) {
      return failure(
        'WAREHOUSE_STOCK_OUT_INVALID_REASON',
        'stock out reason is not supported',
        lineIndex
      );
    }

    if (line.serialNumbers && line.serialNumbers.length > 0 && !hasText(line.lotNumber)) {
      return failure(
        'WAREHOUSE_STOCK_OUT_SERIAL_REQUIRES_LOT',
        'serial numbers require lot number',
        lineIndex
      );
    }

    return null;
  }

  private toStockOutMutation(
    command: WarehouseStockOutCommand,
    line: WarehouseStockOutLineCommand
  ): CanonicalStockOutMutation {
    return {
      tenant_id: command.tenantId,
      item_id: line.itemId,
      location_id: line.locationId,
      quantity: line.quantity,
      reason: line.reason,
      actor_id: command.actorId,
      reference_id: command.issueDocument.id,
      metadata: {
        warehouse_sku_id: line.warehouseSkuId,
        warehouse_bin_id: line.warehouseBinId,
        source_line_id: line.sourceLineId,
        issue_document_type: command.issueDocument.type,
        issue_document_number: command.issueDocument.number,
        production_order_id: command.productionConsumptionReference?.productionOrderId,
        production_order_line_id: command.productionConsumptionReference?.productionOrderLineId,
        production_consumption_idempotency_key: command.productionConsumptionReference?.idempotencyKey,
        stock_out_idempotency_key: command.idempotencyKey,
        unit_of_measure: line.unitOfMeasure,
        lot_number: line.lotNumber,
        serial_numbers: line.serialNumbers,
        notes: line.notes,
        ...line.metadata,
      },
    };
  }

  private toInventoryIssuedEvent(params: {
    command: WarehouseStockOutCommand;
    line: WarehouseStockOutLineCommand;
    balanceBefore: InventoryBalance;
    balanceAfter: InventoryBalance;
    occurredAt: Date;
    movementId: string;
  }): InventoryIssuedEvent {
    const { command, line, balanceBefore, balanceAfter, occurredAt, movementId } = params;

    return {
      metadata: {
        event_id: this.idFactory(),
        event_type: 'InventoryIssuedEvent',
        tenant_id: command.tenantId,
        occurred_at: occurredAt,
        actor_id: command.actorId,
        correlation_id: command.correlationId,
        causation_id: movementId,
      },
      item_id: line.itemId,
      from_location_id: line.locationId,
      quantity: line.quantity,
      reason: line.reason,
      lot_number: line.lotNumber,
      serial_numbers: line.serialNumbers,
      reference_id: command.productionConsumptionReference?.productionOrderId ?? command.issueDocument.id,
      reference_type: readInventoryIssuedReferenceType(command),
      financial: this.toFinancialContext(command, line, balanceBefore, balanceAfter),
    };
  }

  private toFinancialContext(
    command: WarehouseStockOutCommand,
    line: WarehouseStockOutLineCommand,
    balanceBefore: InventoryBalance,
    balanceAfter: InventoryBalance
  ): FinancialContext {
    const unitCost = line.unitCost;

    return {
      unit_cost: unitCost,
      transaction_value: unitCost === undefined ? undefined : unitCost * line.quantity,
      currency: line.currency ?? 'VND',
      valuation_method: line.valuationMethod ?? ValuationMethod.WEIGHTED_AVERAGE,
      financial_posting_status: 'not_posted',
      metadata: {
        balance_before: balanceBefore.on_hand,
        balance_after: balanceAfter.on_hand,
        finance_os_posting_required: true,
        source: 'warehouse_stock_out',
        issue_document_type: command.issueDocument.type,
        source_line_id: line.sourceLineId,
        production_order_id: command.productionConsumptionReference?.productionOrderId,
        production_order_line_id: command.productionConsumptionReference?.productionOrderLineId,
      },
    };
  }
}

class WarehouseStockOutKnownFailure extends Error {
  constructor(readonly result: WarehouseStockOutResult) {
    super(result.ok ? 'Unexpected successful stock-out result' : result.error.message);
    this.name = 'WarehouseStockOutKnownFailure';
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isWarehouseStockOutReason(value: string): value is WarehouseStockOutReason {
  return (
    value === 'disposal' ||
    value === 'damage' ||
    value === 'loss' ||
    value === 'sale' ||
    value === 'production_consumption'
  );
}

function readStockOutIdempotencyKey(command: WarehouseStockOutCommand): string | undefined {
  return command.productionConsumptionReference?.idempotencyKey ?? command.idempotencyKey;
}

function readStockOutIdempotencyOperation(command: WarehouseStockOutCommand): string {
  return command.issueDocument.type === 'sales_order'
    ? 'warehouse_stock_out.sales_order'
    : 'warehouse_stock_out.production_consumption';
}

function readInventoryIssuedReferenceType(
  command: WarehouseStockOutCommand
): InventoryIssuedEvent['reference_type'] {
  if (command.issueDocument.type === 'production_consumption') return 'work_order';
  if (command.issueDocument.type === 'sales_order') return 'sales_order';
  return undefined;
}

function failure(
  code: WarehouseStockOutErrorCode,
  message: string,
  lineIndex?: number
): WarehouseStockOutResult {
  return {
    ok: false,
    error: {
      code,
      message,
      lineIndex,
    },
  };
}

function stablePayloadHash(payload: unknown): string {
  return JSON.stringify(sortValue(payload));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(input[key]);
        return acc;
      }, {});
  }
  return value;
}
