'use strict';
// Authorized disposable-stack recovery, never a table/trigger bypass.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {project,sandbox,configuration,docker,safeEnv,must}=require('./local-runtime.cjs');
const config=configuration();
const all=docker(['container','ls','-a','--format','json']).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
const foreign=all.filter(item=>!item.Names.endsWith(`_${project}`)).map(item=>item.ID).sort();
const owned=all.filter(item=>item.Names.endsWith(`_${project}`)).map(item=>item.ID);
must(owned.length===4&&owned.some(id=>config.containerId.startsWith(id)),'EXACT_OWNED_STACK_REQUIRED');
const cli='C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
const result=spawnSync(process.execPath,[cli,'stop','--workdir',sandbox,'--no-backup'],{env:safeEnv(),cwd:sandbox,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:512*1024});
const remaining=docker(['container','ls','-a','--format','json']).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
const foreignAfter=remaining.filter(item=>!item.Names.endsWith(`_${project}`)).map(item=>item.ID).sort();
must(result.status===0&&!remaining.some(item=>item.Names.endsWith(`_${project}`))&&JSON.stringify(foreign)===JSON.stringify(foreignAfter),'OWNED_STACK_RECOVERY_NOT_PROVEN');
const receipt={capturedAt:new Date().toISOString(),project,command:'supabase stop --workdir [owned sandbox] --no-backup',actualNativeExitCode:result.status,ownedContainersRemoved:owned.length,foreignContainersUnchanged:foreign,rowsRecoveredBy:'DISPOSABLE_STACK_REMOVAL_NO_TRIGGER_OR_POLICY_BYPASS',result:'PASS_OWNED_STACK_RESET'};
fs.writeFileSync(path.join(__dirname,`local-stack-reset-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({result:receipt.result,ownedContainersRemoved:owned.length,foreignContainersUnchanged:foreign.length}));
