import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { hash, validateBinding, DAY_MS } from '../agent-flow/contract.mjs';

// Compatibility projection only: no generated factoryRunId, facts or completion.
export async function readHistorical(root, id, now = Date.now(), controller = false) {
  const dto = { id, kind:'FACTORY', evidenceClass:'LEGACY_COMPATIBILITY', state:'PARTIAL', validation:'LEGACY_WITHOUT_FACTORY_LINK', executionOutcome:null, taskId:null, factoryRunId:null, stages:[], artifacts:[], commit:null };
  let used=0; const deadlines=new Set();
  try {
    const roots=[await realpath(root),await realpath(tmpdir())];
    async function json(path, expectedHash = null) {
      const dir=dirname(path), p=basename(path);
      if (!/^bella-agent-flow-[A-Za-z0-9]{1,32}$/.test(basename(dir)) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(p)) throw Error('PATH_DENIED');
      const di=await lstat(dir), fi=await lstat(path);
      if (di.isSymbolicLink() || fi.isSymbolicLink() || !fi.isFile() || fi.size>2*1024*1024 || !roots.includes(dirname(await realpath(dir)))) throw Error('PATH_DENIED');
      if(p!=='context.json' && !deadlines.has(dir)) {
        const c=await json(join(dir,'context.json')),created=Date.parse(c.createdAt),deadline=Date.parse(c.outputReviewDeadline);
        if(!Number.isFinite(created)||created>now||!Number.isFinite(deadline)||deadline<=created||deadline>created+7*DAY_MS)throw Error('RETENTION_INVALID');
        if(now>=deadline){const error=Error('EXPIRED');error.code='EXPIRED';throw error;}deadlines.add(dir);
      }
      const bytes=await readFile(path); used+=bytes.length; if(used>32*1024*1024)throw Error('READ_LIMIT');
      const sha256=hash(bytes); if(expectedHash&&expectedHash!==sha256)throw Error('HASH_MISMATCH');
      dto.artifacts.push({packageId:basename(dir),file:p,bytes:bytes.length,sha256});return JSON.parse(bytes);
    }
    const directory=join(resolve(root),id), c=await json(join(directory,'context.json'));
    const created=Date.parse(c.createdAt), deadline=Date.parse(c.outputReviewDeadline);
    if(!Number.isFinite(created)||!Number.isFinite(deadline)||created>now||deadline<=created||deadline>created+7*DAY_MS)throw Error('RETENTION_INVALID');
    dto.expiresAt=new Date(deadline).toISOString(); if(now>=deadline)return {...dto,state:'EXPIRED',validation:'EXPIRED'};
    if(controller){
      const report=await json(join(directory,'controller-final-report.json'));
      if(!['HANDOFF','HELD'].includes(report.status)||!Array.isArray(report.results))throw Error('FORMAT_INVALID');
      dto.taskId=report.taskId;dto.executionOutcome=report.status;dto.reason=report.reason;
      for(const r of report.results){
        validateBinding(r.binding);if(r.binding.taskId!==dto.taskId||!Array.isArray(r.evidenceRefs)||!r.evidenceRefs.length)throw Error('BINDING_MISMATCH');
        for(const ref of r.evidenceRefs){if(!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('HASH_REQUIRED');await json(ref.artifactRef,ref.sha256);}
        const activity=r.phase==='BUILD'?'CODE_CHANGE':r.phase==='VERIFY'&&r.execution==='READ_BACK'?'READBACK_ONLY':r.phase==='REVIEW'?'INDEPENDENT_REVIEW':null;
        if(!activity)throw Error('ACTIVITY_UNKNOWN');
        dto.stages.push({role:{BUILD:'BUILDER',VERIFY:'VERIFY',REVIEW:'REVIEWER'}[r.phase],activity,decision:r.status,binding:r.binding,candidate:r.sourceFingerprint,test:null,liveFacts:'retained reference',historyMatches:r.readback});
      }
    }else{
      const intake=await json(join(directory,'intake.json')), value=await json(join(directory,'terminal.json')), terminal=value.terminal||value;
      if(!['PASS','HELD'].includes(terminal.status)||terminal.taskId!==intake.task?.taskId||!Array.isArray(terminal.receipts))throw Error('FORMAT_INVALID');
      dto.taskId=terminal.taskId;dto.baseline=intake.task.sourceRevision;dto.executionOutcome=terminal.status;dto.reason=terminal.reason;
      for(const r of terminal.receipts){
        validateBinding(r.binding);if(r.binding.taskId!==dto.taskId)throw Error('BINDING_MISMATCH');
        if(!/^[a-f0-9]{64}$/.test(r.artifactHash||''))throw Error('HASH_REQUIRED');
        const original=await json(join(r.directory,'role.json'),r.artifactHash);
        for(const [key,value] of Object.entries(original))if(key!=='changed'&&JSON.stringify(value)!==JSON.stringify(r[key]))throw Error('RECEIPT_MISMATCH');
        if(!Array.isArray(r.changed)||r.changed.some(p=>!original.changed.includes(p)))throw Error('RECEIPT_MISMATCH');
        dto.stages.push({role:r.role,activity:{LEAD:'PLAN',BUILDER:'CODE_CHANGE',VERIFY:'TEST_EXECUTION',REVIEWER:'INDEPENDENT_REVIEW'}[r.role],decision:r.decision,binding:r.binding,candidate:r.candidate,test:r.test?{command:r.test.command,exitCode:r.test.exitCode,counters:r.test.counters}:null,liveFacts:r.proof?.liveFacts,historyMatches:r.proof?.historyMatches});
      }
    }
    dto.proofLimit='Historical source/reference integrity only. No factoryRunId, fresh query, reconstructed event or upgraded verdict.';
    return dto;
  }catch(error){if(error.code==='EXPIRED')return {...dto,state:'EXPIRED',validation:'EXPIRED',stages:[],artifacts:[]};return {...dto,state:error.code==='ENOENT'?'MISSING':'CORRUPT',validation:'HELD'};}
}
