import {
  AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
  recognizeVehicleSaleRevenue,
  VehicleSaleRecognitionCommand,
  VehicleSaleRecognitionError,
  VehicleSaleRecognitionLedgerInsert,
  VehicleSaleRecognitionRecord,
  VehicleSaleRecognitionRepository,
} from '../VehicleSaleRecognitionService';

const ids = {
  tenantA: '11111111-1111-4111-8111-111111111111',
  tenantB: '22222222-2222-4222-8222-222222222222',
  userAdminA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userViewerA: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  vehicleA: '33333333-3333-4333-8333-333333333333',
  vehicleB: '44444444-4444-4444-8444-444444444444',
  customerA: '55555555-5555-4555-8555-555555555555',
  customerB: '66666666-6666-4666-8666-666666666666',
  bookingA: '77777777-7777-4777-8777-777777777777',
  saleA: '88888888-8888-4888-8888-888888888888',
};

const baseCommand: VehicleSaleRecognitionCommand = {
  saleTransactionId: ids.saleA,
  idempotencyKey: 'fixture-one',
  bookingId: ids.bookingA,
  vehicleId: ids.vehicleA,
  customerId: ids.customerA,
  recognizedAt: '2026-10-14T09:00:00.000Z',
  recognitionBasis: 'handover evidence and final approved sale document',
  sourceDocumentType: 'vehicle_handover_record',
  sourceDocumentId: 'handover-001',
  handoverEvidenceRef: 'handover://evidence/001',
  salePriceRecognized: 1_500_000_000,
  discountAmount: 10_000_000,
  priceAdjustmentAmount: -5_000_000,
  depositReceivedTotal: 100_000_000,
  paymentReceivedTotal: 1_500_000_000,
  receivableAmountAtRecognition: 0,
  costBasisAtSale: 1_000_000_000,
  costBasisSourceType: 'approved_cost_basis_snapshot',
  costBasisSourceRef: 'cost-snapshot-001',
  costBasisComponents: { purchaseCost: 980_000_000, prepCost: 20_000_000 },
  warrantyEntitlementRef: 'warranty://terms/001',
  metadata: { approvalRef: 'approval-001' },
};

class InMemoryRecognitionRepository implements VehicleSaleRecognitionRepository {
  readonly inserted: VehicleSaleRecognitionLedgerInsert[] = [];
  private readonly records: VehicleSaleRecognitionRecord[] = [];

  actorRole = 'accountant';
  actorStatus: string | null = 'active';
  vehicleTenantId = ids.tenantA;
  customerTenantId = ids.tenantA;
  bookingTenantId = ids.tenantA;
  bookingCustomerId = ids.customerA;
  bookingVehicleId: string | null = ids.vehicleA;
  policies = [{ policyId: AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID, version: '1.0.0' }];

  async getActorProfile(actorUserId: string) {
    if (actorUserId !== ids.userAdminA && actorUserId !== ids.userViewerA) return null;
    return {
      id: actorUserId,
      tenantId: ids.tenantA,
      role: actorUserId === ids.userViewerA ? 'admin_staff' : this.actorRole,
      status: this.actorStatus,
    };
  }

  async getVehicleById(vehicleId: string) {
    if (vehicleId !== ids.vehicleA && vehicleId !== ids.vehicleB) return null;
    return {
      id: vehicleId,
      tenantId: vehicleId === ids.vehicleB ? ids.tenantB : this.vehicleTenantId,
    };
  }

  async getCustomerById(customerId: string) {
    if (customerId !== ids.customerA && customerId !== ids.customerB) return null;
    return {
      id: customerId,
      tenantId: customerId === ids.customerB ? ids.tenantB : this.customerTenantId,
    };
  }

  async getBookingById(bookingId: string) {
    if (bookingId !== ids.bookingA) return null;
    return {
      id: bookingId,
      tenantId: this.bookingTenantId,
      customerId: this.bookingCustomerId,
      vehicleId: this.bookingVehicleId,
    };
  }

  async findActiveAccountingPolicies() {
    return this.policies;
  }

  async findRecognitionByIdempotencyKey(params: {
    tenantId: string;
    idempotencyKey: string;
  }) {
    return this.records.find(
      (record) =>
        record.tenantId === params.tenantId &&
        record.idempotencyKey === params.idempotencyKey
    ) ?? null;
  }

  async findRecognitionBySaleTransactionId(params: {
    tenantId: string;
    saleTransactionId: string;
  }) {
    return this.records.find(
      (record) =>
        record.tenantId === params.tenantId &&
        record.saleTransactionId === params.saleTransactionId
    ) ?? null;
  }

  async insertRecognition(input: VehicleSaleRecognitionLedgerInsert) {
    this.inserted.push(input);
    const record: VehicleSaleRecognitionRecord = {
      ...input,
      id: `recognition-${this.records.length + 1}`,
      createdAt: '2026-10-14T09:00:01.000Z',
    };
    this.records.push(record);
    return record;
  }

  seedRecognition(record: VehicleSaleRecognitionRecord): void {
    this.records.push(record);
  }
}

describe('VehicleSaleRecognitionService', () => {
  it('stores resolved accounting policy and immutable sale snapshots', async () => {
    const repository = new InMemoryRecognitionRepository();

    const result = await recognizeVehicleSaleRevenue({
      actorUserId: ids.userAdminA,
      command: baseCommand,
      repository,
    });

    expect(result.status).toBe('created');
    expect(repository.inserted).toHaveLength(1);
    expect(repository.inserted[0]).toMatchObject({
      tenantId: ids.tenantA,
      saleTransactionId: ids.saleA,
      idempotencyKey: 'fixture-one',
      bookingId: ids.bookingA,
      vehicleId: ids.vehicleA,
      customerId: ids.customerA,
      recognizedByUserId: ids.userAdminA,
      accountingPolicyId: AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
      accountingPolicyVersion: '1.0.0',
      salePriceRecognized: 1_500_000_000,
      costBasisAtSale: 1_000_000_000,
      metadata: {
        approvalRef: 'approval-001',
        command: 'recognize_vehicle_sale_revenue',
      },
    });
  });

  it('rejects caller-supplied accounting policy fields', async () => {
    const repository = new InMemoryRecognitionRepository();
    const commandWithPolicy = {
      ...baseCommand,
      accounting_policy_version: '9.9.9',
    } as unknown as VehicleSaleRecognitionCommand;

    await expect(
      recognizeVehicleSaleRevenue({
        actorUserId: ids.userAdminA,
        command: commandWithPolicy,
        repository,
      })
    ).rejects.toMatchObject({
      code: 'CALLER_POLICY_NOT_ALLOWED',
    });

    expect(repository.inserted).toHaveLength(0);
  });

  it('returns the existing recognition on exact idempotent retry', async () => {
    const repository = new InMemoryRecognitionRepository();
    const first = await recognizeVehicleSaleRevenue({
      actorUserId: ids.userAdminA,
      command: baseCommand,
      repository,
    });

    const retry = await recognizeVehicleSaleRevenue({
      actorUserId: ids.userAdminA,
      command: baseCommand,
      repository,
    });

    expect(first.recognition.id).toBe(retry.recognition.id);
    expect(retry.status).toBe('idempotent');
    expect(repository.inserted).toHaveLength(1);
  });

  it('fails closed when a sale transaction was already recognized with another key', async () => {
    const repository = new InMemoryRecognitionRepository();
    await recognizeVehicleSaleRevenue({
      actorUserId: ids.userAdminA,
      command: baseCommand,
      repository,
    });

    await expect(
      recognizeVehicleSaleRevenue({
        actorUserId: ids.userAdminA,
        command: {
          ...baseCommand,
          idempotencyKey: 'another-idempotency-key',
        },
        repository,
      })
    ).rejects.toMatchObject({
      code: 'SALE_TRANSACTION_ALREADY_RECOGNIZED',
    });
  });

  it('rejects non-accounting-capable actors before writing', async () => {
    const repository = new InMemoryRecognitionRepository();

    await expect(
      recognizeVehicleSaleRevenue({
        actorUserId: ids.userViewerA,
        command: baseCommand,
        repository,
      })
    ).rejects.toMatchObject({
      code: 'ACTOR_NOT_AUTHORIZED',
    });

    expect(repository.inserted).toHaveLength(0);
  });

  it('rejects cross-tenant booking, vehicle, or customer references', async () => {
    const repository = new InMemoryRecognitionRepository();
    repository.bookingTenantId = ids.tenantB;

    await expect(
      recognizeVehicleSaleRevenue({
        actorUserId: ids.userAdminA,
        command: baseCommand,
        repository,
      })
    ).rejects.toMatchObject({
      code: 'BOOKING_OUTSIDE_TENANT',
    });
  });

  it('fails closed when no active accounting policy matches', async () => {
    const repository = new InMemoryRecognitionRepository();
    repository.policies = [];

    await expect(
      recognizeVehicleSaleRevenue({
        actorUserId: ids.userAdminA,
        command: baseCommand,
        repository,
      })
    ).rejects.toMatchObject({
      code: 'ACCOUNTING_POLICY_NOT_FOUND',
    });
  });
});
