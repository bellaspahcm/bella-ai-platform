import { readFile, readdir, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from './contract.mjs';
import { writeDurableJson, validateStorePath } from './store.mjs';
import { validateIndex, validateCandidate, verifyCandidateInventory, validateReadback, validateIndexIdentity } from './run-evidence.mjs';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Collection-side publication only. The Monitor never imports this module.
const git = (cwd, args, options = {}) => execFileSync('git', args, { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options });
export function readAutocrlf(workspace) {
  try { return git(workspace,['config','--get','core.autocrlf'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
  catch(error) { if(error.status===1) return null; throw error; }
}
export async function artifactReference(directory, file) {
  const bytes = await readFile(join(directory, file));
  return { packageId: basename(directory), file, bytes: bytes.length, sha256: hash(bytes) };
}
export async function initializeFactory(directory, workspace, before) {
  if (git(workspace, ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim()) throw new Error('FACTORY_CLEAN_SOURCE_REQUIRED');
  const rules = [];
  for (const [path, sections, reason] of [
    ['AGENTS.md', ['Mandatory architectural control'], 'Preserve the approved tooling and protected-layer scope.'],
    ['docs/governance/BELLA_AI_CODING_CONSTITUTION.md', ['Business Semantic Gate', 'Change Authority', 'Evidence Before Closure'], 'Apply scoped execution and distinguish test/proof/release outcomes.'],
    ['scripts/agent-flow/FACTORY_EVIDENCE_CONTRACT.md', ['Identity and sources', 'Candidate and commit'], 'Bind this workflow to original artifacts and verified source content.'],
  ]) rules.push({ path, revision: before.head, sha256: hash(await readFile(join(workspace, path))), sections, reason });
  const intake = JSON.parse(await readFile(join(directory, 'intake.json'), 'utf8'));
  const index = { format: 'bella-factory-evidence', schemaVersion: 1, repository: 'bellaspahcm/bella-ai-platform', taskId: intake.task.taskId, factoryRunId: randomUUID(),
    provenance: { auditedMainRevision: '5ad15661f2dc2603881d50abdef17bcd7bc5fb20', constitutionCandidateRevision: '36a57668f5aba61da10d7c555dde2e6d01518a5b', rules },
    intake: await artifactReference(directory, 'intake.json'), stages: [], terminal: null, candidate: null, commit: null };
  validateIndex(index);
  await writeDurableJson(join(directory, 'factory-index-intake.json'), index);
  return index;
}

export async function finishFactory(directory, workspace, index, terminal, after) {
  const original = JSON.parse(await readFile(join(directory, 'intake.json'), 'utf8'));
  const stages = [];
  const activities = { LEAD: 'PLAN', BUILDER: 'CODE_CHANGE', VERIFY: 'TEST_EXECUTION', REVIEWER: 'INDEPENDENT_REVIEW' };
  for (const r of terminal.receipts) stages.push({ role: r.role, activity: activities[r.role], receipt: await artifactReference(r.directory, 'role.json'), sourcePointer: '' });
  let candidate = null;
  if (terminal.status === 'PASS') {
    if (after.fingerprint !== terminal.candidate) throw new Error('FACTORY_CANDIDATE_CHANGED');
    const before = new Map(original.before.files.map(f => [f.path, f]));
    const current = new Map(after.files.map(f => [f.path, f]));
    const paths = [...new Set([...before.keys(), ...current.keys()])].filter(p => before.get(p)?.sha256 !== current.get(p)?.sha256 || before.get(p)?.mode !== current.get(p)?.mode).sort();
    if (!paths.length || paths.some(p => !original.task.ownedFiles.includes(p))) throw new Error('FACTORY_CANDIDATE_SCOPE');
    const files = [];
    for (const path of paths) {
      if (!current.has(path)) { files.push({ path, present: false, mode: null, worktreeSha256: null, blobOid: null, canonicalSha256: null }); continue; }
      const bytes = await readFile(join(workspace, path));
      if (hash(bytes) !== current.get(path).sha256) throw new Error('FACTORY_CANDIDATE_CHANGED');
      // Git applies the repository's actual clean/eol policy to verified bytes.
      // Save the resulting blob, not a label supplied by the task or agent.
      const blobOid = git(workspace, ['hash-object', '-w', `--path=${path}`, '--stdin'], { input: bytes, encoding: 'utf8' }).trim();
      const canonical = git(workspace, ['cat-file', 'blob', blobOid]);
      const mode = current.get(path).mode;
      if (!['100644', '100755'].includes(mode)) throw new Error('FACTORY_SOURCE_MODE_REQUIRED');
      files.push({ path, present: true, mode, worktreeSha256: hash(bytes), blobOid, canonicalSha256: hash(canonical),
        attributes: git(workspace, ['check-attr', 'text', 'eol', 'filter', '--', path], { encoding: 'utf8' }).trim() });
    }
    const manifest = { representation: 'git-clean-filtered-blob-v1', baseRevision: original.before.head, sourceFingerprint: after.fingerprint, files,
      coreAutocrlf: readAutocrlf(workspace) };
    verifyCandidateInventory(manifest,original,terminal);
    await writeDurableJson(join(directory,'candidate.json'),manifest);
    candidate = await artifactReference(directory, 'candidate.json');
  }
  const completed = { ...index, stages, terminal: await artifactReference(directory, 'terminal.json'), candidate };
  validateIndex(completed);
  await writeDurableJson(join(directory, 'factory-index-terminal.json'), completed);
  return completed;
}

export async function verifyCommitCandidate(workspace, candidate, commit) {
  validateCandidate(candidate);
  if (!/^[a-f0-9]{40}$/.test(commit || '') || !/^[a-f0-9]{40}$/.test(candidate?.baseRevision || '')) throw new Error('FACTORY_COMMIT_REQUIRED');
  if (git(workspace, ['rev-parse', `${commit}^`], { encoding: 'utf8' }).trim() !== candidate.baseRevision) throw new Error('FACTORY_COMMIT_PARENT_MISMATCH');
  const paths = git(workspace, ['diff-tree', '--no-commit-id', '--name-only', '-r', candidate.baseRevision, commit], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).sort();
  if (JSON.stringify(paths) !== JSON.stringify(candidate.files.map(f => f.path).sort())) throw new Error('FACTORY_COMMIT_SCOPE_MISMATCH');
  for (const file of candidate.files) {
    const entry = git(workspace, ['ls-tree', commit, '--', file.path], { encoding: 'utf8' }).trim();
    if (!file.present) { if (entry) throw new Error('FACTORY_COMMIT_CONTENT_MISMATCH'); try { await lstat(join(workspace,file.path));throw new Error('FACTORY_POST_REVIEW_DRIFT'); } catch(error) { if(error.code!=='ENOENT')throw error; } continue; }
    const [mode, type, oid] = entry.split(/\s+/);
    if (type !== 'blob' || mode !== file.mode || oid !== file.blobOid || hash(git(workspace, ['cat-file', 'blob', oid])) !== file.canonicalSha256) throw new Error('FACTORY_COMMIT_CONTENT_MISMATCH');
    if (hash(await readFile(join(workspace, file.path))) !== file.worktreeSha256) throw new Error('FACTORY_POST_REVIEW_DRIFT');
  }
  return { comparison: 'PARENT_FULL_TREE_PLUS_EXACT_CHANGED_PATHS_MODES_AND_BLOB_BYTES', matches: true };
}

export async function linkFactoryCommit(input, commit) {
  await authorizeRepository(REPOSITORY);
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('FACTORY_COMMIT_REQUIRED');
  const directory = validateStorePath(input);
  const context = JSON.parse(await readFile(join(directory,'context.json'),'utf8'));
  if (!Number.isFinite(Date.parse(context.outputReviewDeadline)) || Date.now() >= Date.parse(context.outputReviewDeadline)) throw new Error('FACTORY_REVIEW_WINDOW_EXPIRED');
  const index = JSON.parse(await readFile(join(directory, 'factory-index-terminal.json'), 'utf8')); validateIndex(index);
  validateIndexIdentity(JSON.parse(await readFile(join(directory,'factory-index-intake.json'),'utf8')),index);
  const { resolveArtifact } = await import('./run-evidence.mjs');
  const candidate = resolveArtifact(index.candidate, await readFile(join(directory, index.candidate.file)));
  const intake = resolveArtifact(index.intake, await readFile(join(directory, index.intake.file)));
  const terminal = resolveArtifact(index.terminal, await readFile(join(directory, index.terminal.file)));
  if (terminal.status !== 'PASS' || candidate.sourceFingerprint !== terminal.candidate) throw new Error('FACTORY_VERIFIED_CANDIDATE_REQUIRED');
  verifyCandidateInventory(candidate,intake,terminal);
  const workspace = intake.workspace;
  if (resolve(workspace) !== resolve(fileURLToPath(new URL('../..',import.meta.url)))) throw new Error('FACTORY_REPOSITORY_MISMATCH');
  const comparison = await verifyCommitCandidate(workspace,candidate,commit);
  const {inventory}=await import('./role-pipeline.mjs'); const current=await inventory(workspace);
  if(current.head!==commit || hash(JSON.stringify({head:candidate.baseRevision,files:current.files}))!==candidate.sourceFingerprint)throw new Error('FACTORY_POST_REVIEW_DRIFT');
  const readers = (await readdir(directory)).filter(f => /^readback-\d+\.json$/.test(f));
  let nativeReadback = null;
  for (const file of readers) {
    const value = JSON.parse(await readFile(join(directory, file), 'utf8'));
    try { validateReadback(value,terminal); nativeReadback = await artifactReference(directory,file); } catch { /* An invalid readback is never a completion proof. */ }
  }
  if (!nativeReadback) throw new Error('FACTORY_FRESH_NATIVE_READBACK_REQUIRED');
  const proof = { taskId: index.taskId, factoryRunId: index.factoryRunId, commit, baseRevision: candidate.baseRevision, candidate: index.candidate, sourceFingerprint: candidate.sourceFingerprint, nativeReadback,
    ...comparison };
  await writeDurableJson(join(directory, 'commit-link.json'), proof);
  const linked = { ...index, commit: await artifactReference(directory, 'commit-link.json') };
  await writeDurableJson(join(directory, 'factory-index-commit.json'), linked);
  return { status: 'PASS_CANDIDATE_COMMIT_CONTENT', taskId: index.taskId, factoryRunId: index.factoryRunId, commit, directory };
}
