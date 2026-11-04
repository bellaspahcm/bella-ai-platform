const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const e=dotenv.parse(fs.readFileSync('.env.local'));
const pub=e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=e.SUPABASE_SECRET_KEY||e.SUPABASE_SERVICE_ROLE_KEY;
function role(key){try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role;}catch{return key.startsWith('sb_publishable_')?'publishable':key.startsWith('sb_secret_')?'secret':'unknown';}}
const target='ed100000-0000-0000-0000-000000000001'; // Exact existing runtime default, not a fixture or new identity.
async function read(table,key,filter,limit=1){
  const response=await fetch(e.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+table+'?select=tenant_id&'+(filter?'tenant_id=eq.'+target+'&':'')+'limit='+limit,{headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  return {table,status:response.status,contentRange:response.headers.get('content-range'),rowCount:Array.isArray(data)?data.length:undefined,matchesRequestedTenant:Array.isArray(data)&&data.length&&filter?data.every(r=>r.tenant_id===target):undefined,distinctTenantsInSample:Array.isArray(data)?new Set(data.map(r=>r.tenant_id)).size:undefined,errorCode:data?.code};
}
async function main(){
  const reads=[];
  for(const table of ['students','edu_fin_invoices','edu_fac_assets','edu_courses','edu_attendance_daily_state'])reads.push(await read(table,pub,true));
  const crossTenant=[];
  for(const table of ['students','edu_fin_invoices','edu_fac_assets'])crossTenant.push(await read(table,pub,false,100));
  const schema=[];
  for(const table of ['preschool_chain_course_branch_assignments','preschool_chain_enrollment_branch_assignments','user_org_unit_access','edu_daily_care_records','edu_comm_notices','edu_fin_tuition_service_period_completions']){
    const response=await fetch(e.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+table+'?select=*&limit=0',{headers:{apikey:admin,Authorization:'Bearer '+admin},signal:AbortSignal.timeout(15000)});const j=await response.json();schema.push({table,status:response.status,errorCode:j?.code});
  }
  const report={checkedAt:new Date().toISOString(),environment:'.env.local configured remote; active production identity not proven',publicKeyRole:role(pub),adminKeyRole:role(admin),publicEqualsAdmin:pub===admin,userJwt:false,cookies:false,reads,crossTenant,schema,notes:'GET only; sampled tenant identifiers were summarized without saving row values. This proves observed anonymous SELECT behavior, not exact deployed policy text or write permissions.'};
  fs.writeFileSync(path.join(__dirname,'anonymous-rls-readback.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.name);process.exitCode=1;});
