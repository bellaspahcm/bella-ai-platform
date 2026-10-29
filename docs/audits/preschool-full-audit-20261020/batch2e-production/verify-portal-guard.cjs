const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = 'C:/Users/DELL/.codex/worktrees/preschool-parent-access-20261021/BELLA SPA ERP';
const commit = JSON.parse(fs.readFileSync(path.join(__dirname, 'portal-local-commit.json')));
const tempFolder = path.join(root, '.cache/guard-evidence'); fs.mkdirSync(tempFolder, { recursive: true });
const index = path.join(tempFolder, 'portal-baseline-path-set.index');
if (fs.existsSync(index)) throw Error('Refuse to overwrite a pre-existing temporary index');
const env = { ...process.env, GIT_INDEX_FILE: index };
function git(args, isolated = false) {
  const result = cp.spawnSync('git', ['--literal-pathspecs', ...args], { cwd: root, env: isolated ? env : process.env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error('Git guard evidence failed: ' + args[0]); return result.stdout;
}
const originalIndex = git(['diff', '--cached', '--name-only']); if (originalIndex.trim()) throw Error('Real index is not empty');
const headBefore = git(['rev-parse', 'HEAD']).trim(); if (headBefore !== commit.commit) throw Error('Unexpected Portal source head');
git(['read-tree', '30134055d1ff5b846584e57833816f076034cdea'], true);
// The existing guard reads only changed filenames, not direction or contents.
// Baseline index versus sealed HEAD supplies exactly the same23 changed paths.
const staged = git(['diff', '--cached', '--name-only'], true).trim().split(/\r?\n/).sort();
if (JSON.stringify(staged) !== JSON.stringify([...commit.files].sort())) throw Error('Temporary index does not match sealed delta');
const run = cp.spawnSync(process.execPath, ['scripts/architecture/git-pre-commit-guard.js'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
fs.writeFileSync(path.join(__dirname, 'portal-manual-guard.log'), (run.stdout || '') + (run.stderr || ''));
const headAfter = git(['rev-parse', 'HEAD']).trim(), realIndexAfter = git(['diff', '--cached', '--name-only']);
const report = { checkedAt: new Date().toISOString(), command: [process.execPath, 'scripts/architecture/git-pre-commit-guard.js'], exitCode: run.status,
  purpose: 'Existing filename-only guard over exact23 changed paths via baseline temporary index versus sealed HEAD; reverse delta has identical protected path set. Not historical pre-commit execution', files: staged, initialCommitHook: 'NOT_RUN: configured .husky/_ shim was absent',
  normalPrepare: 'npm run prepare native0 installed existing ignored Husky runtime, no tracked guard/policy/config value changes', hookShimNowPresent: fs.existsSync(path.join(root, '.husky/_/pre-commit')),
  realIndexUnchanged: realIndexAfter === originalIndex, headUnchanged: headBefore === headAfter, sourceCommit: headBefore, result: run.status === 0 && realIndexAfter === originalIndex && headBefore === headAfter ? 'PASS' : 'FAIL' };
fs.writeFileSync(path.join(__dirname, 'portal-manual-guard.json'), JSON.stringify(report, null, 2) + '\n');
// Remove only the verified single temporary index file; preserve directory and all other data.
fs.unlinkSync(index);
console.log(JSON.stringify(report)); console.log(run.stdout || ''); if (report.result !== 'PASS') process.exitCode = 1;
