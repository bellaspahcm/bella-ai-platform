const { spawnSync, execFileSync } = require('node:child_process');
const { applyHealthOnly, preflightHealthOnly, checkedMigration, assertRunnerContext, assertExactMain, productionClientConfig, safeErrorCode } = require('../../../../../scripts/apply-platform-health-probe-only.cjs');
const { decideMigrationAction } = require('../../../../../scripts/apply-platform-health-probe-migration.cjs');

test('rejects a modified artifact before any database call', async () => {
  const client = { query: jest.fn() };
  await expect(applyHealthOnly(client, Buffer.from('not the reviewed migration'))).rejects.toThrow(/hash mismatch/);
  expect(client.query).not.toHaveBeenCalled();
  expect(() => checkedMigration(Buffer.from('invalid'))).toThrow(/hash mismatch/);
});

test('the original full-release ledger guard still rejects remote-only versions', () => {
  expect(() => decideMigrationAction(['20261029090000'], ['20261029135227'])).toThrow(/missing from Git/);
});

test('direct execution outside the protected runner refuses without database access', () => {
  const result = spawnSync(process.execPath, ['scripts/apply-platform-health-probe-only.cjs'], {
    env: { ...process.env, GITHUB_ACTIONS: 'false' }, encoding: 'utf8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/protected GitHub Linux runner/);
});

test('requires protected runner context and an unchanged exact main revision', () => {
  expect(() => assertRunnerContext('linux', 'true', 'refs/heads/main')).not.toThrow();
  for (const args of [['win32', 'true', 'refs/heads/main'], ['linux', 'false', 'refs/heads/main'], ['linux', 'true', 'refs/heads/feature']]) {
    expect(() => assertRunnerContext(...args)).toThrow(/protected GitHub/);
  }
  const sha = 'a'.repeat(40);
  expect(() => assertExactMain(sha, sha, sha)).not.toThrow();
  expect(() => assertExactMain(sha, sha, 'b'.repeat(40))).toThrow(/Main changed/);
  expect(() => assertExactMain(sha, 'b'.repeat(40), sha)).toThrow(/Main changed/);
  expect(() => assertExactMain('invalid', sha, sha)).toThrow(/Invalid GitHub SHA/);
});

test('pins the project and requires TLS certificate verification', () => {
  const { Client } = require('pg');
  const url = 'postgresql://postgres:test@db.lvnvkpyxtuilhrabtlwv.supabase.co:5432/postgres?sslmode=verify-full';
  expect(productionClientConfig(url).ssl.rejectUnauthorized).toBe(true);
  for (const suffix of ['', '?sslmode=require', '?sslmode=verify-full']) {
    const target = url.split('?')[0] + suffix;
    expect(new Client(productionClientConfig(target)).connectionParameters.ssl.rejectUnauthorized).toBe(true);
  }
  expect(() => productionClientConfig(url, '0')).toThrow(/Secure production/);
  expect(() => productionClientConfig(url.replace('lvnvkpyxtuilhrabtlwv', 'aaaaaaaaaaaaaaaaaaaa'))).toThrow(/does not match/);
  expect(() => productionClientConfig(url.replace('verify-full', 'disable'))).toThrow(/does not match/);
});

test('logs only sanitized error codes', () => {
  expect(safeErrorCode({ code: 'ENETUNREACH' })).toBe('ENETUNREACH');
  expect(safeErrorCode({ code: '42501' })).toBe('42501');
  expect(safeErrorCode({ code: 'potential secret://value' })).toBe('UNCLASSIFIED');
  expect(safeErrorCode({})).toBe('UNCLASSIFIED');
});

test('read-only preflight rejects an existing health version and rolls back', async () => {
  const client = { query: jest.fn(async sql => sql.includes("AS read_only") ? { rows: [{ read_only: 'on', executor: 'owner', session: 'owner', database_owner: 'owner', schema_create: true, anon_schema_usage: true, ledger_read: true, ledger_insert: true, ledger_lock: true, ledger_exists: true, function_exists: false, unexpected_anon_inheritor: false, unexpected_default_execute: false }] } : { rows: [] }) };
  await expect(preflightHealthOnly(client)).rejects.toThrow(/preflight rejected/);
  expect(client.query.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['BEGIN READ ONLY', 'ROLLBACK']));
  expect(client.query.mock.calls.some(call => /^\s*(INSERT|CREATE FUNCTION|COMMIT)\b/.test(call[0]))).toBe(false);
});

test.each(['anon_schema_usage', 'ledger_lock'])('read-only preflight rejects missing %s', async key => {
  const state = { read_only: 'on', executor: 'owner', session: 'owner', database_owner: 'owner', schema_create: true, anon_schema_usage: true, ledger_read: true, ledger_insert: true, ledger_lock: true, ledger_exists: false, function_exists: false, unexpected_anon_inheritor: false, unexpected_default_execute: false };
  state[key] = false;
  const client = { query: jest.fn(async sql => sql.includes('AS read_only') ? { rows: [state] } : { rows: [] }) };
  await expect(preflightHealthOnly(client)).rejects.toThrow(/preflight rejected/);
  expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});

function fakeClient(failure) {
  return { query: jest.fn(async sql => {
    if (sql.includes('AS executor')) return { rows: [{ executor: 'owner', session: 'owner', database_owner: 'owner', schema_create: true, ledger_read: true, ledger_insert: true }] };
    if (sql.includes('AS ledger_exists')) return { rows: [{ ledger_exists: false, function_exists: false }] };
    if (sql.includes('AS result_type')) return { rows: [{ prosecdef: false, provolatile: 's', lanname: 'sql', result_type: 'boolean', proconfig: ['search_path=""'], constant_true: true, database_owner: true, schema_usage: true, anon_execute: true, authenticated_execute: false, service_execute: false, public_execute: false, unexpected_execute: false, unexpected_anon_inheritor: false }] };
    if (sql.startsWith('INSERT INTO') && failure === 'ledger') throw new Error('injected ledger error');
    if (sql.startsWith('SELECT count(*)')) return { rows: [{ count: 1 }] };
    if (sql === 'COMMIT' && failure === 'commit') throw new Error('connection lost');
    return { rows: [] };
  }) };
}

function reviewedBytes() {
  return execFileSync('git', ['show', 'HEAD:supabase/migrations/20261029090000_platform_health_rest_database_probe.sql']);
}

test('ledger failure rolls back without committing', async () => {
  const client = fakeClient('ledger');
  await expect(applyHealthOnly(client, reviewedBytes())).rejects.toThrow(/injected ledger error/);
  const calls = client.query.mock.calls.map(call => call[0]);
  expect(calls).toContain('ROLLBACK');
  expect(calls).not.toContain('COMMIT');
});

test('a lost COMMIT response is not retried or reported as rollback', async () => {
  const client = fakeClient('commit');
  await expect(applyHealthOnly(client, reviewedBytes())).rejects.toThrow(/COMMIT outcome unknown/);
  const calls = client.query.mock.calls.map(call => call[0]);
  expect(calls.filter(call => call === 'COMMIT')).toHaveLength(1);
  expect(calls).not.toContain('ROLLBACK');
});

test('a failed post-COMMIT read-back is reported without claiming rollback', async () => {
  const client = fakeClient();
  await expect(applyHealthOnly(client, reviewedBytes())).rejects.toThrow(/COMMIT acknowledged but read-back failed/);
  const calls = client.query.mock.calls.map(call => call[0]);
  expect(calls.filter(call => call === 'COMMIT')).toHaveLength(1);
  expect(calls).not.toContain('ROLLBACK');
});
