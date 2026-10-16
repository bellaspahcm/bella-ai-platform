import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { createAllocatedBooking } from '../src/modules/bella-auto/services/AutoMoveBookingAllocationService';
import { confirmBookingDeposit } from '../src/modules/bella-auto/services/AutoMoveDepositConfirmationService';

const readTables = ['auto_vehicles', 'auto_leads', 'auto_bookings', 'auto_deposits'] as const;
const writeTables = ['auto_leads', 'auto_bookings', 'auto_deposits'] as const;
const migration = 'supabase/migrations/20261015030000_guard_automove_active_identity_access.sql';
const guardNames = [
  ...readTables.map(table => `${table}_active_identity_select_guard`),
  ...writeTables.map(table => `${table}_active_identity_update_guard`),
];
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(apiUrl).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co', 'Only the authorized E2E project is allowed.');
assert.equal(process.env.ALLOW_E2E_ACTIVE_IDENTITY_VERIFICATION, '1', 'Explicit E2E authorization is required.');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', apiUrl));
const rehearse = process.argv.includes('--test-migration');
const baseline = process.argv.includes('--baseline');
assert.ok(!(rehearse && baseline), 'Select either migration rehearsal or baseline observation.');
const tenants = [randomUUID(), randomUUID()];
const actors = { a: randomUUID(), b: randomUUID(), inactive: randomUUID(), noTenant: randomUUID(), noProfile: randomUUID() };
const rows = [0, 1].map(() => ({
  customer: randomUUID(), brand: randomUUID(), model: randomUUID(), variant: randomUUID(),
  auto_vehicles: randomUUID(), auto_leads: randomUUID(), auto_bookings: randomUUID(), auto_deposits: randomUUID(),
}));
const marker = `automove-active-${randomUUID()}`;
const failures: string[] = [];
let assertions = 0;

function check(actual: unknown, expected: unknown, label: string) {
  assertions++;
  try { assert.deepEqual(actual, expected, label); }
  catch (error: unknown) {
    if (!baseline) throw error;
    failures.push(label);
  }
}

async function fingerprint(includeGuards = false) {
  const relations = await db.query(`select c.relname,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[]) order by c.relname`, [readTables]);
  const columns = await db.query(`select c.relname,a.attname,a.attacl::text
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[]) and a.attnum>0 and not a.attisdropped
    order by c.relname,a.attnum`, [readTables]);
  const policies = await db.query(`select tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies where schemaname='public' and ($2::boolean or not policyname=any($1::text[]))
    order by tablename,policyname`, [guardNames, includeGuards]);
  const helpers = await db.query(`select p.proname,pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('get_auth_tenant_id','is_hq_admin','is_hq_super_admin','mobility_tenant_access_allowed','sync_user_claims_to_auth')
    order by p.proname,p.oid`);
  return { relations: relations.rows, columns: columns.rows, policies: policies.rows, helpers: helpers.rows };
}

async function context(actor: string | null, role: 'authenticated' | 'anon' = 'authenticated', claimedTenant?: string) {
  await db.query('reset role');
  await db.query(`set local role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true),
    set_config('request.jwt.claim','',true),set_config('request.jwt.claims',$3,true)`, [actor || '', role,
    JSON.stringify({ ...(actor ? { sub: actor } : {}), role, app_metadata: {
      tenant_id: claimedTenant || tenants[actor === actors.b ? 1 : 0], role: 'admin', status: 'active', product_key: 'bella_hq',
    } })]);
}

async function expectPermissionDenied(operation: () => Promise<unknown>) {
  await db.query('savepoint denied_operation');
  let caught: unknown;
  try { await operation(); } catch (error: unknown) { caught = error; }
  await db.query('rollback to savepoint denied_operation');
  await db.query('release savepoint denied_operation');
  assert.ok(caught && typeof caught === 'object' && 'code' in caught && caught.code === '42501',
    'Expected permission/RLS denial 42501, not a missing table or configuration error.');
  assertions++;
}

async function seed() {
  for (const [index, tenant] of tenants.entries()) {
    await db.query("insert into public.tenants(id,name,status) values ($1,$2,'active')", [tenant, `${marker}-${index}`]);
  }
  for (const actor of Object.values(actors)) {
    await db.query(`insert into auth.users(id,email,role,aud,raw_app_meta_data,raw_user_meta_data)
      values ($1,$2,'authenticated','authenticated','{}','{}')`, [actor, `${marker}-${actor}@example.test`]);
  }
  for (const [actor, tenant, status] of [
    [actors.a, tenants[0], 'active'], [actors.b, tenants[1], 'active'],
    [actors.inactive, tenants[0], 'inactive'], [actors.noTenant, null, 'active'],
  ]) {
    await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
      values ($1,$2,$3,$4,'accountant',$5)`, [actor, `${marker}-${actor}@example.test`, marker, tenant, status]);
  }
  assert.equal((await db.query('select id from public.users where id=$1', [actors.noProfile])).rowCount, 0,
    'Missing-profile test requires an Auth identity with no canonical public profile.');
  for (const [index, row] of rows.entries()) {
    const tenant = tenants[index];
    await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)',
      [row.customer, tenant, marker, randomUUID()]);
    await db.query('insert into public.auto_brands(id,tenant_id,name) values ($1,$2,$3)', [row.brand, tenant, marker]);
    await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values ($1,$2,$3,$4)',
      [row.model, tenant, row.brand, marker]);
    await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)',
      [row.variant, tenant, row.model, marker]);
    await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status)
      values ($1,$2,$3,$4,'White',2026,'showroom')`,
      [row.auto_vehicles, tenant, row.variant, randomUUID().replaceAll('-', '').slice(0, 17)]);
    await db.query('insert into public.auto_leads(id,tenant_id,customer_id,notes) values ($1,$2,$3,$4)',
      [row.auto_leads, tenant, row.customer, marker]);
    await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,variant_id,vehicle_id,color_exterior,
      booking_number,total_price,deposit_amount,deposit_paid,payment_status,status)
      values ($1,$2,$3,$4,$5,'White',$6,1000000000,100000000,0,'unpaid','pending')`,
      [row.auto_bookings, tenant, row.customer, row.variant, row.auto_vehicles, `${marker}-${index}`]);
    await db.query(`insert into public.auto_deposits(id,tenant_id,booking_id,amount,payment_method,status,created_by,notes)
      values ($1,$2,$3,100000000,'bank_transfer','confirmed',$4,$5)`,
      [row.auto_deposits, tenant, row.auto_bookings, index ? actors.b : actors.a, marker]);
  }
}

async function read(actor: string | null, ownIndex: number | null, label: string, claimedTenant?: string) {
  await context(actor, 'authenticated', claimedTenant);
  for (const table of readTables) {
    const result = await db.query(`select id,tenant_id from public.${table} where id=any($1::uuid[]) order by id`,
      [rows.map(row => row[table])]);
    check(result.rows, ownIndex === null ? [] : [{ id: rows[ownIndex][table], tenant_id: tenants[ownIndex] }], `${label}: ${table} SELECT`);
  }
  await db.query('reset role');
}

async function update(actor: string | null, index: number, allowed: boolean, label: string) {
  await context(actor);
  for (const table of writeTables) {
    const column = table === 'auto_bookings' ? 'metadata' : 'notes';
    const updated = column === 'metadata' ? { probe: marker } : `${marker}-updated`;
    const original = column === 'metadata' ? {} : marker;
    await db.query('savepoint update_probe');
    const result = await db.query(`update public.${table} set ${column}=$2 where id=$1 returning id,${column} as value`,
      [rows[index][table], updated]);
    check(result.rows, allowed ? [{ id: rows[index][table], value: updated }] : [], `${label}: ${table} UPDATE`);
    await db.query('reset role');
    const persisted = await db.query(`select ${column} as value from public.${table} where id=$1`, [rows[index][table]]);
    check(persisted.rows[0]?.value, allowed ? updated : original, `${label}: ${table} persisted value`);
    await db.query('rollback to savepoint update_probe');
    await db.query('release savepoint update_probe');
    await context(actor);
  }
  await db.query('reset role');
}

async function runtimeChecks() {
  await read(actors.a, 0, 'active A'); await read(actors.b, 1, 'active B');
  await update(actors.a, 0, true, 'active A'); await update(actors.b, 1, true, 'active B');
  await update(actors.a, 1, false, 'A cannot update B'); await update(actors.b, 0, false, 'B cannot update A');
  for (const actor of [null, actors.noProfile, actors.noTenant, actors.inactive]) {
    await read(actor, null, 'invalid identity'); await update(actor, 0, false, 'invalid identity');
  }
  for (const status of ['suspended', 'terminated']) {
    await db.query('update public.tenants set status=$2 where id=$1', [tenants[0], status]);
    await read(actors.a, null, status); await update(actors.a, 0, false, status);
  }
  await db.query("update public.tenants set status='active' where id=$1", [tenants[0]]);
  await read(actors.a, 0, 'reactivated tenant');

  // Conflicting SQL JWT metadata must never authorize the other tenant. This is not a forged signed JWT test.
  for (const actor of [actors.a, actors.inactive]) {
    await context(actor, 'authenticated', tenants[1]);
    for (const table of readTables) {
      const result = await db.query(`select id from public.${table} where id=$1`, [rows[1][table]]);
      check(result.rows, [], `conflicting JWT metadata: ${table}`);
    }
  }
  await db.query('reset role');
  await db.query("update public.tenants set product_key='bella_hq' where id=$1", [tenants[1]]);
  await db.query("update public.users set role='admin' where id=$1", [actors.b]);
  await read(actors.b, 1, 'HQ fixture has no cross-tenant bypass');
  await update(actors.b, 0, false, 'HQ cannot update A');

  await context(actors.a);
  for (const table of writeTables) {
    await expectPermissionDenied(() => db.query(`update public.${table} set tenant_id=$2 where id=$1`, [rows[0][table], tenants[1]]));
    await expectPermissionDenied(() => db.query(`delete from public.${table} where id=$1`, [rows[0][table]]));
  }
  await context(null, 'anon');
  for (const table of readTables) {
    await expectPermissionDenied(() => db.query(`select id from public.${table} where id=any($1::uuid[])`, [rows.map(row => row[table])]));
  }
  await db.query('reset role');
}

async function activeFlowRegression() {
  const vehicle = randomUUID(), booking = randomUUID(), receipt = randomUUID();
  const phone = (await db.query('select phone from public.customers where id=$1', [rows[0].customer])).rows[0].phone;
  await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status)
    values ($1,$2,$3,$4,'White',2026,'showroom')`,
    [vehicle, tenants[0], rows[0].variant, randomUUID().replaceAll('-', '').slice(0, 17)]);
  await context(actors.a);
  const intent = { customerId: rows[0].customer, customerPhone: phone, customerName: marker,
    variantId: rows[0].variant, vehicleId: vehicle, colorExterior: 'White',
    totalPrice: 1000000000, depositAmount: 100000000, depositPaid: 0 };
  const first = await createAllocatedBooking(db, actors.a, intent, booking);
  check(first.isDuplicate, false, 'active booking creation');
  check((await createAllocatedBooking(db, actors.a, intent, booking)).isDuplicate, true, 'active booking retry');
  check((await db.query('select status,allocated_to_contract_id from public.auto_vehicles where id=$1', [vehicle])).rows,
    [{ status: 'allocated', allocated_to_contract_id: booking }], 'Mobility allocation read-back');
  const payment = { amount: 20000000, payment_method: 'bank_transfer' };
  check((await confirmBookingDeposit(db, actors.a, booking, receipt, payment)).isDuplicate, false, 'active partial deposit');
  check((await confirmBookingDeposit(db, actors.a, booking, receipt, payment)).isDuplicate, true, 'active deposit retry');
  check((await db.query('select deposit_paid from public.auto_bookings where id=$1', [booking])).rows,
    [{ deposit_paid: '20000000' }], 'deposit retry increments once');
  check((await db.query('select count(*)::int as count from public.auto_deposits where booking_id=$1', [booking])).rows,
    [{ count: 1 }], 'deposit retry creates one receipt');
  await db.query('reset role');
  console.log('ACTIVE_IDENTITY_BOOKING_ALLOCATION_DEPOSIT_RETRY=PASS_REAL_DB');
}

async function cleanupProof() {
  for (const table of ['public.users', 'auth.users']) {
    assert.equal((await db.query(`select id from ${table} where id=any($1::uuid[])`, [Object.values(actors)])).rowCount, 0,
      'Fixture identities must not remain after rollback.');
  }
  assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])', [tenants])).rowCount, 0);
  const fixtureTables = { customers: 'customer', auto_brands: 'brand', auto_models: 'model', auto_variants: 'variant',
    ...Object.fromEntries(readTables.map(table => [table, table])) };
  for (const [table, key] of Object.entries(fixtureTables)) {
    const ids = rows.map(row => row[key as keyof typeof row]);
    assert.equal((await db.query(`select id from public.${table} where id=any($1::uuid[])`, [ids])).rowCount, 0,
      `${table} fixtures must not remain after rollback.`);
  }
  for (const table of [...Object.keys(fixtureTables), 'auto_vehicle_status_logs', 'mobility_domain_events', 'mobility_command_idempotency']) {
    assert.equal((await db.query(`select tenant_id from public.${table} where tenant_id=any($1::uuid[])`, [tenants])).rowCount, 0,
      `${table} must have no residual data for either controlled tenant.`);
  }
  console.log('ACTIVE_IDENTITY_FIXTURE_CLEANUP=PASS_ZERO_REMAINING_TWO_TENANTS');
}

async function verify() {
  await db.connect();
  console.log(`ACTIVE_IDENTITY_VERIFICATION_MODE=${rehearse ? 'MIGRATION_REHEARSAL' : baseline ? 'BASELINE' : 'DURABLE_HISTORY_AND_POLICIES'}_FIXTURES_ROLLBACK`);
  try {
    const original = await fingerprint(true);
    const before = await fingerprint();
    let caught: unknown;
    await db.query('begin isolation level serializable');
    try {
      await db.query("set local lock_timeout='5s'");
      await db.query("set local statement_timeout='30s'");
      await db.query('set local row_security=on');
      const role = await db.query("select rolsuper,rolbypassrls from pg_roles where rolname='authenticated'");
      assert.deepEqual(role.rows, [{ rolsuper: false, rolbypassrls: false }]);
      if (rehearse) {
        const sql = readFileSync(migration, 'utf8');
        await db.query(sql); await db.query(sql);
        assert.deepEqual(await fingerprint(), before, 'ACLs, existing policies, RLS metadata and shared helpers must be unchanged.');
        console.log('ACTIVE_IDENTITY_FORWARD_MIGRATION_RETRY=PASS_ROLLBACK_REHEARSAL');
      } else if (!baseline) {
        const history = await db.query("select version from supabase_migrations.schema_migrations where version='20261015030000'");
        assert.equal(history.rowCount, 1, 'The new migration must be recorded; use --test-migration for rollback-only rehearsal.');
      }
      if (!baseline) {
        const guards = await db.query(`select tablename,policyname,permissive,cmd,roles,qual,with_check from pg_policies
          where schemaname='public' and tablename=any($1::text[]) and policyname=any($2::text[])`, [readTables, guardNames]);
        assert.equal(guards.rowCount, 7);
        assert.deepEqual(guards.rows.map(guard => `${guard.tablename}:${guard.policyname}:${guard.cmd}`).sort(), [
          ...readTables.map(table => `${table}:${table}_active_identity_select_guard:SELECT`),
          ...writeTables.map(table => `${table}:${table}_active_identity_update_guard:UPDATE`),
        ].sort(), 'Only the approved table/command guard pairs may be present.');
        for (const guard of guards.rows) {
          assert.equal(guard.permissive, 'RESTRICTIVE'); assert.equal(guard.roles, '{authenticated}');
          assert.match(guard.qual, /auth\.uid\(\)/); assert.match(guard.qual, /u\.status.*active/);
          assert.match(guard.qual, /t\.status.*active/);
          if (guard.cmd === 'UPDATE') assert.equal(guard.with_check, guard.qual);
        }
      }
      await seed(); await runtimeChecks();
      await activeFlowRegression();
      assert.deepEqual(await fingerprint(), before, 'Runtime verification must not modify shared security definitions or ACLs.');
    } catch (error: unknown) { caught = error; }
    finally { await db.query('rollback'); }
    await cleanupProof();
    assert.deepEqual(await fingerprint(true), original, 'Rollback must restore the complete original security definitions.');
    console.log('ACTIVE_IDENTITY_SECURITY_DEFINITIONS_RESTORED=PASS');
    if (caught) throw caught;
    if (failures.length) {
      console.log(JSON.stringify({ baselineFailures: failures, assertions }));
      throw new Error('Baseline exposes invalid-identity access; this is not a passing verification.');
    }
    console.log(`ACTIVE_IDENTITY_RUNTIME_ASSERTIONS=${assertions}`);
    console.log('AUTOMOVE_ACTIVE_IDENTITY_ACCESS=PASS_ROLLBACK');
  } finally { await db.end(); }
}

verify().catch((error: unknown) => {
  console.error('AUTOMOVE_ACTIVE_IDENTITY_ACCESS=FAIL', error instanceof assert.AssertionError ? error.message :
    error && typeof error === 'object' && 'code' in error ? String(error.code) : 'Verification failed; no PASS claimed.');
  process.exitCode = 1;
});
