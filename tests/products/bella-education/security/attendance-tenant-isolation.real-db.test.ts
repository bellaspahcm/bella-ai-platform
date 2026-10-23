import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';

interface PriorAttendanceEvidence {
  actor: { id: string; tenant_id: string };
  targetEnrollment: { id: string; tenant_id: string };
}

const enabled = process.env.EDUCATION_ATTENDANCE_AUTH_REAL_DB === '1' ? describe : describe.skip;

enabled('Education attendance authenticated tenant guard — isolated Auth/DB', () => {
  jest.setTimeout(60000);

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  let pg: Client;
  let admin: SupabaseClient<Database>;
  let signedIn: SupabaseClient<Database>;
  let anonymous: SupabaseClient<Database>;
  let inactive: SupabaseClient<Database>;
  let evidence: PriorAttendanceEvidence;
  let enrollmentId: string;
  let actorId: string;
  let inactiveActorId: string;
  let existingAuthRows: Array<{ id: string; fp: string }> = [];
  const observations: Array<Record<string, unknown>> = [];

  const snapshot = async (tenantId: string, targetEnrollmentId: string) => {
    const [events, state] = await Promise.all([
      pg.query(
        'SELECT to_jsonb(a) AS row FROM public.edu_attendance a WHERE tenant_id=$1 AND enrollment_id=$2 ORDER BY id',
        [tenantId, targetEnrollmentId],
      ),
      pg.query(
        'SELECT to_jsonb(s) AS row FROM public.edu_attendance_daily_state s WHERE tenant_id=$1 AND enrollment_id=$2 ORDER BY id',
        [tenantId, targetEnrollmentId],
      ),
    ]);
    return { events: events.rows.map((row) => row.row), state: state.rows.map((row) => row.row) };
  };

  beforeAll(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbUrl = process.env.PRESCHOOL_PROOF_DB_URL;
    if (apiUrl !== 'http://127.0.0.1:15421' || !anonKey || !serviceKey || !dbUrl) {
      throw new Error('EDUCATION_ATTENDANCE_AUTH_REAL_DB requires the approved isolated API15421/DB15432 environment');
    }
    const target = new URL(dbUrl);
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') {
      throw new Error('REFUSE_NONLOCAL_EDUCATION_ATTENDANCE_DB');
    }

    evidence = JSON.parse(
      readFileSync('implementation-artifacts/preschool-full-chain/ATTENDANCE_RPC_NEGATIVE_REAL_DB.json', 'utf8'),
    ) as PriorAttendanceEvidence;
    pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    admin = createClient<Database>(apiUrl, serviceKey, options);
    existingAuthRows = (await pg.query<{ id: string; fp: string }>(
      "SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a ORDER BY id",
    )).rows;

    const activeEmail = `attendance-active-${randomUUID()}@example.test`;
    const activePassword = randomUUID() + randomUUID();
    const activeAuth = await admin.auth.admin.createUser({ email: activeEmail, password: activePassword, email_confirm: true });
    if (activeAuth.error || !activeAuth.data.user) throw new Error('Controlled active Auth fixture could not be created');
    actorId = activeAuth.data.user.id;
    const activeProfile = await admin.from('users').insert({
      id: actorId,
      tenant_id: evidence.actor.tenant_id,
      email: activeEmail,
      full_name: 'Active attendance guard actor',
      role: 'admin_staff',
      status: 'active',
    });
    if (activeProfile.error) throw new Error(`Controlled active profile fixture failed: ${activeProfile.error.message}`);
    signedIn = createClient<Database>(apiUrl, anonKey, options);
    anonymous = createClient<Database>(apiUrl, anonKey, options);
    const session = await signedIn.auth.signInWithPassword({ email: activeEmail, password: activePassword });
    if (session.error || session.data.user?.id !== actorId) throw new Error('Signed-in actor did not match the run-owned tenant A identity');

    const inactiveEmail = `attendance-inactive-${randomUUID()}@example.test`;
    const inactivePassword = randomUUID() + randomUUID();
    const inactiveAuth = await admin.auth.admin.createUser({
      email: inactiveEmail,
      password: inactivePassword,
      email_confirm: true,
    });
    if (inactiveAuth.error || !inactiveAuth.data.user) throw new Error('Controlled inactive Auth fixture could not be created');
    inactiveActorId = inactiveAuth.data.user.id;
    const inactiveProfile = await admin.from('users').insert({
      id: inactiveActorId,
      tenant_id: evidence.actor.tenant_id,
      email: inactiveEmail,
      full_name: 'Inactive attendance guard actor',
      role: 'admin_staff',
      status: 'inactive',
    });
    if (inactiveProfile.error) throw new Error(`Controlled inactive profile fixture failed: ${inactiveProfile.error.message}`);
    inactive = createClient<Database>(apiUrl, anonKey, options);
    const inactiveSession = await inactive.auth.signInWithPassword({ email: inactiveEmail, password: inactivePassword });
    if (inactiveSession.error || inactiveSession.data.user?.id !== inactiveActorId) throw new Error('Inactive profile fixture did not authenticate as expected');

    const courseId = randomUUID();
    const studentPartyId = randomUUID();
    const party = await admin.from('party_parties').insert({
      id: studentPartyId,
      tenant_id: evidence.actor.tenant_id,
      party_type: 'person',
      display_name: 'Attendance tenant guard controlled student',
    });
    if (party.error) throw new Error(`Controlled party fixture failed: ${party.error.message}`);
    const course = await admin.from('edu_courses').insert({
      id: courseId,
      tenant_id: evidence.actor.tenant_id,
      course_code: `ATG-${randomUUID()}`,
      title: 'Attendance tenant guard controlled course',
      status: 'active',
      max_students: 10,
      current_enrollment: 0,
      prerequisite_course_codes: [],
    });
    if (course.error) throw new Error(`Controlled course fixture failed: ${course.error.message}`);
    const enrollment = await new EnrollmentContractImpl(admin).enrollStudent({
      tenantId: evidence.actor.tenant_id,
      studentPartyId,
      courseId,
      requestId: `attendance-tenant-guard-${randomUUID()}`,
    });
    enrollmentId = enrollment.id;
  });

  afterAll(async () => {
    if (pg) await pg.end();
    if (signedIn) await signedIn.auth.signOut();
    if (anonymous) await anonymous.auth.signOut();
    if (inactive) await inactive.auth.signOut();
    if (observations.length > 0) {
      const directory = `implementation-artifacts/preschool-attendance-guard-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const { mkdirSync } = await import('node:fs');
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        `${directory}/ATTENDANCE_GUARD_REAL_DB.json`,
        JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            target: 'approved isolated loopback API15421/DB15432 only',
            actorId,
            actorTenantId: evidence.actor.tenant_id,
            foreignTenantId: evidence.targetEnrollment.tenant_id,
            observations,
            retention: 'Run-owned active/inactive Auth actors and tenant A fixtures are retained. Historical diagnostic Auth actors are not used for login by this version of the harness.',
          },
          null,
          2,
        ),
      );
    }
  });

  it('allows the current authenticated actor in its own tenant through the existing RPC', async () => {
    const before = await snapshot(evidence.actor.tenant_id, enrollmentId);
    const result = await new AttendanceContractImpl(signedIn).setDailyAttendance({
      tenantId: evidence.actor.tenant_id,
      enrollmentId,
      status: 'present',
      rollCallTime: '2026-10-22T01:00:00.000Z',
    });
    expect(result.tenantId).toBe(evidence.actor.tenant_id);
    expect(result.enrollmentId).toBe(enrollmentId);
    expect(result.status).toBe('present');
    const after = await snapshot(evidence.actor.tenant_id, enrollmentId);
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(after.state).toHaveLength(1);
    observations.push({ point: 'authenticated_same_tenant_command', success: true, before, after });
  });

  it('denies a tenant A actor targeting tenant B before any attendance side effect', async () => {
    const before = await snapshot(evidence.targetEnrollment.tenant_id, evidence.targetEnrollment.id);
    const result = await signedIn.rpc('edu_set_daily_attendance', {
      p_tenant_id: evidence.targetEnrollment.tenant_id,
      p_enrollment_id: evidence.targetEnrollment.id,
      p_status: 'present',
      p_roll_call_time: '2026-10-22T02:00:00.000Z',
      p_school_day: '2026-10-22',
    });
    expect(result.error?.code).toBe('42501');
    const after = await snapshot(evidence.targetEnrollment.tenant_id, evidence.targetEnrollment.id);
    expect(after).toEqual(before);
    observations.push({ point: 'authenticated_cross_tenant_denied_zero_side_effect', errorCode: result.error?.code, before, after });
  });

  it('denies an anonymous RPC caller without changing tenant A attendance', async () => {
    const before = await snapshot(evidence.actor.tenant_id, enrollmentId);
    const result = await anonymous.rpc('edu_set_daily_attendance', {
      p_tenant_id: evidence.actor.tenant_id,
      p_enrollment_id: enrollmentId,
      p_status: 'absent',
      p_roll_call_time: '2026-10-22T03:00:00.000Z',
      p_school_day: '2026-10-22',
    });
    expect(result.error?.code).toBe('42501');
    const after = await snapshot(evidence.actor.tenant_id, enrollmentId);
    expect(after).toEqual(before);
    observations.push({ point: 'anonymous_rpc_denied_zero_side_effect', errorCode: result.error?.code, before, after });
  });

  it('denies an Auth-backed actor with an inactive canonical profile before writes', async () => {
    const before = await snapshot(evidence.actor.tenant_id, enrollmentId);
    const result = await inactive.rpc('edu_set_daily_attendance', {
      p_tenant_id: evidence.actor.tenant_id,
      p_enrollment_id: enrollmentId,
      p_status: 'absent',
      p_roll_call_time: '2026-10-22T04:00:00.000Z',
      p_school_day: '2026-10-22',
    });
    expect(result.error?.code).toBe('42501');
    const after = await snapshot(evidence.actor.tenant_id, enrollmentId);
    expect(after).toEqual(before);
    observations.push({ point: 'inactive_profile_denied_zero_side_effect', actorId: inactiveActorId, errorCode: result.error?.code, before, after });
  });

  it('preserves every Auth user that existed before this harness run', async () => {
    const current = (await pg.query<{ id: string; fp: string }>(
      "SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a WHERE id=ANY($1::uuid[]) ORDER BY id",
      [existingAuthRows.map((row) => row.id)],
    )).rows;
    expect(current).toEqual(existingAuthRows);
    observations.push({ point: 'preexisting_auth_users_integrity', rows: existingAuthRows.length, unchanged: true });
  });
});
