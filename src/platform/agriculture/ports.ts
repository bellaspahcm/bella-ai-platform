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

export interface AgricultureAuthorizationPort {
  ensureAllowed(params: {
    actor: AgricultureActor;
    tenantId: TenantId;
    orgUnitId: OrgUnitId;
    permission: AgriculturePermission;
  }): Promise<void>;
}

export interface AgricultureRepository {
  withTransaction<T>(callback: (repository: AgricultureRepository) => Promise<T>): Promise<T>;
  saveFarm(farm: Farm): Promise<void>;
  getFarm(tenantId: TenantId, id: AgricultureId): Promise<Farm | null>;
  findFarmByCode(params: { tenantId: TenantId; farmCode: string }): Promise<Farm | null>;
  savePlot(plot: Plot): Promise<void>;
  getPlot(tenantId: TenantId, id: AgricultureId): Promise<Plot | null>;
  findPlotByCode(params: {
    tenantId: TenantId;
    farmId: AgricultureId;
    plotCode: string;
  }): Promise<Plot | null>;
  saveCropCycle(cropCycle: CropCycle): Promise<void>;
  getCropCycle(tenantId: TenantId, id: AgricultureId): Promise<CropCycle | null>;
  findCropCycleByCode(params: {
    tenantId: TenantId;
    plotId: AgricultureId;
    cycleCode: string;
  }): Promise<CropCycle | null>;
  saveCropCycleEvent(event: CropCycleEvent): Promise<void>;
  listCropCycleEvents(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropCycleEvent[]>;
  saveCropActivity(activity: CropActivityEvidence): Promise<void>;
  listCropActivities(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropActivityEvidence[]>;
  saveMaterialUsage(usage: MaterialUsageEvidence): Promise<void>;
  listMaterialUsages(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<MaterialUsageEvidence[]>;
  saveHarvest(harvest: HarvestEvidence): Promise<void>;
  listHarvests(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<HarvestEvidence[]>;
  saveDomainEvent(event: AgricultureDomainEvent): Promise<void>;
  listDomainEvents(params: {
    tenantId: TenantId;
    entityId: AgricultureId;
  }): Promise<AgricultureDomainEvent[]>;
  getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null>;
  saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void>;
}

export interface AgricultureIdFactory {
  next(prefix: string): AgricultureId;
}

export interface AgricultureClock {
  now(): string;
}
