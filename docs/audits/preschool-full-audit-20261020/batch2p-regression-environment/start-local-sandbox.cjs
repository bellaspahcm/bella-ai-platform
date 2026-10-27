'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const project = 'bella-preschool-regression-20261021';
const sandbox = path.join(os.tmpdir(), project);
const cli = 'C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const env = Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
const report = { startedAt: new Date().toISOString(), project, sandbox, cliVersion: '2.115.0',
  migrationAutoEnabled: false, demoSeedEnabled: false, remoteProjectLinked: false, runtimeSourceChanges: false };
function docker(args) {
  const result = spawnSync('docker', ['--context','desktop-linux',...args], { env, encoding:'utf8',windowsHide:true,timeout:15000 });
  if (result.status !== 0) throw Error('DOCKER_INSPECTION_FAILED');
  return result.stdout.trim();
}
async function portFree(port) {
  await new Promise((resolve,reject) => {
    const server = net.createServer();
    server.once('error', () => reject(Error('SANDBOX_PORT_NOT_FREE')));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function main() {
  const authority = JSON.parse(fs.readFileSync(path.join(__dirname,'AUTHORITY.json'),'utf8').replace(/^\uFEFF/,''));
  const marker = JSON.parse(fs.readFileSync(path.join(sandbox,'owner-marker.json'),'utf8').replace(/^\uFEFF/,''));
  if (authority.verbatimReply !== 'Duyệt sandbox local đúng đề xuất (khuyến nghị)' || marker.projectId !== project
    || authority.proposalSha256 !== sha(fs.readFileSync(path.join(__dirname,'OWNER_DECISION.md')))) throw Error('AUTHORITY_OR_MARKER_MISMATCH');
  const config = fs.readFileSync(path.join(sandbox,'supabase/config.toml'));
  if (sha(config) !== sha(fs.readFileSync(path.join(__dirname,'local.config.toml')))
    || fs.existsSync(path.join(sandbox,'supabase/.temp/project-ref'))) throw Error('CONFIG_OR_REMOTE_LINK_REJECTED');
  report.configSha256 = sha(config);
  report.dockerServer = docker(['info','--format','{{.ServerVersion}}']);
  report.containersBefore = docker(['ps','-a','--format','{{.ID}} {{.Names}}']).split(/\r?\n/).filter(Boolean);
  if (report.containersBefore.some(row=>row.includes(project))) throw Error('SANDBOX_CONTAINER_ALREADY_EXISTS');
  for(const port of [24430,24431,24432]) await portFree(port);
  const args = [cli,'start','--workdir',sandbox,'--exclude','realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'];
  report.command = 'supabase start --workdir [owned sandbox] --exclude [unused services]';
  const child = spawn(process.execPath,args,{env,cwd:sandbox,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const chunks=[];let bytes=0;
  for(const stream of [child.stdout,child.stderr]) stream.on('data',data=>{bytes+=data.length;if(bytes<6*1024*1024)chunks.push(data.toString());});
  const progress=setInterval(()=>console.log(JSON.stringify({stage:'LOCAL_STACK_STARTING',outputBytes:bytes})),25000);
  let timedOut=false;
  const deadline=setTimeout(()=>{timedOut=true;try{spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}},20*60_000);
  const exit=await new Promise(resolve=>{child.once('error',()=>resolve({code:null,spawnFailure:true}));child.once('exit',(code,signal)=>resolve({code,signal}));});
  clearInterval(progress);clearTimeout(deadline);
  const output=chunks.join('');
  report.startExit=exit;report.timedOut=timedOut;report.outputBytes=bytes;
  // Never persist CLI status/start credentials, including local keys.
  report.diagnostics=output.split(/\r?\n/).filter(line=>/error|failed|invalid|unknown|unsupported|cannot|could not/i.test(line))
    .map(line=>line.replace(/postgres(?:ql)?:\/\/\S+/g,'[DB_URL_REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT_REDACTED]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[KEY_REDACTED]')).slice(-12);
  report.containersAfter=docker(['ps','-a','--filter',`label=com.supabase.cli.project=${project}`,'--format','{{.ID}} {{.Names}} {{.Status}}']).split(/\r?\n/).filter(Boolean);
  report.finishedAt=new Date().toISOString();report.result=exit.code===0&&!timedOut?'LOCAL_STACK_STARTED_NOT_SCHEMA_PROVEN':'LOCAL_STACK_START_FAILED';
  fs.writeFileSync(path.join(__dirname,'local-stack-start.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:report.result,startExit:exit,diagnostics:report.diagnostics,containers:report.containersAfter.length}));
  if(exit.code!==0||timedOut)process.exitCode=1;
}
main().catch(error=>{report.result='LOCAL_STACK_PREFLIGHT_FAILED';report.errorCode=/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE';report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'local-stack-start.json'),JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify({result:report.result,errorCode:report.errorCode}));process.exitCode=1;});
