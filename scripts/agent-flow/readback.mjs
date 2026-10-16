import { readFile, lstat, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { DevelopmentStore, validateStorePath, writeDurableJson, enforceReviewRetention } from './store.mjs';
import { normalizeHistory, normalizeHistoryTurn, reconcile, signature, hash, validateBinding } from './contract.mjs';
import { AppServer } from './probe.mjs';

async function load(dir, name) {
  const path = join(dir, name);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('UNSAFE_EVIDENCE_FILE');
  return JSON.parse(await readFile(path, 'utf8'));
}

export function verifyLifecycle(rows, writer) {
  const facts = rows.map(r => r.fact);
  const live = facts.filter(f => f.sourceKind === 'live_notification');
  const commands = live.filter(f => f.method === 'item/completed' && f.itemType === 'commandExecution');
  const expectedExit = writer.scenario === 'success' ? 0 : writer.scenario === 'failed-tool' ? 7 : null;
  if (expectedExit === null || commands.length !== 1 || commands[0].exitCode !== expectedExit || !commands[0].output) throw new Error('READBACK_COMMAND_MISMATCH');
  const turnStart = live.findIndex(f => f.method === 'turn/started');
  const commandStart = live.findIndex(f => f.itemId === commands[0].itemId && f.method === 'item/started');
  const commandEnd = live.indexOf(commands[0]);
  const turnEnd = live.findIndex(f => f.method === 'turn/completed');
  if (!(turnStart >= 0 && commandStart > turnStart && commandEnd > commandStart && turnEnd > commandEnd) || live[turnEnd].status !== 'completed') throw new Error('LIFECYCLE_ORDER_INVALID');
  if (!Array.isArray(writer.acknowledgements)) throw new Error('ACK_COUNT_MISMATCH');
  const inserted = writer.acknowledgements.filter(a => !a.duplicate);
  if (inserted.length !== live.length) throw new Error('ACK_COUNT_MISMATCH');
  for (let i = 0; i < live.length; i++) {
    const ack = inserted[i];
    if (ack.digest !== signature(live[i]) || ack.sequence !== i + 1 || ack.duplicate || !Number.isFinite(Date.parse(ack.acknowledgedAt)) || Date.parse(ack.acknowledgedAt) < Date.parse(live[i].receivedAt)) throw new Error('ACK_SEQUENCE_MISMATCH');
  }
  for (const ack of writer.acknowledgements.filter(a => a.duplicate)) if (!inserted.some(a => a.sequence === ack.sequence && a.digest === ack.digest)) throw new Error('INVALID_DUPLICATE_ACK');
  if (!writer.duplicateCollapsed || writer.command.itemId !== commands[0].itemId || writer.command.outputHash !== commands[0].output.sha256) throw new Error('WRITER_COMMAND_MISMATCH');
  return { liveFactCount: live.length, commandItemId: commands[0].itemId, exitCode: expectedExit, order: 'PASS', acknowledgements: 'PASS' };
}

export async function independentReadback(inputDirectory) {
  await authorizeRepository(REPOSITORY);
  const directory = validateStorePath(inputDirectory);
  await enforceReviewRetention(directory);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
  const context = await load(directory, 'context.json');
  validateBinding(context.binding);
  if (context.binding.repository !== REPOSITORY || !Number.isFinite(Date.parse(context.outputReviewDeadline)) || Date.now() >= Date.parse(context.outputReviewDeadline)) throw new Error('REVIEW_WINDOW_EXPIRED');
  const writer = await load(directory, 'writer-result.json');
  if (writer.writerPid === process.pid || JSON.stringify(writer.binding) !== JSON.stringify(context.binding)) throw new Error('INDEPENDENT_PROCESS_REQUIRED');
  // The launcher must have exited: process restart, not another object in its memory.
  try { process.kill(writer.writerPid, 0); throw new Error('WRITER_STILL_RUNNING'); }
  catch (error) { if (error.code !== 'ESRCH') throw new Error('WRITER_STILL_RUNNING'); }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const allowedSource = new Set(['authority.mjs', 'contract.mjs', 'store.mjs', 'probe.mjs', 'readback.mjs', 'completion.mjs', 'agent-flow.test.mjs'].map(f => `scripts/agent-flow/${f}`));
  if (!Array.isArray(writer.sourceFiles) || writer.sourceFiles.length !== allowedSource.size) throw new Error('SOURCE_MANIFEST_INVALID');
  for (const entry of writer.sourceFiles) {
    if (!allowedSource.delete(entry.path) || hash(await readFile(join(root, entry.path))) !== entry.sha256) throw new Error('SOURCE_REVISION_MISMATCH');
  }
  const rows = await new DevelopmentStore(directory, context.binding, { nonce: context.nonce }).read();
  const lifecycle = verifyLifecycle(rows, writer);
  const storedReconciliation = reconcile(rows);
  if (!storedReconciliation.length || storedReconciliation.some(r => r.result !== 'MATCH')) throw new Error('STORED_RECONCILIATION_FAILED');
  const binary = process.platform === 'win32' ? execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0] : 'codex';
  const server = new AppServer(binary, directory);
  const snapshots = [];
  try {
    await server.initialize();
    const thread = await server.rpc('thread/read', { threadId: context.binding.threadId, includeTurns: false });
    if (thread.thread.id !== context.binding.threadId || thread.thread.sessionId !== context.binding.sessionId) throw new Error('SOURCE_SESSION_MISMATCH');
    let cursor, pages = 0;
    do {
      const page = await server.rpc('thread/items/list', { threadId: context.binding.threadId, turnId: context.binding.turnId, limit: 50, sortDirection: 'asc', ...(cursor ? { cursor } : {}) });
      for (const entry of page.data || []) {
        const snapshot = normalizeHistory(entry, context.binding, new Date().toISOString(), context.nonce);
        if (snapshot) snapshots.push({ fact: snapshot });
      }
      cursor = page.nextCursor;
      if (++pages > 10) throw new Error('HISTORY_PAGE_LIMIT');
    } while (cursor);
    const turns = await server.rpc('thread/turns/list', { threadId: context.binding.threadId, limit: 10, itemsView: 'notLoaded' });
    if (turns.data?.length !== 1) throw new Error('ONE_TURN_HISTORY_REQUIRED');
    const turn = normalizeHistoryTurn(turns.data[0], context.binding, new Date().toISOString());
    if (!turn) throw new Error('SOURCE_TURN_MISMATCH');
    snapshots.push({ fact: turn });
  } finally { await server.close(); }
  const independentReconciliation = reconcile([...rows.filter(r => r.fact.sourceKind === 'live_notification'), ...snapshots]);
  if (!independentReconciliation.length || independentReconciliation.some(r => r.result !== 'MATCH')) throw new Error('INDEPENDENT_SOURCE_MISMATCH');
  const artifacts = [];
  for (const name of ['context.json', 'facts.json', 'writer-result.json']) artifacts.push({ name, sha256: hash(await readFile(join(directory, name))) });
  const result = {
    result: 'PASS_INDEPENDENT_PROCESS_READBACK', reviewedAt: new Date().toISOString(), readerPid: process.pid, writerPid: writer.writerPid,
    binding: context.binding, scenario: writer.scenario, lifecycle, storedReconciliation, independentReconciliation,
    freshSourceSnapshots: snapshots.map(r => r.fact), artifacts, sourceFiles: writer.sourceFiles,
    outputReviewDeadline: context.outputReviewDeadline, sourceRevision: writer.codeBaseline,
    rawSensitivePayloadsRetained: false, sourceOfSnapshots: 'Codex App Server history queried by this reader',
    powerLossSafety: 'NOT_PROVEN', production: 'UNTOUCHED', monitorEndToEnd: 'PENDING_INDEPENDENT_REVIEW',
  };
  // New bounded review artifact, never rewrite a prior review.
  const artifact = `reader-${process.pid}-${Date.now()}.json`;
  await writeDurableJson(join(directory, artifact), result);
  return { ...result, evidenceDirectory: directory, readerArtifact: artifact };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const operation = process.argv.includes('--purge') ? (async () => {
    await authorizeRepository(REPOSITORY);
    const validated = validateStorePath(directory);
    const stat = await lstat(validated);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
    await rm(validated, { recursive: true });
    return { result: 'PURGED', evidenceDirectory: validated };
  })() : independentReadback(directory);
  operation.then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(/^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'READBACK_FAILED'); process.exitCode = 1;
  });
}
