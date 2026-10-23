import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { AutoMoveSalePaymentService } from '../src/modules/bella-auto/services/AutoMoveSalePaymentService';
import { confirmBookingDeposit } from '../src/modules/bella-auto/services/AutoMoveDepositConfirmationService';
import type { MobilitySqlClient } from '../src/platform/mobility';

const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(api).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api));
const tenant = randomUUID(), otherTenant = randomUUID(), actor = randomUUID(), other = randomUUID(), inactive = randomUUID(), wrongRole = randomUUID();
const booking = randomUUID(), customer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID(), vehicle = randomUUID(), recognition = randomUUID();
let transaction = false;
async function context(user: string, role = 'authenticated') {
  await db.query('reset role'); await db.query(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`);
  await db.query('set local row_security=on');
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)", [user, role]);
}
async function denied(operation: () => Promise<unknown>, code?: string) {
  await db.query('savepoint denial'); let error: unknown;
  try { await operation(); } catch (caught: unknown) { error = caught; }
  await db.query('rollback to savepoint denial'); await db.query('release savepoint denial');
  assert.ok(error && typeof error === 'object' && 'code' in error, 'Expected a real rejection, not success');
  if (code) assert.equal(error.code, code);
}
async function verify() {
  await db.connect(); await db.query('begin'); transaction = true;
  await db.query("set local statement_timeout='20s'");
  for (const id of [tenant, otherTenant]) await db.query("insert into public.tenants(id,name,status) values($1,'AutoMove receipt rollback proof','active')", [id]);
  for (const [id, owner, status, role] of [[actor, tenant, 'active', 'accountant'], [other, otherTenant, 'active', 'accountant'],
    [inactive, tenant, 'inactive', 'accountant'], [wrongRole, tenant, 'active', 'admin']]) {
    await db.query("insert into auth.users(id,email,role,aud) values($1,$2,'authenticated','authenticated')", [id, `${id}@example.test`]);
    await db.query("insert into public.users(id,email,full_name,tenant_id,status,role) values($1,$2,'Receipt proof',$3,$4,$5)", [id, `${id}@example.test`, owner, status, role]);
  }
  await db.query("insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,'Receipt proof',$3)", [customer, tenant, randomUUID()]);
  await db.query("insert into public.auto_brands(id,tenant_id,name) values($1,$2,'Receipt proof')", [brand, tenant]);
  await db.query("insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,'Receipt proof')", [model, tenant, brand]);
  await db.query("insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,'Receipt proof',2026)", [variant, tenant, model]);
  await db.query("insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status) values($1,$2,$3,$4,'White',2026,'delivered')", [vehicle, tenant, variant, randomUUID().slice(0,17)]);
  await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
    values($1,$2,$3,$4,$5,'White',$6,9900000000,200000000,100000000,'completed')`, [booking, tenant, customer, vehicle, variant, randomUUID()]);
  await db.query(`insert into public.auto_deposits(tenant_id,booking_id,amount,status,created_by,confirmed_by,confirmed_at)
    values($1,$2,100000000,'confirmed',$3,$3,now())`, [tenant, booking, actor]);
  await db.query(`insert into public.auto_vehicle_sale_recognitions
    (id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,recognized_by_user_id,
     recognition_basis,source_document_type,source_document_id,accounting_policy_id,accounting_policy_version,
     sale_price_recognized,cost_basis_at_sale,cost_basis_source_type,cost_basis_source_ref,
     payment_received_total,deposit_received_total,receivable_amount_at_recognition)
    values($1,$2,$3,$4,$5,$6,$7,$8,'Owner-approved receipt proof','approved_financial_snapshot',$9,
     'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1400000000,1000000000,'approved_financial_snapshot',$9,100000000,100000000,1300000000)`,
  [recognition, tenant, randomUUID(), randomUUID(), booking, vehicle, customer, actor, randomUUID()]);
  const original = (await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows[0];
  const depositBefore = (await db.query('select * from public.auto_deposits where booking_id=$1', [booking])).rows;
  await context(actor);
  const service = new AutoMoveSalePaymentService(db, actor), key = randomUUID();
  const intent = { amount: 300000000, paymentMethod: 'bank_transfer', transactionRef: `bank-${randomUUID()}`, notes: null };
  const first = await service.collect(booking, key, intent);
  assert.equal(first.state.outstanding, 1000000000); assert.equal(first.state.totalReceived, 400000000);
  const retry = await service.collect(booking, key, intent); assert.equal(retry.duplicate, true); assert.deepEqual(retry.receipt, first.receipt);
  await db.query('savepoint valid_deposit_after_receipt');
  const additionalDepositKey = randomUUID();
  const additionalDeposit = await confirmBookingDeposit(db, actor, booking, additionalDepositKey, { amount: 1, payment_method: 'cash' });
  assert.equal(additionalDeposit.data.new_deposit_paid, 100000001);
  assert.equal((await confirmBookingDeposit(db, actor, booking, additionalDepositKey, { amount: 1, payment_method: 'cash' })).isDuplicate, true);
  assert.equal((await service.state(booking)).outstanding, 999999999);
  await db.query('rollback to savepoint valid_deposit_after_receipt'); await db.query('release savepoint valid_deposit_after_receipt');
  await denied(() => service.collect(booking, key, { ...intent, amount: 1 }), 'PAYMENT_KEY_CONFLICT');
  await denied(() => service.collect(booking, randomUUID(), intent), '23505');
  await denied(() => service.collect(booking, randomUUID(), { ...intent, transactionRef: 'over', amount: 1000000001 }), 'PAYMENT_EXCEEDS_OUTSTANDING');
  const rawReceipt = (amount: number, receivedBy = actor, owner = tenant) => db.query(`insert into public.auto_vehicle_sale_payments
    (tenant_id,booking_id,recognition_id,idempotency_key,amount,payment_method,received_by)
    values($1,$2,$3,$4,$5,'cash',$6)`, [owner, booking, recognition, randomUUID(), amount, receivedBy]);
  await denied(() => rawReceipt(1000000001), 'P0001');
  await denied(() => rawReceipt(1, other), 'P0001');
  let inserted = false;
  const failingDb: MobilitySqlClient = { query: async (sql, values) => {
    if (inserted && sql.includes('from public.auto_vehicle_sale_recognitions')) throw Object.assign(new Error('Injected read-back failure'), { code: 'INJECTED_READBACK_FAILURE' });
    const result = await db.query(sql, values ? [...values] : undefined);
    if (sql.includes('insert into public.auto_vehicle_sale_payments')) inserted = true;
    return result;
  } };
  const failedKey = randomUUID();
  await denied(() => new AutoMoveSalePaymentService(failingDb, actor).collect(booking, failedKey,
    { amount: 1, paymentMethod: 'cash', transactionRef: null, notes: null }), 'INJECTED_READBACK_FAILURE');
  assert.equal((await db.query('select id from public.auto_vehicle_sale_payments where idempotency_key=$1', [failedKey])).rows.length, 0);
  await denied(() => db.query('update public.auto_vehicle_sale_payments set amount=1 where id=$1', [first.receipt.id]), '42501');
  await denied(() => db.query('delete from public.auto_vehicle_sale_payments where id=$1', [first.receipt.id]), '42501');
  for (const user of [other, inactive, wrongRole]) {
    await context(user);
    const deniedService = new AutoMoveSalePaymentService(db, user);
    await denied(() => deniedService.collect(booking, randomUUID(), intent), user === inactive ? '42501' : user === other ? 'PAYMENT_BOOKING_NOT_FOUND' : 'PAYMENT_FORBIDDEN');
    const read = () => db.query('select id from public.auto_vehicle_sale_payments where tenant_id=$1', [tenant]);
    if (user === inactive) await denied(read, '42501');
    else assert.equal((await read()).rows.length, 0);
  }
  await context('', 'anon'); await denied(() => db.query('select * from public.auto_vehicle_sale_payments'), '42501');
  await context(actor);
  await db.query('update public.auto_bookings set deposit_paid=200000000 where id=$1', [booking]);
  assert.deepEqual((await service.state(booking)).issues, ['DEPOSIT_RECEIPT_MISMATCH']);
  await denied(() => service.collect(booking, randomUUID(), { ...intent, transactionRef: 'mismatch' }), 'PAYMENT_RECONCILIATION_MISMATCH');
  await db.query('update public.auto_bookings set deposit_paid=100000000 where id=$1', [booking]);
  await db.query('savepoint duplicate_deposit');
  await db.query('reset role');
  await db.query("update public.auto_deposits set transaction_ref='duplicate-proof' where booking_id=$1", [booking]);
  await db.query(`insert into public.auto_deposits(tenant_id,booking_id,amount,status,payment_method,transaction_ref,created_by,confirmed_by)
    values($1,$2,100000000,'confirmed','cash','duplicate-proof',$3,$3)`, [tenant, booking, actor]);
  await db.query('update public.auto_bookings set deposit_paid=200000000 where id=$1', [booking]);
  await context(actor);
  assert.ok((await service.state(booking)).issues.includes('DUPLICATE_RECEIPT'));
  await db.query('rollback to savepoint duplicate_deposit'); await db.query('release savepoint duplicate_deposit');
  await context(actor);
  await db.query("update public.auto_bookings set status='cancelled' where id=$1", [booking]);
  assert.equal((await service.collect(booking, key, intent)).duplicate, true);
  await denied(() => service.collect(booking, randomUUID(), { ...intent, transactionRef: 'cancelled' }), 'PAYMENT_COLLECTION_CLOSED');
  await db.query("update public.auto_bookings set status='completed' where id=$1", [booking]);
  await db.query('savepoint unresolved_refund');
  await db.query('reset role');
  await db.query(`insert into public.auto_vehicle_sale_recognition_adjustments
    (tenant_id,recognition_id,adjustment_type,idempotency_key,reason,evidence_ref,accounting_policy_id,accounting_policy_version,refund_amount)
    values($1,$2,'refund_recorded',$3,'Owner-approved denial fixture','receipt-proof','AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1)`, [tenant, recognition, randomUUID()]);
  await context(actor);
  assert.ok((await service.state(booking)).issues.includes('REFUND_OR_ADJUSTMENT_REQUIRES_RESOLUTION'));
  await denied(() => service.collect(booking, randomUUID(), { ...intent, transactionRef: 'refund' }), 'PAYMENT_RECONCILIATION_MISMATCH');
  await db.query('rollback to savepoint unresolved_refund'); await db.query('release savepoint unresolved_refund');
  await context(actor);
  await context('');
  await denied(() => db.query(`insert into public.auto_vehicle_sale_payments(tenant_id,booking_id,recognition_id,idempotency_key,amount,payment_method,received_by)
    values($1,$2,$3,$4,1,'cash',$5)`, [tenant, booking, recognition, randomUUID(), actor]));
  await context(actor);
  const final = await service.collect(booking, randomUUID(), { amount: 1000000000, paymentMethod: 'cash', transactionRef: null, notes: null });
  assert.equal(final.state.outstanding, 0); assert.equal(final.state.receipts.length, 2);
  assert.equal(final.state.status, 'MATCHED'); assert.equal(final.state.canCollect, false);
  await denied(() => service.collect(booking, randomUUID(), { amount: 1, paymentMethod: 'cash', transactionRef: null, notes: null }), 'PAYMENT_COLLECTION_CLOSED');
  await denied(() => confirmBookingDeposit(db, actor, booking, randomUUID(), { amount: 1, payment_method: 'cash' }), '23514');
  await denied(() => db.query('update public.auto_deposits set amount=amount+1 where booking_id=$1', [booking]), '23514');
  assert.equal((await service.state(booking)).outstanding, 0);
  console.log('AUTOMOVE_COMBINED_DEPOSIT_POST_SALE_CAP=PASS_ROLLBACK');
  await db.query('reset role');
  await denied(() => db.query('update public.auto_vehicle_sale_payments set amount=1 where id=$1', [first.receipt.id]), 'P0001');
  assert.deepEqual((await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows[0], original);
  assert.deepEqual((await db.query('select * from public.auto_deposits where booking_id=$1', [booking])).rows, depositBefore);
  await db.query('rollback'); transaction = false;
  assert.equal((await db.query('select id from public.tenants where id=any($1::uuid[])', [[tenant, otherTenant]])).rows.length, 0);
  assert.equal((await db.query('select id from auth.users where id=any($1::uuid[])', [[actor, other, inactive, wrongRole]])).rows.length, 0);
  console.log('AUTOMOVE_POST_SALE_RECEIPT_PERSISTENCE_RETRY_RECONCILIATION_RLS_IMMUTABILITY=PASS_ROLLBACK');
}
verify().catch(error => { console.error('AUTOMOVE_POST_SALE_RECEIPT=FAIL', error instanceof Error ? error.message : 'Unknown'); process.exitCode = 1; })
  .finally(async () => { try { if (transaction) await db.query('rollback'); } finally { await db.end(); } });
