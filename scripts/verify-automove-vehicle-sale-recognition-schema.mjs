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
  throw new Error('DB_URL, SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL is required for non-Production verification.');
}

if (dbUrl.includes(PRODUCTION_REF)) {
  throw new Error('Refusing to run AutoMove schema verification against the Production Supabase project.');
}

const migrationSql = readFileSync(
  resolve('supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql'),
  'utf8'
);
const prerequisiteMigrations = [
  {
    table: 'policy_registry',
    path: 'supabase/migrations/20260701000001_create_policy_registry.sql',
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectQueryError(query, params, pattern) {
  const savepoint = `expected_error_${randomUUID().replaceAll('-', '')}`;
  await client.query(`savepoint ${savepoint}`);

  try {
    await client.query(query, params);
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `Expected error ${pattern}, got: ${message}`);
    return;
  }

  await client.query(`release savepoint ${savepoint}`);
  throw new Error('Expected query to fail, but it succeeded.');
}

async function insertFixtures() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const customerA = randomUUID();
  const customerB = randomUUID();
  const brandA = randomUUID();
  const brandB = randomUUID();
  const modelA = randomUUID();
  const modelB = randomUUID();
  const variantA = randomUUID();
  const variantB = randomUUID();
  const vehicleA = randomUUID();
  const vehicleB = randomUUID();
  const bookingA = randomUUID();
  const policyId = `AUTOMOVE_TEST_POLICY_${suffix}`;

  await client.query(
    `insert into public.tenants (id, name, status) values ($1, $2, 'active'), ($3, $4, 'active')`,
    [tenantA, `AutoMove Schema Test A ${suffix}`, tenantB, `AutoMove Schema Test B ${suffix}`]
  );

  await client.query(
    `insert into public.users (id, email, full_name, role, status, tenant_id)
     values ($1, $2, 'AutoMove Schema User A', 'admin', 'active', $3),
            ($4, $5, 'AutoMove Schema User B', 'admin', 'active', $6)`,
    [userA, `automove-schema-a-${suffix}@example.test`, tenantA, userB, `automove-schema-b-${suffix}@example.test`, tenantB]
  );

  await client.query(
    `insert into public.customers (id, phone, name_mother, tenant_id)
     values ($1, $2, 'AutoMove Schema Customer A', $3),
            ($4, $5, 'AutoMove Schema Customer B', $6)`,
    [customerA, `84${suffix.slice(0, 10)}`, tenantA, customerB, `85${suffix.slice(0, 10)}`, tenantB]
  );

  await client.query(
    `insert into public.auto_brands (id, tenant_id, name)
     values ($1, $2, $3), ($4, $5, $6)`,
    [brandA, tenantA, `Schema Brand A ${suffix}`, brandB, tenantB, `Schema Brand B ${suffix}`]
  );

  await client.query(
    `insert into public.auto_models (id, tenant_id, brand_id, name)
     values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [modelA, tenantA, brandA, `Schema Model A ${suffix}`, modelB, tenantB, brandB, `Schema Model B ${suffix}`]
  );

  await client.query(
    `insert into public.auto_variants (id, tenant_id, model_id, name, year)
     values ($1, $2, $3, $4, 2026), ($5, $6, $7, $8, 2026)`,
    [variantA, tenantA, modelA, `Schema Variant A ${suffix}`, variantB, tenantB, modelB, `Schema Variant B ${suffix}`]
  );

  await client.query(
    `insert into public.auto_vehicles (
       id, tenant_id, variant_id, vin, color_exterior, model_year, list_price, cost_price, status
     )
     values ($1, $2, $3, $4, 'Red', 2026, 1500000000, 1000000000, 'delivered'),
            ($5, $6, $7, $8, 'Blue', 2026, 1600000000, 1100000000, 'delivered')`,
    [vehicleA, tenantA, variantA, `TESTVIN${suffix.slice(0, 10)}`, vehicleB, tenantB, variantB, `TESTVIB${suffix.slice(0, 10)}`]
  );

  await client.query(
    `insert into public.auto_bookings (
       id, tenant_id, customer_id, variant_id, vehicle_id, color_exterior, booking_number,
       total_price, deposit_amount, deposit_paid, payment_status, status
     )
     values ($1, $2, $3, $4, $5, 'Red', $6, 1500000000, 100000000, 100000000, 'fully_paid', 'completed')`,
    [bookingA, tenantA, customerA, variantA, vehicleA, `BK-SCHEMA-${suffix}`]
  );

  await client.query(
    `insert into public.policy_registry (
       policy_id, version, name, status, category, is_active, effective_date, config, metadata
     )
     values ($1, '1.0.0', 'AutoMove Schema Verification Policy', 'active', 'automove-accounting', true, current_date, '{}'::jsonb, '{}'::jsonb)`,
    [policyId]
  );

  return {
    tenantA,
    tenantB,
    userA,
    userB,
    customerA,
    customerB,
    vehicleA,
    vehicleB,
    bookingA,
    policyId,
  };
}

async function verifySchemaMetadata() {
  const tableRows = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name in ('auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments')
      order by table_name`
  );
  assert(tableRows.rowCount === 2, 'Expected both AutoMove vehicle sale ledger tables to exist.');

  const rlsRows = await client.query(
    `select relname, relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments')`
  );
  assert(rlsRows.rows.every((row) => row.relrowsecurity === true), 'Expected RLS enabled on both ledger tables.');

  const policyRows = await client.query(
    `select tablename, cmd, qual, with_check
       from pg_policies
      where schemaname = 'public'
        and tablename in ('auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments')`
  );
  assert(policyRows.rowCount === 2, 'Expected exactly SELECT policies for both ledger tables.');
  assert(policyRows.rows.every((row) => row.cmd === 'SELECT'), 'Only SELECT policies are allowed before recognition command authorization.');
  assert(
    policyRows.rows.every((row) => !String(row.qual || row.with_check || '').includes('IS NULL OR')),
    'RLS policies must not allow null-tenant bypass.'
  );

  const grantRows = await client.query(
    `select table_name, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee = 'authenticated'
        and table_name in ('auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments')`
  );
  const grantSet = new Set(grantRows.rows.map((row) => `${row.table_name}:${row.privilege_type}`));
  for (const table of ['auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments']) {
    assert(grantSet.has(`${table}:SELECT`), `${table} missing authenticated SELECT grant.`);
    assert(!grantSet.has(`${table}:INSERT`), `${table} must not grant authenticated INSERT before command authorization.`);
    assert(!grantSet.has(`${table}:UPDATE`), `${table} must not grant authenticated UPDATE.`);
    assert(!grantSet.has(`${table}:DELETE`), `${table} must not grant authenticated DELETE.`);
  }
}

async function applyMissingPrerequisitesInRollbackTransaction() {
  const profilesResult = await client.query(`select to_regclass('public.profiles') as relation`);
  if (!profilesResult.rows[0]?.relation) {
    await client.query(`create table public.profiles (id uuid primary key)`);
    console.log('Created rollback-only compatibility stub public.profiles(id) for legacy policy_registry FK.');
  }

  for (const prerequisite of prerequisiteMigrations) {
    const result = await client.query(`select to_regclass($1) as relation`, [
      `public.${prerequisite.table}`,
    ]);

    if (result.rows[0]?.relation) continue;

    const prerequisiteSql = readFileSync(resolve(prerequisite.path), 'utf8');
    await client.query(prerequisiteSql);
    console.log(`Applied transactional prerequisite ${prerequisite.path} (rollback pending).`);
  }
}

async function verifyBehavior(fixtures) {
  const recognitionId = randomUUID();
  const saleTransactionId = randomUUID();

  await client.query(
    `insert into public.auto_vehicle_sale_recognitions (
       id, tenant_id, sale_transaction_id, idempotency_key, booking_id, vehicle_id, customer_id,
       recognized_at, recognized_by_user_id, recognition_basis, source_document_type, source_document_id,
       accounting_policy_id, accounting_policy_version, sale_price_recognized, discount_amount,
       price_adjustment_amount, deposit_received_total, payment_received_total, receivable_amount_at_recognition,
       cost_basis_at_sale, cost_basis_source_type, cost_basis_source_ref
     )
     values (
       $1, $2, $3, $4, $5, $6, $7,
       now(), $8, 'handover_confirmed', 'handover_record', $9,
       $10, '1.0.0', 1500000000, 0,
       0, 100000000, 1500000000, 0,
       1000000000, 'vehicle_cost_snapshot', $11
     )`,
    [
      recognitionId,
      fixtures.tenantA,
      saleTransactionId,
      'recognize-' + saleTransactionId,
      fixtures.bookingA,
      fixtures.vehicleA,
      fixtures.customerA,
      fixtures.userA,
      'handover-' + saleTransactionId,
      fixtures.policyId,
      fixtures.vehicleA,
    ]
  );

  await expectQueryError(
    `insert into public.auto_vehicle_sale_recognitions (
       tenant_id, sale_transaction_id, idempotency_key, booking_id, vehicle_id, customer_id,
       recognized_by_user_id, recognition_basis, source_document_type, source_document_id,
       accounting_policy_id, accounting_policy_version, sale_price_recognized, cost_basis_at_sale,
       cost_basis_source_type, cost_basis_source_ref
     )
     values ($1, $2, $3, $4, $5, $6, $7, 'handover_confirmed', 'handover_record', 'duplicate',
       $8, '1.0.0', 1500000000, 1000000000, 'vehicle_cost_snapshot', $9)`,
    [
      fixtures.tenantA,
      randomUUID(),
      'recognize-' + saleTransactionId,
      fixtures.bookingA,
      fixtures.vehicleA,
      fixtures.customerA,
      fixtures.userA,
      fixtures.policyId,
      fixtures.vehicleA,
    ],
    /duplicate key value/
  );

  await expectQueryError(
    `update public.auto_vehicle_sale_recognitions set metadata = '{"attempt":"mutate"}'::jsonb where id = $1`,
    [recognitionId],
    /append-only/
  );

  await expectQueryError(
    `insert into public.auto_vehicle_sale_recognitions (
       tenant_id, sale_transaction_id, idempotency_key, vehicle_id, customer_id,
       recognition_basis, source_document_type, source_document_id,
       accounting_policy_id, accounting_policy_version, sale_price_recognized, cost_basis_at_sale,
       cost_basis_source_type, cost_basis_source_ref
     )
     values ($1, $2, $3, $4, $5, 'handover_confirmed', 'handover_record', 'cross-tenant',
       $6, '1.0.0', 1500000000, 1000000000, 'vehicle_cost_snapshot', $7)`,
    [
      fixtures.tenantB,
      randomUUID(),
      'cross-' + randomUUID(),
      fixtures.vehicleA,
      fixtures.customerB,
      fixtures.policyId,
      fixtures.vehicleA,
    ],
    /outside the recognition tenant/
  );

  const adjustmentId = randomUUID();
  await client.query(
    `insert into public.auto_vehicle_sale_recognition_adjustments (
       id, tenant_id, recognition_id, adjustment_type, idempotency_key, reason, evidence_ref,
       created_by_user_id, accounting_policy_id, accounting_policy_version, sale_price_delta
     )
     values ($1, $2, $3, 'sale_revenue_adjusted', $4, 'approved correction', $5, $6, $7, '1.0.0', -10000000)`,
    [
      adjustmentId,
      fixtures.tenantA,
      recognitionId,
      'adjust-' + recognitionId,
      'adjustment-evidence-' + recognitionId,
      fixtures.userA,
      fixtures.policyId,
    ]
  );

  await expectQueryError(
    `update public.auto_vehicle_sale_recognition_adjustments set reason = 'mutate' where id = $1`,
    [adjustmentId],
    /append-only/
  );

  await client.query(`set local role authenticated`);
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [fixtures.userB]);

  const tenantBRead = await client.query(
    `select id from public.auto_vehicle_sale_recognitions where id = $1`,
    [recognitionId]
  );
  assert(tenantBRead.rowCount === 0, 'Tenant B must not read Tenant A recognition rows.');

  await expectQueryError(
    `insert into public.auto_vehicle_sale_recognitions (
       tenant_id, sale_transaction_id, idempotency_key, vehicle_id, customer_id,
       recognition_basis, source_document_type, source_document_id,
       accounting_policy_id, accounting_policy_version, sale_price_recognized, cost_basis_at_sale,
       cost_basis_source_type, cost_basis_source_ref
     )
     values ($1, $2, $3, $4, $5, 'handover_confirmed', 'handover_record', 'rls-negative',
       $6, '1.0.0', 1500000000, 1000000000, 'vehicle_cost_snapshot', $7)`,
    [
      fixtures.tenantA,
      randomUUID(),
      'rls-' + randomUUID(),
      fixtures.vehicleA,
      fixtures.customerA,
      fixtures.policyId,
      fixtures.vehicleA,
    ],
    /row-level security|permission denied|outside the recognition tenant/
  );

  await client.query(`reset role`);
}

try {
  await client.connect();
  await client.query('begin');
  await client.query(`set local statement_timeout = '30s'`);
  await applyMissingPrerequisitesInRollbackTransaction();
  await client.query(migrationSql);
  await verifySchemaMetadata();
  const fixtures = await insertFixtures();
  await verifyBehavior(fixtures);
  await client.query('rollback');
  console.log('AutoMove vehicle sale recognition schema verification PASS (transaction rolled back).');
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // ignore rollback failures while reporting the original error
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
