import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { persistenceDiagnostic } from './persistence-diagnostic.mjs';

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
