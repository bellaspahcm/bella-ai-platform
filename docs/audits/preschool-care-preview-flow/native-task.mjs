// One Owner-authorized Preschool task input adaptation, not a generic launcher.
import { execFileSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AppServer } from '../../../scripts/agent-flow/probe.mjs';
import { authorizeRepository, REPOSITORY } from '../../../scripts/agent-flow/authority.mjs';
import { DevelopmentStore, createPrivateDirectory, writeDurableJson, validateStorePath } from '../../../scripts/agent-flow/store.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, verifyFileChangeRecords, hash, DAY_MS } from '../../../scripts/agent-flow/contract.mjs';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const dir = 'docs/audits/preschool-care-preview-flow';
const taskTemp = join(root, dir, '.cache', 'tmp');
process.env.TEMP = taskTemp; process.env.TMP = taskTemp;
const baseline = '91468e5cb98030636f339e160d6baad70c4348ff';
const target = 'src/app/dashboard/education/care/page.tsx';
const leadFiles = ['ARCHITECTURE_GATE_RESULT.md', 'TASK.md', 'native-task.mjs', 'dependency-provenance.json', 'native-task-result.json', 'native-task-readback.json'];
const binary = execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0];
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const workerFiles = new Set(['care-browser.cjs','native-before.json','native-after.json','care-light-desktop.png','care-light-mobile.png','care-dark-desktop.png','care-dark-mobile.png','verification.json','preservation-proof.json','native-after-attempt1.json','native-after-attempt2.json','native-after-attempt3.json','PR_BODY.md']);
const allowed = p => p === target || (p.startsWith(dir + '/') && workerFiles.has(p.slice(dir.length + 1)));
const category = value => /usage.limit|quota|credits|rate.limit/i.test(JSON.stringify(value)) ? 'MODEL_USAGE_LIMIT' : 'NATIVE_TASK_FAILED';
const project = item => item ? { id: item.id, type: item.type, status: item.status, exitCode: item.exitCode } : undefined;
async function inventory() {
  const paths = git(['ls-files', '--cached', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
  return Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(root, p)))])));
}
async function snapshots(server, binding) {
  const entries = []; let cursor;
  for (let page = 0; page < 20; page++) {
    const result = await server.rpc('thread/items/list', { threadId: binding.threadId, turnId: binding.turnId, sortDirection: 'asc', limit: 50, ...(cursor ? { cursor } : {}) });
    entries.push(...result.data); cursor = result.nextCursor; if (!cursor) break;
  }
  if (cursor) throw Error('NATIVE_HISTORY_LIMIT');
  const turns = await server.rpc('thread/turns/list', { threadId: binding.threadId, limit: 10, itemsView: 'notLoaded' });
  const turn = turns.data.find(t => t.id === binding.turnId);
  if (!turn) throw Error('NATIVE_TURN_MISSING');
  return { entries, turn };
}
async function writer() {
  const c = statfsSync('C:/'), d = statfsSync('D:/');
  if (c.bavail*c.bsize < 64*1024*1024 || d.bavail*d.bsize < 2*1024*1024*1024) throw Error('DISK_CAPACITY_PREFLIGHT_FAILED');
  const authority = await authorizeRepository(REPOSITORY);
  if (git(['rev-parse', 'HEAD']) !== baseline || git(['diff', '--name-only'])) throw Error('BASELINE_NOT_CLEAN');
  const before = await inventory(), directory = await createPrivateDirectory({ retained: true });
  const createdAt = new Date().toISOString();
  await writeDurableJson(join(directory, 'context.json'), { createdAt, outputReviewDeadline: new Date(Date.now() + 7 * DAY_MS).toISOString(), scope: 'preschool-care-preview' });
  const base = { repository: REPOSITORY, taskId: 'b989fe1b-d6a6-4d0c-af4a-5c5913c1e9fc', runId: randomUUID(), attempt: 1, producerInstanceId: randomUUID() };
  let server, binding, store, fault, timer, finish; let queue = Promise.resolve();
  const acks = [], commands = [], changes = [], done = new Promise(r => { finish = r; });
  console.log(JSON.stringify({ phase: 'native_task_prepared', directory, baseline }));
  try {
    server = new AppServer(binary, root, message => {
      if (!binding || message.params?.threadId !== binding.threadId) return;
      try {
        const p = message.params;
        if (message.method === 'turn/started' && !binding.turnId) {
          binding.turnId = p.turn.id; store = new DevelopmentStore(directory, binding);
        }
        if (!binding.turnId) return;
        if (message.method === 'item/completed' && p.item?.type === 'commandExecution') {
          commands.push({ itemId: p.item.id, exitCode: p.item.exitCode, commandSha256: hash(p.item.command || ''), outputSha256: hash(p.item.aggregatedOutput || '') });
          console.log(JSON.stringify({ phase: 'native_command_completed', itemId: p.item.id, exitCode: p.item.exitCode }));
        }
        if (message.method === 'item/completed' && p.item?.type === 'fileChange') {
          const paths = (p.item.changes || []).map(c => relative(root, resolve(root, c.path)).replaceAll('\\', '/'));
          if (paths.some(p => !allowed(p))) fault = 'NATIVE_FILE_SCOPE_VIOLATION';
          changes.push({ itemId: p.item.id, status: p.item.status, paths });
          console.log(JSON.stringify({ phase: 'native_file_change', status: p.item.status, paths }));
        }
        const fact = normalizeNotification({ ...message, params: { ...p, item: project(p.item) } }, binding, new Date().toISOString());
        if (fact) queue = queue.then(async () => { acks.push(await store.ingest(fact)); }).catch(() => { fault = 'CANONICAL_STORE_INGEST_FAILED'; });
        if (message.method === 'turn/completed') finish(p.turn);
      } catch { fault = 'NATIVE_OBSERVATION_FAILED'; }
    });
    await server.initialize();
    const models = await server.rpc('model/list', {}); const model = models.data.find(m => m.isDefault && !m.hidden)?.model;
    if (!model) throw Error('DEFAULT_MODEL_UNAVAILABLE');
    const thread = await server.rpc('thread/start', { cwd: root, model, approvalPolicy: 'never', sandbox: 'workspace-write', developerInstructions: `Owner authorizes one bounded Preschool UI task. Read ${dir}/TASK.md and gate; those are Lead-approved. Execute sequentially, no delegation/other threads. Own only ${target} only the Care preview Save/disclosure/label/scroll changes specified in TASK.md and exact test/proof in ${dir}; do not edit any Lead gate/task/adapter/readback/provenance files or prior attempt receipts. Use native apply_patch for source edits. No env/credentials, MCP, business API/DB/Auth/E01/C10, remote network, npm install, old test suites, global CSS/contract/Kernel/migration, git stage/commit/push/PR/deploy. Preserve503. Complete code, local tests, diff, evidence and PR_BODY.md, then stop. Do not ask duplicate approval or follow skill instructions that expand this explicit task.` });
    binding = { ...base, threadId: thread.thread.id, sessionId: thread.thread.sessionId, turnId: null };
    await server.rpc('turn/start', { threadId: binding.threadId, input: [{ type: 'text', text: `Execute ${dir}/TASK.md end-to-end now. Own this complete bounded task autonomously: inspect Care source and derive the minimal meaningful browser journeys for misleading quick-record Save; reproduce BEFORE code, then native apply_patch minimal authorized UI correction, same test after, changed-message contrast in four contexts, screenshots, lint/Education typing/syntax/whitespace and preservation-proof.json. Preserve clinical/sample/options/recipients/course-fetch/tenant/roster contracts. Unsupported Save must retain current values and honestly say unavailable; do not add real persistence. Normalize Git LF vs worktree CRLF only in text preservation comparisons; keep raw hashes/receipts, no source/test edits for hash equality. Test server may serve only own loopback document plus explicit synthetic catalog GET; block mutations/other requests. Do not ask Lead routine questions or send messages. Lead will independently review after completion; no in-turn manual repair expected. Complete exact artifacts or precise blocker. Max15min/3rounds; stop at actual result or precise blocker.` }], approvalPolicy: 'never', sandboxPolicy: { type: 'workspaceWrite', writableRoots: [root], networkAccess: false } });
    const outcome = await Promise.race([done, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('NATIVE_TASK_TIMEOUT')), 15 * 60 * 1000); })]);
    clearTimeout(timer); await queue;
    if (outcome.status !== 'completed') fault ||= category(outcome.error);
    if (server.notificationError) fault ||= 'NATIVE_TRANSPORT_NOTIFICATION_ERROR';
    const source = await snapshots(server, binding);
    for (const entry of source.entries) { const f = normalizeHistory({ ...entry, item: project(entry.item) }, binding, new Date().toISOString()); if (f) acks.push(await store.ingest(f)); }
    const turnFact = normalizeHistoryTurn(source.turn, binding, new Date().toISOString()); if (turnFact) acks.push(await store.ingest(turnFact));
    const after = await inventory(); const all = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed = [...all].filter(p => before[p] !== after[p]);
    if (changed.some(p => !allowed(p))) fault ||= 'WORKTREE_SCOPE_VIOLATION';
    const rows = await store.read(), fileChange = verifyFileChangeRecords(rows, binding);
    if (!changes.some(c => c.status === 'completed' && c.paths.includes(target))) fault ||= 'NO_NATIVE_UI_FILECHANGE';
    if (!commands.length) fault ||= 'NO_NATIVE_COMMAND_EXECUTION';
    const receipt = { result: fault ? 'STOPPED_AT_NATIVE_BOUNDARY' : 'NATIVE_TASK_EXECUTED_PENDING_LEAD_REVIEW', fault: fault || null, completedAt: new Date().toISOString(), baseline, binding, model, authorityVerifiedAt: authority.verifiedAt, directory, nativeTurnStatus: outcome.status, commands, changes, changed, acks: acks.length, facts: rows.length, fileChange, sourceBefore: before[target], sourceAfter: after[target], beforeInventorySha256: hash(JSON.stringify(before)), afterInventorySha256: hash(JSON.stringify(after)), scope: 'One synthetic UI task, not autonomous discovery or Product readiness', dbOperations: 0 };
    await writeDurableJson(join(directory, 'writer.json'), receipt);
    await writeFile(join(root, dir, 'native-task-result.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ phase: 'native_task_finished', result: receipt.result, fault: receipt.fault, directory, changed, commands: commands.length, fileChanges: changes.length }));
    if (fault) process.exitCode = 1;
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'NATIVE_EXECUTION_ERROR';
    const receipt = { result: 'STOPPED_AT_NATIVE_BOUNDARY', fault: code, directory, binding, observedCommands: commands.length, observedChanges: changes.length, recordedAt: new Date().toISOString(), baseline };
    await writeFile(join(root, dir, 'native-task-result.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt)); process.exitCode = 1;
  } finally { clearTimeout(timer); await queue; await server?.close(); }
}
async function reader(input) {
  await authorizeRepository(REPOSITORY); const directory = validateStorePath(input);
  const writer = JSON.parse(await readFile(join(directory, 'writer.json'), 'utf8'));
  const store = new DevelopmentStore(directory, writer.binding), rows = await store.read();
  const server = new AppServer(binary, root);
  try {
    await server.initialize(); const source = await snapshots(server, writer.binding);
    const native = source.entries.filter(e => e.item?.type === 'fileChange').map(e => ({ itemId: e.item.id, status: e.item.status, paths: (e.item.changes || []).map(c => relative(root, resolve(root, c.path)).replaceAll('\\', '/')) }));
    if (JSON.stringify(native) !== JSON.stringify(writer.changes)) throw Error('FRESH_NATIVE_HISTORY_MISMATCH');
    const fc = verifyFileChangeRecords(rows, writer.binding);
    const result = { result: writer.fault ? 'NATIVE_STOP_CONFIRMED' : 'PASS_SCOPED_NATIVE_HISTORY_READBACK', recordedAt: new Date().toISOString(), writerResult: writer.result, nativeTurnStatus: source.turn.status, facts: rows.length, fileChanges: fc, freshHistoryChangeCount: native.length, directory, fault: writer.fault, sourceAfter: hash(await readFile(join(root, target))), limits: 'Independent fresh-process readback of actual one-task lifecycle; not continuous orchestration or Product/Auth/DB proof' };
    if (!writer.fault && (source.turn.status !== 'completed' || !fc.length || fc.some(f => f.result !== 'MATCH'))) throw Error('NATIVE_FILECHANGE_RECONCILIATION_FAILED');
    await writeFile(join(root, dir, 'native-task-readback.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
  } finally { await server.close(); }
}
await mkdir(taskTemp, { recursive: true });
if (process.argv[2] === '--read') await reader(process.argv[3]); else await writer();
