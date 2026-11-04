const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');const d=__dirname;
const tracked=['src/app/api/education/courses/route.ts','src/app/api/education/courses/[id]/route.ts','src/app/api/education/courses/__tests__/route.test.ts'];
const added=['src/app/api/education/courses/request-context.ts','src/app/api/education/courses/__tests__/access.test.ts',path.relative(process.cwd(),path.join(d,'build-rpc.cjs')).replaceAll('\\','/'),'supabase/migrations/20261021030000_restrict_exec_sql_client_execution.sql'];
let diff=cp.execFileSync('git',['diff','339c89250d87964ba8d58860a5ecdbc0bdde4956','--',...tracked],{encoding:'utf8'});
for(const f of added){const r=cp.spawnSync('git',['diff','--no-index','--','NUL',f],{encoding:'utf8'});if(![0,1].includes(r.status))throw Error('Cannot construct untracked diff');diff+='\n'+r.stdout;}
fs.writeFileSync(path.join(d,'review.diff'),diff);console.log(JSON.stringify({files:tracked.concat(added),diffBytes:Buffer.byteLength(diff),stagingChanges:false}));
