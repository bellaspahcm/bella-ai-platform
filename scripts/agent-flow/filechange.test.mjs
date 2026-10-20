import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileChanges } from './filechange-reader.mjs';
import * as contract from './contract.mjs';
import { DevelopmentStore, createPrivateDirectory } from './store.mjs';

// Protocol fixtures only: none of these notifications claim a real Codex run.
const binding = { repository: 'bellaspahcm/bella-ai-platform', taskId: 'task-fc', runId: 'run-fc', attempt: 1, producerInstanceId: 'producer-fc', threadId: 'thread-fc', sessionId: 'thread-fc', turnId: 'turn-fc' };
const now = Date.parse('2026-10-15T07:00:00Z');
const notification = (method = 'item/completed', status = 'completed', itemId = 'change-1') => ({ method, params: { threadId: binding.threadId, turnId: binding.turnId, item: { id: itemId, type: 'fileChange', status, changes: [{ path: 'SECRET_PATH', diff: 'SECRET_PATCH' }] } } });
const live = (method, status, itemId) => contract.normalizeNotification(notification(method, status, itemId), binding, new Date(now).toISOString());
const history = () => contract.normalizeHistory({ turnId: binding.turnId, item: notification().params.item }, binding, new Date(now + 1).toISOString());
const row = fact => ({ fact, digest: contract.signature(fact), key: contract.logicalKey(fact), revision: 1 });
const records = () => [row(live('item/started', 'inProgress')), row(live()), row(history())];

test('fileChange native item identity/status accepted; patch/path payload discarded', () => {
  const fact = live(); assert.ok(fact); assert.equal(fact.itemType, 'fileChange'); assert.equal(fact.itemId, 'change-1');
  assert.equal(JSON.stringify(fact).includes('SECRET'), false); assert.equal(fact.output, null); assert.equal(fact.exitCode, null);
  contract.validateFact(fact, binding);
});
test('fileChange canonical store deduplicates and fresh instance reads identical digest', async () => {
  const dir = await createPrivateDirectory();
  const options = { authorize: async () => ({}), clock: () => now };
  try {
    const store = new DevelopmentStore(dir, binding, options);
    const first = await store.ingest(live()); const duplicate = await store.ingest(live());
    assert.equal(first.duplicate, false); assert.equal(duplicate.duplicate, true); assert.equal(first.digest, duplicate.digest);
    const rows = await new DevelopmentStore(dir, binding, options).read(); assert.equal(rows.length, 1); assert.equal(rows[0].digest, contract.signature(rows[0].fact));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('fileChange store reconciliation validates ordering, digest, and snapshot matching', () => {
  assert.deepEqual(contract.verifyFileChangeRecords(records(), binding), [{ itemId: 'change-1', result: 'MATCH' }]);
});
test('missing live/history and missing or reversed start never match', () => {
  const rows = records();
  assert.equal(contract.verifyFileChangeRecords([rows[2]], binding)[0].result, 'MISSING_LIVE');
  assert.equal(contract.verifyFileChangeRecords(rows.slice(0, 2), binding)[0].result, 'MISSING_HISTORY');
  assert.equal(contract.verifyFileChangeRecords(rows.slice(1), binding)[0].result, 'MISSING_START');
  assert.equal(contract.verifyFileChangeRecords([rows[1], rows[0], rows[2]], binding)[0].result, 'INVALID_ORDER');
  assert.equal(contract.verifyFileChangeRecords([row(live('item/started', 'completed')), rows[1], rows[2]], binding)[0].result, 'INVALID_START_STATUS');
});
test('duplicate same fact tolerated; conflicting duplicate cannot be overwritten by map', () => {
  const rows = records();
  assert.equal(contract.verifyFileChangeRecords([rows[0], rows[1], rows[1], rows[2]], binding)[0].result, 'MATCH');
  const failed = row(live('item/completed', 'failed'));
  assert.equal(contract.verifyFileChangeRecords([rows[0], failed, rows[1], rows[2]], binding)[0].result, 'CONFLICTING_DUPLICATE');
});
test('tampered digest, cross-scope and attempt mismatch rejected', () => {
  const rows = records();
  assert.throws(() => contract.verifyFileChangeRecords([{ ...rows[0], digest: '0'.repeat(64) }], binding), /DIGEST/);
  for (const field of ['taskId', 'runId', 'threadId', 'turnId', 'producerInstanceId']) {
    const fact = { ...rows[0].fact, [field]: 'other' }; assert.throws(() => contract.verifyFileChangeRecords([row(fact)], binding), /INVALID_STORED/);
  }
  assert.throws(() => contract.verifyFileChangeRecords([row({ ...rows[0].fact, attempt: 2 })], binding), /INVALID_STORED/);
  assert.notEqual(contract.signature(rows[0].fact), contract.signature({ ...rows[0].fact, itemId: 'different-item' }));
});
test('fileChange cannot smuggle output, command exit or payload fields', () => {
  const fact = live(); assert.ok(fact);
  for (const injected of [{ exitCode: 0 }, { changes: [] }, { output: { text: 'SECRET_PATCH', sha256: '0'.repeat(64) } }]) assert.throws(() => contract.validateFact({ ...fact, ...injected }, binding));
});
test('writer process exits before independent canonical reader process (protocol fixture)', async () => {
  const writerCode = `
    import {createPrivateDirectory,DevelopmentStore,writeDurableJson} from ${JSON.stringify(new URL('./store.mjs', import.meta.url).href)};
    import {join} from 'node:path';
    const directory=await createPrivateDirectory();const binding=${JSON.stringify(binding)};const facts=${JSON.stringify(records().map(row => row.fact))};
    const store=new DevelopmentStore(directory,binding,{authorize:async()=>({})});
    await writeDurableJson(join(directory,'context.json'),{scope:'filechange-canonical-batch',binding,createdAt:new Date().toISOString(),outputReviewDeadline:new Date(Date.now()+86400000).toISOString(),evidenceClass:'fixture'});
    const acks=[];for(const fact of facts)acks.push(await store.ingest(fact));
    const duplicate=await store.ingest(facts[1]);
    console.log(JSON.stringify({directory,writerPid:process.pid,acks,duplicate}));`;
  const writer = spawnSync(process.execPath, ['--input-type=module', '-e', writerCode], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  assert.equal(writer.status, 0, writer.stderr);
  const saved = JSON.parse(writer.stdout);
  try {
    const before = await readFile(join(saved.directory, 'facts.json'));
    const readerCode = `import {readFileChanges} from ${JSON.stringify(new URL('./filechange-reader.mjs', import.meta.url).href)};console.log(JSON.stringify(await readFileChanges(${JSON.stringify(saved.directory)},{authorize:async()=>({})})));`;
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', readerCode], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    assert.equal(reader.status, 0, reader.stderr); const result = JSON.parse(reader.stdout);
    assert.notEqual(result.readerPid, saved.writerPid); assert.equal(result.evidenceClass, 'PROTOCOL_FIXTURE');
    assert.equal(result.result, 'PASS_FILECHANGE_CANONICAL_READBACK'); assert.equal(result.records, 3);
    assert.equal(saved.duplicate.duplicate, true); assert.deepEqual(saved.acks.map(a => a.sequence), [1, 2, 3]);
    const rows = JSON.parse(before).records; assert.deepEqual(saved.acks.map(a => a.digest), rows.map(row => row.digest));
    assert.deepEqual(await readFile(join(saved.directory, 'facts.json')), before);
  } finally { await rm(saved.directory, { recursive: true, force: true }); }
});
test('reader denies authority before filesystem, refuses prior packages and expiry', async () => {
  await assert.rejects(readFileChanges('not-a-real-path', { authorize: async () => { throw Error('DENIED'); } }), /DENIED/);
  const dir = await createPrivateDirectory();
  try {
    const context = { scope: 'old-batch', binding, createdAt: new Date(now).toISOString(), outputReviewDeadline: new Date(now + 1000).toISOString() };
    await writeFile(join(dir, 'context.json'), JSON.stringify(context));
    await assert.rejects(readFileChanges(dir, { authorize: async () => ({}), clock: () => now }), /BATCH_SCOPE_REQUIRED/);
    context.scope = 'filechange-canonical-batch'; await writeFile(join(dir, 'context.json'), JSON.stringify(context));
    await assert.rejects(readFileChanges(dir, { authorize: async () => ({}), clock: () => now + 1000 }), /EXPIRED/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('reader accepts mixed canonical facts and rejects each tampered digest without rewriting fixtures', async t => {
  const dir = await createPrivateDirectory();
  const options = { authorize: async () => ({}), clock: () => now };
  try {
    const contextPath = join(dir, 'context.json'), factsPath = join(dir, 'facts.json');
    const context = { scope: 'filechange-canonical-batch', binding, createdAt: new Date(now).toISOString(), outputReviewDeadline: new Date(now + 1000).toISOString(), evidenceClass: 'fixture' };
    const receivedAt = new Date(now).toISOString();
    const facts = [
      ...records().map(record => record.fact),
      ...['commandExecution', 'agentMessage'].map(type => contract.normalizeNotification({
        method: 'item/completed', params: { threadId: binding.threadId, turnId: binding.turnId, item: { id: `${type}-1`, type, status: 'completed', ...(type === 'commandExecution' ? { exitCode: 0 } : {}) } },
      }, binding, receivedAt)),
      contract.normalizeNotification({ method: 'turn/completed', params: { threadId: binding.threadId, turn: { id: binding.turnId, status: 'completed' } } }, binding, receivedAt),
    ];
    const data = { binding, records: facts.map(fact => ({ ...row(fact), storedAt: now, metadataExpiresAt: now + 14 * contract.DAY_MS, outputExpiresAt: now + 7 * contract.DAY_MS, outputState: 'ABSENT' })) };
    await writeFile(contextPath, JSON.stringify(context));
    await writeFile(factsPath, JSON.stringify(data));
    const contextBefore = await readFile(contextPath), factsBefore = await readFile(factsPath);
    const result = await readFileChanges(dir, options);
    assert.equal(result.result, 'PASS_FILECHANGE_CANONICAL_READBACK');
    assert.equal(result.records, 3);
    assert.deepEqual(result.reconciliation, [{ itemId: 'change-1', result: 'MATCH' }]);
    assert.deepEqual(await readFile(contextPath), contextBefore);
    assert.deepEqual(await readFile(factsPath), factsBefore);

    for (const [index, record] of data.records.entries()) {
      await t.test(`${record.fact.itemType || 'turn'} ${record.fact.method} digest mismatch is rejected`, async () => {
        const tampered = structuredClone(data);
        const canonicalDigest = contract.signature(record.fact);
        const incorrectDigest = (canonicalDigest[0] === '0' ? '1' : '0') + canonicalDigest.slice(1);
        assert.match(incorrectDigest, /^[a-f0-9]{64}$/);
        assert.notEqual(incorrectDigest, canonicalDigest);
        tampered.records[index].digest = incorrectDigest;
        await writeFile(factsPath, JSON.stringify(tampered));
        const tamperedBefore = await readFile(factsPath);
        await assert.rejects(readFileChanges(dir, options), { message: 'INVALID_STORE_RECORD' });
        assert.deepEqual(await readFile(contextPath), contextBefore);
        assert.deepEqual(await readFile(factsPath), tamperedBefore);
      });
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('reader rejects unauthorized repository and malformed canonical row metadata', async () => {
  const dir = await createPrivateDirectory();
  const options = { authorize: async () => ({}), clock: () => now };
  try {
    const context = { scope: 'filechange-canonical-batch', binding, createdAt: new Date(now).toISOString(), outputReviewDeadline: new Date(now + 1000).toISOString(), evidenceClass: 'fixture' };
    await writeFile(join(dir, 'context.json'), JSON.stringify(context));
    const store = new DevelopmentStore(dir, binding, options);
    for (const record of records()) await store.ingest(record.fact);
    const original = JSON.parse(await readFile(join(dir, 'facts.json'), 'utf8'));
    for (const changed of [{ revision: 0 }, { outputState: 'unknown' }, { outputState: 'AVAILABLE' }, { extra: 'not-canonical' }]) {
      const data = structuredClone(original); Object.assign(data.records[0], changed);
      await writeFile(join(dir, 'facts.json'), JSON.stringify(data));
      await assert.rejects(readFileChanges(dir, options), /INVALID_STORE_RECORD/);
    }
    context.binding = { ...binding, repository: 'other/repository' }; await writeFile(join(dir, 'context.json'), JSON.stringify(context));
    await assert.rejects(readFileChanges(dir, options), /SCOPE_DENIED/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
