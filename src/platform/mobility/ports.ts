import type {
  AvailableMobilityVehicle,
  MobilityActor,
  MobilityCommandLogEntry,
  MobilityDomainEvent,
  MobilityId,
  MobilityPermission,
  MobilityServiceHistoryEntry,
  MobilityVehicle,
  MobilityVehicleOwnership,
  MobilityVehicleStatus,
  MobilityVehicleStatusLog,
  TenantId,
} from './domain/types';

export interface MobilityAuthorizationPort {
  ensureAllowed(params: {
    actor: MobilityActor;
    tenantId: TenantId;
    permission: MobilityPermission;
  }): Promise<void>;
}

export interface MobilityRepository {
  withTransaction<T>(callback: (repository: MobilityRepository) => Promise<T>): Promise<T>;
  saveVehicle(vehicle: MobilityVehicle): Promise<void>;
  getVehicle(tenantId: TenantId, id: MobilityId): Promise<MobilityVehicle | null>;
  findVehicleByVin(params: { tenantId: TenantId; vin: string }): Promise<MobilityVehicle | null>;
  saveVehicleStatusLog(log: MobilityVehicleStatusLog): Promise<void>;
  listVehicleStatusLogs(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleStatusLog[]>;
  saveVehicleOwnership(ownership: MobilityVehicleOwnership): Promise<void>;
  listVehicleOwnerships(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleOwnership[]>;
  listVehicleServiceHistory(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityServiceHistoryEntry[]>;
  listAvailableVehicles(params: {
    tenantId: TenantId;
    variantId: MobilityId;
    colorExterior?: string;
    statuses: readonly MobilityVehicleStatus[];
  }): Promise<AvailableMobilityVehicle[]>;
  saveDomainEvent(event: MobilityDomainEvent): Promise<void>;
  listDomainEvents(params: {
    tenantId: TenantId;
    entityId: MobilityId;
  }): Promise<MobilityDomainEvent[]>;
  getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<MobilityCommandLogEntry<T> | null>;
  saveCommandLog<T>(entry: MobilityCommandLogEntry<T>): Promise<void>;
}

export interface MobilityIdFactory {
  next(prefix: string): MobilityId;
}

export interface MobilityClock {
  now(): string;
}
