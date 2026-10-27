const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const net = require('node:net');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '../../..');
const configured = parseEnv(fs.readFileSync(process.argv[2], 'utf8'));
const env = { ...process.env, NODE_ENV: 'production', DEPLOYMENT_ENV: 'staging', NEXT_TELEMETRY_DISABLED: '1' };
for (const [key, value] of Object.entries(configured)) {
  if (/^(NEXT_PUBLIC_SUPABASE_|SUPABASE_)/.test(key)) env[key] = value;
}
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname !== 'bmnbqbcdbuklhopfbopv.supabase.co') {
  throw new Error('E2E_CONFIG_REQUIRED');
}
const port = 3127;
const origin = `http://127.0.0.1:${port}`;
const isListening = () => new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  if (await isListening()) throw new Error('PORT_ALREADY_IN_USE');
  const startedUtc = new Date().toISOString();
  const stdout = fs.openSync(path.join(__dirname, 'runtime.stdout.log'), 'w');
  const stderr = fs.openSync(path.join(__dirname, 'runtime.stderr.log'), 'w');
  const server = cp.spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '--hostname', '127.0.0.1'], {
    cwd: root, env, stdio: ['ignore', stdout, stderr], windowsHide: true,
  });
  const serverExit = new Promise(resolve => server.once('exit', (code, signal) => resolve({ code, signal })));
  const results = [];
  let executionError = null;
  let exit = null;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (server.exitCode !== null) throw new Error('SERVER_EXITED_BEFORE_READY');
      if (await isListening()) { ready = true; break; }
      await delay(1000);
    }
    if (!ready) throw new Error('SERVER_READY_TIMEOUT');
    for (const [route, expected] of [
      ['/login', 200], ['/dashboard', 307],
      ['/api/education/care/classes', 401], ['/api/education/finance', 401],
    ]) {
      const response = await fetch(origin + route, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const location = response.headers.get('location');
      const securityHeaders = {
        contentTypeOptions: response.headers.get('x-content-type-options'),
        frameOptions: response.headers.get('x-frame-options'),
        hasCsp: !!response.headers.get('content-security-policy'),
      };
      const body = await response.text();
      const matches = response.status === expected
        && (route !== '/dashboard' || (location && new URL(location, origin).pathname === '/login'))
        && (route !== '/login' || securityHeaders.contentTypeOptions === 'nosniff');
      results.push({ route, method: 'GET', expected, actual: response.status, location,
        securityHeaders, responseBytes: Buffer.byteLength(body), bodyRetained: false, result: matches ? 'PASS' : 'FAIL' });
    }
  } catch (error) {
    executionError = error.cause?.code || error.message;
  } finally {
    if (server.exitCode === null) server.kill();
    exit = await serverExit;
    fs.closeSync(stdout);
    fs.closeSync(stderr);
    for (const name of ['runtime.stdout.log', 'runtime.stderr.log']) {
      let contents = fs.readFileSync(path.join(__dirname, name), 'utf8');
      for (const [key, value] of Object.entries(configured)) {
        if (/(KEY|SECRET|TOKEN|PASSWORD|DB_URL)/.test(key) && value.length > 8) contents = contents.split(value).join('[REDACTED]');
      }
      fs.writeFileSync(path.join(__dirname, name), contents);
    }
  }
  const portReleased = !(await isListening());
  const report = {
    command: 'node docs/audits/platform-risk-20261027/runtime-smoke.cjs <existing E2E env file>',
    sourceRevision: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    startedUtc, endedUtc: new Date().toISOString(), environment: 'Local production build with process-only E2E Supabase config',
    serverPid: server.pid, serverExit: exit, portReleased, executionError, results,
    result: !executionError && portReleased && results.length === 4 && results.every(r => r.result === 'PASS') ? 'PASS' : 'FAIL',
    scope: 'Unauthenticated HTTP render/denial only. Not Browser E2E, business mutation, or Product Go-Live evidence.',
  };
  fs.writeFileSync(path.join(__dirname, 'runtime-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.result === 'PASS' ? 0 : 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
