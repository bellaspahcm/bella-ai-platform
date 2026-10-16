import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { approvedHash, approvedTag, loadPackage, productionConfig, validateDispatch } from './apply-automove-production-adoption.mjs';

// Pure fixtures; these do not provide runtime owner authority or connect to DB.
const fixture = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'bellaspahcm/bella-ai-platform', GITHUB_REF: 'refs/tags/' + approvedTag,
  GITHUB_RUN_ATTEMPT: '1', ADOPTION_APPROVED_SHA256: approvedHash,
  ADOPTION_CONFIRMATION: 'APPLY_AUTOMOVE_SCHEMA_SECURITY_ONLY',
  AUTOMOVE_PRODUCTION_DB_URL: 'fixture-only', GATE_SIGNING_KEY_FROM_SECRETS_MANAGER: 'fixture-only',
  BDGF_USE_SECRETS_MANAGER: 'false' };
test('approved context shape and every immutable input match', () => {
  assert.doesNotThrow(() => validateDispatch(fixture));
  const pkg = loadPackage();
  assert.equal(pkg.manifest.inputs.length, 16);
  assert.equal(pkg.manifest.creates.length, 8);
  assert.equal(pkg.manifest.authorization.runtime_guard, 'UNCHANGED_HELD');
});
for (const [label, changed] of Object.entries({
  local: { GITHUB_ACTIONS: '' }, push: { GITHUB_EVENT_NAME: 'push' },
  repository: { GITHUB_REPOSITORY: 'other/repo' }, main: { GITHUB_REF: 'refs/heads/main' },
  retry: { GITHUB_RUN_ATTEMPT: '2' }, hash: { ADOPTION_APPROVED_SHA256: '0'.repeat(64) },
  confirmation: { ADOPTION_CONFIRMATION: '' }, credential: { AUTOMOVE_PRODUCTION_DB_URL: '' },
  key: { GATE_SIGNING_KEY_FROM_SECRETS_MANAGER: '' }, fallback: { GATE_SIGNING_KEY: 'forbidden' }
})) test('rejects ' + label + ' before mutation', () => assert.throws(() => validateDispatch({ ...fixture, ...changed })));

test('rejects wrong target, wrong principal and query-parameter overrides', () => {
  for (const url of [
    'postgresql://postgres:unit-fixture@db.bmnbqbcdbuklhopfbopv.supabase.co:5432/postgres',
    'postgresql://bella_migration_executor:unit-fixture@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres',
    'postgresql://postgres:unit-fixture@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres?host=other-host'
  ]) assert.throws(() => productionConfig(url));
});

test('workflow is one manual tag-bound job without app deployment or history repair', () => {
  const source = readFileSync(new URL('../../.github/workflows/bdgf-bella-auto-workshop-security-closure.yml', import.meta.url), 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(Object.keys(workflow.jobs), ['adopt']);
  const job = workflow.jobs.adopt;
  assert.equal(job.environment, 'Production');
  assert.ok(job.if.includes('refs/tags/' + approvedTag));
  assert.equal(job.env, undefined);
  assert.deepEqual([...source.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]), ['PRODUCTION_SUPABASE_DB_URL', 'GATE_SIGNING_KEY']);
  assert.ok(job.steps.some(step => step.run === 'npm ci --ignore-scripts --no-audit --no-fund'));
  assert.doesNotMatch(source, /vercel|supabase migration repair|supabase db push|npm run build|next build/i);
});

test('only canonical entrypoints issue approval and execute SQL; no token writer is duplicated', () => {
  const source = readFileSync(new URL('./apply-automove-production-adoption.mjs', import.meta.url), 'utf8');
  assert.match(source, /await createApprovalRecord\(writer,/);
  assert.match(source, /await executeMigrationWithAuthorization\(/);
  assert.match(source, /PRIOR_ATTEMPT_EXISTS_INSPECT_BEFORE_RETRY/);
  assert.match(source, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.doesNotMatch(source, /issueGateToken\(|INSERT INTO bella_|UPDATE bella_|query\(sql\)|query\(adoption\)|ALTER ROLE|GRANT .* TO postgres/i);
});
