'use strict';
// Extract exact prerequisite DDL bytes; never replay full migration history or data seeds.
const fs=require('node:fs'),path=require('node:path');
const {root,sha,must}=require('./local-runtime.cjs');
function splitSql(source){
  const out=[];let start=0,state='',tag='',depth=0;
  for(let i=0;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(state==='line'){if(c==='\n')state='';continue;}
    if(state==='block'){if(c==='/'&&n==='*'){depth++;i++;}else if(c==='*'&&n==='/'){if(--depth===0)state='';i++;}continue;}
    if(state==='single'||state==='double'){const q=state==='single'?"'":'"';if(c===q){if(n===q)i++;else state='';}continue;}
    if(state==='dollar'){if(source.startsWith(tag,i)){i+=tag.length-1;state='';}continue;}
    if(c==='-'&&n==='-'){state='line';i++;continue;}
    if(c==='/'&&n==='*'){state='block';depth=1;i++;continue;}
    if(c==="'"){state='single';continue;}if(c==='"'){state='double';continue;}
    if(c==='$'){const match=/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(i));if(match){tag=match[0];state='dollar';i+=tag.length-1;continue;}}
    if(c===';'){out.push({text:source.slice(start,i+1),start,end:i+1});start=i+1;}
  }
  must(!state||state==='line','UNTERMINATED_SQL_LEXEME');
  if(clean(source.slice(start)))throw Error('SQL_TAIL_NOT_TERMINATED');
  return out;
}
function clean(sql){return sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();}
const healthcare=process.argv.includes('--healthcare');
const plans=healthcare?[
  ['20260511000000_initial_schema.sql','customers'],
  ['20260511500000_create_inventory_items.sql','inventory'],
  ['20260806030000_healthcare_kernel_schema.sql','healthcareCore'],
  ['20260806050000_healthcare_platform_extended_schema.sql','healthcareExtended'],
  ['20260807010000_add_doctor_notification_to_lab.sql','ddl'],
  ['20260807100000_hospital_inpatient_his_baseline.sql','ddl'],
  ['20260807040000_add_completed_at_to_hc_encounters.sql','ddl'],
  ['20260807050000_add_status_to_hc_prescriptions.sql','ddl'],
  ['20260811120000_migrate_encounters_to_canonical_schema.sql','ddl'],
  ['20260812010000_make_care_journey_id_nullable.sql','ddl'],
  ['20260812020000_drop_care_journey_fk.sql','ddl'],
  ['20260812030000_extend_clinical_orders_table.sql','encounterUnique'],
  ['20260808000004_create_perioperative_platform.sql','ddl'],
  ['20260808000005_create_icu_ed_bloodbank_tables.sql','ddl'],
  ['20260812040000_recreate_clinical_orders_table.sql','clinicalOrdersOnly'],
  ['20260808000006_create_cds_order_tables.sql','ddl'],
  ['20260812050000_extend_pharmacy_schema.sql','ddl'],
  ['20260813000000_create_h8_cds_schema.sql','ddl'],
  ['20260813000009_temporal_engine_tables.sql','ddl'],
  ['20260813000010_rule_governance_tables.sql','ddl'],
  ['20260813000011_clinical_audit_tables.sql','ddl'],
]:[
  ['20260511000000_initial_schema.sql','foundation'],
  ['20260523030000_grant_service_role_schema_access.sql','ddl'],
  ['20260521000004_harden_rls_and_tenant.sql','tenantHelper'],
  ['20260806000000_blueprint_core_schema.sql','ddl'],
  ['20260808000012_create_rule_engine_tables.sql','ddl'],
  ['20260810000001_create_persons_table.sql','ddl'],
  ['20260810224417_create_students_table.sql','ddl'],
  ['20260810231500_create_courses_and_enrollments.sql','ddl'],
  ['20260810235000_create_attendances.sql','ddl'],
  ['20260812060000_create_education_schema.sql','ddl'],
  ['20260813000020_create_edu_attendance_and_assessment.sql','ddl'],
  ['20260813000030_create_assessments_and_results.sql','ddl'],
  ['20260813000040_create_enrollment_transaction_rpc.sql','ddl'],
  ['20260813000050_create_teacher_assignments.sql','ddl'],
  ['20260912000000_r3_education_identity_cutover.sql','r3Ddl'],
  ['20260926002000_r3_student_create_side_nullable_person_id.sql','ddl'],
  ['20260926003000_education_daily_attendance_state.sql','ddl'],
];
const manifest={createdAt:new Date().toISOString(),sourceRevision:'6b031511fd37e5ee22288676b833cf855d40b43f',target:'OWNED_LOCAL_SANDBOX_ONLY',
  semantics:healthcare?'Healthcare reference schema from owning DDL. Complete Phase B/C calculation provenance is preserved; explicitly labeled temporary stub dependencies in the clinical-orders recreation script are not selected. No production-schema equivalence claim.':'Intentionally frozen Education reference environment from owning migrations, including legacy courses/course_id; does not assert compatibility with the shared production Training table.',
  selection:'Exact canonical DDL statements only. Exclude data migration/backfill/preflight, demo data, unrelated initial tables, table drops and transaction wrappers. No test or runtime source edits.',
  sources:[],statements:[],excluded:[],tables:[],sqlSha256:null};
let bundle='-- LOCAL REGRESSION ONLY. Exact prerequisite statements from pinned source; no remote target.\n';
for(const [name,mode]of plans){
  const relative=`supabase/migrations/${name}`,source=fs.readFileSync(path.join(root,relative),'utf8');
  manifest.sources.push({path:relative,sha256:sha(source),mode});
  for(const item of splitSql(source)){
    const sql=clean(item.text);let include=false,reason='NON_PREREQUISITE_OR_DATA_CONTROL';
    if(mode==='foundation')include=/^CREATE EXTENSION/i.test(sql)||/^CREATE TABLE IF NOT EXISTS (?:public\.)?(?:tenants|users)\s*\(/i.test(sql)||/^CREATE OR REPLACE FUNCTION update_updated_at_column\s*\(/i.test(sql);
    else if(mode==='inventory')include=/^CREATE TABLE IF NOT EXISTS (?:public\.)?inventory_items\s*\(/i.test(sql);
    else if(mode==='customers')include=/^CREATE TABLE IF NOT EXISTS (?:public\.)?customers\s*\(/i.test(sql);
    else if(mode==='encounterUnique')include=/^DO\s+\$/i.test(sql)&&/ADD CONSTRAINT uq_hc_encounters_id_patient/i.test(sql);
    else if(mode==='tenantHelper')include=/^CREATE OR REPLACE FUNCTION public\.get_auth_tenant_id\s*\(/i.test(sql);
    else if(mode==='r3Ddl')include=/^(?:CREATE (?:UNIQUE )?INDEX|COMMENT)/i.test(sql)||(/^DO\s+\$/i.test(sql)&&/ALTER TABLE students|CREATE INDEX idx_students_party_id/i.test(sql)&&!/FROM identity_migration_mapping|FROM students|UPDATE students/i.test(sql));
    else include=/^(?:CREATE|ALTER|COMMENT|GRANT|REVOKE)/i.test(sql)||(/^DROP (?:POLICY|TRIGGER|FUNCTION|INDEX)\b/i.test(sql))||(/^DO\s+\$/i.test(sql)&&/\bCREATE (?:TYPE|POLICY|TRIGGER)|\bALTER TABLE/i.test(sql)&&!/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM)\b/i.test(sql));
    if(mode==='healthcareCore'&&/den_odontograms/i.test(sql))include=false;
    if(mode==='healthcareExtended'&&/^(?:CREATE TABLE IF NOT EXISTS public\.hc_clinical_orders|ALTER TABLE public\.hc_clinical_orders)\b|\bON public\.hc_clinical_orders\b/i.test(sql))include=false;
    if(mode==='clinicalOrdersOnly'&&(!/hc_clinical_orders/i.test(sql)||/^(?:DROP|CREATE TABLE public\.hc_drugs|CREATE TABLE public\.hc_clinical_calculations)/i.test(sql)))include=false;
    // Combined clinical-orders DDL supersedes its earlier CREATE in the CDS source.
    if(healthcare&&name==='20260808000006_create_cds_order_tables.sql'&&/^CREATE TABLE IF NOT EXISTS public\.hc_clinical_orders/i.test(sql))include=false;
    if(/^DROP TABLE\b/i.test(sql)){include=false;reason='TABLE_DROP_NOT_REQUIRED_FOR_EMPTY_SANDBOX';}
    if(/^DELETE\b|^UPDATE\b|^INSERT\b/i.test(sql)){include=false;reason='DATA_MIGRATION_NOT_REQUIRED_FOR_EMPTY_SANDBOX';}
    const receipt={source:relative,start:item.start,end:item.end,line:source.slice(0,item.start).split('\n').length,sha256:sha(item.text),kind:sql.split(/\s+/).slice(0,4).join(' ')};
    if(!include){manifest.excluded.push({...receipt,reason});continue;}
    const table=/^CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)/i.exec(sql);if(table)manifest.tables.push(table[1]);
    manifest.statements.push(receipt);bundle+=`\n-- SOURCE ${relative}:${receipt.line}; SHA256 ${receipt.sha256}\n${item.text}\n`;
  }
}
if(healthcare){
  const textOf=item=>fs.readFileSync(path.join(root,item.source),'utf8').slice(item.start,item.end);
  const policies=new Map();manifest.statements=manifest.statements.filter(item=>{
    const sql=clean(textOf(item));if(!/^CREATE POLICY\b/i.test(sql))return true;
    const normalized=sql.replace(/\s+/g,' ').trim();
    if(policies.has(normalized)){manifest.excluded.push({...item,reason:'IDENTICAL_CANONICAL_POLICY_ALREADY_INCLUDED',samePolicySha256:policies.get(normalized)});return false;}
    policies.set(normalized,item.sha256);return true;
  });
  const extensions=manifest.statements.filter(item=>/^CREATE EXTENSION/i.test(clean(textOf(item))));
  const tables=manifest.statements.filter(item=>/^CREATE TABLE/i.test(clean(textOf(item))));
  const uniquePrerequisites=manifest.statements.filter(item=>/^DO\s+\$/i.test(clean(textOf(item)))&&/ADD CONSTRAINT uq_hc_encounters_id_patient/i.test(clean(textOf(item))));
  const rest=manifest.statements.filter(item=>!extensions.includes(item)&&!tables.includes(item)&&!uniquePrerequisites.includes(item));
  const existing=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'EDUCATION_PREREQUISITES.json'))).tables);
  const pending=[...tables],ordered=[];
  while(pending.length){
    const index=pending.findIndex(item=>{const sql=clean(textOf(item));const own=/^CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)/i.exec(sql)[1];return [...sql.matchAll(/\bREFERENCES\s+(?:public\.)?([a-z_]+)/gi)].every(match=>match[1]===own||existing.has(match[1]));});
    if(index<0){console.error(JSON.stringify({missingPrerequisites:[...new Set(pending.flatMap(item=>[...clean(textOf(item)).matchAll(/\bREFERENCES\s+(?:public\.)?([a-z_]+)/gi)].map(match=>match[1]).filter(name=>!existing.has(name))))]}));}
    must(index>=0,'MISSING_OR_CYCLIC_CANONICAL_FOREIGN_KEY_PREREQUISITE');
    const item=pending.splice(index,1)[0];ordered.push(item);const tableName=/^CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)/i.exec(clean(textOf(item)))[1];existing.add(tableName);
    if(tableName==='hc_encounters')ordered.push(...uniquePrerequisites);
  }
  manifest.statements=[...extensions,...ordered,...rest];
  manifest.ordering='Exact extension and CREATE TABLE statements topologically sorted by canonical FK dependencies; subsequent DDL retains source sequence. Existing Education data untouched.';
  bundle='-- LOCAL HEALTHCARE REGRESSION ONLY. Exact canonical statements ordered by FK prerequisites.\n';
  for(const receipt of manifest.statements)bundle+=`\n-- SOURCE ${receipt.source}:${receipt.line}; SHA256 ${receipt.sha256}\n${textOf(receipt)}\n`;
}
manifest.tables=[...new Set(manifest.tables)].sort();
manifest.sqlSha256=sha(bundle);manifest.statementCount=manifest.statements.length;
const basename=healthcare?'HEALTHCARE_PREREQUISITES':'EDUCATION_PREREQUISITES';
for(const extension of ['sql','json']){
  const priorPath=path.join(__dirname,`${basename}.${extension}`);
  if(fs.existsSync(priorPath)){const bytes=fs.readFileSync(priorPath);const backup=path.join(__dirname,`${basename}-preserved-${sha(bytes)}.${extension}`);if(!fs.existsSync(backup))fs.writeFileSync(backup,bytes);}
}
fs.writeFileSync(path.join(__dirname,`${basename}.sql`),bundle);
fs.writeFileSync(path.join(__dirname,`${basename}.json`),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({result:'PREPARED_NOT_EXECUTED',sources:manifest.sources.length,statements:manifest.statementCount,tables:manifest.tables.length,excluded:manifest.excluded.length,sqlSha256:manifest.sqlSha256}));
module.exports={splitSql};
