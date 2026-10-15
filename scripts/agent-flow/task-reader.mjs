import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { DevelopmentStore, validateStorePath, enforceReviewRetention, writeDurableJson } from './store.mjs';
import { reconcile, hash, signature, logicalKey, verifyFileChangeRecords } from './contract.mjs';
import { AppServer } from './probe.mjs';
import { ROOT, binary, sourceInventory, workspaceInventory, history, projectHistory, verifyRedGreen } from './task-workflow.mjs';

export async function readTask(input) {
  await authorizeRepository(REPOSITORY);
  const directory = validateStorePath(input);
  await enforceReviewRetention(directory);
  const context = JSON.parse(await readFile(join(directory, 'context.json'), 'utf8'));
  const task = JSON.parse(await readFile(join(directory, 'task-result.json'), 'utf8'));
  if (task.writerPid === process.pid || JSON.stringify(task.binding) !== JSON.stringify(context.binding)) throw new Error('INVALID_TASK_BINDING');
  try { process.kill(task.writerPid, 0); throw new Error('WRITER_STILL_RUNNING'); }
  catch (error) { if (error.code !== 'ESRCH') throw new Error('WRITER_STILL_RUNNING'); }
  const current = await sourceInventory();
  if (JSON.stringify(current) !== JSON.stringify(task.after)) throw new Error('SOURCE_REVISION_CHANGED');
  if (hash(JSON.stringify(await workspaceInventory())) !== task.workspaceAfterHash) throw new Error('WORKSPACE_REVISION_CHANGED');
  const before = JSON.parse(await readFile(join(directory, 'before-source.json'), 'utf8'));
  const after = JSON.parse(await readFile(join(directory, 'after-source.json'), 'utf8'));
  const red = JSON.parse(await readFile(join(directory, 'red-source.json'), 'utf8'));
  if (red.test.itemId !== task.redGreen.red.itemId || hash(red.sources.find(f => f.path.endsWith('/contract.mjs')).source) !== task.before.find(f => f.path.endsWith('/contract.mjs')).sha256) throw new Error('RED_BASELINE_MISMATCH');
  if (task.workspaceChanged.length !== 2 || task.workspaceChanged.some(path => !task.changed.includes(path))) throw new Error('WORKSPACE_SCOPE_VIOLATION');
  for (const entry of [...before, ...after]) {
    const inventory = before.includes(entry) ? task.before : task.after;
    if (hash(entry.source) !== inventory.find(f => f.path === entry.path)?.sha256) throw new Error('SOURCE_SNAPSHOT_HASH_MISMATCH');
  }
  const rows = await new DevelopmentStore(directory, context.binding).read();
  const live = rows.filter(r => r.fact.sourceKind === 'live_notification');
  if (task.acks.length !== live.length) throw new Error('ACK_COUNT_MISMATCH');
  for (let i = 0; i < live.length; i++) if (task.acks[i].sequence !== i + 1 || task.acks[i].digest !== signature(live[i].fact) || live[i].digest !== signature(live[i].fact)) throw new Error('ACK_DIGEST_MISMATCH');
  const turnStart = live.findIndex(r => r.fact.method === 'turn/started');
  const turnEnd = live.findIndex(r => r.fact.method === 'turn/completed');
  if (turnStart < 0 || turnEnd <= turnStart || live[turnEnd].fact.status !== 'completed') throw new Error('TURN_LIFECYCLE_INVALID');
  const server = new AppServer(binary(), ROOT);
  let snapshots;
  try { await server.initialize(); snapshots = projectHistory(await history(server, context.binding), context.binding); }
  finally { await server.close(); }
  if (JSON.stringify(snapshots.tests) !== JSON.stringify(task.tests) || JSON.stringify(snapshots.changes) !== JSON.stringify(task.changes)) throw new Error('NATIVE_TASK_EVIDENCE_MISMATCH');
  const redGreen = verifyRedGreen(snapshots.tests);
  const comparison = reconcile([...live, ...snapshots.facts.map(fact => ({ fact }))]);
  const fileChanges = verifyFileChangeRecords([...live, ...snapshots.facts.map(fact => ({ fact, digest: signature(fact), key: logicalKey(fact) }))], context.binding);
  if (!fileChanges.length || fileChanges.some(row => row.result !== 'MATCH')) throw new Error('FILECHANGE_RECONCILIATION_FAILED');
  if (!comparison.length || comparison.some(row => row.result !== 'MATCH')) throw new Error('TASK_RECONCILIATION_FAILED');
  const artifacts = [];
  for (const name of ['context.json', 'facts.json', 'task-result.json', 'before-source.json', 'after-source.json', 'red-source.json']) artifacts.push({ name, sha256: hash(await readFile(join(directory, name))) });
  const result = { result: 'PASS_TASK_INDEPENDENT_READBACK_PENDING_REVIEW', checkedAt: new Date().toISOString(), readerPid: process.pid, writerPid: task.writerPid, binding: task.binding, baseline: task.baseline, sourceFiles: current, changed: task.changed, redGreen, nativeFileChanges: snapshots.changes, reconciliation: comparison, liveFacts: live.length, freshHistoryFacts: snapshots.facts.length, artifacts, outputReviewDeadline: context.outputReviewDeadline, production: 'UNTOUCHED' };
  const artifact = `task-reader-${process.pid}-${Date.now()}.json`;
  await writeDurableJson(join(directory, artifact), result);
  return { ...result, directory, artifact };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) readTask(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'TASK_READ_FAILED'); process.exitCode = 1; });
