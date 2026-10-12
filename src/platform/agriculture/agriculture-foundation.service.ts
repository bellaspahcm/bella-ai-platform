import { createHash } from 'crypto';

import {
  AgricultureIdempotencyConflictError,
  AgricultureNotFoundError,
  AgricultureStateError,
  AgricultureValidationError,
} from './domain/errors';
import type {
  AgricultureActor,
  AgricultureDomainEvent,
  AgricultureId,
  CancelCropCycleCommand,
  CommandLogEntry,
  CompleteCropCycleCommand,
  CreateCropCycleCommand,
  CreateFarmCommand,
  CreatePlotCommand,
  CropActivityEvidence,
  CropCycle,
  CropCycleCompletionDisposition,
  CropCycleEvent,
  CropCycleTrace,
  Farm,
  HarvestEvidence,
  IdempotentCommandResult,
  MaterialUsageEvidence,
  OrgUnitId,
  Plot,
  RecordCropActivityCommand,
  RecordHarvestCommand,
  RecordMaterialUsageCommand,
  StartCropCycleCommand,
} from './domain/types';
import type {
  AgricultureAuthorizationPort,
  AgricultureClock,
  AgricultureIdFactory,
  AgricultureRepository,
} from './ports';

type CommandPayload = unknown;

export class AgricultureFoundationService {
  constructor(
    private readonly repository: AgricultureRepository,
    private readonly authorization: AgricultureAuthorizationPort,
    private readonly ids: AgricultureIdFactory,
    private readonly clock: AgricultureClock
  ) {}

  async createFarm(
    actor: AgricultureActor,
    command: CreateFarmCommand
  ): Promise<IdempotentCommandResult<Farm>> {
    this.assertRequiredText(command.orgUnitId, 'orgUnitId');
    this.assertRequiredText(command.farmCode, 'farmCode');
    this.assertRequiredText(command.name, 'name');

    return this.repository.withTransaction(async (repository) => {
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        orgUnitId: command.orgUnitId,
        permission: 'agriculture:farm:write',
      });

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: command.orgUnitId,
        operation: 'agriculture.farm.create',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const existing = await repository.findFarmByCode({
            tenantId: actor.tenantId,
            farmCode: command.farmCode,
          });
          if (existing) {
            throw new AgricultureValidationError('Farm code already exists for tenant');
          }

          const now = this.clock.now();
          const farm: Farm = {
            id: this.ids.next('ag_farm'),
            tenantId: actor.tenantId,
            orgUnitId: command.orgUnitId,
            farmCode: command.farmCode,
            name: command.name,
            status: 'active',
            createdBy: actor.userId,
            createdAt: now,
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.saveFarm(farm);
          await repository.saveDomainEvent(this.domainEvent(actor, farm.orgUnitId, 'farm', farm.id, 'farm.created', {
            farmCode: farm.farmCode,
          }));
          return farm;
        },
      });
    });
  }

  async createPlot(
    actor: AgricultureActor,
    command: CreatePlotCommand
  ): Promise<IdempotentCommandResult<Plot>> {
    this.assertRequiredText(command.farmId, 'farmId');
    this.assertRequiredText(command.plotCode, 'plotCode');
    this.assertRequiredText(command.name, 'name');

    return this.repository.withTransaction(async (repository) => {
      const farm = await this.getAuthorizedFarm(repository, actor, command.farmId, 'agriculture:plot:write');
      this.assertFarmActive(farm);

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: farm.orgUnitId,
        operation: 'agriculture.plot.create',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const existing = await repository.findPlotByCode({
            tenantId: actor.tenantId,
            farmId: farm.id,
            plotCode: command.plotCode,
          });
          if (existing) {
            throw new AgricultureValidationError('Plot code already exists for farm');
          }

          const now = this.clock.now();
          const plot: Plot = {
            id: this.ids.next('ag_plot'),
            tenantId: actor.tenantId,
            farmId: farm.id,
            orgUnitId: farm.orgUnitId,
            plotCode: command.plotCode,
            name: command.name,
            status: 'active',
            createdBy: actor.userId,
            createdAt: now,
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.savePlot(plot);
          await repository.saveDomainEvent(this.domainEvent(actor, plot.orgUnitId, 'plot', plot.id, 'plot.created', {
            farmId: farm.id,
            plotCode: plot.plotCode,
          }));
          return plot;
        },
      });
    });
  }

  async createCropCycle(
    actor: AgricultureActor,
    command: CreateCropCycleCommand
  ): Promise<IdempotentCommandResult<CropCycle>> {
    this.assertRequiredText(command.plotId, 'plotId');
    this.assertRequiredText(command.cycleCode, 'cycleCode');
    this.assertRequiredText(command.cropName, 'cropName');

    return this.repository.withTransaction(async (repository) => {
      const { farm, plot } = await this.getAuthorizedPlot(repository, actor, command.plotId, 'agriculture:crop_cycle:write');
      this.assertFarmActive(farm);
      this.assertPlotActive(plot);

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: plot.orgUnitId,
        operation: 'agriculture.crop_cycle.create',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const existing = await repository.findCropCycleByCode({
            tenantId: actor.tenantId,
            plotId: plot.id,
            cycleCode: command.cycleCode,
          });
          if (existing) {
            throw new AgricultureValidationError('Crop cycle code already exists for plot');
          }

          const now = this.clock.now();
          const cycle: CropCycle = {
            id: this.ids.next('ag_cycle'),
            tenantId: actor.tenantId,
            farmId: farm.id,
            plotId: plot.id,
            orgUnitId: plot.orgUnitId,
            cycleCode: command.cycleCode,
            cropName: command.cropName,
            status: 'planned',
            plannedStartDate: command.plannedStartDate,
            plannedEndDate: command.plannedEndDate,
            createdBy: actor.userId,
            createdAt: now,
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.saveCropCycle(cycle);
          await repository.saveCropCycleEvent(this.cycleEvent(actor, cycle.id, undefined, 'planned'));
          await repository.saveDomainEvent(this.domainEvent(
            actor,
            cycle.orgUnitId,
            'crop_cycle',
            cycle.id,
            'crop_cycle.created',
            { plotId: plot.id, cropName: cycle.cropName }
          ));
          return cycle;
        },
      });
    });
  }

  async startCropCycle(
    actor: AgricultureActor,
    command: StartCropCycleCommand
  ): Promise<IdempotentCommandResult<CropCycle>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:crop_cycle:write');

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.crop_cycle.start',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          if (cycle.status !== 'planned') {
            throw new AgricultureStateError('Only planned Crop Cycles can be started');
          }
          const now = this.clock.now();
          const startedAt = command.startedAt ?? now;
          const updated: CropCycle = {
            ...cycle,
            status: 'active',
            startedAt,
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.saveCropCycle(updated);
          await repository.saveCropCycleEvent(this.cycleEvent(actor, cycle.id, 'planned', 'active', undefined, undefined, startedAt));
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'crop_cycle', cycle.id, 'crop_cycle.started', {
            startedAt,
          }));
          return updated;
        },
      });
    });
  }

  async completeCropCycle(
    actor: AgricultureActor,
    command: CompleteCropCycleCommand
  ): Promise<IdempotentCommandResult<CropCycle>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:crop_cycle:write');

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.crop_cycle.complete',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          if (cycle.status !== 'active') {
            throw new AgricultureStateError('Only active Crop Cycles can be completed');
          }
          const harvests = await repository.listHarvests({
            tenantId: actor.tenantId,
            cropCycleId: cycle.id,
          });
          const disposition = command.completionDisposition;
          const reason = command.completionReason?.trim();
          if (harvests.length === 0) {
            this.assertCompletionWithoutHarvest(disposition, reason);
          }

          const now = this.clock.now();
          const completedAt = command.completedAt ?? now;
          const updated: CropCycle = {
            ...cycle,
            status: 'completed',
            completedAt,
            completionDisposition: disposition ?? 'completed_with_harvest',
            completionReason: reason,
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.saveCropCycle(updated);
          await repository.saveCropCycleEvent(this.cycleEvent(
            actor,
            cycle.id,
            'active',
            'completed',
            reason,
            updated.completionDisposition,
            completedAt
          ));
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'crop_cycle', cycle.id, 'crop_cycle.completed', {
            completedAt,
            completionDisposition: updated.completionDisposition,
            completionReason: reason,
          }));
          return updated;
        },
      });
    });
  }

  async cancelCropCycle(
    actor: AgricultureActor,
    command: CancelCropCycleCommand
  ): Promise<IdempotentCommandResult<CropCycle>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');
    this.assertRequiredText(command.cancellationReason, 'cancellationReason');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:crop_cycle:write');

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.crop_cycle.cancel',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          if (cycle.status !== 'planned' && cycle.status !== 'active') {
            throw new AgricultureStateError('Only planned or active Crop Cycles can be cancelled');
          }
          const now = this.clock.now();
          const cancelledAt = command.cancelledAt ?? now;
          const updated: CropCycle = {
            ...cycle,
            status: 'cancelled',
            cancelledAt,
            cancellationReason: command.cancellationReason.trim(),
            updatedBy: actor.userId,
            updatedAt: now,
          };
          await repository.saveCropCycle(updated);
          await repository.saveCropCycleEvent(this.cycleEvent(
            actor,
            cycle.id,
            cycle.status,
            'cancelled',
            updated.cancellationReason,
            undefined,
            cancelledAt
          ));
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'crop_cycle', cycle.id, 'crop_cycle.cancelled', {
            cancelledAt,
            cancellationReason: updated.cancellationReason,
          }));
          return updated;
        },
      });
    });
  }

  async recordCropActivity(
    actor: AgricultureActor,
    command: RecordCropActivityCommand
  ): Promise<IdempotentCommandResult<CropActivityEvidence>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');
    this.assertRequiredText(command.activityType, 'activityType');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:activity:record');
      this.assertActiveCycle(cycle);

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.crop_activity.record',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const now = this.clock.now();
          const activity: CropActivityEvidence = {
            id: this.ids.next('ag_activity'),
            tenantId: actor.tenantId,
            farmId: cycle.farmId,
            plotId: cycle.plotId,
            cropCycleId: cycle.id,
            orgUnitId: cycle.orgUnitId,
            activityType: command.activityType,
            occurredAt: command.occurredAt ?? now,
            evidence: command.evidence ?? {},
            recordedBy: actor.userId,
            recordedAt: now,
          };
          await repository.saveCropActivity(activity);
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'crop_activity', activity.id, 'crop_activity.recorded', {
            cropCycleId: cycle.id,
            activityType: activity.activityType,
          }));
          return activity;
        },
      });
    });
  }

  async recordMaterialUsage(
    actor: AgricultureActor,
    command: RecordMaterialUsageCommand
  ): Promise<IdempotentCommandResult<MaterialUsageEvidence>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');
    this.assertRequiredText(command.plotId, 'plotId');
    this.assertRequiredText(command.materialId, 'materialId');
    this.assertNonNegativeQuantity(command.quantity, 'quantity');
    this.assertRequiredText(command.uom, 'uom');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:material_usage:record');
      this.assertActiveCycle(cycle);
      this.assertCyclePlotReference(cycle, command.plotId);

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.material_usage.record',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const now = this.clock.now();
          const usage: MaterialUsageEvidence = {
            id: this.ids.next('ag_material_usage'),
            tenantId: actor.tenantId,
            farmId: cycle.farmId,
            plotId: cycle.plotId,
            cropCycleId: cycle.id,
            orgUnitId: cycle.orgUnitId,
            materialId: command.materialId,
            materialName: command.materialName,
            quantity: command.quantity,
            uom: command.uom,
            occurredAt: command.occurredAt ?? now,
            evidence: command.evidence ?? {},
            recordedBy: actor.userId,
            recordedAt: now,
          };
          await repository.saveMaterialUsage(usage);
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'material_usage', usage.id, 'material_usage.recorded', {
            cropCycleId: cycle.id,
            materialId: usage.materialId,
            quantity: usage.quantity,
            uom: usage.uom,
          }));
          return usage;
        },
      });
    });
  }

  async recordHarvest(
    actor: AgricultureActor,
    command: RecordHarvestCommand
  ): Promise<IdempotentCommandResult<HarvestEvidence>> {
    this.assertRequiredText(command.cropCycleId, 'cropCycleId');
    this.assertRequiredText(command.plotId, 'plotId');
    this.assertNonNegativeQuantity(command.quantity, 'quantity');
    this.assertRequiredText(command.uom, 'uom');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, command.cropCycleId, 'agriculture:harvest:record');
      this.assertActiveCycle(cycle);
      this.assertCyclePlotReference(cycle, command.plotId);

      return this.runIdempotent({
        actor,
        repository,
        orgUnitId: cycle.orgUnitId,
        operation: 'agriculture.harvest.record',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          const now = this.clock.now();
          const harvest: HarvestEvidence = {
            id: this.ids.next('ag_harvest'),
            tenantId: actor.tenantId,
            farmId: cycle.farmId,
            plotId: cycle.plotId,
            cropCycleId: cycle.id,
            orgUnitId: cycle.orgUnitId,
            harvestBatchCode: command.harvestBatchCode,
            cropName: cycle.cropName,
            quantity: command.quantity,
            uom: command.uom,
            qualityGrade: command.qualityGrade,
            harvestedAt: command.harvestedAt ?? now,
            evidence: command.evidence ?? {},
            recordedBy: actor.userId,
            recordedAt: now,
          };
          await repository.saveHarvest(harvest);
          await repository.saveDomainEvent(this.domainEvent(actor, cycle.orgUnitId, 'harvest', harvest.id, 'harvest.recorded', {
            cropCycleId: cycle.id,
            quantity: harvest.quantity,
            uom: harvest.uom,
          }));
          return harvest;
        },
      });
    });
  }

  async getCropCycleTrace(
    actor: AgricultureActor,
    params: { cropCycleId: AgricultureId }
  ): Promise<CropCycleTrace> {
    this.assertRequiredText(params.cropCycleId, 'cropCycleId');

    return this.repository.withTransaction(async (repository) => {
      const cycle = await this.getAuthorizedCycle(repository, actor, params.cropCycleId, 'agriculture:foundation:read');
      const [farm, plot, lifecycleEvents, activities, materialUsages, harvests, domainEvents] = await Promise.all([
        repository.getFarm(actor.tenantId, cycle.farmId),
        repository.getPlot(actor.tenantId, cycle.plotId),
        repository.listCropCycleEvents({ tenantId: actor.tenantId, cropCycleId: cycle.id }),
        repository.listCropActivities({ tenantId: actor.tenantId, cropCycleId: cycle.id }),
        repository.listMaterialUsages({ tenantId: actor.tenantId, cropCycleId: cycle.id }),
        repository.listHarvests({ tenantId: actor.tenantId, cropCycleId: cycle.id }),
        repository.listDomainEvents({ tenantId: actor.tenantId, entityId: cycle.id }),
      ]);
      if (!farm) throw new AgricultureNotFoundError('Farm', cycle.farmId);
      if (!plot) throw new AgricultureNotFoundError('Plot', cycle.plotId);
      return {
        farm,
        plot,
        cropCycle: cycle,
        lifecycleEvents,
        activities,
        materialUsages,
        harvests,
        domainEvents,
      };
    });
  }

  private async getAuthorizedFarm(
    repository: AgricultureRepository,
    actor: AgricultureActor,
    farmId: AgricultureId,
    permission: Parameters<AgricultureAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<Farm> {
    const farm = await repository.getFarm(actor.tenantId, farmId);
    if (!farm) throw new AgricultureNotFoundError('Farm', farmId);
    await this.authorization.ensureAllowed({
      actor,
      tenantId: actor.tenantId,
      orgUnitId: farm.orgUnitId,
      permission,
    });
    return farm;
  }

  private async getAuthorizedPlot(
    repository: AgricultureRepository,
    actor: AgricultureActor,
    plotId: AgricultureId,
    permission: Parameters<AgricultureAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<{ farm: Farm; plot: Plot }> {
    const plot = await repository.getPlot(actor.tenantId, plotId);
    if (!plot) throw new AgricultureNotFoundError('Plot', plotId);
    const farm = await this.getAuthorizedFarm(repository, actor, plot.farmId, permission);
    return { farm, plot };
  }

  private async getAuthorizedCycle(
    repository: AgricultureRepository,
    actor: AgricultureActor,
    cropCycleId: AgricultureId,
    permission: Parameters<AgricultureAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<CropCycle> {
    const cycle = await repository.getCropCycle(actor.tenantId, cropCycleId);
    if (!cycle) throw new AgricultureNotFoundError('CropCycle', cropCycleId);
    await this.authorization.ensureAllowed({
      actor,
      tenantId: actor.tenantId,
      orgUnitId: cycle.orgUnitId,
      permission,
    });
    return cycle;
  }

  private async runIdempotent<T>(params: {
    actor: AgricultureActor;
    repository: AgricultureRepository;
    orgUnitId: OrgUnitId;
    operation: string;
    businessKey: string;
    payload: CommandPayload;
    execute: () => Promise<T>;
  }): Promise<IdempotentCommandResult<T>> {
    this.assertRequiredText(params.businessKey, 'idempotencyKey');
    const payloadHash = hashPayload(params.payload);
    const existing = await params.repository.getCommandLog<T>({
      tenantId: params.actor.tenantId,
      operation: params.operation,
      businessKey: params.businessKey,
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new AgricultureIdempotencyConflictError();
      }
      return { value: existing.result, isDuplicate: true };
    }

    const result = await params.execute();
    const entry: CommandLogEntry<T> = {
      tenantId: params.actor.tenantId,
      orgUnitId: params.orgUnitId,
      operation: params.operation,
      businessKey: params.businessKey,
      payloadHash,
      result,
      createdAt: this.clock.now(),
    };
    await params.repository.saveCommandLog(entry);
    return { value: result, isDuplicate: false };
  }

  private cycleEvent(
    actor: AgricultureActor,
    cropCycleId: AgricultureId,
    fromStatus: CropCycle['status'] | undefined,
    toStatus: CropCycle['status'],
    reason?: string,
    disposition?: CropCycleCompletionDisposition,
    recordedAt = this.clock.now()
  ): CropCycleEvent {
    return {
      id: this.ids.next('ag_cycle_event'),
      tenantId: actor.tenantId,
      cropCycleId,
      fromStatus,
      toStatus,
      reason,
      disposition,
      recordedBy: actor.userId,
      recordedAt,
    };
  }

  private domainEvent(
    actor: AgricultureActor,
    orgUnitId: OrgUnitId,
    entityType: AgricultureDomainEvent['entityType'],
    entityId: AgricultureId,
    eventType: string,
    payload: Record<string, unknown>
  ): AgricultureDomainEvent {
    return {
      id: this.ids.next('ag_domain_event'),
      tenantId: actor.tenantId,
      orgUnitId,
      entityType,
      entityId,
      eventType,
      payload,
      recordedBy: actor.userId,
      recordedAt: this.clock.now(),
    };
  }

  private assertRequiredText(value: string | undefined, field: string): void {
    if (!value || value.trim().length === 0) {
      throw new AgricultureValidationError(`${field} is required`);
    }
  }

  private assertNonNegativeQuantity(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new AgricultureValidationError(`${field} must be nonnegative`);
    }
  }

  private assertFarmActive(farm: Farm): void {
    if (farm.status !== 'active') {
      throw new AgricultureStateError('Farm must be active');
    }
  }

  private assertPlotActive(plot: Plot): void {
    if (plot.status !== 'active') {
      throw new AgricultureStateError('Plot must be active');
    }
  }

  private assertActiveCycle(cycle: CropCycle): void {
    if (cycle.status !== 'active') {
      throw new AgricultureStateError('Operation requires an active Crop Cycle');
    }
  }

  private assertCyclePlotReference(cycle: CropCycle, plotId: AgricultureId): void {
    if (cycle.plotId !== plotId) {
      throw new AgricultureValidationError('Operation plotId must match the Crop Cycle plot');
    }
  }

  private assertCompletionWithoutHarvest(
    disposition: CropCycleCompletionDisposition | undefined,
    reason: string | undefined
  ): void {
    if (!disposition || disposition === 'completed_with_harvest') {
      throw new AgricultureValidationError(
        'Completion without Harvest requires a non-harvest completion disposition'
      );
    }
    if (!reason) {
      throw new AgricultureValidationError('Completion without Harvest requires a completion reason');
    }
  }
}

function hashPayload(payload: CommandPayload): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}
