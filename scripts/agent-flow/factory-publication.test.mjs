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

test('real Git proof includes additions/deletions/executable modes and rejects recreated deletion',async t=>{
  const root=await mkdtemp(join(tmpdir(),'bella-tree-changes-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const priorGlobal=process.env.GIT_CONFIG_GLOBAL,priorSystem=process.env.GIT_CONFIG_NOSYSTEM;
  t.after(()=>{if(priorGlobal===undefined)delete process.env.GIT_CONFIG_GLOBAL;else process.env.GIT_CONFIG_GLOBAL=priorGlobal;if(priorSystem===undefined)delete process.env.GIT_CONFIG_NOSYSTEM;else process.env.GIT_CONFIG_NOSYSTEM=priorSystem;});
  process.env.GIT_CONFIG_GLOBAL=join(root,'empty-git-config');process.env.GIT_CONFIG_NOSYSTEM='1';await writeFile(process.env.GIT_CONFIG_GLOBAL,'');
  const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,...options}).trim();
  git(['init','-q']);git(['config','user.name','Protocol Fixture']);git(['config','user.email','protocol@example.invalid']);git(['config','core.autocrlf','false']);
  await writeFile(join(root,'removed.mjs'),'old\n');await writeFile(join(root,'kept.mjs'),'export {};\n');git(['add','--','removed.mjs','kept.mjs']);git(['commit','-qm','base']);const baseRevision=git(['rev-parse','HEAD']);
  await rm(join(root,'removed.mjs'));await writeFile(join(root,'added.mjs'),'export const added = true;\n');git(['add','-A','--','added.mjs','removed.mjs']);git(['update-index','--chmod=+x','kept.mjs']);
  const blob=path=>git(['rev-parse',':'+path]);const entry=async(path,mode)=>({path,present:true,mode,worktreeSha256:hash(await readFile(join(root,path))),blobOid:blob(path),canonicalSha256:hash(execFileSync('git',['cat-file','blob',blob(path)],{cwd:root,windowsHide:true})),attributes:'text: unspecified'});
  const candidate={representation:'git-clean-filtered-blob-v1',baseRevision,sourceFingerprint:'b'.repeat(64),coreAutocrlf:'false',files:[await entry('added.mjs','100644'),await entry('kept.mjs','100755'),{path:'removed.mjs',present:false,mode:null,worktreeSha256:null,blobOid:null,canonicalSha256:null}]};
  git(['commit','-qm','candidate']);const commit=git(['rev-parse','HEAD']);assert.equal((await verifyCommitCandidate(root,candidate,commit)).matches,true);
  await assert.rejects(verifyCommitCandidate(root,{...candidate,files:candidate.files.filter(f=>f.path!=='added.mjs')},commit),/SCOPE_MISMATCH/);
  await assert.rejects(verifyCommitCandidate(root,{...candidate,files:candidate.files.map(f=>f.path==='kept.mjs'?{...f,mode:'100644'}:f)},commit),/CONTENT_MISMATCH/);
  await writeFile(join(root,'removed.mjs'),'recreated\n');await assert.rejects(verifyCommitCandidate(root,candidate,commit),/POST_REVIEW_DRIFT/);
});
