import type {
  ConstructionActor,
  ConstructionBoqLine,
  ConstructionId,
  ConstructionPermission,
  ConstructionProject,
  ConstructionSite,
  ConstructionWorkPackage,
  OrgUnitId,
  TenantId,
} from './domain/types';

export interface ConstructionAuthorizationPort {
  ensureAllowed(params: {
    actor: ConstructionActor;
    tenantId: TenantId;
    orgUnitId?: OrgUnitId;
    permission: ConstructionPermission;
  }): Promise<void>;
}

export interface ConstructionRepository {
  withTransaction<T>(callback: (repository: ConstructionRepository) => Promise<T>): Promise<T>;

  saveProject(project: ConstructionProject): Promise<void>;
  getProject(tenantId: TenantId, id: ConstructionId): Promise<ConstructionProject | null>;
  findProjectByCode(params: { tenantId: TenantId; projectCode: string }): Promise<ConstructionProject | null>;

  saveSite(site: ConstructionSite): Promise<void>;
  getSite(tenantId: TenantId, id: ConstructionId): Promise<ConstructionSite | null>;
  findSiteByCode(params: {
    tenantId: TenantId;
    projectId: ConstructionId;
    siteCode: string;
  }): Promise<ConstructionSite | null>;
  listSitesByProject(params: { tenantId: TenantId; projectId: ConstructionId }): Promise<ConstructionSite[]>;

  saveWorkPackage(workPackage: ConstructionWorkPackage): Promise<void>;
  getWorkPackage(tenantId: TenantId, id: ConstructionId): Promise<ConstructionWorkPackage | null>;
  findWorkPackageByCode(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
    workPackageCode: string;
  }): Promise<ConstructionWorkPackage | null>;
  listWorkPackagesBySite(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
  }): Promise<ConstructionWorkPackage[]>;

  saveBoqLine(line: ConstructionBoqLine): Promise<void>;
  findBoqLineByNumber(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
    lineNumber: string;
  }): Promise<ConstructionBoqLine | null>;
  listBoqLinesByWorkPackage(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
  }): Promise<ConstructionBoqLine[]>;
}

export interface ConstructionIdFactory {
  next(prefix: string): ConstructionId;
}

export interface ConstructionClock {
  now(): string;
}
