'use strict';
// Read-only metadata inspection of the approved E2E target after its recorded timeout.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const file = path.join(root, 'scripts/verify-preschool-care-rls-e2e.cjs');
const source = fs.readFileSync(file, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
if (sha(source) !== 'cf6668792ab9779d5019aa01039e259baffd681dbba7248d96f7d7e84275cbb9') throw Error('PINNED_SOURCE_CHANGED');
const entry = "main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
if (source.split(entry).length !== 2) throw Error('PINNED_ENTRY_CHANGED');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(source.replace(entry, String.raw`module.exports={async inspect(){
  config=await readConfig();args={approved:false};
  db=new(require('pg').Client)({...config.pg,connectionTimeoutMillis:8000});db.on('error',()=>{});await db.connect();connected=true;
  try{
    await db.query({text:'begin read only',query_timeout:35000});transaction=true;
    await q("set local lock_timeout='5s'; set local statement_timeout='30s'");
    const identity=(await q("select current_setting('transaction_read_only') as read_only")).rows[0];
    must(identity.read_only==='on','READ_ONLY_TRANSACTION_REQUIRED');
    const before=await snapshot();must(before.sha256==='9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2','CATALOG_DRIFT');
    const foreignKeys=(await q("select n.nspname as schema,c.relname as relation,k.conname as constraint_name,pg_get_constraintdef(k.oid) as definition,k.condeferrable as deferrable,k.condeferred as deferred,exists(select 1 from pg_index i where i.indrelid=k.conrelid and i.indisvalid and i.indisready and i.indpred is null and i.indexprs is null and i.indnkeyatts>=cardinality(k.conkey) and ARRAY(select i.indkey[pos] from generate_series(0,cardinality(k.conkey)-1) as pos) @> k.conkey) as leading_index_candidate from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where k.contype='f' and k.confrelid='public.users'::regclass order by n.nspname,c.relname,k.conname")).rows;
    const triggers=(await q("select t.tgname as name,t.tgenabled as enabled,pn.nspname as function_schema,p.proname as function_name from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where t.tgrelid='public.users'::regclass and not t.tgisinternal order by t.tgname")).rows;
    const waiting=(await q("select coalesce(wait_event_type,'NONE') as wait_type,count(*)::int as sessions,count(*) filter(where cardinality(pg_blocking_pids(pid))>0)::int as blocked from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() group by coalesce(wait_event_type,'NONE') order by 1")).rows;
    const after=await snapshot();must(before.sha256===after.sha256,'CATALOG_DRIFT');await q('commit');
    return{capturedAt:new Date().toISOString(),projectRef:REF,result:'READ_ONLY_METADATA_CAPTURED',transactionReadOnly:true,mutations:0,businessRowContentsPersisted:false,catalogBefore:before.sha256,catalogAfter:after.sha256,foreignKeys,triggers,currentWaitSummary:waiting,timeoutRootCause:'NOT_PROVEN',limitation:'Current metadata and waits are not historical lock/query evidence. Index candidates do not establish runtime cause.'};
  }finally{await db.end();}
}};`), file);
mod.exports.inspect().then(result => {
  const name = `cleanup-dependencies-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, foreignKeys: result.foreignKeys.length,
    withoutLeadingIndexCandidate: result.foreignKeys.filter(fk => !fk.leading_index_candidate).length,
    triggers: result.triggers.length, timeoutRootCause: result.timeoutRootCause, evidence: name }));
}).catch(error => { console.error(JSON.stringify({ result: 'READ_ONLY_INSPECTION_FAILED', code: /^[A-Z0-9_]{2,90}$/.test(error.code || error.acceptanceCode || '') ? error.code || error.acceptanceCode : 'SANITIZED_FAILURE' })); process.exitCode = 1; });
