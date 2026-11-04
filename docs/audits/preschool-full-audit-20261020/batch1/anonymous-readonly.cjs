const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const e=dotenv.parse(fs.readFileSync('.env.local'));
const expected='https://lvnvkpyxtuilhrabtlwv.supabase.co';
const api=new URL(e.NEXT_PUBLIC_SUPABASE_URL).origin;
if(api!==expected)throw Error('Target changed; review environment before probing');
const key=e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
if(claims.role!=='anon'||claims.ref!=='lvnvkpyxtuilhrabtlwv')throw Error('Expected matching anonymous public key');
async function main(){
  const rows=[];
  for(const table of ['students','edu_fin_invoices','edu_fac_assets','edu_courses']){
    const url=api+'/rest/v1/'+table+'?select=tenant_id&tenant_id=eq.ed100000-0000-0000-0000-000000000001&limit=1';
    const res=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
    const j=await res.json();
    rows.push({table,status:res.status,contentRange:res.headers.get('content-range'),sampleRowCount:Array.isArray(j)?j.length:undefined,sampleMatchesTargetTenant:Array.isArray(j)&&j.length?j.every(r=>r.tenant_id==='ed100000-0000-0000-0000-000000000001'):undefined,errorCode:j?.code});
  }
  const result={checkedAt:new Date().toISOString(),endpoint:api,publicKeyRole:claims.role,projectRef:claims.ref,userJwt:false,cookies:false,method:'GET only',reads:rows,valuesSaved:'Only counts/status/boolean; no returned tenant_id values or business fields'};
  fs.writeFileSync(path.join(__dirname,'anonymous-runtime-readback.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.name);process.exitCode=1;});
