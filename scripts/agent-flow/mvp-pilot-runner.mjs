import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, lstatSync, mkdirSync, writeFileSync, openSync, closeSync, cpSync, rmSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer, connect as connectSocket } from 'node:net';
import { get } from 'node:http';
import { basename, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const pilotProject = 'bmnbqbcdbuklhopfbopv';
const safeError = code => Object.assign(new Error(code), { code });
const outside = path => { const child = relative(workspace, resolve(path)); return child === '..' || child.startsWith('../') || child.startsWith('..\\') || isAbsolute(child); };

// Next dev fetches optional version metadata during startup. Fail that one
// request locally so Next reports its real "unknown" version status without
// attempting registry egress. Product requests still use the policy proxy.
export function installPilotOfflineMetadataGuard(runtime = globalThis) {
  const fetch = runtime.fetch;
  runtime.fetch = function (input, init) {
    let versionMetadata = false;
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      versionMetadata = url.href === 'https://registry.npmjs.org/-/package/next/dist-tags' && method === 'GET';
    } catch { /* Preserve native fetch validation for every other input. */ }
    if (versionMetadata) {
      return Promise.reject(safeError('NEXT_VERSION_METADATA_OFFLINE'));
    }
    return fetch.call(runtime, input, init);
  };
}

export function pilotNextEnvironment(environment) {
  return { ...environment, FACTORY_MVP_NEXT_OFFLINE_METADATA: '1',
    NODE_OPTIONS: `--import=${import.meta.url}`, NEXT_IGNORE_INCORRECT_LOCKFILE: '1' };
}

// --import is inherited by Next's worker through its parsed NODE_OPTIONS.
// The runner itself and Playwright do not receive this flag or preload.
if (process.env.FACTORY_MVP_NEXT_OFFLINE_METADATA === '1') installPilotOfflineMetadataGuard();

// A single supervised Non-Production flow, not a caller-selected command runner.
export function pilotEnvironment(input, proxyEnvironment = process.env) {
  try {
    const api = new URL(input.NEXT_PUBLIC_SUPABASE_URL || '');
    if (api.href !== `https://${pilotProject}.supabase.co/`) throw Error();
    for (const key of ['SUPABASE_URL', 'E2E_SUPABASE_URL']) if (input[key] && new URL(input[key]).href !== api.href) throw Error();
    const urls = ['DB_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'AUTOMOVE_DATABASE_URL'].map(key => input[key]).filter(Boolean);
    if (!urls.length) throw Error();
    for (const text of urls) {
      const db = new URL(text), username = decodeURIComponent(db.username), port = Number(db.port || 5432);
      if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hash || db.pathname !== '/postgres' || !db.password ||
          !(db.hostname === `db.${pilotProject}.supabase.co` && port === 5432 ||
            /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname) && username.endsWith(`.${pilotProject}`) && [5432, 6543].includes(port))) throw Error();
      for (const [key, value] of db.searchParams) if (key !== 'sslmode' || value !== 'verify-full' || db.searchParams.getAll(key).length !== 1) throw Error();
    }
    const publicKey = input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || input.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!publicKey || !input.SUPABASE_SERVICE_ROLE_KEY) throw Error();
    const proxyText = proxyEnvironment.HTTPS_PROXY || proxyEnvironment.HTTP_PROXY;
    const proxy = new URL(proxyText || '');
    if (proxy.protocol !== 'http:' || !proxy.port || Number(proxy.port) < 1 || !['127.0.0.1', 'localhost', '[::1]'].includes(proxy.hostname) ||
        proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash) throw Error();
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY']) {
      if (proxyEnvironment[key] && new URL(proxyEnvironment[key]).href !== proxy.href) throw Error();
    }
    // Trust the supervised runtime's proxy CA files, never TLS overrides from
    // the product env file. Certificate verification remains enabled.
    const certificates = {};
    for (const key of ['NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE']) {
      const path = proxyEnvironment[key];
      if (!path) continue;
      if (!isAbsolute(path) || !statSync(path).isFile()) throw Error();
      certificates[key] = path;
    }
    const system = Object.fromEntries(['SystemDrive', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'PLAYWRIGHT_BROWSERS_PATH'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    return { ...system, NEXT_PUBLIC_SUPABASE_URL: api.href.replace(/\/$/, ''), SUPABASE_URL: api.href.replace(/\/$/, ''),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
      SUPABASE_SERVICE_ROLE_KEY: input.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY: input.SUPABASE_SERVICE_ROLE_KEY,
      DB_URL: urls[0], SUPABASE_DB_URL: urls[0], DATABASE_URL: urls[0], AUTOMOVE_DATABASE_URL: urls[0],
      ...certificates, HTTP_PROXY: proxy.href, HTTPS_PROXY: proxy.href, NODE_USE_ENV_PROXY: '1',
      FACTORY_MVP_NETWORK_MODE: proxyEnvironment.FACTORY_MVP_NETWORK_MODE || '',
      NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', USE_READ_REPLICA: 'false', CI: '1',
      SUPABASE_READ_REPLICA_URL: '', SUPABASE_READ_REPLICA_KEY: '' };
  } catch { throw safeError('ENVIRONMENT_NOT_READY'); }
}

async function freePort() {
  const server = createServer();
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const address = server.address();
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
  if (!address || typeof address === 'string') throw safeError('LOCAL_RUNTIME_UNAVAILABLE');
  return address.port;
}

// The owned local listener does not traverse the external policy proxy.
export async function localRuntimeReady(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  return new Promise(done => {
    const request = get({ hostname: '127.0.0.1', port, path: '/api/health', agent: false, timeout: 2000 }, response => {
      response.resume();
      done(response.statusCode >= 200 && response.statusCode < 300);
    });
    request.once('timeout', () => { request.destroy(); done(false); });
    request.once('error', () => done(false));
  });
}

// pg has no HTTP_PROXY support. Establish the policy tunnel before handing its
// socket to pg; pg still owns PostgreSQL SSL negotiation and vendor validation.
export async function openPilotDatabase(config, environment = process.env) {
  let socket, client;
  try {
    const proxy = new URL(environment.HTTPS_PROXY || environment.HTTP_PROXY || '');
    const host = config.host, port = Number(config.port);
    if (environment.FACTORY_MVP_NETWORK_MODE !== 'full' || proxy.protocol !== 'http:' || !proxy.port ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(proxy.hostname) || proxy.username || proxy.password ||
        proxy.pathname !== '/' || proxy.search || proxy.hash ||
        ['HTTP_PROXY', 'HTTPS_PROXY'].some(key => environment[key] && new URL(environment[key]).href !== proxy.href) ||
        config.database !== 'postgres' || config.connectionString || config.stream ||
        !(host === `db.${pilotProject}.supabase.co` && port === 5432 ||
          /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host || '') && config.user?.endsWith(`.${pilotProject}`) && [5432, 6543].includes(port)) ||
        config.ssl?.rejectUnauthorized !== true || config.ssl.servername !== host || !config.ssl.ca) throw Error();
    socket = await new Promise((done, fail) => {
      const tunnel = connectSocket(Number(proxy.port), proxy.hostname);
      let bytes = Buffer.alloc(0), settled = false;
      const finish = error => {
        if (settled) return; settled = true; clearTimeout(timer); tunnel.removeAllListeners();
        if (error) { tunnel.destroy(); fail(safeError('POLICY_DATABASE_TUNNEL_REJECTED')); }
        else { tunnel.pause(); done(tunnel); }
      };
      const timer = setTimeout(() => finish(true), 5000);
      tunnel.once('error', () => finish(true)); tunnel.once('end', () => finish(true));
      tunnel.once('connect', () => tunnel.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`));
      tunnel.on('data', chunk => {
        bytes = Buffer.concat([bytes, chunk]);
        if (bytes.length > 8192) return finish(true);
        const end = bytes.indexOf('\r\n\r\n');
        if (end < 0) return;
        const status = Number(/^HTTP\/1\.[01] (\d{3})/.exec(bytes.subarray(0, end).toString('latin1'))?.[1]);
        if (status !== 200 || bytes.length !== end + 4) return finish(true);
        finish(false);
      });
    });
    socket.connect = function (requestedPort, requestedHost) {
      if (requestedPort !== port || requestedHost !== host) throw safeError('POLICY_DATABASE_TARGET_MISMATCH');
      queueMicrotask(() => this.emit('connect')); return this;
    };
    const { Client } = require('pg');
    client = new Client({ ...config, stream: () => socket, connectionTimeoutMillis: 7000 });
    const connected = client.connect(); socket.resume(); await connected;
    if (client.connection.stream.authorized !== true) throw Error();
    return client;
  } catch {
    socket?.destroy();
    await client?.end().catch(() => {});
    throw safeError('POLICY_DATABASE_CONNECTION_FAILED');
  }
}

export function nativeProxyCertificate(environment) {
  try {
    const pem = readFileSync(environment.NODE_EXTRA_CA_CERTS, 'utf8');
    if (/PRIVATE KEY/.test(pem)) throw Error();
    const certificates = [...pem.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)]
      .map(match => new X509Certificate(match[0]));
    const roots = certificates.filter(cert => cert.subject === 'CN=network_proxy MITM CA' &&
      cert.issuer === cert.subject && cert.ca && cert.verify(cert.publicKey));
    if (roots.length !== 1 || Date.now() < Date.parse(roots[0].validFrom) || Date.now() > Date.parse(roots[0].validTo)) throw Error();
    return { certificate: roots[0], sha256: createHash('sha256').update(roots[0].raw).digest('hex') };
  } catch { throw safeError('NATIVE_PROXY_CA_REQUIRED'); }
}

// Chromium's profile-local ServerCertificate schema (version 1), not a Product
// database. The browser creates the schema; reject any unexpected version.
export function importProfileProxyCertificate(database, certificate) {
  const db = new DatabaseSync(database);
  try {
    const columns = db.prepare('PRAGMA table_info(certificates)').all().map(row => row.name);
    const version = db.prepare("SELECT value FROM meta WHERE key='version'").get();
    if (JSON.stringify(columns) !== JSON.stringify(['sha256hash_hex', 'der_cert', 'trust_settings']) ||
        Number(version?.value) !== 1 || db.prepare('SELECT count(*) AS count FROM certificates').get().count !== 0) throw Error();
    const dns = Buffer.from(`${pilotProject}.supabase.co`, 'utf8');
    // CertificateMetadata: trust_type=TRUSTED; constrained to the pilot API DNS name.
    const metadata = Buffer.concat([Buffer.from([0x0a, 2, 0x08, 3, 0x12, dns.length + 2, 0x0a, dns.length]), dns]);
    db.prepare('INSERT INTO certificates(sha256hash_hex,der_cert,trust_settings) VALUES(?,?,?)')
      .run(certificate.sha256, certificate.certificate.raw, metadata);
    const saved = db.prepare('SELECT sha256hash_hex,der_cert,trust_settings FROM certificates').get();
    if (saved.sha256hash_hex !== certificate.sha256 || !Buffer.from(saved.der_cert).equals(certificate.certificate.raw) ||
        !Buffer.from(saved.trust_settings).equals(metadata)) throw Error();
  } catch { throw safeError('BROWSER_PROFILE_TRUST_REJECTED'); }
  finally { db.close(); }
}

export function pilotBrowserDependency(chromePath, fullMode) {
  const source=dirname(chromePath);
  if(!fullMode) return {source,executable:'chrome.exe',files:['chrome.exe','chrome.dll','chrome_elf.dll'],channel:'chromium'};
  const revision=/^chromium-(\d+)$/.exec(basename(dirname(source)))?.[1];
  if(!revision) throw safeError('BROWSER_DEPENDENCY_MISMATCH');
  // Use Playwright's installed, matching headless distribution. Full Chrome
  // starts unrelated Google background services even during headless startup.
  return {source:resolve(source,'../..',`chromium_headless_shell-${revision}`,'chrome-headless-shell-win64'),
    executable:'chrome-headless-shell.exe',files:['chrome-headless-shell.exe','headless_command_resources.pak','icudtl.dat']};
}

export async function openPilotBrowser(input = process.env, { diagnosticNetlog = false } = {}) {
  if (!/^[a-f0-9]{64}$/.test(input.FACTORY_MVP_CANDIDATE || '')) throw safeError('CANDIDATE_REQUIRED');
  if (!input.FACTORY_MVP_OUTPUT || !outside(input.FACTORY_MVP_OUTPUT)) throw safeError('EXTERNAL_EVIDENCE_REQUIRED');
  const base = new URL(input.FACTORY_MVP_BASE_URL || 'http://invalid');
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port || base.username || base.password) throw safeError('LOCAL_RUNTIME_UNAVAILABLE');
  const output = resolve(input.FACTORY_MVP_OUTPUT), profile = resolve(output, 'chromium-profile'), runtime = resolve(output, 'chromium-runtime');
  const environment = pilotEnvironment(input, input);
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'DB_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'AUTOMOVE_DATABASE_URL']) delete environment[key];
  // Full mode tunnels end-to-end HTTPS: ordinary browser roots apply. Limited
  // mode diagnostics retain their existing scoped interception-CA path.
  const certificate = environment.FACTORY_MVP_NETWORK_MODE === 'full' ? null : nativeProxyCertificate(environment);
  const { chromium } = require('@playwright/test');
  const dependency=pilotBrowserDependency(chromium.executablePath(),environment.FACTORY_MVP_NETWORK_MODE==='full');
  const source=dependency.source;
  if(dependency.files.some(file=>!existsSync(resolve(source,file)))) throw safeError('BROWSER_DEPENDENCY_MISMATCH');
  if (existsSync(profile) || existsSync(runtime)) throw safeError('BROWSER_PROFILE_ALREADY_EXISTS');
  mkdirSync(output, { recursive: true });
  mkdirSync(profile);
  // Copy existing dependencies into the permitted output; no ACL or installation change.
  cpSync(source, runtime, { recursive: true, force: false, errorOnExist: true });
  for (const file of dependency.files) {
    const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest(resolve(source, file)) !== digest(resolve(runtime, file))) throw safeError('BROWSER_DEPENDENCY_MISMATCH');
  }
  const proxy = new URL(environment.HTTPS_PROXY);
  const proof = { candidate: input.FACTORY_MVP_CANDIDATE, caSha256: certificate?.sha256 || null, dnsConstraint: `${pilotProject}.supabase.co`,
    tlsTrust: certificate ? 'SCOPED_NATIVE_PROXY_CA' : 'DEFAULT_BROWSER_ROOTS',browserRuntime:certificate?'CHROMIUM':'CHROMIUM_HEADLESS_SHELL',
    trustScope: 'Fresh Chromium profile only', tlsVerification: true, globalTrustModified: false, cleanup: 'NOT_PROVEN' };
  let context;
  const cleanup = async () => {
    await context?.close();
    // Only this fresh, fixed child of the external output may be removed.
    if (dirname(profile) !== output || !outside(profile) || lstatSync(profile).isSymbolicLink()) throw safeError('BROWSER_CLEANUP_SCOPE_REJECTED');
    rmSync(profile, { recursive: true, force: true });
    // Windows can retain executable image handles after context.close(). This
    // dependency copy has no browser session data; preserve it outside source.
    proof.runtimeCleanup='RETAINED_DEPENDENCY_COPY';
    proof.cleanup = existsSync(profile) ? 'NOT_PROVEN' : 'PROFILE_REMOVED';
    writeFileSync(resolve(output, 'browser-trust-proof.json'), JSON.stringify(proof, null, 2));
  };
  const launch = logging => chromium.launchPersistentContext(profile, {
    ...(dependency.channel?{channel:dependency.channel}:{}), executablePath: resolve(runtime, dependency.executable), headless: true, timeout: 10000, env: environment,
    ignoreHTTPSErrors: false, proxy: { server: proxy.href, bypass: '127.0.0.1,localhost' },
    baseURL: base.href, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    args: logging ? [`--log-net-log=${resolve(output, 'chromium-netlog.json')}`, '--net-log-capture-mode=Default'] : [],
  });
  try {
    if (certificate) {
      context = await launch(false);
      await context.pages()[0].goto('chrome://certificate-manager/', { waitUntil: 'domcontentloaded', timeout: 5000 });
      await context.close(); context = null;
      importProfileProxyCertificate(resolve(profile, 'Default', 'ServerCertificate'), certificate);
    }
    context = await launch(diagnosticNetlog);
    return { context, proof, cleanup };
  } catch {
    await cleanup();
    throw safeError('BROWSER_PROFILE_NOT_READY');
  }
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const stopped = new Promise(done => child.once('exit', done));
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  await Promise.race([stopped, new Promise(done => setTimeout(done, 5000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

export async function runPilot(input = process.env) {
  const candidate = input.FACTORY_MVP_CANDIDATE;
  if (!/^[a-f0-9]{64}$/.test(candidate || '')) throw safeError('CANDIDATE_REQUIRED');
  if (!input.E2E_ENV_FILE || !outside(input.E2E_ENV_FILE) || !existsSync(input.E2E_ENV_FILE)) throw safeError('ENVIRONMENT_NOT_READY');
  const { parse } = require('dotenv');
  const env = pilotEnvironment(parse(readFileSync(input.E2E_ENV_FILE)));
  if (env.FACTORY_MVP_NETWORK_MODE !== 'full') throw safeError('NETWORK_MODE_NOT_READY');
  if (!input.FACTORY_MVP_OUTPUT || !outside(input.FACTORY_MVP_OUTPUT)) throw safeError('EXTERNAL_EVIDENCE_REQUIRED');
  const output = resolve(input.FACTORY_MVP_OUTPUT);
  mkdirSync(output, { recursive: true });
  try { closeSync(openSync(resolve(output, 'browser-execution.claim'), 'wx')); }
  catch { throw safeError('PILOT_ALREADY_EXECUTED'); }
  const proof = { candidate, target: pilotProject, status: 'NOT_PROVEN', browser: 'NOT_RUN', databaseReadback: 'NOT_RUN', cleanup:'NOT_PROVEN', fixtureJournal:'fixture-journal.json', productGoLive: 'NOT_PROVEN' };
  const writeProof = () => writeFileSync(resolve(output, 'runtime-proof.json'), JSON.stringify(proof, null, 2));
  const children = [];
  let deadlineExceeded = false;
  const deadline = setTimeout(() => { deadlineExceeded = true; void Promise.all(children.map(stop)); }, 270000);
  const launch = (args, launchEnv = env, capture = false) => {
    const child = spawn(process.execPath, args, { cwd: workspace, env: launchEnv, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    // Raw server/test output can contain Auth cookies, credentials or fixture PII.
    // It is drained, never printed or persisted; the exact report/proof is reduced below.
    let captured = '';
    if (capture) child.stdout?.on('data', bytes => { captured += bytes.toString(); if (captured.length > 4 * 1024 * 1024) { captured = ''; void stop(child); } });
    else child.stdout?.resume();
    child.stderr?.resume();
    const done = new Promise((finish, fail) => { child.once('exit', code => finish(code ?? 1)); child.once('error', () => fail(safeError('LOCAL_RUNTIME_UNAVAILABLE'))); });
    void done.catch(() => undefined);
    return { child, done, report: () => captured };
  };
  const interrupted = () => { void Promise.all(children.map(stop)).finally(() => process.exit(1)); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  writeProof();
  try {
    const port = await freePort();
    env.FACTORY_MVP_BASE_URL = `http://127.0.0.1:${port}`;
    env.FACTORY_MVP_OUTPUT = output;
    env.FACTORY_MVP_CANDIDATE = candidate;
    const server = launch(['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], pilotNextEnvironment(env));
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (server.child.exitCode !== null) throw safeError('LOCAL_RUNTIME_UNAVAILABLE');
      if (await localRuntimeReady(port)) { ready = true; break; }
      await new Promise(done => setTimeout(done, 1000));
    }
    if (!ready) throw safeError('LOCAL_RUNTIME_UNAVAILABLE');
    const browser = launch(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.automove-mvp-pilot.config.ts', '--workers=1', '--retries=0'], { ...env, NODE_ENV: 'test' }, true);
    proof.browser='STARTED'; writeProof();
    const timeout = setTimeout(() => { void stop(browser.child); }, 240000);
    const exit = await browser.done.finally(() => clearTimeout(timeout));
    // Parse raw reporter output only in memory: failed fill commands may contain
    // the random fixture password. Persist only reduced counters and safe proof.
    const report = JSON.parse(browser.report());
    const stats = report.stats;
    if (exit !== 0 || stats.expected !== 1 || stats.unexpected !== 0 || stats.flaky !== 0 || stats.skipped !== 0) throw safeError('PRODUCT_E2E_FAILED');
    const browserTrust = JSON.parse(readFileSync(resolve(output, 'browser-trust-proof.json'), 'utf8'));
    if (browserTrust.candidate !== candidate || browserTrust.caSha256 !== null || browserTrust.tlsTrust !== 'DEFAULT_BROWSER_ROOTS' ||
        browserTrust.tlsVerification !== true || browserTrust.globalTrustModified !== false || browserTrust.cleanup !== 'PROFILE_REMOVED') throw safeError('BROWSER_TRUST_PROOF_REQUIRED');
    const observations = JSON.parse(readFileSync(resolve(output, 'customer-proof.json'), 'utf8'));
    if (observations.candidate !== candidate || observations.target !== pilotProject || observations.persisted !== true || observations.reloadReadback !== true || observations.databaseReadback !== true || observations.denialNoMutation !== true || observations.invalidInputNoMutation !== true || observations.cleanup !== 'AUTH_REMOVED_TENANTS_ARCHIVED') throw safeError('PERSISTENCE_PROOF_REQUIRED');
    proof.status = 'PASS'; proof.browser = 'PASS'; proof.databaseReadback = 'PASS';
    proof.deniedAccess = 'PASS'; proof.invalidInput = 'PASS'; proof.cleanup = 'AUTH_REMOVED_TENANTS_ARCHIVED';
    proof.tests = { expected: 1, unexpected: 0, flaky: 0, skipped: 0 };
    return proof;
  } catch (error) {
    proof.reason = deadlineExceeded ? 'PILOT_TIMEOUT' : ['LOCAL_RUNTIME_UNAVAILABLE', 'PRODUCT_E2E_FAILED', 'PERSISTENCE_PROOF_REQUIRED', 'BROWSER_TRUST_PROOF_REQUIRED'].includes(error.code) ? error.code : 'PILOT_RUNTIME_UNCERTAIN';
    throw safeError(proof.reason);
  } finally {
    clearTimeout(deadline);
    await Promise.all(children.map(stop)); writeProof();
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('TAP version 13');
  runPilot().then(proof => {
    console.log('ok 1 - AutoMove customer preferences Browser to Database');
    console.log(`# proof ${JSON.stringify(proof)}`);
    console.log('1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0');
  }).catch(error => {
    const code = /^[A-Z_]{3,80}$/.test(error.code || '') ? error.code : 'PILOT_RUNTIME_UNCERTAIN';
    console.log(`not ok 1 - AutoMove customer preferences Browser to Database\n# reason ${code}`);
    console.log('1..1\n# tests 1\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0');
    process.exitCode = 1;
  });
}
