import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildRehearsalSql, rehearsalConnection } from './rehearse-automove-owner-ddl.mjs';

function environment() {
  return { ALLOW_BDGF_OWNER_E2E_REHEARSAL: '1',
    BDGF_REHEARSAL_API_URL: 'https://bmnbqbcdbuklhopfbopv.supabase.co',
    BDGF_REHEARSAL_DB_URL: 'postgresql://postgres.bmnbqbcdbuklhopfbopv:synthetic@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' };
}

test('rehearsal accepts only an explicit E2E postgres connection with verified TLS', () => {
  const config = rehearsalConnection(environment());
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, config.host);
  assert.equal(config.connectionString, undefined);
});

for (const [name, changes] of [
  ['no authorization', { ALLOW_BDGF_OWNER_E2E_REHEARSAL: undefined }],
  ['no dedicated URL', { BDGF_REHEARSAL_DB_URL: undefined }],
  ['wrong API project', { BDGF_REHEARSAL_API_URL: 'https://lvnvkpyxtuilhrabtlwv.supabase.co' }],
  ['wrong database project', { BDGF_REHEARSAL_DB_URL: environment().BDGF_REHEARSAL_DB_URL.replaceAll('bmnbqbcdbuklhopfbopv', 'lvnvkpyxtuilhrabtlwv') }],
  ['other principal', { BDGF_REHEARSAL_DB_URL: environment().BDGF_REHEARSAL_DB_URL.replace('postgres.', 'bella_migration_executor.') }],
  ['host override', { BDGF_REHEARSAL_DB_URL: environment().BDGF_REHEARSAL_DB_URL + '?host=localhost' }],
  ['TLS override', { BDGF_REHEARSAL_DB_URL: environment().BDGF_REHEARSAL_DB_URL + '?sslmode=disable' }]
]) {
  test(`rehearsal blocks ${name} before connecting`, () => {
    assert.throws(() => rehearsalConnection({ ...environment(), ...changes }));
  });
}

test('fixed SQL proves public and Storage operations inside a rollback boundary', () => {
  const sql = buildRehearsalSql('DO $$ BEGIN NULL; END $$;');
  assert.match(sql, /EXECUTE \$catalog_delta\$/);
  assert.match(sql, /CREATE POLICY .* ON storage.objects/);
  assert.match(sql, /INSERT INTO storage.buckets/);
  assert.match(sql, /EXCEPTION WHEN SQLSTATE 'ZB001' THEN NULL/);
  assert.match(sql, /before_state IS DISTINCT FROM after_state/);
  assert.match(sql, /lock_timeout='5s'/);
  assert.doesNotMatch(sql, /ALTER.*OWNER|GRANT .* TO postgres|CREATE ROLE|SET ROLE/i);
  const failed = buildRehearsalSql('DO $$ BEGIN NULL; END $$;', true);
  assert.match(failed, /RAISE EXCEPTION 'BDGF_REHEARSAL_EXPECTED_ROLLBACK'/);
  assert.doesNotMatch(failed, /EXCEPTION WHEN (OTHERS|SQLSTATE 'P0001')/);
  assert.throws(() => buildRehearsalSql('$catalog_delta$'), /delimiter/);
});

test('owner authority is real Actions metadata, never a local injected role', () => {
  const source = readFileSync(new URL('rehearse-automove-owner-ddl.mjs', import.meta.url), 'utf8');
  assert.ok(source.indexOf('await resolveGitHubActionsOwnerAuthority(') < source.indexOf('const db = new pg.Client('));
  assert.match(source, /executor_identity: 'postgres'/);
  assert.match(source, /targetEnvironment: 'dev', targetSchema: null/);
  assert.match(source, /createApprovalRecord\(db/);
  assert.match(source, /executeMigrationWithAuthorization\(/);
  assert.doesNotMatch(source, /GITHUB_ACTIONS\s*=|ownerAuthority:|approverRole:\s*'admin'/);
});

test('workflow uses exact same-repository PR SHA and E2E secrets only', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/bdgf-automove-owner-rehearsal.yml', import.meta.url), 'utf8');
  assert.match(workflow, /head.repo.full_name == github.repository/);
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.head.sha }}/);
  assert.match(workflow, /secrets.E2E_SUPABASE_DB_URL/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github.token }}/);
  assert.doesNotMatch(workflow, /secrets\.(?:PRODUCTION_|DATABASE_EXECUTOR_URL|GATE_SIGNING_KEY)|refs\/heads\/main|supabase db push/);
});

test('catalog forward migration routes to the existing focused Real DB verifier', () => {
  const result = spawnSync(process.execPath, ['scripts/run-scoped-real-db-e2e.mjs', '--list-only',
    'supabase/migrations/20261016010000_align_automove_catalog_read_acl.sql'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verify-automove-catalog-reads.ts/);
  assert.doesNotMatch(result.stdout, /Running full real database/);
});
