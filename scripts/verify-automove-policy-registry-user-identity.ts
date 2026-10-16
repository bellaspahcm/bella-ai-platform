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
const REQUIRED_MIGRATION_VERSIONS = ['20261014020000', '20261014020100'];
const MIGRATION_PATH =
  'supabase/migrations/20261014020000_create_policy_registry_user_identity_forward.sql';
const RLS_HARDENING_MIGRATION_PATH =
  'supabase/migrations/20261014020100_harden_policy_registry_rls_profile_references.sql';
const AUTOMOVE_POLICY_ID = 'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY';
const AUTOMOVE_POLICY_VERSION = '1.0.0';
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
  throw new Error('Refusing to run AutoMove policy registry verification against Production.');
}

interface QueryRow {
  [column: string]: unknown;
}

const requiredColumns = [
  'id',
  'policy_id',
  'version',
  'name',
  'description',
  'status',
  'category',
  'tenant_id',
  'is_active',
  'parent_version',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'published_at',
  'published_by',
  'deprecated_at',
  'archived_at',
  'deleted_at',
  'deleted_by',
  'owner_department',
  'business_owner',
  'technical_owner',
  'effective_date',
  'expire_date',
  'config',
  'metadata',
  'total_decisions',
  'total_approvals',
  'total_rejections',
  'avg_confidence',
  'last_decision_at',
];

const actorColumns = ['created_by', 'updated_by', 'published_by', 'deleted_by'];

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

function verifyMigrationSource() {
  const migrationSql = readFileSync(resolve(MIGRATION_PATH), 'utf8');
  const rlsHardeningSql = readFileSync(resolve(RLS_HARDENING_MIGRATION_PATH), 'utf8');
  assert(
    !/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?profiles\b/i.test(migrationSql),
    'Forward migration must not create public.profiles compatibility schema.'
  );
  assert(
    !/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?policy_history\b/i.test(migrationSql),
    'Forward migration must not pull policy_history lifecycle into this batch.'
  );
  assert(
    /references\s+public[.]users\s*[(]id[)]/i.test(migrationSql),
    'Forward migration must bind actor identity to public.users(id).'
  );
  assert(
    /drop\s+policy\s+if\s+exists\s+"policy_registry_insert"/i.test(rlsHardeningSql) &&
      /drop\s+policy\s+if\s+exists\s+"policy_registry_update"/i.test(rlsHardeningSql) &&
      /drop\s+policy\s+if\s+exists\s+"policy_registry_delete"/i.test(rlsHardeningSql),
    'RLS hardening migration must remove legacy policy_registry policies.'
  );
  assert(
    /ILIKE\s+'%profiles%'/i.test(rlsHardeningSql),
    'RLS hardening migration must fail closed on remaining profiles references.'
  );
}

function createClient() {
  return new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });
}

async function verifyMigrationHistory(client: pg.Client) {
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

async function verifyTableAndColumns(client: pg.Client) {
  const tableResult = await client.query<QueryRow>(
    `select to_regclass('public.policy_registry') is not null as exists`
  );
  assert(booleanValue(tableResult.rows[0], 'exists'), 'public.policy_registry must exist.');

  const columnResult = await client.query<QueryRow>(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'policy_registry'`
  );
  const columns = new Set(columnResult.rows.map((row) => stringValue(row, 'column_name')));
  const missingColumns = requiredColumns.filter((column) => !columns.has(column));
  assert(missingColumns.length === 0, `policy_registry missing column(s): ${missingColumns.join(', ')}`);
}

async function verifyIdentityForeignKeys(client: pg.Client) {
  const fkResult = await client.query<QueryRow>(
    `select
       source_attribute.attname as column_name,
       target_class.relname as referenced_table
     from pg_constraint constraint_info
     join unnest(constraint_info.conkey) with ordinality as source_key(attnum, ordinal)
       on true
     join pg_attribute source_attribute
       on source_attribute.attrelid = constraint_info.conrelid
      and source_attribute.attnum = source_key.attnum
     join pg_class target_class
       on target_class.oid = constraint_info.confrelid
    where constraint_info.contype = 'f'
      and constraint_info.conrelid = 'public.policy_registry'::regclass`
  );

  const fkSet = new Set(
    fkResult.rows.map((row) => `${stringValue(row, 'column_name')}->${stringValue(row, 'referenced_table')}`)
  );
  const profileForeignKeys = fkResult.rows.filter((row) => stringValue(row, 'referenced_table') === 'profiles');
  assert(profileForeignKeys.length === 0, 'policy_registry must not retain public.profiles foreign keys.');

  for (const column of actorColumns) {
    assert(fkSet.has(`${column}->users`), `policy_registry.${column} must reference public.users(id).`);
  }
}

async function verifyConstraintsAndIndexes(client: pg.Client) {
  const uniqueResult = await client.query<QueryRow>(
    `select count(*)::int as count
       from pg_constraint
      where conrelid = 'public.policy_registry'::regclass
        and contype = 'u'
        and conkey = array[
          (select attnum from pg_attribute where attrelid = 'public.policy_registry'::regclass and attname = 'policy_id'),
          (select attnum from pg_attribute where attrelid = 'public.policy_registry'::regclass and attname = 'version')
        ]::int2[]`
  );
  assert(numberValue(uniqueResult.rows[0], 'count') >= 1, 'policy_registry requires UNIQUE(policy_id, version).');

  const activeIndexResult = await client.query<QueryRow>(
    `select i.indisunique, pg_get_expr(i.indpred, i.indrelid) as predicate
       from pg_index i
       join pg_class c on c.oid = i.indexrelid
      where c.relname = 'idx_policy_registry_one_active'
        and i.indrelid = 'public.policy_registry'::regclass`
  );
  assert(activeIndexResult.rowCount === 1, 'policy_registry active policy uniqueness index is required.');
  assert(booleanValue(activeIndexResult.rows[0], 'indisunique'), 'policy_registry active policy index must be unique.');
  const predicate = stringValue(activeIndexResult.rows[0], 'predicate');
  assert(
    predicate.includes('is_active') && predicate.includes('deleted_at'),
    'policy_registry active policy index must be scoped to active non-deleted rows.'
  );
}

async function verifyRlsAndGrants(client: pg.Client) {
  const rlsResult = await client.query<QueryRow>(
    `select relrowsecurity
       from pg_class
      where oid = 'public.policy_registry'::regclass`
  );
  assert(booleanValue(rlsResult.rows[0], 'relrowsecurity'), 'RLS must be enabled on policy_registry.');

  const policyResult = await client.query<QueryRow>(
    `select policyname, cmd, roles, qual, with_check
       from pg_policies
      where schemaname = 'public'
        and tablename = 'policy_registry'`
  );
  assert(policyResult.rowCount === 1, 'policy_registry must have exactly one approved RLS policy.');
  const policyRow = policyResult.rows[0];
  assert(
    stringValue(policyRow, 'policyname') === 'policy_registry_read_active_global_accounting_policy',
    'policy_registry must not retain legacy RLS policies.'
  );
  assert(stringValue(policyRow, 'cmd') === 'SELECT', 'policy_registry RLS policy must be SELECT-only.');
  const policyExpression = stringValue(policyRow, 'qual');
  const policyCheckExpression = policyRow.with_check === null ? '' : stringValue(policyRow, 'with_check');
  assert(
    !policyExpression.includes('profiles') && !policyCheckExpression.includes('profiles'),
    'policy_registry RLS policies must not reference legacy profiles identity.'
  );
  assert(
    policyExpression.includes('tenant_id IS NULL') &&
      policyExpression.includes("status = 'active'") &&
      policyExpression.includes('is_active') &&
      policyExpression.includes('deleted_at IS NULL'),
    'policy_registry RLS policy must expose only active non-deleted global policies.'
  );

  const grantResult = await client.query<QueryRow>(
    `select grantee, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'policy_registry'
        and grantee in ('authenticated', 'service_role', 'anon', 'PUBLIC')`
  );
  const grantSet = new Set(
    grantResult.rows.map((row) => `${stringValue(row, 'grantee')}:${stringValue(row, 'privilege_type')}`)
  );
  assert(grantSet.has('authenticated:SELECT'), 'authenticated requires SELECT on active policy registry rows.');
  assert(!grantSet.has('authenticated:INSERT'), 'authenticated must not INSERT policy_registry rows.');
  assert(!grantSet.has('authenticated:UPDATE'), 'authenticated must not UPDATE policy_registry rows.');
  assert(!grantSet.has('authenticated:DELETE'), 'authenticated must not DELETE policy_registry rows.');
  assert(grantSet.has('service_role:SELECT'), 'service_role requires SELECT on policy_registry.');
  assert(grantSet.has('service_role:INSERT'), 'service_role requires INSERT on policy_registry.');
  assert(grantSet.has('service_role:UPDATE'), 'service_role requires UPDATE on policy_registry.');
  assert(![...grantSet].some((entry) => entry.startsWith('anon:')), 'anon must not have policy_registry grants.');
  assert(![...grantSet].some((entry) => entry.startsWith('PUBLIC:')), 'PUBLIC must not have policy_registry grants.');
}

async function verifyActiveAutomovePolicy(client: pg.Client) {
  const policyResult = await client.query<QueryRow>(
    `select policy_id, version, status, is_active, tenant_id, effective_date, expire_date, deleted_at
       from public.policy_registry
      where policy_id = $1
        and version = $2`,
    [AUTOMOVE_POLICY_ID, AUTOMOVE_POLICY_VERSION]
  );
  assert(policyResult.rowCount === 1, 'Exactly one AutoMove vehicle sale accounting policy v1 row is required.');

  const row = policyResult.rows[0];
  assert(stringValue(row, 'status') === 'active', 'AutoMove accounting policy v1 must be active.');
  assert(booleanValue(row, 'is_active'), 'AutoMove accounting policy v1 must be marked active.');
  assert(row.tenant_id === null, 'AutoMove accounting policy v1 must be global for this approved scope.');
  assert(row.deleted_at === null, 'AutoMove accounting policy v1 must not be deleted.');
  assert(row.effective_date !== null, 'AutoMove accounting policy v1 must have an effective_date.');
  assert(row.expire_date === null, 'AutoMove accounting policy v1 must not be expired for this scope.');

  const resolverResult = await client.query<QueryRow>(
    `select policy_id, version
       from public.policy_registry
      where policy_id = $1
        and status = 'active'
        and is_active = true
        and deleted_at is null
        and tenant_id is null
        and effective_date <= current_date
        and (expire_date is null or expire_date > current_date)`,
    [AUTOMOVE_POLICY_ID]
  );
  assert(resolverResult.rowCount === 1, 'Trusted AutoMove policy resolver must find exactly one active global row.');
}

async function main() {
  verifyMigrationSource();

  const target = new URL(dbUrl);
  console.log(`AutoMove policy registry user-identity target: ${target.hostname}/${target.pathname.replace(/^\//, '')}`);
  console.log('Mode: READ ONLY; Production ref guard enabled.');

  const client = createClient();
  await client.connect();

  try {
    await client.query('begin read only');
    await client.query(`set local statement_timeout = '15s'`);
    await verifyMigrationHistory(client);
    await verifyTableAndColumns(client);
    await verifyIdentityForeignKeys(client);
    await verifyConstraintsAndIndexes(client);
    await verifyRlsAndGrants(client);
    await verifyActiveAutomovePolicy(client);
    await client.query('rollback');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }

  console.log('AutoMove policy registry user-identity verification PASS (read-only).');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AutoMove policy registry user-identity verification FAILED: ${message}`);
  process.exit(1);
});
