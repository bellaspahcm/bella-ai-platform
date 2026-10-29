const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require('playwright');
const base='http://localhost:3000';
const env=dotenv.parse(fs.readFileSync('.env.local'));
const api=env.NEXT_PUBLIC_SUPABASE_URL;
const adminKey=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}};
const admin=createClient(api,adminKey,options),anon=createClient(api,publicKey,options);
function save(name,data){fs.writeFileSync(path.join(__dirname,name),JSON.stringify(data,null,2)+'\n');}
function safeError(error){return error?{code:error.code||'FETCH_ERROR'}:null;}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
async function main(){
  const tenants=await admin.from('tenants').select('id,name,product_key,enabled_modules').or('product_key.in.(bella_preschool,bella_education),name.ilike.%Preschool%').limit(100);
  if(tenants.error){save('runtime-read.json',{result:'BLOCKED',obstacle:'Configured admin REST read failed',error:safeError(tenants.error)});console.log('REST_READ_BLOCKED');return;}
  const preschool=(tenants.data||[]).filter(t=>t.product_key==='bella_preschool'||t.product_key==='bella_education'||JSON.stringify(t.enabled_modules||{}).includes('bella_education')||/preschool/i.test(t.name));
  const sourceDefault=await admin.from('tenants').select('id,name,product_key,enabled_modules').eq('id','ed100000-0000-0000-0000-000000000001').maybeSingle();
  const candidate=sourceDefault.data||preschool.find(t=>/^Bella Preschool$/i.test(t.name));
  if(!candidate){save('runtime-read.json',{result:'BLOCKED',obstacle:'No Preschool tenant in configured environment'});console.log('PRESCHOOL_TENANT_NOT_FOUND');return;}
  const users=await admin.from('users').select('id,email,role').eq('tenant_id',candidate.id).eq('role','admin').limit(1);
  const user=users.data?.[0];
  const tables=['edu_courses','edu_enrollments','students','edu_attendance','edu_attendance_daily_state','preschool_chain_course_branch_assignments','preschool_chain_enrollment_branch_assignments','user_org_unit_access','edu_fin_invoices','edu_fin_payments','edu_fin_tuition_service_period_completions','edu_care_daily_logs','edu_comm_messages','edu_sched_shift_assignments','edu_fac_assets'];
  const reads=[];
  for(const table of tables){
    const [a,b]=await Promise.all([admin.from(table).select('*',{count:'exact',head:true}).eq('tenant_id',candidate.id),anon.from(table).select('*',{count:'exact',head:true}).eq('tenant_id',candidate.id)]);
    reads.push({table,admin:{count:a.count,error:safeError(a.error)},anonymous:{count:b.count,error:safeError(b.error)}});
  }
  const readResult={checkedAt:new Date().toISOString(),result:'READ_ONLY',preschoolTenantCount:preschool.length,selection:sourceDefault.data?'Exact tenant referenced by current development API defaults':'Exact existing Bella Preschool tenant name',productIdentity:{productKey:candidate.product_key,educationModuleDeclared:JSON.stringify(candidate.enabled_modules||{}).includes('bella_education')},actorAvailable:Boolean(user),reads,caveat:'Admin counts do not prove RLS. Anonymous reads are executed via public API key without a user JWT. No fixtures created.'};
  save('runtime-read.json',readResult);console.log(JSON.stringify(readResult));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
  if(user)await context.addCookies([{name:'mock_user_email',value:user.email,url:base}]);
  const page=await context.newPage();
  const blocked=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,220)));
  const readActions=new Set(['getCurrentUser','getTenantSettings']);
  function actionName(id){try{return JSON.parse(fs.readFileSync('.next/dev/server/server-reference-manifest.json')).node?.[id]?.exportedName;}catch{return undefined;}}
  await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());const action=actionName(req.headers()['next-action']);if(req.method()==='POST'&&action&&readActions.has(action))return route.continue();if(!['GET','HEAD','OPTIONS'].includes(req.method())){blocked.push({path:u.pathname,method:req.method(),action:action||'unknown'});return route.abort('blockedbyclient');}return route.continue();});
  const routes=walk('src/app/dashboard/education').filter(f=>f.endsWith('page.tsx')).map(f=>'/dashboard/education'+f.replaceAll('\\','/').replace('src/app/dashboard/education','').replace('/page.tsx','').replace('[id]','00000000-0000-4000-8000-000000000099'));
  const rows=[];
  for(const route of routes){
    const calls=[];const listener=res=>{const u=new URL(res.url());if(u.pathname.startsWith('/api/education'))calls.push({path:u.pathname,status:res.status()});};page.on('response',listener);
    const errorStart=errors.length,blockedStart=blocked.length;
    try{
      const res=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('h1').first().waitFor({state:'visible',timeout:18000}).catch(()=>{});
      await page.waitForTimeout(1200);
      const ui=await page.evaluate(()=>({heading:[...document.querySelectorAll('h1')].map(e=>e.textContent),tabs:[...document.querySelectorAll('[role=tab]')].map(e=>({label:e.textContent?.trim().slice(0,80),selected:e.getAttribute('aria-selected')})),loginForm:Boolean(document.querySelector('input[type=password]')),mainPresent:Boolean(document.querySelector('main')),overflow:document.documentElement.scrollWidth>innerWidth+2,buttonCount:document.querySelectorAll('button').length,truthNotices:[...document.querySelectorAll('[role=status], [role=alert]')].map(e=>e.textContent?.trim().slice(0,180)).slice(0,6)}));
      rows.push({route,status:res?.status(),finalPath:new URL(page.url()).pathname,...ui,educationResponses:calls,errors:errors.slice(errorStart),blockedMutations:blocked.slice(blockedStart)});
    }catch(e){rows.push({route,result:'BLOCKED',obstacle:e.name});}
    page.off('response',listener);save('browser-routes.partial.json',{authMode:user?'Development mock_user_email cookie; not real Auth':'Anonymous',routes:rows,blocked,errors});console.log(JSON.stringify({route,result:rows.at(-1).status||rows.at(-1).result,heading:rows.at(-1).heading,errors:rows.at(-1).errors?.length}));
  }
  await context.close();await browser.close();
  save('browser-routes.json',{checkedAt:new Date().toISOString(),base,authMode:user?'Development mock_user_email cookie; not a real Auth session':'Anonymous browser',mutationPolicy:'All non-GET/HEAD/OPTIONS requests blocked except inspected read-only Next server actions getCurrentUser/getTenantSettings; theme upgrades and business writes blocked',routes:rows,blocked,errors,caveat:'Read-only route rendering only. Does not prove write-to-DB, Auth, RBAC, RLS or Go-Live. Dynamic detail routes intentionally use nonexistent UUID to test identity/error handling.'});
  const probes=[];
  for(const route of ['/api/education/courses?tenantId='+candidate.id,'/api/education/enrollments','/api/education/branches','/api/education/attendance','/api/education/finance','/api/education/work-queue','/api/education/parent-daily']){
    try{const res=await fetch(base+route,{signal:AbortSignal.timeout(25000)});const j=await res.json().catch(()=>null);probes.push({path:route.split('?')[0],explicitTenantQuery:route.includes('?tenantId='),status:res.status,success:j?.success,collectionSizes:j&&Object.fromEntries(Object.entries(j).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),errorCode:typeof j?.error==='string'?j.error.slice(0,150):undefined});}catch(e){probes.push({path:route.split('?')[0],result:'BLOCKED',obstacle:e.name});}
  }
  save('anonymous-api.json',{checkedAt:new Date().toISOString(),base,session:'No cookies or Authorization header',runtime:'Existing Next development server, not production',probes});console.log(JSON.stringify({anonymousApi:probes}));
}
main().catch(e=>{save('runtime-error.json',{result:'BLOCKED',obstacle:e.name,message:e.message.replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,250)});console.error(e.name);process.exitCode=1;});
