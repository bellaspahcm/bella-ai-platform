'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {root,project,sha,must,connect}=require('./local-runtime.cjs');
const ts=require(path.join(root,'node_modules/typescript'));
const seedPath='scripts/seed-healthcare-test-data.js',source=fs.readFileSync(path.join(root,seedPath),'utf8');
const parsed=ts.createSourceFile(seedPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let literal;
for(const statement of parsed.statements)if(ts.isVariableStatement(statement))for(const item of statement.declarationList.declarations)if(item.name.getText(parsed)==='TEST_DATA')literal=item.initializer;
function value(node){
  if(ts.isStringLiteral(node))return node.text;
  if(ts.isArrayLiteralExpression(node))return node.elements.map(value);
  if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(item=>{must(ts.isPropertyAssignment(item),'FIXTURE_LITERAL_REQUIRED');return[item.name.getText(parsed),value(item.initializer)];}));
  throw Error('FIXTURE_LITERAL_REQUIRED');
}
must(literal,'DECLARED_FIXTURE_DATA_NOT_FOUND');const data=value(literal);
const smokeSource='src/platform/healthcare/engines/encounter-engine/__tests__/supabase-smoke.test.ts';
const smoke=fs.readFileSync(path.join(root,smokeSource),'utf8');
const smokeTenant=/const TEST_TENANT = '([0-9a-f-]{36})'/.exec(smoke)?.[1],smokePatient=/const TEST_PATIENT = '([0-9a-f-]{36})'/.exec(smoke)?.[1];
must(smokeTenant&&smokePatient,'DECLARED_SMOKE_FIXTURE_CHANGED');
const tenants=[{id:'00000000-0000-0000-0000-000000000001',name:'Synthetic common Healthcare fixture',status:'active'},...data.tenants,{id:smokeTenant,name:'Synthetic isolated smoke fixture',status:'active'}];
const parties=[...data.patients,...data.providers,{id:smokePatient,tenant_id:smokeTenant,party_type:'person',display_name:'Synthetic isolated smoke party'}];
const reserve={tenant:crypto.randomUUID(),patient:crypto.randomUUID(),provider:crypto.randomUUID(),journey:crypto.randomUUID(),encounter:crypto.randomUUID()};
tenants.push({id:reserve.tenant,name:'Synthetic reserved repository fixture',status:'active'});
parties.push({id:reserve.patient,tenant_id:reserve.tenant,party_type:'person',display_name:'Synthetic reserved patient'},
  {id:reserve.provider,tenant_id:reserve.tenant,party_type:'person',display_name:'Synthetic reserved provider'});
connect().then(async({db})=>{let transaction=false;
  try{
    const existing=Number((await db.query('select count(*)::int as count from public.tenants where id=any($1::uuid[])',[tenants.map(item=>item.id)])).rows[0].count);must(existing===0,'FRESH_DECLARED_FIXTURE_SCOPE_REQUIRED');
    await db.query('begin');transaction=true;await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
    for(const item of tenants)await db.query('insert into public.tenants(id,name,status) values($1,$2,$3)',[item.id,item.name,item.status]);
    for(const item of parties)await db.query('insert into public.party_parties(id,tenant_id,party_type,display_name) values($1,$2,$3,$4)',[item.id,item.tenant_id,item.party_type,item.display_name]);
    await db.query("insert into public.journey_journeys(id,tenant_id,primary_party_id,journey_type,vertical,status) values($1,$2,$3,'clinical_journey','healthcare','active')",[reserve.journey,reserve.tenant,reserve.patient]);
    await db.query("insert into public.hc_encounters(id,tenant_id,patient_party_id,doctor_party_id,care_journey_id,encounter_class,encounter_type,status,period_start,started_at) values($1,$2,$3,$4,$5,'AMB','outpatient','in-progress',now(),now())",[reserve.encounter,reserve.tenant,reserve.patient,reserve.provider,reserve.journey]);
    await db.query('commit');transaction=false;
    const receipt={capturedAt:new Date().toISOString(),project,result:'PASS_DECLARED_SYNTHETIC_HEALTHCARE_FIXTURES',sources:[{path:seedPath,sha256:sha(source)},{path:smokeSource,sha256:sha(smoke)}],
      syntheticOnly:true,businessDataCopied:false,tenantCount:tenants.length,partyCount:parties.length,reservedEncounterCount:1,reserveIds:reserve,
      note:'Only UUIDs from the frozen smoke fixture are reused. Its real-name comment and any database row are not copied. Reserved encounter satisfies the repository suite declared pre-existing encounter requirement.'};
    fs.writeFileSync(path.join(__dirname,'declared-healthcare-fixtures.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:receipt.result,tenantCount:tenants.length,partyCount:parties.length,reservedEncounterCount:1}));
  }finally{if(transaction)await db.query('rollback');await db.end();}
}).catch(error=>{console.error(JSON.stringify({result:'DECLARED_LOCAL_FIXTURE_FAILED',code:/^[A-Z0-9_]+$/.test(error.code||error.message)?error.code||error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
