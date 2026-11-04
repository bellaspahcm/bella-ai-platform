const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),dotenv=require('dotenv');
const out=__dirname;
const project=JSON.parse(fs.readFileSync('.vercel/project.json'));
const authPath=path.join(process.env.APPDATA,'com.vercel.cli','Data','auth.json');
const auth=JSON.parse(fs.readFileSync(authPath));
const token=auth.token;
function origin(value){try{return new URL(value).origin;}catch{return null;}}
function save(name,data){fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');}
async function api(route){const res=await fetch('https://api.vercel.com'+route+(route.includes('?')?'&':'?')+'teamId='+project.orgId,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!res.ok){const body=await res.json().catch(()=>({}));throw Error('VERCEL_HTTP_'+res.status+'_'+(body.error?.code||'unknown'));}return res.json();}
async function main(){
  const configOrigins=[];
  for(const file of ['.env','.env.local','.env.e2e','.env.test','.env.production']){const e=dotenv.parse(fs.readFileSync(file));configOrigins.push({file,apiOrigin:origin(e.NEXT_PUBLIC_SUPABASE_URL||e.SUPABASE_URL)});}
  let dpl;
  try{
    const p=await api('/v9/projects/'+project.projectId);
    dpl=p.targets?.production?.id;
    if(!dpl)throw Error('NO_PRODUCTION_TARGET');
    const deployment=await api('/v13/deployments/'+dpl);
    const projection={checkedAt:new Date().toISOString(),linkedProject:{id:project.projectId,teamId:project.orgId,name:p.name},productionTarget:{id:dpl,url:deployment.url,target:deployment.target,readyState:deployment.readyState,createdAt:deployment.createdAt||deployment.created,gitSha:deployment.meta?.githubCommitSha||deployment.gitSource?.sha,gitRef:deployment.meta?.githubCommitRef||deployment.gitSource?.ref,aliases:deployment.alias||p.targets?.production?.alias||[],source:p.targets?.production?.source},deploymentPublicApiOrigin:origin(deployment.env?.NEXT_PUBLIC_SUPABASE_URL||deployment.env?.SUPABASE_URL),localConfiguration:configOrigins};
    save('production-deployment.json',projection);console.log(JSON.stringify(projection));
  }catch(error){save('production-rest-attempt.json',{result:'BLOCKED',error:error.message});if(fs.existsSync(path.join(out,'production-deployment-cli.json')))dpl=JSON.parse(fs.readFileSync(path.join(out,'production-deployment-cli.json'))).id;}
  save('configuration-origins.json',configOrigins);
  const publicOrigin='https://bella-spa-erp.vercel.app';
  const response=await fetch(publicOrigin+'/login',{redirect:'follow',signal:AbortSignal.timeout(20000)});
  const html=await response.text();
  const scriptPaths=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))].filter(v=>v.startsWith('/_next/'));
  const scripts=[];
  for(const src of scriptPaths){
    const u=new URL(src,publicOrigin);const r=await fetch(u,{signal:AbortSignal.timeout(20000)});const code=await r.text();
    const supabaseOrigins=[...new Set([...code.matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co/g)].map(m=>m[0]))];
    scripts.push({path:u.pathname,status:r.status,sha256:crypto.createHash('sha256').update(code).digest('hex'),supabaseOrigins});
  }
  const runtime={checkedAt:new Date().toISOString(),origin:publicOrigin,loginStatus:response.status,finalUrl:response.url,deploymentId:dpl,loginHtmlSha256:crypto.createHash('sha256').update(html).digest('hex'),scripts,supabaseOrigins:[...new Set(scripts.flatMap(s=>s.supabaseOrigins))],notes:'Public GETs of login HTML and referenced JavaScript only. No raw bundles, credentials, cookies or env values persisted. Embedded API origins are public configuration; bundle matches alone do not prove every server-side integration target.'};
  save('production-public-bundle.json',runtime);console.log(JSON.stringify({runtimeOrigin:publicOrigin,loginStatus:runtime.loginStatus,supabaseOrigins:runtime.supabaseOrigins,scripts:scripts.length}));
}
main().catch(error=>{save('production-identity-error.json',{result:'BLOCKED',error:error.message.replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,200)});console.error(error.name);process.exitCode=1;});
