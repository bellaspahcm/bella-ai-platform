import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { hash } from './contract.mjs';
import { admitTask, drive } from './role-pipeline.mjs';
import { pilotId, pilotBase, pilotGoal, pilotFiles, pilotTest, isMvpPilot, assertPreparedPilot,
  readPilotRule, observedRuleLoad, pilotExecution, ruleCommand, pilotReads, pilotPrompt, pilotSupervisorContext, pilotNativeTurnFailure, validatePilotReceipt, nonProductionDomains, assertNetworkDenial, checkPilotPermission, pilotNetworkProbe } from './mvp-pilot.mjs';

const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const task=()=>({taskId:pilotId,sourceRevision:pilotBase,goal:pilotGoal,ownedFiles:[...pilotFiles],testFile:pilotTest,
  acceptance:['Prove real customer preferences persistence, reload, tenant denial and current rule loading.'],maxSeconds:600});
const snapshot=()=>{ const source={head:pilotBase,files:pilotFiles.map(path=>({path,mode:'100644',sha256:'a'.repeat(64)}))}; return {...source,fingerprint:hash(JSON.stringify(source))}; };

const supervisorFixture=(role,input)=>({
  permission:{profileId:`bella_mvp_${role.toLowerCase()}`,networkEnabled:role==='VERIFY',networkProxyEnabled:role==='VERIFY',powershellTelemetryOptout:'1',sourceCandidate:input.before.fingerprint},
  binding:{repository:'bellaspahcm/bella-ai-platform',taskId:input.task.taskId,runId:'supervisor-run',attempt:1,producerInstanceId:'supervisor-producer',threadId:'native-thread',sessionId:'native-session',turnId:null},
  networkControl:{exitCode:0,stdout:JSON.stringify({proxy:{host:'127.0.0.1',nodeUseEnvProxy:true},allowed:{destination:'bmnbqbcdbuklhopfbopv.supabase.co:443',tunnelStatus:200,status:401},prohibited:{destination:'example.com:443',status:403,policyError:'blocked-by-allowlist',body:'Domain not in allowlist.'}})},
});
const supervised=(role,input,rule)=>{const f=supervisorFixture(role,input);return {...input,supervisor:pilotSupervisorContext(role,input,rule,f.permission,f.binding,f.networkControl)};};

test('only the exact owner-scoped Product pilot is admitted',()=>{
  assert.ok(isMvpPilot(admitTask(task())));
  for(const overrides of [{taskId:'a'.repeat(36)},{sourceRevision:'a'.repeat(40)},{goal:'other goal for an unrelated Product'},
    {ownedFiles:[...pilotFiles,'src/services/user-actions.ts']},{ownedFiles:[...pilotFiles].reverse()},
    {testFile:'e2e/tests/44-automove-management-persistence.spec.ts'},{extra:true}]) assert.throws(()=>admitTask({...task(),...overrides}),/INVALID_TASK_SCOPE/);
});

test('generic tooling admission cannot rewrite the pilot admission or runner controls',()=>{
  for (const path of ['scripts/agent-flow/mvp-pilot.mjs','scripts/agent-flow/mvp-pilot-runner.mjs','scripts/agent-flow/mvp-pilot.test.mjs','scripts/agent-flow/mvp-pilot-runner.test.mjs','scripts/agent-flow/authority.mjs','scripts/agent-flow/store.mjs']) {
    const generic={...task(),taskId:'12345678-1234-1234-1234-123456789abc',goal:'Generic tooling must not change security controls',ownedFiles:[path,'scripts/agent-flow/example.test.mjs'],testFile:'scripts/agent-flow/example.test.mjs'};
    assert.throws(()=>admitTask(generic),/INVALID_TASK_SCOPE/);
  }
});

test('prepared source rejects unrelated, Product and protected changes and invalid fingerprints',()=>{
  assert.ok(assertPreparedPilot(task(),snapshot(),['AGENTS.md','scripts/agent-flow/mvp-pilot.mjs']));
  assert.ok(assertPreparedPilot(task(),snapshot(),['scripts/agent-flow/authority.mjs','scripts/agent-flow/agent-flow.test.mjs']));
  for(const path of ['src/app/dashboard/bella-auto/customers/page.tsx','src/services/user-actions.ts','scripts/agent-flow/store.mjs','scripts/agent-flow/contract.mjs','scripts/agent-flow-dashboard/authority.mjs','supabase/migrations/new.sql']) {
    assert.throws(()=>assertPreparedPilot(task(),snapshot(),[path]),/MVP_PREPARED_SOURCE_REJECTED/);
  }
  assert.throws(()=>assertPreparedPilot(task(),{...snapshot(),fingerprint:'f'.repeat(64)},[]),/MVP_PREPARED_SOURCE_REJECTED/);
});

test('actual native rule read must match current bytes, not a result label or stale hash',()=>{
  const rule=readPilotRule(workspace);
  assert.match(rule.text,/Six-Step Completion Procedure/);
  const item={id:'native-read',type:'commandExecution',command:ruleCommand,status:'completed',exitCode:0,aggregatedOutput:JSON.stringify(rule)+'\n'};
  const exact=(a,b)=>a===b;
  assert.equal(observedRuleLoad([item],rule,exact).sha256,rule.sha256);
  assert.throws(()=>observedRuleLoad([],rule,exact),/MVP_NATIVE_RULE_READ_REQUIRED/);
  assert.throws(()=>observedRuleLoad([item,item],rule,exact),/MVP_NATIVE_RULE_READ_REQUIRED/);
  assert.throws(()=>observedRuleLoad([{...item,aggregatedOutput:JSON.stringify({...rule,sha256:'0'.repeat(64)})}],rule,exact),/MVP_RULE_SOURCE_MISMATCH/);
});

test('per-role profiles keep source read-only and expose external env path only to exact Verify',()=>{
  const temporary=mkdtempSync(resolve(tmpdir(),'bella-pilot-policy-test-'));
  const envFile=resolve(temporary,'fixture.env');
  writeFileSync(envFile,'NEXT_PUBLIC_SUPABASE_URL=https://bmnbqbcdbuklhopfbopv.supabase.co\nDB_URL=postgresql://postgres:fixture-only@db.bmnbqbcdbuklhopfbopv.supabase.co/postgres\n');
  const options={task:task(),candidate:'b'.repeat(64),output:resolve(temporary,'output'),envFile};
  try {
  for(const role of ['LEAD','BUILDER','VERIFY','REVIEWER']) {
    const execution=pilotExecution(workspace,{...options,role});
    assert.equal(execution.networkEnabled,role==='VERIFY');
    assert.equal(execution.args.includes('features.network_proxy=true'),role==='VERIFY');
    assert.equal(execution.environment.E2E_ENV_FILE!==undefined,role==='VERIFY');
    assert.equal(execution.environment.FACTORY_MVP_NETWORK_MODE,role==='VERIFY'?'full':undefined);
    assert.equal(execution.environment.POWERSHELL_TELEMETRY_OPTOUT,'1');
    assert.equal(execution.environment.TEMP,resolve(options.output,'..','scratch',pilotId));
    assert.equal(execution.filesystem[execution.environment.TEMP.replaceAll('\\','/')],'write');
    assert.equal(execution.environment.PLAYWRIGHT_BROWSERS_PATH,
      role==='VERIFY' && process.platform==='win32' && process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA,'ms-playwright') : undefined);
    assert.equal(execution.environment.SUPABASE_SERVICE_ROLE_KEY,undefined);
    assert.ok(pilotFiles.every(path=>!Object.hasOwn(execution.filesystem,resolve(workspace,path).replaceAll('\\','/'))));
  }
  assert.throws(()=>pilotExecution(workspace,{...options,role:'VERIFY',envFile:resolve(workspace,'.env.local')}),/MVP_EXTERNAL_ENV_OUTPUT_REQUIRED/);
  assert.throws(()=>pilotExecution(workspace,{...options,role:'VERIFY',output:workspace}),/MVP_EXTERNAL_ENV_OUTPUT_REQUIRED/);
  assert.throws(()=>pilotExecution(workspace,{...options,role:'LEAD',output:workspace}),/MVP_EXTERNAL_ENV_OUTPUT_REQUIRED/);
  assert.throws(()=>pilotExecution(workspace,{...options,task:{...task(),goal:'unauthorized'},role:'VERIFY'}),/MVP_PERMISSION_SCOPE_REJECTED/);
  } finally { rmSync(temporary,{recursive:true,force:true}); }
});

test('exact role commands reject extra reads and prompt construction supports independent Reviewer',()=>{
  const rule=readPilotRule(workspace), exact=(a,b)=>a===b;
  const input={task:task(),before:snapshot()};
  const proofPath=resolve(tmpdir(),'safe-verification.json');
  for(const role of ['LEAD','BUILDER','VERIFY','REVIEWER']) {
    const reads=pilotReads(role,proofPath);
    assert.match(pilotPrompt(role,supervised(role,input,rule),rule,reads),/Owner-approved one-task/);
    const items=reads.map((command,index)=>({type:'commandExecution',id:String(index),command,status:'completed',exitCode:0,aggregatedOutput:command===ruleCommand?JSON.stringify(rule)+'\n':'source'}));
    const result={role,workflowSha256:rule.sha256};
    validatePilotReceipt(result,items,rule,exact,proofPath);
    assert.throws(()=>validatePilotReceipt(result,[...items,{...items[0],command:'Get-Content secret.env'}],rule,exact,proofPath),/MVP_EXACT_COMMANDS_REQUIRED/);
  }
});

test('Lead ACCEPT approves only a safe scoped plan, never Product PASS or Go-Live',()=>{
  const rule=readPilotRule(workspace);
  const input={task:task(),before:snapshot()};
  const prompt=pilotPrompt('LEAD',supervised('LEAD',input,rule),rule,pilotReads('LEAD'));
  assert.match(prompt,/ACCEPT means only that this plan is safe, in scope, and ready for Builder to assess\/execute within the approved boundaries/);
  assert.match(prompt,/does not mean the Product flow passed, the pilot is complete, or the Product is Go-Live ready/);
  assert.match(prompt,/Return HELD if the plan is unsafe, out of scope, or a material business prerequisite is unclear/);
  assert.match(prompt,/Native receipts generated after your turn and later runtime checks are collector\/VERIFY responsibilities, not preconditions for your plan/);
  assert.throws(()=>pilotPrompt('LEAD',input,rule,pilotReads('LEAD')),/MVP_SUPERVISOR_CONTEXT_REQUIRED/);
});

test('Builder can hand an unchanged Product to Verify while runtime gates remain unproven',()=>{
  const rule=readPilotRule(workspace);
  const input={task:task(),before:snapshot(),plan:'Verify the existing AutoMove preferences flow.'};
  const prompt=pilotPrompt('BUILDER',supervised('BUILDER',input,rule),rule,pilotReads('BUILDER'));
  assert.match(prompt,/If the authorized source reads establish no Product defect requiring a code change, return exactly this shape/);
  assert.match(prompt,/final BELLA_ROLE_RESULT JSON must include both changed and noChange/);
  assert.match(prompt,/\"decision\":\"DONE\",\"findings\":\[\],\"changed\":\[\],\"noChange\":true/);
  assert.match(prompt,/If an in-scope Product defect is evidenced and fixed, set changed to the exact owned file paths and noChange:false/);
  assert.match(prompt,/runtime, persistence, tenant-denial, invalid-input, telemetry, proxy or Browser\/DB gates remain NOT_PROVEN/);
  assert.match(prompt,/those are Verify acceptance checks/);
});

test('supervisor handoff binds actual pre-turn identity and policy without claiming future proof',()=>{
  const input={task:task(),before:snapshot()},rule=readPilotRule(workspace),f=supervisorFixture('LEAD',input);
  const context=pilotSupervisorContext('LEAD',input,rule,{...f.permission,privateField:'do-not-copy'},{...f.binding,privateField:'do-not-copy'});
  assert.equal(context.candidate,input.before.fingerprint);
  assert.equal(context.binding.threadId,f.binding.threadId);
  assert.equal(context.policy.powershellTelemetryOptout,'1');
  assert.equal(context.nativeLifecycle,'COLLECTOR_MUST_VALIDATE_AFTER_TURN');
  assert.equal(context.productE2E,'NOT_PROVEN');
  assert.equal(context.productGoLive,'NOT_PROVEN');
  assert.equal(context.networkDenial,'REQUIRED_BEFORE_VERIFY_ONLY');
  assert.equal(JSON.stringify(context).includes('do-not-copy'),false);
  for(const edit of [{powershellTelemetryOptout:null},{sourceCandidate:'f'.repeat(64)},{profileId:'bella_mvp_verify'},{networkEnabled:true}]) {
    assert.throws(()=>pilotSupervisorContext('LEAD',input,rule,{...f.permission,...edit},f.binding),/MVP_SUPERVISOR_CONTEXT_INVALID/);
  }
  for(const edit of [{taskId:'other-task'},{threadId:null},{turnId:'already-started'},{sessionId:'invalid/id'},{attempt:0}]) {
    assert.throws(()=>pilotSupervisorContext('LEAD',input,rule,f.permission,{...f.binding,...edit}),/MVP_SUPERVISOR_CONTEXT_INVALID/);
  }
  assert.throws(()=>pilotPrompt('LEAD',{...input,supervisor:{...context,candidate:'f'.repeat(64)}},rule,pilotReads('LEAD')),/MVP_SUPERVISOR_CONTEXT_REQUIRED/);
  assert.throws(()=>pilotPrompt('BUILDER',{...input,supervisor:context},rule,pilotReads('BUILDER')),/MVP_SUPERVISOR_CONTEXT_REQUIRED/);
});

test('Verify supervisor context cannot be created before the executable network-denial gate passes',()=>{
  const input={task:task(),before:snapshot()},rule=readPilotRule(workspace),f=supervisorFixture('VERIFY',input);
  assert.throws(()=>pilotSupervisorContext('VERIFY',input,rule,f.permission,f.binding,{exitCode:0,stdout:'{}'}),/MVP_NETWORK_ENFORCEMENT_NOT_PROVEN/);
  const context=pilotSupervisorContext('VERIFY',input,rule,f.permission,f.binding,f.networkControl);
  assert.equal(context.networkDenial,'VALIDATED_BEFORE_VERIFY_DISPATCH');
  assert.equal(context.productE2E,'NOT_PROVEN');
});

test('network domain map refuses foreign API or DB before allowing native Verify egress',()=>{
  const values={NEXT_PUBLIC_SUPABASE_URL:'https://bmnbqbcdbuklhopfbopv.supabase.co',DB_URL:'postgresql://postgres:fixture-only@db.bmnbqbcdbuklhopfbopv.supabase.co/postgres'};
  assert.equal(nonProductionDomains(values)['production.supabase.co'],undefined);
  assert.deepEqual(Object.keys(nonProductionDomains(values)).sort(), ['localhost','127.0.0.1','bmnbqbcdbuklhopfbopv.supabase.co','db.bmnbqbcdbuklhopfbopv.supabase.co','fonts.googleapis.com','fonts.gstatic.com'].sort());
  for (const host of ['registry.npmjs.org','example.com','foreign.supabase.co']) assert.equal(nonProductionDomains(values)[host],undefined);
  assert.equal(nonProductionDomains(values)['db.bmnbqbcdbuklhopfbopv.supabase.co'],'allow');
  assert.throws(()=>nonProductionDomains({...values,NEXT_PUBLIC_SUPABASE_URL:'https://production.supabase.co'}),/MVP_NETWORK_TARGET_REJECTED/);
  assert.throws(()=>nonProductionDomains({...values,DB_URL:'postgresql://postgres:fixture-only@foreign.supabase.co/postgres'}),/MVP_NETWORK_TARGET_REJECTED/);
});

test('configured network restrictions are insufficient: an allowed forbidden response holds before Browser/DB',()=>{
  const proof={proxy:{host:'127.0.0.1',nodeUseEnvProxy:true},allowed:{destination:'bmnbqbcdbuklhopfbopv.supabase.co:443',tunnelStatus:200,status:401},prohibited:{destination:'example.com:443',status:403,policyError:'blocked-by-allowlist',body:'Domain not in allowlist.'}};
  assertNetworkDenial({exitCode:0,stdout:JSON.stringify(proof)});
  for(const outcome of [{...proof,proxy:{host:'external.example',nodeUseEnvProxy:true}},{...proof,proxy:{host:'127.0.0.1',nodeUseEnvProxy:false}},
    {...proof,allowed:{destination:'foreign.example:443',tunnelStatus:200,status:401}},
    {...proof,allowed:{destination:proof.allowed.destination,tunnelStatus:403,status:401}},{...proof,allowed:{destination:proof.allowed.destination,tunnelStatus:200,status:0}},{...proof,allowed:{destination:proof.allowed.destination,tunnelStatus:200,status:403}},
    {...proof,prohibited:{...proof.prohibited,status:200}},
    {...proof,prohibited:{...proof.prohibited,policyError:null}},{...proof,prohibited:{...proof.prohibited,body:'Unauthorized'}},
    {...proof,prohibited:{destination:'example.com:443',error:'TIMEOUT'}}]) {
    assert.throws(()=>assertNetworkDenial({exitCode:0,stdout:JSON.stringify(outcome)}),/MVP_NETWORK_ENFORCEMENT_NOT_PROVEN/);
  }
  for(const result of [{exitCode:1,stdout:JSON.stringify(proof)},{exitCode:0,stdout:'not JSON'}]) {
    assert.throws(()=>assertNetworkDenial(result),/MVP_NETWORK_ENFORCEMENT_NOT_PROVEN/);
  }
});

test('network proxy must be active even when the exact profile and domain allowlist match',async()=>{
  const execution={profileId:'bella_mvp_verify',filesystem:{},networkEnabled:true,domains:{'approved.example':'allow'},environment:{}};
  const config={permissions:{bella_mvp_verify:{extends:':read-only',filesystem:{},network:{enabled:true,mode:'full',allow_local_binding:true,domains:execution.domains}}},approval_policy:'never',windows:{sandbox:'mxc'},shell_environment_policy:{inherit:'none',set:{}}};
  const server={rpc:async method=>method==='config/read'?{config}:{data:[{id:execution.profileId,allowed:true}]}};
  for(const features of [undefined,{network_proxy:false}]) {
    config.features=features;
    await assert.rejects(checkPilotPermission(server,execution,workspace),/MVP_PERMISSION_POLICY_MISMATCH/);
  }
  config.features={network_proxy:true};
  const permission=await checkPilotPermission(server,execution,workspace);
  assert.equal(permission.networkProxyEnabled,true);
  config.permissions.bella_mvp_verify.network.mode='limited';
  await assert.rejects(checkPilotPermission(server,execution,workspace),/MVP_PERMISSION_POLICY_MISMATCH/);
});

test('network proxy activation cannot replace the executable denial gate',()=>{
  const proxy={host:'127.0.0.1',nodeUseEnvProxy:true},allowed={destination:'bmnbqbcdbuklhopfbopv.supabase.co:443',tunnelStatus:200,status:401};
  for(const prohibited of [{destination:'example.com:443',status:401},{destination:'example.com:443',status:403,policyError:'other',body:'Domain not in allowlist.'},
    {destination:'example.com:443',status:403,policyError:'blocked-by-allowlist',body:'Unauthorized'},
    {destination:'example.com:443',error:'TIMEOUT'},{destination:'example.com:443',error:'Request was cancelled.'}]) {
    const outcome={proxy,allowed,prohibited};
    assert.throws(()=>assertNetworkDenial({exitCode:0,stdout:JSON.stringify(outcome)}),/MVP_NETWORK_ENFORCEMENT_NOT_PROVEN/);
  }
  assert.throws(()=>assertNetworkDenial({exitCode:0,stdout:JSON.stringify({allowed,prohibited:{destination:'example.com:443',status:403,policyError:'blocked-by-allowlist',body:'Domain not in allowlist.'}})}),/MVP_NETWORK_ENFORCEMENT_NOT_PROVEN/);
});

test('known native quota failures remain held and do not use raw error text for classification',()=>{
  for(const error of [{codexErrorInfo:'usageLimitExceeded'},{codex_error_info:'usage_limit_exceeded'}]) {
    assert.equal(pilotNativeTurnFailure({status:'failed',error}),'NATIVE_USAGE_LIMIT_EXCEEDED');
  }
  for(const turn of [{status:'completed'},{status:'failed',error:{message:'usage_limit_exceeded secret-sentinel'}},{status:'failed',error:{codexErrorInfo:'unknown'}}]) {
    assert.equal(pilotNativeTurnFailure(turn),'NATIVE_RUNTIME_UNCERTAIN');
  }
});

test('network probe captures an allowed API response and explicit proxy denial on the Verify profile',async()=>{
  let request;
  const execution={profileId:'bella_mvp_verify',domains:{localhost:'allow','127.0.0.1':'allow','bmnbqbcdbuklhopfbopv.supabase.co':'allow'}};
  await pilotNetworkProbe({rpc:async(method,args)=>{request={method,args};return {exitCode:0,stdout:''};}},execution,workspace);
  assert.equal(request.method,'command/exec');
  assert.equal(request.args.permissionProfile,'bella_mvp_verify');
  const code=request.args.command.at(-1);
  const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8',windowsHide:true});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(code,/https:\/\/bmnbqbcdbuklhopfbopv\.supabase\.co\/auth\/v1\/health/);
  assert.match(code,/CONNECT '\+destination/);
  assert.match(code,/bmnbqbcdbuklhopfbopv\.supabase\.co:443/);
  assert.match(code,/destination:allowedTunnel\.destination/);
  assert.match(code,/NODE_USE_ENV_PROXY!=='1'/);
  assert.match(code,/x-proxy-error/);
  assert.match(code,/policyError/);
  assert.equal(request.args.timeoutMs,20000);
});

async function proof({verifyExit=0,skipped=0,drift=false,omitBuilderNoChangeFields=false}={}) {
  let current=snapshot(); let n=0; const roles=[];
  const terminal=await drive(task(),{snapshot:async()=>structuredClone(current),record:async()=>{},role:async(name,input)=>{
    roles.push(name); const result={role:name,candidate:input.before.fingerprint,nativeVerified:true,binding:{threadId:'role-'+(++n)},findings:[]};
    if(name==='LEAD') return {...result,decision:'ACCEPT',plan:'Verify existing canonical flow without invented changes.'};
    if(name==='BUILDER') { if(drift) current={...current,fingerprint:'f'.repeat(64),files:[...current.files,{path:'src/services/user-actions.ts',mode:'100644',sha256:'a'.repeat(64)}]}; return omitBuilderNoChangeFields?{...result,decision:'DONE'}:{...result,decision:'DONE',changed:[],noChange:true}; }
    if(name==='VERIFY') return {...result,decision:verifyExit===0&&!skipped?'PASS':'FAIL',test:{candidate:input.before.fingerprint,exitCode:verifyExit,counters:{tests:1,pass:verifyExit===0&&!skipped?1:0,fail:verifyExit?1:0,skipped,cancelled:0,todo:0}}};
    return {...result,decision:'PASS'};
  }});
  return {terminal,roles};
}

test('existing-flow verification uses four independent native role bindings without invented Product changes',async()=>{
  const {terminal,roles}=await proof(); assert.equal(terminal.status,'PASS');
  assert.deepEqual(roles,['LEAD','BUILDER','VERIFY','REVIEWER']);
  assert.equal(terminal.receipts[1].noChange,true); assert.deepEqual(terminal.receipts[1].changed,[]);
});

test('unchanged Product cannot pass Builder admission without explicit no-change fields',async()=>{
  const {terminal,roles}=await proof({omitBuilderNoChangeFields:true});
  assert.equal(terminal.status,'HELD');
  assert.equal(terminal.reason,'REAL_BUILDER_CHANGE_REQUIRED');
  assert.deepEqual(roles,['LEAD','BUILDER']);
});

test('failed or skipped verification stops before Reviewer; source drift remains forbidden',async()=>{
  for(const options of [{verifyExit:1},{skipped:1}]) {const {terminal,roles}=await proof(options);assert.equal(terminal.status,'HELD');assert.equal(terminal.reason,'VERIFY_FAILED');assert.ok(!roles.includes('REVIEWER'));}
  const {terminal}=await proof({drift:true});assert.equal(terminal.status,'HELD');assert.equal(terminal.reason,'SOURCE_SCOPE_VIOLATION');
});
