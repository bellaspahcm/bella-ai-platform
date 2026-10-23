/**
 * Opt-in isolated owner verification. Default execution does not contact or write
 * any DB. Existing diagnostic rows are retained and checked against their snapshot.
 * Only explicit race commit creates one course/enrollment; no cleanup/history delete.
 * Run commit/retry in separate Jest processes for process-restart evidence.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { accessSync, constants, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, relative } from 'node:path';
import type { Database } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import { EnrollmentContractImpl } from '../contracts/enrollment.contract.impl';
import { EnrollmentRecoveryContractImpl } from '../contracts/enrollment-recovery.contract.impl';
import { EducationEnrollmentRecoveryConflictError, type RecoverEducationEnrollmentInput } from '../contracts/enrollment-recovery.contract';

jest.mock('@/platform/host/event-bus', () => ({ eventBus: { publish: jest.fn(), subscribe: jest.fn() } }));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => { throw new Error('Owner recovery tests require an explicit isolated client'); },
}));

interface Scenario extends RecoverEducationEnrollmentInput { originalEnrollmentId: string }
interface Fixture {
  tenantId: string;
  actorId: string;
  capacity: Scenario;
  credits: Scenario;
  archived: Scenario;
  beforeRetry: Database['public']['Tables']['edu_enrollments']['Row'][];
}
interface RaceState extends Scenario {
  commitProcessId: number;
  persistedRow: Database['public']['Tables']['edu_enrollments']['Row'];
}

// These are controlled local proof artifacts, not a runtime or remote data parser.
function fixture(): Fixture {
  return JSON.parse(readFileSync(process.env.EDUCATION_RECOVERY_FIXTURE_PATH ??
    'implementation-artifacts/preschool-full-chain/ENROLLMENT_RECOVERY_REAL_DB.json', 'utf8')) as Fixture;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing isolated recovery test variable: ${name}`);
  return value;
}

function localClient(key: string, token?: string): SupabaseClient<Database> {
  const url = requiredEnv('EDUCATION_RECOVERY_SUPABASE_URL');
  if (url !== 'http://127.0.0.1:55421') throw new Error('REFUSE_NON_ISOLATED_RECOVERY_TARGET');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

function assertNoDbError(error: { message: string } | null): void {
  if (error) throw new Error(`Isolated recovery observer failed: ${error.message}`);
}

function raceStatePath(): string {
  const root = resolve('.audit-local-cache');
  const path = resolve(requiredEnv('EDUCATION_RECOVERY_RACE_STATE_PATH'));
  const suffix = relative(root, path);
  if (!suffix || suffix.startsWith('..') || resolve(root, suffix) !== path) {
    throw new Error('Race evidence must remain within .audit-local-cache');
  }
  const parent = realpathSync(dirname(path));
  const parentSuffix = relative(realpathSync(root), parent);
  if (parentSuffix.startsWith('..') || isAbsolute(parentSuffix)) {
    throw new Error('Race evidence parent must remain within .audit-local-cache');
  }
  accessSync(parent, constants.W_OK);
  const targetEntry = lstatSync(path, { throwIfNoEntry: false });
  if (targetEntry) {
    if (!targetEntry.isFile()) throw new Error('Race evidence must be a regular file');
    accessSync(path, constants.W_OK);
  }
  return path;
}

const realDb = process.env.EDUCATION_RECOVERY_REAL_DB === '1' ? describe : describe.skip;
realDb('Education request recovery — actual isolated DB owner capability', () => {
  let db: SupabaseClient<Database>;
  let recovery: EnrollmentRecoveryContractImpl;
  let expected: Fixture;
  let originalRows: Database['public']['Tables']['edu_enrollments']['Row'][];

  beforeAll(async () => {
    db = localClient(requiredEnv('EDUCATION_RECOVERY_SERVICE_ROLE_KEY'));
    recovery = new EnrollmentRecoveryContractImpl(db);
    expected = fixture();
    const { data, error } = await db.from('edu_enrollments').select('*')
      .eq('tenant_id', expected.tenantId).in('id', expected.beforeRetry.map(row => row.id)).order('id');
    assertNoDbError(error);
    expect(data).toEqual(expected.beforeRetry);
    originalRows = data ?? [];
  });

  afterAll(async () => {
    if (!db || !expected || !originalRows) return;
    const { data, error } = await db.from('edu_enrollments').select('*')
      .eq('tenant_id', expected.tenantId).in('id', originalRows.map(row => row.id)).order('id');
    assertNoDbError(error);
    expect(data).toEqual(originalRows);
  });

  it.each(['capacity', 'credits', 'archived'] as const)(
    'recovers canonical %s result after original lost acknowledgement and process exit',
    async scenarioName => {
      const scenario = expected[scenarioName];
      const result = await recovery.getEnrollmentByRequest(scenario);
      expect(result).toMatchObject({
        id: scenario.originalEnrollmentId,
        tenantId: scenario.tenantId,
        studentPartyId: scenario.studentPartyId,
        courseId: scenario.courseId,
        status: 'active',
      });
      const { data, error } = await db.from('edu_enrollments').select('*')
        .eq('tenant_id', scenario.tenantId).eq('request_id', scenario.requestId);
      assertNoDbError(error);
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toBe(scenario.originalEnrollmentId);
      expect(jest.mocked(eventBus.publish)).not.toHaveBeenCalled();
    }
  );

  it('recovers despite current credit eligibility and archived course command denial', async () => {
    const command = new EnrollmentContractImpl(db);
    await expect(command.enrollStudent(expected.credits)).rejects.toThrow('Platform credit limit exceeded');
    await expect(command.enrollStudent(expected.archived)).rejects.toThrow('expected active');
    expect((await recovery.getEnrollmentByRequest(expected.credits))?.id).toBe(expected.credits.originalEnrollmentId);
    expect((await recovery.getEnrollmentByRequest(expected.archived))?.id).toBe(expected.archived.originalEnrollmentId);
  });

  it('recovers uppercase UUID variants through the real UUID columns without changing the request key', async () => {
    const scenario = expected.capacity;
    const result = await recovery.getEnrollmentByRequest({
      ...scenario,
      tenantId: scenario.tenantId.toUpperCase(),
      studentPartyId: scenario.studentPartyId.toUpperCase(),
      courseId: scenario.courseId.toUpperCase(),
    });
    expect(result).toMatchObject({
      id: scenario.originalEnrollmentId, tenantId: scenario.tenantId,
      studentPartyId: scenario.studentPartyId, courseId: scenario.courseId,
    });
  });

  it('serves concurrent owner reads without adding rows or emitting events', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      new EnrollmentRecoveryContractImpl(db).getEnrollmentByRequest(expected.capacity)));
    expect(results.map(result => result?.id)).toEqual(Array(8).fill(expected.capacity.originalEnrollmentId));
    expect(jest.mocked(eventBus.publish)).not.toHaveBeenCalled();
  });

  it('keeps a foreign tenant request absent without leaking or globally searching', async () => {
    await expect(recovery.getEnrollmentByRequest({ ...expected.capacity, tenantId: randomUUID() })).resolves.toBeNull();
  });

  it.each(['studentPartyId', 'courseId'] as const)('returns conflict for a different expected %s', async field => {
    const result = recovery.getEnrollmentByRequest({ ...expected.capacity, [field]: randomUUID() });
    await expect(result).rejects.toBeInstanceOf(EducationEnrollmentRecoveryConflictError);
    await expect(result).rejects.toMatchObject({ code: 'EDUCATION_ENROLLMENT_RECOVERY_CONFLICT' });
  });

  it('preserves actual anonymous SELECT denial instead of treating it as absence', async () => {
    const anon = localClient(requiredEnv('EDUCATION_RECOVERY_ANON_KEY'));
    await expect(new EnrollmentRecoveryContractImpl(anon).getEnrollmentByRequest(expected.capacity))
      .rejects.toMatchObject({ code: '42501' });
  });

  it('preserves actual signed-in SELECT denial without adding grants or using a service key', async () => {
    const token = requiredEnv('EDUCATION_RECOVERY_SIGNED_IN_TOKEN');
    const signedIn = localClient(requiredEnv('EDUCATION_RECOVERY_ANON_KEY'), token);
    const { data, error } = await signedIn.auth.getUser(token);
    assertNoDbError(error);
    expect(data.user?.id).toBe(expected.actorId);
    await expect(new EnrollmentRecoveryContractImpl(signedIn).getEnrollmentByRequest(expected.capacity))
      .rejects.toMatchObject({ code: '42501' });
  });

  const commit = process.env.EDUCATION_RECOVERY_RACE_PHASE === 'commit' ? it : it.skip;
  commit('reconciles recovery-null → simultaneous command commit/lost acknowledgement → command failure', async () => {
    const statePath = raceStatePath();
    const context = {
      tenantId: expected.tenantId,
      studentPartyId: expected.capacity.studentPartyId,
      courseId: randomUUID(),
      requestId: randomUUID(),
    };
    const { error: courseError } = await db.from('edu_courses').insert({
      id: context.courseId, tenant_id: context.tenantId,
      course_code: `RECOVERY-RACE-${randomUUID()}`, title: 'Controlled recovery race fixture',
      status: 'active', max_students: 1, current_enrollment: 0, prerequisite_course_codes: [],
    });
    assertNoDbError(courseError);
    await expect(recovery.getEnrollmentByRequest(context)).resolves.toBeNull();

    // Actual existing command/RPC/unique/lock path; only post-COMMIT event is fault injected.
    const fault = 'Controlled owner recovery post-COMMIT acknowledgement loss';
    jest.mocked(eventBus.publish).mockRejectedValueOnce(new Error(fault));
    const command = new EnrollmentContractImpl(db);
    const results = await Promise.allSettled([command.enrollStudent(context), command.enrollStudent(context)]);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    if (rejected?.status !== 'rejected') throw new Error('Expected controlled lost acknowledgement');
    expect(String(rejected.reason)).toContain(fault);

    const { data: rows, error } = await db.from('edu_enrollments').select('*')
      .eq('tenant_id', context.tenantId).eq('request_id', context.requestId);
    assertNoDbError(error);
    expect(rows).toHaveLength(1);
    const persisted = rows?.[0];
    if (!persisted) throw new Error('Actual race enrollment missing');
    expect(persisted.student_party_id).toBe(context.studentPartyId);
    expect(persisted.course_id).toBe(context.courseId);
    const successful = results.find(result => result.status === 'fulfilled');
    if (successful?.status !== 'fulfilled') throw new Error('Expected duplicate command result');
    expect(successful.value.id).toBe(persisted.id);

    const { error: archiveError } = await db.from('edu_courses').update({ status: 'archived' })
      .eq('tenant_id', context.tenantId).eq('id', context.courseId);
    assertNoDbError(archiveError);
    await expect(command.enrollStudent(context)).rejects.toThrow('expected active');
    expect((await recovery.getEnrollmentByRequest(context))?.id).toBe(persisted.id);
    const state: RaceState = { ...context, originalEnrollmentId: persisted.id,
      commitProcessId: process.pid, persistedRow: persisted };
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  });

  const retry = process.env.EDUCATION_RECOVERY_RACE_PHASE === 'retry' ? it : it.skip;
  retry('recovers the same raced canonical result in a different process with no further writes', async () => {
    const state = JSON.parse(readFileSync(raceStatePath(), 'utf8')) as RaceState;
    expect(process.pid).not.toBe(state.commitProcessId);
    expect(state.tenantId).toBe(expected.tenantId);
    await expect(new EnrollmentContractImpl(db).enrollStudent(state)).rejects.toThrow('expected active');
    const results = await Promise.all([recovery.getEnrollmentByRequest(state), recovery.getEnrollmentByRequest(state)]);
    expect(results.map(result => result?.id)).toEqual([state.originalEnrollmentId, state.originalEnrollmentId]);
    const { data: rows, error } = await db.from('edu_enrollments').select('*')
      .eq('tenant_id', state.tenantId).eq('request_id', state.requestId);
    assertNoDbError(error);
    expect(rows).toEqual([state.persistedRow]);
    const { data: course, error: courseError } = await db.from('edu_courses').select('current_enrollment,status')
      .eq('tenant_id', state.tenantId).eq('id', state.courseId).single();
    assertNoDbError(courseError);
    expect(course).toEqual({ current_enrollment: 1, status: 'archived' });
    expect(jest.mocked(eventBus.publish)).not.toHaveBeenCalled();
  });
});
