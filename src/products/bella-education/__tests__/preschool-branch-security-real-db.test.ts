/** Explicit isolated Auth/RLS/atomic Product writer proof. Retains fixture history. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { PartyRegistrationContractImpl } from '@/platform/party/registration.contract.impl';
import { PreschoolChainService } from '../services/preschool-chain.service';
import { PreschoolAdmissionService } from '../services/preschool-admission.service';
import { admissionCourseReader } from '@/app/api/education/enrollments/admission-course-reader';

jest.mock('@/lib/supabase-server', () => ({ createClient: () => { throw new Error('Explicit local client required'); } }));

interface AdmissionProof {
  tenantId:string; actorId:string; branchId:string; courseId:string;
  cases:Array<{ canonicalIds?:{child:string;guardian:string;enrollment:string} }>;
}
const enabled = process.env.PRESCHOOL_BRANCH_REAL_DB === '1' ? describe : describe.skip;
enabled('Preschool Product branch security — actual isolated DB/Auth', () => {
  jest.setTimeout(60000);
  let pg:Client;
  let db:SupabaseClient<Database>;
  let durable:SupabaseClient<DurableDatabase>;
  let staff:SupabaseClient<DurableDatabase>;
  let nonAction:SupabaseClient<DurableDatabase>;
  let proof:AdmissionProof;
  let staffId:string;
  let nonActionId:string;
  let branchB:string;
  const observations:Array<Record<string,unknown>>=[];
  const options={auth:{persistSession:false,autoRefreshToken:false}};

  async function rows(){return(await pg.query(`SELECT jsonb_build_object(
    'courses',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.preschool_chain_course_branch_assignments c WHERE tenant_id=$1),
    'enrollments',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.preschool_chain_enrollment_branch_assignments e WHERE tenant_id=$1)
  ) state`,[proof.tenantId])).rows[0].state as unknown;}

  async function createActor(role:'admin_staff'|'ktv') {
    const password=randomUUID()+randomUUID();
    const email='branch-proof-'+randomUUID()+'@example.test';
    const auth=await db.auth.admin.createUser({email,password,email_confirm:true});
    if(auth.error||!auth.data.user)throw new Error('Local controlled Auth fixture failed');
    const id=auth.data.user.id; const person=randomUUID();
    await pg.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled branch actor',$4,'active')",[id,proof.tenantId,email,role]);
    await pg.query("INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active) VALUES($1,$2,$3,'employee','Controlled membership',true)",[person,proof.tenantId,id]);
    await pg.query("INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type) VALUES($1,$2,'person',$3,'unit','belongs_to')",[proof.tenantId,person,proof.branchId]);
    const signed=createClient<DurableDatabase>('http://127.0.0.1:55421',process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,options);
    const login=await signed.auth.signInWithPassword({email,password});
    if(login.error||login.data.user?.id!==id)throw new Error('Real signed-in Auth fixture failed');
    return {id,client:signed};
  }

  async function courseEnrollment(studentPartyId:string,courseId=randomUUID()) {
    const existing=await db.from('edu_courses').select('id').eq('id',courseId).maybeSingle();
    if(existing.error)throw new Error(existing.error.message);
    if(!existing.data){const insert=await db.from('edu_courses').insert({id:courseId,tenant_id:proof.tenantId,course_code:'BRANCH-'+randomUUID(),title:'Controlled branch integrity course',status:'active',max_students:100,current_enrollment:0,prerequisite_course_codes:[]});if(insert.error)throw new Error(insert.error.message);}
    const requestId=randomUUID();
    const enrollment=await new EnrollmentContractImpl(db).enrollStudent({tenantId:proof.tenantId,studentPartyId,courseId,requestId});
    return {courseId,enrollmentId:enrollment.id,requestId};
  }

  beforeAll(async()=>{
    if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55421'||!process.env.PRESCHOOL_PROOF_DB_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Explicit local branch environment required');
    const target=new URL(process.env.PRESCHOOL_PROOF_DB_URL);if(target.hostname!=='127.0.0.1'||target.port!=='55422')throw new Error('REFUSE_NONLOCAL_BRANCH_DB');
    proof=JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/ADMISSION_REAL_DB.json','utf8')) as AdmissionProof;
    pg=new Client({connectionString:process.env.PRESCHOOL_PROOF_DB_URL});await pg.connect();
    db=createClient<Database>('http://127.0.0.1:55421',process.env.SUPABASE_SERVICE_ROLE_KEY,options);
    durable=db as unknown as SupabaseClient<DurableDatabase>;
    branchB=randomUUID();await pg.query("INSERT INTO public.org_units(id,tenant_id,unit_type,name,is_active) VALUES($1,$2,'branch','Controlled branch B',true)",[branchB,proof.tenantId]);
    const staffActor=await createActor('admin_staff');staff=staffActor.client;staffId=staffActor.id;
    const nonActionActor=await createActor('ktv');nonAction=nonActionActor.client;nonActionId=nonActionActor.id;
  });

  afterAll(async()=>{if(!pg)return;try{
    writeFileSync('implementation-artifacts/preschool-full-chain/BRANCH_SECURITY_REAL_DB.json',JSON.stringify({capturedAt:new Date().toISOString(),target:'dedicated local API55421/DB55422',tenantId:proof.tenantId,adminId:proof.actorId,staffId,nonActionId,nonActionRole:'ktv',parentRole:'NOT_PROVEN_LOCAL_USERS_ROLE_CONSTRAINT',branchA:proof.branchId,branchB,observations,migrationSha256:createHash('sha256').update(readFileSync('supabase/migrations/20261019030000_preschool_chain_branch_security.sql')).digest('hex'),retention:'Canonical fixtures/history retained; no shared grants or production changes'},null,2));
  }finally{await pg.end();}});

  it('signed-in RLS allows staff branch A, denies branch B and membership without action',async()=>{
    const own=await staff.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id,branch_id').eq('tenant_id',proof.tenantId);
    expect(own.error).toBeNull();expect(own.data?.length).toBeGreaterThan(0);expect(own.data?.every(row=>row.branch_id===proof.branchId)).toBe(true);
    const foreign=await staff.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('branch_id',branchB);expect(foreign.error).toBeNull();expect(foreign.data).toEqual([]);
    const nonActionRows=await nonAction.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id');expect(nonActionRows.error).toBeNull();expect(nonActionRows.data).toEqual([]);
    const insert=await staff.from('preschool_chain_course_branch_assignments').insert({tenant_id:proof.tenantId,course_id:proof.courseId,branch_id:branchB});expect(insert.error?.code).toBe('42501');
    const rpc=await staff.rpc('preschool_assign_chain',{p_tenant_id:proof.tenantId,p_actor_id:staffId,p_course_id:proof.courseId,p_enrollment_id:randomUUID(),p_branch_id:proof.branchId,p_request_id:randomUUID()});expect(rpc.error?.code).toBe('42501');
    const impersonate=await staff.rpc('preschool_branch_access',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_branch_id:branchB,p_action:'registry'});expect(impersonate.error).toBeNull();expect(impersonate.data).toBe(false);
    const profile=await staff.from('preschool_admission_operations').select('operation_key');expect(profile.error?.code).toBe('42501');
    observations.push({point:'real_signed_in_rls_action_branch_membership',ownRows:own.data?.length,ownBranchOnly:true,nonActionMembershipDenied:true,writeDenied:insert.error?.code,serviceRpcDenied:rpc.error?.code,impersonationDenied:impersonate.data===false,intentReadDenied:profile.error?.code});
  });

  it('concurrent contradictory course branches produce one immutable winner and mismatch changes nothing',async()=>{
    const children=proof.cases.flatMap(row=>row.canonicalIds?[row.canonicalIds.child]:[]);
    const first=await courseEnrollment(children[0]);const second=await courseEnrollment(children[1],first.courseId);
    const calls=[{...first,branchId:proof.branchId},{...second,branchId:branchB}];
    const results=await Promise.all(calls.map(input=>durable.rpc('preschool_assign_chain',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_course_id:input.courseId,p_enrollment_id:input.enrollmentId,p_branch_id:input.branchId,p_request_id:input.requestId})));
    expect(results.filter(row=>!row.error)).toHaveLength(1);expect(results.find(row=>row.error)?.error?.message).toContain('CONFLICT');
    const mapped=(await pg.query('SELECT * FROM public.preschool_chain_course_branch_assignments WHERE tenant_id=$1 AND course_id=$2',[proof.tenantId,first.courseId])).rows;expect(mapped).toHaveLength(1);
    const enrollmentRows=(await pg.query('SELECT * FROM public.preschool_chain_enrollment_branch_assignments WHERE tenant_id=$1 AND course_id=$2',[proof.tenantId,first.courseId])).rows;expect(enrollmentRows).toHaveLength(1);expect(enrollmentRows[0].branch_id).toBe(mapped[0].branch_id);
    const before=await rows();const winner=calls[results.findIndex(row=>!row.error)];
    const mismatch=await durable.rpc('preschool_assign_chain',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_course_id:winner.courseId,p_enrollment_id:winner.enrollmentId,p_branch_id:winner.branchId,p_request_id:randomUUID()});expect(mismatch.error?.message).toContain('CONFLICT');expect(await rows()).toEqual(before);
    const staffB=await staff.from('preschool_chain_course_branch_assignments').select('course_id').eq('branch_id',branchB);expect(staffB.error).toBeNull();expect(staffB.data).toEqual([]);
    observations.push({point:'concurrent_branch_assignment_conflict',courseId:first.courseId,winner:mapped[0],enrollmentRows,loserError:results.find(row=>row.error)?.error?.message,canonicalMismatchDenied:true});
    const otherBranch=await courseEnrollment(children[1]);
    const assignedB=await durable.rpc('preschool_assign_chain',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_course_id:otherBranch.courseId,p_enrollment_id:otherBranch.enrollmentId,p_branch_id:branchB,p_request_id:otherBranch.requestId});expect(assignedB.error).toBeNull();expect(assignedB.data).toHaveLength(1);
    const deniedB=await staff.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('enrollment_id',otherBranch.enrollmentId);expect(deniedB.error).toBeNull();expect(deniedB.data).toEqual([]);
    const source=JSON.parse(readFileSync('implementation-artifacts/preschool-full-chain/ENROLLMENT_RECOVERY_REAL_DB.json','utf8')) as {actorId:string;tenantId:string};
    const user=await db.auth.admin.getUserById(source.actorId);if(user.error||!user.data.user?.email)throw new Error('Controlled foreign tenant actor missing');
    const link=await db.auth.admin.generateLink({type:'magiclink',email:user.data.user.email});if(link.error||!link.data.properties?.hashed_token)throw new Error('Foreign local Auth setup failed');
    const foreign=createClient<DurableDatabase>('http://127.0.0.1:55421',process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,options);
    const signed=await foreign.auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});expect(signed.error).toBeNull();expect(source.tenantId).not.toBe(proof.tenantId);
    const deniedTenant=await foreign.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('tenant_id',proof.tenantId);expect(deniedTenant.error).toBeNull();expect(deniedTenant.data).toEqual([]);
    observations.push({point:'actual_other_branch_and_foreign_tenant_rows_hidden',persistedBranchBEnrollment:otherBranch.enrollmentId,branchB:branchB,staffBranchAVisibleRowsForB:0,foreignActorId:source.actorId,foreignActorTenant:source.tenantId,foreignTenantVisibleRows:0});
  });

  it('second assignment insert failure leaves no first course assignment residue',async()=>{
    const child=proof.cases.find(row=>row.canonicalIds)?.canonicalIds?.child;if(!child)throw new Error('Controlled child missing');
    const input=await courseEnrollment(child);const trigger='branch_fault_'+randomUUID().replaceAll('-','');
    const before=await rows();
    try{await pg.query(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.enrollment_id='${input.enrollmentId}'::uuid THEN RAISE EXCEPTION 'CONTROLLED_SECOND_ASSIGNMENT_FAILURE'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON public.preschool_chain_enrollment_branch_assignments FOR EACH ROW EXECUTE FUNCTION public.${trigger}();`);
      const result=await durable.rpc('preschool_assign_chain',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_course_id:input.courseId,p_enrollment_id:input.enrollmentId,p_branch_id:proof.branchId,p_request_id:input.requestId});expect(result.error?.message).toContain('CONTROLLED_SECOND_ASSIGNMENT_FAILURE');expect(await rows()).toEqual(before);
    }finally{await pg.query(`DROP TRIGGER IF EXISTS ${trigger} ON public.preschool_chain_enrollment_branch_assignments; DROP FUNCTION IF EXISTS public.${trigger}();`);}
    observations.push({point:'second_assignment_failure_atomic_rollback',...input,courseAssignmentAbsent:true,enrollmentPreserved:true,faultObjectRemoved:true});
  });

  it('current inactive branch and revoked staff membership deny actual reads without changing grants',async()=>{
    await pg.query('UPDATE public.org_units SET is_active=false WHERE id=$1',[proof.branchId]);
    try{const hidden=await staff.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id').eq('tenant_id',proof.tenantId);expect(hidden.error).toBeNull();expect(hidden.data).toEqual([]);}finally{await pg.query('UPDATE public.org_units SET is_active=true WHERE id=$1',[proof.branchId]);}
    await pg.query('UPDATE public.org_relationships SET until=CURRENT_DATE-1 WHERE tenant_id=$1 AND from_id IN (SELECT id FROM public.people_directory WHERE user_id=$2)',[proof.tenantId,staffId]);
    const hidden=await staff.from('preschool_chain_enrollment_branch_assignments').select('enrollment_id');expect(hidden.error).toBeNull();expect(hidden.data).toEqual([]);
    await expect(new PreschoolChainService(db).preflightEnrollmentBranch({tenantId:proof.tenantId,actorUserId:staffId,branchId:proof.branchId,courseId:proof.courseId})).rejects.toMatchObject({status:403});
    observations.push({point:'current_branch_and_membership_revocation',inactiveBranchHidden:true,expiredMembershipHidden:true,staffAdmissionDenied:true});
  });

  it('a revocation committed while the pickup RPC waits cannot be recreated by stale retry',async()=>{
    const pair=(await pg.query("SELECT a.id,a.student_party_id,a.guardian_party_id,i.identifier_value FROM public.edu_preschool_pickup_authorizations a JOIN public.party_identifiers i ON i.tenant_id=a.tenant_id AND i.party_id=a.guardian_party_id AND i.identifier_type='preschool_guardian_phone' WHERE a.tenant_id=$1 AND a.status='authorized' ORDER BY a.id LIMIT 1",[proof.tenantId])).rows[0];if(!pair)throw new Error('Controlled pickup pair missing');
    const revoker=new Client({connectionString:process.env.PRESCHOOL_PROOF_DB_URL});await revoker.connect();let pending:PromiseLike<unknown>|undefined;
    try{await revoker.query('BEGIN');await revoker.query("UPDATE public.edu_preschool_pickup_authorizations SET status='revoked' WHERE id=$1",[pair.id]);
      const call=durable.rpc('preschool_admission_pickup',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_student_party_id:pair.student_party_id,p_guardian_party_id:pair.guardian_party_id,p_normalized_phone:pair.identifier_value});
      pending=Promise.resolve(call);
      let blocked=false;for(let i=0;i<30;i++){const locks=await pg.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%preschool_admission_pickup%' LIMIT 1");if(locks.rowCount){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
      expect(blocked).toBe(true);await revoker.query('COMMIT');
      const result=await pending as {error:{message:string}|null};expect(result.error?.message).toContain('AUTHORIZATION_REVOKED');
      const actual=(await pg.query('SELECT id,status FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=$1 AND student_party_id=$2 AND guardian_party_id=$3 ORDER BY id',[proof.tenantId,pair.student_party_id,pair.guardian_party_id])).rows;expect(actual).toEqual([{id:pair.id,status:'revoked'}]);
      observations.push({point:'actual_concurrent_pickup_revocation',authorizationId:pair.id,observedDbLock:true,error:result.error?.message,actualRows:actual,noRecreatedAuthorization:true});
    }finally{await revoker.query('ROLLBACK');await revoker.end();if(pending)await pending;}
  });

  it('expired guardian relation is rejected before any pickup authorization is created',async()=>{
    const parties=new PartyRegistrationContractImpl(db);
    const child=await parties.registerOrRecoverPerson({tenantId:proof.tenantId,actorId:proof.actorId,registrationKey:'expired-child-'+randomUUID(),person:{displayName:'Controlled expired relationship child'}});
    const phone='09'+String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,10))%100000000n).padStart(8,'0');
    const guardian=await parties.registerOrRecoverPerson({tenantId:proof.tenantId,actorId:proof.actorId,registrationKey:'expired-guardian-'+randomUUID(),person:{displayName:'Controlled expired guardian'},identifier:{type:'preschool_guardian_phone',value:phone}});
    await pg.query("INSERT INTO public.party_relationships(tenant_id,source_party_id,target_party_id,relationship_type,active_to) VALUES($1,$2,$3,'guardian_of',CURRENT_DATE-1)",[proof.tenantId,guardian.partyId,child.partyId]);
    const result=await durable.rpc('preschool_admission_pickup',{p_tenant_id:proof.tenantId,p_actor_id:proof.actorId,p_student_party_id:child.partyId,p_guardian_party_id:guardian.partyId,p_normalized_phone:phone});expect(result.error?.message).toContain('RELATIONSHIP_NOT_ACTIVE');
    const actual=(await pg.query('SELECT id,status FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=$1 AND student_party_id=$2 AND guardian_party_id=$3',[proof.tenantId,child.partyId,guardian.partyId])).rows;expect(actual).toEqual([]);
    observations.push({point:'expired_guardian_relation_no_authorization_write',studentPartyId:child.partyId,guardianPartyId:guardian.partyId,error:result.error?.message,actualRows:actual});
  });

  it('conflicting admission branches reserve one intent before any losing identity/enrollment and replay current Party facts',async()=>{
    const courseId=randomUUID();
    const course=await db.from('edu_courses').insert({id:courseId,tenant_id:proof.tenantId,course_code:'INTENT-'+randomUUID(),title:'Controlled admission intent race',status:'active',max_students:100,current_enrollment:0,prerequisite_course_codes:[]});expect(course.error).toBeNull();
    const operationKeys=[randomUUID(),randomUUID()];
    const form=(branchId:string)=>({childName:'Controlled intent race child',nickname:'Intake',dateOfBirth:'2023-06-15',gender:'Nam',guardianName:'Controlled intent race guardian',guardianPhone:'09'+String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,10))%100000000n).padStart(8,'0'),medicalNote:'Controlled',courseId,branchId});
    const service=new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)});
    const results=await Promise.allSettled([proof.branchId,branchB].map((branchId,i)=>service.admit({tenantId:proof.tenantId,actorId:proof.actorId,operationKey:operationKeys[i],payload:form(branchId)})));
    const successes=results.filter((row):row is PromiseFulfilledResult<Awaited<ReturnType<PreschoolAdmissionService['admit']>>>=>row.status==='fulfilled');expect(successes).toHaveLength(1);
    const rejected=results.find((row):row is PromiseRejectedResult=>row.status==='rejected');expect(rejected?.reason).toMatchObject({status:409});
    const operations=(await pg.query("SELECT operation_key,branch_id FROM public.preschool_admission_operations WHERE tenant_id=$1 AND payload->>'courseId'=$2",[proof.tenantId,courseId])).rows;expect(operations).toHaveLength(1);
    const actualEnrollments=(await pg.query('SELECT id,student_party_id FROM public.edu_enrollments WHERE tenant_id=$1 AND course_id=$2',[proof.tenantId,courseId])).rows;expect(actualEnrollments).toHaveLength(1);
    const receipts=(await pg.query("SELECT party_id FROM public.party_registration_receipts WHERE tenant_id=$1 AND split_part(registration_key,':',1)=ANY($2::text[])",[proof.tenantId,operationKeys])).rows;expect(receipts).toHaveLength(2);
    const canonical=successes[0].value;
    await pg.query("UPDATE public.party_parties SET display_name='Controlled corrected canonical child',dob='2023-07-20',gender='female' WHERE tenant_id=$1 AND id=$2",[proof.tenantId,canonical.student.partyId]);
    const replay=await service.admit({tenantId:proof.tenantId,actorId:proof.actorId,operationKey:operations[0].operation_key});expect(replay.student.partyId).toBe(canonical.student.partyId);expect(replay.enrollment.id).toBe(canonical.enrollment.id);
    expect(replay.student.childName).toBe('Controlled corrected canonical child');expect(replay.student.dateOfBirth).toBe('2023-07-20');expect(replay.student.gender).toBe('female');
    observations.push({point:'competing_admission_intents_before_canonical_writes',courseId,operationKeys,operations,actualEnrollments,receiptCount:receipts.length,loserStatus:409,currentCanonicalPartyFactsReturned:true,canonicalIds:{child:canonical.student.partyId,enrollment:canonical.enrollment.id}});
  });

  it('Party request waiting on its lock rechecks revoked actor before creating an identity',async()=>{
    const actor=await createActor('ktv');const key='queued-party-'+randomUUID();
    const locker=new Client({connectionString:process.env.PRESCHOOL_PROOF_DB_URL});await locker.connect();let pending:PromiseLike<unknown>|undefined;
    try{await locker.query('BEGIN');await locker.query("SELECT pg_advisory_xact_lock(hashtextextended('party-request:'||$1::text||':'||$2,0))",[proof.tenantId,key]);
      pending=Promise.resolve(durable.rpc('party_register_or_recover',{p_tenant_id:proof.tenantId,p_actor_id:actor.id,p_registration_key:key,p_payload:{partyType:'person',displayName:'Must not be created after revocation'}}));
      let blocked=false;for(let i=0;i<30;i++){const locks=await pg.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%party_register_or_recover%' LIMIT 1");if(locks.rowCount){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
      expect(blocked).toBe(true);await pg.query("UPDATE public.users SET status='inactive' WHERE id=$1",[actor.id]);await locker.query('COMMIT');
      const result=await pending as {error:{code:string;message:string}|null};expect(result.error?.code).toBe('42501');
      const receipt=(await pg.query('SELECT party_id FROM public.party_registration_receipts WHERE tenant_id=$1 AND registration_key=$2',[proof.tenantId,key])).rows;expect(receipt).toEqual([]);
      const identities=(await pg.query("SELECT id FROM public.party_parties WHERE tenant_id=$1 AND display_name='Must not be created after revocation'",[proof.tenantId])).rows;expect(identities).toEqual([]);
      observations.push({point:'queued_party_registration_after_actor_revocation',actorId:actor.id,registrationKey:key,observedDbLock:true,error:result.error?.code,receiptRows:receipt,partyRows:identities});
    }finally{await locker.query('ROLLBACK');await locker.end();if(pending)await pending;}
  });
});
