import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from './contract.mjs';
import { admitTask, counters, validateHandoff, nativeMode } from './role-validation.mjs';
export { admitTask, counters, validateHandoff } from './role-validation.mjs';

const fail = code => { throw new Error(code); };

export async function inventory(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const head = git(['rev-parse', 'HEAD']).trim();
  const paths = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort();
  const modes = new Map(git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(entry => { const [metadata, path] = entry.split('\t'); return [path, metadata.split(' ')[0]]; }));
  const files = [];
  for (const path of paths) {
    try {
      const info = await lstat(join(root, path));
      if (!info.isFile() || info.isSymbolicLink()) fail('UNSAFE_SOURCE_FILE');
      const mode = process.platform === 'win32' ? (modes.get(path) || '100644') : (info.mode & 0o111 ? '100755' : '100644');
      files.push({ path, mode, sha256: hash(await readFile(join(root, path))) });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { head, files, fingerprint: hash(JSON.stringify({ head, files })) };
}

export function changedPaths(before, after) {
  const a = new Map(before.files.map(f => [f.path, `${f.mode}:${f.sha256}`]));
  const b = new Map(after.files.map(f => [f.path, `${f.mode}:${f.sha256}`]));
  return [...new Set([...a.keys(), ...b.keys()])].filter(p => a.get(p) !== b.get(p)).sort();
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
      if (!green) fail('VERIFY_FAILED');
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
  const [operation, input, ...options] = process.argv.slice(2);
  let mode;
  try { mode = operation === 'run' ? nativeMode(options) : null; } catch (error) { console.error(error.message); process.exit(1); }
  const action = operation === 'run' ? import('./role-native.mjs').then(async m => m.runNative(JSON.parse(await readFile(resolve(input), 'utf8')), mode === 'bounded-native' ? ['--bounded-native'] : []))
    : operation === 'read' ? import('./role-native.mjs').then(m => m.readNative(input))
    : operation === 'commit' ? import('./factory-publication.mjs').then(m => m.linkFactoryCommit(input, process.argv[4])) : Promise.reject(new Error('INVALID_OPERATION'));
  action.then(r => { console.log(JSON.stringify({ status: r.status, reason: r.reason, taskId: r.taskId, factoryRunId: r.factoryRunId, candidate: r.candidate, revisions: r.revisions, directory: r.directory, checks: r.checks, commit:r.commit })); if (!['PASS','PASS_CANDIDATE_COMMIT_CONTENT'].includes(r.status)) process.exitCode = 1; }).catch(e => { console.error(/^[A-Z_]{3,80}$/.test(e.message) ? e.message : 'PIPELINE_HELD'); process.exitCode = 1; });
}
