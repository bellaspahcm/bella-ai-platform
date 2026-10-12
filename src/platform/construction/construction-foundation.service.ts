import {
  ConstructionNotFoundError,
  ConstructionStateError,
  ConstructionValidationError,
} from './domain/errors';
import type {
  ConstructionActor,
  ConstructionBoqLine,
  ConstructionId,
  ConstructionProject,
  ConstructionSite,
  ConstructionWorkPackage,
  CreateBoqLineCommand,
  CreateProjectCommand,
  CreateSiteCommand,
  CreateWorkPackageCommand,
} from './domain/types';
import type {
  ConstructionAuthorizationPort,
  ConstructionClock,
  ConstructionIdFactory,
  ConstructionRepository,
} from './ports';

export class ConstructionFoundationService {
  constructor(
    private readonly repository: ConstructionRepository,
    private readonly authorization: ConstructionAuthorizationPort,
    private readonly ids: ConstructionIdFactory,
    private readonly clock: ConstructionClock
  ) {}

  async createProject(
    actor: ConstructionActor,
    command: CreateProjectCommand
  ): Promise<ConstructionProject> {
    this.assertRequiredText(command.projectCode, 'projectCode');
    this.assertRequiredText(command.name, 'name');

    return this.repository.withTransaction(async (repository) => {
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        permission: 'construction:project:write',
      });

      const existing = await repository.findProjectByCode({
        tenantId: actor.tenantId,
        projectCode: command.projectCode,
      });
      if (existing) {
        throw new ConstructionValidationError('Project code already exists for tenant');
      }

      const now = this.clock.now();
      const project: ConstructionProject = {
        id: this.ids.next('construction_project'),
        tenantId: actor.tenantId,
        projectCode: command.projectCode,
        name: command.name,
        status: 'active',
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      };
      await repository.saveProject(project);
      return project;
    });
  }

  async createSite(actor: ConstructionActor, command: CreateSiteCommand): Promise<ConstructionSite> {
    this.assertRequiredText(command.projectId, 'projectId');
    this.assertRequiredText(command.orgUnitId, 'orgUnitId');
    this.assertRequiredText(command.siteCode, 'siteCode');
    this.assertRequiredText(command.name, 'name');

    return this.repository.withTransaction(async (repository) => {
      const project = await this.getProjectOrThrow(repository, actor, command.projectId);
      this.assertProjectActive(project);
      await this.authorization.ensureAllowed({
        actor,
        tenantId: actor.tenantId,
        orgUnitId: command.orgUnitId,
        permission: 'construction:site:write',
      });

      const existing = await repository.findSiteByCode({
        tenantId: actor.tenantId,
        projectId: project.id,
        siteCode: command.siteCode,
      });
      if (existing) {
        throw new ConstructionValidationError('Site code already exists for project');
      }

      const now = this.clock.now();
      const site: ConstructionSite = {
        id: this.ids.next('construction_site'),
        tenantId: actor.tenantId,
        projectId: project.id,
        orgUnitId: command.orgUnitId,
        siteCode: command.siteCode,
        name: command.name,
        locationText: this.optionalText(command.locationText),
        status: 'active',
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      };
      await repository.saveSite(site);
      return site;
    });
  }

  async createWorkPackage(
    actor: ConstructionActor,
    command: CreateWorkPackageCommand
  ): Promise<ConstructionWorkPackage> {
    this.assertRequiredText(command.siteId, 'siteId');
    this.assertRequiredText(command.workPackageCode, 'workPackageCode');
    this.assertRequiredText(command.name, 'name');
    this.assertDateOrder(command.plannedStartDate, command.plannedEndDate);

    return this.repository.withTransaction(async (repository) => {
      const site = await this.getAuthorizedSite(repository, actor, command.siteId, 'construction:work_package:write');
      this.assertSiteActive(site);

      if (command.parentWorkPackageId) {
        const parent = await this.getWorkPackageOrThrow(repository, actor, command.parentWorkPackageId);
        if (parent.siteId !== site.id || parent.projectId !== site.projectId) {
          throw new ConstructionValidationError('Parent Work Package must belong to the same Site');
        }
      }

      const existing = await repository.findWorkPackageByCode({
        tenantId: actor.tenantId,
        siteId: site.id,
        workPackageCode: command.workPackageCode,
      });
      if (existing) {
        throw new ConstructionValidationError('Work Package code already exists for site');
      }

      const now = this.clock.now();
      const workPackage: ConstructionWorkPackage = {
        id: this.ids.next('construction_work_package'),
        tenantId: actor.tenantId,
        projectId: site.projectId,
        siteId: site.id,
        orgUnitId: site.orgUnitId,
        parentWorkPackageId: command.parentWorkPackageId,
        workPackageCode: command.workPackageCode,
        name: command.name,
        status: 'planned',
        plannedStartDate: command.plannedStartDate,
        plannedEndDate: command.plannedEndDate,
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      };
      await repository.saveWorkPackage(workPackage);
      return workPackage;
    });
  }

  async createBoqLine(actor: ConstructionActor, command: CreateBoqLineCommand): Promise<ConstructionBoqLine> {
    this.assertRequiredText(command.workPackageId, 'workPackageId');
    this.assertRequiredText(command.lineNumber, 'lineNumber');
    this.assertRequiredText(command.description, 'description');
    this.assertPositiveQuantity(command.quantity, 'quantity');
    this.assertRequiredText(command.uom, 'uom');
    this.assertNonNegativeOptional(command.unitRate, 'unitRate');

    return this.repository.withTransaction(async (repository) => {
      const workPackage = await this.getAuthorizedWorkPackage(
        repository,
        actor,
        command.workPackageId,
        'construction:boq:write'
      );
      this.assertWorkPackageOpen(workPackage);

      const existing = await repository.findBoqLineByNumber({
        tenantId: actor.tenantId,
        workPackageId: workPackage.id,
        lineNumber: command.lineNumber,
      });
      if (existing) {
        throw new ConstructionValidationError('BOQ line number already exists for Work Package');
      }

      const now = this.clock.now();
      const line: ConstructionBoqLine = {
        id: this.ids.next('construction_boq_line'),
        tenantId: actor.tenantId,
        projectId: workPackage.projectId,
        siteId: workPackage.siteId,
        workPackageId: workPackage.id,
        orgUnitId: workPackage.orgUnitId,
        lineNumber: command.lineNumber,
        description: command.description,
        quantity: command.quantity,
        uom: command.uom,
        unitRate: command.unitRate,
        currency: this.optionalText(command.currency) ?? 'VND',
        costCode: this.optionalText(command.costCode),
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      };
      await repository.saveBoqLine(line);
      return line;
    });
  }

  private async getProjectOrThrow(
    repository: ConstructionRepository,
    actor: ConstructionActor,
    projectId: ConstructionId
  ): Promise<ConstructionProject> {
    const project = await repository.getProject(actor.tenantId, projectId);
    if (!project) throw new ConstructionNotFoundError('Project', projectId);
    return project;
  }

  private async getWorkPackageOrThrow(
    repository: ConstructionRepository,
    actor: ConstructionActor,
    workPackageId: ConstructionId
  ): Promise<ConstructionWorkPackage> {
    const workPackage = await repository.getWorkPackage(actor.tenantId, workPackageId);
    if (!workPackage) throw new ConstructionNotFoundError('WorkPackage', workPackageId);
    return workPackage;
  }

  private async getAuthorizedSite(
    repository: ConstructionRepository,
    actor: ConstructionActor,
    siteId: ConstructionId,
    permission: Parameters<ConstructionAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<ConstructionSite> {
    const site = await repository.getSite(actor.tenantId, siteId);
    if (!site) throw new ConstructionNotFoundError('Site', siteId);
    await this.authorization.ensureAllowed({
      actor,
      tenantId: actor.tenantId,
      orgUnitId: site.orgUnitId,
      permission,
    });
    return site;
  }

  private async getAuthorizedWorkPackage(
    repository: ConstructionRepository,
    actor: ConstructionActor,
    workPackageId: ConstructionId,
    permission: Parameters<ConstructionAuthorizationPort['ensureAllowed']>[0]['permission']
  ): Promise<ConstructionWorkPackage> {
    const workPackage = await this.getWorkPackageOrThrow(repository, actor, workPackageId);
    await this.authorization.ensureAllowed({
      actor,
      tenantId: actor.tenantId,
      orgUnitId: workPackage.orgUnitId,
      permission,
    });
    return workPackage;
  }

  private assertRequiredText(value: string | undefined, field: string): void {
    if (!value || value.trim().length === 0) {
      throw new ConstructionValidationError(`${field} is required`);
    }
  }

  private optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private assertPositiveQuantity(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ConstructionValidationError(`${field} must be greater than zero`);
    }
  }

  private assertNonNegativeOptional(value: number | undefined, field: string): void {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new ConstructionValidationError(`${field} must be nonnegative`);
    }
  }

  private assertDateOrder(startDate: string | undefined, endDate: string | undefined): void {
    if (startDate && endDate && startDate > endDate) {
      throw new ConstructionValidationError('plannedStartDate must be before plannedEndDate');
    }
  }

  private assertProjectActive(project: ConstructionProject): void {
    if (project.status !== 'active') {
      throw new ConstructionStateError('Project must be active');
    }
  }

  private assertSiteActive(site: ConstructionSite): void {
    if (site.status !== 'active') {
      throw new ConstructionStateError('Site must be active');
    }
  }

  private assertWorkPackageOpen(workPackage: ConstructionWorkPackage): void {
    if (workPackage.status === 'archived') {
      throw new ConstructionStateError('BOQ lines cannot be added to an archived Work Package');
    }
  }
}
