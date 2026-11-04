'use strict';

// One owner-approved health migration. The normal release runner and its
// complete-ledger guard remain unchanged; this does not certify that guard.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { EXPECTED_SHA256, EXPECTED_VERSION, assertProductionTarget } = require('./apply-platform-health-probe-migration.cjs');

const MIGRATION_NAME = 'platform_health_rest_database_probe';
let executionStage = 'runner';

function safeErrorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(error.code) ? error.code : 'UNCLASSIFIED';
}

function checkedMigration(bytes) {
  if (createHash('sha256').update(bytes).digest('hex').toUpperCase() !== EXPECTED_SHA256) {
    throw new Error('Reviewed migration hash mismatch');
  }
  const text = bytes.toString('utf8');
  if (!/^BEGIN;\s/.test(text) || !/\sCOMMIT;\s*$/.test(text)) throw new Error('Unexpected transaction wrapper');
  // Keep the exact reviewed statements inside the executor's transaction so the
  // catalog assertions and the single ledger insert commit atomically with them.
  return { text, body: text.replace(/^BEGIN;\s*/, '').replace(/\sCOMMIT;\s*$/, '') };
}

async function verifyHealthDefinition(client) {
  const verify = await client.query(`SELECT p.prosecdef, p.provolatile, l.lanname,
      pg_get_function_result(p.oid) AS result_type, p.proconfig,
      btrim(p.prosrc, E' \\t\\r\\n') IN ('SELECT true;', 'SELECT true') AS constant_true,
      p.proowner=(SELECT datdba FROM pg_database WHERE datname=current_database()) AS database_owner,
      has_schema_privilege('anon', 'public', 'USAGE') AS schema_usage,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute,
      EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute,
      EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a
        WHERE a.grantee NOT IN (p.proowner, (SELECT oid FROM pg_roles WHERE rolname='anon'))
          AND a.privilege_type='EXECUTE') AS unexpected_execute,
      EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid <> p.proowner AND r.rolname <> 'anon'
        AND NOT r.rolsuper AND pg_has_role(r.oid,'anon','USAGE')) AS unexpected_anon_inheritor
      FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=to_regprocedure('public.platform_health_database_probe()')`);
  const v = verify.rows[0];
  if (verify.rows.length !== 1 || v.prosecdef || v.provolatile !== 's' || v.lanname !== 'sql' ||
      v.result_type !== 'boolean' || !v.proconfig?.includes('search_path=""') || !v.constant_true || !v.database_owner ||
      !v.schema_usage || !v.anon_execute || v.authenticated_execute || v.service_execute || v.public_execute ||
      v.unexpected_execute || v.unexpected_anon_inheritor) throw new Error('Health function or ACL verification failed');
}

async function applyHealthOnly(client, bytes) {
  const { text, body } = checkedMigration(bytes);
  let commitSent = false;
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s'");
    const identity = await client.query(`SELECT current_user AS executor, session_user AS session,
      pg_get_userbyid(datdba) AS database_owner,
      has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','SELECT') AS ledger_read,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT') AS ledger_insert
      FROM pg_database WHERE datname=current_database()`);
    const principal = identity.rows[0];
    if (identity.rows.length !== 1 || principal.executor !== principal.session || principal.executor !== principal.database_owner ||
        !principal.schema_create || !principal.ledger_read || !principal.ledger_insert) throw new Error('Database executor identity or privileges rejected');
    await client.query('LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE');
    const before = await client.query(`SELECT
      EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1) AS ledger_exists,
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'platform_health_database_probe') AS function_exists`, [EXPECTED_VERSION]);
    if (before.rows[0].ledger_exists || before.rows[0].function_exists) {
      throw new Error('Health function or ledger version already exists; inspect before retry');
    }
    await client.query(body);
    await verifyHealthDefinition(client);
    await client.query('INSERT INTO supabase_migrations.schema_migrations (version,name,statements,created_by) VALUES ($1,$2,$3,current_user)',
      [EXPECTED_VERSION, MIGRATION_NAME, [text]]);
    const recorded = await client.query('SELECT count(*)::integer AS count FROM supabase_migrations.schema_migrations WHERE version=$1', [EXPECTED_VERSION]);
    if (recorded.rows[0].count !== 1) throw new Error('Health ledger verification failed');
    commitSent = true;
    await client.query('COMMIT');
  } catch (error) {
    if (commitSent) throw new Error('COMMIT outcome unknown; inspect catalog and ledger before any retry');
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  }
  try {
    const readback = await client.query('SELECT name,statements FROM supabase_migrations.schema_migrations WHERE version=$1', [EXPECTED_VERSION]);
    if (readback.rows.length !== 1 || readback.rows[0].name !== MIGRATION_NAME ||
        readback.rows[0].statements?.length !== 1 || readback.rows[0].statements[0] !== text) throw new Error('ledger read-back mismatch');
    await verifyHealthDefinition(client);
  } catch {
    throw new Error('COMMIT acknowledged but read-back failed; inspect catalog and ledger before retry');
  }
}

function assertRunnerContext(platform, actions, ref) {
  if (platform !== 'linux' || actions !== 'true' || ref !== 'refs/heads/main') {
    throw new Error('Requires the protected GitHub Linux runner on main');
  }
}

function assertExactMain(sha, head, remote) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid GitHub SHA');
  if (sha !== head || sha !== remote) throw new Error('Main changed; refuse migration');
}

function productionClientConfig(url, tlsSetting) {
  if (!url || tlsSetting === '0') throw new Error('Secure production database configuration required');
  assertProductionTarget(url);
  // pg parses sslmode from the URL after options and otherwise replaces the
  // explicit SSL object. Target validation permits no other URL parameters.
  const target = new URL(url);
  target.searchParams.delete('sslmode');
  return { connectionString: target.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 };
}

async function preflightHealthOnly(client) {
  await client.query('BEGIN READ ONLY');
  try {
    const result = await client.query(`SELECT current_setting('transaction_read_only') AS read_only,
      current_user AS executor, session_user AS session, pg_get_userbyid(d.datdba) AS database_owner,
      has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_schema_privilege('anon','public','USAGE') AS anon_schema_usage,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','SELECT') AS ledger_read,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT') AS ledger_insert,
      (has_table_privilege(current_user,'supabase_migrations.schema_migrations','UPDATE') OR
       has_table_privilege(current_user,'supabase_migrations.schema_migrations','DELETE') OR
       has_table_privilege(current_user,'supabase_migrations.schema_migrations','TRUNCATE')) AS ledger_lock,
      EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=$1) AS ledger_exists,
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='platform_health_database_probe') AS function_exists,
      EXISTS(SELECT 1 FROM pg_roles r WHERE r.oid<>d.datdba AND r.rolname<>'anon'
        AND NOT r.rolsuper AND pg_has_role(r.oid,'anon','USAGE')) AS unexpected_anon_inheritor,
      EXISTS(SELECT 1 FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) g
        WHERE a.defaclrole=d.datdba AND a.defaclobjtype='f'
          AND a.defaclnamespace IN (0, (SELECT oid FROM pg_namespace WHERE nspname='public'))
          AND g.privilege_type='EXECUTE' AND g.grantee NOT IN (0,d.datdba,
            (SELECT oid FROM pg_roles WHERE rolname='anon'),
            (SELECT oid FROM pg_roles WHERE rolname='authenticated'),
            (SELECT oid FROM pg_roles WHERE rolname='service_role'))) AS unexpected_default_execute
      FROM pg_database d WHERE d.datname=current_database()`, [EXPECTED_VERSION]);
    const r = result.rows[0];
    if (result.rows.length === 1) console.log(JSON.stringify({
      readOnly: r.read_only === 'on', ownerMatches: r.executor === r.session && r.executor === r.database_owner,
      schemaCreate: r.schema_create, anonSchemaUsage: r.anon_schema_usage,
      ledgerRead: r.ledger_read, ledgerInsert: r.ledger_insert, ledgerLock: r.ledger_lock,
      ledgerExists: r.ledger_exists, functionExists: r.function_exists,
      unexpectedAnonInheritor: r.unexpected_anon_inheritor, unexpectedDefaultExecute: r.unexpected_default_execute,
    }));
    if (result.rows.length !== 1 || r.read_only !== 'on' || r.executor !== r.session || r.executor !== r.database_owner ||
        !r.schema_create || !r.anon_schema_usage || !r.ledger_read || !r.ledger_insert || !r.ledger_lock || r.ledger_exists || r.function_exists ||
        r.unexpected_anon_inheritor || r.unexpected_default_execute) throw new Error('Health preflight rejected target state or privileges');
  } finally { await client.query('ROLLBACK'); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--preflight')) throw new Error('Invalid executor mode');
  assertRunnerContext(process.platform, process.env.GITHUB_ACTIONS, process.env.GITHUB_REF);
  executionStage = 'git-main';
  const sha = process.env.GITHUB_SHA || '';
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid GitHub SHA');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const remote = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8' }).trim().split(/\s+/)[0];
  assertExactMain(sha, head, remote);
  executionStage = 'target-config';
  const config = productionClientConfig(process.env.PRODUCTION_SUPABASE_DB_URL, process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  const bytes = readFileSync(join(process.cwd(), 'supabase', 'migrations', `${EXPECTED_VERSION}_${MIGRATION_NAME}.sql`));
  checkedMigration(bytes);
  const { Client } = require('pg');
  const client = new Client(config);
  try {
    executionStage = 'database-connect';
    await client.connect();
    if (args[0] === '--preflight') {
      executionStage = 'database-read-only-preflight';
      await preflightHealthOnly(client);
      console.log('Health preflight PASS: read-only target, principal and catalog checks. No DDL or ledger write.');
      return;
    }
    executionStage = 'database-transaction';
    await applyHealthOnly(client, bytes);
    console.log(`Health migration ${EXPECTED_VERSION} applied and recorded. Other ledger differences remain unresolved.`);
  } finally { await client.end().catch(() => {}); }
}

if (require.main === module) {
  main().catch(error => {
    // Never print raw database/network errors: they can include credentials.
    const known = /^(Reviewed migration hash mismatch|Unexpected transaction wrapper|Invalid executor mode|Health preflight rejected target state or privileges|Database executor identity or privileges rejected|Health function or ledger version already exists; inspect before retry|Health function or ACL verification failed|Health ledger verification failed|COMMIT outcome unknown; inspect catalog and ledger before any retry|COMMIT acknowledged but read-back failed; inspect catalog and ledger before retry|Requires the protected GitHub Linux runner on main|Invalid GitHub SHA|Main changed; refuse migration|Secure production database configuration required|Production database target.*)$/;
    const message = known.test(error.message) ? error.message : 'Health executor failed; inspect catalog and ledger before retry.';
    console.error(`${message} stage=${executionStage} code=${safeErrorCode(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { checkedMigration, applyHealthOnly, preflightHealthOnly, assertRunnerContext, assertExactMain, productionClientConfig, safeErrorCode, MIGRATION_NAME };
