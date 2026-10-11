import {
  ManufacturingIdempotencyConflictError,
  ManufacturingNotFoundError,
  ManufacturingStateError,
  ManufacturingValidationError,
} from './domain/errors';
import type {
  ApproveBOMRevisionCommand,
  ApproveRoutingRevisionCommand,
  BOMRevision,
  CreateRoutingRevisionCommand,
  CalculateMaterialRequirementsCommand,
  CompleteProductionOrderCommand,
  CreateBOMRevisionCommand,
  CreateProductionOrderCommand,
  CreateWorkCenterCommand,
  FinishedGoodsReceiptEvidence,
  IdempotentCommandResult,
  LotGenealogyFinishedGoodTrace,
  LotGenealogyMaterialTrace,
  LotGenealogyTrace,
  ManufacturingActor,
  OperationProgressStatus,
  MaterialRequirement,
  MaterialIssueLogisticsEvidence,
  ProductionOperationProgress,
  ProductionCompletion,
  ProductionExecution,
  QualityDispositionEvidence,
  ApplyRoutingRevisionCommand,
  ReleaseProductionOrderCommand,
  RecordProductionExecutionCommand,
  RecordQualityDispositionCommand,
  RoutingRevision,
  TraceFinishedGoodLotCommand,
  TraceRawMaterialLotCommand,
  UpdateOperationProgressCommand,
  ProductionOrder,
  WorkCenter,
} from './domain/types';
import type {
  ManufacturingAuthorizationPort,
  ManufacturingClock,
  ManufacturingIdFactory,
  ManufacturingRepository,
  LogisticsEvidenceBindingPort,
  MaterialAvailabilityPort,
} from './ports';

type CommandPayload = unknown;

export class ManufacturingSlice1Service {
  constructor(
    private readonly repository: ManufacturingRepository,
    private readonly authorization: ManufacturingAuthorizationPort,
    private readonly availability: MaterialAvailabilityPort,
    private readonly logisticsEvidence: LogisticsEvidenceBindingPort,
    private readonly ids: ManufacturingIdFactory,
    private readonly clock: ManufacturingClock
  ) {}

  async createProductionOrder(
    actor: ManufacturingActor,
    command: CreateProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionOrder>> {
    this.assertPositiveQuantity(command.targetQuantity, 'targetQuantity');
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:write',
        });

        const existingNumber = await repository.findProductionOrderByNumber(
          actor.tenantId,
          command.orderNumber
        );
        if (existingNumber) {
          throw new ManufacturingValidationError('Production order number already exists for tenant');
        }

        const order: ProductionOrder = {
          id: this.ids.next('mfg_po'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          orderNumber: command.orderNumber,
          finishedGoodItemId: command.finishedGoodItemId,
          targetQuantity: command.targetQuantity,
          uom: command.uom,
          status: 'draft',
          lines: [{
            id: this.ids.next('mfg_po_line'),
            tenantId: actor.tenantId,
            productionOrderId: '',
            finishedGoodItemId: command.finishedGoodItemId,
            targetQuantity: command.targetQuantity,
            uom: command.uom,
          }],
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        order.lines = order.lines.map((line) => ({ ...line, productionOrderId: order.id }));
        await repository.saveProductionOrder(order);
        return order;
      },
    });
  }

  async createWorkCenter(
    actor: ManufacturingActor,
    command: CreateWorkCenterCommand
  ): Promise<IdempotentCommandResult<WorkCenter>> {
    if (!command.code.trim() || !command.name.trim()) {
      throw new ManufacturingValidationError('Work center requires code and name');
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.work_center.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:work_center:write',
        });

        const existing = await repository.findWorkCenterByCode({
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          code: command.code,
        });
        if (existing) {
          throw new ManufacturingValidationError('Work center code already exists for factory');
        }

        const workCenter: WorkCenter = {
          id: this.ids.next('mfg_wc'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          code: command.code,
          name: command.name,
          status: 'active',
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        await repository.saveWorkCenter(workCenter);
        return workCenter;
      },
    });
  }

  async createRoutingRevision(
    actor: ManufacturingActor,
    command: CreateRoutingRevisionCommand
  ): Promise<IdempotentCommandResult<RoutingRevision>> {
    if (!command.finishedGoodItemId.trim() || !command.revisionCode.trim()) {
      throw new ManufacturingValidationError('Routing revision requires finished good and revision code');
    }
    if (command.operations.length === 0) {
      throw new ManufacturingValidationError('Routing revision requires at least one operation');
    }
    const sequences = new Set<number>();
    const operationCodes = new Set<string>();
    for (const operation of command.operations) {
      if (!Number.isInteger(operation.sequence) || operation.sequence <= 0) {
        throw new ManufacturingValidationError('Routing operation sequence must be a positive integer');
      }
      if (sequences.has(operation.sequence)) {
        throw new ManufacturingValidationError('Routing operation sequence must be unique');
      }
      sequences.add(operation.sequence);
      if (!operation.operationCode.trim() || !operation.operationName.trim()) {
        throw new ManufacturingValidationError('Routing operation requires code and name');
      }
      if (operationCodes.has(operation.operationCode)) {
        throw new ManufacturingValidationError('Routing operation code must be unique within revision');
      }
      operationCodes.add(operation.operationCode);
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.routing_revision.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:routing:write',
        });

        const existing = await repository.findRoutingRevisionByCode({
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
        });
        if (existing) {
          throw new ManufacturingValidationError('Routing revision code already exists for finished good');
        }

        for (const operation of command.operations) {
          const workCenter = await this.requireWorkCenter(repository, actor.tenantId, operation.workCenterId);
          this.assertSameFactory(actor, workCenter.factoryOrgUnitId);
          if (workCenter.status !== 'active') {
            throw new ManufacturingStateError('Routing operation requires an active work center');
          }
        }

        const routingRevisionId = this.ids.next('mfg_route');
        const revision: RoutingRevision = {
          id: routingRevisionId,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
          status: 'draft',
          operations: command.operations
            .slice()
            .sort((left, right) => left.sequence - right.sequence)
            .map((operation) => ({
              id: this.ids.next('mfg_route_op'),
              tenantId: actor.tenantId,
              routingRevisionId,
              sequence: operation.sequence,
              operationCode: operation.operationCode,
              operationName: operation.operationName,
              workCenterId: operation.workCenterId,
              required: operation.required ?? true,
            })),
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        await repository.saveRoutingRevision(revision);
        return revision;
      },
    });
  }

  async approveRoutingRevision(
    actor: ManufacturingActor,
    command: ApproveRoutingRevisionCommand
  ): Promise<IdempotentCommandResult<RoutingRevision>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.routing_revision.approve',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:routing:approve',
        });

        const revision = await this.requireRoutingRevision(repository, actor.tenantId, command.routingRevisionId);
        this.assertSameFactory(actor, revision.factoryOrgUnitId);
        if (revision.status !== 'draft') {
          throw new ManufacturingStateError('Only draft routing revisions can be approved');
        }

        const approved: RoutingRevision = {
          ...revision,
          status: 'approved',
          approvedBy: actor.userId,
          approvedAt: this.clock.now(),
        };
        await repository.saveRoutingRevision(approved);
        return approved;
      },
    });
  }

  async applyRoutingRevision(
    actor: ManufacturingActor,
    command: ApplyRoutingRevisionCommand
  ): Promise<IdempotentCommandResult<ProductionOperationProgress[]>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.routing_revision.apply',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:routing:apply',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status === 'completed' || order.status === 'cancelled') {
          throw new ManufacturingStateError('Routing cannot be applied to completed or cancelled orders');
        }
        const line = await repository.getProductionOrderLine({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          productionOrderLineId: command.productionOrderLineId,
        });
        if (!line) {
          throw new ManufacturingNotFoundError('ProductionOrderLine', command.productionOrderLineId);
        }

        const revision = await this.requireRoutingRevision(repository, actor.tenantId, command.routingRevisionId);
        this.assertSameFactory(actor, revision.factoryOrgUnitId);
        if (revision.status !== 'approved') {
          throw new ManufacturingStateError('Routing application requires an approved routing revision');
        }
        if (revision.finishedGoodItemId !== line.finishedGoodItemId) {
          throw new ManufacturingValidationError('Routing finished good does not match production order line');
        }

        const existingProgress = await repository.getOperationProgress({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        if (existingProgress.some((progress) => progress.productionOrderLineId === line.id)) {
          throw new ManufacturingStateError('Routing progress already exists for production order line');
        }

        const now = this.clock.now();
        const progress = revision.operations.map((operation) => ({
          id: this.ids.next('mfg_op_progress'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          routingRevisionId: revision.id,
          routingOperationId: operation.id,
          workCenterId: operation.workCenterId,
          required: operation.required,
          status: 'planned' as const,
          updatedBy: actor.userId,
          updatedAt: now,
        }));
        for (const item of progress) {
          await repository.saveOperationProgress(item);
        }
        return progress;
      },
    });
  }

  async updateOperationProgress(
    actor: ManufacturingActor,
    command: UpdateOperationProgressCommand
  ): Promise<IdempotentCommandResult<ProductionOperationProgress>> {
    if (command.status === 'blocked' && !command.blockedReason?.trim()) {
      throw new ManufacturingValidationError('Blocked operation progress requires a reason');
    }
    if (command.status === 'completed') {
      if (!command.productionExecutionId?.trim()) {
        throw new ManufacturingValidationError('Completed operation progress requires production execution evidence');
      }
      this.assertPositiveQuantity(command.completedQuantity ?? 0, 'completedQuantity');
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.operation_progress.update',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        const existing = await repository.getOperationProgressById(
          actor.tenantId,
          command.operationProgressId
        );
        if (!existing) {
          throw new ManufacturingNotFoundError('ProductionOperationProgress', command.operationProgressId);
        }

        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: existing.factoryOrgUnitId,
          permission: 'manufacturing:operation_progress:update',
        });
        this.assertSameFactory(actor, existing.factoryOrgUnitId);

        const order = await this.requireProductionOrder(repository, actor.tenantId, existing.productionOrderId);
        if (order.status === 'completed' || order.status === 'cancelled') {
          throw new ManufacturingStateError('Operation progress cannot change after production order is closed');
        }
        this.assertOperationProgressTransition(existing.status, command.status);
        await this.assertPriorRequiredOperationsComplete(repository, existing, command.status);

        const executionEvidence =
          command.status === 'completed'
            ? await this.requireOperationProgressExecutionEvidence(repository, existing, command)
            : undefined;

        const now = this.clock.now();
        const updated: ProductionOperationProgress = {
          ...existing,
          status: command.status,
          blockedReason: command.status === 'blocked' ? command.blockedReason : undefined,
          productionExecutionId: executionEvidence?.id,
          completedQuantity: executionEvidence ? this.roundQuantity(command.completedQuantity ?? 0) : undefined,
          quantityUom: executionEvidence?.uom,
          startedAt:
            command.status === 'in_progress' && !existing.startedAt
              ? now
              : existing.startedAt,
          completedAt: command.status === 'completed' ? now : existing.completedAt,
          updatedBy: actor.userId,
          updatedAt: now,
        };
        await repository.saveOperationProgress(updated);
        return updated;
      },
    });
  }

  async createBOMRevision(
    actor: ManufacturingActor,
    command: CreateBOMRevisionCommand
  ): Promise<IdempotentCommandResult<BOMRevision>> {
    if (command.components.length === 0) {
      throw new ManufacturingValidationError('BOM revision requires at least one component');
    }
    for (const component of command.components) {
      this.assertPositiveQuantity(component.quantityPerUnit, 'quantityPerUnit');
      if (component.scrapAllowancePercent !== undefined && component.scrapAllowancePercent < 0) {
        throw new ManufacturingValidationError('scrapAllowancePercent cannot be negative');
      }
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.bom_revision.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:bom:write',
        });

        const existingRevision = await repository.findBOMRevisionByCode({
          tenantId: actor.tenantId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
        });
        if (existingRevision) {
          throw new ManufacturingValidationError('BOM revision code already exists for finished good');
        }

        const revision: BOMRevision = {
          id: this.ids.next('mfg_bom'),
          tenantId: actor.tenantId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
          status: 'draft',
          components: command.components.map((component) => ({
            id: this.ids.next('mfg_bom_component'),
            componentItemId: component.componentItemId,
            quantityPerUnit: component.quantityPerUnit,
            uom: component.uom,
            scrapAllowancePercent: component.scrapAllowancePercent,
          })),
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        await repository.saveBOMRevision(revision);
        return revision;
      },
    });
  }

  async approveBOMRevision(
    actor: ManufacturingActor,
    command: ApproveBOMRevisionCommand
  ): Promise<IdempotentCommandResult<BOMRevision>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.bom_revision.approve',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:bom:approve',
        });

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'draft') {
          throw new ManufacturingStateError('Only draft BOM revisions can be approved');
        }

        const approved: BOMRevision = {
          ...revision,
          status: 'approved',
          approvedBy: actor.userId,
          approvedAt: this.clock.now(),
        };
        await repository.saveBOMRevision(approved);
        return approved;
      },
    });
  }

  async calculateMaterialRequirements(
    actor: ManufacturingActor,
    command: CalculateMaterialRequirementsCommand
  ): Promise<IdempotentCommandResult<MaterialRequirement[]>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.material_requirement.calculate',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:material_requirement:calculate',
        });
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:availability:read',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'draft') {
          throw new ManufacturingStateError('Material requirements can only be calculated for draft orders');
        }

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'approved') {
          throw new ManufacturingStateError('Material requirements require an approved BOM revision');
        }
        if (revision.finishedGoodItemId !== order.finishedGoodItemId) {
          throw new ManufacturingValidationError('BOM finished good does not match production order');
        }

        const checkedAt = this.clock.now();
        const requirements: MaterialRequirement[] = [];
        for (const component of revision.components) {
          const requiredQuantity = this.roundQuantity(
            order.targetQuantity *
              component.quantityPerUnit *
              (1 + (component.scrapAllowancePercent ?? 0) / 100)
          );
          const availableQuantity = await this.availability.getAvailable({
            tenantId: actor.tenantId,
            itemId: component.componentItemId,
            locationId: command.sourceLocationId,
          });
          requirements.push({
            id: this.ids.next('mfg_req'),
            tenantId: actor.tenantId,
            productionOrderId: order.id,
            bomRevisionId: revision.id,
            componentItemId: component.componentItemId,
            sourceLocationId: command.sourceLocationId,
            requiredQuantity,
            availableQuantity,
            status: availableQuantity >= requiredQuantity ? 'available' : 'shortage',
            checkedAt,
          });
        }

        await repository.saveMaterialRequirements(requirements);
        return requirements;
      },
    });
  }

  async releaseProductionOrder(
    actor: ManufacturingActor,
    command: ReleaseProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionOrder>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.release',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:release',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'draft') {
          throw new ManufacturingStateError('Only draft production orders can be released');
        }

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'approved') {
          throw new ManufacturingStateError('Production order release requires an approved BOM revision');
        }
        if (revision.finishedGoodItemId !== order.finishedGoodItemId) {
          throw new ManufacturingValidationError('BOM finished good does not match production order');
        }

        const requirements = await repository.getMaterialRequirements({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          bomRevisionId: revision.id,
        });
        if (requirements.length === 0) {
          throw new ManufacturingStateError('Production order release requires calculated material requirements');
        }
        if (requirements.some((requirement) => requirement.status !== 'available')) {
          throw new ManufacturingStateError('Production order release requires all materials to be available');
        }

        const released: ProductionOrder = {
          ...order,
          status: 'released',
          bomRevisionId: revision.id,
          releasedBy: actor.userId,
          releasedAt: this.clock.now(),
        };
        await repository.saveProductionOrder(released);
        return released;
      },
    });
  }

  async recordProductionExecution(
    actor: ManufacturingActor,
    command: RecordProductionExecutionCommand
  ): Promise<IdempotentCommandResult<ProductionExecution>> {
    this.assertPositiveQuantity(command.actualQuantity, 'actualQuantity');
    this.assertNonNegativeQuantity(command.acceptedQuantity, 'acceptedQuantity');
    this.assertNonNegativeQuantity(command.rejectedQuantity ?? 0, 'rejectedQuantity');
    this.assertNonNegativeQuantity(command.scrapQuantity ?? 0, 'scrapQuantity');
    if (!command.materialIssueDocumentId.trim() || !command.materialIssueMovementId.trim()) {
      throw new ManufacturingValidationError('Production execution requires material issue evidence');
    }
    const rejectedQuantity = command.rejectedQuantity ?? 0;
    const scrapQuantity = command.scrapQuantity ?? 0;
    if (
      this.roundQuantity(command.acceptedQuantity + rejectedQuantity + scrapQuantity) !==
      this.roundQuantity(command.actualQuantity)
    ) {
      throw new ManufacturingValidationError(
        'Production execution quantities must reconcile actual, accepted, rejected, and scrap'
      );
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_execution.record',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:execution:record',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'released' && order.status !== 'in_progress') {
          throw new ManufacturingStateError('Production execution can only be recorded for released orders');
        }

        const line = await repository.getProductionOrderLine({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          productionOrderLineId: command.productionOrderLineId,
        });
        if (!line) {
          throw new ManufacturingNotFoundError('ProductionOrderLine', command.productionOrderLineId);
        }
        if (line.uom !== command.uom) {
          throw new ManufacturingValidationError('Production execution UOM must match production order line UOM');
        }
        await this.assertMaterialRequirementEvidence(repository, order, command);
        await this.assertMaterialIssueEvidenceBinding(order, line.id, command);

        const execution: ProductionExecution = {
          id: this.ids.next('mfg_exec'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materialIssueDocumentId: command.materialIssueDocumentId,
          materialIssueMovementId: command.materialIssueMovementId,
          materialIssueEvidence: this.cloneMaterialIssueEvidence(command.materialIssueEvidence),
          materialRequirementId: command.materialRequirementId,
          actualQuantity: this.roundQuantity(command.actualQuantity),
          acceptedQuantity: this.roundQuantity(command.acceptedQuantity),
          rejectedQuantity: this.roundQuantity(rejectedQuantity),
          scrapQuantity: this.roundQuantity(scrapQuantity),
          uom: command.uom,
          recordedBy: actor.userId,
          recordedAt: this.clock.now(),
        };
        await repository.saveProductionExecution(execution);
        if (order.status === 'released') {
          await repository.saveProductionOrder({ ...order, status: 'in_progress' });
        }
        return execution;
      },
    });
  }

  async recordQualityDisposition(
    actor: ManufacturingActor,
    command: RecordQualityDispositionCommand
  ): Promise<IdempotentCommandResult<QualityDispositionEvidence>> {
    this.assertPositiveQuantity(command.quantity, 'quantity');
    this.assertNonNegativeQuantity(command.acceptedOutputQuantity, 'acceptedOutputQuantity');
    if (command.acceptedOutputQuantity > command.quantity) {
      throw new ManufacturingValidationError('Quality disposition accepted output cannot exceed disposition quantity');
    }
    if ((command.receiptDocumentId && !command.receiptLineId) || (!command.receiptDocumentId && command.receiptLineId)) {
      throw new ManufacturingValidationError('Quality disposition receipt evidence requires both document and line references');
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.quality_disposition.record',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:quality_disposition:record',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'in_progress') {
          throw new ManufacturingStateError('Quality disposition requires in-progress production execution');
        }

        const line = await repository.getProductionOrderLine({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          productionOrderLineId: command.productionOrderLineId,
        });
        if (!line) {
          throw new ManufacturingNotFoundError('ProductionOrderLine', command.productionOrderLineId);
        }

        const executions = await repository.getProductionExecutions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        const execution = executions.find((candidate) => candidate.id === command.productionExecutionId);
        if (!execution || execution.productionOrderLineId !== line.id) {
          throw new ManufacturingStateError('Quality disposition must reference execution evidence from the order line');
        }

        this.assertDispositionQuantityWithinSource(execution, command);
        const terminal = this.resolveQualityDispositionTerminal(command);
        const evidence: QualityDispositionEvidence = {
          id: this.ids.next('mfg_qd'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          productionExecutionId: execution.id,
          receiptDocumentId: command.receiptDocumentId,
          receiptLineId: command.receiptLineId,
          sourceQuantityType: command.sourceQuantityType,
          disposition: command.disposition,
          quantity: this.roundQuantity(command.quantity),
          acceptedOutputQuantity: this.roundQuantity(command.acceptedOutputQuantity),
          reasonCode: command.reasonCode,
          reasonText: command.reasonText,
          evidenceReference: command.evidenceReference,
          finalHandlingDecision: command.finalHandlingDecision,
          conditionalAcceptPolicyApproved: command.conditionalAcceptPolicyApproved,
          terminal,
          decidedBy: actor.userId,
          decidedAt: this.clock.now(),
        };

        await repository.saveQualityDisposition(evidence);
        return evidence;
      },
    });
  }

  async completeProductionOrder(
    actor: ManufacturingActor,
    command: CompleteProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionCompletion>> {
    if (command.receiptEvidence.length === 0) {
      throw new ManufacturingValidationError('Production completion requires finished goods receipt evidence');
    }
    for (const receipt of command.receiptEvidence) {
      this.assertPositiveQuantity(receipt.acceptedQuantity, 'receipt.acceptedQuantity');
      this.assertNonNegativeQuantity(receipt.rejectedQuantity ?? 0, 'receipt.rejectedQuantity');
      this.assertNonNegativeQuantity(receipt.pendingQuantity ?? 0, 'receipt.pendingQuantity');
      if (!receipt.receiptDocumentId.trim() || !receipt.receiptLineId.trim()) {
        throw new ManufacturingValidationError('Finished goods receipt evidence requires document and line references');
      }
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.complete',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:complete',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'in_progress') {
          throw new ManufacturingStateError('Production order completion requires in-progress execution');
        }
        const existingCompletion = await repository.getProductionCompletion(actor.tenantId, order.id);
        if (existingCompletion) {
          throw new ManufacturingStateError('Production order is already completed');
        }

        const executions = await repository.getProductionExecutions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        if (executions.length === 0) {
          throw new ManufacturingStateError('Production order completion requires recorded execution');
        }

        const qualityDispositionEvidence = await repository.getQualityDispositions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        await this.assertFinishedGoodsReceiptEvidenceBinding(order, command.receiptEvidence);
        const reconciliation = this.reconcileCompletion(
          order,
          executions,
          command.receiptEvidence,
          qualityDispositionEvidence
        );
        await this.assertAppliedRoutingComplete(repository, order);
        const completedAt = this.clock.now();
        const completion: ProductionCompletion = {
          id: this.ids.next('mfg_completion'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          completedQuantity: reconciliation.acceptedQuantity,
          rejectedQuantity: reconciliation.rejectedQuantity,
          scrapQuantity: reconciliation.scrapQuantity,
          uom: order.uom,
          receiptEvidence: command.receiptEvidence.map((receipt) => this.cloneReceiptEvidence(receipt)),
          qualityDispositionEvidence: qualityDispositionEvidence.map((evidence) => ({ ...evidence })),
          completedBy: actor.userId,
          completedAt,
        };
        await repository.saveProductionCompletion(completion);
        await repository.saveProductionOrder({
          ...order,
          status: 'completed',
          completedBy: actor.userId,
          completedAt,
        });
        return completion;
      },
    });
  }

  async traceFinishedGoodLot(
    actor: ManufacturingActor,
    command: TraceFinishedGoodLotCommand
  ): Promise<LotGenealogyTrace[]> {
    this.assertTraceSelector(command.lotNumber, command.serialNumber);
    return this.repository.withTransaction(async (repository) => {
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        factoryOrgUnitId: actor.factoryOrgUnitId,
        permission: 'manufacturing:genealogy:read',
      });
      const completions = await repository.findProductionCompletionsByFinishedGoodLot({
        tenantId: actor.tenantId,
        factoryOrgUnitId: actor.factoryOrgUnitId,
        itemId: command.finishedGoodItemId,
        lotNumber: command.lotNumber,
        serialNumber: command.serialNumber,
      });
      const traces: LotGenealogyTrace[] = [];
      const seen = new Set<string>();
      for (const completion of completions) {
        const order = await this.requireProductionOrder(repository, actor.tenantId, completion.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        const matchingLineIds = new Set(
          completion.receiptEvidence
            .filter((receipt) =>
              this.finishedGoodReceiptMatches(receipt, {
                itemId: command.finishedGoodItemId,
                lotNumber: command.lotNumber,
                serialNumber: command.serialNumber,
              })
            )
            .map((receipt) => receipt.productionOrderLineId)
        );
        for (const productionOrderLineId of matchingLineIds) {
          const key = `${order.id}:${productionOrderLineId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          traces.push(await this.buildLotGenealogyTrace(repository, order, productionOrderLineId, {
            finishedGoodItemId: command.finishedGoodItemId,
            finishedGoodLotNumber: command.lotNumber,
            finishedGoodSerialNumber: command.serialNumber,
          }));
        }
      }
      return traces;
    });
  }

  async traceRawMaterialLot(
    actor: ManufacturingActor,
    command: TraceRawMaterialLotCommand
  ): Promise<LotGenealogyTrace[]> {
    this.assertTraceSelector(command.lotNumber, command.serialNumber);
    return this.repository.withTransaction(async (repository) => {
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        factoryOrgUnitId: actor.factoryOrgUnitId,
        permission: 'manufacturing:genealogy:read',
      });
      const executions = await repository.findProductionExecutionsByMaterialLot({
        tenantId: actor.tenantId,
        factoryOrgUnitId: actor.factoryOrgUnitId,
        itemId: command.rawMaterialItemId,
        lotNumber: command.lotNumber,
        serialNumber: command.serialNumber,
      });
      const traces: LotGenealogyTrace[] = [];
      const seen = new Set<string>();
      for (const execution of executions) {
        const key = `${execution.productionOrderId}:${execution.productionOrderLineId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const order = await this.requireProductionOrder(repository, actor.tenantId, execution.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        traces.push(await this.buildLotGenealogyTrace(repository, order, execution.productionOrderLineId, {
          rawMaterialItemId: command.rawMaterialItemId,
          rawMaterialLotNumber: command.lotNumber,
          rawMaterialSerialNumber: command.serialNumber,
        }));
      }
      return traces;
    });
  }

  private async runIdempotent<T>(params: {
    actor: ManufacturingActor;
    operation: string;
    businessKey: string;
    payload: CommandPayload;
    execute: (repository: ManufacturingRepository) => Promise<T>;
  }): Promise<IdempotentCommandResult<T>> {
    const payloadHash = stablePayloadHash(params.payload);
    try {
      return await this.repository.withTransaction(async (repository) => {
        const existing = await repository.getCommandLog<T>({
          tenantId: params.actor.tenantId,
          operation: params.operation,
          businessKey: params.businessKey,
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new ManufacturingIdempotencyConflictError();
          }
          return { value: existing.result, isDuplicate: true };
        }

        const value = await params.execute(repository);
        await repository.saveCommandLog<T>({
          tenantId: params.actor.tenantId,
          factoryOrgUnitId: params.actor.factoryOrgUnitId,
          operation: params.operation,
          businessKey: params.businessKey,
          payloadHash,
          result: value,
          createdAt: this.clock.now(),
        });
        return { value, isDuplicate: false };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.repository.getCommandLog<T>({
        tenantId: params.actor.tenantId,
        operation: params.operation,
        businessKey: params.businessKey,
      });
      if (!existing) throw error;
      if (existing.payloadHash !== payloadHash) {
        throw new ManufacturingIdempotencyConflictError();
      }
      return { value: existing.result, isDuplicate: true };
    }
  }

  private async requireProductionOrder(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<ProductionOrder> {
    const order = await repository.getProductionOrder(tenantId, id);
    if (!order) throw new ManufacturingNotFoundError('ProductionOrder', id);
    return order;
  }

  private async requireBOMRevision(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<BOMRevision> {
    const revision = await repository.getBOMRevision(tenantId, id);
    if (!revision) throw new ManufacturingNotFoundError('BOMRevision', id);
    return revision;
  }

  private async requireWorkCenter(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<WorkCenter> {
    const workCenter = await repository.getWorkCenter(tenantId, id);
    if (!workCenter) throw new ManufacturingNotFoundError('WorkCenter', id);
    return workCenter;
  }

  private async requireRoutingRevision(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<RoutingRevision> {
    const revision = await repository.getRoutingRevision(tenantId, id);
    if (!revision) throw new ManufacturingNotFoundError('RoutingRevision', id);
    return revision;
  }

  private assertSameFactory(actor: ManufacturingActor, factoryOrgUnitId: string): void {
    if (actor.factoryOrgUnitId !== factoryOrgUnitId) {
      throw new ManufacturingStateError('Actor factory scope does not match production order factory');
    }
  }

  private async buildLotGenealogyTrace(
    repository: ManufacturingRepository,
    order: ProductionOrder,
    productionOrderLineId: string,
    selector: {
      rawMaterialItemId?: string;
      rawMaterialLotNumber?: string;
      rawMaterialSerialNumber?: string;
      finishedGoodItemId?: string;
      finishedGoodLotNumber?: string;
      finishedGoodSerialNumber?: string;
    }
  ): Promise<LotGenealogyTrace> {
    const line = order.lines.find((candidate) => candidate.id === productionOrderLineId);
    if (!line) {
      throw new ManufacturingStateError('Lot genealogy requires a production order line');
    }
    const executions = await repository.getProductionExecutions({
      tenantId: order.tenantId,
      productionOrderId: order.id,
    });
    const lineExecutions = executions.filter((execution) => execution.productionOrderLineId === productionOrderLineId);
    const materials = lineExecutions
      .filter((execution) =>
        selector.rawMaterialItemId || selector.rawMaterialLotNumber || selector.rawMaterialSerialNumber
          ? this.materialIssueMatches(execution.materialIssueEvidence, {
              itemId: selector.rawMaterialItemId,
              lotNumber: selector.rawMaterialLotNumber,
              serialNumber: selector.rawMaterialSerialNumber,
            })
          : true
      )
      .map((execution) => this.toMaterialTrace(execution));

    if (lineExecutions.length > 0 && materials.length === 0) {
      throw new ManufacturingStateError('Lot genealogy requires persisted material issue evidence');
    }

    const completion = await repository.getProductionCompletion(order.tenantId, order.id);
    const finishedGoods = (completion?.receiptEvidence ?? [])
      .filter((receipt) => receipt.productionOrderLineId === productionOrderLineId)
      .filter((receipt) =>
        selector.finishedGoodItemId || selector.finishedGoodLotNumber || selector.finishedGoodSerialNumber
          ? this.finishedGoodReceiptMatches(receipt, {
              itemId: selector.finishedGoodItemId,
              lotNumber: selector.finishedGoodLotNumber,
              serialNumber: selector.finishedGoodSerialNumber,
            })
          : true
      )
      .map((receipt) => this.toFinishedGoodTrace(receipt));

    return {
      tenantId: order.tenantId,
      factoryOrgUnitId: order.factoryOrgUnitId,
      productionOrderId: order.id,
      productionOrderLineId,
      materials,
      finishedGoods,
    };
  }

  private toMaterialTrace(execution: ProductionExecution): LotGenealogyMaterialTrace {
    const evidence = execution.materialIssueEvidence;
    if (!evidence) {
      throw new ManufacturingStateError('Lot genealogy requires persisted material issue evidence');
    }
    return {
      productionExecutionId: execution.id,
      materialRequirementId: execution.materialRequirementId,
      itemId: evidence.itemId,
      locationId: evidence.locationId,
      quantity: evidence.quantity,
      lotNumber: evidence.lotNumber,
      serialNumbers: evidence.serialNumbers ? [...evidence.serialNumbers] : undefined,
      issueDocumentId: evidence.issueDocumentId,
      movementId: evidence.movementId,
      traceabilityEventId: evidence.traceabilityEventId,
    };
  }

  private toFinishedGoodTrace(receipt: FinishedGoodsReceiptEvidence): LotGenealogyFinishedGoodTrace {
    const evidence = receipt.logisticsEvidence;
    return {
      itemId: evidence.itemId,
      locationId: evidence.locationId,
      quantity: evidence.quantity,
      lotNumber: evidence.lotNumber ?? receipt.lotNumber,
      serialNumbers: evidence.serialNumbers
        ? [...evidence.serialNumbers]
        : receipt.serialNumbers
          ? [...receipt.serialNumbers]
          : undefined,
      receiptDocumentId: receipt.receiptDocumentId,
      receiptLineId: receipt.receiptLineId,
      movementId: evidence.movementId,
      traceabilityEventId: evidence.traceabilityEventId,
      acceptedQuantity: receipt.acceptedQuantity,
      rejectedQuantity: receipt.rejectedQuantity ?? 0,
      pendingQuantity: receipt.pendingQuantity ?? 0,
    };
  }

  private materialIssueMatches(
    evidence: MaterialIssueLogisticsEvidence | undefined,
    selector: { itemId?: string; lotNumber?: string; serialNumber?: string }
  ): boolean {
    if (!evidence) return false;
    return this.traceSelectorMatches({
      evidenceItemId: evidence.itemId,
      evidenceLotNumber: evidence.lotNumber,
      evidenceSerialNumbers: evidence.serialNumbers,
      itemId: selector.itemId,
      lotNumber: selector.lotNumber,
      serialNumber: selector.serialNumber,
    });
  }

  private finishedGoodReceiptMatches(
    receipt: FinishedGoodsReceiptEvidence,
    selector: { itemId?: string; lotNumber?: string; serialNumber?: string }
  ): boolean {
    return this.traceSelectorMatches({
      evidenceItemId: receipt.logisticsEvidence.itemId,
      evidenceLotNumber: receipt.logisticsEvidence.lotNumber ?? receipt.lotNumber,
      evidenceSerialNumbers: receipt.logisticsEvidence.serialNumbers ?? receipt.serialNumbers,
      itemId: selector.itemId,
      lotNumber: selector.lotNumber,
      serialNumber: selector.serialNumber,
    });
  }

  private traceSelectorMatches(params: {
    evidenceItemId: string;
    evidenceLotNumber?: string;
    evidenceSerialNumbers?: string[];
    itemId?: string;
    lotNumber?: string;
    serialNumber?: string;
  }): boolean {
    if (params.itemId !== undefined && params.evidenceItemId !== params.itemId) return false;
    if (params.lotNumber !== undefined && params.evidenceLotNumber !== params.lotNumber) return false;
    if (params.serialNumber !== undefined && !(params.evidenceSerialNumbers ?? []).includes(params.serialNumber)) {
      return false;
    }
    return true;
  }

  private assertTraceSelector(lotNumber: string | undefined, serialNumber: string | undefined): void {
    if (!lotNumber?.trim() && !serialNumber?.trim()) {
      throw new ManufacturingValidationError('Lot genealogy trace requires lot number or serial number');
    }
  }

  private cloneMaterialIssueEvidence(evidence: MaterialIssueLogisticsEvidence): MaterialIssueLogisticsEvidence {
    return {
      ...evidence,
      serialNumbers: evidence.serialNumbers ? [...evidence.serialNumbers] : undefined,
    };
  }

  private cloneReceiptEvidence(receipt: FinishedGoodsReceiptEvidence): FinishedGoodsReceiptEvidence {
    return {
      ...receipt,
      serialNumbers: receipt.serialNumbers ? [...receipt.serialNumbers] : undefined,
      logisticsEvidence: {
        ...receipt.logisticsEvidence,
        serialNumbers: receipt.logisticsEvidence.serialNumbers
          ? [...receipt.logisticsEvidence.serialNumbers]
          : undefined,
      },
    };
  }

  private assertOperationProgressTransition(
    current: OperationProgressStatus,
    next: OperationProgressStatus
  ): void {
    const allowed: Record<OperationProgressStatus, OperationProgressStatus[]> = {
      planned: ['ready', 'blocked'],
      ready: ['in_progress', 'blocked'],
      in_progress: ['completed', 'blocked'],
      blocked: ['ready'],
      completed: [],
    };
    if (!allowed[current].includes(next)) {
      throw new ManufacturingStateError(`Invalid operation progress transition from ${current} to ${next}`);
    }
  }

  private async assertPriorRequiredOperationsComplete(
    repository: ManufacturingRepository,
    progress: ProductionOperationProgress,
    nextStatus: OperationProgressStatus
  ): Promise<void> {
    if (nextStatus !== 'in_progress' && nextStatus !== 'completed') return;

    const routing = await this.requireRoutingRevision(repository, progress.tenantId, progress.routingRevisionId);
    const currentOperation = routing.operations.find((operation) => operation.id === progress.routingOperationId);
    if (!currentOperation) {
      throw new ManufacturingStateError('Operation progress references an operation outside its routing revision');
    }

    const allProgress = await repository.getOperationProgress({
      tenantId: progress.tenantId,
      productionOrderId: progress.productionOrderId,
    });
    const lineProgress = allProgress.filter(
      (candidate) =>
        candidate.productionOrderLineId === progress.productionOrderLineId &&
        candidate.routingRevisionId === progress.routingRevisionId
    );

    const earlierRequiredOperations = routing.operations.filter(
      (operation) => operation.required && operation.sequence < currentOperation.sequence
    );
    for (const operation of earlierRequiredOperations) {
      const priorProgress = lineProgress.find((candidate) => candidate.routingOperationId === operation.id);
      if (!priorProgress || priorProgress.status !== 'completed') {
        throw new ManufacturingStateError(
          'Operation progress requires prior required routing operations to be completed'
        );
      }
    }
  }

  private async requireOperationProgressExecutionEvidence(
    repository: ManufacturingRepository,
    progress: ProductionOperationProgress,
    command: UpdateOperationProgressCommand
  ): Promise<ProductionExecution> {
    if (!command.productionExecutionId) {
      throw new ManufacturingValidationError('Completed operation progress requires production execution evidence');
    }
    const executions = await repository.getProductionExecutions({
      tenantId: progress.tenantId,
      productionOrderId: progress.productionOrderId,
    });
    const execution = executions.find((candidate) => candidate.id === command.productionExecutionId);
    if (!execution || execution.productionOrderLineId !== progress.productionOrderLineId) {
      throw new ManufacturingStateError(
        'Operation progress execution evidence must belong to the production order line'
      );
    }
    const completedQuantity = this.roundQuantity(command.completedQuantity ?? 0);
    if (completedQuantity > execution.actualQuantity) {
      throw new ManufacturingValidationError(
        'Operation progress completed quantity cannot exceed execution actual quantity'
      );
    }
    return execution;
  }

  private assertPositiveQuantity(quantity: number, field: string): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ManufacturingValidationError(`${field} must be a positive finite quantity`);
    }
  }

  private assertNonNegativeQuantity(quantity: number, field: string): void {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ManufacturingValidationError(`${field} must be a non-negative finite quantity`);
    }
  }

  private async assertMaterialRequirementEvidence(
    repository: ManufacturingRepository,
    order: ProductionOrder,
    command: RecordProductionExecutionCommand
  ): Promise<void> {
    if (!command.materialRequirementId) return;
    if (!order.bomRevisionId) {
      throw new ManufacturingStateError('Production execution material evidence requires released BOM');
    }
    const requirements = await repository.getMaterialRequirements({
      tenantId: order.tenantId,
      productionOrderId: order.id,
      bomRevisionId: order.bomRevisionId,
    });
    if (!requirements.some((requirement) => requirement.id === command.materialRequirementId)) {
      throw new ManufacturingStateError('Material issue evidence must reference a requirement from the order');
    }
  }

  private async assertMaterialIssueEvidenceBinding(
    order: ProductionOrder,
    productionOrderLineId: string,
    command: RecordProductionExecutionCommand
  ): Promise<void> {
    const evidence = command.materialIssueEvidence;
    if (
      evidence.issueDocumentId !== command.materialIssueDocumentId ||
      evidence.movementId !== command.materialIssueMovementId
    ) {
      throw new ManufacturingValidationError('Material issue evidence does not match execution references');
    }
    if (
      evidence.productionOrderId !== order.id ||
      evidence.productionOrderLineId !== productionOrderLineId
    ) {
      throw new ManufacturingValidationError('Material issue evidence must reference the production order line');
    }
    if (
      command.materialRequirementId !== undefined &&
      evidence.materialRequirementId !== command.materialRequirementId
    ) {
      throw new ManufacturingValidationError('Material issue evidence must reference the material requirement');
    }
    await this.logisticsEvidence.verifyMaterialIssueEvidence({
      tenantId: order.tenantId,
      productionOrderId: order.id,
      productionOrderLineId,
      materialRequirementId: command.materialRequirementId,
      evidence,
    });
  }

  private async assertFinishedGoodsReceiptEvidenceBinding(
    order: ProductionOrder,
    receipts: CompleteProductionOrderCommand['receiptEvidence']
  ): Promise<void> {
    const orderLineIds = new Set(order.lines.map((line) => line.id));
    for (const receipt of receipts) {
      const evidence = receipt.logisticsEvidence;
      if (!orderLineIds.has(receipt.productionOrderLineId)) {
        throw new ManufacturingValidationError('Finished goods receipt evidence references an unknown order line');
      }
      if (
        evidence.receiptDocumentId !== receipt.receiptDocumentId ||
        evidence.receiptLineId !== receipt.receiptLineId ||
        evidence.productionOrderId !== order.id ||
        evidence.productionOrderLineId !== receipt.productionOrderLineId
      ) {
        throw new ManufacturingValidationError('Finished goods receipt evidence does not match completion references');
      }
      await this.logisticsEvidence.verifyFinishedGoodsReceiptEvidence({
        tenantId: order.tenantId,
        productionOrderId: order.id,
        receipt,
      });
    }
  }

  private async assertAppliedRoutingComplete(
    repository: ManufacturingRepository,
    order: ProductionOrder
  ): Promise<void> {
    const progress = await repository.getOperationProgress({
      tenantId: order.tenantId,
      productionOrderId: order.id,
    });
    if (progress.length === 0) return;

    const progressByLine = new Map<string, ProductionOperationProgress[]>();
    for (const item of progress) {
      const existing = progressByLine.get(item.productionOrderLineId) ?? [];
      existing.push(item);
      progressByLine.set(item.productionOrderLineId, existing);
    }

    for (const line of order.lines) {
      const lineProgress = progressByLine.get(line.id);
      if (!lineProgress || lineProgress.length === 0) continue;
      if (lineProgress.some((item) => item.required && item.status !== 'completed')) {
        throw new ManufacturingStateError(
          'Production order completion requires all applied routing operations to be completed'
        );
      }
      if (
        lineProgress.some(
          (item) =>
            item.required &&
            (!item.productionExecutionId || item.completedQuantity === undefined || item.completedQuantity <= 0)
        )
      ) {
        throw new ManufacturingStateError(
          'Production order completion requires completed routing operations to carry execution evidence'
        );
      }
    }
  }

  private assertDispositionQuantityWithinSource(
    execution: ProductionExecution,
    command: RecordQualityDispositionCommand
  ): void {
    if (command.sourceQuantityType === 'pending') {
      if (!command.receiptDocumentId || !command.receiptLineId) {
        throw new ManufacturingValidationError('Pending quality disposition requires FGR receipt evidence');
      }
      return;
    }

    const sourceQuantity = this.getExecutionSourceQuantity(execution, command.sourceQuantityType);
    if (this.roundQuantity(command.quantity) > sourceQuantity) {
      throw new ManufacturingValidationError('Quality disposition quantity exceeds source execution quantity');
    }
  }

  private resolveQualityDispositionTerminal(command: RecordQualityDispositionCommand): boolean {
    switch (command.disposition) {
      case 'accepted':
        if (command.acceptedOutputQuantity !== command.quantity) {
          throw new ManufacturingValidationError('Accepted disposition must fully count as accepted output');
        }
        return true;
      case 'conditional_accept':
        if (!command.conditionalAcceptPolicyApproved || !command.evidenceReference?.trim()) {
          throw new ManufacturingValidationError('Conditional accept requires policy approval evidence');
        }
        return true;
      case 'rework':
        this.assertNoAcceptedOutput(command, 'Rework is not accepted output');
        return false;
      case 'scrap':
        this.requireReasonAndEvidence(command, 'Scrap disposition requires reason and evidence');
        this.assertNoAcceptedOutput(command, 'Scrap is not accepted output');
        return true;
      case 'discard_reject':
        this.requireReasonAndEvidence(command, 'Discard/reject disposition requires reason and evidence');
        if (!command.finalHandlingDecision) {
          throw new ManufacturingValidationError('Discard/reject disposition requires a final handling decision');
        }
        this.assertNoAcceptedOutput(command, 'Discard/reject is not accepted output');
        return true;
      case 'pending':
        this.assertNoAcceptedOutput(command, 'Pending quality disposition is not accepted output');
        return false;
    }
  }

  private assertNoAcceptedOutput(command: RecordQualityDispositionCommand, message: string): void {
    if (command.acceptedOutputQuantity !== 0) {
      throw new ManufacturingValidationError(message);
    }
  }

  private requireReasonAndEvidence(command: RecordQualityDispositionCommand, message: string): void {
    if (!command.reasonCode?.trim() || !command.evidenceReference?.trim()) {
      throw new ManufacturingValidationError(message);
    }
  }

  private getExecutionSourceQuantity(
    execution: ProductionExecution,
    sourceQuantityType: RecordQualityDispositionCommand['sourceQuantityType']
  ): number {
    switch (sourceQuantityType) {
      case 'accepted':
        return execution.acceptedQuantity;
      case 'rejected':
        return execution.rejectedQuantity;
      case 'scrap':
        return execution.scrapQuantity;
      case 'pending':
        return 0;
    }
  }

  private reconcileCompletion(
    order: ProductionOrder,
    executions: ProductionExecution[],
    receipts: CompleteProductionOrderCommand['receiptEvidence'],
    qualityDispositions: QualityDispositionEvidence[]
  ): { acceptedQuantity: number; rejectedQuantity: number; scrapQuantity: number } {
    let acceptedQuantity = 0;
    let rejectedQuantity = 0;
    let scrapQuantity = 0;
    const receiptLineKeys = new Set<string>();

    for (const line of order.lines) {
      const lineExecutions = executions.filter((execution) => execution.productionOrderLineId === line.id);
      if (lineExecutions.length === 0) {
        throw new ManufacturingStateError('Every production order line requires recorded execution');
      }

      const actual = this.sumQuantities(lineExecutions.map((execution) => execution.actualQuantity));
      const accepted = this.sumQuantities(lineExecutions.map((execution) => execution.acceptedQuantity));
      const rejected = this.sumQuantities(lineExecutions.map((execution) => execution.rejectedQuantity));
      const scrap = this.sumQuantities(lineExecutions.map((execution) => execution.scrapQuantity));
      if (actual !== this.roundQuantity(line.targetQuantity)) {
        throw new ManufacturingStateError('Production execution must explain the full target quantity before completion');
      }
      if (this.roundQuantity(accepted + rejected + scrap) !== actual) {
        throw new ManufacturingStateError('Production execution quantities are not reconciled');
      }

      const lineReceipts = receipts.filter((receipt) => receipt.productionOrderLineId === line.id);
      const receiptAccepted = this.sumQuantities(lineReceipts.map((receipt) => receipt.acceptedQuantity));
      const receiptRejected = this.sumQuantities(lineReceipts.map((receipt) => receipt.rejectedQuantity ?? 0));
      const receiptPending = this.sumQuantities(lineReceipts.map((receipt) => receipt.pendingQuantity ?? 0));
      for (const receipt of lineReceipts) {
        const key = `${receipt.receiptDocumentId}:${receipt.receiptLineId}`;
        if (receiptLineKeys.has(key)) {
          throw new ManufacturingValidationError('Finished goods receipt evidence must not contain duplicate lines');
        }
        receiptLineKeys.add(key);
      }
      if (receiptPending !== 0) {
        throw new ManufacturingStateError('Production order completion requires no pending finished goods quantity');
      }
      const lineDispositions = qualityDispositions.filter(
        (evidence) => evidence.productionOrderLineId === line.id
      );
      const qualityReconciliation = this.reconcileQualityDispositions({
        lineDispositions,
        accepted,
        rejected,
        scrap,
        receiptPending,
      });
      const expectedReceiptAccepted = this.roundQuantity(accepted + qualityReconciliation.acceptedAdjustment);
      const expectedReceiptRejected = this.roundQuantity(rejected - qualityReconciliation.acceptedAdjustment);
      if (receiptAccepted !== expectedReceiptAccepted || receiptRejected !== expectedReceiptRejected) {
        throw new ManufacturingStateError('Finished goods receipt evidence must reconcile with production execution');
      }

      acceptedQuantity = this.roundQuantity(acceptedQuantity + expectedReceiptAccepted);
      rejectedQuantity = this.roundQuantity(rejectedQuantity + expectedReceiptRejected);
      scrapQuantity = this.roundQuantity(scrapQuantity + scrap);
    }

    return { acceptedQuantity, rejectedQuantity, scrapQuantity };
  }

  private reconcileQualityDispositions(params: {
    lineDispositions: QualityDispositionEvidence[];
    accepted: number;
    rejected: number;
    scrap: number;
    receiptPending: number;
  }): { acceptedAdjustment: number } {
    if (params.lineDispositions.some((evidence) => !evidence.terminal)) {
      throw new ManufacturingStateError('Production order completion requires terminal quality dispositions');
    }

    const dispositionAccepted = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'accepted')
        .map((evidence) => evidence.quantity)
    );
    const dispositionRejected = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'rejected')
        .map((evidence) => evidence.quantity)
    );
    const dispositionScrap = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'scrap')
        .map((evidence) => evidence.quantity)
    );
    const dispositionPending = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'pending')
        .map((evidence) => evidence.quantity)
    );

    if (dispositionAccepted > params.accepted) {
      throw new ManufacturingStateError('Quality disposition accepted quantity exceeds execution accepted quantity');
    }
    if (params.rejected > 0 && dispositionRejected !== params.rejected) {
      throw new ManufacturingStateError('Rejected production quantity requires terminal quality disposition');
    }
    if (params.scrap > 0 && dispositionScrap !== params.scrap) {
      throw new ManufacturingStateError('Scrap production quantity requires terminal quality disposition');
    }
    if (dispositionPending > params.receiptPending) {
      throw new ManufacturingStateError('Pending quality disposition exceeds FGR pending quantity');
    }

    const acceptedAdjustment = this.sumQuantities(
      params.lineDispositions
        .filter(
          (evidence) =>
            evidence.sourceQuantityType === 'rejected' &&
            evidence.disposition === 'conditional_accept'
        )
        .map((evidence) => evidence.acceptedOutputQuantity)
    );
    if (acceptedAdjustment > params.rejected) {
      throw new ManufacturingStateError('Conditional accepted output exceeds rejected execution quantity');
    }

    return { acceptedAdjustment };
  }

  private sumQuantities(values: number[]): number {
    return this.roundQuantity(values.reduce((total, value) => total + value, 0));
  }

  private roundQuantity(quantity: number): number {
    return Math.round(quantity * 1_000_000) / 1_000_000;
  }
}

function stablePayloadHash(payload: CommandPayload): string {
  return JSON.stringify(sortValue(payload));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
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
