'use strict';
const fs=require('node:fs'),path=require('node:path');
const {root,project,connect,sha,must}=require('./local-runtime.cjs');
const source='supabase/migrations/20260523030000_grant_service_role_schema_access.sql';
const sql=fs.readFileSync(path.join(root,source),'utf8');
async function main(){
  must(!/\b(?:INSERT|UPDATE|DELETE|DROP|DISABLE)\b/i.test(sql),'UNEXPECTED_PREREQUISITE_CONTENT');
  const {db}=await connect();let transaction=false;
  const receipt={startedAt:new Date().toISOString(),project,source,sourceSha256:sha(sql),scope:'Declared service-role fixture access in owned local schema only; not Auth/RLS proof',businessDataChanges:0};
  try{
    const before=(await db.query("select tablename,has_table_privilege('service_role','public.'||tablename,'SELECT,INSERT,UPDATE,DELETE') as access from pg_tables where schemaname='public' order by tablename")).rows;
    const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'EDUCATION_PREREQUISITES-initial.json'))).tables;
    must(JSON.stringify(before.map(row=>row.tablename))===JSON.stringify(expected),'LOCAL_SCHEMA_SCOPE_CHANGED');
    for(const table of expected)must(Number((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count)===0,'LOCAL_DATA_NOT_EMPTY');
    await db.query('begin');transaction=true;await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
    await db.query(sql);
    const after=(await db.query("select tablename,has_table_privilege('service_role','public.'||tablename,'SELECT,INSERT,UPDATE,DELETE') as access from pg_tables where schemaname='public' order by tablename")).rows;
    must(after.every(row=>row.access),'SERVICE_ROLE_PREREQUISITE_NOT_EFFECTIVE');
    await db.query('commit');transaction=false;receipt.before=before;receipt.after=after;receipt.result='PASS_CANONICAL_LOCAL_SERVICE_FIXTURE_PREREQUISITE';
  }finally{if(transaction)await db.query('rollback');await db.end();receipt.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'local-service-prerequisite.json'),JSON.stringify(receipt,null,2)+'\n');}
  console.log(JSON.stringify({result:receipt.result,tables:receipt.after.length,businessDataChanges:0}));
}
main().catch(error=>{console.error(JSON.stringify({result:'LOCAL_SERVICE_PREREQUISITE_FAILED',code:/^[A-Z0-9_]+$/.test(error.code||error.message)?error.code||error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
