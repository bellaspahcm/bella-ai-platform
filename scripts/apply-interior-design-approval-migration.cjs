'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assertProductionTarget, PRODUCTION_MIGRATION_VERSION_ALIASES } = require('./apply-platform-health-probe-migration.cjs');
const { listLocalMigrationVersions, parseSupabaseMigrationList } = require('./check-supabase-migrations.cjs');
const { normalizeMigrationSql, normalizeRecordedMigrationStatements } = require('./apply-e2e-pr-migrations.cjs');

const EXPECTED_VERSION = '20261128145534';
const EXPECTED_NAME = 'interior_design_approval_sets_active_revision';
const EXPECTED_SHA256 = '6E4010191E13253A6C70A8F704443024DCA90C7494854F287929DE77A19D84FC';
const MIGRATION_PATH = join(process.cwd(), 'supabase', 'migrations', `${EXPECTED_VERSION}_${EXPECTED_NAME}.sql`);
let executionStage = 'runner';

function safeErrorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(error.code) ? error.code : 'UNCLASSIFIED';
}

function runSupabase(args, databaseUrl) {
  if (process.platform !== 'linux') throw new Error('Production migration requires the protected Linux release runner.');
  try {
    return execFileSync('npx', ['--yes', 'supabase', ...args, '--db-url', databaseUrl], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_DB_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Supabase migration command failed; credentials and raw CLI output were suppressed.');
  }
}

function listRemoteVersions(databaseUrl) {
  const output = runSupabase(['migration', 'list'], databaseUrl);
  return parseSupabaseMigrationList(output).map(row => row.remote).filter(Boolean).sort();
}

function productionClientConfig(databaseUrl) {
  const target = new URL(databaseUrl);
  target.searchParams.delete('sslmode');
  return { connectionString: target.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 };
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
  } finally {
    await client.end().catch(() => {});
  }
}

function migrationState(localVersions, remoteVersions) {
  const resolvedRemoteVersions = remoteVersions.map(
    version => PRODUCTION_MIGRATION_VERSION_ALIASES.get(version) ?? version,
  );
  const localSet = new Set(localVersions);
  const remoteSet = new Set(resolvedRemoteVersions);
  const pending = localVersions.filter(version => !remoteSet.has(version));
  const remoteOnly = resolvedRemoteVersions.filter(version => !localSet.has(version));

  if (remoteOnly.length > 0) {
    throw new Error(`Production migration ledger has versions missing from Git: ${remoteOnly.join(', ')}`);
  }
  if (remoteSet.has(EXPECTED_VERSION)) {
    if (pending.length > 0) {
      throw new Error(`Refusing migration; another local migration is pending: ${pending.join(', ')}`);
    }
    return 'already-applied';
  }
  if (pending.length === 1 && pending[0] === EXPECTED_VERSION) return 'apply';
  throw new Error(`Refusing migration; expected only ${EXPECTED_VERSION} pending, found: ${pending.join(', ') || 'none'}`);
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

async function main() {
  assertRunnerContext();
  executionStage = 'target-config';
  const databaseUrl = process.env.PRODUCTION_SUPABASE_DB_URL;
  if (!databaseUrl) throw new Error('Production database credential is required by the protected release runner.');
  assertProductionTarget(databaseUrl);

  executionStage = 'migration-integrity';
  const bytes = readFileSync(MIGRATION_PATH);
  if (createHash('sha256').update(bytes).digest('hex').toUpperCase() !== EXPECTED_SHA256) {
    throw new Error('Interior migration content does not match the reviewed SHA-256.');
  }
  const migrationText = bytes.toString('utf8');
  const localVersions = listLocalMigrationVersions();
  if (!localVersions.includes(EXPECTED_VERSION)) throw new Error('Approved Interior migration is missing from this revision.');

  executionStage = 'ledger-preflight';
  const before = listRemoteVersions(databaseUrl);
  if (before.length === 0) throw new Error('Production migration ledger could not be verified.');
  const action = migrationState(localVersions, before);
  if (action === 'apply') {
    // Apply the exact timestamped Git migration. No include-all or MCP-generated version is used.
    executionStage = 'migration-apply';
    runSupabase(['migration', 'up'], databaseUrl);
  }

  executionStage = 'ledger-readback';
  const after = listRemoteVersions(databaseUrl);
  if (!after.includes(EXPECTED_VERSION) || migrationState(localVersions, after) !== 'already-applied') {
    throw new Error('Interior migration ledger read-back failed.');
  }
  executionStage = 'sql-readback';
  try {
    await verifyProductionReadback(databaseUrl, migrationText);
  } catch {
    throw new Error('Interior migration SQL or RPC security read-back failed.');
  }
  console.log(`Interior design approval migration ${EXPECTED_VERSION}: ${action === 'apply' ? 'applied' : 'already present'}.`);
}

if (require.main === module) {
  main().catch(error => {
    const known = /^(Production migration ledger has versions missing from Git:|Refusing migration; expected only |Main changed; refusing Production migration\.|Invalid GitHub release SHA\.|Production migration can run only from the protected main release workflow\.|Production database credential is required by the protected release runner\.|Production database target does not match the approved Supabase project\.|Interior migration content does not match the reviewed SHA-256\.|Approved Interior migration is missing from this revision\.|Production migration ledger could not be verified\.|Interior migration ledger read-back failed\.|Interior migration SQL or RPC security read-back failed\.)/;
    const message = known.test(error.message) ? error.message : 'Interior migration runner failed; inspect Production ledger before retry.';
    console.error(`${message} stage=${executionStage} code=${safeErrorCode(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { EXPECTED_VERSION, EXPECTED_NAME, EXPECTED_SHA256, migrationState };
