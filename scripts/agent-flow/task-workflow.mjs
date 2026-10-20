import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AppServer } from './probe.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { createPrivateDirectory, DevelopmentStore, writeDurableJson } from './store.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, hash, DAY_MS } from './contract.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OWNED = ['scripts/agent-flow/contract.mjs', 'scripts/agent-flow/agent-flow.test.mjs'];
export const binary = () => process.platform === 'win32' ? execFileSync('where.exe', ['codex.exe'], { windowsHide: true, encoding: 'utf8' }).trim().split(/\r?\n/)[0] : 'codex';

export function testCounters(output) {
  if (typeof output !== 'string') return null;
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:ℹ|#)\s+(tests|pass|fail|cancelled|skipped|todo)\b(.*)$/s);
    if (!match) continue;
    if (Object.hasOwn(values, match[1]) || !/^\s+\d+\s*$/.test(match[2])) return null;
    values[match[1]] = Number(match[2]);
  }
  if (!['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].every(k => Number.isSafeInteger(values[k]) && values[k] >= 0)) return null;
  const total = values.pass + values.fail + values.cancelled + values.skipped + values.todo;
  return Number.isSafeInteger(total) && values.tests === total ? values : null;
}

export function classifyTestCommand(command, cwd) {
  if (typeof command !== 'string') return null;
  // Recognize only this suite invocation, either directly or the shell wrapper
  // emitted by Codex. No echo, compound script, redirection or arbitrary args.
  const exact = 'node --test scripts/agent-flow/agent-flow.test.mjs';
  const text = command.trim();
  const direct = text === exact;
  const wrapped = /^(?:"[A-Za-z]:[\\/][A-Za-z0-9_ .\\/-]*[\\/](?:powershell|pwsh)\.exe"|(?:powershell|pwsh)(?:\.exe)?)\s+(?:-NoProfile\s+)?(?:-NonInteractive\s+)?-Command\s+["']node --test scripts\/agent-flow\/agent-flow\.test\.mjs["']$/i.test(text);
  return (direct || wrapped) && typeof cwd === 'string' && resolve(cwd) === ROOT ? { classification: 'NODE_TEST_APPROVED_SUITE', commandHash: hash(text) } : null;
}

export async function workspaceInventory() {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = join(directory, entry.name);
      const path = relative(ROOT, full).replaceAll('\\', '/');
      if (entry.isDirectory()) await visit(full);
      else files.push({ path, sha256: hash(await readFile(full)) });
    }
  }
  await visit(ROOT); return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function projectItem(item) {
  // No raw command, prompt, transcript, stdout/stderr, reasoning or patch payload.
  return item ? { id: item.id, type: item.type, status: item.status, exitCode: item.exitCode } : undefined;
}

export function changeMetadata(item, root = ROOT) {
  if (item?.type !== 'fileChange') return null;
  const paths = (item.changes || []).map(change => {
    const local = relative(root, resolve(root, change.path)).replaceAll('\\', '/');
    if (!OWNED.includes(local)) throw new Error('AGENT_CHANGED_FORBIDDEN_PATH');
    return local;
  });
  return { itemId: item.id, type: 'fileChange', status: item.status, paths: [...new Set(paths)].sort() };
}

export async function sourceInventory() {
  const names = (await readdir(join(ROOT, 'scripts/agent-flow'))).filter(f => f.endsWith('.mjs')).sort();
  const files = [];
  for (const name of names) {
    const path = `scripts/agent-flow/${name}`;
    files.push({ path, sha256: hash(await readFile(join(ROOT, path))) });
  }
  return files;
}

export async function history(server, binding) {
  const entries = []; let cursor, pages = 0;
  do {
    const page = await server.rpc('thread/items/list', { threadId: binding.threadId, turnId: binding.turnId, sortDirection: 'asc', limit: 50, ...(cursor ? { cursor } : {}) });
    entries.push(...(page.data || [])); cursor = page.nextCursor;
    if (++pages > 20) throw new Error('HISTORY_PAGE_LIMIT');
  } while (cursor);
  const turns = await server.rpc('thread/turns/list', { threadId: binding.threadId, limit: 10, itemsView: 'notLoaded' });
  if (turns.data?.length !== 1 || turns.data[0].id !== binding.turnId) throw new Error('ONE_TASK_TURN_REQUIRED');
  return { entries, turn: turns.data[0] };
}

export function projectHistory(source, binding) {
  const facts = [], tests = [], changes = [];
  const receivedAt = new Date().toISOString();
  for (const entry of source.entries) {
    const fact = normalizeHistory({ ...entry, item: projectItem(entry.item) }, binding, receivedAt);
    if (fact) facts.push(fact);
    if (entry.item?.type === 'commandExecution') {
      const counters = testCounters(entry.item.aggregatedOutput);
      if (counters) {
        const command = classifyTestCommand(entry.item.command, entry.item.cwd);
        if (!command) throw new Error('UNVERIFIED_TEST_COMMAND');
        tests.push({ itemId: entry.item.id, exitCode: entry.item.exitCode, counters, ...command });
      }
    }
    const change = changeMetadata(entry.item);
    if (change) changes.push(change);
  }
  facts.push(normalizeHistoryTurn(source.turn, binding, receivedAt));
  return { facts, tests, changes };
}

function verifyRedGreen(tests) {
  const counters = ['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo'];
  if (!Array.isArray(tests) || tests.length < 2 || Array.from(tests).some(t =>
    !t || !Number.isSafeInteger(t.exitCode) || !t.counters ||
    !counters.every(key => Number.isSafeInteger(t.counters[key]) && t.counters[key] >= 0)
  )) throw new Error('REAL_RED_GREEN_REQUIRED');
  const red = tests.findIndex(t => t.exitCode !== 0 && t.counters.fail > 0);
  const green = tests.length - 1;
  const final = tests[green];
  if (red < 0 || green <= red || final.exitCode !== 0 || final.counters.tests === 0 ||
    final.counters.pass !== final.counters.tests ||
    ['fail', 'skipped', 'cancelled', 'todo'].some(key => final.counters[key] !== 0)
  ) throw new Error('REAL_RED_GREEN_REQUIRED');
  return { red: tests[red], green: tests[green] };
}
export { verifyRedGreen };

export async function runTask() {
  const authority = await authorizeRepository(REPOSITORY);
  const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
  if (baseline !== '49f78e358817bb3991f699cc678204a3bd5ea8f9') throw new Error('WRONG_BASELINE');
  const before = await sourceInventory();
  const workspaceBefore = await workspaceInventory();
  const directory = await createPrivateDirectory({ retained: true });
  console.log(JSON.stringify({ phase: 'task_evidence_created', directory }));
  const createdAt = new Date().toISOString();
  const retention = { scenario: 'software-task', createdAt, outputReviewDeadline: new Date(Date.parse(createdAt) + 7 * DAY_MS).toISOString() };
  await writeDurableJson(join(directory, 'context.json'), retention);
  const beforeOwned = [];
  for (const path of OWNED) beforeOwned.push({ path, source: await readFile(join(ROOT, path), 'utf8') });
  await writeDurableJson(join(directory, 'before-source.json'), beforeOwned);
  const base = { repository: REPOSITORY, taskId: randomUUID(), runId: randomUUID(), attempt: 1, producerInstanceId: randomUUID() };
  let binding, store, server, queue = Promise.resolve(), failure, timeout;
  const acks = [], tests = [], changes = [];
  let completed;
  const done = new Promise(resolveDone => { completed = resolveDone; });
  try {
    server = new AppServer(binary(), ROOT, message => {
      if (!binding || message.params?.threadId !== binding.threadId) return;
      if (!binding.turnId && message.method === 'turn/started') {
        binding.turnId = message.params.turn.id;
        store = new DevelopmentStore(directory, binding);
        queue = queue.then(async () => {
          // Expiry is established before source is retained; binding is added
          // only after the real turn identity arrives.
          const { writeFile } = await import('node:fs/promises');
          await writeFile(join(directory, 'context.json'), JSON.stringify({ ...retention, binding }), { mode: 0o600 });
        });
      }
      if (!binding.turnId) return;
      try {
        const p = message.params;
        if (p.turnId && p.turnId !== binding.turnId) throw new Error('UNEXPECTED_AGENT_TURN');
        if (message.method === 'item/completed') {
          const counters = p.item?.type === 'commandExecution' ? testCounters(p.item.aggregatedOutput) : null;
          if (counters) {
            const command = classifyTestCommand(p.item.command, p.item.cwd);
            if (!command) throw new Error('UNVERIFIED_TEST_COMMAND');
            const test = { itemId: p.item.id, exitCode: p.item.exitCode, counters, ...command };
            tests.push(test);
            if (test.exitCode !== 0 && counters.fail > 0 && !tests.slice(0, -1).some(t => t.counters.fail > 0)) {
              // Snapshot read starts synchronously at the RED completion boundary,
              // before a later file-change tool can complete.
              const redSnapshot = Promise.all(OWNED.map(async path => ({ path, source: await readFile(join(ROOT, path), 'utf8') })));
              queue = queue.then(async () => {
                const sources = await redSnapshot;
                if (hash(sources.find(f => f.path.endsWith('/contract.mjs')).source) !== before.find(f => f.path.endsWith('/contract.mjs')).sha256) throw new Error('IMPLEMENTATION_CHANGED_BEFORE_RED');
                await writeDurableJson(join(directory, 'red-source.json'), { test, sources });
              }).catch(() => { failure = 'RED_SNAPSHOT_FAILED'; });
            }
          }
          const change = changeMetadata(p.item);
          if (change) changes.push(change);
        }
        const fact = normalizeNotification({ method: message.method, params: { ...p, item: projectItem(p.item) } }, binding, new Date().toISOString());
        if (fact) queue = queue.then(async () => { if (!failure) acks.push(await store.ingest(fact)); }).catch(() => { failure = 'PERSISTENCE_FAILED'; });
        if (message.method === 'turn/completed') completed(p.turn);
        if (message.method === 'item/started' && !['reasoning', 'userMessage', 'agentMessage', 'commandExecution', 'fileChange'].includes(p.item?.type)) failure = 'UNEXPECTED_TASK_TOOL';
      } catch (error) { failure = /^[A-Z_]+$/.test(error.message) ? error.message : 'INVALID_TASK_EVENT'; }
    });
    await server.initialize();
    const models = await server.rpc('model/list', {});
    const model = models.data?.find(m => m.isDefault && !m.hidden)?.model;
    if (!model) throw new Error('NO_DEFAULT_MODEL');
    const thread = await server.rpc('thread/start', {
      cwd: ROOT, model, approvalPolicy: 'never', sandbox: 'workspace-write',
      developerInstructions: 'User authorized one real local software task. You own ONLY scripts/agent-flow/contract.mjs and scripts/agent-flow/agent-flow.test.mjs. Do not edit any other path, no other agent, no commit/push/PR/deploy, no business DB/network/MCP/.env/credentials. Approved gate is scripts/agent-flow/ARCHITECTURE_GATE_RESULT_TASK.md. Implement within this already-authorized scope without asking duplicate approval. Use apply_patch for edits so source changes are observable. Run real node tests RED before implementation and GREEN afterward. Do not weaken tests or assertions.',
    });
    binding = { ...base, threadId: thread.thread.id, sessionId: thread.thread.sessionId, turnId: null };
    const task = `Fix a real reconciliation scope defect. Reproducer: reconcile([{fact:live completed turn of runA},{fact:history.turn of runB}]) returns MATCH because key is itemId || '@turn'. Canonical approved invariant: repository/task/run/thread/turn scopes must never cross-match even if source item IDs coincide.\nRead the approved gate and relevant source. First add regression tests covering individually different repository,taskId,runId,threadId,turnId (including colliding itemId or null turn item), run node --test scripts/agent-flow/agent-flow.test.mjs and observe failure. THEN make the smallest change to reconcile internal grouping key to include scope, preserving same-scope result shape and existing tests. Use apply_patch. Run that exact real test command again until GREEN. Only edit the two owned files. No new dependencies or broad refactors. Finish with concise actual results. No other workflow/sprint documentation edits are authorized.`;
    await server.rpc('turn/start', { threadId: binding.threadId, input: [{ type: 'text', text: task }], approvalPolicy: 'never', sandboxPolicy: { type: 'workspaceWrite', writableRoots: [ROOT], networkAccess: false } });
    const outcome = await Promise.race([done, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('TASK_TIMEOUT')), 300000); })]);
    clearTimeout(timeout); await queue;
    if (failure || server.notificationError || outcome.status !== 'completed') throw new Error(failure || 'TASK_RUNTIME_FAILED');
    const redGreen = verifyRedGreen(tests);
    if (!changes.some(c => c.status === 'completed' && c.paths.length)) throw new Error('NATIVE_FILE_CHANGE_REQUIRED');
    const after = await sourceInventory();
    const workspaceAfter = await workspaceInventory();
    const allPaths = new Set([...workspaceBefore.map(f => f.path), ...workspaceAfter.map(f => f.path)]);
    const workspaceChanged = [...allPaths].filter(path => workspaceBefore.find(f => f.path === path)?.sha256 !== workspaceAfter.find(f => f.path === path)?.sha256);
    if (workspaceChanged.length !== 2 || workspaceChanged.some(path => !OWNED.includes(path))) throw new Error('WORKSPACE_SCOPE_VIOLATION');
    const changed = after.filter(f => before.find(b => b.path === f.path)?.sha256 !== f.sha256).map(f => f.path);
    if (changed.length !== 2 || changed.some(path => !OWNED.includes(path)) || after.length !== before.length) throw new Error('AGENT_CODE_SCOPE_VIOLATION');
    const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
    if (tracked) throw new Error('TRACKED_SCOPE_VIOLATION');
    const afterOwned = [];
    for (const path of OWNED) afterOwned.push({ path, source: await readFile(join(ROOT, path), 'utf8') });
    await writeDurableJson(join(directory, 'after-source.json'), afterOwned);
    // Source process restart before obtaining history snapshots.
    await server.close();
    server = new AppServer(binary(), ROOT); await server.initialize();
    const snapshots = projectHistory(await history(server, binding), binding);
    if (JSON.stringify(snapshots.tests) !== JSON.stringify(tests) || JSON.stringify(snapshots.changes) !== JSON.stringify(changes)) throw new Error('SOURCE_TASK_EVIDENCE_MISMATCH');
    for (const f of snapshots.facts) await store.ingest(f);
    await writeDurableJson(join(directory, 'task-result.json'), { result: 'TASK_WRITER_PASS_PENDING_REVIEW', writerPid: process.pid, baseline, binding, model, authority, before, after, changed, workspaceChanged, workspaceBeforeHash: hash(JSON.stringify(workspaceBefore)), workspaceAfterHash: hash(JSON.stringify(workspaceAfter)), acks, tests, changes, redGreen, snapshotCount: snapshots.facts.length, taskScope: 'reconciliation scope bugfix only', production: 'UNTOUCHED' });
    return { result: 'TASK_WRITER_PASS_PENDING_REVIEW', directory, binding, changed, redGreen };
  } finally { clearTimeout(timeout); await queue; await server?.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runTask().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'TASK_FAILED'); process.exitCode = 1; });
