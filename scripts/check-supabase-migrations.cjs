const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const MIGRATION_FILE_PATTERN = /^(\d{8}|\d{14})_.+\.sql$/;

// The isolated Construction E2E database recorded this exact migration under
// its earlier version before the repository timestamp was normalized. The
// stored SQL was read back and matches the local migration after the same
// newline/comment normalization used by the E2E migration applier.
const MIGRATION_VERSION_ALIASES = new Map([
  ['20261104223802', '20261104135713'],
]);

function normalizeMigrationVersion(version) {
  const value = String(version || '').trim();
  if (/^\d{8}$/.test(value)) {
    return `${value}000000`;
  }
  return /^\d{14}$/.test(value) ? value : null;
}

function listLocalMigrationVersions(migrationsDir = join(process.cwd(), 'supabase', 'migrations')) {
  const versions = readdirSync(migrationsDir)
    .map((name) => normalizeMigrationVersion(name.match(MIGRATION_FILE_PATTERN)?.[1]))
    .filter(Boolean);
  return Array.from(new Set(versions)).sort();
}

function listGitMigrationVersions(ref) {
  if (!ref) return null;

  const result = spawnSync('git', ['ls-tree', '-r', '--name-only', ref, 'supabase/migrations'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `Could not read migrations at ${ref}`).trim());
  }

  const versions = String(result.stdout || '')
    .split(/\r?\n/)
    .map((name) => normalizeMigrationVersion(name.split('/').pop()?.match(MIGRATION_FILE_PATTERN)?.[1]))
    .filter(Boolean);
  return Array.from(new Set(versions)).sort();
}

function parseSupabaseMigrationList(output) {
  const rawOutput = String(output || '');
  const jsonStart = rawOutput.indexOf('{');
  const jsonEnd = rawOutput.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(rawOutput.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed.migrations)) {
        return parsed.migrations
          .map((row) => ({
            local: row.local ? normalizeMigrationVersion(row.local) : null,
            remote: row.remote ? normalizeMigrationVersion(row.remote) : null,
          }))
          .filter((row) => row.local || row.remote);
      }
    } catch {
      // Fall through to the table parser for older Supabase CLI output.
    }
  }

  const rows = [];

  for (const line of rawOutput.split(/\r?\n/)) {
    const columns = line
      .split('|')
      .map((column) => column.trim().replace(/^`|`$/g, '').trim());
    if (columns.length < 2) continue;

    const localMatch = columns[0].match(/^(\d{8,14})/);
    const remoteMatch = columns[1].match(/^(\d{8,14})/);
    const local = localMatch ? normalizeMigrationVersion(localMatch[1]) : null;
    const remote = remoteMatch ? normalizeMigrationVersion(remoteMatch[1]) : null;
    if (!local && !remote) continue;

    rows.push({ local, remote });
  }

  return rows;
}

function analyzeMigrationState(
  localVersions,
  remoteVersions,
  baselineLocalVersions = null,
  allowVerifiedE2eVersionAliases = false,
) {
  const localSet = new Set(localVersions);
  const baselineLocalSet = baselineLocalVersions ? new Set(baselineLocalVersions) : null;
  const satisfiedLocalVersions = new Set(remoteVersions);
  const recognizedRemoteAliases = [];

  for (const remoteVersion of remoteVersions) {
    const localAlias = allowVerifiedE2eVersionAliases
      ? MIGRATION_VERSION_ALIASES.get(remoteVersion)
      : null;
    if (localAlias && localSet.has(localAlias)) {
      satisfiedLocalVersions.add(localAlias);
      recognizedRemoteAliases.push({ remote: remoteVersion, local: localAlias });
    }
  }

  const pendingLocal = localVersions.filter((version) => !satisfiedLocalVersions.has(version));
  const grandfatheredPendingLocal = baselineLocalSet
    ? pendingLocal.filter((version) => baselineLocalSet.has(version))
    : [];
  const newPendingLocal = baselineLocalSet
    ? pendingLocal.filter((version) => !baselineLocalSet.has(version))
    : pendingLocal;
  const recognizedRemoteAliasVersions = new Set(recognizedRemoteAliases.map((alias) => alias.remote));
  const remoteOnly = remoteVersions.filter((version) => (
    !localSet.has(version) && !recognizedRemoteAliasVersions.has(version)
  ));

  return {
    latestLocal: localVersions.at(-1) || null,
    latestRemote: remoteVersions.at(-1) || null,
    pendingLocal,
    grandfatheredPendingLocal,
    newPendingLocal,
    remoteOnly,
    recognizedRemoteAliases,
    isSynced: newPendingLocal.length === 0 && remoteOnly.length === 0,
  };
}

function getNpxInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx.cmd', ...args],
    };
  }

  return {
    command: 'npx',
    args,
  };
}

function getSupabaseMigrationListArgs() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  const args = ['--yes', 'supabase', 'migration', 'list'];

  if (dbUrl) {
    return [...args, `--remote=${dbUrl}`];
  }

  return [...args, '--linked'];
}

function runSupabaseMigrationList() {
  const invocation = getNpxInvocation(getSupabaseMigrationListArgs());
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    throw new Error(output || result.error?.message || 'Supabase migration list failed');
  }

  return output;
}

function printState(state) {
  console.log(`Local latest migration: ${state.latestLocal || 'none'}`);
  console.log(`Remote latest migration: ${state.latestRemote || 'none'}`);
}

function main() {
  const hasDbUrl = Boolean(process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL);
  const optional = process.env.DB_MIGRATION_CHECK_OPTIONAL === '1';
  const allowRemoteAheadOnly = process.env.DB_MIGRATION_CHECK_ALLOW_REMOTE_AHEAD_ONLY === '1';

  if (!hasDbUrl && optional) {
    console.log('Supabase migration check skipped: SUPABASE_DB_URL is not configured.');
    return;
  }

  const localVersions = listLocalMigrationVersions();
  if (localVersions.length === 0) {
    console.error('No local Supabase migrations found.');
    process.exit(1);
  }

  const baselineRef = process.env.MIGRATION_BASE_REF || process.env.BASE_REF || null;
  let baselineLocalVersions = null;
  if (baselineRef) {
    try {
      baselineLocalVersions = listGitMigrationVersions(baselineRef);
      console.log(`Migration baseline ref: ${baselineRef}`);
      console.log(`Baseline local migrations: ${baselineLocalVersions.length}`);
    } catch (error) {
      console.error('Could not read baseline Supabase migrations.');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  let rows;
  try {
    rows = parseSupabaseMigrationList(runSupabaseMigrationList());
  } catch (error) {
    console.error('Could not read remote Supabase migrations.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const remoteVersions = rows.map((row) => row.remote).filter(Boolean).sort();
  const state = analyzeMigrationState(
    localVersions,
    remoteVersions,
    baselineLocalVersions,
    allowRemoteAheadOnly,
  );
  const remoteAheadOnly = allowRemoteAheadOnly
    ? state.remoteOnly.filter((version) => state.latestLocal && version > state.latestLocal)
    : [];
  const blockingRemoteOnly = allowRemoteAheadOnly
    ? state.remoteOnly.filter((version) => !state.latestLocal || version <= state.latestLocal)
    : state.remoteOnly;
  const isSynced = state.newPendingLocal.length === 0 && blockingRemoteOnly.length === 0;
  printState(state);

  // Allow empty remote database (fresh installation scenario)
  if (remoteVersions.length === 0) {
    console.log('⚠️  Remote database is empty (fresh installation).');
    console.log('✅ Migration drift check skipped for empty remote database.');
    console.log('Migrations will be applied on first deployment.');
    return;
  }

  if (state.grandfatheredPendingLocal.length > 0) {
    console.warn(
      `Grandfathered pending local migrations already present at baseline: ${state.grandfatheredPendingLocal.length}`,
    );
  }

  if (state.recognizedRemoteAliases.length > 0) {
    console.log('Recognized verified migration version aliases:');
    for (const alias of state.recognizedRemoteAliases) {
      console.log(`- Remote ${alias.remote} satisfies local ${alias.local}`);
    }
  }

  if (state.newPendingLocal.length > 0) {
    console.error('Remote Supabase database is missing new local migrations:');
    for (const version of state.newPendingLocal) {
      console.error(`- ${version}`);
    }
  }

  if (remoteAheadOnly.length > 0) {
    console.warn('Remote Supabase database has future migrations not present in this repository:');
    for (const version of remoteAheadOnly) {
      console.warn(`- ${version}`);
    }
    console.warn('Ignoring future remote-only migrations for this isolated E2E database check.');
  }

  if (blockingRemoteOnly.length > 0) {
    console.error('Remote Supabase database has migrations missing from this repository:');
    for (const version of blockingRemoteOnly) {
      console.error(`- ${version}`);
    }
  }

  if (!isSynced) {
    console.error('Apply new migrations to the E2E database before deploy. Historical pending-local drift must stay tracked as a baseline boundary.');
    process.exit(1);
  }

  if (state.grandfatheredPendingLocal.length > 0) {
    console.log('Supabase migrations have no new drift beyond the baseline boundary.');
    return;
  }

  console.log('Supabase migrations are in sync.');
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeMigrationState,
  getSupabaseMigrationListArgs,
  listGitMigrationVersions,
  listLocalMigrationVersions,
  parseSupabaseMigrationList,
};
