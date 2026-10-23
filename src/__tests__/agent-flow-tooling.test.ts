import { spawnSync } from 'node:child_process';

// CI's changed-file runner discovers Jest tests, not scripts/*.test.mjs.
// Execute the actual existing suites; never substitute a mocked collector.
test('Agent Flow Node suites pass with no skipped or cancelled tests', () => {
  const result = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap',
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
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });

  if (result.error || result.status !== 0) {
    const failures = result.stdout.match(/^not ok \d+ - .+$/gm) ?? [];
    throw new Error(`Agent Flow tests failed: exit=${result.status ?? result.error?.message ?? 'unknown'}; ${failures.join('; ') || 'no named failure emitted'}`);
  }
  const counters = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(counter => {
    const match = result.stdout.match(new RegExp(`^# ${counter} (\\d+)$`, 'm'));
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
