#!/usr/bin/env node
/**
 * Static guard tests for the Bella Auto workshop security closure workflow.
 */

import assert from 'assert/strict';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import {
  LEAST_PRIVILEGE_MIGRATION_VERSION,
  RLS_HISTORY_VERSION,
  WORKSHOP_TABLES,
  assertPostClosureState,
  assertPreflightState,
  assertProductionProjectUrl,
  buildWorkflowOutputs,
  requireDatabaseUrl
} from './probe-bella-auto-workshop-security-closure.mjs';

const WORKFLOW_PATH = '.github/workflows/bdgf-bella-auto-workshop-security-closure.yml';
const MIGRATION_FILE = 'supabase/migrations/20261013103000_restrict_bella_auto_workshop_authenticated_grants.sql';
const EXPECTED_HASH = '20DD5EBC3C7EF55879CBE7B1EF318AC975F32CF9A3DF6E4E8E36DD008E110F4B';
const CONFIRMATION = 'CLOSE_BELLA_AUTO_WORKSHOP_SECURITY_20261013103000';

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error });
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

function tableRow(tableName, overrides = {}) {
  return {
    table_name: tableName,
    exists: true,
    rls_enabled: true,
    anon_select: false,
    anon_insert: false,
    anon_update: false,
    anon_delete: false,
    authenticated_select: true,
    authenticated_insert: true,
    authenticated_update: true,
    authenticated_delete: true,
    authenticated_references: false,
    authenticated_trigger: false,
    authenticated_truncate: false,
    ...overrides
  };
}

function closureState({ appliedVersions = [RLS_HISTORY_VERSION, LEAST_PRIVILEGE_MIGRATION_VERSION], rowOverrides = {} } = {}) {
  return {
    appliedVersions: new Set(appliedVersions),
    tables: WORKSHOP_TABLES.map(tableName => tableRow(tableName, rowOverrides[tableName] || {}))
  };
}

const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
const migration = readFileSync(MIGRATION_FILE, 'utf8');
const migrationHash = createHash('sha256').update(migration).digest('hex').toUpperCase();

await test('least-privilege migration hash is workflow-bound', () => {
  assert.equal(migrationHash, EXPECTED_HASH);
  assert.match(workflow, new RegExp(EXPECTED_HASH));
  assert.match(workflow, new RegExp(MIGRATION_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflow, /sha256sum "\$LEAST_PRIVILEGE_MIGRATION_FILE"/);
});

await test('workflow is manual-only, main-only, and protected by Production environment', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /environment:\s*\n\s+name: Production/);
  assert.match(workflow, new RegExp(CONFIRMATION));
  assert.match(workflow, /GITHUB_REF"\s*!=\s*"refs\/heads\/main"/);
});

await test('workflow uses Production DB URL for approval, repair, and probes', () => {
  const productionUrlSecretReferences = workflow.match(/secrets\.PRODUCTION_SUPABASE_DB_URL/g) || [];
  assert.ok(productionUrlSecretReferences.length >= 5);
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.PRODUCTION_SUPABASE_DB_URL \}\}/);
  assert.match(workflow, /PRODUCTION_SUPABASE_DB_URL: \$\{\{ secrets\.PRODUCTION_SUPABASE_DB_URL \}\}/);
  assert.match(workflow, /test -n "\$PRODUCTION_SUPABASE_DB_URL"/);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
});

await test('workflow repairs migration history without db push or psql', () => {
  assert.match(workflow, new RegExp(`supabase migration repair "\\$RLS_HISTORY_VERSION"`));
  assert.match(workflow, new RegExp(`supabase migration repair "\\$LEAST_PRIVILEGE_MIGRATION_VERSION"`));
  assert.match(workflow, /--status applied/);
  assert.match(workflow, /--db-url "\$PRODUCTION_SUPABASE_DB_URL"/);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/);
  assert.doesNotMatch(workflow, /\bpsql\b/);
});

await test('least-privilege DDL runs only through BDGF wrapper', () => {
  assert.match(workflow, /create-migration-approval\.mjs/);
  assert.match(workflow, /--approval-mode=owner-operated/);
  assert.match(workflow, /execute-migration-wrapper\.mjs/);
  assert.doesNotMatch(workflow, /node\s+scripts\/bdgf\/migration-executor\.mjs/);

  const approvalIndex = workflow.indexOf('Create owner-operated BDGF approval for least privilege');
  const executeIndex = workflow.indexOf('Execute least-privilege migration through BDGF wrapper');
  const repairIndex = workflow.indexOf('Record least-privilege migration history');
  assert.ok(approvalIndex > 0);
  assert.ok(executeIndex > approvalIndex);
  assert.ok(repairIndex > executeIndex);
});

await test('workflow probes tenant isolation and closure state before PROVEN status', () => {
  const rlsProbeIndex = workflow.indexOf('probe-bella-auto-workshop-rls.mjs');
  const closureProbeIndex = workflow.indexOf('probe-bella-auto-workshop-security-closure.mjs --phase=post');
  const provenIndex = workflow.indexOf('BELLA_AUTO_SECURITY_CLOSURE=PROVEN');
  assert.ok(rlsProbeIndex > 0);
  assert.ok(closureProbeIndex > rlsProbeIndex);
  assert.ok(provenIndex > closureProbeIndex);
  assert.match(workflow, /MIGRATION_HISTORY=RECORDED/);
  assert.match(workflow, /AUTHENTICATED_LEAST_PRIVILEGE=SEALED/);
  assert.match(workflow, /WORKSHOP_TENANT_ISOLATION=PASS/);
});

await test('workflow pins third-party actions by full commit SHA', () => {
  const usesLines = workflow.split('\n').filter(line => line.trim().startsWith('- uses: '));
  assert.ok(usesLines.length >= 2);
  for (const line of usesLines) {
    assert.match(line, /@[a-f0-9]{40}\s*$/);
  }
});

await test('least-privilege migration only removes authenticated table-management grants', () => {
  for (const tableName of WORKSHOP_TABLES) {
    assert.match(migration, new RegExp(`REVOKE REFERENCES, TRIGGER, TRUNCATE ON TABLE public\\.${tableName} FROM authenticated`, 'i'));
    assert.match(migration, new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.${tableName} TO authenticated`, 'i'));
  }

  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bGRANT\b[\s\S]+?\bTO\s+anon\b/i);
  assert.match(migration, /zero-downtime: allow truncate - this revokes the table privilege only/);
});

await test('closure probe validates Production project ref without exposing secrets', () => {
  const direct = assertProductionProjectUrl('postgresql://postgres:secret@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres');
  assert.equal(direct.hostHasProjectRef, true);

  const pooler = assertProductionProjectUrl('postgresql://postgres.lvnvkpyxtuilhrabtlwv:secret@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');
  assert.equal(pooler.usernameHasProjectRef, true);

  assert.throws(
    () => assertProductionProjectUrl('postgresql://postgres:secret@db.wrongproject.supabase.co:5432/postgres'),
    /does not identify Supabase project/
  );
});

await test('closure probe fails closed on history and grants drift', () => {
  assert.doesNotThrow(() => assertPostClosureState(closureState()));
  assert.throws(
    () => assertPostClosureState(closureState({ appliedVersions: [RLS_HISTORY_VERSION] })),
    new RegExp(LEAST_PRIVILEGE_MIGRATION_VERSION)
  );
  assert.throws(
    () => assertPostClosureState(closureState({
      rowOverrides: {
        auto_service_appointments: { authenticated_trigger: true }
      }
    })),
    /table-management privileges: TRIGGER/
  );
});

await test('preflight outputs are idempotent and detect inconsistent history', () => {
  const needsClosure = closureState({ appliedVersions: [] });
  assert.deepEqual(buildWorkflowOutputs(needsClosure), {
    history_repair_needed: 'true',
    least_privilege_already_applied: 'false'
  });
  assert.doesNotThrow(() => assertPreflightState(needsClosure));

  const alreadyClosed = closureState();
  assert.deepEqual(buildWorkflowOutputs(alreadyClosed), {
    history_repair_needed: 'false',
    least_privilege_already_applied: 'true'
  });

  assert.throws(
    () => assertPreflightState(closureState({
      appliedVersions: [LEAST_PRIVILEGE_MIGRATION_VERSION],
      rowOverrides: {
        auto_repair_orders: { authenticated_truncate: true }
      }
    })),
    /recorded but authenticated least privilege is not sealed/
  );
});

await test('closure probe requires explicit DATABASE_URL', () => {
  assert.equal(requireDatabaseUrl({ DATABASE_URL: 'postgresql://example' }), 'postgresql://example');
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
});

const failed = results.filter(result => !result.pass);
console.log(`\nBella Auto security closure workflow tests: ${results.length - failed.length}/${results.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
