'use strict';
const fs=require('node:fs'),path=require('node:path');
const {root,project,sha,must,connect}=require('./local-runtime.cjs');
const source='src/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures.ts';
const bytes=fs.readFileSync(path.join(root,source),'utf8');
const id=/HEALTHCARE_TEST_TENANT_ID = '([0-9a-f-]{36})'/.exec(bytes)?.[1];
must(id==='00000000-0000-0000-0000-000000000001','DECLARED_FIXTURE_ID_CHANGED');
connect().then(async({db})=>{
  try{
    const exists=(await db.query('select count(*)::int as count from public.tenants where id=$1',[id])).rows[0].count;
    must(exists===0,'LOCAL_HEALTHCARE_FIXTURE_ALREADY_EXISTS');
    const inserted=await db.query("insert into public.tenants(id,name,status) values($1,'Isolated local Healthcare regression fixture','active')",[id]);
    must(inserted.rowCount===1,'FIXTURE_INSERT_NOT_PROVEN');
    fs.writeFileSync(path.join(__dirname,'local-healthcare-fixture.json'),JSON.stringify({capturedAt:new Date().toISOString(),project,source,sourceSha256:sha(bytes),declaredTenantId:id,insertedRows:1,syntheticOnly:true,productionAccess:false,e2eAccess:false,result:'PASS_DECLARED_LOCAL_HEALTHCARE_FIXTURE'},null,2)+'\n');
    console.log(JSON.stringify({result:'PASS_DECLARED_LOCAL_HEALTHCARE_FIXTURE',insertedRows:1}));
  }finally{await db.end();}
}).catch(error=>{console.error(JSON.stringify({result:'LOCAL_FIXTURE_FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
