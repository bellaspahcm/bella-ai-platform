import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium, request as playwrightRequest } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

const origin = 'https://bella-spa-erp.vercel.app';
const artifact = 'artifacts/automove-production-runtime';
const authOrigin = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function verifySmokeContext(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REPOSITORY, 'bellaspahcm/bella-ai-platform');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.match(env.AUTOMOVE_EXPECTED_SHA || '', /^[a-f0-9]{40}$/);
  assert.equal(env.AUTOMOVE_EXPECTED_SHA, env.GITHUB_SHA);
  assert.ok(['auth-only', 'diagnose-identity', 'full'].includes(env.AUTOMOVE_SMOKE_MODE));
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

const fingerprint = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const safeStatus = value => ['active', 'inactive', 'suspended', 'terminated', 'pending'].includes(value) ? value : 'OTHER';
const safeRole = value => ['accountant', 'admin', 'manager', 'staff', 'owner', 'receptionist', 'cashier', 'therapist', 'doctor'].includes(value) ? value : 'OTHER';
const safeErrorCode = error => ['42501', '42P01', 'PGRST116', 'PGRST301', 'PGRST205'].includes(error?.code) ? error.code : 'OTHER';

export function captureDiagnosticPublicKey(response) {
  try {
    assert.equal(new URL(response.url()).origin, authOrigin);
    assert.equal(new URL(response.url()).pathname, '/auth/v1/token');
    assert.equal(new URL(response.url()).searchParams.get('grant_type'), 'password');
    assert.equal(response.request().method(), 'POST');
    assert.equal(response.status(), 200);
    const publicKey = response.request().headers().apikey;
    return publicKey ? { publicKey } : { failure: 'LOGIN_PUBLIC_KEY_MISSING' };
  } catch { return { failure: 'LOGIN_RESPONSE_CAPTURE_UNAVAILABLE' }; }
}

export function createDiagnosticReadClient(publicKey, cookies, fetcher = fetch) {
  const sessionCookies = cookies.filter(cookie => /^sb-lvnvkpyxtuilhrabtlwv-auth-token(?:\.\d+)?$/.test(cookie.name));
  assert.ok(sessionCookies.length, 'DIAGNOSTIC_AUTH_COOKIE_MISSING');
  return createServerClient(authOrigin, publicKey, {
    global: { fetch: (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      assert.equal(url.origin, authOrigin, 'DIAGNOSTIC_AUTH_ORIGIN_MISMATCH');
      if (method.toUpperCase() !== 'GET') {
        // A terminal local response prevents Auth SDK network-error refresh retries.
        return Promise.resolve(new Response(JSON.stringify({ error: 'diagnostic_read_only',
          error_description: 'Diagnostic requests are read-only.' }),
        { status: 400, headers: { 'content-type': 'application/json' } }));
      }
      assert.ok(url.pathname === '/auth/v1/user' || ['/rest/v1/users', '/rest/v1/tenants'].includes(url.pathname), 'DIAGNOSTIC_READ_SCOPE');
      return fetcher(input, init);
    } },
    // This detached snapshot cannot update browser cookies or persist a session.
    cookies: { getAll: () => sessionCookies, setAll: () => {} },
  });
}

export async function inspectOwnIdentity(client, accessToken, expectedEmail, observe = () => {}) {
  observe('VERIFY_AUTH_SUBJECT');
  const { data: auth, error: authError } = await client.auth.getUser(accessToken);
  assert.ok(!authError && auth?.user);
  observe('VERIFY_AUTH_SUBJECT_BINDING');
  const user = auth.user;
  assert.match(user.id, uuid);
  assert.equal(user.email?.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const result = { actorFingerprint: fingerprint(user.id), configuredIdentityMatches: true,
    source: 'Verified Supabase Auth -> authenticated public.users self -> owning public.tenants',
    failures: [], historical403Origin: 'NOT_PROVEN_RESPONSE_BODY_NOT_RETAINED' };
  observe('READ_SELF_PROFILE');
  const profile = await client.from('users').select('id,tenant_id,role,status').eq('id', user.id).maybeSingle();
  result.profileRead = { status: profile.status, visible: Boolean(profile.data && !profile.error) };
  if (profile.error || !profile.data) {
    if (profile.error) result.profileRead.code = safeErrorCode(profile.error);
    result.failures.push('PROFILE_NOT_VISIBLE_OR_READ_DENIED');
    return result;
  }
  observe('VERIFY_PROFILE_BINDING');
  assert.equal(profile.data.id, user.id);
  result.profile = { subjectMatchesAuth: true, role: safeRole(profile.data.role), status: safeStatus(profile.data.status) };
  if (profile.data.role !== 'accountant') result.failures.push('ROLE_NOT_ACCOUNTANT');
  if (profile.data.status !== 'active') result.failures.push('ACTOR_NOT_ACTIVE');
  if (typeof profile.data.tenant_id !== 'string' || !uuid.test(profile.data.tenant_id)) {
    result.failures.push('TENANT_MISSING_OR_INVALID');
    return result;
  }
  const tenantId = profile.data.tenant_id;
  observe('READ_OWN_TENANT');
  const tenant = await client.from('tenants').select('id,status,product_key').eq('id', tenantId).maybeSingle();
  result.tenantRead = { status: tenant.status, visible: Boolean(tenant.data && !tenant.error) };
  if (tenant.error || !tenant.data) {
    if (tenant.error) result.tenantRead.code = safeErrorCode(tenant.error);
    result.failures.push('TENANT_NOT_VISIBLE_OR_READ_DENIED');
    return result;
  }
  observe('VERIFY_TENANT_BINDING');
  assert.equal(tenant.data.id, tenantId);
  result.tenant = { fingerprint: fingerprint(tenantId), matchesProfile: true,
    status: safeStatus(tenant.data.status),
    productKey: /^bella_[a-z_]{1,40}$/.test(tenant.data.product_key) ? tenant.data.product_key : 'OTHER' };
  if (tenant.data.status !== 'active') result.failures.push('TENANT_NOT_ACTIVE');
  return result;
}

export async function verifyProductionRuntime() {
  verifySmokeContext(process.env);
  const evidence = { status: 'NOT_PROVEN', sha: process.env.GITHUB_SHA,
    startedAt: new Date().toISOString(), environment: 'production', origin,
    mode: process.env.AUTOMOVE_SMOKE_MODE, businessMutation: false, migration: false, checks: {} };
  let browser, context, anonymous, page;
  let authHttpStatus = null;
  let capturedAuth;
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
      if (target.origin === authOrigin && target.pathname === '/auth/v1/token' &&
          target.searchParams.get('grant_type') === 'password' && response.request().method() === 'POST') {
        authHttpStatus = response.status();
        if (process.env.AUTOMOVE_SMOKE_MODE === 'diagnose-identity' && response.status() === 200 && !capturedAuth) {
          capturedAuth = captureDiagnosticPublicKey(response);
        }
      }
    });
    await loginWithConfiguredCredentials(page, {
      email: process.env.PRODUCTION_E2E_ADMIN_EMAIL, password: process.env.PRODUCTION_E2E_ADMIN_PASSWORD,
    });
    evidence.checks.login = 'PASS_REAL_AUTH';
    if (['auth-only', 'diagnose-identity'].includes(process.env.AUTOMOVE_SMOKE_MODE)) {
      phase = 'AUTHENTICATED_CLOSED_GUARD';
      const closed = await context.request.get(path);
      const closedBody = await closed.json();
      verifyAuthenticatedClosedGuard(closed.status(), closedBody);
      evidence.checks.closedGuard = 'PASS_REAL_AUTH_RUNTIME_STILL_DISABLED';
      if (process.env.AUTOMOVE_SMOKE_MODE === 'diagnose-identity') {
        phase = 'CAPTURE_LOGIN_SESSION';
        const login = capturedAuth || { failure: 'LOGIN_RESPONSE_NOT_OBSERVED' };
        if (login.failure) {
          evidence.diagnosticFailure = login.failure;
          throw new Error('DIAGNOSTIC_SESSION_UNAVAILABLE');
        }
        phase = 'CREATE_AUTHENTICATED_READ_CLIENT';
        const client = createDiagnosticReadClient(login.publicKey, await context.cookies(origin));
        evidence.identity = await inspectOwnIdentity(client, undefined, process.env.PRODUCTION_E2E_ADMIN_EMAIL,
          step => { phase = step; });
        const requestId = closed.headers()['x-vercel-id'];
        evidence.closedRequest = { method: 'GET', path: '/api/bella-auto/sales-chain/state',
          status: closed.status(), code: closedBody.code,
          requestId: typeof requestId === 'string' && /^[a-zA-Z0-9:._-]{1,160}$/.test(requestId) ? requestId : 'NOT_AVAILABLE' };
        evidence.status = 'DIAGNOSTIC_COLLECTED_RUNTIME_CLOSED';
        evidence.scope = 'Current self-profile/own-tenant authority only; no historical 403 body reconstruction or operational runtime proof';
        return evidence;
      }
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
