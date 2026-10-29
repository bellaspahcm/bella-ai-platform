const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),dotenv=require('dotenv');
const d=__dirname,cli=path.join(process.env.APPDATA,'npm/node_modules/vercel/dist/vc.js');
const linked=JSON.parse(fs.readFileSync('.vercel/project.json'));
const api=route=>JSON.parse(cp.execFileSync(process.execPath,[cli,'api',route,'--method','GET','--raw'],{stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:12000000,encoding:'utf8'}));
async function main(){
 const p=api('/v9/projects/'+linked.projectId),t=p.targets.production;
 const deployment=api('/v13/deployments/'+t.id);
 const env=api('/v1/projects/'+linked.projectId+'/env/rczhKsQvqaLA7zfg');
 const origin=new URL(env.value).origin;
 assert.equal(origin,'https://lvnvkpyxtuilhrabtlwv.supabase.co');assert.equal(deployment.readyState,'READY');
 const prior=JSON.parse(fs.readFileSync(path.join(d,'../batch2a/execution-preconditions.json')));
 const gitSha=deployment.meta?.githubCommitSha||deployment.gitSource?.sha;
 assert.equal(gitSha,prior.production.gitSha,'STOP:production source drift');
 assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'339c89250d87964ba8d58860a5ecdbc0bdde4956');
 assert.equal(cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'codex/preschool-full-audit-20261020');
 const e=dotenv.parse(fs.readFileSync('.env.local')),key=e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.equal(claim.role,'anon');assert.equal(claim.ref,'lvnvkpyxtuilhrabtlwv');
 const health=await fetch('https://bella-spa-erp.vercel.app/api/health',{signal:AbortSignal.timeout(20000)});assert(health.ok);
 const result={checkedAt:new Date().toISOString(),project:'lvnvkpyxtuilhrabtlwv',publicApiOrigin:origin,vercelProjectId:linked.projectId,deploymentId:t.id,gitSha,readyState:deployment.readyState,sourceUnchanged:true,healthStatus:health.status,credentialsSaved:false};
 fs.writeFileSync(path.join(d,'production-identity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,250));process.exitCode=1;});
