'use strict';

const { execFileSync } = require('node:child_process');
const { createHash, X509Certificate } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { rootCertificates } = require('node:tls');
const { assertProductionTarget } = require('./apply-platform-health-probe-migration.cjs');
const { normalizeMigrationSql, normalizeRecordedMigrationStatements } = require('./apply-e2e-pr-migrations.cjs');

const EXPECTED_VERSION = '20261128145534';
const EXPECTED_NAME = 'interior_design_approval_sets_active_revision';
const EXPECTED_SHA256 = '04E7A3B68151D80F348652A55469F103B1BA5E046982B1326E63FD062459CFD7';
const MIGRATION_PATH = join(process.cwd(), 'supabase', 'migrations', `${EXPECTED_VERSION}_${EXPECTED_NAME}.sql`);
const SUPABASE_ROOT_CA_PATH = join(__dirname, 'certificates', 'supabase-root-2021.crt');
const EXPECTED_SUPABASE_ROOT_FINGERPRINT = '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';
let executionStage = 'runner';

function safeErrorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(error.code) ? error.code : 'UNCLASSIFIED';
}

function productionClientConfig(databaseUrl) {
  if (!databaseUrl || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('Secure Production database configuration is required.');
  }
  assertProductionTarget(databaseUrl);
  const target = new URL(databaseUrl);
  target.searchParams.delete('sslmode');
  const supabaseRootCa = readFileSync(SUPABASE_ROOT_CA_PATH, 'utf8');
  const certificate = new X509Certificate(supabaseRootCa);
  if (certificate.fingerprint256.replaceAll(':', '').toLowerCase() !== EXPECTED_SUPABASE_ROOT_FINGERPRINT) {
    throw new Error('Reviewed Supabase root certificate fingerprint mismatch.');
  }
  return {
    host: target.hostname,
    port: Number(target.port || 5432),
    database: decodeURIComponent(target.pathname.slice(1)),
    user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password),
    ssl: { ca: [...rootCertificates, supabaseRootCa], rejectUnauthorized: true, servername: target.hostname },
    connectionTimeoutMillis: 10000,
  };
}

async function verifyProductionFunctions(client) {
  const functions = await client.query(`WITH expected(oid) AS (VALUES
      (to_regprocedure('public.interior_approve_design_revision(uuid,text)')),
      (to_regprocedure('public.interior_list_design_revisions(uuid)')),
      (to_regprocedure('public.interior_list_design_portfolio_summaries(uuid[])'))
    )
    SELECT count(*)::integer AS function_count,
      coalesce(bool_and(p.oid IS NOT NULL AND p.prosecdef
        AND coalesce(p.proconfig,ARRAY[]::text[]) @> ARRAY['search_path=""']
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
        AND has_function_privilege('authenticated',p.oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
        AND pg_get_userbyid(p.proowner)=pg_get_userbyid(d.datdba)),false) AS functions_secure
    FROM expected e LEFT JOIN pg_proc p ON p.oid=e.oid
    CROSS JOIN pg_database d WHERE d.datname=current_database()`);
  if (functions.rows.length !== 1 || functions.rows[0].function_count !== 3 || !functions.rows[0].functions_secure) {
    throw new Error('Interior RPC security read-back did not match the reviewed ACL contract.');
  }
}

async function verifyProductionReadback(databaseUrl, migrationText) {
  const { Client } = require('pg');
  const client = new Client(productionClientConfig(databaseUrl));
  try {
    await client.connect();
    const result = await client.query(
      'SELECT name, statements FROM supabase_migrations.schema_migrations WHERE version = $1',
      [EXPECTED_VERSION],
    );
    if (result.rows.length !== 1 || result.rows[0].name !== EXPECTED_NAME ||
        normalizeRecordedMigrationStatements(result.rows[0].statements) !== normalizeMigrationSql(migrationText)) {
      throw new Error('Interior migration name, version or recorded SQL did not match Git.');
    }
    await verifyProductionFunctions(client);
  } finally {
    await client.end().catch(() => {});
  }
}

function assertRunnerContext() {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Production migration can run only from the protected main release workflow.');
  }
  const sha = process.env.GITHUB_SHA || '';
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid GitHub release SHA.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const remote = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8' }).trim().split(/\s+/)[0];
  if (sha !== head || sha !== remote) throw new Error('Main changed; refusing Production migration.');
}

async function applyReviewedMigration(client, migrationText, databaseUrl) {
  let commitSent = false;
  let action = 'apply';
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
    const identity = await client.query(`SELECT current_user AS executor, session_user AS session,
      pg_get_userbyid(datdba) AS database_owner,
      has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','SELECT') AS ledger_read,
      has_table_privilege(current_user,'supabase_migrations.schema_migrations','INSERT') AS ledger_insert
      FROM pg_database WHERE datname=current_database()`);
    const principal = identity.rows[0];
    if (identity.rows.length !== 1 || principal.executor !== principal.session || principal.executor !== principal.database_owner ||
        !principal.schema_create || !principal.ledger_read || !principal.ledger_insert) {
      throw new Error('Production database executor identity or privileges rejected.');
    }

    await client.query('LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE');
    const recorded = await client.query(
      'SELECT name, statements FROM supabase_migrations.schema_migrations WHERE version = $1',
      [EXPECTED_VERSION],
    );
    if (recorded.rows.length > 0) {
      if (recorded.rows.length !== 1 || recorded.rows[0].name !== EXPECTED_NAME ||
          normalizeRecordedMigrationStatements(recorded.rows[0].statements) !== normalizeMigrationSql(migrationText)) {
        throw new Error('Interior migration version exists with a different ledger record.');
      }
      await verifyProductionFunctions(client);
      action = 'already-applied';
    } else {
      const history = await client.query(
        'SELECT version, statements FROM supabase_migrations.schema_migrations WHERE statements IS NOT NULL AND version <> $1',
        [EXPECTED_VERSION],
      );
      const duplicate = history.rows.some((row) =>
        normalizeRecordedMigrationStatements(row.statements) === normalizeMigrationSql(migrationText));
      if (duplicate) throw new Error('Interior migration SQL is already recorded under another version.');

      // Apply only the reviewed migration bytes inside the same transaction as its exact ledger entry.
      await client.query(migrationText);
      await verifyProductionFunctions(client);
      await client.query(
        'INSERT INTO supabase_migrations.schema_migrations (version,name,statements,created_by) VALUES ($1,$2,$3,current_user)',
        [EXPECTED_VERSION, EXPECTED_NAME, [migrationText]],
      );
      const readback = await client.query(
        'SELECT name, statements FROM supabase_migrations.schema_migrations WHERE version = $1',
        [EXPECTED_VERSION],
      );
      if (readback.rows.length !== 1 || readback.rows[0].name !== EXPECTED_NAME ||
          normalizeRecordedMigrationStatements(readback.rows[0].statements) !== normalizeMigrationSql(migrationText)) {
        throw new Error('Interior migration ledger transaction read-back failed.');
      }
    }

    commitSent = true;
    await client.query('COMMIT');
  } catch (error) {
    if (commitSent) throw new Error('COMMIT outcome unknown; inspect Production ledger before retry.');
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  }

  await verifyProductionReadback(databaseUrl, migrationText).catch(() => {
    throw new Error('COMMIT acknowledged but Production migration read-back failed; inspect before retry.');
  });
  return action;
}

async function main() {
  assertRunnerContext();
  executionStage = 'migration-integrity';
  const bytes = readFileSync(MIGRATION_PATH);
  if (createHash('sha256').update(bytes).digest('hex').toUpperCase() !== EXPECTED_SHA256) {
    throw new Error('Interior migration content does not match the reviewed SHA-256.');
  }
  const migrationText = bytes.toString('utf8');

  executionStage = 'target-config';
  const databaseUrl = process.env.PRODUCTION_SUPABASE_DB_URL;
  const config = productionClientConfig(databaseUrl);
  const { Client } = require('pg');
  const client = new Client(config);
  let action;
  try {
    executionStage = 'database-connect';
    await client.connect();
    executionStage = 'database-transaction';
    action = await applyReviewedMigration(client, migrationText, databaseUrl);
  } finally {
    await client.end().catch(() => {});
  }
  console.log(`Interior design approval migration ${EXPECTED_VERSION}: ${action === 'apply' ? 'applied' : 'already present'}.`);
}

if (require.main === module) {
  main().catch(error => {
    const known = /^(Production migration can run only from the protected main release workflow\.|Invalid GitHub release SHA\.|Main changed; refusing Production migration\.|Interior migration content does not match the reviewed SHA-256\.|Secure Production database configuration is required\.|Production database target does not match the approved Supabase project\.|Reviewed Supabase root certificate fingerprint mismatch\.|Production database executor identity or privileges rejected\.|Interior migration version exists with a different ledger record\.|Interior migration SQL is already recorded under another version\.|Interior RPC security read-back did not match the reviewed ACL contract\.|Interior migration ledger transaction read-back failed\.|COMMIT outcome unknown; inspect Production ledger before retry\.|COMMIT acknowledged but Production migration read-back failed; inspect before retry\.)/;
    const message = known.test(error.message) ? error.message : 'Interior migration runner failed; inspect Production ledger before retry.';
    console.error(`${message} stage=${executionStage} code=${safeErrorCode(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { EXPECTED_VERSION, EXPECTED_NAME, EXPECTED_SHA256, applyReviewedMigration, verifyProductionFunctions };
