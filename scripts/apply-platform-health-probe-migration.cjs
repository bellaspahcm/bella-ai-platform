const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  listLocalMigrationVersions,
  parseSupabaseMigrationList,
} = require('./check-supabase-migrations.cjs');

const EXPECTED_VERSION = '20261029090000';
const EXPECTED_SHA256 = '46A11CFF0F380C957C55C118436FD1E3D23D9277BCBE2FEBDB15017E38AF5282';
const EXPECTED_PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  `${EXPECTED_VERSION}_platform_health_rest_database_probe.sql`,
);

function assertProductionTarget(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Production database target is invalid.');
  }

  let user;
  try {
    user = decodeURIComponent(url.username);
  } catch {
    throw new Error('Production database target is invalid.');
  }
  const direct = url.hostname === `db.${EXPECTED_PROJECT_REF}.supabase.co` &&
    (url.port === '' || url.port === '5432');
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
    user.endsWith(`.${EXPECTED_PROJECT_REF}`) && ['5432', '6543'].includes(url.port);
  const parameters = [...url.searchParams.entries()];
  const safeParameters = parameters.length === 0 ||
    (parameters.length === 1 && parameters[0][0] === 'sslmode' &&
      ['require', 'verify-full'].includes(parameters[0][1]));

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password || url.hash ||
      !safeParameters || url.pathname !== '/postgres' || (!direct && !pooler)) {
    throw new Error('Production database target does not match the approved Supabase project.');
  }
}

function decideMigrationAction(localVersions, remoteVersions) {
  const localSet = new Set(localVersions);
  const remoteSet = new Set(remoteVersions);
  const pending = localVersions.filter(version => !remoteSet.has(version));
  const remoteOnly = remoteVersions.filter(version => !localSet.has(version));

  if (remoteOnly.length > 0) {
    throw new Error(`Production migration ledger has versions missing from Git: ${remoteOnly.join(', ')}`);
  }
  if (pending.length === 0 && remoteSet.has(EXPECTED_VERSION)) return 'already-applied';
  if (pending.length === 1 && pending[0] === EXPECTED_VERSION) return 'apply';

  throw new Error(
    `Refusing to apply migrations; expected only ${EXPECTED_VERSION} pending, found: ${pending.join(', ') || 'none'}`,
  );
}

function runSupabase(args, databaseUrl) {
  if (process.platform === 'win32') {
    throw new Error('Production migrations run only on the protected GitHub Linux runner.');
  }

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
  const versions = parseSupabaseMigrationList(output).map(row => row.remote).filter(Boolean).sort();
  if (versions.length === 0) throw new Error('Production migration ledger could not be verified.');
  return versions;
}

function main() {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('This migration can run only on the protected GitHub Linux release runner.');
  }
  if (process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('This migration can run only from the main branch release workflow.');
  }

  const databaseUrl = process.env.PRODUCTION_SUPABASE_DB_URL;
  if (!databaseUrl) throw new Error('Production database credential is required by the protected release runner.');
  assertProductionTarget(databaseUrl);

  const migrationBytes = readFileSync(MIGRATION_PATH);
  const actualHash = createHash('sha256').update(migrationBytes).digest('hex').toUpperCase();
  if (actualHash !== EXPECTED_SHA256) throw new Error('Health migration content does not match the reviewed SHA-256.');

  const localVersions = listLocalMigrationVersions();
  if (!localVersions.includes(EXPECTED_VERSION)) throw new Error('Approved health migration is missing from this revision.');

  const before = listRemoteVersions(databaseUrl);
  const action = decideMigrationAction(localVersions, before);
  if (action === 'apply') {
    // No --include-all: the preflight permits exactly this one pending migration.
    runSupabase(['migration', 'up'], databaseUrl);
  }

  const after = listRemoteVersions(databaseUrl);
  if (!after.includes(EXPECTED_VERSION)) throw new Error('Health migration is not recorded as applied.');
  decideMigrationAction(localVersions, after);
  console.log(`Platform health migration ${EXPECTED_VERSION}: ${action === 'apply' ? 'applied' : 'already present'}.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Health migration failed.');
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_VERSION,
  EXPECTED_SHA256,
  assertProductionTarget,
  decideMigrationAction,
};
