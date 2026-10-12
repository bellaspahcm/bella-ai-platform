export type ConstructionId = string;
export type TenantId = string;
export type UserId = string;
export type OrgUnitId = string;

export type ConstructionProjectStatus = 'active' | 'archived';
export type ConstructionSiteStatus = 'active' | 'archived';
export type ConstructionWorkPackageStatus = 'planned' | 'in_progress' | 'completed' | 'archived';

export type ConstructionPermission =
  | 'construction:foundation:read'
  | 'construction:project:write'
  | 'construction:site:write'
  | 'construction:work_package:write'
  | 'construction:boq:write';

export interface ConstructionActor {
  tenantId: TenantId;
  userId: UserId;
  roles: string[];
  orgUnitIds: OrgUnitId[];
}

export interface ConstructionProject {
  id: ConstructionId;
  tenantId: TenantId;
  projectCode: string;
  name: string;
  status: ConstructionProjectStatus;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface ConstructionSite {
  id: ConstructionId;
  tenantId: TenantId;
  projectId: ConstructionId;
  orgUnitId: OrgUnitId;
  siteCode: string;
  name: string;
  locationText?: string;
  status: ConstructionSiteStatus;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface ConstructionWorkPackage {
  id: ConstructionId;
  tenantId: TenantId;
  projectId: ConstructionId;
  siteId: ConstructionId;
  orgUnitId: OrgUnitId;
  parentWorkPackageId?: ConstructionId;
  workPackageCode: string;
  name: string;
  status: ConstructionWorkPackageStatus;
  plannedStartDate?: string;
  plannedEndDate?: string;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface ConstructionBoqLine {
  id: ConstructionId;
  tenantId: TenantId;
  projectId: ConstructionId;
  siteId: ConstructionId;
  workPackageId: ConstructionId;
  orgUnitId: OrgUnitId;
  lineNumber: string;
  description: string;
  quantity: number;
  uom: string;
  unitRate?: number;
  currency: string;
  costCode?: string;
  createdBy: UserId;
  createdAt: string;
  updatedBy: UserId;
  updatedAt: string;
}

export interface CreateProjectCommand {
  projectCode: string;
  name: string;
}

export interface CreateSiteCommand {
  projectId: ConstructionId;
  orgUnitId: OrgUnitId;
  siteCode: string;
  name: string;
  locationText?: string;
}

export interface CreateWorkPackageCommand {
  siteId: ConstructionId;
  parentWorkPackageId?: ConstructionId;
  workPackageCode: string;
  name: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

export interface CreateBoqLineCommand {
  workPackageId: ConstructionId;
  lineNumber: string;
  description: string;
  quantity: number;
  uom: string;
  unitRate?: number;
  currency?: string;
  costCode?: string;
}
