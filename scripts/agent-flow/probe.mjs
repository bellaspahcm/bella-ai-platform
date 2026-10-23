import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { rm, access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, reconcile, hash, DAY_MS } from './contract.mjs';
import { createPrivateDirectory, DevelopmentStore, writeDurableJson } from './store.mjs';
import { pilotExecution, isMvpPilot } from './mvp-pilot.mjs';

export class AppServer {
  constructor(binary, cwd, onNotification = () => {}, options = {}) {
    this.pending = new Map(); this.sequence = 0; this.buffer = ''; this.closed = false;
    this.execution = isMvpPilot(options.task) ? pilotExecution(cwd, options) : null;
    this.child = spawn(binary, this.execution?.args || ['app-server', '--listen', 'stdio://'], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stderr.on('data', () => {}); // Never persist raw diagnostics.
    this.child.on('error', () => this.fail());
    this.child.on('exit', () => { this.closed = true; this.fail(); });
    this.child.stdin.on('error', () => this.fail());
    const decoder = new StringDecoder('utf8');
    this.child.stdout.once('end', () => { if (decoder.end()) this.notificationError = true; });
    this.child.stdout.on('data', bytes => {
      this.buffer += decoder.write(bytes);
      if (this.buffer.length > 4 * 1024 * 1024) { this.fail(); this.child.kill(); return; }
      const lines = this.buffer.split('\n'); this.buffer = lines.pop();
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined && (message.result !== undefined || message.error)) {
            const pending = this.pending.get(message.id);
            if (pending) { this.pending.delete(message.id); clearTimeout(pending.timer); message.error ? pending.reject(new Error('CODEX_RPC_REJECTED')) : pending.resolve(message.result); }
          } else if (message.id !== undefined && message.method) {
            this.child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Batch 1 probe denies additional requests' } }) + '\n');
          } else if (message.method) onNotification(message);
        } catch { this.notificationError = true; }
      }
    });
  }

  fail() {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CODEX_TRANSPORT_CLOSED')); }
    this.pending.clear();
  }

  rpc(method, params) {
    if (this.closed) return Promise.reject(new Error('CODEX_TRANSPORT_CLOSED'));
    return new Promise((resolveRpc, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CODEX_RPC_TIMEOUT')); }, 20000);
      this.pending.set(id, { resolve: resolveRpc, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  async initialize() {
    const result = await this.rpc('initialize', { clientInfo: { name: 'bella_monitor_batch1_dev', version: '0.0.1' }, capabilities: { experimentalApi: !!this.execution } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    return result;
  }

  async close() {
    if (this.closed) return;
    const exit = new Promise(resolveExit => this.child.once('exit', resolveExit));
    this.child.stdin.end();
    let timer;
    await Promise.race([exit, new Promise(resolveTimeout => { timer = setTimeout(() => { this.child.kill(); resolveTimeout(); }, 4000); })]);
    clearTimeout(timer);
    if (!this.closed) await Promise.race([exit, new Promise(resolveTimeout => { timer = setTimeout(resolveTimeout, 2000); })]);
    clearTimeout(timer);
    if (!this.closed) throw new Error('CODEX_PROCESS_CLEANUP_FAILED');
  }
}

export async function runProof({ retained = false, scenario = 'success' } = {}) {
  if (!['success', 'failed-tool'].includes(scenario)) throw new Error('INVALID_PROOF_SCENARIO');
  const authority = await authorizeRepository(REPOSITORY);
  const binary = process.platform === 'win32'
    ? execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0]
    : 'codex';
  const directory = await createPrivateDirectory({ retained });
  const nonce = `BELLA_BATCH1_${randomBytes(12).toString('hex')}`;
  const base = { repository: REPOSITORY, taskId: randomUUID(), runId: randomUUID(), attempt: 1, producerInstanceId: randomUUID() };
  let binding, server, replay, store, summary, completionTimer, intakeError;
  let writes = Promise.resolve();
  const acknowledgements = [];
  const live = [];
  let resolveCompletion;
  const complete = new Promise(resolveDone => { resolveCompletion = resolveDone; });
  try {
    server = new AppServer(binary, directory, message => {
      if (!binding) return;
      if (live.length >= 200) { server.notificationError = true; return; }
      if (message.method === 'item/started' && !['commandExecution', 'agentMessage', 'reasoning', 'userMessage'].includes(message.params?.item?.type)) server.notificationError = true;
      if (message.params?.threadId !== binding.threadId) return;
      const turnId = message.params?.turnId || message.params?.turn?.id || binding.turnId;
      if (!turnId) return;
      try {
        if (!binding.turnId) {
          if (message.method !== 'turn/started') return;
          binding.turnId = turnId;
          store = new DevelopmentStore(directory, binding, { nonce });
          writes = writes.then(() => writeDurableJson(join(directory, 'context.json'), { binding, nonce, scenario, createdAt: new Date().toISOString(), outputReviewDeadline: new Date(Date.now() + 7 * DAY_MS).toISOString() }));
        }
        const normalized = normalizeNotification(message, binding, new Date().toISOString(), nonce);
        if (normalized) {
          live.push(normalized);
          writes = writes.then(async () => { if (!intakeError) acknowledgements.push(await store.ingest(normalized)); }).catch(() => { intakeError = 'PERSISTENCE_FAILED'; });
        }
        if (normalized?.method === 'turn/completed') resolveCompletion(normalized);
      } catch { server.notificationError = true; }
    });
    const init = await server.initialize();
    const models = await server.rpc('model/list', {});
    const model = models.data?.find(m => m.isDefault && !m.hidden)?.model;
    if (!model) throw new Error('NO_DEFAULT_MODEL');
    const created = await server.rpc('thread/start', {
      cwd: directory, model, approvalPolicy: 'never', sandbox: 'read-only',
      developerInstructions: 'Authorized Bella isolated transport proof. Run only the requested harmless arithmetic/output command once. No file reads/writes, network tools, MCP, delegation, credentials or repository access. Report command outcome then stop.',
    });
    binding = { ...base, threadId: created.thread.id, sessionId: created.thread.sessionId, turnId: null };
    let command = process.platform === 'win32'
      ? `$probeValue = 19 + 23; if ($probeValue -ne 42) { throw 'Assertion failed' }; Write-Output '${nonce}'; Write-Output ('UTC=' + [DateTime]::UtcNow.ToString('o')); Write-Output 'ASSERT_19_PLUS_23_EQ_42=PASS'`
      : `test "$((19+23))" = 42 && printf '%s\\n' '${nonce}' "UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)" 'ASSERT_19_PLUS_23_EQ_42=PASS'`;
    if (scenario === 'failed-tool') command += process.platform === 'win32' ? '; exit 7' : '; exit 7';
    const started = await server.rpc('turn/start', { threadId: binding.threadId, input: [{ type: 'text', text: `Execute exactly this shell command once with the shell tool, report real output and exit code, then stop. Exit 7 is intentional for the failed-tool scenario: do not retry it. No other work.\n${command}` }], approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly' } });
    if (binding.turnId && binding.turnId !== started.turn.id) throw new Error('TURN_ID_MISMATCH');
    // thread binding must be established by the actual turn/started notification.
    const bindingDeadline = Date.now() + 5000;
    while (!binding.turnId && Date.now() < bindingDeadline) await new Promise(resolveTick => setTimeout(resolveTick, 20));
    if (!binding.turnId || binding.turnId !== started.turn.id) throw new Error('MISSING_TURN_STARTED');
    const result = await Promise.race([complete, new Promise((_, reject) => { completionTimer = setTimeout(() => reject(new Error('TURN_TIMEOUT')), 120000); })]);
    clearTimeout(completionTimer);
    if (result.turnId !== binding.turnId || result.status !== 'completed' || server.notificationError) throw new Error('RUNTIME_PROOF_FAILED');
    await writes;
    if (intakeError) throw new Error(intakeError);
    const observed = live.filter(f => f.turnId === binding.turnId);
    const commandFact = observed.find(f => f.method === 'item/completed' && f.itemType === 'commandExecution');
    if (!commandFact?.output || commandFact.exitCode !== (scenario === 'success' ? 0 : 7) || observed.filter(f => f.method === 'item/completed' && f.itemType === 'commandExecution').length !== 1) throw new Error('COMMAND_PROOF_FAILED');
    const duplicate = await store.ingest(commandFact);
    await server.close();
    replay = new AppServer(binary, directory);
    await replay.initialize();
    const rows = await new DevelopmentStore(directory, binding, { nonce }).read();
    if (!rows.some(r => r.fact.itemId === commandFact.itemId && r.fact.output?.sha256 === commandFact.output.sha256) || !duplicate.duplicate) throw new Error('READ_BACK_FAILED');
    let cursor = null, pages = 0;
    do {
      const page = await replay.rpc('thread/items/list', { threadId: binding.threadId, turnId: binding.turnId, sortDirection: 'asc', limit: 50, ...(cursor ? { cursor } : {}) });
      for (const entry of page.data || []) {
        const f = normalizeHistory(entry, binding, new Date().toISOString(), nonce);
        if (f) await store.ingest(f);
      }
      cursor = page.nextCursor;
      if (++pages > 10) throw new Error('HISTORY_PAGE_LIMIT');
    } while (cursor);
    const turns = await replay.rpc('thread/turns/list', { threadId: binding.threadId, limit: 10, sortDirection: 'desc', itemsView: 'notLoaded' });
    const turn = turns.data?.find(t => t.id === binding.turnId);
    const turnFact = normalizeHistoryTurn(turn, binding, new Date().toISOString());
    if (!turnFact || turns.data.length !== 1) throw new Error('ONE_TURN_HISTORY_REQUIRED');
    await store.ingest(turnFact);
    const persisted = await store.read();
    const reconciliation = reconcile(persisted);
    if (reconciliation.length === 0 || reconciliation.some(r => r.result !== 'MATCH')) throw new Error('HISTORY_RECONCILIATION_FAILED');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const gitHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
    summary = {
      result: retained ? 'PASS_LIFECYCLE_WRITER' : 'PASS_ISOLATED_BATCH1_PROOF', source: 'real_app_server', version: init.userAgent,
      scenario, executionResult: scenario === 'success' ? 'PASS' : 'FAIL_EXPECTED_EXIT_7',
      repository: REPOSITORY, actor: authority.actor, permission: authority.permission,
      binding, codeBaseline: { source: 'git', sha: gitHead, isAgentCommitEvidence: false },
      command: { itemId: commandFact.itemId, exitCode: commandFact.exitCode, outputHash: commandFact.output.sha256, receivedAt: commandFact.receivedAt },
      factCount: persisted.length, duplicateCollapsed: duplicate.duplicate,
      readBackAfterSourceRestart: true, reconciliation,
      retention: 'OPERATION_TIME_ONLY',
      fullReplay: 'NOT_PROVEN', desktop: 'NOT_PROVEN', agentCommitTestLinkage: 'NOT_PROVEN', monitorEndToEnd: 'BLOCKED',
    };
    if (retained) {
      const files = ['authority.mjs', 'contract.mjs', 'store.mjs', 'probe.mjs', 'readback.mjs', 'completion.mjs', 'agent-flow.test.mjs'];
      const sourceFiles = [];
      for (const file of files) sourceFiles.push({ path: `scripts/agent-flow/${file}`, sha256: hash(await readFile(join(root, 'scripts/agent-flow', file))) });
      await writeDurableJson(join(directory, 'writer-result.json'), { ...summary, writerPid: process.pid, acknowledgements, sourceFiles });
    }
  } finally {
    clearTimeout(completionTimer);
    try { await server?.close(); } finally {
      try { await replay?.close(); } finally {
        // Owner cleanup must not be blocked by a GitHub/network outage.
        // directory was freshly created by this function, never caller supplied.
        await writes;
        if (!retained) await rm(directory, { recursive: true, force: true });
      }
    }
  }
  if (retained) return { ...summary, evidenceDirectory: directory, retainedForIndependentReview: true, childServersStopped: true };
  let removed = false;
  try { await access(directory); } catch (error) { if (error.code === 'ENOENT') removed = true; }
  if (!removed) throw new Error('STORE_CLEANUP_FAILED');
  return { ...summary, temporaryStoreRemoved: true, childServersStopped: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const retained = process.argv.includes('--retain');
  const scenario = process.argv.includes('--failed-tool') ? 'failed-tool' : 'success';
  runProof({ retained, scenario }).then(summary => console.log(JSON.stringify(summary, null, 2))).catch(error => {
    const code = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'UNCLASSIFIED_FAILURE';
    console.error(`BATCH1_PROOF_FAILED:${code}; no runtime PASS claimed.`);
    process.exitCode = 1;
  });
}
