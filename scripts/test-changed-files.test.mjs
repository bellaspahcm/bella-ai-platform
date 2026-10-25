import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

// Execute the real selector; replace only OS process/filesystem boundaries.
const source = readFileSync(new URL('./test-changed-files.mjs', import.meta.url), 'utf8')
  .replace(/^import .* from 'node:(?:child_process|fs|path)';\r?\n/gm, '');
const t1Values = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:24631',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  BELLA_DISPOSABLE_FIXTURE_MANIFEST: '/tmp/t1/fixture-manifest.json',
  BELLA_FIXTURE_RECEIPT_DIR: '/tmp/t1/receipts',
};
function jestResult(testFiles, status) {
  const failed = status !== 0;
  return {
    numFailedTestSuites: failed ? testFiles.length : 0,
    numFailedTests: failed ? testFiles.length : 0,
    numPassedTestSuites: failed ? 0 : testFiles.length,
    numPassedTests: failed ? 0 : testFiles.length,
    numPendingTestSuites: 0, numPendingTests: 0, numRuntimeErrorTestSuites: 0,
    numTodoTests: 0, numTotalTestSuites: testFiles.length, numTotalTests: testFiles.length,
    openHandles: [], startTime: 1, success: !failed, wasInterrupted: false,
    snapshot: {
      added: 0, didUpdate: false, failure: false, filesAdded: 0, filesRemoved: 0,
      filesRemovedList: [], filesUnmatched: 0, filesUpdated: 0, matched: 0,
      total: 0, unchecked: 0, uncheckedKeysByFile: [], unmatched: 0, updated: 0,
    },
    testResults: testFiles.map((file) => ({
      name: path.resolve(file), status: failed ? 'failed' : 'passed',
      assertionResults: [{ status: failed ? 'failed' : 'passed', title: 'probe' }],
    })),
  };
}
function select(files, status = 0, jsonOutput = false, options = {}) {
  const calls = [], writes = [], storedFiles = new Map(), stopped = {};
  let exit;
  let thrown;
  if (options.t1Env) storedFiles.set('/tmp/t1-env.json', JSON.stringify(options.t1Env));
  if (options.existingOutput) storedFiles.set('result.json', JSON.stringify(options.existingOutput));
  const context = {
    process: { argv: ['node', 'selector', ...(jsonOutput ? ['--jest-json-output', 'result.json'] : []), ...files],
      platform: 'linux', env: options.env ?? {}, exit(code) { exit = code; throw stopped; } },
    console: { log() {} },
    path,
    spawnSync(command, args, spawnOptions) {
      calls.push({ command, args: [...args], env: spawnOptions.env });
      if (args.includes('--listTests')) {
        return { status: 0, stdout: 'src/__tests__/agent-flow-tooling.test.ts\n' };
      }
      const firstTest = args.indexOf('--runTestsByPath') + 1;
      const jsonIndex = args.indexOf('--json');
      const tests = args.slice(firstTest, jsonIndex === -1 ? undefined : jsonIndex);
      const groupStatus = options.statusByGroup?.(tests) ?? status;
      if (jsonIndex !== -1 && groupStatus !== null && !options.omitJestJson) {
        const result = jestResult(tests, groupStatus);
        options.transformResult?.(result, tests);
        storedFiles.set(args[jsonIndex + 2], JSON.stringify(result));
      }
      return { status: groupStatus };
    },
    existsSync(file) { return storedFiles.has(file); },
    readFileSync(file) {
      if (!storedFiles.has(file)) throw new Error(`FILE_MISSING:${file}`);
      return storedFiles.get(file);
    },
    unlinkSync(file) { storedFiles.delete(file); },
    writeFileSync(file, value) {
      storedFiles.set(file, value);
      writes.push({ path: file, value: JSON.parse(value) });
    },
  };
  try { runInNewContext(source, context); } catch (error) {
    if (error !== stopped) thrown = error;
  }
  return { calls, writes, exit, thrown, storedFiles };
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

test('controlled local DB proofs never run as direct tests without their local fixture environment', () => {
  const local = [
    'tests/products/bella-education/finance/p71-finance-billing.integration.test.ts',
    'tests/products/bella-education/finance/p72-finance-communication.integration.test.ts',
    'tests/products/bella-education/finance/preschool-finance-canonical-identity.test.ts',
    'src/platform/education/__tests__/enrollment-event-recovery-real-db.test.ts',
  ];
  const r = select([...local, 'src/__tests__/example.test.ts']);
  assert.deepEqual(r.calls[0].args, ['jest', '--runInBand', '--runTestsByPath', 'src/__tests__/example.test.ts']);
  const onlyLocal = select(local, 0, true);
  assert.equal(onlyLocal.calls.length, 0);
  assert.equal(onlyLocal.writes[0].value.numTotalTests, 0);
});

test('failed process creation is a failure, never a no-tests pass', () => {
  assert.match(select(['src/example.ts', 'src/__tests__/example.test.ts'], null).thrown.message,
    /JEST_PROCESS_FAILED/);
});

test('ba bộ kiểm thử Education dùng khóa T1 riêng, các bộ khác giữ môi trường thường', () => {
  const r = select([
    'src/__tests__/agent-flow-tooling.test.ts',
    'src/platform/education/__tests__/verification-gates.test.ts',
    'src/platform/education/__tests__/course-contract-real-db.integration.test.ts',
    'src/platform/education/__tests__/kernel-invariants.integration.test.ts',
  ], 0, true, {
    env: { CI: 'true', BELLA_T1_ENV_REQUIRED: 'true', BELLA_T1_TEST_ENV_FILE: '/tmp/t1-env.json', ...t1Values },
    t1Env: t1Values,
  });
  assert.equal(r.thrown, undefined);
  assert.equal(r.exit, 0);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls[0].env.NEXT_PUBLIC_SUPABASE_URL, undefined);
  assert.equal(r.calls[0].env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(r.calls[0].env.BELLA_T1_TEST_ENV_FILE, undefined);
  assert.equal(r.calls[1].env.NEXT_PUBLIC_SUPABASE_URL, t1Values.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(r.calls[1].env.SUPABASE_SERVICE_ROLE_KEY, t1Values.SUPABASE_SERVICE_ROLE_KEY);
  const merged = r.writes.find((write) => write.path === 'result.json')?.value;
  assert.equal(merged.numTotalTestSuites, 4);
  assert.equal(merged.numPassedTests, 4);
  assert.equal(merged.testResults.length, 4);
  assert.equal(new Set(merged.testResults.map((suite) => suite.name)).size, 4);
});

test('bộ kiểm thử thường thất bại vẫn được ghi nhận và Education vẫn chạy', () => {
  const r = select([
    'src/__tests__/agent-flow-tooling.test.ts',
    'src/platform/education/__tests__/verification-gates.test.ts',
  ], 0, true, {
    env: { CI: 'true', BELLA_T1_TEST_ENV_FILE: '/tmp/t1-env.json' },
    t1Env: t1Values,
    statusByGroup: (files) => files.some((file) => file.includes('agent-flow')) ? 1 : 0,
  });
  assert.equal(r.exit, 1);
  assert.equal(r.calls.length, 2);
  const merged = r.writes.find((write) => write.path === 'result.json')?.value;
  assert.equal(merged.numFailedTests, 1);
  assert.equal(merged.numPassedTests, 1);
  assert.equal(merged.success, false);
});

test('CI từ chối khi thiếu khóa T1, kết quả Jest hoặc bộ kiểm thử đã chọn', () => {
  const testFile = 'src/platform/education/__tests__/verification-gates.test.ts';
  const noCredentials = select([testFile], 0, true, {
    env: { CI: 'true', BELLA_T1_ENV_REQUIRED: 'true' },
    existingOutput: jestResult([testFile], 0),
  });
  assert.match(noCredentials.thrown.message, /T1_TEST_ENV_FILE_REQUIRED/);
  assert.equal(noCredentials.storedFiles.has('result.json'), false);
  assert.match(select([testFile], 0, true, {
    env: { CI: 'true', BELLA_T1_TEST_ENV_FILE: '/tmp/t1-env.json' },
    t1Env: t1Values, omitJestJson: true,
  }).thrown.message, /JEST_JSON_MISSING/);
  assert.match(select([testFile, 'src/platform/education/__tests__/kernel-invariants.integration.test.ts'], 0, true, {
    env: { CI: 'true', BELLA_T1_TEST_ENV_FILE: '/tmp/t1-env.json' },
    t1Env: t1Values,
    transformResult: (result) => { result.testResults[1].name = result.testResults[0].name; },
  }).thrown.message, /JEST_SUITE_MISSING_DUPLICATED_OR_UNEXPECTED/);
});

test('CI khác không bật cờ T1 vẫn dùng môi trường hiện có của bộ kiểm thử Education', () => {
  const r = select(['src/platform/education/__tests__/verification-gates.test.ts'], 0, true, {
    env: { CI: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid' },
  });
  assert.equal(r.thrown, undefined);
  assert.equal(r.exit, 0);
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].env.NEXT_PUBLIC_SUPABASE_URL, 'https://example.invalid');
});
