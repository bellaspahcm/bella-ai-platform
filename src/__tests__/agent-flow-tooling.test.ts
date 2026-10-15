import { spawnSync } from 'node:child_process';

// CI's changed-file runner discovers Jest tests, not scripts/*.test.mjs.
// Execute the actual existing suites; never substitute a mocked collector.
test('Agent Flow Node suites pass with no skipped or cancelled tests', () => {
  const result = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap',
    'scripts/agent-flow/agent-flow.test.mjs',
    'scripts/agent-flow/task-workflow.test.mjs',
    'scripts/agent-flow/filechange.test.mjs',
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, windowsHide: true });

  if (result.error || result.status !== 0) {
    throw new Error(`Agent Flow tests failed: ${result.error?.message ?? result.status}\n${result.stdout}\n${result.stderr}`);
  }
  expect(result.stdout).toMatch(/^# tests [1-9]\d*$/m);
  for (const counter of ['fail', 'cancelled', 'skipped', 'todo']) {
    expect(result.stdout).toMatch(new RegExp(`^# ${counter} 0$`, 'm'));
  }
  console.log(result.stdout.split(/\r?\n/).filter(line => /^# (tests|pass|fail|cancelled|skipped|todo) /.test(line)).join('\n'));
}, 70000);
