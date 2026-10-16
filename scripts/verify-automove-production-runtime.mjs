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
  assert.ok(['auth-only', 'full'].includes(env.AUTOMOVE_SMOKE_MODE));
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

export function verifyAuthenticatedClosedGuard(status, value) {
  assert.equal(status, 503);
  assert.equal(value?.code, 'AUTOMOVE_RUNTIME_DISABLED');
}

export async function verifyProductionRuntime() {
  verifySmokeContext(process.env);
  const evidence = { status: 'NOT_PROVEN', sha: process.env.GITHUB_SHA,
    startedAt: new Date().toISOString(), environment: 'production', origin,
    mode: process.env.AUTOMOVE_SMOKE_MODE, businessMutation: false, migration: false, checks: {} };
  let browser, context, anonymous, page;
  let authHttpStatus = null;
  let phase = 'LAUNCH';
  try {
    browser = await chromium.launch();
    const { loginWithConfiguredCredentials, getE2eContextOptions } = await import('../e2e/fixtures/auth.ts');
    const options = getE2eContextOptions();
    assert.equal(options.baseURL, origin);
    context = await browser.newContext({ ...options, serviceWorkers: 'block' });
    anonymous = await playwrightRequest.newContext({ baseURL: origin });
    const id = randomUUID();
    const path = `/api/bella-auto/sales-chain/state?bookingId=${id}`;
    phase = 'UNAUTHENTICATED_DENIAL';
    const denied = await anonymous.get(path);
    assert.equal(denied.status(), 401);
    evidence.checks.unauthenticated = 'DENIED_401';
    phase = 'REAL_LOGIN';
    page = await context.newPage();
    page.on('response', response => {
      const target = new URL(response.url());
      if (target.hostname === 'lvnvkpyxtuilhrabtlwv.supabase.co' && target.pathname === '/auth/v1/token') {
        authHttpStatus = response.status();
      }
    });
    await loginWithConfiguredCredentials(page, {
      email: process.env.PRODUCTION_E2E_ADMIN_EMAIL, password: process.env.PRODUCTION_E2E_ADMIN_PASSWORD,
    });
    evidence.checks.login = 'PASS_REAL_AUTH';
    if (process.env.AUTOMOVE_SMOKE_MODE === 'auth-only') {
      phase = 'AUTHENTICATED_CLOSED_GUARD';
      const closed = await context.request.get(path);
      verifyAuthenticatedClosedGuard(closed.status(), await closed.json());
      evidence.checks.closedGuard = 'PASS_REAL_AUTH_RUNTIME_STILL_DISABLED';
      evidence.status = 'PASS_AUTH_ONLY_RUNTIME_CLOSED';
      evidence.scope = 'Real existing-credential browser Auth only; accountant authority, SQL business path and Go-Live remain unproven';
      return evidence;
    }
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
    if (phase === 'REAL_LOGIN' && page) {
      const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const pathname = new URL(page.url()).pathname;
      evidence.loginObservation = {
        authHttpStatus,
        route: ['/login', '/dashboard', '/hq'].includes(pathname) ? pathname : 'OTHER',
        mfaPromptVisible: /nhập mã xác minh|nhap ma xac minh|2 lớp|2 lop/i.test(body),
        invalidCredentialsVisible: /invalid login credentials/i.test(body),
      };
    }
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
  verifyProductionRuntime().then(result => console.log(result.status))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
