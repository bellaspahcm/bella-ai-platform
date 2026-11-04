const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-groups-summary.json')));
const checks = [];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
for (const group of summary.groups) {
  const git = args => cp.spawnSync('git', ['--literal-pathspecs', ...args], { cwd: group.root, encoding: 'utf8', windowsHide: true });
  const filesMatch = group.files.every(file => sha(fs.readFileSync(path.join(group.root, file.file))) === file.sha256);
  const kernel = git(['diff', '--name-only', summary.baseline, '--', 'src/platform', 'supabase', '.github', 'scripts/architecture', '.husky', 'AGENTS.md']);
  const index = git(['diff', '--cached', '--name-only']);
  const trackedCheck = git(['diff', '--check']);
  const doc = path.join(group.root, 'docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md');
  const contractHash = fs.existsSync(doc) ? sha(fs.readFileSync(doc)) : null;
  const sealedFile = path.join(__dirname, group.group + '-local-commit.json');
  const sealed = fs.existsSync(sealedFile) ? JSON.parse(fs.readFileSync(sealedFile)) : null;
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  const valid = filesMatch && kernel.status === 0 && !kernel.stdout.trim() && index.status === 0 && !index.stdout.trim() && trackedCheck.status === 0 && (!sealed || head === sealed.commit);
  checks.push({ group: group.group, root: group.root, branch: group.branch, head, sourceFilesMatchManifest: filesMatch, protectedSurfaceDiffEmpty: kernel.status === 0 && !kernel.stdout.trim(), indexEmpty: index.status === 0 && !index.stdout.trim(), trackedWhitespaceExit: trackedCheck.status, approvedContractSha256: contractHash, localCommit: sealed?.commit ?? null, sourceDelivery: sealed ? 'LOCAL_COMMIT_ONLY' : 'HELD_IN_REVIEW', result: valid ? 'PASS' : 'FAIL' });
}
const documentHashes = [...new Set(checks.map(row => row.approvedContractSha256).filter(Boolean))];
const result = checks.every(row => row.result === 'PASS') && documentHashes.length === 1 && documentHashes[0] === '8a0a6925b3cce32e88df1f016fa8e984276e217cdae57f6e4c51be2148e2ba39' ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'source-seals.json'), JSON.stringify({ checkedAt: new Date().toISOString(), purpose: 'Current source byte/seal/scope integrity only; no authorization/RLS/release PASS', checks, totalFocusedSuites: summary.groups.reduce((n, group) => n + group.tests.passedSuites, 0), totalFocusedTests: summary.totalFocusedTests, result }, null, 2) + '\n');
console.log(JSON.stringify({ result, checks, suites: summary.groups.reduce((n, group) => n + group.tests.passedSuites, 0), tests: summary.totalFocusedTests })); if (result !== 'PASS') process.exitCode = 1;
