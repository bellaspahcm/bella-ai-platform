import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { lstatSync, realpathSync } from 'node:fs';
import { rm, access, readFile, mkdir, rmdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { normalizeNotification, normalizeHistory, normalizeHistoryTurn, reconcile, hash, DAY_MS } from './contract.mjs';
import { createPrivateDirectory, DevelopmentStore, writeDurableJson } from './store.mjs';
import { admitTask, productTaskHash, productJestConfig } from './role-validation.mjs';
import { pilotExecution, isMvpPilot } from './mvp-pilot.mjs';

const permissionFailure = code => { throw new Error(code); };
const canonicalPath = value => process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value);

// Refuse aliases at every existing ancestor, including Windows junctions.
export function assertFactoryPath(path, directory = false) {
  let current = resolve(path), first = true;
  for (;;) {
    const info = lstatSync(current);
    if (info.isSymbolicLink() || (first && !directory && info.nlink > 1) || canonicalPath(realpathSync(current)) !== canonicalPath(current) ||
        (first ? (directory ? !info.isDirectory() : !info.isFile()) : !info.isDirectory())) permissionFailure('UNSAFE_FACTORY_PERMISSION_PATH');
    first = false;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function factoryScratch(cwd, input, approval) {
  const task = admitTask(input, approval);
  if (isMvpPilot(task)) permissionFailure('INVALID_FACTORY_PERMISSION_OPT_IN');
  const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (resolve(cwd) !== workspace) permissionFailure('INVALID_FACTORY_PERMISSION_OPT_IN');
  if (task.product && resolve(task.product.workspace) !== workspace) permissionFailure('PRODUCT_ROOT_MISMATCH');
  assertFactoryPath(workspace, true);
  return resolve(workspace, '..', 'scratch', task.taskId);
}

// Before the single-use claim, reject unsafe static inputs. Clean up only the
// empty directory this call created; never remove a prior task's scratch.
export async function prepareFactoryScratch(cwd, task, approval) {
  const scratch = factoryScratch(cwd, task, approval), parent = dirname(scratch);
  assertFactoryPath(dirname(parent), true);
  try { await mkdir(parent); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  assertFactoryPath(parent, true);
  try { await mkdir(scratch); } catch (error) { if (error.code === 'EEXIST') permissionFailure('FACTORY_SCRATCH_ALREADY_EXISTS'); throw error; }
  try {
    for (const role of ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER']) factoryTransport(cwd, { task, role, ...(approval ? { productApproval: approval } : {}) });
  } catch (error) {
    try { assertFactoryPath(scratch, true); await rmdir(scratch); }
    catch { permissionFailure('FACTORY_SCRATCH_CLEANUP_FAILED'); }
    throw error;
  }
  return scratch;
}

export function factoryEnvironment(scratch, parent = process.env) {
  const required = ['SystemDrive', 'SystemRoot', 'COMSPEC', 'PATH', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
  if (required.some(k => typeof parent[k] !== 'string' || !parent[k].trim() || /[\0\r\n]/.test(parent[k])) ||
      !/^[A-Za-z]:$/.test(parent.SystemDrive) || !/^[A-Za-z]:[\\/]/.test(parent.SystemRoot) ||
      parent.SystemRoot.slice(0, 2).toLowerCase() !== parent.SystemDrive.toLowerCase()) permissionFailure('FACTORY_ENVIRONMENT_UNAVAILABLE');
  const keys = [...required, 'WINDIR', 'ProgramData', 'ProgramFiles', 'HOMEDRIVE', 'HOMEPATH'];
  const env = Object.fromEntries(keys.filter(k => typeof parent[k] === 'string' && parent[k].trim()).map(k => [k, parent[k]]));
  if (Object.values(env).some(v => /[\0\r\n]/.test(v))) permissionFailure('FACTORY_ENVIRONMENT_UNAVAILABLE');
  // Never inherit application credentials, Node injection options or browser trust.
  return { ...env, TEMP: scratch, TMP: scratch, NODE_ENV: 'test', CI: '1', FORCE_COLOR: '0', NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S: '' };
}

// Exact, existing tooling admission supplies the only writable source paths.
// Default transport remains byte-for-byte equivalent in argv and capability.
export function factoryTransport(cwd, options = {}) {
  const base = { args: ['app-server', '--listen', 'stdio://'], experimentalApi: false };
  if (!options || typeof options !== 'object' || Array.isArray(options)) permissionFailure('INVALID_FACTORY_PERMISSION_OPT_IN');
  if (!Object.keys(options).length) return base;
  const keys = options.productApproval === undefined ? 'role,task' : 'productApproval,role,task';
  if (Object.keys(options).sort().join() !== keys || !['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER'].includes(options.role) || process.platform !== 'win32') permissionFailure('INVALID_FACTORY_PERMISSION_OPT_IN');
  const task = admitTask(options.task, options.productApproval), scratch = factoryScratch(cwd, task, options.productApproval);
  assertFactoryPath(scratch, true);
  for (const file of task.ownedFiles) assertFactoryPath(resolve(cwd, file));
  const paths = options.role === 'BUILDER' ? [...task.ownedFiles.map(p => resolve(cwd, p)), scratch] : options.role === 'VERIFY' ? [scratch] : [];
  const filesystem = Object.fromEntries(paths.map(p => [p.replaceAll('\\', '/'), 'write']));
  const profileId = `bella_factory_${options.role.toLowerCase()}`;
  const policy = { extends: ':read-only', filesystem, network: { enabled: false } };
  const encoded = `{extends=":read-only",filesystem={${Object.keys(filesystem).map(p => `${JSON.stringify(p)}="write"`).join(',')}},network={enabled=false}}`;
  const environment = factoryEnvironment(scratch);
  const overrides = [`permissions.${profileId}=${encoded}`, 'approval_policy="never"', 'windows.sandbox="mxc"', 'analytics.enabled=false', 'shell_environment_policy.inherit="none"',
    `shell_environment_policy.set={${Object.entries(environment).map(([k, v]) => `${JSON.stringify(k)}=${JSON.stringify(v)}`).join(',')}}`];
  return { args: [...overrides.flatMap(v => ['-c', v]), ...base.args], experimentalApi: true, profileId, policy, scratch, environment,
    thread: { permissions: profileId }, turn: { permissions: profileId } };
}

export async function inspectFactoryPermission(server, execution, cwd) {
  const { config } = await server.rpc('config/read', { cwd, includeLayers: false });
  const profiles = await server.rpc('permissionProfile/list', { cwd, limit: 100 });
  const actual = config?.permissions?.[execution.profileId];
  const rules = Object.entries(actual?.filesystem || {}).filter(([k, v]) => !(k === 'glob_scan_max_depth' && v === null));
  const environment = config?.shell_environment_policy;
  if (!execution.profileId || config?.approval_policy !== 'never' || config?.windows?.sandbox !== 'mxc' || actual?.extends !== ':read-only' || actual?.network?.enabled !== false ||
      rules.length !== Object.keys(execution.policy.filesystem).length || rules.some(([k, v]) => execution.policy.filesystem[k] !== v) ||
      !profiles.data?.some(p => p.id === execution.profileId && p.allowed === true) || environment?.inherit !== 'none' ||
      Object.keys(environment?.set || {}).length !== Object.keys(execution.environment || {}).length ||
      Object.entries(execution.environment || {}).some(([k, v]) => environment.set[k] !== v)) permissionFailure('FACTORY_PERMISSION_POLICY_MISMATCH');
  return { profileId: execution.profileId, backend: 'mxc', approvalPolicy: 'never', networkEnabled: false, filesystem: Object.fromEntries(rules),
    shellEnvironment: { inherit: 'none', keys: Object.keys(execution.environment).sort(), valueHashes: Object.fromEntries(Object.entries(execution.environment).map(([k, v]) => [k, hash(v)])) } };
}

export class AppServer {
  constructor(binary, cwd, onNotification = () => {}, options = {}) {
    const execution = isMvpPilot(options?.task) ? pilotExecution(cwd, options) : factoryTransport(cwd, options);
    this.execution = execution;
    this.experimentalApi = execution.experimentalApi;
    this.pending = new Map(); this.sequence = 0; this.buffer = ''; this.closed = false;
    this.child = spawn(binary, execution.args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], ...(!isMvpPilot(options?.task) && execution.environment ? { env: execution.environment } : {}) });
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
    const result = await this.rpc('initialize', { clientInfo: { name: 'bella_monitor_batch1_dev', version: '0.0.1' }, capabilities: { experimentalApi: this.experimentalApi } });
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

// Fixed one-suite Jest invocation, inside the existing Verify scratch profile.
// The real Jest JSON is forwarded unchanged and reconciled as command output.
export function runProductJest(args, cwd = process.cwd()) {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== '--product-jest' ||
      typeof args[1] !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(args[1]) || Buffer.from(args[1], 'base64').toString('base64') !== args[1]) permissionFailure('INVALID_PRODUCT_JEST_COMMAND');
  let input;
  try { input = JSON.parse(Buffer.from(args[1], 'base64').toString('utf8')); } catch { permissionFailure('INVALID_PRODUCT_JEST_COMMAND'); }
  const approval = productTaskHash(input), task = admitTask(input, approval);
  if (!task.product) permissionFailure('INVALID_PRODUCT_JEST_COMMAND');
  const scratch = factoryScratch(cwd, task, approval);
  assertFactoryPath(scratch, true);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', windowsHide: true }).trim();
  if (head !== task.sourceRevision) permissionFailure('WRONG_SOURCE_REVISION');
  const { entries, config } = productJestConfig(task, cwd, scratch);
  const result = spawnSync(process.execPath, ['-e', 'require(process.argv[1]).run(process.argv.slice(2))', entries.jest, '--config', JSON.stringify(config), '--runInBand', '--no-cache', '--json', '--runTestsByPath', task.testFile], {
    cwd, env: factoryEnvironment(scratch), encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.signal || !Number.isSafeInteger(result.status) || result.status < 0) permissionFailure('PRODUCT_JEST_UNCERTAIN');
  return result.status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2]?.startsWith('--product')) {
  try { process.exitCode = runProductJest(process.argv.slice(2)); }
  catch (error) { console.error(/^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'PRODUCT_JEST_FAILED'); process.exitCode = 1; }
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const retained = process.argv.includes('--retain');
  const scenario = process.argv.includes('--failed-tool') ? 'failed-tool' : 'success';
  runProof({ retained, scenario }).then(summary => console.log(JSON.stringify(summary, null, 2))).catch(error => {
    const code = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'UNCLASSIFIED_FAILURE';
    console.error(`BATCH1_PROOF_FAILED:${code}; no runtime PASS claimed.`);
    process.exitCode = 1;
  });
}
