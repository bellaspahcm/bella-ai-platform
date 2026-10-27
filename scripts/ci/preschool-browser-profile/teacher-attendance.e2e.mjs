import { randomBytes, randomUUID } from 'node:crypto';
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
const repoRoot = env.BELLA_PROFILE_REPO_ROOT;
const targetCommit = env.BELLA_PROFILE_TARGET_COMMIT;
const requiredEnv = { apiUrl, dbUrl, anonKey, serviceKey, runDirectory, appRoot, repoRoot, targetCommit };

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) throw new Error(`PROFILE_REQUIRED_ENV_MISSING:${key}`);
}

const receiptPath = path.join(runDirectory, 'receipt.json');
const acceptancePath = path.join(runDirectory, 'acceptance-receipt.json');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const manifest = JSON.parse(await readFile(path.join(runDirectory, 'manifest.snapshot.json'), 'utf8'));
const api = new URL(apiUrl);
const database = new URL(dbUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(api.hostname)
  || api.origin !== new URL(receipt.apiOrigin).origin
  || !['127.0.0.1', 'localhost', '::1'].includes(database.hostname)
  || Number(database.port) !== Number(receipt.databasePort)
  || receipt.sourceRevision !== targetCommit
  || receipt.schemaAcceptance !== 'PASS'
  || receipt.realJwt !== 'NOT_RUN' || receipt.browserE2e !== 'NOT_RUN') {
  throw new Error('PROFILE_RECEIPT_OR_LOOPBACK_TARGET_MISMATCH');
}
if (/mock\.supabase\.co|supabase\.co\/rest|supabase\.com\/rest/i.test(apiUrl)) {
  throw new Error('NON_LOCAL_SUPABASE_TARGET_REFUSED');
}

const outcome = {
  profileId: receipt.profileId,
  targetCommit,
  applicationSourceRevision: targetCommit,
  schemaSourceRevision: receipt.sourceRevision,
  manifestSha256: receipt.manifestSha256,
  migrationHashes: manifest.profileMigrations.map(({ profileVersion, sha256 }) => ({ profileVersion, sha256 })),
  schemaAcceptance: receipt.schemaAcceptance,
  fixture: { kind: 'synthetic-only', businessDataImported: false, fabricatedR3IdentityMappings: false },
  jwtDatabase: { status: 'NOT_RUN', results: [] },
  browserE2e: { status: 'NOT_RUN', results: [] },
  cleanup: 'PENDING_PROFILE_CLEANUP',
  credentialsRecorded: false,
  completedAt: null,
};

let currentPhase = 'preflight';
let pgClient;
let serviceClient;
let adminAClient;
let adminBClient;
let teacherClient;
let browser;
let appProcess;
let appOutput = '';
let appPort = null;
const createdPasswords = [];
const secretsToScrub = [anonKey, serviceKey];
let failure = null;

const addResult = (group, name, result, detail = undefined) => {
  const entry = { name, result };
  if (detail !== undefined) entry.detail = detail;
  outcome[group].results.push(entry);
  process.stdout.write(`${group === 'jwtDatabase' ? 'JWT_DB' : 'BROWSER'} ${result} ${name}${detail ? ` ${detail}` : ''}\n`);
};

function scrub(value) {
  let text = String(value ?? '');
  for (const secret of secretsToScrub) if (secret) text = text.split(secret).join('[REDACTED]');
  for (const secret of createdPasswords) if (secret) text = text.split(secret).join('[REDACTED]');
  return text
    .replace(/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED_JWT]')
    .replace(/e2e-(?:admin-[ab]|teacher)-[a-f0-9-]+@bella\.test/gi, '[REDACTED_EMAIL]')
    .replace(/(apikey|service_role_key|anon_key|access_token|refresh_token|password)(\s*[=:]\s*)[^\s,;]+/gi, '$1$2[REDACTED]');
}

function assert(condition, code) {
  if (!condition) throw new Error(`ASSERTION_FAILED:${code}`);
}

function addPass(group, name, detail) {
  addResult(group, name, 'PASS', detail);
}

function denied(error) {
  return Boolean(error) && (error.code === '42501' || /ACCESS_DENIED|ATTENDANCE_COURSE_ACCESS_DENIED|ATTENDANCE_ENROLLMENT_ACCESS_DENIED/.test(error.message ?? ''));
}

async function requiredRpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const detail = [error.message, error.details, error.hint].filter(Boolean).join(' | ');
    throw new Error(`RPC_FAILED:${name}:${error.code ?? 'NO_CODE'}:${detail}`);
  }
  return data;
}

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('APP_PORT_UNAVAILABLE');
  const { port } = address;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function createAuthUser(email, password) {
  const { data, error } = await serviceClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user?.id) throw new Error('SYNTHETIC_AUTH_USER_CREATE_FAILED');
  return data.user.id;
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session?.access_token) throw new Error(`SYNTHETIC_${label}_JWT_SIGN_IN_FAILED`);
  return { userId: data.user.id, accessToken: data.session.access_token };
}

async function ownerCount(table) {
  const allowed = new Set([
    'tenants', 'users', 'org_units', 'people_directory', 'org_relationships', 'party_parties', 'students', 'edu_courses', 'edu_enrollments',
    'party_auth_links', 'teacher_assignments', 'edu_attendance', 'edu_attendance_daily_state',
  ]);
  if (!allowed.has(table)) throw new Error('PROFILE_COUNT_TABLE_NOT_ALLOWLISTED');
  const result = await pgClient.query(`SELECT count(*)::int AS count FROM public.${table}`);
  return result.rows[0].count;
}

async function startApp() {
  appPort = await getFreePort();
  const appOrigin = `http://127.0.0.1:${appPort}`;
  const nextCli = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const appEnvironment = { ...env };
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'POSTGRES_URL', 'DB_URL']) delete appEnvironment[name];
  Object.assign(appEnvironment, {
    NODE_ENV: 'development',
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
  appProcess = spawn(process.execPath, [nextCli, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(appPort)], {
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
      if (response.status > 0 && response.status < 500) return { appOrigin, responseStatus: response.status };
    } catch { /* wait for Next to bind */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('NEXT_DEV_READY_TIMEOUT');
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

async function main() {
  pgClient = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 8000, statement_timeout: 15000 });
  await pgClient.connect();
  serviceClient = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  currentPhase = 'empty-profile-preflight';
  const emptyTables = ['tenants', 'users', 'org_units', 'people_directory', 'org_relationships', 'party_parties', 'students', 'edu_courses', 'edu_enrollments',
    'party_auth_links', 'teacher_assignments', 'edu_attendance', 'edu_attendance_daily_state'];
  const emptyCounts = {};
  for (const table of emptyTables) emptyCounts[table] = await ownerCount(table);
  const authCount = await pgClient.query('SELECT count(*)::int AS count FROM auth.users');
  assert(authCount.rows[0].count === 0 && Object.values(emptyCounts).every(count => count === 0), 'SCHEMA_PROFILE_HAS_NO_PREEXISTING_FIXTURE_ROWS');
  outcome.fixture.preflightEmpty = true;

  currentPhase = 'synthetic-fixture';
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
    await pgClient.query(`INSERT INTO public.org_relationships(tenant_id,from_id,from_type,to_id,to_type,rel_type,since)
      VALUES ($1,$2,'person',$3,'unit','manages',$6),($1,$2,'person',$4,'unit','manages',$6),
        ($5,$7,'person',$8,'unit','manages',$6),($1,$9,'person',$3,'unit','belongs_to',$6)`,
    [ids.tenantA, ids.adminDirectoryA, ids.branchA, ids.branchB, ids.tenantB, schoolDay,
      ids.adminDirectoryB, ids.branchC, ids.teacherDirectory]);

    await pgClient.query(`INSERT INTO public.party_parties(id,tenant_id,party_type,display_name,gender,dob)
      VALUES ($1,$4,'person','Synthetic Teacher','other','1990-01-01'),($2,$4,'person','Synthetic Child A','other','2020-01-01'),($3,$4,'person','Synthetic Child B','other','2020-01-01'),($5,$6,'person','Synthetic Child C','other','2020-01-01')`,
    [ids.teacherParty, ids.studentPartyA, ids.studentPartyB, ids.tenantA, ids.studentPartyC, ids.tenantB]);

    for (const row of studentRows) {
      await pgClient.query(`INSERT INTO public.persons(id,tenant_id,first_name,last_name,date_of_birth,gender,status)
        VALUES ($1,$2,$3,$4,'2020-01-01','other','active')`, [row.personId, row.tenantId, row.first, row.last]);
      await pgClient.query(`INSERT INTO public.students(student_id,tenant_id,person_id,student_code,academic_status,enrollment_type,program_id,enrollment_date,party_id)
        VALUES ($1,$2,$3,$4,'enrolled','full_time','preschool',$5,$6)`, [row.studentId, row.tenantId, row.personId, row.code, schoolDay, row.partyId]);
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
  currentPhase = 'jwt-database-acceptance';
  outcome.jwtDatabase.status = 'RUNNING';

  const link = await requiredRpc(teacherClient, 'party_resolve_current_auth_link', {});
  assert(link?.tenantId === ids.tenantA && link?.authUserId === ids.teacher && link?.partyId === ids.teacherParty, 'REAL_JWT_RESOLVES_SELF_IDENTITY');
  addPass('jwtDatabase', 'real_teacher_jwt_resolves_auth_party');

  const tenantPresentation = await requiredRpc(teacherClient, 'platform_current_actor_tenant_presentation');
  assert(Array.isArray(tenantPresentation) && tenantPresentation.length === 1
    && tenantPresentation[0].tenant_id === ids.tenantA
    && tenantPresentation[0].tenant_status === 'active'
    && tenantPresentation[0].product_key === 'bella_preschool'
    && tenantPresentation[0].name === 'Synthetic Preschool A'
    && Object.keys(tenantPresentation[0]).sort().join(',') === 'brand_theme,enabled_modules,logo_url,name,product_key,tenant_id,tenant_status',
  'REAL_JWT_RECEIVES_ONLY_OWN_TENANT_PRESENTATION_FIELDS');
  addPass('jwtDatabase', 'teacher_jwt_reads_minimal_own_tenant_presentation');

  const forgedTenant = await teacherClient.rpc('platform_current_actor_tenant_presentation', { p_tenant_id: ids.tenantB });
  assert(Boolean(forgedTenant.error) && !forgedTenant.data, 'TENANT_PRESENTATION_CONTRACT_REJECTS_CLIENT_TENANT_ARGUMENT');
  addPass('jwtDatabase', 'tenant_presentation_has_no_client_selected_tenant');

  const orphanPresentation = await orphanClient.rpc('platform_current_actor_tenant_presentation');
  assert(denied(orphanPresentation.error) && !orphanPresentation.data, 'TENANT_PRESENTATION_DENIES_AUTH_WITHOUT_ACTIVE_PROFILE');
  addPass('jwtDatabase', 'tenant_presentation_denies_missing_profile', orphanPresentation.error.code ?? 'DENIED');

  const anonymousClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonymousPresentation = await anonymousClient.rpc('platform_current_actor_tenant_presentation');
  assert(denied(anonymousPresentation.error) && !anonymousPresentation.data, 'TENANT_PRESENTATION_DENIES_ANONYMOUS_CALLER');
  addPass('jwtDatabase', 'tenant_presentation_denies_missing_identity', anonymousPresentation.error.code ?? 'DENIED');

  const directTenantRead = await teacherClient.from('tenants').select('id,name,product_key').eq('id', ids.tenantA);
  assert(Boolean(directTenantRead.error) && !directTenantRead.data, 'TENANT_PRESENTATION_DOES_NOT_GRANT_DIRECT_TENANT_SELECT');
  addPass('jwtDatabase', 'teacher_cannot_select_tenants_table', directTenantRead.error.code ?? 'DENIED');

  const adminBPresentation = await requiredRpc(adminBClient, 'platform_current_actor_tenant_presentation');
  assert(Array.isArray(adminBPresentation) && adminBPresentation.length === 1
    && adminBPresentation[0].tenant_id === ids.tenantB && adminBPresentation[0].name === 'Synthetic Preschool B',
  'SECOND_TENANT_ACTOR_RESOLVES_ONLY_OWN_TENANT');
  addPass('jwtDatabase', 'second_tenant_actor_is_self_scoped');

  const courses = await requiredRpc(teacherClient, 'preschool_teacher_attendance_courses', { p_school_day: schoolDay, p_branch_id: null });
  assert(courses?.tenantId === ids.tenantA && courses?.actorId === ids.teacher && Array.isArray(courses?.courses)
    && courses.courses.length === 1 && courses.courses[0].courseId === ids.courseA
    && courses.courses[0].branchId === ids.branchA, 'REAL_JWT_SEES_ONLY_ASSIGNED_BRANCH_CLASS');
  addPass('jwtDatabase', 'teacher_course_list_is_self_and_branch_scoped');

  const ownRoster = await requiredRpc(teacherClient, 'edu_preschool_roster_identity', { p_course_id: ids.courseA, p_school_day: schoolDay });
  assert(ownRoster?.tenantId === ids.tenantA && ownRoster?.roster?.length === 1
    && ownRoster.roster[0].enrollmentId === ids.enrollmentA && ownRoster.roster[0].name === 'Synthetic Child A', 'REAL_JWT_READS_ASSIGNED_ROSTER');
  addPass('jwtDatabase', 'teacher_reads_assigned_course_roster');

  for (const [label, tenantId, courseId, enrollmentId] of [
    ['other_branch', ids.tenantA, ids.courseB, ids.enrollmentB],
    ['other_tenant', ids.tenantB, ids.courseC, ids.enrollmentC],
  ]) {
    const { data: allowed, error: accessError } = await teacherClient.rpc('edu_can_access_attendance_enrollment', {
      p_tenant_id: tenantId, p_enrollment_id: enrollmentId, p_school_day: schoolDay,
    });
    assert(!accessError && allowed === false, `REAL_JWT_DENIES_${label.toUpperCase()}_ATTENDANCE_SCOPE`);
    addPass('jwtDatabase', `teacher_db_access_denied_${label}`);
    const { data: foreignRoster, error: rosterError } = await teacherClient.rpc('edu_preschool_roster_identity', {
      p_course_id: courseId, p_school_day: schoolDay,
    });
    assert(denied(rosterError) && !foreignRoster, `REAL_JWT_ROSTER_DENIED_${label.toUpperCase()}`);
    addPass('jwtDatabase', `teacher_roster_denied_${label}`, rosterError.code ?? 'DENIED');
    const { error: writeError } = await teacherClient.rpc('edu_set_daily_attendance', {
      p_tenant_id: tenantId, p_enrollment_id: enrollmentId, p_status: 'present',
      p_roll_call_time: rollCallTime, p_school_day: schoolDay,
    });
    assert(denied(writeError), `REAL_JWT_DIRECT_WRITER_DENIES_${label.toUpperCase()}`);
    addPass('jwtDatabase', `teacher_direct_write_denied_${label}`, writeError.code ?? 'DENIED');
    const hidden = await teacherClient.from('edu_attendance_daily_state')
      .select('tenant_id,enrollment_id,school_day,status').eq('tenant_id', tenantId)
      .eq('enrollment_id', enrollmentId).eq('school_day', schoolDay);
    const hiddenStateSummary = {
      errorCode: hidden.error?.code ?? null,
      errorMessage: hidden.error?.message?.slice(0, 180) ?? null,
      rowCount: Array.isArray(hidden.data) ? hidden.data.length : null,
    };
    assert(!hidden.error && Array.isArray(hidden.data) && hidden.data.length === 0,
      `RLS_HIDES_${label.toUpperCase()}_ATTENDANCE_STATE:${JSON.stringify(hiddenStateSummary)}`);
    addPass('jwtDatabase', `attendance_state_rls_hides_${label}`);
    const hiddenMapping = await teacherClient.from('preschool_chain_enrollment_branch_assignments')
      .select('tenant_id,enrollment_id,course_id,branch_id').eq('tenant_id', tenantId).eq('enrollment_id', enrollmentId);
    assert(!hiddenMapping.error && Array.isArray(hiddenMapping.data) && hiddenMapping.data.length === 0, `RLS_HIDES_${label.toUpperCase()}_ENROLLMENT_MAPPING`);
    addPass('jwtDatabase', `enrollment_branch_rls_hides_${label}`);
  }

  const managerWrite = await teacherClient.from('party_identity_link_managers').insert({ id: randomUUID() });
  assert(Boolean(managerWrite.error) && managerWrite.error.code === '42501', 'AUTHENTICATED_CANNOT_SELF_GRANT_IDENTITY_MANAGER');
  addPass('jwtDatabase', 'caller_cannot_write_identity_manager_grants', managerWrite.error.code);

  outcome.jwtDatabase.status = 'PASS';
  const route = await startApp();
  currentPhase = 'browser-e2e';
  outcome.browserE2e.status = 'RUNNING';
  const appOrigin = route.appOrigin;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const browserConsoleErrors = [];
  const browserRequestFailures = [];
  const navigationResponses = [];
  const authResponseStatuses = [];
  const appApiResponses = [];
  page.on('pageerror', error => pageErrors.push(scrub(error.message)));
  page.on('console', message => {
    if (message.type() === 'error') browserConsoleErrors.push(scrub(message.text()).slice(0, 240));
  });
  page.on('requestfailed', request => {
    const requestUrl = new URL(request.url());
    if (requestUrl.pathname.startsWith('/_next/') || requestUrl.pathname.startsWith('/auth/v1/')) {
      browserRequestFailures.push({
        method: request.method(),
        path: requestUrl.pathname,
        error: scrub(request.failure()?.errorText ?? 'REQUEST_FAILED').slice(0, 160),
      });
    }
  });
  page.on('response', async response => {
    const responseUrl = new URL(response.url());
    if (response.request().isNavigationRequest()) {
      navigationResponses.push({
        path: responseUrl.pathname,
        status: response.status(),
        location: response.headers().location ?? null,
      });
    }
    if (responseUrl.pathname === '/auth/v1/token') {
      authResponseStatuses.push(response.status());
    }
    if (responseUrl.pathname === '/api/tenant/context' || responseUrl.pathname.startsWith('/api/education/')) {
      const entry = { path: responseUrl.pathname, status: response.status() };
      if (response.status() >= 400) {
        const body = await response.text().catch(() => 'ERROR_RESPONSE_BODY_UNAVAILABLE');
        entry.error = scrub(body).slice(0, 180);
      } else if (responseUrl.pathname === '/api/education/attendance') {
        const body = await response.json().catch(() => null);
        if (body && Array.isArray(body.roster)) {
          entry.roster = { count: body.roster.length, names: body.roster.map(row => scrub(row?.name ?? '')).slice(0, 5) };
        }
      } else if (responseUrl.pathname === '/api/education/attendance/courses') {
        const body = await response.json().catch(() => null);
        if (body && Array.isArray(body.classrooms)) {
          entry.classrooms = body.classrooms.map(row => ({ id: row?.id, name: scrub(row?.name ?? ''), students: row?.students }));
        }
      }
      appApiResponses.push(entry);
    }
  });
  await page.goto(`${appOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  const emailInput = page.locator('input[type="email"]');
  await emailInput.focus();
  try {
    await page.waitForFunction(() => {
      const input = document.querySelector('input[type="email"]');
      return input instanceof HTMLInputElement && input.style.borderColor === 'rgb(124, 58, 237)';
    }, { timeout: 20000 });
  } catch {
    throw new Error(`LOGIN_CLIENT_NOT_HYDRATED:${JSON.stringify({
      path: new URL(page.url()).pathname,
      pageErrors: pageErrors.slice(-5),
      consoleErrors: browserConsoleErrors.slice(-5),
      failedRequests: browserRequestFailures.slice(-8),
    })}`);
  }
  await emailInput.fill(emails.teacher);
  await page.locator('input[type="password"]').fill(passwords.teacher);
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();
  try {
    // The generic dashboard is an intermediate route: its client bootstrap
    // redirects Preschool tenants to /dashboard/education. Wait for that
    // destination before navigating so the pending root redirect cannot race
    // and replace the attendance route.
    await page.waitForURL(url => url.pathname === '/dashboard/education', { timeout: 45000 });
    await page.waitForLoadState('load', { timeout: 45000 });
    await page.getByRole('heading', { name: 'Chào mừng bạn trở lại!' }).waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    const loginError = await page.locator('div[style*="254, 242, 242"]').allTextContents().catch(() => []);
    const visibleText = await page.locator('body').innerText().catch(() => 'BODY_TEXT_UNAVAILABLE');
    throw new Error(`TEACHER_LOGIN_REDIRECT_FAILED:${JSON.stringify({
      path: new URL(page.url()).pathname,
      authResponseStatuses,
      loginError: loginError.map(value => scrub(value).slice(0, 180)).slice(0, 3),
      visibleText: scrub(visibleText).slice(0, 1000),
      pageErrors: pageErrors.slice(-5),
      consoleErrors: browserConsoleErrors.slice(-5),
      failedRequests: browserRequestFailures.slice(-8),
    })}`);
  }
  addPass('browserE2e', 'teacher_signs_in_through_real_supabase_auth');

  const attendanceNavigation = await page.goto(`${appOrigin}/dashboard/education/attendance`, { waitUntil: 'load' });
  if (new URL(page.url()).pathname !== '/dashboard/education/attendance') {
    throw new Error(`ATTENDANCE_ROUTE_REDIRECTED:${JSON.stringify({
      path: new URL(page.url()).pathname,
      navigationStatus: attendanceNavigation?.status() ?? null,
      navigationResponses: navigationResponses.slice(-8),
      pageErrors: pageErrors.slice(-5),
      consoleErrors: browserConsoleErrors.slice(-5),
    })}`);
  }
  try {
    await page.getByText('Synthetic Assigned Class', { exact: true }).waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    const bodyText = await page.locator('body').innerText().catch(() => 'BODY_TEXT_UNAVAILABLE');
    throw new Error(`ATTENDANCE_ASSIGNED_CLASS_NOT_VISIBLE:${JSON.stringify({
      path: new URL(page.url()).pathname,
      apiResponses: appApiResponses.slice(-12),
      navigationResponses: navigationResponses.slice(-8),
      pageErrors: pageErrors.slice(-5),
      consoleErrors: browserConsoleErrors.slice(-5),
      failedRequests: browserRequestFailures.slice(-8),
      visibleText: scrub(bodyText).slice(0, 1000),
    })}`);
  }
  const childRowBeforeWrite = page.getByRole('row').filter({ hasText: 'Synthetic Child A' });
  try {
    await childRowBeforeWrite.waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    const bodyText = await page.locator('body').innerText().catch(() => 'BODY_TEXT_UNAVAILABLE');
    throw new Error(`ATTENDANCE_ASSIGNED_CHILD_NOT_VISIBLE:${JSON.stringify({
      path: new URL(page.url()).pathname,
      apiResponses: appApiResponses.slice(-12),
      visibleText: scrub(bodyText).slice(0, 1000),
      pageErrors: pageErrors.slice(-5),
      consoleErrors: browserConsoleErrors.slice(-5),
    })}`);
  }
  assert(await page.getByText('Synthetic Child B', { exact: true }).count() === 0
    && await page.getByText('Synthetic Child C', { exact: true }).count() === 0, 'BROWSER_ONLY_SHOWS_ASSIGNED_CLASS_CHILD');
  addPass('browserE2e', 'teacher_sees_only_assigned_course_and_child');

  const apiClasses = await page.evaluate(async date => {
    const response = await fetch(`/api/education/attendance/courses?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
    const body = await response.json();
    return { status: response.status, body };
  }, schoolDay);
  assert(apiClasses.status === 200 && apiClasses.body?.success === true
    && apiClasses.body.classrooms?.length === 1 && apiClasses.body.classrooms[0].id === ids.courseA,
  'BROWSER_API_LISTS_ONLY_ASSIGNED_CLASS');
  addPass('browserE2e', 'attendance_courses_api_returns_assigned_class_only');

  for (const [label, courseId, enrollmentId] of [
    ['other_branch', ids.courseB, ids.enrollmentB],
    ['other_tenant', ids.courseC, ids.enrollmentC],
  ]) {
    const foreignRoster = await page.evaluate(async input => {
      const response = await fetch(`/api/education/attendance?courseId=${encodeURIComponent(input.courseId)}&date=${encodeURIComponent(input.date)}`, { cache: 'no-store' });
      return { status: response.status, body: await response.json() };
    }, { courseId, date: schoolDay });
    assert(foreignRoster.status === 403, `BROWSER_API_DENIES_${label.toUpperCase()}_COURSE`);
    addPass('browserE2e', `attendance_api_denies_${label}_course`, String(foreignRoster.status));
    const before = await pgClient.query(`SELECT
      (SELECT count(*)::int FROM public.edu_attendance WHERE tenant_id=$1 AND enrollment_id=$2) AS events,
      (SELECT count(*)::int FROM public.edu_attendance_daily_state WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3) AS states`,
    [label === 'other_tenant' ? ids.tenantB : ids.tenantA, enrollmentId, schoolDay]);
    const posted = await page.evaluate(async input => {
      const response = await fetch('/api/education/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId: input.enrollmentId, status: 'present', date: input.date }),
      });
      return { status: response.status, body: await response.json() };
    }, { enrollmentId, date: schoolDay });
    assert(posted.status === 403, `BROWSER_API_DENIES_${label.toUpperCase()}_WRITE`);
    const after = await pgClient.query(`SELECT
      (SELECT count(*)::int FROM public.edu_attendance WHERE tenant_id=$1 AND enrollment_id=$2) AS events,
      (SELECT count(*)::int FROM public.edu_attendance_daily_state WHERE tenant_id=$1 AND enrollment_id=$2 AND school_day=$3) AS states`,
    [label === 'other_tenant' ? ids.tenantB : ids.tenantA, enrollmentId, schoolDay]);
    assert(before.rows[0].events === after.rows[0].events && before.rows[0].states === after.rows[0].states,
      `BROWSER_DENIED_${label.toUpperCase()}_WRITE_HAS_NO_PARTIAL_STATE`);
    addPass('browserE2e', `attendance_api_denies_${label}_write_without_partial_state`, String(posted.status));
  }

  const present = page.getByRole('button', { name: 'Có mặt — Synthetic Child A' });
  await present.waitFor({ state: 'visible', timeout: 30000 });
  await present.click();
  await page.getByRole('status').filter({ hasText: 'Đã ghi nhận điểm danh.' }).waitFor({ state: 'visible', timeout: 30000 });
  const saved = await pgClient.query(`SELECT s.status,e.status AS event_status FROM public.edu_attendance_daily_state s
    JOIN public.edu_attendance e ON e.tenant_id=s.tenant_id AND e.enrollment_id=s.enrollment_id
      AND e.roll_call_time::date = s.school_day
    WHERE s.tenant_id=$1 AND s.enrollment_id=$2 AND s.school_day=$3 ORDER BY e.created_at DESC LIMIT 1`,
  [ids.tenantA, ids.enrollmentA, schoolDay]);
  assert(saved.rows.length === 1 && saved.rows[0].status === 'present' && saved.rows[0].event_status === 'present',
    'BROWSER_WRITE_READS_BACK_FROM_DATABASE');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const childRow = page.getByRole('row').filter({ hasText: 'Synthetic Child A' });
  await childRow.getByRole('cell', { name: 'Có mặt', exact: true }).waitFor({ state: 'visible', timeout: 45000 });
  addPass('browserE2e', 'teacher_marks_present_and_state_persists_after_reload');
  assert(pageErrors.length === 0, 'BROWSER_HAS_NO_UNHANDLED_PAGE_ERRORS');
  addPass('browserE2e', 'browser_page_has_no_unhandled_errors');

  const adminRevoke = await adminAClient.rpc('party_revoke_auth_link', {
    p_link_id: ids.authLink, p_reason: 'Synthetic E2E revocation to verify immediate denial.',
  });
  assert(!adminRevoke.error && adminRevoke.data?.revokedAt, 'ADMIN_REVOKES_AUTH_PARTY_LINK_VIA_PUBLIC_CONTRACT');
  const resolvedAfterRevoke = await teacherClient.rpc('party_resolve_current_auth_link');
  assert(!resolvedAfterRevoke.error && resolvedAfterRevoke.data === null, 'REVOKED_IDENTITY_LINK_NO_LONGER_RESOLVES');
  const revokedApi = await page.evaluate(async date => {
    const response = await fetch(`/api/education/attendance/courses?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  }, schoolDay);
  assert(revokedApi.status === 403, 'BROWSER_API_DENIES_REVOKED_TEACHER_IDENTITY');
  addPass('browserE2e', 'revoked_auth_party_link_denies_following_teacher_request');
  outcome.browserE2e.status = 'PASS';
  outcome.jwtDatabase.status = 'PASS';
  outcome.fixture.cleanup = 'CONTAINED_IN_DISPOSABLE_PROFILE';
}

try {
  await main();
} catch (error) {
  failure = { phase: currentPhase, code: scrub(error?.message ?? 'UNKNOWN_FAILURE').slice(0, 1500) };
  if (currentPhase === 'jwt-database-acceptance' && outcome.jwtDatabase.status === 'RUNNING') outcome.jwtDatabase.status = 'FAIL';
  if (currentPhase === 'browser-e2e' && outcome.browserE2e.status === 'RUNNING') outcome.browserE2e.status = 'FAIL';
  process.stderr.write(`PRESCHOOL_PROFILE_ACCEPTANCE_FAIL phase=${failure.phase} reason=${failure.code}\n`);
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await stopApp().catch(() => undefined);
  if (pgClient) await pgClient.end().catch(() => undefined);
  const safeAppOutput = scrub(appOutput);
  if (safeAppOutput.trim()) await writeFile(path.join(runDirectory, 'next-dev.redacted.log'), safeAppOutput, 'utf8');
  outcome.error = failure;
  outcome.completedAt = new Date().toISOString();
  await writeFile(acceptancePath, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8');
  const latestReceipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  latestReceipt.realJwt = outcome.jwtDatabase.status;
  latestReceipt.browserE2e = outcome.browserE2e.status;
  latestReceipt.acceptanceReceipt = 'acceptance-receipt.json';
  latestReceipt.completedAt = outcome.completedAt;
  await writeFile(receiptPath, `${JSON.stringify(latestReceipt, null, 2)}\n`, 'utf8');
}

if (failure) process.exitCode = 1;
else process.stdout.write(`PRESCHOOL_PROFILE_JWT_AND_BROWSER_E2E_PASS ${targetCommit}\n`);
