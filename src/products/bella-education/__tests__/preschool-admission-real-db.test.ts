/** Explicit local-only opt-in. Actual service/RPC/DB; faults wrap real results. */
import { describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client as PostgresClient } from 'pg';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import { admissionCourseReader } from '@/app/api/education/enrollments/admission-course-reader';
import { PreschoolAdmissionService } from '../services/preschool-admission.service';
import { PartyRegistrationContractImpl } from '@/platform/party/registration.contract.impl';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EnrollmentRecoveryContractImpl } from '@/platform/education/contracts/enrollment-recovery.contract.impl';
import { PreschoolGuardianAuthorizationService } from '../services/preschool-guardian-authorization.service';
import { PreschoolChainService } from '../services/preschool-chain.service';

jest.mock('@/lib/supabase-server', () => ({ createClient: () => { throw new Error('Use explicit isolated client'); } }));
jest.mock('@/platform/host/event-bus', () => ({ eventBus: { publish: jest.fn(async () => undefined), subscribe: jest.fn() } }));

const phase = process.env.PRESCHOOL_ADMISSION_DB_PHASE;
const enabled = phase === 'commit' || phase === 'restart';
const suite = enabled ? describe : describe.skip;
const artifactPath = 'implementation-artifacts/preschool-full-chain/ADMISSION_REAL_DB.json';

interface Proof {
  target: string; baseline: string; commitPid: number; restartPid?: number;
  tenantId: string; actorId: string; otherActorId: string; branchId: string; courseId: string;
  restartOperationKey: string; restartChildId: string;
  cases: Array<Record<string, unknown>>;
}

function dbClient() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55421' || !process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY === 'mock-service-role-key') throw new Error('REFUSE_NON_ISOLATED_TARGET');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}
function noError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}
function form(branchId: string, courseId: string, phone?: string) {
  return { childName: 'Controlled admission child', nickname: 'Controlled', dateOfBirth: '2023-06-15', gender: 'Nam',
    guardianName: 'Controlled guardian', guardianPhone: phone ?? `09${String(BigInt('0x' + randomUUID().replace(/-/g, '').slice(0, 10)) % 100000000n).padStart(8, '0')}`,
    medicalNote: 'Controlled Non-Production note', branchId, courseId };
}

function serviceWithFault(db: SupabaseClient<Database>, point: string) {
  let pending = true;
  const lose = () => { if (pending) { pending = false; throw new Error(`controlled-after-${point}`); } };
  const parties = new PartyRegistrationContractImpl(db);
  const students = new StudentContractImpl(db);
  const enrollments = new EnrollmentContractImpl(db);
  const guardians = new PreschoolGuardianAuthorizationService(db);
  const chain = new PreschoolChainService(db);
  return new PreschoolAdmissionService(db, {
    courseReader:admissionCourseReader(db),
    parties: { registerOrRecoverPerson: async (input) => {
      const result = await parties.registerOrRecoverPerson(input);
      if ((point === 'child' && input.registrationKey.endsWith(':child'))
        || (point === 'guardian' && input.registrationKey.endsWith(':guardian'))) lose();
      return result;
    } },
    students: { getStudent: students.getStudent.bind(students), registerStudent: async (input) => {
      const result = await students.registerStudent(input); if (point === 'student') lose(); return result;
    } },
    enrollments: { getEnrollment: enrollments.getEnrollment.bind(enrollments), enrollStudent: async (input) => {
      const result = await enrollments.enrollStudent(input); if (point === 'enrollment') lose(); return result;
    } },
    recovery: new EnrollmentRecoveryContractImpl(db),
    guardians: { establishForCanonicalGuardian: async (input) => {
      const result = await guardians.establishForCanonicalGuardian(input); if (point === 'authorization') lose(); return result;
    } },
    chain: { preflightEnrollmentBranch: chain.preflightEnrollmentBranch.bind(chain), getEnrollmentChain: chain.getEnrollmentChain.bind(chain),
      assignEnrollmentToBranch: async (input) => {
        const result = await chain.assignEnrollmentToBranch(input); if (point === 'assignment') lose(); return result;
      } },
  });
}

suite('Preschool durable admission actual isolated DB', () => {
  jest.setTimeout(120000);
  if (!enabled) it('requires the explicit isolated launcher', () => undefined);

  if (phase === 'commit') {
    it('proves durable identities, every completed step retry, conflicts and concurrent reuse', async () => {
      const db = dbClient();
      const durable = db as unknown as SupabaseClient<DurableDatabase>;
      const tenantId = randomUUID();
      noError((await db.from('tenants').insert({ id: tenantId, name: 'Controlled Preschool durable admission proof', status: 'active' })).error, 'tenant');
      async function actor() {
        const email = `preschool-admission-${randomUUID()}@example.test`;
        const { data, error } = await db.auth.admin.createUser({ email, password: `${randomUUID()}${randomUUID()}`, email_confirm: true });
        noError(error, 'Auth fixture'); if (!data.user) throw new Error('Auth fixture missing');
        noError((await db.from('users').insert({ id: data.user.id, tenant_id: tenantId, email, full_name: 'Controlled admin actor', role: 'admin', status: 'active' })).error, 'canonical actor');
        return data.user.id;
      }
      const actorId = await actor(); const otherActorId = await actor();
      const branchId = randomUUID(); const courseId = randomUUID();
      noError((await db.from('org_units').insert({ id: branchId, tenant_id: tenantId, unit_type: 'branch', name: 'Controlled branch', is_active: true })).error, 'branch');
      noError((await db.from('edu_courses').insert({ id: courseId, tenant_id: tenantId, course_code: `CONTROLLED-${randomUUID()}`, title: 'Controlled admission course', status: 'active', max_students: 100, current_enrollment: 0, prerequisite_course_codes: [] })).error, 'course fixture');
      const proof: Proof = { target: '127.0.0.1:55421/55422 isolated Non-Production', baseline: process.env.PRESCHOOL_PROOF_SHA ?? 'UNKNOWN',
        commitPid: process.pid, tenantId, actorId, otherActorId, branchId, courseId, restartOperationKey: '', restartChildId: '', cases: [] };
      async function snapshot() {
        const result: Record<string, unknown> = {};
        for (const table of ['party_parties', 'party_relationships', 'party_identifiers', 'students', 'edu_enrollments', 'edu_preschool_pickup_authorizations', 'preschool_chain_enrollment_branch_assignments'] as const) {
          const { data, error } = await db.from(table).select('*').eq('tenant_id', tenantId);
          noError(error, `read actual ${table}`); result[table] = data;
        }
        const { data, error } = await durable.from('preschool_admission_operations').select('*').eq('tenant_id', tenantId);
        noError(error, 'operations read'); result.operations = data;
        const receipts = await durable.from('party_registration_receipts').select('*').eq('tenant_id', tenantId);
        noError(receipts.error, 'receipts read'); result.receipts = receipts.data;
        return result;
      }
      const invalidBefore = await snapshot();
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: 'invalid', payload: form(branchId, courseId) })).rejects.toMatchObject({ status: 400 });
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: randomUUID(), payload: { ...form(branchId, courseId), branchId: '' } })).rejects.toMatchObject({ status: 400 });
      expect(await snapshot()).toEqual(invalidBefore);
      proof.cases.push({ point: 'invalid_key_and_missing_branch_no_business_writes', result: 'PASS' });

      const databaseUrl = process.env.PRESCHOOL_PROOF_DB_URL;
      if (!databaseUrl) throw new Error('Missing isolated DB connection for controlled receipt fault');
      const target = new URL(databaseUrl);
      if (target.hostname !== '127.0.0.1' || target.port !== '55422') throw new Error('REFUSE_NON_ISOLATED_RECEIPT_FAULT');
      const observer = new PostgresClient({ connectionString: databaseUrl });
      await observer.connect();
      const faultKey = `proof-${randomUUID()}`;
      const faultIdentifier = form(branchId, courseId).guardianPhone;
      const triggerName = `preschool_receipt_fault_${randomUUID().replace(/-/g, '')}`;
      const faultInput = { tenantId, actorId, registrationKey: faultKey,
        person: { displayName: 'Controlled atomic receipt identity' },
        identifier: { type: 'preschool_guardian_phone', value: faultIdentifier } };
      const atomicBefore = await snapshot();
      try {
        // Only the new, approved Party receipt table is fault injected; no
        // Kernel object is changed. Filter limits the trigger to this test key.
        await observer.query(`CREATE FUNCTION public.${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.registration_key='${faultKey}' THEN RAISE EXCEPTION 'CONTROLLED_RECEIPT_INSERT_FAILURE'; END IF; RETURN NEW; END; $$;
          CREATE TRIGGER ${triggerName} BEFORE INSERT ON public.party_registration_receipts FOR EACH ROW EXECUTE FUNCTION public.${triggerName}();`);
        await expect(new PartyRegistrationContractImpl(db).registerOrRecoverPerson(faultInput)).rejects.toThrow('CONTROLLED_RECEIPT_INSERT_FAILURE');
        expect(await snapshot()).toEqual(atomicBefore);
      } finally {
        await observer.query(`DROP TRIGGER IF EXISTS ${triggerName} ON public.party_registration_receipts; DROP FUNCTION IF EXISTS public.${triggerName}();`);
        await observer.end();
      }
      const atomicSuccess = await new PartyRegistrationContractImpl(db).registerOrRecoverPerson(faultInput);
      const atomicReplay = await new PartyRegistrationContractImpl(db).registerOrRecoverPerson(faultInput);
      expect(atomicReplay.partyId).toBe(atomicSuccess.partyId);
      proof.cases.push({ point: 'party_identifier_receipt_atomic_failure_injection', registrationKey: faultKey,
        result: 'PASS_NO_PARTY_IDENTIFIER_OR_RECEIPT_AFTER_FAILURE', canonicalPartyIdAfterRetry: atomicSuccess.partyId,
        before: atomicBefore, afterSuccessfulRetry: await snapshot(), testTriggerRemoved: true });

      for (const point of ['child', 'guardian', 'authorization', 'student', 'enrollment', 'assignment']) {
        const operationKey = randomUUID(); const payload = form(branchId, courseId);
        let initialOutcome = 'ACK_SUCCESS_AFTER_RECONCILIATION';
        try { await serviceWithFault(db, point).admit({ tenantId, actorId, operationKey, payload }); }
        catch (error) { expect((error as Error).message).toBe(`controlled-after-${point}`); initialOutcome = 'CONTROLLED_LOST_ACK'; }
        const afterFault = await snapshot();
        if (point === 'child') {
          await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey,
            payload: { ...payload, childName: 'Conflicting after uncertain acknowledgement' } })).rejects.toMatchObject({ status: 409 });
          expect(await snapshot()).toEqual(afterFault);
        }
        const result = await new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey });
        const replay = await new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey });
        expect(replay).toEqual(result);
        const afterReplay = await snapshot();
        const operations = afterReplay.operations as Array<{ operation_key: string; enrollment_request_id: string }>;
        const operation = operations.find((row) => row.operation_key === operationKey)!;
        const enrollments = afterReplay.edu_enrollments as Array<{ id: string; request_id: string; student_party_id: string }>;
        expect(enrollments.filter((row) => row.request_id === operation.enrollment_request_id)).toEqual([
          expect.objectContaining({ id: result.enrollment.id, student_party_id: result.student.partyId }),
        ]);
        const receipts = afterReplay.receipts as Array<{ registration_key: string; party_id: string }>;
        expect(receipts.filter((row) => row.registration_key.startsWith(operationKey))).toHaveLength(2);
        proof.cases.push({ point, operationKey, initialOutcome, canonicalIds: { child: result.student.partyId, guardian: result.student.guardianPartyId, enrollment: result.enrollment.id }, afterFault, afterReplay });
      }
      const concurrentKey = randomUUID(); const concurrentPayload = form(branchId, courseId);
      const concurrent = await Promise.all(Array.from({ length: 6 }, () => new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey, payload: concurrentPayload })));
      expect(new Set(concurrent.map((row) => row.student.partyId)).size).toBe(1);
      expect(new Set(concurrent.map((row) => row.enrollment.id)).size).toBe(1);
      const countsBeforeConflict = await snapshot();
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey, payload: { ...concurrentPayload, childName: 'Conflicting child' } })).rejects.toMatchObject({ status: 409 });
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId: otherActorId, operationKey: concurrentKey })).rejects.toMatchObject({ status: 403 });
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId: randomUUID(), actorId, operationKey: concurrentKey })).rejects.toMatchObject({ status: 403 });
      expect(await snapshot()).toEqual(countsBeforeConflict);
      proof.cases.push({ point: 'concurrent_same_operation_payload_conflict_other_actor_tenant', operationKey: concurrentKey, attempts: 6, canonicalIds: { child: concurrent[0].student.partyId, enrollment: concurrent[0].enrollment.id }, after: countsBeforeConflict });

      const phone = form(branchId, courseId).guardianPhone;
      const guardianRaceKeys = [randomUUID(), randomUUID()];
      const guardianRace = await Promise.all(guardianRaceKeys.map((operationKey) => new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey, payload: form(branchId, courseId, phone) })));
      expect(guardianRace[0].student.guardianPartyId).toBe(guardianRace[1].student.guardianPartyId);
      expect(guardianRace[0].student.partyId).not.toBe(guardianRace[1].student.partyId);
      const guardianId = guardianRace[0].student.guardianPartyId;
      const identifier = await db.from('party_identifiers').select('party_id').eq('tenant_id', tenantId).eq('identifier_type', 'preschool_guardian_phone').eq('identifier_value', phone);
      noError(identifier.error, 'guardian identifier race'); expect(identifier.data).toEqual([{ party_id: guardianId }]);
      proof.cases.push({ point: 'concurrent_guardian_identifier_reuse', operations: guardianRaceKeys, canonicalGuardianId: guardianId, after: await snapshot() });

      noError((await db.from('users').update({ role: 'admin_staff' }).eq('id', actorId).eq('tenant_id', tenantId)).error, 'controlled revoke admission role');
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey })).rejects.toMatchObject({ status: 403 });
      noError((await db.from('users').update({ role: 'admin' }).eq('id', actorId).eq('tenant_id', tenantId)).error, 'restore controlled actor');
      noError((await db.from('org_units').update({ is_active: false }).eq('id', branchId).eq('tenant_id', tenantId)).error, 'controlled deactivate branch');
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey })).rejects.toThrow('BRANCH_NOT_ACTIVE');
      noError((await db.from('org_units').update({ is_active: true }).eq('id', branchId).eq('tenant_id', tenantId)).error, 'restore controlled branch');
      const anonymous = createClient<DurableDatabase>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      expect((await anonymous.rpc('preschool_open_admission', { p_tenant_id: tenantId, p_actor_id: actorId, p_operation_key: concurrentKey })).error).toBeTruthy();
      expect((await anonymous.from('preschool_admission_operations').select('*')).error).toBeTruthy();
      const user = await db.auth.admin.getUserById(actorId);
      noError(user.error, 'controlled identity lookup');
      if (!user.data.user.email) throw new Error('Controlled email missing');
      const link = await db.auth.admin.generateLink({ type: 'magiclink', email: user.data.user.email });
      noError(link.error, 'controlled signed-in fixture link');
      if (!link.data.properties.hashed_token) throw new Error('Controlled sign-in token missing');
      noError((await anonymous.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })).error, 'actual authenticated fixture');
      const deniedRpc = await anonymous.rpc('preschool_open_admission', { p_tenant_id: tenantId, p_actor_id: actorId, p_operation_key: concurrentKey });
      const deniedTable = await anonymous.from('preschool_admission_operations').select('*');
      const deniedPartyRpc = await anonymous.rpc('party_register_or_recover', { p_tenant_id: tenantId, p_actor_id: actorId, p_registration_key: randomUUID(), p_payload: { partyType: 'person', displayName: 'Denied forged writer' } });
      expect(deniedRpc.error?.code).toBe('42501'); expect(deniedTable.error?.code).toBe('42501'); expect(deniedPartyRpc.error?.code).toBe('42501');
      proof.cases.push({ point: 'completed_replay_current_role_branch_anon_and_signed_in_internal_rpc_denial',
        restrictedRole: 'authenticated', operationRpcError: deniedRpc.error?.code,
        operationTableError: deniedTable.error?.code, partyRpcError: deniedPartyRpc.error?.code, result: 'PASS' });

      // The original command cannot safely recover at its mutable eligibility
      // boundary. Product now recovers through the additive public read contract.
      const saturatedChild = concurrent[0].student.partyId;
      const extraCourseIds = Array.from({ length: 7 }, () => randomUUID());
      noError((await db.from('edu_courses').insert(extraCourseIds.map((id) => ({
        id, tenant_id: tenantId, course_code: `CREDIT-${randomUUID()}`, title: 'Controlled credit boundary fixture',
        status: 'active', max_students: 1, current_enrollment: 0, prerequisite_course_codes: [],
      })))).error, 'credit boundary fixtures');
      for (const extraCourseId of extraCourseIds) await new EnrollmentContractImpl(db).enrollStudent({
        tenantId, studentPartyId: saturatedChild, courseId: extraCourseId, requestId: randomUUID(),
      });
      noError((await db.from('edu_courses').update({ status: 'archived' }).eq('tenant_id', tenantId).eq('id', courseId)).error, 'archive controlled course');
      const eligibilityBefore = await snapshot();
      const recoveredAtBoundary = await new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey });
      expect(recoveredAtBoundary.enrollment.id).toBe(concurrent[0].enrollment.id);
      const eligibilityAfter = await snapshot();
      expect(eligibilityAfter.edu_enrollments).toEqual(eligibilityBefore.edu_enrollments);
      expect(eligibilityAfter.students).toEqual(eligibilityBefore.students);
      expect(eligibilityAfter.party_parties).toEqual(eligibilityBefore.party_parties);
      proof.cases.push({ point: 'existing_enrollment_recovery_at_24_credits_and_archived_course',
        operationKey: concurrentKey, enrollmentId: recoveredAtBoundary.enrollment.id,
        before: eligibilityBefore.edu_enrollments, after: eligibilityAfter.edu_enrollments, result: 'PASS' });
      noError((await db.from('edu_courses').update({ status: 'active' }).eq('tenant_id', tenantId).eq('id', courseId)).error, 'restore controlled course');

      // Revoked pickup authority must not be silently recreated during retry.
      noError((await db.from('edu_preschool_pickup_authorizations').update({ status: 'revoked' })
        .eq('tenant_id', tenantId).eq('student_party_id', concurrent[0].student.partyId)).error, 'controlled revoke pickup');
      const revokedBefore = await snapshot();
      await expect(new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId, actorId, operationKey: concurrentKey })).rejects.toThrow('AUTHORIZATION_REVOKED');
      expect(await snapshot()).toEqual(revokedBefore);
      proof.cases.push({ point: 'revoked_guardian_authority_not_recreated', operationKey: concurrentKey, result: 'PASS' });

      proof.restartOperationKey = randomUUID();
      await expect(serviceWithFault(db, 'child').admit({ tenantId, actorId, operationKey: proof.restartOperationKey, payload: form(branchId, courseId) })).rejects.toThrow('controlled-after-child');
      const receipt = await durable.from('party_registration_receipts').select('party_id').eq('tenant_id', tenantId).eq('registration_key', `${proof.restartOperationKey}:child`).single();
      noError(receipt.error, 'restart child receipt'); if (!receipt.data) throw new Error('Missing restart child');
      proof.restartChildId = receipt.data.party_id;
      writeFileSync(artifactPath, `${JSON.stringify(proof, null, 2)}\n`);
    });
  }
  if (phase === 'restart') {
    it('resumes key-only after actual process restart with the original canonical child', async () => {
      const proof = JSON.parse(readFileSync(artifactPath, 'utf8')) as Proof;
      expect(process.pid).not.toBe(proof.commitPid);
      const db = dbClient();
      const result = await new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId: proof.tenantId, actorId: proof.actorId, operationKey: proof.restartOperationKey });
      expect(result.student.partyId).toBe(proof.restartChildId);
      const replay = await new PreschoolAdmissionService(db,{courseReader:admissionCourseReader(db)}).admit({ tenantId: proof.tenantId, actorId: proof.actorId, operationKey: proof.restartOperationKey });
      expect(replay).toEqual(result);
      proof.restartPid = process.pid;
      proof.cases.push({ point: 'key_only_actual_process_restart', operationKey: proof.restartOperationKey,
        originalChildId: proof.restartChildId, canonicalIds: { child: result.student.partyId, guardian: result.student.guardianPartyId, enrollment: result.enrollment.id }, result: 'PASS' });
      writeFileSync(artifactPath, `${JSON.stringify(proof, null, 2)}\n`);
    });
  }
});
