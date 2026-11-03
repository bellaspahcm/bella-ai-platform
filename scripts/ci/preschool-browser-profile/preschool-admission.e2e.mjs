import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import pg from 'pg';

const { Client } = pg;
const env = process.env;
const apiUrl = env.BELLA_PROFILE_API_URL;
const dbUrl = env.BELLA_PROFILE_DB_URL;
const anonKey = env.BELLA_PROFILE_ANON_KEY;
const serviceKey = env.BELLA_PROFILE_SERVICE_ROLE_KEY;
const runDirectory = env.BELLA_PROFILE_RUN_DIRECTORY;
const appRoot = env.BELLA_PROFILE_APP_ROOT;
const targetCommit = env.BELLA_PROFILE_TARGET_COMMIT;
const databaseResultsPath = env.BELLA_PROFILE_DB_RESULTS_PATH;

for (const [key, value] of Object.entries({ apiUrl, dbUrl, anonKey, serviceKey, runDirectory, appRoot, targetCommit, databaseResultsPath })) {
  if (!value) throw new Error(`PROFILE_REQUIRED_ENV_MISSING:${key}`);
}

const receiptPath = path.join(runDirectory, 'receipt.json');
const acceptancePath = path.join(runDirectory, 'acceptance-receipt.json');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const manifest = JSON.parse(await readFile(path.join(runDirectory, 'manifest.snapshot.json'), 'utf8'));
const dbResults = JSON.parse(await readFile(databaseResultsPath, 'utf8'));
const browserHarnessSha256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const api = new URL(apiUrl);
const database = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(api.hostname)
  || api.origin !== new URL(receipt.apiOrigin).origin
  || !['127.0.0.1', 'localhost', '::1'].includes(database.hostname)
  || Number(database.port) !== Number(receipt.databasePort)
  || Number(receipt.databasePort) !== Number(api.port) + 1
  || receipt.sourceRevision !== targetCommit
  || receipt.profileId !== manifest.admissionProfile?.profileId
  || receipt.acceptanceType !== 'Admission'
  || receipt.schemaAcceptance !== 'PASS'
  || receipt.realJwt !== 'NOT_RUN' || receipt.browserE2e !== 'NOT_RUN') {
  throw new Error('PROFILE_RECEIPT_OR_LOOPBACK_TARGET_MISMATCH');
}
if (/mock\.supabase\.co|supabase\.co\/rest|supabase\.com\/rest/i.test(apiUrl)) {
  throw new Error('NON_LOCAL_SUPABASE_TARGET_REFUSED');
}
if (dbResults.targetRevision !== targetCommit || dbResults.status !== 'PASS'
  || dbResults.phases?.length !== 2 || dbResults.phases.some(phase => phase.status !== 'PASS' || phase.passedTests < 1 || phase.failedTests !== 0)) {
  throw new Error('ADMISSION_DB_RLS_RECEIPT_NOT_PASS');
}

const outcome = {
  profileId: receipt.profileId,
  acceptanceType: 'Admission',
  targetCommit,
  applicationSourceRevision: targetCommit,
  schemaSourceRevision: receipt.sourceRevision,
  manifestSha256: receipt.manifestSha256,
  browserHarnessSha256,
  migrationHashes: receipt.migrationSourceHashes,
  schemaAcceptance: receipt.schemaAcceptance,
  fixture: { kind: 'synthetic-only', businessRowsImported: false, credentialsRecorded: false },
  dbRls: dbResults,
  browserE2e: { status: 'NOT_RUN', results: [] },
  readback: { status: 'NOT_RUN' },
  cleanup: 'PENDING_DISPOSABLE_PROFILE_TEARDOWN',
  appWorktreeCleanup: 'PENDING',
  completedAt: null,
};

const secretsToScrub = [anonKey, serviceKey];
let pgClient;
let serviceClient;
let browser;
let appProcess;
let appOutput = '';
let appOrigin;
let failure;
const browserResults = [];

function scrub(value) {
  let text = String(value ?? '');
  for (const secret of secretsToScrub) if (secret) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED_JWT]')
    .replace(/(apikey|service_role_key|anon_key|access_token|refresh_token|password)(\s*[=:]\s*)[^\s,;]+/gi, '$1$2[REDACTED]');
}

function record(name, status, details = undefined) {
  const item = { name, status };
  if (details !== undefined) item.details = details;
  browserResults.push(item);
  process.stdout.write(`BROWSER ${status} ${name}\n`);
}

function assert(condition, code) {
  if (!condition) throw new Error(`ASSERTION_FAILED:${code}`);
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('APP_PORT_UNAVAILABLE');
  const port = address.port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function startApp() {
  const port = await freePort();
  appOrigin = `http://127.0.0.1:${port}`;
  const nextCli = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const appEnvironment = { ...env };
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'POSTGRES_URL', 'DB_URL']) delete appEnvironment[name];
  Object.assign(appEnvironment, {
    NODE_ENV: 'development',
    BELLA_PROFILE_ACCEPTANCE_DIAGNOSTICS: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    SUPABASE_URL: apiUrl,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_PUBLISHABLE_KEY: anonKey,
    SUPABASE_SECRET_KEY: serviceKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  });
  appProcess = spawn(process.execPath, [nextCli, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: appRoot,
    env: appEnvironment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collect = chunk => { appOutput = (appOutput + chunk.toString()).slice(-20000); };
  appProcess.stdout.on('data', collect);
  appProcess.stderr.on('data', collect);
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null) throw new Error(`NEXT_DEV_EXITED:${appProcess.exitCode}`);
    try {
      const response = await fetch(`${appOrigin}/login`, { redirect: 'manual' });
      if (response.status > 0 && response.status < 500) return;
    } catch { /* wait until the exact application worktree binds */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`NEXT_DEV_READY_TIMEOUT:${scrub(appOutput).slice(-1800)}`);
}

async function stopApp() {
  if (!appProcess || appProcess.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/pid', String(appProcess.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  } else {
    appProcess.kill('SIGTERM');
  }
  await Promise.race([once(appProcess, 'exit'), new Promise(resolve => setTimeout(resolve, 10000))]);
}

async function insertOne(table, row, label) {
  const { error } = await serviceClient.from(table).insert(row);
  if (error) throw new Error(`FIXTURE_INSERT_FAILED:${label}:${error.code ?? 'UNKNOWN'}`);
}

async function readOne(table, columns, filters, label) {
  let query = serviceClient.from(table).select(columns);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error(`CANONICAL_READBACK_FAILED:${label}:${error?.code ?? 'NO_ROW'}`);
  return data;
}

async function main() {
  pgClient = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 8000, statement_timeout: 15000 });
  await pgClient.connect();
  serviceClient = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  let actorId;
  const actorPersonId = randomUUID();
  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  const courseId = randomUUID();
  const secondCourseId = randomUUID();
  const thirdCourseId = randomUUID();
  const otherCourseId = randomUUID();
  const email = `admission-${suffix}@example.test`;
  const password = `${randomBytes(32).toString('base64url')}A1!`;
  const childName = `Synthetic Admission ${suffix}`;
  const guardianName = `Synthetic Guardian ${suffix}`;
  const guardianPhone = `09${String(BigInt(`0x${randomBytes(5).toString('hex')}`) % 100000000n).padStart(8, '0')}`;

  const auth = await serviceClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (auth.error || !auth.data.user?.id) throw new Error('SYNTHETIC_ADMIN_AUTH_CREATION_FAILED');
  actorId = auth.data.user.id;
  await insertOne('tenants', { id: tenantId, name: `Synthetic Preschool ${suffix}`, status: 'active', product_key: 'bella_preschool' }, 'tenant-a');
  await insertOne('tenants', { id: otherTenantId, name: `Synthetic Other Preschool ${suffix}`, status: 'active', product_key: 'bella_preschool' }, 'tenant-b');
  await insertOne('users', { id: actorId, tenant_id: tenantId, email, full_name: 'Synthetic Admission Admin', role: 'admin', status: 'active' }, 'admin-actor');
  await insertOne('org_units', { id: branchId, tenant_id: tenantId, unit_type: 'branch', name: `Synthetic Branch ${suffix}`, is_active: true }, 'branch-a');
  await insertOne('org_units', { id: otherBranchId, tenant_id: otherTenantId, unit_type: 'branch', name: `Synthetic Other Branch ${suffix}`, is_active: true }, 'branch-b');
  await insertOne('people_directory', {
    id: actorPersonId, tenant_id: tenantId, user_id: actorId, person_type: 'employee',
    display_name: 'Synthetic Admission Admin', is_active: true,
  }, 'admin-person');
  await insertOne('org_relationships', {
    tenant_id: tenantId, from_id: actorPersonId, from_type: 'person', to_id: branchId,
    to_type: 'unit', rel_type: 'manages', since: new Date().toISOString().slice(0, 10),
  }, 'admin-branch-management');
  await insertOne('edu_courses', {
    id: courseId, tenant_id: tenantId, course_code: `ADM-${suffix}`, title: `Synthetic Admission Class ${suffix}`,
    status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [],
  }, 'course-a');
  await insertOne('edu_courses', {
    id: otherCourseId, tenant_id: otherTenantId, course_code: `OTHER-${suffix}`, title: `Synthetic Other Class ${suffix}`,
    status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [],
  }, 'course-b');
  await insertOne('edu_courses', {
    id: secondCourseId, tenant_id: tenantId, course_code: `ADM-SECOND-${suffix}`, title: `Synthetic Second Class ${suffix}`,
    status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [],
  }, 'course-second');
  await insertOne('edu_courses', {
    id: thirdCourseId, tenant_id: tenantId, course_code: `ADM-THIRD-${suffix}`, title: `Synthetic Third Class ${suffix}`,
    status: 'active', max_students: 20, current_enrollment: 0, prerequisite_course_codes: [],
  }, 'course-third');
  await insertOne('preschool_chain_course_branch_assignments', {
    tenant_id: tenantId, course_id: secondCourseId, branch_id: branchId, assigned_by: actorId,
  }, 'course-second-branch-assignment');
  await insertOne('preschool_chain_course_branch_assignments', {
    tenant_id: tenantId, course_id: thirdCourseId, branch_id: branchId, assigned_by: actorId,
  }, 'course-third-branch-assignment');
  record('synthetic_tenant_branch_course_auth_and_canonical_branch_access_created', 'PASS');

  await startApp();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const authStatuses = [];
  const apiResponses = [];
  const mainFramePaths = [];
  const failedRequests = [];
  page.on('response', async response => {
    const url = new URL(response.url());
    if (url.pathname === '/auth/v1/token') authStatuses.push(response.status());
    if (url.pathname.startsWith('/api/education/')) apiResponses.push({ path: url.pathname, status: response.status() });
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      try { mainFramePaths.push(new URL(frame.url()).pathname); } catch { /* ignore non-URL navigation */ }
    }
  });
  page.on('pageerror', error => { appOutput = (appOutput + `\nPAGE_ERROR:${error.message}`).slice(-20000); });
  page.on('console', message => {
    if (message.type() === 'error') appOutput = (appOutput + `\nBROWSER_CONSOLE:${message.text()}`).slice(-20000);
  });
  page.on('requestfailed', request => {
    try {
      failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText ?? 'UNKNOWN' });
    } catch { failedRequests.push({ path: 'INVALID_URL', error: 'UNKNOWN' }); }
  });

  await page.goto(`${appOrigin}/login`, { waitUntil: 'networkidle' });
  await page.waitForLoadState('load');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();
  try {
    await page.waitForURL(url => url.pathname === '/dashboard/education', { timeout: 60000 });
  } catch {
    const pageText = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
    throw new Error(`AUTH_LOGIN_REDIRECT_FAILED:${JSON.stringify({
      currentPath: new URL(page.url()).pathname,
      authStatuses,
      mainFramePaths,
      failedRequests,
      clientAndServerErrors: scrub(appOutput).slice(-1600),
      apiResponses,
      pageText,
    })}`);
  }
  assert(authStatuses.includes(200), 'REAL_SUPABASE_AUTH_JWT_LOGIN');
  record('synthetic_admin_logs_in_through_supabase_auth', 'PASS');

  await page.goto(`${appOrigin}/dashboard/education/enrollments`, { waitUntil: 'domcontentloaded' });
  const startButton = page.getByRole('button', { name: 'Đăng Ký Nhập Học Mới', exact: true });
  await startButton.waitFor({ state: 'visible', timeout: 60000 });
  await startButton.click();
  await page.getByRole('heading', { name: 'Đăng Ký Hồ Sơ Nhập Học Mới' }).waitFor({ state: 'visible', timeout: 20000 });

  await page.locator('input[placeholder="VD: Lê Hoàng Nam"]').fill(childName);
  await page.locator('input[type="date"]').fill('2023-06-15');
  await page.getByRole('button', { name: 'Tiếp theo: Giám hộ →' }).click();
  await page.locator('input[placeholder="VD: Lê Văn Thành (Bố)"]').fill(guardianName);
  await page.locator('input[placeholder="VD: 0989 112 334"]').fill(guardianPhone);
  const branchSelect = page.locator('label').filter({ hasText: 'Cơ sở / chi nhánh nhập học' }).locator('xpath=following-sibling::select');
  await branchSelect.waitFor({ state: 'visible', timeout: 20000 });
  await branchSelect.selectOption(branchId);
  const courseSelect = page.locator('label').filter({ hasText: 'Lớp nhập học' }).locator('xpath=following-sibling::select');
  await courseSelect.locator(`option[value="${courseId}"]`).waitFor({ state: 'attached', timeout: 30000 }).catch(async () => {
    const options = await courseSelect.locator('option').allTextContents().catch(() => []);
    throw new Error(`ADMISSION_COURSE_OPTION_NOT_LOADED:${scrub(options.join('|')).slice(0, 400)}`);
  });
  await courseSelect.selectOption(courseId);
  const submit = page.getByRole('button', { name: 'Hoàn Tất Đăng Ký Nhập Học', exact: true });
  const admissionResponsePromise = page.waitForResponse(response => response.url().includes('/api/education/enrollments')
    && response.request().method() === 'POST', { timeout: 120000 });
  await submit.click();
  const admissionResponse = await admissionResponsePromise;
  const admissionBody = await admissionResponse.json();
  assert(admissionResponse.status() === 201 && admissionBody.success === true, `ADMISSION_API_STATUS_${admissionResponse.status()}`);
  assert(admissionBody.student?.childName === childName && admissionBody.enrollment?.courseId === courseId
    && admissionBody.chain?.branchId === branchId, 'ADMISSION_API_CANONICAL_RESPONSE');
  record('browser_form_posts_admission_to_authenticated_api', 'PASS');

  await page.getByText('Đã tạo thành công hồ sơ', { exact: false }).waitFor({ state: 'visible', timeout: 30000 });
  record('browser_confirms_admission_completion', 'PASS');

  const enrollmentId = admissionBody.enrollment.id;
  const studentPartyId = admissionBody.student.partyId;
  const guardianPartyId = admissionBody.student.guardianPartyId;
  const enrollment = await readOne('edu_enrollments', 'id,tenant_id,student_party_id,course_id,status,request_id', { id: enrollmentId, tenant_id: tenantId }, 'enrollment');
  const student = await readOne('students', 'student_id,tenant_id,party_id,student_code', { party_id: studentPartyId, tenant_id: tenantId }, 'student');
  const childParty = await readOne('party_parties', 'id,tenant_id,display_name,dob', { id: studentPartyId, tenant_id: tenantId }, 'child-party');
  const guardianParty = await readOne('party_parties', 'id,tenant_id,display_name', { id: guardianPartyId, tenant_id: tenantId }, 'guardian-party');
  const assignment = await readOne('preschool_chain_enrollment_branch_assignments', 'tenant_id,enrollment_id,course_id,branch_id,request_id', { enrollment_id: enrollmentId, tenant_id: tenantId }, 'branch-assignment');
  const operation = await readOne('preschool_admission_operations', 'tenant_id,operation_key,actor_id,branch_id,student_code,enrollment_request_id', { tenant_id: tenantId, operation_key: admissionBody.operationKey }, 'admission-operation');
  assert(enrollment.student_party_id === studentPartyId && enrollment.course_id === courseId && enrollment.status === 'active', 'ENROLLMENT_CANONICAL_READBACK');
  assert(student.student_code === admissionBody.student.studentCode && childParty.display_name === childName, 'STUDENT_CANONICAL_READBACK');
  assert(guardianParty.display_name === guardianName, 'GUARDIAN_CANONICAL_READBACK');
  assert(assignment.branch_id === branchId && assignment.course_id === courseId && assignment.request_id === enrollment.request_id, 'BRANCH_ASSIGNMENT_CANONICAL_READBACK');
  assert(operation.actor_id === actorId && operation.student_code === student.student_code && operation.enrollment_request_id === enrollment.request_id, 'ADMISSION_OPERATION_CANONICAL_READBACK');
  const receiptRows = await serviceClient.from('party_registration_receipts').select('registration_key,party_id')
    .eq('tenant_id', tenantId).in('registration_key', [`${admissionBody.operationKey}:child`, `${admissionBody.operationKey}:guardian`]);
  if (receiptRows.error || receiptRows.data?.length !== 2) throw new Error('PARTY_RECEIPT_CANONICAL_READBACK_FAILED');
  outcome.readback = {
    status: 'PASS',
    canonicalStudent: { partyId: studentPartyId, studentCode: student.student_code },
    canonicalGuardianPartyId: guardianPartyId,
    enrollment: { id: enrollment.id, courseId: enrollment.course_id, status: enrollment.status },
    branchAssignment: { branchId: assignment.branch_id, courseId: assignment.course_id },
    partyRegistrationReceipts: receiptRows.data.length,
  };
  record('database_reloads_student_guardian_enrollment_branch_and_party_receipts', 'PASS');

  const submitDenied = async body => page.evaluate(async requestBody => {
    const response = await fetch('/api/education/enrollments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, body);
  const secondClassAttempt = await submitDenied({
    courseId: secondCourseId, studentPartyId, guardianPartyId, requestId: randomUUID(), branchId,
  });
  if (secondClassAttempt.status !== 409 || secondClassAttempt.body?.error !== 'ENROLLMENT_CONFLICT') {
    const diagnosticClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const diagnosticAuth = await diagnosticClient.auth.signInWithPassword({ email, password });
    let directRpcDiagnostic = 'AUTH_FAILED';
    if (!diagnosticAuth.error) {
      const directRpc = await diagnosticClient.rpc('edu_preschool_enroll_student', {
        p_course_id: secondCourseId,
        p_student_party_id: studentPartyId,
        p_guardian_party_id: guardianPartyId,
        p_request_id: randomUUID(),
      });
      const knownMessages = new Set([
        'ENROLLMENT_ALREADY_IN_ANOTHER_CLASS', 'ENROLLMENT_ALREADY_EXISTS',
        'ENROLLMENT_BRANCH_ACCESS_DENIED', 'ENROLLMENT_BRANCH_SCOPE_UNAVAILABLE',
        'ENROLLMENT_COURSE_ACCESS_DENIED', 'ENROLLMENT_STUDENT_ACCESS_DENIED',
        'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED',
      ]);
      directRpcDiagnostic = directRpc.error
        ? `SQLSTATE_${directRpc.error.code ?? 'UNKNOWN'}_MESSAGE_${knownMessages.has(directRpc.error.message) ? directRpc.error.message : 'OTHER'}`
        : `SUCCESS_DUPLICATE_${directRpc.data?.isDuplicate === true}`;
    }
    const conflictReadback = await serviceClient.from('edu_enrollments').select('id,course_id,status')
      .eq('tenant_id', tenantId).eq('student_party_id', studentPartyId).in('status', ['active', 'pending']);
    const activeCourseCount = conflictReadback.error ? 'READ_FAILED'
      : new Set((conflictReadback.data ?? []).map(row => row.course_id)).size;
    const safeDiagnostic = JSON.stringify(secondClassAttempt.body?.diagnostic ?? {});
    record('second_active_class_api_returns_http_409_conflict', 'FAIL', {
      status: secondClassAttempt.status,
      error: String(secondClassAttempt.body?.error ?? 'MISSING'),
      diagnostic: secondClassAttempt.body?.diagnostic ?? {},
      directRpc: directRpcDiagnostic,
      activeCourseCount,
    });
  } else {
    record('second_active_class_api_returns_http_409_conflict', 'PASS', { status: secondClassAttempt.status });
  }
  const activeStudentEnrollments = await serviceClient.from('edu_enrollments')
    .select('id,course_id,status').eq('tenant_id', tenantId).eq('student_party_id', studentPartyId)
    .in('status', ['active', 'pending']);
  if (activeStudentEnrollments.error || activeStudentEnrollments.data?.length !== 1
    || activeStudentEnrollments.data[0].id !== enrollmentId || activeStudentEnrollments.data[0].course_id !== courseId) {
    throw new Error('SECOND_CLASS_DENIAL_CHANGED_ENROLLMENT_STATE');
  }
  record('database_retains_only_the_original_active_enrollment', 'PASS', {
    status: secondClassAttempt.status,
    activeEnrollmentCount: activeStudentEnrollments.data.length,
  });

  const cancelledEnrollment = await serviceClient.from('edu_enrollments').update({ status: 'cancelled' })
    .eq('tenant_id', tenantId).eq('id', enrollmentId).select('id').maybeSingle();
  if (cancelledEnrollment.error || cancelledEnrollment.data?.id !== enrollmentId) {
    throw new Error('SYNTHETIC_ENROLLMENT_RESET_FAILED');
  }
  const originalCourseReset = await serviceClient.from('edu_courses').update({ current_enrollment: 0 })
    .eq('tenant_id', tenantId).eq('id', courseId);
  if (originalCourseReset.error) throw new Error('SYNTHETIC_COURSE_COUNTER_RESET_FAILED');

  const directWriterA = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 8000, statement_timeout: 15000 });
  const directWriterB = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 8000, statement_timeout: 15000 });
  let writerATransactionOpen = false;
  let writerBTransactionOpen = false;
  try {
    await Promise.all([directWriterA.connect(), directWriterB.connect()]);
    await directWriterA.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    writerATransactionOpen = true;
    await directWriterA.query(
      `INSERT INTO public.edu_enrollments(id, tenant_id, student_party_id, course_id, status, request_id)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [randomUUID(), tenantId, studentPartyId, secondCourseId, randomUUID()],
    );

    await directWriterB.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    writerBTransactionOpen = true;
    const competingInsert = directWriterB.query(
      `INSERT INTO public.edu_enrollments(id, tenant_id, student_party_id, course_id, status, request_id)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [randomUUID(), tenantId, studentPartyId, thirdCourseId, randomUUID()],
    ).then(() => ({ status: 'INSERTED' }), error => ({ status: 'REJECTED', code: error.code, message: error.message }));

    let partyLockWaitObserved = false;
    const lockDeadline = Date.now() + 10000;
    while (Date.now() < lockDeadline) {
      const waiters = await pgClient.query(
        `SELECT count(*)::int AS count FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock' AND state = 'active'
           AND query ILIKE '%INSERT INTO public.edu_enrollments%'`,
      );
      if (waiters.rows[0]?.count >= 1) {
        partyLockWaitObserved = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    await directWriterA.query('COMMIT');
    writerATransactionOpen = false;
    const competingResult = await competingInsert;
    if (competingResult.status === 'INSERTED') {
      await directWriterB.query('COMMIT');
    } else {
      await directWriterB.query('ROLLBACK');
    }
    writerBTransactionOpen = false;

    const syntheticDuplicateCount = await pgClient.query(
      `SELECT count(*)::int AS duplicate_students,
              coalesce(sum(enrollment_count), 0)::int AS duplicate_enrollment_rows
       FROM (
         SELECT student_party_id, count(*)::int AS enrollment_count
         FROM public.edu_enrollments
         WHERE tenant_id = $1 AND status IN ('active', 'pending')
         GROUP BY student_party_id
         HAVING count(*) > 1
       ) duplicates`,
      [tenantId],
    );
    const activeRowsAfterRace = await serviceClient.from('edu_enrollments')
      .select('id,course_id,status').eq('tenant_id', tenantId).eq('student_party_id', studentPartyId)
      .in('status', ['active', 'pending']);
    const raceDetails = {
      databaseTransactions: 2,
      partyLockWaitObserved,
      winnerCourseId: secondCourseId,
      losingSqlState: competingResult.code ?? null,
      activeEnrollmentCount: activeRowsAfterRace.data?.length ?? null,
      syntheticDuplicateStudents: syntheticDuplicateCount.rows[0]?.duplicate_students ?? null,
      syntheticDuplicateEnrollmentRows: syntheticDuplicateCount.rows[0]?.duplicate_enrollment_rows ?? null,
    };
    const raceAccepted = partyLockWaitObserved && competingResult.status === 'REJECTED'
      && competingResult.code === '23505'
      && competingResult.message.includes('ENROLLMENT_ALREADY_IN_ANOTHER_CLASS')
      && !activeRowsAfterRace.error && activeRowsAfterRace.data?.length === 1
      && activeRowsAfterRace.data[0].course_id === secondCourseId
      && syntheticDuplicateCount.rows[0]?.duplicate_students === 0
      && syntheticDuplicateCount.rows[0]?.duplicate_enrollment_rows === 0;
    if (!raceAccepted) {
      record('concurrent_database_writes_serialize_on_party_and_leave_one_active_class', 'FAIL', raceDetails);
      throw new Error('CONCURRENT_ENROLLMENT_PARTY_LOCK_ACCEPTANCE_FAILED');
    }
    record('concurrent_database_writes_serialize_on_party_and_leave_one_active_class', 'PASS', raceDetails);
  } finally {
    if (writerATransactionOpen) await directWriterA.query('ROLLBACK').catch(() => undefined);
    if (writerBTransactionOpen) await directWriterB.query('ROLLBACK').catch(() => undefined);
    await Promise.all([directWriterA.end().catch(() => undefined), directWriterB.end().catch(() => undefined)]);
  }

  const apiConflictAfterConcurrentWrite = await submitDenied({
    courseId: thirdCourseId, studentPartyId, guardianPartyId, requestId: randomUUID(), branchId,
  });
  assert(apiConflictAfterConcurrentWrite.status === 409
    && apiConflictAfterConcurrentWrite.body?.error === 'ENROLLMENT_CONFLICT',
  'CONCURRENT_DATABASE_CONFLICT_MAPPED_TO_HTTP_409');
  record('authenticated_api_maps_database_class_conflict_to_409', 'PASS', { status: apiConflictAfterConcurrentWrite.status });

  const forgedTenantKey = randomUUID();
  const forgedTenant = await submitDenied({
    operationKey: forgedTenantKey, tenantId: otherTenantId, childName: `Denied ${suffix}`, dateOfBirth: '2023-06-15',
    guardianName, guardianPhone: `09${String(BigInt(`0x${randomBytes(5).toString('hex')}`) % 100000000n).padStart(8, '0')}`,
    gender: 'Nam', medicalNote: '', branchId, courseId,
  });
  assert(forgedTenant.status === 403, 'FORGED_TENANT_DENIED');
  const foreignBranchKey = randomUUID();
  const foreignBranch = await submitDenied({
    operationKey: foreignBranchKey, childName: `Denied ${suffix}`, dateOfBirth: '2023-06-15',
    guardianName, guardianPhone: `09${String(BigInt(`0x${randomBytes(5).toString('hex')}`) % 100000000n).padStart(8, '0')}`,
    gender: 'Nam', medicalNote: '', branchId: otherBranchId, courseId: otherCourseId,
  });
  assert(foreignBranch.status === 400 || foreignBranch.status === 403, 'CROSS_TENANT_BRANCH_DENIED');
  const deniedOperations = await serviceClient.from('preschool_admission_operations').select('operation_key')
    .eq('tenant_id', tenantId).in('operation_key', [forgedTenantKey, foreignBranchKey]);
  if (deniedOperations.error || deniedOperations.data?.length !== 0) throw new Error('DENIED_ADMISSION_CREATED_OPERATION');
  const authProbe = apiResponses.some(item => item.path === '/api/education/branches' && item.status === 200)
    && apiResponses.some(item => item.path === '/api/education/courses' && item.status === 200);
  assert(authProbe, 'ADMISSION_BRANCH_AND_COURSE_APIS_SUCCEEDED');
  record('browser_api_denies_forged_tenant_and_cross_tenant_branch_without_operation_writes', 'PASS', {
    forgedTenantStatus: forgedTenant.status,
    crossTenantBranchStatus: foreignBranch.status,
  });

  outcome.browserE2e = { status: 'PASS', results: browserResults, realSupabaseAuth: true, apiStatuses: apiResponses };
  outcome.fixture.actorRole = 'admin';
  outcome.fixture.serviceRolePurpose = 'synthetic_fixture_setup_and_canonical_readback_only';
  outcome.fixture.tenantCount = 2;
  outcome.fixture.branchCount = 2;
  outcome.fixture.courseCount = 4;
}

try {
  await main();
} catch (error) {
  failure = scrub(error?.stack ?? error?.message ?? error);
  outcome.browserE2e = { status: 'FAIL', results: browserResults, failure: failure.slice(0, 3000) };
  outcome.readback = outcome.readback.status === 'PASS' ? outcome.readback : { status: 'NOT_PROVEN' };
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await stopApp().catch(() => undefined);
  if (pgClient) await pgClient.end().catch(() => undefined);
  outcome.appServerShutdown = appProcess ? (appProcess.exitCode !== null ? 'STOPPED' : 'STOP_REQUESTED') : 'NOT_STARTED';
  outcome.completedAt = new Date().toISOString();
  await writeFile(acceptancePath, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8');
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PRESCHOOL_ADMISSION_BROWSER_E2E_PASS ${targetCommit}\n`);
}
