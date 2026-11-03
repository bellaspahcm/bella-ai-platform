// Bounded attendance DB rehearsal; owned synthetic loopback profile only.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client }=pg;
const repo=process.cwd(), root=path.join(repo,'docs/audits/preschool-main-20261101');
const runDirectory=process.argv[2], label=process.argv[3];
if(!runDirectory || !/^v[12]$/.test(label??'')) throw Error('REHEARSAL_ARGUMENTS_REQUIRED');
const receipt=JSON.parse(await readFile(path.join(runDirectory,'receipt.json'),'utf8'));
const intent=JSON.parse(await readFile(path.join(runDirectory,'owner-intent.json'),'utf8'));
const apiUrl=process.env.BELLA_PROFILE_API_URL, dbUrl=process.env.BELLA_PROFILE_DB_URL;
const anonKey=process.env.BELLA_PROFILE_ANON_KEY, serviceKey=process.env.BELLA_PROFILE_SERVICE_ROLE_KEY;
if(!apiUrl||!dbUrl||!anonKey||!serviceKey)throw Error('LOCAL_ENV_REQUIRED');
const api=new URL(apiUrl),db=new URL(dbUrl);
if(!['127.0.0.1','localhost'].includes(api.hostname)||!['127.0.0.1','localhost'].includes(db.hostname)
 ||api.origin!==receipt.apiOrigin||Number(db.port)!==receipt.databasePort||intent.projectId!==receipt.projectId
 ||receipt.schemaAcceptance!=='PASS'||path.resolve(intent.repositoryRoot)!==path.resolve(repo))throw Error('OWNED_LOOPBACK_MISMATCH');
const container=execFileSync('docker',['inspect','--format','{{.Id}}','supabase_db_'+receipt.projectId],{encoding:'utf8',windowsHide:true}).trim();
if(container!==receipt.databaseContainerId)throw Error('CONTAINER_ID_MISMATCH');
const previous=(JSON.parse(await readFile(path.join(root,'attendance-production-catalog-live.json'),'utf8'))).rows[0].catalog;
const supplement=(JSON.parse(await readFile(path.join(root,'attendance-production-catalog-supplement.json'),'utf8'))).rows[0].catalog;
const live=JSON.parse(await readFile(path.join(root,'attendance-db-dependencies-live.json'),'utf8'));
const candidate=await readFile(path.join(root,'ATTENDANCE_DB_CANDIDATE.sql'),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const candidateHash=sha(candidate);
const fixtureSource=await readFile(path.join(repo,'scripts/ci/preschool-browser-profile/teacher-attendance.e2e.mjs'),'utf8');
if(createHash('sha256').update(fixtureSource).digest('hex')!=='7e29b454aa0aa87ebe47788bc81840eb4343a4937a2466229475c9dd7a4b8bd0')throw Error('FIXTURE_SOURCE_DRIFT');
const result={label,projectId:receipt.projectId,sourceRevision:receipt.sourceRevision,candidateHash,baseline:'PENDING',parse:'NOT_RUN',rollback:'NOT_RUN',checks:[],compatibility:'NOT_RUN',productionTouched:false,fixtureKind:'synthetic-only',completedAt:null};
const createdPasswords=[];
const outcome={fixture:{}};
let pgClient,serviceClient;
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const check=(name,ok,detail)=>{result.checks.push({name,status:ok?'PASS':'FAIL',...(detail?{detail}:{} )});console.log((ok?'PASS ':'FAIL ')+name);};
async function requiredRpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error('RPC_FAILED:'+name+':'+error.code+':'+error.message);return data;}
async function createAuthUser(email,password){const {data,error}=await serviceClient.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user?.id)throw Error('SYNTHETIC_AUTH_CREATE_FAILED');return data.user.id;}
async function signIn(client,email,password){const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.session)throw Error('SYNTHETIC_LOGIN_FAILED');return {userId:data.user.id,accessToken:data.session.access_token};}
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
const claims=token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
async function asCaller(token,guc,isolation,body,role='authenticated'){
 const client=new Client({connectionString:dbUrl,statement_timeout:10000});await client.connect();
 try{await client.query('BEGIN ISOLATION LEVEL '+isolation);await client.query('SET LOCAL ROLE '+role);
 await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(token?claims(token):{role:'service_role'})]);
 if(guc!==null)await client.query("SELECT set_config('app.current_tenant_id',$1,true)",[guc]);
 const value=await body(client);await client.query('COMMIT');return value;
 }finally{await client.query('ROLLBACK').catch(()=>{});await client.end();}
}
async function catalogFingerprint(){
 const r=await pgClient.query(`SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('sig',p.oid::regprocedure::text,'md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',p.proowner) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('edu_set_daily_attendance','edu_can_access_attendance_enrollment','edu_preschool_roster_identity','preschool_teacher_attendance_courses','preschool_teacher_can_attend_course','edu_set_scoped_daily_attendance','preschool_set_scoped_daily_attendance')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'using',pg_get_expr(polqual,polrelid),'roles',polroles,'mode',polpermissive) ORDER BY polname) FROM pg_policy WHERE polrelid='public.edu_attendance_daily_state'::regclass),
 'acl',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl::text,'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY c.relname) FROM pg_class c WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass))) AS x`);
 return JSON.stringify(r.rows[0].x);
}
async function restoreBefore(){
 await pgClient.query(supplement.tenantPresentation[0].definition);
 for(const f of previous.functions.filter(f=>/^(edu_set_daily_attendance|edu_can_access_attendance_enrollment|edu_preschool_roster_identity|edu_set_scoped_daily_attendance|preschool_set_scoped_daily_attendance)\(/.test(f.signature))){
   await pgClient.query(f.definition);
   await pgClient.query('REVOKE ALL ON FUNCTION public.'+f.signature+' FROM PUBLIC,anon,authenticated,service_role');
   for(const item of f.acl.slice(1,-1).split(',')){
     const role=item.split('=')[0];
     if(['anon','authenticated','service_role'].includes(role)&&previous.effectiveExecute.some(e=>e.signature===f.signature&&e.role===role&&e.execute))
       await pgClient.query('GRANT EXECUTE ON FUNCTION public.'+f.signature+' TO '+role);
   }
 }
 await pgClient.query('DROP FUNCTION IF EXISTS public.preschool_teacher_attendance_courses(date,uuid)');
 await pgClient.query('DROP FUNCTION IF EXISTS public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)');
 for(const p of live.policyReferences)await pgClient.query('ALTER POLICY '+p.name+' ON public.edu_attendance_daily_state USING ('+p.using+')');
 for(const table of ['edu_attendance','edu_attendance_daily_state']){
   await pgClient.query('REVOKE ALL ON TABLE public.'+table+' FROM PUBLIC,anon,authenticated,service_role');
   for(const p of live.directAttendancePrivileges.filter(p=>p.table===table)){
     const privileges=['select','insert','update','delete','truncate'].filter(k=>p[k]);
     if(privileges.length)await pgClient.query('GRANT '+privileges.join(',')+' ON TABLE public.'+table+' TO '+p.role);
   }
 }
 // The captured Production ACL allows this SELECT; the regular profile intentionally does not.
 await pgClient.query('GRANT SELECT ON public.tenants TO authenticated');
 const actual=await pgClient.query("SELECT oid::regprocedure::text AS signature,md5(pg_get_functiondef(oid)) AS md5,proacl::text AS acl FROM pg_proc WHERE oid IN ('public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)'::regprocedure,'public.edu_can_access_attendance_enrollment(uuid,uuid,date)'::regprocedure,'public.edu_preschool_roster_identity(uuid,date)'::regprocedure)");
 result.baselineFunctions=actual.rows;
 for(const a of actual.rows){const expected=live.functions.find(f=>f.signature===a.signature);assert(expected&&a.md5===expected.definitionMd5&&a.acl===expected.acl,'BEFORE_DEFINITION_ACL_MISMATCH:'+a.signature);}
 result.baseline='MATCHED_TARGETED_FUNCTION_POLICY_ACL_SURFACES';
}
async function main(){
 pgClient=new Client({connectionString:dbUrl,statement_timeout:30000});await pgClient.connect();
 serviceClient=createClient(apiUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 for(const table of ['tenants','users','party_parties','edu_courses','edu_enrollments','teacher_assignments','edu_attendance']){
 const r=await pgClient.query('SELECT count(*)::int AS n FROM public.'+table);assert(r.rows[0].n===0,'PROFILE_NOT_EMPTY:'+table);}
  const suffix = randomUUID().slice(0, 8);
  const passwords = {
    adminA: `${randomBytes(26).toString('base64url')}A1!`,
    adminB: `${randomBytes(26).toString('base64url')}B2!`,
    teacher: `${randomBytes(26).toString('base64url')}T3!`,
    orphan: `${randomBytes(26).toString('base64url')}O4!`,
  };
  createdPasswords.push(...Object.values(passwords));
  const emails = {
    adminA: `e2e-admin-a-${suffix}@bella.test`,
    adminB: `e2e-admin-b-${suffix}@bella.test`,
    teacher: `e2e-teacher-${suffix}@bella.test`,
    orphan: `e2e-orphan-${suffix}@bella.test`,
  };
  const ids = {
    tenantA: randomUUID(), tenantB: randomUUID(),
    adminA: null, adminB: null, teacher: null,
    branchA: randomUUID(), branchB: randomUUID(), branchC: randomUUID(),
    adminDirectoryA: randomUUID(), adminDirectoryB: randomUUID(),
    teacherDirectory: randomUUID(), teacherParty: randomUUID(),
    studentPartyA: randomUUID(), studentPartyB: randomUUID(), studentPartyC: randomUUID(),
    personA: randomUUID(), personB: randomUUID(), personC: randomUUID(),
    studentA: randomUUID(), studentB: randomUUID(), studentC: randomUUID(),
    courseA: randomUUID(), courseB: randomUUID(), courseC: randomUUID(),
    enrollmentA: randomUUID(), enrollmentB: randomUUID(), enrollmentC: randomUUID(),
    requestA: randomUUID(), requestB: randomUUID(), requestC: randomUUID(),
    authLink: randomUUID(), identityManagerGrant: randomUUID(), teacherConfirmation: randomUUID(), teacherAssignment: randomUUID(),
  };
  ids.adminA = await createAuthUser(emails.adminA, passwords.adminA);
  ids.adminB = await createAuthUser(emails.adminB, passwords.adminB);
  ids.teacher = await createAuthUser(emails.teacher, passwords.teacher);
  await createAuthUser(emails.orphan, passwords.orphan);

  const dayResult = await pgClient.query("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day");
  const schoolDay = dayResult.rows[0].day;
  const studentRows = [
    { tenantId: ids.tenantA, partyId: ids.studentPartyA, personId: ids.personA, studentId: ids.studentA, courseId: ids.courseA, enrollmentId: ids.enrollmentA, requestId: ids.requestA, code: `SYN-A-${suffix}`, first: 'Synthetic', last: 'Child A' },
    { tenantId: ids.tenantA, partyId: ids.studentPartyB, personId: ids.personB, studentId: ids.studentB, courseId: ids.courseB, enrollmentId: ids.enrollmentB, requestId: ids.requestB, code: `SYN-B-${suffix}`, first: 'Synthetic', last: 'Child B' },
    { tenantId: ids.tenantB, partyId: ids.studentPartyC, personId: ids.personC, studentId: ids.studentC, courseId: ids.courseC, enrollmentId: ids.enrollmentC, requestId: ids.requestC, code: `SYN-C-${suffix}`, first: 'Synthetic', last: 'Child C' },
  ];

  await pgClient.query('BEGIN');
  try {
    await pgClient.query("INSERT INTO public.tenants(id,name,status,product_key) VALUES ($1,'Synthetic Preschool A','active','bella_preschool'),($2,'Synthetic Preschool B','active','bella_preschool')", [ids.tenantA, ids.tenantB]);
    await pgClient.query(`INSERT INTO public.users(id,email,full_name,role,status,tenant_id)
      VALUES ($1,$2,'Synthetic Admin A','admin','active',$4),($3,$5,'Synthetic Admin B','admin','active',$6),($7,$8,'Synthetic Teacher','admin_staff','active',$4)`,
    [ids.adminA, emails.adminA, ids.adminB, ids.tenantA, emails.adminB, ids.tenantB, ids.teacher, emails.teacher]);
    await pgClient.query(`INSERT INTO public.org_units(id,tenant_id,unit_type,name,code,is_active)
      VALUES ($1,$4,'branch','Synthetic Branch A',$6,true),($2,$4,'branch','Synthetic Branch B',$7,true),($3,$5,'branch','Synthetic Branch C',$8,true)`,
    [ids.branchA, ids.branchB, ids.branchC, ids.tenantA, ids.tenantB, `BA-${suffix}`, `BB-${suffix}`, `BC-${suffix}`]);
    await pgClient.query(`INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active)
      VALUES ($1,$2,$3,'employee','Synthetic Admin A',true),($4,$5,$6,'employee','Synthetic Admin B',true),
        ($7,$2,$8,'employee','Synthetic Teacher',true)`,
    [ids.adminDirectoryA, ids.tenantA, ids.adminA, ids.adminDirectoryB, ids.tenantB, ids.adminB, ids.teacherDirectory, ids.teacher]);
    // Access must be active at the database's CURRENT_DATE; schoolDay can be tomorrow in UTC.
    await pgClient.query(`INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type,since)
      VALUES ($1,$2,'person',$3,'unit','manages',CURRENT_DATE),($1,$2,'person',$4,'unit','manages',CURRENT_DATE),
        ($5,$6,'person',$7,'unit','manages',CURRENT_DATE),($1,$8,'person',$3,'unit','belongs_to',CURRENT_DATE)`,
    [ids.tenantA, ids.adminDirectoryA, ids.branchA, ids.branchB, ids.tenantB,
      ids.adminDirectoryB, ids.branchC, ids.teacherDirectory]);

    await pgClient.query(`INSERT INTO public.party_parties(id,tenant_id,party_type,display_name,gender,dob)
      VALUES ($1,$4,'person','Synthetic Teacher','other','1990-01-01'),($2,$4,'person','Synthetic Child A','other','2020-01-01'),($3,$4,'person','Synthetic Child B','other','2020-01-01'),($5,$6,'person','Synthetic Child C','other','2020-01-01')`,
    [ids.teacherParty, ids.studentPartyA, ids.studentPartyB, ids.tenantA, ids.studentPartyC, ids.tenantB]);

    for (const row of studentRows) {
      await pgClient.query(`INSERT INTO public.persons(id,tenant_id,first_name,last_name,date_of_birth,gender,status)
        VALUES ($1,$2,$3,$4,'2020-01-01','other','active')`, [row.personId, row.tenantId, row.first, row.last]);
      await pgClient.query(`INSERT INTO public.students(student_id,tenant_id,person_id,student_code,academic_status,enrollment_type,program_id,enrollment_date,party_id)
        VALUES ($1,$2,$3,$4,'enrolled','full_time','preschool',CURRENT_DATE,$5)`, [row.studentId, row.tenantId, row.personId, row.code, row.partyId]);
    }

    await pgClient.query(`INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment)
      VALUES ($1,$4,$6,'Synthetic Assigned Class','active',20,0),($2,$4,$7,'Synthetic Other Branch Class','active',20,0),($3,$5,$8,'Synthetic Other Tenant Class','active',20,0)`,
    [ids.courseA, ids.courseB, ids.courseC, ids.tenantA, ids.tenantB, `E2E-A-${suffix}`, `E2E-B-${suffix}`, `E2E-C-${suffix}`]);
    for (const row of studentRows) {
      await pgClient.query(`INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,enrolled_at,request_id)
        VALUES ($1,$2,$3,$4,'active',clock_timestamp(),$5)`, [row.enrollmentId, row.tenantId, row.partyId, row.courseId, row.requestId]);
    }
    await pgClient.query(`INSERT INTO public.party_identity_link_managers(id,tenant_id,auth_user_id,valid_from,granted_by,reference)
      VALUES ($1,$2,$3,clock_timestamp()-interval '1 minute',$4,'Synthetic local/E2E fixture grant')`,
    [ids.identityManagerGrant, ids.tenantA, ids.adminA, ids.adminA]);
    await pgClient.query('COMMIT');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  }

  const adminAClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const adminBClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const adminA = await signIn(adminAClient, emails.adminA, passwords.adminA, 'ADMIN_A');
  const adminB = await signIn(adminBClient, emails.adminB, passwords.adminB, 'ADMIN_B');
  assert(adminA.userId === ids.adminA && adminB.userId === ids.adminB, 'FIXTURE_ADMIN_AUTH_PROFILES_MATCH');

  const managerReceipt = await requiredRpc(adminAClient, 'party_confirm_auth_link', {
    p_operation_key: ids.authLink,
    p_auth_user_id: ids.teacher,
    p_party_id: ids.teacherParty,
    p_valid_from: new Date(Date.now() - 60_000).toISOString(),
    p_valid_until: null,
    p_attestation: 'Synthetic administrator confirmed the teacher identity for isolated E2E.',
  });
  assert(managerReceipt?.id === ids.authLink && managerReceipt?.partyId === ids.teacherParty, 'AUTH_PARTY_PUBLIC_CONFIRM_CONTRACT');

  for (const [tenantId, actorId, branchId, courseId, enrollmentId, requestId] of [
    [ids.tenantA, ids.adminA, ids.branchA, ids.courseA, ids.enrollmentA, ids.requestA],
    [ids.tenantA, ids.adminA, ids.branchB, ids.courseB, ids.enrollmentB, ids.requestB],
    [ids.tenantB, ids.adminB, ids.branchC, ids.courseC, ids.enrollmentC, ids.requestC],
  ]) {
    const result = await requiredRpc(serviceClient, 'preschool_assign_chain', {
      p_tenant_id: tenantId, p_actor_id: actorId, p_course_id: courseId,
      p_enrollment_id: enrollmentId, p_branch_id: branchId, p_request_id: requestId,
    });
    assert(Array.isArray(result) && result.length === 1, 'SYNTHETIC_BRANCH_ENROLLMENT_ASSIGNMENT_CREATED');
  }
  await requiredRpc(serviceClient, 'preschool_confirm_teacher', {
    p_tenant_id: ids.tenantA, p_actor_id: ids.adminA, p_branch_id: ids.branchA,
    p_operation_key: ids.teacherConfirmation, p_teacher_party_id: ids.teacherParty,
    p_valid_from: schoolDay, p_valid_to: null,
    p_attestation: 'Synthetic local/E2E administrator verified teacher and branch.',
  });
  const assignment = await requiredRpc(serviceClient, 'edu_assign_preschool_teacher', {
    p_tenant_id: ids.tenantA, p_actor_id: ids.adminA, p_branch_id: ids.branchA,
    p_operation_key: ids.teacherAssignment, p_course_id: ids.courseA,
    p_confirmation_id: ids.teacherConfirmation, p_teacher_party_id: ids.teacherParty,
    p_role: 'lead_teacher', p_academic_year: '2026-2027',
    p_effective_start_date: schoolDay, p_effective_end_date: null,
  });
  assert(assignment?.assignment_id === ids.teacherAssignment && assignment?.canonical_course_id === ids.courseA,
    'CANONICAL_TEACHER_ASSIGNMENT_CONTRACT');

  // Seed real out-of-scope attendance rows only in this disposable profile so JWT/RLS denial is observable.
  const rollCallTime = `${schoolDay}T05:00:00.000Z`;
  for (const [tenantId, enrollmentId] of [[ids.tenantA, ids.enrollmentB], [ids.tenantB, ids.enrollmentC]]) {
    const { error } = await serviceClient.rpc('edu_set_daily_attendance', {
      p_tenant_id: tenantId, p_enrollment_id: enrollmentId, p_status: 'excused',
      p_roll_call_time: rollCallTime, p_school_day: schoolDay,
    });
    if (error) throw new Error('OUT_OF_SCOPE_FIXTURE_STATE_SEED_FAILED');
  }

  const teacherClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const teacher = await signIn(teacherClient, emails.teacher, passwords.teacher, 'TEACHER');
  assert(teacher.userId === ids.teacher, 'TEACHER_AUTH_SUBJECT_MATCHES_FIXTURE');
  const orphanClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await signIn(orphanClient, emails.orphan, passwords.orphan, 'ORPHAN_AUTH');
  outcome.fixture = {
    kind: 'synthetic-only', businessDataImported: false, fabricatedR3IdentityMappings: false,
    tenantCount: 2, branchCount: 3, teacherCount: 1, studentCount: 3, classCount: 3,
    preflightEmpty: true, syntheticOnly: true,
  };
  outcome._fixtureIds = ids;
  outcome._schoolDay = schoolDay;
  outcome._studentNames = ['Synthetic Child A', 'Synthetic Child B', 'Synthetic Child C'];

 await restoreBefore();
 const before=await catalogFingerprint();
 await pgClient.query(candidate);
 result.parse='PASS';
 check('original_candidate_parse_preflight_postflight',true);
 check('explicit_rollback_restores_all_package_metadata',(await catalogFingerprint())===before);
 result.rollback='PASS';
 try{await pgClient.query(candidate.replace(/ROLLBACK;\s*$/,'SELECT 1/0;\nROLLBACK;'));throw Error('FAULT_DID_NOT_FAIL');}
 catch(e){assert(e.code==='22012','WRONG_INJECTED_FAULT:'+e.message);await pgClient.query('ROLLBACK');}
 check('late_package_failure_rolls_back_all_ddl_acl',(await catalogFingerprint())===before);
 for(const [name,ddl,expected] of [
 ['dependency',"CREATE VIEW public.attendance_rehearsal_drift AS SELECT public.edu_can_access_attendance_enrollment(NULL::uuid,NULL::uuid,CURRENT_DATE)",'ATTENDANCE_REGISTERED_DEPENDENCY'],
 ['acl','GRANT UPDATE ON public.edu_attendance_daily_state TO authenticated','ATTENDANCE_TABLE_ACL_DRIFT'],
 ['schema','ALTER TABLE public.edu_attendance_daily_state RENAME COLUMN school_day TO rehearsal_day','ATTENDANCE_COLUMN_DRIFT'],
 ['function',"ALTER FUNCTION public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date) SET statement_timeout='7s'",'ATTENDANCE_FUNCTION_DRIFT']]){
   await pgClient.query('BEGIN');await pgClient.query(ddl);let rejected=false;
   try{await pgClient.query(candidate);}catch(e){rejected=e.message.includes(expected);}finally{await pgClient.query('ROLLBACK');}
   check('preflight_rejects_'+name+'_drift',rejected&&await catalogFingerprint()===before);
 }
 // Independent English tenant/session fixtures, not business rows imported from another DB.
 const english={tenant:randomUUID(),other:randomUUID(),user:null,party:randomUUID(),course:randomUUID(),enrollment:randomUUID(),request:randomUUID()};
 const englishPassword=randomBytes(28).toString('base64url')+'E1!';createdPasswords.push(englishPassword);
 const englishEmail='e2e-english-'+randomUUID()+'@bella.test';
 english.user=await createAuthUser(englishEmail,englishPassword);
 await pgClient.query("INSERT INTO public.tenants(id,name,status,product_key) VALUES($1,'Synthetic English A','active','bella_english_center'),($2,'Synthetic English B','active','bella_english_center')",[english.tenant,english.other]);
 await pgClient.query("INSERT INTO public.users(id,email,full_name,role,status,tenant_id) VALUES($1,$2,'Synthetic English Actor','admin','active',$3)",[english.user,englishEmail,english.tenant]);
 await pgClient.query("INSERT INTO public.party_parties(id,tenant_id,party_type,display_name) VALUES($1,$2,'person','Synthetic English Pupil')",[english.party,english.tenant]);
 await pgClient.query("INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment) VALUES($1,$2,$3,'Synthetic English Course','active',20,0)",[english.course,english.tenant,'ENG-'+randomUUID()]);
 await pgClient.query("INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,enrolled_at,request_id) VALUES($1,$2,$3,$4,'active',clock_timestamp(),$5)",[english.enrollment,english.tenant,english.party,english.course,english.request]);
 const englishClient=createClient(apiUrl,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const englishSession=await signIn(englishClient,englishEmail,englishPassword);
 const unassigned={course:randomUUID(),party:randomUUID(),person:randomUUID(),student:randomUUID(),enrollment:randomUUID(),request:randomUUID()};
 await pgClient.query("INSERT INTO public.party_parties(id,tenant_id,party_type,display_name) VALUES($1,$2,'person','Synthetic Unassigned Child')",[unassigned.party,ids.tenantA]);
 await pgClient.query("INSERT INTO public.persons(id,tenant_id,first_name,last_name,date_of_birth,gender,status) VALUES($1,$2,'Synthetic','Unassigned','2020-01-01','other','active')",[unassigned.person,ids.tenantA]);
 await pgClient.query("INSERT INTO public.students(student_id,tenant_id,person_id,student_code,academic_status,enrollment_type,program_id,enrollment_date,party_id) VALUES($1,$2,$3,$4,'enrolled','full_time','preschool',CURRENT_DATE,$5)",[unassigned.student,ids.tenantA,unassigned.person,'UNASSIGNED-'+randomUUID(),unassigned.party]);
 await pgClient.query("INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment) VALUES($1,$2,$3,'Synthetic Unassigned Same Branch','active',20,0)",[unassigned.course,ids.tenantA,'UNASSIGNED-'+randomUUID()]);
 await pgClient.query("INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,enrolled_at,request_id) VALUES($1,$2,$3,$4,'active',clock_timestamp(),$5)",[unassigned.enrollment,ids.tenantA,unassigned.party,unassigned.course,unassigned.request]);
 await requiredRpc(serviceClient,'preschool_assign_chain',{p_tenant_id:ids.tenantA,p_actor_id:ids.adminA,p_course_id:unassigned.course,p_enrollment_id:unassigned.enrollment,p_branch_id:ids.branchA,p_request_id:unassigned.request});
 const writeArgs=[english.tenant,english.enrollment,'present',rollCallTime,schoolDay];
 await requiredRpc(serviceClient,'edu_set_daily_attendance',{p_tenant_id:english.tenant,p_enrollment_id:english.enrollment,p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
 const probeEnglish=async()=>{
   const data={};
   for(const [key,guc]of [['withoutGuc',null],['withGuc',english.tenant],['foreignGuc',ids.tenantA]]){
     try{data[key]=await asCaller(englishSession.accessToken,guc,'READ COMMITTED',async c=>(await c.query('SELECT tenant_id,enrollment_id FROM public.edu_attendance_daily_state ORDER BY tenant_id,enrollment_id')).rows);}
     catch(e){data[key]={error:e.code};}
     try{const w=await asCaller(englishSession.accessToken,guc,'READ COMMITTED',c=>c.query('SELECT * FROM public.edu_set_daily_attendance($1,$2,$3,$4,$5)',writeArgs));data[key+'Write']=w.rows.length===1&&w.rows[0].enrollment_id===english.enrollment;}
     catch(e){data[key+'Write']={error:e.code};}
   }
   try{data.repeatableReadWrite=(await asCaller(englishSession.accessToken,null,'REPEATABLE READ',c=>c.query('SELECT * FROM public.edu_set_daily_attendance($1,$2,$3,$4,$5)',writeArgs))).rows.length===1;}catch(e){data.repeatableReadWrite={error:e.code};}
   const rest=await englishClient.rpc('edu_set_daily_attendance',{p_tenant_id:english.tenant,p_enrollment_id:english.enrollment,p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});data.restWriteWithoutGuc=!rest.error&&rest.data?.length===1;
   return data;
 };
 const baselineEnglish=await probeEnglish();result.englishBefore=baselineEnglish;
 // Only the final transaction terminator changes for the owned local commit rehearsal.
 await pgClient.query(candidate.replace(/ROLLBACK;\s*$/,'COMMIT;'));
 check('isolated_commit_of_exact_candidate',true);
 const afterEnglish=await probeEnglish();result.englishAfter=afterEnglish;
 for(const key of Object.keys(baselineEnglish))check('english_compatibility_'+key,JSON.stringify(afterEnglish[key])===JSON.stringify(baselineEnglish[key]),{before:baselineEnglish[key],after:afterEnglish[key]});
 const scope=await requiredRpc(teacherClient,'preschool_teacher_attendance_courses',{p_school_day:schoolDay,p_branch_id:null});
 check('teacher_assigned_scope',scope.courses.length===1&&scope.courses[0].courseId===ids.courseA);
 const roster=await requiredRpc(teacherClient,'edu_preschool_roster_identity',{p_course_id:ids.courseA,p_school_day:schoolDay});
 check('teacher_assigned_roster',roster.roster.length===1&&roster.roster[0].enrollmentId===ids.enrollmentA);
 const own=await requiredRpc(teacherClient,'edu_set_daily_attendance',{p_tenant_id:ids.tenantA,p_enrollment_id:ids.enrollmentA,p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
 const readback=await pgClient.query('SELECT status FROM public.edu_attendance_daily_state WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3',[ids.tenantA,ids.enrollmentA,schoolDay]);
 check('teacher_save_owner_readback',own.length===1&&readback.rows[0]?.status==='present');
 const teacherReload=await teacherClient.from('edu_attendance_daily_state').select('enrollment_id,status').eq('enrollment_id',ids.enrollmentA);
 check('teacher_caller_readback',!teacherReload.error&&teacherReload.data?.length===1&&teacherReload.data[0].status==='present');
 for(const [name,tenant,course,enrollment]of [['unassigned_same_branch',ids.tenantA,unassigned.course,unassigned.enrollment],['other_branch',ids.tenantA,ids.courseB,ids.enrollmentB],['other_tenant',ids.tenantB,ids.courseC,ids.enrollmentC]]){
   const priorCount=await pgClient.query('SELECT count(*)::int AS n FROM public.edu_attendance WHERE enrollment_id=$1',[enrollment]);
   const deniedRoster=await teacherClient.rpc('edu_preschool_roster_identity',{p_course_id:course,p_school_day:schoolDay});
   const deniedWrite=await teacherClient.rpc('edu_set_daily_attendance',{p_tenant_id:tenant,p_enrollment_id:enrollment,p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
   const afterCount=await pgClient.query('SELECT count(*)::int AS n FROM public.edu_attendance WHERE enrollment_id=$1',[enrollment]);
   check('teacher_denies_'+name,deniedRoster.error?.code==='42501'&&deniedWrite.error?.code==='42501'&&priorCount.rows[0].n===afterCount.rows[0].n);
 }
 const worker=await requiredRpc(serviceClient,'preschool_set_scoped_daily_attendance',{
 p_tenant_id:ids.tenantA,p_actor_id:ids.adminA,p_expected_role:'admin',p_branch_id:ids.branchA,
 p_enrollment_id:ids.enrollmentA,p_course_id:ids.courseA,p_student_party_id:ids.studentPartyA,
 p_status:'excused',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
 check('admin_service_nested_scoped_write',worker.length===1&&worker[0].status==='excused');
 const forbiddenWorker=await teacherClient.rpc('preschool_set_scoped_daily_attendance',{
 p_tenant_id:ids.tenantA,p_actor_id:ids.adminA,p_expected_role:'admin',p_branch_id:ids.branchA,
 p_enrollment_id:ids.enrollmentA,p_course_id:ids.courseA,p_student_party_id:ids.studentPartyA,
 p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
 check('authenticated_cannot_execute_trusted_worker_command',forbiddenWorker.error?.code==='42501');
 const englishForeign=await englishClient.rpc('edu_set_daily_attendance',{p_tenant_id:ids.tenantB,p_enrollment_id:ids.enrollmentC,p_status:'present',p_roll_call_time:rollCallTime,p_school_day:schoolDay});
 check('english_cross_tenant_write_denied',englishForeign.error?.code==='42501');
 const privileges=await pgClient.query("SELECT r.rolname,c.relname,has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,has_table_privilege(r.rolname,c.oid,'INSERT') AS ins,has_table_privilege(r.rolname,c.oid,'UPDATE') AS upd,has_table_privilege(r.rolname,c.oid,'DELETE') AS del,has_any_column_privilege(r.rolname,c.oid,'INSERT') AS col_ins,has_any_column_privilege(r.rolname,c.oid,'UPDATE') AS col_upd FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname IN ('anon','authenticated','service_role') AND c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass)");
 check('acl_direct_user_writes_closed',privileges.rows.filter(p=>p.rolname!=='service_role').every(p=>!p.ins&&!p.upd&&!p.del&&!p.col_ins&&!p.col_upd));
 check('acl_worker_writes_retained',privileges.rows.filter(p=>p.rolname==='service_role').every(p=>p.ins&&p.upd&&p.del));
 const direct=await teacherClient.from('edu_attendance').insert({tenant_id:ids.tenantA,enrollment_id:ids.enrollmentA,status:'present',roll_call_time:rollCallTime});
 check('authenticated_direct_event_insert_denied',direct.error?.code==='42501');
 result.compatibility=result.checks.some(x=>x.status==='FAIL')?'FAIL':'PASS';
}
try{await main();}catch(e){result.error={code:e.code??null,message:String(e.message).replace(/eyJ[^\s]+/g,'[REDACTED_JWT]')};result.compatibility='BLOCKED';console.error('REHEARSAL_ERROR '+result.error.code+':'+result.error.message);}
finally{if(pgClient){await pgClient.query('ROLLBACK').catch(()=>{});await pgClient.end().catch(()=>{});}result.completedAt=new Date().toISOString();await writeFile(path.join(root,'attendance-db-rehearsal-'+label+'.json'),JSON.stringify(result,null,2)+'\n');}
if(result.compatibility!=='PASS')process.exitCode=1;

