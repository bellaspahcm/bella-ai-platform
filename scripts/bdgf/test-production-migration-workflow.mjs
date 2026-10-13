#!/usr/bin/env node
/**
 * Static guard tests for the official BDGF Production migration workflow.
 */

import assert from 'assert/strict';
import { readFileSync } from 'fs';
import {
  WORKSHOP_TABLES,
  assertTableSecurity,
  expectNoWrite,
  requireDatabaseUrl,
  tenantClaims
} from './probe-bella-auto-workshop-rls.mjs';

const WORKFLOW_PATH = '.github/workflows/bdgf-bella-auto-workshop-rls-production.yml';
const EXPECTED_HASH = '1FEDCE34702106E86A38D650AAF43FEC52A763F54E66A11187EEF6D3A37C2425';
const MIGRATION_FILE = 'supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql';

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

const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

await test('workflow is manual-only and protected by Production environment', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /environment:\s*\n\s+name: Production/);
  assert.match(workflow, /GITHUB_EVENT_NAME"\s*!=\s*"workflow_dispatch"/);
  assert.match(workflow, /GITHUB_REF"\s*!=\s*"refs\/heads\/main"/);
  assert.doesNotMatch(workflow, /\$\{\{\s*inputs\.[^}]+}}\s*!=/);
});

await test('workflow binds the exact approved migration artifact and hash', () => {
  assert.match(workflow, new RegExp(MIGRATION_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflow, new RegExp(EXPECTED_HASH));
  assert.match(workflow, /sha256sum "\$MIGRATION_FILE"/);
  assert.match(workflow, /Migration SHA-256 mismatch/);
});

await test('workflow creates owner-operated approval before execution', () => {
  assert.match(workflow, /create-migration-approval\.mjs/);
  assert.match(workflow, /--approval-mode=owner-operated/);
  assert.match(workflow, /--environment="\$TARGET_ENVIRONMENT"/);
  assert.match(workflow, /--target-schema="\$TARGET_SCHEMA"/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
});

await test('workflow uses the canonical Production Supabase database URL secret', () => {
  const productionUrlSecretReferences = workflow.match(/secrets\.PRODUCTION_SUPABASE_DB_URL/g) || [];
  assert.ok(productionUrlSecretReferences.length >= 3);
  assert.match(workflow, /PRODUCTION_SUPABASE_DB_URL: \$\{\{ secrets\.PRODUCTION_SUPABASE_DB_URL \}\}/);
  assert.match(workflow, /DATABASE_URL: \$\{\{ secrets\.PRODUCTION_SUPABASE_DB_URL \}\}/);
  assert.match(workflow, /test -n "\$PRODUCTION_SUPABASE_DB_URL"/);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL/);
});

await test('workflow pins third-party actions by full commit SHA', () => {
  const usesLines = workflow.split('\n').filter(line => line.trim().startsWith('- uses: '));
  assert.ok(usesLines.length >= 2);
  for (const line of usesLines) {
    assert.match(line, /@[a-f0-9]{40}\s*$/);
  }
});

await test('workflow executes only through the BDGF wrapper', () => {
  assert.match(workflow, /execute-migration-wrapper\.mjs/);
  assert.doesNotMatch(workflow, /node\s+scripts\/bdgf\/migration-executor\.mjs/);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/);
  assert.doesNotMatch(workflow, /\bpsql\b/);
});

await test('workflow requires post-deploy RLS probe before PROVEN status', () => {
  assert.match(workflow, /probe-bella-auto-workshop-rls\.mjs/);
  assert.match(workflow, /POST_DEPLOY_RLS=PASS/);
  assert.match(workflow, /SECURITY_REPAIR=PROVEN/);
  assert.ok(workflow.indexOf('probe-bella-auto-workshop-rls.mjs') < workflow.indexOf('SECURITY_REPAIR=PROVEN'));
});

await test('probe validates required database environment', () => {
  assert.equal(requireDatabaseUrl({ DATABASE_URL: 'postgresql://example' }), 'postgresql://example');
  assert.throws(() => requireDatabaseUrl({}), /DATABASE_URL is required/);
});

await test('probe table security assertions fail closed', () => {
  for (const table of WORKSHOP_TABLES) {
    assert.throws(() => assertTableSecurity(table, { exists: false }), /does not exist/);
    assert.throws(() => assertTableSecurity(table, { exists: true, rls_enabled: false }), /does not have RLS enabled/);
    assert.throws(
      () => assertTableSecurity(table, { exists: true, rls_enabled: true, anon_select: true }),
      /grants anon table privileges/
    );
    assert.doesNotThrow(() => assertTableSecurity(table, {
      exists: true,
      rls_enabled: true,
      anon_select: false,
      anon_insert: false,
      anon_update: false,
      anon_delete: false
    }));
  }
});

await test('probe tenant claims bind authenticated role to tenant identity', () => {
  const claims = JSON.parse(tenantClaims(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  ));

  assert.equal(claims.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.tenant_id, '22222222-2222-4222-8222-222222222222');
  assert.equal(claims.app_metadata.tenant_id, claims.tenant_id);
});

await test('probe cross-tenant write helper fails when rows are modified', async () => {
  await assert.rejects(
    () => expectNoWrite({
      async query() {
        return { rowCount: 1 };
      }
    }, 'cross-tenant update', 'UPDATE example', []),
    /modified 1 row/
  );

  const deniedByRls = await expectNoWrite({
    async query() {
      const error = new Error('new row violates row-level security policy');
      error.code = '42501';
      throw error;
    }
  }, 'cross-tenant insert', 'INSERT example', []);

  assert.equal(deniedByRls.pass, true);
  assert.equal(deniedByRls.code, '42501');
});

const failed = results.filter(result => !result.pass);
console.log(`\nBDGF Production migration workflow tests: ${results.length - failed.length}/${results.length} PASS`);

if (failed.length > 0) {
  process.exit(1);
}
