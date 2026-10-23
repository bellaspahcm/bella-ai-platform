import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { rootCertificates } from 'node:tls';
import { X509Certificate, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { pilotEnvironment, pilotProject, pilotNextEnvironment, installPilotOfflineMetadataGuard, localRuntimeReady, nativeProxyCertificate, importProfileProxyCertificate, pilotBrowserDependency, openPilotBrowser, openPilotDatabase, runPilot } from './mvp-pilot-runner.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const browserConfig = ts.transpileModule(readFileSync(new URL('../../playwright.automove-mvp-pilot.config.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const localProxy = () => ({ HTTP_PROXY: 'http://127.0.0.1:49687', HTTPS_PROXY: 'http://127.0.0.1:49687' });
const browserEnvironment = () => ({ FACTORY_MVP_BASE_URL: 'http://127.0.0.1:3000', FACTORY_MVP_OUTPUT: 'synthetic-output',
  FACTORY_MVP_CANDIDATE: 'a'.repeat(64), NODE_USE_ENV_PROXY: '1' });
function loadBrowserConfig(environment) {
  const module = { exports: {} };
  runInNewContext(browserConfig, { module, exports: module.exports, require, process: { env: environment }, URL });
  return module.exports.default;
}
const rejectedProxies = [
  {}, { HTTPS_PROXY: 'http://example.com:8080' }, { HTTPS_PROXY: 'http://127.0.0.1' }, { HTTPS_PROXY: 'http://127.0.0.1:0' },
  { HTTPS_PROXY: 'http://user:synthetic-only@127.0.0.1:49687' },
  { HTTP_PROXY: 'http://127.0.0.1:49687', HTTPS_PROXY: 'http://127.0.0.1:49688' },
  { HTTPS_PROXY: 'https://127.0.0.1:49687' }, { HTTPS_PROXY: 'http://127.0.0.1:49687/path' },
  { HTTPS_PROXY: 'http://127.0.0.1:49687/?bypass=example.com' }, { HTTPS_PROXY: 'http://127.0.0.1:49687/#fragment' },
  { HTTPS_PROXY: 'invalid-proxy-sentinel' },
];

const valid = () => ({ NEXT_PUBLIC_SUPABASE_URL: `https://${pilotProject}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-test', DB_URL: `postgresql://postgres.${pilotProject}:example@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full` });

test('pilot permits only matching Non-Production target and removes unrelated host secrets', () => {
  const result = pilotEnvironment({ ...valid(), VERCEL_ENV: 'production', VERCEL_AUTOMATION_BYPASS_SECRET: 'not-passed', AWS_SECRET_ACCESS_KEY: 'not-passed', OTHER_SECRET: 'not-passed' }, localProxy());
  assert.equal(result.NEXT_PUBLIC_SUPABASE_URL, `https://${pilotProject}.supabase.co`);
  assert.equal(result.HTTP_PROXY, 'http://127.0.0.1:49687/'); assert.equal(result.HTTPS_PROXY, result.HTTP_PROXY); assert.equal(result.NODE_USE_ENV_PROXY, '1');
  assert.equal(result.VERCEL_ENV, undefined); assert.equal(result.OTHER_SECRET, undefined); assert.equal(result.AWS_SECRET_ACCESS_KEY, undefined);
});
test('pilot rejects Production API, foreign DB, conflicting aliases and TLS injection', () => {
  for (const change of [
    { NEXT_PUBLIC_SUPABASE_URL: 'https://lvnvkpyxtuilhrabtlwv.supabase.co' },
    { DB_URL: 'postgresql://postgres:example@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres' },
    { DATABASE_URL: 'postgresql://postgres:example@localhost:5432/postgres' },
    { DB_URL: valid().DB_URL.replace('verify-full', 'disable') },
    { DB_URL: `${valid().DB_URL}&sslcert=/sensitive` },
    { DB_URL: `${valid().DB_URL}&sslmode=verify-full` },
    { SUPABASE_URL: 'https://foreign.supabase.co' },
    { SUPABASE_SERVICE_ROLE_KEY: '' },
  ]) assert.throws(() => pilotEnvironment({ ...valid(), ...change }, localProxy()), { message: 'ENVIRONMENT_NOT_READY' });
});
test('pilot requires one matching loopback policy proxy and rejects direct or ambient egress', () => {
  const accepted = localProxy();
  assert.equal(pilotEnvironment(valid(), accepted).NODE_USE_ENV_PROXY, '1');
  for (const proxy of rejectedProxies) {
    assert.throws(() => pilotEnvironment(valid(), proxy), { message: 'ENVIRONMENT_NOT_READY' });
  }
});
test('only the supervised runtime supplies the protocol mode to child processes', () => {
  const fromRuntime = pilotEnvironment({ ...valid(), FACTORY_MVP_NETWORK_MODE: 'limited' }, { ...localProxy(), FACTORY_MVP_NETWORK_MODE: 'full' });
  assert.equal(fromRuntime.FACTORY_MVP_NETWORK_MODE, 'full');
  assert.equal(pilotEnvironment({ ...valid(), FACTORY_MVP_NETWORK_MODE: 'full' }, localProxy()).FACTORY_MVP_NETWORK_MODE, '');
});

test('offline metadata guard rejects only the optional Next version GET without fabricating a response', async () => {
  const calls = [], response = { status: 401 };
  const runtime = { fetch: (...args) => { calls.push(args); return Promise.resolve(response); } };
  installPilotOfflineMetadataGuard(runtime);
  for (const input of ['https://registry.npmjs.org/-/package/next/dist-tags',
    new URL('https://registry.npmjs.org/-/package/next/dist-tags'),
    new Request('https://registry.npmjs.org/-/package/next/dist-tags')]) {
    await assert.rejects(runtime.fetch(input), { code: 'NEXT_VERSION_METADATA_OFFLINE' });
  }
  assert.equal(calls.length, 0);
  for (const input of [`https://${pilotProject}.supabase.co/auth/v1/health`,
    'https://example.com/', 'https://registry.npmjs.org/next',
    'https://registry.npmjs.org/-/package/next/dist-tags?unexpected=1']) {
    const options = { method: 'GET' };
    assert.equal(await runtime.fetch(input, options), response);
    assert.deepEqual(calls.at(-1), [input, options]);
  }
  assert.equal(await runtime.fetch('https://registry.npmjs.org/-/package/next/dist-tags', { method: 'POST' }), response);
  assert.equal(calls.length, 5);
});

test('Next and its worker inherit the offline preload while real version metadata stays unknown', () => {
  const parent = { ...process.env, ...localProxy(), FACTORY_MVP_NETWORK_MODE: 'full' };
  const environment = pilotNextEnvironment(parent);
  assert.equal(parent.FACTORY_MVP_NEXT_OFFLINE_METADATA, undefined);
  assert.equal(environment.HTTP_PROXY, parent.HTTP_PROXY);
  assert.equal(environment.HTTPS_PROXY, parent.HTTPS_PROXY);
  assert.equal(environment.NEXT_IGNORE_INCORRECT_LOCKFILE, '1');
  const source = `
    const assert = require('node:assert/strict');
    (async () => {
      await assert.rejects(fetch('https://registry.npmjs.org/-/package/next/dist-tags'), { code: 'NEXT_VERSION_METADATA_OFFLINE' });
      const {getVersionInfo} = require('next/dist/server/dev/hot-reloader-shared-utils');
      assert.deepEqual(await getVersionInfo(), { installed: require('next/package.json').version, staleness: 'unknown' });
      const {getParsedNodeOptions,formatNodeOptions} = require('next/dist/server/lib/utils');
      const inherited = formatNodeOptions(getParsedNodeOptions());
      assert.ok(inherited.nodeOptions.includes('--import=') || inherited.execArgv.some(value => value.startsWith('--import')));
      assert.equal(process.env.HTTP_PROXY, process.env.HTTPS_PROXY);
      console.log('NEXT_OFFLINE_METADATA_UNKNOWN_PROXY_RETAINED');
    })().catch(() => { process.exitCode = 1; });
  `;
  const child = spawnSync(process.execPath, ['-e', source], { cwd: new URL('../..', import.meta.url), env: environment,
    windowsHide: true, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, 'installed Next must use its unknown metadata path with the inherited preload');
  assert.equal(child.stdout.trim(), 'NEXT_OFFLINE_METADATA_UNKNOWN_PROXY_RETAINED');
});
test('PostgreSQL refuses wrong mode, foreign target and TLS weakening before opening a socket', async () => {
  const host = `db.${pilotProject}.supabase.co`;
  const config = { host, port: 5432, database: 'postgres', user: 'synthetic', password: 'synthetic-unused', ssl: { ca: rootCertificates[0], rejectUnauthorized: true, servername: host } };
  const environment = { ...localProxy(), FACTORY_MVP_NETWORK_MODE: 'full' };
  for (const changed of [{ host: 'production.example' }, { port: 443 }, { database: 'other' }, { connectionString: 'postgresql://foreign.invalid/db' }, { stream: () => {} },
    { ssl: { ...config.ssl, rejectUnauthorized: false } }, { ssl: { ...config.ssl, ca: '' } }, { ssl: { ...config.ssl, servername: 'foreign.invalid' } }]) {
    await assert.rejects(openPilotDatabase({ ...config, ...changed }, environment), { message: 'POLICY_DATABASE_CONNECTION_FAILED' });
  }
  for (const changed of [{ FACTORY_MVP_NETWORK_MODE: 'limited' }, { HTTPS_PROXY: 'http://foreign.invalid:8080' }, { HTTPS_PROXY: '' , HTTP_PROXY: '' }, { HTTPS_PROXY: 'http://127.0.0.1:49688' }]) {
    await assert.rejects(openPilotDatabase(config, { ...environment, ...changed }), { message: 'POLICY_DATABASE_CONNECTION_FAILED' });
  }
});
test('PostgreSQL uses exactly the configured proxy tunnel and never authenticates after denial or SSL rejection', async () => {
  const host = `db.${pilotProject}.supabase.co`, commands = [], postgresMessages = [];
  let denied = true;
  const server = createTcpServer(socket => {
    let header = '', tunnel = false;
    socket.on('data', bytes => {
      if (tunnel) { postgresMessages.push(Buffer.from(bytes)); socket.end('N'); return; }
      header += bytes.toString();
      if (!header.includes('\r\n\r\n')) return;
      commands.push(header);
      if (denied) socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
      else { tunnel = true; socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); }
    });
    socket.on('error', () => {});
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const proxy = `http://127.0.0.1:${server.address().port}`;
  const environment = { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, FACTORY_MVP_NETWORK_MODE: 'full' };
  const config = { host, port: 5432, database: 'postgres', user: 'synthetic', password: 'must-not-be-sent', ssl: { ca: rootCertificates[0], rejectUnauthorized: true, servername: host } };
  try {
    await assert.rejects(openPilotDatabase(config, environment), { message: 'POLICY_DATABASE_CONNECTION_FAILED' });
    assert.equal(postgresMessages.length, 0);
    denied = false;
    await assert.rejects(openPilotDatabase(config, environment), { message: 'POLICY_DATABASE_CONNECTION_FAILED' });
    assert.equal(commands.length, 2);
    assert.ok(commands.every(command => command === `CONNECT ${host}:5432 HTTP/1.1\r\nHost: ${host}:5432\r\n\r\n`));
    assert.equal(postgresMessages.length, 1);
    const request = postgresMessages[0];
    assert.equal(request.length, 8); assert.equal(request.readInt32BE(0), 8); assert.equal(request.readInt32BE(4), 80877103);
    assert.ok(commands.every(command => !command.includes(config.password)));
  } finally { await new Promise(done => server.close(done)); }
});
test('pilot preserves native proxy CA files without accepting TLS overrides from the env file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'automove-proxy-ca-'));
  const certificate = join(directory, 'runtime-ca.pem');
  try {
    writeFileSync(certificate, rootCertificates[0]);
    const runtime = { ...localProxy(), NODE_EXTRA_CA_CERTS: certificate, SSL_CERT_FILE: certificate, NODE_TLS_REJECT_UNAUTHORIZED: '0', NODE_OPTIONS: '--tls-min-v1.0' };
    const result = pilotEnvironment({ ...valid(), NODE_EXTRA_CA_CERTS: 'untrusted-env-file', SSL_CERT_FILE: 'untrusted-env-file', NODE_TLS_REJECT_UNAUTHORIZED: '0' }, runtime);
    assert.equal(result.NODE_EXTRA_CA_CERTS, certificate);
    assert.equal(result.SSL_CERT_FILE, certificate);
    assert.equal(result.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
    assert.equal(result.NODE_OPTIONS, undefined);
    const withoutRuntimeCA = pilotEnvironment({ ...valid(), NODE_EXTRA_CA_CERTS: certificate, SSL_CERT_FILE: certificate }, localProxy());
    assert.equal(withoutRuntimeCA.NODE_EXTRA_CA_CERTS, undefined);
    assert.equal(withoutRuntimeCA.SSL_CERT_FILE, undefined);
    for (const invalid of [directory, join(directory, 'missing.pem'), 'relative-ca.pem']) {
      assert.throws(() => pilotEnvironment(valid(), { ...localProxy(), NODE_EXTRA_CA_CERTS: invalid }), { message: 'ENVIRONMENT_NOT_READY' });
    }
  } finally { unlinkSync(certificate); rmdirSync(directory); }
});
test('Chromium uses the same policy proxy and bypasses only the local app', () => {
  const config = loadBrowserConfig({ ...browserEnvironment(), ...localProxy() });
  assert.equal(config.use.launchOptions.proxy.server, 'http://127.0.0.1:49687/');
  assert.equal(config.use.launchOptions.proxy.bypass, '127.0.0.1,localhost');
  assert.equal(config.use.ignoreHTTPSErrors, false);
  assert.deepEqual([...config.build.external], ['**/scripts/agent-flow/mvp-pilot-runner.mjs']);
});

test('full-mode pilot uses the matching installed Headless Shell without full-Chrome fallback',()=>{
  const root=resolve(tmpdir(),'fixture-browser-cache');
  const path=join(root,'chromium-1223','chrome-win64','chrome.exe');
  const selected=pilotBrowserDependency(path,true);
  assert.equal(selected.source,join(root,'chromium_headless_shell-1223','chrome-headless-shell-win64'));
  assert.equal(selected.executable,'chrome-headless-shell.exe');
  assert.equal(selected.channel,undefined);
  assert.ok(selected.files.includes(selected.executable));
  assert.equal(pilotBrowserDependency(path,false).executable,'chrome.exe');
  assert.throws(()=>pilotBrowserDependency(join(root,'unknown','chrome.exe'),true),{message:'BROWSER_DEPENDENCY_MISMATCH'});
});
test('browser trust rejects missing CA, private keys, malformed certificates and unrelated roots without echoing them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'automove-browser-ca-')), path = join(directory, 'ca.pem');
  try {
    assert.throws(() => nativeProxyCertificate({}), { message: 'NATIVE_PROXY_CA_REQUIRED' });
    for (const text of ['invalid-input-sentinel', '-----BEGIN PRIVATE KEY-----', rootCertificates[0]]) {
      writeFileSync(path, text);
      assert.throws(() => nativeProxyCertificate({ NODE_EXTRA_CA_CERTS: path }), { message: 'NATIVE_PROXY_CA_REQUIRED' });
    }
  } finally { unlinkSync(path); rmdirSync(directory); }
});
test('profile trust imports one certificate with API DNS constraints and rejects occupied or unknown schemas', () => {
  const directory = mkdtempSync(join(tmpdir(), 'automove-browser-db-')), path = join(directory, 'ServerCertificate');
  const certificate = new X509Certificate(rootCertificates[0]);
  const ca = { certificate, sha256: createHash('sha256').update(certificate.raw).digest('hex') };
  let db = new DatabaseSync(path);
  db.exec("CREATE TABLE meta(key TEXT PRIMARY KEY,value INTEGER); INSERT INTO meta VALUES('version',1); CREATE TABLE certificates(sha256hash_hex TEXT PRIMARY KEY,der_cert BLOB NOT NULL,trust_settings BLOB NOT NULL)");
  db.close();
  try {
    importProfileProxyCertificate(path, ca);
    db = new DatabaseSync(path);
    const row = db.prepare('SELECT sha256hash_hex,der_cert,trust_settings FROM certificates').get();
    assert.equal(row.sha256hash_hex, ca.sha256);
    assert.deepEqual(Buffer.from(row.der_cert), certificate.raw);
    const metadata = Buffer.from(row.trust_settings);
    assert.deepEqual([...metadata.subarray(0, 4)], [0x0a, 2, 0x08, 3]);
    assert.equal(metadata[4], 0x12);
    assert.equal(metadata[6], 0x0a);
    assert.equal(metadata.subarray(8).toString(), `${pilotProject}.supabase.co`);
    db.close();
    assert.throws(() => importProfileProxyCertificate(path, ca), { message: 'BROWSER_PROFILE_TRUST_REJECTED' });
    db = new DatabaseSync(path);
    db.exec("DELETE FROM certificates; UPDATE meta SET value=2 WHERE key='version'");
    db.close();
    assert.throws(() => importProfileProxyCertificate(path, ca), { message: 'BROWSER_PROFILE_TRUST_REJECTED' });
    db = new DatabaseSync(path);
    assert.equal(db.prepare('SELECT count(*) AS count FROM certificates').get().count, 0);
    db.close();
  } finally { if (db.isOpen) db.close(); unlinkSync(path); rmdirSync(directory); }
});
test('browser setup rejects missing provenance and an in-repository profile before startup', async () => {
  await assert.rejects(openPilotBrowser({}), { message: 'CANDIDATE_REQUIRED' });
  await assert.rejects(openPilotBrowser({ FACTORY_MVP_CANDIDATE: 'a'.repeat(64), FACTORY_MVP_OUTPUT: process.cwd() }), { message: 'EXTERNAL_EVIDENCE_REQUIRED' });
});
test('readiness checks only the owned loopback health listener and reports real status', async () => {
  let status = 200;
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, host: request.headers.host });
    response.writeHead(status); response.end();
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  try {
    assert.equal(await localRuntimeReady(port), true);
    status = 503;
    assert.equal(await localRuntimeReady(port), false);
    assert.deepEqual(requests, [1, 2].map(() => ({ path: '/api/health', host: `127.0.0.1:${port}` })));
    for (const invalid of [0, 65536, '443', 'https://example.com']) assert.equal(await localRuntimeReady(invalid), false);
  } finally { await new Promise(done => server.close(done)); }
  assert.equal(await localRuntimeReady(port), false);
});
test('Chromium rejects invalid policy proxy configuration without echoing its input', () => {
  for (const proxy of rejectedProxies) {
    assert.throws(() => loadBrowserConfig({ ...browserEnvironment(), ...proxy }), error => {
      assert.match(error.message, /supervised AutoMove MVP pilot runner/);
      assert.doesNotMatch(error.message, /invalid-proxy-sentinel|synthetic-only/);
      return true;
    });
  }
});
test('pilot rejects callerless candidate and missing external environment before network', async () => {
  await assert.rejects(runPilot({}), { message: 'CANDIDATE_REQUIRED' });
  await assert.rejects(runPilot({ FACTORY_MVP_CANDIDATE: 'a'.repeat(64) }), { message: 'ENVIRONMENT_NOT_READY' });
});
