const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const d=__dirname,pre=JSON.parse(fs.readFileSync(path.join(d,'rpc-pre.json'))),q=s=>'"'+s.replaceAll('"','""')+'"',lit=s=>"'"+s.replaceAll("'","''")+"'";
// Preserve every current non-anonymous role's effective EXECUTE privilege. No new effective privileges or grant options.
const existing=pre.function_grants.filter(g=>g.grantee!=='PUBLIC'&&g.grantee!=='anon');
const preserved=pre.roles.filter(r=>r.name!=='anon'&&r.execute&&!r.superuser&&!existing.some(g=>g.grantee===r.name)).map(r=>r.name);
assert(!pre.memberships.some(m=>m.member==='anon'));assert(pre.function_grants.find(g=>g.grantee==='PUBLIC'&&!g.grantable));
const normalize=x=>({...x,memberships:x.memberships.map(({grantor,...m})=>m)});
let query=fs.readFileSync(path.join(d,'rpc-catalog-query.sql'),'utf8').trim().replace(/;$/,'');
query=query.replace('FROM pg_roles r)',"FROM pg_roles r WHERE r.rolname<>'acl_rehearsal_superuser')");
// OID-independent ACL ordering, and ignore rehearsal-only membership grantor identity.
query=query.replace('ORDER BY a.grantee,a.grantor','ORDER BY CASE WHEN a.grantee=0 THEN \'PUBLIC\' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor)');
query=`SELECT evidence - 'memberships' || jsonb_build_object('memberships',(SELECT jsonb_agg(m - 'grantor' ORDER BY m->>'role',m->>'member') FROM jsonb_array_elements(evidence->'memberships') m)) AS evidence FROM (${query}) all_rpc_catalog`;
const canonicalPre=normalize(structuredClone(pre));
canonicalPre.function_grants.sort((a,b)=>a.grantee.localeCompare(b.grantee,'en',{caseFirst:'upper'}));
// PostgreSQL database collation sorts these ASCII role names lexically; explicit JS comparator avoids locale drift.
canonicalPre.function_grants.sort((a,b)=>a.grantee<b.grantee?-1:a.grantee>b.grantee?1:0);
const post=structuredClone(canonicalPre);
post.function_grants=existing.concat(preserved.map(name=>({grantor:'postgres',grantee:name,privilege:'EXECUTE',grantable:false}))).sort((a,b)=>a.grantee<b.grantee?-1:a.grantee>b.grantee?1:0);
const acl=pre.function.acl.slice(1,-1).split(',').filter(x=>!x.startsWith('=')&&!x.startsWith('anon='));
for(const name of preserved)acl.push(name+'=X/postgres');
post.function.acl='{'+acl.join(',')+'}';
post.roles.find(r=>r.name==='anon').execute=false;
for(const x of post.dynamic_candidates)if(x.name==='exec_sql'){x.anon_execute=false;x.acl=post.function.acl;}
const delta=`REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public.exec_sql(text) TO ${preserved.map(q).join(', ')};\n`;
function guard(expected,label){return `DO $${label}$ DECLARE actual jsonb; BEGIN SELECT evidence INTO actual FROM (${query}) rpc_catalog; IF actual IS DISTINCT FROM ${lit(JSON.stringify(expected))}::jsonb THEN RAISE EXCEPTION '${label}: RPC/role/dependency drift'; END IF; END $${label}$;\n`;}
const old=fs.readFileSync(path.join(d,'../batch2a/EXECUTE_APPROVED_32_TABLE_ANON_CONTAINMENT.sql'),'utf8');
const artifact=old.replace('-- OWNER AUTHORIZED 2026-10-20: exact32-table ACL-only containment.','-- OWNER AUTHORIZED 2026-10-20 plus 2026-10-21: exact32-table ACL and one RPC EXECUTE boundary.')
 .replace('-- CHANGE_BEGIN',guard(canonicalPre,'rpc_precondition')+'-- CHANGE_BEGIN\n'+delta)
 .replace("SELECT jsonb_build_object('result','ACL_POSTCONDITIONS_PASS'",guard(post,'rpc_postcondition')+"SELECT jsonb_build_object('result','ACL_POSTCONDITIONS_PASS'");
fs.writeFileSync(path.join(d,'rpc-fingerprint-query.sql'),query+';\n');
fs.writeFileSync(path.join(d,'rpc-pre-fingerprint.json'),JSON.stringify(canonicalPre,null,2)+'\n');
fs.writeFileSync(path.join(d,'rpc-expected-post.json'),JSON.stringify(post,null,2)+'\n');
fs.writeFileSync(path.join(d,'EXECUTE_APPROVED_32_TABLE_ANON_CONTAINMENT.sql'),artifact);
fs.copyFileSync(path.join(d,'../batch2a/expected-post-fingerprint.json'),path.join(d,'expected-post-fingerprint.json'));
fs.writeFileSync(path.join(d,'execution-manifest.json'),JSON.stringify({target:'lvnvkpyxtuilhrabtlwv',ownerApprovalDates:['2026-10-20','2026-10-21'],source:'339c89250d87964ba8d58860a5ecdbc0bdde4956',tables:JSON.parse(fs.readFileSync(path.join(d,'../batch1/reviewed-scope.json'))).tables,rpc:'public.exec_sql(text)',rpcDelta:delta,preservedPreviouslyEffectiveNonAnonRoles:preserved,explicitCommit:true,lockTimeoutSeconds:5,statementTimeoutSeconds:30,sha256:crypto.createHash('sha256').update(artifact).digest('hex'),bytes:Buffer.byteLength(artifact),scope:'One RPC EXECUTE ACL and exact32 table ACLs only. No body/policy/membership/schema/default/data changes.'},null,2)+'\n');
console.log(JSON.stringify({artifactSha256:crypto.createHash('sha256').update(artifact).digest('hex'),bytes:Buffer.byteLength(artifact),nonAnonImplicitExecuteConvertedToExplicit:preserved.length}));
