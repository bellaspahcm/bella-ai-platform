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
input.on('line',line=>{const request=JSON.parse(line);if(request.id!==1)return;
 const response=Buffer.from(JSON.stringify({id:1,result:{text}})+'\\n');
 const notification=Buffer.from(JSON.stringify({method:'fixture/notification',params:{text}})+'\\n');
 const split=bytes=>bytes.indexOf(Buffer.from('↓'))+2;
 process.stdout.write(response.subarray(0,split(response)));
 setTimeout(()=>{process.stdout.write(response.subarray(split(response)));process.stdout.write(notification.subarray(0,split(notification)));setTimeout(()=>process.stdout.write(notification.subarray(split(notification))),30);},30);
});`;
    await writeFile(join(root,'app-server'),fixture,'utf8');
    let resolveNotification;const notification=new Promise(resolve=>{resolveNotification=resolve;});
    server=new AppServer(process.execPath,root,message=>resolveNotification(message));
    const result=await server.initialize();assert.equal(result.text,text);
    const received=await Promise.race([notification,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('NOTIFICATION_TIMEOUT')),2000);timer.unref();})]);
    assert.equal(received.params.text,text);assert.equal(server.notificationError,undefined);
  }finally{await server?.close();await rm(root,{recursive:true,force:true});}
});
