import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(root, '.github/workflows/static-analysis.yml'), 'utf8').replaceAll('\r\n', '\n');
const step = workflow.split('      - name: Check if application code changed\n')[1]?.split('      - name: Run Semgrep CE\n')[0];
assert.ok(step, 'Semgrep scope step must exist');
const script = step.split('        run: |\n')[1].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function fixture(paths, run, initialPaths = []) {
  const temporary = mkdtempSync(join(tmpdir(), 'bella-semgrep-scope-'));
  try {
    const origin = join(temporary, 'origin'), checkout = join(temporary, 'checkout');
    mkdirSync(origin);
    git(origin, 'init', '-b', 'main');
    writeFileSync(join(origin, 'README.md'), 'base\n');
    for (const path of initialPaths) {
      mkdirSync(dirname(join(origin, path)), { recursive: true });
      writeFileSync(join(origin, path), 'base\n');
    }
    git(origin, 'add', '.');
    const commit = message => git(origin, '-c', 'user.name=Scope Fixture', '-c', 'user.email=scope@example.invalid', 'commit', '-m', message);
    commit('base');
    const base = git(origin, 'rev-parse', 'HEAD');
    git(origin, 'switch', '-c', 'topic');
    for (const path of paths) {
      mkdirSync(dirname(join(origin, path)), { recursive: true });
      writeFileSync(join(origin, path), 'changed\n');
    }
    git(origin, 'add', '.');
    commit('changes');
    const head = git(origin, 'rev-parse', 'HEAD');
    git(temporary, 'clone', '--no-hardlinks', '--branch', 'topic', origin, checkout);
    let sequence = 0;
    const execute = (overrides = {}) => {
      const output = join(temporary, `output-${sequence++}`);
      const result = spawnSync(shell, ['-e', '-c', script], {
        cwd: checkout, encoding: 'utf8', windowsHide: true, timeout: 15000,
        env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main',
          GITHUB_WORKSPACE: checkout.replaceAll('\\', '/'), GITHUB_OUTPUT: output.replaceAll('\\', '/'),
          SEMGREP_BASE_SHA: base, SEMGREP_HEAD_SHA: head, ...overrides },
      });
      assert.ifError(result.error);
      let value = '';
      try { value = readFileSync(output, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return { ...result, output: value };
    };
    run({ execute, origin, checkout, base, head });
  } finally {
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
    rmSync(temporary, { recursive: true, force: true });
  }
}

test('AutoMove source/test files require application scan', () => {
  fixture(['src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx', 'src/components/bella-auto/__tests__/BellaAutoAnalyticsDashboard.recognition.test.tsx'], ({ execute }) => {
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  });
});

test('verified infrastructure-only diff retains reduced scan', () => {
  fixture(['.github/workflows/test.yml', 'docs/test.md', 'scripts/test.mjs'], ({ execute }) => {
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=false\n');
  });
});

test('mixed changes still require application scan', () => {
  fixture(['docs/test.md', 'src/changed.ts'], ({ execute }) => {
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  });
});

test('moving source into docs still requires application scan', () => {
  fixture(['docs/placeholder.md'], ({ execute, origin, checkout }) => {
    git(origin, 'mv', 'src/original.ts', 'docs/original.ts');
    git(origin, '-c', 'user.name=Scope Fixture', '-c', 'user.email=scope@example.invalid', 'commit', '-m', 'move source into docs');
    const head = git(origin, 'rev-parse', 'HEAD');
    git(checkout, 'fetch', 'origin', head);
    git(checkout, 'switch', '--detach', head);
    const result = execute({ SEMGREP_HEAD_SHA: head });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  }, ['src/original.ts']);
});

test('moving base branch does not erase the pinned PR change', () => {
  fixture(['src/changed.ts'], ({ execute, origin, head }) => {
    git(origin, 'branch', '-f', 'main', head);
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  });
});

test('fetch failure fails the classifier instead of reducing scan', () => {
  fixture(['src/changed.ts'], ({ execute, origin, checkout }) => {
    // Known SHA fetches can be satisfied locally. Require a genuinely new object.
    writeFileSync(join(origin, 'src/changed.ts'), 'new remote commit\n');
    git(origin, 'add', '.');
    git(origin, '-c', 'user.name=Scope Fixture', '-c', 'user.email=scope@example.invalid', 'commit', '-m', 'remote-only change');
    const remoteHead = git(origin, 'rev-parse', 'HEAD');
    git(checkout, 'remote', 'set-url', 'origin', join(dirname(checkout), 'missing-origin'));
    const result = execute({ SEMGREP_HEAD_SHA: remoteHead });
    assert.notEqual(result.status, 0, JSON.stringify({ stdout: result.stdout, stderr: result.stderr }));
    assert.equal(result.output, '');
  });
});

test('unavailable pinned revision cannot be treated as infrastructure', () => {
  fixture(['docs/test.md'], ({ execute }) => {
    const result = execute({ SEMGREP_BASE_SHA: 'f'.repeat(40) });
    assert.notEqual(result.status, 0);
    assert.equal(result.output, '');
  });
});

test('missing or malformed revision fails without a scope output', () => {
  fixture(['docs/test.md'], ({ execute }) => {
    for (const base of ['', 'not-a-revision', '-'.repeat(40)]) {
      const result = execute({ SEMGREP_BASE_SHA: base });
      assert.notEqual(result.status, 0);
      assert.equal(result.output, '');
    }
  });
});

test('empty comparison conservatively requests application scan', () => {
  fixture(['docs/test.md'], ({ execute, head }) => {
    const result = execute({ SEMGREP_BASE_SHA: head });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  });
});

test('manual and scheduled runs require full application scan', () => {
  fixture(['docs/test.md'], ({ execute }) => {
    for (const event of ['workflow_dispatch', 'schedule']) {
      const result = execute({ GITHUB_EVENT_NAME: event, SEMGREP_BASE_SHA: '' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.output, 'has_code=true\n');
    }
  });
});

test('push compares the complete pinned push range', () => {
  fixture(['src/changed.ts'], ({ execute, base, head }) => {
    const result = execute({ GITHUB_EVENT_NAME: 'push', SEMGREP_BASE_SHA: base, SEMGREP_HEAD_SHA: head });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'has_code=true\n');
  });
});
