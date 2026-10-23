import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admitTask, counters, drive, validateHandoff } from './role-pipeline.mjs';
import { canonicalVerifyDecision, validateRetainedRole, validateReviewCommands } from './role-validation.mjs';
import { hash } from './contract.mjs';
import { parseResult, exactTest, reviewReads, repositoryIdentity, terminalRecord, validateNativeBaseline } from './role-native.mjs';

const task = () => ({ taskId: randomUUID(), sourceRevision: 'a'.repeat(40), goal: 'Repair a concrete final-test evidence defect.', ownedFiles: ['scripts/agent-flow/task-workflow.mjs', 'scripts/agent-flow/task-workflow.test.mjs'], testFile: 'scripts/agent-flow/task-workflow.test.mjs', acceptance: ['Only the final complete GREEN test run proves success.'], maxSeconds: 60 });
const green = { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
async function fixture({ reviews = ['PASS'], mutate, modifyRole, clock } = {}) {
  const input = task(), log = [], records = []; let generation = 0;
  const snapshot = () => ({ head: input.sourceRevision, files: [{ path: input.ownedFiles[0], sha256: String(generation) }], fingerprint: String(generation) });
  const output = await drive(input, {
    snapshot, now: clock || Date.now, record: async r => records.push(r),
    role: async (name, data) => {
      log.push({ name, revision: data.revision, findings: data.findings });
      if (mutate) await mutate(name, data);
      const result = { role: name, candidate: data.before.fingerprint, nativeVerified: true, binding: { threadId: randomUUID() }, decision: 'PASS', findings: [] };
      if (name === 'LEAD') Object.assign(result, { decision: 'ACCEPT', plan: 'repair and regress' });
      if (name === 'BUILDER') { generation++; Object.assign(result, { decision: 'DONE', changed: [input.ownedFiles[0]] }); }
      if (name === 'VERIFY') result.test = { candidate: String(generation), exitCode: 0, counters: green };
      if (name === 'REVIEWER') { result.decision = reviews[data.revision] || 'HELD'; result.findings = result.decision === 'REVISE' ? ['Final failure must invalidate earlier GREEN.'] : []; }
      if (modifyRole) modifyRole(name, result, data);
      return result;
    },
  });
  return { output, log, records, input };
}

test('strict scope admission refuses protected runtime, shell paths and budget expansion', () => {
  assert.ok(admitTask(task()));
  for (const edit of [{ ownedFiles: ['src/platform/auth.mjs'] }, { ownedFiles: ['scripts/agent-flow/role-native.mjs'] }, { maxSeconds: 1801 }, { testFile: 'x; curl remote' }, { extra: true }, { taskId: '../escape' }]) assert.throws(() => admitTask({ ...task(), ...edit }), /INVALID_TASK_SCOPE/);
});
test('real adapter result format must be one unambiguous final JSON', () => {
  assert.equal(parseResult([{ phase: 'final_answer', text: 'BELLA_ROLE_RESULT={"decision":"PASS"}' }]).decision, 'PASS');
  for (const entries of [[], [{ text: 'PASS' }], [{ text: 'BELLA_ROLE_RESULT={}' }, { text: 'BELLA_ROLE_RESULT={}' }], [{ text: 'BELLA_ROLE_RESULT={} garbage' }]]) assert.throws(() => parseResult(entries));
});
test('repository identity is the authorized Bella repository, without credential URLs', () => {
  assert.ok(repositoryIdentity('https://github.com/bellaspahcm/bella-ai-platform.git'));
  assert.ok(repositoryIdentity('git@github.com:bellaspahcm/bella-ai-platform.git'));
  assert.equal(repositoryIdentity('https://github.com/bellaspahcm/bella-spa-erp.git'), false);
  assert.ok(repositoryIdentity('https://github.com/bellaspahcm/bella-spa-erp.git', 'bellaspahcm/bella-ai-platform'));
  for (const origin of ['https://github.com/other/repo', 'https://github.com.evil/bellaspahcm/bella-ai-platform', 'https://secret@github.com/bellaspahcm/bella-ai-platform', '../local', 'https://github.com/bellaspahcm/bella-ai-platform-extra']) assert.equal(repositoryIdentity(origin), false);
});
test('test command matching refuses appended commands, wrong cwd and arbitrary wrappers', () => {
  const exact = 'node --test --test-reporter=tap scripts/agent-flow/task-workflow.test.mjs';
  assert.ok(exactTest(exact, process.cwd(), exact, process.cwd()));
  assert.ok(exactTest(`powershell.exe -NoProfile -Command "${exact}"`, process.cwd(), exact, process.cwd()));
  for (const command of [`${exact}; echo pass`, `echo '${exact}'`, `pwsh -Command "${exact}; exit 0"`]) assert.equal(exactTest(command, process.cwd(), exact, process.cwd()), false);
  assert.equal(exactTest(exact, '../elsewhere', exact, process.cwd()), false);
});
test('counter reader rejects ambiguous/contradictory/unsafe and skipped is not green', () => {
  const output = Object.entries(green).map(([k, v]) => `# ${k} ${v}`).join('\n');
  assert.deepEqual(counters(output), green);
  for (const raw of [output + '\n# pass 3', output.replace('# tests 3', '# tests 4'), output.replace('# tests 3', '# tests 9007199254740992'), '# tests 0', output.replace('# fail 0', '# fail -1')]) assert.equal(counters(raw), null);
});
test('Verify receipt canonicalizes the native verbose verdict only when it matches collected test evidence', () => {
  const test = { exitCode: 0, counters: { tests: 30, pass: 30, fail: 0, cancelled: 0, skipped: 0, todo: 0 }, output: '# suites 0\n' };
  assert.equal(canonicalVerifyDecision({ decision: 'PASS' }, test), 'PASS');
  assert.equal(canonicalVerifyDecision({ decision: 'PASS (tests=30, suites=0, pass=30, fail=0, cancelled=0, skipped=0, todo=0; exit=0)' }, test), 'PASS');
  assert.throws(() => canonicalVerifyDecision({ decision: 'PASSISH' }, test), /INVALID_VERIFY_DECISION/);
  assert.throws(() => canonicalVerifyDecision({ decision: 'PASS (tests=29, suites=0, pass=30, fail=0, cancelled=0, skipped=0, todo=0; exit=0)' }, test), /VERIFY_DECISION_MISMATCH/);
  assert.throws(() => canonicalVerifyDecision({ decision: 'FAIL (tests=30, suites=0, pass=30, fail=0, cancelled=0, skipped=0, todo=0; exit=0)' }, test), /VERIFY_DECISION_MISMATCH/);
  const verbose = { decision: 'PASS (tests=30, suites=0, pass=30, fail=0, cancelled=0, skipped=0, todo=0; exit=0)' };
  assert.throws(() => canonicalVerifyDecision({ decision: verbose.decision.replace('suites=0', 'suites=999') }, test), /VERIFY_DECISION_MISMATCH/);
  for (const output of ['', '# suites 0\n# suites 0\n', '# suites invalid\n', '# suites 0\n# suites invalid\n']) {
    assert.throws(() => canonicalVerifyDecision(verbose, { ...test, output }), /INVALID_VERIFY_DECISION/);
  }
});
test('Verify receipt preserves FAIL for observed failing, skipped, or nonzero-exit test evidence', () => {
  assert.equal(canonicalVerifyDecision({ decision: 'FAIL (tests=5, suites=1, pass=3, fail=2, cancelled=0, skipped=0, todo=0; exit=1)' }, {
    exitCode: 1, counters: { tests: 5, pass: 3, fail: 2, cancelled: 0, skipped: 0, todo: 0 }, output: '# suites 1\n',
  }), 'FAIL');
  assert.equal(canonicalVerifyDecision({ decision: 'FAIL' }, {
    exitCode: 0, counters: { tests: 5, pass: 4, fail: 0, cancelled: 0, skipped: 1, todo: 0 },
  }), 'FAIL');
  assert.throws(() => canonicalVerifyDecision({ decision: 'PASS' }, {
    exitCode: 1, counters: { tests: 5, pass: 3, fail: 2, cancelled: 0, skipped: 0, todo: 0 },
  }), /VERIFY_DECISION_MISMATCH/);
});
test('retained Verify receipt reconciles native verbose decision to canonical observed verdict', () => {
  const t = task(), candidate = 'candidate', itemId = 'verify-command';
  const output = '# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  const binding = { repository: 'bellaspahcm/bella-ai-platform', taskId: t.taskId, runId: 'run', attempt: 1, producerInstanceId: 'producer', threadId: 'thread', sessionId: 'session', turnId: 'turn' };
  const nativeResult = { role: 'VERIFY', candidate, decision: 'PASS (tests=1, suites=0, pass=1, fail=0, cancelled=0, skipped=0, todo=0; exit=0)', findings: [] };
  const native = { binding, result: nativeResult, commands: [{ itemId, command: `node --test --test-reporter=tap ${t.testFile}`, cwd: process.cwd(), exitCode: 0, status: 'completed', outputHash: hash(output) }], changes: [] };
  const receipt = { ...nativeResult, decision: 'PASS', role: 'VERIFY', candidate, nativeVerified: true, binding, native, changed: [], test: { candidate, itemId, command: native.commands[0].command, exitCode: 0, counters: { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }, output, outputHash: hash(output) } };
  const records = [{ fact: { method: 'item/completed', itemType: 'commandExecution', itemId, exitCode: 0, status: 'completed' } }];
  assert.equal(validateRetainedRole(receipt, records, t, process.cwd()), true);
  assert.equal(validateRetainedRole({ ...receipt, decision: nativeResult.decision }, records, t, process.cwd()), true);
  assert.throws(() => validateRetainedRole({ ...receipt, decision: 'FAIL' }, records, t, process.cwd()), /NATIVE_RESULT_MISMATCH/);
});
test('review requires actual exact reads of diff, each current file and Verify evidence', () => {
  const t = task(), commands = reviewReads(t, 'C:/private/role.json');
  assert.equal(commands.length, 4);
  for (const command of commands) {
    assert.ok(exactTest(command, process.cwd(), command, process.cwd()));
    assert.equal(exactTest(`Write-Output \"${command}\"`, process.cwd(), command, process.cwd()), false);
    assert.equal(exactTest(`${command} | Select-Object -First 0`, process.cwd(), command, process.cwd()), false);
  }
});
test('Windows review uses portable literal paths without relaxing exact command checks', () => {
  const commands = reviewReads(task(), 'C:\\Users\\DELL\\.codex\\private\\role.json');
  assert.equal(commands.at(-1), "Get-Content -LiteralPath 'C:/Users/DELL/.codex/private/role.json'");
  const observedShell = '"C:\\\\Users\\\\DELL\\\\.cache\\\\codex-runtimes\\\\codex-primary-runtime\\\\dependencies\\\\native\\\\powershell\\\\pwsh.exe"';
  assert.ok(exactTest(`${observedShell} -Command "${commands.at(-1)}"`, process.cwd(), commands.at(-1), process.cwd()));
  assert.equal(exactTest(`Write-Output \"${commands.at(-1)}\"`, process.cwd(), commands.at(-1), process.cwd()), false);
});
test('bounded review reads the pinned baseline, full current files and same-run Verify exactly once', () => {
  const t = task(), method = 'PINNED_BASELINE_AND_CURRENT', path = 'C:/private/role.json';
  const reads = reviewReads(t, path, method);
  assert.deepEqual(reads, t.ownedFiles.flatMap(p => [`git show "${t.sourceRevision}:${p}"`, `Get-Content -LiteralPath '${p}'`]).concat(`Get-Content -LiteralPath '${path}'`));
  const commands = reads.map((command, i) => ({ command, itemId: `read-${i}`, cwd: process.cwd(), status: 'completed', exitCode: 0 }));
  assert.equal(validateReviewCommands(commands, t, process.cwd(), path, method), true);
  for (const mutate of [
    c => c.pop(), c => c.push(c[0]), c => c.push({ ...c[0], command: 'git status' }),
    c => { c[0].command = c[0].command.replace(t.sourceRevision, 'b'.repeat(40)); },
    c => { c[0].command = 'git show "HEAD:scripts/agent-flow/task-workflow.mjs"'; },
    c => { c[1].command = "Get-Content -LiteralPath 'scripts/agent-flow/other.mjs'"; },
    c => { c[0].command += ' | Select-Object -First 0'; },
    c => { c[0].command = `Write-Output '${c[0].command}'`; },
    c => { c[0].command = reviewReads(t, path)[0]; },
    c => { c[0].exitCode = 1; }, c => { c[0].status = 'inProgress'; },
    c => { c[0].cwd = '..'; },
  ]) {
    const changed = structuredClone(commands); mutate(changed);
    assert.throws(() => validateReviewCommands(changed, t, process.cwd(), path, method), /ACTUAL_REVIEW_READ_REQUIRED/);
  }
  assert.throws(() => validateReviewCommands(commands, t, process.cwd(), path, 'unknown'), /INVALID_REVIEW_METHOD/);
  assert.throws(() => validateReviewCommands(commands, t, process.cwd(), path), /ACTUAL_REVIEW_READ_REQUIRED/);
  const legacy = reviewReads(t, path).map(command => ({ command, cwd: process.cwd(), status: 'completed', exitCode: 0 }));
  assert.equal(validateReviewCommands(legacy, t, process.cwd(), path), true);
  assert.throws(() => validateReviewCommands(legacy, t, process.cwd(), path, method), /ACTUAL_REVIEW_READ_REQUIRED/);
});
test('retained bounded Reviewer preserves collector method and rejects spoofing, downgrade and stale candidate', () => {
  const t = task(), candidate = 'pinned', binding = { threadId: 'review-thread' }, path = 'C:/private/role.json';
  const result = { role: 'REVIEWER', candidate, decision: 'PASS', findings: [] };
  const commands = reviewReads(t, path, 'PINNED_BASELINE_AND_CURRENT').map((command, i) => ({ command, itemId: `cmd-${i}`, cwd: process.cwd(), exitCode: 0, status: 'completed', outputHash: hash(`content-${i}`) }));
  const receipt = { ...result, reviewMethod: 'PINNED_BASELINE_AND_CURRENT', binding, changed: [], native: { binding, result, commands, changes: [] } };
  const records = commands.map(c => ({ fact: { method: 'item/completed', itemType: 'commandExecution', itemId: c.itemId, exitCode: 0, status: 'completed' } }));
  assert.equal(validateRetainedRole(receipt, records, t, process.cwd(), path), true);
  for (const mutate of [
    r => { delete r.reviewMethod; }, r => { r.reviewMethod = 'unknown'; },
    r => { r.native.result.reviewMethod = r.reviewMethod; },
    r => { r.candidate = 'stale'; }, r => { r.native.commands.pop(); },
  ]) {
    const changed = structuredClone(receipt); mutate(changed);
    assert.throws(() => validateRetainedRole(changed, records, t, process.cwd(), path));
  }
});
test('bounded baseline rejects staged, unstaged and untracked changes before runtime preparation', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtemp, writeFile, rm, readdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'bella-review-baseline-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  try {
    git(['init', '-q']); git(['config', 'user.email', 'fixture@example.invalid']); git(['config', 'user.name', 'Fixture']);
    await writeFile(join(root, 'owned.mjs'), 'baseline\n'); git(['add', 'owned.mjs']); git(['commit', '-qm', 'baseline']);
    const t = { ...task(), sourceRevision: git(['rev-parse', 'HEAD']).trim(), ownedFiles: ['owned.mjs'] };
    const before = { head: t.sourceRevision, files: [{ path: 'owned.mjs' }] };
    assert.doesNotThrow(() => validateNativeBaseline(t, before, root, 'bounded-native'));
    assert.throws(() => validateNativeBaseline(t, { ...before, head: 'b'.repeat(40) }, root, 'bounded-native'), /WRONG_SOURCE_REVISION/);
    assert.throws(() => validateNativeBaseline(t, { ...before, files: [] }, root, 'bounded-native'), /EXISTING_TASK_FILES_REQUIRED/);
    await writeFile(join(root, 'owned.mjs'), 'unstaged\n');
    assert.throws(() => validateNativeBaseline(t, before, root, 'bounded-native'), /DIRTY_NATIVE_BASELINE/);
    assert.doesNotThrow(() => validateNativeBaseline(t, before, root, 'legacy'));
    git(['add', 'owned.mjs']);
    assert.throws(() => validateNativeBaseline(t, before, root, 'bounded-native'), /DIRTY_NATIVE_BASELINE/);
    git(['reset', '--hard', '-q', 'HEAD']);
    for (const flag of ['assume-unchanged', 'skip-worktree']) {
      git(['update-index', `--${flag}`, 'owned.mjs']);
      await writeFile(join(root, 'owned.mjs'), 'hidden preexisting edit\n');
      assert.equal(git(['status', '--porcelain']).trim(), '');
      assert.throws(() => validateNativeBaseline(t, before, root, 'bounded-native'), /DIRTY_NATIVE_BASELINE/);
      git(['update-index', `--no-${flag}`, 'owned.mjs']); git(['reset', '--hard', '-q', 'HEAD']);
    }
    await writeFile(join(root, 'extra.mjs'), 'untracked');
    assert.throws(() => validateNativeBaseline(t, before, root, 'bounded-native'), /DIRTY_NATIVE_BASELINE/);
    assert.equal((await readdir(join(root, '.git'))).includes('bella-agent-flow-task-claims'), false);
  } finally { await rm(root, { recursive: true }); }
});
test('fresh reader accepts immutable V1 envelope and direct terminal format, never upgrades HELD', () => {
  const held = { status: 'HELD', receipts: [], reason: 'ACTUAL_REVIEW_READ_REQUIRED' };
  assert.strictEqual(terminalRecord({ terminal: held }), held);
  assert.strictEqual(terminalRecord(held), held);
  assert.equal(terminalRecord({ terminal: held }).status, 'HELD');
  for (const value of [null, {}, { status: 'PASS' }, { terminal: held, extra: true }]) assert.throws(() => terminalRecord(value), /INVALID_TERMINAL_RECORD/);
});
test('happy path uses four independent role dispatches and final-candidate handoff', async () => {
  const r = await fixture(); assert.equal(r.output.status, 'PASS');
  assert.deepEqual(r.log.map(i => i.name), ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER']);
  assert.equal(r.output.candidate, '1'); assert.ok(validateHandoff(r.output, r.input));
});
test('REVISE automatically hands findings to one Builder repair then reruns Verify and fresh Reviewer', async () => {
  const r = await fixture({ reviews: ['REVISE', 'PASS'] });
  assert.equal(r.output.status, 'PASS'); assert.equal(r.output.revisions, 1); assert.equal(r.output.candidate, '2');
  assert.deepEqual(r.log.map(i => i.name), ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER', 'BUILDER', 'VERIFY', 'REVIEWER']);
  assert.deepEqual(r.log[4].findings, ['Final failure must invalidate earlier GREEN.']);
});
test('second REVISE is terminal HELD with no third Builder or auto resume', async () => {
  const r = await fixture({ reviews: ['REVISE', 'REVISE'] });
  assert.equal(r.output.status, 'HELD'); assert.equal(r.output.reason, 'REVISION_LIMIT'); assert.equal(r.log.length, 7); assert.equal(r.output.autoResume, false);
});
test('ambiguous dispatch outcome is HELD and never retried', async () => {
  const r = await fixture({ mutate: name => { if (name === 'BUILDER') throw new Error('CODEX_RPC_TIMEOUT'); } });
  assert.equal(r.output.status, 'HELD'); assert.equal(r.output.reason, 'CODEX_RPC_TIMEOUT'); assert.equal(r.log.length, 2);
});
test('stale Verify candidate cannot pass even when tests report success', async () => {
  const r = await fixture({ modifyRole: (name, result) => { if (name === 'VERIFY') result.candidate = 'stale'; } });
  assert.equal(r.output.reason, 'STALE_ROLE_RESULT'); assert.equal(r.log.length, 3);
});
test('fresh Reviewer thread identity is mandatory', async () => {
  const r = await fixture({ modifyRole: (name, result) => { result.binding.threadId = 'same-thread'; } });
  assert.equal(r.output.reason, 'NATIVE_ROLE_PROOF_REQUIRED');
});
test('failed tests hold before Reviewer dispatch', async () => {
  const r = await fixture({ modifyRole: (name, result) => { if (name === 'VERIFY') { result.test.exitCode = 1; result.test.counters = { ...green, pass: 2, fail: 1 }; result.decision = 'FAIL'; } } });
  assert.equal(r.output.status, 'HELD'); assert.equal(r.output.reason, 'VERIFY_FAILED');
  assert.deepEqual(r.log.map(i=>i.name),['LEAD','BUILDER','VERIFY']);
  assert.equal(r.output.receipts.length,3);
});
test('skip/todo/cancelled cannot pass despite zero exit code', async () => {
  for (const k of ['skipped', 'todo', 'cancelled']) {
    const r = await fixture({ modifyRole: (name, result) => { if (name === 'VERIFY') result.test.counters = { ...green, pass: 2, [k]: 1 }; } });
    assert.equal(r.output.reason, 'TEST_VERDICT_MISMATCH');
  }
});
test('expired task budget stops before any dispatch', async () => {
  let call = 0; const r = await fixture({ clock: () => call++ === 0 ? 0 : 61000 });
  assert.equal(r.output.reason, 'BUDGET_EXHAUSTED'); assert.equal(r.log.length, 0);
});
test('terminal handoff detects missing stage, forged final candidate and stale review', async () => {
  const r = await fixture({ reviews: ['REVISE', 'PASS'] });
  for (const change of [v => v.receipts.pop(), v => { v.candidate = 'old'; }, v => { v.receipts.at(-1).before = 'old'; }]) {
    const value = structuredClone(r.output); change(value); assert.throws(() => validateHandoff(value, r.input));
  }
});

test('payload mismatch diagnostic retains field hashes only without relaxing equality',async()=>{
  const {nativePayloadDifferences}=await import('./role-validation.mjs');const left={commands:[{itemId:'cmd',command:'SECRET_ARG',outputHash:'a'}],changes:[],result:{role:'LEAD'},binding:{taskId:'task'}};
  assert.deepEqual(nativePayloadDifferences(left,structuredClone(left)),[]);
  const right=structuredClone(left);right.commands[0].command='DIFFERENT_SECRET';right.commands[0].outputHash='b';const differences=nativePayloadDifferences(left,right);
  assert.deepEqual(differences.map(d=>d.path),['commands[0].command','commands[0].outputHash']);assert.equal(JSON.stringify(differences).includes('SECRET'),false);assert.ok(differences.every(d=>/^[a-f0-9]{64}$/.test(d.leftSha256)&&/^[a-f0-9]{64}$/.test(d.rightSha256)));
});


test('native mode is one literal opt-in and rejects typos, duplicates and extra flags', async () => {
  const { nativeMode } = await import('./role-validation.mjs');
  assert.equal(nativeMode(), 'legacy');
  assert.equal(nativeMode(['--bounded-native']), 'bounded-native');
  for (const flags of [null, {}, '--bounded-native', ['--bounded'], ['--bounded-native', '--bounded-native'], ['--bounded-native', '--profile=custom']]) {
    assert.throws(() => nativeMode(flags), /INVALID_NATIVE_MODE/);
  }
});

test('native invocation rejects unknown options and Product tasks without dispatch or claim', async () => {
  const { runNative } = await import('./role-native.mjs');
  await assert.rejects(() => runNative(task(), ['--workspace-write']), /INVALID_NATIVE_MODE/);
  await assert.rejects(() => runNative({ ...task(), ownedFiles: ['src/product.mjs'], testFile: 'src/product.test.mjs' }, ['--bounded-native']), /INVALID_TASK_SCOPE/);
});

test('default AppServer transport keeps legacy argv and experimental API disabled', async () => {
  const { factoryTransport } = await import('./probe.mjs');
  assert.deepEqual(factoryTransport(process.cwd()), { args: ['app-server', '--listen', 'stdio://'], experimentalApi: false });
  for (const options of [null, [], { mode: 'bounded-native' }, { role: 'VERIFY' }, { role: 'VERIFY', task: task(), policy: {} }]) {
    assert.throws(() => factoryTransport(process.cwd(), options), /INVALID_FACTORY_PERMISSION_OPT_IN/);
  }
});

async function transportFixture(run) {
  const { mkdir, rm } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const { factoryScratch, assertFactoryPath } = await import('./probe.mjs');
  const input = task(), scratch = factoryScratch(process.cwd(), input);
  await mkdir(dirname(scratch), { recursive: true });
  assertFactoryPath(dirname(scratch), true);
  await mkdir(scratch);
  try { await run(input, scratch); }
  finally { assertFactoryPath(scratch, true); await rm(scratch, { recursive: true }); }
}

test('bounded transport grants Builder exact owned files and Verify only derived scratch', { skip: process.platform === 'win32' ? false : 'Windows MXC transport construction is unavailable on this platform' }, async () => {
  const { resolve } = await import('node:path');
  const { factoryTransport } = await import('./probe.mjs');
  await transportFixture(async (input, scratch) => {
    for (const role of ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER']) {
      const result = factoryTransport(process.cwd(), { task: input, role });
      const portable = p => p.replaceAll('\\', '/');
      const expected = role === 'BUILDER' ? [...input.ownedFiles.map(p => portable(resolve(p))), portable(scratch)] : role === 'VERIFY' ? [portable(scratch)] : [];
      assert.deepEqual(Object.keys(result.policy.filesystem), expected);
      assert.equal(result.policy.extends, ':read-only');
      assert.deepEqual(result.policy.network, { enabled: false });
      assert.equal(result.experimentalApi, true);
      assert.deepEqual(result.thread, { permissions: result.profileId });
      assert.deepEqual(result.turn, { permissions: result.profileId });
      assert.equal(result.environment.TEMP, scratch);
      assert.equal(result.environment.TMP, scratch);
      assert.equal(result.environment.SystemDrive, process.env.SystemDrive);
      assert.equal(result.args.includes('workspace-write'), false);
      for (const bad of [{ ...input, taskId: '../other' }, { ...input, ownedFiles: ['src/allowed.mjs'] }]) {
        assert.throws(() => factoryTransport(process.cwd(), { task: bad, role }), /INVALID_TASK_SCOPE/);
      }
    }
    assert.throws(() => factoryTransport(resolve(process.cwd(), '..'), { task: input, role: 'VERIFY' }), /INVALID_FACTORY_PERMISSION_OPT_IN/);
    assert.throws(() => factoryTransport(process.cwd(), { task: input, role: 'ADMIN' }), /INVALID_FACTORY_PERMISSION_OPT_IN/);
  });
});

test('bounded transport rejects missing scratch before native start', { skip: process.platform === 'win32' ? false : 'Windows MXC transport construction is unavailable on this platform' }, async () => {
  const { factoryTransport } = await import('./probe.mjs');
  assert.throws(() => factoryTransport(process.cwd(), { task: task(), role: 'VERIFY' }), /ENOENT/);
});

test('bounded transport rejects aliased ancestor paths on the current filesystem', async () => {
  const { mkdir, writeFile, symlink, rm, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { assertFactoryPath } = await import('./probe.mjs');
  const root = await mkdtemp(join(tmpdir(), 'bella-factory-alias-'));
  try {
    const target = join(root, 'target'), alias = join(root, 'alias');
    await mkdir(target); await writeFile(join(target, 'test.txt'), 'fixture');
    await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => assertFactoryPath(alias, true), /UNSAFE_FACTORY_PERMISSION_PATH/);
    assert.throws(() => assertFactoryPath(join(alias, 'test.txt')), /UNSAFE_FACTORY_PERMISSION_PATH/);
  } finally { await rm(root, { recursive: true }); }
});

test('shell environment preserves Windows startup fields but drops inherited credentials and Node injection', async () => {
  const { factoryEnvironment } = await import('./probe.mjs');
  const parent = { SystemDrive: 'C:', SystemRoot: 'C:\\Windows', COMSPEC: 'C:\\Windows\\System32\\cmd.exe', PATH: 'C:\\Windows', PATHEXT: '.EXE', USERPROFILE: 'C:\\Users\\fixture', APPDATA: 'C:\\Users\\fixture\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\fixture\\AppData\\Local', SUPABASE_SERVICE_ROLE_KEY: 'fake-secret', GITHUB_TOKEN: 'fake-secret', NODE_OPTIONS: '--require injection.js', NODE_PATH: 'injection', NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S: 'inherited-browser' };
  const environment = factoryEnvironment('C:/scratch', parent);
  assert.equal(environment.SystemDrive, 'C:');
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'GITHUB_TOKEN', 'NODE_OPTIONS', 'NODE_PATH']) assert.equal(Object.hasOwn(environment, key), false);
  assert.equal(environment.NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S, '');
  assert.equal(environment.TEMP, 'C:/scratch');
  for (const key of ['SystemDrive', 'SystemRoot', 'COMSPEC', 'PATH', 'PATHEXT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    assert.throws(() => factoryEnvironment('C:/scratch', { ...parent, [key]: '' }), /FACTORY_ENVIRONMENT_UNAVAILABLE/);
  }
  assert.throws(() => factoryEnvironment('C:/scratch', { ...parent, SystemDrive: 'D:' }), /FACTORY_ENVIRONMENT_UNAVAILABLE/);
});

test('effective bounded policy must exactly retain permissions and filtered environment before role start', { skip: process.platform === 'win32' ? false : 'Windows MXC transport construction is unavailable on this platform' }, async () => {
  const { factoryTransport, inspectFactoryPermission } = await import('./probe.mjs');
  await transportFixture(async (input) => {
    for (const role of ['LEAD', 'BUILDER', 'VERIFY', 'REVIEWER']) {
      const execution = factoryTransport(process.cwd(), { task: input, role });
      const config = { approval_policy: 'never', windows: { sandbox: 'mxc' }, permissions: { [execution.profileId]: structuredClone(execution.policy) }, shell_environment_policy: { inherit: 'none', set: { ...execution.environment } } };
      const profiles = { data: [{ id: execution.profileId, allowed: true }] };
      const server = (current, list = profiles) => ({ rpc: async method => {
        if (method === 'config/read') return { config: current };
        if (method === 'permissionProfile/list') return list;
        assert.fail('unexpected native dispatch');
      } });
      const proof = await inspectFactoryPermission(server(config), execution, process.cwd());
      assert.equal(proof.profileId, execution.profileId);
      assert.equal(Object.hasOwn(proof.shellEnvironment, 'set'), false);
      assert.equal(JSON.stringify(proof).includes(process.env.USERPROFILE.replaceAll('\\', '\\\\')), false);
      for (const mutate of [
        c => { c.permissions[execution.profileId].filesystem[process.cwd()] = 'write'; },
        c => { c.permissions[execution.profileId].network.enabled = true; },
        c => { c.permissions[execution.profileId].extends = ':workspace-write'; },
        c => { c.approval_policy = 'on-request'; },
        c => { c.windows.sandbox = 'legacy'; },
        c => { c.shell_environment_policy.inherit = 'all'; },
        c => { c.shell_environment_policy.set.NODE_OPTIONS = '--require other.js'; },
        c => { c.shell_environment_policy.set.NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S = 'trusted'; },
        c => { delete c.shell_environment_policy.set.SystemDrive; },
      ]) {
        const changed = structuredClone(config); mutate(changed);
        await assert.rejects(() => inspectFactoryPermission(server(changed), execution, process.cwd()), /FACTORY_PERMISSION_POLICY_MISMATCH/);
      }
      await assert.rejects(() => inspectFactoryPermission(server(config, { data: [] }), execution, process.cwd()), /FACTORY_PERMISSION_POLICY_MISMATCH/);
    }
  });
});

test('findings contract accepts strings and rejects object elements without coercion', async () => {
  const { validateRoleResult } = await import('./role-validation.mjs');
  const value = { role: 'BUILDER', candidate: 'pinned', decision: 'DONE', findings: ['One clear finding'] };
  assert.strictEqual(validateRoleResult(value, 'BUILDER', 'pinned'), value);
  for (const findings of [[{ message: 'object is not a string' }], [''], [' '], [1], [null], ['x'.repeat(2001)], null]) {
    assert.throws(() => validateRoleResult({ ...value, findings }, 'BUILDER', 'pinned'), /INVALID_ROLE_RESULT/);
  }
  assert.throws(() => validateRoleResult({ ...value, candidate: 'other' }, 'BUILDER', 'pinned'), /INVALID_ROLE_RESULT/);
});


test('retained-role readback rejects malformed findings without repairing candidate or source', async () => {
  const { validateRetainedRole } = await import('./role-validation.mjs');
  const { hash } = await import('./contract.mjs');
  const input = task(), binding = { threadId: 'retained-thread' };
  const result = { role: 'LEAD', candidate: 'retained-candidate', decision: 'ACCEPT', findings: [], plan: 'bounded read' };
  const receipt = { ...result, binding, changed: [], native: { binding, result: structuredClone(result), changes: [], commands: [{ itemId: 'read-1', command: "Get-Content -LiteralPath 'scripts/agent-flow/task-workflow.mjs'", cwd: process.cwd(), status: 'completed', exitCode: 0, outputHash: hash('retained source') }] } };
  const records = [{ fact: { method: 'item/completed', itemType: 'commandExecution', itemId: 'read-1', status: 'completed', exitCode: 0 } }];
  assert.equal(validateRetainedRole(receipt, records, input, process.cwd()), true);
  const malformed = structuredClone(receipt);
  malformed.findings = [{ message: 'must remain rejected' }];
  malformed.native.result.findings = structuredClone(malformed.findings);
  assert.throws(() => validateRetainedRole(malformed, records, input, process.cwd()), /INVALID_ROLE_RESULT/);
  assert.equal(malformed.candidate, 'retained-candidate');
  assert.equal(typeof malformed.native.result.findings[0], 'object');
  const stale = structuredClone(receipt); stale.native.result.candidate = 'changed';
  assert.throws(() => validateRetainedRole(stale, records, input, process.cwd()), /NATIVE_RESULT_MISMATCH/);
});

test('non-Windows hosts reject bounded transport without a fallback', { skip: process.platform === 'win32' ? 'Non-Windows transport rejection is not exercised by this Windows host' : false }, async () => {
  const { factoryTransport } = await import('./probe.mjs');
  assert.throws(() => factoryTransport(process.cwd(), { task: task(), role: 'VERIFY' }), /INVALID_FACTORY_PERMISSION_OPT_IN/);
});


test('permission file validation refuses hardlinks to unowned synthetic files', async () => {
  const { mkdtemp, writeFile, link, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { assertFactoryPath } = await import('./probe.mjs');
  const root = await mkdtemp(join(tmpdir(), 'bella-factory-hardlink-'));
  try {
    const unowned = join(root, 'unowned.mjs'), admittedAlias = join(root, 'admitted.mjs');
    await writeFile(unowned, 'synthetic source');
    assert.doesNotThrow(() => assertFactoryPath(unowned));
    await link(unowned, admittedAlias);
    assert.throws(() => assertFactoryPath(admittedAlias), /UNSAFE_FACTORY_PERMISSION_PATH/);
    assert.throws(() => assertFactoryPath(unowned), /UNSAFE_FACTORY_PERMISSION_PATH/);
  } finally { await rm(root, { recursive: true }); }
});

test('failed preclaim setup removes only its newly created empty scratch', { skip: process.platform === 'win32' ? false : 'Windows MXC static preparation requires Windows environment' }, async () => {
  const { lstat, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const { prepareFactoryScratch, factoryScratch, assertFactoryPath } = await import('./probe.mjs');
  const input = task(), scratch = factoryScratch(process.cwd(), input);
  const previous = process.env.SystemDrive;
  try {
    process.env.SystemDrive = '';
    await assert.rejects(() => prepareFactoryScratch(process.cwd(), input), /FACTORY_ENVIRONMENT_UNAVAILABLE/);
    await assert.rejects(() => lstat(scratch), { code: 'ENOENT' });
    // A prior/nonempty directory belongs to its owner and must remain unchanged.
    await mkdir(dirname(scratch), { recursive: true });
    assertFactoryPath(dirname(scratch), true);
    await mkdir(scratch);
    await writeFile(join(scratch, 'owned-by-prior-preflight.txt'), 'preserve');
    await assert.rejects(() => prepareFactoryScratch(process.cwd(), input), /FACTORY_SCRATCH_ALREADY_EXISTS/);
    assert.equal(await readFile(join(scratch, 'owned-by-prior-preflight.txt'), 'utf8'), 'preserve');
  } finally {
    if (previous === undefined) delete process.env.SystemDrive; else process.env.SystemDrive = previous;
    try { assertFactoryPath(scratch, true); await rm(scratch, { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
});
