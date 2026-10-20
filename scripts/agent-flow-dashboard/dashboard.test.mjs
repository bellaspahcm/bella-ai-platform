import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { hash, readPackage, safeRead, listPackages } from './evidence.mjs';
import { createDashboard } from './server.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { DAY_MS, normalizeNotification, normalizeHistory, normalizeHistoryTurn, logicalKey, signature, reconcile } from '../agent-flow/contract.mjs';

const time = Date.parse('2026-10-15T06:00:00Z');
const packageId = 'bella-agent-flow-test';
async function fixture(t, mutate = () => {}, kind = 'legacy') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bella-dashboard-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, packageId));
  const binding = { repository: REPOSITORY, taskId: 'task', runId: 'run', attempt: 1, producerInstanceId: 'producer', threadId: 'thread', sessionId: 'thread', turnId: 'turn' };
  const baseline = 'a'.repeat(40), created = time - 2000;
  const deadline = new Date(kind === 'legacy' ? time + 86400000 : created + 7 * DAY_MS).toISOString();
  const green = { itemId: 'green', exitCode: 0, commandHash: 'a'.repeat(64), counters: { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 } };
  const red = { ...green, itemId: 'red', exitCode: 1, counters: { ...green.counters, pass: 0, fail: 1 } };
  const live = [], history = [], changes = [];
  const emit = (method, params) => live.push(normalizeNotification({ method, params: { threadId: binding.threadId, turnId: binding.turnId, ...params } }, binding, new Date(time - 1000).toISOString()));
  emit('turn/started', { turn: { id: binding.turnId, status: 'inProgress' } });
  for (const value of [red, green]) {
    if (kind !== 'legacy') {
      const file = value === red ? 'scripts/agent-flow/task-workflow.test.mjs' : 'scripts/agent-flow/task-workflow.mjs';
      const item = { id: 'patch-' + value.itemId, type: 'fileChange', status: 'completed' };
      emit('item/started', { item: { ...item, status: 'inProgress' } }); emit('item/completed', { item });
      history.push(normalizeHistory({ turnId: binding.turnId, item }, binding, new Date(time - 900).toISOString()));
      changes.push({ itemId: item.id, status: 'completed', paths: [file] });
    }
    const item = { id: value.itemId, type: 'commandExecution', status: value.exitCode ? 'failed' : 'completed', exitCode: value.exitCode };
    emit('item/started', { item: { ...item, status: 'inProgress', exitCode: undefined } }); emit('item/completed', { item });
    history.push(normalizeHistory({ turnId: binding.turnId, item }, binding, new Date(time - 900).toISOString()));
  }
  emit('turn/completed', { turn: { id: binding.turnId, status: 'completed' } });
  history.push(normalizeHistoryTurn({ id: binding.turnId, status: 'completed' }, binding, new Date(time - 900).toISOString()));
  const records = [...live, ...history].map((fact, index) => ({ key: logicalKey(fact), digest: signature(fact), revision: 1, storedAt: time - 800 + index, metadataExpiresAt: time - 800 + index + 14 * DAY_MS, outputExpiresAt: time - 800 + index + 7 * DAY_MS, outputState: 'ABSENT', fact }));
  const acks = records.slice(0, live.length).map((row, index) => ({ sequence: index + 1, digest: row.digest, duplicate: false, revision: 1, acknowledgedAt: new Date(row.storedAt + 1).toISOString() }));
  const comparison = reconcile(records);
  const files = kind === 'legacy' ? ['scripts/agent-flow/contract.mjs', 'scripts/agent-flow/agent-flow.test.mjs'] : ['scripts/agent-flow/task-workflow.mjs', 'scripts/agent-flow/task-workflow.test.mjs'];
  let docs;
  if (kind === 'legacy') {
    docs = {
      'seal.json': { task_code_test_workflow: 'PASS', binding, baseline, review_deadline: deadline, independent_reader_artifact: 'reader.json', independent_red_green_artifact: 'review.json', red, green, independent_code_review: 'PASS', independent_runtime_review: 'PASS', agent_owned_files: files, production: 'UNTOUCHED' },
      'facts.json': { binding, records },
      'reader.json': { result: 'PASS_TASK_INDEPENDENT_READBACK_PENDING_REVIEW', binding, baseline, outputReviewDeadline: deadline, reconciliation: comparison, readerPid: 2, writerPid: 1, redGreen: { red, green }, changed: files },
      'review.json': { red: { exitCode: red.exitCode, counters: red.counters }, green: { exitCode: green.exitCode, counters: green.counters } },
      'task-result.json': { result: 'TASK_WRITER_PASS_PENDING_REVIEW', binding, baseline, writerPid: 1, acks, tests: [red, green], changed: files, stdout: 'SECRET_SENTINEL' },
    };
  } else {
    const source = { revision: baseline, inventoryHash: 'a'.repeat(64), launcherSha256: 'b'.repeat(64) }, afterSource = { ...source, inventoryHash: 'c'.repeat(64) };
    const task = { taskId: binding.taskId, sourceRevision: baseline, mode: 'bounded-coding', suites: ['task'], changeRequest: 'counter-integrity' };
    docs = {
      'context.json': { scope: 'configured-agent-launcher-v2', task, source, createdAt: new Date(created).toISOString(), outputReviewDeadline: deadline },
      'seal.json': { result: 'PASS_BOUNDED_CODING_TASK_VIA_LAUNCHER', taskId: binding.taskId, sourceRevision: baseline, sourceBefore: source, sourceAfter: afterSource, reviewDeadline: deadline, independentCodeAndEvidenceReview: 'PASS', production: 'UNTOUCHED' },
      'facts.json': { binding, records },
      'writer.json': { result: 'LAUNCHER_WRITER_PASS', writerPid: 1, task, binding, source, afterSource, tests: [red, green], acks, changed: files, changes, proof: { liveFacts: live.length, acks: live.length, reconciliation: comparison } },
      'reader-2.json': { result: 'PASS_BOUNDED_CODING_TASK_VIA_LAUNCHER', taskId: binding.taskId, binding, mode: 'bounded-coding', source, afterSource, deadline, writerPid: 1, readerPid: 2, writerStopped: true, freshNativeHistory: true, canonicalStoreBytesUnchanged: true, tests: [red, green], liveFacts: live.length, acks: live.length, reconciliation: comparison, freshReconciliation: comparison, nativeChanges: changes, changed: files, codingEvidence: { sourceSnapshotsMatch: true, sourceReadsVerified: true, redPosition: 3, greenPosition: 7 } },
      'independent-review.json': { result: 'PASS_SCOPED_CODE_AND_EVIDENCE_REVIEW', checks: { writerStopped: true, writerPid: 1, readerPid: 2 } },
    };
  }
  // Clone shared structures before injecting semantic tampering. Hashes are
  // recalculated afterward, so these cases prove more than byte integrity.
  docs = Object.fromEntries(Object.entries(docs).map(([key, value]) => [key, structuredClone(value)]));
  mutate(docs);
  const manifest = { schema_version: 1, created_at: new Date(time - 100).toISOString(), ...(kind === 'legacy' ? { review_deadline: deadline, baseline } : {}), artifacts: [] };
  for (const [file, doc] of Object.entries(docs)) { const bytes = Buffer.from(JSON.stringify(doc)); await writeFile(path.join(root, packageId, file), bytes); manifest.artifacts.push({ path: file, bytes: bytes.length, sha256: hash(bytes) }); }
  await writeFile(path.join(root, packageId, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest, dir: path.join(root, packageId) };
}
test('allowlisted projection and immutable read, historical claims separate from integrity', async t => {
  const { root, dir } = await fixture(t);
  const before = await readFile(path.join(dir, 'facts.json'));
  const result = await readPackage(root, packageId, time);
  assert.equal(result.state, 'AVAILABLE'); assert.equal(result.integrity.state, 'MATCH'); assert.equal(result.reviews.runtime, 'PASS (retained review)');
  assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false);
  assert.deepEqual(await readFile(path.join(dir, 'facts.json')), before);
  assert.equal((await listPackages(root, time)).length, 1);
});
test('expired package exposes no timeline or binding', async t => {
  const { root } = await fixture(t); const value = await readPackage(root, packageId, time + 86400000);
  assert.equal(value.state, 'EXPIRED'); assert.equal(value.timeline, undefined); assert.equal(value.binding, undefined);
});
test('tampered artifact is CORRUPT without leaking content', async t => {
  const { root, dir } = await fixture(t); await writeFile(path.join(dir, 'facts.json'), 'SECRET_SENTINEL');
  const value = await readPackage(root, packageId, time); assert.equal(value.state, 'CORRUPT'); assert.equal(JSON.stringify(value).includes('SECRET'), false);
});
test('missing artifacts and invalid IDs fail closed', async t => {
  const { root, dir } = await fixture(t); await rm(path.join(dir, 'reader.json'));
  assert.equal((await readPackage(root, packageId, time)).state, 'MISSING');
  assert.equal((await readPackage(root, '../secret', time)).state, 'INVALID_ID');
});
test('cross-run evidence is rejected even with matching hashes', async t => {
  const { root } = await fixture(t, docs => { docs['reader.json'].binding = { ...docs['reader.json'].binding, runId: 'other' }; });
  assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
});
test('missing identity cannot compare as equal', async t => {
  const { root } = await fixture(t, docs => {
    for (const doc of Object.values(docs)) if (doc.binding) delete doc.binding.runId;
    for (const row of docs['facts.json'].records) delete row.fact.runId;
  });
  assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
});
test('reader test item must match seal and completed lifecycle', async t => {
  const { root } = await fixture(t, docs => { docs['reader.json'].redGreen = { red: { ...docs['seal.json'].red, itemId: 'wrong-item' }, green: docs['seal.json'].green }; });
  assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
});
test('earliest output retention and metadata maximum are enforced', async t => {
  for (const mutate of [docs => { docs['facts.json'].records[0].outputExpiresAt = time + 1000; }, docs => { docs['facts.json'].records[0].metadataExpiresAt = time + 15 * 86400000; }, docs => { docs['facts.json'].records[0].metadataExpiresAt = time + 1000; }]) {
    const { root } = await fixture(t, mutate);
    assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  }
});
test('unsafe paths and symlink packages are rejected', async t => {
  const { root, dir } = await fixture(t);
  for (const file of ['../outside', '/absolute', 'C:/secret', 'x\\secret']) await assert.rejects(safeRead(root, file));
  await symlink(dir, path.join(root, 'bella-agent-flow-link'), 'junction');
  assert.equal((await readPackage(root, 'bella-agent-flow-link', time)).state, 'CORRUPT');
});
test('size limits and impossible retention fail closed', async t => {
  const { root, dir, manifest } = await fixture(t);
  await writeFile(path.join(dir, 'large'), Buffer.alloc(2 * 1024 * 1024 + 1)); await assert.rejects(safeRead(root, `${packageId}/large`));
  manifest.review_deadline = new Date(time + 8 * 86400000).toISOString(); await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
});
test('existing GitHub BDGF admin policy: grant, denied tenant/maintain, identity mismatch', async () => {
  const get = permission => async endpoint => endpoint === 'user' ? { login: 'owner' } : { user: { login: 'owner' }, permission };
  assert.equal((await authorizeRepository(REPOSITORY, get('admin'))).actor, 'owner');
  for (const role of ['maintain', 'write', 'tenant_admin']) await assert.rejects(authorizeRepository(REPOSITORY, get(role)), /ACCESS_DENIED/);
  await assert.rejects(authorizeRepository('other/repo', get('admin')), /SCOPE_DENIED/);
  await assert.rejects(authorizeRepository(REPOSITORY, async endpoint => endpoint === 'user' ? { login: 'owner' } : { user: { login: 'other' }, permission: 'admin' }), /ACCESS_DENIED/);
});
test('HTTP access controls, single-use session, read-only API and revocation', async t => {
  const { root } = await fixture(t); let allowed = true; let clock = time;
  const app = await createDashboard({ root, now: () => clock, authorize: async () => { if (!allowed) throw new Error('denied'); return { actor: 'owner' }; } });
  t.after(() => app.close()); const get = (url, options) => fetch(app.origin + url, options);
  assert.equal((await get('/api/packages')).status, 401);
  assert.equal((await get('/api/packages', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const request = { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new URL(app.url).hash.slice(1) }) };
  assert.equal((await get('/session', { ...request, headers: { 'Content-Type': 'application/json' } })).status, 403);
  const boot = await get('/session', request); assert.equal(boot.status, 200);
  const set = boot.headers.get('set-cookie'); assert.match(set, /HttpOnly; SameSite=Strict/); const headers = { Cookie: set.split(';')[0] };
  assert.equal((await get('/session', request)).status, 403);
  assert.equal((await get('/api/packages', { headers })).status, 200);
  assert.equal((await (await get(`/api/packages/${packageId}`, { headers })).json()).state, 'AVAILABLE');
  assert.equal((await get('/api/packages', { method: 'POST', headers })).status, 405);
  allowed = false; assert.equal((await get('/api/packages', { headers })).status, 403); allowed = true;
  clock += 3600000; assert.equal((await get('/api/packages', { headers })).status, 401);
});
test('startup authority failure never opens listener', async () => {
  await assert.rejects(createDashboard({ authorize: async () => { throw new Error('denied'); } }), /denied/);
});
test('concurrent bootstrap accepts a capability only once', async t => {
  const { root } = await fixture(t);
  const app = await createDashboard({ root, authorize: async () => { await new Promise(resolve => setTimeout(resolve, 20)); return { actor: 'owner' }; } });
  t.after(() => app.close());
  const options = { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new URL(app.url).hash.slice(1) }) };
  const results = await Promise.all([fetch(app.origin + '/session', options), fetch(app.origin + '/session', options)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 403]);
});
test('interleaved request bodies cannot reuse bootstrap capability', async t => {
  const { root } = await fixture(t);
  const app = await createDashboard({ root, authorize: async () => ({ actor: 'owner' }) }); t.after(() => app.close());
  const body = JSON.stringify({ token: new URL(app.url).hash.slice(1) });
  const make = () => { let request; const result = new Promise((resolve, reject) => { request = http.request(app.origin + '/session', { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode); }); request.on('error', reject); request.write(body.slice(0, 20)); }); return { result, finish: () => request.end(body.slice(20)) }; };
  const a = make(), b = make(); await new Promise(resolve => setTimeout(resolve, 20)); a.finish(); b.finish();
  assert.deepEqual((await Promise.all([a.result, b.result])).sort(), [200, 403]);
});

test('launcher-v2 package reads without legacy manifest fields and never rewrites evidence', async t => {
  const { root, dir } = await fixture(t, () => {}, 'launcher');
  const before = await readFile(path.join(dir, 'facts.json'));
  const value = await readPackage(root, packageId, time);
  assert.equal(value.state, 'AVAILABLE'); assert.equal(value.integrity.artifacts, 6);
  assert.equal(value.reconciliation.matches, 5); assert.equal(value.acks, 10);
  assert.deepEqual(value.files.sort(), ['scripts/agent-flow/task-workflow.mjs', 'scripts/agent-flow/task-workflow.test.mjs'].sort());
  assert.deepEqual(await readFile(path.join(dir, 'facts.json')), before);
  assert.equal((await listPackages(root, time))[0].state, 'AVAILABLE');
});

test('unsupported, expired, failed and corrupt are distinct without exposing a failed timeline', async t => {
  const failed = await fixture(t, docs => { docs['seal.json'].result = 'FAIL_INDEPENDENT_READBACK'; }, 'launcher');
  const value = await readPackage(failed.root, packageId, time);
  assert.equal(value.state, 'FAILED'); assert.equal(value.timeline, undefined); assert.equal(value.tests, undefined);
  assert.equal((await listPackages(failed.root, time))[0].state, 'FAILED');
  const unknown = await fixture(t, docs => { docs['context.json'].scope = 'unknown-version'; }, 'launcher');
  assert.equal((await readPackage(unknown.root, packageId, time)).state, 'UNSUPPORTED');
  const expired = await fixture(t, () => {}, 'launcher');
  assert.equal((await readPackage(expired.root, packageId, time + 7 * DAY_MS)).state, 'EXPIRED');
  assert.deepEqual((await listPackages(unknown.root, time))[0].state, 'UNSUPPORTED');
});

test('matching manifest hashes cannot hide canonical digest, ACK, binding or deadline errors', async t => {
  const mutations = [
    docs => { docs['facts.json'].records[0].digest = '0'.repeat(64); },
    docs => { docs['facts.json'].records[0].key = 'wrong'; },
    docs => { docs['writer.json'].acks[0].digest = '0'.repeat(64); },
    docs => { docs['writer.json'].acks[0].sequence = 2; },
    docs => { docs['writer.json'].acks[0].revision = 2; },
    docs => { docs['writer.json'].acks[0].acknowledgedAt = new Date(time + 1000).toISOString(); },
    docs => { docs['reader-2.json'].binding.runId = 'other'; },
    docs => { docs['context.json'].task.taskId = 'other'; },
    docs => { docs['seal.json'].reviewDeadline = new Date(time + DAY_MS).toISOString(); },
    docs => { docs['context.json'].createdAt = new Date(time - 3000).toISOString(); },
    docs => { docs['reader-2.json'].source.revision = 'b'.repeat(40); },
  ];
  for (const mutate of mutations) {
    const { root } = await fixture(t, mutate, 'launcher');
    assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  }
});

test('valid artifact hashes do not override reconciliation conflicts or a failed reader', async t => {
  for (const mutate of [
    docs => { docs['reader-2.json'].reconciliation.pop(); },
    docs => { docs['reader-2.json'].freshReconciliation[0].result = 'CONFLICT'; },
    docs => { docs['writer.json'].proof.reconciliation[0].result = 'MISSING_HISTORY'; },
    docs => { docs['reader-2.json'].result = 'FAIL'; },
    docs => { docs['reader-2.json'].writerStopped = false; },
    docs => { docs['reader-2.json'].readerPid = 1; },
    docs => {
      const row = docs['facts.json'].records.find(row => row.fact.method === 'history.item' && row.fact.itemType === 'commandExecution');
      row.fact.exitCode = 9; row.digest = signature(row.fact);
    },
    docs => {
      const duplicate = structuredClone(docs['facts.json'].records.find(row => row.fact.method === 'history.item'));
      docs['facts.json'].records.push(duplicate);
    },
  ]) {
    const { root } = await fixture(t, mutate, 'launcher');
    assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  }
});

test('RED/GREEN and file-change identity, scope and ordering must match canonical evidence', async t => {
  for (const mutate of [
    docs => { docs['writer.json'].tests[1].counters.pass = 0; },
    docs => { docs['reader-2.json'].tests[0].itemId = 'wrong'; },
    docs => { docs['reader-2.json'].nativeChanges[0].itemId = 'wrong'; },
    docs => { docs['writer.json'].changes[0].paths = ['src/app/page.tsx']; },
    docs => { docs['writer.json'].changed = ['src/app/page.tsx']; },
    docs => { docs['reader-2.json'].codingEvidence.sourceSnapshotsMatch = false; },
    docs => { docs['reader-2.json'].codingEvidence.greenPosition = 0; },
    docs => {
      for (const doc of [docs['writer.json'], docs['reader-2.json']]) {
        const changes = doc.changes || doc.nativeChanges;
        [changes[0].paths, changes[1].paths] = [changes[1].paths, changes[0].paths];
      }
    },
  ]) {
    const { root } = await fixture(t, mutate, 'launcher');
    assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  }
});

test('ambiguous reader artifacts and payload injection never become valid evidence', async t => {
  const { root } = await fixture(t, docs => { docs['reader-3.json'] = structuredClone(docs['reader-2.json']); }, 'launcher');
  assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  const injected = await fixture(t, docs => { docs['facts.json'].records[0].fact.reasoning = 'SECRET_SENTINEL'; }, 'launcher');
  const value = await readPackage(injected.root, packageId, time);
  assert.equal(value.state, 'CORRUPT'); assert.equal(JSON.stringify(value).includes('SECRET'), false);
});

test('self-consistent hashes and reconciliation cannot mislabel lifecycle statuses', async t => {
  for (const select of [
    fact => fact.method === 'item/started' && fact.itemType === 'commandExecution',
    fact => fact.itemId === 'green',
    fact => fact.itemId === 'patch-green' && fact.method !== 'item/started',
  ]) {
    const { root } = await fixture(t, docs => {
      const records = docs['facts.json'].records;
      for (const row of records.filter(row => select(row.fact))) {
        row.fact.status = 'failed'; row.digest = signature(row.fact);
        const index = records.indexOf(row);
        if (index < docs['writer.json'].acks.length) docs['writer.json'].acks[index].digest = row.digest;
      }
    }, 'launcher');
    assert.equal((await readPackage(root, packageId, time)).state, 'CORRUPT');
  }
});
