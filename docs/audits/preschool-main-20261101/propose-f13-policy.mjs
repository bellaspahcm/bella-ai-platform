// Draft policy/evidence only. This script never changes active control inputs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { compareBaseline, compareResourceAccesses, resourceAccessSignature } from '../../../scripts/ci-run-education-architecture.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8').replace(/^\uFEFF/, ''));
const hash = data => createHash('sha256').update(data).digest('hex');
const baselinePath = path.join(repository, '.github/ci/education-architecture-baselines.json');
const baselineBytes = fs.readFileSync(baselinePath);
const trackedBefore = hash(execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repository }));
const sealed = read('f13-scanner-seal.json');
for (const item of sealed.sourceFiles) {
  if (hash(fs.readFileSync(path.join(repository, item.file))) !== item.sha256) throw new Error(`Source drift: ${item.file}`);
}
const dispositionSeal = read('f13-disposition-seal.json');
for (const item of dispositionSeal.artifacts) {
  if (hash(fs.readFileSync(path.join(directory, item.file))) !== item.sha256) throw new Error(`Evidence drift: ${item.file}`);
}
const analysis = read('f13-gate-disposition.json');
const baseline = JSON.parse(baselineBytes).directDatabaseAccess.violations;
const debt = analysis.rows.filter(item => item.bucket === 'HISTORICAL_265');
const candidates = analysis.candidates;
const countResources = rows => {
  const result = {};
  for (const row of rows) {
    const key = resourceAccessSignature(row);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};
const debtCounts = countResources(debt);
const exceptionCounts = countResources(candidates);
const proposedResources = { ...baseline, ...debtCounts, ...exceptionCounts };

// Hypothetical common disposition: exact exception occurrences are excluded
// from the legacy *comparison*, never from raw reporting or other callsites.
function evaluateProposal(rows) {
  const exceptionRemaining = { ...exceptionCounts };
  const legacy = {};
  for (const row of rows) {
    if (!row.legacyMatch) continue;
    const key = resourceAccessSignature(row);
    if ((exceptionRemaining[key] ?? 0) > 0) { exceptionRemaining[key]--; continue; }
    const file = path.posix.relative('src/products/bella-education', row.file);
    const message = row.method === 'rpc' ? 'Direct RPC database execution is prohibited in the Product layer.'
      : `Direct database query targeting '${row.legacyMatch}' is prohibited in the Product layer.`;
    const signature = `${file}:L${row.line} - ${message}`;
    legacy[signature] = (legacy[signature] ?? 0) + 1;
  }
  const legacyDecision = compareBaseline(baseline, legacy);
  const resourceDecision = compareResourceAccesses(proposedResources, rows);
  return { status: legacyDecision.status === 'BLOCK' || resourceDecision.status === 'BLOCK' ? 'BLOCK' : 'ALLOW',
    legacyDecision, resourceDecision };
}
const probes = [];
function check(name, rows, expected) {
  const actual = evaluateProposal(rows).status;
  probes.push({ name, expected, actual });
  if (actual !== expected) throw new Error(`Policy probe failed: ${name}`);
}
for (const row of candidates) {
  check(`${row.frozenId}: exact candidate`, [row], 'ALLOW');
  const changes = [
    ['file', { file: 'src/app/api/education/unapproved/route.ts' }],
    ['caller', { caller: 'unapprovedHandler' }],
    ['Education target', { target: 'edu_courses' }],
    ['schema', { schema: 'unapproved_schema' }],
    ['unknown target', { target: null }],
    ['unknown operation', { operation: null }],
    ['unknown schema', { schema: null }],
  ];
  if (row.method === 'from') changes.push(
    ['read/write', { operation: row.operation === 'select' ? 'update' : 'select' }],
    ['transport', { method: 'rpc', operation: 'execute' }]);
  for (const [name, delta] of changes) check(`${row.frozenId}: changed ${name}`, [{ ...row, ...delta }], 'BLOCK');
  check(`${row.frozenId}: additional source occurrence`, [row, row], 'BLOCK');
}
for (const row of analysis.rows.filter(item => item.disposition === 'BLOCK_EDUCATION_BOUNDARY')) {
  check(`${row.frozenId}: Education boundary`, [row], 'BLOCK');
}
for (const row of analysis.rows.filter(item => item.bucket === 'UNRESOLVED_EXPRESSION')) {
  check(`unresolved ${row.index}`, [row], 'BLOCK');
}
check('unchanged historical debt', debt, 'ALLOW');
check('reduced historical debt', debt.slice(1), 'ALLOW');
check('historical source quota exceeded', [...debt, debt[0]], 'BLOCK');
for (const [name, delta] of [
  ['target', { target: 'edu_unreviewed_policy_probe' }],
  ['caller', { caller: 'unapprovedHandler' }],
  ['schema', { schema: 'unapproved_schema' }],
]) check(`historical substitution: ${name}`, [{ ...debt[0], ...delta }, ...debt.slice(1)], 'BLOCK');

const full = evaluateProposal(analysis.rows);
const exactAdded = full.resourceDecision.added.reduce((sum, item) => sum + item.delta, 0);
const legacyAdded = full.legacyDecision.added.reduce((sum, item) => sum + item.delta, 0);
if (full.status !== 'BLOCK' || exactAdded !== 90 || legacyAdded !== 70
  || full.resourceDecision.unresolved.length !== 20 || full.legacyDecision.added.length !== 30) {
  throw new Error('Unexpected proposed-policy totals');
}

const tuple = row => ({ file: row.file, caller: row.caller, transport: row.method,
  schema: row.schema, resource: row.target, operation: row.operation });
const debtProjection = Object.entries(debtCounts).map(([key, count]) => {
  const rows = debt.filter(row => row.signature === key);
  return { tuple: tuple(rows[0]), maximumStaticOccurrences: count,
    sourceLocations: rows.map(row => ({ file: row.file, line: row.line })),
    proposedDisposition: 'KNOWN_DEBT_BOUNDED', semanticReviewClaim: false };
});
const proposal = {
  status: 'PROPOSED — NOT APPROVED / NOT APPLIED', policyId: 'F13-P1-P2-P3-20261101',
  sourceBase: sealed.sourceBase, sourceScannerSha256: sealed.sourceFiles[0].sha256,
  runtimeUseAuthorized: false, ownerDecision: null, actualExceptionsApplied: 0,
  P1: { recommendation: 'Retain 265 historical occurrences as bounded existing debt; exact snapshot projection is debt identity, not approval of access.',
    sourceOccurrences: debt.length, exactIdentities: debtProjection.length, existingBaselineUnchanged: true,
    automaticRegeneration: false, projection: debtProjection },
  P2: { recommendation: 'Default BLOCK for new/changed/unresolved calls; individual exact exceptions only after control approval.',
    newlyObservedOccurrences: 77, unresolvedExpressions: 20, wildcardOrFileException: false,
    consumerLiteralRewrite: false, unknownTargetException: false },
  P3: { recommendation: 'Approve only the seven listed control exceptions; grant no DB/user/business authority.',
    exceptions: candidates.map(row => ({ frozenId: row.frozenId, tuple: tuple(row), maximumStaticOccurrences: 1,
      sourceFileSha256: hash(fs.readFileSync(path.join(repository, row.file))),
      sourceReview: row.reason, proposedDisposition: 'APPROVED_CONTRACT_PATH_IF_OWNER_ACCEPTS', approved: false })) },
  implementationIfApproved: {
    scope: 'Local enforcement only: reuse scanner v2 and the two existing comparisons; no new analyzer.',
    keepLegacy265FileUnchanged: true,
    metadataPathIfApproved: '.github/ci/education-architecture-dispositions.json',
    ownedFiles: ['scripts/ci-run-education-architecture.mjs', 'scripts/test-ci-education-architecture.mjs',
      'src/products/bella-education/__tests__/bella-education-architecture.test.ts', '.github/ci/education-architecture-dispositions.json'],
    metadata: 'One separately approved, typed disposition input attached to the existing Education guard; this document JSON is not active configuration.',
    bothGates: 'Apply the same exact tuple/count disposition before comparisons, retain raw observations and all blocked findings.',
    prohibited: ['Product or UI changes', 'DB/schema/Auth/RLS/grant changes', 'commit/push/merge/deploy', 'automatic current-source baselining'],
  },
  expectedAfterLocalImplementation: { rawResourceOccurrences: 362, boundedHistoricalDebt: 265,
    approvedControlOccurrences: 7, blockedResourceOccurrences: 90, blockedResourceSignatures: full.resourceDecision.added.length,
    blockedKnownNewOccurrences: 70, blockedLegacySignatures: 30, unresolvedBlocked: 20, overall: 'BLOCK — NOT MERGE-READY' },
};
if (debt.length !== 265 || candidates.length !== 7 || debtProjection.length !== 263) throw new Error('Projection size mismatch');
if (hash(fs.readFileSync(baselinePath)) !== hash(baselineBytes)
  || hash(execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repository })) !== trackedBefore) throw new Error('Unexpected active changes');
fs.writeFileSync(path.join(directory, 'f13-policy-proposal.json'), JSON.stringify(proposal, null, 2));
const simulation = { capturedAt: new Date().toISOString(), scope: 'Hypothetical policy in memory only; not a live gate change',
  actualExceptionsApplied: 0, positiveProbes: probes.filter(item => item.expected === 'ALLOW').length,
  negativeProbes: probes.filter(item => item.expected === 'BLOCK').length, failedProbes: 0,
  existingBaselineAndTrackedDiffUnchanged: true, expected: proposal.expectedAfterLocalImplementation,
  probes, legacy: full.legacyDecision, resources: full.resourceDecision };
fs.writeFileSync(path.join(directory, 'f13-policy-simulation.json'), JSON.stringify(simulation, null, 2));
console.log(JSON.stringify({ proposalStatus: proposal.status, actualExceptionsApplied: 0,
  debtOccurrences: 265, debtIdentities: 263, candidates: 7,
  positiveProbes: simulation.positiveProbes, negativeProbes: simulation.negativeProbes, failedProbes: 0,
  expectedAfterApprovalAndImplementation: proposal.expectedAfterLocalImplementation }));
