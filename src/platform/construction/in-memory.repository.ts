import { ConstructionAuthorizationError } from './domain/errors';
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
import type {
  ConstructionAuthorizationPort,
  ConstructionClock,
  ConstructionIdFactory,
  ConstructionRepository,
} from './ports';

export class SequentialConstructionIdFactory implements ConstructionIdFactory {
  private nextValue = 1;

  next(prefix: string): ConstructionId {
    const id = `${prefix}_${this.nextValue.toString().padStart(6, '0')}`;
    this.nextValue += 1;
    return id;
  }
}

export class FixedConstructionClock implements ConstructionClock {
  constructor(private readonly timestamp: string = '2026-10-13T00:00:00.000Z') {}

  now(): string {
    return this.timestamp;
  }
}

export class InMemoryConstructionRepository implements ConstructionRepository {
  private readonly projects = new Map<string, ConstructionProject>();
  private readonly sites = new Map<string, ConstructionSite>();
  private readonly workPackages = new Map<string, ConstructionWorkPackage>();
  private readonly boqLines = new Map<string, ConstructionBoqLine>();

  async withTransaction<T>(callback: (repository: ConstructionRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async saveProject(project: ConstructionProject): Promise<void> {
    this.projects.set(this.key(project.tenantId, project.id), { ...project });
  }

  async getProject(tenantId: TenantId, id: ConstructionId): Promise<ConstructionProject | null> {
    const project = this.projects.get(this.key(tenantId, id));
    return project ? { ...project } : null;
  }

  async findProjectByCode(params: { tenantId: TenantId; projectCode: string }): Promise<ConstructionProject | null> {
    for (const project of this.projects.values()) {
      if (project.tenantId === params.tenantId && project.projectCode === params.projectCode) {
        return { ...project };
      }
    }
    return null;
  }

  async saveSite(site: ConstructionSite): Promise<void> {
    this.sites.set(this.key(site.tenantId, site.id), { ...site });
  }

  async getSite(tenantId: TenantId, id: ConstructionId): Promise<ConstructionSite | null> {
    const site = this.sites.get(this.key(tenantId, id));
    return site ? { ...site } : null;
  }

  async findSiteByCode(params: {
    tenantId: TenantId;
    projectId: ConstructionId;
    siteCode: string;
  }): Promise<ConstructionSite | null> {
    for (const site of this.sites.values()) {
      if (
        site.tenantId === params.tenantId &&
        site.projectId === params.projectId &&
        site.siteCode === params.siteCode
      ) {
        return { ...site };
      }
    }
    return null;
  }

  async listSitesByProject(params: { tenantId: TenantId; projectId: ConstructionId }): Promise<ConstructionSite[]> {
    return Array.from(this.sites.values())
      .filter((site) => site.tenantId === params.tenantId && site.projectId === params.projectId)
      .sort((left, right) => left.siteCode.localeCompare(right.siteCode))
      .map((site) => ({ ...site }));
  }

  async saveWorkPackage(workPackage: ConstructionWorkPackage): Promise<void> {
    this.workPackages.set(this.key(workPackage.tenantId, workPackage.id), { ...workPackage });
  }

  async getWorkPackage(tenantId: TenantId, id: ConstructionId): Promise<ConstructionWorkPackage | null> {
    const workPackage = this.workPackages.get(this.key(tenantId, id));
    return workPackage ? { ...workPackage } : null;
  }

  async findWorkPackageByCode(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
    workPackageCode: string;
  }): Promise<ConstructionWorkPackage | null> {
    for (const workPackage of this.workPackages.values()) {
      if (
        workPackage.tenantId === params.tenantId &&
        workPackage.siteId === params.siteId &&
        workPackage.workPackageCode === params.workPackageCode
      ) {
        return { ...workPackage };
      }
    }
    return null;
  }

  async listWorkPackagesBySite(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
  }): Promise<ConstructionWorkPackage[]> {
    return Array.from(this.workPackages.values())
      .filter((workPackage) => workPackage.tenantId === params.tenantId && workPackage.siteId === params.siteId)
      .sort((left, right) => left.workPackageCode.localeCompare(right.workPackageCode))
      .map((workPackage) => ({ ...workPackage }));
  }

  async saveBoqLine(line: ConstructionBoqLine): Promise<void> {
    this.boqLines.set(this.key(line.tenantId, line.id), { ...line });
  }

  async findBoqLineByNumber(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
    lineNumber: string;
  }): Promise<ConstructionBoqLine | null> {
    for (const line of this.boqLines.values()) {
      if (
        line.tenantId === params.tenantId &&
        line.workPackageId === params.workPackageId &&
        line.lineNumber === params.lineNumber
      ) {
        return { ...line };
      }
    }
    return null;
  }

  async listBoqLinesByWorkPackage(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
  }): Promise<ConstructionBoqLine[]> {
    return Array.from(this.boqLines.values())
      .filter((line) => line.tenantId === params.tenantId && line.workPackageId === params.workPackageId)
      .sort((left, right) => left.lineNumber.localeCompare(right.lineNumber))
      .map((line) => ({ ...line }));
  }

  private key(tenantId: TenantId, id: ConstructionId): string {
    return `${tenantId}:${id}`;
  }
}

export class StaticConstructionAuthorization implements ConstructionAuthorizationPort {
  constructor(
    private readonly allowedOrgUnitsByUser: Record<string, OrgUnitId[]>,
    private readonly permissionsByUser: Record<string, ConstructionPermission[]>
  ) {}

  async ensureAllowed(params: {
    actor: ConstructionActor;
    tenantId: TenantId;
    orgUnitId?: OrgUnitId;
    permission: ConstructionPermission;
  }): Promise<void> {
    const permissions = this.permissionsByUser[params.actor.userId] ?? [];
    const configuredOrgUnits = this.allowedOrgUnitsByUser[params.actor.userId] ?? [];
    const hasTenantAccess = params.actor.tenantId === params.tenantId;
    const hasPermission = permissions.includes(params.permission);
    const hasOrgUnitAccess = !params.orgUnitId || (
      params.actor.orgUnitIds.includes(params.orgUnitId) &&
      configuredOrgUnits.includes(params.orgUnitId)
    );

    if (!hasTenantAccess || !hasPermission || !hasOrgUnitAccess) {
      throw new ConstructionAuthorizationError();
    }
  }
}
