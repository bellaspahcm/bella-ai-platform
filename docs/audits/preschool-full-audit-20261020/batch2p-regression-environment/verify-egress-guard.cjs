'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net');
require('./loopback-only.cjs');
const results=[];
for(const [name,args]of [
  ['REMOTE_TCP_DENIED',[443,'example.invalid']],
  ['OTHER_LOOPBACK_PORT_DENIED',[24433,'127.0.0.1']],
  ['FOREIGN_LOCAL_PIPE_DENIED',['\\\\?\\pipe\\unrelated-regression-test']],
]){
  const socket=new net.Socket();
  try{assert.throws(()=>socket.connect(...args),error=>error.code==='REGRESSION_NETWORK_DENIED');results.push({name,result:'PASS'});}finally{socket.destroy();}
}
async function main(){
  for(const [name,url]of [['REMOTE_FETCH_DENIED','https://example.invalid'],['OTHER_LOCAL_FETCH_DENIED','http://127.0.0.1:24433']]){
    await assert.rejects(fetch(url),error=>error.code==='REGRESSION_NETWORK_DENIED');results.push({name,result:'PASS'});
  }
  // Fixed credential-free local sandbox health probe; loopback-only.cjs rejects other origins.
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  const response=await fetch('http://127.0.0.1:24431/auth/v1/health',{signal:AbortSignal.timeout(8000)});
  assert.equal(response.status,200);await response.body.cancel();
  results.push({name:'ACTUAL_SANDBOX_HEALTH_ALLOWED',result:'PASS',status:response.status});
  const receipt={capturedAt:new Date().toISOString(),result:'PASS_SCOPED_EGRESS_CONTROLS',checks:results,credentialsUsed:false,businessRowsRead:0,mutations:0};
  fs.writeFileSync(path.join(__dirname,'egress-guard-tests.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({result:receipt.result,checks:results.length,mutations:0}));
}
main().catch(error=>{console.error(JSON.stringify({result:'EGRESS_CONTROLS_FAILED',code:error.code||'SANITIZED_FAILURE'}));process.exitCode=1;});
