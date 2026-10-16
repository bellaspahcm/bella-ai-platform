import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

describe('Vitest env-file selection', () => {
  let scratch: string;
  const files = ['.env.local', 'explicit.env', 'alias.env'];

  beforeAll(() => {
    scratch = mkdtempSync(path.join(tmpdir(), 'bella-vitest-env-'));
    for (const [index, value] of ['default', 'explicit', 'alias'].entries()) {
      writeFileSync(path.join(scratch, files[index]), `RECOVERY_ENV_CHECK=${value}\n`);
    }
  });

  afterAll(() => {
    for (const file of files) unlinkSync(path.join(scratch, file));
    rmdirSync(scratch);
  });

  const cases: Array<[string, Record<string, string>, string]> = [
    ['default', {}, 'default'],
    ['explicit path', { VITEST_ENV_FILE: 'explicit.env' }, 'explicit'],
    ['Bella alias', { BELLA_VITEST_ENV_FILE: 'alias.env' }, 'alias'],
    ['primary variable precedence', { VITEST_ENV_FILE: 'explicit.env', BELLA_VITEST_ENV_FILE: 'alias.env' }, 'explicit'],
    ['preserve process environment', { VITEST_ENV_FILE: 'explicit.env', RECOVERY_ENV_CHECK: 'process' }, 'process'],
  ];

  it.each(cases)('%s', (_name, patch, expected) => {
    const env = { ...process.env };
    delete env.VITEST_ENV_FILE;
    delete env.BELLA_VITEST_ENV_FILE;
    delete env.RECOVERY_ENV_CHECK;
    Object.assign(env, patch);
    const configUrl = pathToFileURL(path.resolve('vitest.config.ts')).href;
    const loader = pathToFileURL(require.resolve('tsx')).href;
    const result = spawnSync(process.execPath, [
      '--import', loader, '--input-type=module', '-e',
      `await import(${JSON.stringify(configUrl)}); console.log('RESULT:' + process.env.RECOVERY_ENV_CHECK);`,
    ], { cwd: scratch, env, encoding: 'utf8', timeout: 30000 });

    assert.equal(result.status, 0, result.stderr);
    expect(result.stdout).toContain(`RESULT:${expected}`);
  });
});
