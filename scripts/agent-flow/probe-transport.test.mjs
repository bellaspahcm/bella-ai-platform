import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppServer} from './probe.mjs';

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
