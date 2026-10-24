'use strict';
// Offline verification-controller negative controls. No credentials/DB/browser.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),file=path.join(root,'scripts/verify-preschool-care-browser-e2e.cjs');
const source=fs.readFileSync(file,'utf8');
const entry="main().catch(()=>{console.error('BROWSER_RUN_FATAL_SANITIZED');process.exitCode=1;});";
assert.equal(source.split(entry).length,2);
function load(present){
  const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
  const realRequire=mod.require.bind(mod);
  mod.require=name=>name==='node:fs'?{...fs,existsSync:target=>String(target)===path.join(root,present||'__absent__')||fs.existsSync(target)}:realRequire(name);
  mod._compile(source.replace(entry,'module.exports={childEnvironment,verifyCareHeaders};'),file);return mod.exports;
}
const cases=[];
for(const name of ['.env','.env.local','.env.production','.env.production.local']){
  assert.throws(()=>load(name).childEnvironment(),error=>error.acceptanceCode==='PRODUCTION_ENV_FILE_PRESENT');
  cases.push({name:'REJECT_'+name,result:'PASS'});
}
const gate=load(null).verifyCareHeaders;
const valid={path:'/api/education/care/bulk',private:true,noStore:true,cacheControl:'private, no-store'};
assert.equal(gate([valid,{...valid,path:'/api/education/care/classes'}]).responses,2);cases.push({name:'VALID_CARE_HEADERS',result:'PASS'});
assert.throws(()=>gate([valid,{...valid,path:'/api/education/care/classes'}],true),error=>error.acceptanceCode==='BROWSER_RECEIPT_COLLECTION_FAILED');cases.push({name:'COLLECTION_FAILURE_CANNOT_PASS',result:'PASS'});
for(const [name,rows] of [['MISSING_PRIVATE',[{...valid,private:false},{...valid,path:'/api/education/care/classes'}]],['MISSING_NO_STORE',[{...valid,noStore:false},{...valid,path:'/api/education/care/classes'}]],['NO_CLASSES_RESPONSE',[valid]],['NO_CARE_RESPONSE',[{...valid,path:'/api/education/care/bulk-extra'}]]]){
  assert.throws(()=>gate(rows),error=>error.acceptanceCode==='AUTHENTICATED_CARE_PRIVATE_HEADERS_FAILED');cases.push({name,result:'PASS'});
}
assert.throws(()=>gate([{...valid,cacheControl:'private="x", no-storex'},{...valid,path:'/api/education/care/classes'}]),error=>error.acceptanceCode==='AUTHENTICATED_CARE_PRIVATE_HEADERS_FAILED');cases.push({name:'LITERAL_CACHE_CONTRACT_REQUIRED',result:'PASS'});
fs.writeFileSync(path.join(__dirname,'browser-controller-guards.json'),JSON.stringify({result:'PASS_OFFLINE_CONTROLLER_GUARDS',networkCalls:0,mutations:0,cases},null,2)+'\n');
console.log(JSON.stringify({result:'PASS_OFFLINE_CONTROLLER_GUARDS',cases:cases.length,networkCalls:0,mutations:0}));
