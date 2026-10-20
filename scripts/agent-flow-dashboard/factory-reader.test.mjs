import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, normalizeNotification, normalizeHistory, normalizeHistoryTurn, signature, logicalKey, DAY_MS } from '../agent-flow/contract.mjs';
import { readFactory } from './factory-reader.mjs';

// Real filesystem/protocol fixtures, not a Codex execution or Factory proof.
async function fixture(t, held = false) {
  const root = await mkdtemp(join(tmpdir(), 'bella-factory-reader-')); t.after(() => rm(root, { recursive: true, force: true }));
  const id = 'bella-agent-flow-Index', directory = join(root, id); await mkdir(directory);
  const now=Date.now(), taskId=randomUUID(), source='a'.repeat(40), workspace=root;
  const files=[{path:'scripts/agent-flow/task-workflow.mjs',mode:'100644',sha256:hash('old')},{path:'scripts/agent-flow/task-workflow.test.mjs',mode:'100644',sha256:hash('test')}];
  const a=hash(JSON.stringify({head:source,files})), b=hash(JSON.stringify({head:source,files:[{...files[0],sha256:hash('new')},files[1]]}));
  const put = async (dir, file, value) => { const bytes = Buffer.from(JSON.stringify(value)); await writeFile(join(dir, file), bytes); return { packageId: basename(dir), file, bytes: bytes.length, sha256: hash(bytes) }; };
  const context={createdAt:new Date(now).toISOString(),outputReviewDeadline:new Date(now+DAY_MS).toISOString()};
  await put(directory,'context.json',context);
  const task={taskId,sourceRevision:source,goal:'Validate read-only protocol fixture.',ownedFiles:files.map(f=>f.path),testFile:files[1].path,acceptance:['An approved invariant.'],maxSeconds:60};
  const intake=await put(directory,'intake.json',{task,workspace,before:{head:source,files,fingerprint:a}});
  const index={format:'bella-factory-evidence',schemaVersion:1,repository:'bellaspahcm/bella-ai-platform',taskId,factoryRunId:randomUUID(),
    provenance:{auditedMainRevision:source,constitutionCandidateRevision:'b'.repeat(40),rules:[{path:'AGENTS.md',revision:source,sha256:a,sections:['Scope'],reason:'Protocol fixture scope.'}]},intake,stages:[],terminal:null,candidate:null,commit:null};
  await put(directory,'factory-index-intake.json',index);
  const receipts=[], roles=held?['LEAD']:['LEAD','BUILDER','VERIFY','REVIEWER'];
  for (const role of roles) {
    const dir=join(root,`bella-agent-flow-${role}`);await mkdir(dir);await put(dir,'context.json',context);
    const binding={repository:index.repository,taskId,runId:randomUUID(),producerInstanceId:randomUUID(),attempt:1,threadId:randomUUID(),sessionId:null,turnId:randomUUID()};
    const output='# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
    const verifyPath=join(root,'bella-agent-flow-VERIFY','role.json');
    const commands=role==='VERIFY'?['node --test --test-reporter=tap '+task.testFile]:role==='REVIEWER'?[`git diff -- ${task.ownedFiles.join(' ')}`,...task.ownedFiles.map(p=>`Get-Content -LiteralPath '${p}'`),`Get-Content -LiteralPath '${verifyPath.replaceAll('\\','/')}'`]:['Get-Content -LiteralPath AGENTS.md'];
    const items=commands.map((command,i)=>({id:`command-${role}-${i}`,type:'commandExecution',status:'completed',exitCode:0,command,cwd:workspace}));
    const fact=(method,params)=>normalizeNotification({method,params:{threadId:binding.threadId,turnId:binding.turnId,...params}},binding,new Date(now).toISOString());
    const changeItem={id:'change-BUILDER',type:'fileChange',status:'completed'};
    const changeFacts=role==='BUILDER'?[fact('item/started',{item:{...changeItem,status:'inProgress'}}),fact('item/completed',{item:changeItem})]:[];
    const facts=[fact('turn/started',{turn:{id:binding.turnId,status:'inProgress'}}),...items.flatMap(item=>[fact('item/started',{item:{...item,status:'inProgress'}}),fact('item/completed',{item})]),...changeFacts,fact('turn/completed',{turn:{id:binding.turnId,status:'completed'}}),...(role==='BUILDER'?[normalizeHistory({turnId:binding.turnId,item:changeItem},binding,new Date(now).toISOString())]:[]),...items.map(item=>normalizeHistory({turnId:binding.turnId,item},binding,new Date(now).toISOString())),normalizeHistoryTurn({id:binding.turnId,status:'completed'},binding,new Date(now).toISOString())];
    const records=facts.map(fact=>({fact,key:logicalKey(fact),digest:signature(fact),revision:1,storedAt:now,metadataExpiresAt:now+14*DAY_MS,outputExpiresAt:now+7*DAY_MS,outputState:'ABSENT'}));
    await put(dir,'facts.json',{binding,records});
    const before=role==='LEAD'||role==='BUILDER'?a:b,after=role==='LEAD'?a:b;
    const result={role,candidate:before,decision:{LEAD:'ACCEPT',BUILDER:'DONE',VERIFY:'PASS',REVIEWER:'PASS'}[role],findings:[]};
    const live=records.filter(r=>r.fact.sourceKind==='live_notification');
    const r={...result,nativeVerified:true,binding,changed:role==='BUILDER'?[task.ownedFiles[0]]:[],verificationPath:join(dir,'role.json'),
      acknowledgements:live.map((r,i)=>({sequence:i+1,digest:r.digest})),native:{binding,result,commands:items.map(item=>({itemId:item.id,command:item.command,cwd:workspace,exitCode:0,status:'completed',outputHash:hash(role==='VERIFY'?output:'')})),changes:role==='BUILDER'?[{itemId:changeItem.id,paths:[task.ownedFiles[0]]}]:[]},
      proof:{liveFacts:live.length,historyMatches:items.length+1+(role==='BUILDER'?1:0),changes:role==='BUILDER'?1:0},
      ...(role==='VERIFY'?{test:{candidate:b,itemId:items[0].id,output,outputHash:hash(output),command:commands[0],exitCode:0,counters:{tests:1,pass:1,fail:0,skipped:0,cancelled:0,todo:0}}}:{})};
    const ref=await put(dir,'role.json',r);
    index.stages.push({role,activity:{LEAD:'PLAN',BUILDER:'CODE_CHANGE',VERIFY:'TEST_EXECUTION',REVIEWER:'INDEPENDENT_REVIEW'}[role],receipt:ref,sourcePointer:''});
    receipts.push({...r,revision:0,before,after,artifactHash:ref.sha256});
  }
  const terminal={status:held?'HELD':'PASS',taskId,reason:held?'STORE_WRITE_FAILED':undefined,candidate:held?a:b,revisions:0,receipts};
  index.terminal=await put(directory,'terminal.json',terminal);
  if(!held)index.candidate=await put(directory,'candidate.json',{representation:'git-clean-filtered-blob-v1',baseRevision:source,sourceFingerprint:b,coreAutocrlf:null,files:[{path:files[0].path,present:true,mode:'100644',worktreeSha256:hash('new'),blobOid:'c'.repeat(40),canonicalSha256:hash('new'),attributes:'text: unspecified'}]});
  await put(directory,'factory-index-terminal.json',index);
  return {root,id,directory,index,now,put,terminal};
}

test('reader exposes HELD separately from complete evidence and never writes or purges packages', async t => {
  const f=await fixture(t,true), before=await readFile(join(f.directory,'terminal.json'));
  const r=await readFactory(f.root,f.id,f.now);
  assert.equal(r.state,'AVAILABLE'); assert.equal(r.executionOutcome,'HELD'); assert.equal(r.reason,'STORE_WRITE_FAILED');
  assert.equal(r.stages[0].activity,'PLAN'); assert.equal(r.stages[0].test,null);
  assert.deepEqual(await readFile(join(f.directory,'terminal.json')),before);
  assert.equal((await readdir(f.directory)).some(n=>n.startsWith('readback-')),false);
});

test('PASS requires consistent native receipts/test output/facts and matching candidate', async t => {
  const f=await fixture(t), r=await readFactory(f.root,f.id,f.now);
  assert.equal(r.state,'AVAILABLE'); assert.equal(r.executionOutcome,'PASS'); assert.equal(r.stages.length,4);
  assert.equal(r.commit,null); // No commit proof manufactured from execution PASS.
});

test('missing artifact, corrupt bytes and expired package are distinguishable without rewriting original', async t => {
  const f=await fixture(t), original=await readFile(join(f.directory,'terminal.json'));
  const expired=await readFactory(f.root,f.id,f.now+DAY_MS); assert.equal(expired.state,'EXPIRED'); assert.equal(expired.stages.length,0);
  await writeFile(join(f.directory,'terminal.json'),'{}'); assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  await writeFile(join(f.directory,'terminal.json'),original); await rm(join(f.directory,'candidate.json'));
  const missing=await readFactory(f.root,f.id,f.now); assert.equal(missing.state,'MISSING'); assert.equal(missing.validation,'HELD');
});

test('metadata cannot relabel readback as native test execution or cross-bind another task', async t => {
  const f=await fixture(t); f.index.stages[2].activity='READBACK_ONLY'; await f.put(f.directory,'factory-index-terminal.json',f.index);
  assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  f.index.taskId=randomUUID(); await f.put(f.directory,'factory-index-terminal.json',f.index);
  assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
});

test('incomplete candidate and manifest fingerprint contradiction are HELD',async t=>{
  const f=await fixture(t),original=JSON.parse(await readFile(join(f.directory,'candidate.json'),'utf8'));
  for(const files of [[],[{path:original.files[0].path}],[{...original.files[0],worktreeSha256:hash('different')}],[original.files[0],original.files[0]]]){
    f.index.candidate=await f.put(f.directory,'candidate.json',{...original,files});await f.put(f.directory,'factory-index-terminal.json',f.index);
    assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  }
});

test('later index cannot change immutable identity and child deadline cannot be extended',async t=>{
  const f=await fixture(t);f.index.factoryRunId=randomUUID();await f.put(f.directory,'factory-index-terminal.json',f.index);
  assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  const g=await fixture(t);await g.put(join(g.root,'bella-agent-flow-VERIFY'),'context.json',{createdAt:new Date(g.now-2*DAY_MS).toISOString(),outputReviewDeadline:new Date(g.now-1).toISOString()});
  assert.equal((await readFactory(g.root,g.id,g.now)).state,'EXPIRED');
});

test('missing native command payload and unrelated fresh readback cannot become evidence agreement',async t=>{
  const f=await fixture(t);const stage=f.index.stages[2],dir=join(f.root,stage.receipt.packageId),r=JSON.parse(await readFile(join(dir,'role.json'),'utf8'));
  r.native.commands=[{outputHash:r.test.outputHash}];stage.receipt=await f.put(dir,'role.json',r);await f.put(f.directory,'factory-index-terminal.json',f.index);
  assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  const g=await fixture(t);const candidate=JSON.parse(await readFile(join(g.directory,'candidate.json'),'utf8'));
  const nativeReadback=await g.put(g.directory,'readback-42.json',{status:'PASS',source:'fresh_process_native_history_and_store',taskId:g.index.taskId,candidate:candidate.sourceFingerprint,revisions:0,readerPid:42,writerPid:41,checks:[{},{},{},{}]});
  g.index.commit=await g.put(g.directory,'commit-link.json',{taskId:g.index.taskId,factoryRunId:g.index.factoryRunId,sourceFingerprint:candidate.sourceFingerprint,candidate:g.index.candidate,matches:true,commit:'c'.repeat(40),nativeReadback});
  await g.put(g.directory,'factory-index-commit.json',g.index);
  assert.equal((await readFactory(g.root,g.id,g.now)).state,'CORRUPT');
});

test('native result decision and Builder file-change sources cannot be omitted',async t=>{
  for(const [position,mutate] of [[0,r=>{delete r.native.result.decision;}],[1,r=>{r.native.changes=[];}]]){
    const f=await fixture(t),stage=f.index.stages[position],dir=join(f.root,stage.receipt.packageId),r=JSON.parse(await readFile(join(dir,'role.json'),'utf8'));
    mutate(r);stage.receipt=await f.put(dir,'role.json',r);await f.put(f.directory,'factory-index-terminal.json',f.index);
    assert.equal((await readFactory(f.root,f.id,f.now)).state,'CORRUPT');
  }
});

test('Builder declared changed list is not substituted for native observed paths',async t=>{
  const f=await fixture(t),stage=f.index.stages[1],dir=join(f.root,stage.receipt.packageId),r=JSON.parse(await readFile(join(dir,'role.json'),'utf8'));
  r.native.result.changed=['untrusted-declared-path'];stage.receipt=await f.put(dir,'role.json',r);
  f.terminal.receipts[1]={...f.terminal.receipts[1],...r,artifactHash:stage.receipt.sha256};f.index.terminal=await f.put(f.directory,'terminal.json',f.terminal);await f.put(f.directory,'factory-index-terminal.json',f.index);
  assert.equal((await readFactory(f.root,f.id,f.now)).state,'AVAILABLE');
});
