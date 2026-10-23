import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { EducationEnrollmentEventsDatabase } from '@/types/education-enrollment-events.database.types';
import type { EnrollmentEventContext, EnrollmentEventRecoveryReceipt } from '../contracts/enrollment-event-recovery.contract';
import { EnrollmentEventRecoveryContractImpl } from '../contracts/enrollment-event-recovery.contract.impl';
import { EnrollmentRecoveryContractImpl } from '../contracts/enrollment-recovery.contract.impl';
import { EnrollmentContractImpl } from '../contracts/enrollment.contract.impl';

const mockPublish = jest.fn(async (..._input: unknown[]) => undefined);
jest.mock('@/platform/host/event-bus', () => ({ eventBus: { publish: (...input: unknown[]) => mockPublish(...input), subscribe: jest.fn() } }));
jest.mock('@/lib/supabase-server', () => ({ createClient: () => { throw new Error('Explicit isolated client required'); } }));

interface Fixture {
  context: EnrollmentEventContext;
  replayKey: string;
  firstReceipt: EnrollmentEventRecoveryReceipt;
  finishedReceipt: EnrollmentEventRecoveryReceipt;
  commitPid: number;
  observations: Array<Record<string, unknown>>;
}

const phase = process.env.EDUCATION_EVENT_DB_PHASE;
const enabled = phase === 'capture' || phase === 'resume' ? describe : describe.skip;
enabled(`Education durable capture/replay — actual DB ${phase ?? 'disabled'}`, () => {
  jest.setTimeout(60000);
  let pg: Client;
  let db: SupabaseClient<Database>;
  let contract: EnrollmentEventRecoveryContractImpl;
  let fixture: Fixture;
  let output: string;
  const observations: Array<Record<string, unknown>> = [];
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  async function eventRows() {
    return (await pg.query('SELECT to_jsonb(e) AS row FROM public.edu_enrollment_event_records e WHERE tenant_id=$1 ORDER BY event_id', [fixture.context.tenantId])).rows;
  }

  async function createPair() {
    const tenantId = fixture.context.tenantId, studentPartyId = randomUUID(), courseId = randomUUID();
    const party = await db.from('party_parties').insert({ id: studentPartyId, tenant_id: tenantId, party_type: 'person', display_name: 'Controlled event recovery student' });
    if (party.error) throw new Error(party.error.message);
    const course = await db.from('edu_courses').insert({ id: courseId, tenant_id: tenantId, course_code: `EVT-${randomUUID()}`,
      title: 'Controlled event recovery course', status: 'active', max_students: 10, current_enrollment: 0, prerequisite_course_codes: [] });
    if (course.error) throw new Error(course.error.message);
    return { tenantId, studentPartyId, courseId, requestId: `event-recovery-${randomUUID()}` };
  }

  beforeAll(async () => {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.PRESCHOOL_PROOF_DB_URL, directory = process.env.EDUCATION_EVENT_EVIDENCE_DIR;
    if (api !== 'http://127.0.0.1:15421' || !key || !url || !directory) throw new Error('ISOLATED_EVENT_ENV_REQUIRED');
    const target = new URL(url);
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') throw new Error('REFUSE_EVENT_NONLOCAL_DB');
    const root = resolve('implementation-artifacts/preschool-enrollment-event-recovery-20261023');
    output = resolve(directory);
    if (!output.startsWith(root + '/') && !output.startsWith(root + '\\')) throw new Error('REFUSE_EVENT_EVIDENCE_OUTSIDE_PACKET');
    pg = new Client({ connectionString: url }); await pg.connect();
    db = createClient<Database>(api, key, options);
    contract = new EnrollmentEventRecoveryContractImpl(db);
    if (phase === 'resume') {
      fixture = JSON.parse(readFileSync(resolve(output, 'CAPTURE.json'), 'utf8')) as Fixture;
      if (fixture.commitPid === process.pid) throw new Error('RESTART_REQUIRES_DISTINCT_PROCESS');
    } else {
      const tenantId = randomUUID();
      const inserted = await db.from('tenants').insert({ id: tenantId, name: 'Controlled Education event proof', status: 'active' });
      if (inserted.error) throw new Error(inserted.error.message);
      fixture = { context: { tenantId, requestId: '', enrollmentId: '', studentPartyId: '', courseId: '' }, observations: [], commitPid: process.pid } as unknown as Fixture;
    }
  });

  afterAll(async () => {
    if (pg) await pg.end();
    if (fixture && output) writeFileSync(resolve(output, phase === 'capture' ? 'CAPTURE.json' : 'RESUME.json'),
      JSON.stringify({ ...fixture, observations: [...fixture.observations, ...observations], ...(phase === 'resume' ? { resumePid: process.pid } : {}) }, null, 2) + '\n', { flag: 'wx' });
  });

  if (phase === 'capture') {
    it('retains one captured event when enrollment commits and best-effort publication throws', async () => {
      const pair = await createPair();
      mockPublish.mockRejectedValueOnce(new Error('CONTROLLED_POST_COMMIT_PUBLICATION_FAILURE'));
      await expect(new EnrollmentContractImpl(db).enrollStudent(pair)).rejects.toThrow('CONTROLLED_POST_COMMIT_PUBLICATION_FAILURE');
      const enrollment = await new EnrollmentRecoveryContractImpl(db).getEnrollmentByRequest(pair);
      expect(enrollment).not.toBeNull();
      fixture.context = { ...pair, enrollmentId: enrollment!.id };
      const captured = await contract.getCapturedEvent(fixture.context);
      expect(captured?.event.payload.enrollmentId).toBe(enrollment!.id);
      expect(captured?.replayState).toBe('pending');
      expect(captured?.downstreamProcessing).toBe('NOT_PROVEN');
      const counts = (await pg.query('SELECT count(*)::int AS total FROM public.edu_enrollments WHERE tenant_id=$1 AND request_id=$2', [pair.tenantId, pair.requestId])).rows[0];
      expect(counts.total).toBe(1); expect(await eventRows()).toHaveLength(1);
      observations.push({ point: 'post_commit_publication_failure_durable_capture', enrollmentId: enrollment!.id, eventId: captured!.event.eventId, enrollments: counts.total });
    });

    it('rolls back enrollment, capacity and event when atomic capture fails', async () => {
      const pair = await createPair(), name = `event_fault_${randomUUID().replaceAll('-', '')}`;
      const before = (await pg.query('SELECT to_jsonb(c) AS row FROM public.edu_courses c WHERE id=$1', [pair.courseId])).rows;
      try {
        await pg.query(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'courseId'='${pair.courseId}' THEN RAISE EXCEPTION 'CONTROLLED_ATOMIC_CAPTURE_FAILURE'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${name} BEFORE INSERT ON public.edu_enrollment_event_records FOR EACH ROW EXECUTE FUNCTION public.${name}();`);
        await expect(new EnrollmentContractImpl(db).enrollStudent(pair)).rejects.toThrow('CONTROLLED_ATOMIC_CAPTURE_FAILURE');
        expect((await pg.query('SELECT id FROM public.edu_enrollments WHERE tenant_id=$1 AND request_id=$2', [pair.tenantId, pair.requestId])).rows).toEqual([]);
        expect((await pg.query('SELECT to_jsonb(c) AS row FROM public.edu_courses c WHERE id=$1', [pair.courseId])).rows).toEqual(before);
        expect(await eventRows()).toHaveLength(1);
        observations.push({ point: 'atomic_capture_failure_rollback', enrollmentAbsent: true, eventAbsent: true, courseUnchanged: true });
      } finally { await pg.query(`DROP TRIGGER IF EXISTS ${name} ON public.edu_enrollment_event_records; DROP FUNCTION IF EXISTS public.${name}();`); }
    });

    it('serializes concurrent retries with one replay key and rejects a competing active lease', async () => {
      fixture.replayKey = randomUUID();
      const [first, second] = await Promise.all([contract.claimReplay({ ...fixture.context, replayKey: fixture.replayKey }), contract.claimReplay({ ...fixture.context, replayKey: fixture.replayKey })]);
      expect(second).toEqual(first); expect(first.attempts).toBe(1); expect(first.replay?.outcome).toBe('leased');
      fixture.firstReceipt = first;
      await expect(contract.claimReplay({ ...fixture.context, replayKey: randomUUID() })).rejects.toThrow('EDUCATION_EVENT_REPLAY_BUSY');
      expect((await pg.query('SELECT * FROM public.edu_enrollment_event_replays WHERE event_id=$1', [first.event.eventId])).rows).toHaveLength(1);
      observations.push({ point: 'concurrent_same_key_claim', sameToken: true, attempts: 1, competingLeaseDenied: true });
    });

    it('fails closed on ID conflicts and denied clients without mutating capture', async () => {
      const before = await eventRows();
      await expect(contract.getCapturedEvent({ ...fixture.context, studentPartyId: randomUUID() })).rejects.toThrow('context or replay receipt conflicts');
      await expect(contract.getCapturedEvent({ ...fixture.context, courseId: randomUUID() })).rejects.toThrow('context or replay receipt conflicts');
      expect(await contract.getCapturedEvent({ ...fixture.context, tenantId: randomUUID() })).toBeNull();
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('ISOLATED_ANON_KEY_REQUIRED');
      const anon = createClient<Database>('http://127.0.0.1:15421', anonKey, options);
      await expect(new EnrollmentEventRecoveryContractImpl(anon).getCapturedEvent(fixture.context)).rejects.toThrow('42501');
      const email = `event-proof-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
      const actor = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (actor.error) throw new Error(actor.error.message);
      const signed = createClient<Database>('http://127.0.0.1:15421', anonKey, options);
      const login = await signed.auth.signInWithPassword({ email, password });
      if (login.error) throw new Error(login.error.message);
      try {
        await expect(new EnrollmentEventRecoveryContractImpl(signed).getCapturedEvent(fixture.context)).rejects.toThrow('42501');
        const direct = await (db as unknown as SupabaseClient<EducationEnrollmentEventsDatabase>).rpc('edu_finish_enrollment_event_replay', {
          p_tenant_id: fixture.context.tenantId, p_request_id: fixture.context.requestId, p_enrollment_id: fixture.context.enrollmentId,
          p_student_party_id: fixture.context.studentPartyId, p_course_id: fixture.context.courseId,
          p_replay_key: fixture.replayKey, p_lease_token: fixture.firstReceipt.replay!.leaseToken, p_outcome: 'delivered',
        });
        expect(direct.error?.code).toBe('22023');
        expect(await eventRows()).toEqual(before);
        observations.push({ point: 'canonical_conflict_and_restricted_client_denial', anonymousDenied: true, signedInDenied: true, falseDeliveryOutcomeDenied: true, noCaptureChanges: true });
      } finally { await signed.auth.signOut(); }
    });

    it('records replay failure durably without claiming downstream processing', async () => {
      fixture.finishedReceipt = await contract.finishReplay({ ...fixture.context, replayKey: fixture.replayKey,
        leaseToken: fixture.firstReceipt.replay!.leaseToken, outcome: 'failed', errorCode: 'CONTROLLED_REPLAY_FAILURE' });
      expect(fixture.finishedReceipt.replayState).toBe('retryable');
      expect(fixture.finishedReceipt.downstreamProcessing).toBe('NOT_PROVEN');
      observations.push({ point: 'failed_replay_persisted', eventId: fixture.finishedReceipt.event.eventId, state: fixture.finishedReceipt.replayState });
    });
  } else if (phase === 'resume') {
    it('recovers exact event and completed attempt after restart and lost acknowledgement', async () => {
      const recovered = await contract.getCapturedEvent(fixture.context);
      expect(recovered?.event).toEqual(fixture.firstReceipt.event);
      const claimed = await contract.claimReplay({ ...fixture.context, replayKey: fixture.replayKey });
      expect(claimed).toEqual(fixture.finishedReceipt);
      const finished = await contract.finishReplay({ ...fixture.context, replayKey: fixture.replayKey,
        leaseToken: fixture.firstReceipt.replay!.leaseToken, outcome: 'failed', errorCode: 'CONTROLLED_REPLAY_FAILURE' });
      expect(finished).toEqual(fixture.finishedReceipt);
      await expect(contract.finishReplay({ ...fixture.context, replayKey: fixture.replayKey,
        leaseToken: fixture.firstReceipt.replay!.leaseToken, outcome: 'released' })).rejects.toThrow('context or replay receipt conflicts');
      const enrollment = await new EnrollmentRecoveryContractImpl(db).getEnrollmentByRequest(fixture.context);
      expect(enrollment?.id).toBe(fixture.context.enrollmentId);
      observations.push({ point: 'distinct_process_lost_ack_recovery', commitPid: fixture.commitPid, resumePid: process.pid, sameEvent: true, sameAttempt: true, sameEnrollment: true });
    });

    it('recovers an active lease with the same key and releases it without delivery claims', async () => {
      const replayKey = randomUUID();
      const receipt = await contract.claimReplay({ ...fixture.context, replayKey });
      expect(await new EnrollmentEventRecoveryContractImpl(db).claimReplay({ ...fixture.context, replayKey })).toEqual(receipt);
      const release = await contract.finishReplay({ ...fixture.context, replayKey, leaseToken: receipt.replay!.leaseToken, outcome: 'released' });
      expect(release.replayState).toBe('pending'); expect(release.downstreamProcessing).toBe('NOT_PROVEN');
      observations.push({ point: 'replay_release', attempts: release.attempts, state: release.replayState, processing: release.downstreamProcessing });
    });

    it('expires an abandoned lease, retains history and enforces a five-attempt intervention limit', async () => {
      const abandonedKey = randomUUID(), abandoned = await contract.claimReplay({ ...fixture.context, replayKey: abandonedKey });
      await pg.query("UPDATE public.edu_enrollment_event_replays SET lease_until=clock_timestamp()-interval '1 second' WHERE event_id=$1 AND replay_key=$2", [abandoned.event.eventId, abandonedKey]);
      await pg.query("UPDATE public.edu_enrollment_event_records SET lease_until=clock_timestamp()-interval '1 second' WHERE event_id=$1", [abandoned.event.eventId]);
      await expect(contract.claimReplay({ ...fixture.context, replayKey: abandonedKey })).rejects.toThrow('EDUCATION_EVENT_REPLAY_EXPIRED');
      for (let attempt = 4; attempt <= 5; attempt++) {
        const replayKey = randomUUID(), receipt = await contract.claimReplay({ ...fixture.context, replayKey });
        expect(receipt.attempts).toBe(attempt);
        await contract.finishReplay({ ...fixture.context, replayKey, leaseToken: receipt.replay!.leaseToken, outcome: 'failed', errorCode: 'CONTROLLED_REPLAY_FAILURE' });
      }
      const exhausted = await contract.claimReplay({ ...fixture.context, replayKey: randomUUID() });
      expect(exhausted.replay).toBeNull(); expect(exhausted.attempts).toBe(5); expect(exhausted.replayState).toBe('intervention_required');
      const rows = (await pg.query('SELECT outcome,error_code FROM public.edu_enrollment_event_replays WHERE event_id=$1 ORDER BY attempt_number', [abandoned.event.eventId])).rows;
      expect(rows).toHaveLength(5); expect(rows[2]).toEqual({ outcome: 'failed', error_code: 'LEASE_EXPIRED' });
      expect(await eventRows()).toHaveLength(1);
      expect((await pg.query('SELECT id FROM public.edu_enrollments WHERE tenant_id=$1 AND request_id=$2', [fixture.context.tenantId, fixture.context.requestId])).rows).toHaveLength(1);
      observations.push({ point: 'expiry_bounded_retry_and_history', attempts: 5, state: exhausted.replayState, rows, oneEventOneEnrollment: true });
    });
  }
});
