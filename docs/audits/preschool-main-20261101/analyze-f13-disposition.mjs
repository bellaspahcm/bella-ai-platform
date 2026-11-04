// Audit-only analysis of sealed scanner output. Never imported by the guard.
// Simulated resource entries exist only in memory; no baseline/source changes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareBaseline, compareResourceAccesses, resourceAccessSignature } from '../../../scripts/ci-run-education-architecture.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, ''));
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceSeal = read('f13-scanner-seal.json');
for (const item of sourceSeal.sourceFiles) {
  if (hash(fs.readFileSync(path.join(repository, item.file))) !== item.sha256) throw new Error(`Source drift: ${item.file}`);
}
for (const item of sourceSeal.artifacts) {
  if (hash(fs.readFileSync(path.join(directory, item.file))) !== item.sha256) throw new Error(`Evidence drift: ${item.file}`);
}
const baselineFile = path.join(repository, '.github/ci/education-architecture-baselines.json');
const baselineBefore = hash(fs.readFileSync(baselineFile));
const trackedDiffBefore = hash(execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repository }));
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).directDatabaseAccess.violations;
const main = read('f13-resource-v2-main.json');
const technical = read('f13-resource-v2-technical.json');
const review = read('f13-enforcement-review.json');
const frozen = read('f13-ownership-inventory.json');
const jest = read('f13-resource-v2-jest.json');

const relevant = access => access.method === 'rpc' || !access.target
  || /^(edu_|students$|assessment_|attendance_|journal_)/.test(access.target);
const counts = accesses => {
  const result = {};
  for (const access of accesses.filter(relevant)) {
    const key = resourceAccessSignature(access);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort());
};
if (JSON.stringify(counts(main.resourceInventory)) !== JSON.stringify(counts(technical.resourceInventory))) {
  throw new Error('Main and technical resource identities differ; review required');
}
const accesses = main.resourceInventory.filter(relevant);
const rows = accesses.map((access, index) => {
  const occurrence = frozen.matches.find(item => item.sourceFile === access.file && item.line === access.line
    && item.target === access.target && (item.kind === 'rpc' ? 'rpc' : 'from') === access.method);
  const disposition = occurrence ? review.matches.find(item => item.id === occurrence.id) : null;
  const unresolved = !access.target || !access.operation || !access.caller || !access.schema;
  if (!unresolved && !occurrence && !access.file.startsWith('src/products/bella-education/')) {
    throw new Error(`Literal expanded-scope call not in frozen inventory: ${access.file}:${access.line}`);
  }
  return { index: index + 1, ...access, signature: resourceAccessSignature(access),
    frozenId: occurrence?.id ?? null, groupId: occurrence?.groupId ?? null,
    bucket: unresolved ? 'UNRESOLVED_EXPRESSION' : occurrence ? 'FROZEN_77' : 'HISTORICAL_265',
    blockedBy: occurrence ? ['legacy-direct-db', 'exact-resource'] : ['exact-resource'],
    disposition: disposition?.decision ?? (unresolved ? 'HELD_UNRESOLVED_NO_EXCEPTION' : 'HISTORICAL_DEBT_NOT_REVIEWED_AS_EXACT'),
    reason: disposition?.reason ?? (unresolved ? 'No full literal target; a named expression is not an exact exception.' : 'Legacy debt is not new exact-resource approval; no re-audit or automatic mapping authorized.'),
    exceptionApplied: false };
});
const buckets = {};
for (const row of rows) buckets[row.bucket] = (buckets[row.bucket] ?? 0) + 1;
if (rows.length !== 362 || buckets.FROZEN_77 !== 77 || buckets.HISTORICAL_265 !== 265 || buckets.UNRESOLVED_EXPRESSION !== 20) {
  throw new Error('Unexpected gate inventory totals');
}

const candidateIds = ['M066', 'M067', 'M068', 'M069', 'M070', 'M071', 'M004'];
const candidates = candidateIds.map(id => {
  const row = rows.find(item => item.frozenId === id);
  if (!row) throw new Error(`Missing candidate ${id}`);
  return row;
});
const simulated = { ...baseline };
for (const row of candidates) simulated[row.signature] = 1;
const probes = [];
const check = (name, input, expected) => {
  const actual = compareResourceAccesses(simulated, input).status;
  probes.push({ name, expected, actual });
  if (actual !== expected) throw new Error(`Narrowness probe failed: ${name}`);
};
for (const row of candidates) {
  check(`${row.frozenId}: exact tuple once`, [row], 'ALLOW');
  const substitutions = [
    ['different file', { file: 'src/app/api/education/unapproved/route.ts' }],
    ['different caller', { caller: 'unapprovedHandler' }],
    ['Education target', { target: 'edu_courses' }],
    ['different schema', { schema: 'unapproved_schema' }],
    ['unknown target', { target: null }],
    ['unknown operation', { operation: null }],
    ['unknown schema', { schema: null }],
  ];
  if (row.method === 'from') substitutions.push(
    ['read/write change', { operation: row.operation === 'select' ? 'update' : 'select' }],
    ['SQL to RPC change', { method: 'rpc', operation: 'execute' }]);
  for (const [name, changes] of substitutions) check(`${row.frozenId}: ${name}`, [{ ...row, ...changes }], 'BLOCK');
  check(`${row.frozenId}: extra occurrence`, [row, row], 'BLOCK');
}
for (const row of rows.filter(item => item.disposition === 'BLOCK_EDUCATION_BOUNDARY')) {
  check(`${row.frozenId}: Education boundary still denied`, [row], 'BLOCK');
}
for (const row of rows.filter(item => item.bucket === 'UNRESOLVED_EXPRESSION')) {
  check(`unresolved ${row.index}: still denied`, [row], 'BLOCK');
}
const actualLegacy = compareBaseline(baseline, technical.violations.directDatabaseAccess);
const simulatedResources = compareResourceAccesses(simulated, technical.resourceInventory);
if (actualLegacy.status !== 'BLOCK' || simulatedResources.status !== 'BLOCK') throw new Error('Unexpected whole-source allowance');
const groups = [...new Set(frozen.matches.map(item => item.groupId))].sort().map(groupId => {
  const items = rows.filter(row => row.groupId === groupId);
  return { groupId, sourceFile: items[0].file, occurrences: items.length,
    ids: items.map(item => item.frozenId), callers: [...new Set(items.map(item => item.caller))],
    resources: [...new Set(items.map(item => `${item.method}/${item.operation}:${item.target}`))],
    dispositions: [...new Set(items.map(item => item.disposition))] };
});
if (groups.length !== 33) throw new Error('Unexpected legacy group count');
if (baselineBefore !== hash(fs.readFileSync(baselineFile))
  || trackedDiffBefore !== hash(execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repository }))) {
  throw new Error('Analysis mutated source or baseline');
}
const result = {
  capturedAt: new Date().toISOString(), sourceBase: sourceSeal.sourceBase,
  scope: 'Read-only enforcement disposition; no runtime or baseline implementation',
  sourceAndSealedEvidenceHashesUnchanged: true, baselineUnchanged: true, trackedDiffUnchanged: true,
  actualExceptionsApplied: 0, frozenInventory: { occurrences: 77, signatures: 33 },
  failedAssertions: jest.testResults.flatMap(suite => suite.assertionResults.filter(item => item.status === 'failed').map(item => item.title)),
  actualGates: { legacy: actualLegacy, resources: technical.resourceComparison },
  buckets, groups, candidates,
  simulationOnly: { assumedExactEntriesInMemory: 7, positiveProbes: probes.filter(item => item.expected === 'ALLOW').length,
    negativeProbes: probes.filter(item => item.expected === 'BLOCK').length, failedProbes: 0,
    legacyStillBlockedOccurrences: actualLegacy.added.reduce((sum, item) => sum + item.delta, 0),
    resourcesStillBlockedOccurrences: simulatedResources.added.reduce((sum, item) => sum + item.delta, 0),
    resourceSignaturesStillBlocked: simulatedResources.added.length, unresolvedStillBlocked: simulatedResources.unresolved.length,
    wholeSourceStatus: 'BLOCK', probes },
  rows,
};
fs.writeFileSync(path.join(directory, 'f13-gate-disposition.json'), JSON.stringify(result, null, 2));
const groupRows = groups.map(item => `| ${item.groupId} | ${item.sourceFile} | ${item.occurrences} | ${item.ids.join(', ')} | ${item.resources.join('; ')} |`);
fs.writeFileSync(path.join(directory, 'F13_GATE_CALLERS.md'), [
  '# F13 — exact callers blocked by the two assertions', '',
  `Pinned main ${sourceSeal.sourceBase}; technical resource identities/counts are equal. No exception approved/applied.`, '',
  'The legacy assertion blocks the 77 occurrences below, grouped into its 33 signatures. The exact-resource assertion blocks these same 77 plus 265 historical Product calls and 20 unresolved expressions. All 362 locations, caller scopes, identities and dispositions are in f13-gate-disposition.json; these are not 362 new vulnerabilities.', '',
  '| Legacy group | Pinned caller file | Occurrences | Frozen IDs | Exact resources / operations |',
  '| --- | --- | ---: | --- | --- |', ...groupRows, '',
].join('\n'));
console.log(JSON.stringify({ buckets, groups: groups.length, actualExceptionsApplied: 0,
  simulationOnly: { positive: result.simulationOnly.positiveProbes, negative: result.simulationOnly.negativeProbes,
    failed: 0, exactRemainingOccurrences: result.simulationOnly.resourcesStillBlockedOccurrences,
    legacyRemainingOccurrences: result.simulationOnly.legacyStillBlockedOccurrences, status: 'BLOCK' } }));
