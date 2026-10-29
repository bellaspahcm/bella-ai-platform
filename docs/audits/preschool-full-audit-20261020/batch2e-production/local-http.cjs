const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), net = require('node:net');
const mode = process.argv[2];
const config = {
  copilot: { root: 'C:/Users/DELL/.codex/worktrees/preschool-courses-auth-20261021/BELLA SPA ERP',
    folder: 'batch2e-ai-auth', route: '/api/education/ai/copilot', status: 401, code: 'COPILOT_UNAUTHENTICATED' },
  medication: { root: 'C:/Users/DELL/.codex/worktrees/shared-identity-containment-20261021/BELLA SPA ERP',
    folder: 'batch2f-disable-medication', route: '/api/education/care/medication', status: 410, code: 'PRESCHOOL_MEDICATION_DISABLED' },
}[mode];
if (!config) throw Error('Unknown local HTTP scope');
const folder = path.join(config.root, 'docs/audits/preschool-full-audit-20261020', config.folder);
for (const name of ['local-http.json', 'local-http.log']) {
  const previous = path.join(folder, name), archive = path.join(folder, name.replace('local-http', 'local-http-turbopack-attempt1'));
  if (fs.existsSync(previous) && !fs.existsSync(archive)) fs.copyFileSync(previous, archive);
}
for (const name of ['local-http.json', 'local-http.log']) {
  const previous = path.join(folder, name), archive = path.join(folder, name.replace('local-http', 'local-http-webpack-junction-attempt2'));
  if (fs.existsSync(previous) && !fs.existsSync(archive)) fs.copyFileSync(previous, archive);
}
for (const name of ['local-http.json', 'local-http.log']) {
  const previous = path.join(folder, name), archive = path.join(folder, name.replace('local-http', 'local-http-webpack-preserved-links-attempt4'));
  if (fs.existsSync(previous) && !fs.existsSync(archive)) fs.copyFileSync(previous, archive);
}
const env = { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key',
  GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '',
};
for (const key of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(key)) env[key] = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const done = open => { socket.destroy(); resolve(open); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(1000, () => done(true));
  });
}
async function main() {
  const report = { checkedAt: new Date().toISOString(), mode, source: 'Uncommitted bounded source patch on isolated branch from30134055d',
    environment: 'Local Next development runtime with webpack, loopback offline DB and synthetic keys',
    nextVersion: JSON.parse(fs.readFileSync(path.join(config.root, 'node_modules/next/package.json'))).version,
    productionMutation: 'NOT_PERFORMED', modelCalls: 'NOT_PERFORMED', realAuthSession: false, tests: [] };
  const port = await freePort();
  const server = cp.spawn(process.execPath, [path.join(config.root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: config.root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  report.serverPid = server.pid; report.port = port;
  let output = '';
  server.stdout.on('data', bytes => { output += bytes; }); server.stderr.on('data', bytes => { output += bytes; });
  server.on('error', error => { report.serverError = error.code; });
  try {
    let ready = false;
    for (let index = 0; index < 60; index++) {
      if (server.exitCode !== null || report.serverError) break;
      if (/Ready in/.test(output)) { ready = true; break; }
      await pause(1000);
    }
    if (!ready) throw Error('SERVER_NOT_READY');
    const probes = [
      ['anonymous', '', {}, JSON.stringify({ action: 'invalid_action' })],
      ['forgedRoleAndTenant', '?tenantId=00000000-0000-4000-8000-000000000099', {
        'x-mock-role': 'SUPER_ADMIN', 'x-mock-user-email': 'synthetic@example.invalid', Cookie: 'mock_user_email=synthetic@example.invalid',
      }, JSON.stringify({ action: 'invalid_action' })],
      ['conflictingTenantSelectors', '?tenantId=00000000-0000-4000-8000-000000000011&tenantId=00000000-0000-4000-8000-000000000099',
        { 'x-mock-role': 'CAMPUS_ADMIN' }, '{}'],
      ['malformedPayload', '', {}, '{'],
    ];
    for (const [name, query, headers, body] of probes) {
      const response = await fetch('http://127.0.0.1:' + port + config.route + query, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body, signal: AbortSignal.timeout(45000),
      });
      const json = await response.json().catch(() => null);
      const cache = response.headers.get('cache-control');
      report.tests.push({ name, status: response.status, code: json?.error || null, cacheControl: cache,
        result: response.status === config.status && json?.error === config.code && cache === 'private, no-store' ? 'PASS' : 'FAIL' });
    }
  } catch (error) { report.errorType = error.name; report.errorCode = error.message; }
  finally {
    const stop = cp.spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
    report.stopExitCode = stop.status;
    await pause(750);
    report.listenerStopped = !await portOpen(port);
    report.result = report.tests.length === 4 && report.tests.every(test => test.result === 'PASS') && report.listenerStopped ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(folder, 'local-http.log'), output);
    fs.writeFileSync(path.join(folder, 'local-http.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (report.result !== 'PASS') process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.name + ':LOCAL_HTTP_FAILED'); process.exitCode = 1; });
