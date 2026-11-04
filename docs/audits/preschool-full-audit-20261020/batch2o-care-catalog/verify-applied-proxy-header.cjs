'use strict';
// Actual applied proxy against preimage; isolated simulated Auth callbacks, no network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),file=path.join(root,'src/proxy.ts');
const before=fs.readFileSync(path.join(__dirname,'src__proxy.ts.before.txt'),'utf8');
const after=fs.readFileSync(file,'utf8');
function load(source,scenario) {
  const sandboxModule={exports:{}};
  const code=require('typescript').transpileModule(source,{compilerOptions:{module:require('typescript').ModuleKind.CommonJS,target:require('typescript').ScriptTarget.ES2022}}).outputText;
  const allowed={
    'next/server':require('next/server'),
    '@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{
      if(scenario.refresh==='set')options.cookies.set('synthetic-refresh','synthetic-value',{});
      if(scenario.refresh==='remove')options.cookies.remove('synthetic-refresh',{});
      return{data:{user:scenario.user?{id:'synthetic-subject'}:null}};
    }},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'admin'}})})})})})},
    '@/lib/supabase-public-env':{getSupabasePublicUrl:()=> 'https://synthetic.invalid',getSupabasePublicKey:()=> 'synthetic-public-key',requireSupabasePublicEnv:()=>{throw Error('Unexpected missing config');}},
    '@/lib/supabase-admin-env':{getSupabaseAdminKey:()=>{throw Error('Admin forbidden');},getSupabaseAdminUrl:()=>{throw Error('Admin forbidden');}},
  };
  vm.runInNewContext(code,{module:sandboxModule,exports:sandboxModule.exports,require:name=>{assert.ok(name in allowed,'Unexpected dependency');return allowed[name];},process:{env:{NODE_ENV:'production',DEPLOYMENT_ENV:'production'}},Headers,URL});
  return sandboxModule.exports.proxy;
}
async function main(){
  const rows=[];
  for(const user of [false,true])for(const refresh of [null,'set','remove'])for(const route of ['/api/education/care/bulk','/api/education/care/classes','/api/education/care/classes-extra','/api/education/care/bulk-extra','/api/education/courses','/api/v1/public/catalog','/api/v1/webhooks/partner']){
    const scenario={user,refresh},request=()=>new(require('next/server').NextRequest)('http://localhost'+route);
    const prior=await load(before,scenario)(request()),candidate=await load(after,scenario)(request());
    const oldCache=prior.headers.get('cache-control'),newCache=candidate.headers.get('cache-control');
    if(['/api/education/care/bulk','/api/education/care/classes'].includes(route))assert.equal(newCache,'private, no-store');
    else assert.equal(newCache,oldCache,'Unrelated cache behavior changed');
    assert.equal(candidate.status,prior.status);assert.equal(candidate.headers.get('content-security-policy'),prior.headers.get('content-security-policy'));
    rows.push({route,authenticatedSimulation:user,refresh,baseline:oldCache,candidate:newCache,result:'PASS'});
  }
  const diff=require('diff').createTwoFilesPatch('a/src/proxy.ts','b/src/proxy.ts',before,after,'','');
  fs.writeFileSync(path.join(__dirname,'APPLIED_PROXY_PRIVATE.patch'),diff);
  fs.writeFileSync(path.join(__dirname,'proxy-applied-tests.json'),JSON.stringify({result:'PASS_UNIT_APPLIED_PROXY',cases:rows.length,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),candidateSha256:crypto.createHash('sha256').update(after).digest('hex'),applied:true,networkCalls:0,casesDetail:rows},null,2)+'\n');
  console.log(JSON.stringify({result:'PASS_UNIT_APPLIED_PROXY',cases:rows.length,applied:true,networkCalls:0}));
}
main().catch(()=>{console.error('PROXY_CANDIDATE_TEST_FAILED');process.exitCode=1;});
