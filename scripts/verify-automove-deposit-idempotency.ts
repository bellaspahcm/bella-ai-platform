import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { confirmBookingDeposit } from '../src/modules/bella-auto/services/AutoMoveDepositConfirmationService';
import type { MobilitySqlClient } from '../src/platform/mobility';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(apiUrl).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
assert.equal(process.env.ALLOW_E2E_DEPOSIT_VERIFICATION, '1');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', apiUrl));
const tenantA = randomUUID(), tenantB = randomUUID(), actor = randomUUID(), other = randomUUID(), inactive = randomUUID();
const book = randomUUID(), secondBook = randomUUID(), foreignBook = randomUUID(), firstKey = randomUUID();
const marker = `automove-deposit-tx-${randomUUID()}`;
let transaction = false;
const payload = { amount: 30000000, payment_method: 'cash', notes: 'Rollback verifier' };
async function context(id: string) {
  await db.query('reset role'); await db.query('set local role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.jwt.claims',$2,true)`, [id, JSON.stringify({ sub: id, role: 'authenticated' })]);
}
async function rejected(work: () => Promise<unknown>, code: string) {
  await db.query('savepoint expected_denial'); let caught: unknown;
  try { await work(); } catch (error: unknown) { caught = error; }
  await db.query('rollback to savepoint expected_denial'); await db.query('release savepoint expected_denial');
  assert.ok(caught && typeof caught === 'object' && 'code' in caught && caught.code === code, `Expected ${code}, not a configuration/schema failure.`);
}
async function verify() {
  await db.connect(); await db.query('begin'); transaction = true;
  for (const [id, name] of [[tenantA, `${marker}-A`], [tenantB, `${marker}-B`]]) await db.query("insert into public.tenants(id,name,status) values ($1,$2,'active')", [id, name]);
  for (const [id, tenant, status] of [[actor, tenantA, 'active'], [other, tenantB, 'active'], [inactive, tenantA, 'inactive']]) {
    await db.query("insert into auth.users(id,email,role,aud) values ($1,$2,'authenticated','authenticated')", [id, `${marker}-${id}@example.test`]);
    await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values ($1,$2,$3,$4,'accountant',$5)", [id, `${marker}-${id}@example.test`, marker, tenant, status]);
  }
  for (const tenant of [tenantA, tenantB]) {
    const customer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
    await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)', [customer, tenant, marker, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
    await db.query('insert into public.auto_brands(id,tenant_id,name) values ($1,$2,$3)', [brand, tenant, marker]);
    await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [model, tenant, brand, marker]);
    await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [variant, tenant, model, marker]);
    for (const id of tenant === tenantA ? [book, secondBook] : [foreignBook]) await db.query(`insert into public.auto_bookings
      (id,tenant_id,customer_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
      values ($1,$2,$3,$4,'White',$5,1500000000,100000000,0,'pending_deposit')`, [id, tenant, customer, variant, `${marker}-${id}`]);
  }
  await context(actor);
  const first = await confirmBookingDeposit(db, actor, book, firstKey, payload);
  assert.equal(first.isDuplicate, false); assert.equal(first.data.new_deposit_paid, 30000000);
  const before = (await db.query('select * from public.auto_deposits where id=$1', [firstKey])).rows[0];
  const replay = await confirmBookingDeposit(db, actor, book, firstKey, payload);
  assert.equal(replay.isDuplicate, true); assert.equal(replay.data.deposit_id, firstKey); assert.equal(replay.data.new_deposit_paid, 30000000);
  await rejected(() => confirmBookingDeposit(db, actor, book, firstKey, { ...payload, amount: 1 }), 'DEPOSIT_IDEMPOTENCY_CONFLICT');
  await rejected(() => confirmBookingDeposit(db, actor, secondBook, firstKey, payload), 'DEPOSIT_IDEMPOTENCY_CONFLICT');
  await rejected(() => confirmBookingDeposit(db, actor, foreignBook, randomUUID(), payload), 'BOOKING_NOT_FOUND');
  await context(inactive);
  await rejected(() => confirmBookingDeposit(db, inactive, book, randomUUID(), payload), 'ACTOR_NOT_AUTHORIZED');
  await context(actor);
  await confirmBookingDeposit(db, actor, book, randomUUID(), payload);
  const laterReplay = await confirmBookingDeposit(db, actor, book, firstKey, payload);
  assert.equal(laterReplay.data.new_deposit_paid, 60000000);
  assert.deepEqual((await db.query('select * from public.auto_deposits where id=$1', [firstKey])).rows[0], before);
  const fullKey = randomUUID();
  await confirmBookingDeposit(db, actor, book, fullKey, { ...payload, amount: 40000000 });
  assert.equal((await confirmBookingDeposit(db, actor, book, fullKey, { ...payload, amount: 40000000 })).isDuplicate, true);
  await rejected(() => confirmBookingDeposit(db, actor, book, randomUUID(), { ...payload, amount: 1 }), 'DEPOSIT_EXCEEDS_REQUIRED_AMOUNT');
  assert.equal((await db.query('select id from public.auto_deposits where booking_id=$1', [book])).rows.length, 3);
  assert.equal((await db.query('select deposit_paid,status from public.auto_bookings where id=$1', [book])).rows[0].status, 'pending_deposit');
  console.log('DEPOSIT_REAL_DB_SEQUENTIAL_INDEPENDENT_REPLAY_IMMUTABILITY=PASS');
  console.log('DEPOSIT_REAL_DB_TENANT_ACTOR_PAYLOAD_BINDING_AND_CAP=PASS');

  await context(other);
  await rejected(() => confirmBookingDeposit(db, other, foreignBook, firstKey, payload), '23505');
  assert.equal((await db.query('select deposit_paid from public.auto_bookings where id=$1', [foreignBook])).rows[0].deposit_paid, '0');
  await context(actor);
  const failedKey = randomUUID();
  const fault: MobilitySqlClient = { query: async (sql, values) => {
    if (/update public\.auto_bookings/i.test(sql)) throw Object.assign(new Error('Injected booking update failure'), { code: 'INJECTED_WRITE_FAILURE' });
    return db.query(sql, values ? [...values] : undefined);
  } };
  await rejected(() => confirmBookingDeposit(fault, actor, secondBook, failedKey, payload), 'INJECTED_WRITE_FAILURE');
  assert.equal((await db.query('select id from public.auto_deposits where id=$1', [failedKey])).rows.length, 0);
  assert.equal((await db.query('select deposit_paid from public.auto_bookings where id=$1', [secondBook])).rows[0].deposit_paid, '0');
  const recovered = await confirmBookingDeposit(db, actor, secondBook, failedKey, payload);
  assert.equal(recovered.isDuplicate, false); assert.equal(recovered.data.new_deposit_paid, 30000000);
  console.log('DEPOSIT_RECEIPT_AND_BALANCE_ROLLBACK_ON_INJECTED_WRITE_FAILURE=PASS');

  const receiptBeforeClosure = (await db.query('select * from public.auto_deposits where id=$1', [failedKey])).rows[0];
  for (const [status, paymentStatus] of [['cancelled', 'partially_paid'], ['pending_deposit', 'refunded']]) {
    await db.query('update public.auto_bookings set status=$1,payment_status=$2 where id=$3', [status, paymentStatus, secondBook]);
    const closedBooking = (await db.query('select * from public.auto_bookings where id=$1', [secondBook])).rows[0];
    const rejectedKey = randomUUID();
    await rejected(() => confirmBookingDeposit(db, actor, secondBook, rejectedKey, payload), 'BOOKING_CLOSED_FOR_DEPOSIT');
    assert.equal((await db.query('select id from public.auto_deposits where id=$1', [rejectedKey])).rows.length, 0);
    assert.deepEqual((await db.query('select * from public.auto_bookings where id=$1', [secondBook])).rows[0], closedBooking);
    assert.deepEqual((await db.query('select * from public.auto_deposits where id=$1', [failedKey])).rows[0], receiptBeforeClosure);
    if (status === 'cancelled') {
      const retry = await confirmBookingDeposit(db, actor, secondBook, failedKey, payload);
      assert.equal(retry.isDuplicate, true);
      assert.equal(retry.data.new_deposit_paid, 30000000);
      assert.equal((await db.query('select id from public.auto_deposits where booking_id=$1', [secondBook])).rows.length, 1);
    }
  }
  console.log('DEPOSIT_CLOSED_BOOKING_DENIAL_AND_EXISTING_RECEIPT_RETRY=PASS');
  await db.query('reset role'); await db.query('rollback'); transaction = false;
  assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])', [[tenantA, tenantB]])).rows.length, 0);
  assert.equal((await db.query('select id from auth.users where id=any($1::uuid[])', [[actor, other, inactive]])).rows.length, 0);
  console.log('AUTOMOVE_DEPOSIT_TRANSACTION_REAL_DB=PASS_ROLLBACK');
}
verify().catch(error => { console.error('AUTOMOVE_DEPOSIT_TRANSACTION_REAL_DB=FAIL', error instanceof Error ? error.message : 'Unknown'); process.exitCode = 1; })
  .finally(async () => { try { if (transaction) await db.query('rollback'); } finally { await db.end(); } });
