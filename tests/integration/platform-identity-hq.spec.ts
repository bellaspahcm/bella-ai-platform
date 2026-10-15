import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { saleChainConnection } from '@/modules/bella-auto/services/AutoMoveSaleChainConnection';

let mockClient: SupabaseClient<Database>;
const mockGetCache = jest.fn();
jest.mock('server-only', () => ({}), { virtual: true });
// Only the Next request/cookie adapter is replaced. Auth, PostgREST and RLS are real.
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('@/lib/revalidate', () => ({ safeRevalidatePath: jest.fn() }));
jest.mock('@/services/audit-actions', () => ({ recordAuditLog: jest.fn() }));
jest.mock('@/lib/redis-cache', () => ({
  getCache: (...args: unknown[]) => mockGetCache(...args),
  setCache: jest.fn(), CacheKeys: { user: (id: string) => `user:${id}` },
}));

import { getCurrentUser } from '@/services/user-actions';
import { checkHqAuth } from '@/services/hq-actions';

jest.setTimeout(180000);

async function acquireFixtureLock(connection: Pick<Client, 'query'>) {
  await connection.query('begin');
  await connection.query("set local statement_timeout='30s'");
  await connection.query('select pg_advisory_xact_lock($1,$2)', [1720626327, 571]);
}

it('holds the shared-fixture lock inside a dedicated transaction, including with transaction pooling', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  await acquireFixtureLock({ query });
  expect(query.mock.calls).toEqual([
    ['begin'], ["set local statement_timeout='30s'"],
    ['select pg_advisory_xact_lock($1,$2)', [1720626327, 571]],
  ]);
});

it('enforces live authority through real Auth, application functions and database RLS', async () => {
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  expect(new URL(api).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(process.env.ALLOW_E2E_PLATFORM_IDENTITY_VERIFICATION).toBe('1');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !adminKey) throw new Error('Real Auth proof requires E2E public and service keys.');
  const config = saleChainConnection(process.env.SUPABASE_DB_URL || process.env.DB_URL || '', api);
  const db = new Client(config);
  const lockDb = new Client(config);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient<Database>(api, adminKey, options);
  mockClient = createClient<Database>(api, key, options);
  // Owner-approved reusable E2E shells: append-only timeline rules prevent tenant deletion.
  const tenants = ['3a2e462c-5f7a-441c-8b28-3a3752c37d95', '064994d5-d50c-4322-afa6-5b53ecf270a9'];
  const actors: string[] = [];
  const marker = `identity-runtime-${randomUUID()}`;
  const password = randomBytes(32).toString('hex');
  let connected = false;
  let lockConnected = false;
  let fixtureLock = false;
  const failures: unknown[] = [];

  try {
    await lockDb.connect(); lockConnected = true;
    // A dedicated open transaction pins the lock even through transaction pooling.
    await acquireFixtureLock(lockDb);
    fixtureLock = true;
    await db.connect(); connected = true;
    await db.query("set statement_timeout='30s'");
    await db.query('begin');
    try {
      expect((await db.query('select pg_try_advisory_xact_lock($1,$2) as acquired', [1720626327, 571])).rows)
        .toEqual([{ acquired: false }]);
    } finally { await db.query('rollback'); }
    expect((await db.query('select version from supabase_migrations.schema_migrations where version=any($1::text[])',
      [['20261015040000', '20261015040100']])).rowCount).toBe(2);
    const email = `${marker}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { role: 'admin', tenant_id: tenants[1], product_key: 'bella_hq', status: 'active' } });
    if (created.error || !created.data.user) throw new Error('Failed to create E2E Auth identity.');
    const actor = created.data.user.id;
    actors.push(actor);
    await db.query('begin');
    try {
      await db.query(`insert into public.tenants(id,name,status,product_key)
        values ($1,'Bella Spa Headquarter','active','bella_auto'),($2,'Platform identity E2E HQ','active','bella_hq')
        on conflict(id) do update set name=excluded.name,status=excluded.status,product_key=excluded.product_key`, tenants);
      await db.query(`insert into public.users(id,email,full_name,role,status,tenant_id)
        values ($1,$2,$3,'accountant','active',$4) on conflict(id) do update
        set role='accountant',status='active',tenant_id=excluded.tenant_id`, [actor, email, marker, tenants[0]]);
      await db.query('commit');
    } catch (error: unknown) { await db.query('rollback'); throw error; }

    const signedIn = await mockClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw new Error('Real E2E Auth login failed.');
    const token = signedIn.data.session.access_token;
    expect(signedIn.data.user?.app_metadata.role).toBe('admin');
    mockGetCache.mockResolvedValue({ id: actor, role: 'admin', tenant_id: tenants[1] });

    expect(await getCurrentUser()).toEqual(expect.objectContaining({ id: actor, role: 'accountant', tenant_id: tenants[0] }));
    expect((await checkHqAuth()).authorized).toBe(false);
    const ownTenant = await mockClient.from('tenants').select('id').in('id', tenants);
    expect(ownTenant.error).toBeNull();
    expect(ownTenant.data).toEqual([{ id: tenants[0] }]);
    expect((await mockClient.rpc('get_auth_tenant_id')).data).toBe(tenants[0]);
    expect((await mockClient.rpc('is_admin')).data).toBe(false);

    await db.query("update public.users set role='admin' where id=$1", [actor]);
    expect((await checkHqAuth()).authorized).toBe(false); // Old HQ name is not HQ identity.
    await db.query('update public.users set tenant_id=$2 where id=$1', [actor, tenants[1]]);
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'admin', tenant_id: tenants[1] }));
    expect((await checkHqAuth()).authorized).toBe(true); // Renamed HQ is canonical.
    expect((await mockClient.rpc('get_auth_tenant_id')).data).toBe(tenants[1]);
    const hqTenants = await mockClient.from('tenants').select('id').in('id', tenants).order('id');
    expect(hqTenants.error).toBeNull();
    expect(hqTenants.data).toEqual(tenants.slice().sort().map(id => ({ id })));
    const hqUpdate = await mockClient.from('tenants').update({ name: `${marker}-managed` }).eq('id', tenants[0]).select('id');
    expect(hqUpdate.error).toBeNull();
    expect(hqUpdate.data).toEqual([{ id: tenants[0] }]);

    for (const status of ['suspended', 'terminated']) {
      await db.query('update public.tenants set status=$2 where id=$1', [tenants[1], status]);
      expect(await getCurrentUser()).toBeNull();
      expect((await checkHqAuth()).authorized).toBe(false);
      expect((await mockClient.rpc('get_auth_tenant_id')).error?.code).toBe('42501');
    }
    await db.query("update public.tenants set status='active' where id=$1", [tenants[1]]);
    expect((await checkHqAuth()).authorized).toBe(true);
    await db.query("update public.users set status='inactive' where id=$1", [actor]);
    expect(await getCurrentUser()).toBeNull();
    expect((await checkHqAuth()).authorized).toBe(false);
    expect((await mockClient.from('tenants').select('id').in('id', tenants)).error?.code).toBe('42501');
    await db.query("update public.users set status='active',role='hr' where id=$1", [actor]);
    expect(await getCurrentUser()).toEqual(expect.objectContaining({ role: 'hr' }));
    expect((await checkHqAuth()).authorized).toBe(false);
    await db.query('update public.users set tenant_id=null where id=$1', [actor]);
    expect(await getCurrentUser()).toBeNull();
    await db.query('delete from public.users where id=$1', [actor]);
    expect(await getCurrentUser()).toBeNull();
    expect((await mockClient.auth.getUser()).data.user?.id).toBe(actor); // Auth alone is insufficient.
    expect((await mockClient.auth.getSession()).data.session?.access_token).toBe(token);
    expect(mockGetCache).not.toHaveBeenCalled();
    await mockClient.auth.signOut({ scope: 'local' });
    expect(await getCurrentUser()).toBeNull();
  } catch (error: unknown) {
    failures.push(error);
  } finally {
    // HTTP fixtures need committed rows. Cleanup is explicit, not called a transaction rollback.
    for (const actor of actors) {
      try {
        const removed = await admin.auth.admin.deleteUser(actor);
        if (removed.error) throw new Error('Failed to clean up E2E Auth fixture.');
      } catch (error: unknown) { failures.push(error); }
    }
    try {
      if (connected && fixtureLock) {
        await db.query('rollback');
        await db.query('delete from public.users where id=any($1::uuid[])', [actors]);
        await db.query("update public.tenants set status='suspended' where id=any($1::uuid[])", [tenants]);
        for (const table of ['public.users', 'auth.users']) {
          expect((await db.query(`select id from ${table} where id=any($1::uuid[])`, [actors])).rows).toEqual([]);
        }
        const shells = await db.query('select status from public.tenants where id=any($1::uuid[])', [tenants]);
        expect(shells.rows).toEqual([{ status: 'suspended' }, { status: 'suspended' }]);
        console.log('PLATFORM_IDENTITY_REAL_AUTH_ACTORS=0 REUSABLE_TENANT_SHELLS=2_SUSPENDED');
      }
    } catch (error: unknown) { failures.push(error); }
    finally {
      try { await db.end(); }
      finally {
        try { if (lockConnected) await lockDb.query('rollback'); }
        finally { await lockDb.end(); }
      }
    }
  }
  if (failures.length) throw new AggregateError(failures, failures.map(error => error instanceof Error ? error.message : 'Verification/cleanup failed').join('\n'));
  console.log('PLATFORM_IDENTITY_REAL_AUTH_APP=PASS');
});
