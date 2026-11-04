const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), net = require('node:net');
const mode = process.argv[2];
const configs = {
  care: { name: 'preschool-care-authorization-20261021', folder: 'batch2g-care-auth', routes: [
    ['GET', '/api/education/care/bulk?courseId=synthetic&date=2026-10-21', 'CARE_UNAUTHENTICATED'],
    ['POST', '/api/education/care/bulk', 'CARE_UNAUTHENTICATED'],
  ] },
  portal: { name: 'preschool-parent-access-20261021', folder: 'batch2h-parent-access', routes: [
    ['POST', '/api/education/portal/token', 'PORTAL_UNAUTHENTICATED'],
    ['GET', '/api/education/portal/invalid', 'TOKEN_MALFORMED'],
    ['POST', '/api/education/portal/invalid/chat', 'TOKEN_MALFORMED'],
    ['POST', '/api/education/portal/invalid/copilot', 'TOKEN_MALFORMED'],
  ] },
  announcements: { name: 'preschool-announcement-auth-20261021', folder: 'batch2i-announcements', routes: [
    ['POST', '/api/education/announcements', 'ANNOUNCEMENT_UNAUTHENTICATED'],
  ] },
};
const config = configs[mode]; if (!config) throw Error('Unknown scope');
const root = path.join('C:/Users/DELL/.codex/worktrees', config.name, 'BELLA SPA ERP');
const folder = path.join(root, 'docs/audits/preschool-full-audit-20261020', config.folder);
const env = { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_URL: 'http://127.0.0.1:1',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-offline-anon-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-offline-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-offline-service-key', SUPABASE_SECRET_KEY: 'synthetic-offline-service-key', NEXTAUTH_SECRET: 'synthetic-offline-signing-key',
  GEMINI_API_KEY: '', GOOGLE_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' };
for (const key of Object.keys(env)) if (/(?:DATABASE|SUPABASE_DB|POSTGRES|E2E_SUPABASE_DB).*URL|DB_PASSWORD/.test(key)) env[key] = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function isOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const done = open => { socket.destroy(); resolve(open); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.setTimeout(1000, () => done(true));
  });
}
async function main() {
  const report = { mode, startedAt: new Date().toISOString(), source: 'Uncommitted isolated branch from30134055d',
    environment: 'Local Next16.3.8 development webpack with offline loopback DB/synthetic keys; no real Auth/DB/model calls',
    cacheCriterion: 'Effective Cache-Control has no-store and lacks public; dev runtime can rewrite the exact application string', tests: [] };
  const before = cp.spawnSync('git', ['diff', 'HEAD', '--exit-code', '--', 'AGENTS.md'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (before.status !== 0) throw Error('AGENTS_NOT_CLEAN_BEFORE_DEV');
  report.initialAgentsClean = true;
  const port = await freePort();
  const server = cp.spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  report.serverPid = server.pid; report.port = port; let output = '';
  server.stdout.on('data', bytes => { output += bytes; }); server.stderr.on('data', bytes => { output += bytes; });
  server.on('error', error => { report.serverError = error.code; });
  try {
    for (let index = 0; index < 60 && !/Ready in/.test(output); index++) {
      if (server.exitCode !== null || report.serverError) throw Error('SERVER_EXITED'); await pause(1000);
    }
    if (!/Ready in/.test(output)) throw Error('SERVER_NOT_READY');
    for (const [method, route, code] of config.routes) for (const spoof of [false, true]) {
      const separator = route.includes('?') ? '&' : '?';
      const headers = { 'Content-Type': 'application/json' };
      if (spoof) Object.assign(headers, { 'x-mock-role': 'SUPER_ADMIN', 'x-mock-user-email': 'synthetic@example.invalid', Cookie: 'mock_user_email=synthetic@example.invalid' });
      const response = await fetch('http://127.0.0.1:' + port + route + (spoof ? separator + 'tenantId=foreign&tenantId=other' : ''), {
        method, headers, ...(method === 'POST' ? { body: '{malformed' } : {}), signal: AbortSignal.timeout(45000),
      });
      const json = await response.json().catch(() => null), cache = response.headers.get('cache-control');
      const directives = (cache || '').toLowerCase().split(',').map(value => value.trim());
      const noStore = directives.includes('no-store') && !directives.includes('public');
      report.tests.push({ method, route, spoof, status: response.status, code: json?.error ?? null, cacheControl: cache,
        result: response.status === 401 && json?.error === code && noStore ? 'PASS' : 'FAIL' });
    }
  } catch (error) { report.errorType = error.name; report.errorCode = error.message; }
  finally {
    const stop = cp.spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
    report.stopExitCode = stop.status; await pause(750); report.listenerStopped = !await isOpen(port);
    // Next dev appends generated instructions. Preserve the exact delta and restore ONLY this known-clean file.
    const generated = cp.spawnSync('git', ['diff', '--', 'AGENTS.md'], { cwd: root, encoding: 'utf8', windowsHide: true });
    fs.writeFileSync(path.join(folder, 'next-generated-agents.patch'), generated.stdout || '');
    // Restoration is performed by the lead after inspecting the captured delta.
    report.agentsRestoration = 'PENDING_LEAD_INSPECTION';
    report.result = report.tests.length === config.routes.length * 2 && report.tests.every(test => test.result === 'PASS') && report.listenerStopped ? 'PASS' : 'FAIL';
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(folder, 'local-http.log'), output);
    fs.writeFileSync(path.join(folder, 'local-http.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report)); if (report.result !== 'PASS') process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.name + ':LOCAL_HTTP_FAILED'); process.exitCode = 1; });
