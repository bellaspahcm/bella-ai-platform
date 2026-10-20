import { hash, validateBinding } from './contract.mjs';

// Pure companion validation. No filesystem, process, network, store or native calls.
export const FACTORY_FORMAT = 'bella-factory-evidence';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const keys = (value, expected) => !!value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const fail = code => { throw new Error(code); };
const safePath = value => typeof value === 'string' && value.length <= 500 && !/[\x00-\x1f\\:]/.test(value) && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..');

export function validateArtifactReference(ref) {
  if (!keys(ref, ['packageId', 'file', 'bytes', 'sha256']) ||
      !/^bella-agent-flow-[A-Za-z0-9]{1,32}$/.test(ref.packageId) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(ref.file) ||
      !Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > 2 * 1024 * 1024 || !digest(ref.sha256)) fail('INVALID_FACTORY_ARTIFACT_REFERENCE');
  return ref;
}

export function resolveArtifact(ref, bytes) {
  validateArtifactReference(ref);
  if (!Buffer.isBuffer(bytes) || bytes.length !== ref.bytes || hash(bytes) !== ref.sha256) fail('FACTORY_ARTIFACT_MISMATCH');
  try { return JSON.parse(bytes.toString('utf8')); } catch { fail('FACTORY_ARTIFACT_INVALID_JSON'); }
}

export function validateIndex(index) {
  if (!keys(index, ['format', 'schemaVersion', 'repository', 'taskId', 'factoryRunId', 'provenance', 'intake', 'stages', 'terminal', 'candidate', 'commit']) ||
      index.format !== FACTORY_FORMAT || index.schemaVersion !== 1 || index.repository !== 'bellaspahcm/bella-ai-platform' ||
      !uuid(index.taskId) || !uuid(index.factoryRunId) || index.taskId === index.factoryRunId) fail('INVALID_FACTORY_INDEX');
  const p = index.provenance;
  if (!keys(p, ['auditedMainRevision', 'constitutionCandidateRevision', 'rules']) || !revision(p.auditedMainRevision) || !revision(p.constitutionCandidateRevision) ||
      !Array.isArray(p.rules) || !p.rules.length || p.rules.length > 30) fail('INVALID_FACTORY_PROVENANCE');
  const paths = new Set();
  for (const rule of p.rules) {
    if (!keys(rule, ['path', 'revision', 'sha256', 'sections', 'reason']) || !safePath(rule.path) || !revision(rule.revision) || !digest(rule.sha256) ||
        !text(rule.reason) || !Array.isArray(rule.sections) || !rule.sections.length || rule.sections.some(section => !text(section)) ||
        new Set(rule.sections).size !== rule.sections.length || paths.has(rule.path)) fail('INVALID_FACTORY_RULE_REFERENCE');
    paths.add(rule.path);
  }
  validateArtifactReference(index.intake);
  if (!Array.isArray(index.stages) || index.stages.length > 20) fail('INVALID_FACTORY_STAGE');
  const activities = { LEAD: ['PLAN'], BUILDER: ['CODE_CHANGE'], VERIFY: ['TEST_EXECUTION', 'READBACK_ONLY'], REVIEWER: ['INDEPENDENT_REVIEW'] };
  const receipts = new Set();
  for (const stage of index.stages) {
    if (!keys(stage, ['role', 'activity', 'receipt', 'sourcePointer']) || !activities[stage.role]?.includes(stage.activity) || !/^(?:|\/(?:receipts|results)\/\d{1,3})$/.test(stage.sourcePointer)) fail('INVALID_FACTORY_STAGE');
    validateArtifactReference(stage.receipt);
    const key = `${stage.receipt.packageId}/${stage.receipt.file}#${stage.sourcePointer}`;
    if (receipts.has(key)) fail('DUPLICATE_FACTORY_STAGE_REFERENCE');
    receipts.add(key);
  }
  for (const field of ['terminal', 'candidate', 'commit']) if (index[field] !== null) validateArtifactReference(index[field]);
  return index;
}

export function resolveStageArtifact(stage, bytes) {
  const document = resolveArtifact(stage.receipt, bytes);
  if (stage.sourcePointer === '') return document;
  const match = /^\/(receipts|results)\/(\d{1,3})$/.exec(stage.sourcePointer);
  if (!match || !Array.isArray(document?.[match[1]]) || !Object.hasOwn(document[match[1]], Number(match[2]))) fail('MISSING_FACTORY_STAGE_SOURCE');
  return document[match[1]][Number(match[2])];
}

export function verifyNativeStageBinding(index, binding) {
  validateIndex(index); validateBinding(binding);
  if (binding.repository !== index.repository || binding.taskId !== index.taskId || binding.runId === index.factoryRunId) fail('FACTORY_NATIVE_BINDING_MISMATCH');
  return binding;
}

function manifestMap(entries) {
  if (!Array.isArray(entries)) fail('INVALID_FACTORY_SOURCE_MANIFEST');
  const result = new Map();
  for (const entry of entries) {
    if (!keys(entry, ['path', 'mode', 'sha256']) || !safePath(entry.path) || !['100644', '100755'].includes(entry.mode) || !digest(entry.sha256) || result.has(entry.path)) fail('INVALID_FACTORY_SOURCE_MANIFEST');
    result.set(entry.path, entry);
  }
  return result;
}

// Inputs must be independently captured candidate and commit-tree bytes.
// Equality is a content observation, not proof those inputs came from Git/tests.
export function compareCandidateTree(candidateEntries, commitEntries) {
  const candidate = manifestMap(candidateEntries), commit = manifestMap(commitEntries);
  const mismatches = [...new Set([...candidate.keys(), ...commit.keys()])].sort().filter(path => {
    const a = candidate.get(path), b = commit.get(path);
    return !a || !b || a.mode !== b.mode || a.sha256 !== b.sha256;
  });
  return { matches: mismatches.length === 0, mismatches };
}

export function validateCandidate(candidate) {
  if (!keys(candidate,['representation','baseRevision','sourceFingerprint','files','coreAutocrlf']) || candidate.representation!=='git-clean-filtered-blob-v1' || !revision(candidate.baseRevision) || !digest(candidate.sourceFingerprint) || !(candidate.coreAutocrlf===null || ['true','false','input'].includes(candidate.coreAutocrlf)) || !Array.isArray(candidate.files) || !candidate.files.length) fail('INVALID_FACTORY_CANDIDATE');
  const seen=new Set();
  for (const f of candidate.files) {
    if (!safePath(f.path) || seen.has(f.path) || typeof f.present!=='boolean') fail('INVALID_FACTORY_CANDIDATE');
    seen.add(f.path);
    if (f.present) {
      if (!keys(f,['path','present','mode','worktreeSha256','blobOid','canonicalSha256','attributes']) || !['100644','100755'].includes(f.mode) || !digest(f.worktreeSha256) || !revision(f.blobOid) || !digest(f.canonicalSha256) || typeof f.attributes!=='string' || !f.attributes.length) fail('INVALID_FACTORY_CANDIDATE');
    } else if (!keys(f,['path','present','mode','worktreeSha256','blobOid','canonicalSha256']) || [f.mode,f.worktreeSha256,f.blobOid,f.canonicalSha256].some(v=>v!==null)) fail('INVALID_FACTORY_CANDIDATE');
  }
  return candidate;
}

export function verifyCandidateInventory(candidate,intake,terminal) {
  validateCandidate(candidate);
  const before=manifestMap(intake.before.files);
  if (hash(JSON.stringify({head:intake.before.head,files:intake.before.files}))!==intake.before.fingerprint || candidate.baseRevision!==intake.before.head || candidate.sourceFingerprint!==terminal.candidate) fail('CANDIDATE_BASE_MISMATCH');
  for (const f of candidate.files) {
    if (!intake.task.ownedFiles.includes(f.path)) fail('CANDIDATE_SCOPE_MISMATCH');
    const old=before.get(f.path);
    if (!f.present) { if (!old) fail('CANDIDATE_NO_CHANGE'); before.delete(f.path); }
    else {
      if (old?.sha256===f.worktreeSha256 && old?.mode===f.mode) fail('CANDIDATE_NO_CHANGE');
      before.set(f.path,{path:f.path,mode:f.mode,sha256:f.worktreeSha256});
    }
  }
  const files=[...before.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(hash(JSON.stringify({head:candidate.baseRevision,files}))!==candidate.sourceFingerprint) fail('CANDIDATE_MANIFEST_MISMATCH');
  return true;
}

export function validateReadback(value,terminal) {
  if(value?.status!=='PASS' || value.source!=='fresh_process_native_history_and_store' || value.taskId!==terminal.taskId || value.candidate!==terminal.candidate || value.revisions!==terminal.revisions || !Array.isArray(value.checks) || value.checks.length!==terminal.receipts.length || !Number.isSafeInteger(value.readerPid) || value.readerPid===value.writerPid) fail('READBACK_MISMATCH');
  value.checks.forEach((check,i)=>{
    const r=terminal.receipts[i];
    if(check.role!==r.role || check.revision!==r.revision || JSON.stringify(check.binding)!==JSON.stringify(r.binding) || check.artifactHash!==r.artifactHash || check.payload!=='MATCH' || check.liveFacts!==r.proof?.liveFacts || check.historyMatches!==r.proof?.historyMatches || check.changes!==r.proof?.changes) fail('READBACK_MISMATCH');
  });
  return true;
}

export function validateIndexIdentity(initial,later) {
  validateIndex(initial);validateIndex(later);
  for(const key of ['repository','taskId','factoryRunId','provenance','intake']) if(JSON.stringify(initial[key])!==JSON.stringify(later[key])) fail('FACTORY_IMMUTABLE_IDENTITY_MISMATCH');
  return true;
}
