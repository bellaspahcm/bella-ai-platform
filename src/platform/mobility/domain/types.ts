export type MobilityId = string;
export type TenantId = string;
export type UserId = string;
export type OrgUnitId = string;

export const MOBILITY_VEHICLE_STATUSES = [
  'in_transit',
  'warehouse',
  'showroom',
  'allocated',
  'delivered',
  'returned',
  'scrapped',
] as const;

export type MobilityVehicleStatus = typeof MOBILITY_VEHICLE_STATUSES[number];

export const MOBILITY_AVAILABLE_FOR_SALE_STATUSES = ['warehouse', 'showroom'] as const;

export const MOBILITY_ALLOWED_STATUS_TRANSITIONS: Record<
  MobilityVehicleStatus,
  readonly MobilityVehicleStatus[]
> = {
  in_transit: ['warehouse', 'returned'],
  warehouse: ['showroom', 'returned', 'scrapped'],
  showroom: ['allocated', 'warehouse', 'returned', 'scrapped'],
  allocated: ['delivered', 'showroom'],
  delivered: ['returned'],
  returned: ['warehouse', 'scrapped'],
  scrapped: [],
};

export type MobilityPermission =
  | 'mobility:foundation:read'
  | 'mobility:vehicle:write'
  | 'mobility:ownership:write';

export type MobilityDomainEventEntityType =
  | 'vehicle'
  | 'vehicle_owner'
  | 'vehicle_status'
  | 'service_history';

export type MobilityOwnershipType = 'primary' | 'co_owner' | 'user';

export interface MobilityActor {
  tenantId: TenantId;
  userId: UserId;
  roles: string[];
  orgUnitId?: OrgUnitId;
}

export interface MobilityVehicle {
  id: MobilityId;
  tenantId: TenantId;
  variantId: MobilityId;
  vin: string;
  chassisNumber?: string;
  engineNumber?: string;
  colorExterior: string;
  colorInterior?: string;
  modelYear: number;
  listPrice: number;
  costPrice: number;
  status: MobilityVehicleStatus;
  locationNote?: string;
  expectedArrivalDate?: string;
  actualArrivalDate?: string;
  importDeclarationNumber?: string;
  allocatedToContractId?: MobilityId;
  allocatedAt?: string;
  allocatedByUserId?: UserId;
  deliveredAt?: string;
  deliveredToCustomerId?: MobilityId;
  deliveryNotes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MobilityVehicleStatusLog {
  id: MobilityId;
  tenantId: TenantId;
  vehicleId: MobilityId;
  fromStatus?: MobilityVehicleStatus;
  toStatus: MobilityVehicleStatus;
  changedByUserId?: UserId;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MobilityVehicleOwnership {
  id: MobilityId;
  tenantId: TenantId;
  customerId: MobilityId;
  vehicleId: MobilityId;
  ownershipType: MobilityOwnershipType;
  licensePlate?: string;
  registrationDate?: string;
  isActive: boolean;
  transferredAt?: string;
  transferNotes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MobilityServiceHistoryEntry {
  id: MobilityId;
  tenantId: TenantId;
  vehicleId: MobilityId;
  vin: string;
  repairOrderId?: MobilityId;
  appointmentId?: MobilityId;
  serviceDate: string;
  serviceType: string;
  serviceDescription: string;
  mileage: number;
  servicesPerformed: Record<string, unknown>[];
  partsReplaced: Record<string, unknown>[];
  laborHours?: number;
  totalCost?: number;
  nextServiceDueDate?: string;
  nextServiceDueMileage?: number;
  recordedBy: UserId;
  recordedAt: string;
}

export interface MobilityDomainEvent {
  id: MobilityId;
  tenantId: TenantId;
  orgUnitId?: OrgUnitId;
  entityType: MobilityDomainEventEntityType;
  entityId: MobilityId;
  eventType: string;
  payload: Record<string, unknown>;
  recordedBy: UserId;
  recordedAt: string;
}

export interface MobilityCommandLogEntry<T = unknown> {
  tenantId: TenantId;
  orgUnitId?: OrgUnitId;
  operation: string;
  businessKey: string;
  payloadHash: string;
  result: T;
  createdAt: string;
}

export interface IdempotentCommandResult<T> {
  value: T;
  isDuplicate: boolean;
}

export interface RegisterVehicleCommand {
  idempotencyKey: string;
  variantId: MobilityId;
  vin: string;
  chassisNumber?: string;
  engineNumber?: string;
  colorExterior: string;
  colorInterior?: string;
  modelYear: number;
  listPrice?: number;
  costPrice?: number;
  locationNote?: string;
  expectedArrivalDate?: string;
  actualArrivalDate?: string;
  importDeclarationNumber?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionVehicleStatusCommand {
  idempotencyKey: string;
  vehicleId: MobilityId;
  toStatus: MobilityVehicleStatus;
  reason?: string;
  allocatedToContractId?: MobilityId;
  deliveredToCustomerId?: MobilityId;
  deliveryNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface LinkVehicleOwnerCommand {
  idempotencyKey: string;
  vehicleId: MobilityId;
  customerId: MobilityId;
  ownershipType?: MobilityOwnershipType;
  licensePlate?: string;
  registrationDate?: string;
  metadata?: Record<string, unknown>;
}

export interface MobilityVehicleTrace {
  vehicle: MobilityVehicle;
  lifecycleEvents: MobilityVehicleStatusLog[];
  ownerships: MobilityVehicleOwnership[];
  serviceHistory: MobilityServiceHistoryEntry[];
  domainEvents: MobilityDomainEvent[];
}

export interface AvailableMobilityVehicle {
  id: MobilityId;
  vin: string;
  colorExterior: string;
  status: MobilityVehicleStatus;
}
