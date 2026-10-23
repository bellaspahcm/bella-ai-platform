import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, reconcile, approvedOutput, DAY_MS } from './contract.mjs';
import { DevelopmentStore, createPrivateDirectory, enforceReviewRetention } from './store.mjs';
import { verifyLifecycle } from './readback.mjs';
import { persistenceDiagnostic } from './persistence-diagnostic.mjs';

// Expectations below follow approved retention, provenance and security invariants.
// These are protocol fixtures, not claims of live Codex execution.
const binding = { repository: REPOSITORY, taskId: 'task-1', runId: 'run-1', attempt: 1, producerInstanceId: 'producer-1', threadId: 'thread-1', sessionId: 'session-1', turnId: 'turn-1' };
const nonce = 'BELLA_BATCH1_0123456789abcdef01234567';
const start = Date.parse('2026-10-15T00:00:00.000Z');
const safeOutput = `${nonce}\nUTC=2026-10-15T00:00:00.000Z\nASSERT_19_PLUS_23_EQ_42=PASS\n`;
const command = { type: 'commandExecution', id: 'exec-1', status: 'completed', exitCode: 0, aggregatedOutput: safeOutput, command: 'DO_NOT_PERSIST_ARGUMENTS', cwd: 'DO_NOT_PERSIST_PATH' };
const message = (item = command, method = 'item/completed') => ({ method, params: { threadId: 'thread-1', turnId: 'turn-1', completedAtMs: start, item } });
const normalized = (item = command, method = 'item/completed') => normalizeNotification(message(item, method), binding, new Date(start).toISOString(), nonce);
const authorize = async repository => { assert.equal(repository, REPOSITORY); return { repository, actor: 'fixture-admin' }; };

async function withStore(action) {
  const dir = await createPrivateDirectory();
  let now = start;
  const store = new DevelopmentStore(dir, binding, { authorize, nonce, clock: () => now });
  try { await action(store, dir, value => { now = value; }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('authority uses authenticated GitHub actor and existing BDGF dev admin policy', async () => {
  const calls = [];
  const result = await authorizeRepository(REPOSITORY, async endpoint => {
    calls.push(endpoint);
    return endpoint === 'user' ? { login: 'actual-operator' } : { user: { login: 'actual-operator' }, permission: 'admin' };
  });
  assert.equal(result.actor, 'actual-operator');
  assert.deepEqual(calls, ['user', `repos/${REPOSITORY}/collaborators/actual-operator/permission`]);
});

test('wrong repository is denied without invoking authority provider', async () => {
  await assert.rejects(authorizeRepository('other/project', async () => { assert.fail('must not query'); }), /SCOPE_DENIED/);
});

test('tenant role, write-only GitHub access, identity mismatch and provider failure never authorize', async () => {
  for (const grant of [{ permission: 'write', user: { login: 'operator' } }, { role: 'super_admin', user: { login: 'operator' } }, { permission: 'admin', user: { login: 'another' } }]) {
    await assert.rejects(authorizeRepository(REPOSITORY, async path => path === 'user' ? { login: 'operator' } : grant), /ACCESS_DENIED/);
  }
  await assert.rejects(authorizeRepository(REPOSITORY, async () => { throw new Error('sensitive diagnostics'); }), error => error.message === 'TELEMETRY_ACCESS_DENIED');
});

test('authority distinguishes unavailable GitHub lookups without retaining provider diagnostics', async () => {
  for (const unavailableEndpoint of ['user', `repos/${REPOSITORY}/collaborators/operator/permission`]) {
    const calls = [];
    const original = Object.assign(new Error('GITHUB_AUTHORITY_UNAVAILABLE'), {
      stderr: 'sensitive-provider-detail', cause: new Error('sensitive-provider-detail'), stack: 'sensitive-provider-detail',
    });
    await assert.rejects(authorizeRepository(REPOSITORY, async endpoint => {
      calls.push(endpoint);
      if (endpoint === unavailableEndpoint) throw original;
      return { login: 'operator' };
    }), error => {
      assert.equal(error.message, 'GITHUB_AUTHORITY_UNAVAILABLE');
      assert.notEqual(error, original);
      assert.deepEqual(Object.keys(error), []);
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes('sensitive-provider-detail'), false);
      const diagnostic = persistenceDiagnostic(error, { operation: 'facts.ingest', role: 'LEAD', binding, method: 'turn/started', observedAt: new Date(start).toISOString() });
      assert.equal(diagnostic.causeCode, 'GITHUB_AUTHORITY_UNAVAILABLE');
      assert.equal(diagnostic.rawDiagnosticsRetained, false);
      assert.equal(JSON.stringify(diagnostic).includes('sensitive-provider-detail'), false);
      return true;
    });
    assert.equal(calls.at(-1), unavailableEndpoint);
    assert.equal(calls.length, unavailableEndpoint === 'user' ? 1 : 2);
  }
});

test('authority sanitizes unknown failures rather than accepting arbitrary provider error codes', async () => {
  for (const failure of [null, 'sensitive-provider-detail', new Error('GITHUB_AUTHORITY_UNAVAILABLE sensitive-provider-detail'), Object.assign(new Error('sensitive-provider-detail'), { code: 'GITHUB_AUTHORITY_UNAVAILABLE' })]) {
    await assert.rejects(authorizeRepository(REPOSITORY, async () => { throw failure; }), error => {
      assert.equal(error.message, 'TELEMETRY_ACCESS_DENIED');
      assert.deepEqual(Object.keys(error), []);
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes('sensitive-provider-detail'), false);
      return true;
    });
  }
});

test('normalization preserves separate identities/source timestamps and removes arguments/paths', () => {
  const f = normalized();
  assert.equal(f.taskId, 'task-1'); assert.equal(f.runId, 'run-1'); assert.equal(f.threadId, 'thread-1'); assert.equal(f.turnId, 'turn-1');
  assert.equal(f.sourceTimestamp, '2026-10-15T00:00:00.000Z');
  assert.equal(f.sourceKind, 'live_notification');
  assert.equal(JSON.stringify(f).includes('DO_NOT_PERSIST'), false);
  assert.equal(f.exitCode, 0);
});

test('unknown methods, deltas, reasoning, prompts and other threads/turns are excluded', () => {
  for (const method of ['item/agentMessage/delta', 'item/reasoning/textDelta', 'rawResponseItem/completed', 'unknown']) {
    assert.equal(normalizeNotification(message(command, method), binding, new Date(start).toISOString(), nonce), null);
  }
  for (const type of ['reasoning', 'userMessage']) assert.equal(normalized({ ...command, type }), null);
  assert.equal(normalizeNotification({ ...message(), params: { ...message().params, turnId: 'other' } }, binding, new Date(start).toISOString(), nonce), null);
  assert.equal(normalizeNotification({ ...message(), params: { ...message().params, threadId: 'other' } }, binding, new Date(start).toISOString(), nonce), null);
  assert.equal(JSON.stringify(normalized({ type: 'agentMessage', id: 'msg-1', text: 'customer transcript' })).includes('customer transcript'), false);
});

test('output is default-denied; unknown text, credentials and customer data fail closed', () => {
  for (const raw of ['hello', 'Bearer fake-fixture-token', safeOutput + 'customer: fixture@example.test', safeOutput + 'password=fixture']) {
    assert.equal(approvedOutput(raw, nonce), null);
    const f = normalized({ ...command, aggregatedOutput: raw });
    assert.equal(f.output, null); assert.equal(f.collectionError, 'OUTPUT_NOT_ALLOWLISTED');
    assert.equal(JSON.stringify(f).includes(raw), false);
  }
  assert.equal(normalizeNotification(message(), binding, new Date(start).toISOString()).output, null);
  assert.equal(approvedOutput(safeOutput, nonce).text, safeOutput);
});

test('private external persistence survives new instance; duplicate collapses without losing changed revision', async () => {
  await withStore(async (store, dir) => {
    const checkAck = (actual, duplicate, revision, sequence) => {
      assert.equal(actual.duplicate, duplicate); assert.equal(actual.revision, revision); assert.equal(actual.sequence, sequence);
      assert.match(actual.digest, /^[a-f0-9]{64}$/); assert.equal(actual.acknowledgedAt, new Date(start).toISOString());
    };
    checkAck(await store.ingest(normalized()), false, 1, 1);
    checkAck(await store.ingest({ ...normalized(), receivedAt: new Date(start + 1).toISOString() }), true, 1, 1);
    checkAck(await store.ingest(normalized({ ...command, exitCode: 1, status: 'failed' })), false, 2, 2);
    checkAck(await store.ingest(normalized()), true, 1, 1);
    const reader = new DevelopmentStore(dir, binding, { authorize, nonce, clock: () => start });
    const rows = await reader.read();
    assert.equal(rows.length, 2); assert.equal(rows[0].fact.exitCode, 0); assert.equal(rows[1].fact.exitCode, 1);
    const raw = await readFile(join(dir, 'facts.json'), 'utf8');
    assert.equal(raw.includes('DO_NOT_PERSIST'), false);
    assert.equal(raw.includes('aggregatedOutput'), false);
  });
});

test('status A -> B -> A is retained; consecutive repeated status collapses', async () => {
  await withStore(async store => {
    const status = type => normalizeNotification({ method: 'thread/status/changed', params: { threadId: binding.threadId, status: { type } } }, binding, new Date(start).toISOString());
    for (const value of ['active', 'active', 'idle', 'active']) await store.ingest(status(value));
    assert.deepEqual((await store.read()).map(r => r.fact.status), ['active', 'idle', 'active']);
  });
});

test('scope mismatch, injected fields and unsafe output are rejected', async () => {
  await withStore(async (store, dir) => {
    await assert.rejects(store.ingest({ ...normalized(), repository: 'other/project' }), /INVALID_STORED_FACT/);
    await assert.rejects(store.ingest({ ...normalized(), prompt: 'do not store' }), /INVALID_STORED_FACT/);
    await assert.rejects(store.ingest({ ...normalized(), output: { text: 'unsafe', sha256: 'fake' } }), /UNSAFE_OUTPUT/);
    await store.ingest(normalized());
    const wrongScopeReader = new DevelopmentStore(dir, { ...binding, runId: 'different-run' }, { authorize, nonce, clock: () => start });
    await assert.rejects(wrongScopeReader.read(), /SCOPE_MISMATCH/);
  });
});

test('authorization occurs before filesystem read on every operation', async () => {
  const dir = join(tmpdir(), 'bella-agent-flow-DoesNotExist');
  for (const expected of ['GITHUB_AUTHORITY_UNAVAILABLE', 'TELEMETRY_ACCESS_DENIED']) {
    let calls = 0;
    const store = new DevelopmentStore(dir, binding, { nonce, authorize: repository => {
      calls++;
      return authorizeRepository(repository, async endpoint => {
        if (expected === 'GITHUB_AUTHORITY_UNAVAILABLE') throw new Error(expected);
        return endpoint === 'user' ? { login: 'operator' } : { user: { login: 'operator' }, permission: 'write' };
      });
    } });
    for (const operation of [() => store.read(), () => store.ingest(normalized()), () => store.destroy()]) {
      await assert.rejects(operation(), error => error.message === expected);
    }
    assert.equal(calls, 3);
  }
});

test('output expires at exactly 7 days; metadata expires at exactly 14, with physical operation-time purge', async () => {
  await withStore(async (store, dir, setNow) => {
    await store.ingest(normalized());
    setNow(start + 7 * DAY_MS - 1);
    assert.equal((await store.read())[0].fact.output.text, safeOutput);
    setNow(start + 7 * DAY_MS);
    const row = (await store.read())[0];
    assert.equal(row.fact.output, null); assert.equal(row.outputState, 'EXPIRED');
    assert.equal((await readFile(join(dir, 'facts.json'), 'utf8')).includes(nonce), false);
    setNow(start + 14 * DAY_MS - 1); assert.equal((await store.read()).length, 1);
    setNow(start + 14 * DAY_MS); assert.deepEqual(await store.read(), []);
    await assert.rejects(readFile(join(dir, 'facts.json'), 'utf8'), { code: 'ENOENT' });
  });
});

test('history stays a snapshot; match, missing history/live and conflict are explicit', async () => {
  const live = normalized();
  const snapshot = normalizeHistory({ turnId: binding.turnId, item: command, completedAtMs: start }, binding, new Date(start).toISOString(), nonce);
  assert.equal(snapshot.method, 'history.item'); assert.equal(snapshot.sourceKind, 'history_snapshot');
  assert.deepEqual(reconcile([{ fact: live }, { fact: snapshot }]), [{ itemId: 'exec-1', result: 'MATCH' }]);
  assert.deepEqual(reconcile([{ fact: live }]), [{ itemId: 'exec-1', result: 'MISSING_HISTORY' }]);
  assert.deepEqual(reconcile([{ fact: snapshot }]), [{ itemId: 'exec-1', result: 'MISSING_LIVE' }]);
  assert.deepEqual(reconcile([{ fact: live }, { fact: { ...snapshot, exitCode: 2 } }]), [{ itemId: 'exec-1', result: 'CONFLICT' }]);
  for (const output of ['', 'unknown history output', safeOutput + 'secret=fixture']) {
    const incomplete = normalizeHistory({ turnId: binding.turnId, item: { ...command, aggregatedOutput: output } }, binding, new Date(start).toISOString(), nonce);
    assert.deepEqual(reconcile([{ fact: live }, { fact: incomplete }]), [{ itemId: 'exec-1', result: 'CONFLICT' }]);
  }
  await withStore(async store => {
    await store.ingest(live); await store.ingest({ ...snapshot, exitCode: 2 });
    assert.equal((await store.read()).length, 2);
    assert.equal(reconcile(await store.read())[0].result, 'CONFLICT');
  });
});

for (const field of ['repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'sessionId', 'threadId', 'turnId']) {
  for (const kind of ['item', 'turn']) {
    test(`reconciliation isolates different ${field} with ${kind === 'item' ? 'colliding itemId' : 'null turn itemId'}`, () => {
      const receivedAt = new Date(start).toISOString();
      const live = kind === 'item' ? normalized() : normalizeNotification({
        method: 'turn/completed',
        params: { threadId: binding.threadId, turn: { id: binding.turnId, status: 'completed' }, completedAtMs: start },
      }, binding, receivedAt);
      const otherBinding = { ...binding, [field]: field === 'repository' ? 'other/project' : field === 'attempt' ? 2 : `other-${field}` };
      const snapshot = kind === 'item'
        ? normalizeHistory({ turnId: otherBinding.turnId, item: command, completedAtMs: start }, otherBinding, receivedAt, nonce)
        : normalizeHistoryTurn({ id: otherBinding.turnId, status: 'completed', completedAt: start / 1000 }, otherBinding, receivedAt);
      const itemId = kind === 'item' ? command.id : null;
      assert.deepEqual(reconcile([{ fact: live }, { fact: snapshot }]), [
        { itemId, result: 'MISSING_HISTORY' },
        { itemId, result: 'MISSING_LIVE' },
      ]);
    });
  }
}

test('canonical store accepts equal binding fields irrespective of object property order', async () => {
  await withStore(async (store, dir) => {
    await store.ingest(normalized());
    const reversed = Object.fromEntries(Object.entries(binding).reverse());
    const rows = await new DevelopmentStore(dir, reversed, { authorize, nonce, clock: () => start }).read();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fact.runId, binding.runId);
    await assert.rejects(new DevelopmentStore(dir, { ...reversed, attempt: 2 }, { authorize, nonce, clock: () => start }).read(), /STORE_SCOPE_MISMATCH/);
  });
});

test('same-scope completed turn reconciles with unchanged null item result', () => {
  const receivedAt = new Date(start).toISOString();
  const live = normalizeNotification({
    method: 'turn/completed',
    params: { threadId: binding.threadId, turn: { id: binding.turnId, status: 'completed' }, completedAtMs: start },
  }, binding, receivedAt);
  const snapshot = normalizeHistoryTurn({ id: binding.turnId, status: 'completed', completedAt: start / 1000 }, binding, receivedAt);
  assert.deepEqual(reconcile([{ fact: live }, { fact: snapshot }]), [{ itemId: null, result: 'MATCH' }]);
});

test('turn history validates identity and does not invent a started event', () => {
  assert.equal(normalizeHistoryTurn({ id: 'other', status: 'completed' }, binding, new Date(start).toISOString()), null);
  const f = normalizeHistoryTurn({ id: binding.turnId, status: 'completed', completedAt: start / 1000 }, binding, new Date(start).toISOString());
  assert.equal(f.method, 'history.turn'); assert.equal(f.itemId, null); assert.equal(f.sourceKind, 'history_snapshot');
});

test('store creation rejects repository paths and conflated launcher identities', () => {
  assert.throws(() => new DevelopmentStore(process.cwd(), binding), /EXTERNAL_PRIVATE_STORE/);
  assert.throws(() => new DevelopmentStore(join(tmpdir(), 'bella-agent-flow-test'), { ...binding, taskId: 'run-1' }), /INVALID_LIFECYCLE_BINDING/);
  assert.throws(() => new DevelopmentStore(join(tmpdir(), 'bella-agent-flow-test'), { ...binding, prompt: 'unapproved' }), /INVALID_LIFECYCLE_BINDING/);
  assert.throws(() => new DevelopmentStore(join(tmpdir(), 'bella-agent-flow-test'), { ...binding, sessionId: 'customer@fixture.test' }), /INVALID_LIFECYCLE_BINDING/);
});

test('expired command output never produces evidence MATCH', async () => {
  await withStore(async (store, _, setNow) => {
    await store.ingest(normalized());
    await store.ingest(normalizeHistory({ turnId: binding.turnId, item: command }, binding, new Date(start).toISOString(), nonce));
    setNow(start + 7 * DAY_MS);
    assert.deepEqual(reconcile(await store.read()), [{ itemId: 'exec-1', result: 'OUTPUT_EXPIRED' }]);
  });
});

test('oversized append fails without replacing a readable store', async () => {
  await withStore(async store => {
    await store.ingest(normalized());
    await assert.rejects(store.operation(data => {
      const row = data.records[0];
      data.records.push(...Array.from({ length: 3000 }, () => structuredClone(row)));
    }), /PROOF_STORE_LIMIT/);
    assert.equal((await store.read()).length, 1);
  });
});

test('restart recovers a dead writer lock; never steals a live writer lock', async () => {
  await withStore(async (store, dir) => {
    await store.ingest(normalized());
    const exited = spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
    assert.equal(exited.status, 0);
    await writeFile(join(dir, 'store.lock'), String(exited.pid));
    assert.equal((await store.read()).length, 1);
    await writeFile(join(dir, 'store.lock'), String(process.pid));
    await assert.rejects(store.read(), /STORE_BUSY/);
  });
});

test('ack is independently readable after the writer process exits', async () => {
  await withStore(async (store, dir) => {
    const storeUrl = pathToFileURL(join(process.cwd(), 'scripts/agent-flow/store.mjs')).href;
    const shared = `import {DevelopmentStore} from ${JSON.stringify(storeUrl)};const s=new DevelopmentStore(${JSON.stringify(dir)},${JSON.stringify(binding)},{nonce:${JSON.stringify(nonce)},authorize:async()=>({}),clock:()=>${start}});`;
    const writer = spawnSync(process.execPath, ['--input-type=module', '-e', shared + `console.log(JSON.stringify(await s.ingest(${JSON.stringify(normalized())})));`], { encoding: 'utf8', windowsHide: true });
    assert.equal(writer.status, 0, writer.stderr);
    const ack = JSON.parse(writer.stdout);
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', shared + 'console.log(JSON.stringify(await s.read()));'], { encoding: 'utf8', windowsHide: true });
    assert.equal(reader.status, 0, reader.stderr);
    const rows = JSON.parse(reader.stdout);
    assert.equal(rows.length, 1); assert.equal(rows[0].digest, ack.digest); assert.equal(ack.sequence, 1);
    assert.equal(rows[0].fact.output.text, safeOutput);
  });
});

test('independent lifecycle checker requires ordered events, exact ack and actual expected exit', async () => {
  await withStore(async store => {
    const liveFacts = [
      normalizeNotification({ method: 'turn/started', params: { threadId: binding.threadId, turn: { id: binding.turnId, status: 'inProgress' }, startedAtMs: start } }, binding, new Date(start).toISOString()),
      normalized({ ...command, status: 'inProgress', exitCode: null, aggregatedOutput: null }, 'item/started'),
      normalized(),
      normalizeNotification({ method: 'turn/completed', params: { threadId: binding.threadId, turn: { id: binding.turnId, status: 'completed' }, completedAtMs: start } }, binding, new Date(start).toISOString()),
    ];
    const acknowledgements = [];
    for (const f of liveFacts) acknowledgements.push(await store.ingest(f));
    const writer = { scenario: 'success', acknowledgements, duplicateCollapsed: true, command: { itemId: command.id, outputHash: liveFacts[2].output.sha256 } };
    const rows = await store.read();
    assert.equal(verifyLifecycle(rows, writer).order, 'PASS');
    assert.throws(() => verifyLifecycle([rows[2], rows[0], rows[1], rows[3]], writer), /LIFECYCLE_ORDER_INVALID/);
    assert.throws(() => verifyLifecycle(rows, { ...writer, scenario: 'failed-tool' }), /READBACK_COMMAND_MISMATCH/);
    assert.throws(() => verifyLifecycle(rows, { ...writer, acknowledgements: acknowledgements.slice(1) }), /ACK_COUNT_MISMATCH/);
    assert.throws(() => verifyLifecycle(rows, { ...writer, acknowledgements: acknowledgements.map(a => ({ ...a, digest: 'forged' })) }), /ACK_SEQUENCE_MISMATCH/);
  });
});

test('retained-package expiry purges companion output/metadata before reader rejection', async () => {
  await withStore(async (store, dir, setNow) => {
    await store.ingest(normalized());
    await writeFile(join(dir, 'context.json'), JSON.stringify({ createdAt: new Date(start).toISOString(), outputReviewDeadline: new Date(start + 7 * DAY_MS).toISOString() }));
    await writeFile(join(dir, 'reader-fixture.json'), JSON.stringify({ output: safeOutput }));
    await writeFile(join(dir, 'writer-result.json'), JSON.stringify({ metadata: binding }));
    await enforceReviewRetention(dir, start + 7 * DAY_MS - 1);
    setNow(start + 7 * DAY_MS);
    await assert.rejects(store.read(), /REVIEW_WINDOW_EXPIRED/);
    await assert.rejects(readFile(join(dir, 'reader-fixture.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(dir, 'context.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(dir, 'writer-result.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(dir, 'facts.json')), { code: 'ENOENT' });
  });
});

test('interrupted writer leaves committed facts readable after real process death', async () => {
  await withStore(async (store, dir) => {
    await store.ingest(normalized());
    const url = pathToFileURL(join(process.cwd(), 'scripts/agent-flow/store.mjs')).href;
    const code = `import {DevelopmentStore} from ${JSON.stringify(url)};const s=new DevelopmentStore(${JSON.stringify(dir)},${JSON.stringify(binding)},{nonce:${JSON.stringify(nonce)},authorize:async()=>({}),clock:()=>${start}});await s.operation(()=>{console.log('LOCK_HELD');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let timer;
    try {
      await new Promise((resolveReady, reject) => {
        timer = setTimeout(() => reject(new Error('writer lock timeout')), 5000);
        child.stdout.once('data', data => data.toString().includes('LOCK_HELD') ? resolveReady() : reject(new Error('unexpected writer output')));
        child.once('error', reject);
      });
      clearTimeout(timer);
      const closed = new Promise(resolveExit => child.once('close', resolveExit));
      child.kill(); await closed;
      const rows = await store.read();
      assert.equal(rows.length, 1); assert.equal(rows[0].fact.output.text, safeOutput);
    } finally { clearTimeout(timer); child.kill(); }
  });
});
