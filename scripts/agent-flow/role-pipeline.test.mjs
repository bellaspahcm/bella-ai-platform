import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admitTask, counters, drive, validateHandoff } from './role-pipeline.mjs';
import { parseResult, exactTest, reviewReads, repositoryIdentity, terminalRecord } from './role-native.mjs';

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
