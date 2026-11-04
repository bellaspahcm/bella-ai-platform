const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Client}=require('pg');
const d=__dirname,pre=JSON.parse(fs.readFileSync(path.join(d,'rpc-pre.json'))),q=s=>'"'+s.replaceAll('"','""')+'"';
const pg=new Client({host:'127.0.0.1',port:56329,database:'postgres',user:'acl_rehearsal_superuser'});
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x;
async function main(){await pg.connect();await pg.query('BEGIN');
 for(const r of pre.roles){const found=(await pg.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[r.name])).rowCount;if(r.name.startsWith('pg_')){assert(found,'Missing built-in role');continue;}await pg.query(`${found?'ALTER':'CREATE'} ROLE ${q(r.name)} ${r.login?'LOGIN':'NOLOGIN'} ${r.superuser?'SUPERUSER':'NOSUPERUSER'} ${r.inherit?'INHERIT':'NOINHERIT'} ${r.bypass_rls?'BYPASSRLS':'NOBYPASSRLS'}`);}
 for(const m of pre.memberships)await pg.query(`GRANT ${q(m.role)} TO ${q(m.member)} WITH ADMIN ${m.admin?'TRUE':'FALSE'}, INHERIT ${m.inherit?'TRUE':'FALSE'}, SET ${m.set?'TRUE':'FALSE'}`);
 await pg.query('SET ROLE postgres');await pg.query(pre.function.definition);
 await pg.query('REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC,postgres,service_role,bella_migration_executor');
 for(const g of pre.function_grants)await pg.query(`GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO ${g.grantee==='PUBLIC'?'PUBLIC':q(g.grantee)}${g.grantable?' WITH GRANT OPTION':''}`);
 await pg.query('COMMIT');
 const actual=(await pg.query(fs.readFileSync(path.join(d,'rpc-fingerprint-query.sql'),'utf8'))).rows[0].evidence;
 const expected=JSON.parse(fs.readFileSync(path.join(d,'rpc-pre-fingerprint.json')));
 fs.writeFileSync(path.join(d,'rehearsal-rpc-pre.json'),JSON.stringify(actual,null,2)+'\n');
 assert.deepEqual(canon(actual),canon(expected));
 console.log(JSON.stringify({exactRpcAndRoleMembershipSemanticFingerprintMatch:true,productionRowsCopied:0,roles:pre.roles.length}));
}
main().catch(async e=>{await pg.query('ROLLBACK').catch(()=>{});console.error(e.message.slice(0,1800));process.exitCode=1;}).finally(()=>pg.end());
