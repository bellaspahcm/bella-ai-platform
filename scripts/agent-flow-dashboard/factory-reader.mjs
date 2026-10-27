import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { hash, DAY_MS, validateFact, logicalKey, signature, reconcile, verifyFileChangeRecords } from '../agent-flow/contract.mjs';
import { validateIndex, resolveArtifact, resolveStageArtifact, verifyNativeStageBinding, verifyCandidateInventory, validateReadback, validateIndexIdentity } from '../agent-flow/run-evidence.mjs';
import { validateHandoff, validateRetainedRole } from '../agent-flow/role-validation.mjs';
import { isMvpPilot } from '../agent-flow/mvp-pilot.mjs';

// No writer/store/AppServer/retention calls. All package content is inert JSON.
const missing = () => { const error = new Error('MISSING'); error.code = 'ENOENT'; throw error; };
export async function readFactory(root, packageId, now = Date.now()) {
  const result = { id: packageId, kind: 'FACTORY', checkedAt: new Date(now).toISOString(), state: 'PARTIAL', executionOutcome: null, validation: 'INCOMPLETE', taskId: null, factoryRunId: null, stages: [], artifacts: [], commit: null };
  let budget = 0;
  const seen = new Map(), deadlines = new Map();
  try {
    const rootInfo = await lstat(root); if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw Error('ROOT_DENIED');
    const canonicalRoot = await realpath(root);
    async function bytes(id, file) {
      if (!/^bella-agent-flow-[A-Za-z0-9]{1,32}$/.test(id) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(file)) throw Error('PATH_DENIED');
      const directory = join(canonicalRoot, id), info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || dirname(await realpath(directory)) !== canonicalRoot) throw Error('PATH_DENIED');
      if(file!=='context.json' && !deadlines.has(id)) {
        const c=JSON.parse((await bytes(id,'context.json')).toString('utf8')), created=Date.parse(c.createdAt), deadline=Date.parse(c.outputReviewDeadline);
        if(!Number.isFinite(created)||created>now||!Number.isFinite(deadline)||deadline<=created||deadline>created+7*DAY_MS)throw Error('RETENTION_INVALID');
        if(now>=deadline) { const error=Error('EXPIRED');error.code='EXPIRED';throw error; }
        deadlines.set(id,deadline);
      }
      const path = join(directory, file), stat = await lstat(path);
      // A verified-source artifact contains both full before/after manifests.
      const maxBytes = (file === 'verified-source.json' ? 4 : 2) * 1024 * 1024;
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw Error('FILE_DENIED');
      const data = await readFile(path); budget += data.length; if (budget > 32 * 1024 * 1024) throw Error('READ_BUDGET_EXHAUSTED');
      seen.set(`${id}/${file}`, { packageId: id, file, bytes: data.length, sha256: hash(data) });
      return data;
    }
    const json = async (id, file) => JSON.parse((await bytes(id, file)).toString('utf8'));
    const reference = async ref => resolveArtifact(ref, await bytes(ref.packageId, ref.file));
    const context = await json(packageId, 'context.json');
    const created = Date.parse(context.createdAt), deadline = Date.parse(context.outputReviewDeadline);
    if (!Number.isFinite(created) || created > now || !Number.isFinite(deadline) || deadline <= created || deadline > created + 7 * DAY_MS) throw Error('RETENTION_INVALID');
    result.expiresAt = new Date(deadline).toISOString();
    if (now >= deadline) return { ...result, state: 'EXPIRED', validation: 'EXPIRED' };
    let index;
    for (const file of ['factory-index-commit.json', 'factory-index-terminal.json', 'factory-index-intake.json']) {
      try { index = await json(packageId, file); break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!index) missing();
    validateIndex(index);
    const initial=await json(packageId,'factory-index-intake.json'); validateIndexIdentity(initial,index);
    const intake = await reference(index.intake);
    if (intake.task?.taskId !== index.taskId || !intake.before?.fingerprint || intake.task.sourceRevision !== intake.before.head) throw Error('INTAKE_MISMATCH');
    Object.assign(result, { taskId: index.taskId, factoryRunId: index.factoryRunId, provenance: index.provenance, baseline: intake.before.head });
    const terminalValue=index.terminal?await reference(index.terminal):null;
    const terminal=terminalValue?.terminal||terminalValue;
    const existingFlow=isMvpPilot(intake.task)&&terminal?.receipts?.some(r=>r.role==='BUILDER'&&r.noChange===true);
    const stages=[...index.stages];
    if(existingFlow) {
      // This producer omitted source-only Builder assessments from its index.
      // Read the original receipt referenced by terminal; never invent a stage
      // event, CODE_CHANGE, or missing ACK to make an incomplete run pass.
      for(const [position,r] of terminal.receipts.entries()) {
        if(r.role!=='BUILDER'||r.noChange!==true)continue;
        if(r.decision!=='DONE'||!Array.isArray(r.changed)||r.changed.length||r.before!==r.after||r.candidate!==r.before||stages.some(s=>s.role==='BUILDER'))throw Error('ASSESSMENT_MISMATCH');
        if(typeof r.directory!=='string'||dirname(resolve(r.directory))!==canonicalRoot)throw Error('PATH_DENIED');
        const id=basename(r.directory);
        if(dirname(await realpath(r.directory))!==canonicalRoot)throw Error('PATH_DENIED');
        const data=await bytes(id,'role.json');
        const ref={packageId:id,file:'role.json',bytes:data.length,sha256:r.artifactHash};
        resolveArtifact(ref,data);
        stages.splice(position,0,{role:'BUILDER',activity:'SOURCE_ASSESSMENT',receipt:ref,sourcePointer:''});
      }
    }
    const receipts = [];
    for (const stage of stages) {
      const receiptBytes = await bytes(stage.receipt.packageId, stage.receipt.file);
      const r = resolveStageArtifact(stage, receiptBytes); verifyNativeStageBinding(index, r.binding);
      if (r.role !== stage.role || r.nativeVerified !== true || stage.activity === 'READBACK_ONLY'||(stage.activity==='CODE_CHANGE'&&r.noChange===true)) throw Error('STAGE_SEMANTICS_MISMATCH');
      const data = await json(stage.receipt.packageId, 'facts.json');
      if (JSON.stringify(data.binding) !== JSON.stringify(r.binding) || !Array.isArray(data.records)) throw Error('FACT_SCOPE_MISMATCH');
      for (const row of data.records) {
        validateFact(row.fact, r.binding);
        if (row.digest !== signature(row.fact) || row.key !== logicalKey(row.fact) || !Number.isSafeInteger(row.storedAt) || row.storedAt < 0 || row.storedAt > now || !Number.isSafeInteger(row.revision) || row.revision < 1 || !['AVAILABLE','ABSENT','EXPIRED'].includes(row.outputState) || row.metadataExpiresAt !== row.storedAt + 14 * DAY_MS || row.outputExpiresAt !== row.storedAt + 7 * DAY_MS || now >= row.outputExpiresAt) throw Error('FACT_INTEGRITY_MISMATCH');
      }
      const live = data.records.filter(row => row.fact.sourceKind === 'live_notification');
      if (!live.length || live.length !== r.acknowledgements?.length) throw Error('ACK_MISMATCH');
      for (let i = 0; i < live.length; i++) if (r.acknowledgements[i].sequence !== i + 1 || r.acknowledgements[i].digest !== live[i].digest) throw Error('ACK_MISMATCH');
      const facts=live.map(row=>row.fact), end=facts.findIndex(f=>f.method==='turn/completed');
      if(facts[0]?.method!=='turn/started'||end<1||facts[end].status!=='completed')throw Error('LIFECYCLE_ORDER_MISMATCH');
      for(const f of facts.filter(f=>f.method==='item/completed'&&f.itemType==='commandExecution')){
        const start=facts.findIndex(p=>p.method==='item/started'&&p.itemId===f.itemId);
        if(start<1||start>=facts.indexOf(f)||facts.indexOf(f)>=end)throw Error('LIFECYCLE_ORDER_MISMATCH');
      }
      const comparison = reconcile(data.records);
      if (!comparison.length || comparison.some(row => row.result !== 'MATCH') || verifyFileChangeRecords(data.records, r.binding).some(row => row.result !== 'MATCH')) throw Error('HISTORY_MISMATCH');
      validateRetainedRole(r,data.records,intake.task,intake.workspace,receipts.at(-1)?.receipt.verificationPath);
      receipts.push({ receipt: r, ref: stage.receipt });
      result.stages.push({ role: r.role, activity: stage.activity, decision: r.decision, binding: r.binding, candidate: r.candidate,
        test: r.test ? { command: r.test.command, exitCode: r.test.exitCode, counters: r.test.counters } : null,
        liveFacts: live.length, historyMatches: comparison.length, receipt: stage.receipt, changed: r.changed });
    }
    if (!index.terminal) return { ...result, artifacts: [...seen.values()] };
    if (!['PASS', 'HELD'].includes(terminal.status) || terminal.taskId !== index.taskId || !Array.isArray(terminal.receipts) || terminal.receipts.length !== receipts.length) throw Error('TERMINAL_MISMATCH');
    for (let i = 0; i < receipts.length; i++) {
      const original = receipts[i].receipt, augmented = terminal.receipts[i];
      if (augmented.artifactHash !== receipts[i].ref.sha256) throw Error('RECEIPT_HASH_MISMATCH');
      for (const [key, value] of Object.entries(original)) if (key !== 'changed' && JSON.stringify(augmented[key]) !== JSON.stringify(value)) throw Error('RECEIPT_MISMATCH');
      if (augmented.changed.some(path => !original.changed.includes(path))) throw Error('RECEIPT_MISMATCH');
    }
    result.executionOutcome = terminal.status;
    result.reason = terminal.reason || null;
    if (terminal.status === 'PASS') {
      validateHandoff(terminal, intake.task);
      let candidate;
      if(existingFlow) {
        if(index.candidate!==null||index.commit!==null)throw Error('EXISTING_FLOW_RELEASE_MISMATCH');
        const verified=await json(packageId,'verified-source.json');
        if(verified.kind!=='VERIFIED_EXISTING_FLOW_NO_PRODUCT_CHANGE'||JSON.stringify(verified.before)!==JSON.stringify(intake.before)||
            JSON.stringify(verified.after)!==JSON.stringify(verified.before)||verified.after.fingerprint!==terminal.candidate||
            hash(JSON.stringify({head:verified.before.head,files:verified.before.files}))!==terminal.candidate)throw Error('VERIFIED_SOURCE_MISMATCH');
        result.sourceEvidence='VERIFIED_EXISTING_FLOW_NO_PRODUCT_CHANGE';
      } else {
        if (!index.candidate) missing();
        candidate=await reference(index.candidate);
        verifyCandidateInventory(candidate,intake,terminal);
      }
      if (index.commit) {
        const commit = await reference(index.commit);
        if (commit.taskId !== index.taskId || commit.factoryRunId !== index.factoryRunId || commit.sourceFingerprint !== terminal.candidate || commit.candidate.sha256 !== index.candidate.sha256 || commit.matches !== true || !/^[a-f0-9]{40}$/.test(commit.commit)) throw Error('COMMIT_LINK_MISMATCH');
        const native = await reference(commit.nativeReadback);
        validateReadback(native,terminal);
        result.commit = { sha: commit.commit, comparison: commit.comparison, matches: commit.matches, evidenceClass: 'RETAINED_OPERATOR_TREE_COMPARISON' };
      }
    }
    result.validation = 'MATCH_RETAINED_SOURCES'; result.state = 'AVAILABLE';
    result.artifacts = [...seen.values()];
    result.proofLimit = 'Retained facts/receipts only; no fresh native history or current Git query by Monitor.';
    return result;
  } catch (error) {
    if(error.code==='EXPIRED') return {...result,state:'EXPIRED',validation:'EXPIRED',stages:[],artifacts:[],commit:null};
    return { ...result, state: error.code === 'ENOENT' ? 'MISSING' : 'CORRUPT', validation: 'HELD', artifacts: [...seen.values()] };
  }
}
