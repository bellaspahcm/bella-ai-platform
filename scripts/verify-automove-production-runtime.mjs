import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium, request as playwrightRequest } from '@playwright/test';

const origin = 'https://bella-spa-erp.vercel.app';
const artifact = 'artifacts/automove-production-runtime';

export function verifySmokeContext(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REPOSITORY, 'bellaspahcm/bella-ai-platform');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.match(env.AUTOMOVE_EXPECTED_SHA || '', /^[a-f0-9]{40}$/);
  assert.equal(env.AUTOMOVE_EXPECTED_SHA, env.GITHUB_SHA);
  assert.ok(env.PRODUCTION_E2E_ADMIN_EMAIL && env.PRODUCTION_E2E_ADMIN_PASSWORD);
}

export function verifyRecognitionDashboard(value) {
  assert.equal(value?.timeZone, 'UTC');
  const summary = value.summary;
  assert.ok(Number.isSafeInteger(summary?.sales) && summary.sales >= 0);
  assert.ok(Number.isSafeInteger(summary.revenue) && summary.revenue >= 0);
  assert.equal(summary.averageSalePrice, summary.sales ? summary.revenue / summary.sales : 0);
  assert.ok(Array.isArray(value.revenueByMonth) && value.revenueByMonth.length === 6);
  assert.ok(Array.isArray(value.topModels));
}

export function verifySqlRead(status, value) {
  // A nonexistent ID must reach authenticated SQL and the tenant-bound lookup.
  // 401/403/503 or an arbitrary HTTP 404 do not prove an enabled SQL path.
  assert.equal(status, 404);
  assert.equal(value?.code, 'BOOKING_NOT_FOUND');
}

export async function verifyProductionRuntime() {
  verifySmokeContext(process.env);
  const evidence = { status: 'NOT_PROVEN', sha: process.env.GITHUB_SHA,
    startedAt: new Date().toISOString(), environment: 'production', origin,
    businessMutation: false, migration: false, checks: {} };
  let browser, context, anonymous;
  let phase = 'LAUNCH';
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ baseURL: origin, serviceWorkers: 'block' });
    anonymous = await playwrightRequest.newContext({ baseURL: origin });
    const id = randomUUID();
    const path = `/api/bella-auto/sales-chain/state?bookingId=${id}`;
    phase = 'UNAUTHENTICATED_DENIAL';
    const denied = await anonymous.get(path);
    assert.equal(denied.status(), 401);
    evidence.checks.unauthenticated = 'DENIED_401';
    phase = 'REAL_LOGIN';
    const page = await context.newPage();
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(process.env.PRODUCTION_E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.PRODUCTION_E2E_ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${origin}/dashboard**`, { timeout: 45000 });
    evidence.checks.login = 'PASS_REAL_AUTH';
    phase = 'AUTHENTICATED_SQL';
    const sql = await context.request.get(path);
    verifySqlRead(sql.status(), await sql.json());
    evidence.checks.sql = 'PASS_ACCOUNTANT_TENANT_BOUND_NOT_FOUND';
    phase = 'CANONICAL_REPORT_READ';
    const report = await context.request.get('/api/bella-auto/analytics/recognized-sales');
    assert.equal(report.status(), 200);
    verifyRecognitionDashboard(await report.json());
    evidence.checks.canonicalReport = 'PASS_AUTHENTICATED_SHAPE_AND_TOTALS';
    phase = 'DASHBOARD_RENDER';
    const errors = [];
    page.on('pageerror', () => errors.push('pageerror'));
    const response = await page.goto(`${origin}/dashboard/bella-auto`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.getByRole('heading', { level: 1 }).filter({ hasText: /Ch.o m.ng tr. l.i/ }).waitFor({ timeout: 45000 });
    assert.equal(new URL(page.url()).pathname, '/dashboard/bella-auto');
    assert.equal(errors.length, 0);
    evidence.checks.dashboard = 'PASS_AUTHENTICATED_RENDER';
    evidence.status = 'PASS_READ_ONLY_OPERATIONAL_SMOKE';
    evidence.scope = 'Connectivity, existing accountant authority, tenant-bound denial, canonical report and dashboard; not a Production financial write/retry test';
    return evidence;
  } catch {
    evidence.status = 'FAIL_NOT_OPERATIONAL_PASS';
    evidence.failedPhase = phase;
    throw new Error(`AUTOMOVE_PRODUCTION_SMOKE_FAILED_${phase}`);
  } finally {
    await context?.close();
    await anonymous?.dispose();
    await browser?.close();
    evidence.finishedAt = new Date().toISOString();
    await mkdir(artifact, { recursive: true });
    // No cookies, credentials, identity, financial values, screenshots or raw responses.
    await writeFile(`${artifact}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyProductionRuntime().then(() => console.log('PASS: read-only AutoMove operational smoke'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
