import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { AttendanceCommandDatabase } from '@/types/education-attendance-command.database.types';

interface Prior {
  tenantId: string; foreignTenant: string;
  branches: { branchA: string; branchB: string };
  enrollments: { a: { id: string; courseId: string; studentPartyId: string } };
  actors: Array<{ id: string; personId: string }>;
}
interface Actor { id: string; personId: string; cookie: string; signed: SupabaseClient<Database> }
const enabled = process.env.PRESCHOOL_ATTENDANCE_SCOPED_REAL_DB === '1' ? describe : describe.skip;

enabled('Attendance scoped transaction — actual locks/Auth/SQL/HTTP', () => {
  jest.setTimeout(60000);
  let pg: Client, admin: SupabaseClient<Database>, command: SupabaseClient<AttendanceCommandDatabase>;
  let prior: Prior, directory: string;
  const observations: Array<Record<string, unknown>> = [];
  const day = '2026-10-23';
  const time = '2026-10-23T05:00:00.000Z';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  const args = (actorId = prior.actors[0].id, role = 'admin') => ({
    p_tenant_id: prior.tenantId, p_actor_id: actorId, p_expected_role: role,
    p_branch_id: prior.branches.branchA, p_enrollment_id: prior.enrollments.a.id,
    p_course_id: prior.enrollments.a.courseId, p_student_party_id: prior.enrollments.a.studentPartyId,
    p_status: 'present', p_roll_call_time: time, p_school_day: day,
  });

  async function snapshot() {
    return (await pg.query("SELECT jsonb_build_object('events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.edu_attendance e WHERE enrollment_id=$1),'state',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.edu_attendance_daily_state s WHERE enrollment_id=$1)) AS data", [prior.enrollments.a.id])).rows[0].data;
  }

  async function freshActor(): Promise<Actor> {
    const email = `attendance-lock-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw new Error('RUN_OWNED_LOCK_ACTOR_FAILED');
    const id = result.data.user.id, personId = randomUUID();
    await pg.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled Attendance lock actor','admin_staff','active')", [id, prior.tenantId, email]);
    await pg.query("INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active) VALUES($1,$2,$3,'employee','Controlled Attendance lock actor',true)", [personId, prior.tenantId, id]);
    await pg.query("INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type) VALUES($1,$2,'person',$3,'unit','belongs_to')", [prior.tenantId, personId, prior.branches.branchA]);
    const jar = new Map<string, string>();
    const signed = createServerClient<Database>('http://127.0.0.1:15421', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: items => { for (const item of items) jar.set(item.name, item.value); } },
    });
    const login = await signed.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== id) throw new Error('LOCK_ACTOR_SIGN_IN_FAILED');
    return { id, personId, signed, cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ') };
  }

  async function waitForCommandLock() {
    for (let i = 0; i < 80; i++) {
      const waits = await pg.query("SELECT pid,wait_event,wait_event_type FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%preschool_set_scoped_daily_attendance%' ");
      if (waits.rows.length) return waits.rows;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('EXPECTED_SCOPED_COMMAND_LOCK_NOT_OBSERVED');
  }

  async function httpPost(actor: Actor) {
    const response = await fetch('http://127.0.0.1:15440/api/education/attendance', {
      method: 'POST', headers: { cookie: actor.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId: prior.enrollments.a.id, status: 'present', date: day }),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:15421') throw new Error('LOCAL_SCOPED_ENV_REQUIRED');
    const target = new URL(process.env.PRESCHOOL_PROOF_DB_URL || '');
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') throw new Error('LOCAL_SCOPED_DB_REQUIRED');
    directory = resolve(process.env.PRESCHOOL_ATTENDANCE_EVIDENCE_DIR || '');
    const packet = resolve('implementation-artifacts/preschool-attendance-branch-20261023');
    if (!directory.startsWith(packet + '\\') && !directory.startsWith(packet + '/')) throw new Error('SCOPED_PACKET_REQUIRED');
    prior = JSON.parse(readFileSync(resolve(directory, 'HTTP_AUTH_DB.json'), 'utf8')) as Prior;
    pg = new Client({ connectionString: target.toString() }); await pg.connect();
    admin = createClient<Database>('http://127.0.0.1:15421', process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    command = admin as unknown as SupabaseClient<AttendanceCommandDatabase>;
  });

  afterAll(async () => {
    if (directory) writeFileSync(resolve(directory, 'SCOPED_COMMAND_DB.json'), JSON.stringify({ at: new Date().toISOString(), observations,
      scope: 'Actual scoped daily write transaction, SQL read-back and lock-wait HTTP denial. History retained; no consumer/Go-Live claim.' }, null, 2) + '\n', { flag: 'wx' });
    if (pg) await pg.end();
  });

  it('denies anonymous and signed-in direct RPC execution, including a same-tenant actor', async () => {
    const actor = await freshActor(), before = await snapshot();
    const anonymous = createClient<Database>('http://127.0.0.1:15421', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const errors = [];
    for (const client of [anonymous, actor.signed]) {
      const legacy = await client.rpc('edu_set_daily_attendance', { p_tenant_id: prior.tenantId, p_enrollment_id: prior.enrollments.a.id, p_status: 'present', p_roll_call_time: time, p_school_day: day });
      expect(legacy.error?.code).toBe('42501');
      const scoped = await (client as unknown as SupabaseClient<AttendanceCommandDatabase>).rpc('preschool_set_scoped_daily_attendance', args(actor.id, 'admin_staff'));
      expect(scoped.error?.code).toBe('42501'); errors.push({ legacy: legacy.error?.code, scoped: scoped.error?.code });
    }
    expect(await snapshot()).toEqual(before);
    observations.push({ point: 'direct_rpc_denied_zero_effect', sameTenantActor: actor.id, errors });
  });

  it('rejects forged role, canonical IDs, foreign actor and an unassigned branch before writes', async () => {
    const before = await snapshot(), variants = [
      { ...args(), p_expected_role: 'accountant' },
      { ...args(), p_student_party_id: randomUUID() },
      { ...args(), p_actor_id: prior.actors.at(-1)!.id },
      { ...args(), p_branch_id: prior.branches.branchB },
    ];
    const codes = [];
    for (const input of variants) {
      const result = await command.rpc('preschool_set_scoped_daily_attendance', input);
      expect(['42501', '23505']).toContain(result.error?.code); codes.push(result.error?.code);
    }
    expect(await snapshot()).toEqual(before); observations.push({ point: 'server_context_and_canonical_denials', codes });
  });

  it('rechecks branch revocation after waiting on daily serialization through the real API', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: Promise<Awaited<ReturnType<typeof httpPost>>> | undefined;
    try {
      await locker.query('BEGIN');
      await locker.query("SELECT pg_advisory_xact_lock(hashtextextended('education-attendance:'||$1::text||':'||$2::text||':'||$3::text,0))", [prior.tenantId, prior.enrollments.a.id, day]);
      pending = httpPost(actor); const waits = await waitForCommandLock();
      await pg.query('UPDATE public.org_relationships SET until=CURRENT_DATE-1 WHERE tenant_id=$1 AND from_id=$2', [prior.tenantId, actor.personId]);
      await locker.query('COMMIT');
      const result = await pending; expect(result.status).toBe(403); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'http_branch_revocation_after_serialization_wait', actorId: actor.id, waits, result, noAttendanceChange: true });
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });

  it('rechecks role revocation after waiting on the existing daily row through the real API', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: Promise<Awaited<ReturnType<typeof httpPost>>> | undefined;
    try {
      await locker.query('BEGIN');
      const held = await locker.query('SELECT id FROM public.edu_attendance_daily_state WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3 FOR UPDATE', [prior.tenantId, prior.enrollments.a.id, day]);
      expect(held.rows).toHaveLength(1);
      pending = httpPost(actor); const waits = await waitForCommandLock();
      await pg.query("UPDATE public.users SET role='accountant' WHERE id=$1", [actor.id]);
      await locker.query('COMMIT');
      const result = await pending; expect(result.status).toBe(403); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'http_role_revocation_after_daily_row_wait', actorId: actor.id, waits, result, noAttendanceChange: true });
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });

  it('rejects role revocation while an Attendance insert waits on its tenant foreign key', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: Promise<Awaited<ReturnType<typeof httpPost>>> | undefined;
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM public.tenants WHERE id=$1 FOR UPDATE', [prior.tenantId]);
      pending = httpPost(actor); const waits = await waitForCommandLock();
      await pg.query("UPDATE public.users SET role='accountant' WHERE id=$1", [actor.id]);
      await locker.query('COMMIT');
      const result = await pending, after = await snapshot();
      observations.push({ point: 'http_role_revocation_during_tenant_fk_wait', actorId: actor.id, waits, result,
        noAttendanceChange: JSON.stringify(before) === JSON.stringify(after) });
      expect(result.status).toBe(403); expect(after).toEqual(before);
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });

  it('rejects role revocation while waiting on the Attendance append-table lock', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: Promise<Awaited<ReturnType<typeof httpPost>>> | undefined;
    try {
      await locker.query('BEGIN'); await locker.query('LOCK TABLE public.edu_attendance IN SHARE MODE');
      pending = httpPost(actor); const waits = await waitForCommandLock();
      await pg.query("UPDATE public.users SET role='accountant' WHERE id=$1", [actor.id]);
      await locker.query('COMMIT');
      const result = await pending; expect(result.status).toBe(403); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'http_role_revocation_during_append_table_wait', actorId: actor.id, waits, result, noAttendanceChange: true });
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });

  it('returns HTTP400 for an impossible calendar date without attendance changes', async () => {
    const actor = await freshActor(), before = await snapshot();
    const response = await fetch('http://127.0.0.1:15440/api/education/attendance', {
      method: 'POST', headers: { cookie: actor.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId: prior.enrollments.a.id, status: 'present', date: '2026-02-30' }),
    });
    expect(response.status).toBe(400); expect(await snapshot()).toEqual(before);
    observations.push({ point: 'invalid_calendar_date_rejected', status: response.status, noAttendanceChange: true });
  });

  it('rechecks role after a canonical Course read-lock wait before persisting', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: PromiseLike<{ error: { code?: string; message: string } | null }> | undefined;
    try {
      await locker.query('BEGIN'); await locker.query('LOCK TABLE public.edu_courses IN ACCESS EXCLUSIVE MODE');
      pending = Promise.resolve(command.rpc('preschool_set_scoped_daily_attendance', args(actor.id, 'admin_staff')));
      const waits = await waitForCommandLock();
      await pg.query("UPDATE public.users SET role='accountant' WHERE id=$1", [actor.id]);
      await locker.query('COMMIT');
      const result = await pending; expect(result.error?.code).toBe('42501'); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'role_revocation_during_canonical_read_wait', actorId: actor.id, waits, code: result.error?.code, noAttendanceChange: true });
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });

  it('rolls back the append event when the daily-state write fails', async () => {
    const before = await snapshot(), name = `attendance_fault_${randomUUID().replaceAll('-', '')}`;
    try {
      await pg.query(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.enrollment_id='${prior.enrollments.a.id}'::uuid THEN RAISE EXCEPTION 'CONTROLLED_DAILY_STATE_FAILURE'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE ON public.edu_attendance_daily_state FOR EACH ROW EXECUTE FUNCTION public.${name}();`);
      const result = await command.rpc('preschool_set_scoped_daily_attendance', args());
      expect(result.error?.message).toContain('CONTROLLED_DAILY_STATE_FAILURE'); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'daily_write_failure_atomic_rollback', code: result.error?.code, noEventOrStateChange: true });
    } finally { await pg.query(`DROP TRIGGER IF EXISTS ${name} ON public.edu_attendance_daily_state; DROP FUNCTION IF EXISTS public.${name}();`); }
  });

  it('serializes allowed concurrent writes and keeps append history plus one daily state', async () => {
    const before = await snapshot(), statuses = ['present', 'excused'];
    const results = await Promise.all(statuses.map(status => command.rpc('preschool_set_scoped_daily_attendance', { ...args(), p_status: status })));
    expect(results.every(result => result.error === null)).toBe(true);
    const events = (await pg.query('SELECT id,status FROM public.edu_attendance WHERE enrollment_id=$1 ORDER BY created_at,id', [prior.enrollments.a.id])).rows;
    const state = (await pg.query('SELECT id,status FROM public.edu_attendance_daily_state WHERE enrollment_id=$1 AND school_day=$2', [prior.enrollments.a.id, day])).rows;
    expect(events).toHaveLength(before.events.length + 2); expect(state).toHaveLength(1);
    expect(statuses).toContain(state[0].status);
    expect(new Set(results.flatMap(result => result.data ?? []).map(row => row.event_id)).size).toBe(2);
    observations.push({ point: 'allowed_concurrent_append_and_single_daily_state', eventsAdded: 2, state, results: results.map(result => result.data) });
  });

  it('confirms exact RPC and TRUNCATE restrictions without destructive probes', async () => {
    const functions = (await pg.query("SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') AS service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('edu_set_daily_attendance','edu_set_scoped_daily_attendance','preschool_set_scoped_daily_attendance') ORDER BY p.proname")).rows;
    expect(functions).toHaveLength(3); expect(functions.every(row => !row.anon && !row.authenticated && row.service)).toBe(true);
    const grants = (await pg.query("SELECT c.relname AS table,r.rolname AS role,has_table_privilege(r.rolname,c.oid,'TRUNCATE') AS truncate FROM pg_class c CROSS JOIN pg_roles r WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass) AND r.rolname IN ('anon','authenticated') ORDER BY c.relname,r.rolname")).rows;
    expect(grants).toHaveLength(4); expect(grants.every(row => !row.truncate)).toBe(true);
    observations.push({ point: 'actual_acl_readback', functions, grants });
  });

  it('rejects a branch retyped while the command waits for its canonical branch row', async () => {
    const actor = await freshActor(), before = await snapshot();
    const locker = new Client({ connectionString: process.env.PRESCHOOL_PROOF_DB_URL }); await locker.connect();
    let pending: Promise<Awaited<ReturnType<typeof httpPost>>> | undefined;
    try {
      await locker.query('BEGIN'); await locker.query('SELECT id FROM public.org_units WHERE id=$1 FOR UPDATE', [prior.branches.branchA]);
      pending = httpPost(actor); const waits = await waitForCommandLock();
      await locker.query("UPDATE public.org_units SET unit_type='department' WHERE id=$1", [prior.branches.branchA]);
      await locker.query('COMMIT');
      const result = await pending; expect(result.status).toBe(403); expect(await snapshot()).toEqual(before);
      observations.push({ point: 'http_branch_retyped_during_branch_row_wait', actorId: actor.id, waits, result, noAttendanceChange: true });
    } finally { await locker.query('ROLLBACK'); await locker.end(); if (pending) await pending; }
  });
});
