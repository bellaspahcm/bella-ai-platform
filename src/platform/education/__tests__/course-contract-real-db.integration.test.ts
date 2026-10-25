/**
 * Academic Course contract proof on an attested, owned disposable T1/C local
 * Supabase API with process-local service/public credentials.
 * No mocks, skips, migration replay or grants. Service fixtures prove persistence;
 * the separate provider-Auth section must fail if legitimate ACL/RLS is missing.
 * Expected initial active state/prerequisite codes come from COURSE_SPEC.approved.md.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Database } from '@/types/database.types';
import { CourseContractImpl } from '../contracts/course.contract.impl';

const FIXTURE_SOURCE_REVISION = '54e599048ebc315416e7a82e85f0af33dc25583d';

function readDisposableFixtureAuthority(apiUrl: string) {
  const manifestPath = process.env.BELLA_DISPOSABLE_FIXTURE_MANIFEST;
  const receiptDirectory = process.env.BELLA_FIXTURE_RECEIPT_DIR;
  if (!manifestPath || !path.isAbsolute(manifestPath) || !receiptDirectory || !path.isAbsolute(receiptDirectory)) {
    throw new Error('DISPOSABLE_FIXTURE_MANIFEST_AND_RECEIPT_DIRECTORY_REQUIRED');
  }
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest: unknown = JSON.parse(manifestBytes.toString('utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('INVALID_DISPOSABLE_FIXTURE_MANIFEST');
  const field = (name: string): unknown => Reflect.get(manifest, name);
  const approved = field('scope') === 'T1'
    ? { project: 'bella-preschool-t1-20261022', apiOrigin: 'http://127.0.0.1:24631', databasePort: 24632 }
    : field('scope') === 'C'
      ? { project: 'bella-preschool-course-20261022', apiOrigin: 'http://127.0.0.1:24531', databasePort: 24532 }
      : undefined;
  const target = new URL(apiUrl);
  const containerId = field('containerId');
  const markerPath = field('markerPath');
  const markerSha256 = field('markerSha256');
  const expiresAt = field('expiresAt');
  if (!approved || field('project') !== approved.project || field('apiOrigin') !== approved.apiOrigin ||
      field('databasePort') !== approved.databasePort || field('sourceRevision') !== FIXTURE_SOURCE_REVISION ||
      target.origin !== approved.apiOrigin || target.pathname !== '/' || target.search || target.hash || target.username || target.password ||
      typeof containerId !== 'string' || !/^[a-f0-9]{12,64}$/.test(containerId) ||
      typeof markerPath !== 'string' || !path.isAbsolute(markerPath) ||
      typeof markerSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(markerSha256) ||
      typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    throw new Error('APPROVED_UNEXPIRED_DISPOSABLE_FIXTURE_TARGET_REQUIRED');
  }
  if (field('projectId') !== undefined && field('projectId') !== approved.project) throw new Error('FIXTURE_PROJECT_ID_MISMATCH');
  const resolvedMarker = fs.realpathSync(markerPath);
  if (!fs.statSync(resolvedMarker).isFile()) throw new Error('DISPOSABLE_FIXTURE_MARKER_FILE_REQUIRED');
  const markerBytes = fs.readFileSync(resolvedMarker);
  if (createHash('sha256').update(markerBytes).digest('hex') !== markerSha256) throw new Error('DISPOSABLE_FIXTURE_MARKER_HASH_MISMATCH');
  const markerText = markerBytes.toString('utf8');
  if (markerText.trimStart().startsWith('{')) {
    const marker: unknown = JSON.parse(markerText);
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) throw new Error('INVALID_DISPOSABLE_FIXTURE_MARKER');
    for (const key of ['projectId', 'project', 'project_id']) {
      if (Reflect.get(marker, key) !== undefined && Reflect.get(marker, key) !== approved.project) throw new Error('FIXTURE_MARKER_PROJECT_MISMATCH');
    }
    for (const key of ['containerId', 'container']) {
      if (Reflect.get(marker, key) !== undefined && Reflect.get(marker, key) !== containerId) throw new Error('FIXTURE_MARKER_CONTAINER_MISMATCH');
    }
  } else {
    const projectId = markerText.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1];
    if (projectId !== undefined && projectId !== approved.project) throw new Error('FIXTURE_MARKER_PROJECT_MISMATCH');
  }
  const resolvedReceipts = fs.realpathSync(receiptDirectory);
  const within = (root: string) => {
    const relative = path.relative(root, resolvedReceipts);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  };
  if (!fs.statSync(resolvedReceipts).isDirectory() ||
      (!within(path.dirname(resolvedMarker)) && !within(path.resolve(process.cwd(), 'docs/audits/preschool-full-audit-20261020')))) {
    throw new Error('OWNED_LOCAL_FIXTURE_RECEIPT_DIRECTORY_REQUIRED');
  }
  return { ...approved, scope: field('scope'), containerId, markerSha256, receiptDirectory: resolvedReceipts,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex') };
}

jest.setTimeout(30000);

describe('Academic Course contract — approved local Real DB', () => {
  let fixture: SupabaseClient<Database> | undefined;
  let observer: SupabaseClient<Database>;
  let contract: CourseContractImpl;
  let apiUrl: string;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const fixtureTenantIds = [tenantA, tenantB];
  const ownedAuthUsers: string[] = [];
  const plannedAuthUserIds: string[] = [];
  const plannedProfiles: { id: string; tenantId: string }[] = [];
  const createdTenantIds: string[] = [];
  const createdProfileIds: string[] = [];
  const runId = randomUUID();
  let authority: ReturnType<typeof readDisposableFixtureAuthority> | undefined;
  let receiptPath: string | undefined;
  let lifecycle = 'PLANNED';
  const quarantineOperations: { operation: string; outcome: string }[] = [];
  let authorityReadback = 'NOT_RUN';

  function requireAuthority() {
    const current = readDisposableFixtureAuthority(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (authority && (current.manifestSha256 !== authority.manifestSha256 || current.receiptDirectory !== authority.receiptDirectory)) {
      throw new Error('DISPOSABLE_FIXTURE_AUTHORITY_DRIFT');
    }
    return current;
  }

  const attestedFetch: typeof fetch = (input, init) => {
    requireAuthority();
    return fetch(input, init);
  };

  function writeReceipt(initial = false) {
    if (!authority || !receiptPath) throw new Error('DISPOSABLE_FIXTURE_RECEIPT_NOT_INITIALIZED');
    fs.writeFileSync(receiptPath, JSON.stringify({ runId, suite: 'course-contract-real-db', sourceRevision: FIXTURE_SOURCE_REVISION,
      target: authority, lifecycle, plannedTenantIds: fixtureTenantIds, createdTenantIds, createdProfileIds,
      plannedProfileIds: plannedProfiles.map(profile => profile.id), plannedProfiles,
      plannedAuthUserIds, authUserIds: ownedAuthUsers, quarantineOperations, authorityReadback,
      retainedData: 'PROVIDER_AUTH_AND_ALL_SYNTHETIC_ROWS_AND_IMMUTABLE_HISTORY_RETAINED',
      disposal: 'NOT_PERFORMED_REQUIRES_ROOT_OWNED_STACK_DISPOSAL' }, null, 2), { flag: initial ? 'wx' : 'w' });
  }

  function requireFixture(): SupabaseClient<Database> {
    requireAuthority();
    if (!fixture) throw new Error('COURSE_LOCAL_FIXTURE_UNAVAILABLE');
    return fixture;
  }

  async function independentLegacyCount(): Promise<number> {
    const result = await observer.from('courses').select('*', { count: 'exact', head: true }).in('tenant_id', fixtureTenantIds);
    if (result.error || result.count === null) throw new Error('COURSE_LEGACY_READBACK_UNAVAILABLE');
    return result.count;
  }

  async function independentCanonicalCount(tenantId: string): Promise<number> {
    const result = await observer.from('edu_courses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    if (result.error || result.count === null) throw new Error('COURSE_CANONICAL_READBACK_UNAVAILABLE');
    return result.count;
  }

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey || serviceKey === 'mock-service-role-key') throw new Error('COURSE_REAL_LOCAL_CREDENTIALS_REQUIRED');
    authority = requireAuthority();
    receiptPath = path.join(authority.receiptDirectory, `course-contract-real-db-${runId}.json`);
    writeReceipt(true);
    apiUrl = authority.apiOrigin;
    const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: attestedFetch } };
    fixture = createClient<Database>(apiUrl, serviceKey, options);
    // Independent instance; expected values never come from repository mapping.
    observer = createClient<Database>(apiUrl, serviceKey, options);
    contract = new CourseContractImpl(fixture);
    const tenants = await requireFixture().from('tenants').insert([
      { id: tenantA, name: 'Synthetic academic contract A', status: 'active', product_key: 'bella_preschool' },
      { id: tenantB, name: 'Synthetic academic contract B', status: 'active', product_key: 'bella_preschool' },
    ]);
    if (tenants.error) throw new Error(`COURSE_TENANT_FIXTURE_CREATE_FAILED:${tenants.error.code}`);
    createdTenantIds.push(...fixtureTenantIds);
    lifecycle = 'ACTIVE';
    writeReceipt();
    expect(await independentLegacyCount()).toBe(0);
  });

  beforeEach(() => { requireAuthority(); });

  afterAll(async () => {
    if (!fixture || !receiptPath) return;
    const failures: string[] = [];
    const recordFailure = (operation: string, error: unknown) => {
      const reason = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
      failures.push(`${operation}:${reason}`);
      quarantineOperations.push({ operation, outcome: reason });
    };
    try {
      // Reconcile every planned identity, including writes with a lost response.
      for (const profile of plannedProfiles) {
        const operation = `profile:${profile.id}`;
        try {
          const existing = await requireFixture().from('users').select('id, tenant_id, status').eq('id', profile.id).maybeSingle();
          if (existing.error) throw new Error(`COURSE_PROFILE_RECONCILIATION_FAILED:${existing.error.code}`);
          if (existing.data) {
            if (existing.data.tenant_id !== profile.tenantId) throw new Error('COURSE_PROFILE_AUTHORITY_MISMATCH');
            const result = await requireFixture().from('users').update({ status: 'inactive' })
              .eq('id', profile.id).eq('tenant_id', profile.tenantId);
            if (result.error) throw new Error(`COURSE_PROFILE_QUARANTINE_FAILED:${result.error.code}`);
          }
          quarantineOperations.push({ operation, outcome: 'RECONCILED_PENDING_FRESH_READBACK' });
        } catch (error) {
          recordFailure(operation, error);
        }
      }
      for (const tenantId of fixtureTenantIds) {
        const operation = `tenant:${tenantId}`;
        try {
          const existing = await requireFixture().from('tenants').select('id, status').eq('id', tenantId).maybeSingle();
          if (existing.error) throw new Error(`COURSE_TENANT_RECONCILIATION_FAILED:${existing.error.code}`);
          if (existing.data) {
            const result = await requireFixture().from('tenants').update({ status: 'terminated' }).eq('id', tenantId);
            if (result.error) throw new Error(`COURSE_TENANT_QUARANTINE_FAILED:${result.error.code}`);
          }
          quarantineOperations.push({ operation, outcome: 'RECONCILED_PENDING_FRESH_READBACK' });
        } catch (error) {
          recordFailure(operation, error);
        }
      }
      try {
        const legacy = await independentLegacyCount();
        if (legacy !== 0) failures.push('COURSE_UNEXPECTED_LEGACY_WRITE_REQUIRES_OWNER_RECOVERY');
      } catch (error) {
        recordFailure('legacy-readback', error);
      }
    } finally {
      let readbackFailed = false;
      for (const profile of plannedProfiles) {
        const operation = `profile-readback:${profile.id}`;
        try {
          const current = await requireFixture().from('users').select('id, tenant_id, status').eq('id', profile.id).maybeSingle();
          if (current.error) throw new Error(`COURSE_PROFILE_FRESH_READBACK_FAILED:${current.error.code}`);
          if (current.data && (current.data.tenant_id !== profile.tenantId || current.data.status !== 'inactive')) {
            throw new Error('COURSE_PROFILE_FRESH_READBACK_UNSAFE_AUTHORITY');
          }
          quarantineOperations.push({ operation, outcome: current.data ? 'INACTIVE' : 'ABSENT' });
        } catch (error) {
          readbackFailed = true;
          recordFailure(operation, error);
        }
      }
      for (const tenantId of fixtureTenantIds) {
        const operation = `tenant-readback:${tenantId}`;
        try {
          const current = await requireFixture().from('tenants').select('id, status').eq('id', tenantId).maybeSingle();
          if (current.error) throw new Error(`COURSE_TENANT_FRESH_READBACK_FAILED:${current.error.code}`);
          if (current.data && current.data.status !== 'terminated') throw new Error('COURSE_TENANT_FRESH_READBACK_UNSAFE_AUTHORITY');
          quarantineOperations.push({ operation, outcome: current.data ? 'TERMINATED' : 'ABSENT' });
        } catch (error) {
          readbackFailed = true;
          recordFailure(operation, error);
        }
      }
      authorityReadback = readbackFailed ? 'FAILED' : 'NO_ACTIVE_TRACKED_AUTHORITY';
      lifecycle = failures.length ? 'QUARANTINE_FAILED' : 'QUARANTINED_REQUIRES_OWNED_STACK_DISPOSAL';
      writeReceipt();
    }
    if (failures.length) throw new Error(failures.join(';'));
  });

  describe('service fixture technical persistence — does not prove caller RLS', () => {
    it('lists every catalog item beyond the API row cap without duplicates or tenant leakage', async () => {
      const before = await independentCanonicalCount(tenantA);
      const ids = Array.from({ length: 1005 }, () => randomUUID());
      for (let offset = 0; offset < ids.length; offset += 200) {
        const batch = ids.slice(offset, offset + 200).map(id => ({ id, tenant_id: tenantA,
          course_code: 'PAGE-' + id, title: 'Synthetic paginated catalog', status: 'active' }));
        const result = await requireFixture().from('edu_courses').insert(batch);
        if (result.error) throw new Error('COURSE_PAGE_FIXTURE_FAILED:' + result.error.code);
      }
      const listed = await contract.listCourses(tenantA);
      expect(listed).toHaveLength(before + ids.length);
      expect(new Set(listed.map(row => row.id)).size).toBe(listed.length);
      expect(ids.every(id => listed.some(row => row.id === id))).toBe(true);
      expect(listed.every(row => row.tenantId === tenantA)).toBe(true);
      expect(await independentCanonicalCount(tenantB)).toBe(0);
    });

    it('normalizes direct persisted catalog rows identically for get and list', async () => {
      const id = randomUUID();
      const inserted = await requireFixture().from('edu_courses').insert({ id, tenant_id: tenantA,
        course_code: ' mixed-' + id + ' ', title: '  Synthetic mixed catalog title  ', status: 'active' });
      if (inserted.error) throw new Error('COURSE_DTO_FIXTURE_FAILED:' + inserted.error.code);
      const direct = await contract.getCourse(tenantA, id);
      const listed = (await contract.listCourses(tenantA)).find(row => row.id === id);
      expect(direct?.courseCode).toBe('MIXED-' + id.toUpperCase());
      expect(direct?.title).toBe('Synthetic mixed catalog title');
      expect(listed).toEqual(direct);
    });

    it('rejects whitespace-only Course code or title before persisting any catalog row', async () => {
      const before = await independentCanonicalCount(tenantA);
      await expect(contract.createCourse({ tenantId: tenantA, courseCode: '   ', title: 'Synthetic valid title' })).rejects.toThrow();
      await expect(contract.createCourse({ tenantId: tenantA, courseCode: `BLANK-${randomUUID()}`, title: '   ' })).rejects.toThrow();
      expect(await independentCanonicalCount(tenantA)).toBe(before);
      expect(await independentLegacyCount()).toBe(0);
    });

    it('persists active academic create/get/list with prerequisite course codes and zero legacy writes', async () => {
      const code = `ACADEMIC-${randomUUID()}`.toUpperCase();
      const title = 'Synthetic academic item';
      const prerequisites = ['FOUNDATION-101', 'READING-102'];
      const legacyBefore = await independentLegacyCount();
      const dto = await contract.createCourse({ tenantId: tenantA, courseCode: code, title, prerequisites });
      expect(dto).toEqual({ id: expect.any(String), tenantId: tenantA, courseCode: code, title, status: 'active', prerequisites });
      const persisted = await observer.from('edu_courses')
        .select('id, tenant_id, course_code, title, status, prerequisite_course_codes')
        .eq('id', dto.id).eq('tenant_id', tenantA).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ id: dto.id, tenant_id: tenantA, course_code: code,
        title, status: 'active', prerequisite_course_codes: prerequisites });
      expect(await contract.getCourse(tenantA, dto.id)).toEqual(dto);
      expect(await contract.listCourses(tenantA)).toContainEqual(dto);
      expect(await independentLegacyCount()).toBe(legacyBefore);
    });

    it('keeps the same course code independent across tenants and absence scoped to tenant', async () => {
      const code = `SHARED-${randomUUID()}`.toUpperCase();
      const inA = await contract.createCourse({ tenantId: tenantA, courseCode: code, title: 'Synthetic A' });
      const inB = await contract.createCourse({ tenantId: tenantB, courseCode: code, title: 'Synthetic B' });
      expect(inA.id).not.toBe(inB.id);
      expect(await contract.getCourse(tenantB, inA.id)).toBeNull();
      expect(await contract.getCourse(tenantA, inB.id)).toBeNull();
      expect(await contract.listCourses(tenantA)).not.toContainEqual(expect.objectContaining({ id: inB.id }));
      const rows = await observer.from('edu_courses').select('id, tenant_id, course_code').eq('course_code', code).in('tenant_id', fixtureTenantIds);
      expect(rows.error).toBeNull();
      expect(rows.data).toHaveLength(2);
      expect(rows.data).toEqual(expect.arrayContaining([
        { id: inA.id, tenant_id: tenantA, course_code: code }, { id: inB.id, tenant_id: tenantB, course_code: code },
      ]));
      expect(await independentLegacyCount()).toBe(0);
    });

    it('propagates same-tenant uniqueness failure without overwriting the original row', async () => {
      const code = `UNIQUE-${randomUUID()}`.toUpperCase();
      const original = await contract.createCourse({ tenantId: tenantA, courseCode: code, title: 'Original synthetic title' });
      await expect(contract.createCourse({ tenantId: tenantA, courseCode: code, title: 'Duplicate synthetic title' })).rejects.toThrow();
      const persisted = await observer.from('edu_courses').select('id, title').eq('tenant_id', tenantA).eq('course_code', code);
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual([{ id: original.id, title: 'Original synthetic title' }]);
      expect(await independentLegacyCount()).toBe(0);
    });

    it('distinguishes absent scoped row/empty catalog from database lookup failures', async () => {
      expect(await contract.getCourse(tenantA, randomUUID())).toBeNull();
      expect(await contract.listCourses(randomUUID())).toEqual([]);
      // Invalid UUIDs reach the real PostgreSQL query boundary; no transport mock.
      await expect(contract.getCourse(tenantA, 'invalid-course-uuid')).rejects.toThrow();
      await expect(contract.listCourses('invalid-tenant-uuid')).rejects.toThrow();
      expect(await independentLegacyCount()).toBe(0);
    });

    it('propagates persistence errors without creating a legacy fallback', async () => {
      const missingTenant = randomUUID();
      const before = await independentCanonicalCount(missingTenant);
      await expect(contract.createCourse({ tenantId: missingTenant, courseCode: `FK-${randomUUID()}`, title: 'Rejected synthetic item' })).rejects.toThrow();
      expect(await independentCanonicalCount(missingTenant)).toBe(before);
      expect(await independentLegacyCount()).toBe(0);
    });
  });

  describe('provider Auth permission gate — missing legitimate ACL/RLS is FAIL, never skipped PASS', () => {
    let caller: SupabaseClient<Database>;
    let callerContract: CourseContractImpl;
    let foreignCourseId: string;

    beforeAll(async () => {
      const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!publicKey) throw new Error('COURSE_REAL_PROVIDER_PUBLIC_KEY_REQUIRED');
      const email = `academic-course-${randomUUID()}@example.invalid`;
      const password = randomBytes(32).toString('base64url');
      const actorId = randomUUID();
      plannedAuthUserIds.push(actorId);
      plannedProfiles.push({ id: actorId, tenantId: tenantA });
      writeReceipt();
      const created = await requireFixture().auth.admin.createUser({ id: actorId, email, password, email_confirm: true });
      if (created.error || created.data.user?.id !== actorId) throw new Error(`COURSE_PROVIDER_FIXTURE_CREATE_FAILED:${created.error?.code ?? 'PLANNED_ID_MISMATCH'}`);
      ownedAuthUsers.push(actorId);
      writeReceipt();
      const profile = await requireFixture().from('users').insert({
        id: actorId, tenant_id: tenantA, email, full_name: 'Synthetic academic actor', role: 'admin', status: 'active',
      });
      if (profile.error) throw new Error(`COURSE_PROVIDER_PROFILE_CREATE_FAILED:${profile.error.code}`);
      createdProfileIds.push(actorId);
      writeReceipt();
      caller = createClient<Database>(apiUrl, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: attestedFetch },
      });
      const login = await caller.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session?.access_token) throw new Error('COURSE_PROVIDER_LOGIN_FAILED');
      const verified = await caller.auth.getUser(login.data.session.access_token);
      if (verified.error || verified.data.user?.id !== actorId) throw new Error('COURSE_PROVIDER_SUBJECT_MISMATCH');
      callerContract = new CourseContractImpl(caller);
      foreignCourseId = (await contract.createCourse({ tenantId: tenantB,
        courseCode: `AUTH-FOREIGN-${randomUUID()}`, title: 'Synthetic foreign catalog item' })).id;
    });

    it('requires legitimate provider-authenticated create/get/list before claiming caller RLS proof', async () => {
      const dto = await callerContract.createCourse({ tenantId: tenantA,
        courseCode: `AUTH-POSITIVE-${randomUUID()}`.toUpperCase(), title: 'Synthetic allowed catalog item' });
      expect(dto.status).toBe('active');
      expect(await callerContract.getCourse(tenantA, dto.id)).toEqual(dto);
      expect(await callerContract.listCourses(tenantA)).toContainEqual(dto);
      const persisted = await observer.from('edu_courses').select('id, tenant_id, status').eq('id', dto.id).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ id: dto.id, tenant_id: tenantA, status: 'active' });
      expect(await independentLegacyCount()).toBe(0);
    });

    it('denies foreign tenant create/read with independent zero foreign writes after an allowed control', async () => {
      // A permission error on all tenants is not evidence of working tenant isolation.
      const allowed = await callerContract.createCourse({ tenantId: tenantA,
        courseCode: `AUTH-CONTROL-${randomUUID()}`, title: 'Synthetic allowed control' });
      expect(await callerContract.getCourse(tenantA, allowed.id)).toEqual(allowed);
      const before = await independentCanonicalCount(tenantB);
      expect(await callerContract.getCourse(tenantB, foreignCourseId)).toBeNull();
      expect(await callerContract.listCourses(tenantB)).toEqual([]);
      await expect(callerContract.createCourse({ tenantId: tenantB,
        courseCode: `AUTH-DENIED-${randomUUID()}`, title: 'Forbidden synthetic item' })).rejects.toThrow();
      expect(await independentCanonicalCount(tenantB)).toBe(before);
      expect(await independentLegacyCount()).toBe(0);
    });
  });
});
