import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import dotenv from 'dotenv';
import pg from 'pg';

import { MobilityFoundationService } from '../src/platform/mobility/mobility-foundation.service';
import { PostgresMobilityRepository } from '../src/platform/mobility/postgres.repository';
import type {
  MobilityActor,
  MobilityPermission,
  TenantId,
} from '../src/platform/mobility/domain/types';
import type {
  MobilityAuthorizationPort,
  MobilityClock,
  MobilityIdFactory,
} from '../src/platform/mobility/ports';
import {
  AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
  recognizeVehicleSaleRevenue,
  type JsonObject,
  type VehicleSaleRecognitionActor,
  type VehicleSaleRecognitionBooking,
  type VehicleSaleRecognitionCustomer,
  type VehicleSaleRecognitionLedgerInsert,
  type VehicleSaleRecognitionPolicy,
  type VehicleSaleRecognitionRecord,
  type VehicleSaleRecognitionRepository,
  type VehicleSaleRecognitionVehicle,
} from '../src/modules/bella-auto/services/VehicleSaleRecognitionService';

for (const envPath of [
  '.env.e2e',
  '../BELLA SPA ERP/.env.e2e',
  'D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e',
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const PRODUCTION_REF = 'lvnvkpyxtuilhrabtlwv';
const REQUIRED_MIGRATION_VERSIONS = [
  '20260803210000',
  '20260803240000',
  '20260804310000',
  '20261013120000',
  '20261014010000',
  '20261014020000',
  '20261014020100',
  '20261014020200',
];

const dbUrl =
  process.env.DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    'DB_URL, SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL is required for non-Production verification.'
  );
}

if (dbUrl.includes(PRODUCTION_REF)) {
  throw new Error('Refusing to run AutoMove sales-chain alignment verification against Production.');
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
});

type DbRow = Record<string, unknown>;

interface Fixtures {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  customerA: string;
  brandA: string;
  modelA: string;
  variantA: string;
  vehicleA: string;
  bookingA: string;
}

class StaticMobilityAuthorization implements MobilityAuthorizationPort {
  async ensureAllowed(params: {
    actor: MobilityActor;
    tenantId: TenantId;
    permission: MobilityPermission;
  }): Promise<void> {
    if (params.actor.tenantId !== params.tenantId) {
      throw new Error('Mobility actor tenant mismatch.');
    }

    if (!params.actor.roles.some((role) => ['admin', 'accountant', 'finance_manager'].includes(role))) {
      throw new Error(`Mobility actor is not authorized for ${params.permission}.`);
    }
  }
}

class PgVehicleSaleRecognitionRepository implements VehicleSaleRecognitionRepository {
  constructor(
    private readonly db: pg.Client,
    private readonly actorUserId: string
  ) {}

  async getActorProfile(actorUserId: string): Promise<VehicleSaleRecognitionActor | null> {
    return this.withAuthenticated(async () => {
      const result = await this.db.query<DbRow>(
        `select id, tenant_id, role, status from public.users where id = $1`,
        [actorUserId]
      );
      const row = result.rows[0];
      return row
        ? {
            id: getString(row, 'id'),
            tenantId: getString(row, 'tenant_id'),
            role: getString(row, 'role'),
            status: getNullableString(row, 'status'),
          }
        : null;
    });
  }

  async getVehicleById(vehicleId: string): Promise<VehicleSaleRecognitionVehicle | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select id, tenant_id from public.auto_vehicles where id = $1`,
        [vehicleId]
      );
      const row = result.rows[0];
      return row ? { id: getString(row, 'id'), tenantId: getString(row, 'tenant_id') } : null;
    });
  }

  async getCustomerById(customerId: string): Promise<VehicleSaleRecognitionCustomer | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select id, tenant_id from public.customers where id = $1`,
        [customerId]
      );
      const row = result.rows[0];
      return row ? { id: getString(row, 'id'), tenantId: getString(row, 'tenant_id') } : null;
    });
  }

  async getBookingById(bookingId: string): Promise<VehicleSaleRecognitionBooking | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select id, tenant_id, customer_id, vehicle_id
           from public.auto_bookings
          where id = $1`,
        [bookingId]
      );
      const row = result.rows[0];
      return row
        ? {
            id: getString(row, 'id'),
            tenantId: getString(row, 'tenant_id'),
            customerId: getString(row, 'customer_id'),
            vehicleId: getNullableString(row, 'vehicle_id'),
          }
        : null;
    });
  }

  async findActiveAccountingPolicies(params: {
    policyId: string;
    effectiveDate: string;
  }): Promise<VehicleSaleRecognitionPolicy[]> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select policy_id, version
           from public.policy_registry
          where policy_id = $1
            and status = 'active'
            and is_active = true
            and deleted_at is null
            and effective_date <= $2::date
            and (expire_date is null or expire_date > $2::date)
          order by version desc
          limit 2`,
        [params.policyId, params.effectiveDate]
      );

      return result.rows.map((row) => ({
        policyId: getString(row, 'policy_id'),
        version: getString(row, 'version'),
      }));
    });
  }

  async findRecognitionByIdempotencyKey(params: {
    tenantId: string;
    idempotencyKey: string;
  }): Promise<VehicleSaleRecognitionRecord | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select *
           from public.auto_vehicle_sale_recognitions
          where tenant_id = $1
            and idempotency_key = $2`,
        [params.tenantId, params.idempotencyKey]
      );
      return result.rows[0] ? mapRecognitionRow(result.rows[0]) : null;
    });
  }

  async findRecognitionBySaleTransactionId(params: {
    tenantId: string;
    saleTransactionId: string;
  }): Promise<VehicleSaleRecognitionRecord | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select *
           from public.auto_vehicle_sale_recognitions
          where tenant_id = $1
            and sale_transaction_id = $2`,
        [params.tenantId, params.saleTransactionId]
      );
      return result.rows[0] ? mapRecognitionRow(result.rows[0]) : null;
    });
  }

  async insertRecognition(input: VehicleSaleRecognitionLedgerInsert): Promise<VehicleSaleRecognitionRecord> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `insert into public.auto_vehicle_sale_recognitions (
           tenant_id, sale_transaction_id, idempotency_key, booking_id, vehicle_id, customer_id,
           recognized_at, recognized_by_user_id, recognition_basis, source_document_type,
           source_document_id, handover_evidence_ref, accounting_policy_id,
           accounting_policy_version, sale_price_recognized, discount_amount,
           price_adjustment_amount, currency_code, deposit_received_total,
           payment_received_total, receivable_amount_at_recognition, cost_basis_at_sale,
           cost_basis_source_type, cost_basis_source_ref, cost_basis_components,
           warranty_entitlement_ref, metadata
         )
         values (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, $13,
           $14, $15, $16,
           $17, $18, $19,
           $20, $21, $22,
           $23, $24, $25::jsonb,
           $26, $27::jsonb
         )
         returning *`,
        [
          input.tenantId,
          input.saleTransactionId,
          input.idempotencyKey,
          input.bookingId,
          input.vehicleId,
          input.customerId,
          input.recognizedAt,
          input.recognizedByUserId,
          input.recognitionBasis,
          input.sourceDocumentType,
          input.sourceDocumentId,
          input.handoverEvidenceRef,
          input.accountingPolicyId,
          input.accountingPolicyVersion,
          input.salePriceRecognized,
          input.discountAmount,
          input.priceAdjustmentAmount,
          input.currencyCode,
          input.depositReceivedTotal,
          input.paymentReceivedTotal,
          input.receivableAmountAtRecognition,
          input.costBasisAtSale,
          input.costBasisSourceType,
          input.costBasisSourceRef,
          JSON.stringify(input.costBasisComponents),
          input.warrantyEntitlementRef,
          JSON.stringify(input.metadata),
        ]
      );

      return mapRecognitionRow(result.rows[0]);
    });
  }

  private async withAuthenticated<T>(operation: () => Promise<T>): Promise<T> {
    await client.query(`set local role authenticated`);
    await client.query(
      `select
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.role', 'authenticated', true)`,
      [this.actorUserId]
    );

    let operationError: unknown;
    try {
      return await operation();
    } catch (error: unknown) {
      operationError = error;
      throw error;
    } finally {
      try {
        await client.query(`reset role`);
      } catch (resetError: unknown) {
        if (!operationError) throw resetError;
      }
    }
  }

  private async withServiceRole<T>(operation: () => Promise<T>): Promise<T> {
    await client.query(`set local role service_role`);

    let operationError: unknown;
    try {
      return await operation();
    } catch (error: unknown) {
      operationError = error;
      throw error;
    } finally {
      try {
        await client.query(`reset role`);
      } catch (resetError: unknown) {
        if (!operationError) throw resetError;
      }
    }
  }
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function verifyMigrationHistory(): Promise<void> {
  const result = await client.query<DbRow>(
    `select version
       from supabase_migrations.schema_migrations
      where version = any($1::text[])`,
    [REQUIRED_MIGRATION_VERSIONS]
  );
  const appliedVersions = new Set(result.rows.map((row) => getString(row, 'version')));
  const missingVersions = REQUIRED_MIGRATION_VERSIONS.filter((version) => !appliedVersions.has(version));
  assertCondition(
    missingVersions.length === 0,
    `${missingVersions.join(', ')} must be recorded in E2E migration history.`
  );
}

async function verifyRequiredRelations(): Promise<void> {
  const requiredRelations = [
    'auto_bookings',
    'auto_deposits',
    'auto_vehicles',
    'auto_vehicle_status_logs',
    'auto_vehicle_sale_recognitions',
    'mobility_command_idempotency',
    'mobility_domain_events',
    'policy_registry',
  ];
  const result = await client.query<DbRow>(
    `select relation_name, to_regclass('public.' || relation_name) is not null as exists
       from unnest($1::text[]) as required_relations(relation_name)`,
    [requiredRelations]
  );

  for (const row of result.rows) {
    assertCondition(getBoolean(row, 'exists'), `public.${getString(row, 'relation_name')} must exist.`);
  }
}

async function insertFixtures(): Promise<Fixtures> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const fixtures = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    customerA: randomUUID(),
    customerB: randomUUID(),
    brandA: randomUUID(),
    modelA: randomUUID(),
    variantA: randomUUID(),
    vehicleA: randomUUID(),
    bookingA: randomUUID(),
  };

  await client.query(
    `insert into public.tenants (id, name, status)
     values ($1, $2, 'active'), ($3, $4, 'active')`,
    [
      fixtures.tenantA,
      `AutoMove Chain A ${suffix}`,
      fixtures.tenantB,
      `AutoMove Chain B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.users (id, email, full_name, role, status, tenant_id)
     values ($1, $2, 'AutoMove Chain User A', 'accountant', 'active', $3),
            ($4, $5, 'AutoMove Chain User B', 'accountant', 'active', $6)`,
    [
      fixtures.userA,
      `automove-chain-a-${suffix}@example.test`,
      fixtures.tenantA,
      fixtures.userB,
      `automove-chain-b-${suffix}@example.test`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.customers (id, phone, name_mother, tenant_id)
     values ($1, $2, 'AutoMove Chain Customer A', $3),
            ($4, $5, 'AutoMove Chain Customer B', $6)`,
    [
      fixtures.customerA,
      `88${suffix.slice(0, 10)}`,
      fixtures.tenantA,
      fixtures.customerB,
      `89${suffix.slice(0, 10)}`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.auto_brands (id, tenant_id, name)
     values ($1, $2, $3)`,
    [fixtures.brandA, fixtures.tenantA, `Chain Brand ${suffix}`]
  );

  await client.query(
    `insert into public.auto_models (id, tenant_id, brand_id, name)
     values ($1, $2, $3, $4)`,
    [fixtures.modelA, fixtures.tenantA, fixtures.brandA, `Chain Model ${suffix}`]
  );

  await client.query(
    `insert into public.auto_variants (id, tenant_id, model_id, name, year)
     values ($1, $2, $3, $4, 2026)`,
    [fixtures.variantA, fixtures.tenantA, fixtures.modelA, `Chain Variant ${suffix}`]
  );

  await client.query(
    `insert into public.auto_vehicles (
       id, tenant_id, variant_id, vin, color_exterior, model_year, list_price, cost_price, status
     )
     values ($1, $2, $3, $4, 'White', 2026, 1500000000, 1000000000, 'showroom')`,
    [
      fixtures.vehicleA,
      fixtures.tenantA,
      fixtures.variantA,
      makeVin('CHAINA', suffix),
    ]
  );

  return {
    tenantA: fixtures.tenantA,
    tenantB: fixtures.tenantB,
    userA: fixtures.userA,
    userB: fixtures.userB,
    customerA: fixtures.customerA,
    brandA: fixtures.brandA,
    modelA: fixtures.modelA,
    variantA: fixtures.variantA,
    vehicleA: fixtures.vehicleA,
    bookingA: fixtures.bookingA,
  };
}

async function verifyBookingAndDeposit(fixtures: Fixtures): Promise<void> {
  await withAuthenticated(fixtures.userA, async () => {
    const bookingNumber = `BK-CHAIN-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const bookingResult = await client.query<DbRow>(
      `insert into public.auto_bookings (
         id, tenant_id, customer_id, variant_id, vehicle_id, color_exterior,
         booking_number, total_price, deposit_amount, deposit_paid, payment_status, status
       )
       values ($1, $2, $3, $4, $5, 'White', $6, 1500000000, 100000000, 0, 'unpaid', 'pending')
       returning id, status, payment_status`,
      [
        fixtures.bookingA,
        fixtures.tenantA,
        fixtures.customerA,
        fixtures.variantA,
        fixtures.vehicleA,
        bookingNumber,
      ]
    );
    assertCondition(bookingResult.rowCount === 1, 'Booking insert must succeed for the tenant actor.');

    const depositResult = await client.query<DbRow>(
      `insert into public.auto_deposits (
         tenant_id, booking_id, amount, payment_method, transaction_ref, status,
         created_by, confirmed_by, confirmed_at, notes
       )
       values ($1, $2, 100000000, 'bank_transfer', $3, 'confirmed', $4, $4, now(), 'chain verifier deposit')
       returning id`,
      [
        fixtures.tenantA,
        fixtures.bookingA,
        `DEP-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
        fixtures.userA,
      ]
    );
    assertCondition(depositResult.rowCount === 1, 'Deposit insert must succeed for the tenant actor.');

    await client.query(
      `update public.auto_bookings
          set deposit_paid = 100000000,
              payment_status = 'fully_paid',
              status = 'confirmed',
              updated_at = now()
        where id = $1`,
      [fixtures.bookingA]
    );

    const check = await client.query<DbRow>(
      `select b.status, b.payment_status, b.deposit_paid, coalesce(sum(d.amount), 0) as deposit_total
         from public.auto_bookings b
         left join public.auto_deposits d on d.booking_id = b.id
        where b.id = $1
        group by b.id`,
      [fixtures.bookingA]
    );
    assertCondition(check.rowCount === 1, 'Booking and deposit must be visible to the tenant actor.');
    assertCondition(getString(check.rows[0], 'status') === 'confirmed', 'Booking must be confirmed after deposit.');
    assertCondition(getString(check.rows[0], 'payment_status') === 'fully_paid', 'Deposit must fully pay the required deposit.');
    assertCondition(getNumber(check.rows[0], 'deposit_total') === 100_000_000, 'Deposit total must be persisted.');
  });
}

async function verifyHandoverPersistence(fixtures: Fixtures): Promise<string> {
  const actor: MobilityActor = {
    tenantId: fixtures.tenantA,
    userId: fixtures.userA,
    roles: ['accountant'],
  };
  const service = new MobilityFoundationService(
    new PostgresMobilityRepository(client, true),
    new StaticMobilityAuthorization(),
    createIdFactory(),
    createFixedClock('2026-10-14T10:30:00.000Z')
  );

  await withAuthenticated(fixtures.userA, async () => {
    const allocated = await service.transitionVehicleStatus(actor, {
      idempotencyKey: `allocate-${fixtures.bookingA}`,
      vehicleId: fixtures.vehicleA,
      toStatus: 'allocated',
      allocatedToContractId: fixtures.bookingA,
      reason: 'Allocate vehicle to verified sale booking',
      metadata: { verifier: 'automove-sales-chain' },
    });
    assertCondition(!allocated.isDuplicate, 'Vehicle allocation must be a new transition.');

    const delivered = await service.transitionVehicleStatus(actor, {
      idempotencyKey: `deliver-${fixtures.bookingA}`,
      vehicleId: fixtures.vehicleA,
      toStatus: 'delivered',
      deliveredToCustomerId: fixtures.customerA,
      deliveryNotes: 'Vehicle handover confirmed by sales-chain verifier',
      reason: 'Vehicle handover confirmed',
      metadata: { verifier: 'automove-sales-chain' },
    });
    assertCondition(!delivered.isDuplicate, 'Vehicle handover must be a new transition.');

    await client.query(
      `update public.auto_bookings
          set status = 'completed',
              updated_at = now()
        where id = $1`,
      [fixtures.bookingA]
    );
  });

  const vehicleResult = await client.query<DbRow>(
    `select status, delivered_at, delivered_to_customer_id, delivery_notes
       from public.auto_vehicles
      where id = $1`,
    [fixtures.vehicleA]
  );
  const vehicle = vehicleResult.rows[0];
  assertCondition(vehicleResult.rowCount === 1, 'Vehicle must exist after handover.');
  assertCondition(getString(vehicle, 'status') === 'delivered', 'Vehicle must be delivered after handover.');
  assertCondition(
    getString(vehicle, 'delivered_to_customer_id') === fixtures.customerA,
    'Vehicle handover must persist the customer.'
  );
  assertCondition(
    getString(vehicle, 'delivery_notes').includes('handover confirmed'),
    'Vehicle handover must persist delivery notes.'
  );

  const bookingResult = await client.query<DbRow>(
    `select status
       from public.auto_bookings
      where id = $1`,
    [fixtures.bookingA]
  );
  assertCondition(getString(bookingResult.rows[0], 'status') === 'completed', 'Booking must persist completed status.');

  const logResult = await client.query<DbRow>(
    `select id, from_status, to_status
       from public.auto_vehicle_status_logs
      where vehicle_id = $1
        and to_status = 'delivered'
      order by created_at desc
      limit 1`,
    [fixtures.vehicleA]
  );
  assertCondition(logResult.rowCount === 1, 'Vehicle handover must create a delivered status log.');
  assertCondition(getString(logResult.rows[0], 'from_status') === 'allocated', 'Handover log must be allocated -> delivered.');

  const eventResult = await client.query<DbRow>(
    `select count(*)::int as count
       from public.mobility_domain_events
      where tenant_id = $1
        and entity_id = $2
        and event_type = 'vehicle.status_changed'`,
    [fixtures.tenantA, fixtures.vehicleA]
  );
  assertCondition(getNumber(eventResult.rows[0], 'count') >= 2, 'Vehicle lifecycle must emit persisted domain events.');

  return getString(logResult.rows[0], 'id');
}

async function verifyRecognitionAndReporting(fixtures: Fixtures, handoverLogId: string): Promise<void> {
  const repository = new PgVehicleSaleRecognitionRepository(client, fixtures.userA);
  const saleTransactionId = randomUUID();
  const command = {
    saleTransactionId,
    idempotencyKey: `chain-recognition-${saleTransactionId}`,
    bookingId: fixtures.bookingA,
    vehicleId: fixtures.vehicleA,
    customerId: fixtures.customerA,
    recognizedAt: '2026-10-14T11:00:00.000Z',
    recognitionBasis: 'vehicle handover status log and final approved sale agreement',
    sourceDocumentType: 'mobility_vehicle_status_log',
    sourceDocumentId: handoverLogId,
    handoverEvidenceRef: `mobility-status-log://${handoverLogId}`,
    salePriceRecognized: 1_500_000_000,
    discountAmount: 0,
    priceAdjustmentAmount: 0,
    depositReceivedTotal: 100_000_000,
    paymentReceivedTotal: 1_500_000_000,
    receivableAmountAtRecognition: 0,
    costBasisAtSale: 1_000_000_000,
    costBasisSourceType: 'approved_cost_basis_snapshot',
    costBasisSourceRef: fixtures.vehicleA,
    costBasisComponents: { vehicleCost: 1_000_000_000 },
    warrantyEntitlementRef: null,
    metadata: { verifier: 'automove-sales-chain' },
  };

  const created = await recognizeVehicleSaleRevenue({
    actorUserId: fixtures.userA,
    repository,
    command,
  });
  assertCondition(created.status === 'created', 'Recognition command must create the initial ledger row.');
  assertCondition(
    created.recognition.sourceDocumentId === handoverLogId,
    'Recognition must reference the persisted handover evidence.'
  );
  assertCondition(
    created.recognition.accountingPolicyId === AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
    'Recognition must resolve the trusted accounting policy.'
  );

  const retry = await recognizeVehicleSaleRevenue({
    actorUserId: fixtures.userA,
    repository,
    command,
  });
  assertCondition(retry.status === 'idempotent', 'Recognition retry must be idempotent.');
  assertCondition(retry.recognition.id === created.recognition.id, 'Recognition retry must not create another row.');

  const reporting = await readReportingSummary(fixtures.tenantA);
  assertCondition(reporting.recognitionCount === 1, 'Reporting chain must see one recognized sale.');
  assertCondition(reporting.vehicleSales === 1_500_000_000, 'Reporting must use recognized sale price snapshot.');
  assertCondition(reporting.totalCost === 1_000_000_000, 'Reporting must use recognized cost snapshot.');
  assertCondition(reporting.grossProfit === 500_000_000, 'Reporting gross profit must derive from recognition snapshots.');

  await client.query(
    `update public.auto_vehicles set cost_price = 1200000000 where id = $1`,
    [fixtures.vehicleA]
  );
  const afterCurrentCostChange = await readReportingSummary(fixtures.tenantA);
  assertCondition(
    afterCurrentCostChange.totalCost === 1_000_000_000,
    'Reporting must not recompute historical cost from current vehicle cost.'
  );

  await withAuthenticated(fixtures.userB, async () => {
    const tenantBRead = await client.query<DbRow>(
      `select id
         from public.auto_vehicle_sale_recognitions
        where id = $1`,
      [created.recognition.id]
    );
    assertCondition(tenantBRead.rowCount === 0, 'Tenant B must not read Tenant A recognition rows.');
  });
}

async function readReportingSummary(tenantId: string): Promise<{
  recognitionCount: number;
  vehicleSales: number;
  totalCost: number;
  grossProfit: number;
}> {
  const result = await client.query<DbRow>(
    `select count(*)::int as recognition_count,
            coalesce(sum(sale_price_recognized), 0) as vehicle_sales,
            coalesce(sum(cost_basis_at_sale), 0) as total_cost
       from public.auto_vehicle_sale_recognitions
      where tenant_id = $1`,
    [tenantId]
  );

  const row = result.rows[0] ?? {};
  const vehicleSales = getNumber(row, 'vehicle_sales');
  const totalCost = getNumber(row, 'total_cost');
  return {
    recognitionCount: getNumber(row, 'recognition_count'),
    vehicleSales,
    totalCost,
    grossProfit: vehicleSales - totalCost,
  };
}

async function withAuthenticated<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  await client.query(`set local role authenticated`);
  await client.query(
    `select
       set_config('request.jwt.claim.sub', $1, true),
       set_config('request.jwt.claim.role', 'authenticated', true)`,
    [userId]
  );

  let operationError: unknown;
  try {
    return await operation();
  } catch (error: unknown) {
    operationError = error;
    throw error;
  } finally {
    try {
      await client.query(`reset role`);
    } catch (resetError: unknown) {
      if (!operationError) throw resetError;
    }
  }
}

function createIdFactory(): MobilityIdFactory {
  return {
    next() {
      return randomUUID();
    },
  };
}

function createFixedClock(now: string): MobilityClock {
  return {
    now() {
      return now;
    },
  };
}

function makeVin(prefix: string, suffix: string): string {
  return `${prefix}${suffix}`.toUpperCase().slice(0, 17).padEnd(17, 'X');
}

function mapRecognitionRow(row: DbRow): VehicleSaleRecognitionRecord {
  return {
    id: getString(row, 'id'),
    tenantId: getString(row, 'tenant_id'),
    saleTransactionId: getString(row, 'sale_transaction_id'),
    idempotencyKey: getString(row, 'idempotency_key'),
    bookingId: getString(row, 'booking_id'),
    vehicleId: getString(row, 'vehicle_id'),
    customerId: getString(row, 'customer_id'),
    recognizedAt: getString(row, 'recognized_at'),
    recognizedByUserId: getString(row, 'recognized_by_user_id'),
    recognitionBasis: getString(row, 'recognition_basis'),
    sourceDocumentType: getString(row, 'source_document_type'),
    sourceDocumentId: getString(row, 'source_document_id'),
    handoverEvidenceRef: getString(row, 'handover_evidence_ref'),
    accountingPolicyId: getString(row, 'accounting_policy_id'),
    accountingPolicyVersion: getString(row, 'accounting_policy_version'),
    salePriceRecognized: getNumber(row, 'sale_price_recognized'),
    discountAmount: getNumber(row, 'discount_amount'),
    priceAdjustmentAmount: getNumber(row, 'price_adjustment_amount'),
    currencyCode: 'VND',
    depositReceivedTotal: getNumber(row, 'deposit_received_total'),
    paymentReceivedTotal: getNumber(row, 'payment_received_total'),
    receivableAmountAtRecognition: getNumber(row, 'receivable_amount_at_recognition'),
    costBasisAtSale: getNumber(row, 'cost_basis_at_sale'),
    costBasisSourceType: getString(row, 'cost_basis_source_type'),
    costBasisSourceRef: getString(row, 'cost_basis_source_ref'),
    costBasisComponents: getJsonObject(row, 'cost_basis_components'),
    warrantyEntitlementRef: getNullableString(row, 'warranty_entitlement_ref'),
    metadata: getJsonObject(row, 'metadata'),
    createdAt: getString(row, 'created_at'),
  };
}

function getString(row: DbRow, field: string): string {
  const value = row[field];
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Expected ${field} to be a string.`);
}

function getNullableString(row: DbRow, field: string): string | null {
  const value = row[field];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Expected ${field} to be a string or null.`);
}

function getNumber(row: DbRow, field: string): number {
  const value = row[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Expected ${field} to be numeric.`);
}

function getBoolean(row: DbRow, field: string): boolean {
  const value = row[field];
  if (typeof value === 'boolean') return value;
  throw new Error(`Expected ${field} to be a boolean.`);
}

function getJsonObject(row: DbRow, field: string): JsonObject {
  const value = row[field];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw new Error(`Expected ${field} to be a JSON object.`);
}

async function main(): Promise<void> {
  const target = new URL(dbUrl);
  console.log(`AutoMove sales-chain alignment target: ${target.hostname}/${target.pathname.replace(/^\//, '')}`);
  console.log('Mode: ROLLBACK transaction; Production ref guard enabled.');

  await client.connect();
  await client.query('begin');
  await client.query(`set local statement_timeout = '30s'`);
  await client.query(`set local row_security = on`);

  try {
    await verifyMigrationHistory();
    await verifyRequiredRelations();
    const fixtures = await insertFixtures();
    await verifyBookingAndDeposit(fixtures);
    const handoverLogId = await verifyHandoverPersistence(fixtures);
    await verifyRecognitionAndReporting(fixtures, handoverLogId);
    await client.query('rollback');
  } catch (error: unknown) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }

  console.log('AutoMove sales-chain Real DB alignment verification PASS (transaction rolled back).');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AutoMove sales-chain Real DB alignment verification FAILED: ${message}`);
  process.exit(1);
});
