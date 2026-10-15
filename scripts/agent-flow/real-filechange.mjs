// One approved task execution, not a configurable launcher/framework.
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AppServer } from './probe.mjs';
import { ROOT, binary, workspaceInventory, projectItem, testCounters, classifyTestCommand } from './task-workflow.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { DevelopmentStore, createPrivateDirectory, writeDurableJson, validateStorePath } from './store.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, hash, signature, logicalKey, verifyFileChangeRecords, DAY_MS } from './contract.mjs';
import { readFileChanges } from './filechange-reader.mjs';

const target = 'scripts/agent-flow/filechange-reader.mjs';
const suite = 'node --test scripts/agent-flow/filechange.test.mjs';
const baseline = '49f78e358817bb3991f699cc678204a3bd5ea8f9';
const testResult = item => {
  if (item?.type !== 'commandExecution') return null;
  const counters = testCounters(item.aggregatedOutput);
  if (!counters) return null;
  if (!classifyTestCommand(item.command?.replace('filechange.test.mjs', 'agent-flow.test.mjs'), item.cwd)) throw Error('UNAPPROVED_TEST_COMMAND');
  return { itemId: item.id, exitCode: item.exitCode, counters, commandHash: hash(item.command) };
};
const changedPaths = item => {
  if (item?.type !== 'fileChange') return null;
  const paths = (item.changes || []).map(change => relative(ROOT, change.path).replaceAll('\\', '/'));
  if (!paths.length || paths.some(path => path !== target)) throw Error('FILE_SCOPE_VIOLATION');
  return { itemId: item.id, status: item.status, paths: [...new Set(paths)] };
};
async function snapshots(server, binding) {
  const items = []; let cursor;
  for (let page = 0; page < 20; page++) {
    const result = await server.rpc('thread/items/list', { threadId: binding.threadId, turnId: binding.turnId, sortDirection: 'asc', limit: 50, ...(cursor ? { cursor } : {}) });
    items.push(...result.data); cursor = result.nextCursor; if (!cursor) break;
  }
  if (cursor) throw Error('HISTORY_LIMIT');
  const turns = await server.rpc('thread/turns/list', { threadId: binding.threadId, limit: 10, itemsView: 'notLoaded' });
  if (turns.data.length !== 1 || turns.data[0].id !== binding.turnId || turns.data[0].status !== 'completed') throw Error('TURN_HISTORY_MISMATCH');
  const facts = items.map(entry => normalizeHistory({ ...entry, item: projectItem(entry.item) }, binding, new Date().toISOString())).filter(Boolean);
  facts.push(normalizeHistoryTurn(turns.data[0], binding, new Date().toISOString()));
  return { facts, changes: items.map(entry => changedPaths(entry.item)).filter(Boolean), tests: items.map(entry => testResult(entry.item)).filter(Boolean) };
}

async function writer() {
  await authorizeRepository(REPOSITORY);
  if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim() !== baseline) throw Error('BASELINE_MISMATCH');
  const before = await workspaceInventory(), beforeSource = await readFile(join(ROOT, target), 'utf8');
  const directory = await createPrivateDirectory({ retained: true });
  console.log(JSON.stringify({ phase: 'writer_started', directory }));
  const createdMillis = Date.now();
  const createdAt = new Date(createdMillis).toISOString(), deadline = new Date(createdMillis + 7 * DAY_MS).toISOString();
  await writeDurableJson(join(directory, 'context.json'), { scope: 'filechange-canonical-batch', createdAt, outputReviewDeadline: deadline, evidenceClass: 'runtime' });
  const base = { repository: REPOSITORY, taskId: randomUUID(), runId: randomUUID(), attempt: 1, producerInstanceId: randomUUID() };
  let binding, store, server, failure, timer, complete; let queue = Promise.resolve();
  const acks = [], tests = [], changes = [], done = new Promise(resolve => { complete = resolve; });
  try {
    server = new AppServer(binary(), ROOT, message => {
      if (!binding || message.params?.threadId !== binding.threadId) return;
      try {
        if (!binding.turnId && message.method === 'turn/started') {
          binding.turnId = message.params.turn.id; store = new DevelopmentStore(directory, binding);
          const serializedBinding = Object.fromEntries(Object.entries(binding).reverse());
          queue = queue.then(async () => {
            const { writeFile } = await import('node:fs/promises');
            await writeFile(join(directory, 'context.json'), JSON.stringify({ scope: 'filechange-canonical-batch', binding: serializedBinding, createdAt, outputReviewDeadline: deadline, evidenceClass: 'runtime' }), { mode: 0o600 });
          });
        }
        if (!binding.turnId) return;
        if (message.params.turnId && message.params.turnId !== binding.turnId) throw Error('WRONG_TURN');
        if (message.method === 'item/completed') {
          const test = testResult(message.params.item), change = changedPaths(message.params.item);
          if (test) tests.push(test); if (change) changes.push(change);
        }
        const fact = normalizeNotification({ ...message, params: { ...message.params, item: projectItem(message.params.item) } }, binding, new Date().toISOString());
        if (fact) queue = queue.then(async () => { acks.push(await store.ingest(fact)); }).catch(() => { failure = 'PERSISTENCE_FAILED'; });
        if (message.method === 'turn/completed') complete(message.params.turn);
      } catch { failure = 'RUNTIME_OBSERVATION_FAILED'; }
    });
    await server.initialize(); const models = await server.rpc('model/list', {}), model = models.data.find(m => m.isDefault && !m.hidden)?.model;
    if (!model) throw Error('NO_DEFAULT_MODEL');
    const thread = await server.rpc('thread/start', { cwd: ROOT, model, approvalPolicy: 'never', sandbox: 'workspace-write', developerInstructions: `One approved real development task. You own ONLY ${target}. Use apply_patch for the edit. No other file changes, agent delegation, network, MCP, credentials, DB, commit, PR or deployment. No new tests or fixtures. Run only the existing relevant suite and syntax check.` });
    binding = { ...base, threadId: thread.thread.id, sessionId: thread.thread.sessionId, turnId: null };
    await server.rpc('turn/start', { threadId: binding.threadId, input: [{ type: 'text', text: `Fix one real reader defect in ${target}: equal canonical binding objects are currently rejected when JSON property insertion order differs, because JSON.stringify(data.binding) is compared with JSON.stringify(context.binding). Validate data.binding using the existing validateBinding function, then compare the eight existing canonical binding fields by value, irrespective of property order. Preserve all other validation/security behavior. No new helper/framework, no new files or fixtures. Edit only this file using apply_patch. Run ${suite}, then node --check ${target}; report actual results and stop.` }], approvalPolicy: 'never', sandboxPolicy: { type: 'workspaceWrite', writableRoots: [ROOT], networkAccess: false } });
    const outcome = await Promise.race([done, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('TASK_TIMEOUT')), 300000); })]);
    clearTimeout(timer); await queue;
    if (failure || server.notificationError || outcome.status !== 'completed') throw Error(failure || 'TASK_FAILED');
    if (!tests.length || tests.some(t => t.exitCode !== 0 || t.counters.fail || t.counters.skipped || t.counters.cancelled || t.counters.todo)) throw Error('TESTS_NOT_PASS');
    if (!changes.length) throw Error('NO_NATIVE_FILECHANGE');
    const after = await workspaceInventory(), changed = after.filter(f => before.find(b => b.path === f.path)?.sha256 !== f.sha256).map(f => f.path);
    if (after.length !== before.length || changed.length !== 1 || changed[0] !== target) throw Error('WORKSPACE_SCOPE_VIOLATION');
    const source = await snapshots(server, binding);
    if (JSON.stringify(source.tests) !== JSON.stringify(tests) || JSON.stringify(source.changes) !== JSON.stringify(changes)) throw Error('NATIVE_HISTORY_MISMATCH');
    for (const fact of source.facts) await store.ingest(fact);
    const afterSource = await readFile(join(ROOT, target), 'utf8');
    await writeDurableJson(join(directory, 'source-change.json'), { target, before: beforeSource, after: afterSource, beforeHash: hash(beforeSource), afterHash: hash(afterSource) });
    await writeDurableJson(join(directory, 'writer.json'), { baseline, writerPid: process.pid, binding, acks, tests, changes, changed, source: { tests: source.tests, changes: source.changes }, afterWorkspaceHash: hash(JSON.stringify(after)), deadline });
    console.log(JSON.stringify({ result: 'REAL_WRITER_COMPLETE', directory, fileChanges: changes.length, tests }));
  } finally { clearTimeout(timer); await queue; await server?.close(); }
}

async function reader(input) {
  await authorizeRepository(REPOSITORY);
  const directory = validateStorePath(input), task = JSON.parse(await readFile(join(directory, 'writer.json'), 'utf8'));
  try { process.kill(task.writerPid, 0); throw Error('WRITER_STILL_RUNNING'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  const result = await readFileChanges(directory);
  if (result.result !== 'PASS_FILECHANGE_CANONICAL_READBACK') throw Error('READBACK_NOT_PASS');
  const rows = JSON.parse(await readFile(join(directory, 'facts.json'), 'utf8')).records;
  const live = rows.filter(r => r.fact.sourceKind === 'live_notification');
  if (live.length !== task.acks.length || live.some((r, i) => task.acks[i].sequence !== i + 1 || task.acks[i].digest !== signature(r.fact))) throw Error('ACK_MISMATCH');
  if (hash(JSON.stringify(await workspaceInventory())) !== task.afterWorkspaceHash) throw Error('SOURCE_DRIFT');
  const server = new AppServer(binary(), ROOT); let source;
  try { await server.initialize(); source = await snapshots(server, task.binding); } finally { await server.close(); }
  if (JSON.stringify(source.tests) !== JSON.stringify(task.tests) || JSON.stringify(source.changes) !== JSON.stringify(task.changes)) throw Error('FRESH_NATIVE_HISTORY_MISMATCH');
  const reconciliation = verifyFileChangeRecords([...live, ...source.facts.map(fact => ({ fact, digest: signature(fact), key: logicalKey(fact) }))], task.binding);
  if (!reconciliation.length || reconciliation.some(r => r.result !== 'MATCH')) throw Error('RECONCILIATION_NOT_PASS');
  const report = { ...result, result: 'PASS_REAL_FILECHANGE_RUNTIME', writerPid: task.writerPid, writerStopped: true, freshNativeHistory: true, reconciliation, tests: source.tests, changes: source.changes, liveFacts: live.length, acknowledgementCount: task.acks.length, baseline, deadline: task.deadline };
  await writeDurableJson(join(directory, `independent-reader-${process.pid}.json`), report);
  console.log(JSON.stringify(report));
}

try { if (process.argv[2] === '--read') await reader(process.argv[3]); else await writer(); }
catch (error) { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'REAL_FILECHANGE_FAILED'); process.exitCode = 1; }
