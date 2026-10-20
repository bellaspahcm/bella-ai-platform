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

const mixedCounters = { tests: 15, pass: 5, fail: 4, cancelled: 3, skipped: 2, todo: 1 };

function nodeSummary(counters, marker = '#', newline = '\n') {
  return Object.entries(counters).map(([key, value]) => `${marker} ${key} ${value}`).join(newline);
}

test('testCounters preserves complete TAP and Node info summaries with LF or CRLF', () => {
  const cases = [
    mixedCounters,
    { tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 },
    { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 },
    { tests: 4, pass: 0, fail: 0, cancelled: 0, skipped: 3, todo: 1 },
  ];
  for (const marker of ['#', 'ℹ']) {
    for (const newline of ['\n', '\r\n']) {
      for (const counters of cases) {
        const output = [
          'test output', `${marker} suites 0`, nodeSummary(counters, marker, newline),
          `${marker} duration_ms 12.5`, '',
        ].join(newline);
        assert.deepEqual(testCounters(output), counters, `${marker} ${JSON.stringify(counters)}`);
      }
    }
  }
});

test('testCounters preserves whitespace, leading zeroes, mixed markers and counter order', () => {
  const output = '\t# todo\t001 \t\r\n  ℹ skipped 002\r\n# cancelled 003\r\nℹ fail 004\r\n # pass 005\r\nℹ tests 015\t';
  assert.deepEqual(testCounters(output), mixedCounters);
});

test('testCounters rejects identical and conflicting duplicates of every counter', () => {
  for (const marker of ['#', 'ℹ']) {
    const output = nodeSummary(mixedCounters, marker);
    for (const duplicateMarker of ['#', 'ℹ']) {
      for (const [key, value] of Object.entries(mixedCounters)) {
        for (const duplicate of [value, value + 1]) {
          assert.equal(testCounters(`${output}\n${duplicateMarker} ${key} ${duplicate}`), null, `${marker}/${duplicateMarker} ${key} ${duplicate}`);
        }
      }
    }
  }
});

test('testCounters rejects concatenated complete summaries even when they agree', () => {
  const green = { tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const firstMarker of ['#', 'ℹ']) {
    for (const secondMarker of ['#', 'ℹ']) {
      for (const second of [mixedCounters, green]) {
        assert.equal(testCounters(`${nodeSummary(mixedCounters, firstMarker)}\r\n${nodeSummary(second, secondMarker)}`), null);
      }
    }
  }
});

test('testCounters rejects totals above or below the sum of all five outcomes', () => {
  for (const marker of ['#', 'ℹ']) {
    for (const tests of [0, 14, 16]) {
      assert.equal(testCounters(nodeSummary({ ...mixedCounters, tests }, marker)), null, `tests ${tests}`);
    }
    for (const key of ['pass', 'fail', 'cancelled', 'skipped', 'todo']) {
      assert.equal(testCounters(nodeSummary({ ...mixedCounters, [key]: mixedCounters[key] + 1 }, marker)), null, key);
    }
  }
});

test('testCounters rejects each missing counter and non-string output', () => {
  for (const marker of ['#', 'ℹ']) {
    for (const key of Object.keys(mixedCounters)) {
      const incomplete = { ...mixedCounters };
      delete incomplete[key];
      assert.equal(testCounters(nodeSummary(incomplete, marker)), null, key);
    }
  }
  for (const output of [undefined, null, 0, {}, [], '', 'random stdout']) assert.equal(testCounters(output), null);
});

test('testCounters rejects malformed recognized counters even alongside a valid summary', () => {
  const suffixes = [
    '', ' ', ': 1', '=1', ' -1', ' -0', ' +1', ' 1.5', ' 1e0', ' 0x1',
    ' NaN', ' Infinity', ' 1 trailing', ' 1_000', ' 1,000', ' １２', ' 1\u0000', ' 1\u2028trailing',
  ];
  for (const marker of ['#', 'ℹ']) {
    const output = nodeSummary(mixedCounters, marker);
    for (const [key, value] of Object.entries(mixedCounters)) {
      for (const suffix of suffixes) {
        const malformed = `${marker} ${key}${suffix}`;
        const label = JSON.stringify(malformed);
        assert.equal(testCounters(output.replace(`${marker} ${key} ${value}`, malformed)), null, label);
        assert.equal(testCounters(`${malformed}\n${output}`), null, label);
        assert.equal(testCounters(`${output}\n${malformed}`), null, label);
      }
    }
  }
});

test('testCounters rejects unsafe integers and overflow in outcome totals', () => {
  for (const marker of ['#', 'ℹ']) {
    for (const key of Object.keys(mixedCounters)) {
      for (const value of ['9007199254740992', '9007199254740993', '9'.repeat(400)]) {
        assert.equal(testCounters(nodeSummary({ ...mixedCounters, [key]: value }, marker)), null, `${key} ${value}`);
      }
    }
    for (const counters of [
      { tests: Number.MAX_SAFE_INTEGER, pass: Number.MAX_SAFE_INTEGER, fail: 1, cancelled: 0, skipped: 0, todo: 0 },
      { tests: Number.MAX_SAFE_INTEGER, pass: Number.MAX_SAFE_INTEGER - 1, fail: 1, cancelled: 1, skipped: 0, todo: 0 },
      { tests: Number.MAX_SAFE_INTEGER, pass: Number.MAX_SAFE_INTEGER, fail: Number.MAX_SAFE_INTEGER, cancelled: 0, skipped: 0, todo: 0 },
    ]) assert.equal(testCounters(nodeSummary(counters, marker)), null);
  }
});

test('testCounters accepts safe-integer boundaries for every outcome', () => {
  for (const marker of ['#', 'ℹ']) {
    for (const key of ['pass', 'fail', 'cancelled', 'skipped', 'todo']) {
      const counters = { tests: Number.MAX_SAFE_INTEGER, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0, [key]: Number.MAX_SAFE_INTEGER };
      assert.deepEqual(testCounters(nodeSummary(counters, marker)), counters, key);
    }
    const counters = { tests: Number.MAX_SAFE_INTEGER, pass: Number.MAX_SAFE_INTEGER - 4, fail: 1, cancelled: 1, skipped: 1, todo: 1 };
    assert.deepEqual(testCounters(nodeSummary(counters, marker)), counters);
  }
});
