import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import { verifySmokeContext, verifyRecognitionDashboard, verifySqlRead, verifyAuthenticatedClosedGuard, inspectOwnIdentity, captureDiagnosticPublicKey, createDiagnosticReadClient } from './verify-automove-production-runtime.mjs';

const fixture = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REPOSITORY: 'bellaspahcm/bella-ai-platform', GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'a'.repeat(40), AUTOMOVE_EXPECTED_SHA: 'a'.repeat(40),
  AUTOMOVE_SMOKE_MODE: 'auth-only',
  PRODUCTION_E2E_ADMIN_EMAIL: 'unit@example.invalid', PRODUCTION_E2E_ADMIN_PASSWORD: 'unit-only' };
test('smoke refuses a local, PR, wrong SHA or missing operating identity', () => {
  verifySmokeContext(fixture);
  for (const change of [{ GITHUB_ACTIONS: '' }, { GITHUB_REF: 'refs/heads/other' },
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REPOSITORY: 'other/repository' },
    { AUTOMOVE_EXPECTED_SHA: 'b'.repeat(40) }, { PRODUCTION_E2E_ADMIN_PASSWORD: '' }, { AUTOMOVE_SMOKE_MODE: 'skip' }]) {
    assert.throws(() => verifySmokeContext({ ...fixture, ...change }));
  }
});
test('auth-only requires the real authenticated closed guard, never generic errors or enabled SQL', () => {
  verifyAuthenticatedClosedGuard(503, { code: 'AUTOMOVE_RUNTIME_DISABLED' });
  for (const status of [200, 401, 403, 404, 500]) assert.throws(() => verifyAuthenticatedClosedGuard(status, { code: 'AUTOMOVE_RUNTIME_DISABLED' }));
  assert.throws(() => verifyAuthenticatedClosedGuard(503, { code: 'DATABASE_NOT_CONFIGURED' }));
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
  assert.equal(workflow.on.workflow_dispatch.inputs.mode.default, 'auth-only');
  assert.ok(workflow.on.workflow_dispatch.inputs.mode.options.includes('diagnose-identity'));
  assert.match(workflow.jobs.smoke.if, /refs\/heads\/main/);
  const source = readFileSync('scripts/verify-automove-production-runtime.mjs', 'utf8');
  assert.doesNotMatch(source, /from ['"]pg['"]|\.post\(|\.put\(|\.delete\(|\.patch\(|storageState\(|screenshot\(/);
  assert.match(source, /import\('\.\.\/e2e\/fixtures\/auth\.ts'\)/);
  assert.doesNotMatch(source, /loginWithLocalDevBypass|mock_user_email|E2E_ADMIN_PASSWORD\s*\|\|/);
  assert.ok(source.indexOf('verifyAuthenticatedClosedGuard(closed.status(), closedBody)') < source.indexOf('evidence.identity = await inspectOwnIdentity'));
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE|createAdmin|SUPABASE_DB_URL|DATABASE_URL/);
});

const actorId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
function identityClient({ role = 'accountant', status = 'active', tenantStatus = 'active',
  profileError, tenantError, profileMissing = false, tenantMissing = false, foreignProfile = false,
  authError = false } = {}) {
  const queries = [];
  const client = {
    auth: { getUser: async token => {
      assert.equal(token, 'unit-session-canary');
      return { data: { user: { id: actorId, email: 'unit@example.invalid',
        app_metadata: { role: 'accountant', tenant_id: tenantId } } }, error: authError ? {} : null };
    } },
    from: table => ({ select: fields => ({ eq: (column, value) => ({ maybeSingle: async () => {
      queries.push({ table, fields, column, value });
      return table === 'users'
        ? { status: profileError ? 403 : 200, error: profileError,
          data: profileMissing ? null : { id: foreignProfile ? tenantId : actorId, tenant_id: tenantId, role, status } }
        : { status: tenantError ? 403 : 200, error: tenantError,
          data: tenantMissing ? null : { id: tenantId, status: tenantStatus, product_key: 'bella_hq' } };
    } }) }) }),
  };
  return { client, queries };
}

test('closed-runtime diagnosis reads only verified self and owning tenant; never persists session or raw identities', async () => {
  const { client, queries } = identityClient();
  const result = await inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid');
  assert.deepEqual(result.failures, []);
  assert.equal(result.profile.role, 'accountant');
  assert.equal(result.tenant.matchesProfile, true);
  assert.deepEqual(queries, [
    { table: 'users', fields: 'id,tenant_id,role,status', column: 'id', value: actorId },
    { table: 'tenants', fields: 'id,status,product_key', column: 'id', value: tenantId },
  ]);
  const serialized = JSON.stringify(result);
  for (const secret of ['unit-session-canary', 'unit@example.invalid', actorId, tenantId]) assert.ok(!serialized.includes(secret));
  assert.equal(result.historical403Origin, 'NOT_PROVEN_RESPONSE_BODY_NOT_RETAINED');
});

test('canonical DB role/status override permissive JWT metadata; inactive tenant is reported without changing authority', async () => {
  for (const [input, failure] of [
    [{ role: 'admin' }, 'ROLE_NOT_ACCOUNTANT'],
    [{ status: 'inactive' }, 'ACTOR_NOT_ACTIVE'],
    [{ tenantStatus: 'suspended' }, 'TENANT_NOT_ACTIVE'],
  ]) {
    const { client } = identityClient(input);
    const result = await inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid');
    assert.deepEqual(result.failures, [failure]);
  }
});

test('RLS-hidden or denied self/tenant rows remain unavailable, not fabricated identities or nonexistent records', async () => {
  for (const input of [{ profileMissing: true }, { profileError: { code: '42501', message: 'secret-canary' } }]) {
    const { client, queries } = identityClient(input);
    const result = await inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid');
    assert.deepEqual(result.failures, ['PROFILE_NOT_VISIBLE_OR_READ_DENIED']);
    assert.equal(queries.length, 1);
    assert.ok(!JSON.stringify(result).includes('secret-canary'));
  }
  for (const input of [{ tenantMissing: true }, { tenantError: { code: 'secret-canary', message: 'secret-canary' } }]) {
    const { client } = identityClient(input);
    const result = await inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid');
    assert.deepEqual(result.failures, ['TENANT_NOT_VISIBLE_OR_READ_DENIED']);
    assert.ok(!JSON.stringify(result).includes('secret-canary'));
  }
});

test('diagnosis rejects mismatched Auth/configured identity and profile binding before any broader read', async () => {
  for (const input of [{ authError: true }, { foreignProfile: true }]) {
    const { client, queries } = identityClient(input);
    await assert.rejects(inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid'));
    assert.ok(queries.length <= 1);
  }
  const { client, queries } = identityClient();
  await assert.rejects(inspectOwnIdentity(client, 'unit-session-canary', 'different@example.invalid'));
  assert.equal(queries.length, 0);
});

test('diagnostic captures only the public key synchronously, never the browser response body or raw session', () => {
  const response = {
    url: () => 'https://lvnvkpyxtuilhrabtlwv.supabase.co/auth/v1/token?grant_type=password',
    status: () => 200,
    json: () => { throw new Error('MUST_NOT_READ_RESPONSE_BODY'); },
    request: () => ({ method: () => 'POST', headers: () => ({ apikey: 'unit-public-key' }) }),
  };
  assert.deepEqual(captureDiagnosticPublicKey(response), { publicKey: 'unit-public-key' });
  for (const override of [{ url: () => 'https://other.invalid/auth/v1/token' },
    { url: () => 'https://lvnvkpyxtuilhrabtlwv.supabase.co/auth/v1/token?grant_type=refresh_token' },
    { request: () => ({ method: () => 'OPTIONS' }) },
    { status: () => 403 }, { request: () => { throw new Error('private-canary'); } }]) {
    const result = captureDiagnosticPublicKey({ ...response, ...override });
    assert.deepEqual(result, { failure: 'LOGIN_RESPONSE_CAPTURE_UNAVAILABLE' });
    assert.ok(!JSON.stringify(result).includes('private-canary'));
  }
});

function diagnosticCookies(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -600 : 3600);
  const token = `e30.${Buffer.from(JSON.stringify({ sub: actorId, exp })).toString('base64url')}.unit`;
  const session = { access_token: token, refresh_token: 'unit-refresh-canary', token_type: 'bearer',
    expires_at: exp, expires_in: 3600, user: { id: actorId, email: 'unit@example.invalid' } };
  return [{ name: 'sb-lvnvkpyxtuilhrabtlwv-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}` }];
}

test('canonical SSR diagnostic uses existing cookies and real Auth verification before own-profile reads', async () => {
  const requests = [];
  const client = createDiagnosticReadClient('unit-public-key', diagnosticCookies(), async (input, init) => {
    const url = new URL(input);
    requests.push({ path: url.pathname, method: init?.method || 'GET', query: url.searchParams });
    const body = url.pathname === '/auth/v1/user' ? { id: actorId, email: 'unit@example.invalid' }
      : url.pathname === '/rest/v1/users' ? [{ id: actorId, tenant_id: tenantId, role: 'admin', status: 'active' }]
        : [{ id: tenantId, status: 'active', product_key: 'bella_hq' }];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const result = await inspectOwnIdentity(client, undefined, 'unit@example.invalid');
  assert.deepEqual(result.failures, ['ROLE_NOT_ACCOUNTANT']);
  assert.deepEqual(requests.map(({ path, method }) => ({ path, method })), [
    { path: '/auth/v1/user', method: 'GET' }, { path: '/rest/v1/users', method: 'GET' }, { path: '/rest/v1/tenants', method: 'GET' },
  ]);
  assert.equal(requests[1].query.get('id'), `eq.${actorId}`);
  assert.equal(requests[2].query.get('id'), `eq.${tenantId}`);
  assert.ok(!JSON.stringify(result).includes('unit-refresh-canary'));
});

test('SSR diagnostic forbids token refresh or any write before network transport', async () => {
  const requests = [];
  const cookies = diagnosticCookies(true);
  const original = structuredClone(cookies);
  const client = createDiagnosticReadClient('unit-public-key', cookies, async input => {
    requests.push(String(input));
    throw new Error('SHOULD_NOT_REACH_NETWORK');
  });
  await assert.rejects(inspectOwnIdentity(client, undefined, 'unit@example.invalid'));
  assert.equal(requests.length, 0);
  assert.deepEqual(cookies, original);
  assert.throws(() => createDiagnosticReadClient('unit-public-key', []), /AUTH_COOKIE_MISSING/);
});

test('diagnostic failure substep identifies the boundary without raw Auth or profile errors', async () => {
  const stages = [];
  const { client } = identityClient({ foreignProfile: true });
  await assert.rejects(inspectOwnIdentity(client, 'unit-session-canary', 'unit@example.invalid', stage => stages.push(stage)));
  assert.deepEqual(stages, ['VERIFY_AUTH_SUBJECT', 'VERIFY_AUTH_SUBJECT_BINDING', 'READ_SELF_PROFILE', 'VERIFY_PROFILE_BINDING']);
});

test('reused login settles the page before credentials and waits for the real redirect', async () => {
  const { loginWithConfiguredCredentials } = await import('../e2e/fixtures/auth.ts');
  const calls = [];
  const page = {
    goto: async () => calls.push('goto'),
    waitForLoadState: async () => calls.push('settle'),
    locator: selector => ({
      fill: async () => calls.push(selector === 'input[type="email"]' ? 'email' : 'password'),
      click: async () => calls.push('submit'),
    }),
    waitForURL: async () => calls.push('redirect'),
  };
  await loginWithConfiguredCredentials(page, { email: 'unit@example.invalid', password: 'unit-only' });
  assert.deepEqual(calls, ['goto', 'settle', 'email', 'password', 'submit', 'redirect', 'settle']);
});
test('reused login fails on MFA or unsuccessful Auth without dev-cookie fallback', async () => {
  const { loginWithConfiguredCredentials } = await import('../e2e/fixtures/auth.ts');
  for (const body of ['Xác minh 2 lớp bảo mật', 'Invalid login credentials']) {
    const page = {
      goto: async () => {}, waitForLoadState: async () => {},
      locator: () => ({ fill: async () => {}, click: async () => {}, innerText: async () => body }),
      waitForURL: async () => { throw new Error('unit redirect denied'); },
    };
    await assert.rejects(loginWithConfiguredCredentials(page, { email: 'unit@example.invalid', password: 'unit-only' }),
      body.includes('2 lớp') ? /requires MFA/ : /real-auth login did not reach/);
  }
});
