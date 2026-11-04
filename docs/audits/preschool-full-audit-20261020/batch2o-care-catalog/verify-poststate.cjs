'use strict';
// Independent E2E-only readback. No seed/DDL/recovery path is exported or invoked.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),file=path.join(root,'scripts/verify-preschool-care-rls-e2e.cjs');
const source=fs.readFileSync(file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const progressFiles=fs.readdirSync(__dirname).filter(f=>/^care-rls-progress-2026-10-21T04-(09-14|14-20|17-34)-\d+Z\.json$/.test(f));
if(progressFiles.length!==3)throw Error('EXACT_THREE_FIXTURE_RUNS_REQUIRED');
const fixtureRuns=progressFiles.map(f=>JSON.parse(fs.readFileSync(path.join(__dirname,f))));
if(fixtureRuns.some(r=>r.projectRef!=='bmnbqbcdbuklhopfbopv'||r.fixtureIdentities.length!==2||r.fixtureIdentities.some(f=>f.actors.length!==3)))throw Error('FIXTURE_PROVENANCE_REJECTED');
const tenants=fixtureRuns.flatMap(r=>r.fixtureIdentities.map(f=>f.tenant));
const actors=fixtureRuns.flatMap(r=>r.fixtureIdentities.flatMap(f=>f.actors.map(a=>a.id)));
if(sha(source)!=='cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9')throw Error('PINNED_SOURCE_CHANGED');
const entry="main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
if(source.split(entry).length!==2)throw Error('PINNED_ENTRY_CHANGED');
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(source.replace(entry,String.raw`module.exports={async inspect(tenantIds,actorIds){
  config=await readConfig();args={approved:false};
  db=new(require('pg').Client)({...config.pg,connectionTimeoutMillis:8000});db.on('error',()=>{});await db.connect();connected=true;
  try {
    const catalog=await snapshot();must(catalog.sha256==='9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2','RETAINED_CATALOG_DRIFT');
    const receipts=[];
    for(const table of TARGETS)for(const [role,key]of [['anon',config.publicKey],['service_role',config.adminKey]]){
      const result=await fetch(API+'/rest/v1/'+table+'?select=id&limit=0',{headers:{apikey:key,Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(25000)});
      const payload=await result.json();const code=!Array.isArray(payload)&&typeof payload.code==='string'&&/^[A-Z0-9_]{2,90}$/.test(payload.code)?payload.code:null;
      must(role==='anon'?result.status===401&&code==='42501':result.status===200&&Array.isArray(payload)&&payload.length===0,'INDEPENDENT_REST_PRIVILEGE_MISMATCH');
      receipts.push({table,role,status:result.status,code,limit:0});
    }
    const residual={};
    for(const table of ['edu_daily_care_records','edu_daily_care_sessions','edu_attendance_daily_state','edu_enrollments','preschool_chain_course_branch_assignments','party_parties','edu_courses','org_relationships','people_directory','org_units'])residual[table]=(await q('select count(*)::int as count from public.'+table+' where tenant_id=any($1::uuid[])',[tenantIds])).rows[0].count;
    for(const schema of ['auth','public'])residual[schema+'_users']=(await q('select count(*)::int as count from '+schema+'.users where id=any($1::uuid[])',[actorIds])).rows[0].count;
    const shells=(await q("select count(*)::int as shells,count(*) filter(where status is distinct from 'terminated')::int as authoritative from public.tenants where id=any($1::uuid[])",[tenantIds])).rows[0];
    must(Object.values(residual).every(count=>count===0)&&shells.shells===tenantIds.length&&shells.authoritative===0,'INDEPENDENT_RESIDUE_CHECK_FAILED');
    return{target:REF,result:'PASS_SCOPED_POSTSTATE',catalogSha256:catalog.sha256,receipts,residual,retainedTerminatedShells:shells.shells,syntheticRunsVerified:3,mutations:0,businessRowContentsPersisted:false};
  }finally{await db.end();}
}};`),file);
mod.exports.inspect(tenants,actors).then(result=>{const before=JSON.parse(fs.readFileSync(path.join(__dirname,'FROZEN_BEFORE.json'))).files;
  for(const [f,h]of Object.entries(before))if(sha(fs.readFileSync(path.join(root,f)))!==h)throw Error('EXISTING_FROZEN_FILE_CHANGED');
  result.existingFrozenFilesUnchanged=Object.keys(before).length;
  fs.writeFileSync(path.join(__dirname,'poststate.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,requests:result.receipts.length,existingFrozenFilesUnchanged:result.existingFrozenFilesUnchanged,mutations:0}));
}).catch(()=>{console.error('INDEPENDENT_POSTSTATE_FAILED');process.exitCode=1;});
