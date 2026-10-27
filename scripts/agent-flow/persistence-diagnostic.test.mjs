import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { persistenceDiagnostic } from './persistence-diagnostic.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';

const context = () => ({ operation: 'facts.ingest', role: 'BUILDER', binding: { repository: 'bellaspahcm/bella-ai-platform', taskId: randomUUID(), runId: randomUUID(), attempt: 1, producerInstanceId: randomUUID(), threadId: randomUUID(), sessionId: null, turnId: randomUUID() }, method: 'item/completed', itemId: 'diagnostic-item' });

test('actual exclusive-write failure retains operation/system code without raw path or error text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bella-persistence-diagnostic-'));
  try {
    const file = join(dir, 'existing.json'); const handle = await open(file, 'wx'); await handle.close();
    let original; try { await open(file, 'wx'); } catch (error) { original = error; }
    assert.equal(original?.code, 'EEXIST');
    const d = persistenceDiagnostic(original, { ...context(), operation: 'context.write' });
    assert.equal(d.causeCode, 'EEXIST'); assert.equal(d.operation, 'context.write');
    assert.equal(d.source, 'COLLECTOR_FAILURE_OBSERVATION');
    assert.equal(JSON.stringify(d).includes(dir), false);
    assert.equal(d.rawDiagnosticsRetained, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('safe domain guards remain distinct from system errors; unknown text is not saved', () => {
  const c = context();
  const authority = persistenceDiagnostic(new Error('TELEMETRY_ACCESS_DENIED'), c);
  assert.equal(authority.causeCode, 'TELEMETRY_ACCESS_DENIED');
  assert.equal(authority.causeClass, 'STORE_GUARD_OR_AUTHORITY');
  const error = Object.assign(new Error('PASSWORD=private diagnostic'), { code: 'SECRET_CREDENTIAL_VALUE', stack: 'private stack' });
  const unknown = persistenceDiagnostic(error, c);
  assert.equal(unknown.causeCode, 'UNKNOWN_CAUSE');
  for (const secret of ['PASSWORD', 'private diagnostic', 'SECRET_CREDENTIAL_VALUE', 'private stack']) assert.equal(JSON.stringify(unknown).includes(secret), false);
});

test('diagnostic cannot use fabricated activity or unbound lifecycle context', () => {
  for (const edit of [{ operation: 'rewrite-store' }, { role: 'admin' }, { binding: {} }, { method: 'invented/event' }, { itemId: '../outside' }]) assert.throws(() => persistenceDiagnostic(new Error('EIO'), { ...context(), ...edit }));
});

test('collector retains the safe authority stage/cause from an actual denied authority call', async () => {
  let denied;
  try {
    await authorizeRepository(REPOSITORY, async endpoint => {
      if (endpoint === 'user') return { login: 'fixture-operator' };
      throw Object.assign(new Error('private provider details'), { code: 'ETIMEDOUT', stderr: 'Bearer fixture-only-secret', stdout: 'private provider stdout' });
    });
  } catch (error) { denied = error; }
  assert.equal(denied?.message, 'TELEMETRY_ACCESS_DENIED');
  const d = persistenceDiagnostic(denied, context());
  assert.equal(d.causeCode, 'TELEMETRY_ACCESS_DENIED');
  assert.equal(d.causeClass, 'STORE_GUARD_OR_AUTHORITY');
  assert.equal(d.source, 'COLLECTOR_FAILURE_OBSERVATION');
  assert.deepEqual(d.authorityFailure, { stage: 'GRANT_LOOKUP', cause: 'PROVIDER_TIMEOUT' });
  assert.equal(d.rawDiagnosticsRetained, false);
  for (const text of ['private', 'Bearer', 'fixture-only-secret', 'fixture-operator', 'stderr', 'stdout', 'ETIMEDOUT']) {
    assert.equal(JSON.stringify(d).includes(text), false);
  }
});

test('collector allowlists optional authority diagnostics and keeps old/system observations compatible', () => {
  const c = context();
  const old = persistenceDiagnostic(new Error('TELEMETRY_ACCESS_DENIED'), c);
  assert.equal(Object.hasOwn(old, 'authorityFailure'), false);
  const system = persistenceDiagnostic(Object.assign(new Error('EIO'), {
    code: 'EIO', authorityFailure: { stage: 'ACTOR_LOOKUP', cause: 'PROVIDER_TIMEOUT' },
  }), c);
  assert.equal(system.causeCode, 'EIO');
  assert.equal(system.causeClass, 'SYSTEM_ERROR');
  assert.equal(Object.hasOwn(system, 'authorityFailure'), false);

  const valid = { stage: 'PERMISSION_CHECK', cause: 'PERMISSION_REJECTED' };
  const projected = persistenceDiagnostic(Object.assign(new Error('TELEMETRY_ACCESS_DENIED'), { authorityFailure: valid }), c);
  assert.deepEqual(projected.authorityFailure, valid);
  assert.notEqual(projected.authorityFailure, valid);
  for (const authorityFailure of [null, [], 'private custom reason', {},
    { stage: 'https://private-provider.invalid', cause: 'PROVIDER_TIMEOUT' },
    { stage: 'ACTOR_LOOKUP', cause: 'Bearer fixture-only-secret' },
    { stage: 'ACTOR_LOOKUP', cause: 'PROVIDER_TIMEOUT', stderr: 'private raw diagnostics' },
    { stage: 'ACTOR_LOOKUP' },
    { stage: 'PERMISSION_CHECK', cause: 'PROVIDER_TIMEOUT' },
    { stage: 'ACTOR_LOOKUP', cause: 'PERMISSION_REJECTED' },
    { stage: {}, cause: 'PROVIDER_TIMEOUT' },
    { stage: '__proto__', cause: 'PROVIDER_TIMEOUT' },
  ]) {
    const d = persistenceDiagnostic(Object.assign(new Error('TELEMETRY_ACCESS_DENIED'), { authorityFailure }), c);
    assert.equal(Object.hasOwn(d, 'authorityFailure'), false);
    for (const text of ['private', 'Bearer', 'fixture-only-secret', 'stderr']) assert.equal(JSON.stringify(d).includes(text), false);
  }
});
