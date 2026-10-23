import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';

interface Actor { id: string; cookie: string; personId: string }
interface Enrollment { id: string; courseId: string; studentPartyId: string; branchId: string }
const enabled = process.env.PRESCHOOL_ATTENDANCE_BRANCH_HTTP === '1' ? describe : describe.skip;

enabled('Preschool Attendance branch preflight — actual HTTP/Auth/DB', () => {
  jest.setTimeout(90000);
  let pg: Client, admin: SupabaseClient<Database>;
  let tenantId: string, foreignTenant: string, branchA: string, branchB: string, branchC: string;
  let creator: Actor, staff: Actor, scopedAdmin: Actor, unassignedAdmin: Actor, nonAction: Actor, accountant: Actor, foreignActor: Actor;
  let a: Enrollment, b: Enrollment, c: Enrollment;
  let directory: string;
  let oldAuth: Array<{ id: string; fp: string }>;
  const observations: Array<Record<string, unknown>> = [];
  const schoolDay = '2026-10-23';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  async function actor(role: string, tenant: string, branches: string[]): Promise<Actor> {
    const email = `attendance-branch-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
    const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (auth.error || !auth.data.user) throw new Error('RUN_OWNED_AUTH_CREATE_FAILED');
    const id = auth.data.user.id, personId = randomUUID();
    await pg.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled Attendance branch actor',$4,'active')", [id, tenant, email, role]);
    await pg.query("INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active) VALUES($1,$2,$3,'employee','Controlled Attendance branch actor',true)", [personId, tenant, id]);
    for (const branch of branches) await pg.query("INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type) VALUES($1,$2,'person',$3,'unit','belongs_to')", [tenant, personId, branch]);
    const jar = new Map<string, string>();
    const signed = createServerClient<Database>('http://127.0.0.1:15421', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: cookies => { for (const cookie of cookies) jar.set(cookie.name, cookie.value); } },
    });
    const login = await signed.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== id) throw new Error('RUN_OWNED_AUTH_SIGN_IN_FAILED');
    return { id, personId, cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ') };
  }

  async function enrollment(branchId: string): Promise<Enrollment> {
    const courseId = randomUUID(), studentPartyId = randomUUID(), requestId = randomUUID();
    const party = await admin.from('party_parties').insert({ id: studentPartyId, tenant_id: tenantId, party_type: 'person', display_name: 'Controlled Attendance branch student' });
    if (party.error) throw new Error(party.error.message);
    const course = await admin.from('edu_courses').insert({ id: courseId, tenant_id: tenantId, course_code: `AB-${randomUUID()}`, title: 'Controlled Attendance branch course', status: 'active', max_students: 10, current_enrollment: 0, prerequisite_course_codes: [] });
    if (course.error) throw new Error(course.error.message);
    await new StudentContractImpl(admin).registerStudent({ tenantId, partyId: studentPartyId, studentCode: `EDU-2026-${BigInt('0x' + randomUUID().replaceAll('-', '')).toString()}` });
    const result = await new EnrollmentContractImpl(admin).enrollStudent({ tenantId, studentPartyId, courseId, requestId });
    const assigned = await (admin as unknown as SupabaseClient<DurableDatabase>).rpc('preschool_assign_chain', {
      p_tenant_id: tenantId, p_actor_id: creator.id, p_course_id: courseId, p_enrollment_id: result.id, p_branch_id: branchId, p_request_id: requestId,
    });
    if (assigned.error) throw new Error(assigned.error.message);
    return { id: result.id, courseId, studentPartyId, branchId };
  }

  async function snapshot() {
    return (await pg.query("SELECT jsonb_build_object('events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.edu_attendance e WHERE tenant_id=$1),'state',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.edu_attendance_daily_state s WHERE tenant_id=$1)) AS data", [tenantId])).rows[0].data;
  }

  async function request(method: 'GET' | 'POST', who: Actor | null, target: Enrollment, status = 'present') {
    const suffix = method === 'GET' ? `?courseId=${target.courseId}&date=${schoolDay}` : '';
    const response = await fetch(`http://127.0.0.1:15440/api/education/attendance${suffix}`, {
      method, headers: { ...(who ? { cookie: who.cookie } : {}), ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify({ enrollmentId: target.id, status, date: schoolDay }) } : {}),
    });
    const text = await response.text();
    let body: Record<string, unknown>;
    try { body = JSON.parse(text) as Record<string, unknown>; } catch { throw new Error(`UNEXPECTED_HTTP_BODY_${response.status}`); }
    return { status: response.status, body };
  }

  async function denied(point: string, method: 'GET' | 'POST', who: Actor | null, target: Enrollment, expected = 403) {
    const before = await snapshot(), result = await request(method, who, target);
    observations.push({ point, actorId: who?.id ?? null, enrollmentId: target.id, ...result });
    expect(result.status).toBe(expected); expect(result.body.success).toBe(false);
    expect(result.body.roster).toBeUndefined();
    expect(await snapshot()).toEqual(before);
  }

  beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:15421' || process.env.PRESCHOOL_ATTENDANCE_HTTP_ORIGIN !== 'http://127.0.0.1:15440') throw new Error('APPROVED_HTTP_ENV_REQUIRED');
    const target = new URL(process.env.PRESCHOOL_PROOF_DB_URL || '');
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') throw new Error('APPROVED_DB_ENV_REQUIRED');
    const root = resolve('implementation-artifacts/preschool-attendance-branch-20261023');
    directory = resolve(process.env.PRESCHOOL_ATTENDANCE_EVIDENCE_DIR || '');
    if (!directory.startsWith(root + '\\') && !directory.startsWith(root + '/')) throw new Error('FRESH_PACKET_DIRECTORY_REQUIRED');
    pg = new Client({ connectionString: target.toString() }); await pg.connect();
    oldAuth = (await pg.query("SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a ORDER BY id")).rows;
    admin = createClient<Database>('http://127.0.0.1:15421', process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    tenantId = randomUUID(); foreignTenant = randomUUID();
    const tenants = await admin.from('tenants').insert([{ id: tenantId, name: 'Controlled Attendance branch proof', status: 'active' }, { id: foreignTenant, name: 'Controlled foreign Attendance branch proof', status: 'active' }]);
    if (tenants.error) throw new Error(tenants.error.message);
    branchA = randomUUID(); branchB = randomUUID(); branchC = randomUUID();
    for (const [id, name] of [[branchA, 'A'], [branchB, 'B'], [branchC, 'Inactive C']]) {
      await pg.query("INSERT INTO public.org_units(id,tenant_id,unit_type,name,is_active) VALUES($1,$2,'branch',$3,true)", [id, tenantId, 'Controlled ' + name]);
    }
    creator = await actor('admin', tenantId, [branchA, branchB, branchC]);
    staff = await actor('admin_staff', tenantId, [branchA]);
    scopedAdmin = await actor('admin', tenantId, [branchA]);
    unassignedAdmin = await actor('admin', tenantId, []);
    // Actual users_role_check supports ktv, not parent/super_admin. Do not alter
    // schema or fabricate a parent profile to make the HTTP fixture pass.
    nonAction = await actor('ktv', tenantId, [branchA]);
    accountant = await actor('accountant', tenantId, [branchA]);
    foreignActor = await actor('admin', foreignTenant, []);
    a = await enrollment(branchA); b = await enrollment(branchB); c = await enrollment(branchC);
  });

  afterAll(async () => {
    if (directory) writeFileSync(resolve(directory, 'HTTP_AUTH_DB.json'), JSON.stringify({ at: new Date().toISOString(), tenantId, foreignTenant,
      branches: { branchA, branchB, branchC }, enrollments: { a, b, c }, actors: [creator, staff, scopedAdmin, unassignedAdmin, nonAction, accountant, foreignActor].filter(Boolean).map(item => ({ id: item.id, personId: item.personId })),
      observations, scope: 'Actual Next HTTP API preflight and SQL read-back; no atomic/direct-RPC branch authorization claim', retention: 'All run-owned fixtures retained; no old Auth actor used for sign-in; no credentials retained' }, null, 2) + '\n', { flag: 'wx' });
    if (pg) await pg.end();
  });

  it('denies anonymous GET and POST with no attendance effects', async () => {
    await denied('anonymous_get', 'GET', null, a, 401); await denied('anonymous_post', 'POST', null, a, 401);
  });

  it('allows assigned staff GET/POST with canonical roster and SQL read-back', async () => {
    const roster = await request('GET', staff, a);
    observations.push({ point: 'assigned_staff_get', ...roster });
    expect(roster.status).toBe(200);
    expect(roster.body.roster).toEqual(expect.arrayContaining([expect.objectContaining({ enrollmentId: a.id, studentPartyId: a.studentPartyId })]));
    const write = await request('POST', staff, { ...a, id: a.id.toUpperCase() });
    observations.push({ point: 'assigned_staff_uppercase_uuid_post', requestedEnrollmentId: a.id.toUpperCase(), ...write });
    expect(write.status).toBe(200);
    expect(write.body.attendance).toEqual(expect.objectContaining({ enrollmentId: a.id }));
    const rows = (await pg.query('SELECT tenant_id,enrollment_id,status FROM public.edu_attendance_daily_state WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3', [tenantId, a.id, schoolDay])).rows;
    expect(rows).toEqual([{ tenant_id: tenantId, enrollment_id: a.id, status: 'present' }]);
  });

  it('allows an explicitly assigned admin without requiring tenant-wide access', async () => {
    const result = await request('POST', scopedAdmin, a, 'absent'); observations.push({ point: 'assigned_admin_post', ...result });
    expect(result.status).toBe(200);
    expect((await pg.query('SELECT status FROM public.edu_attendance_daily_state WHERE enrollment_id=$1 AND school_day=$2', [a.id, schoolDay])).rows).toEqual([{ status: 'absent' }]);
  });

  it('denies an admin with only tenant_admin projection on GET and POST', async () => {
    await denied('tenant_admin_only_get', 'GET', unassignedAdmin, a); await denied('tenant_admin_only_post', 'POST', unassignedAdmin, a);
  });

  it('denies another branch to both staff and scoped admin without writes or disclosures', async () => {
    await denied('staff_other_branch_get', 'GET', staff, b); await denied('staff_other_branch_post', 'POST', staff, b);
    await denied('admin_other_branch_post', 'POST', scopedAdmin, b);
  });

  it('denies a non-attendance role and accountant even with current branch membership', async () => {
    await denied('ktv_membership_not_action', 'POST', nonAction, a); await denied('accountant_membership_not_action', 'POST', accountant, a);
  });

  it('denies a foreign tenant actor with no changes in target tenant', async () => {
    await denied('foreign_tenant_actor', 'POST', foreignActor, a);
  });

  it('denies a previously granted branch after its relationship is revoked', async () => {
    await pg.query('UPDATE public.org_relationships SET until=CURRENT_DATE-1 WHERE tenant_id=$1 AND from_id=$2', [tenantId, staff.personId]);
    await denied('revoked_relationship_post', 'POST', staff, a); await denied('revoked_relationship_get', 'GET', staff, a);
  });

  it('denies an inactive mapped branch before writing attendance', async () => {
    await pg.query('UPDATE public.org_units SET is_active=false WHERE id=$1 AND tenant_id=$2', [branchC, tenantId]);
    await denied('inactive_branch_post', 'POST', creator, c, 400);
  });

  it('rejects conflicting course/enrollment branch mappings before writing', async () => {
    await pg.query('UPDATE public.preschool_chain_course_branch_assignments SET branch_id=$1 WHERE tenant_id=$2 AND course_id=$3', [branchA, tenantId, b.courseId]);
    await denied('conflicting_branch_mapping_post', 'POST', creator, b, 409);
  });

  it('preserves every Auth row that existed before this run', async () => {
    const actual = (await pg.query("SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a WHERE id=ANY($1::uuid[]) ORDER BY id", [oldAuth.map(row => row.id)])).rows;
    expect(actual).toEqual(oldAuth);
    observations.push({ point: 'old_auth_rows_unchanged', rows: oldAuth.length, unchanged: true });
  });
});
