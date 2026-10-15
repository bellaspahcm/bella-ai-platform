import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(apiUrl).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co', 'Only authorized E2E is allowed.');
assert.equal(process.env.ALLOW_E2E_PLATFORM_IDENTITY_VERIFICATION, '1');
const db = new Client(saleChainConnection(process.env.SUPABASE_DB_URL || process.env.DB_URL || '', apiUrl));
const migration = 'supabase/migrations/20261015040000_align_platform_identity_hq_authority.sql';
const hqMigration = 'supabase/migrations/20261015040100_preserve_explicit_active_hq_tenant_management.sql';
const hqPolicies = ['platform_active_hq_tenant_select', 'platform_active_hq_tenant_update'];
const helpers = ['get_auth_tenant_id', 'is_admin', 'is_hr', 'is_accountant', 'is_hq_admin', 'is_hq_super_admin'];
const tenants = [randomUUID(), randomUUID()];
const actors = { a: randomUUID(), b: randomUUID(), noTenant: randomUUID(), noProfile: randomUUID() };
const customers = [randomUUID(), randomUUID()], leads = [randomUUID(), randomUUID()];
const marker = `platform-identity-${randomUUID()}`;
const rehearse = process.argv.includes('--test-migration');
let assertions = 0;

function check(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  assertions++;
}

async function fingerprint() {
  return {
    functions: (await db.query(`select p.proname,p.proowner,p.proacl::text,p.prorettype,p.proargtypes::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any($1::text[]) order by p.proname`, [helpers])).rows,
    policies: (await db.query(`select * from pg_policies
      where not (schemaname='public' and tablename='tenants' and policyname=any($1::text[]))
      order by schemaname,tablename,policyname`, [hqPolicies])).rows,
    grants: (await db.query(`select c.oid,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.oid`)).rows,
  };
}

async function context(actor: string | null) {
  await db.query('reset role');
  await db.query('set local role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.jwt.claims',$2,true)`, [actor || '', JSON.stringify({ sub: actor,
    role: 'authenticated', app_metadata: { tenant_id: tenants[1], role: 'admin', product_key: 'bella_hq', status: 'active' } })]);
}

async function denied(sql: string, values: unknown[] = []) {
  await db.query('savepoint denied_probe');
  let failure: unknown;
  try { await db.query(sql, values); } catch (error: unknown) { failure = error; }
  await db.query('rollback to savepoint denied_probe');
  await db.query('release savepoint denied_probe');
  assert.ok(failure && typeof failure === 'object' && 'code' in failure && failure.code === '42501',
    'Expected permission denial, not a configuration/schema failure.');
  assertions++;
}

async function roles(expected: boolean[]) {
  const row = (await db.query(`select public.is_admin() as admin,public.is_hr() as hr,
    public.is_accountant() as accountant,public.is_hq_admin() as hq,public.is_hq_super_admin() as hq_super`)).rows[0];
  check(Object.values(row), expected, 'Live role and HQ authority');
}

async function isolated(tenant: string, hq = false) {
  check((await db.query('select public.get_auth_tenant_id() as id')).rows, [{ id: tenant }], 'Real tenant, never HQ NULL');
  check((await db.query('select id from public.tenants where id=any($1::uuid[]) order by id', [tenants])).rows,
    hq ? tenants.map(id => ({ id })).sort((a, b) => a.id.localeCompare(b.id)) : [{ id: tenant }], 'Only explicit HQ can manage Platform tenants');
  check((await db.query('select tenant_id from public.auto_leads where id=any($1::uuid[])', [leads])).rows,
    [{ tenant_id: tenant }], 'No implicit HQ bypass of AutoMove');
}

async function seed() {
  await db.query(`insert into public.tenants(id,name,status,product_key)
    values ($1,'Bella Spa Headquarter','active','bella_auto'),($2,$3,'active','bella_hq')`, [...tenants, marker]);
  for (const [key, actor] of Object.entries(actors)) {
    await db.query(`insert into auth.users(id,email,role,aud,raw_app_meta_data,raw_user_meta_data)
      values ($1,$2,'authenticated','authenticated','{}','{}')`, [actor, `${marker}-${key}@example.test`]);
    if (key !== 'noProfile') {
      await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
        values ($1,$2,$3,$4,'admin','active')`,
      [actor, `${marker}-${key}@example.test`, marker, key === 'noTenant' ? null : tenants[key === 'b' ? 1 : 0]]);
    }
  }
  for (const [i, tenant] of tenants.entries()) {
    await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)',
      [customers[i], tenant, marker, randomUUID()]);
    await db.query('insert into public.auto_leads(id,tenant_id,customer_id,notes) values ($1,$2,$3,$4)',
      [leads[i], tenant, customers[i], marker]);
  }
}

async function runtimeProof() {
  await context(actors.a);
  await roles([true, false, false, false, false]);
  await isolated(tenants[0]); // A has the old HQ name but is not HQ.
  await context(actors.b);
  await roles([true, false, false, true, true]);
  await isolated(tenants[1], true); // B is HQ with a different name.
  await db.query('savepoint hq_update');
  check((await db.query('update public.tenants set name=$2 where id=$1 returning id', [tenants[0], `${marker}-managed`])).rows,
    [{ id: tenants[0] }], 'Explicit HQ can update another Platform tenant');
  await db.query('rollback to savepoint hq_update');
  await db.query('release savepoint hq_update');
  check((await db.query('update public.auto_leads set notes=$2 where id=$1 returning id', [leads[0], marker])).rows,
    [], 'Explicit Platform HQ exception does not authorize AutoMove UPDATE across tenants');

  for (const role of ['accountant', 'hr', 'ktv']) {
    await db.query('reset role');
    await db.query('update public.users set role=$2 where id=$1', [actors.a, role]);
    await context(actors.a);
    await roles([false, role === 'hr', role === 'accountant', false, false]);
    await isolated(tenants[0]);
    check((await db.query('update public.tenants set name=$2 where id=$1 returning id', [tenants[1], marker])).rows,
      [], 'Non-HQ cannot update another tenant');
  }

  await db.query('reset role');
  await db.query("update public.users set status='inactive' where id=$1", [actors.a]);
  for (const actor of [actors.a, actors.noTenant, actors.noProfile, null]) {
    await context(actor);
    await roles([false, false, false, false, false]);
    await denied('select public.get_auth_tenant_id()');
    await denied('select id from public.tenants where id=any($1::uuid[])', [tenants]);
  }

  await db.query('reset role');
  await db.query("update public.users set status='inactive' where id=$1", [actors.b]);
  await context(actors.b);
  await roles([false, false, false, false, false]);
  await denied('update public.tenants set name=$2 where id=$1 returning id', [tenants[0], marker]);
  await db.query('reset role');
  await db.query("update public.users set status='active' where id=$1", [actors.b]);

  for (const status of ['suspended', 'terminated']) {
    await db.query('reset role');
    await db.query('update public.tenants set status=$2 where id=$1', [tenants[1], status]);
    await context(actors.b);
    await roles([false, false, false, false, false]);
    await denied('select public.get_auth_tenant_id()');
  }

  await db.query('reset role');
  await db.query("update public.tenants set status='active' where id=$1", [tenants[1]]);
  await db.query("update public.users set status='active',role='accountant',tenant_id=$2 where id=$1", [actors.a, tenants[1]]);
  await context(actors.a);
  await roles([false, false, true, false, false]);
  await isolated(tenants[1]);
  await context(actors.b);
  await roles([true, false, false, true, true]);
  await db.query('reset role');
}

async function main() {
  await db.connect();
  try {
    const before = await fingerprint();
    check(before.functions.length, helpers.length, 'Existing helper signatures required');
    const definitionsBefore = (await db.query(`select pg_get_functiondef(p.oid) as body from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname=any($1::text[]) order by p.proname`, [helpers])).rows;
    await db.query('begin');
    try {
      if (rehearse) {
        await db.query(readFileSync(migration, 'utf8'));
        await db.query(readFileSync(migration, 'utf8'));
        await db.query(readFileSync(hqMigration, 'utf8'));
        await db.query(readFileSync(hqMigration, 'utf8'));
      } else {
        check((await db.query('select version from supabase_migrations.schema_migrations where version=any($1::text[])',
          [['20261015040000', '20261015040100']])).rowCount, 2, 'Durable migration history');
      }
      check(await fingerprint(), before, 'Owners, signatures, ACLs, policies and table privileges unchanged');
      check((await db.query(`select policyname,cmd,roles::text[],qual,with_check from pg_policies
        where schemaname='public' and tablename='tenants' and policyname=any($1::text[]) order by policyname`,
      [hqPolicies])).rows, [
        { policyname: hqPolicies[0], cmd: 'SELECT', roles: ['authenticated'], qual: 'is_hq_super_admin()', with_check: null },
        { policyname: hqPolicies[1], cmd: 'UPDATE', roles: ['authenticated'], qual: 'is_hq_super_admin()', with_check: 'is_hq_super_admin()' },
      ], 'Exactly scoped explicit HQ policies');
      await seed();
      await runtimeProof();
    } finally {
      await db.query('rollback');
    }
    check(await fingerprint(), before, 'Rollback preserves database security metadata');
    check((await db.query(`select pg_get_functiondef(p.oid) as body from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname=any($1::text[]) order by p.proname`, [helpers])).rows, definitionsBefore, 'Rollback preserves helper definitions');
    for (const table of ['public.users', 'auth.users']) {
      check((await db.query(`select id from ${table} where id=any($1::uuid[])`, [Object.values(actors)])).rows, [], 'No actor fixture remains');
    }
    for (const [table, ids] of [['tenants', tenants], ['customers', customers], ['auto_leads', leads]] as const) {
      check((await db.query(`select id from public.${table} where id=any($1::uuid[])`, [ids])).rows, [], `No ${table} fixture remains`);
    }
    console.log(`PLATFORM_IDENTITY_HQ=${rehearse ? 'PASS_ROLLBACK_REHEARSAL' : 'PASS_DURABLE_E2E'} ASSERTIONS=${assertions} FIXTURES=0`);
  } finally { await db.end(); }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Verification failed'); process.exitCode = 1; });
