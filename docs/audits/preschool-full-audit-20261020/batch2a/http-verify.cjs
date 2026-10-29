const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');const d=__dirname;
const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('Explicit phase required');
const e=dotenv.parse(fs.readFileSync('.env.local'));const origin=new URL(e.NEXT_PUBLIC_SUPABASE_URL).origin;
if(origin!=='https://lvnvkpyxtuilhrabtlwv.supabase.co')throw Error('Wrong target');
const key=e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY;const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
if(claim.role!=='anon'||claim.ref!=='lvnvkpyxtuilhrabtlwv')throw Error('Not matching anon public key');
const names=JSON.parse(fs.readFileSync(path.join(d,'../batch1/reviewed-scope.json'))).tables;
async function main(){
 const rows=[];
 for(const table of names){const variants=phase==='after'?['none','own-tenant','other-tenant']:['none'];for(const variant of variants){
   const filter=variant==='none'?'':variant==='own-tenant'?'&tenant_id=eq.ed100000-0000-0000-0000-000000000001':'&tenant_id=eq.00000000-0000-4000-8000-000000000099';
   const res=await fetch(origin+'/rest/v1/'+table+'?select=tenant_id&limit=1'+filter,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});const body=await res.json().catch(()=>null);
   rows.push({table,variant,status:res.status,errorCode:body?.code,returnedRowCount:Array.isArray(body)?body.length:0,denied:res.status>=400&&body?.code==='42501'});
 }}
 const api=await fetch('https://bella-spa-erp.vercel.app/api/education/courses?tenantId=ed100000-0000-0000-0000-000000000001',{signal:AbortSignal.timeout(30000)});const body=await api.json().catch(()=>null);
 const result={checkedAt:new Date().toISOString(),phase,project:'lvnvkpyxtuilhrabtlwv',session:'anon public key only, no user JWT or cookies',reads:rows,directTablesVerified:new Set(rows.map(r=>r.table)).size,allDirectReadsDenied:rows.every(r=>r.denied),coursesApi:{status:api.status,classrooms:Array.isArray(body?.classrooms)?body.classrooms.length:0,returnsClassrooms:Array.isArray(body?.classrooms)&&body.classrooms.length>0,pathClassification:'Known service-role server API path, not direct anon table privileges; Batch2B'},businessRowValuesSaved:false};
 fs.writeFileSync(path.join(d,'http-'+phase+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({phase,requests:rows.length,tables:result.directTablesVerified,allDenied:result.allDirectReadsDenied,coursesApi:result.coursesApi}));
 if(phase==='after'&&!result.allDirectReadsDenied)process.exitCode=1;
}
main().catch(error=>{console.error(error.name);process.exitCode=1;});
