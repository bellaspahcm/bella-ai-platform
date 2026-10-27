import { chromium, type Browser } from 'playwright';
import { expect as browserExpect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { Client } from 'pg';
import type { Database } from '@/types/database.types';
import type { PreschoolAdmissionService } from '@/products/bella-education/services/preschool-admission.service';

type Admission = Awaited<ReturnType<PreschoolAdmissionService['admit']>>;
interface Fingerprint { id: string; fp: string }
const enabled = process.env.PRESCHOOL_ADMISSION_EVENT_UI_REAL_DB === '1' ? describe : describe.skip;

enabled('Admission UI lost acknowledgement → restart → durable enrollment event', () => {
  jest.setTimeout(240000);
  let db: Client, admin: SupabaseClient<Database>, browser: Browser, replacement: ChildProcess | undefined;
  let directory: string, oldAuth: Fingerprint[], actorBefore: Fingerprint;
  let tenantId: string, actorId: string, branchId: string, courseId: string;
  const origin = 'http://127.0.0.1:15440', observations: Array<Record<string, unknown>> = [];
  const secrets: string[] = []; let replacementLog = '';
  const save = (name: string, value: unknown) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const clean = (value: string) => secrets.reduce((result, secret) => result.replaceAll(secret, '[REDACTED]'), value)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');

  async function authSnapshot(): Promise<Fingerprint[]> {
    return (await db.query("SELECT id,encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex') AS fp FROM auth.users a ORDER BY id")).rows;
  }

  async function readBack(admission: Admission) {
    const parameters = [tenantId, admission.enrollment.id];
    return {
      enrollment: (await db.query('SELECT id,tenant_id,student_party_id,course_id,request_id FROM public.edu_enrollments WHERE tenant_id=$1 AND id=$2', parameters)).rows,
      events: (await db.query('SELECT event_id,tenant_id,enrollment_id,request_id,event_type,event_version,payload,replay_state,replay_attempts FROM public.edu_enrollment_event_records WHERE tenant_id=$1 AND enrollment_id=$2', parameters)).rows,
      assignment: (await db.query('SELECT enrollment_id,course_id,branch_id,request_id FROM public.preschool_chain_enrollment_branch_assignments WHERE tenant_id=$1 AND enrollment_id=$2', parameters)).rows,
      student: (await db.query('SELECT student_id,party_id,student_code FROM public.students WHERE tenant_id=$1 AND party_id=$2', [tenantId, admission.student.partyId])).rows,
      operation: (await db.query('SELECT operation_key,enrollment_request_id,student_code FROM public.preschool_admission_operations WHERE tenant_id=$1 AND operation_key=$2', [tenantId, admission.operationKey])).rows,
      enrollmentCount: Number((await db.query('SELECT count(*) AS count FROM public.edu_enrollments WHERE tenant_id=$1 AND request_id=$2', [tenantId, admission.chain.requestId])).rows[0].count),
    };
  }

  beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:15421' || process.env.PRESCHOOL_ATTENDANCE_HTTP_ORIGIN !== origin) throw Error('APPROVED_LOCAL_HTTP_REQUIRED');
    const target = new URL(process.env.PRESCHOOL_PROOF_DB_URL || '');
    if (target.hostname !== '127.0.0.1' || target.port !== '15432') throw Error('APPROVED_LOCAL_DB_REQUIRED');
    directory = resolve(process.env.PRESCHOOL_ATTENDANCE_EVIDENCE_DIR || '');
    const packet = resolve('implementation-artifacts/preschool-attendance-ui-20261023');
    if (!directory.startsWith(packet + '\\') && !directory.startsWith(packet + '/')) throw Error('FRESH_EVIDENCE_DIRECTORY_REQUIRED');
    db = new Client({ connectionString: target.toString() }); await db.connect(); oldAuth = await authSnapshot();
    secrets.push(process.env.SUPABASE_SERVICE_ROLE_KEY!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, target.toString());
    admin = createClient<Database>('http://127.0.0.1:15421', process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (replacement?.pid && replacement.exitCode === null) spawnSync('taskkill', ['/PID', String(replacement.pid), '/T', '/F'], { windowsHide: true, timeout: 15000, stdio: 'ignore' });
    writeFileSync(resolve(directory, 'REPLACEMENT_NEXT_SANITIZED.log'), clean(replacementLog), { flag: 'wx' });
    if (db) {
      const after = await authSnapshot();
      const changedOldAuthIds = oldAuth.filter(old => !after.some(row => row.id === old.id && row.fp === old.fp)).map(row => row.id);
      const ownedUnchanged = actorBefore ? after.some(row => row.id === actorBefore.id && row.fp === actorBefore.fp) : false;
      save('ADMISSION_AUTH_INTEGRITY.json', { at: new Date().toISOString(), oldRows: oldAuth.length, changedOldAuthIds, actorUnchanged: ownedUnchanged, credentialsPersisted: false });
      save('ADMISSION_BROWSER_OBSERVATIONS.json', { at: new Date().toISOString(), observations, downstreamProcessing: 'NOT_PROVEN_NO_OPERATIONAL_CONSUMER', processMode: 'Non-Production Next dev; not production build/release proof' });
      await db.end(); expect(changedOldAuthIds).toEqual([]); expect(ownedUnchanged).toBe(true);
    }
  });

  it('recovers exactly one canonical enrollment/event after real form commit, response loss and a different server process', async () => {
    tenantId = randomUUID(); branchId = randomUUID(); courseId = randomUUID();
    const tenant = await admin.from('tenants').insert({ id: tenantId, name: 'Controlled D01 UI proof', status: 'active', product_key: 'bella_preschool' });
    if (tenant.error) throw Error(tenant.error.message);
    await db.query("INSERT INTO public.org_units(id,tenant_id,unit_type,name,is_active) VALUES($1,$2,'branch','Controlled D01 UI branch',true)", [branchId, tenantId]);
    const email = `admission-event-ui-${randomUUID()}@example.test`, password = randomUUID() + randomUUID(); secrets.push(email, password);
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw Error('RUN_OWNED_AUTH_CREATE_FAILED'); actorId = created.data.user.id;
    const personId = randomUUID();
    await db.query("INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES($1,$2,$3,'Controlled D01 UI actor','admin','active')", [actorId, tenantId, email]);
    await db.query("INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active) VALUES($1,$2,$3,'employee','Controlled D01 UI actor',true)", [personId, tenantId, actorId]);
    await db.query("INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type) VALUES($1,$2,'person',$3,'unit','belongs_to')", [tenantId, personId, branchId]);
    const courseTitle = 'Controlled D01 UI Class ' + courseId.slice(0, 8);
    const course = await admin.from('edu_courses').insert({ id: courseId, tenant_id: tenantId, course_code: 'D01UI-' + courseId, title: courseTitle, status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [] });
    if (course.error) throw Error(course.error.message);
    const jar = new Map<string, string>();
    const auth = createServerClient<Database>('http://127.0.0.1:15421', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: values => { for (const cookie of values) jar.set(cookie.name, cookie.value); } },
    });
    const login = await auth.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== actorId) throw Error('REAL_AUTH_SIGN_IN_FAILED');
    actorBefore = (await authSnapshot()).find(row => row.id === actorId)!;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies(Array.from(jar, ([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const })));
    const page = await context.newPage(), requests: Array<{ operationKey: string; keys: string[] }> = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/education/enrollments')) { const body = request.postDataJSON() as { operationKey: string }; requests.push({ operationKey: body.operationKey, keys: Object.keys(body).sort() }); } });
    await page.goto(origin + '/dashboard/education/enrollments', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.getByRole('button', { name: 'Đăng Ký Nhập Học Mới', exact: true }).click();
    const childName = 'Controlled D01 UI Child ' + randomUUID().slice(0, 8);
    await page.getByPlaceholder('VD: Lê Hoàng Nam', { exact: true }).fill(childName);
    await page.locator('input[type=date]').fill('2022-04-12');
    await page.getByRole('button', { name: 'Tiếp theo: Giám hộ →', exact: true }).click();
    await page.getByPlaceholder('VD: Lê Văn Thành (Bố)', { exact: true }).fill('Controlled D01 UI Guardian');
    await page.getByPlaceholder('VD: 0989 112 334', { exact: true }).fill('09' + String(Date.now()).slice(-8));
    await page.locator('select').filter({ has: page.locator(`option[value="${branchId}"]`) }).selectOption(branchId);
    await browserExpect(page.locator(`option[value="${courseId}"]`)).toHaveCount(1, { timeout: 30000 });
    await page.locator('select').filter({ has: page.locator(`option[value="${courseId}"]`) }).selectOption(courseId);
    let committed: Admission | undefined;
    await page.route('**/api/education/enrollments', async route => {
      if (route.request().method() === 'POST' && !committed) {
        const upstream = await route.fetch(); expect(upstream.status()).toBe(201);
        committed = await upstream.json() as Admission; save('ADMISSION_COMMITTED_RESPONSE.json', { upstreamStatus: 201, forwarded: false, result: committed });
        await route.abort('failed');
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Hoàn Tất Đăng Ký Nhập Học', exact: true }).click();
    await browserExpect(page.getByRole('button', { name: 'Tiếp tục hồ sơ đang xử lý', exact: true })).toBeEnabled({ timeout: 60000 });
    if (!committed) throw Error('COMMITTED_ADMISSION_REQUIRED');
    const admission = committed as Admission;
    const firstRead = await readBack(admission); expect(firstRead.enrollment).toHaveLength(1); expect(firstRead.events).toHaveLength(1); expect(firstRead.assignment).toHaveLength(1); expect(firstRead.student).toHaveLength(1); expect(firstRead.operation).toHaveLength(1); expect(firstRead.enrollmentCount).toBe(1);
    expect(firstRead.events[0].payload).toEqual(expect.objectContaining({ enrollmentId: admission.enrollment.id, studentPartyId: admission.student.partyId, courseId }));
    save('ADMISSION_DB_BEFORE_RESTART.json', firstRead);
    const runtime = JSON.parse(readFileSync(resolve(directory, 'RUNTIME_SOURCE.json'), 'utf8')) as { runtime: string };
    const original = JSON.parse(readFileSync(resolve(directory, 'SERVER_PROCESS.json'), 'utf8')) as { pid: number; runtime: string };
    expect(original.runtime).toBe(runtime.runtime);
    expect(spawnSync('taskkill', ['/PID', String(original.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8', timeout: 15000 }).status).toBe(0);
    const serverEnvironment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1' };
    // This child is a real Next server. Next's Windows config loader handles
    // file URLs differently inside Jest, so do not inherit its worker marker.
    delete serverEnvironment.JEST_WORKER_ID;
    replacement = spawn(process.execPath, [join(runtime.runtime, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '15440'], {
      cwd: runtime.runtime, env: serverEnvironment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    replacement.stdout?.on('data', chunk => { replacementLog += String(chunk); }); replacement.stderr?.on('data', chunk => { replacementLog += String(chunk); });
    await browserExpect.poll(async () => { try { return (await fetch(origin + '/api/education/attendance?courseId=' + courseId + '&date=2026-10-23', { signal: AbortSignal.timeout(2000) })).status; } catch { return 0; } }, { timeout: 90000 }).toBe(401);
    expect(replacement.pid).not.toBe(original.pid); save('ADMISSION_SERVER_RESTART.json', { beforePid: original.pid, afterPid: replacement.pid, runtime: runtime.runtime, sourceUnchanged: true, processMode: 'Non-Production Next dev' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Đăng Ký Nhập Học Mới', exact: true }).click();
    await page.getByText('Hồ sơ trước chưa được xác nhận hoàn tất. Tiếp tục để kiểm tra và khôi phục đúng hồ sơ.', { exact: true }).waitFor();
    const nextStep = page.getByRole('button', { name: 'Tiếp theo: Giám hộ →', exact: true }); if (await nextStep.isVisible()) await nextStep.click();
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/education/enrollments') && r.request().method() === 'POST'), page.getByRole('button', { name: 'Tiếp tục hồ sơ đang xử lý', exact: true }).click()]);
    const recovered = await response.json() as Admission; expect(response.status()).toBe(201);
    expect([recovered.operationKey, recovered.student.partyId, recovered.enrollment.id, recovered.guardianAuthorization.id]).toEqual([admission.operationKey, admission.student.partyId, admission.enrollment.id, admission.guardianAuthorization.id]);
    expect(requests).toHaveLength(2); expect(requests.map(item => item.operationKey)).toEqual([admission.operationKey, admission.operationKey]); expect(requests[1].keys).toEqual(['operationKey']);
    const finalRead = await readBack(admission); expect(finalRead).toEqual(firstRead); save('ADMISSION_DB_AFTER_RECOVERY.json', finalRead);
    await browserExpect(page.getByText('Đã tạo thành công hồ sơ ' + admission.student.studentCode + ' cho bé ' + childName, { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(directory, 'admission-event-recovered.png'), fullPage: false });
    observations.push({ point: 'form_commit_lost_response_process_restart_key_only_recovery', operationKey: admission.operationKey, canonicalEnrollmentId: admission.enrollment.id, canonicalStudentPartyId: admission.student.partyId, eventId: finalRead.events[0].event_id, enrollmentCount: finalRead.enrollmentCount, noDuplicateEventOrRelation: true, distinctProcess: true });
  });
});
