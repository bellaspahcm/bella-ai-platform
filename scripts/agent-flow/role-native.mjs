import { execFileSync } from 'node:child_process';
import { readFile, open, mkdir } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AppServer } from './probe.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { createPrivateDirectory, DevelopmentStore, writeDurableJson, validateStorePath, enforceReviewRetention } from './store.mjs';
import { hash, DAY_MS, normalizeNotification, normalizeHistory, normalizeHistoryTurn, reconcile, signature, verifyFileChangeRecords } from './contract.mjs';
import { admitTask, drive, inventory, counters, validateHandoff } from './role-pipeline.mjs';

const binary = () => process.platform === 'win32' ? execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0] : 'codex';
const project = item => item ? { id: item.id, type: item.type, status: item.status, exitCode: item.exitCode } : undefined;
const stop = code => { throw new Error(code); };
export function repositoryIdentity(origin, resolvedName) {
  const match = origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
  return !!match && (resolvedName || match[1]).toLowerCase() === REPOSITORY.toLowerCase();
}
function workspaceIdentity(workspace) {
  const git = args => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', windowsHide: true }).trim();
  const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (resolve(workspace) !== moduleRoot || resolve(git(['rev-parse', '--show-toplevel'])) !== moduleRoot) stop('WRONG_REPOSITORY');
  const origin = git(['remote', 'get-url', 'origin']);
  const remote = origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1];
  if (!remote) stop('WRONG_REPOSITORY');
  // Read-only canonical resolution also handles a renamed repository's old URL.
  const canonical = execFileSync('gh', ['api', `repos/${remote}`, '--jq', '.full_name'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (!repositoryIdentity(origin, canonical)) stop('WRONG_REPOSITORY');
  return moduleRoot;
}
const now = () => new Date().toISOString();

export function parseResult(messages) {
  const finals = messages.filter(m => m.phase === 'final_answer' || m.phase == null).filter(m => m.text?.trim().startsWith('BELLA_ROLE_RESULT='));
  if (finals.length !== 1 || finals[0].text.length > 12000) stop('AMBIGUOUS_ROLE_RESULT');
  try { return JSON.parse(finals[0].text.trim().slice('BELLA_ROLE_RESULT='.length)); }
  catch { stop('INVALID_ROLE_RESULT'); }
}

export function exactTest(command, cwd, expected, workspace) {
  if (typeof command !== 'string' || typeof cwd !== 'string' || resolve(cwd) !== workspace) return false;
  if (command.trim() === expected) return true;
  const wrapped = command.match(/^(?:"[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]*[\\/](?:powershell|pwsh)\.exe"|(?:powershell|pwsh)(?:\.exe)?)\s+(?:-(?:NoProfile|NoLogo|NonInteractive)\s+)*-Command\s+(["'])(.*)\1$/i);
  return wrapped?.[2] === expected;
}

export function reviewReads(task, verificationPath) {
  // Forward slashes avoid native Windows shell-display backslash escaping.
  const portablePath = verificationPath.replaceAll('\\', '/');
  return [`git diff -- ${task.ownedFiles.join(' ')}`, ...task.ownedFiles.map(p => `Get-Content -LiteralPath '${p}'`), `Get-Content -LiteralPath '${portablePath.replaceAll("'", "''")}'`];
}

export function terminalRecord(value) {
  const result = Object.keys(value || {}).length === 1 && value.terminal ? value.terminal : value;
  if (!result || !['PASS', 'HELD'].includes(result.status) || !Array.isArray(result.receipts)) stop('INVALID_TERMINAL_RECORD');
  return result;
}

async function history(server, binding) {
  const thread = await server.rpc('thread/read', { threadId: binding.threadId, includeTurns: false });
  if (thread.thread.id !== binding.threadId || (thread.thread.sessionId || null) !== (binding.sessionId || null)) stop('NATIVE_SESSION_MISMATCH');
  const entries = []; let cursor, pages = 0;
  do {
    const page = await server.rpc('thread/items/list', { threadId: binding.threadId, turnId: binding.turnId, sortDirection: 'asc', limit: 50, ...(cursor ? { cursor } : {}) });
    entries.push(...(page.data || [])); cursor = page.nextCursor;
    if (++pages > 20) stop('HISTORY_PAGE_LIMIT');
  } while (cursor);
  const turns = await server.rpc('thread/turns/list', { threadId: binding.threadId, limit: 10, itemsView: 'notLoaded' });
  if (turns.data?.length !== 1 || turns.data[0].id !== binding.turnId || turns.data[0].status !== 'completed') stop('NATIVE_TURN_NOT_COMPLETED');
  return { entries, turn: turns.data[0] };
}

function changed(item, task, workspace) {
  if (item.type !== 'fileChange') return [];
  if (item.status !== 'completed' || !item.changes?.length) stop('INVALID_NATIVE_CHANGE');
  return item.changes.map(c => {
    const p = relative(workspace, resolve(workspace, c.path)).replaceAll('\\', '/');
    if (!task.ownedFiles.includes(p) || c.kind?.move_path || c.kind?.movePath) stop('FORBIDDEN_NATIVE_CHANGE');
    return p;
  });
}

function nativeShape(items, binding, task, workspace) {
  const commands = items.filter(i => i.type === 'commandExecution').map(i => ({ itemId: i.id, command: i.command, cwd: i.cwd, exitCode: i.exitCode, status: i.status, outputHash: hash(i.aggregatedOutput || '') }));
  const changes = items.filter(i => i.type === 'fileChange').map(i => ({ itemId: i.id, paths: changed(i, task, workspace) }));
  const messages = items.filter(i => i.type === 'agentMessage');
  return { commands, changes, result: parseResult(messages), binding };
}

function validateStored(rows, acks, binding) {
  const live = rows.filter(r => r.fact.sourceKind === 'live_notification');
  if (live.length !== acks.length || !live.length) stop('ACK_COUNT_MISMATCH');
  for (let i = 0; i < live.length; i++) if (acks[i].sequence !== i + 1 || acks[i].digest !== signature(live[i].fact) || live[i].digest !== signature(live[i].fact)) stop('ACK_DIGEST_MISMATCH');
  const facts = live.map(r => r.fact);
  const start = facts.findIndex(f => f.method === 'turn/started'), end = facts.findIndex(f => f.method === 'turn/completed');
  if (start !== 0 || end <= start || facts[end].status !== 'completed') stop('NATIVE_LIFECYCLE_INVALID');
  for (const f of facts.filter(f => f.method === 'item/completed' && f.itemType === 'commandExecution')) {
    const s = facts.findIndex(p => p.itemId === f.itemId && p.method === 'item/started');
    if (s <= start || facts.indexOf(f) <= s || facts.indexOf(f) >= end) stop('NATIVE_COMMAND_ORDER_INVALID');
  }
  const comparison = reconcile(rows);
  if (!comparison.length || comparison.some(r => r.result !== 'MATCH')) stop('NATIVE_HISTORY_MISMATCH');
  if (verifyFileChangeRecords(rows, binding).some(r => r.result !== 'MATCH')) stop('NATIVE_CHANGE_HISTORY_MISMATCH');
  return { liveFacts: live.length, historyMatches: comparison.length, changes: verifyFileChangeRecords(rows, binding).length };
}

function promptFor(name, input, expected) {
  const { task, before, revision } = input;
  const common = `GOAL: ${task.goal}\nOWNER: human task authority; Lead plans, Builder writes, Verify tests, independent Reviewer reviews.\nSCOPE / OWNED FILES: ${task.ownedFiles.join(', ')}\nFORBIDDEN: all other paths, running pipeline/collector/store/authority, Product, kernels, DB/Auth/RLS/migration, .env, credentials, network, MCP, subagents, git write operations, commit/PR/merge/deploy. No installation or permission changes.\nDEPENDENCIES: previous stages supplied below. AUTHORITY: code/test only inside scope.\nACCEPTANCE: ${JSON.stringify(task.acceptance)}\nCandidate fingerprint: ${before.fingerprint}. Revision ${revision}/1.\nRead relevant existing source before acting. Do not re-run historical real proof commands. Never fabricate evidence. If blocked/ambiguous stop HELD.\nFinal response MUST be exactly one line BELLA_ROLE_RESULT=<JSON object>, no fences, with role:${JSON.stringify(name)}, candidate:${JSON.stringify(before.fingerprint)}, decision and findings array.\n`;
  if (name === 'LEAD') return common + 'Read-only Lead. Read owned files and identify root cause/minimal plan and test coverage. Return decision ACCEPT or HELD, plan:string, findings:[]. Do not code or run tests. Stop after analysis.';
  if (name === 'BUILDER') return common + `Builder is the only writer. Use native apply_patch file changes to implement the minimal fix plus meaningful regression tests. Do not modify driver or proof receipts. Verify Agent will run tests next, so do not run tests yourself.\nPLAN: ${input.plan}\nREVIEW FINDINGS TO ADDRESS: ${JSON.stringify(input.findings)}\nReturn decision DONE or HELD, findings:[], changed files list and concise summary. Actual changes will be independently observed; do not invent candidate fingerprint after edits.`;
  if (name === 'VERIFY') return common + `Read-only QA. Execute exactly once, without extra commands or wrappers/scripts: ${expected}\nNo edits, no retry, no skip, no test weakening. Return PASS only if every test passes with zero skipped/todo/cancelled; else FAIL. Do not repair. findings:[] or concise failure explanations.`;
  return common + `Independent Reviewer in a fresh thread, no Builder transcript. MUST execute each of these exact read commands separately, without appending commands, filters, output fabrication or wrappers/scripts (normal native shell wrapping is permitted):\n${reviewReads(task, input.verification.verificationPath).join('\n')}\nThese read the actual complete diff, current owned files and actual Verify evidence. Do not run tests, code or change files.\nReview all acceptance criteria, edge cases and whether test output belongs to this candidate. Verification artifact SHA256: ${input.verification.artifactHash}. The collector computes this hash and fresh-process readback checks it; you must inspect the artifact content and candidate. Do not invoke Get-FileHash or broaden sandbox permissions.\nReturn decision PASS with findings:[] only if complete and tests green; REVISE with actionable findings (at most one repair available), or HELD if outside authority/uncertain. Do not demand changes outside scope; do not force a revision merely to exercise the loop.`;
}

async function executeRole(name, input, workspace, pipelineDirectory) {
  const deadline = Date.now() + input.remainingMs;
  const checkBudget = () => { if (Date.now() >= deadline) stop('BUDGET_EXHAUSTED'); };
  const directory = await createPrivateDirectory({ retained: true });
  const expected = `node --test --test-reporter=tap ${input.task.testFile}`;
  const base = { repository: REPOSITORY, taskId: input.task.taskId, runId: randomUUID(), attempt: input.revision + 1, producerInstanceId: randomUUID() };
  let binding, store, writer, reader, timer, turnFinished = false, writes = Promise.resolve(), intakeError;
  const liveItems = [], acks = [];
  let complete;
  const finished = new Promise(resolveDone => { complete = resolveDone; });
  try {
    writer = new AppServer(binary(), workspace, message => {
      if (!binding || message.params?.threadId !== binding.threadId) return;
      try {
        if (message.method === 'turn/started') {
          if (binding.turnId && binding.turnId !== message.params.turn.id) stop('UNEXPECTED_TURN');
          binding.turnId = message.params.turn.id;
          store = new DevelopmentStore(directory, binding);
          writes = writes.then(() => writeDurableJson(join(directory, 'context.json'), { binding, createdAt: now(), outputReviewDeadline: new Date(Date.now() + 7 * DAY_MS).toISOString() }));
        }
        if (!binding.turnId) return;
        if (message.method === 'item/completed') {
          if (!['commandExecution', 'fileChange', 'agentMessage', 'reasoning', 'userMessage', 'plan', 'contextCompaction'].includes(message.params.item.type)) stop('FORBIDDEN_NATIVE_TOOL');
          liveItems.push(message.params.item);
          if (liveItems.length > 200) stop('ROLE_EVENT_LIMIT');
        }
        const projected = { ...message, params: { ...message.params, ...(message.params.item ? { item: project(message.params.item) } : {}) } };
        const fact = normalizeNotification(projected, binding, now());
        if (fact) writes = writes.then(async () => { acks.push(await store.ingest(fact)); }).catch(() => { intakeError = 'STORE_WRITE_FAILED'; });
        if (message.method === 'turn/completed') { turnFinished = true; complete(message.params.turn); }
      } catch (e) { intakeError = e.message; complete({ status: 'failed' }); }
    });
    await writer.initialize();
    checkBudget();
    const models = await writer.rpc('model/list', {});
    checkBudget();
    const model = models.data?.find(m => m.isDefault && !m.hidden)?.model;
    if (!model) stop('NO_DEFAULT_MODEL');
    const startedThread = await writer.rpc('thread/start', { cwd: workspace, model, approvalPolicy: 'never', sandbox: name === 'BUILDER' ? 'workspace-write' : 'read-only', developerInstructions: 'Authorized Bella development tooling task. Follow the supplied role/scope exactly. No network, MCP, subagents, credentials or changes outside assigned files. Other roles are read-only. Stop if task needs broader permissions. Use only native shell and apply_patch tools.' });
    binding = { ...base, threadId: startedThread.thread.id, sessionId: startedThread.thread.sessionId || null, turnId: null };
    await writeDurableJson(join(pipelineDirectory, `dispatch-${input.revision}-${name}.json`), { role: name, threadId: binding.threadId, candidate: input.before.fingerprint, directory, dispatchedAt: now() });
    checkBudget();
    const started = await writer.rpc('turn/start', { threadId: binding.threadId, input: [{ type: 'text', text: promptFor(name, input, expected) }], approvalPolicy: 'never', sandboxPolicy: name === 'BUILDER' ? { type: 'workspaceWrite', writableRoots: [workspace], networkAccess: false } : { type: 'readOnly' } });
    const terminal = await Promise.race([finished, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ROLE_TIMEOUT')), Math.max(1, Math.min(deadline - Date.now(), 300000))); })]);
    clearTimeout(timer);
    if (terminal.status !== 'completed' || !binding.turnId || binding.turnId !== started.turn.id || writer.notificationError || intakeError) stop(intakeError || 'NATIVE_RUNTIME_UNCERTAIN');
    await writes;
    if (intakeError) stop(intakeError);
    await writer.close();
    reader = new AppServer(binary(), workspace); await reader.initialize();
    const source = await history(reader, binding);
    for (const entry of source.entries) {
      const fact = normalizeHistory({ ...entry, item: project(entry.item) }, binding, now());
      if (fact) await store.ingest(fact);
    }
    await store.ingest(normalizeHistoryTurn(source.turn, binding, now()));
    const proof = validateStored(await store.read(), acks, binding);
    checkBudget();
    const native = nativeShape(source.entries.map(e => e.item), binding, input.task, workspace);
    if (JSON.stringify(nativeShape(liveItems, binding, input.task, workspace)) !== JSON.stringify(native)) stop('NATIVE_PAYLOAD_MISMATCH');
    const result = native.result;
    if (result.role !== name || result.candidate !== input.before.fingerprint || !Array.isArray(result.findings) || result.findings.some(f => typeof f !== 'string' || !f.trim() || f.length > 2000)) stop('INVALID_ROLE_RESULT');
    if (!native.commands.length && name !== 'BUILDER') stop('NATIVE_READ_REQUIRED');
    if (name !== 'BUILDER' && native.changes.length) stop('READ_ONLY_ROLE_CHANGED_FILES');
    let test;
    if (name === 'VERIFY') {
      if (native.commands.length !== 1 || !exactTest(native.commands[0].command, native.commands[0].cwd, expected, workspace)) stop('EXACT_TEST_REQUIRED');
      const item = source.entries.find(e => e.item.id === native.commands[0].itemId).item;
      const summary = counters(item.aggregatedOutput);
      if (!summary || !Number.isSafeInteger(item.exitCode) || item.status !== 'completed') stop('TEST_OUTPUT_INVALID');
      test = { candidate: input.before.fingerprint, itemId: item.id, command: expected, exitCode: item.exitCode, counters: summary, output: item.aggregatedOutput, outputHash: hash(item.aggregatedOutput) };
    }
    if (name === 'REVIEWER') {
      if (native.commands.some(c => c.exitCode !== 0 || c.status !== 'completed')) stop('REVIEW_COMMAND_FAILED');
      if (reviewReads(input.task, input.verification.verificationPath).some(expectedRead => !native.commands.some(c => c.exitCode === 0 && c.status === 'completed' && exactTest(c.command, c.cwd, expectedRead, workspace)))) stop('ACTUAL_REVIEW_READ_REQUIRED');
    }
    const receipt = { ...result, test, role: name, candidate: input.before.fingerprint, nativeVerified: true, binding, directory, writerPid: process.pid, native, proof, acknowledgements: acks, changed: [...new Set(native.changes.flatMap(c => c.paths))], verificationPath: join(directory, 'role.json') };
    await writeDurableJson(receipt.verificationPath, receipt);
    return { ...receipt, artifactHash: hash(await readFile(receipt.verificationPath)) };
  } finally {
    clearTimeout(timer);
    // Interrupt is a stop request, never a retry/resume. An uncertain dispatch
    // remains HELD even when the interrupt itself cannot be acknowledged.
    if (writer && binding?.turnId && !turnFinished) {
      try { await writer.rpc('turn/interrupt', { threadId: binding.threadId, turnId: binding.turnId }); }
      catch { /* closing the owned AppServer is the final stop boundary */ }
    }
    try { await writer?.close(); } finally { await reader?.close(); await writes; }
  }
}

export async function runNative(input) {
  const task = admitTask(input), workspace = workspaceIdentity(resolve(process.cwd()));
  const authority = await authorizeRepository(REPOSITORY);
  const before = await inventory(workspace);
  if (before.head !== task.sourceRevision) stop('WRONG_SOURCE_REVISION');
  for (const p of task.ownedFiles) if (!before.files.some(f => f.path === p)) stop('EXISTING_TASK_FILES_REQUIRED');
  // Durable single-use claim lives in Git's common metadata, not writable task files.
  const gitCommon = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: workspace, encoding: 'utf8', windowsHide: true }).trim();
  const claims = resolve(workspace, gitCommon, 'bella-agent-flow-task-claims'); await mkdir(claims, { recursive: true });
  let claim;
  try { claim = await open(join(claims, `${task.taskId}.json`), 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') stop('TASK_ALREADY_DISPATCHED'); throw e; }
  const directory = await createPrivateDirectory({ retained: true });
  try { await claim.writeFile(JSON.stringify({ taskId: task.taskId, directory, createdAt: now() })); await claim.sync(); } finally { await claim.close(); }
  await writeDurableJson(join(directory, 'context.json'), { createdAt: now(), outputReviewDeadline: new Date(Date.now() + 7 * DAY_MS).toISOString() });
  await writeDurableJson(join(directory, 'intake.json'), { task, workspace, before, actor: authority.actor, writerPid: process.pid });
  console.log(JSON.stringify({ phase: 'INTAKE_ACCEPTED', taskId: task.taskId, directory }));
  let count = 0;
  const result = await drive(task, {
    snapshot: () => inventory(workspace),
    role: async (name, data) => { console.log(JSON.stringify({ phase: name, revision: data.revision, candidate: data.before.fingerprint })); return executeRole(name, data, workspace, directory); },
    record: receipt => writeDurableJson(join(directory, receipt.terminal ? 'terminal.json' : `receipt-${++count}.json`), receipt.terminal || receipt),
  });
  return { ...result, directory };
}

// Fresh CLI process: re-query every native session and compare payloads and store.
export async function readNative(input) {
  await authorizeRepository(REPOSITORY);
  const directory = validateStorePath(input); await enforceReviewRetention(directory);
  const intake = JSON.parse(await readFile(join(directory, 'intake.json'), 'utf8'));
  workspaceIdentity(intake.workspace);
  if (intake.writerPid === process.pid) stop('FRESH_PROCESS_REQUIRED');
  try { process.kill(intake.writerPid, 0); stop('WRITER_STILL_RUNNING'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  const terminal = terminalRecord(JSON.parse(await readFile(join(directory, 'terminal.json'), 'utf8')));
  if (terminal.status === 'PASS') validateHandoff(terminal, admitTask(intake.task));
  if ((await inventory(intake.workspace)).fingerprint !== terminal.candidate) stop('CANDIDATE_CHANGED');
  const checks = [];
  for (const receipt of terminal.receipts) {
    const dir = validateStorePath(receipt.directory); await enforceReviewRetention(dir);
    const bytes = await readFile(join(dir, 'role.json'));
    if (hash(bytes) !== receipt.artifactHash) stop('ROLE_ARTIFACT_CHANGED');
    const original = JSON.parse(bytes);
    for (const [key, value] of Object.entries(original)) {
      // The driver augments changed with the independently observed workspace diff.
      if (key !== 'changed' && JSON.stringify(receipt[key]) !== JSON.stringify(value)) stop('ROLE_RECEIPT_MISMATCH');
    }
    if (receipt.changed.some(p => !original.changed.includes(p))) stop('ROLE_RECEIPT_MISMATCH');
    if (receipt.role === 'VERIFY' && (hash(receipt.test.output) !== receipt.test.outputHash || JSON.stringify(counters(receipt.test.output)) !== JSON.stringify(receipt.test.counters) || receipt.native.commands[0].outputHash !== receipt.test.outputHash)) stop('TEST_OUTPUT_CHANGED');
    const server = new AppServer(binary(), intake.workspace);
    try {
      await server.initialize(); const source = await history(server, receipt.binding);
      const shape = nativeShape(source.entries.map(e => e.item), receipt.binding, intake.task, intake.workspace);
      if (JSON.stringify(shape) !== JSON.stringify(receipt.native)) stop('FRESH_NATIVE_PAYLOAD_MISMATCH');
      const rows = await new DevelopmentStore(dir, receipt.binding).read();
      const fresh = source.entries.map(e => normalizeHistory({ ...e, item: project(e.item) }, receipt.binding, now())).filter(Boolean);
      fresh.push(normalizeHistoryTurn(source.turn, receipt.binding, now()));
      const comparison = reconcile([...rows.filter(r => r.fact.sourceKind === 'live_notification'), ...fresh.map(fact => ({ fact }))]);
      if (!comparison.length || comparison.some(r => r.result !== 'MATCH')) stop('FRESH_NATIVE_RECONCILIATION_FAILED');
      checks.push({ role: receipt.role, revision: receipt.revision, binding: receipt.binding, ...validateStored(rows, receipt.acknowledgements, receipt.binding), payload: 'MATCH', artifactHash: receipt.artifactHash });
    } finally { await server.close(); }
  }
  const result = { status: terminal.status === 'PASS' ? 'PASS' : 'HELD', source: 'fresh_process_native_history_and_store', taskId: terminal.taskId, candidate: terminal.candidate, revisions: terminal.revisions, checks, writerPid: intake.writerPid, readerPid: process.pid, productGoLive: 'NOT_PROVEN' };
  await writeDurableJson(join(directory, `readback-${process.pid}.json`), result);
  return { ...result, directory };
}
