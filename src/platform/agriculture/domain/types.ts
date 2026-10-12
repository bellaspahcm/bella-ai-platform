export type AgricultureId = string;
export type TenantId = string;
export type UserId = string;
export type OrgUnitId = string;

export type FarmStatus = 'active' | 'archived';
export type PlotStatus = 'active' | 'archived';
export type CropCycleStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type CropCycleCompletionDisposition =
  | 'completed_with_harvest'
  | 'crop_failure'
  | 'abandoned'
  | 'terminated_without_harvest'
  | 'other';
export type AgricultureDomainEventEntityType =
  | 'farm'
  | 'plot'
  | 'crop_cycle'
  | 'crop_activity'
  | 'material_usage'
  | 'harvest';
export type AgriculturePermission =
  | 'agriculture:foundation:read'
  | 'agriculture:farm:write'
  | 'agriculture:plot:write'
  | 'agriculture:crop_cycle:write'
  | 'agriculture:activity:record'
  | 'agriculture:material_usage:record'
  | 'agriculture:harvest:record';

export interface AgricultureActor {
  tenantId: TenantId;
  userId: UserId;
  roles: string[];
  orgUnitId: OrgUnitId;
}

export interface Farm {
  id: AgricultureId;
  tenantId: TenantId;
  orgUnitId: OrgUnitId;
  farmCode: string;
  name: string;
  status: FarmStatus;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface Plot {
  id: AgricultureId;
  tenantId: TenantId;
  farmId: AgricultureId;
  orgUnitId: OrgUnitId;
  plotCode: string;
  name: string;
  status: PlotStatus;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface CropCycle {
  id: AgricultureId;
  tenantId: TenantId;
  farmId: AgricultureId;
  plotId: AgricultureId;
  orgUnitId: OrgUnitId;
  cycleCode: string;
  cropName: string;
  status: CropCycleStatus;
  plannedStartDate?: string;
  plannedEndDate?: string;
  startedAt?: string;
  completedAt?: string;
  completionDisposition?: CropCycleCompletionDisposition;
  completionReason?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface CropCycleEvent {
  id: AgricultureId;
  tenantId: TenantId;
  cropCycleId: AgricultureId;
  fromStatus?: CropCycleStatus;
  toStatus: CropCycleStatus;
  reason?: string;
  disposition?: CropCycleCompletionDisposition;
  recordedBy: UserId;
  recordedAt: string;
}

export interface CropActivityEvidence {
  id: AgricultureId;
  tenantId: TenantId;
  farmId: AgricultureId;
  plotId: AgricultureId;
  cropCycleId: AgricultureId;
  orgUnitId: OrgUnitId;
  activityType: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
  recordedBy: UserId;
  recordedAt: string;
}

export interface MaterialUsageEvidence {
  id: AgricultureId;
  tenantId: TenantId;
  farmId: AgricultureId;
  plotId: AgricultureId;
  cropCycleId: AgricultureId;
  orgUnitId: OrgUnitId;
  materialId: string;
  materialName?: string;
  quantity: number;
  uom: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
  recordedBy: UserId;
  recordedAt: string;
}

export interface HarvestEvidence {
  id: AgricultureId;
  tenantId: TenantId;
  farmId: AgricultureId;
  plotId: AgricultureId;
  cropCycleId: AgricultureId;
  orgUnitId: OrgUnitId;
  harvestBatchCode?: string;
  cropName?: string;
  quantity: number;
  uom: string;
  qualityGrade?: string;
  harvestedAt: string;
  evidence: Record<string, unknown>;
  recordedBy: UserId;
  recordedAt: string;
}

export interface AgricultureDomainEvent {
  id: AgricultureId;
  tenantId: TenantId;
  orgUnitId: OrgUnitId;
  entityType: AgricultureDomainEventEntityType;
  entityId: AgricultureId;
  eventType: string;
  payload: Record<string, unknown>;
  recordedBy: UserId;
  recordedAt: string;
}

export interface CommandLogEntry<T = unknown> {
  tenantId: TenantId;
  orgUnitId: OrgUnitId;
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

export interface CreateFarmCommand {
  idempotencyKey: string;
  orgUnitId: OrgUnitId;
  farmCode: string;
  name: string;
}

export interface CreatePlotCommand {
  idempotencyKey: string;
  farmId: AgricultureId;
  plotCode: string;
  name: string;
}

export interface CreateCropCycleCommand {
  idempotencyKey: string;
  plotId: AgricultureId;
  cycleCode: string;
  cropName: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export interface StartCropCycleCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  startedAt?: string;
}

export interface CompleteCropCycleCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  completedAt?: string;
  completionDisposition?: CropCycleCompletionDisposition;
  completionReason?: string;
}

export interface CancelCropCycleCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  cancellationReason: string;
  cancelledAt?: string;
}

export interface RecordCropActivityCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  activityType: string;
  occurredAt?: string;
  evidence?: Record<string, unknown>;
}

export interface RecordMaterialUsageCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  plotId: AgricultureId;
  materialId: string;
  materialName?: string;
  quantity: number;
  uom: string;
  occurredAt?: string;
  evidence?: Record<string, unknown>;
}

export interface RecordHarvestCommand {
  idempotencyKey: string;
  cropCycleId: AgricultureId;
  plotId: AgricultureId;
  harvestBatchCode?: string;
  quantity: number;
  uom: string;
  qualityGrade?: string;
  harvestedAt?: string;
  evidence?: Record<string, unknown>;
}

export interface CropCycleTrace {
  farm: Farm;
  plot: Plot;
  cropCycle: CropCycle;
  lifecycleEvents: CropCycleEvent[];
  activities: CropActivityEvidence[];
  materialUsages: MaterialUsageEvidence[];
  harvests: HarvestEvidence[];
  domainEvents: AgricultureDomainEvent[];
}
