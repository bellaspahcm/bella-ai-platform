import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';
import pg from 'pg';

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
  throw new Error('Refusing to run AutoMove financial reporting verification against Production.');
}

const migrationSql = readFileSync(
  resolve('supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql'),
  'utf8'
);

const policyRegistryMigrationPath =
  'supabase/migrations/20261014020000_create_policy_registry_user_identity_forward.sql';

const { Client } = pg;
const client = new Client({
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
  vehicleA: string;
  vehicleB: string;
  recognitionA: string;
  recognitionB: string;
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function applyMissingPrerequisitesInRollbackTransaction(): Promise<void> {
  const policyResult = await client.query<DbRow>(
    `select to_regclass('public.policy_registry') as relation`
  );
  if (!policyResult.rows[0]?.relation) {
    await client.query(readFileSync(resolve(policyRegistryMigrationPath), 'utf8'));
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
    brandB: randomUUID(),
    modelA: randomUUID(),
    modelB: randomUUID(),
    variantA: randomUUID(),
    variantB: randomUUID(),
    vehicleA: randomUUID(),
    vehicleB: randomUUID(),
    recognitionA: randomUUID(),
    recognitionB: randomUUID(),
    recognitionOtherTenant: randomUUID(),
  };

  await client.query(
    `insert into public.tenants (id, name, status)
     values ($1, $2, 'active'), ($3, $4, 'active')`,
    [
      fixtures.tenantA,
      `AutoMove Reporting A ${suffix}`,
      fixtures.tenantB,
      `AutoMove Reporting B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.users (id, email, full_name, role, status, tenant_id)
     values ($1, $2, 'AutoMove Reporting User A', 'accountant', 'active', $3),
            ($4, $5, 'AutoMove Reporting User B', 'accountant', 'active', $6)`,
    [
      fixtures.userA,
      `automove-reporting-a-${suffix}@example.test`,
      fixtures.tenantA,
      fixtures.userB,
      `automove-reporting-b-${suffix}@example.test`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.customers (id, phone, name_mother, tenant_id)
     values ($1, $2, 'AutoMove Reporting Customer A', $3),
            ($4, $5, 'AutoMove Reporting Customer B', $6)`,
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
      `Reporting Brand A ${suffix}`,
      fixtures.brandB,
      fixtures.tenantB,
      `Reporting Brand B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_models (id, tenant_id, brand_id, name)
     values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      fixtures.modelA,
      fixtures.tenantA,
      fixtures.brandA,
      `Reporting Model A ${suffix}`,
      fixtures.modelB,
      fixtures.tenantB,
      fixtures.brandB,
      `Reporting Model B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_variants (id, tenant_id, model_id, name, year)
     values ($1, $2, $3, $4, 2026), ($5, $6, $7, $8, 2026)`,
    [
      fixtures.variantA,
      fixtures.tenantA,
      fixtures.modelA,
      `Reporting Variant A ${suffix}`,
      fixtures.variantB,
      fixtures.tenantB,
      fixtures.modelB,
      `Reporting Variant B ${suffix}`,
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
      `RPVIA${suffix}`,
      fixtures.vehicleB,
      fixtures.tenantB,
      fixtures.variantB,
      `RPVIB${suffix}`,
    ]
  );

  await ensureGlobalPolicy();

  await client.query(
    `insert into public.auto_vehicle_sale_recognitions (
       id, tenant_id, sale_transaction_id, idempotency_key, booking_id, vehicle_id,
       customer_id, recognized_at, recognized_by_user_id, recognition_basis,
       source_document_type, source_document_id, handover_evidence_ref,
       accounting_policy_id, accounting_policy_version, sale_price_recognized,
       discount_amount, price_adjustment_amount, deposit_received_total,
       payment_received_total, receivable_amount_at_recognition, cost_basis_at_sale,
       cost_basis_source_type, cost_basis_source_ref, cost_basis_components,
       warranty_entitlement_ref, metadata
     )
     values
       ($1, $2, $3, $4, null, $5, $6, '2026-10-10T09:00:00Z', $7,
        'handover evidence and final approved sale document',
        'vehicle_handover_record', $8, $9,
        'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY', '1.0.0',
        1500000000, 0, 0, 100000000, 1500000000, 0, 1000000000,
        'approved_cost_basis_snapshot', 'vehicle-snapshot-a', '{"purchaseCost":1000000000}'::jsonb,
        'warranty://reporting/a', '{"verifier":"reporting"}'::jsonb),
       ($10, $2, $11, $12, null, $5, $6, '2026-10-11T09:00:00Z', $7,
        'handover evidence and final approved sale document',
        'vehicle_handover_record', $13, $14,
        'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY', '1.0.0',
        800000000, 0, 0, 0, 800000000, 0, 700000000,
        'approved_cost_basis_snapshot', 'vehicle-snapshot-b', '{"purchaseCost":700000000}'::jsonb,
        null, '{"verifier":"reporting"}'::jsonb),
       ($15, $16, $17, $18, null, $19, $20, '2026-10-10T09:00:00Z', $21,
        'handover evidence and final approved sale document',
        'vehicle_handover_record', $22, $23,
        'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY', '1.0.0',
        2000000000, 0, 0, 0, 2000000000, 0, 1100000000,
        'approved_cost_basis_snapshot', 'vehicle-snapshot-other', '{"purchaseCost":1100000000}'::jsonb,
        null, '{"verifier":"other-tenant"}'::jsonb)`,
    [
      fixtures.recognitionA,
      fixtures.tenantA,
      randomUUID(),
      `reporting-${fixtures.recognitionA}`,
      fixtures.vehicleA,
      fixtures.customerA,
      fixtures.userA,
      `handover-${fixtures.recognitionA}`,
      `handover://evidence/${fixtures.recognitionA}`,
      fixtures.recognitionB,
      randomUUID(),
      `reporting-${fixtures.recognitionB}`,
      `handover-${fixtures.recognitionB}`,
      `handover://evidence/${fixtures.recognitionB}`,
      fixtures.recognitionOtherTenant,
      fixtures.tenantB,
      randomUUID(),
      `reporting-${fixtures.recognitionOtherTenant}`,
      fixtures.vehicleB,
      fixtures.customerB,
      fixtures.userB,
      `handover-${fixtures.recognitionOtherTenant}`,
      `handover://evidence/${fixtures.recognitionOtherTenant}`,
    ]
  );

  await client.query(
    `insert into public.auto_vehicle_sale_recognition_adjustments (
       tenant_id, recognition_id, adjustment_type, idempotency_key, reason, evidence_ref,
       accounting_policy_id, accounting_policy_version, sale_price_delta, cost_basis_delta
     )
     values ($1, $2, 'sale_revenue_adjusted', $3, 'approved sales price correction',
       $4, 'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY', '1.0.0', -100000000, 50000000)`,
    [
      fixtures.tenantA,
      fixtures.recognitionA,
      `adjust-${fixtures.recognitionA}`,
      `adjustment://evidence/${fixtures.recognitionA}`,
    ]
  );

  return {
    tenantA: fixtures.tenantA,
    tenantB: fixtures.tenantB,
    userA: fixtures.userA,
    userB: fixtures.userB,
    customerA: fixtures.customerA,
    vehicleA: fixtures.vehicleA,
    vehicleB: fixtures.vehicleB,
    recognitionA: fixtures.recognitionA,
    recognitionB: fixtures.recognitionB,
  };
}

async function ensureGlobalPolicy(): Promise<void> {
  await client.query(
    `insert into public.policy_registry (
       policy_id, version, name, status, category, is_active, effective_date,
       expire_date, config, metadata
     )
     values ('AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY', '1.0.0',
       'AutoMove Vehicle Sale Accounting Policy v1', 'active',
       'automove-accounting', true, current_date, null, '{}'::jsonb, '{}'::jsonb)
     on conflict (policy_id, version) do update
       set status = 'active',
           is_active = true,
           effective_date = current_date,
           expire_date = null,
           deleted_at = null`
  );
}

async function verifyRecognizedSalesReporting(fixtures: Fixtures): Promise<void> {
  const summary = await readReportingSummary(fixtures.tenantA);
  assertCondition(summary.recognitionCount === 2, 'Tenant A should have two recognized sales.');
  assertCondition(
    summary.vehicleSales === 2_200_000_000,
    'Vehicle sales should use recognized sale snapshots plus approved sale deltas.'
  );
  assertCondition(
    summary.totalCost === 1_750_000_000,
    'Vehicle cost should use sale-time cost basis snapshots plus approved cost deltas.'
  );
  assertCondition(summary.grossProfit === 450_000_000, 'Gross profit should be snapshot-based.');

  await client.query(
    `update public.auto_vehicles set cost_price = 9999999999 where id = $1`,
    [fixtures.vehicleA]
  );
  const afterMutableVehicleCostChange = await readReportingSummary(fixtures.tenantA);
  assertCondition(
    afterMutableVehicleCostChange.totalCost === 1_750_000_000,
    'Reporting must not recompute historical cost from mutable auto_vehicles.cost_price.'
  );

  await client.query(`set local role authenticated`);
  await client.query(
    `select
       set_config('request.jwt.claim.sub', $1, true),
       set_config('request.jwt.claim.role', 'authenticated', true)`,
    [fixtures.userB]
  );
  const tenantBRead = await client.query<DbRow>(
    `select id from public.auto_vehicle_sale_recognitions where id = $1`,
    [fixtures.recognitionA]
  );
  assertCondition(
    tenantBRead.rowCount === 0,
    'Tenant B must not read Tenant A recognition rows through RLS.'
  );
  await client.query(`reset role`);

  const otherTenantLeak = await readReportingSummary(fixtures.tenantB);
  assertCondition(
    otherTenantLeak.vehicleSales === 2_000_000_000,
    'Tenant-scoped reporting should not mix recognized sales across tenants.'
  );
}

async function readReportingSummary(tenantId: string): Promise<{
  recognitionCount: number;
  vehicleSales: number;
  totalCost: number;
  grossProfit: number;
}> {
  const result = await client.query<DbRow>(
    `with adjustment_totals as (
       select recognition_id,
              coalesce(sum(sale_price_delta), 0) as sale_price_delta,
              coalesce(sum(cost_basis_delta), 0) as cost_basis_delta
         from public.auto_vehicle_sale_recognition_adjustments
        where tenant_id = $1
        group by recognition_id
     )
     select count(*)::int as recognition_count,
            coalesce(sum(r.sale_price_recognized + coalesce(a.sale_price_delta, 0)), 0) as vehicle_sales,
            coalesce(sum(r.cost_basis_at_sale + coalesce(a.cost_basis_delta, 0)), 0) as total_cost
       from public.auto_vehicle_sale_recognitions r
       left join adjustment_totals a on a.recognition_id = r.id
      where r.tenant_id = $1`,
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

function getNumber(row: DbRow, field: string): number {
  const value = row[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Expected ${field} to be numeric.`);
}

async function main(): Promise<void> {
  await client.connect();
  await client.query('begin');
  await client.query(`set local statement_timeout = '30s'`);
  await client.query(`set local row_security = on`);
  await applyMissingPrerequisitesInRollbackTransaction();
  await client.query(migrationSql);
  const fixtures = await insertFixtures();
  await verifyRecognizedSalesReporting(fixtures);
  await client.query('rollback');
  console.log('AutoMove financial reporting recognized sales verification PASS (transaction rolled back).');
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
