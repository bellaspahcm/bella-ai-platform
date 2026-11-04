'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const project = 'bella-preschool-regression-20261021';
const sandbox = path.join(os.tmpdir(), project);
const cli = 'C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
const root = path.resolve(__dirname, '../../../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const safeEnv = () => Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
function must(value, code) { if (!value) throw Error(code); }
function docker(args, input) {
  const result = spawnSync('docker', ['--context','desktop-linux',...args], {env:safeEnv(),encoding:'utf8',windowsHide:true,timeout:45000,input,maxBuffer:4*1024*1024});
  must(result.status===0,'LOCAL_DOCKER_COMMAND_FAILED');return result.stdout.trim();
}
function configuration() {
  const marker = JSON.parse(fs.readFileSync(path.join(sandbox,'owner-marker.json'),'utf8').replace(/^\uFEFF/,''));
  must(marker.projectId===project && !fs.existsSync(path.join(sandbox,'supabase/.temp/project-ref')),'SANDBOX_OWNERSHIP_OR_LINK_REJECTED');
  must(sha(fs.readFileSync(path.join(sandbox,'supabase/config.toml')))===sha(fs.readFileSync(path.join(__dirname,'local.config.toml'))),'SANDBOX_CONFIGURATION_CHANGED');
  const container=JSON.parse(docker(['inspect',`supabase_db_${project}`]))[0];
  must(container.Config.Labels['com.supabase.cli.project']===project&&container.State.Running===true,'SANDBOX_CONTAINER_REJECTED');
  const port=container.NetworkSettings.Ports['5432/tcp'];
  must(port?.some(item=>item.HostPort==='24432'),'SANDBOX_DATABASE_PORT_REJECTED');
  const result=spawnSync(process.execPath,[cli,'status','--workdir',sandbox,'--output','json'],{env:safeEnv(),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:512*1024});
  must(result.status===0,'LOCAL_STATUS_FAILED');
  const values=JSON.parse(result.stdout);
  const dbUrl=new URL(values.DB_URL),apiUrl=new URL(values.API_URL);
  must(dbUrl.hostname==='127.0.0.1'&&dbUrl.port==='24432'&&dbUrl.pathname==='/postgres'&&apiUrl.origin==='http://127.0.0.1:24431','REMOTE_TARGET_FORBIDDEN');
  must(values.ANON_KEY&&values.SERVICE_ROLE_KEY,'LOCAL_KEYS_REQUIRED');
  return {values, containerId:container.Id,containerName:container.Name.slice(1),pg:{connectionString:values.DB_URL,ssl:false,connectionTimeoutMillis:8000,query_timeout:35000,statement_timeout:30000,lock_timeout:5000,application_name:project}};
}
async function connect() {
  const config=configuration();
  const {Client}=require(path.join(root,'node_modules/pg'));
  const db=new Client(config.pg);db.on('error',()=>{});await db.connect();
  const identity=(await db.query("select current_database() as database,current_setting('server_version_num')::int as version_num")).rows[0];
  must(identity.database==='postgres'&&identity.version_num>=170000&&identity.version_num<180000,'LOCAL_DATABASE_IDENTITY_REJECTED');
  return {db,config,identity};
}
module.exports={root,project,sandbox,sha,must,safeEnv,docker,configuration,connect};
if(require.main===module)connect().then(async({db,config,identity})=>{
  try{
    const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row=>row.tablename);
    const receipt={capturedAt:new Date().toISOString(),result:tables.length===0?'PASS_EMPTY_OWNED_LOCAL_SANDBOX':'LOCAL_SCHEMA_NOT_EMPTY',project,containerId:config.containerId,identity,apiOrigin:'http://127.0.0.1:24431',databaseHost:'127.0.0.1',databasePort:24432,publicTables:tables,automaticMigrations:false,automaticSeed:false,remoteProjectLinked:false,mutations:0,credentialsPersisted:false};
    fs.writeFileSync(path.join(__dirname,'local-identity.json'),JSON.stringify(receipt,null,2)+'\n');
    console.log(JSON.stringify({result:receipt.result,publicTables:tables.length,mutations:0}));
  }finally{await db.end();}
}).catch(error=>{console.error(JSON.stringify({result:'LOCAL_IDENTITY_FAILED',code:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SANITIZED_FAILURE'}));process.exitCode=1;});
