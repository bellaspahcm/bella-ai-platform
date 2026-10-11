import {
  FixedManufacturingClock,
  InMemoryManufacturingRepository,
  LogisticsMaterialAvailabilityAdapter,
  ManufacturingAuthorizationError,
  ManufacturingIdempotencyConflictError,
  ManufacturingSlice1Service,
  ManufacturingStateError,
  ManufacturingValidationError,
  SequentialManufacturingIdFactory,
  StaticManufacturingAuthorization,
  type FinishedGoodsReceiptEvidence,
  type LogisticsEvidenceBindingPort,
  type ManufacturingActor,
  type MaterialIssueLogisticsEvidence,
  type MaterialAvailabilityPort,
} from '..';
import type { IInventoryBalanceQuery } from '../../logistics/contracts/inventory.contract';

function createActor(overrides: Partial<ManufacturingActor> = {}): ManufacturingActor {
  return {
    tenantId: 'tenant-a',
    userId: 'planner-1',
    roles: ['manufacturing_planner'],
    factoryOrgUnitId: 'factory-branch-a',
    ...overrides,
  };
}

function createAvailability(availableByItem: Record<string, number>): MaterialAvailabilityPort & {
  calls: Array<{ tenantId: string; itemId: string; locationId: string }>;
} {
  return {
    calls: [],
    async getAvailable(params) {
      this.calls.push(params);
      return availableByItem[params.itemId] ?? 0;
    },
  };
}

function createService(availability: MaterialAvailabilityPort = createAvailability({ component_a: 100 })) {
  const repository = new InMemoryManufacturingRepository();
  const authorization = new StaticManufacturingAuthorization(
    { 'planner-1': 'factory-branch-a' },
    {
      'planner-1': [
        'manufacturing:operational_read:read',
        'manufacturing:production_order:write',
        'manufacturing:production_order:release',
        'manufacturing:production_order:complete',
        'manufacturing:bom:write',
        'manufacturing:bom:approve',
        'manufacturing:material_requirement:calculate',
        'manufacturing:availability:read',
        'manufacturing:execution:record',
        'manufacturing:quality_disposition:record',
        'manufacturing:work_center:write',
        'manufacturing:routing:write',
        'manufacturing:routing:approve',
        'manufacturing:routing:apply',
        'manufacturing:operation_progress:update',
        'manufacturing:genealogy:read',
      ],
    }
  );
  const service = new ManufacturingSlice1Service(
    repository,
    authorization,
    availability,
    createEvidenceBindingPort(),
    new SequentialManufacturingIdFactory(),
    new FixedManufacturingClock()
  );
  return { service, repository };
}

function createEvidenceBindingPort(): LogisticsEvidenceBindingPort {
  return {
    async verifyMaterialIssueEvidence(params) {
      if (
        params.evidence.productionOrderId !== params.productionOrderId ||
        params.evidence.productionOrderLineId !== params.productionOrderLineId
      ) {
        throw new Error('Material issue evidence mismatch');
      }
      if (
        params.materialRequirementId !== undefined &&
        params.evidence.materialRequirementId !== params.materialRequirementId
      ) {
        throw new Error('Material requirement evidence mismatch');
      }
    },
    async verifyFinishedGoodsReceiptEvidence(params) {
      const evidence = params.receipt.logisticsEvidence;
      if (
        evidence.productionOrderId !== params.productionOrderId ||
        evidence.productionOrderLineId !== params.receipt.productionOrderLineId ||
        evidence.receiptDocumentId !== params.receipt.receiptDocumentId ||
        evidence.receiptLineId !== params.receipt.receiptLineId
      ) {
        throw new Error('Finished goods receipt evidence mismatch');
      }
    },
  };
}

function materialIssueEvidence(params: {
  productionOrderId: string;
  productionOrderLineId: string;
  issueDocumentId: string;
  movementId: string;
  materialRequirementId?: string;
  quantity?: number;
  lotNumber?: string;
  serialNumbers?: string[];
}): MaterialIssueLogisticsEvidence {
  return {
    issueDocumentId: params.issueDocumentId,
    movementId: params.movementId,
    traceabilityEventId: `${params.movementId}-trace`,
    itemId: 'component_a',
    locationId: 'warehouse-bin-a',
    quantity: params.quantity ?? 20,
    lotNumber: params.lotNumber ?? 'raw-lot-1',
    serialNumbers: params.serialNumbers,
    productionOrderId: params.productionOrderId,
    productionOrderLineId: params.productionOrderLineId,
    materialRequirementId: params.materialRequirementId,
  };
}

function receiptEvidence(params: {
  productionOrderId: string;
  productionOrderLineId: string;
  receiptDocumentId: string;
  receiptLineId: string;
  acceptedQuantity: number;
  rejectedQuantity?: number;
  pendingQuantity?: number;
  lotNumber?: string;
  serialNumbers?: string[];
}): FinishedGoodsReceiptEvidence {
  return {
    productionOrderLineId: params.productionOrderLineId,
    receiptDocumentId: params.receiptDocumentId,
    receiptLineId: params.receiptLineId,
    lotNumber: params.lotNumber ?? 'fg-lot-1',
    serialNumbers: params.serialNumbers,
    acceptedQuantity: params.acceptedQuantity,
    rejectedQuantity: params.rejectedQuantity,
    pendingQuantity: params.pendingQuantity,
    logisticsEvidence: {
      receiptDocumentId: params.receiptDocumentId,
      receiptLineId: params.receiptLineId,
      movementId: `${params.receiptLineId}-movement`,
      traceabilityEventId: `${params.receiptLineId}-trace`,
      itemId: 'finished_good_a',
      locationId: 'finished-goods-warehouse',
      quantity: params.acceptedQuantity,
      lotNumber: params.lotNumber ?? 'fg-lot-1',
      serialNumbers: params.serialNumbers,
      productionOrderId: params.productionOrderId,
      productionOrderLineId: params.productionOrderLineId,
      acceptedQuantity: params.acceptedQuantity,
      rejectedQuantity: params.rejectedQuantity,
      pendingQuantity: params.pendingQuantity,
    },
  };
}

async function createApprovedBomAndOrder(
  service: ManufacturingSlice1Service,
  actor: ManufacturingActor,
  options: { targetQuantity?: number; componentQuantity?: number; availableLocation?: string } = {}
) {
  const order = await service.createProductionOrder(actor, {
    idempotencyKey: 'create-po-1',
    orderNumber: 'PO-001',
    finishedGoodItemId: 'finished_good_a',
    targetQuantity: options.targetQuantity ?? 10,
    uom: 'EA',
  });
  const bom = await service.createBOMRevision(actor, {
    idempotencyKey: 'create-bom-1',
    finishedGoodItemId: 'finished_good_a',
    revisionCode: 'REV-1',
    components: [
      {
        componentItemId: 'component_a',
        quantityPerUnit: options.componentQuantity ?? 2,
        uom: 'EA',
      },
    ],
  });
  const approvedBom = await service.approveBOMRevision(actor, {
    idempotencyKey: 'approve-bom-1',
    bomRevisionId: bom.value.id,
  });
  return { order: order.value, bom: approvedBom.value };
}

async function createApprovedRouting(
  service: ManufacturingSlice1Service,
  actor: ManufacturingActor,
  suffix: string,
  finishedGoodItemId = 'finished_good_a'
) {
  const workCenter = await service.createWorkCenter(actor, {
    idempotencyKey: `create-wc-${suffix}`,
    code: `WC-${suffix}`,
    name: `Work Center ${suffix}`,
  });
  const routing = await service.createRoutingRevision(actor, {
    idempotencyKey: `create-route-${suffix}`,
    finishedGoodItemId,
    revisionCode: `ROUTE-${suffix}`,
    operations: [
      {
        sequence: 10,
        operationCode: `OP-${suffix}`,
        operationName: `Operation ${suffix}`,
        workCenterId: workCenter.value.id,
      },
    ],
  });
  const approved = await service.approveRoutingRevision(actor, {
    idempotencyKey: `approve-route-${suffix}`,
    routingRevisionId: routing.value.id,
  });
  return { workCenter: workCenter.value, routing: approved.value };
}

describe('Manufacturing Slice 1', () => {
  it('creates a production order, calculates requirements from an approved BOM, and releases only after availability is proven', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-1',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });

    expect(requirements.value).toHaveLength(1);
    expect(requirements.value[0]).toMatchObject({
      tenantId: 'tenant-a',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      componentItemId: 'component_a',
      requiredQuantity: 20,
      availableQuantity: 25,
      status: 'available',
    });
    expect(availability.calls).toEqual([
      { tenantId: 'tenant-a', itemId: 'component_a', locationId: 'warehouse-bin-a' },
    ]);

    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-1',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });

    expect(released.value.status).toBe('released');
    expect(released.value.bomRevisionId).toBe(bom.id);
  });

  it('blocks invalid production order release before material requirements are calculated', async () => {
    const { service } = createService();
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    await expect(
      service.releaseProductionOrder(actor, {
        idempotencyKey: 'release-before-requirements',
        productionOrderId: order.id,
        bomRevisionId: bom.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('marks material shortage and blocks release when Logistics availability is insufficient', async () => {
    const availability = createAvailability({ component_a: 5 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-shortage',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });

    expect(requirements.value[0].status).toBe('shortage');
    await expect(
      service.releaseProductionOrder(actor, {
        idempotencyKey: 'release-shortage',
        productionOrderId: order.id,
        bomRevisionId: bom.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('enforces tenant and factory authorization before Manufacturing mutation', async () => {
    const { service } = createService();
    const actor = createActor({ factoryOrgUnitId: 'factory-branch-b' });

    await expect(
      service.createProductionOrder(actor, {
        idempotencyKey: 'unauthorized-create',
        orderNumber: 'PO-UNAUTHORIZED',
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 1,
        uom: 'EA',
      })
    ).rejects.toThrow(ManufacturingAuthorizationError);
  });

  it('returns the original result for duplicate commands with the same payload', async () => {
    const { service } = createService();
    const actor = createActor();
    const command = {
      idempotencyKey: 'duplicate-create',
      orderNumber: 'PO-DUP',
      finishedGoodItemId: 'finished_good_a',
      targetQuantity: 10,
      uom: 'EA',
    };

    const first = await service.createProductionOrder(actor, command);
    const second = await service.createProductionOrder(actor, command);

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.value.id).toBe(first.value.id);
  });

  it('rejects duplicate command keys with conflicting payloads', async () => {
    const { service } = createService();
    const actor = createActor();
    await service.createProductionOrder(actor, {
      idempotencyKey: 'conflict-create',
      orderNumber: 'PO-CONFLICT',
      finishedGoodItemId: 'finished_good_a',
      targetQuantity: 10,
      uom: 'EA',
    });

    await expect(
      service.createProductionOrder(actor, {
        idempotencyKey: 'conflict-create',
        orderNumber: 'PO-CONFLICT-CHANGED',
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 10,
        uom: 'EA',
      })
    ).rejects.toThrow(ManufacturingIdempotencyConflictError);
  });

  it('reads material availability through the Logistics inventory balance contract', async () => {
    const calls: Array<{ tenant_id: string; item_id: string; location_id: string }> = [];
    const inventory: IInventoryBalanceQuery = {
      async getAvailable(params) {
        calls.push(params);
        return 42;
      },
      async getOnHand() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalance() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalancesByItem() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalancesByLocation() {
        throw new Error('not used by Manufacturing Slice 1');
      },
    };

    const adapter = new LogisticsMaterialAvailabilityAdapter(inventory);
    const available = await adapter.getAvailable({
      tenantId: 'tenant-a',
      itemId: 'component_a',
      locationId: 'warehouse-bin-a',
    });

    expect(available).toBe(42);
    expect(calls).toEqual([
      {
        tenant_id: 'tenant-a',
        item_id: 'component_a',
        location_id: 'warehouse-bin-a',
      },
    ]);
  });

  it('keeps approved BOM revisions immutable for Slice 1 approval flow', async () => {
    const { service } = createService();
    const actor = createActor();
    const bom = await service.createBOMRevision(actor, {
      idempotencyKey: 'create-bom-immutable',
      finishedGoodItemId: 'finished_good_a',
      revisionCode: 'REV-IMMUTABLE',
      components: [{ componentItemId: 'component_a', quantityPerUnit: 1, uom: 'EA' }],
    });

    await service.approveBOMRevision(actor, {
      idempotencyKey: 'approve-bom-immutable',
      bomRevisionId: bom.value.id,
    });

    await expect(
      service.approveBOMRevision(actor, {
        idempotencyKey: 'approve-bom-again',
        bomRevisionId: bom.value.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('records production execution from material issue evidence and completes only after FGR reconciliation', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service, repository } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-execution',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-execution',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;

    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-execution-1',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-1',
      materialIssueMovementId: 'issue-movement-1',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-1',
        movementId: 'issue-movement-1',
      }),
      actualQuantity: 10,
      acceptedQuantity: 8,
      rejectedQuantity: 1,
      scrapQuantity: 1,
      uom: 'EA',
    });

    expect(execution.value).toMatchObject({
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-1',
      materialIssueMovementId: 'issue-movement-1',
      actualQuantity: 10,
      acceptedQuantity: 8,
      rejectedQuantity: 1,
      scrapQuantity: 1,
    });
    await expect(repository.getProductionOrder(actor.tenantId, order.id)).resolves.toMatchObject({
      status: 'in_progress',
    });

    await service.recordQualityDisposition(actor, {
      idempotencyKey: 'quality-reject-1',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'rejected',
      disposition: 'discard_reject',
      quantity: 1,
      acceptedOutputQuantity: 0,
      reasonCode: 'FAILED_INSPECTION',
      evidenceReference: 'qc-report-1',
      finalHandlingDecision: true,
    });
    await service.recordQualityDisposition(actor, {
      idempotencyKey: 'quality-scrap-1',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'scrap',
      disposition: 'scrap',
      quantity: 1,
      acceptedOutputQuantity: 0,
      reasonCode: 'DAMAGED_OUTPUT',
      evidenceReference: 'qc-photo-1',
    });

    const completion = await service.completeProductionOrder(actor, {
      idempotencyKey: 'complete-po-1',
      productionOrderId: order.id,
      receiptEvidence: [receiptEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        receiptDocumentId: 'fgr-1',
        receiptLineId: 'fgr-line-1',
        acceptedQuantity: 8,
        rejectedQuantity: 1,
        pendingQuantity: 0,
      })],
    });

    expect(completion.value).toMatchObject({
      productionOrderId: order.id,
      completedQuantity: 8,
      rejectedQuantity: 1,
      scrapQuantity: 1,
      qualityDispositionEvidence: expect.arrayContaining([
        expect.objectContaining({ disposition: 'discard_reject', terminal: true }),
        expect.objectContaining({ disposition: 'scrap', terminal: true }),
      ]),
    });
    await expect(repository.getProductionOrder(actor.tenantId, order.id)).resolves.toMatchObject({
      status: 'completed',
      completedBy: actor.userId,
    });
  });

  it('traces finished good lots back to material lots and raw lots forward to FGR lots', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-genealogy',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-genealogy',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const [requirement] = requirements.value;
    if (!line || !requirement) throw new Error('Expected order line and material requirement');

    await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-execution-genealogy',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-genealogy',
      materialIssueMovementId: 'issue-movement-genealogy',
      materialRequirementId: requirement.id,
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-genealogy',
        movementId: 'issue-movement-genealogy',
        materialRequirementId: requirement.id,
        lotNumber: 'raw-lot-genealogy',
        quantity: 20,
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });
    await service.completeProductionOrder(actor, {
      idempotencyKey: 'complete-po-genealogy',
      productionOrderId: order.id,
      receiptEvidence: [receiptEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        receiptDocumentId: 'fgr-genealogy',
        receiptLineId: 'fgr-line-genealogy',
        acceptedQuantity: 10,
        lotNumber: 'fg-lot-genealogy',
      })],
    });

    await expect(
      service.traceFinishedGoodLot(actor, {
        finishedGoodItemId: 'finished_good_a',
        lotNumber: 'fg-lot-genealogy',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        materials: [
          expect.objectContaining({
            itemId: 'component_a',
            lotNumber: 'raw-lot-genealogy',
            movementId: 'issue-movement-genealogy',
            materialRequirementId: requirement.id,
          }),
        ],
        finishedGoods: [
          expect.objectContaining({
            itemId: 'finished_good_a',
            lotNumber: 'fg-lot-genealogy',
            receiptDocumentId: 'fgr-genealogy',
            receiptLineId: 'fgr-line-genealogy',
          }),
        ],
      }),
    ]);

    await expect(
      service.traceRawMaterialLot(actor, {
        rawMaterialItemId: 'component_a',
        lotNumber: 'raw-lot-genealogy',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        materials: [
          expect.objectContaining({
            itemId: 'component_a',
            lotNumber: 'raw-lot-genealogy',
          }),
        ],
        finishedGoods: [
          expect.objectContaining({
            itemId: 'finished_good_a',
            lotNumber: 'fg-lot-genealogy',
          }),
        ],
      }),
    ]);
  });

  it('rejects completion when execution and FGR evidence do not reconcile', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-mismatch',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-mismatch',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-execution-mismatch',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-mismatch',
      materialIssueMovementId: 'issue-movement-mismatch',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-mismatch',
        movementId: 'issue-movement-mismatch',
      }),
      actualQuantity: 10,
      acceptedQuantity: 9,
      rejectedQuantity: 1,
      uom: 'EA',
    });
    await service.recordQualityDisposition(actor, {
      idempotencyKey: 'quality-mismatch-reject',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'rejected',
      disposition: 'discard_reject',
      quantity: 1,
      acceptedOutputQuantity: 0,
      reasonCode: 'FAILED_INSPECTION',
      evidenceReference: 'qc-report-mismatch',
      finalHandlingDecision: true,
    });

    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-po-mismatch',
        productionOrderId: order.id,
        receiptEvidence: [receiptEvidence({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          receiptDocumentId: 'fgr-mismatch',
          receiptLineId: 'fgr-line-mismatch',
          acceptedQuantity: 8,
          rejectedQuantity: 1,
          pendingQuantity: 0,
        })],
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('rejects production execution when material issue evidence is not bound to the order line', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-fake-issue',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-fake-issue',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;

    await expect(
      service.recordProductionExecution(actor, {
        idempotencyKey: 'record-fake-issue',
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        materialIssueDocumentId: 'issue-doc-fake',
        materialIssueMovementId: 'issue-movement-fake',
        materialIssueEvidence: materialIssueEvidence({
          productionOrderId: 'other-production-order',
          productionOrderLineId: line.id,
          issueDocumentId: 'issue-doc-fake',
          movementId: 'issue-movement-fake',
        }),
        actualQuantity: 10,
        acceptedQuantity: 10,
        uom: 'EA',
      })
    ).rejects.toThrow();
  });

  it('rejects completion when FGR evidence is not bound to the receipt line', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-fake-fgr',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-fake-fgr',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-fake-fgr',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-fake-fgr',
      materialIssueMovementId: 'issue-movement-fake-fgr',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-fake-fgr',
        movementId: 'issue-movement-fake-fgr',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });

    const fakeReceipt = receiptEvidence({
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      receiptDocumentId: 'fgr-fake',
      receiptLineId: 'fgr-line-fake',
      acceptedQuantity: 10,
    });

    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-fake-fgr',
        productionOrderId: order.id,
        receiptEvidence: [{
          ...fakeReceipt,
          logisticsEvidence: {
            ...fakeReceipt.logisticsEvidence,
            receiptLineId: 'other-fgr-line',
          },
        }],
      })
    ).rejects.toThrow();
  });

  it('blocks completion until rejected and scrap quantities have terminal quality disposition', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-quality-required',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-quality-required',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-quality-required',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-quality-required',
      materialIssueMovementId: 'issue-movement-quality-required',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-quality-required',
        movementId: 'issue-movement-quality-required',
      }),
      actualQuantity: 10,
      acceptedQuantity: 8,
      rejectedQuantity: 1,
      scrapQuantity: 1,
      uom: 'EA',
    });

    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-quality-required',
        productionOrderId: order.id,
        receiptEvidence: [receiptEvidence({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          receiptDocumentId: 'fgr-quality-required',
          receiptLineId: 'fgr-line-quality-required',
          acceptedQuantity: 8,
          rejectedQuantity: 1,
          pendingQuantity: 0,
        })],
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('keeps rework open and prevents production order completion', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-quality-rework',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-quality-rework',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-quality-rework',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-quality-rework',
      materialIssueMovementId: 'issue-movement-quality-rework',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-quality-rework',
        movementId: 'issue-movement-quality-rework',
      }),
      actualQuantity: 10,
      acceptedQuantity: 9,
      rejectedQuantity: 1,
      uom: 'EA',
    });
    await service.recordQualityDisposition(actor, {
      idempotencyKey: 'quality-rework-open',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'rejected',
      disposition: 'rework',
      quantity: 1,
      acceptedOutputQuantity: 0,
    });

    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-quality-rework',
        productionOrderId: order.id,
        receiptEvidence: [receiptEvidence({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          receiptDocumentId: 'fgr-quality-rework',
          receiptLineId: 'fgr-line-quality-rework',
          acceptedQuantity: 9,
          rejectedQuantity: 1,
          pendingQuantity: 0,
        })],
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('allows policy-approved conditional accept to contribute to completed accepted output', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-conditional',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-conditional',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-conditional',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-conditional',
      materialIssueMovementId: 'issue-movement-conditional',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-conditional',
        movementId: 'issue-movement-conditional',
      }),
      actualQuantity: 10,
      acceptedQuantity: 9,
      rejectedQuantity: 1,
      uom: 'EA',
    });
    await service.recordQualityDisposition(actor, {
      idempotencyKey: 'quality-conditional',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'rejected',
      disposition: 'conditional_accept',
      quantity: 1,
      acceptedOutputQuantity: 1,
      evidenceReference: 'quality-manager-approval',
      conditionalAcceptPolicyApproved: true,
    });

    const completion = await service.completeProductionOrder(actor, {
      idempotencyKey: 'complete-conditional',
      productionOrderId: order.id,
      receiptEvidence: [receiptEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        receiptDocumentId: 'fgr-conditional',
        receiptLineId: 'fgr-line-conditional',
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        pendingQuantity: 0,
      })],
    });

    expect(completion.value).toMatchObject({
      completedQuantity: 10,
      rejectedQuantity: 0,
      scrapQuantity: 0,
    });
  });

  it('applies routing to an order line and tracks operation progress through valid transitions', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const { routing, workCenter } = await createApprovedRouting(service, actor, 'A');
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-routing',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-routing',
      materialIssueMovementId: 'issue-movement-routing',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-routing',
        movementId: 'issue-movement-routing',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });

    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-routing',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
    });
    const retry = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-routing',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
    });

    expect(applied.isDuplicate).toBe(false);
    expect(retry.isDuplicate).toBe(true);
    expect(applied.value).toHaveLength(1);
    expect(applied.value[0]).toMatchObject({
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
      routingOperationId: routing.operations[0].id,
      workCenterId: workCenter.id,
      status: 'planned',
    });

    const ready = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-ready',
      operationProgressId: applied.value[0].id,
      status: 'ready',
    });
    const started = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-start',
      operationProgressId: applied.value[0].id,
      status: 'in_progress',
    });
    const completed = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-complete',
      operationProgressId: applied.value[0].id,
      status: 'completed',
      productionExecutionId: execution.value.id,
      completedQuantity: 10,
    });

    expect(ready.value.status).toBe('ready');
    expect(started.value.status).toBe('in_progress');
    expect(started.value.startedAt).toBeDefined();
    expect(completed.value.status).toBe('completed');
    expect(completed.value.productionExecutionId).toBe(execution.value.id);
    expect(completed.value.completedQuantity).toBe(10);
    expect(completed.value.completedAt).toBeDefined();
  });

  it('rejects invalid operation progress transitions and conflicting idempotency payloads', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing-invalid',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing-invalid',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const { routing } = await createApprovedRouting(service, actor, 'B');
    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-routing-invalid',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
    });

    await expect(
      service.updateOperationProgress(actor, {
        idempotencyKey: 'progress-invalid-complete',
        operationProgressId: applied.value[0].id,
        status: 'completed',
        productionExecutionId: 'execution-not-needed-for-transition-check',
        completedQuantity: 10,
      })
    ).rejects.toThrow(ManufacturingStateError);

    const blocked = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-blocked',
      operationProgressId: applied.value[0].id,
      status: 'blocked',
      blockedReason: 'Machine unavailable',
    });
    const retry = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-blocked',
      operationProgressId: applied.value[0].id,
      status: 'blocked',
      blockedReason: 'Machine unavailable',
    });

    expect(blocked.value.status).toBe('blocked');
    expect(retry.isDuplicate).toBe(true);
    await expect(
      service.updateOperationProgress(actor, {
        idempotencyKey: 'progress-blocked',
        operationProgressId: applied.value[0].id,
        status: 'blocked',
        blockedReason: 'Different reason',
      })
    ).rejects.toThrow(ManufacturingIdempotencyConflictError);
  });

  it('replays duplicate quality disposition commands and rejects conflicting payloads', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-quality-idempotent',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-quality-idempotent',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-quality-idempotent',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-quality-idempotent',
      materialIssueMovementId: 'issue-movement-quality-idempotent',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-quality-idempotent',
        movementId: 'issue-movement-quality-idempotent',
      }),
      actualQuantity: 10,
      acceptedQuantity: 9,
      rejectedQuantity: 1,
      uom: 'EA',
    });
    const command = {
      idempotencyKey: 'quality-idempotent',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      productionExecutionId: execution.value.id,
      sourceQuantityType: 'rejected' as const,
      disposition: 'discard_reject' as const,
      quantity: 1,
      acceptedOutputQuantity: 0,
      reasonCode: 'FAILED_INSPECTION',
      evidenceReference: 'qc-report-idempotent',
      finalHandlingDecision: true,
    };

    const first = await service.recordQualityDisposition(actor, command);
    const retry = await service.recordQualityDisposition(actor, command);

    expect(first.isDuplicate).toBe(false);
    expect(retry.isDuplicate).toBe(true);
    expect(retry.value.id).toBe(first.value.id);

    await expect(
      service.recordQualityDisposition(actor, {
        ...command,
        quantity: 0.5,
      })
    ).rejects.toThrow(ManufacturingIdempotencyConflictError);
  });

  it('does not complete an order from FGR evidence alone', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-no-exec',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-no-exec',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;

    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-po-no-exec',
        productionOrderId: order.id,
        receiptEvidence: [receiptEvidence({
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          receiptDocumentId: 'fgr-no-exec',
          receiptLineId: 'fgr-line-no-exec',
          acceptedQuantity: 10,
        })],
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('blocks completion for routed order lines until applied operations are completed', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing-complete',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing-complete',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const { routing } = await createApprovedRouting(service, actor, 'C');
    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-routing-complete',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
    });
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-routing-complete',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-routing-complete',
      materialIssueMovementId: 'issue-movement-routing-complete',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-routing-complete',
        movementId: 'issue-movement-routing-complete',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });

    const receipt = receiptEvidence({
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      receiptDocumentId: 'fgr-routing-complete',
      receiptLineId: 'fgr-line-routing-complete',
      acceptedQuantity: 10,
    });
    await expect(
      service.completeProductionOrder(actor, {
        idempotencyKey: 'complete-routing-incomplete',
        productionOrderId: order.id,
        receiptEvidence: [receipt],
      })
    ).rejects.toThrow(ManufacturingStateError);

    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-routing-ready',
      operationProgressId: applied.value[0].id,
      status: 'ready',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-routing-start',
      operationProgressId: applied.value[0].id,
      status: 'in_progress',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-routing-completed',
      operationProgressId: applied.value[0].id,
      status: 'completed',
      productionExecutionId: execution.value.id,
      completedQuantity: 10,
    });

    const completion = await service.completeProductionOrder(actor, {
      idempotencyKey: 'complete-routing-finished',
      productionOrderId: order.id,
      receiptEvidence: [receipt],
    });
    expect(completion.value.completedQuantity).toBe(10);
  });

  it('requires only mandatory applied routing operations before completion', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing-optional',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing-optional',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const workCenter = await service.createWorkCenter(actor, {
      idempotencyKey: 'create-wc-optional',
      code: 'WC-OPTIONAL',
      name: 'Optional Operation Cell',
    });
    const routing = await service.createRoutingRevision(actor, {
      idempotencyKey: 'create-route-optional',
      finishedGoodItemId: 'finished_good_a',
      revisionCode: 'ROUTE-OPTIONAL',
      operations: [
        {
          sequence: 10,
          operationCode: 'OP-OPTIONAL',
          operationName: 'Optional polish',
          workCenterId: workCenter.value.id,
          required: false,
        },
        {
          sequence: 20,
          operationCode: 'OP-REQUIRED',
          operationName: 'Required assembly',
          workCenterId: workCenter.value.id,
          required: true,
        },
      ],
    });
    const approved = await service.approveRoutingRevision(actor, {
      idempotencyKey: 'approve-route-optional',
      routingRevisionId: routing.value.id,
    });
    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-route-optional',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: approved.value.id,
    });
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-routing-optional',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-routing-optional',
      materialIssueMovementId: 'issue-movement-routing-optional',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-routing-optional',
        movementId: 'issue-movement-routing-optional',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });
    const requiredProgress = applied.value.find((progress) => progress.required);
    if (!requiredProgress) {
      throw new Error('Expected a required operation progress record');
    }
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-optional-required-ready',
      operationProgressId: requiredProgress.id,
      status: 'ready',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-optional-required-start',
      operationProgressId: requiredProgress.id,
      status: 'in_progress',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-optional-required-complete',
      operationProgressId: requiredProgress.id,
      status: 'completed',
      productionExecutionId: execution.value.id,
      completedQuantity: 10,
    });

    const completion = await service.completeProductionOrder(actor, {
      idempotencyKey: 'complete-routing-optional',
      productionOrderId: order.id,
      receiptEvidence: [receiptEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        receiptDocumentId: 'fgr-routing-optional',
        receiptLineId: 'fgr-line-routing-optional',
        acceptedQuantity: 10,
      })],
    });
    expect(completion.value.completedQuantity).toBe(10);
  });

  it('rejects later required operation progress until prior required operations are completed', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing-sequence',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing-sequence',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const workCenter = await service.createWorkCenter(actor, {
      idempotencyKey: 'create-wc-sequence',
      code: 'WC-SEQUENCE',
      name: 'Sequenced Operation Cell',
    });
    const routing = await service.createRoutingRevision(actor, {
      idempotencyKey: 'create-route-sequence',
      finishedGoodItemId: 'finished_good_a',
      revisionCode: 'ROUTE-SEQUENCE',
      operations: [
        {
          sequence: 10,
          operationCode: 'OP-FIRST',
          operationName: 'First operation',
          workCenterId: workCenter.value.id,
        },
        {
          sequence: 20,
          operationCode: 'OP-SECOND',
          operationName: 'Second operation',
          workCenterId: workCenter.value.id,
        },
      ],
    });
    const approved = await service.approveRoutingRevision(actor, {
      idempotencyKey: 'approve-route-sequence',
      routingRevisionId: routing.value.id,
    });
    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-route-sequence',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: approved.value.id,
    });
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-routing-sequence',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-routing-sequence',
      materialIssueMovementId: 'issue-movement-routing-sequence',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-routing-sequence',
        movementId: 'issue-movement-routing-sequence',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });
    const first = applied.value.find((progress) => progress.routingOperationId === approved.value.operations[0].id);
    const second = applied.value.find((progress) => progress.routingOperationId === approved.value.operations[1].id);
    if (!first || !second) throw new Error('Expected two applied routing operations');

    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-second-ready',
      operationProgressId: second.id,
      status: 'ready',
    });
    await expect(
      service.updateOperationProgress(actor, {
        idempotencyKey: 'progress-second-start-too-early',
        operationProgressId: second.id,
        status: 'in_progress',
      })
    ).rejects.toThrow(ManufacturingStateError);

    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-first-ready',
      operationProgressId: first.id,
      status: 'ready',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-first-start',
      operationProgressId: first.id,
      status: 'in_progress',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-first-complete',
      operationProgressId: first.id,
      status: 'completed',
      productionExecutionId: execution.value.id,
      completedQuantity: 10,
    });
    const secondStarted = await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-second-start',
      operationProgressId: second.id,
      status: 'in_progress',
    });

    expect(secondStarted.value.status).toBe('in_progress');
  });

  it('rejects completed operation progress quantity that exceeds execution evidence', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-routing-quantity',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-routing-quantity',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    const [line] = released.value.lines;
    const { routing } = await createApprovedRouting(service, actor, 'QTY');
    const applied = await service.applyRoutingRevision(actor, {
      idempotencyKey: 'apply-routing-quantity',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      routingRevisionId: routing.id,
    });
    const execution = await service.recordProductionExecution(actor, {
      idempotencyKey: 'record-routing-quantity',
      productionOrderId: order.id,
      productionOrderLineId: line.id,
      materialIssueDocumentId: 'issue-doc-routing-quantity',
      materialIssueMovementId: 'issue-movement-routing-quantity',
      materialIssueEvidence: materialIssueEvidence({
        productionOrderId: order.id,
        productionOrderLineId: line.id,
        issueDocumentId: 'issue-doc-routing-quantity',
        movementId: 'issue-movement-routing-quantity',
      }),
      actualQuantity: 10,
      acceptedQuantity: 10,
      uom: 'EA',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-quantity-ready',
      operationProgressId: applied.value[0].id,
      status: 'ready',
    });
    await service.updateOperationProgress(actor, {
      idempotencyKey: 'progress-quantity-start',
      operationProgressId: applied.value[0].id,
      status: 'in_progress',
    });

    await expect(
      service.updateOperationProgress(actor, {
        idempotencyKey: 'progress-quantity-too-high',
        operationProgressId: applied.value[0].id,
        status: 'completed',
        productionExecutionId: execution.value.id,
        completedQuantity: 11,
      })
    ).rejects.toThrow(ManufacturingValidationError);
  });

  it('builds an operational readiness snapshot scoped to the actor factory', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service, repository } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);
    await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-snapshot',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });
    await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-snapshot',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });
    await createApprovedRouting(service, actor, 'SNAP');

    await repository.saveProductionOrder({
      id: 'po-other-factory',
      tenantId: actor.tenantId,
      factoryOrgUnitId: 'factory-branch-b',
      orderNumber: 'PO-OTHER',
      finishedGoodItemId: 'finished_good_a',
      targetQuantity: 5,
      uom: 'EA',
      status: 'draft',
      lines: [
        {
          id: 'po-other-line',
          tenantId: actor.tenantId,
          productionOrderId: 'po-other-factory',
          finishedGoodItemId: 'finished_good_a',
          targetQuantity: 5,
          uom: 'EA',
        },
      ],
      createdBy: actor.userId,
      createdAt: '2026-10-10T00:00:00.000Z',
    });

    const snapshot = await service.getOperationalReadinessSnapshot(actor);

    expect(snapshot).toMatchObject({
      tenantId: actor.tenantId,
      factoryOrgUnitId: actor.factoryOrgUnitId,
      generatedAt: '2026-10-10T00:00:00.000Z',
    });
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0].order.id).toBe(order.id);
    expect(snapshot.orders[0]).toMatchObject({
      materialReadiness: 'available',
      reconciliationStatus: 'released',
      missingEvidence: [],
      quantities: {
        plannedQuantity: 10,
        actualQuantity: 0,
        acceptedQuantity: 0,
        receivedAcceptedQuantity: 0,
      },
    });
    expect(snapshot.bomRevisions).toHaveLength(1);
    expect(snapshot.routingRevisions).toHaveLength(1);
    expect(snapshot.workCenters).toHaveLength(1);
  });

  it('requires operational read permission before returning the Manufacturing snapshot', async () => {
    const { service } = createService();
    const actor = createActor({ userId: 'operator-without-operational-read' });

    await expect(service.getOperationalReadinessSnapshot(actor)).rejects.toThrow(
      ManufacturingAuthorizationError
    );
  });
});
