import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppServer,factoryTransport,factoryScratch,prepareFactoryScratch,runProductJest} from './probe.mjs';
import {productTaskHash} from './role-validation.mjs';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// A local fake RPC process exercises the actual pipe decoder. No native model/run.
test('AppServer preserves UTF-8 characters split across real pipe data events',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bella-rpc-utf8-'));let server;
  const text='Tiếng Việt ↓ ℹ đ → 中文';
  try{
    const fixture=`const readline=require('node:readline');
const text=${JSON.stringify(text)};
const input=readline.createInterface({input:process.stdin});
const response=Buffer.from(JSON.stringify({id:1,result:{text}})+'\\n');
const notification=Buffer.from(JSON.stringify({method:'fixture/notification',params:{text}})+'\\n');
const split=bytes=>bytes.indexOf(Buffer.from('↓'))+2;
input.on('line',line=>{const request=JSON.parse(line);
 if(request.id===1)process.stdout.write(response.subarray(0,split(response)));
 else if(request.method==='fixture/continue-response')process.stdout.write(Buffer.concat([response.subarray(split(response)),notification.subarray(0,split(notification))]));
 else if(request.method==='fixture/continue-notification')process.stdout.write(notification.subarray(split(notification)));
});`;
    await writeFile(join(root,'app-server'),fixture,'utf8');
    let resolveNotification;const notification=new Promise(resolve=>{resolveNotification=resolve;});
    server=new AppServer(process.execPath,root,message=>resolveNotification(message));
    const responseBytes=Buffer.from(JSON.stringify({id:1,result:{text}})+'\n');
    const notificationBytes=Buffer.from(JSON.stringify({method:'fixture/notification',params:{text}})+'\n');
    const split=bytes=>bytes.indexOf(Buffer.from('↓'))+2;
    const expected=[responseBytes.subarray(0,split(responseBytes)),Buffer.concat([responseBytes.subarray(split(responseBytes)),notificationBytes.subarray(0,split(notificationBytes))]),notificationBytes.subarray(split(notificationBytes))];
    let phase=0,observed=Buffer.alloc(0);const boundaries=[];
    // The child cannot send continuation bytes until this parent data event ACKs.
    server.child.stdout.on('data',bytes=>{
      observed=Buffer.concat([observed,bytes]);
      if(observed.length<expected[phase].length)return;
      assert.deepEqual(observed,expected[phase]);boundaries.push(observed);observed=Buffer.alloc(0);phase++;
      const method=['fixture/continue-response','fixture/continue-notification'][phase-1];
      if(method)server.child.stdin.write(JSON.stringify({method})+'\n');
    });
    const result=await server.initialize();assert.equal(result.text,text);
    const received=await Promise.race([notification,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('NOTIFICATION_TIMEOUT')),2000);timer.unref();})]);
    assert.equal(received.params.text,text);assert.equal(server.notificationError,undefined);
    assert.equal(phase,3);assert.deepEqual(boundaries[0].subarray(-2),Buffer.from([0xe2,0x86]));assert.deepEqual(boundaries[1].subarray(-2),Buffer.from([0xe2,0x86]));
  }finally{await server?.close();await rm(root,{recursive:true,force:true});}
});

test('Product transport preserves role-specific exact file/scratch rules and rejects digest/root substitution', async () => {
  const descriptor=Object.getOwnPropertyDescriptor(process,'platform');
  const values={SystemDrive:'C:',SystemRoot:'C:/Windows',COMSPEC:'C:/Windows/System32/cmd.exe',PATH:process.env.PATH||'/fixture',PATHEXT:'.EXE',USERPROFILE:'C:/Users/fixture',APPDATA:'C:/Users/fixture/AppData/Roaming',LOCALAPPDATA:'C:/Users/fixture/AppData/Local'};
  const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
  const task={taskId:randomUUID(),sourceRevision:'a'.repeat(40),goal:'Verify exact Product permissions without native dispatch.',
    ownedFiles:['src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx','src/components/bella-auto/__tests__/BellaAutoAnalyticsDashboard.recognition.test.tsx'],
    testFile:'src/components/bella-auto/__tests__/BellaAutoAnalyticsDashboard.recognition.test.tsx',acceptance:['No native process or source edit.'],maxSeconds:60,
    product:{workspace:process.cwd(),dependencyRoot:resolve('node_modules'),dependencyFingerprint:'a'.repeat(64),testEnvironment:'jsdom'}};
  const approval=productTaskHash(task),scratch=resolve(process.cwd(),'..','scratch',task.taskId);
  Object.defineProperty(process,'platform',{...descriptor,value:'win32'});
  if(descriptor.value!=='win32')Object.assign(process.env,values);
  try{
    await mkdir(resolve(scratch,'..'),{recursive:true});
    assert.equal(await prepareFactoryScratch(process.cwd(),task,approval),scratch);
    for(const role of ['LEAD','BUILDER','VERIFY','REVIEWER']){
      const result=factoryTransport(process.cwd(),{task,role,productApproval:approval});
      const portable=p=>p.replaceAll('\\','/');
      const expected=role==='BUILDER'?[...task.ownedFiles.map(p=>portable(resolve(p))),portable(scratch)]:role==='VERIFY'?[portable(scratch)]:[];
      assert.deepEqual(Object.keys(result.policy.filesystem),expected);
      assert.equal(result.policy.extends,':read-only');assert.deepEqual(result.policy.network,{enabled:false});
      assert.equal(result.args.some(arg=>arg.includes('workspace-write')),false);
      assert.throws(()=>factoryTransport(process.cwd(),{task,role}),/PRODUCT_APPROVAL_REQUIRED/);
      assert.throws(()=>factoryTransport(process.cwd(),{task,role,productApproval:'b'.repeat(64)}),/PRODUCT_APPROVAL_REQUIRED/);
      const moved={...task,product:{...task.product,workspace:resolve('other-workspace')}};
      assert.throws(()=>factoryTransport(process.cwd(),{task:moved,role,productApproval:productTaskHash(moved)}),/PRODUCT_ROOT_MISMATCH/);
    }
    assert.throws(()=>factoryScratch(process.cwd(),task),/PRODUCT_APPROVAL_REQUIRED/);
    assert.throws(()=>new AppServer('must-not-start',process.cwd(),()=>{},{task,role:'BUILDER'}),/PRODUCT_APPROVAL_REQUIRED/);
  }finally{
    Object.defineProperty(process,'platform',descriptor);
    for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await rm(scratch,{recursive:true,force:true});
  }
});

test('invalid Product Jest requests fail before AppServer, Jest or application setup can start', () => {
  for(const args of [[],['--product-jest'],['--product-jest','bad'],['--product-jest','e30=','extra'],['--product-jest','eyJ4IjoxfQ==']])assert.throws(()=>runProductJest(args));
  const result=spawnSync(process.execPath,['scripts/agent-flow/probe.mjs','--product-jest'],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,1);assert.match(result.stderr,/INVALID_PRODUCT_JEST_COMMAND/);
  assert.equal(result.stdout,'');assert.equal(result.stderr.includes('BATCH1_PROOF'),false);
});
