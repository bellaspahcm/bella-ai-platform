import { createHash } from 'crypto';

import {
  MobilityIdempotencyConflictError,
  MobilityNotFoundError,
  MobilityStateError,
  MobilityValidationError,
} from './domain/errors';
import type {
  IdempotentCommandResult,
  LinkVehicleOwnerCommand,
  MobilityActor,
  MobilityCommandLogEntry,
  MobilityDomainEvent,
  MobilityId,
  MobilityOwnershipType,
  MobilityVehicle,
  MobilityVehicleOwnership,
  MobilityVehicleStatus,
  MobilityVehicleStatusLog,
  MobilityVehicleTrace,
  RegisterVehicleCommand,
  TransitionVehicleStatusCommand,
} from './domain/types';
import {
  MOBILITY_ALLOWED_STATUS_TRANSITIONS,
} from './domain/types';
import type {
  MobilityAuthorizationPort,
  MobilityClock,
  MobilityIdFactory,
  MobilityRepository,
} from './ports';

type CommandPayload = unknown;

export class MobilityFoundationService {
  constructor(
    private readonly repository: MobilityRepository,
    private readonly authorization: MobilityAuthorizationPort,
    private readonly ids: MobilityIdFactory,
    private readonly clock: MobilityClock
  ) {}

  async registerVehicle(
    actor: MobilityActor,
    command: RegisterVehicleCommand
  ): Promise<IdempotentCommandResult<MobilityVehicle>> {
    this.assertRequiredText(command.variantId, 'variantId');
    const vin = this.normalizeVin(command.vin);
    this.assertRequiredText(command.colorExterior, 'colorExterior');
    this.assertPositiveInteger(command.modelYear, 'modelYear');

    return this.repository.withTransaction(async (repository) => {
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        permission: 'mobility:vehicle:write',
      });

      return this.runIdempotent({
        actor,
        repository,
        operation: 'mobility.vehicle.register',
        businessKey: command.idempotencyKey,
        payload: { ...command, vin },
        execute: async () => {
          const existing = await repository.findVehicleByVin({
            tenantId: actor.tenantId,
            vin,
          });
          if (existing) {
            throw new MobilityValidationError('VIN already exists for tenant');
          }

          const now = this.clock.now();
          const vehicle: MobilityVehicle = {
            id: this.ids.next('mobility_vehicle'),
            tenantId: actor.tenantId,
            variantId: command.variantId,
            vin,
            chassisNumber: this.optionalText(command.chassisNumber),
            engineNumber: this.optionalText(command.engineNumber),
            colorExterior: command.colorExterior.trim(),
            colorInterior: this.optionalText(command.colorInterior),
            modelYear: command.modelYear,
            listPrice: command.listPrice ?? 0,
            costPrice: command.costPrice ?? 0,
            status: 'in_transit',
            locationNote: this.optionalText(command.locationNote),
            expectedArrivalDate: this.optionalText(command.expectedArrivalDate),
            actualArrivalDate: this.optionalText(command.actualArrivalDate),
            importDeclarationNumber: this.optionalText(command.importDeclarationNumber),
            metadata: command.metadata ?? {},
            createdAt: now,
            updatedAt: now,
          };
          await repository.saveVehicle(vehicle);
          await repository.saveVehicleStatusLog(this.statusLog(actor, vehicle.id, undefined, 'in_transit', 'vehicle.registered'));
          await repository.saveDomainEvent(this.domainEvent(actor, 'vehicle', vehicle.id, 'vehicle.registered', {
            vin: vehicle.vin,
            variantId: vehicle.variantId,
          }));
          return vehicle;
        },
      });
    });
  }

  async transitionVehicleStatus(
    actor: MobilityActor,
    command: TransitionVehicleStatusCommand
  ): Promise<IdempotentCommandResult<MobilityVehicle>> {
    this.assertRequiredText(command.vehicleId, 'vehicleId');
    this.assertVehicleStatus(command.toStatus);

    return this.repository.withTransaction(async (repository) => {
      const vehicle = await this.getAuthorizedVehicle(
        repository,
        actor,
        command.vehicleId,
        'mobility:vehicle:write'
      );

      return this.runIdempotent({
        actor,
        repository,
        operation: 'mobility.vehicle.transition',
        businessKey: command.idempotencyKey,
        payload: command,
        execute: async () => {
          this.assertTransition(vehicle.status, command.toStatus);
          const now = this.clock.now();
          const updated: MobilityVehicle = {
            ...vehicle,
            status: command.toStatus,
            updatedAt: now,
          };

          if (command.toStatus === 'allocated') {
            this.assertRequiredText(command.allocatedToContractId, 'allocatedToContractId');
            updated.allocatedToContractId = command.allocatedToContractId;
            updated.allocatedAt = now;
            updated.allocatedByUserId = actor.userId;
          }

          if (command.toStatus === 'delivered') {
            this.assertRequiredText(command.deliveredToCustomerId, 'deliveredToCustomerId');
            updated.deliveredAt = now;
            updated.deliveredToCustomerId = command.deliveredToCustomerId;
            updated.deliveryNotes = this.optionalText(command.deliveryNotes);
          }

          if (vehicle.status === 'allocated' && command.toStatus === 'showroom') {
            updated.allocatedToContractId = undefined;
            updated.allocatedAt = undefined;
            updated.allocatedByUserId = undefined;
          }

          await repository.saveVehicle(updated);
          await repository.saveVehicleStatusLog(this.statusLog(
            actor,
            vehicle.id,
            vehicle.status,
            updated.status,
            command.reason,
            command.metadata
          ));
          await repository.saveDomainEvent(this.domainEvent(actor, 'vehicle_status', vehicle.id, 'vehicle.status_changed', {
            fromStatus: vehicle.status,
            toStatus: updated.status,
            reason: command.reason,
          }));
          return updated;
        },
      });
    });
  }

  async linkVehicleOwner(
    actor: MobilityActor,
    command: LinkVehicleOwnerCommand
  ): Promise<IdempotentCommandResult<MobilityVehicleOwnership>> {
    this.assertRequiredText(command.vehicleId, 'vehicleId');
    this.assertRequiredText(command.customerId, 'customerId');
    const ownershipType = command.ownershipType ?? 'primary';
    this.assertOwnershipType(ownershipType);

    return this.repository.withTransaction(async (repository) => {
      const vehicle = await this.getAuthorizedVehicle(
        repository,
        actor,
        command.vehicleId,
        'mobility:ownership:write'
      );

      return this.runIdempotent({
        actor,
        repository,
        operation: 'mobility.vehicle_owner.link',
        businessKey: command.idempotencyKey,
        payload: { ...command, ownershipType },
        execute: async () => {
          const ownerships = await repository.listVehicleOwnerships({
            tenantId: actor.tenantId,
            vehicleId: vehicle.id,
          });
          const activeDuplicate = ownerships.find((ownership) =>
            ownership.isActive && ownership.ownershipType === ownershipType
          );
          if (activeDuplicate) {
            throw new MobilityValidationError('Active ownership of this type already exists for vehicle');
          }

          const now = this.clock.now();
          const ownership: MobilityVehicleOwnership = {
            id: this.ids.next('mobility_owner'),
            tenantId: actor.tenantId,
            customerId: command.customerId,
            vehicleId: vehicle.id,
            ownershipType,
            licensePlate: this.optionalText(command.licensePlate),
            registrationDate: this.optionalText(command.registrationDate),
            isActive: true,
            metadata: command.metadata ?? {},
            createdAt: now,
            updatedAt: now,
          };
          await repository.saveVehicleOwnership(ownership);
          await repository.saveDomainEvent(this.domainEvent(actor, 'vehicle_owner', ownership.id, 'vehicle_owner.linked', {
            vehicleId: vehicle.id,
            customerId: ownership.customerId,
            ownershipType: ownership.ownershipType,
          }));
          return ownership;
        },
      });
    });
  }

  async getVehicleTrace(
    actor: MobilityActor,
    params: { vehicleId: MobilityId }
  ): Promise<MobilityVehicleTrace> {
    this.assertRequiredText(params.vehicleId, 'vehicleId');

    return this.repository.withTransaction(async (repository) => {
      const vehicle = await this.getAuthorizedVehicle(
        repository,
        actor,
        params.vehicleId,
        'mobility:foundation:read'
      );
      const [lifecycleEvents, ownerships, serviceHistory, domainEvents] = await Promise.all([
        repository.listVehicleStatusLogs({ tenantId: actor.tenantId, vehicleId: vehicle.id }),
        repository.listVehicleOwnerships({ tenantId: actor.tenantId, vehicleId: vehicle.id }),
        repository.listVehicleServiceHistory({ tenantId: actor.tenantId, vehicleId: vehicle.id }),
        repository.listDomainEvents({ tenantId: actor.tenantId, entityId: vehicle.id }),
      ]);
      return {
        vehicle,
        lifecycleEvents,
        ownerships,
        serviceHistory,
        domainEvents,
      };
    });
  }

  private async getAuthorizedVehicle(
    repository: MobilityRepository,
    actor: MobilityActor,
    vehicleId: MobilityId,
    permission: Parameters<MobilityAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<MobilityVehicle> {
    const vehicle = await repository.getVehicle(actor.tenantId, vehicleId);
    if (!vehicle) throw new MobilityNotFoundError('Vehicle', vehicleId);
    await this.authorization.ensureAllowed({
      actor,
      tenantId: actor.tenantId,
      permission,
    });
    return vehicle;
  }

  private async runIdempotent<T>(params: {
    actor: MobilityActor;
    repository: MobilityRepository;
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
        throw new MobilityIdempotencyConflictError();
      }
      return { value: existing.result, isDuplicate: true };
    }

    const result = await params.execute();
    const entry: MobilityCommandLogEntry<T> = {
      tenantId: params.actor.tenantId,
      orgUnitId: params.actor.orgUnitId,
      operation: params.operation,
      businessKey: params.businessKey,
      payloadHash,
      result,
      createdAt: this.clock.now(),
    };
    await params.repository.saveCommandLog(entry);
    return { value: result, isDuplicate: false };
  }

  private statusLog(
    actor: MobilityActor,
    vehicleId: MobilityId,
    fromStatus: MobilityVehicleStatus | undefined,
    toStatus: MobilityVehicleStatus,
    reason?: string,
    metadata?: Record<string, unknown>
  ): MobilityVehicleStatusLog {
    return {
      id: this.ids.next('mobility_status_log'),
      tenantId: actor.tenantId,
      vehicleId,
      fromStatus,
      toStatus,
      changedByUserId: actor.userId,
      reason: this.optionalText(reason),
      metadata: metadata ?? {},
      createdAt: this.clock.now(),
    };
  }

  private domainEvent(
    actor: MobilityActor,
    entityType: MobilityDomainEvent['entityType'],
    entityId: MobilityId,
    eventType: string,
    payload: Record<string, unknown>
  ): MobilityDomainEvent {
    return {
      id: this.ids.next('mobility_domain_event'),
      tenantId: actor.tenantId,
      orgUnitId: actor.orgUnitId,
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
      throw new MobilityValidationError(`${field} is required`);
    }
  }

  private optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private normalizeVin(value: string): string {
    this.assertRequiredText(value, 'vin');
    const vin = value.trim().toUpperCase();
    if (vin.length !== 17) {
      throw new MobilityValidationError('vin must be 17 characters');
    }
    return vin;
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new MobilityValidationError(`${field} must be a positive integer`);
    }
  }

  private assertVehicleStatus(value: MobilityVehicleStatus): void {
    if (!(value in MOBILITY_ALLOWED_STATUS_TRANSITIONS)) {
      throw new MobilityValidationError(`Unsupported vehicle status: ${value}`);
    }
  }

  private assertTransition(fromStatus: MobilityVehicleStatus, toStatus: MobilityVehicleStatus): void {
    if (!MOBILITY_ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new MobilityStateError(
        `Cannot transition vehicle from ${fromStatus} to ${toStatus}`
      );
    }
  }

  private assertOwnershipType(value: MobilityOwnershipType): void {
    if (value !== 'primary' && value !== 'co_owner' && value !== 'user') {
      throw new MobilityValidationError(`Unsupported ownership type: ${value}`);
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
