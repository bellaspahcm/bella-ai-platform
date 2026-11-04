'use strict';
// Owner-authorized account provisioning and read-only application smoke.
// Credentials and browser sessions remain in this process; no storageState,
// screenshots, HTML, passwords, JWTs or bypass secrets are written to evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline');
const root = 'D:/CodexWorktrees/preschool-sealed-release-20261102/BELLA SPA ERP';
const req = createRequire(root + '/package.json');
const evidence = __dirname;
const projectId = 'prj_Rgncynqz8ptznREGggMxPfjwoikW';
const tenantId = '00000000-0000-0000-0000-000000000001';
const email = 'phuckhangdigital@gmail.com';
const password = crypto.randomBytes(36).toString('base64url');
const env = req('dotenv').parse(fs.readFileSync('D:/Antigravity/Projects/BELLA SPA ERP/.env.local'));
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'lvnvkpyxtuilhrabtlwv.supabase.co') throw Error('PROJECT_MISMATCH');
const admin = req('@supabase/supabase-js').createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function api(endpoint) {
  const r = spawnSync(process.execPath, ['C:/Users/DELL/AppData/Roaming/npm/node_modules/vercel/dist/vc.js', 'api', endpoint, '--scope', 'bella-spa-s-projects', '--raw', '--no-color'], { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (r.status !== 0) throw Error('VERCEL_READ_FAILED');
  return JSON.parse(r.stdout);
}
async function smoke(deployment, sha, tag) {
  if (!/^[a-zA-Z0-9.-]+$/.test(deployment) || !/^[0-9a-f]{40}$/.test(sha) || !/^[a-z0-9-]+$/.test(tag)) throw Error('BAD_SMOKE_TARGET');
  const dep = api('/v13/deployments/' + deployment);
  if (dep.projectId !== projectId || dep.meta?.githubCommitSha !== sha || dep.readyState !== 'READY') throw Error('DEPLOYMENT_PROVENANCE_MISMATCH');
  const project = api('/v9/projects/' + projectId);
  const bypass = Object.keys(project.protectionBypass || {}).find(key => project.protectionBypass[key].scope === 'automation-bypass');
  if (!bypass) throw Error('EXISTING_BYPASS_MISSING');
  const origin = 'https://' + dep.url;
  const checks = [];
  for (const suffix of ['care', 'attendance', 'tuition']) {
    const response = await fetch(origin + '/api/education/portal/release-invalid-signature/' + suffix, { headers: { 'x-vercel-protection-bypass': bypass }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const body = await response.json().catch(() => ({}));
    checks.push({ name: suffix + ' invalid-token denial', status: response.status, code: typeof body.error === 'string' ? body.error : 'NOT_APP_ERROR', pass: response.status === 401 && body.error === 'TOKEN_INVALID' });
  }
  const health = await fetch(origin + '/api/health', { headers: { 'x-vercel-protection-bypass': bypass }, signal: AbortSignal.timeout(30000) });
  const healthBody = await health.json().catch(() => ({}));
  checks.push({ name: 'constant Supabase health probe', status: health.status, applicationStatus: healthBody.status, database: healthBody.checks?.database, pass: health.status === 200 && healthBody.status === 'healthy' && healthBody.checks?.database === 'ok' });

  const { chromium } = req('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  try {
    await context.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) {
        return route.continue({ headers: { ...request.headers(), 'x-vercel-protection-bypass': bypass } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin + '/login', { waitUntil: 'load', timeout: 45000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 45000 });
    checks.push({ name: 'real browser login', pass: true });
    // Use the exact existing release smoke's route/content criteria. Keep all
    // customer/page text transient, unlike its diagnostic artifact collectors.
    const source = fs.readFileSync(path.join(root, 'e2e/tests/12-authenticated-core-routes-smoke.spec.ts'), 'utf8');
    const match = source.match(/const coreRoutes: CoreRoute\[\] = (\[[\s\S]*?\n\]);/);
    if (!match) throw Error('SMOKE_ROUTE_CONTRACT_DRIFT');
    const routes = require('node:vm').runInNewContext(match[1]);
    routes.push({ name: 'preschool-care', path: '/dashboard/education/care', content: /cham soc|nhat ky|care/i });
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    for (const item of routes) {
      const errors = [];
      const onError = () => errors.push('pageerror');
      const onConsole = message => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (/TypeError: Failed to fetch/i.test(text) || /vercel\.live\/_next-live\/feedback\/feedback\.js.*Content Security Policy/i.test(text)) return;
        errors.push('console.error');
      };
      const onFailed = request => {
        if (!['document', 'fetch', 'xhr', 'script'].includes(request.resourceType()) || new URL(request.url()).origin !== origin) return;
        if (request.resourceType() === 'fetch' && request.failure()?.errorText === 'net::ERR_ABORTED') return;
        errors.push('requestfailed');
      };
      page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onFailed);
      let status = 0, content = false, routeMatches = false, appError = false;
      try {
        const response = await page.goto(origin + item.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        status = response?.status() || 0;
        await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
        const end = Date.now() + 18000;
        while (Date.now() < end) {
          if (item.content.test(normalize(await page.locator('body').innerText({ timeout: 5000 })))) { content = true; break; }
          await page.waitForTimeout(400);
        }
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        routeMatches = new URL(page.url()).pathname.startsWith(item.path);
        appError = /application error|an error occurred in the server components render|digest property is included|permission denied for table|this page could not be found|unhandled runtime error/i.test(normalize(await page.locator('body').innerText({ timeout: 8000 })));
      } catch { errors.push('navigation_or_render_failure'); }
      page.off('pageerror', onError); page.off('console', onConsole); page.off('requestfailed', onFailed);
      checks.push({ name: item.name, path: item.path, status, content, routeMatches, appError, runtimeErrorCount: errors.length, pass: status > 0 && status < 400 && content && routeMatches && !appError && errors.length === 0 });
    }
  } catch (error) {
    checks.push({ name: 'authenticated browser execution', pass: false, code: /^[A-Z_]+$/.test(error.message) ? error.message : 'LOGIN_OR_BROWSER_FAILED' });
  } finally { await context.close(); await browser.close(); }
  const result = { at: new Date().toISOString(), deployment: dep.id, url: origin, sha, target: dep.target, checks, passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, limits: 'Read-only route/guard smoke; no child records, CRUD or Product end-to-end claim. No browser artifacts or credential storage.' };
  fs.writeFileSync(path.join(evidence, 'sealed-release-20261102-' + tag + '-smoke.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
(async () => {
  const tenant = await admin.from('tenants').select('id,product_key').eq('id', tenantId).single();
  if (tenant.error || tenant.data.product_key !== 'bella_preschool') throw Error('TENANT_CONTRACT_MISMATCH');
  const existing = await admin.from('users').select('id').eq('email', email);
  if (existing.error || existing.data.length) throw Error('ACCOUNT_EXISTS_NO_OVERWRITE');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Preschool Release Smoke' } });
  if (created.error || !created.data.user) throw Error('AUTH_CREATE_FAILED_' + (created.error?.code || 'UNKNOWN'));
  const id = created.data.user.id;
  const profile = await admin.from('users').select('id').eq('id', id).maybeSingle();
  if (profile.error) throw Error('NEW_PROFILE_LOOKUP_FAILED');
  const payload = { email, full_name: 'Preschool Release Smoke', role: 'admin', tenant_id: tenantId, status: 'active' };
  const saved = profile.data ? await admin.from('users').update(payload).eq('id', id).select('id,role,tenant_id,status').single() : await admin.from('users').insert({ id, ...payload }).select('id,role,tenant_id,status').single();
  if (saved.error || saved.data.role !== 'admin' || saved.data.tenant_id !== tenantId) throw Error('NEW_PROFILE_PROVISION_FAILED');
  const receipt = { at: new Date().toISOString(), project: 'lvnvkpyxtuilhrabtlwv', id, email, tenantId, tenant: 'Bella Preschool Tenant A', role: saved.data.role, status: saved.data.status, authCreated: true, profileReadBack: true, credentialsPersisted: false, scope: 'Owner-authorized single smoke account only; no business rows, roles, schema or permissions modified' };
  fs.writeFileSync(path.join(evidence, 'sealed-release-20261102-account.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ state: 'ACCOUNT_READY', ...receipt }));
  for await (const line of readline.createInterface({ input: process.stdin })) {
    if (line.trim() === 'EXIT') break;
    try { const command = JSON.parse(line); if (command.action !== 'smoke') throw Error('UNKNOWN_ACTION'); await smoke(command.deployment, command.sha, command.tag); }
    catch (error) { console.log(JSON.stringify({ state: 'SMOKE_FAILED', code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'UNCLASSIFIED_FAILURE' })); }
  }
})().catch(error => { console.log(JSON.stringify({ state: 'ACCOUNT_FAILED', code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'UNCLASSIFIED_FAILURE' })); process.exitCode = 1; });
