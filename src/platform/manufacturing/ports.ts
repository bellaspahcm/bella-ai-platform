import type { IInventoryBalanceQuery, LocationId, Quantity } from '../logistics/contracts/inventory.contract';
import type {
  WarehouseStockInCommand,
  WarehouseStockInPorts,
  WarehouseStockInResult,
} from '../logistics/warehouse/stock-in-canonical.facade';
import type {
  WarehouseStockOutCommand,
  WarehouseStockOutPorts,
  WarehouseStockOutResult,
} from '../logistics/warehouse/stock-out-canonical.facade';
import type {
  BOMRevision,
  CommandLogEntry,
  FactoryOrgUnitId,
  FinishedGoodsReceiptEvidence,
  FinishedGoodsReceiptLogisticsEvidence,
  ManufacturingActor,
  ManufacturingId,
  ManufacturingPermission,
  MaterialIssueLogisticsEvidence,
  MaterialRequirement,
  ProductionPlan,
  ProductionPlanScheduleSlot,
  ProductionOperationProgress,
  ProductionCompletion,
  ProductionExecution,
  ProductionOrder,
  ProductionOrderLine,
  QualityDispositionEvidence,
  RoutingRevision,
  TenantId,
  WorkCenter,
} from './domain/types';

export interface ManufacturingAuthorizationPort {
  ensureAllowed(params: {
    actor: ManufacturingActor;
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    permission: ManufacturingPermission;
  }): Promise<void>;
}

export interface ManufacturingRepository {
  withTransaction<T>(callback: (repository: ManufacturingRepository) => Promise<T>): Promise<T>;
  saveProductionOrder(order: ProductionOrder): Promise<void>;
  getProductionOrder(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOrder | null>;
  listProductionOrders(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    limit?: number;
  }): Promise<ProductionOrder[]>;
  findProductionOrderByNumber(tenantId: TenantId, orderNumber: string): Promise<ProductionOrder | null>;
  getProductionOrderLine(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    productionOrderLineId: ManufacturingId;
  }): Promise<ProductionOrderLine | null>;
  saveProductionPlan(plan: ProductionPlan): Promise<void>;
  getProductionPlan(tenantId: TenantId, id: ManufacturingId): Promise<ProductionPlan | null>;
  listProductionPlans(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    limit?: number;
  }): Promise<ProductionPlan[]>;
  findProductionPlanByNumber(tenantId: TenantId, planNumber: string): Promise<ProductionPlan | null>;
  saveProductionPlanScheduleSlots(params: {
    productionPlanId: ManufacturingId;
    slots: ProductionPlanScheduleSlot[];
  }): Promise<void>;
  getProductionPlanScheduleSlots(params: {
    tenantId: TenantId;
    productionPlanId: ManufacturingId;
  }): Promise<ProductionPlanScheduleSlot[]>;
  listProductionPlanScheduleSlots(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    limit?: number;
  }): Promise<ProductionPlanScheduleSlot[]>;
  findProductionPlanScheduleConflict(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    workCenterId: ManufacturingId;
    plannedDate: string;
    shiftCode: string;
    excludeProductionPlanId?: ManufacturingId;
  }): Promise<ProductionPlanScheduleSlot | null>;
  saveWorkCenter(workCenter: WorkCenter): Promise<void>;
  getWorkCenter(tenantId: TenantId, id: ManufacturingId): Promise<WorkCenter | null>;
  listWorkCenters(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
  }): Promise<WorkCenter[]>;
  findWorkCenterByCode(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    code: string;
  }): Promise<WorkCenter | null>;
  saveRoutingRevision(revision: RoutingRevision): Promise<void>;
  getRoutingRevision(tenantId: TenantId, id: ManufacturingId): Promise<RoutingRevision | null>;
  listRoutingRevisions(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
  }): Promise<RoutingRevision[]>;
  findRoutingRevisionByCode(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<RoutingRevision | null>;
  saveOperationProgress(progress: ProductionOperationProgress): Promise<void>;
  getOperationProgressById(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOperationProgress | null>;
  getOperationProgress(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<ProductionOperationProgress[]>;
  saveBOMRevision(revision: BOMRevision): Promise<void>;
  getBOMRevision(tenantId: TenantId, id: ManufacturingId): Promise<BOMRevision | null>;
  listBOMRevisions(params: {
    tenantId: TenantId;
  }): Promise<BOMRevision[]>;
  findBOMRevisionByCode(params: {
    tenantId: TenantId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<BOMRevision | null>;
  saveMaterialRequirements(requirements: MaterialRequirement[]): Promise<void>;
  getMaterialRequirements(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    bomRevisionId: ManufacturingId;
  }): Promise<MaterialRequirement[]>;
  saveProductionExecution(execution: ProductionExecution): Promise<void>;
  getProductionExecutions(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<ProductionExecution[]>;
  findProductionExecutionsByMaterialLot(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    itemId?: string;
    lotNumber?: string;
    serialNumber?: string;
  }): Promise<ProductionExecution[]>;
  saveQualityDisposition(evidence: QualityDispositionEvidence): Promise<void>;
  getQualityDispositions(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<QualityDispositionEvidence[]>;
  saveProductionCompletion(completion: ProductionCompletion): Promise<void>;
  getProductionCompletion(tenantId: TenantId, productionOrderId: ManufacturingId): Promise<ProductionCompletion | null>;
  findProductionCompletionsByFinishedGoodLot(params: {
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    itemId?: string;
    lotNumber?: string;
    serialNumber?: string;
  }): Promise<ProductionCompletion[]>;
  getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null>;
  saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void>;
}

export interface ManufacturingIdFactory {
  next(prefix: string): ManufacturingId;
}

export interface ManufacturingClock {
  now(): string;
}

export interface MaterialAvailabilityPort {
  getAvailable(params: {
    tenantId: TenantId;
    itemId: string;
    locationId: LocationId;
  }): Promise<Quantity>;
}

export interface LogisticsEvidenceBindingPort {
  verifyMaterialIssueEvidence(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    productionOrderLineId: ManufacturingId;
    materialRequirementId?: ManufacturingId;
    evidence: MaterialIssueLogisticsEvidence;
  }): Promise<void>;
  verifyFinishedGoodsReceiptEvidence(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    receipt: FinishedGoodsReceiptEvidence;
  }): Promise<void>;
}

export interface ProductionConsumptionIssueRequest {
  tenantId: TenantId;
  actorId: string;
  correlationId?: string;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  idempotencyKey: string;
  issueDocumentId: string;
  issueDocumentNumber?: string;
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: LocationId;
  quantity: Quantity;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  materialRequirementId?: ManufacturingId;
}

export interface ProductionConsumptionIssuePort {
  issue(request: ProductionConsumptionIssueRequest): Promise<WarehouseStockOutResult>;
}

export interface LogisticsStockOutContract {
  execute(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult>;
}

export interface FinishedGoodsReceiptRequest {
  tenantId: TenantId;
  actorId: string;
  correlationId?: string;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  idempotencyKey: string;
  receiptDocumentId: string;
  receiptDocumentNumber?: string;
  receiptLineId?: ManufacturingId;
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: LocationId;
  acceptedQuantity: Quantity;
  rejectedQuantity?: Quantity;
  pendingQuantity?: Quantity;
  qualityInspectionId?: string;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  unitCost?: number;
  currency?: string;
}

export interface FinishedGoodsReceiptPort {
  receive(request: FinishedGoodsReceiptRequest): Promise<WarehouseStockInResult>;
}

export interface LogisticsStockInContract {
  execute(command: WarehouseStockInCommand): Promise<WarehouseStockInResult>;
}

export class LogisticsMaterialAvailabilityAdapter implements MaterialAvailabilityPort {
  constructor(private readonly inventory: IInventoryBalanceQuery) {}

  getAvailable(params: { tenantId: TenantId; itemId: string; locationId: LocationId }): Promise<Quantity> {
    return this.inventory.getAvailable({
      tenant_id: params.tenantId,
      item_id: params.itemId,
      location_id: params.locationId,
    });
  }
}

export class LogisticsProductionConsumptionIssueAdapter implements ProductionConsumptionIssuePort {
  constructor(private readonly stockOut: LogisticsStockOutContract) {}

  issue(request: ProductionConsumptionIssueRequest): Promise<WarehouseStockOutResult> {
    const command: WarehouseStockOutCommand = {
      tenantId: request.tenantId,
      actorId: request.actorId,
      correlationId: request.correlationId,
      issueDocument: {
        id: request.issueDocumentId,
        number: request.issueDocumentNumber,
        type: 'production_consumption',
      },
      productionConsumptionReference: {
        productionOrderId: request.productionOrderId,
        productionOrderLineId: request.productionOrderLineId,
        idempotencyKey: request.idempotencyKey,
      },
      lines: [
        {
          warehouseSkuId: request.warehouseSkuId,
          warehouseBinId: request.warehouseBinId,
          itemId: request.itemId,
          locationId: request.locationId,
          quantity: request.quantity,
          unitOfMeasure: request.unitOfMeasure,
          reason: 'production_consumption',
          lotNumber: request.lotNumber,
          serialNumbers: request.serialNumbers,
          sourceLineId: request.materialRequirementId,
          metadata: {
            production_order_id: request.productionOrderId,
            production_order_line_id: request.productionOrderLineId,
            material_requirement_id: request.materialRequirementId,
          },
        },
      ],
    };
    return this.stockOut.execute(command);
  }
}

export class LogisticsFinishedGoodsReceiptAdapter implements FinishedGoodsReceiptPort {
  constructor(private readonly stockIn: LogisticsStockInContract) {}

  receive(request: FinishedGoodsReceiptRequest): Promise<WarehouseStockInResult> {
    const command: WarehouseStockInCommand = {
      tenantId: request.tenantId,
      actorId: request.actorId,
      correlationId: request.correlationId,
      sourceDocument: {
        id: request.receiptDocumentId,
        number: request.receiptDocumentNumber,
        type: 'production_order',
      },
      productionOutputReference: {
        productionOrderId: request.productionOrderId,
        productionOrderLineId: request.productionOrderLineId,
        receiptLineId: request.receiptLineId,
        idempotencyKey: request.idempotencyKey,
      },
      lines: [
        {
          warehouseSkuId: request.warehouseSkuId,
          warehouseBinId: request.warehouseBinId,
          itemId: request.itemId,
          locationId: request.locationId,
          quantity: request.acceptedQuantity,
          unitOfMeasure: request.unitOfMeasure,
          lotNumber: request.lotNumber,
          serialNumbers: request.serialNumbers,
          sourceLineId: request.receiptLineId,
          unitCost: request.unitCost,
          currency: request.currency,
          qualityDisposition: {
            acceptedQuantity: request.acceptedQuantity,
            rejectedQuantity: request.rejectedQuantity,
            pendingQuantity: request.pendingQuantity,
            qualityInspectionId: request.qualityInspectionId,
          },
          metadata: {
            production_order_id: request.productionOrderId,
            production_order_line_id: request.productionOrderLineId,
            production_receipt_line_id: request.receiptLineId,
            quality_inspection_id: request.qualityInspectionId,
          },
        },
      ],
    };
    return this.stockIn.execute(command);
  }
}

export class LogisticsEvidenceBindingAdapter implements LogisticsEvidenceBindingPort {
  constructor(
    private readonly stockOut: Pick<WarehouseStockOutPorts, 'readBack' | 'transaction'>,
    private readonly stockIn: Pick<WarehouseStockInPorts, 'readBack' | 'transaction'>
  ) {}

  async verifyMaterialIssueEvidence(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    productionOrderLineId: ManufacturingId;
    materialRequirementId?: ManufacturingId;
    evidence: MaterialIssueLogisticsEvidence;
  }): Promise<void> {
    const evidence = params.evidence;
    const readBack = await this.runStockOutReadBack({
      tenant_id: params.tenantId,
      item_id: evidence.itemId,
      location_id: evidence.locationId,
      movement_id: evidence.movementId,
      traceability_event_id: evidence.traceabilityEventId,
    });

    const custodyEvent = readCustodyEvents(readBack.traceability.metadata).find((event) => {
      const metadata = readRecord(event.metadata);
      return event.transaction_id === evidence.movementId &&
        metadata.production_order_id === params.productionOrderId &&
        metadata.production_order_line_id === params.productionOrderLineId;
    });
    assertEvidence(
      readBack.movement.tenant_id === params.tenantId &&
        readBack.traceability.tenant_id === params.tenantId,
      'Material issue evidence tenant does not match Manufacturing tenant'
    );
    assertEvidence(
      readBack.movement.id === evidence.movementId &&
        readBack.traceability.transaction_id === evidence.movementId,
      'Material issue evidence movement does not match Logistics read-back'
    );
    assertEvidence(
      readBack.movement.reason === 'production_consumption' &&
        readBack.traceability.reason === 'production_consumption',
      'Material issue evidence movement is not a production consumption stock-out'
    );
    assertEvidence(
      readBack.movement.item_id === evidence.itemId &&
        readBack.traceability.item_id === evidence.itemId &&
        readBack.movement.location_id === evidence.locationId &&
        readBack.traceability.from_location_id === evidence.locationId,
      'Material issue evidence item or location does not match Logistics read-back'
    );
    assertEvidence(
      sameQuantity(readBack.movement.quantity, evidence.quantity) &&
        sameQuantity(readBack.traceability.quantity, evidence.quantity),
      'Material issue evidence quantity does not match Logistics read-back'
    );
    assertOptionalTraceability(evidence.lotNumber, readBack.traceability.lot_number, 'Material issue evidence lot');
    assertOptionalSerials(
      evidence.serialNumbers,
      readBack.traceability.serial_numbers,
      'Material issue evidence serials'
    );
    assertEvidence(Boolean(custodyEvent), 'Material issue evidence document is not a production consumption stock-out');
    const metadata = readRecord(custodyEvent?.metadata);
    assertEvidence(
      metadata.production_order_id === params.productionOrderId &&
        metadata.production_order_line_id === params.productionOrderLineId,
      'Material issue evidence production reference does not match Manufacturing order'
    );
    if (params.materialRequirementId !== undefined) {
      assertEvidence(
        metadata.material_requirement_id === params.materialRequirementId,
        'Material issue evidence material requirement does not match Manufacturing requirement'
      );
    }
  }

  async verifyFinishedGoodsReceiptEvidence(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    receipt: FinishedGoodsReceiptEvidence;
  }): Promise<void> {
    const evidence: FinishedGoodsReceiptLogisticsEvidence = params.receipt.logisticsEvidence;
    const readBack = await this.runStockInReadBack({
      tenant_id: params.tenantId,
      item_id: evidence.itemId,
      location_id: evidence.locationId,
      movement_id: evidence.movementId,
      traceability_event_id: evidence.traceabilityEventId,
    });

    const custodyEvent = readCustodyEvents(readBack.traceability.metadata).find((event) => {
      const metadata = readRecord(event.metadata);
      return event.transaction_id === evidence.movementId &&
        metadata.production_order_id === params.productionOrderId &&
        metadata.production_order_line_id === params.receipt.productionOrderLineId &&
        metadata.production_receipt_line_id === params.receipt.receiptLineId;
    });
    const metadata = readRecord(custodyEvent?.metadata);
    const qualityDisposition = readRecord(metadata.quality_disposition);
    assertEvidence(
      readBack.movement.tenant_id === params.tenantId &&
        readBack.traceability.tenant_id === params.tenantId,
      'Finished goods receipt evidence tenant does not match Manufacturing tenant'
    );
    assertEvidence(
      readBack.movement.id === evidence.movementId &&
        readBack.traceability.transaction_id === evidence.movementId,
      'Finished goods receipt evidence movement does not match Logistics read-back'
    );
    assertEvidence(
      readBack.movement.reason === 'receipt' &&
        readBack.traceability.reason === 'receipt',
      'Finished goods receipt evidence movement is not a stock-in receipt'
    );
    assertEvidence(
      readBack.movement.item_id === evidence.itemId &&
        readBack.traceability.item_id === evidence.itemId &&
        readBack.movement.location_id === evidence.locationId &&
        readBack.traceability.to_location_id === evidence.locationId,
      'Finished goods receipt evidence item or location does not match Logistics read-back'
    );
    assertEvidence(
      sameQuantity(readBack.movement.quantity, evidence.quantity) &&
        sameQuantity(readBack.traceability.quantity, evidence.quantity),
      'Finished goods receipt evidence quantity does not match Logistics read-back'
    );
    assertOptionalTraceability(evidence.lotNumber, readBack.traceability.lot_number, 'Finished goods receipt lot');
    assertOptionalSerials(
      evidence.serialNumbers,
      readBack.traceability.serial_numbers,
      'Finished goods receipt serials'
    );
    assertEvidence(Boolean(custodyEvent), 'Finished goods receipt evidence document is not a production order stock-in');
    assertEvidence(
      metadata.production_order_id === params.productionOrderId &&
        metadata.production_order_line_id === params.receipt.productionOrderLineId &&
        metadata.production_receipt_line_id === params.receipt.receiptLineId,
      'Finished goods receipt evidence production reference does not match Manufacturing order'
    );
    assertEvidence(
      sameQuantity(evidence.quantity, params.receipt.acceptedQuantity) &&
        sameQuantity(evidence.acceptedQuantity, params.receipt.acceptedQuantity) &&
        sameQuantity(evidence.rejectedQuantity ?? 0, params.receipt.rejectedQuantity ?? 0) &&
        sameQuantity(evidence.pendingQuantity ?? 0, params.receipt.pendingQuantity ?? 0),
      'Finished goods receipt evidence quantities do not match Manufacturing receipt evidence'
    );
    assertEvidence(
      sameQuantity(readNumber(qualityDisposition.acceptedQuantity), params.receipt.acceptedQuantity) &&
        sameQuantity(readNumber(qualityDisposition.rejectedQuantity), params.receipt.rejectedQuantity ?? 0) &&
        sameQuantity(readNumber(qualityDisposition.pendingQuantity), params.receipt.pendingQuantity ?? 0),
      'Finished goods receipt QC disposition does not match Logistics read-back'
    );
  }

  private runStockOutReadBack(
    params: Parameters<WarehouseStockOutPorts['readBack']['getStockOutEvidence']>[0]
  ): ReturnType<WarehouseStockOutPorts['readBack']['getStockOutEvidence']> {
    if (!this.stockOut.transaction) {
      return this.stockOut.readBack.getStockOutEvidence(params);
    }
    return this.stockOut.transaction.run(() => this.stockOut.readBack.getStockOutEvidence(params));
  }

  private runStockInReadBack(
    params: Parameters<WarehouseStockInPorts['readBack']['getStockInEvidence']>[0]
  ): ReturnType<WarehouseStockInPorts['readBack']['getStockInEvidence']> {
    if (!this.stockIn.transaction) {
      return this.stockIn.readBack.getStockInEvidence(params);
    }
    return this.stockIn.transaction.run(() => this.stockIn.readBack.getStockInEvidence(params));
  }
}

function assertEvidence(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function sameQuantity(left: number, right: number): boolean {
  return Math.round(left * 1_000_000) / 1_000_000 === Math.round(right * 1_000_000) / 1_000_000;
}

function assertOptionalTraceability(expected: string | undefined, actual: string | undefined, label: string): void {
  if (expected !== undefined) {
    assertEvidence(actual === expected, `${label} does not match Logistics read-back`);
  }
}

function assertOptionalSerials(
  expected: string[] | undefined,
  actual: string[] | undefined,
  label: string
): void {
  if (expected === undefined) return;
  const actualSet = new Set(actual ?? []);
  assertEvidence(
    expected.every((serial) => actualSet.has(serial)),
    `${label} do not match Logistics read-back`
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readCustodyEvents(metadata: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  const events = metadata?.custody_events;
  if (!Array.isArray(events)) return [];
  return events.filter((event): event is Record<string, unknown> => {
    return typeof event === 'object' && event !== null && !Array.isArray(event);
  });
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
