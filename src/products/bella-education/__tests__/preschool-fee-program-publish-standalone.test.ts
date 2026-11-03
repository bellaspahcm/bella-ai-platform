/** Opt-in Auth/PostgREST verification. Requires an explicitly selected loopback Local/Test stack. */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { Client as PostgresClient } from 'pg';
import type { Database } from '@/types/database.types';
import { publishFeeProgramVersion } from '@/products/bella-education/fee-program/fee-program.persistence';

const enabled = process.env.PRESCHOOL_FEE_PROGRAM_REAL_DB === '1' ? describe : describe.skip;
type Actor = { id: string; email: string; password: string; client: SupabaseClient<Database> };

enabled('Preschool Fee Program — standalone publish-only Auth and PostgREST', () => {
  jest.setTimeout(60000);
  let observer: PostgresClient | undefined;
  let adminClient: SupabaseClient<Database> | undefined;
  let tenantA: string;
  let tenantB: string;
  const actorIdsByTenant = new Map<string, string[]>();

  async function requireNoError(error: { message: string } | null, action: string) {
    if (error) throw new Error(`${action}: ${error.message}`);
  }

  function requireData<T>(data: T | null, action: string): T {
    if (data === null) throw new Error(`${action}: expected a returned row`);
    return data;
  }

  beforeAll(async () => {
    const apiUrl = process.env.PRESCHOOL_FEE_PROGRAM_API_URL;
    const dbUrl = process.env.PRESCHOOL_FEE_PROGRAM_DB_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!apiUrl || !dbUrl || !anonKey || !serviceRoleKey) throw new Error('FEE_PROGRAM_LOCAL_TEST_ENV_REQUIRED');
    const api = new URL(apiUrl);
    const database = new URL(dbUrl);
    if (api.port !== '32621' || database.port !== '32622') throw new Error('REFUSE_WRONG_STANDALONE_TARGET');
    const loopback = (hostname: string) => ['127.0.0.1', 'localhost', '::1'].includes(hostname);
    if (api.protocol !== 'http:' || !loopback(api.hostname) || !loopback(database.hostname)) {
      throw new Error('REFUSE_NONLOCAL_FEE_PROGRAM_TARGET');
    }

    observer = new PostgresClient({ connectionString: dbUrl });
    await observer.connect();
    adminClient = createClient<Database>(apiUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    tenantA = randomUUID();
    tenantB = randomUUID();
    await observer.query(`INSERT INTO public.tenants(id,name,status,product_key) VALUES
      ($1,'Controlled Fee Program tenant A','active','bella_preschool'),
      ($2,'Controlled Fee Program tenant B','active','bella_preschool')`, [tenantA, tenantB]);
  });

  async function actor(role: 'admin' | 'super_admin' | 'admin_staff', tenantId: string): Promise<Actor> {
    if (!adminClient) throw new Error('FEE_PROGRAM_TEST_SETUP_REQUIRED');
    const email = `fee-program-${randomUUID()}@example.test`;
    const password = `F1!${randomUUID()}aA`;
    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(
      `FEE_PROGRAM_AUTH_FIXTURE_FAILED: status=${error?.status ?? 'unknown'} name=${error?.name ?? 'unknown'} message=${error?.message ?? 'missing user'}`,
    );
    actorIdsByTenant.set(tenantId, [...(actorIdsByTenant.get(tenantId) ?? []), data.user.id]);
    if (!observer) throw new Error('FEE_PROGRAM_TEST_SETUP_REQUIRED');
    await observer.query(`INSERT INTO public.users(id,tenant_id,email,full_name,role,status)
      VALUES($1,$2,$3,'Controlled Fee Program actor',$4,'active')`, [data.user.id, tenantId, email, role]);
    const client = createClient<Database>(process.env.PRESCHOOL_FEE_PROGRAM_API_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await client.auth.signInWithPassword({ email, password });
    if (session.error || !session.data.session) throw new Error('FEE_PROGRAM_SIGNED_IN_SESSION_REQUIRED');
    return { id: data.user.id, email, password, client };
  }

  async function createDraft(actorClient: SupabaseClient<Database>, tenantId: string) {
    const typeCode = `FEE_${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const feeType = await actorClient.from('preschool_fixed_fee_types')
      .insert({ tenant_id: tenantId, code: typeCode, display_name: 'Controlled fixed fee type' }).select('id').single();
    await requireNoError(feeType.error, 'create tenant fixed fee type');
    const feeTypeRow = requireData(feeType.data, 'create tenant fixed fee type');
    const program = await actorClient.from('preschool_fee_programs')
      .insert({ tenant_id: tenantId, display_name: `Controlled ${randomUUID()}` }).select('id').single();
    await requireNoError(program.error, 'create fee program');
    const programRow = requireData(program.data, 'create fee program');
    const item = await actorClient.from('preschool_fee_items')
      .insert({ tenant_id: tenantId, display_name: `Controlled ${randomUUID()}` }).select('id').single();
    await requireNoError(item.error, 'create fee item');
    const itemRow = requireData(item.data, 'create fee item');
    const policy = await actorClient.from('preschool_billing_period_policy_versions')
      .insert({ tenant_id: tenantId, policy_definition: {} }).select('id').single();
    await requireNoError(policy.error, 'create policy draft');
    const policyRow = requireData(policy.data, 'create policy draft');
    const itemVersion = await actorClient.from('preschool_fee_item_versions').insert({
      tenant_id: tenantId, fee_item_id: itemRow.id, fee_type_code: typeCode, amount: 123456, currency: 'VND',
      unit_basis: {}, billing_basis: {}, effective_applicability: {},
    }).select('id').single();
    await requireNoError(itemVersion.error, 'create fee item version draft');
    const itemVersionRow = requireData(itemVersion.data, 'create fee item version draft');
    const programVersion = await actorClient.from('preschool_fee_program_versions').insert({
      tenant_id: tenantId, fee_program_id: programRow.id, billing_period_policy_version_id: policyRow.id,
      applicability: {}, effective_applicability: {},
    }).select('id').single();
    await requireNoError(programVersion.error, 'create fee program version draft');
    const programVersionRow = requireData(programVersion.data, 'create fee program version draft');
    const membership = await actorClient.from('preschool_fee_program_version_items').insert({
      tenant_id: tenantId, program_version_id: programVersionRow.id, fee_item_version_id: itemVersionRow.id,
    });
    await requireNoError(membership.error, 'link fee item version');
    return { programId: programRow.id, policyId: policyRow.id, itemVersionId: itemVersionRow.id, programVersionId: programVersionRow.id, typeCode, feeTypeId: feeTypeRow.id };
  }

  afterAll(async () => {
    try {
      if (observer && tenantA && tenantB) {
        for (const tenantId of [tenantA, tenantB]) {
          const published = await observer.query(`SELECT EXISTS(
            SELECT 1 FROM public.preschool_fee_program_versions WHERE tenant_id=$1 AND status='PUBLISHED'
          ) AS has_published_version`, [tenantId]);
          if (published.rows[0]?.has_published_version) continue;
          await observer.query('DELETE FROM public.users WHERE tenant_id = $1', [tenantId]);
          await observer.query('DELETE FROM public.tenants WHERE id = $1', [tenantId]);
          if (adminClient) {
            for (const id of actorIdsByTenant.get(tenantId) ?? []) await adminClient.auth.admin.deleteUser(id);
          }
        }
      }
    } finally {
      await observer?.end();
    }
  });

  it('publishes immutably for Admin and Super Admin, denies Staff/anon/cross-tenant access, and stays fail-closed', async () => {
    if (!adminClient || !observer) throw new Error('FEE_PROGRAM_TEST_SETUP_REQUIRED');
    const adminA = await actor('admin', tenantA);
    const superAdminA = await actor('super_admin', tenantA);
    const adminB = await actor('admin', tenantB);
    const staffA = await actor('admin_staff', tenantA);
    const draft = await createDraft(adminA.client, tenantA);

    const missingAmount = await adminA.client.from('preschool_fee_item_versions')
      .update({ amount: null }).eq('id', draft.itemVersionId);
    await requireNoError(missingAmount.error, 'prepare missing amount');
    const missingAmountPublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(missingAmountPublish.error?.message).toContain('FEE_PROGRAM_FIXED_FEE_INVALID');
    const missingCurrency = await adminA.client.from('preschool_fee_item_versions')
      .update({ amount: 0, currency: null }).eq('id', draft.itemVersionId);
    await requireNoError(missingCurrency.error, 'prepare missing currency');
    const missingCurrencyPublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(missingCurrencyPublish.error?.message).toContain('FEE_PROGRAM_FIXED_FEE_INVALID');
    const negativeAmount = await adminA.client.from('preschool_fee_item_versions')
      .update({ amount: -1 }).eq('id', draft.itemVersionId);
    expect(negativeAmount.error?.code).toBe('23514');
    await observer.query("UPDATE public.preschool_fee_item_versions SET amount='NaN'::numeric WHERE id=$1", [draft.itemVersionId]);
    const nanPublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(nanPublish.error?.message).toContain('FEE_PROGRAM_FIXED_FEE_INVALID');
    const invalidCurrency = await adminA.client.from('preschool_fee_item_versions')
      .update({ amount: 123456, currency: 'ZZZ' }).eq('id', draft.itemVersionId);
    await requireNoError(invalidCurrency.error, 'prepare invalid currency');
    const invalidCurrencyPublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(invalidCurrencyPublish.error?.message).toContain('FEE_PROGRAM_FIXED_FEE_INVALID');
    const unknownType = await adminA.client.from('preschool_fee_item_versions')
      .update({ currency: 'VND', fee_type_code: 'UNKNOWN' }).eq('id', draft.itemVersionId);
    await requireNoError(unknownType.error, 'prepare unknown fee type');
    const unknownTypePublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(unknownTypePublish.error?.message).toContain('FEE_PROGRAM_FEE_TYPE_NOT_DEFINED');
    const afterFailure = await adminA.client.from('preschool_fee_program_versions').select('status')
      .eq('id', draft.programVersionId).single();
    await requireNoError(afterFailure.error, 'verify failed publication rolled back');
    expect(afterFailure.data?.status).toBe('DRAFT');
    const policyAfterFailure = await adminA.client.from('preschool_billing_period_policy_versions')
      .select('status').eq('id', draft.policyId).single();
    await requireNoError(policyAfterFailure.error, 'verify failed publication did not publish policy');
    expect(policyAfterFailure.data?.status).toBe('DRAFT');
    const itemAfterFailure = await adminA.client.from('preschool_fee_item_versions')
      .select('status,fee_item_name_snapshot,fee_type_name_snapshot').eq('id', draft.itemVersionId).single();
    await requireNoError(itemAfterFailure.error, 'verify failed publication did not snapshot item');
    expect(itemAfterFailure.data).toEqual({ status: 'DRAFT', fee_item_name_snapshot: null, fee_type_name_snapshot: null });
    const inactiveType = await adminA.client.from('preschool_fixed_fee_types').update({ status: 'INACTIVE' }).eq('id', draft.feeTypeId);
    await requireNoError(inactiveType.error, 'deactivate fee type');
    const restoreType = await adminA.client.from('preschool_fee_item_versions')
      .update({ fee_type_code: draft.typeCode, amount: 0 }).eq('id', draft.itemVersionId);
    await requireNoError(restoreType.error, 'restore approved tenant fee type');
    const inactiveTypePublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(inactiveTypePublish.error?.message).toContain('FEE_PROGRAM_FEE_TYPE_NOT_DEFINED');
    const reactivateType = await adminA.client.from('preschool_fixed_fee_types').update({ status: 'ACTIVE' }).eq('id', draft.feeTypeId);
    await requireNoError(reactivateType.error, 'reactivate fee type');
    const emptyName = await adminA.client.from('preschool_fee_items')
      .insert({ tenant_id: tenantA, display_name: '  ' });
    expect(emptyName.error?.code).toBe('23514');

    const grants = await observer.query(`SELECT
      has_function_privilege('anon', 'public.preschool_publish_fee_program_version(uuid)', 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', 'public.preschool_publish_fee_program_version(uuid)', 'EXECUTE') AS authenticated_execute`);
    expect(grants.rows[0]).toEqual({ anon_execute: false, authenticated_execute: true });
    const tableGrants = await observer.query(`SELECT bool_and(
      NOT has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      AND NOT has_table_privilege('authenticated', c.oid, 'REFERENCES')
      AND NOT has_table_privilege('authenticated', c.oid, 'TRIGGER')
      AND NOT has_table_privilege('authenticated', c.oid, 'MAINTAIN')
    ) AS restricted, count(*)::integer AS tables
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (
      'preschool_fee_programs','preschool_fee_items','preschool_billing_period_policy_versions',
      'preschool_fee_item_versions','preschool_fee_program_versions',
      'preschool_fee_program_version_items','preschool_fixed_fee_types'
    )`);
    expect(tableGrants.rows[0]).toEqual({ restricted: true, tables: 7 });

    const published = await publishFeeProgramVersion(adminA.client, draft.programVersionId);
    expect(published).toMatchObject({ status: 'PUBLISHED', duplicate: false, programVersionId: draft.programVersionId });
    const replay = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    await requireNoError(replay.error, 'replay publication');
    expect(replay.data).toMatchObject({ status: 'PUBLISHED', duplicate: true, programVersionId: draft.programVersionId });

    const state = await adminA.client.from('preschool_fee_program_versions').select('status,published_by').eq('id', draft.programVersionId).single();
    await requireNoError(state.error, 'read published version');
    expect(state.data).toMatchObject({ status: 'PUBLISHED', published_by: adminA.id });
    const publishedPolicy = await adminA.client.from('preschool_billing_period_policy_versions')
      .select('status,published_by').eq('id', draft.policyId).single();
    await requireNoError(publishedPolicy.error, 'read published policy');
    expect(publishedPolicy.data).toMatchObject({ status: 'PUBLISHED', published_by: adminA.id });
    const publishedItem = await adminA.client.from('preschool_fee_item_versions')
      .select('status,published_by,fee_item_name_snapshot,fee_type_name_snapshot').eq('id', draft.itemVersionId).single();
    await requireNoError(publishedItem.error, 'read published fee item');
    expect(publishedItem.data).toMatchObject({ status: 'PUBLISHED', published_by: adminA.id, fee_type_name_snapshot: 'Controlled fixed fee type' });
    expect(publishedItem.data?.fee_item_name_snapshot).toMatch(/^Controlled /);
    const renamedType = await adminA.client.from('preschool_fixed_fee_types')
      .update({ display_name: 'Renamed fixed fee type' }).eq('id', draft.feeTypeId);
    await requireNoError(renamedType.error, 'rename fee type');
    const snapshotReadback = await adminA.client.from('preschool_fee_item_versions')
      .select('fee_type_name_snapshot').eq('id', draft.itemVersionId).single();
    await requireNoError(snapshotReadback.error, 'read historical fee type snapshot');
    expect(snapshotReadback.data?.fee_type_name_snapshot).toBe('Controlled fixed fee type');
    const initialMembership = await adminA.client.from('preschool_fee_program_version_items')
      .select('fee_item_version_id').eq('program_version_id', draft.programVersionId);
    await requireNoError(initialMembership.error, 'read published membership');
    expect(initialMembership.data).toEqual([{ fee_item_version_id: draft.itemVersionId }]);
    const immutableAttempt = await adminA.client.from('preschool_fee_program_versions')
      .update({ applicability: { changed: true } }).eq('id', draft.programVersionId).select('id');
    await requireNoError(immutableAttempt.error, 'attempt published mutation');
    expect(immutableAttempt.data).toEqual([]);
    const stillPublished = await adminA.client.from('preschool_fee_program_versions').select('status,applicability')
      .eq('id', draft.programVersionId).single();
    await requireNoError(stillPublished.error, 'verify immutable version');
    expect(stillPublished.data).toEqual({ status: 'PUBLISHED', applicability: {} });
    const lateMembership = await adminA.client.from('preschool_fee_program_version_items').insert({
      tenant_id: tenantA, program_version_id: draft.programVersionId, fee_item_version_id: randomUUID(),
    });
    expect(lateMembership.error?.code).toBe('55000');
    expect(lateMembership.error?.message).toContain('FEE_PROGRAM_MEMBERSHIP_FROZEN');

    const anonClient = createClient<Database>(process.env.PRESCHOOL_FEE_PROGRAM_API_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonCall = await anonClient.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(anonCall.error).toBeTruthy();
    const serviceRoleClient = createClient<Database>(process.env.PRESCHOOL_FEE_PROGRAM_API_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const serviceRoleCall = await serviceRoleClient.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(serviceRoleCall.error?.code).toBe('42501');

    const staffCall = await staffA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(staffCall.error?.code).toBe('42501');
    const staffRead = await staffA.client.from('preschool_fee_programs').select('id').eq('id', draft.programId);
    await requireNoError(staffRead.error, 'staff isolation read');
    expect(staffRead.data).toEqual([]);
    const staffType = await staffA.client.from('preschool_fixed_fee_types')
      .insert({ tenant_id: tenantA, code: 'STAFF_TYPE', display_name: 'Staff type' });
    expect(staffType.error).toBeTruthy();

    const crossTenantRead = await adminB.client.from('preschool_fee_programs').select('id').eq('id', draft.programId);
    await requireNoError(crossTenantRead.error, 'cross-tenant read');
    expect(crossTenantRead.data).toEqual([]);
    const crossTenantType = await adminB.client.from('preschool_fixed_fee_types').select('id').eq('id', draft.feeTypeId);
    await requireNoError(crossTenantType.error, 'cross-tenant fee type read');
    expect(crossTenantType.data).toEqual([]);
    const crossTenantPublish = await adminB.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: draft.programVersionId });
    expect(crossTenantPublish.error?.code).toBe('P0002');

    const secondVersion = await adminA.client.from('preschool_fee_program_versions').insert({
      tenant_id: tenantA, fee_program_id: draft.programId, billing_period_policy_version_id: draft.policyId,
      applicability: {}, effective_applicability: {},
    }).select('id').single();
    await requireNoError(secondVersion.error, 'create version reusing published references');
    const secondVersionRow = requireData(secondVersion.data, 'create version reusing published references');
    const reusedMembership = await adminA.client.from('preschool_fee_program_version_items').insert({
      tenant_id: tenantA, program_version_id: secondVersionRow.id, fee_item_version_id: draft.itemVersionId,
    });
    await requireNoError(reusedMembership.error, 'reuse published fee item version');
    const superPublish = await superAdminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: secondVersionRow.id });
    await requireNoError(superPublish.error, 'publish as tenant Super Admin');
    expect(superPublish.data).toMatchObject({ status: 'PUBLISHED', duplicate: false, programVersionId: secondVersionRow.id });

    const pendingPolicy = await adminA.client.from('preschool_fee_program_versions').insert({
      tenant_id: tenantA, fee_program_id: draft.programId, billing_period_policy_version_id: null,
      applicability: {}, effective_applicability: {},
    }).select('id').single();
    await requireNoError(pendingPolicy.error, 'create version with policy pending');
    const pendingRow = requireData(pendingPolicy.data, 'create version with policy pending');
    const pendingMembership = await adminA.client.from('preschool_fee_program_version_items').insert({
      tenant_id: tenantA, program_version_id: pendingRow.id, fee_item_version_id: draft.itemVersionId,
    });
    await requireNoError(pendingMembership.error, 'link item to pending-policy version');
    const pendingPublish = await adminA.client.rpc('preschool_publish_fee_program_version', { p_program_version_id: pendingRow.id });
    await requireNoError(pendingPublish.error, 'publish with policy pending');
    expect(pendingPublish.data).toMatchObject({ status: 'PUBLISHED', billingPeriodPolicyVersionId: null, duplicate: false });
    const pendingReadback = await adminA.client.from('preschool_fee_program_versions')
      .select('status,billing_period_policy_version_id').eq('id', pendingRow.id).single();
    await requireNoError(pendingReadback.error, 'read pending-policy publication');
    expect(pendingReadback.data).toEqual({ status: 'PUBLISHED', billing_period_policy_version_id: null });
    const attemptPin = await adminA.client.from('preschool_fee_program_versions')
      .update({ billing_period_policy_version_id: draft.policyId }).eq('id', pendingRow.id).select('id');
    await requireNoError(attemptPin.error, 'attempt to alter published pending-policy version');
    expect(attemptPin.data).toEqual([]);

    const excluded = await observer.query(`SELECT
      to_regprocedure('public.preschool_fee_program_resolve(uuid,jsonb,jsonb,uuid[])') AS resolver,
      to_regclass('public.preschool_enrollment_fee_bindings') AS bindings,
      to_regclass('public.preschool_fee_period_assessment_snapshots') AS snapshots`);
    expect(excluded.rows[0]).toEqual({ resolver: null, bindings: null, snapshots: null });
  });
});
