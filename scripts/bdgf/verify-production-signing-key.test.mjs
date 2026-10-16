import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { adoptionHash, signProbe, validateContext, verifyProbe } from './verify-production-signing-key.mjs';

// Pure input fixtures, not fabricated runtime authority or Production-key proof.
const fixture = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'bellaspahcm/bella-ai-platform', GITHUB_REF: 'refs/tags/bdgf-key-check-20261016',
  GITHUB_SHA: 'a'.repeat(40), GATE_SIGNING_KEY_FROM_SECRETS_MANAGER: 'unit-fixture-only-'.repeat(5),
  BDGF_USE_SECRETS_MANAGER: 'false', SECRETS_CACHE_ENABLED: 'false' };
test('approved context shape is accepted', () => assert.doesNotThrow(() => validateContext(fixture)));
for (const [name, changed] of Object.entries({
  outsideActions: { GITHUB_ACTIONS: '' }, nonManual: { GITHUB_EVENT_NAME: 'push' },
  wrongRepo: { GITHUB_REPOSITORY: 'other/repo' }, main: { GITHUB_REF: 'refs/heads/main' },
  missingSha: { GITHUB_SHA: '' }, missingKey: { GATE_SIGNING_KEY_FROM_SECRETS_MANAGER: '' },
  fallback: { GATE_SIGNING_KEY: 'forbidden' }, credential: { DATABASE_EXECUTOR_URL: 'forbidden' },
  backend: { BDGF_USE_SECRETS_MANAGER: 'true' }
})) test('rejects ' + name, () => assert.throws(() => validateContext({ ...fixture, ...changed })));

test('HMAC verifies only the unchanged non-authorizing challenge', () => {
  const key = fixture.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER;
  const probe = { purpose: 'verification-only-no-execution', adoption_sql_sha256: adoptionHash, nonce: 'fixture' };
  const signature = signProbe(probe, key);
  assert.equal(verifyProbe(probe, signature, key), true);
  assert.equal(verifyProbe({ ...probe, nonce: 'changed' }, signature, key), false);
  assert.equal(verifyProbe(probe, signature, key + '-different'), false);
  for (const value of ['', 'invalid', '0'.repeat(63), null, undefined]) assert.equal(verifyProbe(probe, value, key), false);
});

test('workflow has only manual entry, read token and one step-scoped signing secret', () => {
  const text = readFileSync(new URL('../../.github/workflows/test-secret-injection.yml', import.meta.url), 'utf8');
  const workflow = YAML.parse(text);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['verify-key']);
  const job = workflow.jobs['verify-key'];
  assert.equal(job.environment, 'Production');
  assert.ok(job.if.includes("refs/tags/bdgf-key-check-20261016"));
  assert.equal(job.env, undefined);
  const secrets = [...text.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]);
  assert.deepEqual(secrets, ['GATE_SIGNING_KEY']);
  assert.ok(job.steps.some(step => step.run === 'npm ci --ignore-scripts --no-audit --no-fund'));
  const source = readFileSync(new URL('./verify-production-signing-key.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /issueGateToken|createApprovalRecord|executeMigration|from ['"]pg['"]|DATABASE_EXECUTOR_URL\s*=/);
});
