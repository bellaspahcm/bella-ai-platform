import { spawnSync } from 'node:child_process';

const nodeTestFiles = [
  'scripts/test-changed-files.test.mjs',
  'scripts/static-analysis-scope.test.mjs',
  'scripts/agent-flow/agent-flow.test.mjs',
  'scripts/agent-flow/task-workflow.test.mjs',
  'scripts/agent-flow/filechange.test.mjs',
  'scripts/agent-flow/role-pipeline.test.mjs',
  'scripts/agent-flow/probe-transport.test.mjs',
  'scripts/agent-flow/run-evidence.test.mjs',
  'scripts/agent-flow/persistence-diagnostic.test.mjs',
  'scripts/agent-flow/factory-publication.test.mjs',
  'scripts/agent-flow/mvp-pilot.test.mjs',
  'scripts/agent-flow/mvp-pilot-runner.test.mjs',
  'scripts/agent-flow-dashboard/dashboard.test.mjs',
  'scripts/agent-flow-dashboard/factory-reader.test.mjs',
  'scripts/agent-flow-dashboard/historical-reader.test.mjs',
];

// CI's changed-file runner discovers Jest tests, not scripts/*.test.mjs.
// Execute the actual existing suites; never substitute a mocked collector.
test('Agent Flow Node suites pass with no skipped or cancelled tests', () => {
  const result = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap',
    ...nodeTestFiles,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });

  if (result.error || result.status !== 0) {
    const lines = result.stdout.split(/\r?\n/);
    const failureBlocks = lines.flatMap((line, index) => {
      if (!/^not ok \d+ - /.test(line)) return [];
      const end = lines.findIndex((candidate, offset) => offset > index && /^(?:ok|not ok) \d+ - /.test(candidate));
      return [lines.slice(index, end < 0 ? lines.length : end).join('\n')];
    });
    const failedFiles = nodeTestFiles.filter(file => lines.some(line => /^not ok \d+ - /.test(line) && line.includes(file)));
    const isolatedDiagnostics = failedFiles.map(file => {
      const isolated = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 30000, windowsHide: true,
      });
      return `ISOLATED ${file} exit=${isolated.status ?? isolated.error?.message ?? 'unknown'}\n${isolated.stdout ?? ''}\n${isolated.stderr ?? ''}`;
    });
    const diagnostic = [...failureBlocks, ...isolatedDiagnostics].join('\n').slice(0, 6000);
    throw new Error(`Agent Flow tests failed: exit=${result.status ?? result.error?.message ?? 'unknown'}; ${diagnostic || 'no named failure emitted'}`);
  }
  const counterPatterns = {
    tests: /^# tests (\d+)$/m,
    pass: /^# pass (\d+)$/m,
    fail: /^# fail (\d+)$/m,
    cancelled: /^# cancelled (\d+)$/m,
    skipped: /^# skipped (\d+)$/m,
    todo: /^# todo (\d+)$/m,
  };
  const counters = Object.fromEntries(Object.entries(counterPatterns).map(([counter, pattern]) => {
    const match = result.stdout.match(pattern);
    return [counter, match ? Number(match[1]) : null];
  }));
  expect(counters).toEqual({
    tests: expect.any(Number),
    pass: expect.any(Number),
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  expect(counters.tests).toBeGreaterThan(0);
  expect(counters.pass).toBe(counters.tests);
  console.log(Object.entries(counters).map(([name, value]) => `# ${name} ${value}`).join('\n'));
}, 70000);
