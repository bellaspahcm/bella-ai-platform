import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { verifySmokeContext, verifyRecognitionDashboard, verifySqlRead } from './verify-automove-production-runtime.mjs';

const fixture = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'bellaspahcm/bella-ai-platform', GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'a'.repeat(40), AUTOMOVE_EXPECTED_SHA: 'a'.repeat(40),
  PRODUCTION_E2E_ADMIN_EMAIL: 'unit@example.invalid', PRODUCTION_E2E_ADMIN_PASSWORD: 'unit-only' };
test('smoke refuses a local, PR, wrong SHA or missing operating identity', () => {
  verifySmokeContext(fixture);
  for (const change of [{ GITHUB_ACTIONS: '' }, { GITHUB_REF: 'refs/heads/other' },
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REPOSITORY: 'other/repository' },
    { AUTOMOVE_EXPECTED_SHA: 'b'.repeat(40) }, { PRODUCTION_E2E_ADMIN_PASSWORD: '' }]) {
    assert.throws(() => verifySmokeContext({ ...fixture, ...change }));
  }
});
test('zero revenue is valid only with an actual canonical dashboard response', () => {
  const valid = { timeZone: 'UTC', summary: { sales: 0, revenue: 0, averageSalePrice: 0 },
    revenueByMonth: Array.from({ length: 6 }, () => ({ revenue: 0, sales: 0 })), topModels: [] };
  verifyRecognitionDashboard(valid);
  assert.throws(() => verifyRecognitionDashboard({ error: 'loading failed' }));
  assert.throws(() => verifyRecognitionDashboard({ ...valid, summary: { sales: 0, revenue: 0, averageSalePrice: 1 } }));
});
test('auth/configuration failures and generic 404 are never SQL runtime PASS', () => {
  verifySqlRead(404, { code: 'BOOKING_NOT_FOUND' });
  for (const status of [200, 401, 403, 500, 503]) assert.throws(() => verifySqlRead(status, { code: 'BOOKING_NOT_FOUND' }));
  assert.throws(() => verifySqlRead(404, { error: 'not found' }));
});
test('manual workflow pins main and expected SHA; smoke has no DB or mutation client', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/automove-production-runtime-smoke.yml', 'utf8'));
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.smoke.environment, 'Production');
  assert.match(workflow.jobs.smoke.if, /refs\/heads\/main/);
  const source = readFileSync('scripts/verify-automove-production-runtime.mjs', 'utf8');
  assert.doesNotMatch(source, /from ['"]pg['"]|\.post\(|\.put\(|\.delete\(|\.patch\(|storageState\(|screenshot\(/);
});
