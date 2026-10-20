import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,DAY_MS} from '../agent-flow/contract.mjs';
import {readHistorical} from './historical-reader.mjs';

test('historical projection rejects contradictory terminal fields, missing hashes and expired child context',async t=>{
  const root=await mkdtemp(join(tmpdir(),'bella-historical-reader-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const id='bella-agent-flow-History',directory=join(root,id),child=join(root,'bella-agent-flow-Role');await mkdir(directory);await mkdir(child);
  const now=Date.now(),context={createdAt:new Date(now).toISOString(),outputReviewDeadline:new Date(now+DAY_MS).toISOString()},taskId=randomUUID();
  const put=async(dir,file,value)=>{const bytes=Buffer.from(JSON.stringify(value));await writeFile(join(dir,file),bytes);return hash(bytes);};
  await put(directory,'context.json',context);await put(child,'context.json',context);
  await put(directory,'intake.json',{task:{taskId,sourceRevision:'a'.repeat(40)}});
  const original={role:'LEAD',decision:'ACCEPT',candidate:'a'.repeat(64),changed:[],binding:{repository:'bellaspahcm/bella-ai-platform',taskId,runId:randomUUID(),producerInstanceId:randomUUID(),attempt:1,threadId:randomUUID(),sessionId:null,turnId:randomUUID()}};
  const artifactHash=await put(child,'role.json',original),receipt={...original,directory:child,artifactHash};
  const terminal={status:'HELD',taskId,reason:'STOPPED',receipts:[receipt]};await put(directory,'terminal.json',terminal);
  assert.equal((await readHistorical(root,id,now)).state,'PARTIAL');
  receipt.decision='PASS';await put(directory,'terminal.json',terminal);assert.equal((await readHistorical(root,id,now)).state,'CORRUPT');
  receipt.decision='ACCEPT';delete receipt.artifactHash;await put(directory,'terminal.json',terminal);assert.equal((await readHistorical(root,id,now)).state,'CORRUPT');
  receipt.artifactHash=artifactHash;await put(directory,'terminal.json',terminal);
  await put(child,'context.json',{createdAt:new Date(now-2*DAY_MS).toISOString(),outputReviewDeadline:new Date(now-1).toISOString()});assert.equal((await readHistorical(root,id,now)).state,'EXPIRED');
});
