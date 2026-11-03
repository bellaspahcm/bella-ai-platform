'use strict';
// Local-only, disposable-profile browser test. Credentials are never logged.
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { randomBytes: makeSocketKey } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('@playwright/test');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const container = 'supabase_db_bella-preschool-532b3b8a';
const tenant = 'a0000000-0000-4000-8000-8ac103f865e8';
const profile = 'C:/Users/DELL/AppData/Local/Bella/Preschool/DisposableProfiles/bella-preschool-532b3b8a';
const cli = 'C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('LOCAL_DATABASE_COMMAND_FAILED');
  return r.stdout.trim();
}
function sql(input) { return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], input); }
function probeWebSocket(url) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const target = new URL(url);
    const socket = new WebSocket(url, { origin: `http://${target.host}` });
    const timer = setTimeout(() => { socket.terminate(); finish({ result: 'TIMEOUT' }); }, 3000);
    socket.once('open', () => { socket.close(); finish({ result: 'UPGRADED' }); });
    socket.once('unexpected-response', (_request, response) => {
      const contentType = response.headers['content-type'] ?? '';
      response.resume();
      finish({ result: 'REJECTED', status: response.statusCode, contentType });
    });
    socket.once('error', error => finish({ result: 'ERROR', code: error.code ?? 'UNKNOWN' }));
  });
}
function probeRawHandshake(url) {
  return new Promise(resolve => {
    const target = new URL(url);
    const socket = net.createConnection({ host: target.hostname, port: Number(target.port) });
    let data = Buffer.alloc(0);
    const timer = setTimeout(() => { socket.destroy(); resolve('TIMEOUT'); }, 2000);
    socket.once('connect', () => socket.write([
      `GET ${target.pathname}${target.search} HTTP/1.1`,
      `Host: ${target.host}`,
      'Connection: Upgrade', 'Upgrade: websocket',
      `Sec-WebSocket-Key: ${makeSocketKey(16).toString('base64')}`,
      'Sec-WebSocket-Version: 13', `Origin: http://${target.host}`, '', '',
    ].join('\r\n')));
    socket.on('data', chunk => {
      data = Buffer.concat([data, chunk]);
      const line = data.toString('latin1').split('\r\n', 1)[0].replace(/id=[^&\s]+/g, 'id=[REDACTED]').replace(/[^\x20-\x7E]/g, '.');
      clearTimeout(timer); socket.destroy(); resolve(line.slice(0, 120));
    });
    socket.once('error', error => { clearTimeout(timer); resolve(`ERROR:${error.code ?? 'UNKNOWN'}`); });
  });
}
async function cleanupStaleBrowserFixtures(admin, tenant) {
  const rows = sql(`SELECT id || '|' || email FROM public.users WHERE tenant_id='${tenant}' AND full_name='F09 browser fixture' AND email LIKE 'f09-browser-%@example.invalid';`)
    .split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [id, email] = row.split('|');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^f09-browser-[0-9a-f-]{36}@example\.invalid$/i.test(email ?? '')) throw new Error('STALE_FIXTURE_SCOPE_REJECTED');
    sql(`BEGIN; DELETE FROM public.edu_weekly_menu_days WHERE tenant_id='${tenant}' AND menu_id IN (SELECT id FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND created_by='${id}' AND title IN ('F09 browser fixture','F09 browser edited')); DELETE FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND created_by='${id}' AND title IN ('F09 browser fixture','F09 browser edited'); DELETE FROM public.users WHERE id='${id}' AND tenant_id='${tenant}' AND full_name='F09 browser fixture' AND email='${email}'; COMMIT;`);
    const authUser = await admin.auth.admin.getUserById(id);
    if (authUser.data.user && (await admin.auth.admin.deleteUser(id)).error) throw new Error('STALE_AUTH_FIXTURE_CLEANUP_FAILED');
  }
  console.log(rows.length ? 'PASS STALE_BROWSER_FIXTURE_CLEANUP' : 'PASS NO_STALE_BROWSER_FIXTURE');
}
async function main() {
  if (docker(['inspect', container, '--format', '{{.Id}}']) !== 'e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45') throw new Error('LOCAL_CONTAINER_MISMATCH');
  const status = spawnSync(process.execPath, [cli, 'status', '--workdir', profile, '--output', 'json'], { encoding: 'utf8', windowsHide: true });
  if (status.status !== 0) throw new Error('LOCAL_STATUS_FAILED');
  const cfg = JSON.parse(status.stdout);
  if (cfg.API_URL !== 'http://127.0.0.1:32314') throw new Error('LOCAL_API_MISMATCH');
  const check = await fetch('http://127.0.0.1:3002', { signal: AbortSignal.timeout(1500) }).then(() => true).catch(() => false);
  if (check) throw new Error('LOCAL_PORT_OCCUPIED');
  const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `f09-browser-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('hex');
  let userId; let menuId; let server; let browser; let cleanupFailed = false;
  try {
    await cleanupStaleBrowserFixtures(admin, tenant);
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('AUTH_CREATE_FAILED');
    userId = created.data.user.id;
    sql(`INSERT INTO public.users(id,email,full_name,role,status,tenant_id) VALUES ('${userId}','${email}','F09 browser fixture','admin','active','${tenant}');`);
    const env = {};
    for (const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']) if (process.env[key]) env[key] = process.env[key];
    for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
      if (existsSync(file)) for (const key of Object.keys(dotenv.parse(readFileSync(file)))) env[key] = '';
    }
    Object.assign(env, { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: cfg.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: cfg.ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: cfg.ANON_KEY,
      SUPABASE_URL: cfg.API_URL, SUPABASE_SERVICE_ROLE_KEY: cfg.SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY: cfg.SERVICE_ROLE_KEY });
    // Match the repository's `npm run dev` bundler selection; on this Next 16
    // version that means the default Turbopack HMR path, not forced Webpack.
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3002'], { env, windowsHide: true, stdio: 'ignore' });
    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      ready = await fetch('http://127.0.0.1:3002/login', { signal: AbortSignal.timeout(10000) }).then(r => r.ok).catch(() => false);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!ready) throw new Error('LOCAL_APP_NOT_READY');
    console.log('PASS LOCAL_APP_READY');
    browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
    const page = await browser.newPage({ baseURL: 'http://localhost:3002', locale: 'vi-VN' });
    const diagnostics = { csp: 0, scriptFailures: 0, pageErrors: 0, consoleErrorMessages: [], nextAssetStatuses: [], hmrCreated: 0, hmrHandshakeStatus: null, hmrFailure: null, hmrUrl: null };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.webSocketCreated', event => { if (event.url.includes('/_next/hmr')) { diagnostics.hmrCreated++; diagnostics.hmrUrl = event.url; } });
    cdp.on('Network.webSocketHandshakeResponseReceived', event => {
      if (event.response?.url?.includes('/_next/hmr')) diagnostics.hmrHandshakeStatus = event.response.status;
    });
    cdp.on('Network.loadingFailed', event => {
      if (event.type === 'WebSocket' && event.errorText) diagnostics.hmrFailure = event.errorText;
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.hostname === '127.0.0.1' && url.port === '32314' && url.pathname === '/auth/v1/token') {
        console.log(`LOCAL_AUTH_TOKEN_HTTP ${response.status()}`);
      }
      if (['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '3002' && url.pathname.startsWith('/_next/') && response.status() >= 400) {
        console.log(`LOCAL_NEXT_ASSET_HTTP ${response.status()}`);
      }
      if (['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '3002' && url.pathname.startsWith('/_next/')) diagnostics.nextAssetStatuses.push(response.status());
    });
    page.on('pageerror', () => { diagnostics.pageErrors++; });
    page.on('console', message => { if (/content security policy|refused to execute/i.test(message.text())) diagnostics.csp++; });
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrorMessages.push(message.text().replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]').replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]').slice(0, 240));
    });
    page.on('requestfailed', request => { if (request.url().includes('/_next/')) diagnostics.scriptFailures++; });
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const dom = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('*')];
      const nextScripts = [...document.scripts].filter(script => script.src.includes('/_next/')).map(script => new URL(script.src).pathname);
      return {
        forms: document.forms.length,
        inputs: document.querySelectorAll('input').length,
        submitButtons: document.querySelectorAll('button[type="submit"]').length,
        nextScripts,
        reactPropsNodes: nodes.filter(node => Reflect.ownKeys(node).some(key => typeof key === 'string' && key.startsWith('__reactProps$'))).length,
        reactFiberNodes: nodes.filter(node => Reflect.ownKeys(node).some(key => typeof key === 'string' && key.startsWith('__reactFiber$'))).length,
      };
    });
    console.log('BROWSER_DOM_DIAGNOSTICS ' + JSON.stringify({ ...dom, assets: diagnostics.nextAssetStatuses.length, assetErrors: diagnostics.nextAssetStatuses.filter(status => status >= 400).length, csp: diagnostics.csp, pageErrors: diagnostics.pageErrors, consoleErrors: diagnostics.consoleErrorMessages, hmrCreated: diagnostics.hmrCreated, hmrHandshakeStatus: diagnostics.hmrHandshakeStatus, hmrFailure: diagnostics.hmrFailure }));
    if (diagnostics.hmrUrl) {
      const hmrProbe = await probeWebSocket(diagnostics.hmrUrl);
      console.log('BROWSER_HMR_NODE_PROBE ' + JSON.stringify(hmrProbe));
      if (hmrProbe.result !== 'UPGRADED') {
        console.log('BROWSER_HMR_RAW_RESPONSE ' + await probeRawHandshake(diagnostics.hmrUrl));
        throw new Error('BROWSER_HMR_HANDSHAKE_FAILED');
      }
    }
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    try { await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 45000 }); } catch {
      const body = await page.locator('body').innerText().catch(() => '');
      console.log('LOGIN_DIAGNOSTICS ' + JSON.stringify({
        invalidCredentials: /invalid login credentials/i.test(body),
        missingConfig: /Supabase chưa được cấu hình/i.test(body),
        mfa: /mã xác minh|2 lớp/i.test(body),
        failedFetch: /failed to fetch|network request failed/i.test(body),
      }));
      throw new Error('BROWSER_LOGIN_NOT_COMPLETED');
    }
    console.log('PASS BROWSER_REAL_AUTH_LOGIN');
    await page.goto('/dashboard/education/nutrition', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const open = page.getByRole('button', { name: /Tạo thực đơn tuần mới|Chỉnh sửa thực đơn tuần/ }).first();
    await open.waitFor({ state: 'visible', timeout: 45000 });
    await open.click();
    const title = page.getByPlaceholder('Ví dụ: Thực đơn tuần 44 — Đảm bảo dinh dưỡng học đường');
    await title.waitFor({ state: 'visible', timeout: 30000 });
    await title.fill('F09 browser fixture');
    const save = page.getByRole('button', { name: /Lưu dự thảo/ });
    const first = page.waitForResponse(r => r.url().includes('/api/education/nutrition/weekly-menu') && r.request().method() === 'POST');
    await save.click();
    const firstResponse = await first;
    const firstBody = await firstResponse.json();
    if (!firstResponse.ok() || !firstBody.success || !firstBody.menuId) {
      const reason = String(firstBody.errorCode ?? firstBody.error ?? firstBody.message ?? 'NO_ERROR_FIELD')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]').slice(0, 180);
      throw new Error(`BROWSER_CREATE_FAILED:${firstResponse.status()}:${reason}`);
    }
    menuId = firstBody.menuId;
    console.log('PASS BROWSER_CREATE');
    await page.getByRole('button', { name: 'Thêm thứ Bảy tùy chọn' }).click();
    await title.fill('F09 browser edited');
    const second = page.waitForResponse(r => r.url().includes('/api/education/nutrition/weekly-menu') && r.request().method() === 'POST');
    await save.click();
    const secondResponse = await second;
    if (!secondResponse.ok() || !(await secondResponse.json()).success) throw new Error('BROWSER_UPDATE_FAILED');
    console.log('PASS BROWSER_UPDATE');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('F09 browser edited', { exact: true }).first().waitFor({ state: 'visible', timeout: 45000 });
    console.log('PASS BROWSER_RELOAD');
    if (sql(`SELECT count(*) FROM public.edu_weekly_menus WHERE id='${menuId}' AND tenant_id='${tenant}' AND title='F09 browser edited';`) !== '1') throw new Error('BROWSER_DB_READBACK_FAILED');
    if (sql(`SELECT count(*) FROM public.edu_weekly_menu_days WHERE tenant_id='${tenant}' AND menu_id='${menuId}';`) !== '6') throw new Error('BROWSER_OPTIONAL_SATURDAY_READBACK_FAILED');
    console.log('PASS BROWSER_DB_READBACK_WITH_OPTIONAL_SATURDAY');
  } finally {
    if (browser) await browser.close();
    if (server?.pid) spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    if (userId) try { sql(`BEGIN; DELETE FROM public.edu_weekly_menu_days WHERE tenant_id='${tenant}' AND menu_id IN (SELECT id FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND (created_by='${userId}' OR id='${menuId ?? '00000000-0000-0000-0000-000000000000'}') AND title IN ('F09 browser fixture','F09 browser edited')); DELETE FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND (created_by='${userId}' OR id='${menuId ?? '00000000-0000-0000-0000-000000000000'}') AND title IN ('F09 browser fixture','F09 browser edited'); COMMIT;`); } catch { cleanupFailed = true; }
    if (userId) {
      try { sql(`DELETE FROM public.users WHERE id='${userId}' AND tenant_id='${tenant}' AND full_name='F09 browser fixture';`); } catch { cleanupFailed = true; }
      if ((await admin.auth.admin.deleteUser(userId)).error) cleanupFailed = true;
    }
    if (cleanupFailed) throw new Error('BROWSER_FIXTURE_CLEANUP_FAILED');
    console.log('PASS BROWSER_FIXTURE_CLEANUP');
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
