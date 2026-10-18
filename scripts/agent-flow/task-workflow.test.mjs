import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, classifyTestCommand, testCounters, verifyRedGreen, changeMetadata } from './task-workflow.mjs';

test('test evidence requires the entire exact native suite command and worktree', () => {
  const exact = 'node --test scripts/agent-flow/agent-flow.test.mjs';
  assert.equal(classifyTestCommand(exact, ROOT).classification, 'NODE_TEST_APPROVED_SUITE');
  assert.ok(classifyTestCommand(`powershell.exe -Command "${exact}"`, ROOT));
  assert.ok(classifyTestCommand(`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "${exact}"`, ROOT));
  for (const command of [`echo '# tests 31'`, `exit 1; pwsh -Command "${exact}"`, `${exact}; echo fabricated`, `pwsh -Command "echo fake; ${exact}"`]) assert.equal(classifyTestCommand(command, ROOT), null);
  assert.equal(classifyTestCommand(exact, 'C:/different-worktree'), null);
  assert.equal(classifyTestCommand(exact), null);
});

test('only complete Node counters can enter RED/GREEN checks', () => {
  assert.equal(testCounters('random stdout'), null);
  assert.equal(testCounters('# tests 31\n# pass 31'), null);
  const green = { exitCode: 0, counters: { tests: 31, pass: 31, fail: 0, skipped: 0, cancelled: 0, todo: 0 } };
  const red = { exitCode: 1, counters: { tests: 31, pass: 21, fail: 10, skipped: 0, cancelled: 0, todo: 0 } };
  assert.equal(verifyRedGreen([red, green]).green.counters.pass, 31);
  assert.throws(() => verifyRedGreen([green, red]), /REAL_RED_GREEN_REQUIRED/);
  assert.throws(() => verifyRedGreen([red, { ...green, counters: { ...green.counters, skipped: 1 } }]), /REAL_RED_GREEN_REQUIRED/);
});

test('native file-change projection rejects paths outside two owned files', () => {
  assert.equal(changeMetadata({ type: 'fileChange', id: 'file-1', status: 'completed', changes: [{ path: 'scripts/agent-flow/contract.mjs' }] }).paths[0], 'scripts/agent-flow/contract.mjs');
  assert.throws(() => changeMetadata({ type: 'fileChange', changes: [{ path: '../../outside.txt' }] }), /FORBIDDEN_PATH/);
});

test('RED/GREEN returns the original RED and final GREEN entries only', () => {
  const red = { exitCode: 1, counters: { tests: 2, pass: 1, fail: 1, skipped: 0, cancelled: 0, todo: 0 } };
  const green = { exitCode: 0, counters: { tests: 2, pass: 2, fail: 0, skipped: 0, cancelled: 0, todo: 0 } };
  const final = { ...green };
  const result = verifyRedGreen([red, green, final]);
  assert.deepEqual(Object.keys(result).sort(), ['green', 'red']);
  assert.strictEqual(result.red, red);
  assert.strictEqual(result.green, final);
  assert.throws(() => verifyRedGreen([red, green, red]), { message: 'REAL_RED_GREEN_REQUIRED' });
});

test('a stale GREEN cannot hide incomplete or contradictory final results', () => {
  const red = { exitCode: 1, counters: { tests: 2, pass: 1, fail: 1, skipped: 0, cancelled: 0, todo: 0 } };
  const green = { exitCode: 0, counters: { tests: 2, pass: 2, fail: 0, skipped: 0, cancelled: 0, todo: 0 } };
  const rejectsFinal = final => assert.throws(() => verifyRedGreen([red, green, final]), { message: 'REAL_RED_GREEN_REQUIRED' });
  for (const key of ['tests', 'pass', 'fail', 'skipped', 'cancelled', 'todo']) {
    const missing = { ...green.counters };
    delete missing[key];
    rejectsFinal({ ...green, counters: missing });
    for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '0', null]) {
      rejectsFinal({ ...green, counters: { ...green.counters, [key]: value } });
    }
  }
  for (const counters of [
    { ...green.counters, tests: 0, pass: 0 },
    { ...green.counters, pass: 1 },
    { ...green.counters, pass: 3 },
    ...['fail', 'skipped', 'cancelled', 'todo'].map(key => ({ ...green.counters, [key]: 1 })),
  ]) rejectsFinal({ ...green, counters });
  for (const exitCode of [1, undefined, null, '0', NaN, 0.5]) rejectsFinal({ ...green, exitCode });
  for (const final of [null, undefined, {}, { exitCode: 0 }, { ...green, counters: null }]) rejectsFinal(final);
});

test('RED/GREEN rejects malformed input and requires an actual earlier RED', () => {
  const green = { exitCode: 0, counters: { tests: 2, pass: 2, fail: 0, skipped: 0, cancelled: 0, todo: 0 } };
  for (const evidence of [
    undefined, null, {}, 'invalid', [], [green], [green, green],
    [null, green], [undefined, green], [ , green],
    [{ ...green, exitCode: 1 }, green],
    [{ ...green, counters: { ...green.counters, pass: 1, fail: 1 } }, green],
    [{ counters: { ...green.counters, fail: 1 } }, green],
  ]) assert.throws(() => verifyRedGreen(evidence), { message: 'REAL_RED_GREEN_REQUIRED' });
});
