import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DAY_MS, validateBinding, validateFact, logicalKey, signature, reconcile, verifyFileChangeRecords } from '../agent-flow/contract.mjs';
import { readFactory } from './factory-reader.mjs';
import { readHistorical } from './historical-reader.mjs';

export const hash = data => createHash('sha256').update(data).digest('hex');
const packagePattern = /^bella-agent-flow-[A-Za-z0-9]{1,32}$/;
const states = new Set(['inProgress', 'completed', 'failed', 'interrupted', 'declined', 'idle', 'active', 'running', 'notLoaded', 'systemError']);
const types = new Set(['commandExecution', 'agentMessage', 'fileChange']);
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const counters = value => {
  const result = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => {
    if (!Number.isSafeInteger(value?.[key]) || value[key] < 0) throw new Error('COUNTERS_INVALID');
    return [key, value[key]];
  }));
  if (result.tests !== result.pass + result.fail + result.cancelled + result.skipped + result.todo) throw new Error('COUNTERS_INVALID');
  return result;
};
const claim = value => value === 'PASS' ? 'PASS (retained review)' : 'NOT_PROVEN';
const keys = ['repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'threadId', 'sessionId', 'turnId'];
const sameBinding = (a, b) => keys.every(key => a?.[key] === b?.[key]);

// Every component is checked. No artifacts are executed, imported, served or modified.
export async function safeRead(root, relative, budget = { bytes: 0 }) {
  if (typeof relative !== 'string' || relative.length > 250 || relative.includes('\\') || relative.includes(':') || relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('PATH_DENIED');
  let current = path.resolve(root);
  if ((await lstat(current)).isSymbolicLink()) throw new Error('SYMLINK_DENIED');
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('SYMLINK_DENIED');
  }
  const stat = await lstat(current);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('SIZE_DENIED');
  budget.bytes += stat.size;
  if (budget.bytes > 16 * 1024 * 1024) throw new Error('SIZE_DENIED');
  const resolved = await realpath(current);
  const base = await realpath(root);
  if (!resolved.startsWith(base + path.sep)) throw new Error('PATH_DENIED');
  const data = await readFile(current);
  if (data.length !== stat.size) throw new Error('FILE_CHANGED');
  return data;
}

const sameSource = (a, b) => ['revision', 'inventoryHash', 'launcherSha256'].every(key => a?.[key] === b?.[key]) && /^[a-f0-9]{40}$/.test(a?.revision || '') && ['inventoryHash', 'launcherSha256'].every(key => /^[a-f0-9]{64}$/.test(a?.[key] || ''));
const phase = value => {
  if (!id(value?.itemId) || !Number.isSafeInteger(value.exitCode) || !/^[a-f0-9]{64}$/.test(value.commandHash || '')) throw Error('TEST_INVALID');
  return { itemId: value.itemId, exitCode: value.exitCode, commandHash: value.commandHash, counters: counters(value.counters) };
};
const samePhase = (a, b) => JSON.stringify(phase(a)) === JSON.stringify(phase(b));
function compareReconciliation(expected, saved) {
  if (!Array.isArray(saved) || saved.length !== expected.length) throw Error('RECONCILIATION_INVALID');
  const seen = new Set();
  for (const row of saved) {
    if (seen.has(row.itemId) || (row.result ?? row.status) !== 'MATCH' || (row.result && row.status && row.result !== row.status) || !expected.some(entry => entry.itemId === row.itemId && entry.result === 'MATCH')) throw Error('RECONCILIATION_INVALID');
    seen.add(row.itemId);
  }
}

export async function readPackage(root, packageId, now = Date.now()) {
  if (packagePattern.test(packageId)) {
    try { await lstat(path.join(root, packageId, 'factory-index-intake.json')); return readFactory(root, packageId, now); }
    catch (error) { if (error.code !== 'ENOENT') return { id: packageId, state: 'CORRUPT' }; }
    for (const [file,controller] of [['controller-final-report.json',true],['terminal.json',false]]) {
      try { await lstat(path.join(root,packageId,file)); return readHistorical(root,packageId,now,controller); }
      catch(error){if(error.code!=='ENOENT')return {id:packageId,state:'CORRUPT'};}
    }
  }
  if (!packagePattern.test(packageId)) return { id: 'invalid', state: 'INVALID_ID' };
  const summary = { id: packageId, checkedAt: new Date(now).toISOString() };
  try {
    const budget = { bytes: 0 }, read = relative => safeRead(root, `${packageId}/${relative}`, budget);
    const manifestBytes = await read('manifest.json'), manifest = JSON.parse(manifestBytes);
    const created = Date.parse(manifest.created_at);
    if (!Number.isFinite(created) || created > now || manifest.schema_version !== 1 || !Array.isArray(manifest.artifacts) || !manifest.artifacts.length || manifest.artifacts.length > 100) throw Error('MANIFEST_INVALID');
    const metadata = new Map(), artifacts = new Map();
    for (const entry of manifest.artifacts) {
      if (typeof entry.path !== 'string' || entry.path === 'manifest.json' || metadata.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw Error('MANIFEST_INVALID');
      metadata.set(entry.path, entry);
    }
    const verified = async name => {
      if (artifacts.has(name)) return artifacts.get(name);
      const entry = metadata.get(name); if (!entry) throw Error('ARTIFACT_REQUIRED');
      const bytes = await read(name);
      if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw Error('HASH_MISMATCH');
      artifacts.set(name, bytes); return bytes;
    };
    const document = async name => JSON.parse(await verified(name));
    const seal = await document('seal.json');
    const context = metadata.has('context.json') ? await document('context.json') : null;
    const legacy = seal?.task_code_test_workflow !== undefined;
    const launcher = !legacy && context?.scope === 'configured-agent-launcher-v2' && context.task?.mode === 'bounded-coding' && context.task?.changeRequest === 'counter-integrity';
    if (!legacy && !launcher) return { ...summary, state: 'UNSUPPORTED' };
    const deadlineText = legacy ? manifest.review_deadline : context.outputReviewDeadline;
    const deadline = Date.parse(deadlineText);
    if (!Number.isFinite(deadline) || deadline <= created || deadline > created + 7 * DAY_MS || Date.parse(legacy ? seal.review_deadline : seal.reviewDeadline) !== deadline) throw Error('RETENTION_INVALID');
    if (launcher && (!Number.isFinite(Date.parse(context.createdAt)) || Date.parse(context.createdAt) > created || deadline !== Date.parse(context.createdAt) + 7 * DAY_MS || (manifest.review_deadline !== undefined && Date.parse(manifest.review_deadline) !== deadline))) throw Error('RETENTION_INVALID');
    if (now >= deadline) return { ...summary, state: 'EXPIRED', expiresAt: new Date(deadline).toISOString() };
    for (const name of metadata.keys()) await verified(name);
    const integrity = { state: 'MATCH', artifacts: artifacts.size, manifestSha256: hash(manifestBytes), warning: 'Hashes verify package bytes, not runtime authenticity.' };
    if ((legacy && ['FAIL', 'TIMEOUT'].includes(seal.task_code_test_workflow)) || (launcher && ['FAIL_INDEPENDENT_READBACK', 'FAIL', 'TIMEOUT'].includes(seal.result))) return { ...summary, state: 'FAILED', expiresAt: new Date(deadline).toISOString(), integrity };
    if (legacy ? seal.task_code_test_workflow !== 'PASS' : seal.result !== 'PASS_BOUNDED_CODING_TASK_VIA_LAUNCHER') throw Error('SEAL_RESULT_INVALID');
    const facts = await document('facts.json');
    const result = await document(legacy ? 'task-result.json' : 'writer.json');
    const readerNames = legacy ? [seal.independent_reader_artifact] : [...metadata.keys()].filter(name => /^reader-\d+\.json$/.test(name));
    if (readerNames.length !== 1) throw Error('READER_AMBIGUOUS');
    const reader = await document(readerNames[0]);
    const review = await document(legacy ? seal.independent_red_green_artifact : 'independent-review.json');
    const binding = legacy ? seal.binding : result.binding;
    validateBinding(binding);
    if (binding.repository !== 'bellaspahcm/bella-ai-platform' || keys.filter(key => !['repository', 'attempt'].includes(key)).some(key => !id(binding[key])) || [facts.binding, result.binding, reader.binding].some(value => !sameBinding(binding, value))) throw Error('BINDING_MISMATCH');
    const baseline = legacy ? manifest.baseline : context.source?.revision;
    if (!/^[a-f0-9]{40}$/.test(baseline || '')) throw Error('PROVENANCE_INVALID');
    if (legacy) {
      if (seal.baseline !== baseline || reader.baseline !== baseline || result.baseline !== baseline || reader.outputReviewDeadline !== deadlineText || reader.result !== 'PASS_TASK_INDEPENDENT_READBACK_PENDING_REVIEW' || result.result !== 'TASK_WRITER_PASS_PENDING_REVIEW') throw Error('PROVENANCE_INVALID');
    } else {
      if (seal.taskId !== binding.taskId || context.task.taskId !== binding.taskId || context.task.sourceRevision !== baseline || JSON.stringify(context.task.suites) !== '["task"]' || JSON.stringify(result.task) !== JSON.stringify(context.task) || reader.taskId !== binding.taskId || reader.mode !== 'bounded-coding' || reader.deadline !== deadlineText || seal.sourceRevision !== baseline || (manifest.baseline !== undefined && manifest.baseline !== baseline) || !sameSource(context.source, result.source) || !sameSource(context.source, reader.source) || !sameSource(context.source, seal.sourceBefore) || !sameSource(result.afterSource, reader.afterSource) || !sameSource(result.afterSource, seal.sourceAfter) || result.afterSource.revision !== baseline || result.afterSource.launcherSha256 !== context.source.launcherSha256 || result.result !== 'LAUNCHER_WRITER_PASS' || reader.result !== seal.result || reader.writerStopped !== true || reader.freshNativeHistory !== true || reader.canonicalStoreBytesUnchanged !== true || review.result !== 'PASS_SCOPED_CODE_AND_EVIDENCE_REVIEW' || review.checks?.writerStopped !== true || review.checks.writerPid !== result.writerPid || review.checks.readerPid !== reader.readerPid) throw Error('PROVENANCE_INVALID');
    }
    if (![result.writerPid, reader.writerPid, reader.readerPid].every(value => Number.isSafeInteger(value) && value > 0) || reader.writerPid !== result.writerPid || reader.writerPid === reader.readerPid) throw Error('READER_NOT_INDEPENDENT');
    if (!Array.isArray(facts.records) || !facts.records.length || facts.records.length > 5000) throw Error('FACTS_INVALID');
    const seen = new Map();
    for (const row of facts.records) {
      validateFact(row.fact, binding);
      if (Object.keys(row).sort().join(',') !== 'digest,fact,key,metadataExpiresAt,outputExpiresAt,outputState,revision,storedAt' || row.key !== logicalKey(row.fact) || row.digest !== signature(row.fact) || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.outputState !== 'ABSENT' || row.fact.output !== null || row.fact.collectionError !== null || !Number.isSafeInteger(row.storedAt) || row.storedAt < 0 || row.storedAt > now || Date.parse(row.fact.receivedAt) > now || row.metadataExpiresAt !== row.storedAt + 14 * DAY_MS || row.outputExpiresAt !== row.storedAt + 7 * DAY_MS || deadline > row.outputExpiresAt || deadline > row.metadataExpiresAt || now >= row.metadataExpiresAt) throw Error('CANONICAL_RECORD_INVALID');
      if (row.fact.method !== 'thread/status/changed' && seen.has(row.key)) throw Error('DUPLICATE_CANONICAL_RECORD');
      seen.set(row.key, row.digest);
    }
    const live = facts.records.filter(row => row.fact.sourceKind === 'live_notification');
    if (!Array.isArray(result.acks) || result.acks.length !== live.length) throw Error('ACK_INVALID');
    live.forEach((row, index) => {
      const ack = result.acks[index], at = Date.parse(ack.acknowledgedAt);
      if (ack.sequence !== facts.records.indexOf(row) + 1 || ack.digest !== row.digest || ack.revision !== row.revision || ack.duplicate !== false || !Number.isFinite(at) || at < row.storedAt || at > now) throw Error('ACK_INVALID');
    });
    const comparison = reconcile(facts.records);
    if (!comparison.length || comparison.some(row => row.result !== 'MATCH')) throw Error('RECONCILIATION_INVALID');
    compareReconciliation(comparison, reader.reconciliation);
    const changes = verifyFileChangeRecords(facts.records, binding);
    if (changes.some(row => row.result !== 'MATCH')) throw Error('FILECHANGE_INVALID');
    const red = phase(legacy ? seal.red : result.tests?.[0]), green = phase(legacy ? seal.green : result.tests?.[1]);
    if (red.exitCode === 0 || red.counters.fail < 1 || green.exitCode !== 0 || green.counters.tests < 1 || green.counters.pass !== green.counters.tests || ['fail', 'cancelled', 'skipped', 'todo'].some(key => green.counters[key] !== 0) || red.counters.tests !== green.counters.tests || red.commandHash !== green.commandHash) throw Error('RED_GREEN_INVALID');
    if (!Array.isArray(result.tests) || result.tests.length !== 2 || !samePhase(red, result.tests[0]) || !samePhase(green, result.tests[1])) throw Error('TEST_LINK_INVALID');
    if (legacy) {
      for (const [name, value] of [['red', red], ['green', green]]) if (review[name]?.exitCode !== value.exitCode || JSON.stringify(counters(review[name]?.counters)) !== JSON.stringify(value.counters) || !samePhase(value, reader.redGreen?.[name])) throw Error('TEST_LINK_INVALID');
    } else {
      if (!Array.isArray(reader.tests) || reader.tests.length !== 2 || !samePhase(red, reader.tests[0]) || !samePhase(green, reader.tests[1]) || reader.liveFacts !== live.length || reader.acks !== live.length || result.proof?.liveFacts !== live.length || result.proof?.acks !== live.length || changes.length !== 2) throw Error('READER_RESULT_INVALID');
      compareReconciliation(comparison, reader.freshReconciliation); compareReconciliation(comparison, result.proof.reconciliation);
    }
    const completed = value => live.findIndex(row => row.fact.itemId === value.itemId && row.fact.itemType === 'commandExecution' && row.fact.method === 'item/completed' && row.fact.exitCode === value.exitCode);
    if (live[0]?.fact.method !== 'turn/started' || live[0].fact.status !== 'inProgress' || live.at(-1)?.fact.method !== 'turn/completed' || live.at(-1).fact.status !== 'completed' || completed(red) < 1 || completed(green) <= completed(red) || completed(green) >= live.length - 1) throw Error('LIFECYCLE_ORDER_INVALID');
    live.forEach((row, index) => {
      if (row.fact.method === 'item/started' && ['commandExecution', 'fileChange'].includes(row.fact.itemType) && row.fact.status !== 'inProgress') throw Error('INVALID_START_STATUS');
      if (row.fact.method === 'item/completed' && !live.slice(0, index).some(start => start.fact.itemId === row.fact.itemId && start.fact.itemType === row.fact.itemType && start.fact.method === 'item/started')) throw Error('MISSING_ITEM_START');
    });
    if (live[completed(red)].fact.status !== 'failed' || live[completed(green)].fact.status !== 'completed') throw Error('INVALID_TEST_STATUS');
    const allowed = legacy ? ['scripts/agent-flow/contract.mjs', 'scripts/agent-flow/agent-flow.test.mjs'] : ['scripts/agent-flow/task-workflow.mjs', 'scripts/agent-flow/task-workflow.test.mjs'];
    const files = legacy ? seal.agent_owned_files : result.changed;
    const sameFiles = value => Array.isArray(value) && value.length === 2 && new Set(value).size === 2 && value.every(file => allowed.includes(file));
    if (!sameFiles(files) || !sameFiles(result.changed) || !sameFiles(reader.changed)) throw Error('FILE_SCOPE_INVALID');
    if (launcher) {
      const projectChanges = value => {
        if (!Array.isArray(value) || value.length !== changes.length || new Set(value.map(entry => entry.itemId)).size !== changes.length) throw Error('FILECHANGE_LINK_INVALID');
        return value.map(entry => {
          if (entry.status !== 'completed' || !changes.some(row => row.itemId === entry.itemId) || !live.some(row => row.fact.itemId === entry.itemId && row.fact.method === 'item/completed' && row.fact.status === entry.status) || !Array.isArray(entry.paths) || entry.paths.length !== 1 || !allowed.includes(entry.paths[0])) throw Error('FILECHANGE_LINK_INVALID');
          return { itemId: entry.itemId, path: entry.paths[0] };
        }).sort((a, b) => a.itemId.localeCompare(b.itemId));
      };
      const declared = projectChanges(result.changes);
      if (JSON.stringify(declared) !== JSON.stringify(projectChanges(reader.nativeChanges)) || new Set(declared.map(entry => entry.path)).size !== 2 || reader.codingEvidence?.sourceSnapshotsMatch !== true || reader.codingEvidence?.sourceReadsVerified !== true || !Number.isSafeInteger(reader.codingEvidence.redPosition) || reader.codingEvidence.redPosition < 0 || !Number.isSafeInteger(reader.codingEvidence.greenPosition) || reader.codingEvidence.greenPosition <= reader.codingEvidence.redPosition) throw Error('FILECHANGE_LINK_INVALID');
      const editPosition = file => live.findIndex(row => row.fact.method === 'item/completed' && row.fact.itemId === declared.find(entry => entry.path === file)?.itemId);
      if (editPosition(allowed[1]) < 1 || editPosition(allowed[1]) >= completed(red) || editPosition(allowed[0]) <= completed(red) || editPosition(allowed[0]) >= completed(green)) throw Error('FILECHANGE_ORDER_INVALID');
    }
    const timeline = facts.records.map((row, index) => ({ index, itemId: id(row.fact.itemId), method: row.fact.method, type: types.has(row.fact.itemType) ? row.fact.itemType : null, status: states.has(row.fact.status) ? row.fact.status : 'unknown', exitCode: row.fact.exitCode, source: row.fact.sourceKind, sourceAt: iso(row.fact.sourceTimestamp), receivedAt: iso(row.fact.receivedAt), storedAt: new Date(row.storedAt).toISOString() }));
    const reviews = legacy ? { code: claim(seal.independent_code_review), runtime: claim(seal.independent_runtime_review), workflow: claim(seal.task_code_test_workflow) } : { code: claim(seal.independentCodeAndEvidenceReview), runtime: claim(seal.independentCodeAndEvidenceReview), workflow: claim('PASS') };
    return { ...summary, state: 'AVAILABLE', expiresAt: new Date(deadline).toISOString(), integrity, binding: Object.fromEntries(keys.map(key => [key, binding[key]])), baseline, timeline, tests: { red, green }, reconciliation: { matches: comparison.length, total: comparison.length }, reviews, files, liveCount: live.length, historyCount: timeline.length - live.length, acks: result.acks.length, readerPid: reader.readerPid, writerPid: reader.writerPid, production: seal.production === 'UNTOUCHED' ? 'UNTOUCHED (retained claim)' : 'NOT_PROVEN' };
  } catch (error) {
    return { ...summary, state: error.code === 'ENOENT' ? 'MISSING' : 'CORRUPT' };
  }
}

export async function listPackages(root, now = Date.now()) {
  if ((await lstat(root)).isSymbolicLink()) throw Error('ROOT_DENIED');
  const entries = await readdir(root, { withFileTypes: true }), result = [];
  if (entries.length > 1000) throw Error('DISCOVERY_LIMIT');
  for (const entry of entries.filter(entry => entry.isDirectory() && packagePattern.test(entry.name))) {
    try { await safeRead(root, `${entry.name}/seal.json`); } catch {
      let found=false;
      for(const file of ['factory-index-intake.json','terminal.json','controller-final-report.json']){try{await safeRead(root,`${entry.name}/${file}`);found=true;break;}catch{}}
      if(!found)continue;
    }
    const data = await readPackage(root, entry.name, now);
    result.push({ id: data.id, state: data.state, expiresAt: data.expiresAt });
  }
  return result;
}
