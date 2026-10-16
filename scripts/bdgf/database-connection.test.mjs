import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { connect, createServer, rootCertificates } from 'node:tls';
import pg from 'pg';
import { createBdgfDatabaseConfig } from './database-connection.mjs';

const databaseUrl = 'postgresql://executor:p%40ss%3Aword@localhost:5432/postgres';

test('structured parsing preserves encoded credentials and verifies chain/hostname', () => {
  const config = createBdgfDatabaseConfig(databaseUrl);
  assert.equal(config.host, 'localhost');
  assert.equal(config.port, 5432);
  assert.equal(config.user, 'executor');
  assert.equal(config.password, 'p@ss:word');
  assert.equal(config.database, 'postgres');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, config.host);
  assert.equal(config.ssl.checkServerIdentity, undefined);
  assert.equal(config.connectionString, undefined);
  assert.equal(config.connectionTimeoutMillis, 10000);
});

test('bundled public Supabase root is the approved certificate', () => {
  const { ssl } = createBdgfDatabaseConfig(databaseUrl);
  assert.deepEqual(ssl.ca.slice(0, -1), rootCertificates);
  const certificate = new X509Certificate(ssl.ca.at(-1));
  assert.equal(certificate.ca, true);
  assert.equal(certificate.fingerprint256.replaceAll(':', '').toLowerCase(),
    '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa');
});

for (const mode of ['', '?sslmode=require', '?sslmode=verify-full']) {
  test(`encrypted URL hint cannot replace the verified TLS config: ${mode || 'default'}`, () => {
    const config = createBdgfDatabaseConfig(databaseUrl + mode);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.servername, 'localhost');
    assert.equal(config.connectionString, undefined);
    assert.equal(config.sslmode, undefined);
  });
}

for (const query of [
  'sslmode=disable', 'sslmode=no-verify', 'sslmode=prefer', 'sslmode=allow',
  'sslmode=verify-ca', 'ssl=false', 'sslmode=require&sslmode=disable',
  'host=attacker.invalid', 'host=%2Ftmp', 'sslrootcert=secret.pem',
  'sslcert=client.pem', 'sslkey=private.pem', 'options=-c%20row_security%3Doff',
  'sslmode=require&host=attacker.invalid', 'uselibpqcompat=true',
  'sslmode=require&sslmode=require'
]) {
  test(`rejects URL override before connection: ${query}`, () => {
    assert.throws(() => createBdgfDatabaseConfig(`${databaseUrl}?${query}`),
      { message: 'Invalid BDGF database connection configuration.' });
  });
}

for (const url of [
  '', 'not-a-url', 'https://executor:password@localhost/postgres',
  'postgresql://localhost/postgres', 'postgresql://executor@localhost/postgres',
  'postgresql://executor:password@localhost/',
  'postgresql://executor:password@localhost:0/postgres',
  'postgresql://executor:password@localhost:65536/postgres',
  `${databaseUrl}#fragment`
]) {
  test(`invalid configuration fails without disclosing its input (${url.length} chars)`, () => {
    assert.throws(() => createBdgfDatabaseConfig(url),
      { message: 'Invalid BDGF database connection configuration.' });
  });
}

test('each call returns independent TLS options', () => {
  const config = createBdgfDatabaseConfig(databaseUrl);
  config.ssl.rejectUnauthorized = false;
  config.ssl.ca.length = 0;
  assert.equal(createBdgfDatabaseConfig(databaseUrl).ssl.rejectUnauthorized, true);
  assert.ok(createBdgfDatabaseConfig(databaseUrl).ssl.ca.length > 0);
});

test('pg receives explicit verified TLS despite a weaker PGSSLMODE environment', () => {
  const previous = process.env.PGSSLMODE;
  process.env.PGSSLMODE = 'disable';
  try {
    const client = new pg.Client(createBdgfDatabaseConfig(databaseUrl + '?sslmode=require'));
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(client.connectionParameters.ssl.servername, 'localhost');
    assert.equal(client.connectionParameters.host, 'localhost');
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previous;
  }
});

test('all reachable approval and execution callers use verified TLS without changing approval order', () => {
  for (const file of ['create-migration-approval.mjs', 'r4-verify-approval.mjs', 'execute-migration-wrapper.mjs', 'migration-executor.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /import \{ createBdgfDatabaseConfig \} from '\.\/database-connection\.mjs'/);
    assert.match(source, /createBdgfDatabaseConfig\(dbUrl\)/);
    assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false|dbUrl\.match\(/);
  }
  const wrapper = readFileSync(new URL('execute-migration-wrapper.mjs', import.meta.url), 'utf8');
  assert.ok(wrapper.indexOf('await verifyApproval(') < wrapper.indexOf('await issueGateToken('));
  assert.ok(wrapper.indexOf('await issueGateToken(') < wrapper.indexOf('await executeMigration('));
  assert.ok(wrapper.indexOf('await assertExecutionIdentity(') < wrapper.indexOf('await issueGateToken('));
  const executor = readFileSync(new URL('migration-executor.mjs', import.meta.url), 'utf8');
  assert.ok(executor.indexOf('await validateGateToken(') < executor.indexOf('await consumeGateToken('));
  assert.ok(executor.indexOf('await consumeGateToken(') < executor.indexOf('await db.query(migration_content)'));
  assert.ok(executor.indexOf('await assertExecutionIdentity(') < executor.indexOf('await consumeGateToken('));
});

test('missing and malformed tokens still block execution before any connection', async () => {
  const { executeMigration } = await import('./migration-executor.mjs');
  await assert.rejects(() => executeMigration({}), { code: 'NO_TOKEN' });
  await assert.rejects(() => executeMigration({ token: {} }), { code: 'INVALID_TOKEN_STRUCTURE' });
});

// These keys are ephemeral synthetic fixtures, never Production credentials.
let fixtureDirectory;
let server;
let certificate;
let port;
const sockets = new Set();

before(async () => {
  fixtureDirectory = mkdtempSync(join(tmpdir(), 'bdgf-tls-test-'));
  const windowsOpenSsl = join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe');
  const openssl = process.platform === 'win32' && existsSync(windowsOpenSsl) ? windowsOpenSsl : 'openssl';
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', join(fixtureDirectory, 'key.pem'), '-out', join(fixtureDirectory, 'cert.pem'),
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
  { stdio: 'pipe', windowsHide: true, timeout: 15000 });
  certificate = readFileSync(join(fixtureDirectory, 'cert.pem'), 'utf8');
  server = createServer({ key: readFileSync(join(fixtureDirectory, 'key.pem')), cert: certificate }, socket => socket.end());
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('tlsClientError', () => {});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
});

after(async () => {
  for (const socket of sockets) socket.destroy();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  if (fixtureDirectory) {
    const target = realpathSync(fixtureDirectory);
    assert.equal(dirname(target), realpathSync(tmpdir()));
    assert.ok(basename(target).startsWith('bdgf-tls-test-'));
    rmSync(target, { recursive: true, force: true });
  }
});

function handshake(ssl) {
  return new Promise((resolve, reject) => {
    const socket = connect({ ...ssl, host: '127.0.0.1', port });
    socket.setTimeout(5000, () => socket.destroy(new Error('TLS handshake timed out')));
    socket.once('error', reject);
    socket.once('secureConnect', () => {
      const authorized = socket.authorized;
      socket.end();
      resolve(authorized);
    });
  });
}

test('real TLS: trusted fixture with matching hostname succeeds', async () => {
  // Only the fixture trust anchor changes; verification/SNI come from production config.
  const { ssl } = createBdgfDatabaseConfig(databaseUrl);
  assert.equal(await handshake({ ...ssl, ca: certificate }), true);
});

test('real TLS: untrusted certificate is rejected by the default configuration', async () => {
  const { ssl } = createBdgfDatabaseConfig(databaseUrl);
  await assert.rejects(() => handshake(ssl), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
});

test('real TLS: trusted certificate with mismatched hostname is rejected', async () => {
  const { ssl } = createBdgfDatabaseConfig(databaseUrl.replace('localhost', 'wrong-host.invalid'));
  await assert.rejects(() => handshake({ ...ssl, ca: certificate }), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
});
