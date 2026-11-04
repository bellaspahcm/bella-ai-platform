'use strict';
// Runtime-only egress restriction for the approved isolated regression process.
const net=require('node:net');
const path=require('node:path'),os=require('node:os');
const tsxPipe='\\\\?\\pipe\\'+path.join(os.tmpdir(),`tsx-${os.userInfo().username}`,`${process.ppid}.pipe`);
const allowed=options=>['127.0.0.1','localhost','::1'].includes(String(options.host||options.hostname||'localhost'))&&[24431,24432].includes(Number(options.port));
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
  const normalized=Array.isArray(args[0])?args[0]:args;
  const first=normalized[0];
  const options=first&&typeof first==='object'?first:{port:first,host:typeof normalized[1]==='string'?normalized[1]:'localhost'};
  // tsx's exact parent-process named pipe is local IPC, not an outbound socket.
  if(process.platform==='win32'&&(first===tsxPipe||options.path===tsxPipe))return originalConnect.apply(this,args);
  if(!allowed(options)){const error=new Error('REGRESSION_NON_SANDBOX_NETWORK_DENIED');error.code='REGRESSION_NETWORK_DENIED';throw error;}
  return originalConnect.apply(this,args);
};
if(typeof globalThis.fetch==='function'){
  const originalFetch=globalThis.fetch;
  globalThis.fetch=function(input,...args){
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    if(url.origin!=='http://127.0.0.1:24431'){const error=new Error('REGRESSION_NON_SANDBOX_FETCH_DENIED');error.code='REGRESSION_NETWORK_DENIED';return Promise.reject(error);}
    return originalFetch.call(this,input,...args);
  };
}
