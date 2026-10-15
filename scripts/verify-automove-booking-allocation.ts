import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { createAllocatedBooking } from '../src/modules/bella-auto/services/AutoMoveBookingAllocationService';
import type { MobilitySqlClient } from '../src/platform/mobility';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(apiUrl).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
assert.equal(process.env.ALLOW_E2E_BOOKING_ALLOCATION_VERIFICATION, '1');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', apiUrl));
const tenantA = randomUUID(), tenantB = randomUUID(), actorA = randomUUID(), actorB = randomUUID(), inactive = randomUUID();
const customerA = randomUUID(), customerB = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
const vehicle = randomUUID(), failureVehicle = randomUUID(), bookingId = randomUUID(), failedId = randomUUID();
const marker = `automove-allocation-${randomUUID()}`;
const phone = () => `09${BigInt(`0x${randomUUID().replaceAll('-', '')}`).toString().slice(-8)}`;
const phoneA = phone(), phoneB = phone();
let transaction = false;

async function context(actor: string) {
  await db.query('reset role');
  await db.query('set local role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.jwt.claims',$2,true)`, [actor, JSON.stringify({ sub: actor, role: 'authenticated' })]);
}
async function rejected(work: () => Promise<unknown>, code: string) {
  await db.query('savepoint expected_rejection');
  let error: unknown;
  try { await work(); } catch (caught: unknown) { error = caught; }
  await db.query('rollback to savepoint expected_rejection');
  await db.query('release savepoint expected_rejection');
  assert.ok(error && typeof error === 'object' && 'code' in error && error.code === code, `Expected ${code}, not schema/auth/config failure.`);
}

async function verify() {
  await db.connect();
  await db.query('begin isolation level serializable'); transaction = true;
  await db.query("set local statement_timeout='30s'");
  await db.query("insert into public.tenants(id,name,status) values ($1,$3,'active'),($2,$4,'active')", [tenantA, tenantB, `${marker}-A`, `${marker}-B`]);
  for (const actor of [actorA, actorB, inactive]) await db.query("insert into auth.users(id,email,role,aud) values ($1,$2,'authenticated','authenticated')", [actor, `${marker}-${actor}@example.test`]);
  for (const [actor, tenant, status] of [[actorA, tenantA, 'active'], [actorB, tenantB, 'active'], [inactive, tenantA, 'inactive']]) {
    await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values ($1,$2,$3,$4,'accountant',$5)", [actor, `${marker}-${actor}@example.test`, marker, tenant, status]);
  }
  await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values ($1,$3,$5,$6),($2,$4,$5,$7)', [customerA, customerB, tenantA, tenantB, marker, phoneA, phoneB]);
  await db.query('insert into public.auto_brands(id,tenant_id,name) values ($1,$2,$3)', [brand, tenantA, marker]);
  await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [model, tenantA, brand, marker]);
  await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [variant, tenantA, model, marker]);
  for (const id of [vehicle, failureVehicle]) await db.query(`insert into public.auto_vehicles
    (id,tenant_id,variant_id,vin,color_exterior,model_year,list_price,cost_price,status)
    values ($1,$2,$3,$4,'White',2026,9900000000,8800000000,'showroom')`, [id, tenantA, variant, randomUUID().replaceAll('-', '').slice(0, 17).toUpperCase()]);
  const payload = { customerId: customerA, customerPhone: phoneA, customerName: marker, customerAddress: '',
    variantId: variant, vehicleId: vehicle, colorExterior: 'White', totalPrice: 1500000000, depositAmount: 100000000, depositPaid: 0 };
  await context(actorA);
  await rejected(() => createAllocatedBooking(db, actorA, { ...payload, customerId: customerB }, randomUUID()), 'CUSTOMER_MISMATCH');
  await rejected(() => createAllocatedBooking(db, actorA, { ...payload, variantId: randomUUID() }, randomUUID()), 'VEHICLE_MISMATCH');
  await rejected(() => createAllocatedBooking(db, actorA, { ...payload, colorExterior: 'Black' }, randomUUID()), 'VEHICLE_MISMATCH');
  await context(inactive);
  // Canonical identity now rejects the SQL lookup before service authorization.
  await rejected(() => createAllocatedBooking(db, inactive, payload, randomUUID()), '42501');
  await context(actorB);
  await rejected(() => createAllocatedBooking(db, actorB, { ...payload, customerId: customerB }, randomUUID()), 'MOBILITY_NOT_FOUND');
  await context(actorA);
  const created = await createAllocatedBooking(db, actorA, payload, bookingId);
  assert.equal(created.isDuplicate, false); assert.equal(created.booking.id, bookingId);
  assert.equal(created.booking.total_price, 1500000000);
  const read = async () => (await db.query('select status,allocated_to_contract_id,allocated_at,allocated_by_user_id from public.auto_vehicles where id=$1', [vehicle])).rows[0];
  const allocation = await read();
  assert.equal(allocation.status, 'allocated'); assert.equal(allocation.allocated_to_contract_id, bookingId);
  assert.equal(allocation.allocated_by_user_id, actorA); assert.ok(allocation.allocated_at);
  console.log('BOOKING_MOBILITY_ALLOCATION_BINDING_ACTOR_TIME=PASS');
  const retry = await createAllocatedBooking(db, actorA, payload, bookingId);
  assert.equal(retry.isDuplicate, true); assert.equal(retry.booking.id, bookingId);
  assert.deepEqual(await read(), allocation);
  await rejected(() => createAllocatedBooking(db, actorA, { ...payload, totalPrice: 1500000001 }, bookingId), 'IDEMPOTENCY_CONFLICT');
  await rejected(() => createAllocatedBooking(db, actorA, payload, randomUUID()), 'DUPLICATE_VIN');
  assert.equal((await db.query('select id from public.auto_bookings where tenant_id=$1 and vehicle_id=$2', [tenantA, vehicle])).rows.length, 1);
  for (const [table, predicate] of [
    ['auto_vehicle_status_logs', "vehicle_id=$1 and to_status='allocated'"],
    ['mobility_domain_events', "entity_id=$1 and event_type='vehicle.status_changed'"],
  ]) assert.equal((await db.query(`select id from public.${table} where ${predicate}`, [vehicle])).rows.length, 1);
  assert.equal((await db.query("select business_key from public.mobility_command_idempotency where tenant_id=$1 and business_key=$2", [tenantA, `automove-booking-allocation:${bookingId}`])).rows.length, 1);
  console.log('BOOKING_RETRY_NO_DUPLICATE_LIFECYCLE_COMMAND_EVENT=PASS');
  console.log('BOOKING_TENANT_CUSTOMER_VARIANT_INACTIVE_CONFLICTS=PASS');

  const fault: MobilitySqlClient = { query: async (sql, values) => {
    if (sql.includes('INSERT INTO public.mobility_domain_events')) throw Object.assign(new Error('Injected event write failure'), { code: 'INJECTED_WRITE_FAILURE' });
    return db.query(sql, values ? [...values] : undefined);
  } };
  await rejected(() => createAllocatedBooking(fault, actorA, { ...payload, customerId: undefined, customerPhone: phone(), vehicleId: failureVehicle, customerName: `${marker}-rollback` }, failedId), 'INJECTED_WRITE_FAILURE');
  assert.equal((await db.query('select id from public.auto_bookings where id=$1', [failedId])).rows.length, 0);
  assert.equal((await db.query('select id from public.customers where name_mother=$1', [`${marker}-rollback`])).rows.length, 0);
  const untouched = (await db.query('select status,allocated_to_contract_id from public.auto_vehicles where id=$1', [failureVehicle])).rows[0];
  assert.equal(untouched.status, 'showroom'); assert.equal(untouched.allocated_to_contract_id, null);
  assert.equal((await db.query('select id from public.auto_vehicle_status_logs where vehicle_id=$1', [failureVehicle])).rows.length, 0);
  console.log('BOOKING_AND_ALLOCATION_ROLLBACK_ON_INJECTED_WRITE_FAILURE=PASS');
  await db.query('reset role');
  await db.query('rollback'); transaction = false;
  assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])', [[tenantA, tenantB]])).rows.length, 0);
  assert.equal((await db.query('select id from auth.users where id=any($1::uuid[])', [[actorA, actorB, inactive]])).rows.length, 0);
  console.log('AUTOMOVE_BOOKING_ALLOCATION_REAL_DB=PASS_ROLLBACK');
}
verify().catch(error => { console.error('AUTOMOVE_BOOKING_ALLOCATION_REAL_DB=FAIL', error instanceof Error ? error.message : 'Unknown'); process.exitCode = 1; })
  .finally(async () => { try { if (transaction) await db.query('rollback'); } finally { await db.end(); } });
