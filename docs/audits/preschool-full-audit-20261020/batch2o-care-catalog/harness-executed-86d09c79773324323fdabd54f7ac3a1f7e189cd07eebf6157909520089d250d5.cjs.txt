/* Local production-build and browser proof against approved E2E only. Default offline. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const CATALOG_APPROVED = process.argv.includes('--catalog-approved');
const OUTPUT = path.join(ROOT, 'docs/audits/preschool-full-audit-20261020', CATALOG_APPROVED ? 'batch2o-care-catalog' : 'batch2n-care-browser');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const report = { startedAt: new Date().toISOString(), scope: 'Local production build and actual browser; E2E only, no schema change', checks: [] };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const PRODUCT_FILES = ['src/app/dashboard/education/care/page.tsx', 'src/app/dashboard/education/care/care-save.ts', 'src/app/dashboard/education/care/__tests__/care-save.test.ts', 'src/app/dashboard/education/care/__tests__/page.test.tsx'];
if(CATALOG_APPROVED)PRODUCT_FILES.push('src/proxy.ts',
  'src/platform/education/contracts/canonical-course-catalog.contract.ts', 'src/platform/education/contracts/canonical-course-catalog.contract.impl.ts',
  'src/app/api/education/care/classes/route.ts', 'src/app/api/education/care/classes/__tests__/access.test.ts', 'src/app/api/education/care/classes/__tests__/catalog-contract.test.ts');
const productHashes = () => Object.fromEntries(PRODUCT_FILES.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
const PRODUCTION_ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local'];
const harnessPath = path.join(ROOT, 'scripts/verify-preschool-care-rls-e2e.cjs');
const source = fs.readFileSync(harnessPath, 'utf8');
if (hash(source) !== 'cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9') throw new Error('PINNED_HARNESS_CHANGED');
const entry = "main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
if (source.split(entry).length !== 2) throw new Error('ENTRY_MISMATCH');
// Reuse audited primitives, without invoking its DDL preparation or recovery main.
const compiled = new Module(harnessPath, module);
compiled.filename = harnessPath;
compiled.paths = Module._nodeModulePaths(path.dirname(harnessPath));
const productionSource = source.replace("NODE_ENV: 'development'", "NODE_ENV: 'production'")
  .replace("DEPLOYMENT_ENV: 'development'", "DEPLOYMENT_ENV: 'production'")
  .replace("'dev', '--webpack', '--hostname'", "'start', '--hostname'")
  .replace("noStore: cache.includes('no-store'), private:", "cacheControl: cache, noStore: cache.includes('no-store'), private:")
  .replace("nodeEnv: 'development'", "nodeEnv: 'production'");
compiled._compile(productionSource.replace(entry, String.raw`module.exports = {
  REF, API, TARGETS, CREATED, fixtures, owned, must, safeCode, hash, sourceState, snapshot, q, remoteFetch,
  seed, login, cleanFixtures, startServer, http, schoolDay, summarize, loggedIn,
  get config(){return config;}, get port(){return port;}, get commonReport(){return report;},
  async configure(output) {
    args={approved:true,output}; config=await readConfig();
    agentBefore=readFileSync(join(ROOT,'AGENTS.md')); must(git(['status','--porcelain','--','AGENTS.md']).trim()==='', 'AGENTS_NOT_CLEAN');
    report.scope='Already-retained E2E fixture/browser verification; no DDL'; report.sourceBefore=sourceState();
  },
  async connect() {
    db=new(require('pg').Client)({...config.pg,connectionTimeoutMillis:8000}); db.on('error',()=>{report.databaseConnectionError=true;}); await db.connect(); connected=true;
    admin=require('@supabase/supabase-js').createClient(API,config.adminKey,{global:{fetch:remoteFetch},auth:{persistSession:false,autoRefreshToken:false}});
  },
  async close(){if(db)await db.end();},
};`), harnessPath);
const adapter = compiled.exports;
let browser, baseline;

function save() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, `browser-results-${STAMP}.json.tmp`), JSON.stringify(report, null, 2) + '\n', { flush: true });
  fs.renameSync(path.join(OUTPUT, `browser-results-${STAMP}.json.tmp`), path.join(OUTPUT, `browser-results-${STAMP}.json`));
}
async function check(name, operation) {
  try { const detail = await operation(); report.checks.push({ name, result: 'PASS', ...detail }); }
  catch (error) { report.checks.push({ name, result: 'FAIL', code: adapter.safeCode(error) }); throw error; }
  finally { save(); }
}
function childEnvironment() {
  adapter.must(!PRODUCTION_ENV_FILES.some(file=>fs.existsSync(path.join(ROOT,file))),'PRODUCTION_ENV_FILE_PRESENT');
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']) if(process.env[key])env[key]=process.env[key];
  return { ...env, NODE_ENV:'production', NEXT_TELEMETRY_DISABLED:'1', DEPLOYMENT_ENV:'production',
    NEXT_PUBLIC_SUPABASE_URL:adapter.API, SUPABASE_URL:adapter.API,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:adapter.config.publicKey, NEXT_PUBLIC_SUPABASE_ANON_KEY:adapter.config.publicKey };
}
async function build() {
  const args = [require.resolve('next/dist/bin/next'), 'build', '--webpack'];
  const child = spawn(process.execPath, args, { cwd:ROOT, env:childEnvironment(), windowsHide:true, stdio:['ignore','pipe','pipe'] });
  const chunks=[]; let bytes=0;
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{bytes+=data.length;if(bytes<4_000_000)chunks.push(data.toString());});
  const deadline=setTimeout(()=>{try{require('node:child_process').execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}},12*60_000);
  const exit=await new Promise(resolve=>{child.once('error',()=>resolve({code:null,spawnFailure:true}));child.once('exit',(code,signal)=>resolve({code,signal}));});clearTimeout(deadline);
  const output=chunks.join('');
  // Build has only public config. Reject secrets before preserving diagnostics.
  const safe=output.replaceAll(adapter.config.publicKey,'[PUBLIC_KEY_REDACTED]');
  fs.writeFileSync(path.join(OUTPUT,`build-${STAMP}.log`),safe);
  report.build={...exit,command:'next build --webpack',nodeEnv:'production',privilegedKeyInChild:false,outputBytes:bytes,
    typescriptGate:'NOT_PROVEN_BUILD_CONFIG_IGNORES_TYPE_ERRORS',buildId:fs.existsSync(path.join(ROOT,'.next/BUILD_ID'))?fs.readFileSync(path.join(ROOT,'.next/BUILD_ID'),'utf8').trim():null};
  adapter.must(!PRODUCTION_ENV_FILES.some(file=>fs.existsSync(path.join(ROOT,file))),'PRODUCTION_ENV_FILE_PRESENT');
  adapter.must(exit.code===0&&!exit.spawnFailure,'PRODUCTION_BUILD_FAILED');return report.build;
}
function reuseBuild(name) {
  adapter.must(/^browser-results-[0-9TZ-]+\.json$/.test(name || ''),'BUILD_RECEIPT_PATH_REJECTED');
  const prior=JSON.parse(fs.readFileSync(path.join(OUTPUT,name),'utf8'));
  adapter.must(prior.projectRef===adapter.REF&&prior.build?.code===0&&prior.build.nodeEnv==='production'
    &&prior.sourceBefore.sha256===report.sourceBefore.sha256&&prior.sourceAfter.sha256===report.sourceBefore.sha256
    &&JSON.stringify(prior.productHashesBefore)===JSON.stringify(report.productHashesBefore)
    &&JSON.stringify(prior.productHashesAfter)===JSON.stringify(report.productHashesBefore)
    &&prior.build.buildId===fs.readFileSync(path.join(ROOT,'.next/BUILD_ID'),'utf8').trim(),'BUILD_RECEIPT_SOURCE_MISMATCH');
  report.build={...prior.build,reusedFrom:name};return report.build;
}
function classifyError(message) {
  if(typeof message!=='string')return null;
  if(message.includes('permission denied'))return 'PERMISSION_DENIED';
  if(message.includes('statement timeout'))return 'STATEMENT_TIMEOUT';
  if(message.includes('does not exist')||message.includes('schema cache'))return 'SCHEMA_MISSING';
  if(message.includes('infinite recursion'))return 'RLS_RECURSION';
  return /^[A-Z0-9_]{2,90}$/.test(message)?message:'UNCLASSIFIED_ERROR';
}
async function diagnoseCourses() {
  const fixture=adapter.fixtures[0],actor=fixture.actors[0];
  const client=require('@supabase/supabase-js').createClient(adapter.API,adapter.config.publicKey,
    {global:{fetch:adapter.remoteFetch},auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  adapter.must(!auth.error&&auth.data.user?.id===actor.id,'COURSE_DIAGNOSTIC_REAL_AUTH_FAILED');
  try {
    const stages=[
      ['CANONICAL_COURSES',()=>client.from('edu_courses').select('id,course_code,title,status,max_students,current_enrollment,created_at').eq('tenant_id',fixture.tenant).order('created_at',{ascending:false})],
      ['COURSE_PROJECTION',()=>client.from('courses').select('course_id,course_code,course_name,description,duration_weeks,metadata,status').eq('tenant_id',fixture.tenant).in('course_id',[fixture.course])],
      ['TEACHER_ASSIGNMENT',()=>client.from('teacher_assignments').select('assignment_id').eq('tenant_id',fixture.tenant).eq('course_id',fixture.course).eq('status','active')],
    ];
    report.courseDiagnostics=[];
    for(const [stage,query] of stages){
      const result=await query();
      report.courseDiagnostics.push({stage,status:result.status,code:result.error?.code||null,errorKind:classifyError(result.error?.message),
        ...(stage==='CANONICAL_COURSES'?{fixtureCourseVisible:result.data?.some(r=>r.id===fixture.course)===true}:{})});
      save();
    }
  } finally {await client.auth.signOut({scope:'local'});}
}
async function verifyCatalogHttp() {
  for(const fixture of adapter.fixtures)for(const actor of fixture.actors){
    const jar=new Map();actor.jar=jar;
    actor.client=require('@supabase/ssr').createServerClient(adapter.API,adapter.config.publicKey,{global:{fetch:adapter.remoteFetch},cookies:{
      getAll:()=>[...jar].map(([name,value])=>({name,value})),
      setAll:cookies=>{for(const {name,value,options}of cookies){if(options.maxAge===0)jar.delete(name);else jar.set(name,value);}},
    }});adapter.loggedIn.push(actor);
    const auth=await actor.client.auth.signInWithPassword({email:actor.email,password:actor.password});
    const verified=await actor.client.auth.getUser();
    adapter.must(!auth.error&&auth.data.user?.id===actor.id&&!verified.error&&verified.data.user?.id===actor.id,'CATALOG_REAL_AUTH_FAILED');
  }
  const endpoint='/api/education/care/classes';
  const expect=async(name,actor,status,code,validate)=>check(name,async()=>{
    const result=await adapter.http(actor,endpoint+(validate?.query||''));
    report.catalogHttpReceipts=adapter.commonReport.httpReceipts;
    const receipt=adapter.commonReport.httpReceipts.at(-1);
    adapter.must(result.status===status&&(!code||result.data.error===code)&&receipt.cacheControl==='private, no-store','CATALOG_HTTP_STATUS_OR_HEADERS');
    if(validate?.body)validate.body(result.data);return{status,code:code||null,realProviderSession:Boolean(actor),private:true,noStore:true};
  });
  await expect('CATALOG_ANONYMOUS',null,401,'CARE_UNAUTHENTICATED');
  for(const fixture of adapter.fixtures)for(const actor of fixture.actors){
    if(actor.role==='admin')await expect(`CATALOG_ADMIN_${fixture.index}`,actor,200,null,{body:data=>adapter.must(data.success===true&&data.classrooms?.length===1&&data.classrooms[0].id===fixture.course&&data.classrooms[0].status==='active','CATALOG_SCOPE_LEAK')});
    else await expect(`CATALOG_ROLE_${fixture.index}_${actor.role}`,actor,actor.role==='admin_staff'?503:403,actor.role==='admin_staff'?'CARE_TEACHER_IDENTITY_UNAVAILABLE':'CARE_ROLE_DENIED');
  }
  const fixture=adapter.fixtures[0],actor=fixture.actors[0],foreign=adapter.fixtures[1];
  for(const [name,query]of [['FOREIGN_TENANT',`?tenantId=${foreign.tenant}`],['DUPLICATE_TENANT',`?tenantId=${fixture.tenant}&tenantId=${foreign.tenant}`],['BRANCH_SELECTOR',`?branchId=${foreign.branch}`]]){
    await expect(`CATALOG_${name}`,actor,403,'CARE_CONTEXT_OVERRIDE_DENIED',{query});
  }
  for(const [name,sql,restore,params,status,code,body]of [
    ['INACTIVE_BRANCH','update public.org_units set is_active=false where id=$1 and tenant_id=$2','update public.org_units set is_active=true where id=$1 and tenant_id=$2',[fixture.branch,fixture.tenant],200,null,data=>adapter.must(data.success===true&&data.classrooms?.length===0,'INACTIVE_BRANCH_VISIBLE')],
    ['INACTIVE_PROFILE',"update public.users set status='inactive' where id=$1 and tenant_id=$2","update public.users set status='active' where id=$1 and tenant_id=$2",[actor.id,fixture.tenant],403,'CARE_ACCESS_DENIED'],
    ['ROLE_CHANGED',"update public.users set role='accountant' where id=$1 and tenant_id=$2","update public.users set role='admin' where id=$1 and tenant_id=$2",[actor.id,fixture.tenant],403,'CARE_ROLE_DENIED'],
    ['INACTIVE_TENANT',"update public.tenants set status='suspended' where id=$1","update public.tenants set status='active' where id=$1",[fixture.tenant],403,'CARE_ACCESS_DENIED'],
  ]){
    await adapter.q(sql,params);
    try{await expect(`CATALOG_${name}`,actor,status,code,{body});}finally{await adapter.q(restore,params);}
  }
  await adapter.q('update public.users set tenant_id=$1 where id=$2 and tenant_id=$3',[foreign.tenant,actor.id,fixture.tenant]);
  try{
    await expect('CATALOG_SAME_AUTH_PROFILE_TENANT_CHANGED',actor,403,'CARE_CONTEXT_OVERRIDE_DENIED',{query:`?tenantId=${fixture.tenant}`});
  }finally{await adapter.q('update public.users set tenant_id=$1 where id=$2 and tenant_id=$3',[fixture.tenant,actor.id,foreign.tenant]);}
  await expect('CATALOG_CONTEXT_RESTORED',actor,200,null,{body:data=>adapter.must(data.success===true&&data.classrooms?.length===1&&data.classrooms[0].id===fixture.course,'CATALOG_RESTORED_SCOPE_MISMATCH')});
  report.catalogHttpReceipts=adapter.commonReport.httpReceipts;
}
function verifyCareHeaders(receipts, collectionFailed=false) {
  adapter.must(!collectionFailed,'BROWSER_RECEIPT_COLLECTION_FAILED');
  const paths=CATALOG_APPROVED?['/api/education/care/bulk','/api/education/care/classes']:['/api/education/care/bulk'];
  const care=receipts.filter(receipt=>paths.includes(receipt.path));
  adapter.must(paths.every(path=>care.some(receipt=>receipt.path===path)),'AUTHENTICATED_CARE_PRIVATE_HEADERS_FAILED');
  adapter.must(care.length>0&&care.every(receipt=>receipt.private&&receipt.noStore&&receipt.cacheControl==='private, no-store'),'AUTHENTICATED_CARE_PRIVATE_HEADERS_FAILED');
  return{responses:care.length,private:true,noStore:true};
}
async function verifyBrowser() {
  const { chromium }=require('playwright');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Ho_Chi_Minh',serviceWorkers:'block'});
  const page=await context.newPage(); page.setDefaultTimeout(25_000);
  const fixture=adapter.fixtures[0], actor=fixture.actors[0];
  const base=`http://127.0.0.1:${adapter.port}`;
  const receipts=[];const pending=[];
  page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&['/api/education/courses','/api/education/care/classes','/api/education/care/bulk'].includes(url.pathname)){
    const task=(async()=>{const h=await response.allHeaders();let errorKind=null;
      if(!response.ok()){try{const body=await response.json();errorKind=classifyError(body.error);}catch{}}
      receipts.push({path:url.pathname,method:response.request().method(),status:response.status(),errorKind,cacheControl:h['cache-control']||'',private:(h['cache-control']||'').includes('private'),noStore:(h['cache-control']||'').includes('no-store')});})().catch(()=>{report.browserReceiptFailure='RECEIPT_COLLECTION_FAILED';});pending.push(task);
  }});
  try {
    await check('BROWSER_REAL_LOGIN',async()=>{
      await page.goto(base+'/login'); await page.locator('input[type=email]').fill(actor.email);await page.locator('input[type=password]').fill(actor.password);
      await page.getByRole('button',{name:/Đăng nhập/i}).click();await page.waitForURL(/\/dashboard/, {timeout:60_000});
      const cookies=await context.cookies();adapter.must(cookies.some(c=>c.name.startsWith('sb-'+adapter.REF+'-auth-token'))&&!cookies.some(c=>c.name==='mock_user_email'),'BROWSER_REAL_AUTH_COOKIE_MISSING');
      return {actualForm:true,providerCookie:true,mockCookie:false};
    });
    await check('BROWSER_CARE_ROSTER',async()=>{
      await page.goto(base+'/dashboard/education/care');await page.getByRole('heading',{name:'Chăm sóc & Nuôi dưỡng',exact:true}).waitFor();
      await page.locator('select').filter({has:page.locator(`option[value="${fixture.course}"]`)}).waitFor({timeout:60_000});
      await page.getByText('Synthetic Care active',{exact:true}).first().waitFor({timeout:60_000});
      adapter.must(await page.getByText('Synthetic Care pending',{exact:true}).count()===0,'PENDING_STUDENT_VISIBLE');
      return {canonicalCourse:true,activeStudent:true,pendingExcluded:true};
    });
    await check('BROWSER_QUICK_SAVE_AND_READBACK',async()=>{
      await page.getByRole('button',{name:'Ghi nhận nhanh',exact:true}).first().click();
      await page.locator('#care-meal').selectOption('HALF');await page.locator('#care-nap').selectOption('RESTLESS');await page.locator('#care-hygiene').selectOption('DIAPER');
      adapter.must(await page.locator('#care-health').isDisabled(),'HEALTH_EDIT_ENABLED');
      await page.locator('#care-note').fill('Synthetic browser persistence');
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/education/care/bulk'&&r.request().method()==='POST');
      await page.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).click();const actual=await response;
      const payload=JSON.parse(actual.request().postData());adapter.must(payload.data.records.every(r=>!('health' in r)),'BROWSER_SENT_HELD_HEALTH');
      const outcome=await actual.json();adapter.must(actual.status()===200&&outcome.savedCount===1&&outcome.success===true,'BROWSER_SAVE_REJECTED');
      const rows=(await adapter.q(`select r.meal_records,r.nap_records,r.hygiene_records,r.morning_condition,r.health_checks from public.edu_daily_care_records r join public.edu_daily_care_sessions s on s.id=r.session_id where r.tenant_id=$1 and s.tenant_id=$1 and s.class_id=$2 and r.student_party_id=$3`,[fixture.tenant,fixture.course,fixture.students[0].id])).rows;
      adapter.must(rows.length===1&&rows[0].meal_records[0]?.portion==='HALF'&&rows[0].nap_records.quality==='RESTLESS'&&rows[0].hygiene_records[0]?.type==='DIAPER'&&rows[0].morning_condition==='Synthetic browser persistence'&&JSON.stringify(rows[0].health_checks)==='{}','BROWSER_DB_READBACK_FAILED');
      await page.getByRole('dialog',{name:'Ghi Nhận Chăm Sóc Nhanh'}).waitFor({state:'hidden'});
      await page.reload();await page.getByText('Synthetic browser persistence',{exact:true}).first().waitFor();return {realApi:true,independentDbReadback:true,reloadPersisted:true,healthUnchanged:true};
    });
    if(CATALOG_APPROVED)await check('BROWSER_INDIVIDUAL_SAVE_AND_READBACK',async()=>{
      await page.getByTitle('Chỉnh sửa nội dung chăm sóc cho bé').click();
      const dialog=page.getByRole('dialog',{name:'Chỉnh sửa chăm sóc'});
      await dialog.getByPlaceholder(/^Nhập dặn dò phụ huynh/).fill('Synthetic individual persistence');
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/education/care/bulk'&&r.request().method()==='POST');
      await dialog.getByRole('button',{name:'Lưu Thay Đổi'}).click();const actual=await response;
      const payload=JSON.parse(actual.request().postData()),outcome=await actual.json();
      adapter.must(actual.status()===200&&outcome.success===true&&outcome.savedCount===1&&payload.data.records.every(r=>!('health' in r)),'BROWSER_INDIVIDUAL_SAVE_REJECTED');
      await dialog.waitFor({state:'hidden'});
      const rows=(await adapter.q('select morning_condition,health_checks from public.edu_daily_care_records where tenant_id=$1 and student_party_id=$2',[fixture.tenant,fixture.students[0].id])).rows;
      adapter.must(rows.length===1&&rows[0].morning_condition==='Synthetic individual persistence'&&JSON.stringify(rows[0].health_checks)==='{}','BROWSER_INDIVIDUAL_DB_READBACK_FAILED');
      await page.reload();await page.getByText('Synthetic individual persistence',{exact:true}).first().waitFor();return{realApi:true,independentDbReadback:true,reloadPersisted:true,healthUnchanged:true};
    });
    await check('BROWSER_DENIED_SAVE_NO_FALSE_SUCCESS',async()=>{
      await page.getByRole('button',{name:'Ghi nhận nhanh',exact:true}).first().click();await page.locator('#care-meal').selectOption('ALL');
      const initial=(await adapter.q('select morning_condition,meal_records from public.edu_daily_care_records where tenant_id=$1',[fixture.tenant])).rows;
      await adapter.q('update public.org_units set is_active=false where id=$1 and tenant_id=$2',[fixture.branch,fixture.tenant]);
      try {
        const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/education/care/bulk'&&r.request().method()==='POST');
        await page.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).click();const denied=await pending;
        adapter.must([403,503].includes(denied.status()),'REVOKED_BROWSER_SAVE_NOT_DENIED');
        await page.getByRole('alert').filter({hasText:'Chưa xác nhận lưu đầy đủ'}).last().waitFor();
        adapter.must(await page.getByRole('button',{name:'Lưu Ghi Nhận',exact:true}).isVisible(),'REJECTED_SAVE_CLOSED_EDITOR');
        const final=(await adapter.q('select morning_condition,meal_records from public.edu_daily_care_records where tenant_id=$1',[fixture.tenant])).rows;
        adapter.must(JSON.stringify(initial)===JSON.stringify(final),'REJECTED_SAVE_CHANGED_DB');
        return {actualDenial:denied.status(),editorPreserved:true,independentDbUnchanged:true};
      } finally {await adapter.q('update public.org_units set is_active=true where id=$1 and tenant_id=$2',[fixture.branch,fixture.tenant]);}
    });
  } finally {await context.close();await Promise.allSettled(pending);report.browserReceipts=receipts;}
}
async function main(){
  if(!process.argv.includes('--execute')){console.log(JSON.stringify({mode:'OFFLINE_PLAN',target:adapter.REF,networkCalls:0,mutations:0,productionOperations:false}));return;}
  fs.mkdirSync(OUTPUT,{recursive:true});
  try{
    await adapter.configure(OUTPUT);report.projectRef=adapter.REF;report.harnessSha256=hash(fs.readFileSync(__filename));report.sourceBefore=adapter.sourceState();
    report.productHashesBefore=productHashes();
    report.productionEnvironmentFiles=PRODUCTION_ENV_FILES.filter(file=>fs.existsSync(path.join(ROOT,file)));
    adapter.must(report.productionEnvironmentFiles.length===0,'PRODUCTION_ENV_FILE_PRESENT');
    adapter.must([...report.sourceBefore.changed,...report.sourceBefore.untracked].every(f=>PRODUCT_FILES.includes(f))&&!report.sourceBefore.environmentFiles.length,'UNEXPECTED_RUNTIME_SOURCE');
    const reuseIndex=process.argv.indexOf('--reuse-build');
    await check('LOCAL_PRODUCTION_BUILD',()=>reuseIndex<0?build():reuseBuild(process.argv[reuseIndex+1]));
    if(process.argv.includes('--build-only'))return;
    await adapter.connect();baseline=await adapter.snapshot();adapter.must(baseline.sha256==='9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2','RETAINED_CATALOG_DRIFT');report.catalogBefore=adapter.summarize(baseline);
    await check('FIXTURE_SEED',adapter.seed);
    adapter.must(!PRODUCTION_ENV_FILES.some(file=>fs.existsSync(path.join(ROOT,file))),'PRODUCTION_ENV_FILE_PRESENT');
    await check('OWN_PRODUCTION_SERVER',adapter.startServer);
    const anon=await fetch(`http://127.0.0.1:${adapter.port}/api/education/care/bulk`,{signal:AbortSignal.timeout(25_000)});const cache=anon.headers.get('cache-control')||'';
    report.headerObservation={status:anon.status,cacheControl:cache,environment:anon.headers.get('x-environment')};
    try {await check('PRODUCTION_BUILD_PRIVATE_HEADER',async()=>{adapter.must(anon.status===401&&cache==='private, no-store','PRODUCTION_PRIVATE_HEADER_NOT_PROVEN');return{status:anon.status,private:true,noStore:true};});}
    catch {report.headerGateFailed=true;}
    if(CATALOG_APPROVED)await verifyCatalogHttp();
    else await check('COURSE_REAL_AUTH_DIAGNOSTIC',diagnoseCourses);
    await verifyBrowser();
    await check('BROWSER_AUTHENTICATED_CARE_PRIVATE_HEADERS',async()=>verifyCareHeaders(report.browserReceipts,Boolean(report.browserReceiptFailure)));
  }catch(error){report.primaryFailure=adapter.safeCode(error);}
  finally{
    if(CATALOG_APPROVED)report.catalogHttpReceipts=adapter.commonReport.httpReceipts||[];
    if(browser)try{await browser.close();}catch{report.browserCloseFailed=true;}
    await adapter.cleanFixtures();report.cleanup=adapter.commonReport.cleanup;report.server=adapter.commonReport.server;
    if(baseline)try{const after=await adapter.snapshot();adapter.must(after.sha256===baseline.sha256,'CATALOG_CHANGED');report.catalogAfterSha256=after.sha256;}catch(error){report.catalogFailure=adapter.safeCode(error);}
    try{await adapter.close();}catch{report.databaseCloseFailed=true;}
    report.sourceAfter=adapter.sourceState();report.productHashesAfter=productHashes();
    if(report.sourceAfter.sha256!==report.sourceBefore?.sha256||JSON.stringify(report.productHashesBefore)!==JSON.stringify(report.productHashesAfter))report.sourceChanged=true;
    report.finishedAt=new Date().toISOString();report.result=report.primaryFailure||report.cleanup.failures.length||report.catalogFailure||report.browserCloseFailed||report.databaseCloseFailed||report.sourceChanged?'FAIL':process.argv.includes('--build-only')?'BUILD_ONLY_NOT_PROVEN':'PASS_SCOPED_BROWSER';
    if(report.headerGateFailed)report.result='FAIL';
    report.exitCode=report.result==='FAIL'?1:0;save();console.log(JSON.stringify({result:report.result,primaryFailure:report.primaryFailure,header:report.headerObservation,checks:report.checks.map(c=>({name:c.name,result:c.result,code:c.code})),cleanupFailures:report.cleanup.failures.length,report:`browser-results-${STAMP}.json`,exitCode:report.exitCode}));process.exitCode=report.exitCode;
  }
}
main().catch(()=>{console.error('BROWSER_RUN_FATAL_SANITIZED');process.exitCode=1;});
