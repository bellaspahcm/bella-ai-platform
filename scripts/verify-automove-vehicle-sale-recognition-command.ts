import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';
import pg from 'pg';

import {
  AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
  recognizeVehicleSaleRevenue,
  type VehicleSaleRecognitionActor,
  type VehicleSaleRecognitionBooking,
  type VehicleSaleRecognitionCustomer,
  type JsonObject,
  type VehicleSaleRecognitionLedgerInsert,
  type VehicleSaleRecognitionPolicy,
  type VehicleSaleRecognitionRecord,
  type VehicleSaleRecognitionRepository,
  type VehicleSaleRecognitionVehicle,
} from '../src/modules/bella-auto/services/VehicleSaleRecognitionService';

for (const envPath of ['.env.e2e', '../BELLA SPA ERP/.env.e2e']) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const PRODUCTION_REF = 'lvnvkpyxtuilhrabtlwv';
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
  throw new Error('Refusing to run AutoMove command verification against Production.');
}

const migrationSql = readFileSync(
  resolve('supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql'),
  'utf8'
);

const prerequisiteMigrations = [
  {
    table: 'policy_registry',
    path: 'supabase/migrations/20261014020000_create_policy_registry_user_identity_forward.sql',
  },
  {
    table: 'auto_bookings',
    path: 'supabase/migrations/20260803240000_create_auto_leads_bookings.sql',
  },
];

const { Client } = pg;
const client = new Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
});

type DbRow = Record<string, unknown>;

interface CommandFixtures {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  customerA: string;
  vehicleA: string;
  bookingA: string;
}

class PgVehicleSaleRecognitionRepository
  implements VehicleSaleRecognitionRepository
{
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
      return row
        ? { id: getString(row, 'id'), tenantId: getString(row, 'tenant_id') }
        : null;
    });
  }

  async getCustomerById(customerId: string): Promise<VehicleSaleRecognitionCustomer | null> {
    return this.withServiceRole(async () => {
      const result = await this.db.query<DbRow>(
        `select id, tenant_id from public.customers where id = $1`,
        [customerId]
      );
      const row = result.rows[0];
      return row
        ? { id: getString(row, 'id'), tenantId: getString(row, 'tenant_id') }
        : null;
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
        `select * from public.auto_vehicle_sale_recognitions
          where tenant_id = $1 and idempotency_key = $2`,
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
        `select * from public.auto_vehicle_sale_recognitions
          where tenant_id = $1 and sale_transaction_id = $2`,
        [params.tenantId, params.saleTransactionId]
      );
      return result.rows[0] ? mapRecognitionRow(result.rows[0]) : null;
    });
  }

  async insertRecognition(
    input: VehicleSaleRecognitionLedgerInsert
  ): Promise<VehicleSaleRecognitionRecord> {
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
    await this.db.query(`set local role authenticated`);
    await this.db.query(
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
        await this.db.query(`reset role`);
      } catch (resetError: unknown) {
        if (!operationError) throw resetError;
      }
    }
  }

  private async withServiceRole<T>(operation: () => Promise<T>): Promise<T> {
    await this.db.query(`set local role service_role`);
    let operationError: unknown;
    try {
      return await operation();
    } catch (error: unknown) {
      operationError = error;
      throw error;
    } finally {
      try {
        await this.db.query(`reset role`);
      } catch (resetError: unknown) {
        if (!operationError) throw resetError;
      }
    }
  }
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function applyMissingPrerequisitesInRollbackTransaction(): Promise<void> {
  for (const prerequisite of prerequisiteMigrations) {
    const result = await client.query<DbRow>(`select to_regclass($1) as relation`, [
      `public.${prerequisite.table}`,
    ]);

    if (result.rows[0]?.relation) continue;

    const prerequisiteSql = readFileSync(resolve(prerequisite.path), 'utf8');
    await client.query(prerequisiteSql);
  }
}

async function insertFixtures(): Promise<CommandFixtures> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const fixtures = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    customerA: randomUUID(),
    customerB: randomUUID(),
    brandA: randomUUID(),
    brandB: randomUUID(),
    modelA: randomUUID(),
    modelB: randomUUID(),
    variantA: randomUUID(),
    variantB: randomUUID(),
    vehicleA: randomUUID(),
    vehicleB: randomUUID(),
    bookingA: randomUUID(),
  };

  await client.query(
    `insert into public.tenants (id, name, status)
     values ($1, $2, 'active'), ($3, $4, 'active')`,
    [
      fixtures.tenantA,
      `AutoMove Recognition Command A ${suffix}`,
      fixtures.tenantB,
      `AutoMove Recognition Command B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.users (id, email, full_name, role, status, tenant_id)
     values ($1, $2, 'AutoMove Recognition User A', 'accountant', 'active', $3),
            ($4, $5, 'AutoMove Recognition User B', 'accountant', 'active', $6)`,
    [
      fixtures.userA,
      `automove-recognition-a-${suffix}@example.test`,
      fixtures.tenantA,
      fixtures.userB,
      `automove-recognition-b-${suffix}@example.test`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.customers (id, phone, name_mother, tenant_id)
     values ($1, $2, 'AutoMove Recognition Customer A', $3),
            ($4, $5, 'AutoMove Recognition Customer B', $6)`,
    [
      fixtures.customerA,
      `86${suffix.slice(0, 10)}`,
      fixtures.tenantA,
      fixtures.customerB,
      `87${suffix.slice(0, 10)}`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.auto_brands (id, tenant_id, name)
     values ($1, $2, $3), ($4, $5, $6)`,
    [
      fixtures.brandA,
      fixtures.tenantA,
      `Recognition Brand A ${suffix}`,
      fixtures.brandB,
      fixtures.tenantB,
      `Recognition Brand B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_models (id, tenant_id, brand_id, name)
     values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      fixtures.modelA,
      fixtures.tenantA,
      fixtures.brandA,
      `Recognition Model A ${suffix}`,
      fixtures.modelB,
      fixtures.tenantB,
      fixtures.brandB,
      `Recognition Model B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_variants (id, tenant_id, model_id, name, year)
     values ($1, $2, $3, $4, 2026), ($5, $6, $7, $8, 2026)`,
    [
      fixtures.variantA,
      fixtures.tenantA,
      fixtures.modelA,
      `Recognition Variant A ${suffix}`,
      fixtures.variantB,
      fixtures.tenantB,
      fixtures.modelB,
      `Recognition Variant B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_vehicles (
       id, tenant_id, variant_id, vin, color_exterior, model_year, list_price, cost_price, status
     )
     values ($1, $2, $3, $4, 'White', 2026, 1500000000, 1000000000, 'delivered'),
            ($5, $6, $7, $8, 'Black', 2026, 1600000000, 1100000000, 'delivered')`,
    [
      fixtures.vehicleA,
      fixtures.tenantA,
      fixtures.variantA,
      `CMDVINA${suffix.slice(0, 10)}`,
      fixtures.vehicleB,
      fixtures.tenantB,
      fixtures.variantB,
      `CMDVINB${suffix.slice(0, 10)}`,
    ]
  );

  await client.query(
    `insert into public.auto_bookings (
       id, tenant_id, customer_id, variant_id, vehicle_id, color_exterior, booking_number,
       total_price, deposit_amount, deposit_paid, payment_status, status
     )
     values ($1, $2, $3, $4, $5, 'White', $6, 1500000000, 100000000, 100000000, 'fully_paid', 'completed')`,
    [
      fixtures.bookingA,
      fixtures.tenantA,
      fixtures.customerA,
      fixtures.variantA,
      fixtures.vehicleA,
      `BK-RECOGNITION-${suffix}`,
    ]
  );

  await ensureGlobalPolicy();

  return {
    tenantA: fixtures.tenantA,
    tenantB: fixtures.tenantB,
    userA: fixtures.userA,
    userB: fixtures.userB,
    customerA: fixtures.customerA,
    vehicleA: fixtures.vehicleA,
    bookingA: fixtures.bookingA,
  };
}

async function ensureGlobalPolicy(): Promise<void> {
  const existing = await client.query<DbRow>(
    `select policy_id, version
       from public.policy_registry
      where policy_id = $1
        and status = 'active'
        and is_active = true
        and deleted_at is null
        and effective_date <= current_date
        and (expire_date is null or expire_date > current_date)
      limit 2`,
    [AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID]
  );

  if ((existing.rowCount ?? 0) > 0) return;

  await client.query(
    `insert into public.policy_registry (
       policy_id, version, name, status, category, is_active, effective_date,
       expire_date, config, metadata
     )
     values ($1, '1.0.0', 'AutoMove Vehicle Sale Accounting Policy v1',
       'active', 'automove-accounting', true, current_date, null, '{}'::jsonb, '{}'::jsonb)
     on conflict (policy_id, version) do update
       set status = 'active',
           is_active = true,
           effective_date = current_date,
           expire_date = null,
           deleted_at = null`,
    [AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID]
  );
}

async function verifyRuntimeCommand(fixtures: CommandFixtures): Promise<void> {
  const repository = new PgVehicleSaleRecognitionRepository(client, fixtures.userA);
  const saleTransactionId = randomUUID();
  const idempotencyKey = `recognize-${saleTransactionId}`;
  const command = {
    saleTransactionId,
    idempotencyKey,
    bookingId: fixtures.bookingA,
    vehicleId: fixtures.vehicleA,
    customerId: fixtures.customerA,
    recognizedAt: '2026-10-14T09:00:00.000Z',
    recognitionBasis: 'handover evidence and final approved sale document',
    sourceDocumentType: 'vehicle_handover_record',
    sourceDocumentId: `handover-${saleTransactionId}`,
    handoverEvidenceRef: `handover://evidence/${saleTransactionId}`,
    salePriceRecognized: 1_500_000_000,
    discountAmount: 0,
    priceAdjustmentAmount: 0,
    depositReceivedTotal: 100_000_000,
    paymentReceivedTotal: 1_500_000_000,
    receivableAmountAtRecognition: 0,
    costBasisAtSale: 1_000_000_000,
    costBasisSourceType: 'approved_cost_basis_snapshot',
    costBasisSourceRef: fixtures.vehicleA,
    costBasisComponents: { purchaseCost: 980_000_000, prepCost: 20_000_000 },
    warrantyEntitlementRef: `warranty://terms/${saleTransactionId}`,
    metadata: { verifier: 'automove-command' },
  };

  const created = await recognizeVehicleSaleRevenue({
    actorUserId: fixtures.userA,
    repository,
    command,
  });

  assertCondition(created.status === 'created', 'Initial command should create a recognition.');
  assertCondition(
    created.recognition.accountingPolicyId === AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY_ID,
    'Recognition must store the trusted resolved policy id.'
  );
  assertCondition(
    created.recognition.costBasisAtSale === 1_000_000_000,
    'Recognition must store the sale-time cost basis snapshot.'
  );

  const retry = await recognizeVehicleSaleRevenue({
    actorUserId: fixtures.userA,
    repository,
    command,
  });

  assertCondition(retry.status === 'idempotent', 'Retry must return existing recognition.');
  assertCondition(
    retry.recognition.id === created.recognition.id,
    'Retry must not create a duplicate recognition.'
  );

  await client.query(
    `update public.auto_vehicles set cost_price = 1200000000 where id = $1`,
    [fixtures.vehicleA]
  );
  const stored = await client.query<DbRow>(
    `select cost_basis_at_sale from public.auto_vehicle_sale_recognitions where id = $1`,
    [created.recognition.id]
  );
  assertCondition(
    Number(stored.rows[0]?.cost_basis_at_sale) === 1_000_000_000,
    'Stored recognition cost basis must not change when vehicle current cost changes.'
  );

  await client.query(`set local role authenticated`);
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
    fixtures.userB,
  ]);
  const tenantBRead = await client.query<DbRow>(
    `select id from public.auto_vehicle_sale_recognitions where id = $1`,
    [created.recognition.id]
  );
  assertCondition(
    tenantBRead.rowCount === 0,
    'Tenant B must not read Tenant A recognition rows.'
  );
  await client.query(`reset role`);
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

function getJsonObject(row: DbRow, field: string): JsonObject {
  const value = row[field];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw new Error(`Expected ${field} to be a JSON object.`);
}

async function main(): Promise<void> {
  await client.connect();
  await client.query('begin');
  await client.query(`set local statement_timeout = '30s'`);
  await client.query(`set local row_security = on`);
  await applyMissingPrerequisitesInRollbackTransaction();
  await client.query(migrationSql);
  const fixtures = await insertFixtures();
  await verifyRuntimeCommand(fixtures);
  await client.query('rollback');
  console.log('AutoMove vehicle sale recognition command verification PASS (transaction rolled back).');
}

main().catch(async (error: unknown) => {
  try {
    await client.query('rollback');
  } catch {
    // Preserve the original failure.
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await client.end().catch(() => undefined);
});
