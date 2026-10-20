import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createDashboard } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw Error('ABSOLUTE_EVIDENCE_DIRECTORY_REQUIRED');
await mkdir(output, { recursive: true });
let app, browser, stage = 'STARTUP';
try {
  app = await createDashboard({ root: path.join(os.homedir(), '.codex', 'agent-flow-evidence') });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', () => errors.push('PAGE_ERROR'));
  page.on('console', message => { if (message.type() === 'error') errors.push('CONSOLE_ERROR'); });
  await page.goto(app.url);
  await page.locator('#content:not([hidden])').waitFor({ timeout: 60000 });
  assert.equal(new URL(page.url()).hash, '');
  const cases = [
    { id: 'F3oiu6', hash: 'b38b1f271b14f71b16ff69fb2958f47841ac65c782b2251d836a2ff28f95ddb5', pass: 32, fail: 10, artifacts: 23, files: ['scripts/agent-flow/agent-flow.test.mjs', 'scripts/agent-flow/contract.mjs'], fileChangeRows: 0 },
    { id: 'mbTMET', hash: 'f48ec67757d596d1329c44b631a4cbb7b2a80a02cd6abd186dbbf2e348b08912', pass: 7, fail: 2, artifacts: 26, files: ['scripts/agent-flow/task-workflow.mjs', 'scripts/agent-flow/task-workflow.test.mjs'], fileChangeRows: 6 },
  ];
  const packages = [];
  for (const expected of cases) {
    stage = expected.id;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.getByRole('button', { name: new RegExp('Run · ' + expected.id) }).click();
    await page.getByText(`${expected.pass}/${expected.pass} PASS`, { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await page.getByText(`${expected.fail} failures`, { exact: true }).count(), 1);
    assert.equal(await page.getByText('11/11 MATCH', { exact: true }).count(), 1);
    assert.equal(await page.locator('tbody tr').count(), 34);
    const response = await page.request.get(app.origin + '/api/packages/bella-agent-flow-' + expected.id);
    assert.equal(response.status(), 200);
    const data = await response.json(); assert.equal(data.state, 'AVAILABLE');
    assert.equal(data.integrity.manifestSha256, expected.hash); assert.equal(data.integrity.artifacts, expected.artifacts);
    assert.equal(data.liveCount, 23); assert.equal(data.historyCount, 11); assert.equal(data.acks, 23);
    assert.deepEqual([...data.files].sort(), [...expected.files].sort());
    assert.equal(data.timeline.filter(row => row.type === 'fileChange').length, expected.fileChangeRows);
    for (const file of expected.files) assert.equal(await page.getByText(file, { exact: true }).count(), 1);
    for (const value of [data.binding.taskId, data.binding.runId, data.binding.turnId]) assert.ok(await page.getByText(value, { exact: true }).count() > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, expected.id + '-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('tbody tr').count(), 34);
    await page.screenshot({ path: path.join(output, expected.id + '-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Làm mới' }).click();
    await page.locator('#refresh:not([disabled])').waitFor({ timeout: 60000 });
    assert.equal(await page.getByText(`${expected.pass}/${expected.pass} PASS`, { exact: true }).count(), 1);
    packages.push({ id: data.id, manifestSha256: data.integrity.manifestSha256, artifactHashes: expected.artifacts, live: data.liveCount, history: data.historyCount, acks: data.acks, reconciliation: data.reconciliation, red: data.tests.red.counters, green: data.tests.green.counters, files: data.files, rows: 34, fileChangeRows: expected.fileChangeRows, desktop: '1500x1100 PASS', mobile: '390x844 PASS', horizontalOverflow: false, refresh: 'PASS', expiresAt: data.expiresAt });
  }
  stage = 'FAILED_AND_UNSUPPORTED';
  for (const [id, expected] of [['XvTmtM', 'FAILED'], ['R0fOzS', 'UNSUPPORTED']]) {
    await page.getByRole('button', { name: new RegExp('Run · ' + id) }).click();
    await page.locator('#notice').filter({ hasText: new RegExp('^' + expected) }).waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#content').isHidden(), true);
    assert.equal(await page.locator('tbody tr').count(), 0);
    const data = await (await page.request.get(app.origin + '/api/packages/bella-agent-flow-' + id)).json();
    assert.equal(data.state, expected); assert.equal(data.timeline, undefined); assert.equal(data.tests, undefined);
  }
  await page.reload(); await page.locator('#content:not([hidden])').waitFor({ timeout: 60000 });
  stage = 'ANONYMOUS';
  const denied = await browser.newContext();
  const anonymous = await denied.request.get(app.origin + '/api/packages'); assert.equal(anonymous.status(), 401); await denied.close();
  assert.equal(errors.length, 0);
  const report = { result: 'PASS_REAL_LEGACY_AND_BOUNDED_PACKAGE_BROWSER', checkedAt: new Date().toISOString(), authority: 'REAL_GITHUB_BDGF', packages, failed: 'FAILED_WITHOUT_TIMELINE', unsupported: 'UNSUPPORTED_WITHOUT_TIMELINE', anonymousStatus: 401, reload: 'PASS', pageErrors: errors, deadline: packages.map(entry => entry.expiresAt).sort()[0], scope: 'Retained historical evidence only; no agent run, writer, native-history re-query or source package mutation', production: 'UNTOUCHED' };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch {
  const report = { result: 'FAIL_BROWSER_PROOF', stage, diagnostic: 'Details omitted to protect in-memory browser capability' };
  await writeFile(path.join(output, 'browser-failure.json'), JSON.stringify(report));
  console.error(JSON.stringify(report)); process.exitCode = 1;
} finally { await browser?.close(); await app?.close(); }
