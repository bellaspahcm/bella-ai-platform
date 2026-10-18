import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './contract.mjs';

const protectedNames = new Set(['authority.mjs', 'contract.mjs', 'store.mjs', 'probe.mjs', 'role-pipeline.mjs', 'role-native.mjs', 'role-pipeline.test.mjs']);
const fail = code => { throw new Error(code); };
export function admitTask(task) {
  const keys = ['taskId', 'sourceRevision', 'goal', 'ownedFiles', 'testFile', 'acceptance', 'maxSeconds'];
  if (!task || Object.keys(task).sort().join() !== keys.sort().join() ||
      !/^[a-f0-9-]{36}$/.test(task.taskId) || !/^[a-f0-9]{40}$/.test(task.sourceRevision) ||
      typeof task.goal !== 'string' || task.goal.length < 20 || task.goal.length > 4000 ||
      !Array.isArray(task.acceptance) || !task.acceptance.length || task.acceptance.length > 12 || task.acceptance.some(v => typeof v !== 'string' || !v.length || v.length > 1000) ||
      !Number.isSafeInteger(task.maxSeconds) || task.maxSeconds < 60 || task.maxSeconds > 1800 ||
      !Array.isArray(task.ownedFiles) || !task.ownedFiles.length || task.ownedFiles.length > 4 || new Set(task.ownedFiles).size !== task.ownedFiles.length ||
      task.ownedFiles.some(p => typeof p !== 'string' || !/^scripts\/agent-flow\/[a-z][a-z0-9.-]*\.mjs$/.test(p) || protectedNames.has(p.split('/').at(-1))) ||
      !/^scripts\/agent-flow\/[a-z][a-z0-9.-]*\.test\.mjs$/.test(task.testFile) || !task.ownedFiles.includes(task.testFile)) fail('INVALID_TASK_SCOPE');
  return structuredClone(task);
}

export async function inventory(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const head = git(['rev-parse', 'HEAD']).trim();
  const paths = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort();
  const files = [];
  for (const path of paths) {
    try {
      const info = await lstat(join(root, path));
      if (!info.isFile() || info.isSymbolicLink()) fail('UNSAFE_SOURCE_FILE');
      files.push({ path, sha256: hash(await readFile(join(root, path))) });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { head, files, fingerprint: hash(JSON.stringify({ head, files })) };
}

export function changedPaths(before, after) {
  const a = new Map(before.files.map(f => [f.path, f.sha256]));
  const b = new Map(after.files.map(f => [f.path, f.sha256]));
  return [...new Set([...a.keys(), ...b.keys()])].filter(p => a.get(p) !== b.get(p)).sort();
}

export function counters(output) {
  const values = {};
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$/);
    if (match) {
      if (Object.hasOwn(values, match[1]) || !Number.isSafeInteger(Number(match[2]))) return null;
      values[match[1]] = Number(match[2]);
    }
  }
  const names = ['pass', 'fail', 'cancelled', 'skipped', 'todo'];
  if (!Number.isSafeInteger(values.tests) || values.tests < 1 || names.some(n => !Number.isSafeInteger(values[n])) || names.reduce((n, k) => n + values[k], 0) !== values.tests) return null;
  return values;
}

export function validateHandoff(terminal, task) {
  if (terminal.status !== 'PASS' || ![0, 1].includes(terminal.revisions) || terminal.taskId !== task.taskId) fail('HANDOFF_NOT_PASS');
  const roles = ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER', ...(terminal.revisions ? ['BUILDER', 'VERIFY', 'REVIEWER'] : [])];
  if (terminal.receipts.length !== roles.length || new Set(terminal.receipts.map(r => r.binding?.threadId)).size !== roles.length) fail('HANDOFF_ROLE_SEQUENCE');
  let candidate = terminal.receipts[0].before;
  terminal.receipts.forEach((r, i) => {
    if (r.role !== roles[i] || !r.nativeVerified || r.before !== candidate || r.revision !== (i < 4 ? 0 : 1)) fail('HANDOFF_ROLE_SEQUENCE');
    if (r.role !== 'BUILDER' && (r.after !== r.before || r.candidate !== candidate)) fail('HANDOFF_CANDIDATE_MISMATCH');
    if (r.role === 'BUILDER' && (!r.changed.length || r.after === r.before || r.changed.some(p => !task.ownedFiles.includes(p)))) fail('HANDOFF_BUILDER_MISMATCH');
    if (r.role === 'LEAD' && r.decision !== 'ACCEPT') fail('HANDOFF_LEAD_MISMATCH');
    if (r.role === 'VERIFY' && r.test?.candidate !== candidate) fail('HANDOFF_TEST_MISMATCH');
    if (r.role === 'REVIEWER' && i !== roles.length - 1 && (r.decision !== 'REVISE' || !r.findings?.length)) fail('HANDOFF_REVISION_MISMATCH');
    candidate = r.after;
  });
  const verify = terminal.receipts.at(-2), review = terminal.receipts.at(-1), c = verify.test?.counters;
  if (verify.decision !== 'PASS' || verify.test.exitCode !== 0 || !c || c.tests < 1 || c.pass !== c.tests || ['fail', 'cancelled', 'skipped', 'todo'].some(k => c[k] !== 0) || review.decision !== 'PASS' || review.findings.length || terminal.candidate !== candidate) fail('HANDOFF_FINAL_MISMATCH');
  return true;
}

// No resume entry point: a fresh invocation requires a fresh, admitted task ID.
// role() is the native adapter in production; injected roles in tests are fixtures.
export async function drive(taskInput, { role, snapshot, record, now = Date.now }) {
  const task = admitTask(taskInput), started = now(), receipts = [];
  let revision = 0, candidate, failure;
  const withinBudget = () => { if (now() - started >= task.maxSeconds * 1000) fail('BUDGET_EXHAUSTED'); };
  async function stage(name, input = {}) {
    withinBudget();
    const before = await snapshot();
    if (before.head !== task.sourceRevision || (candidate && before.fingerprint !== candidate)) fail('CANDIDATE_CHANGED');
    const result = await role(name, { task, revision, before, ...input, remainingMs: task.maxSeconds * 1000 - (now() - started) });
    withinBudget();
    const after = await snapshot();
    const changed = changedPaths(before, after);
    if (before.head !== after.head || changed.some(p => !task.ownedFiles.includes(p)) || (name !== 'BUILDER' && changed.length)) fail('SOURCE_SCOPE_VIOLATION');
    if (!result || result.role !== name || !result.nativeVerified || !result.binding?.threadId || receipts.some(r => r.binding.threadId === result.binding.threadId)) fail('NATIVE_ROLE_PROOF_REQUIRED');
    if (name !== 'BUILDER' && result.candidate !== before.fingerprint) fail('STALE_ROLE_RESULT');
    if (name === 'BUILDER' && (!changed.length || !Array.isArray(result.changed) || changed.some(p => !result.changed.includes(p)) || result.changed.some(p => !task.ownedFiles.includes(p)))) fail('REAL_BUILDER_CHANGE_REQUIRED');
    const receipt = { ...result, revision, before: before.fingerprint, after: after.fingerprint, changed, elapsedMs: now() - started };
    await record(receipt); receipts.push(receipt); candidate = after.fingerprint;
    return receipt;
  }
  try {
    const before = await snapshot();
    if (before.head !== task.sourceRevision) fail('WRONG_SOURCE_REVISION');
    candidate = before.fingerprint;
    const lead = await stage('LEAD');
    if (lead.decision !== 'ACCEPT' || typeof lead.plan !== 'string' || !lead.plan.trim()) fail('LEAD_HELD');
    let findings = [];
    for (;;) {
      const builder = await stage('BUILDER', { plan: lead.plan, findings });
      if (builder.decision !== 'DONE') fail('BUILDER_HELD');
      const verify = await stage('VERIFY');
      if (!['PASS', 'FAIL'].includes(verify.decision) || !verify.test?.counters || verify.test.candidate !== candidate) fail('TEST_EVIDENCE_REQUIRED');
      const c = verify.test.counters;
      const green = verify.test.exitCode === 0 && c.tests > 0 && c.pass === c.tests && ['fail', 'cancelled', 'skipped', 'todo'].every(k => c[k] === 0);
      if (green !== (verify.decision === 'PASS')) fail('TEST_VERDICT_MISMATCH');
      const review = await stage('REVIEWER', { verification: verify });
      if (review.decision === 'PASS' && green && Array.isArray(review.findings) && !review.findings.length) {
        if ((await snapshot()).fingerprint !== candidate) fail('FINAL_CANDIDATE_CHANGED');
        const result = { status: 'PASS', taskId: task.taskId, candidate, revisions: revision, receipts, productGoLive: 'NOT_PROVEN' };
        validateHandoff(result, task);
        await record({ terminal: result }); return result;
      }
      if (review.decision !== 'REVISE' || !Array.isArray(review.findings) || !review.findings.length) fail('REVIEW_HELD');
      if (revision === 1) fail('REVISION_LIMIT');
      findings = review.findings; revision++;
    }
  } catch (error) {
    failure = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : 'RUNTIME_UNCERTAIN';
  }
  const held = { status: 'HELD', taskId: task.taskId, reason: failure, candidate, revisions: revision, receipts, autoResume: false, productGoLive: 'NOT_PROVEN' };
  await record({ terminal: held }); return held;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, input] = process.argv.slice(2);
  const action = operation === 'run' ? import('./role-native.mjs').then(async m => m.runNative(JSON.parse(await readFile(resolve(input), 'utf8'))))
    : operation === 'read' ? import('./role-native.mjs').then(m => m.readNative(input)) : Promise.reject(new Error('INVALID_OPERATION'));
  action.then(r => { console.log(JSON.stringify({ status: r.status, reason: r.reason, taskId: r.taskId, candidate: r.candidate, revisions: r.revisions, directory: r.directory, checks: r.checks })); if (r.status !== 'PASS') process.exitCode = 1; }).catch(e => { console.error(/^[A-Z_]{3,80}$/.test(e.message) ? e.message : 'PIPELINE_HELD'); process.exitCode = 1; });
}
