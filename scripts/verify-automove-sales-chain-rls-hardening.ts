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
const MIGRATION_PATH =
  'supabase/migrations/20261014020200_harden_automove_sales_chain_rls_grants.sql';
const REQUIRED_MIGRATION_VERSIONS = [
  '20260803240000',
  '20260804310000',
  '20261014010000',
  '20261014020000',
  '20261014020100',
  '20261014020200',
];
const TARGET_TABLES = ['auto_leads', 'auto_bookings', 'auto_deposits'] as const;
const REQUIRED_AUTHENTICATED_GRANTS = ['SELECT', 'INSERT', 'UPDATE'] as const;
const FORBIDDEN_AUTHENTICATED_GRANTS = ['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;

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
  throw new Error('Refusing to run AutoMove sales-chain RLS verification against Production.');
}

interface QueryRow {
  [column: string]: unknown;
}

interface SalesChainFixtures {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  customerA: string;
  customerB: string;
  variantA: string;
  vehicleA: string;
  bookingA: string;
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
});

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stringValue(row: QueryRow, column: string): string {
  const value = row[column];
  assert(typeof value === 'string', `Expected ${column} to be a string.`);
  return value;
}

function booleanValue(row: QueryRow, column: string): boolean {
  const value = row[column];
  assert(typeof value === 'boolean', `Expected ${column} to be a boolean.`);
  return value;
}

function numberValue(row: QueryRow, column: string): number {
  const value = row[column];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  throw new Error(`Expected ${column} to be numeric.`);
}

function verifyMigrationSource(): void {
  const migrationSql = readFileSync(resolve(MIGRATION_PATH), 'utf8');
  assert(
    !/(using|with\s+check)[\s\S]{0,160}get_auth_tenant_id\s*\(\s*\)\s+is\s+null/i.test(migrationSql),
    'Sales-chain RLS migration policies must not include null-tenant fallback.'
  );
  assert(
    !/grant\s+all\s+on\s+table\s+public\.(auto_leads|auto_bookings|auto_deposits)\s+to\s+authenticated/i.test(migrationSql),
    'Sales-chain RLS migration must not grant ALL to authenticated.'
  );
  assert(
    /revoke\s+all\s+on\s+table\s+public\.auto_deposits\s+from\s+authenticated/i.test(migrationSql),
    'Sales-chain RLS migration must revoke broad auto_deposits authenticated grants.'
  );
  for (const table of TARGET_TABLES) {
    assert(
      new RegExp(`grant\\s+select\\s*,\\s*insert\\s*,\\s*update\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+authenticated`, 'i')
        .test(migrationSql),
      `${table} must grant only SELECT, INSERT, UPDATE to authenticated.`
    );
  }
}

async function verifyMigrationHistory(): Promise<void> {
  const result = await client.query<QueryRow>(
    `select version
       from supabase_migrations.schema_migrations
      where version = any($1::text[])`,
    [REQUIRED_MIGRATION_VERSIONS]
  );
  const appliedVersions = new Set(result.rows.map((row) => stringValue(row, 'version')));
  const missingVersions = REQUIRED_MIGRATION_VERSIONS.filter((version) => !appliedVersions.has(version));
  assert(
    missingVersions.length === 0,
    `${missingVersions.join(', ')} must be recorded in E2E migration history.`
  );
}

async function verifyTablesAndRls(): Promise<void> {
  const relationResult = await client.query<QueryRow>(
    `select table_name, to_regclass('public.' || table_name) is not null as exists
       from unnest($1::text[]) as required_tables(table_name)`,
    [[...TARGET_TABLES]]
  );
  for (const row of relationResult.rows) {
    assert(booleanValue(row, 'exists'), `public.${stringValue(row, 'table_name')} must exist.`);
  }

  const rlsResult = await client.query<QueryRow>(
    `select c.relname, c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any($1::text[])`,
    [[...TARGET_TABLES]]
  );
  assert(rlsResult.rowCount === TARGET_TABLES.length, 'Expected RLS metadata for all sales-chain tables.');
  for (const row of rlsResult.rows) {
    assert(booleanValue(row, 'relrowsecurity'), `RLS must be enabled on ${stringValue(row, 'relname')}.`);
  }
}

async function verifyPolicies(): Promise<void> {
  const policyResult = await client.query<QueryRow>(
    `select tablename, policyname, cmd, qual, with_check
       from pg_policies
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename, policyname`,
    [[...TARGET_TABLES]]
  );

  const policiesByTable = new Map<string, QueryRow[]>();
  for (const row of policyResult.rows) {
    const table = stringValue(row, 'tablename');
    const rows = policiesByTable.get(table) ?? [];
    rows.push(row);
    policiesByTable.set(table, rows);
  }

  for (const table of TARGET_TABLES) {
    const rows = policiesByTable.get(table) ?? [];
    assert(rows.length === 3, `${table} must have exactly SELECT, INSERT, UPDATE tenant policies.`);
    const commands = new Set(rows.map((row) => stringValue(row, 'cmd')));
    for (const command of ['SELECT', 'INSERT', 'UPDATE']) {
      assert(commands.has(command), `${table} missing ${command} tenant policy.`);
    }
    assert(!commands.has('DELETE'), `${table} must not have DELETE tenant policy.`);

    for (const row of rows) {
      const expression = `${String(row.qual ?? '')} ${String(row.with_check ?? '')}`;
      assert(
        expression.includes('get_auth_tenant_id'),
        `${table}.${stringValue(row, 'policyname')} must use get_auth_tenant_id.`
      );
      assert(
        !/get_auth_tenant_id\s*\(\s*\)\s+IS\s+NULL/i.test(expression) &&
          !/IS\s+NULL\s+OR/i.test(expression),
        `${table}.${stringValue(row, 'policyname')} must not allow null-tenant fallback.`
      );
    }
  }
}

async function verifyGrants(): Promise<void> {
  const grantResult = await client.query<QueryRow>(
    `select table_name, grantee, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = any($1::text[])
        and grantee in ('authenticated', 'anon', 'PUBLIC')`,
    [[...TARGET_TABLES]]
  );

  const grantSet = new Set(
    grantResult.rows.map((row) => (
      `${stringValue(row, 'table_name')}:${stringValue(row, 'grantee')}:${stringValue(row, 'privilege_type')}`
    ))
  );

  for (const table of TARGET_TABLES) {
    for (const privilege of REQUIRED_AUTHENTICATED_GRANTS) {
      assert(grantSet.has(`${table}:authenticated:${privilege}`), `${table} missing authenticated ${privilege}.`);
    }
    for (const privilege of FORBIDDEN_AUTHENTICATED_GRANTS) {
      assert(!grantSet.has(`${table}:authenticated:${privilege}`), `${table} must not grant authenticated ${privilege}.`);
    }
    assert(
      ![...grantSet].some((entry) => entry.startsWith(`${table}:anon:`) || entry.startsWith(`${table}:PUBLIC:`)),
      `${table} must not grant anon or PUBLIC access.`
    );
  }
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

async function expectQueryError(
  query: string,
  params: unknown[],
  pattern: RegExp
): Promise<void> {
  const savepoint = `expected_error_${randomUUID().replaceAll('-', '')}`;
  await client.query(`savepoint ${savepoint}`);

  try {
    await client.query(query, params);
  } catch (error: unknown) {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `Expected error ${pattern}, got: ${message}`);
    return;
  }

  await client.query(`release savepoint ${savepoint}`);
  throw new Error('Expected query to fail, but it succeeded.');
}

async function insertFixtures(): Promise<SalesChainFixtures> {
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
      `AutoMove Sales Chain RLS A ${suffix}`,
      fixtures.tenantB,
      `AutoMove Sales Chain RLS B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.users (id, email, full_name, role, status, tenant_id)
     values ($1, $2, 'AutoMove Sales Chain User A', 'admin', 'active', $3),
            ($4, $5, 'AutoMove Sales Chain User B', 'admin', 'active', $6)`,
    [
      fixtures.userA,
      `automove-sales-chain-a-${suffix}@example.test`,
      fixtures.tenantA,
      fixtures.userB,
      `automove-sales-chain-b-${suffix}@example.test`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.customers (id, phone, name_mother, tenant_id)
     values ($1, $2, 'AutoMove Sales Chain Customer A', $3),
            ($4, $5, 'AutoMove Sales Chain Customer B', $6)`,
    [
      fixtures.customerA,
      `82${suffix.slice(0, 10)}`,
      fixtures.tenantA,
      fixtures.customerB,
      `83${suffix.slice(0, 10)}`,
      fixtures.tenantB,
    ]
  );

  await client.query(
    `insert into public.auto_brands (id, tenant_id, name)
     values ($1, $2, $3), ($4, $5, $6)`,
    [
      fixtures.brandA,
      fixtures.tenantA,
      `Sales Chain Brand A ${suffix}`,
      fixtures.brandB,
      fixtures.tenantB,
      `Sales Chain Brand B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_models (id, tenant_id, brand_id, name)
     values ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      fixtures.modelA,
      fixtures.tenantA,
      fixtures.brandA,
      `Sales Chain Model A ${suffix}`,
      fixtures.modelB,
      fixtures.tenantB,
      fixtures.brandB,
      `Sales Chain Model B ${suffix}`,
    ]
  );

  await client.query(
    `insert into public.auto_variants (id, tenant_id, model_id, name, year)
     values ($1, $2, $3, $4, 2026), ($5, $6, $7, $8, 2026)`,
    [
      fixtures.variantA,
      fixtures.tenantA,
      fixtures.modelA,
      `Sales Chain Variant A ${suffix}`,
      fixtures.variantB,
      fixtures.tenantB,
      fixtures.modelB,
      `Sales Chain Variant B ${suffix}`,
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
      `SCRLSA${suffix}`.slice(0, 17).padEnd(17, 'A'),
      fixtures.vehicleB,
      fixtures.tenantB,
      fixtures.variantB,
      `SCRLSB${suffix}`.slice(0, 17).padEnd(17, 'B'),
    ]
  );

  return {
    tenantA: fixtures.tenantA,
    tenantB: fixtures.tenantB,
    userA: fixtures.userA,
    userB: fixtures.userB,
    customerA: fixtures.customerA,
    customerB: fixtures.customerB,
    variantA: fixtures.variantA,
    vehicleA: fixtures.vehicleA,
    bookingA: fixtures.bookingA,
  };
}

async function verifyRuntimeBehavior(fixtures: SalesChainFixtures): Promise<void> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);

  await withAuthenticated(fixtures.userA, async () => {
    const bookingResult = await client.query<QueryRow>(
      `insert into public.auto_bookings (
         id, tenant_id, customer_id, variant_id, vehicle_id, color_exterior, booking_number,
         total_price, deposit_amount, deposit_paid, payment_status, status
       )
       values ($1, $2, $3, $4, $5, 'White', $6, 1500000000, 100000000, 0, 'unpaid', 'pending')
       returning id`,
      [
        fixtures.bookingA,
        fixtures.tenantA,
        fixtures.customerA,
        fixtures.variantA,
        fixtures.vehicleA,
        `BK-RLS-${suffix}`,
      ]
    );
    assert(bookingResult.rowCount === 1, 'Tenant A authenticated user must insert own-tenant booking.');

    const depositResult = await client.query<QueryRow>(
      `insert into public.auto_deposits (
         tenant_id, booking_id, amount, payment_method, status, created_by, notes
       )
       values ($1, $2, 100000000, 'bank_transfer', 'confirmed', $3, 'RLS verifier deposit')
       returning id`,
      [fixtures.tenantA, fixtures.bookingA, fixtures.userA]
    );
    assert(depositResult.rowCount === 1, 'Tenant A authenticated user must insert own-tenant deposit.');

    await client.query(
      `update public.auto_bookings
          set deposit_paid = 100000000,
              payment_status = 'fully_paid',
              status = 'confirmed'
        where id = $1`,
      [fixtures.bookingA]
    );

    const visibleResult = await client.query<QueryRow>(
      `select count(*)::int as count from public.auto_deposits where booking_id = $1`,
      [fixtures.bookingA]
    );
    assert(numberValue(visibleResult.rows[0], 'count') === 1, 'Tenant A must read own deposit rows.');

    await expectQueryError(
      `delete from public.auto_deposits where booking_id = $1`,
      [fixtures.bookingA],
      /permission denied|row-level security/
    );
  });

  await withAuthenticated(fixtures.userB, async () => {
    const tenantBRead = await client.query<QueryRow>(
      `select count(*)::int as count from public.auto_deposits where booking_id = $1`,
      [fixtures.bookingA]
    );
    assert(numberValue(tenantBRead.rows[0], 'count') === 0, 'Tenant B must not read Tenant A deposits.');

    await expectQueryError(
      `insert into public.auto_deposits (
         tenant_id, booking_id, amount, payment_method, status, created_by, notes
       )
       values ($1, $2, 100000000, 'cash', 'confirmed', $3, 'cross tenant denied')`,
      [fixtures.tenantA, fixtures.bookingA, fixtures.userB],
      /row-level security|permission denied/
    );
  });

  await withAuthenticated(randomUUID(), async () => {
    const unknownUserRead = await client.query<QueryRow>(
      `select count(*)::int as count from public.auto_deposits where booking_id = $1`,
      [fixtures.bookingA]
    );
    assert(
      numberValue(unknownUserRead.rows[0], 'count') === 0,
      'Unknown authenticated user must not read sales-chain rows.'
    );

    await expectQueryError(
      `insert into public.auto_bookings (
         tenant_id, customer_id, variant_id, vehicle_id, color_exterior, booking_number,
         total_price, deposit_amount, deposit_paid, payment_status, status
       )
       values ($1, $2, $3, $4, 'White', $5, 1500000000, 100000000, 0, 'unpaid', 'pending')`,
      [
        fixtures.tenantA,
        fixtures.customerA,
        fixtures.variantA,
        fixtures.vehicleA,
        `BK-RLS-UNKNOWN-${suffix}`,
      ],
      /row-level security|permission denied/
    );
  });
}

async function main(): Promise<void> {
  verifyMigrationSource();

  const target = new URL(dbUrl);
  console.log(`AutoMove sales-chain RLS hardening target: ${target.hostname}/${target.pathname.replace(/^\//, '')}`);
  console.log('Mode: ROLLBACK transaction; Production ref guard enabled.');

  await client.connect();
  await client.query('begin');
  await client.query(`set local statement_timeout = '30s'`);
  await client.query(`set local row_security = on`);

  try {
    await verifyMigrationHistory();
    await verifyTablesAndRls();
    await verifyPolicies();
    await verifyGrants();
    const fixtures = await insertFixtures();
    await verifyRuntimeBehavior(fixtures);
    await client.query('rollback');
  } catch (error: unknown) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }

  console.log('AutoMove sales-chain RLS hardening verification PASS (transaction rolled back).');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AutoMove sales-chain RLS hardening verification FAILED: ${message}`);
  process.exit(1);
});
