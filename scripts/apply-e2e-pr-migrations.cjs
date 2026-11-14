const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { basename } = require('node:path');
const { Client } = require('pg');

const MIGRATION_PATH = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/;
const EXPECTED_INTERIOR_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const PRODUCTION_PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const INTERIOR_TRIGGER_HARDENING_MIGRATION =
  'supabase/migrations/20261112230707_interior_trigger_function_hardening.sql';
const INTERIOR_BOQ_HISTORY_MIGRATION =
  'supabase/migrations/20261109140000_interior_boq_item_history.sql';
const INTERIOR_BOQ_HISTORY_READ_SCOPE_MIGRATION =
  'supabase/migrations/20261109124658_interior_boq_history_read_scope.sql';
const INTERIOR_BOQ_HISTORY_LINEAGE_FIX_MIGRATION =
  'supabase/migrations/20261109180000_interior_boq_history_lineage_fix.sql';
const INTERIOR_TRIGGER_FUNCTIONS = [
  'guard_interior_quotation_items_immutability',
  'guard_interior_quotations_immutability',
  'guard_interior_contracts_immutability',
  'guard_interior_payment_milestones_immutability',
  'guard_interior_customer_approvals_immutability',
  'interior_customer_approvals_updated_at',
  'interior_guard_boq_approval',
  'trg_record_interior_boq_item_history',
];
const FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION =
  'supabase/migrations/20260801030000_foundation_org_people_schema.sql';
const BLUEPRINT_CORE_SCHEMA_MIGRATION = 'supabase/migrations/20260806000000_blueprint_core_schema.sql';
const EDUCATION_STUDENTS_PLATFORM_SCHEMA_MIGRATION =
  'supabase/migrations/20260810224418_migrate_students_to_platform_schema.sql';
const EDUCATION_SCHEMA_MIGRATION = 'supabase/migrations/20260812060000_create_education_schema.sql';
const EDUCATION_ENROLLMENT_RPC_MIGRATION = 'supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql';
const EDUCATION_STUDENT_IDENTITY_CUTOVER_MIGRATION =
  'supabase/migrations/20260912000000_r3_education_identity_cutover.sql';
const EDUCATION_STUDENT_CREATE_SIDE_MIGRATION =
  'supabase/migrations/20260926002000_r3_student_create_side_nullable_person_id.sql';
const PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION =
  'supabase/migrations/20260927010000_preschool_guardian_pickup_authorizations.sql';
const USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION =
  'supabase/migrations/20260914_create_user_org_unit_access_projection.sql';
const LOGISTICS_DOMAIN_KERNEL_MIGRATION =
  'migrations/logistics/20260822_logistics_os_domain_kernel.sql';
const LOGISTICS_RUNTIME_PRIVILEGES_MIGRATION =
  'supabase/migrations/20261007090000_platform_logistics_runtime_privileges.sql';
const F2_V1_V2_BRIDGE_MIGRATION =
  'supabase/migrations/20261103100000_finance_f2_v1_v2_compatibility_bridge.sql';
const F2_LEGACY_V2_LEG_ORDER_COMPAT_MIGRATION =
  'supabase/migrations/20261104033616_finance_f2_legacy_v2_leg_order_compat.sql';
const F1_CATALOG_GUARD_MIGRATIONS = new Set([
  F2_V1_V2_BRIDGE_MIGRATION,
  F2_LEGACY_V2_LEG_ORDER_COMPAT_MIGRATION,
]);
const PLATFORM_RULE_DOMAIN_TYPE_SQL = `
DO $$ BEGIN
  CREATE TYPE public.platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

function isCiEnvironment(env) {
  return [env.CI, env.GITHUB_ACTIONS].some((value) => (
    typeof value === 'string' && value.length > 0
    && !['0', 'false', 'no'].includes(value.toLowerCase())
  ));
}

// pg-connection-string accepts query parameters that override the URL host,
// port and user. Restrict them before the client is even constructed.
function assertIsolatedE2eTarget(connectionString, expectedProjectRef, apiUrl) {
  const fail = () => { throw new Error('E2E_DATABASE_TARGET_REJECTED'); };
  if (expectedProjectRef !== EXPECTED_INTERIOR_E2E_PROJECT_REF) fail();

  let url;
  let api;
  let username;
  try {
    url = new URL(connectionString);
    api = new URL(apiUrl);
    username = decodeURIComponent(url.username);
  } catch {
    fail();
  }

  const allowedParams = new Set(['sslmode', 'ssl', 'uselibpqcompat', 'application_name', 'connect_timeout']);
  const seenParams = new Set();
  for (const [key] of url.searchParams) {
    if (!allowedParams.has(key) || seenParams.has(key)) fail();
    seenParams.add(key);
  }

  const direct = url.hostname === `db.${expectedProjectRef}.supabase.co`
    && (url.port === '' || url.port === '5432');
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
    && /^[a-zA-Z0-9_]+$/.test(username.slice(0, -(expectedProjectRef.length + 1)))
    && username.endsWith(`.${expectedProjectRef}`)
    && (url.port === '5432' || url.port === '6543');
  if (api.protocol !== 'https:' || api.hostname !== `${expectedProjectRef}.supabase.co`
    || api.port || api.username || api.password || api.pathname !== '/' || api.search || api.hash
    || !['postgres:', 'postgresql:'].includes(url.protocol) || !username || !url.password
    || url.hash || url.pathname !== '/postgres'
    || url.hostname.includes(PRODUCTION_PROJECT_REF) || username.includes(PRODUCTION_PROJECT_REF)
    || (!direct && !pooler)) fail();
}

function createE2eMigrationClient(connectionString, env = process.env, ClientConstructor = Client) {
  if (isCiEnvironment(env)) {
    assertIsolatedE2eTarget(connectionString, env.EXPECTED_E2E_PROJECT_REF, env.SUPABASE_URL);
  }
  return new ClientConstructor({ connectionString });
}

function needsInteriorTriggerHardeningDiagnostic(migrations) {
  return migrations.some((migration) => migration.file === INTERIOR_TRIGGER_HARDENING_MIGRATION);
}

// Catalog-only evidence to diagnose the prerequisite mismatch before any DDL.
async function inspectInteriorTriggerHardeningBaseline(client) {
  const functions = await client.query(
    `SELECT candidate.name,
            p.oid IS NOT NULL AS present, pg_get_userbyid(p.proowner) AS owner,
            p.prosecdef AS security_definer, p.proconfig AS configuration, p.proacl::text AS explicit_acl,
            CASE WHEN p.oid IS NULL THEN NULL ELSE ARRAY(
              SELECT format('%s:%s:%s',
                            CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
                            a.privilege_type, a.is_grantable)
                FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
               ORDER BY 1
            ) END AS effective_acl
       FROM unnest($1::text[]) AS candidate(name)
       LEFT JOIN pg_proc p ON p.oid = to_regprocedure(format('public.%I()', candidate.name))
      ORDER BY candidate.name`,
    [INTERIOR_TRIGGER_FUNCTIONS],
  );
  const relations = await client.query(
    `SELECT candidate.name, c.oid IS NOT NULL AS present,
            CASE WHEN c.oid IS NULL THEN NULL ELSE c.relrowsecurity END AS rls_enabled
       FROM unnest($1::text[]) AS candidate(name)
       LEFT JOIN pg_namespace n ON n.nspname = 'public'
       LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = candidate.name
                            AND c.relkind IN ('r', 'p')
      ORDER BY candidate.name`,
    [['tenants', 'interior_projects', 'interior_design_revisions', 'interior_project_room_zones',
      'interior_boqs', 'interior_boq_items', 'interior_boq_item_history',
      'interior_takeoff_runs', 'interior_takeoff_components']],
  );
  const authUsers = await client.query("SELECT to_regclass('auth.users') IS NOT NULL AS present");
  const expectedColumns = {
    interior_boqs: ['id', 'tenant_id', 'version_number', 'project_id'],
    interior_boq_items: [
      'tenant_id', 'boq_id', 'id', 'room_zone_id', 'room_zone_name', 'item_code', 'item_name',
      'category', 'dimensions_json', 'specifications_json', 'unit', 'quantity', 'internal_unit_cost',
      'internal_total_cost', 'client_unit_price', 'client_total_price', 'gross_margin_amount',
      'gross_margin_percent', 'source_takeoff_component_id', 'stable_component_id',
    ],
    interior_boq_item_history: [
      'id', 'tenant_id', 'boq_id', 'boq_item_id', 'boq_version_number', 'change_type', 'room_zone_id',
      'room_zone_name', 'item_code', 'item_name', 'category', 'dimensions_json', 'specifications_json',
      'unit', 'quantity', 'internal_unit_cost', 'internal_total_cost', 'client_unit_price',
      'client_total_price', 'gross_margin_amount', 'gross_margin_percent', 'lineage_metadata',
      'actor_id', 'recorded_at',
    ],
  };
  const expectedColumnPairs = Object.entries(expectedColumns).flatMap(([table, names]) =>
    names.map((name) => [table, name]));
  const columns = await client.query(
    `SELECT candidate.table_name, candidate.column_name,
            EXISTS (SELECT 1 FROM pg_attribute a
                     WHERE a.attrelid = to_regclass(format('public.%I', candidate.table_name))
                       AND a.attname = candidate.column_name AND NOT a.attisdropped) AS present
       FROM unnest($1::text[], $2::text[]) AS candidate(table_name, column_name)
      ORDER BY candidate.table_name, candidate.column_name`,
    [expectedColumnPairs.map(([table]) => table), expectedColumnPairs.map(([, name]) => name)],
  );
  const triggers = await client.query(
    `SELECT t.tgname AS name, t.tgenabled AS enabled, t.tgtype AS type,
            function_namespace.nspname AS function_schema, p.proname AS function_name
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace function_namespace ON function_namespace.oid = p.pronamespace
      WHERE n.nspname = 'public' AND c.relname = 'interior_boq_items'
        AND t.tgname = 'trg_interior_boq_items_history_capture' AND NOT t.tgisinternal`,
  );
  const policies = await client.query(
    `SELECT p.polname AS name FROM pg_policy p
       WHERE p.polrelid = to_regclass('public.interior_boq_item_history') ORDER BY p.polname`,
  );
  const historyReadFunction = await client.query(
    `SELECT p.oid IS NOT NULL AS present, p.prosecdef AS security_definer,
            COALESCE(p.proconfig, ARRAY[]::text[]) AS configuration,
            CASE WHEN p.oid IS NULL THEN NULL
                 ELSE has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_execute,
            CASE WHEN p.oid IS NULL THEN NULL
                 ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS authenticated_execute
       FROM (SELECT to_regprocedure('public.interior_get_boq_item_history(uuid,text)') AS oid) target
       LEFT JOIN pg_proc p ON p.oid = target.oid`,
  );
  const ledger = await client.query(
    "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS present",
  );
  const ledgerPresent = ledger.rows[0]?.present === true;
  const versions = ledgerPresent
    ? await client.query(
      `SELECT version FROM supabase_migrations.schema_migrations
        WHERE version = ANY($1::text[]) ORDER BY version`,
      [['20261109124658', '20261109140000', '20261109170000', '20261109180000']],
    )
    : { rows: [] };
  return {
    functions: functions.rows,
    relations: relations.rows,
    columns: columns.rows,
    triggers: triggers.rows,
    policies: policies.rows.map((row) => row.name),
    policyCount: policies.rows.length,
    authUsersPresent: authUsers.rows[0]?.present === true,
    historyReadFunction: historyReadFunction.rows[0],
    ledgerPresent,
    versions: versions.rows,
  };
}

function interiorHistoryVersions(diagnostic) {
  return new Set(diagnostic.versions.map(({ version }) => String(version)));
}

function interiorHistoryTableColumnsPresent(diagnostic) {
  const required = diagnostic.columns.filter(({ table_name }) => table_name === 'interior_boq_item_history');
  return required.length > 0 && required.every(({ present }) => present === true);
}

function isInteriorHistoryBaselineReady(diagnostic) {
  const relations = new Map(diagnostic.relations.map((row) => [row.name, row]));
  const columns = new Map(diagnostic.columns.map((row) => [`${row.table_name}.${row.column_name}`, row.present]));
  const functions = new Map(diagnostic.functions.map((row) => [row.name, row]));
  const versions = interiorHistoryVersions(diagnostic);
  const trigger = diagnostic.triggers[0];
  const readFunction = diagnostic.historyReadFunction;
  return relations.get('interior_boq_item_history')?.present === true
    && relations.get('interior_boq_item_history')?.rls_enabled === true
    && interiorHistoryTableColumnsPresent(diagnostic)
    && columns.get('interior_boq_items.source_takeoff_component_id') === true
    && columns.get('interior_boq_items.stable_component_id') === true
    && functions.get('trg_record_interior_boq_item_history')?.present === true
    && trigger?.enabled === 'O' && trigger.type === 27
    && trigger.function_schema === 'public'
    && trigger.function_name === 'trg_record_interior_boq_item_history'
    && diagnostic.policies.includes('tenant_isolation_policy')
    && versions.has('20261109124658') && versions.has('20261109140000')
    && versions.has('20261109180000')
    && readFunction?.present === true && readFunction.security_definer === true
    && readFunction.configuration.some((value) => value === 'search_path=""')
    && readFunction.anon_execute === false && readFunction.authenticated_execute === true;
}

function isPristineInteriorHistoryBaseline(diagnostic) {
  const relations = new Map(diagnostic.relations.map((row) => [row.name, row]));
  const columns = new Map(diagnostic.columns.map((row) => [`${row.table_name}.${row.column_name}`, row.present]));
  const functions = new Map(diagnostic.functions.map((row) => [row.name, row]));
  const versions = interiorHistoryVersions(diagnostic);
  return diagnostic.ledgerPresent === true
    && diagnostic.authUsersPresent === true
    && relations.get('tenants')?.present === true
    && relations.get('interior_project_room_zones')?.present === true
    && relations.get('interior_boqs')?.present === true
    && relations.get('interior_boqs')?.rls_enabled === true
    && relations.get('interior_boq_items')?.present === true
    && relations.get('interior_boq_items')?.rls_enabled === true
    && columns.get('interior_boqs.id') === true
    && columns.get('interior_boqs.tenant_id') === true
    && columns.get('interior_boqs.version_number') === true
    && columns.get('interior_boqs.project_id') === true
    && columns.get('interior_boq_items.tenant_id') === true
    && columns.get('interior_boq_items.boq_id') === true
    && columns.get('interior_boq_items.id') === true
    && columns.get('interior_boq_items.source_takeoff_component_id') === false
    && columns.get('interior_boq_items.stable_component_id') === false
    && relations.get('interior_boq_item_history')?.present === false
    && relations.get('interior_takeoff_runs')?.present === false
    && relations.get('interior_takeoff_components')?.present === false
    && functions.get('trg_record_interior_boq_item_history')?.present === false
    && diagnostic.triggers.length === 0 && diagnostic.policyCount === 0
    && versions.has('20261109124658')
    && !versions.has('20261109140000')
    && !versions.has('20261109170000')
    && !versions.has('20261109180000')
    && diagnostic.historyReadFunction?.present === true
    && diagnostic.historyReadFunction.security_definer === true
    && diagnostic.historyReadFunction.configuration.some((value) => value === 'search_path=""')
    && diagnostic.historyReadFunction.anon_execute === false
    && diagnostic.historyReadFunction.authenticated_execute === true;
}

async function ensureInteriorHistoryHardeningBaseline(client, migrations, diagnostic) {
  if (!needsInteriorTriggerHardeningDiagnostic(migrations)) return;
  if (isInteriorHistoryBaselineReady(diagnostic)) return;
  if (!isPristineInteriorHistoryBaseline(diagnostic)) {
    throw new Error(
      'INTERIOR_E2E_BASELINE_PARTIAL: refusing to replay Interior BOQ history DDL over an unknown catalog or ledger state.',
    );
  }

  console.log(
    'Repairing pristine isolated E2E Interior history prerequisites from canonical migrations; '
    + 'this CI-only fixture adds nullable BOQ lineage columns without Takeoff foreign keys and records no 20261109170000 migration.',
  );
  await client.query('BEGIN');
  try {
    await applyMigration(client, parseMigration(INTERIOR_BOQ_HISTORY_MIGRATION));
    await client.query(`
      ALTER TABLE public.interior_boq_items
        ADD COLUMN source_takeoff_component_id UUID,
        ADD COLUMN stable_component_id UUID
    `);
    await applyMigration(client, parseMigration(INTERIOR_BOQ_HISTORY_LINEAGE_FIX_MIGRATION));
    await client.query(readFileSync(INTERIOR_BOQ_HISTORY_READ_SCOPE_MIGRATION, 'utf8'));
    console.log(
      'Restored the already-recorded canonical BOQ history read-scope RPC after 20261109140000 replaced it; migration ledger unchanged for 20261109124658.',
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const repaired = await inspectInteriorTriggerHardeningBaseline(client);
  if (!isInteriorHistoryBaselineReady(repaired)) {
    throw new Error('INTERIOR_E2E_BASELINE_REPAIR_INCOMPLETE: canonical history prerequisites did not reach the expected catalog state.');
  }
}

async function assertInteriorTriggerHelpersHardened(client, migrations, before) {
  if (!needsInteriorTriggerHardeningDiagnostic(migrations)) return;
  const result = await client.query(
    `SELECT candidate.name, p.oid IS NOT NULL AS present,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
            COALESCE(p.proconfig, ARRAY[]::text[]) AS configuration
       FROM unnest($1::text[]) AS candidate(name)
       LEFT JOIN pg_proc p ON p.oid = to_regprocedure(format('public.%I()', candidate.name))
      ORDER BY candidate.name`,
    [INTERIOR_TRIGGER_FUNCTIONS],
  );
  const beforeFunctions = new Map(before.functions.map((row) => [row.name, row]));
  const failures = result.rows.filter((row) => (
    row.present !== true
    || row.anon_execute !== false
    || row.authenticated_execute !== false
    || row.service_role_execute !== false
    || (row.name !== 'interior_guard_boq_approval'
      && !row.configuration.includes('search_path=pg_catalog'))
    || (row.name === 'interior_guard_boq_approval'
      && JSON.stringify(row.configuration)
        !== JSON.stringify(beforeFunctions.get(row.name)?.configuration || []))
  ));
  if (result.rows.length !== INTERIOR_TRIGGER_FUNCTIONS.length || failures.length > 0) {
    throw new Error('INTERIOR_TRIGGER_HARDENING_POSTCONDITION_FAILED: helper privileges or search_path differ from the migration contract.');
  }
  console.log('PASS Interior trigger helper privilege and search_path catalog postcondition.');
}

function parseArgs(argv) {
  const baseIndex = argv.indexOf('--base');
  const filesIndex = argv.indexOf('--files');
  const dryRun = argv.includes('--dry-run');
  const explicitFiles = filesIndex >= 0
    ? (argv[filesIndex + 1] || '')
      .split(/[;,\n]/)
      .map((file) => file.trim().replace(/\\/g, '/'))
      .filter(Boolean)
    : [];

  return {
    baseRef: baseIndex >= 0 ? argv[baseIndex + 1] : process.env.BASE_REF || 'HEAD^',
    dryRun,
    explicitFiles,
  };
}

function gitLines(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listChangedMigrationFiles(baseRef) {
  if (!baseRef) throw new Error('A migration comparison base is required.');

  const lines = gitLines(['diff', '--name-status', '--diff-filter=ACMR', baseRef, 'HEAD', '--', 'supabase/migrations']);
  return lines
    .map((line) => {
      const parts = line.split(/\s+/);
      return parts.at(-1)?.replace(/\\/g, '/') ?? '';
    })
    .filter((file) => MIGRATION_PATH.test(file))
    .sort();
}

function listExplicitMigrationFiles(files) {
  const normalizedFiles = files.map((file) => file.replace(/\\/g, '/'));
  const invalidFiles = normalizedFiles.filter((file) => !MIGRATION_PATH.test(file));

  if (invalidFiles.length > 0) {
    throw new Error(`Invalid explicit migration file path(s): ${invalidFiles.join(', ')}`);
  }

  return normalizedFiles.sort();
}

function parseMigration(file) {
  const match = file.match(MIGRATION_PATH);
  if (!match) throw new Error(`Invalid migration file path: ${file}`);
  return {
    file,
    version: match[1],
    name: basename(file).replace(/^\d{14}_/, '').replace(/\.sql$/, ''),
    sql: readFileSync(file, 'utf8'),
  };
}

async function ensureMigrationHistory(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      statements TEXT[],
      name TEXT
    )
  `);
}

async function getF1CatalogSnapshot(client) {
  const result = await client.query(`
    SELECT p.proname,
           pg_catalog.pg_get_functiondef(p.oid) AS function_definition,
           r.rolname AS owner_name,
           p.prosecdef,
           COALESCE(pg_catalog.array_to_string(p.proconfig, ','), '') AS proconfig,
           COALESCE(pg_catalog.array_to_string(p.proacl, ','), '') AS acl,
           pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec,
           pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_exec
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname IN ('finance_post_transaction', 'finance_reverse_transaction')
    ORDER BY p.proname
  `);

  if (result.rows.length !== 2) {
    throw new Error('F1_FREEZE_CATALOG_INCOMPLETE: expected both frozen F1 RPCs before PR migration apply.');
  }

  return JSON.stringify(result.rows);
}

async function getMigrationHistoryColumns(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations'
      AND table_name = 'schema_migrations'
  `);
  return new Set(result.rows.map((row) => row.column_name));
}

async function hasRecordedMigration(client, version) {
  const result = await client.query(
    'SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1 LIMIT 1',
    [version],
  );
  return result.rowCount > 0;
}

function normalizeMigrationSql(sql) {
  return String(sql)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*--\s*zero-downtime:/i.test(line))
    .join('\n')
    .trim();
}

function normalizeRecordedMigrationStatements(statements) {
  if (!Array.isArray(statements) || statements.some((statement) => typeof statement !== 'string')) return null;
  const nonEmptyStatements = statements.map((statement) => statement.trim()).filter(Boolean);
  if (nonEmptyStatements.length === 0) return null;
  const sql = nonEmptyStatements.map((statement) => (
    /;\s*$/.test(statement) ? statement : `${statement};`
  )).join('\n');
  return normalizeMigrationSql(sql);
}

async function findEquivalentRecordedMigration(client, migration) {
  const columns = await getMigrationHistoryColumns(client);
  if (!columns.has('statements')) return null;

  const result = await client.query(
    `SELECT version, statements
     FROM supabase_migrations.schema_migrations
     WHERE version <> $1 AND statements IS NOT NULL`,
    [migration.version],
  );

  return result.rows.find((row) => (
    normalizeRecordedMigrationStatements(row.statements) === normalizeMigrationSql(migration.sql)
  ))?.version ?? null;
}

async function recordMigration(client, migration) {
  const columns = await getMigrationHistoryColumns(client);
  const insertColumns = ['version'];
  const placeholders = ['$1'];
  const values = [migration.version];

  if (columns.has('name')) {
    insertColumns.push('name');
    values.push(migration.name);
    placeholders.push(`$${values.length}`);
  }

  if (columns.has('statements')) {
    insertColumns.push('statements');
    values.push(['-- Applied by scripts/apply-e2e-pr-migrations.cjs for isolated E2E proof']);
    placeholders.push(`$${values.length}`);
  }

  await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (version) DO NOTHING`,
    values,
  );
}

async function relationExists(client, schemaName, relationName) {
  const result = await client.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`${schemaName}.${relationName}`],
  );
  return result.rows[0]?.exists === true;
}

async function schemaExists(client, schemaName) {
  const result = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [schemaName],
  );
  return result.rows[0]?.exists === true;
}

async function hasTablePrivilege(client, roleName, schemaName, tableName, privilege) {
  const result = await client.query(
    'SELECT has_table_privilege($1, $2, $3) AS has_privilege',
    [roleName, `${schemaName}.${tableName}`, privilege],
  );
  return result.rows[0]?.has_privilege === true;
}

async function hasSchemaPrivilege(client, roleName, schemaName, privilege) {
  const result = await client.query(
    'SELECT has_schema_privilege($1, $2, $3) AS has_privilege',
    [roleName, schemaName, privilege],
  );
  return result.rows[0]?.has_privilege === true;
}

async function policyUsesAuthTenant(client, schemaName, tableName, policyName) {
  const result = await client.query(
    `
      SELECT qual, with_check
      FROM pg_policies
      WHERE schemaname = $1
        AND tablename = $2
        AND policyname = $3
      LIMIT 1
    `,
    [schemaName, tableName, policyName],
  );
  const row = result.rows[0];
  if (!row) return false;
  return String(row.qual || '').includes('get_auth_tenant_id')
    && String(row.with_check || '').includes('get_auth_tenant_id');
}

async function columnExists(client, schemaName, tableName, columnName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
      LIMIT 1
    `,
    [schemaName, tableName, columnName],
  );
  return result.rowCount > 0;
}

async function functionExists(client, schemaName, functionName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1
        AND p.proname = $2
      LIMIT 1
    `,
    [schemaName, functionName],
  );
  return result.rowCount > 0;
}

async function constraintExists(client, schemaName, tableName, constraintName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = $1
        AND table_name = $2
        AND constraint_name = $3
      LIMIT 1
    `,
    [schemaName, tableName, constraintName],
  );
  return result.rowCount > 0;
}

async function indexExists(client, schemaName, tableName, indexName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = $2
        AND indexname = $3
      LIMIT 1
    `,
    [schemaName, tableName, indexName],
  );
  return result.rowCount > 0;
}

async function columnIsNotNull(client, schemaName, tableName, columnName) {
  const result = await client.query(
    `
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
      LIMIT 1
    `,
    [schemaName, tableName, columnName],
  );
  return result.rows[0]?.is_nullable === 'NO';
}

async function typeExists(client, schemaName, typeName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1
        AND t.typname = $2
      LIMIT 1
    `,
    [schemaName, typeName],
  );
  return result.rowCount > 0;
}

function needsEducationRuntimeBaseline(migrations) {
  return migrations.some((migration) => (
    migration.sql.includes('public.edu_courses')
    || migration.sql.includes('public.edu_enrollments')
    || migration.sql.includes('preschool_chain_')
  ));
}

function needsPreschoolAdmissionBaseline(migrations) {
  return migrations.some((migration) => migration.sql.includes('preschool_chain_'));
}

function needsLogisticsRuntimeBaseline(migrations) {
  return migrations.some((migration) => (
    migration.sql.includes('logistics.')
    || migration.sql.includes("to_regnamespace('logistics')")
  ));
}

async function logisticsRuntimePrivilegesAreNeeded(client) {
  const requiredTables = [
    'items',
    'locations',
    'inventory',
    'inventory_movements',
    'traceability',
  ];

  if (!(await schemaExists(client, 'logistics'))) {
    return false;
  }

  for (const table of requiredTables) {
    if (!(await relationExists(client, 'logistics', table))) {
      return false;
    }
  }

  if (!(await hasSchemaPrivilege(client, 'authenticated', 'logistics', 'USAGE'))) {
    return true;
  }

  const privilegeChecks = [
    ['items', 'SELECT'],
    ['locations', 'SELECT'],
    ['inventory', 'SELECT'],
    ['inventory', 'INSERT'],
    ['inventory', 'UPDATE'],
    ['inventory_movements', 'SELECT'],
    ['inventory_movements', 'INSERT'],
    ['traceability', 'SELECT'],
    ['traceability', 'INSERT'],
    ['traceability', 'UPDATE'],
  ];

  for (const [table, privilege] of privilegeChecks) {
    if (!(await hasTablePrivilege(client, 'authenticated', 'logistics', table, privilege))) {
      return true;
    }
  }

  for (const table of requiredTables) {
    const policyName = `${table === 'inventory_movements' ? 'movements' : table}_tenant_isolation`;
    if (!(await policyUsesAuthTenant(client, 'logistics', table, policyName))) {
      return true;
    }
  }

  return false;
}

async function canonicalMigrationIsNeeded(client, file) {
  if (file === FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'org_units'))
      || !(await relationExists(client, 'public', 'org_relationships'))
      || !(await relationExists(client, 'public', 'people_directory'));
  }

  if (file === BLUEPRINT_CORE_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'party_parties'));
  }

  if (file === EDUCATION_SCHEMA_MIGRATION) {
    return !(await relationExists(client, 'public', 'edu_courses'))
      || !(await relationExists(client, 'public', 'edu_enrollments'));
  }

  if (file === EDUCATION_STUDENTS_PLATFORM_SCHEMA_MIGRATION) {
    return !(await columnExists(client, 'public', 'students', 'student_code'))
      || !(await columnExists(client, 'public', 'students', 'academic_status'))
      || !(await columnExists(client, 'public', 'students', 'enrollment_type'))
      || !(await columnExists(client, 'public', 'students', 'program_id'))
      || !(await columnExists(client, 'public', 'students', 'enrollment_date'))
      || !(await columnExists(client, 'public', 'students', 'metadata'));
  }

  if (file === EDUCATION_ENROLLMENT_RPC_MIGRATION) {
    return !(await columnExists(client, 'public', 'edu_courses', 'current_enrollment'))
      || !(await columnExists(client, 'public', 'edu_enrollments', 'request_id'))
      || !(await functionExists(client, 'public', 'edu_enroll_student_v3'));
  }

  if (file === PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION) {
    return !(await relationExists(client, 'public', 'edu_preschool_pickup_authorizations'));
  }

  if (file === USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION) {
    return !(await relationExists(client, 'public', 'user_org_unit_access'));
  }

  if (file === LOGISTICS_RUNTIME_PRIVILEGES_MIGRATION) {
    return await logisticsRuntimePrivilegesAreNeeded(client);
  }

  throw new Error(`Unsupported E2E baseline repair migration: ${file}`);
}

async function ensurePlatformRuleDomainType(client) {
  if (await typeExists(client, 'public', 'platform_rule_domain')) {
    return;
  }

  console.log(
    'Repairing isolated E2E baseline with canonical type public.platform_rule_domain '
    + 'from migration 20260808000012 (create_rule_engine_tables): required by Education enrollment RPC.',
  );
  await client.query(PLATFORM_RULE_DOMAIN_TYPE_SQL);
}

async function ensureEducationStudentIdentityCreateSideBaseline(client) {
  if (!(await relationExists(client, 'public', 'students'))) {
    return;
  }

  if (!(await columnExists(client, 'public', 'students', 'student_id'))) {
    console.log(
      'Repairing isolated E2E baseline with canonical Education student identifier column '
      + 'from supabase/migrations/20260810224417_create_students_table.sql: required by current StudentRepository writes.',
    );
    await client.query('ALTER TABLE public.students ADD COLUMN student_id UUID DEFAULT gen_random_uuid()');
  }

  if (!(await indexExists(client, 'public', 'students', 'students_student_id_unique'))) {
    console.log(
      'Repairing isolated E2E baseline with canonical unique student_id lookup '
      + 'from supabase/migrations/20260810224417_create_students_table.sql.',
    );
    await client.query('CREATE UNIQUE INDEX students_student_id_unique ON public.students(student_id)');
  }

  if (!(await columnExists(client, 'public', 'students', 'party_id'))) {
    console.log(
      'Repairing isolated E2E baseline with canonical Education student identity column '
      + `from ${EDUCATION_STUDENT_IDENTITY_CUTOVER_MIGRATION}: required by current StudentRepository writes.`,
    );
    await client.query('ALTER TABLE public.students ADD COLUMN party_id UUID');
  }

  if (!(await constraintExists(client, 'public', 'students', 'students_party_id_fkey'))) {
    console.log(
      'Repairing isolated E2E baseline with canonical students.party_id FK '
      + `from ${EDUCATION_STUDENT_IDENTITY_CUTOVER_MIGRATION}: required by Party-backed students.`,
    );
    await client.query(`
      ALTER TABLE public.students
      ADD CONSTRAINT students_party_id_fkey
      FOREIGN KEY (party_id)
      REFERENCES public.party_parties(id)
      ON DELETE RESTRICT
    `);
  }

  if (!(await indexExists(client, 'public', 'students', 'idx_students_party_id'))) {
    console.log(
      'Repairing isolated E2E baseline with canonical students.party_id index '
      + `from ${EDUCATION_STUDENT_IDENTITY_CUTOVER_MIGRATION}.`,
    );
    await client.query('CREATE INDEX idx_students_party_id ON public.students(party_id)');
  }

  if (
    await columnExists(client, 'public', 'students', 'person_id')
    && await columnIsNotNull(client, 'public', 'students', 'person_id')
  ) {
    console.log(
      'Repairing isolated E2E baseline with canonical nullable students.person_id '
      + `from ${EDUCATION_STUDENT_CREATE_SIDE_MIGRATION}: required for Party-backed student creation.`,
    );
    await client.query('ALTER TABLE public.students ALTER COLUMN person_id DROP NOT NULL');
  }

  for (const legacyColumn of ['user_id', 'course_id', 'full_name']) {
    if (
      await columnExists(client, 'public', 'students', legacyColumn)
      && await columnIsNotNull(client, 'public', 'students', legacyColumn)
    ) {
      console.log(
        `Repairing isolated E2E baseline by relaxing legacy students.${legacyColumn} NOT NULL: `
        + 'current canonical StudentRepository writes do not use the student-training legacy columns.',
      );
      await client.query(`ALTER TABLE public.students ALTER COLUMN ${legacyColumn} DROP NOT NULL`);
    }
  }
}

async function applyCanonicalBaselineMigration(client, file, reason) {
  if (!(await canonicalMigrationIsNeeded(client, file))) {
    return;
  }

  const migration = parseMigration(file);
  const recorded = await hasRecordedMigration(client, migration.version);
  const historyState = recorded ? 'recorded migration history exists' : 'migration history missing';
  console.log(
    `Repairing isolated E2E baseline with canonical migration ${migration.version} (${migration.name}): `
    + `${reason}; ${historyState}.`,
  );

  await client.query(migration.sql);
  await recordMigration(client, migration);
}

async function ensureLogisticsDomainKernelBaseline(client) {
  const requiredTables = [
    'items',
    'locations',
    'inventory',
    'inventory_movements',
    'traceability',
  ];
  const existingSchema = await schemaExists(client, 'logistics');
  const existingTables = [];

  for (const table of requiredTables) {
    if (await relationExists(client, 'logistics', table)) {
      existingTables.push(table);
    }
  }

  if (existingTables.length === requiredTables.length) {
    return;
  }

  if (existingSchema || existingTables.length > 0) {
    throw new Error(
      'Refusing to repair isolated E2E Logistics baseline from a partial logistics schema. '
      + `Found ${existingTables.length}/${requiredTables.length} required tables. `
      + 'Reset/provision the canonical E2E Logistics baseline before running Logistics runtime proof.',
    );
  }

  console.log(
    `Repairing isolated E2E baseline with canonical Logistics domain kernel ${LOGISTICS_DOMAIN_KERNEL_MIGRATION}: `
    + 'required by current Logistics runtime ports and production-consumption Real DB proof.',
  );
  await client.query(readFileSync(LOGISTICS_DOMAIN_KERNEL_MIGRATION, 'utf8'));
}

async function ensureRequiredE2eBaseline(client, migrations) {
  if (needsEducationRuntimeBaseline(migrations)) {
    await applyCanonicalBaselineMigration(
      client,
      FOUNDATION_ORG_PEOPLE_SCHEMA_MIGRATION,
      'required by canonical Platform branch/org-unit dependencies',
    );
    await applyCanonicalBaselineMigration(
      client,
      BLUEPRINT_CORE_SCHEMA_MIGRATION,
      'required by canonical Education student party dependency',
    );
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_STUDENTS_PLATFORM_SCHEMA_MIGRATION,
      'required by current Education StudentRepository create/read shape',
    );
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_SCHEMA_MIGRATION,
      'required by canonical Education course/enrollment dependencies',
    );
    await ensurePlatformRuleDomainType(client);
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_ENROLLMENT_RPC_MIGRATION,
      'required by canonical Education enrollment idempotency RPC',
    );
    await ensureEducationStudentIdentityCreateSideBaseline(client);
  }

  if (needsPreschoolAdmissionBaseline(migrations)) {
    await applyCanonicalBaselineMigration(
      client,
      EDUCATION_STUDENTS_PLATFORM_SCHEMA_MIGRATION,
      'required by Preschool admission student create/read shape',
    );
    await ensureEducationStudentIdentityCreateSideBaseline(client);
    await applyCanonicalBaselineMigration(
      client,
      PRESCHOOL_GUARDIAN_AUTHORIZATION_MIGRATION,
      'required by Preschool admission guardian authorization flow',
    );
    await applyCanonicalBaselineMigration(
      client,
      USER_ORG_UNIT_ACCESS_PROJECTION_MIGRATION,
      'required by Platform branch authorization read-back',
    );
  }

  if (needsLogisticsRuntimeBaseline(migrations)) {
    await ensureLogisticsDomainKernelBaseline(client);
    await applyCanonicalBaselineMigration(
      client,
      LOGISTICS_RUNTIME_PRIVILEGES_MIGRATION,
      'required by canonical Logistics runtime tables and authenticated RLS proof',
    );
  }
}

async function applyMigration(client, migration) {
  if (await hasRecordedMigration(client, migration.version)) {
    console.log(`Skipping already-recorded E2E migration ${migration.version} (${migration.name}).`);
    return;
  }

  const equivalentVersion = await findEquivalentRecordedMigration(client, migration);
  if (equivalentVersion) {
    console.log(
      `Skipping E2E migration ${migration.version} (${migration.name}); `
      + `identical SQL is already recorded as ${equivalentVersion}.`,
    );
    return;
  }

  console.log(`Applying E2E migration ${migration.version} (${migration.name}).`);
  await client.query(migration.sql);
  await recordMigration(client, migration);
}

async function reloadPostgrestSchema(client) {
  await client.query("NOTIFY pgrst, 'reload schema'");
}

async function main() {
  const { baseRef, dryRun, explicitFiles } = parseArgs(process.argv.slice(2));
  const files = explicitFiles.length > 0
    ? listExplicitMigrationFiles(explicitFiles)
    : listChangedMigrationFiles(baseRef);

  if (files.length === 0) {
    console.log('No changed Supabase migrations to apply to isolated E2E database.');
    return;
  }

  console.log(
    explicitFiles.length > 0
      ? 'Explicit Supabase migrations for isolated E2E database:'
      : `Changed Supabase migrations since ${baseRef}:`,
  );
  for (const file of files) {
    console.log(`- ${file}`);
  }

  if (dryRun) {
    console.log('Dry run complete; no E2E database mutation performed.');
    return;
  }

  if (process.env.ALLOW_E2E_MIGRATION_APPLY !== '1') {
    throw new Error('Refusing to apply migrations without ALLOW_E2E_MIGRATION_APPLY=1.');
  }

  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL or SUPABASE_DATABASE_URL is required for isolated E2E migration apply.');
  }

  const client = createE2eMigrationClient(dbUrl);
  try {
    await client.connect();
  } catch (error) {
    if (isCiEnvironment(process.env)) throw new Error('E2E_DATABASE_CONNECTION_FAILED');
    throw error;
  }
  try {
    const migrations = files.map((file) => parseMigration(file));
    let interiorDiagnostic = null;
    if (needsInteriorTriggerHardeningDiagnostic(migrations)) {
      interiorDiagnostic = await inspectInteriorTriggerHardeningBaseline(client);
      console.log(`INTERIOR_TRIGGER_HARDENING_BASELINE_DIAGNOSTIC=${JSON.stringify(interiorDiagnostic)}`);
    }
    await ensureMigrationHistory(client);
    await ensureRequiredE2eBaseline(client, migrations);
    await ensureInteriorHistoryHardeningBaseline(client, migrations, interiorDiagnostic);
    const f1CatalogBefore = migrations.some((migration) => F1_CATALOG_GUARD_MIGRATIONS.has(migration.file))
      ? await getF1CatalogSnapshot(client)
      : null;
    for (const migration of migrations) {
      await applyMigration(client, migration);
    }
    await assertInteriorTriggerHelpersHardened(client, migrations, interiorDiagnostic);
    if (f1CatalogBefore !== null) {
      const f1CatalogAfter = await getF1CatalogSnapshot(client);
      if (f1CatalogAfter !== f1CatalogBefore) {
        throw new Error('F1_FREEZE_CATALOG_CHANGED: F1 definitions, owner, security, ACL, or effective EXECUTE changed.');
      }
      console.log('PASS F1 catalog unchanged across PR migration apply.');
    }
    await reloadPostgrestSchema(client);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  applyMigration,
  assertIsolatedE2eTarget,
  canonicalMigrationIsNeeded,
  createE2eMigrationClient,
  ensureRequiredE2eBaseline,
  ensureInteriorHistoryHardeningBaseline,
  assertInteriorTriggerHelpersHardened,
  isInteriorHistoryBaselineReady,
  isPristineInteriorHistoryBaseline,
  inspectInteriorTriggerHardeningBaseline,
  needsInteriorTriggerHardeningDiagnostic,
  listChangedMigrationFiles,
  parseMigration,
};
