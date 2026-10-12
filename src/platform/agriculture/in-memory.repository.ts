import {
  AgricultureAuthorizationError,
  AgricultureIdempotencyConflictError,
} from './domain/errors';
import type {
  AgricultureActor,
  AgricultureDomainEvent,
  AgricultureId,
  AgriculturePermission,
  CommandLogEntry,
  CropActivityEvidence,
  CropCycle,
  CropCycleEvent,
  Farm,
  HarvestEvidence,
  MaterialUsageEvidence,
  OrgUnitId,
  Plot,
  TenantId,
} from './domain/types';
import type {
  AgricultureAuthorizationPort,
  AgricultureClock,
  AgricultureIdFactory,
  AgricultureRepository,
} from './ports';

export class SequentialAgricultureIdFactory implements AgricultureIdFactory {
  private nextValue = 1;

  next(prefix: string): AgricultureId {
    const id = `${prefix}_${this.nextValue.toString().padStart(6, '0')}`;
    this.nextValue += 1;
    return id;
  }
}

export class FixedAgricultureClock implements AgricultureClock {
  constructor(private readonly timestamp: string = '2026-10-12T00:00:00.000Z') {}

  now(): string {
    return this.timestamp;
  }
}

export class InMemoryAgricultureRepository implements AgricultureRepository {
  private readonly farms = new Map<string, Farm>();
  private readonly plots = new Map<string, Plot>();
  private readonly cropCycles = new Map<string, CropCycle>();
  private readonly cropCycleEvents = new Map<string, CropCycleEvent>();
  private readonly cropActivities = new Map<string, CropActivityEvidence>();
  private readonly materialUsages = new Map<string, MaterialUsageEvidence>();
  private readonly harvests = new Map<string, HarvestEvidence>();
  private readonly domainEvents = new Map<string, AgricultureDomainEvent>();
  private readonly commandLogs = new Map<string, CommandLogEntry<unknown>>();

  async withTransaction<T>(callback: (repository: AgricultureRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async saveFarm(farm: Farm): Promise<void> {
    this.farms.set(this.key(farm.tenantId, farm.id), { ...farm });
  }

  async getFarm(tenantId: TenantId, id: AgricultureId): Promise<Farm | null> {
    const farm = this.farms.get(this.key(tenantId, id));
    return farm ? { ...farm } : null;
  }

  async findFarmByCode(params: { tenantId: TenantId; farmCode: string }): Promise<Farm | null> {
    for (const farm of this.farms.values()) {
      if (farm.tenantId === params.tenantId && farm.farmCode === params.farmCode) {
        return { ...farm };
      }
    }
    return null;
  }

  async savePlot(plot: Plot): Promise<void> {
    this.plots.set(this.key(plot.tenantId, plot.id), { ...plot });
  }

  async getPlot(tenantId: TenantId, id: AgricultureId): Promise<Plot | null> {
    const plot = this.plots.get(this.key(tenantId, id));
    return plot ? { ...plot } : null;
  }

  async findPlotByCode(params: {
    tenantId: TenantId;
    farmId: AgricultureId;
    plotCode: string;
  }): Promise<Plot | null> {
    for (const plot of this.plots.values()) {
      if (
        plot.tenantId === params.tenantId &&
        plot.farmId === params.farmId &&
        plot.plotCode === params.plotCode
      ) {
        return { ...plot };
      }
    }
    return null;
  }

  async saveCropCycle(cropCycle: CropCycle): Promise<void> {
    this.cropCycles.set(this.key(cropCycle.tenantId, cropCycle.id), { ...cropCycle });
  }

  async getCropCycle(tenantId: TenantId, id: AgricultureId): Promise<CropCycle | null> {
    const cycle = this.cropCycles.get(this.key(tenantId, id));
    return cycle ? { ...cycle } : null;
  }

  async findCropCycleByCode(params: {
    tenantId: TenantId;
    plotId: AgricultureId;
    cycleCode: string;
  }): Promise<CropCycle | null> {
    for (const cycle of this.cropCycles.values()) {
      if (
        cycle.tenantId === params.tenantId &&
        cycle.plotId === params.plotId &&
        cycle.cycleCode === params.cycleCode
      ) {
        return { ...cycle };
      }
    }
    return null;
  }

  async saveCropCycleEvent(event: CropCycleEvent): Promise<void> {
    this.cropCycleEvents.set(this.key(event.tenantId, event.id), { ...event });
  }

  async listCropCycleEvents(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropCycleEvent[]> {
    return Array.from(this.cropCycleEvents.values())
      .filter((event) => event.tenantId === params.tenantId && event.cropCycleId === params.cropCycleId)
      .sort((left, right) => `${left.recordedAt}:${left.id}`.localeCompare(`${right.recordedAt}:${right.id}`))
      .map((event) => ({ ...event }));
  }

  async saveCropActivity(activity: CropActivityEvidence): Promise<void> {
    this.cropActivities.set(this.key(activity.tenantId, activity.id), cloneActivity(activity));
  }

  async listCropActivities(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropActivityEvidence[]> {
    return Array.from(this.cropActivities.values())
      .filter((activity) => activity.tenantId === params.tenantId && activity.cropCycleId === params.cropCycleId)
      .sort((left, right) => `${left.occurredAt}:${left.id}`.localeCompare(`${right.occurredAt}:${right.id}`))
      .map(cloneActivity);
  }

  async saveMaterialUsage(usage: MaterialUsageEvidence): Promise<void> {
    this.materialUsages.set(this.key(usage.tenantId, usage.id), cloneMaterialUsage(usage));
  }

  async listMaterialUsages(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<MaterialUsageEvidence[]> {
    return Array.from(this.materialUsages.values())
      .filter((usage) => usage.tenantId === params.tenantId && usage.cropCycleId === params.cropCycleId)
      .sort((left, right) => `${left.occurredAt}:${left.id}`.localeCompare(`${right.occurredAt}:${right.id}`))
      .map(cloneMaterialUsage);
  }

  async saveHarvest(harvest: HarvestEvidence): Promise<void> {
    this.harvests.set(this.key(harvest.tenantId, harvest.id), cloneHarvest(harvest));
  }

  async listHarvests(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<HarvestEvidence[]> {
    return Array.from(this.harvests.values())
      .filter((harvest) => harvest.tenantId === params.tenantId && harvest.cropCycleId === params.cropCycleId)
      .sort((left, right) => `${left.harvestedAt}:${left.id}`.localeCompare(`${right.harvestedAt}:${right.id}`))
      .map(cloneHarvest);
  }

  async saveDomainEvent(event: AgricultureDomainEvent): Promise<void> {
    this.domainEvents.set(this.key(event.tenantId, event.id), cloneDomainEvent(event));
  }

  async listDomainEvents(params: {
    tenantId: TenantId;
    entityId: AgricultureId;
  }): Promise<AgricultureDomainEvent[]> {
    return Array.from(this.domainEvents.values())
      .filter((event) => event.tenantId === params.tenantId && event.entityId === params.entityId)
      .sort((left, right) => `${left.recordedAt}:${left.id}`.localeCompare(`${right.recordedAt}:${right.id}`))
      .map(cloneDomainEvent);
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null> {
    const entry = this.commandLogs.get(this.commandKey(params.tenantId, params.operation, params.businessKey));
    return entry ? (cloneCommandLog(entry) as CommandLogEntry<T>) : null;
  }

  async saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void> {
    const key = this.commandKey(entry.tenantId, entry.operation, entry.businessKey);
    const existing = this.commandLogs.get(key);
    if (existing && existing.payloadHash !== entry.payloadHash) {
      throw new AgricultureIdempotencyConflictError();
    }
    this.commandLogs.set(key, cloneCommandLog(entry));
  }

  private key(tenantId: TenantId, id: AgricultureId): string {
    return `${tenantId}:${id}`;
  }

  private commandKey(tenantId: TenantId, operation: string, businessKey: string): string {
    return `${tenantId}:${operation}:${businessKey}`;
  }
}

export class StaticAgricultureAuthorization implements AgricultureAuthorizationPort {
  constructor(
    private readonly allowedOrgUnitByUser: Record<string, OrgUnitId>,
    private readonly permissionsByUser: Record<string, AgriculturePermission[]>
  ) {}

  async ensureAllowed(params: {
    actor: AgricultureActor;
    tenantId: TenantId;
    orgUnitId: OrgUnitId;
    permission: AgriculturePermission;
  }): Promise<void> {
    const allowedOrgUnit = this.allowedOrgUnitByUser[params.actor.userId];
    const permissions = this.permissionsByUser[params.actor.userId] ?? [];
    if (
      params.actor.tenantId !== params.tenantId ||
      params.actor.orgUnitId !== params.orgUnitId ||
      allowedOrgUnit !== params.orgUnitId ||
      !permissions.includes(params.permission)
    ) {
      throw new AgricultureAuthorizationError();
    }
  }
}

function cloneActivity(activity: CropActivityEvidence): CropActivityEvidence {
  return {
    ...activity,
    evidence: { ...activity.evidence },
  };
}

function cloneMaterialUsage(usage: MaterialUsageEvidence): MaterialUsageEvidence {
  return {
    ...usage,
    evidence: { ...usage.evidence },
  };
}

function cloneHarvest(harvest: HarvestEvidence): HarvestEvidence {
  return {
    ...harvest,
    evidence: { ...harvest.evidence },
  };
}

function cloneDomainEvent(event: AgricultureDomainEvent): AgricultureDomainEvent {
  return {
    ...event,
    payload: { ...event.payload },
  };
}

function cloneCommandLog<T>(entry: CommandLogEntry<T>): CommandLogEntry<T> {
  return {
    ...entry,
  };
}
