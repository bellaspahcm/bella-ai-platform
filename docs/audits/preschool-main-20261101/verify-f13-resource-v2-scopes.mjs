// Read-only source scans. Only evidence files here and an owned temp snapshot
// are written. No checkout, baseline update, migration, or database connection.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { scanViolations, scanDatabaseAccesses, compareBaseline, compareResourceAccesses, getAllTsFiles } from '../../../scripts/ci-run-education-architecture.mjs';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(evidenceDir, '../../..');
const wip = 'D:/Antigravity/Projects/BELLA SPA ERP';
const sourceSha = 'f1299e3138f3700062a1ed84271db315737b0071';
const baselineFile = '.github/ci/education-architecture-baselines.json';
const sourcePaths = ['src/products/bella-education', 'src/app/api/education', 'src/app/dashboard/education'];
const sha256 = data => createHash('sha256').update(data).digest('hex');
const git = (cwd, args) => execFileSync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
function fingerprint(cwd) {
  const status = git(cwd, ['status', '--porcelain=v1', '-z']);
  const diff = git(cwd, ['diff', '--binary', 'HEAD']);
  const untracked = git(cwd, ['ls-files', '-z', '--others', '--exclude-standard']).toString().split('\0').filter(Boolean).sort();
  return {
    head: git(cwd, ['rev-parse', 'HEAD']).toString().trim(),
    branch: git(cwd, ['branch', '--show-current']).toString().trim(),
    statusSha256: sha256(status), trackedDiffSha256: sha256(diff),
    untrackedCount: untracked.length,
    untrackedSha256: sha256(JSON.stringify(untracked.map(file => [file, sha256(fs.readFileSync(path.join(cwd, file)))]))),
  };
}
async function scan(label, checkout) {
  const roots = sourcePaths.map(file => path.join(checkout, file));
  const baseline = JSON.parse(fs.readFileSync(path.join(checkout, baselineFile), 'utf8'));
  const violations = await scanViolations(roots, roots[0]);
  const inventory = await scanDatabaseAccesses(roots, checkout);
  const categories = Object.fromEntries(Object.entries(violations).map(([key, current]) =>
    [key, compareBaseline(baseline[key]?.violations ?? {}, current)]));
  const resourceComparison = compareResourceAccesses(baseline.directDatabaseAccess?.violations ?? {}, inventory);
  const files = await Promise.all(roots.map(getAllTsFiles));
  const result = {
    label, scannerSha256: sha256(fs.readFileSync(path.join(repo, 'scripts/ci-run-education-architecture.mjs'))),
    scopeFiles: Object.fromEntries(sourcePaths.map((name, index) => [name, files[index].length])),
    status: resourceComparison.status === 'BLOCK' || Object.values(categories).some(category => category.status === 'BLOCK') ? 'BLOCK' : 'ALLOW',
    categories, violations, resourceInventory: inventory, resourceComparison,
  };
  fs.writeFileSync(path.join(evidenceDir, `f13-resource-v2-${label}.json`), JSON.stringify(result, null, 2));
  return result;
}

const before = fingerprint(wip);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bella-f13-main-'));
let main, current, oldWip;
try {
  const snapshot = path.join(temp, 'snapshot');
  fs.mkdirSync(snapshot);
  const archive = path.join(temp, 'source.tar');
  git(repo, ['archive', '--format=tar', `--output=${archive}`, sourceSha, '--', ...sourcePaths, baselineFile]);
  execFileSync('tar', ['-xf', archive, '-C', snapshot]);
  main = await scan('main', snapshot);
  current = await scan('technical', repo);
  oldWip = await scan('wip', wip);
} finally {
  const target = path.resolve(temp);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('bella-f13-main-')) {
    throw new Error('Unexpected snapshot cleanup path');
  }
  fs.rmSync(target, { recursive: true, force: true });
}
const after = fingerprint(wip);
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('WIP changed during read-only scan');
const frozen = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'f13-ownership-inventory.json'), 'utf8'));
for (const match of frozen.matches) {
  if (!main.resourceInventory.some(row => row.file === match.sourceFile && row.line === match.line
    && row.target === match.target && row.method === (match.kind === 'sql' ? 'from' : 'rpc'))) {
    throw new Error(`AST inventory does not account for frozen occurrence ${match.id}`);
  }
}
const summary = {
  capturedAt: new Date().toISOString(), mainSourceSha: sourceSha,
  remoteMain: 'Separate read-only git ls-remote receipt; scans use the pinned SHA, not remote-tracking cache.',
  baselineChanged: false, wipUnchanged: true, wipBefore: before, wipAfter: after,
  frozenOccurrencesAccountedFor: frozen.matches.length,
  scopes: [main, current, oldWip].map(result => ({
    label: result.label, status: result.status, scopeFiles: result.scopeFiles,
    categories: Object.fromEntries(Object.entries(result.categories).map(([key, value]) =>
      [key, { status: value.status, baseline: value.baselineTotal, current: value.currentTotal,
        newSignatures: value.added.length, addedOccurrences: value.added.reduce((sum, row) => sum + row.delta, 0) }])),
    resources: {status: result.resourceComparison.status, current: result.resourceComparison.currentTotal, exactBaseline: result.resourceComparison.exactBaselineTotal, unresolved: result.resourceComparison.unresolved.length},
    resourceCalls: result.resourceInventory.length,
    unresolvedTargets: result.resourceInventory.filter(row => row.target === null).length,
  })),
};
fs.writeFileSync(path.join(evidenceDir, 'f13-resource-v2-scopes.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
