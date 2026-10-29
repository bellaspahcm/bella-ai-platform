const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');const d=__dirname;
const candidate=JSON.parse(fs.readFileSync(path.join(d,'dynamic-access-cli.json'))).rows[0].evidence.candidates.find(f=>f.name==='exec_sql'&&f.arguments==='sql_query text');
if(!candidate?.anon_execute||!candidate.definition.includes('EXECUTE sql_query;'))throw Error('Blocker definition changed');
const e=dotenv.parse(fs.readFileSync('.env.local')),origin=new URL(e.NEXT_PUBLIC_SUPABASE_URL).origin,key=e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));
if(origin!=='https://lvnvkpyxtuilhrabtlwv.supabase.co'||claim.role!=='anon'||claim.ref!=='lvnvkpyxtuilhrabtlwv')throw Error('Identity mismatch');
async function main(){
 const res=await fetch(origin+'/rest/v1/rpc/exec_sql',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({sql_query:'SELECT 1'}),signal:AbortSignal.timeout(15000)});
 const text=await res.text();let error;try{error=JSON.parse(text)?.code;}catch{}
 const proof={checkedAt:new Date().toISOString(),target:'lvnvkpyxtuilhrabtlwv',endpoint:'/rest/v1/rpc/exec_sql',callerRole:'anon',userJwt:false,cookies:false,probeSql:'SELECT 1',businessTablesAccessed:[],mutationStatements:0,status:res.status,errorCode:error,returnedVoid:text.length===0,anonymousRpcExecutionConfirmed:res.ok,interpretation:'Read-only constant SELECT via existing SQL-execution RPC. Function catalog is SECURITY DEFINER owned by postgres with BYPASSRLS. Not a production containment change.'};
 fs.writeFileSync(path.join(d,'blocker-runtime.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
main().catch(error=>{console.error(error.name);process.exitCode=1;});
