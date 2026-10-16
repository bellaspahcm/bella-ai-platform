import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertExecutionIdentity } from './execution-identity.mjs';

test('database identity must match both authenticated session and current executor', async () => {
  const calls = [];
  await assertExecutionIdentity({ query: async sql => {
    calls.push(sql);
    return { rows: [{ actor: 'bella_migration_executor', session_actor: 'bella_migration_executor' }] };
  } }, 'bella_migration_executor');
  assert.deepEqual(calls, ['SELECT current_user AS actor, session_user AS session_actor']);
});

for (const identity of [
  { actor: 'postgres', session_actor: 'postgres' },
  { actor: 'bella_migration_executor', session_actor: 'postgres' },
  { actor: 'postgres', session_actor: 'bella_migration_executor' },
  {}, undefined
]) {
  test(`mismatched or missing database identity fails closed: ${JSON.stringify(identity)}`, async () => {
    await assert.rejects(() => assertExecutionIdentity({ query: async () => ({ rows: identity ? [identity] : [] }) },
      'bella_migration_executor'), { code: 'EXECUTOR_DATABASE_IDENTITY_MISMATCH' });
  });
}

test('database errors propagate without granting authority', async () => {
  const error = new Error('read unavailable');
  await assert.rejects(() => assertExecutionIdentity({ query: async () => { throw error; } },
    'bella_migration_executor'), error);
});

test('identity checks precede token writes and execution transaction remains bounded', () => {
  const wrapper = readFileSync(new URL('execute-migration-wrapper.mjs', import.meta.url), 'utf8');
  const executor = readFileSync(new URL('migration-executor.mjs', import.meta.url), 'utf8');
  assert.ok(wrapper.indexOf('await assertExecutionIdentity(') < wrapper.indexOf('await issueGateToken('));
  assert.ok(executor.indexOf('await assertExecutionIdentity(') < executor.indexOf('await validateGateToken('));
  assert.ok(executor.indexOf('await validateGateToken(') < executor.indexOf('await consumeGateToken('));
  assert.ok(executor.indexOf("await db.query('BEGIN')") < executor.indexOf('await db.query(migration_content)'));
  assert.ok(executor.indexOf('await db.query(migration_content)') < executor.indexOf("await db.query('COMMIT')"));
  assert.ok(executor.includes("await db.query('ROLLBACK')"));
});
