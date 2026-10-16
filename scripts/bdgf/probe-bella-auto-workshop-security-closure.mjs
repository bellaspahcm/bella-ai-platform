#!/usr/bin/env node
/**
 * Bella Auto workshop security closure probe.
 *
 * This read-only probe verifies that the target Production URL points at the
 * expected Supabase project, migration history contains the closure versions,
 * RLS remains enabled, anon access remains denied, and authenticated no longer
 * has table-management privileges on the two workshop tables.
 */

import { appendFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

const EXPECTED_PRODUCTION_PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const RLS_HISTORY_VERSION = '20261013090000';
const LEAST_PRIVILEGE_MIGRATION_VERSION = '20261013103000';
const WORKSHOP_TABLES = [
  'auto_service_appointments',
  'auto_repair_orders'
];

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = 'true';
    }
  }

  return args;
}

function requireDatabaseUrl(env = process.env) {
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === '') {
    throw new Error('DATABASE_URL is required for Bella Auto security closure probes');
  }
  return dbUrl.trim();
}

function assertProductionProjectUrl(dbUrl, expectedProjectRef = EXPECTED_PRODUCTION_PROJECT_REF) {
  const parsed = new URL(dbUrl);
  const username = decodeURIComponent(parsed.username || '');
  const hostname = parsed.hostname || '';
  const hostHasProjectRef = hostname.includes(expectedProjectRef);
  const usernameHasProjectRef = username.includes(expectedProjectRef);

  if (!hostHasProjectRef && !usernameHasProjectRef) {
    throw new Error(`DATABASE_URL does not identify Supabase project ${expectedProjectRef}`);
  }

  return {
    hostname,
    hostHasProjectRef,
    usernameHasProjectRef
  };
}

async function loadClosureState(client) {
  const tableResult = await client.query(
    `
      WITH target_tables(table_name) AS (
        SELECT * FROM unnest($1::text[])
      )
      SELECT
        target_tables.table_name,
        c.oid IS NOT NULL AS exists,
        COALESCE(c.relrowsecurity, false) AS rls_enabled,
        CASE WHEN c.oid IS NULL THEN NULL ELSE pg_get_userbyid(c.relowner) END AS owner,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon', format('public.%I', target_tables.table_name), 'SELECT') END AS anon_select,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon', format('public.%I', target_tables.table_name), 'INSERT') END AS anon_insert,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon', format('public.%I', target_tables.table_name), 'UPDATE') END AS anon_update,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon', format('public.%I', target_tables.table_name), 'DELETE') END AS anon_delete,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'SELECT') END AS authenticated_select,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'INSERT') END AS authenticated_insert,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'UPDATE') END AS authenticated_update,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'DELETE') END AS authenticated_delete,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'REFERENCES') END AS authenticated_references,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'TRIGGER') END AS authenticated_trigger,
        CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('authenticated', format('public.%I', target_tables.table_name), 'TRUNCATE') END AS authenticated_truncate
      FROM target_tables
      LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', target_tables.table_name))
      ORDER BY target_tables.table_name
    `,
    [WORKSHOP_TABLES]
  );

  const migrationResult = await client.query(
    `
      SELECT version
      FROM supabase_migrations.schema_migrations
      WHERE version = ANY($1::text[])
      ORDER BY version
    `,
    [[RLS_HISTORY_VERSION, LEAST_PRIVILEGE_MIGRATION_VERSION]]
  );

  return {
    tables: tableResult.rows,
    appliedVersions: new Set(migrationResult.rows.map(row => String(row.version)))
  };
}

function assertHistoryApplied(state, version) {
  if (!state.appliedVersions.has(version)) {
    throw new Error(`Migration history does not contain ${version}`);
  }
}

function assertRuntimeProtected(tableName, row) {
  if (!row || !row.exists) {
    throw new Error(`${tableName} does not exist on target database`);
  }

  if (!row.rls_enabled) {
    throw new Error(`${tableName} does not have RLS enabled`);
  }

  if (row.anon_select || row.anon_insert || row.anon_update || row.anon_delete) {
    throw new Error(`${tableName} grants anon table privileges`);
  }
}

function assertLeastPrivilege(tableName, row) {
  assertRuntimeProtected(tableName, row);

  const missingRuntimePrivileges = [
    ['SELECT', row.authenticated_select],
    ['INSERT', row.authenticated_insert],
    ['UPDATE', row.authenticated_update],
    ['DELETE', row.authenticated_delete]
  ].filter(([, enabled]) => !enabled).map(([privilege]) => privilege);

  if (missingRuntimePrivileges.length > 0) {
    throw new Error(`${tableName} is missing authenticated runtime privileges: ${missingRuntimePrivileges.join(', ')}`);
  }

  const extraPrivileges = [
    ['REFERENCES', row.authenticated_references],
    ['TRIGGER', row.authenticated_trigger],
    ['TRUNCATE', row.authenticated_truncate]
  ].filter(([, enabled]) => enabled).map(([privilege]) => privilege);

  if (extraPrivileges.length > 0) {
    throw new Error(`${tableName} still grants authenticated table-management privileges: ${extraPrivileges.join(', ')}`);
  }
}

function isLeastPrivilegeSealed(state) {
  return WORKSHOP_TABLES.every(tableName => {
    const row = state.tables.find(candidate => candidate.table_name === tableName);
    try {
      assertLeastPrivilege(tableName, row);
      return true;
    } catch {
      return false;
    }
  });
}

function assertPostClosureState(state) {
  assertHistoryApplied(state, RLS_HISTORY_VERSION);
  assertHistoryApplied(state, LEAST_PRIVILEGE_MIGRATION_VERSION);

  for (const tableName of WORKSHOP_TABLES) {
    const row = state.tables.find(candidate => candidate.table_name === tableName);
    assertLeastPrivilege(tableName, row);
  }
}

function assertPreflightState(state) {
  for (const tableName of WORKSHOP_TABLES) {
    const row = state.tables.find(candidate => candidate.table_name === tableName);
    assertRuntimeProtected(tableName, row);
  }

  if (state.appliedVersions.has(LEAST_PRIVILEGE_MIGRATION_VERSION) && !isLeastPrivilegeSealed(state)) {
    throw new Error(`${LEAST_PRIVILEGE_MIGRATION_VERSION} is recorded but authenticated least privilege is not sealed`);
  }
}

function buildWorkflowOutputs(state) {
  return {
    history_repair_needed: String(!state.appliedVersions.has(RLS_HISTORY_VERSION)),
    least_privilege_already_applied: String(
      state.appliedVersions.has(LEAST_PRIVILEGE_MIGRATION_VERSION) && isLeastPrivilegeSealed(state)
    )
  };
}

function writeGithubOutput(outputPath, values) {
  if (!outputPath) return;

  const payload = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  appendFileSync(outputPath, `${payload}\n`);
}

function summarizeState(project, state, phase) {
  return {
    phase,
    project: {
      expected_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      hostname: project.hostname,
      host_has_project_ref: project.hostHasProjectRef,
      username_has_project_ref: project.usernameHasProjectRef
    },
    migration_history: {
      rls_history_version: RLS_HISTORY_VERSION,
      rls_history_recorded: state.appliedVersions.has(RLS_HISTORY_VERSION),
      least_privilege_version: LEAST_PRIVILEGE_MIGRATION_VERSION,
      least_privilege_recorded: state.appliedVersions.has(LEAST_PRIVILEGE_MIGRATION_VERSION)
    },
    tables: state.tables.map(row => ({
      table: row.table_name,
      owner: row.owner,
      rls_enabled: row.rls_enabled,
      anon_select: row.anon_select,
      authenticated_select: row.authenticated_select,
      authenticated_insert: row.authenticated_insert,
      authenticated_update: row.authenticated_update,
      authenticated_delete: row.authenticated_delete,
      authenticated_references: row.authenticated_references,
      authenticated_trigger: row.authenticated_trigger,
      authenticated_truncate: row.authenticated_truncate
    }))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase || 'post';
  const dbUrl = requireDatabaseUrl();
  const project = assertProductionProjectUrl(dbUrl);
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query('BEGIN READ ONLY');

  try {
    const state = await loadClosureState(client);

    if (phase === 'preflight') {
      assertPreflightState(state);
      const outputs = buildWorkflowOutputs(state);
      writeGithubOutput(args['github-output'], outputs);
      console.log('Bella Auto workshop security closure preflight passed');
      console.log(JSON.stringify({
        ...summarizeState(project, state, phase),
        workflow_outputs: outputs
      }, null, 2));
      return;
    }

    if (phase !== 'post') {
      throw new Error(`Unsupported phase: ${phase}`);
    }

    assertPostClosureState(state);
    console.log('Bella Auto workshop security closure probe passed');
    console.log(JSON.stringify(summarizeState(project, state, phase), null, 2));
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

function isMainModule() {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  main().catch(error => {
    console.error(`Bella Auto workshop security closure probe failed: ${error.message}`);
    process.exit(1);
  });
}

export {
  EXPECTED_PRODUCTION_PROJECT_REF,
  LEAST_PRIVILEGE_MIGRATION_VERSION,
  RLS_HISTORY_VERSION,
  WORKSHOP_TABLES,
  assertHistoryApplied,
  assertLeastPrivilege,
  assertPostClosureState,
  assertPreflightState,
  assertProductionProjectUrl,
  buildWorkflowOutputs,
  requireDatabaseUrl
};
