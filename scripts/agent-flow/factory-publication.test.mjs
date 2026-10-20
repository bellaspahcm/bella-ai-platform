import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from './contract.mjs';
import { verifyCommitCandidate, readAutocrlf } from './factory-publication.mjs';

test('real disposable Git tree must match candidate bytes/mode/paths; source drift and extra source rejected', async()=>{
  const root=await mkdtemp(join(tmpdir(),'bella-commit-proof-'));
  const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,...options}).trim();
  const priorGlobal=process.env.GIT_CONFIG_GLOBAL,priorSystem=process.env.GIT_CONFIG_NOSYSTEM;
  process.env.GIT_CONFIG_GLOBAL=join(root,'empty-git-config');process.env.GIT_CONFIG_NOSYSTEM='1';await writeFile(process.env.GIT_CONFIG_GLOBAL,'');
  try{
    git(['init','-q']);git(['config','user.name','Protocol Fixture']);git(['config','user.email','protocol@example.invalid']);git(['config','core.autocrlf','false']);
    await writeFile(join(root,'source.mjs'),'export const value = 1;\n');git(['add','--','source.mjs']);git(['commit','-qm','fixture baseline']);
    assert.equal(readAutocrlf(root),'false');git(['config','--unset','core.autocrlf']);assert.equal(readAutocrlf(root),null);git(['config','core.autocrlf','false']);
    const baseRevision=git(['rev-parse','HEAD']);
    await writeFile(join(root,'source.mjs'),'export const value = 2;\n');const bytes=await readFile(join(root,'source.mjs'));
    const blobOid=git(['hash-object','-w','--path=source.mjs','--stdin'],{input:bytes});
    const candidate={representation:'git-clean-filtered-blob-v1',sourceFingerprint:'b'.repeat(64),coreAutocrlf:'false',baseRevision,files:[{path:'source.mjs',present:true,mode:'100644',blobOid,worktreeSha256:hash(bytes),canonicalSha256:hash(bytes),attributes:'text: unspecified'}]};
    git(['add','--','source.mjs']);git(['commit','-qm','fixture candidate']);const commit=git(['rev-parse','HEAD']);
    assert.equal((await verifyCommitCandidate(root,candidate,commit)).matches,true);
    await assert.rejects(verifyCommitCandidate(root,{...candidate,files:[{...candidate.files[0],mode:'100755'}]},commit),/CONTENT_MISMATCH/);
    await assert.rejects(verifyCommitCandidate(root,{...candidate,files:[{...candidate.files[0],canonicalSha256:'0'.repeat(64)}]},commit),/CONTENT_MISMATCH/);
    await writeFile(join(root,'source.mjs'),'export const value = 3;\n');await assert.rejects(verifyCommitCandidate(root,candidate,commit),/POST_REVIEW_DRIFT/);
    await writeFile(join(root,'source.mjs'),bytes);await writeFile(join(root,'extra.mjs'),'export {};\n');git(['add','--','extra.mjs']);git(['commit','--amend','--no-edit','-q']);
    await assert.rejects(verifyCommitCandidate(root,candidate,git(['rev-parse','HEAD'])),/SCOPE_MISMATCH/);
  }finally{if(priorGlobal===undefined)delete process.env.GIT_CONFIG_GLOBAL;else process.env.GIT_CONFIG_GLOBAL=priorGlobal;if(priorSystem===undefined)delete process.env.GIT_CONFIG_NOSYSTEM;else process.env.GIT_CONFIG_NOSYSTEM=priorSystem;await rm(root,{recursive:true,force:true});}
});
