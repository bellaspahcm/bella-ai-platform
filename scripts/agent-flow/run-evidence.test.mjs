import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hash } from './contract.mjs';
import { validateIndex, validateArtifactReference, resolveArtifact, resolveStageArtifact, verifyNativeStageBinding, compareCandidateTree } from './run-evidence.mjs';

// Protocol fixtures only: never native runtime evidence.
const ref = () => ({ packageId: 'bella-agent-flow-Protocol', file: 'intake.json', bytes: 2, sha256: hash('{}') });
const index = () => ({ format: 'bella-factory-evidence', schemaVersion: 1, repository: 'bellaspahcm/bella-ai-platform', taskId: randomUUID(), factoryRunId: randomUUID(),
  provenance: { auditedMainRevision: '5ad15661f2dc2603881d50abdef17bcd7bc5fb20', constitutionCandidateRevision: '36a57668f5aba61da10d7c555dde2e6d01518a5b',
    rules: [{ path: 'docs/governance/BELLA_AI_CODING_CONSTITUTION.md', revision: '5ad15661f2dc2603881d50abdef17bcd7bc5fb20', sha256: 'a'.repeat(64), sections: ['Evidence Before Closure'], reason: 'Bind evidence to the actual scoped execution.' }] },
  intake: ref(), stages: [], terminal: null, candidate: null, commit: null });

test('distinct workflow and native IDs; explicit incomplete references do not invent completion', () => {
  const value = index(); assert.strictEqual(validateIndex(value), value);
  assert.equal(value.terminal, null); assert.equal(value.commit, null);
  assert.equal(Object.hasOwn(value, 'status'), false);
  for (const edit of [{ factoryRunId: value.taskId }, { status: 'PASS' }, { factoryRunId: undefined }, { commit: undefined }]) assert.throws(() => validateIndex({ ...value, ...edit }));
});

test('audited main and unmerged constitution provenance cannot be omitted or replaced by defaults', () => {
  for (const edit of [{ auditedMainRevision: null }, { constitutionCandidateRevision: undefined }, { rules: [] }, { activeOnMain: true }]) {
    const value = index(); Object.assign(value.provenance, edit); assert.throws(() => validateIndex(value));
  }
  const value = index(); value.provenance.rules[0].path = '../other'; assert.throws(() => validateIndex(value));
});

test('VERIFY test execution and readback remain distinct; wrong role/activity and duplicate references rejected', () => {
  for (const activity of ['TEST_EXECUTION', 'READBACK_ONLY']) {
    const value = index(); value.stages = [{ role: 'VERIFY', activity, receipt: ref(), sourcePointer: '' }]; assert.ok(validateIndex(value));
    value.stages[0].role = 'REVIEWER'; assert.throws(() => validateIndex(value));
  }
  const value = index(); value.stages = [{ role: 'LEAD', activity: 'PLAN', receipt: ref(), sourcePointer: '' }, { role: 'BUILDER', activity: 'CODE_CHANGE', receipt: ref(), sourcePointer: '' }];
  assert.throws(() => validateIndex(value), /DUPLICATE_FACTORY_STAGE_REFERENCE/);
});

test('artifact paths cannot escape their package and size/hash checked before JSON parsing', () => {
  assert.deepEqual(resolveArtifact(ref(), Buffer.from('{}')), {});
  for (const edit of [{ packageId: '../private' }, { file: '../facts.json' }, { file: 'C:secret' }, { file: 'a/b' }, { bytes: 0 }, { bytes: 2 ** 22 }, { sha256: 'label' }]) assert.throws(() => validateArtifactReference({ ...ref(), ...edit }));
  assert.throws(() => resolveArtifact(ref(), Buffer.from('[]')), /FACTORY_ARTIFACT_MISMATCH/);
  assert.throws(() => resolveArtifact(ref(), '{}'), /FACTORY_ARTIFACT_MISMATCH/);
  assert.throws(() => resolveArtifact({ ...ref(), sha256: hash('xx') }, Buffer.from('xx')), /FACTORY_ARTIFACT_INVALID_JSON/);
});

test('candidate–commit comparison checks additions, deletions, bytes and executable mode, not SHA labels', () => {
  const a = { path: 'scripts/agent-flow/task-workflow.mjs', mode: '100644', sha256: 'a'.repeat(64) };
  assert.deepEqual(compareCandidateTree([a], [{ ...a }]), { matches: true, mismatches: [] });
  for (const commit of [[], [{ ...a, sha256: 'b'.repeat(64) }], [{ ...a, mode: '100755' }], [a, { ...a, path: 'extra.mjs' }]]) assert.equal(compareCandidateTree([a], commit).matches, false);
  for (const entries of [[a, a], [{ ...a, path: '../outside' }], [{ ...a, mode: '120000' }], [{ ...a, sha256: 'commit-sha-label' }]]) assert.throws(() => compareCandidateTree(entries, [a]));
});

test('shared source document requires distinct explicit pointers, never manufactured stage defaults',()=>{
  const value=index(), bytes=Buffer.from(JSON.stringify({results:[{phase:'BUILD'},{phase:'VERIFY',execution:'READ_BACK'}]}));
  const receipt={...ref(),bytes:bytes.length,sha256:hash(bytes)};
  value.stages=[{role:'BUILDER',activity:'CODE_CHANGE',receipt,sourcePointer:'/results/0'},{role:'VERIFY',activity:'READBACK_ONLY',receipt,sourcePointer:'/results/1'}];
  assert.ok(validateIndex(value));assert.equal(resolveStageArtifact(value.stages[1],bytes).execution,'READ_BACK');
  assert.throws(()=>resolveStageArtifact({...value.stages[1],sourcePointer:'/results/2'},bytes),/MISSING_FACTORY_STAGE_SOURCE/);
  const binding={repository:value.repository,taskId:value.taskId,runId:randomUUID(),attempt:1,producerInstanceId:randomUUID(),threadId:randomUUID(),sessionId:null,turnId:randomUUID()};
  assert.ok(verifyNativeStageBinding(value,binding));assert.throws(()=>verifyNativeStageBinding(value,{...binding,taskId:randomUUID()}),/FACTORY_NATIVE_BINDING_MISMATCH/);
});
