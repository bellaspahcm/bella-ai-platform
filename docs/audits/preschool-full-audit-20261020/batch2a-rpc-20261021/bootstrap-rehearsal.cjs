const fs=require('node:fs'),path=require('node:path');const {Client}=require('pg');
const d=__dirname,pre=JSON.parse(fs.readFileSync(path.join(d,'production-pre-fingerprint.json')));
const names=pre.tables.map(t=>t.name),q=s=>'"'+s.replaceAll('"','""')+'"',lit=s=>"'"+s.replaceAll("'","''")+"'",role=s=>s.toLowerCase()==='public'||!s?'PUBLIC':q(s);
const pg=new Client({host:'127.0.0.1',port:56329,database:'postgres',user:'acl_rehearsal_superuser',connectionTimeoutMillis:4000});
async function main(){
 await pg.connect();
 if((await pg.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows[0].n!==0)throw Error('Rehearsal database is not empty');
 await pg.query('BEGIN');
 const extra=['bella_developer','bella_migration_executor','verification_executor','supabase_auth_admin','dashboard_user'];
 for(const r of pre.roles)await pg.query(`CREATE ROLE ${q(r.name)} ${r.can_login?'LOGIN':'NOLOGIN'} ${r.inherit?'INHERIT':'NOINHERIT'} ${r.bypass_rls?'BYPASSRLS':'NOBYPASSRLS'} NOSUPERUSER`);
 for(const r of extra)await pg.query(`CREATE ROLE ${q(r)} NOLOGIN`);
 for(const m of pre.memberships)await pg.query(`GRANT ${q(m.role)} TO ${q(m.member)}${m.admin_option?' WITH ADMIN OPTION':''}`);
 await pg.query('GRANT ALL ON SCHEMA public TO postgres; CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; GRANT USAGE ON SCHEMA auth TO PUBLIC; SET ROLE postgres');
 // Empty prerequisite references only; no production rows copied. Their full business schemas are not under test.
 await pg.query("CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text,product_key text); CREATE TABLE public.users(id uuid PRIMARY KEY,tenant_id uuid,status text,role text); CREATE TABLE public.party_parties(id uuid PRIMARY KEY); CREATE TABLE public.persons(id uuid PRIMARY KEY)");
 for(const t of pre.tables){const cols=pre.columns.filter(c=>c.table_name===t.name).map(c=>`${q(c.name)} ${c.type}${c.default_expression?' DEFAULT '+c.default_expression:''}${c.not_null?' NOT NULL':''}`);await pg.query(`CREATE TABLE public.${q(t.name)}(${cols.join(',')})`);}
 for(const c of pre.constraints.filter(c=>c.contype!=='f'))await pg.query(`ALTER TABLE public.${q(c.table_name)} ADD CONSTRAINT ${q(c.conname)} ${c.definition}`);
 for(const c of pre.constraints.filter(c=>c.contype==='f'))await pg.query(`ALTER TABLE public.${q(c.table_name)} ADD CONSTRAINT ${q(c.conname)} ${c.definition}`);
 const funcs=[...pre.functions].sort((a,b)=>(a.name==='is_hq_admin'?1:0)-(b.name==='is_hq_admin'?1:0));
 await pg.query('RESET ROLE');
 for(const f of funcs){
   await pg.query(`SET ROLE ${q(f.owner)}`);await pg.query(f.definition);
   const object=`${q(f.schema)}.${q(f.name)}(${f.arguments})`;
   await pg.query(`REVOKE ALL ON FUNCTION ${object} FROM PUBLIC,${q(f.owner)}`);
   for(const a of (f.acl||'').slice(1,-1).split(',').filter(Boolean)){const m=a.match(/^([^=]*)=([^/]+)\/(.+)$/);if(!m)throw Error('Unparsed function ACL');await pg.query(`GRANT EXECUTE ON FUNCTION ${object} TO ${role(m[1])}${m[2].includes('*')?' WITH GRANT OPTION':''}`);}
   await pg.query('RESET ROLE');
 }
 await pg.query('SET ROLE postgres');
 for(const t of pre.tables){if(t.rls_enabled)await pg.query(`ALTER TABLE public.${q(t.name)} ENABLE ROW LEVEL SECURITY`);if(t.rls_forced)await pg.query(`ALTER TABLE public.${q(t.name)} FORCE ROW LEVEL SECURITY`);}
 for(const p of pre.policies)await pg.query(`CREATE POLICY ${q(p.policyname)} ON public.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(role).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''}`);
 for(const t of pre.triggers)await pg.query(t.definition);
 for(const g of pre.grants)await pg.query(`GRANT ${g.privilege_type} ON TABLE public.${q(g.table_name)} TO ${role(g.grantee)}${g.is_grantable?' WITH GRANT OPTION':''}`);
 await pg.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO bella_developer; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO bella_migration_executor; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO verification_executor; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO bella_migration_executor; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role');
 await pg.query('COMMIT');
 const actual=(await pg.query(fs.readFileSync(path.join(d,'fingerprint-query.sql'),'utf8'))).rows[0].evidence;
 fs.writeFileSync(path.join(d,'rehearsal-pre-fingerprint.json'),JSON.stringify(actual,null,2)+'\n');
 function canonical(x){return Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;}
 const diff=Object.keys(pre).filter(k=>JSON.stringify(canonical(pre[k]))!==JSON.stringify(canonical(actual[k])));
 const proof={target:'loopback-only PostgreSQL17.10 :56329',sourceProject:'lvnvkpyxtuilhrabtlwv',approvedTables:names.length,columns:pre.columns.length,constraints:pre.constraints.length,policies:pre.policies.length,functions:pre.functions.length,triggers:pre.triggers.length,prerequisiteTables:['tenants(id,status,product_key)','users(id,tenant_id,status,role)','party_parties(id)','persons(id)'],productionBusinessRowsCopied:0,exactSelectedFingerprintMatch:diff.length===0,differentGroups:diff};
 fs.writeFileSync(path.join(d,'rehearsal-bootstrap.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));if(diff.length)process.exitCode=1;
}
main().catch(async error=>{await pg.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1;}).finally(()=>pg.end());
