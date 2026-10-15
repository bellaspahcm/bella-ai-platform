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
