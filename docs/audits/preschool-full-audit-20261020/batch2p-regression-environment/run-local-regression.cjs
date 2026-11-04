'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {root,project,must,safeEnv,connect,sha}=require('./local-runtime.cjs');
const command=process.argv[2];must(['education:verify','healthcare:verify','education:diagnostic','healthcare:laboratory:diagnostic'].includes(command),'EXACT_REGRESSION_COMMAND_REQUIRED');
const diagnosticFiles=['src/platform/education/__tests__/verification-gates.test.ts','src/platform/education/__tests__/kernel-invariants.integration.test.ts','src/platform/education/__tests__/attendance-contract-real-db.integration.test.ts'];
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const report={startedAt:new Date().toISOString(),project,command:`npm run ${command}`,runtimeSourceChanges:false,rawLogsPersisted:false,credentialsPersisted:false,businessRowContentsPersistedInEvidence:false};
const schema=async db=>(await db.query("select n.nspname,c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum")).rows;
async function main(){
  for(const file of ['.env','.env.local','.env.test','.env.test.local','.env.production','.env.production.local'])must(!fs.existsSync(path.join(root,file)),'DOTENV_NOT_ALLOWED');
  const {db,config}=await connect();
  try{
    report.schemaBeforeSha256=sha(JSON.stringify(await schema(db)));report.containerId=config.containerId;
    const env={...safeEnv(),NODE_ENV:'test',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:`--require "${path.join(__dirname,'loopback-only.cjs').replaceAll('\\','/')}"`,
      NEXT_PUBLIC_SUPABASE_URL:config.values.API_URL,SUPABASE_URL:config.values.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:config.values.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:config.values.SERVICE_ROLE_KEY};
    // Do not enable tests requiring an unreviewed fixture JWT. Provider/RLS scope is separate.
    const diagnostic=command.endsWith(':diagnostic');
    const selectedFiles=command==='education:diagnostic'?diagnosticFiles:['src/platform/healthcare/__tests__/laboratory-engine.integration.test.ts'];
    const executable=diagnostic?process.execPath:process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe';
    const args=diagnostic?[path.join(root,'node_modules/jest/bin/jest.js'),'--runTestsByPath',...selectedFiles,'--runInBand','--json']:['/d','/s','/c',`npm run ${command}`];
    if(diagnostic)report.command=`node node_modules/jest/bin/jest.js --runTestsByPath ${selectedFiles.join(' ')} --runInBand --json`;
    const child=spawn(executable,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let bytes=0,stdout='';const chunks=[];
    child.stdout.on('data',chunk=>{if(stdout.length<10*1024*1024)stdout+=chunk.toString();});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{bytes+=chunk.length;if(bytes<12*1024*1024)chunks.push(chunk.toString());});
    const progress=setInterval(()=>console.log(JSON.stringify({stage:'LOCAL_REGRESSION_RUNNING',command:report.command,outputBytes:bytes})),25000);
    let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;try{require('node:child_process').spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}},10*60_000);
    const exit=await new Promise(resolve=>{child.once('error',()=>resolve({code:null,spawnFailure:true}));child.once('exit',(code,signal)=>resolve({code,signal}));});
    clearInterval(progress);clearTimeout(timeout);
    let output=chunks.join('');
    for(const value of [config.values.ANON_KEY,config.values.SERVICE_ROLE_KEY,config.values.JWT_SECRET,config.values.DB_URL].filter(Boolean))output=output.replaceAll(value,'[LOCAL_CREDENTIAL_REDACTED]');
    output=output.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT_REDACTED]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[KEY_REDACTED]');
    const lines=output.split(/\r?\n/);
    if(diagnostic){
      const json=JSON.parse(stdout);report.executedCounts={suites:json.numTotalTestSuites,failedSuites:json.numFailedTestSuites,tests:json.numTotalTests,failedTests:json.numFailedTests,passedTests:json.numPassedTests,pendingTests:json.numPendingTests};
      report.failedAssertions=json.testResults.flatMap(suite=>suite.assertionResults.filter(test=>test.status==='failed').map(test=>({file:path.relative(root,suite.name).replaceAll('\\','/'),name:test.fullName,status:test.status,
        diagnostics:test.failureMessages.flatMap(message=>message.replace(/\u001b\[[0-9;]*m/g,'').split(/\r?\n/).filter(line=>/^\s*(?:Error: |TypeError: |Failed to (?:create|set|load|find|seed|save)|Expected: (?:true|false|null|\d)|Received: (?:true|false|null|\d)|Expected number of calls:|Received number of calls:)/.test(line)).map(line=>line.trim().replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'[SYNTHETIC_ID]'))),
        scalarMismatch:test.failureMessages.some(message=>/Expected: (?:true|false|null|\d)/.test(message))})));
    }
    const structural=lines.filter(line=>/^(?:> |PASS |FAIL |Test Suites:|Tests:|Time:|Snapshots:|Ran all test suites|  ● )/.test(line));
    fs.writeFileSync(path.join(__dirname,`local-${command.split(':')[0]}-${stamp}.structure.log`),structural.join('\n')+'\n');
    report.actualNativeExitCode=exit.code;report.signal=exit.signal;report.timedOut=timedOut;report.outputBytes=bytes;
    report.earlyFailureLines=lines.filter(line=>/^Error:|Cannot find module|^\s+code: '[A-Z_]+',?\s*$/.test(line)).slice(0,6);
    report.summaries=lines.filter(line=>/^(Test Suites:|Tests:)/.test(line));
    report.failureCategories={missingRelation:/(?:relation [^\r\n]*does not exist|Could not find the table)/i.test(output),missingColumn:/(?:column [^\r\n]*does not exist|Could not find the [^\r\n]*column)/i.test(output),
      foreignKey:/foreign key constraint/i.test(output),notNull:/not-null constraint/i.test(output),checkConstraint:/check constraint/i.test(output),appendOnly:/append.only|immutable/i.test(output),
      mockDns:/ENOTFOUND mock\.supabase\.co/.test(output),networkDenied:/REGRESSION_(?:NETWORK_DENIED|NON_SANDBOX)/.test(output)};
    report.safeDiagnostics=lines.filter(line=>/^\s+(?:Failed to seed|Failed to create|Failed to save|Database error|Error:|TypeError:)/.test(line)&&!line.includes('Failing row contains'))
      .map(line=>line.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'[SYNTHETIC_ID]').replace(/\b(?:details|data|payload|row):.*$/i,'[ROW_DETAILS_OMITTED]')).slice(0,24);
    report.schemaAfterSha256=sha(JSON.stringify(await schema(db)));report.schemaUnchanged=report.schemaAfterSha256===report.schemaBeforeSha256;
    const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
    report.localResidualCounts={};for(const {tablename}of tables)report.localResidualCounts[tablename]=Number((await db.query(`select count(*)::int as count from public.${tablename}`)).rows[0].count);
    report.result=exit.code===0&&!timedOut&&report.schemaUnchanged?'PASS_EXACT_COMMAND_LOCAL_ENVIRONMENT':'FAIL_EXACT_COMMAND_LOCAL_ENVIRONMENT';
    if(exit.code!==0||timedOut||!report.schemaUnchanged)process.exitCode=1;
  }finally{await db.end();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,`local-${command.split(':')[0]}-${stamp}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,nativeExit:report.actualNativeExitCode,summaries:report.summaries,failureCategories:report.failureCategories,safeDiagnostics:report.safeDiagnostics}));}
}
main().catch(error=>{console.error(JSON.stringify({result:'LOCAL_REGRESSION_PREFLIGHT_OR_COLLECTION_FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
