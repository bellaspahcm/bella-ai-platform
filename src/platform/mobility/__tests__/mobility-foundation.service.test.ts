import {
  FixedMobilityClock,
  InMemoryMobilityRepository,
  MobilityAuthorizationError,
  MobilityFoundationService,
  MobilityIdempotencyConflictError,
  MobilityNotFoundError,
  MobilityStateError,
  MobilityValidationError,
  SequentialMobilityIdFactory,
  StaticMobilityAuthorization,
  type MobilityActor,
  type MobilityPermission,
} from '..';

const allPermissions: MobilityPermission[] = [
  'mobility:foundation:read',
  'mobility:vehicle:write',
  'mobility:ownership:write',
];

const actorA: MobilityActor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  roles: ['mobility_operator'],
  orgUnitId: 'org-a',
};

const actorB: MobilityActor = {
  tenantId: 'tenant-b',
  userId: 'user-b',
  roles: ['mobility_operator'],
  orgUnitId: 'org-b',
};

const actorWrongTenantGrant: MobilityActor = {
  tenantId: 'tenant-a',
  userId: 'user-b',
  roles: ['mobility_operator'],
  orgUnitId: 'org-b',
};

describe('Mobility OS Foundation service', () => {
  it('registers a VIN, records lifecycle audit, and returns the trace contract', async () => {
    const { service, repository } = buildService();
    const vehicle = (await service.registerVehicle(actorA, {
      idempotencyKey: 'register-vin-1',
      variantId: 'variant-a',
      vin: '1HGCM82633A004352',
      colorExterior: 'Pearl White',
      modelYear: 2026,
      listPrice: 1_200_000_000,
      metadata: { source: 'unit' },
    })).value;

    const inWarehouse = (await service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'transition-warehouse',
      vehicleId: vehicle.id,
      toStatus: 'warehouse',
      reason: 'arrived at central warehouse',
    })).value;

    await service.linkVehicleOwner(actorA, {
      idempotencyKey: 'owner-primary',
      vehicleId: vehicle.id,
      customerId: 'customer-a',
      ownershipType: 'primary',
      licensePlate: '51A-12345',
    });

    repository.seedServiceHistory({
      id: 'service-history-1',
      tenantId: actorA.tenantId,
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      serviceDate: '2026-10-13',
      serviceType: 'routine_maintenance',
      serviceDescription: 'First inspection',
      mileage: 1000,
      servicesPerformed: [{ code: 'inspection' }],
      partsReplaced: [],
      recordedBy: actorA.userId,
      recordedAt: '2026-10-13T00:00:00.000Z',
    });

    const trace = await service.getVehicleTrace(actorA, { vehicleId: vehicle.id });

    expect(vehicle.vin).toBe('1HGCM82633A004352');
    expect(inWarehouse.status).toBe('warehouse');
    expect(trace.lifecycleEvents.map((event) => event.toStatus)).toEqual(['in_transit', 'warehouse']);
    expect(trace.ownerships).toHaveLength(1);
    expect(trace.serviceHistory).toHaveLength(1);
    expect(trace.domainEvents.map((event) => event.eventType)).toEqual([
      'vehicle.registered',
      'vehicle.status_changed',
    ]);
  });

  it('enforces valid state transitions and required allocation/delivery fields', async () => {
    const { service } = buildService();
    const vehicle = await registerVehicle(service);

    await expect(service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'invalid-direct-delivery',
      vehicleId: vehicle.id,
      toStatus: 'delivered',
    })).rejects.toBeInstanceOf(MobilityStateError);

    const warehouse = (await service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'warehouse',
      vehicleId: vehicle.id,
      toStatus: 'warehouse',
    })).value;
    expect(warehouse.status).toBe('warehouse');

    await expect(service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'warehouse-to-allocated-missing-contract',
      vehicleId: vehicle.id,
      toStatus: 'allocated',
    })).rejects.toBeInstanceOf(MobilityStateError);

    const showroom = (await service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'showroom',
      vehicleId: vehicle.id,
      toStatus: 'showroom',
    })).value;
    expect(showroom.status).toBe('showroom');

    await expect(service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'allocated-missing-contract',
      vehicleId: vehicle.id,
      toStatus: 'allocated',
    })).rejects.toBeInstanceOf(MobilityValidationError);
  });

  it('guards tenant boundaries and permission grants before mutations', async () => {
    const { service } = buildService();
    const vehicle = await registerVehicle(service);

    await expect(service.getVehicleTrace(actorB, {
      vehicleId: vehicle.id,
    })).rejects.toBeInstanceOf(MobilityNotFoundError);

    await expect(service.transitionVehicleStatus(actorWrongTenantGrant, {
      idempotencyKey: 'wrong-tenant-grant',
      vehicleId: vehicle.id,
      toStatus: 'warehouse',
    })).rejects.toBeInstanceOf(MobilityAuthorizationError);
  });

  it('guards idempotency duplicates and conflicts per tenant operation', async () => {
    const { service } = buildService();
    const first = await service.registerVehicle(actorA, {
      idempotencyKey: 'register-idem',
      variantId: 'variant-a',
      vin: '1HGCM82633A004354',
      colorExterior: 'Black',
      modelYear: 2026,
    });
    const duplicate = await service.registerVehicle(actorA, {
      idempotencyKey: 'register-idem',
      variantId: 'variant-a',
      vin: '1HGCM82633A004354',
      colorExterior: 'Black',
      modelYear: 2026,
    });

    expect(first.isDuplicate).toBe(false);
    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.value.id).toBe(first.value.id);

    await expect(service.registerVehicle(actorA, {
      idempotencyKey: 'register-idem',
      variantId: 'variant-a',
      vin: '1HGCM82633A004355',
      colorExterior: 'Black',
      modelYear: 2026,
    })).rejects.toBeInstanceOf(MobilityIdempotencyConflictError);
  });

  it('exposes available vehicle listing through the repository contract', async () => {
    const { service, repository } = buildService();
    const vehicleA = await registerVehicle(service, '1HGCM82633A004356');
    const vehicleB = await registerVehicle(service, '1HGCM82633A004357');
    await service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'available-a',
      vehicleId: vehicleA.id,
      toStatus: 'warehouse',
    });
    await service.transitionVehicleStatus(actorA, {
      idempotencyKey: 'returned-b',
      vehicleId: vehicleB.id,
      toStatus: 'returned',
    });

    const available = await repository.listAvailableVehicles({
      tenantId: actorA.tenantId,
      variantId: 'variant-a',
      statuses: ['warehouse', 'showroom'],
    });

    expect(available.map((vehicle) => vehicle.id)).toEqual([vehicleA.id]);
  });
});

function buildService(): {
  service: MobilityFoundationService;
  repository: InMemoryMobilityRepository;
} {
  const repository = new InMemoryMobilityRepository();
  const authorization = new StaticMobilityAuthorization(
    {
      [actorA.userId]: actorA.tenantId,
      [actorB.userId]: actorB.tenantId,
    },
    {
      [actorA.userId]: allPermissions,
      [actorB.userId]: allPermissions,
    }
  );
  return {
    service: new MobilityFoundationService(
      repository,
      authorization,
      new SequentialMobilityIdFactory(),
      new FixedMobilityClock('2026-10-13T03:00:00.000Z')
    ),
    repository,
  };
}

async function registerVehicle(
  service: MobilityFoundationService,
  vin = '1HGCM82633A004353'
) {
  return (await service.registerVehicle(actorA, {
    idempotencyKey: `register-${vin}`,
    variantId: 'variant-a',
    vin,
    colorExterior: 'Pearl White',
    modelYear: 2026,
  })).value;
}
