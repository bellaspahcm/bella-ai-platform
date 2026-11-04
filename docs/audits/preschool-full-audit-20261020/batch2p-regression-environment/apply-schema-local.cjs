'use strict';
const fs=require('node:fs'),path=require('node:path');
const {root,project,sha,must,connect}=require('./local-runtime.cjs');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const healthcare=process.argv.includes('--healthcare');
const basename=healthcare?'HEALTHCARE_PREREQUISITES':'EDUCATION_PREREQUISITES';
const report={startedAt:new Date().toISOString(),project,stage:'EDUCATION_PREREQUISITES_ONLY',committed:false,statementsExecuted:0,productionAccess:false,e2eAccess:false};
async function main(){
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,`${basename}.json`)));
  must(manifest.target==='OWNED_LOCAL_SANDBOX_ONLY'&&sha(fs.readFileSync(path.join(__dirname,`${basename}.sql`)))===manifest.sqlSha256,'BUNDLE_CHANGED');
  const sources=new Map();
  for(const item of manifest.sources){const bytes=fs.readFileSync(path.join(root,item.path),'utf8');must(sha(bytes)===item.sha256,'CANONICAL_SOURCE_CHANGED');sources.set(item.path,bytes);}
  const statements=manifest.statements.map(item=>{const text=sources.get(item.source).slice(item.start,item.end);must(sha(text)===item.sha256,'CANONICAL_STATEMENT_CHANGED');return text;});
  const {db,config}=await connect();let transaction=false;
  try{
    const tables=(await db.query("select tablename from pg_tables where schemaname='public'")).rows;
    const educationTables=healthcare?JSON.parse(fs.readFileSync(path.join(__dirname,'EDUCATION_PREREQUISITES.json'))).tables:[];
    must(healthcare?JSON.stringify(tables.map(row=>row.tablename).sort())===JSON.stringify(educationTables):tables.length===0,'EXPECTED_LOCAL_DATABASE_SCOPE_REQUIRED');
    const existingCounts={};for(const table of educationTables)existingCounts[table]=Number((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count);
    report.stage=healthcare?'HEALTHCARE_PREREQUISITES_ONLY':report.stage;
    report.containerId=config.containerId;report.publicTablesBefore=tables.length;report.manifestSha256=sha(JSON.stringify(manifest));report.sqlSha256=manifest.sqlSha256;
    await db.query('begin');transaction=true;await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
    for(let index=0;index<statements.length;index++){
      const receipt=manifest.statements[index];report.currentStatement={index,source:receipt.source,line:receipt.line,sha256:receipt.sha256};
      await db.query({text:statements[index],query_timeout:35000});report.statementsExecuted++;
    }
    const actual=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row=>row.tablename);
    must(JSON.stringify(actual)===JSON.stringify([...new Set([...educationTables,...manifest.tables])].sort()),'UNEXPECTED_LOCAL_SCHEMA_SCOPE');
    const counts={};for(const table of actual)counts[table]=Number((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count);
    must(Object.entries(counts).every(([table,count])=>count===(existingCounts[table]||0)),'SCHEMA_PROVISIONING_CHANGED_DATA');
    await db.query('commit');transaction=false;report.committed=true;report.tables=actual;report.rowCounts=counts;
    await db.query("notify pgrst, 'reload schema'");report.result=healthcare?'PASS_EXACT_LOCAL_HEALTHCARE_SCHEMA_NO_DATA_CHANGE':'PASS_EXACT_EMPTY_LOCAL_EDUCATION_SCHEMA';
  }catch(error){if(transaction)try{await db.query('rollback');report.rollback='ACKNOWLEDGED';}catch{report.rollback='NOT_PROVEN';}
    report.result='FAIL_LOCAL_SCHEMA_ROLLED_BACK';report.code=/^[A-Z0-9_]+$/.test(error.code||error.message)?error.code||error.message:'SANITIZED_FAILURE';
    report.position=error.position||null;process.exitCode=1;
  }finally{await db.end();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,`schema-execution-${stamp}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,committed:report.committed,statementsExecuted:report.statementsExecuted,code:report.code,currentStatement:report.currentStatement,rollback:report.rollback}));}
}
main().catch(error=>{console.error(JSON.stringify({result:'LOCAL_SCHEMA_PREFLIGHT_FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
