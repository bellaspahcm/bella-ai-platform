'use strict';
// Read-only E2E catalog diagnostic. No fixtures, business rows, DDL or grants.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const file=path.join(root,'scripts/verify-preschool-care-rls-e2e.cjs');
const source=fs.readFileSync(file,'utf8');
if(crypto.createHash('sha256').update(source).digest('hex')!=='cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9')throw Error('PINNED_SOURCE_CHANGED');
const entry="main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(source.replace(entry,String.raw`module.exports={async inspect(output){
  args={approved:true,output}; config=await readConfig();
  db=new(require('pg').Client)({...config.pg,connectionTimeoutMillis:8000});db.on('error',()=>{});await db.connect();connected=true;
  try {
    await q('begin read only');
    const relations=(await q("select c.relname,c.relkind,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('courses','teacher_assignments') order by c.relname")).rows;
    const columns=(await q("select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('courses','teacher_assignments') order by table_name,ordinal_position")).rows;
    const privileges=(await q("select c.relname,r.rolname,has_table_privilege(r.oid,c.oid,'SELECT') as can_select from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r where n.nspname='public' and c.relname in ('courses','teacher_assignments') and r.rolname in ('anon','authenticated','service_role') order by c.relname,r.rolname")).rows;
    const policies=(await q("select tablename,policyname,roles,cmd,permissive from pg_policies where schemaname='public' and tablename in ('courses','teacher_assignments') order by tablename,policyname")).rows;
    await q('rollback');return{target:REF,mode:'READ_ONLY_CATALOG',businessRowsRead:0,mutations:0,relations,columns,privileges,policies};
  }finally{try{if(transaction||transactionUncertain)await q('rollback');}finally{await db.end();}}
}};`),file);
mod.exports.inspect(__dirname).then(result=>{fs.writeFileSync(path.join(__dirname,'course-prerequisite-catalog.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'PASS_READ_ONLY_CATALOG',target:result.target,mutations:0}));}).catch(()=>{console.error('READ_ONLY_CATALOG_FAILED');process.exitCode=1;});
