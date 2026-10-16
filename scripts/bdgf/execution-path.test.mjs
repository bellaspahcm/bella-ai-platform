import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, beforeEach, test } from 'node:test';
import pg from 'pg';

// Unit-only database double. No network, real approvals or deployment proof.
const originalClient = pg.Client;
const savedEnv = Object.fromEntries(['DATABASE_EXECUTOR_URL', 'GATE_SIGNING_KEY_FROM_SECRETS_MANAGER',
  'BDGF_USE_SECRETS_MANAGER'].map(key => [key, process.env[key]]));
process.env.DATABASE_EXECUTOR_URL = 'postgresql://bella_migration_executor:synthetic@localhost:5432/postgres';
process.env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER = randomBytes(32).toString('hex');
process.env.BDGF_USE_SECRETS_MANAGER = 'false';
let state;

class DatabaseDouble {
  constructor(config) {
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.servername, 'localhost');
    assert.equal(config.connectionString, undefined);
  }
  async connect() {}
  async end() {}
  async query(sql, values = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    state.calls.push(normalized);
    if (normalized === 'SELECT current_user AS actor, session_user AS session_actor') {
      return { rows: [{ actor: state.actor, session_actor: state.actor }] };
    }
    if (normalized.startsWith('SELECT * FROM bella_migration_approval')) return { rows: [state.approval] };
    if (normalized.startsWith('INSERT INTO bella_gate_tokens')) {
      const token = { token_id: randomUUID(), approval_id: values[0], nonce: values[7], status: 'issued' };
      state.tokens.set(token.nonce, token);
      return { rows: [{ ...token, issued_at: new Date(), expires_at: new Date(Date.now() + 60000) }] };
    }
    if (normalized.startsWith('SELECT token_id, status, used_at, approval_id FROM bella_gate_tokens')) {
      return { rows: state.tokens.has(values[0]) ? [state.tokens.get(values[0])] : [] };
    }
    if (normalized.startsWith('SELECT approval_id, status, migration_hash FROM bella_migration_approval')) {
      return { rows: [state.approval] };
    }
    if (normalized.startsWith('UPDATE bella_gate_tokens')) {
      const token = state.tokens.get(values[0]);
      if (!token || token.status !== 'issued') return { rows: [] };
      token.status = 'used';
      return { rows: [{ ...token, used_at: new Date() }] };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rows: [] };
    if (sql === state.sql) {
      state.executions += 1;
      if (state.failDdl) throw Object.assign(new Error('synthetic DDL failure'), { code: '42501' });
      return { rows: [], rowCount: 0 };
    }
    throw new Error('Unexpected SQL in the unit-only database double.');
  }
}

pg.Client = DatabaseDouble;
const { computeHash, computeApprovalHash } = await import('./r4-verify-approval.mjs');
const { executeMigration } = await import('./migration-executor.mjs');
const { executeMigrationWithAuthorization } = await import('./execute-migration-wrapper.mjs');
const { issueGateToken } = await import('./gate-token.mjs');

beforeEach(() => {
  const id = randomUUID();
  state = { sql: 'CREATE TABLE bdgf_synthetic_fixture (id integer);', actor: 'bella_migration_executor',
    executions: 0, calls: [], tokens: new Map(), failDdl: false };
  state.approval = { approval_id: id, migration_id: id, migration_hash: computeHash(state.sql),
    approval_mode: 'separated', requester_id: 'synthetic-requester', approver_id: 'synthetic-approver',
    approver_role: 'admin', approved_at: new Date(), expires_at: new Date(Date.now() + 60000),
    target_environment: 'dev', target_schema: 'public', status: 'approved' };
  state.approval.approval_hash = computeApprovalHash(state.approval);
});

after(() => {
  pg.Client = originalClient;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function parameters(overrides = {}) {
  return { migration_content: state.sql, target_environment: 'dev', target_schema: 'public',
    executor_identity: 'bella_migration_executor', ...overrides };
}

async function token() {
  const db = new DatabaseDouble({ ssl: { rejectUnauthorized: true, servername: 'localhost' } });
  return issueGateToken({ approval_id: state.approval.approval_id, migration_id: state.approval.migration_id,
    migration_hash: computeHash(state.sql), target_environment: 'dev', target_schema: 'public',
    executor_identity: 'bella_migration_executor' }, db);
}

test('unit path: actual approval/token/executor functions commit only after bound authorization', async () => {
  const result = await executeMigrationWithAuthorization({ approval_id: state.approval.approval_id, ...parameters() });
  assert.equal(result.execution.status, 'SUCCESS');
  assert.equal(state.executions, 1);
  assert.equal([...state.tokens.values()][0].status, 'used');
  const transaction = state.calls.slice(state.calls.indexOf('BEGIN'));
  assert.deepEqual(transaction, ['BEGIN', state.sql, 'COMMIT']);
});

test('unit path: wrong real database principal cannot issue a token or execute', async () => {
  state.actor = 'postgres';
  await assert.rejects(() => executeMigrationWithAuthorization({ approval_id: state.approval.approval_id, ...parameters() }),
    { code: 'EXECUTOR_DATABASE_IDENTITY_MISMATCH' });
  assert.equal(state.tokens.size, 0);
  assert.equal(state.executions, 0);
  assert.ok(!state.calls.includes('BEGIN'));
});

for (const [name, overrides, reason] of [
  ['hash', { migration_content: 'SELECT 2;' }, 'MIGRATION_HASH_MISMATCH'],
  ['environment', { target_environment: 'staging' }, 'ENVIRONMENT_MISMATCH'],
  ['schema', { target_schema: 'storage' }, 'SCHEMA_MISMATCH'],
  ['identity', { executor_identity: 'other_executor' }, 'EXECUTOR_IDENTITY_MISMATCH']
]) {
  test(`unit path: token ${name} mismatch blocks before consumption and DDL`, async () => {
    const issued = await token();
    if (overrides.executor_identity) state.actor = overrides.executor_identity;
    await assert.rejects(() => executeMigration({ token: issued, ...parameters(overrides) }),
      error => error.code === 'INVALID_TOKEN' && error.details.validation.reason === reason);
    assert.equal([...state.tokens.values()][0].status, 'issued');
    assert.equal(state.executions, 0);
    assert.ok(!state.calls.includes('BEGIN'));
  });
}

test('unit path: a consumed token cannot execute a second transaction', async () => {
  const issued = await token();
  await executeMigration({ token: issued, ...parameters() });
  await assert.rejects(() => executeMigration({ token: issued, ...parameters() }),
    error => error.code === 'INVALID_TOKEN' && error.details.validation.reason === 'TOKEN_ALREADY_USED');
  assert.equal(state.executions, 1);
  assert.equal(state.calls.filter(sql => sql === 'BEGIN').length, 1);
});

test('unit path: DDL failure rolls back but does not resurrect the single-use token', async () => {
  const issued = await token();
  state.failDdl = true;
  await assert.rejects(() => executeMigration({ token: issued, ...parameters() }), /synthetic DDL failure/);
  assert.deepEqual(state.calls.slice(state.calls.indexOf('BEGIN')), ['BEGIN', state.sql, 'ROLLBACK']);
  assert.equal([...state.tokens.values()][0].status, 'used');
});
