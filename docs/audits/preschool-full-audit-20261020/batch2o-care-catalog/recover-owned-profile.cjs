'use strict';
// Exact synthetic residue recovery after recorded cleanup timeout; no schema/ACL change.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),file=path.join(root,'scripts/verify-preschool-care-rls-e2e.cjs');
const source=fs.readFileSync(file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(source)!=='cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9')throw Error('PINNED_SOURCE_CHANGED');
const receipt='browser-results-2026-10-21T04-17-34-437Z.json',progress='care-rls-progress-2026-10-21T04-17-34-441Z.json';
const report=JSON.parse(fs.readFileSync(path.join(__dirname,receipt)));
const candidates=fs.readdirSync(__dirname).filter(f=>f.startsWith('care-rls-progress-2026-10-21T04-17-34-')&&f.endsWith('.json'));
if(candidates.length!==1)throw Error('EXACT_PROGRESS_REQUIRED');
const checkpoint=JSON.parse(fs.readFileSync(path.join(__dirname,candidates[0])));
if(report.projectRef!=='bmnbqbcdbuklhopfbopv'||report.exitCode!==1||report.cleanup.residualCounts.auth_users!==0||report.cleanup.residualCounts.public_users!==1
  ||!report.cleanup.failures.some(f=>f.name==='DELETE_RESIDUAL_OWN_PROFILE'&&f.code==='57014'))throw Error('EXACT_FAILURE_NOT_PROVEN');
const tenants=checkpoint.fixtureIdentities.map(f=>f.tenant),actors=checkpoint.fixtureIdentities.flatMap(f=>f.actors.map(a=>a.id));
if(tenants.length!==2||actors.length!==6)throw Error('EXACT_FIXTURE_IDENTITY_REQUIRED');
const entry="main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(source.replace(entry,String.raw`module.exports={async recover(ids,tenants){
  config=await readConfig();args={approved:false};db=new(require('pg').Client)({...config.pg,connectionTimeoutMillis:8000});db.on('error',()=>{});await db.connect();connected=true;
  try{
    const before=await snapshot();must(before.sha256==='9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2','CATALOG_DRIFT');
    const shells=(await q("select count(*)::int as count,count(*) filter(where status='terminated')::int as terminated from public.tenants where id=any($1::uuid[])",[tenants])).rows[0];
    const profiles=(await q('select id,tenant_id,status from public.users where id=any($1::uuid[])',[ids])).rows;
    const auth=(await q('select count(*)::int as count from auth.users where id=any($1::uuid[])',[ids])).rows[0];
    must(shells.count===2&&shells.terminated===2&&profiles.length===1&&profiles.every(p=>tenants.includes(p.tenant_id)&&p.status==='inactive')&&auth.count===0,'RECOVERY_GUARD_FAILED');
    const deletion=await q("delete from public.users u where u.id=any($1::uuid[]) and u.tenant_id=any($2::uuid[]) and u.status='inactive' and not exists(select 1 from auth.users a where a.id=u.id)",[ids,tenants]);
    const residual=(await q('select (select count(*)::int from public.users where id=any($1::uuid[])) as profiles,(select count(*)::int from auth.users where id=any($1::uuid[])) as auth',[ids])).rows[0];
    const after=await snapshot();must(deletion.rowCount===1&&residual.profiles===0&&residual.auth===0&&after.sha256===before.sha256,'RECOVERY_POSTCONDITION_FAILED');
    return{result:'PASS_EXACT_OWNED_PROFILE_RECOVERY',projectRef:REF,sourceFailure:'browser-results-2026-10-21T04-17-34-437Z.json',pinnedActorIds:ids,pinnedTenantIds:tenants,profilesBefore:1,authBefore:0,deletedProfiles:1,residual,catalogBefore:before.sha256,catalogAfter:after.sha256,retainedTerminatedShells:2,statementTimeoutMs:30000,lockTimeoutMs:5000};
  }finally{await db.end();}
}};`),file);
mod.exports.recover(actors,tenants).then(result=>{fs.writeFileSync(path.join(__dirname,'profile-recovery.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,deletedProfiles:result.deletedProfiles,residual:result.residual,catalogUnchanged:true}));}).catch(()=>{console.error('EXACT_PROFILE_RECOVERY_FAILED');process.exitCode=1;});
