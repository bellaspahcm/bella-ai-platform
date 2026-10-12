import {
  AgricultureAuthorizationError,
  AgricultureFoundationService,
  AgricultureIdempotencyConflictError,
  AgricultureStateError,
  AgricultureValidationError,
  FixedAgricultureClock,
  InMemoryAgricultureRepository,
  SequentialAgricultureIdFactory,
  StaticAgricultureAuthorization,
  type AgricultureActor,
  type AgriculturePermission,
  type CropCycle,
  type Farm,
  type Plot,
} from '..';

const allPermissions: AgriculturePermission[] = [
  'agriculture:foundation:read',
  'agriculture:farm:write',
  'agriculture:plot:write',
  'agriculture:crop_cycle:write',
  'agriculture:activity:record',
  'agriculture:material_usage:record',
  'agriculture:harvest:record',
];

const actorA: AgricultureActor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  roles: ['operator'],
  orgUnitId: 'org-a',
};

const actorB: AgricultureActor = {
  tenantId: 'tenant-b',
  userId: 'user-b',
  roles: ['operator'],
  orgUnitId: 'org-b',
};

const actorWrongOrgSameTenant: AgricultureActor = {
  tenantId: 'tenant-a',
  userId: 'user-b',
  roles: ['operator'],
  orgUnitId: 'org-b',
};

describe('Agriculture OS Foundation service', () => {
  it('creates Farm, Plot, overlapping Crop Cycles, and records evidence only on active cycles', async () => {
    const { service } = buildService();
    const { farm, plot } = await createFarmAndPlot(service);

    const cycleOne = (await service.createCropCycle(actorA, {
      idempotencyKey: 'cycle-1',
      plotId: plot.id,
      cycleCode: 'RICE-2026-A',
      cropName: 'Rice',
      plannedStartDate: '2026-10-12',
      plannedEndDate: '2027-01-12',
    })).value;

    const cycleTwo = (await service.createCropCycle(actorA, {
      idempotencyKey: 'cycle-2',
      plotId: plot.id,
      cycleCode: 'RICE-2026-B',
      cropName: 'Rice',
      plannedStartDate: '2026-10-12',
      plannedEndDate: '2027-01-12',
    })).value;

    expect(cycleOne.plotId).toBe(plot.id);
    expect(cycleTwo.plotId).toBe(plot.id);
    expect(cycleOne.id).not.toBe(cycleTwo.id);

    await expect(service.recordCropActivity(actorA, {
      idempotencyKey: 'activity-before-start',
      cropCycleId: cycleOne.id,
      activityType: 'soil_preparation',
    })).rejects.toBeInstanceOf(AgricultureStateError);

    const activeCycle = (await service.startCropCycle(actorA, {
      idempotencyKey: 'start-cycle-1',
      cropCycleId: cycleOne.id,
    })).value;
    expect(activeCycle.status).toBe('active');

    const activity = (await service.recordCropActivity(actorA, {
      idempotencyKey: 'activity-1',
      cropCycleId: activeCycle.id,
      activityType: 'soil_preparation',
      evidence: { note: 'raised beds' },
    })).value;
    expect(activity.farmId).toBe(farm.id);
    expect(activity.plotId).toBe(plot.id);

    const materialUsage = (await service.recordMaterialUsage(actorA, {
      idempotencyKey: 'usage-1',
      cropCycleId: activeCycle.id,
      plotId: plot.id,
      materialId: 'seed-rice-a',
      materialName: 'Rice seed A',
      quantity: 12,
      uom: 'kg',
    })).value;
    expect(materialUsage.quantity).toBe(12);

    const harvest = (await service.recordHarvest(actorA, {
      idempotencyKey: 'harvest-1',
      cropCycleId: activeCycle.id,
      plotId: plot.id,
      harvestBatchCode: 'HV-001',
      quantity: 450,
      uom: 'kg',
      qualityGrade: 'A',
    })).value;
    expect(harvest.cropName).toBe('Rice');

    const completed = (await service.completeCropCycle(actorA, {
      idempotencyKey: 'complete-cycle-1',
      cropCycleId: activeCycle.id,
    })).value;
    expect(completed.status).toBe('completed');
    expect(completed.completionDisposition).toBe('completed_with_harvest');

    const trace = await service.getCropCycleTrace(actorA, { cropCycleId: activeCycle.id });
    expect(trace.activities).toHaveLength(1);
    expect(trace.materialUsages).toHaveLength(1);
    expect(trace.harvests).toHaveLength(1);
    expect(trace.lifecycleEvents.map((event) => event.toStatus)).toEqual(['planned', 'active', 'completed']);
  });

  it('allows Crop Cycle completion without Harvest only with a non-harvest disposition and reason', async () => {
    const { service } = buildService();
    const { plot } = await createFarmAndPlot(service);
    const cycle = await createStartedCycle(service, plot);

    await expect(service.completeCropCycle(actorA, {
      idempotencyKey: 'complete-no-harvest-invalid',
      cropCycleId: cycle.id,
    })).rejects.toBeInstanceOf(AgricultureValidationError);

    const completed = (await service.completeCropCycle(actorA, {
      idempotencyKey: 'complete-no-harvest-valid',
      cropCycleId: cycle.id,
      completionDisposition: 'crop_failure',
      completionReason: 'Flood damage recorded by field team',
    })).value;

    expect(completed.status).toBe('completed');
    expect(completed.completionDisposition).toBe('crop_failure');
    expect(completed.completionReason).toBe('Flood damage recorded by field team');
  });

  it('rejects cross-tenant access, unauthorized organization access, and mismatched Plot references', async () => {
    const { service } = buildService();
    const { farm, plot } = await createFarmAndPlot(service);
    const cycle = await createStartedCycle(service, plot);

    await expect(service.createPlot(actorB, {
      idempotencyKey: 'cross-tenant-plot',
      farmId: farm.id,
      plotCode: 'PLOT-B',
      name: 'Tenant B attempt',
    })).rejects.toMatchObject({ code: 'AGRICULTURE_NOT_FOUND' });

    await expect(service.createPlot(actorWrongOrgSameTenant, {
      idempotencyKey: 'wrong-org-plot',
      farmId: farm.id,
      plotCode: 'PLOT-C',
      name: 'Wrong org attempt',
    })).rejects.toBeInstanceOf(AgricultureAuthorizationError);

    await expect(service.recordHarvest(actorA, {
      idempotencyKey: 'wrong-plot-harvest',
      cropCycleId: cycle.id,
      plotId: 'other-plot',
      quantity: 1,
      uom: 'kg',
    })).rejects.toBeInstanceOf(AgricultureValidationError);
  });

  it('guards idempotency duplicates and conflicts per tenant operation', async () => {
    const { service } = buildService();
    const first = await service.createFarm(actorA, {
      idempotencyKey: 'farm-idem',
      orgUnitId: actorA.orgUnitId,
      farmCode: 'FARM-IDEM',
      name: 'Idempotent Farm',
    });
    const duplicate = await service.createFarm(actorA, {
      idempotencyKey: 'farm-idem',
      orgUnitId: actorA.orgUnitId,
      farmCode: 'FARM-IDEM',
      name: 'Idempotent Farm',
    });

    expect(first.isDuplicate).toBe(false);
    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.value.id).toBe(first.value.id);

    await expect(service.createFarm(actorA, {
      idempotencyKey: 'farm-idem',
      orgUnitId: actorA.orgUnitId,
      farmCode: 'FARM-IDEM-CHANGED',
      name: 'Changed Farm',
    })).rejects.toBeInstanceOf(AgricultureIdempotencyConflictError);
  });
});

function buildService(): { service: AgricultureFoundationService; repository: InMemoryAgricultureRepository } {
  const repository = new InMemoryAgricultureRepository();
  const authorization = new StaticAgricultureAuthorization(
    {
      [actorA.userId]: actorA.orgUnitId,
      [actorB.userId]: actorB.orgUnitId,
    },
    {
      [actorA.userId]: allPermissions,
      [actorB.userId]: allPermissions,
    }
  );
  return {
    service: new AgricultureFoundationService(
      repository,
      authorization,
      new SequentialAgricultureIdFactory(),
      new FixedAgricultureClock('2026-10-12T03:00:00.000Z')
    ),
    repository,
  };
}

async function createFarmAndPlot(service: AgricultureFoundationService): Promise<{ farm: Farm; plot: Plot }> {
  const farm = (await service.createFarm(actorA, {
    idempotencyKey: 'farm-1',
    orgUnitId: actorA.orgUnitId,
    farmCode: 'FARM-1',
    name: 'Delta Farm',
  })).value;
  const plot = (await service.createPlot(actorA, {
    idempotencyKey: 'plot-1',
    farmId: farm.id,
    plotCode: 'PLOT-1',
    name: 'North Plot',
  })).value;
  return { farm, plot };
}

async function createStartedCycle(
  service: AgricultureFoundationService,
  plot: Plot
): Promise<CropCycle> {
  const cycle = (await service.createCropCycle(actorA, {
    idempotencyKey: `cycle-${plot.id}`,
    plotId: plot.id,
    cycleCode: `CYCLE-${plot.id}`,
    cropName: 'Rice',
  })).value;
  return (await service.startCropCycle(actorA, {
    idempotencyKey: `start-${cycle.id}`,
    cropCycleId: cycle.id,
  })).value;
}
