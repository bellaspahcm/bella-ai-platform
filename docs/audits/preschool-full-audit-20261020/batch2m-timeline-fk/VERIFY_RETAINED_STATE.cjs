/* Read-only, separate-process verification. No schema/business mutations. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const file = path.join(root, 'scripts/verify-preschool-care-rls-e2e.cjs');
const source = fs.readFileSync(file, 'utf8');
const entry = "main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
if (source.split(entry).length !== 2) throw new Error('ENTRY_MISMATCH');
const name = process.argv[2];
if (!/^care-rls-results-[0-9TZ-]+\.json$/.test(name || '')) throw new Error('EXACT_LOCAL_REPORT_REQUIRED');
const prior = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
if (crypto.createHash('sha256').update(source).digest('hex') !== prior.harnessSha256) throw new Error('EXECUTED_HARNESS_CHANGED');
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(path.dirname(file));
compiled._compile(source.replace(entry, String.raw`module.exports = async () => {
  const folder = join(ROOT, 'docs/audits/preschool-full-audit-20261020/batch2m-timeline-fk');
  const prior = JSON.parse(readFileSync(join(folder, process.argv[2]), 'utf8'));
  must(prior.projectRef === REF && prior.functionalAcceptance === 'PASS'
    && prior.recovery.retainedOnExplicitApprovedPass && prior.timelineFk.recovery.retainedOnApprovedPass, 'NO_PROVEN_RETAINED_RUN');
  const progress = JSON.parse(readFileSync(join(folder, process.argv[2].replace('results-', 'progress-')), 'utf8'));
  must(progress.projectRef === REF && progress.harnessSha256 === prior.harnessSha256
    && progress.fixtureIdentities.length === 2 && progress.fixtureIdentities.flatMap(f=>f.actors).length === 6, 'FIXTURE_IDENTITY_RECEIPT_REJECTED');
  args = { approved: false }; config = await readConfig();
  const result = { projectRef: REF, startedAt: new Date().toISOString(), readOnly: true,
    sourceReport: process.argv[2], sourceHarnessSha256: prior.harnessSha256, requests: [] };
  try {
    const liveSource = sourceState(); must(liveSource.sha256 === prior.sourceAfter.sha256 && !liveSource.changed.length && !liveSource.untracked.length && !liveSource.environmentFiles.length, 'RUNTIME_SOURCE_DRIFT');
    db = new (require('pg').Client)({ ...config.pg, connectionTimeoutMillis: 8000 }); await db.connect();
    const live = await snapshot(); must(live.sha256 === prior.after.sha256, 'RETAINED_CATALOG_DRIFT');
    result.catalogSha256 = live.sha256; result.controlsUnchanged = jsonHash(live.controls) === jsonHash(prior.after.controls);
    const tenants = progress.fixtureIdentities.map(f=>f.tenant), actors = progress.fixtureIdentities.flatMap(f=>f.actors.map(a=>a.id));
    result.residualCounts = {};
    for (const table of ['edu_daily_care_records','edu_daily_care_sessions','edu_attendance_daily_state','edu_enrollments','preschool_chain_course_branch_assignments','party_parties','edu_courses','org_relationships','people_directory','org_units'])
      result.residualCounts[table] = (await q('select count(*)::int as count from public.'+table+' where tenant_id=any($1::uuid[])',[tenants])).rows[0].count;
    for (const schema of ['auth','public']) result.residualCounts[schema+'_users'] = (await q('select count(*)::int as count from '+schema+'.users where id=any($1::uuid[])',[actors])).rows[0].count;
    must(Object.values(result.residualCounts).every(n=>n===0),'OWNED_FIXTURE_RESIDUE');
    result.newRelationTotals = {};
    for (const table of CREATED) result.newRelationTotals[table] = (await q('select count(*)::int as count from public.'+table)).rows[0].count;
    must(Object.values(result.newRelationTotals).every(n=>n===0),'UNACCOUNTED_NEW_RELATION_DATA');
    const shells = (await q("select count(*)::int as count,count(*) filter(where status is distinct from 'terminated')::int as active from public.tenants where id=any($1::uuid[])",[tenants])).rows[0];
    must(shells.count===2 && shells.active===0,'TENANT_AUTHORITY_RESIDUE'); result.terminatedTenantShells=shells.count;
    for (const table of TARGETS) for (const [role,key,expected] of [['anon',config.publicKey,[401,403]],['service_role',config.adminKey,[200]]]) {
      const response = await remoteFetch(API+'/rest/v1/'+table+'?select=id&limit=0',{headers:{apikey:key,Authorization:'Bearer '+key}});
      let payload; try { payload=await response.json(); } catch { fail('REST_JSON_REQUIRED'); }
      const code = typeof payload?.code==='string' && /^[A-Z0-9_]{2,90}$/.test(payload.code) ? payload.code : null;
      result.requests.push({table,role,status:response.status,code,requestedLimit:0});
      must(expected.includes(response.status) && (role==='anon' ? code==='42501' : Array.isArray(payload)&&payload.length===0),'POSTSTATE_ACL_REQUEST_FAILED');
    }
    must((await snapshot()).sha256===live.sha256,'POSTSTATE_CATALOG_CHANGED'); result.result='PASS_POSTSTATE_ONLY';
  } catch (error) { result.result='FAIL'; result.code=safeCode(error); }
  finally { if(db) try { await db.end(); } catch { result.result='FAIL'; result.closeFailure=true; } }
  result.finishedAt=new Date().toISOString(); writeFileSync(join(folder,'independent-poststate.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({result:result.result,code:result.code,catalogSha256:result.catalogSha256,requests:result.requests.length}));
  process.exitCode=result.result==='PASS_POSTSTATE_ONLY'?0:1;
};`), file);
compiled.exports().catch(() => { console.error('POSTSTATE_VERIFICATION_FAILED_SANITIZED'); process.exitCode = 1; });
