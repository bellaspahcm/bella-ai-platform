import {
  ConstructionAuthorizationError,
  ConstructionFoundationService,
  ConstructionNotFoundError,
  ConstructionValidationError,
  FixedConstructionClock,
  InMemoryConstructionRepository,
  SequentialConstructionIdFactory,
  StaticConstructionAuthorization,
  type ConstructionActor,
  type ConstructionPermission,
  type ConstructionProject,
  type ConstructionSite,
} from '..';

const allPermissions: ConstructionPermission[] = [
  'construction:foundation:read',
  'construction:project:write',
  'construction:site:write',
  'construction:work_package:write',
  'construction:boq:write',
];

const actorA: ConstructionActor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  roles: ['construction_manager'],
  orgUnitIds: ['org-a'],
};

const actorB: ConstructionActor = {
  tenantId: 'tenant-b',
  userId: 'user-b',
  roles: ['construction_manager'],
  orgUnitIds: ['org-b'],
};

const actorWrongOrgSameTenant: ConstructionActor = {
  tenantId: 'tenant-a',
  userId: 'user-c',
  roles: ['construction_manager'],
  orgUnitIds: ['org-c'],
};

describe('Construction OS Foundation service', () => {
  it('creates Project, Site, Work Package, and BOQ line inside the approved foundation slice', async () => {
    const { service, repository } = buildService();
    const { project, site } = await createProjectAndSite(service);

    const workPackage = await service.createWorkPackage(actorA, {
      siteId: site.id,
      workPackageCode: 'WP-FOUNDATION',
      name: 'Foundation works',
      plannedStartDate: '2026-10-13',
      plannedEndDate: '2026-10-31',
    });

    const boqLine = await service.createBoqLine(actorA, {
      workPackageId: workPackage.id,
      lineNumber: '1.1',
      description: 'Concrete volume',
      quantity: 125.5,
      uom: 'm3',
      unitRate: 1000000,
      currency: 'VND',
      costCode: 'CIVIL-CONCRETE',
    });

    expect(project.projectCode).toBe('PRJ-001');
    expect(site.orgUnitId).toBe(actorA.orgUnitIds[0]);
    expect(workPackage.projectId).toBe(project.id);
    expect(workPackage.siteId).toBe(site.id);
    expect(boqLine.projectId).toBe(project.id);
    expect(boqLine.siteId).toBe(site.id);
    expect(boqLine.workPackageId).toBe(workPackage.id);
    expect(boqLine.quantity).toBe(125.5);

    await expect(repository.listBoqLinesByWorkPackage({
      tenantId: actorA.tenantId,
      workPackageId: workPackage.id,
    })).resolves.toHaveLength(1);
  });

  it('rejects duplicate business codes at their approved scope boundaries', async () => {
    const { service } = buildService();
    const { project, site } = await createProjectAndSite(service);

    await expect(service.createProject(actorA, {
      projectCode: project.projectCode,
      name: 'Duplicate project',
    })).rejects.toBeInstanceOf(ConstructionValidationError);

    await expect(service.createSite(actorA, {
      projectId: project.id,
      orgUnitId: actorA.orgUnitIds[0],
      siteCode: site.siteCode,
      name: 'Duplicate site',
    })).rejects.toBeInstanceOf(ConstructionValidationError);

    const workPackage = await service.createWorkPackage(actorA, {
      siteId: site.id,
      workPackageCode: 'WP-001',
      name: 'Main works',
    });

    await expect(service.createWorkPackage(actorA, {
      siteId: site.id,
      workPackageCode: workPackage.workPackageCode,
      name: 'Duplicate package',
    })).rejects.toBeInstanceOf(ConstructionValidationError);

    await service.createBoqLine(actorA, {
      workPackageId: workPackage.id,
      lineNumber: '1',
      description: 'Steel',
      quantity: 10,
      uom: 'kg',
    });

    await expect(service.createBoqLine(actorA, {
      workPackageId: workPackage.id,
      lineNumber: '1',
      description: 'Duplicate steel',
      quantity: 10,
      uom: 'kg',
    })).rejects.toBeInstanceOf(ConstructionValidationError);
  });

  it('enforces tenant and Platform Org Unit authorization boundaries', async () => {
    const { service } = buildService();
    const { project, site } = await createProjectAndSite(service);
    const workPackage = await service.createWorkPackage(actorA, {
      siteId: site.id,
      workPackageCode: 'WP-AUTH',
      name: 'Authorized package',
    });

    await expect(service.createSite(actorB, {
      projectId: project.id,
      orgUnitId: actorB.orgUnitIds[0],
      siteCode: 'SITE-B',
      name: 'Cross tenant attempt',
    })).rejects.toBeInstanceOf(ConstructionNotFoundError);

    await expect(service.createWorkPackage(actorWrongOrgSameTenant, {
      siteId: site.id,
      workPackageCode: 'WP-DENIED',
      name: 'Wrong org attempt',
    })).rejects.toBeInstanceOf(ConstructionAuthorizationError);

    await expect(service.createBoqLine(actorWrongOrgSameTenant, {
      workPackageId: workPackage.id,
      lineNumber: 'AUTH-DENIED',
      description: 'Wrong org BOQ attempt',
      quantity: 1,
      uom: 'ea',
    })).rejects.toBeInstanceOf(ConstructionAuthorizationError);
  });

  it('guards Work Package parent scope and BOQ quantity invariants', async () => {
    const { service } = buildService();
    const { site } = await createProjectAndSite(service);
    const otherProject = await service.createProject(actorA, {
      projectCode: 'PRJ-OTHER',
      name: 'Other project',
    });
    const otherSite = await service.createSite(actorA, {
      projectId: otherProject.id,
      orgUnitId: actorA.orgUnitIds[0],
      siteCode: 'SITE-OTHER',
      name: 'Other site',
    });
    const parent = await service.createWorkPackage(actorA, {
      siteId: otherSite.id,
      workPackageCode: 'WP-PARENT-OTHER',
      name: 'Other parent',
    });

    await expect(service.createWorkPackage(actorA, {
      siteId: site.id,
      parentWorkPackageId: parent.id,
      workPackageCode: 'WP-BAD-PARENT',
      name: 'Bad parent',
    })).rejects.toBeInstanceOf(ConstructionValidationError);

    const workPackage = await service.createWorkPackage(actorA, {
      siteId: site.id,
      workPackageCode: 'WP-QTY',
      name: 'Quantity proof',
    });

    await expect(service.createBoqLine(actorA, {
      workPackageId: workPackage.id,
      lineNumber: 'QTY-0',
      description: 'Zero quantity',
      quantity: 0,
      uom: 'ea',
    })).rejects.toBeInstanceOf(ConstructionValidationError);

    await expect(service.createBoqLine(actorA, {
      workPackageId: workPackage.id,
      lineNumber: 'NEG-RATE',
      description: 'Negative rate',
      quantity: 1,
      uom: 'ea',
      unitRate: -1,
    })).rejects.toBeInstanceOf(ConstructionValidationError);
  });
});

function buildService(): {
  service: ConstructionFoundationService;
  repository: InMemoryConstructionRepository;
} {
  const repository = new InMemoryConstructionRepository();
  const authorization = new StaticConstructionAuthorization(
    {
      [actorA.userId]: actorA.orgUnitIds,
      [actorB.userId]: actorB.orgUnitIds,
      [actorWrongOrgSameTenant.userId]: actorWrongOrgSameTenant.orgUnitIds,
    },
    {
      [actorA.userId]: allPermissions,
      [actorB.userId]: allPermissions,
      [actorWrongOrgSameTenant.userId]: allPermissions,
    }
  );
  return {
    service: new ConstructionFoundationService(
      repository,
      authorization,
      new SequentialConstructionIdFactory(),
      new FixedConstructionClock('2026-10-13T03:00:00.000Z')
    ),
    repository,
  };
}

async function createProjectAndSite(
  service: ConstructionFoundationService
): Promise<{ project: ConstructionProject; site: ConstructionSite }> {
  const project = await service.createProject(actorA, {
    projectCode: 'PRJ-001',
    name: 'Tower A',
  });
  const site = await service.createSite(actorA, {
    projectId: project.id,
    orgUnitId: actorA.orgUnitIds[0],
    siteCode: 'SITE-001',
    name: 'District 1 Site',
    locationText: 'District 1',
  });
  return { project, site };
}
