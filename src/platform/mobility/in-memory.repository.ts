import {
  MobilityAuthorizationError,
  MobilityIdempotencyConflictError,
} from './domain/errors';
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
import type {
  MobilityAuthorizationPort,
  MobilityClock,
  MobilityIdFactory,
  MobilityRepository,
} from './ports';

export class SequentialMobilityIdFactory implements MobilityIdFactory {
  private nextValue = 1;

  next(prefix: string): MobilityId {
    const id = `${prefix}_${this.nextValue.toString().padStart(6, '0')}`;
    this.nextValue += 1;
    return id;
  }
}

export class FixedMobilityClock implements MobilityClock {
  constructor(private readonly timestamp: string = '2026-10-13T00:00:00.000Z') {}

  now(): string {
    return this.timestamp;
  }
}

export class InMemoryMobilityRepository implements MobilityRepository {
  private readonly vehicles = new Map<string, MobilityVehicle>();
  private readonly statusLogs = new Map<string, MobilityVehicleStatusLog>();
  private readonly ownerships = new Map<string, MobilityVehicleOwnership>();
  private readonly serviceHistory = new Map<string, MobilityServiceHistoryEntry>();
  private readonly domainEvents = new Map<string, MobilityDomainEvent>();
  private readonly commandLogs = new Map<string, MobilityCommandLogEntry<unknown>>();

  async withTransaction<T>(callback: (repository: MobilityRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async saveVehicle(vehicle: MobilityVehicle): Promise<void> {
    this.vehicles.set(this.key(vehicle.tenantId, vehicle.id), cloneVehicle(vehicle));
  }

  async getVehicle(tenantId: TenantId, id: MobilityId): Promise<MobilityVehicle | null> {
    const vehicle = this.vehicles.get(this.key(tenantId, id));
    return vehicle ? cloneVehicle(vehicle) : null;
  }

  async findVehicleByVin(params: { tenantId: TenantId; vin: string }): Promise<MobilityVehicle | null> {
    const vin = params.vin.toUpperCase();
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.tenantId === params.tenantId && vehicle.vin === vin) {
        return cloneVehicle(vehicle);
      }
    }
    return null;
  }

  async saveVehicleStatusLog(log: MobilityVehicleStatusLog): Promise<void> {
    this.statusLogs.set(this.key(log.tenantId, log.id), cloneStatusLog(log));
  }

  async listVehicleStatusLogs(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleStatusLog[]> {
    return Array.from(this.statusLogs.values())
      .filter((log) => log.tenantId === params.tenantId && log.vehicleId === params.vehicleId)
      .sort((left, right) => `${left.createdAt}:${left.id}`.localeCompare(`${right.createdAt}:${right.id}`))
      .map(cloneStatusLog);
  }

  async saveVehicleOwnership(ownership: MobilityVehicleOwnership): Promise<void> {
    this.ownerships.set(this.key(ownership.tenantId, ownership.id), cloneOwnership(ownership));
  }

  async listVehicleOwnerships(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleOwnership[]> {
    return Array.from(this.ownerships.values())
      .filter((ownership) => ownership.tenantId === params.tenantId && ownership.vehicleId === params.vehicleId)
      .sort((left, right) => `${left.createdAt}:${left.id}`.localeCompare(`${right.createdAt}:${right.id}`))
      .map(cloneOwnership);
  }

  async listVehicleServiceHistory(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityServiceHistoryEntry[]> {
    return Array.from(this.serviceHistory.values())
      .filter((entry) => entry.tenantId === params.tenantId && entry.vehicleId === params.vehicleId)
      .sort((left, right) => `${left.serviceDate}:${left.id}`.localeCompare(`${right.serviceDate}:${right.id}`))
      .map(cloneServiceHistory);
  }

  seedServiceHistory(entry: MobilityServiceHistoryEntry): void {
    this.serviceHistory.set(this.key(entry.tenantId, entry.id), cloneServiceHistory(entry));
  }

  async listAvailableVehicles(params: {
    tenantId: TenantId;
    variantId: MobilityId;
    colorExterior?: string;
    statuses: readonly MobilityVehicleStatus[];
  }): Promise<AvailableMobilityVehicle[]> {
    return Array.from(this.vehicles.values())
      .filter((vehicle) => vehicle.tenantId === params.tenantId)
      .filter((vehicle) => vehicle.variantId === params.variantId)
      .filter((vehicle) => params.statuses.includes(vehicle.status))
      .filter((vehicle) => !params.colorExterior || vehicle.colorExterior === params.colorExterior)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((vehicle) => ({
        id: vehicle.id,
        vin: vehicle.vin,
        colorExterior: vehicle.colorExterior,
        status: vehicle.status,
      }));
  }

  async saveDomainEvent(event: MobilityDomainEvent): Promise<void> {
    this.domainEvents.set(this.key(event.tenantId, event.id), cloneDomainEvent(event));
  }

  async listDomainEvents(params: {
    tenantId: TenantId;
    entityId: MobilityId;
  }): Promise<MobilityDomainEvent[]> {
    return Array.from(this.domainEvents.values())
      .filter((event) => event.tenantId === params.tenantId && event.entityId === params.entityId)
      .sort((left, right) => `${left.recordedAt}:${left.id}`.localeCompare(`${right.recordedAt}:${right.id}`))
      .map(cloneDomainEvent);
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<MobilityCommandLogEntry<T> | null> {
    const entry = this.commandLogs.get(this.commandKey(params.tenantId, params.operation, params.businessKey));
    return entry ? (cloneCommandLog(entry) as MobilityCommandLogEntry<T>) : null;
  }

  async saveCommandLog<T>(entry: MobilityCommandLogEntry<T>): Promise<void> {
    const key = this.commandKey(entry.tenantId, entry.operation, entry.businessKey);
    const existing = this.commandLogs.get(key);
    if (existing && existing.payloadHash !== entry.payloadHash) {
      throw new MobilityIdempotencyConflictError();
    }
    this.commandLogs.set(key, cloneCommandLog(entry));
  }

  private key(tenantId: TenantId, id: MobilityId): string {
    return `${tenantId}:${id}`;
  }

  private commandKey(tenantId: TenantId, operation: string, businessKey: string): string {
    return `${tenantId}:${operation}:${businessKey}`;
  }
}

export class StaticMobilityAuthorization implements MobilityAuthorizationPort {
  constructor(
    private readonly allowedTenantsByUser: Record<string, TenantId>,
    private readonly permissionsByUser: Record<string, MobilityPermission[]>
  ) {}

  async ensureAllowed(params: {
    actor: MobilityActor;
    tenantId: TenantId;
    permission: MobilityPermission;
  }): Promise<void> {
    const allowedTenant = this.allowedTenantsByUser[params.actor.userId];
    const permissions = this.permissionsByUser[params.actor.userId] ?? [];
    if (
      params.actor.tenantId !== params.tenantId ||
      allowedTenant !== params.tenantId ||
      !permissions.includes(params.permission)
    ) {
      throw new MobilityAuthorizationError();
    }
  }
}

function cloneVehicle(vehicle: MobilityVehicle): MobilityVehicle {
  return {
    ...vehicle,
    metadata: { ...vehicle.metadata },
  };
}

function cloneStatusLog(log: MobilityVehicleStatusLog): MobilityVehicleStatusLog {
  return {
    ...log,
    metadata: { ...log.metadata },
  };
}

function cloneOwnership(ownership: MobilityVehicleOwnership): MobilityVehicleOwnership {
  return {
    ...ownership,
    metadata: { ...ownership.metadata },
  };
}

function cloneServiceHistory(entry: MobilityServiceHistoryEntry): MobilityServiceHistoryEntry {
  return {
    ...entry,
    servicesPerformed: entry.servicesPerformed.map((item) => ({ ...item })),
    partsReplaced: entry.partsReplaced.map((item) => ({ ...item })),
  };
}

function cloneDomainEvent(event: MobilityDomainEvent): MobilityDomainEvent {
  return {
    ...event,
    payload: { ...event.payload },
  };
}

function cloneCommandLog<T>(entry: MobilityCommandLogEntry<T>): MobilityCommandLogEntry<T> {
  return {
    ...entry,
  };
}
