import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

// Owner-approved contract, not inferred from the historical NULL-tenant policy:
// authenticated + active profile + matching active tenant. No HQ/global bypass.
// Fixtures and optional migration rehearsal are always rolled back.
const tables = ['auto_brands', 'auto_models', 'auto_variants'] as const;
const migrationPath = 'supabase/migrations/20261015010000_authorize_automove_catalog_tenant_reads.sql';
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(apiUrl).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co', 'Only the authorized E2E project is allowed.');
assert.equal(process.env.ALLOW_E2E_CATALOG_VERIFICATION, '1', 'Explicit Non-Production verification authorization is required.');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', apiUrl));
const rehearse = process.argv.includes('--test-migration');
const marker = `automove-catalog-${randomUUID()}`;
let inTransaction = false;

async function fingerprint() {
  const grants = await db.query(`select c.relname,e.grantor,e.grantee,e.privilege_type,e.is_grantable
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) e
    where n.nspname='public' and c.relname=any($1::text[]) and e.privilege_type<>'SELECT'
    order by c.relname,e.grantor,e.grantee,e.privilege_type,e.is_grantable`, [tables]);
  const columnGrants = await db.query(`select c.relname,a.attname,a.attacl::text
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[]) and a.attnum>0 and not a.attisdropped
    order by c.relname,a.attnum`, [tables]);
  const policies = await db.query(`select tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies where schemaname='public' and tablename=any($1::text[]) and cmd<>'SELECT'
    order by tablename,policyname`, [tables]);
  const helpers = await db.query(`select p.proname,pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_auth_tenant_id','is_hq_super_admin','mobility_tenant_access_allowed')
    order by p.proname`);
  return { grants: grants.rows, columnGrants: columnGrants.rows, policies: policies.rows, helpers: helpers.rows };
}

async function context(userId: string | null, role: 'authenticated' | 'anon' = 'authenticated', claimedTenant?: string) {
  await db.query('reset role');
  await db.query(`set local role ${role}`);
  await db.query('set local row_security=on');
  await db.query(`select set_config('request.jwt.claim.sub',$1,true),
    set_config('request.jwt.claim.role',$2,true),set_config('request.jwt.claims',$3,true)`, [userId || '', role,
    JSON.stringify({ ...(userId ? { sub: userId } : {}), role,
      ...(claimedTenant ? { app_metadata: { tenant_id: claimedTenant, role: 'accountant' } } : {}) })]);
}

async function deniedSql(operation: () => Promise<unknown>, code: string) {
  await db.query('savepoint denied_sql');
  let caught: unknown;
  try { await operation(); } catch (error: unknown) { caught = error; }
  await db.query('rollback to savepoint denied_sql');
  await db.query('release savepoint denied_sql');
  assert.ok(caught && typeof caught === 'object' && 'code' in caught && caught.code === code,
    `Expected PostgreSQL ${code}, not a configuration/schema failure.`);
}

async function verify() {
  await db.connect();
  await db.query('begin'); inTransaction = true;
  await db.query("set local lock_timeout='5s'");
  const before = await fingerprint();
  if (rehearse) {
    const sql = readFileSync(migrationPath, 'utf8');
    await db.query(sql);
    await db.query(sql);
    assert.deepEqual(await fingerprint(), before, 'Migration must preserve write ACLs, column ACLs, write policies and shared helpers.');
    console.log('CATALOG_MIGRATION_REHEARSAL_AND_RETRY=PASS');
  } else {
    const history = await db.query("select version from supabase_migrations.schema_migrations where version='20261015010000'");
    assert.equal(history.rowCount, 1, 'Catalog migration must be durably recorded by the existing E2E applier.');
  }
  const guards = await db.query(`select tablename,policyname,permissive,cmd,roles from pg_policies
    where schemaname='public' and tablename=any($1::text[]) and policyname=tablename||'_tenant_read_guard'
    order by tablename`, [tables]);
  assert.equal(guards.rowCount, 3);
  for (const row of guards.rows) {
    assert.equal(row.permissive, 'RESTRICTIVE'); assert.equal(row.cmd, 'SELECT');
    assert.deepEqual(row.roles, '{authenticated}');
  }
  const grants = await db.query(`select c.relname,c.relrowsecurity,
    has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
    has_any_column_privilege('anon',c.oid,'SELECT') as anon_select
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[])`, [tables]);
  assert.equal(grants.rowCount, 3);
  for (const row of grants.rows) {
    assert.equal(row.relrowsecurity, true); assert.equal(row.authenticated_select, true); assert.equal(row.anon_select, false);
  }

  const tenantA = randomUUID(), tenantB = randomUUID(), suspended = randomUUID(), terminated = randomUUID();
  const hq = randomUUID();
  await db.query(`insert into public.tenants(id,name,status) values
    ($1,$5,'active'),($2,$6,'active'),($3,$7,'suspended'),($4,$8,'terminated')`,
    [tenantA, tenantB, suspended, terminated, `${marker}-A`, `${marker}-B`, `${marker}-suspended`, `${marker}-terminated`]);
  // Sealed Platform identity contract: HQ is a product identity, not a name.
  await db.query("insert into public.tenants(id,name,status,product_key) values ($1,$2,'active','bella_hq')", [hq, `${marker}-HQ`]);
  const userA = randomUUID(), userB = randomUUID(), inactive = randomUUID(), noTenant = randomUUID();
  const suspendedUser = randomUUID(), terminatedUser = randomUUID(), hqUser = randomUUID(), noProfile = randomUUID();
  const actorIds = [userA, userB, inactive, noTenant, suspendedUser, terminatedUser, hqUser, noProfile];
  for (const id of actorIds) {
    await db.query(`insert into auth.users(id,email,role,aud,raw_app_meta_data,raw_user_meta_data)
      values ($1,$2,'authenticated','authenticated','{}','{}')`, [id, `${marker}-${id}@example.test`]);
  }
  const profiles = [
    [userA, tenantA, 'accountant', 'active'], [userB, tenantB, 'admin', 'active'],
    [inactive, tenantA, 'accountant', 'inactive'], [noTenant, null, 'accountant', 'active'],
    [suspendedUser, suspended, 'accountant', 'active'], [terminatedUser, terminated, 'accountant', 'active'],
    [hqUser, hq, 'admin', 'active'],
  ];
  for (const [id, tenantId, role, status] of profiles) {
    await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
      values ($1,$2,$3,$4,$5,$6) on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`,
      [id, `${marker}-${id}@example.test`, marker, tenantId, role, status]);
  }
  assert.equal((await db.query('select id from public.users where id=$1', [noProfile])).rowCount, 0,
    'The missing-profile negative case must actually have no public profile.');
  const rows = new Map<string, string[]>();
  for (const tenantId of [tenantA, tenantB, suspended, terminated, hq]) {
    const ids = [randomUUID(), randomUUID(), randomUUID()]; rows.set(tenantId, ids);
    await db.query('insert into public.auto_brands(id,tenant_id,name) values ($1,$2,$3)', [ids[0], tenantId, marker]);
    await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [ids[1], tenantId, ids[0], marker]);
    await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [ids[2], tenantId, ids[1], marker]);
  }

  async function read(userId: string | null, ownTenant?: string, claimedTenant?: string) {
    await context(userId, 'authenticated', claimedTenant);
    for (const [index, table] of tables.entries()) {
      const fixtureIds = [...rows.values()].map(ids => ids[index]);
      if (!ownTenant) {
        await deniedSql(() => db.query(`select id from public.${table} where id=any($1::uuid[])`, [fixtureIds]), '42501');
        continue;
      }
      const result = await db.query(`select id,tenant_id from public.${table} where id=any($1::uuid[]) order by id`, [fixtureIds]);
      const expected = [{ id: rows.get(ownTenant)![index], tenant_id: ownTenant }];
      assert.deepEqual(result.rows, expected, `${table} must return exactly the authorized fixture rows, not just HTTP success.`);
    }
    await db.query('reset role');
  }
  await read(userA, tenantA); await read(userB, tenantB);
  console.log('CATALOG_SAME_TENANT_AND_CROSS_TENANT_ROWS=PASS');
  for (const actor of [null, noProfile, noTenant, inactive, suspendedUser, terminatedUser]) await read(actor);
  console.log('CATALOG_MISSING_IDENTITY_PROFILE_TENANT_INACTIVE_RLS_DENIED_42501=PASS');
  await context(hqUser);
  assert.equal((await db.query('select public.get_auth_tenant_id() as tenant_id')).rows[0].tenant_id, hq);
  assert.equal((await db.query('select public.is_hq_super_admin() as hq')).rows[0].hq, true);
  await read(hqUser, hq);
  await context(userA, 'authenticated', tenantB);
  for (const table of tables) {
    const result = await db.query(`select id from public.${table} where tenant_id=$1`, [tenantB]);
    assert.equal(result.rowCount, 0, `${table} must reject caller-selected tenant claims.`);
  }
  await db.query('reset role');
  console.log('CATALOG_HQ_AND_CALLER_TENANT_BYPASS_DENIED=PASS');

  await context(null, 'anon');
  for (const table of tables) await deniedSql(() => db.query(`select id from public.${table} limit 1`), '42501');
  await db.query('reset role');
  console.log('CATALOG_ANON_PRIVILEGE_DENIED_42501=PASS');
  await context(userA);
  for (const [index, table] of tables.entries()) {
    await deniedSql(() => db.query(`insert into public.${table}(id) values ($1)`, [randomUUID()]), '42501');
    await deniedSql(() => db.query(`update public.${table} set name=name where id=$1`, [rows.get(tenantA)![index]]), '42501');
    await deniedSql(() => db.query(`delete from public.${table} where id=$1`, [rows.get(tenantA)![index]]), '42501');
  }
  await db.query('reset role');
  assert.deepEqual(await fingerprint(), before, 'Verification must preserve writes and shared helper contracts.');
  console.log('CATALOG_WRITE_ACLS_POLICIES_HELPERS_UNCHANGED=PASS');
  await db.query('rollback'); inTransaction = false;
  for (const table of ['public.users', 'auth.users']) {
    const leftovers = await db.query(`select id from ${table} where id=any($1::uuid[])`, [actorIds]);
    assert.equal(leftovers.rowCount, 0, 'Rolled-back fixture actors must not remain.');
  }
  assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])',
    [[tenantA, tenantB, suspended, terminated, hq]])).rowCount, 0);
  console.log('AUTOMOVE_CATALOG_REAL_DB_RLS=PASS_ROLLBACK');
}

verify().catch(error => {
  console.error('AUTOMOVE_CATALOG_REAL_DB_RLS=FAIL', error instanceof Error ? error.message : 'Unknown verification failure');
  process.exitCode = 1;
}).finally(async () => {
  try { if (inTransaction) await db.query('rollback'); } finally { await db.end(); }
});
