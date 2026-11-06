import { randomBytes, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import type { Database } from '@/types/database.types';

const expectedProjectRef = 'bmnbqbcdbuklhopfbopv';
const e2eEnvironment = loadE2eEnvironment();

const supabaseUrl = process.env.E2E_SUPABASE_URL
  || e2eEnvironment.E2E_SUPABASE_URL
  || e2eEnvironment.NEXT_PUBLIC_SUPABASE_URL
  || e2eEnvironment.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.SUPABASE_URL
  || '';
const anonKey = process.env.E2E_SUPABASE_ANON_KEY
  || e2eEnvironment.E2E_SUPABASE_ANON_KEY
  || e2eEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || e2eEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || e2eEnvironment.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || '';
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  || e2eEnvironment.E2E_SUPABASE_SERVICE_ROLE_KEY
  || e2eEnvironment.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || '';
const databaseUrl = process.env.E2E_SUPABASE_DB_URL
  || e2eEnvironment.E2E_SUPABASE_DB_URL
  || e2eEnvironment.DATABASE_EXECUTOR_URL_TEST
  || e2eEnvironment.SUPABASE_DB_URL
  || e2eEnvironment.SUPABASE_DATABASE_URL
  || e2eEnvironment.DATABASE_URL
  || process.env.DATABASE_EXECUTOR_URL_TEST
  || process.env.SUPABASE_DB_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.DATABASE_URL
  || '';
const canRunE2e = isAllowedProjectUrl(supabaseUrl)
  && databaseUrl.toLowerCase().includes(expectedProjectRef)
  && Boolean(anonKey.trim() && serviceRoleKey.trim());
const describeWithE2e = canRunE2e ? describe : describe.skip;

type RpcError = { code?: string; message?: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): Promise<RpcResponse> };
type SiteOperationsRoute = typeof import('@/app/api/construction/site-operations/route');
type ActorRole = 'admin' | 'ktv';
type E2eActor = {
  id: string;
  client: SupabaseClient<Database>;
  authorization: InstanceType<typeof SupabasePlatformActionAuthorization>;
};
type ActorKey = 'tenantAdmin' | 'siteUser' | 'deniedUser' | 'otherOrgUser';
type RuntimeRow = QueryResultRow & { site_diary: boolean; issues: boolean; direct_grants: boolean };
let activeServerClient: SupabaseClient<Database> | null = null;
let siteOperationsRoute: SiteOperationsRoute | null = null;

describeWithE2e('Construction Site Diary and Issue real-auth E2E', () => {
  jest.setTimeout(180_000);

  const marker = 'construction-site-operations-' + randomUUID();
  const tenantId = randomUUID();
  const siteOrgUnitId = randomUUID();
  const otherOrgUnitId = randomUUID();
  const siteUserPersonId = randomUUID();
  const deniedUserPersonId = randomUUID();
  const otherOrgUserPersonId = randomUUID();
  const actorIds: string[] = [];
  const actors: Partial<Record<ActorKey, E2eActor>> = {};
  let databaseAdmin: Client | null = null;
  let supabaseAdmin: SupabaseClient<Database> | null = null;
  let projectId: string | null = null;
  let siteId: string | null = null;
  let otherSiteId: string | null = null;
  let workPackageId: string | null = null;
  let otherWorkPackageId: string | null = null;

  beforeAll(async () => {
    if (!canRunE2e) throw new Error('CONSTRUCTION_SITE_OPERATIONS_E2E_CONFIGURATION_REQUIRED');
    jest.doMock('@/lib/supabase-server', () => ({
      createClient: async () => {
        if (!activeServerClient) throw new Error('CONSTRUCTION_SITE_OPERATIONS_AUTHENTICATED_CLIENT_REQUIRED');
        return activeServerClient;
      },
    }));
    siteOperationsRoute = require('@/app/api/construction/site-operations/route') as SiteOperationsRoute;
    databaseAdmin = new Client({ connectionString: databaseUrl, ssl: sslConfig() });
    await databaseAdmin.connect();
    const runtime = await databaseAdmin.query<RuntimeRow>(
      "SELECT " +
        "to_regclass('public.construction_site_diary_entries') IS NOT NULL AS site_diary, " +
        "to_regclass('public.construction_issues') IS NOT NULL AS issues, " +
        "to_regclass('public.platform_direct_user_action_grants') IS NOT NULL AS direct_grants"
    );
    if (!runtime.rows[0]?.site_diary || !runtime.rows[0]?.issues || !runtime.rows[0]?.direct_grants) {
      throw new Error('CONSTRUCTION_SITE_OPERATIONS_MIGRATION_NOT_APPLIED_TO_E2E');
    }

    supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await seedTenant();
    await seedOrgUnit(siteOrgUnitId, marker + '-site-org');
    await seedOrgUnit(otherOrgUnitId, marker + '-other-org');

    actors.tenantAdmin = await createActor('tenant-admin', 'admin');
    actors.siteUser = await createActor('site-user', 'ktv');
    actors.deniedUser = await createActor('denied-user', 'ktv');
    actors.otherOrgUser = await createActor('other-org-user', 'ktv');
    await seedOrgMembership(siteUserPersonId, actor('siteUser').id, siteOrgUnitId, 'site user');
    await seedOrgMembership(deniedUserPersonId, actor('deniedUser').id, siteOrgUnitId, 'denied user');
    await seedOrgMembership(otherOrgUserPersonId, actor('otherOrgUser').id, otherOrgUnitId, 'other org user');

    await grant(actor('siteUser'), 'construction:foundation:read', { type: 'TENANT' });
    await grant(actor('siteUser'), 'construction:project:write', { type: 'TENANT' });
    await grant(actor('siteUser'), 'construction:site:write', { type: 'ORG_UNIT', orgUnitId: siteOrgUnitId });
    await grant(actor('siteUser'), 'construction:work_package:write', { type: 'ORG_UNIT', orgUnitId: siteOrgUnitId });
    await grant(actor('otherOrgUser'), 'construction:foundation:read', { type: 'TENANT' });
    await grant(actor('otherOrgUser'), 'construction:project:write', { type: 'TENANT' });
    await grant(actor('otherOrgUser'), 'construction:site:write', { type: 'ORG_UNIT', orgUnitId: otherOrgUnitId });
    await grant(actor('otherOrgUser'), 'construction:work_package:write', { type: 'ORG_UNIT', orgUnitId: otherOrgUnitId });
    for (const permissionId of [
      'construction.site_diary.view',
      'construction.site_diary.create',
      'construction.site_diary.update',
      'construction.issue.view',
      'construction.issue.create',
      'construction.issue.update',
      'construction.issue.resolve',
      'construction.issue.close',
      'construction.issue.reopen',
    ]) {
      await grant(actor('siteUser'), permissionId, { type: 'ORG_UNIT', orgUnitId: siteOrgUnitId });
    }

    const project = row(await rpc(actor('siteUser'), 'construction_create_project', {
      p_project_code: marker + '-project',
      p_name: marker + ' Project',
    }));
    projectId = requireText(project.id, 'project id');
    const site = row(await rpc(actor('siteUser'), 'construction_create_site', {
      p_project_id: projectId,
      p_org_unit_id: siteOrgUnitId,
      p_site_code: marker + '-site-a',
      p_name: marker + ' Site A',
      p_location_text: 'Non-Production E2E fixture',
    }));
    siteId = requireText(site.id, 'site id');
    const workPackage = row(await rpc(actor('siteUser'), 'construction_create_work_package', {
      p_site_id: siteId,
      p_work_package_code: marker + '-package-a',
      p_name: marker + ' Work Package A',
    }));
    workPackageId = requireText(workPackage.id, 'work package id');

    const otherProject = row(await rpc(actor('otherOrgUser'), 'construction_create_project', {
      p_project_code: marker + '-project-b',
      p_name: marker + ' Project B',
    }));
    const otherProjectId = requireText(otherProject.id, 'other project id');
    const otherSite = row(await rpc(actor('otherOrgUser'), 'construction_create_site', {
      p_project_id: otherProjectId,
      p_org_unit_id: otherOrgUnitId,
      p_site_code: marker + '-site-b',
      p_name: marker + ' Site B',
      p_location_text: 'Non-Production E2E scope fixture',
    }));
    otherSiteId = requireText(otherSite.id, 'other site id');
    const otherPackage = row(await rpc(actor('otherOrgUser'), 'construction_create_work_package', {
      p_site_id: otherSiteId,
      p_work_package_code: marker + '-package-b',
      p_name: marker + ' Work Package B',
    }));
    otherWorkPackageId = requireText(otherPackage.id, 'other work package id');
  });

  afterAll(async () => {
    if (databaseAdmin) {
      try {
        await cleanupFixtures();
      } finally {
        await databaseAdmin.end();
      }
    }
    if (supabaseAdmin) {
      for (const actorId of actorIds) {
        const result = await supabaseAdmin.auth.admin.deleteUser(actorId);
        if (result.error && result.error.code !== 'user_not_found') {
          throw new Error('CONSTRUCTION_SITE_OPERATIONS_AUTH_FIXTURE_CLEANUP_FAILED');
        }
      }
    }
  });

  it('persists diary and Issue lifecycle while enforcing real-auth permission and Org Unit scope', async () => {
    const siteUser = actor('siteUser');
    const deniedUser = actor('deniedUser');
    const visibleSites = rows(await rpc(siteUser, 'construction_list_site_activity_sites'));
    expect(visibleSites.map((entry) => entry.id)).toContain(siteId);
    expect(visibleSites.map((entry) => entry.id)).not.toContain(otherSiteId);
    expect(await rpc(siteUser, 'construction_list_issues', { p_site_id: otherSiteId })).toMatchObject({ data: [], error: null });
    expect((await rpc(deniedUser, 'construction_list_site_activity_sites')).data).toEqual([]);

    const firstDiary = row(await rpc(siteUser, 'construction_create_site_diary_entry', {
      p_site_id: siteId,
      p_entry_date: '2026-11-05',
      p_work_package_id: workPackageId,
      p_content: marker + ' first diary entry',
    }));
    const secondDiary = row(await rpc(siteUser, 'construction_create_site_diary_entry', {
      p_site_id: siteId,
      p_entry_date: '2026-11-05',
      p_work_package_id: null,
      p_content: marker + ' second diary entry',
    }));
    const diaryId = requireText(firstDiary.id, 'diary id');
    expect(firstDiary.author_user_id).toBe(siteUser.id);
    expect(secondDiary.entry_date).toBe('2026-11-05');

    const diaryRows = rows(await rpc(siteUser, 'construction_list_site_diary_entries', { p_site_id: siteId }));
    expect(diaryRows.filter((entry) => entry.entry_date === '2026-11-05')).toHaveLength(2);

    const updatedDiary = row(await rpc(siteUser, 'construction_update_site_diary_entry', {
      p_entry_id: diaryId,
      p_entry_date: '2026-11-05',
      p_work_package_id: workPackageId,
      p_content: marker + ' updated diary entry',
    }));
    expect(updatedDiary.author_user_id).toBe(siteUser.id);
    expect(updatedDiary.content).toBe(marker + ' updated diary entry');
    expect(updatedDiary.updated_by).toBe(siteUser.id);

    const createdIssue = row(await rpc(siteUser, 'construction_create_issue', {
      p_site_id: siteId,
      p_title: marker + ' Issue',
      p_description: marker + ' Issue description',
      p_due_date: '2026-11-10',
      p_diary_entry_id: diaryId,
      p_work_package_id: workPackageId,
    }));
    const issueId = requireText(createdIssue.id, 'issue id');
    expect(createdIssue.status).toBe('OPEN');
    expect(createdIssue.diary_entry_id).toBe(diaryId);

    const badLink = await rpc(siteUser, 'construction_create_issue', {
      p_site_id: siteId,
      p_title: marker + ' invalid linked Issue',
      p_description: marker + ' invalid linked Issue description',
      p_due_date: null,
      p_diary_entry_id: diaryId,
      p_work_package_id: otherWorkPackageId,
    });
    expect(badLink.error).not.toBeNull();

    const updatedIssue = row(await rpc(siteUser, 'construction_update_issue', {
      p_issue_id: issueId,
      p_title: marker + ' Issue updated',
      p_description: marker + ' Issue description updated',
      p_due_date: '2026-11-11',
      p_diary_entry_id: diaryId,
      p_work_package_id: workPackageId,
    }));
    expect(updatedIssue.due_date).toBe('2026-11-11');

    for (const transition of [
      { p_target_status: 'IN_PROGRESS' },
      { p_target_status: 'RESOLVED', p_resolution_result: marker + ' repair verified' },
      { p_target_status: 'CLOSED' },
      { p_target_status: 'IN_PROGRESS', p_reopen_reason: marker + ' issue returned' },
    ]) {
      row(await rpc(siteUser, 'construction_transition_issue', { p_issue_id: issueId, ...transition }));
    }
    const issueRows = rows(await rpc(siteUser, 'construction_list_issues', { p_site_id: siteId }));
    const reopened = issueRows.find((entry) => entry.id === issueId);
    expect(reopened).toMatchObject({
      status: 'IN_PROGRESS',
      resolution_result: marker + ' repair verified',
      reopen_reason: marker + ' issue returned',
      closed_at: null,
    });

    const apiCreated = await callApi(siteUser, 'POST', '', {
      kind: 'diary',
      siteId,
      entryDate: '2026-11-05',
      workPackageId,
      content: marker + ' API diary entry',
    });
    expect(apiCreated.status).toBe(201);
    expect(await apiCreated.json()).toMatchObject({
      success: true,
      diaryEntry: { author_user_id: siteUser.id, content: marker + ' API diary entry' },
    });

    const apiRead = await callApi(siteUser, 'GET', '?site_id=' + encodeURIComponent(siteId ?? ''));
    expect(apiRead.status).toBe(200);
    expect(await apiRead.json()).toMatchObject({
      success: true,
      site: { id: siteId },
      currentUserId: siteUser.id,
      diaryEntries: expect.arrayContaining([expect.objectContaining({ content: marker + ' API diary entry' })]),
      issues: expect.arrayContaining([expect.objectContaining({ id: issueId, status: 'IN_PROGRESS' })]),
    });

    const forgedApiCreate = await callApi(siteUser, 'POST', '', {
      kind: 'diary',
      siteId,
      entryDate: '2026-11-05',
      workPackageId: null,
      content: marker + ' forged API diary entry',
      tenantId,
      actorId: siteUser.id,
    });
    expect(forgedApiCreate.status).toBe(400);

    const deniedApiRead = await callApi(siteUser, 'GET', '?site_id=' + encodeURIComponent(otherSiteId ?? ''));
    expect(deniedApiRead.status).toBe(404);

    const deniedCreate = await rpc(deniedUser, 'construction_create_site_diary_entry', {
      p_site_id: siteId,
      p_entry_date: '2026-11-05',
      p_work_package_id: null,
      p_content: marker + ' denied entry',
    });
    expect(deniedCreate.error).not.toBeNull();
    const outOfScopeCreate = await rpc(siteUser, 'construction_create_site_diary_entry', {
      p_site_id: otherSiteId,
      p_entry_date: '2026-11-05',
      p_work_package_id: otherWorkPackageId,
      p_content: marker + ' out of scope entry',
    });
    expect(outOfScopeCreate.error).not.toBeNull();

    const persisted = await database().query<QueryResultRow & { diary_count: number; issue_count: number; author_user_id: string }>(
      'SELECT (SELECT count(*)::integer FROM public.construction_site_diary_entries WHERE tenant_id=$1::uuid AND site_id=$2::uuid) AS diary_count, ' +
        '(SELECT count(*)::integer FROM public.construction_issues WHERE tenant_id=$1::uuid AND site_id=$2::uuid) AS issue_count, ' +
        '(SELECT author_user_id::text FROM public.construction_site_diary_entries WHERE id=$3::uuid) AS author_user_id',
      [tenantId, siteId, diaryId]
    );
    expect(persisted.rows[0]).toMatchObject({ diary_count: 3, issue_count: 1, author_user_id: siteUser.id });
  });

  async function grant(target: E2eActor, permissionId: string, scope: { type: 'TENANT' } | { type: 'ORG_UNIT'; orgUnitId: string }): Promise<void> {
    const result = await actor('tenantAdmin').authorization.grantDirectUser({
      targetUserId: target.id,
      permissionId,
      scope,
    });
    if (result.status !== 'COMMITTED') {
      throw new Error('CONSTRUCTION_SITE_OPERATIONS_PERMISSION_GRANT_FAILED:' + result.status);
    }
  }

  async function createActor(label: string, role: ActorRole): Promise<E2eActor> {
    const admin = requireSupabaseAdmin();
    const email = marker + '-' + label + '-' + randomUUID() + '@example.invalid';
    const password = randomBytes(32).toString('base64url') + 'A1!';
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('CONSTRUCTION_SITE_OPERATIONS_AUTH_FIXTURE_CREATE_FAILED');
    const id = created.data.user.id;
    actorIds.push(id);
    await database().query(
      'INSERT INTO public.users (id, tenant_id, email, full_name, role, status) ' +
        "VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active')",
      [id, tenantId, email, marker + ' ' + label, role]
    );
    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== id) throw new Error('CONSTRUCTION_SITE_OPERATIONS_REAL_AUTH_FAILED');
    return { id, client, authorization: new SupabasePlatformActionAuthorization(client) };
  }

  async function seedTenant(): Promise<void> {
    await database().query(
      "INSERT INTO public.tenants (id, name, status, enabled_modules) VALUES ($1::uuid, $2, 'active', '{}'::jsonb)",
      [tenantId, marker + ' tenant']
    );
  }

  async function seedOrgUnit(id: string, code: string): Promise<void> {
    await database().query(
      "INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata) " +
        "VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{\"proof\":\"construction-site-operations-e2e\"}'::jsonb)",
      [id, tenantId, marker + ' ' + code, code]
    );
  }

  async function seedOrgMembership(personId: string, userId: string, orgUnitId: string, label: string): Promise<void> {
    await database().query(
      "INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata) " +
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{\"proof\":\"construction-site-operations-e2e\"}'::jsonb)",
      [personId, tenantId, userId, marker + ' ' + label]
    );
    await database().query(
      "INSERT INTO public.org_relationships (tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata) " +
        "VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, " +
        "'{\"proof\":\"construction-site-operations-e2e\"}'::jsonb)",
      [tenantId, personId, orgUnitId]
    );
  }

  async function cleanupFixtures(): Promise<void> {
    await database().query('SET row_security = off');
    await database().query('DELETE FROM public.construction_issues WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.construction_site_diary_entries WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.platform_direct_user_action_grant_audit WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.platform_direct_user_action_grants WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.construction_work_packages WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.construction_sites WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.construction_projects WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.org_relationships WHERE tenant_id = $1::uuid', [tenantId]);
    await database().query('DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])', [[siteUserPersonId, deniedUserPersonId, otherOrgUserPersonId]]);
    await database().query('DELETE FROM public.org_units WHERE id = ANY($1::uuid[])', [[siteOrgUnitId, otherOrgUnitId]]);
    if (actorIds.length > 0) await database().query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [actorIds]);
    await database().query('DELETE FROM public.tenants WHERE id = $1::uuid', [tenantId]);
  }

  function actor(key: ActorKey): E2eActor {
    const value = actors[key];
    if (!value) throw new Error('CONSTRUCTION_SITE_OPERATIONS_ACTOR_FIXTURE_MISSING');
    return value;
  }

  function database(): Client {
    if (!databaseAdmin) throw new Error('CONSTRUCTION_SITE_OPERATIONS_DATABASE_UNAVAILABLE');
    return databaseAdmin;
  }

  function requireSupabaseAdmin(): SupabaseClient<Database> {
    if (!supabaseAdmin) throw new Error('CONSTRUCTION_SITE_OPERATIONS_SUPABASE_ADMIN_UNAVAILABLE');
    return supabaseAdmin;
  }

  async function callApi(
    user: E2eActor,
    method: 'GET' | 'POST',
    query: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    if (!siteOperationsRoute) throw new Error('CONSTRUCTION_SITE_OPERATIONS_ROUTE_UNAVAILABLE');
    const session = await user.client.auth.getSession();
    const token = session.data.session?.access_token;
    if (session.error || !token) throw new Error('CONSTRUCTION_SITE_OPERATIONS_SESSION_REQUIRED');
    activeServerClient = user.client;
    const request = new Request('http://localhost/api/construction/site-operations' + query, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return method === 'GET'
      ? siteOperationsRoute.GET(request)
      : siteOperationsRoute.POST(request);
  }
});

async function rpc(actor: E2eActor, name: string, args?: Record<string, unknown>): Promise<RpcResponse> {
  return (actor.client as unknown as RpcClient).rpc(name, args);
}

function row(response: RpcResponse): Record<string, unknown> {
  if (response.error) throw new Error('CONSTRUCTION_SITE_OPERATIONS_RPC_FAILED:' + (response.error.code ?? 'UNKNOWN'));
  const value = Array.isArray(response.data) ? response.data[0] : response.data;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('CONSTRUCTION_SITE_OPERATIONS_RPC_SHAPE_INVALID');
  }
  return value as Record<string, unknown>;
}

function rows(response: RpcResponse): Record<string, unknown>[] {
  if (response.error) throw new Error('CONSTRUCTION_SITE_OPERATIONS_RPC_FAILED:' + (response.error.code ?? 'UNKNOWN'));
  if (!Array.isArray(response.data)) throw new Error('CONSTRUCTION_SITE_OPERATIONS_RPC_SHAPE_INVALID');
  return response.data.filter((value): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error('CONSTRUCTION_SITE_OPERATIONS_FIXTURE_INVALID:' + label);
  return value;
}

function isAllowedProjectUrl(value: string): boolean {
  try {
    return new URL(value).host === expectedProjectRef + '.supabase.co';
  } catch {
    return false;
  }
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function loadE2eEnvironment(): Record<string, string> {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve('D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'),
  ].filter((entry): entry is string => Boolean(entry));
  for (const file of [...new Set(candidates.map((entry) => path.resolve(entry)))]) {
    if (!existsSync(file)) continue;
    return parseEnv(readFileSync(file));
  }
  return process.env;
}
