import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { expect as browserExpect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { Database as DurableDatabase } from '@/types/preschool-durable.database.types';
import { StudentContractImpl } from '@/platform/education/contracts/student.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';

interface Actor { id: string; personId: string; relationshipId: string; cookies: Array<{ name: string; value: string }> }
interface Child { id: string; partyId: string; name: string; courseId: string }
const enabled = process.env.PRESCHOOL_ATTENDANCE_UI_REAL_DB === '1' ? describe : describe.skip;

enabled('Attendance UI → scoped command → actual DB', () => {
  jest.setTimeout(150000);
  let db: Client, admin: SupabaseClient<Database>, browser: Browser;
  let tenantId: string, branchA: string, branchB: string, courseA: string, courseB: string;
  let creator: Actor, teacher: Actor, revokedTeacher: Actor;
  let saved: Child, lost: Child, denied: Child, foreignBranchChild: Child;
  let directory: string;
  let oldAuth: Array<{ id: string; fp: string }>, ownedAuthBefore: Array<{ id: string; fp: string }>;
  const contexts: BrowserContext[] = [];
  const observations: Array<Record<string, unknown>> = [];
  const origin = 'http://127.0.0.1:15440';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const courseTitle = 'Controlled Attendance Classroom A ' + randomUUID().slice(0, 8);
  const otherTitle = 'Controlled Attendance Classroom B ' + randomUUID().slice(0, 8);

  async function authSnapshot() {
    return (await db.query("SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a ORDER BY id")).rows as Array<{ id: string; fp: string }>;
  }

  async function actor(role: string, branches: string[]): Promise<Actor> {
    const email = `attendance-ui-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw Error('RUN_OWNED_AUTH_CREATE_FAILED');
    const id = created.data.user.id, personId = randomUUID(), relationshipId = randomUUID();
    await db.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled Attendance UI actor',$4,'active')", [id, tenantId, email, role]);
    await db.query("INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active) VALUES($1,$2,$3,'employee','Controlled Attendance UI actor',true)", [personId, tenantId, id]);
    for (const [index, branchId] of branches.entries()) {
      await db.query("INSERT INTO public.org_relationships(id,tenant_id,from_id,from_type,to_id,to_type,rel_type) VALUES($1,$2,$3,'person',$4,'unit','belongs_to')", [index === 0 ? relationshipId : randomUUID(), tenantId, personId, branchId]);
    }
    const jar = new Map<string, string>();
    const signed = createServerClient<Database>('http://127.0.0.1:15421', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: values => { for (const cookie of values) jar.set(cookie.name, cookie.value); } },
    });
    const login = await signed.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== id) throw Error('RUN_OWNED_REAL_SIGN_IN_FAILED');
    return { id, personId, relationshipId, cookies: Array.from(jar, ([name, value]) => ({ name, value })) };
  }

  async function child(courseId: string, branchId: string, label: string): Promise<Child> {
    const partyId = randomUUID(), requestId = randomUUID(), name = 'Controlled UI ' + label + ' ' + randomUUID().slice(0, 8);
    const party = await admin.from('party_parties').insert({ id: partyId, tenant_id: tenantId, party_type: 'person', display_name: name });
    if (party.error) throw Error(party.error.message);
    await new StudentContractImpl(admin).registerStudent({ tenantId, partyId, studentCode: `EDU-2026-${BigInt('0x' + randomUUID().replaceAll('-', '')).toString()}` });
    const enrollment = await new EnrollmentContractImpl(admin).enrollStudent({ tenantId, studentPartyId: partyId, courseId, requestId });
    const assigned = await (admin as unknown as SupabaseClient<DurableDatabase>).rpc('preschool_assign_chain', {
      p_tenant_id: tenantId, p_actor_id: creator.id, p_branch_id: branchId, p_course_id: courseId, p_enrollment_id: enrollment.id, p_request_id: requestId,
    });
    if (assigned.error) throw Error(assigned.error.message);
    return { id: enrollment.id, partyId, name, courseId };
  }

  async function state(target: Child) {
    return (await db.query("SELECT jsonb_build_object('events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.edu_attendance e WHERE tenant_id=$1 AND enrollment_id=$2),'daily',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.edu_attendance_daily_state s WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3)) AS data", [tenantId, target.id, day])).rows[0].data as { events: Array<{ enrollment_id: string; status: string }>; daily: Array<{ enrollment_id: string; status: string }> };
  }

  async function open(who: Actor): Promise<Page> {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); contexts.push(context);
    await context.addCookies(who.cookies.map(cookie => ({ ...cookie, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const })));
    const page = await context.newPage();
    await page.goto(origin + '/dashboard/education/attendance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await browserExpect(page.getByRole('heading', { name: 'Điểm Danh & Đưa Đón Bé An Toàn', exact: true })).toBeVisible({ timeout: 60000 });
    await browserExpect(page.getByRole('button', { name: new RegExp(courseTitle) })).toBeVisible({ timeout: 60000 });
    await browserExpect(page.locator('tr').filter({ hasText: saved.name })).toBeVisible({ timeout: 60000 });
    return page;
  }

  beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:15421' || process.env.PRESCHOOL_ATTENDANCE_HTTP_ORIGIN !== origin) throw Error('APPROVED_LOCAL_HTTP_REQUIRED');
    const target = new URL(process.env.PRESCHOOL_PROOF_DB_URL || '');
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') throw Error('APPROVED_LOCAL_DB_REQUIRED');
    directory = resolve(process.env.PRESCHOOL_ATTENDANCE_EVIDENCE_DIR || '');
    const packets = ['implementation-artifacts/preschool-attendance-ui-20261023', 'implementation-artifacts/preschool-release-preflight-20261023'].map(packet => resolve(packet));
    if (!packets.some(packet => directory.startsWith(packet + '\\') || directory.startsWith(packet + '/'))) throw Error('FRESH_EVIDENCE_DIRECTORY_REQUIRED');
    db = new Client({ connectionString: target.toString() }); await db.connect(); oldAuth = await authSnapshot();
    admin = createClient<Database>('http://127.0.0.1:15421', process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    tenantId = randomUUID(); branchA = randomUUID(); branchB = randomUUID(); courseA = randomUUID(); courseB = randomUUID();
    const tenant = await admin.from('tenants').insert({ id: tenantId, name: 'Controlled Preschool Attendance UI proof', status: 'active', product_key: 'bella_preschool' });
    if (tenant.error) throw Error(tenant.error.message);
    for (const [id, name] of [[branchA, 'Controlled UI branch A'], [branchB, 'Controlled UI branch B']]) await db.query("INSERT INTO public.org_units(id,tenant_id,unit_type,name,is_active) VALUES($1,$2,'branch',$3,true)", [id, tenantId, name]);
    creator = await actor('admin', [branchA, branchB]); teacher = await actor('admin_staff', [branchA]); revokedTeacher = await actor('admin_staff', [branchA]);
    for (const [id, title] of [[courseA, courseTitle], [courseB, otherTitle]]) {
      const course = await admin.from('edu_courses').insert({ id, tenant_id: tenantId, course_code: 'UI-' + randomUUID(), title, status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [] });
      if (course.error) throw Error(course.error.message);
    }
    saved = await child(courseA, branchA, 'persisted'); lost = await child(courseA, branchA, 'lost acknowledgement'); denied = await child(courseA, branchA, 'revoked'); foreignBranchChild = await child(courseB, branchB, 'other branch');
    ownedAuthBefore = (await authSnapshot()).filter(row => [creator.id, teacher.id, revokedTeacher.id].includes(row.id));
    browser = await chromium.launch({ headless: true });
    writeFileSync(resolve(directory, 'FIXTURE_IDS.json'), JSON.stringify({ tenantId, branchA, branchB, courseA, courseB, creatorId: creator.id, teacherId: teacher.id, revokedTeacherId: revokedTeacher.id, children: { saved, lost, denied, foreignBranchChild }, credentialsPersisted: false }, null, 2) + '\n', { flag: 'wx' });
  });

  afterAll(async () => {
    if (browser) { for (const context of contexts) await context.close(); await browser.close(); }
    if (db) {
      const after = await authSnapshot();
      const changedOldAuthIds = oldAuth.filter(old => !after.some(row => row.id === old.id && row.fp === old.fp)).map(row => row.id);
      const changedOwnedAuthIds = (ownedAuthBefore ?? []).filter(old => !after.some(row => row.id === old.id && row.fp === old.fp)).map(row => row.id);
      writeFileSync(resolve(directory, 'AUTH_FIXTURE_INTEGRITY.json'), JSON.stringify({ at: new Date().toISOString(), oldAuthRows: oldAuth.length, ownedAuthRows: ownedAuthBefore?.length ?? 0, changedOldAuthIds, changedOwnedAuthIds, result: changedOldAuthIds.length || changedOwnedAuthIds.length ? 'FAIL' : 'PASS', scope: 'Full auth.users row fingerprints; fresh actors signed in before owned baseline; no password or session retained' }, null, 2) + '\n', { flag: 'wx' });
      writeFileSync(resolve(directory, 'BROWSER_READBACK.json'), JSON.stringify({ at: new Date().toISOString(), observations, day, scope: 'Actual browser with real SSR Auth session, scoped API and SQL read-back; no mocked backend' }, null, 2) + '\n', { flag: 'wx' });
      await db.end();
      expect(changedOldAuthIds).toEqual([]); expect(changedOwnedAuthIds).toEqual([]);
    }
  });

  it('lists only the assigned classroom, saves through UI, and reloads the same canonical daily state', async () => {
    const page = await open(teacher);
    await browserExpect(page.getByRole('button', { name: new RegExp(otherTitle) })).toHaveCount(0);
    const row = page.locator('tr').filter({ hasText: saved.name });
    await browserExpect(row.getByText('Chưa điểm danh', { exact: true })).toBeVisible();
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/education/attendance') && r.request().method() === 'POST'), row.getByRole('button', { name: 'Có Mặt', exact: true }).click()]);
    const result = await response.json(); expect(response.status()).toBe(200); expect(result.attendance.enrollmentId).toBe(saved.id);
    await browserExpect(page.getByText('Đã ghi nhận điểm danh thật vào hệ thống', { exact: true })).toBeVisible();
    const committed = await state(saved); expect(committed.events).toHaveLength(1); expect(committed.daily).toEqual([expect.objectContaining({ enrollment_id: saved.id, status: 'present' })]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await browserExpect(page.locator('tr').filter({ hasText: saved.name }).locator('td').nth(1).getByText('Có Mặt', { exact: true })).toBeVisible({ timeout: 60000 });
    expect(await state(saved)).toEqual(committed);
    await page.screenshot({ path: resolve(directory, 'attendance-persisted.png'), fullPage: false });
    observations.push({ point: 'ui_save_and_reload', enrollmentId: saved.id, responseStatus: response.status(), committed, noReloadWrite: true });
  });

  it('requires read-back after a real committed response is lost, then reloads without duplicate submission', async () => {
    const page = await open(teacher); let dropped = false;
    let releaseResponse!: () => void;
    const pendingResponse = new Promise<void>(resolveResponse => { releaseResponse = resolveResponse; });
    await page.route('**/api/education/attendance', async route => {
      const request = route.request();
      if (request.method() === 'POST' && request.postDataJSON().enrollmentId === lost.id && !dropped) {
        const upstream = await route.fetch(); const result = await upstream.json();
        expect(upstream.status()).toBe(200); expect(result.attendance.enrollmentId).toBe(lost.id);
        dropped = true; await pendingResponse; await route.abort('failed');
      } else await route.continue();
    });
    await page.locator('tr').filter({ hasText: lost.name }).getByRole('button', { name: 'Vắng', exact: true }).click();
    try {
      await browserExpect.poll(() => dropped, { timeout: 60000 }).toBe(true);
      await browserExpect(page.getByRole('button', { name: /^Tất cả khối/ })).toBeDisabled();
      await browserExpect(page.getByRole('button', { name: /^Khối Mầm/ })).toBeDisabled();
    } finally { releaseResponse(); }
    await browserExpect(page.getByText('Failed to fetch', { exact: true })).toBeVisible({ timeout: 60000 });
    expect(dropped).toBe(true);
    const committed = await state(lost); expect(committed.events).toHaveLength(1); expect(committed.daily).toEqual([expect.objectContaining({ enrollment_id: lost.id, status: 'absent' })]);
    await browserExpect(page.getByText(lost.name, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Thử tải lại danh sách', exact: true }).click();
    await browserExpect(page.locator('tr').filter({ hasText: lost.name }).locator('td').nth(1).getByText('Vắng', { exact: true })).toBeVisible({ timeout: 60000 });
    expect(await state(lost)).toEqual(committed);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await browserExpect(page.locator('tr').filter({ hasText: lost.name }).locator('td').nth(1).getByText('Vắng', { exact: true })).toBeVisible({ timeout: 60000 });
    expect(await state(lost)).toEqual(committed);
    observations.push({ point: 'committed_response_lost_reload_recovery', enrollmentId: lost.id, committed, noReplayOrDuplicate: true });
  });

  it('denies a stale visible roster command after branch revocation and reads back zero effects', async () => {
    const page = await open(revokedTeacher); const before = await state(denied);
    await db.query("UPDATE public.org_relationships SET since=CURRENT_DATE-2,until=CURRENT_DATE-1 WHERE id=$1 AND tenant_id=$2", [revokedTeacher.relationshipId, tenantId]);
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/education/attendance') && r.request().method() === 'POST'), page.locator('tr').filter({ hasText: denied.name }).getByRole('button', { name: 'Có Phép', exact: true }).click()]);
    expect(response.status()).toBe(403); const result = await response.json(); expect(result.success).toBe(false);
    await browserExpect(page.getByText(result.error, { exact: true })).toBeVisible(); expect(await state(denied)).toEqual(before);
    await browserExpect(page.getByText(denied.name, { exact: true })).toHaveCount(0);
    const [courses] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/education/courses') && r.request().method() === 'GET'),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    expect(courses.status()).toBe(200); expect((await courses.json()).classrooms).toEqual([]);
    await browserExpect(page.getByText(denied.name, { exact: true })).toHaveCount(0, { timeout: 60000 });
    expect(await state(denied)).toEqual(before);
    observations.push({ point: 'browser_stale_roster_revocation', enrollmentId: denied.id, status: response.status(), noAttendanceChange: true });
  });

  it('rejects a direct browser request to another branch without mutation or roster disclosure', async () => {
    const page = await open(teacher); const before = await state(foreignBranchChild);
    const response = await page.request.post(origin + '/api/education/attendance', { data: { enrollmentId: foreignBranchChild.id, status: 'present', date: day } });
    expect(response.status()).toBe(403); expect((await response.json()).success).toBe(false); expect(await state(foreignBranchChild)).toEqual(before);
    const roster = await page.request.get(origin + '/api/education/attendance?courseId=' + courseB + '&date=' + day);
    expect(roster.status()).toBe(403); expect((await roster.json()).roster).toBeUndefined();
    observations.push({ point: 'browser_foreign_branch_denial', status: response.status(), rosterStatus: roster.status(), noAttendanceChange: true });
  });
});
