import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the real selector; replace only OS process/filesystem boundaries.
const source = readFileSync(new URL('./test-changed-files.mjs', import.meta.url), 'utf8')
  .replace(/^import .* from 'node:(?:child_process|fs)';\r?\n/gm, '');
function select(files, status = 0, jsonOutput = false) {
  const calls = [], writes = [], stopped = {};
  let exit;
  const context = {
    process: { argv: ['node', 'selector', ...(jsonOutput ? ['--jest-json-output', 'result.json'] : []), ...files],
      platform: 'linux', env: {}, exit(code) { exit = code; throw stopped; } },
    console: { log() {} },
    spawnSync(command, args) {
      calls.push({ command, args: [...args] });
      return { status: args.includes('--listTests') ? 0 : status,
        stdout: args.includes('--listTests') ? 'src/__tests__/agent-flow-tooling.test.ts\n' : '' };
    },
    writeFileSync(path, value) { writes.push({ path, value: JSON.parse(value) }); },
  };
  try { runInNewContext(source, context); } catch (error) { if (error !== stopped) throw error; }
  return { calls, writes, exit };
}

test('mixed source/config and direct tests run in separate Jest modes', () => {
  const r = select(['playwright.automove-mvp-pilot.config.ts', 'src/__tests__/agent-flow-tooling.test.ts'], 0, true);
  assert.equal(r.exit, 0); assert.equal(r.calls.length, 2);
  assert.equal(r.calls[0].command, 'npx');
  assert.deepEqual(r.calls[0].args.slice(0, 4), ['jest', '--listTests', '--findRelatedTests', 'playwright.automove-mvp-pilot.config.ts']);
  assert.ok(r.calls[0].args.includes('--testPathIgnorePatterns'));
  assert.deepEqual(r.calls[1].args, ['jest', '--runInBand', '--runTestsByPath', 'src/__tests__/agent-flow-tooling.test.ts',
    '--json', '--outputFile', 'result.json']);
});

test('direct-test-only and source-only keep their existing invocation and failures propagate', () => {
  const direct = select(['src/__tests__/agent-flow-tooling.test.ts'], 1, true);
  assert.equal(direct.exit, 1);
  assert.deepEqual(direct.calls[0].args, ['jest', '--runInBand', '--runTestsByPath', 'src/__tests__/agent-flow-tooling.test.ts', '--json', '--outputFile', 'result.json']);
  const related = select(['src/example.ts'], 2, true);
  assert.equal(related.exit, 2); assert.ok(related.calls[0].args.includes('src/example.ts'));
  assert.deepEqual(related.calls[1].args, ['jest', '--runInBand', '--runTestsByPath', 'src/__tests__/agent-flow-tooling.test.ts', '--json', '--outputFile', 'result.json']);
});

test('E2E and unsupported real-DB suites remain outside the non-DB Jest selector', () => {
  const r = select(['playwright.automove-mvp-pilot.config.ts', 'e2e/tests/47-automove-customer-preferences-pilot.spec.ts',
    'src/products/bella-education/__tests__/preschool-chain-real-db.test.ts']);
  assert.equal(r.exit, 0);
  assert.equal(r.calls[0].args.some(arg => arg.includes('47-automove') || arg.includes('preschool-chain-real-db.test.ts')), false);
});

test('no covered changes writes truthful empty counters without spawning Jest', () => {
  const r = select(['docs/example.md'], 0, true);
  assert.equal(r.exit, 0); assert.equal(r.calls.length, 0);
  assert.equal(r.writes.length, 1); assert.equal(r.writes[0].value.numTotalTests, 0);
  assert.equal(r.writes[0].value.numFailedTests, 0);
});

test('failed process creation is a failure, never a no-tests pass', () => {
  assert.equal(select(['src/example.ts', 'src/__tests__/example.test.ts'], null).exit, 1);
});
