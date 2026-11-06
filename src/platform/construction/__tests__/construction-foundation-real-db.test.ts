import { randomBytes, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow as PgQueryResultRow } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SupabasePlatformActionAuthorization } from '@/platform/authorization';
import type { Database } from '@/types/database.types';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = EXPECTED_E2E_PROJECT_REF + '.supabase.co';

loadConstructionE2eEnv();

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const anonKey =
  process.env.E2E_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';
const serviceRoleKey =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const dbUrl =
  process.env.DATABASE_EXECUTOR_URL_TEST ||
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const canRun =
  isAllowedE2eProject(supabaseUrl) &&
  isAllowedE2eDbUrl(dbUrl) &&
  Boolean(anonKey.trim() && serviceRoleKey.trim());
const describeWithE2e = canRun ? describe : describe.skip;

type PlatformAuth = InstanceType<typeof SupabasePlatformActionAuthorization>;
type ActorKey = 'adminA' | 'adminB' | 'userA' | 'userB' | 'userDenied';
type ActorRole = 'admin' | 'ktv';
type RpcClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};
type TestActor = {
  id: string;
  client: SupabaseClient<Database>;
  authorization: PlatformAuth;
};
type AuditFault = {
  triggerName: string;
  functionName: string;
};
type RuntimeStatusRow = PgQueryResultRow & {
  grant_table: boolean;
  audit_table: boolean;
  construction_tables: number;
};

describeWithE2e('Construction Direct Grant real E2E on isolated Supabase project', () => {
  jest.setTimeout(180_000);

  const marker = 'construction-direct-grant-' + randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const orgA = randomUUID();
  const orgASecondary = randomUUID();
  const orgADenied = randomUUID();
  const orgB = randomUUID();
  const personA = randomUUID();
  const personDenied = randomUUID();
  const personB = randomUUID();
  const actors: Partial<Record<ActorKey, TestActor>> = {};
  const authUserIds: string[] = [];
  const auditFaults = new Set<AuditFault>();

  let databaseAdmin: Client | null = null;
  let supabaseAdmin: SupabaseClient<Database> | null = null;

  beforeAll(async () => {
    if (!canRun) throw new Error('CONSTRUCTION_E2E_PROJECT_OR_CREDENTIALS_NOT_CONFIGURED');

    const database = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await database.connect();
    databaseAdmin = database;

    const runtime = await databaseAdmin.query<RuntimeStatusRow>(
      "SELECT " +
        "to_regclass('public.platform_direct_user_action_grants') IS NOT NULL AS grant_table, " +
        "to_regclass('public.platform_direct_user_action_grant_audit') IS NOT NULL AS audit_table, " +
        "(SELECT COUNT(*)::integer FROM pg_class relation " +
        "JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace " +
        "WHERE namespace.nspname = 'public' AND relation.relname IN " +
        "('construction_projects','construction_sites','construction_work_packages','construction_boq_lines')) " +
        "AS construction_tables"
    );
    if (
      !runtime.rows[0]?.grant_table ||
      !runtime.rows[0]?.audit_table ||
      runtime.rows[0]?.construction_tables !== 4
    ) {
      throw new Error('CONSTRUCTION_E2E_REQUIRED_DATABASE_OBJECTS_NOT_FOUND');
    }

    supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    await seedTenant(tenantA, marker + ' tenant A');
    await seedTenant(tenantB, marker + ' tenant B');
    await seedOrgUnit(tenantA, orgA, marker + '-A-main');
    await seedOrgUnit(tenantA, orgASecondary, marker + '-A-secondary');
    await seedOrgUnit(tenantA, orgADenied, marker + '-A-denied');
    await seedOrgUnit(tenantB, orgB, marker + '-B-main');

    actors.adminA = await createActor('admin-a', tenantA, 'admin');
    actors.adminB = await createActor('admin-b', tenantB, 'admin');
    actors.userA = await createActor('user-a', tenantA, 'ktv');
    actors.userB = await createActor('user-b', tenantB, 'ktv');
    actors.userDenied = await createActor('user-denied', tenantA, 'ktv');

    await seedOrgMembership(tenantA, personA, actor('userA').id, [orgA, orgASecondary], marker + ' user A');
    await seedOrgMembership(tenantA, personDenied, actor('userDenied').id, [orgADenied], marker + ' denied user');
    await seedOrgMembership(tenantB, personB, actor('userB').id, [orgB], marker + ' user B');

    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userA').id,
        permissionId: 'construction:foundation:read',
        scope: { type: 'TENANT' },
      }),
      'BASE_GRANT_FOUNDATION_READ'
    );
    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userA').id,
        permissionId: 'construction:project:write',
        scope: { type: 'TENANT' },
      }),
      'BASE_GRANT_PROJECT_WRITE'
    );
    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userA').id,
        permissionId: 'construction:site:write',
        scope: { type: 'ORG_UNIT', orgUnitId: orgA },
      }),
      'BASE_GRANT_SITE_WRITE'
    );
    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userA').id,
        permissionId: 'construction:work_package:write',
        scope: { type: 'ORG_UNIT', orgUnitId: orgA },
      }),
      'BASE_GRANT_WORK_PACKAGE_WRITE'
    );
    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userA').id,
        permissionId: 'construction:boq:write',
        scope: { type: 'ORG_UNIT', orgUnitId: orgA },
      }),
      'BASE_GRANT_BOQ_WRITE'
    );
    await expectCommitted(
      await actor('adminA').authorization.grantDirectUser({
        targetUserId: actor('userDenied').id,
        permissionId: 'construction:site:write',
        scope: { type: 'TENANT' },
      }),
      'BASE_GRANT_DENIED_USER_SITE_WRITE'
    );
    await expectCommitted(
      await actor('adminB').authorization.grantDirectUser({
        targetUserId: actor('userB').id,
        permissionId: 'construction:foundation:read',
        scope: { type: 'TENANT' },
      }),
      'BASE_GRANT_TENANT_B_READ'
    );
    await expectCommitted(
      await actor('adminB').authorization.grantDirectUser({
        targetUserId: actor('userB').id,
        permissionId: 'construction:project:write',
        scope: { type: 'TENANT' },
      }),
      'BASE_GRANT_TENANT_B_PROJECT_WRITE'
    );
  });

  afterAll(async () => {
    await dropAllAuditFaults();

    if (databaseAdmin) {
      try {
        await cleanupDatabaseFixtures();
      } finally {
        await databaseAdmin.end();
      }
    }

    if (supabaseAdmin) {
      for (const userId of authUserIds) {
        const result = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (result.error && result.error.code !== 'user_not_found') {
          throw new Error('CONSTRUCTION_E2E_AUTH_FIXTURE_CLEANUP_FAILED');
        }
      }
    }
  });

  it('enforces authenticated Tenant Admin grant/revoke authority and persists audit', async () => {
    const adminA = actor('adminA');
    const adminB = actor('adminB');
    const userA = actor('userA');

    expect(await userA.authorization.authorize({
      permissionId: 'construction:boq:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'DENY', reason: 'NO_GRANT' });

    expect(await userA.authorization.grantDirectUser({
      targetUserId: userA.id,
      permissionId: 'construction:project:write',
      scope: { type: 'TENANT' },
    })).toEqual({ status: 'DENIED', reason: 'NOT_TENANT_GRANT_ADMIN' });

    expect(await userA.authorization.revokeDirectUser({ grantId: randomUUID() })).toEqual({
      status: 'DENIED',
      reason: 'NOT_TENANT_GRANT_ADMIN',
    });

    expect(await adminA.authorization.grantDirectUser({
      targetUserId: userA.id,
      permissionId: 'construction:admin:write',
      scope: { type: 'TENANT' },
    })).toEqual({ status: 'DENIED', reason: 'INVALID_TARGET_OR_SCOPE' });

    expect(await adminA.authorization.grantDirectUser({
      targetUserId: actor('userB').id,
      permissionId: 'construction:project:write',
      scope: { type: 'TENANT' },
    })).toEqual({ status: 'DENIED', reason: 'INVALID_TARGET_OR_SCOPE' });

    expect(await readRows(adminB, 'platform_direct_user_action_grants', {
      tenant_id: tenantB,
      user_id: actor('userB').id,
      permission_id: 'construction:project:write',
    })).toHaveLength(1);

    const tenantGrantId = committedGrantId(await adminA.authorization.grantDirectUser({
      targetUserId: userA.id,
      permissionId: 'construction:boq:write',
      scope: { type: 'TENANT' },
    }));

    expect(await userA.authorization.authorize({
      permissionId: 'construction:boq:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });

    expect(await adminB.authorization.revokeDirectUser({ grantId: tenantGrantId })).toEqual({
      status: 'DENIED',
      reason: 'INVALID_TARGET_OR_SCOPE',
    });
    expect(await userA.authorization.authorize({
      permissionId: 'construction:boq:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });

    expect((await readRows(adminA, 'platform_direct_user_action_grant_audit', {
      tenant_id: tenantA,
      grant_id: tenantGrantId,
    })).map((row) => row.action)).toEqual(['GRANT']);

    expect(await adminA.authorization.revokeDirectUser({ grantId: tenantGrantId })).toEqual({
      status: 'COMMITTED',
      grantId: tenantGrantId,
    });

    expect(await userA.authorization.authorize({
      permissionId: 'construction:boq:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'DENY', reason: 'NO_GRANT' });

    const grantAfterRevoke = await readRows(adminA, 'platform_direct_user_action_grants', {
      id: tenantGrantId,
    });
    expect(grantAfterRevoke).toHaveLength(1);
    expect(grantAfterRevoke[0].status).toBe('REVOKED');
    expect((await readRows(adminA, 'platform_direct_user_action_grant_audit', {
      tenant_id: tenantA,
      grant_id: tenantGrantId,
    })).map((row) => row.action)).toEqual(['GRANT', 'REVOKE']);

    const adminRoleCheck = await requireDatabaseAdmin().query<PgQueryResultRow & { role: string }>(
      'SELECT role FROM public.users WHERE id = $1::uuid',
      [userA.id]
    );
    expect(adminRoleCheck.rows[0]?.role).toBe('ktv');
  });

  it('enforces tenant, Org Unit, actor, read and Construction RPC boundaries', async () => {
    const userA = actor('userA');
    const userDenied = actor('userDenied');
    const userB = actor('userB');

    expect(await userA.authorization.authorize({
      permissionId: 'construction:foundation:read',
      tenantId: tenantA,
    })).toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });
    expect(await userA.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgA,
    })).toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });
    expect(await userA.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'DENY', reason: 'NO_GRANT' });

    expect(await userDenied.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgA,
    })).toEqual({ status: 'DENY', reason: 'ORG_UNIT_MISMATCH' });
    expect(await userDenied.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgADenied,
    })).toEqual({ status: 'ALLOW', reason: 'DIRECT_GRANT' });
    expect(await userA.authorization.authorize({
      permissionId: 'construction:project:write',
      tenantId: tenantB,
    })).toEqual({ status: 'DENY', reason: 'TENANT_MISMATCH' });

    const tenantAProject = rpcObject(await callRpc(userA.client, 'construction_create_project', {
      p_project_code: marker + '-A-project',
      p_name: marker + ' Project A',
    }));
    const tenantBProject = rpcObject(await callRpc(userB.client, 'construction_create_project', {
      p_project_code: marker + '-B-project',
      p_name: marker + ' Project B',
    }));
    expect(typeof tenantAProject.id).toBe('string');
    expect(typeof tenantBProject.id).toBe('string');

    const createdAByActor = await readRows(userA, 'construction_projects', {
      id: String(tenantAProject.id),
    });
    expect(createdAByActor).toHaveLength(1);
    expect(createdAByActor[0].tenant_id).toBe(tenantA);
    expect(createdAByActor[0].created_by).toBe(userA.id);

    const site = rpcObject(await callRpc(userA.client, 'construction_create_site', {
      p_project_id: tenantAProject.id,
      p_org_unit_id: orgA,
      p_site_code: marker + '-site',
      p_name: marker + ' Site',
      p_location_text: 'E2E test fixture',
    }));
    const workPackage = rpcObject(await callRpc(userA.client, 'construction_create_work_package', {
      p_site_id: site.id,
      p_work_package_code: marker + '-wp',
      p_name: marker + ' Work Package',
    }));
    const boqLine = rpcObject(await callRpc(userA.client, 'construction_create_boq_line', {
      p_work_package_id: workPackage.id,
      p_line_number: 'E2E-1',
      p_description: marker + ' BOQ line',
      p_quantity: 2,
      p_uom: 'ea',
      p_unit_rate: 100,
      p_currency: 'VND',
      p_cost_code: marker + '-cost',
    }));
    expect(typeof site.id).toBe('string');
    expect(typeof workPackage.id).toBe('string');
    expect(typeof boqLine.id).toBe('string');

    expect(rpcRows((await callRpc(userA.client, 'construction_list_projects', {
      p_project_id: null,
    })).data).some((row) => row.id === tenantAProject.id)).toBe(true);
    expect(rpcRows((await callRpc(userA.client, 'construction_list_projects', {
      p_project_id: null,
    })).data).some((row) => row.id === tenantBProject.id)).toBe(false);
    expect(rpcRows((await callRpc(userA.client, 'construction_list_sites', {
      p_project_id: tenantAProject.id,
    })).data).some((row) => row.id === site.id)).toBe(true);
    expect(rpcRows((await callRpc(userA.client, 'construction_list_work_packages', {
      p_site_id: site.id,
    })).data).some((row) => row.id === workPackage.id)).toBe(true);
    expect(rpcRows((await callRpc(userA.client, 'construction_list_boq_lines', {
      p_work_package_id: workPackage.id,
    })).data).some((row) => row.id === boqLine.id)).toBe(true);

    const tenantAProjects = await readRows(userA, 'construction_projects');
    expect(tenantAProjects.every((row) => row.tenant_id === tenantA)).toBe(true);
    expect(tenantAProjects.some((row) => row.id === tenantBProject.id)).toBe(false);
    expect(await readRows(userA, 'construction_projects', {
      id: String(tenantBProject.id),
    })).toHaveLength(0);

    expect((await postRow(userA, 'construction_projects', {
      tenant_id: tenantA,
      project_code: marker + '-forged-actor',
      name: 'forged actor denied',
      created_by: actor('adminA').id,
      updated_by: actor('adminA').id,
    })).ok).toBe(false);

    expect((await postRow(userA, 'construction_projects', {
      tenant_id: tenantB,
      project_code: marker + '-forged-tenant',
      name: 'forged tenant denied',
      created_by: userA.id,
      updated_by: userA.id,
    })).ok).toBe(false);

    expect(await userA.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgADenied,
    })).toEqual({ status: 'DENY', reason: 'ORG_UNIT_MISMATCH' });
  });

  it('rolls back grant and revoke when audit persistence fails', async () => {
    const adminA = actor('adminA');
    const userA = actor('userA');
    const tenantGrantFilter = {
      tenant_id: tenantA,
      user_id: userA.id,
      permission_id: 'construction:site:write',
      scope_type: 'TENANT',
    };

    const grantAuditFault = await installAuditFault('GRANT');
    try {
      const failedGrant = await adminA.authorization.grantDirectUser({
        targetUserId: userA.id,
        permissionId: 'construction:site:write',
        scope: { type: 'TENANT' },
      });
      expect(failedGrant).toEqual({ status: 'UNAVAILABLE', reason: 'PERSISTENCE_FAILED' });
      expect(await readRows(adminA, 'platform_direct_user_action_grants', tenantGrantFilter)).toHaveLength(0);
      expect(await readRows(adminA, 'platform_direct_user_action_grant_audit', {
        tenant_id: tenantA,
        permission_id: 'construction:site:write',
        scope_type: 'TENANT',
      })).toHaveLength(0);
    } finally {
      await dropAuditFault(grantAuditFault);
    }

    const revokeGrantId = committedGrantId(await adminA.authorization.grantDirectUser({
      targetUserId: userA.id,
      permissionId: 'construction:site:write',
      scope: { type: 'TENANT' },
    }));
    expect((await readRows(adminA, 'platform_direct_user_action_grant_audit', {
      tenant_id: tenantA,
      grant_id: revokeGrantId,
    })).map((row) => row.action)).toEqual(['GRANT']);

    const revokeAuditFault = await installAuditFault('REVOKE');
    try {
      expect(await adminA.authorization.revokeDirectUser({ grantId: revokeGrantId })).toEqual({
        status: 'UNAVAILABLE',
        reason: 'PERSISTENCE_FAILED',
      });
      const stillActive = await readRows(adminA, 'platform_direct_user_action_grants', {
        id: revokeGrantId,
      });
      expect(stillActive).toHaveLength(1);
      expect(stillActive[0].status).toBe('ACTIVE');
      expect((await readRows(adminA, 'platform_direct_user_action_grant_audit', {
        tenant_id: tenantA,
        grant_id: revokeGrantId,
      })).map((row) => row.action)).toEqual(['GRANT']);
    } finally {
      await dropAuditFault(revokeAuditFault);
    }

    expect(await adminA.authorization.revokeDirectUser({ grantId: revokeGrantId })).toEqual({
      status: 'COMMITTED',
      grantId: revokeGrantId,
    });
    expect((await readRows(adminA, 'platform_direct_user_action_grant_audit', {
      tenant_id: tenantA,
      grant_id: revokeGrantId,
    })).map((row) => row.action)).toEqual(['GRANT', 'REVOKE']);
    expect(await userA.authorization.authorize({
      permissionId: 'construction:site:write',
      tenantId: tenantA,
      orgUnitId: orgASecondary,
    })).toEqual({ status: 'DENY', reason: 'NO_GRANT' });
  });

  async function createActor(label: string, tenantId: string, role: ActorRole): Promise<TestActor> {
    const admin = requireSupabaseAdmin();
    const email = marker + '-' + label + '-' + randomUUID() + '@example.invalid';
    const password = randomBytes(32).toString('base64url') + 'A1!';
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error('CONSTRUCTION_E2E_AUTH_USER_CREATE_FAILED');
    }
    const userId = created.data.user.id;
    authUserIds.push(userId);

    await requireDatabaseAdmin().query(
      'INSERT INTO public.users (id, tenant_id, email, full_name, role, status) ' +
        "VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active')",
      [userId, tenantId, email, marker + ' ' + label, role]
    );

    const client = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.user || login.data.user.id !== userId) {
      throw new Error('CONSTRUCTION_E2E_AUTH_SIGN_IN_FAILED');
    }

    return {
      id: userId,
      client,
      authorization: new SupabasePlatformActionAuthorization(client),
    };
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await requireDatabaseAdmin().query(
      "INSERT INTO public.tenants (id, name, status, enabled_modules) " +
        "VALUES ($1::uuid, $2, 'active', '{}'::jsonb)",
      [tenantId, name]
    );
  }

  async function seedOrgUnit(tenantId: string, orgUnitId: string, label: string): Promise<void> {
    await requireDatabaseAdmin().query(
      "INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata) " +
        "VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{\"proof\":\"construction-direct-grant-e2e\"}'::jsonb)",
      [orgUnitId, tenantId, label, label]
    );
  }

  async function seedOrgMembership(
    tenantId: string,
    personId: string,
    userId: string,
    orgUnitIds: string[],
    label: string
  ): Promise<void> {
    await requireDatabaseAdmin().query(
      "INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata) " +
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{\"proof\":\"construction-direct-grant-e2e\"}'::jsonb)",
      [personId, tenantId, userId, label]
    );

    for (const orgUnitId of orgUnitIds) {
      await requireDatabaseAdmin().query(
        "INSERT INTO public.org_relationships (tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata) " +
          "VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, " +
          "'{\"proof\":\"construction-direct-grant-e2e\"}'::jsonb)",
        [tenantId, personId, orgUnitId]
      );
    }
  }

  async function installAuditFault(action: 'GRANT' | 'REVOKE'): Promise<AuditFault> {
    const suffix = randomUUID().replace(/-/g, '');
    const fault: AuditFault = {
      triggerName: 'test_construction_audit_fault_' + suffix,
      functionName: 'test_construction_audit_fault_fn_' + suffix,
    };
    const actorId = actor('adminA').id;

    await requireDatabaseAdmin().query(
      'CREATE FUNCTION public.' +
        fault.functionName +
        '() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN ' +
        "IF NEW.actor_user_id = '" +
        actorId +
        "'::uuid AND NEW.action = '" +
        action +
        "' THEN RAISE EXCEPTION 'CONSTRUCTION_E2E_AUDIT_FAILURE_INJECTION'; END IF; " +
        'RETURN NEW; END; $fault$'
    );
    auditFaults.add(fault);

    await requireDatabaseAdmin().query(
      'CREATE TRIGGER ' +
        fault.triggerName +
        ' BEFORE INSERT ON public.platform_direct_user_action_grant_audit ' +
        'FOR EACH ROW EXECUTE FUNCTION public.' +
        fault.functionName +
        '()'
    );
    return fault;
  }

  async function dropAuditFault(fault: AuditFault): Promise<void> {
    try {
      await requireDatabaseAdmin().query(
        'DROP TRIGGER IF EXISTS ' +
          fault.triggerName +
          ' ON public.platform_direct_user_action_grant_audit'
      );
      await requireDatabaseAdmin().query('DROP FUNCTION IF EXISTS public.' + fault.functionName + '()');
      auditFaults.delete(fault);
    } catch {
      throw new Error('CONSTRUCTION_E2E_AUDIT_FAULT_CLEANUP_FAILED');
    }
  }

  async function dropAllAuditFaults(): Promise<void> {
    for (const fault of auditFaults) {
      await dropAuditFault(fault);
    }
  }

  async function cleanupDatabaseFixtures(): Promise<void> {
    const tenantIds = [tenantA, tenantB];
    await requireDatabaseAdmin().query('SET row_security = off');
    await requireDatabaseAdmin().query(
      'DELETE FROM public.platform_direct_user_action_grant_audit WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.platform_direct_user_action_grants WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.construction_boq_lines WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.construction_work_packages WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.construction_sites WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.construction_projects WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.org_relationships WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])',
      [[personA, personDenied, personB]]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.org_units WHERE id = ANY($1::uuid[])',
      [[orgA, orgASecondary, orgADenied, orgB]]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.users WHERE id = ANY($1::uuid[])',
      [authUserIds]
    );
    await requireDatabaseAdmin().query(
      'DELETE FROM public.tenants WHERE id = ANY($1::uuid[])',
      [tenantIds]
    );
  }

  function actor(key: ActorKey): TestActor {
    const value = actors[key];
    if (!value) throw new Error('CONSTRUCTION_E2E_ACTOR_FIXTURE_MISSING');
    return value;
  }

  function requireDatabaseAdmin(): Client {
    if (!databaseAdmin) throw new Error('CONSTRUCTION_E2E_DATABASE_ADMIN_UNAVAILABLE');
    return databaseAdmin;
  }

  function requireSupabaseAdmin(): SupabaseClient<Database> {
    if (!supabaseAdmin) throw new Error('CONSTRUCTION_E2E_SUPABASE_ADMIN_UNAVAILABLE');
    return supabaseAdmin;
  }
});

function committedGrantId(result: Awaited<ReturnType<PlatformAuth['grantDirectUser']>>): string {
  if (result.status !== 'COMMITTED') {
    throw new Error('CONSTRUCTION_E2E_GRANT_NOT_COMMITTED:' + result.status);
  }
  return result.grantId;
}

async function expectCommitted(
  result: Awaited<ReturnType<PlatformAuth['grantDirectUser']>>,
  label: string
): Promise<string> {
  if (result.status !== 'COMMITTED') {
    throw new Error(label + ':' + result.status + ':' + ('reason' in result ? result.reason : 'NO_REASON'));
  }
  return result.grantId;
}

async function callRpc(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
  return (client as unknown as RpcClient).rpc(name, args);
}

function rpcObject(
  result: { data: unknown; error: { code?: string; message?: string } | null }
): Record<string, unknown> {
  if (result.error) {
    throw new Error('CONSTRUCTION_E2E_RPC_FAILED:' + (result.error.code ?? 'UNKNOWN'));
  }
  if (typeof result.data === 'object' && result.data !== null && !Array.isArray(result.data)) {
    return result.data as Record<string, unknown>;
  }
  throw new Error('CONSTRUCTION_E2E_RPC_RETURN_SHAPE_INVALID');
}

function rpcRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && !Array.isArray(row)
  );
}

async function readRows(
  actor: TestActor,
  table: string,
  filters: Record<string, string> = {}
): Promise<Record<string, unknown>[]> {
  const session = await actor.client.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (session.error || !accessToken) throw new Error('CONSTRUCTION_E2E_SESSION_REQUIRED');

  const endpoint = new URL('/rest/v1/' + table, supabaseUrl);
  endpoint.searchParams.set('select', '*');
  for (const [key, value] of Object.entries(filters)) {
    endpoint.searchParams.set(key, 'eq.' + value);
  }

  const response = await fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error('CONSTRUCTION_E2E_READ_FAILED:' + table + ':' + response.status);
  return rpcRows(await response.json());
}

async function postRow(
  actor: TestActor,
  table: string,
  body: Record<string, unknown>
): Promise<Response> {
  const session = await actor.client.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (session.error || !accessToken) throw new Error('CONSTRUCTION_E2E_SESSION_REQUIRED');

  return fetch(new URL('/rest/v1/' + table, supabaseUrl), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function isAllowedE2eProject(value: string): boolean {
  try {
    return new URL(value).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function isAllowedE2eDbUrl(value: string): boolean {
  return Boolean(value.trim()) && value.toLowerCase().includes(EXPECTED_E2E_PROJECT_REF);
}

function loadConstructionE2eEnv(): void {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve('D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  for (const filePath of [...new Set(candidates.map((candidate) => path.resolve(candidate)))]) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) process.env[key] = value;
    }
    if (!process.env.E2E_SUPABASE_URL?.trim() && parsed.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.E2E_SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (!process.env.E2E_SUPABASE_ANON_KEY?.trim()) {
      process.env.E2E_SUPABASE_ANON_KEY =
        parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        parsed.SUPABASE_ANON_KEY ||
        '';
    }
    if (!process.env.E2E_SUPABASE_SERVICE_ROLE_KEY?.trim() && parsed.SUPABASE_SERVICE_ROLE_KEY) {
      process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = parsed.SUPABASE_SERVICE_ROLE_KEY;
    }
    if (!process.env.E2E_SUPABASE_DB_URL?.trim() && parsed.DATABASE_EXECUTOR_URL_TEST) {
      process.env.E2E_SUPABASE_DB_URL = parsed.DATABASE_EXECUTOR_URL_TEST;
    }
  }
}
