import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { AutoMoveSettlementService } from '../src/modules/bella-auto/services/AutoMoveSettlementService';
import { AutoMoveSalePaymentService } from '../src/modules/bella-auto/services/AutoMoveSalePaymentService';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import type { MobilitySqlClient } from '../src/platform/mobility';

const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(api).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api));
const tenant = randomUUID(), otherTenant = randomUUID(), actor = randomUUID(), other = randomUUID(), inactive = randomUUID(), wrong = randomUUID();
const customer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
const beforeBooking = randomUUID(), afterBooking = randomUUID(), beforeVehicle = randomUUID(), afterVehicle = randomUUID();
const beforeDeposit = randomUUID(), afterDeposit = randomUUID(), recognition = randomUUID();
const content = new TextEncoder().encode('Owner-confirmed refund/cancellation test document');
const document = { bucket: 'automove-sale-documents', path: `${tenant}/proof.pdf`, sha256: createHash('sha256').update(content).digest('hex') };
let transaction = false, assertions = 0;
function check(value: unknown, message: string) { assert.ok(value, message); assertions++; }
async function context(user: string, role: 'authenticated' | 'anon' = 'authenticated') {
  await db.query('reset role'); await db.query(role === 'anon' ? 'set local role anon' : 'set local role authenticated');
  await db.query('set local row_security=on');
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)", [user, role]);
}
async function denied(operation: () => Promise<unknown>, code?: string) {
  await db.query('savepoint denied_operation'); let caught: unknown;
  try { await operation(); } catch (error: unknown) { caught = error; }
  await db.query('rollback to savepoint denied_operation'); await db.query('release savepoint denied_operation');
  check(!!caught && typeof caught === 'object' && 'code' in caught, 'Expected runtime rejection');
  if (code) { assert.equal((caught as { code: string }).code, code); assertions++; }
}
async function verify() {
  await db.connect(); await db.query('begin'); transaction = true;
  await db.query("set local statement_timeout='30s'");
  for (const id of [tenant, otherTenant]) await db.query("insert into public.tenants(id,name,status) values($1,'AutoMove settlement rollback proof','active')", [id]);
  for (const [id, owner, status, role] of [[actor, tenant, 'active', 'accountant'], [other, otherTenant, 'active', 'accountant'],
    [inactive, tenant, 'inactive', 'accountant'], [wrong, tenant, 'active', 'admin']]) {
    await db.query("insert into auth.users(id,email,role,aud) values($1,$2,'authenticated','authenticated')", [id, `${id}@example.test`]);
    await db.query("insert into public.users(id,email,full_name,tenant_id,status,role) values($1,$2,'Settlement proof',$3,$4,$5)", [id, `${id}@example.test`, owner, status, role]);
  }
  await db.query("insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,'Settlement proof',$3)", [customer, tenant, randomUUID()]);
  await db.query("insert into public.auto_brands(id,tenant_id,name) values($1,$2,'Settlement proof')", [brand, tenant]);
  await db.query("insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,'Settlement proof')", [model, tenant, brand]);
  await db.query("insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,'Settlement proof',2026)", [variant, tenant, model]);
  for (const [booking, vehicle, deposit, status] of [[beforeBooking, beforeVehicle, beforeDeposit, 'allocated'], [afterBooking, afterVehicle, afterDeposit, 'delivered']]) {
    await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status)
      values($1,$2,$3,$4,'White',2026,$5)`, [vehicle, tenant, variant, randomUUID().replaceAll('-', '').slice(0,17), status]);
    await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
      values($1,$2,$3,$4,$5,'White',$6,1000,100,100,'confirmed')`, [booking, tenant, customer, vehicle, variant, randomUUID()]);
    await db.query('update public.auto_vehicles set allocated_to_contract_id=$2 where id=$1', [vehicle, booking]);
    await db.query(`insert into public.auto_deposits(id,tenant_id,booking_id,amount,status,created_by,confirmed_by,confirmed_at)
      values($1,$2,$3,100,'confirmed',$4,$4,now())`, [deposit, tenant, booking, actor]);
  }
  const sources = (await db.query('select id,amount,status from public.auto_deposits where tenant_id=$1 order by id', [tenant])).rows;
  await context(actor);
  const service = new AutoMoveSettlementService(db, actor, async () => content);
  const refund = { action: 'refund', receiptType: 'deposit', receiptId: beforeDeposit, amount: 30, reason: 'Confirmed manual refund', document, confirmed: true };
  const key = randomUUID();
  const first = await service.execute(beforeBooking, key, refund);
  check(first.state.netReceived === 70 && first.state.refunded === 30 && first.state.recognitionId === null, 'Pre-recognition cash refund does not create revenue');
  const replay = await new AutoMoveSettlementService(db, actor, async () => { throw new Error('Document removed later'); }).execute(beforeBooking, key, refund);
  check(replay.duplicate && replay.action.id === first.action.id, 'Retry returns original persisted fact');
  await denied(() => service.execute(beforeBooking, key, { ...refund, amount: 1 }), 'SETTLEMENT_KEY_CONFLICT');
  await denied(() => service.execute(beforeBooking, randomUUID(), { ...refund, amount: 71 }), 'SETTLEMENT_REFUND_EXCEEDS_RECEIPT');
  await denied(() => service.execute(beforeBooking, randomUUID(), { ...refund, receiptId: afterDeposit }), 'SETTLEMENT_RECEIPT_NOT_FOUND');
  await denied(() => service.execute(beforeBooking, randomUUID(), { ...refund, document: { ...document, path: `${otherTenant}/proof.pdf` } }), 'SETTLEMENT_DOCUMENT_TENANT');
  await denied(() => service.execute(beforeBooking, randomUUID(), { ...refund, confirmed: false }), 'SETTLEMENT_INVALID_INTENT');
  await denied(() => new AutoMoveSettlementService(db, actor, async () => new Uint8Array([1])).execute(beforeBooking, randomUUID(), refund), 'SETTLEMENT_DOCUMENT_INVALID');
  const cancel = { action: 'cancel', reason: 'Documented cancellation', document, confirmed: true }, cancelKey = randomUUID();
  const cancelled = await service.execute(beforeBooking, cancelKey, cancel);
  check(cancelled.state.bookingStatus === 'cancelled' && cancelled.state.vehicleStatus === 'showroom' && cancelled.state.refunded === 30, 'Cancellation releases allocation but does not issue a refund');
  check((await db.query('select allocated_to_contract_id from public.auto_vehicles where id=$1', [beforeVehicle])).rows[0].allocated_to_contract_id === null, 'Mobility persisted allocation release');
  check((await service.execute(beforeBooking, cancelKey, cancel)).duplicate, 'Cancellation is idempotent');
  await denied(() => service.execute(beforeBooking, randomUUID(), cancel), 'SETTLEMENT_ALREADY_CANCELLED');

  await db.query('reset role');
  await db.query(`insert into public.auto_vehicle_sale_recognitions
    (id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,recognized_by_user_id,
     recognition_basis,source_document_type,source_document_id,accounting_policy_id,accounting_policy_version,
     sale_price_recognized,cost_basis_at_sale,cost_basis_source_type,cost_basis_source_ref,
     payment_received_total,deposit_received_total,receivable_amount_at_recognition)
    values($1,$2,$3,$4,$5,$6,$7,$8,'Approved settlement fixture','approved_financial_snapshot',$9,
     'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1000,700,'approved_financial_snapshot',$9,100,100,900)`,
  [recognition, tenant, randomUUID(), randomUUID(), afterBooking, afterVehicle, customer, actor, randomUUID()]);
  const original = (await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows[0];
  await context(actor);
  const payment = new AutoMoveSalePaymentService(db, actor);
  const receipt = await payment.collect(afterBooking, randomUUID(), { amount: 900, paymentMethod: 'cash', transactionRef: null, notes: null });
  const afterRefund = { ...refund, receiptType: 'post_sale', receiptId: receipt.receipt.id, amount: 100 };
  await service.execute(afterBooking, randomUUID(), afterRefund);
  const reconciliation = await payment.state(afterBooking);
  check(reconciliation.status === 'MATCHED' && reconciliation.totalReceived === 900 && reconciliation.outstanding === 100 && reconciliation.saleAmount === 1000, 'Refund changes cash/receivable only, not revenue');
  await payment.collect(afterBooking, randomUUID(), { amount: 100, paymentMethod: 'cash', transactionRef: null, notes: null });
  check((await payment.state(afterBooking)).outstanding === 0, 'Net-cash collection trigger and service agree');
  const afterCancel = await service.execute(afterBooking, randomUUID(), cancel);
  check(afterCancel.state.vehicleStatus === 'delivered' && afterCancel.state.refunded === 100, 'Post-handover cancellation does not return the vehicle or refund automatically');
  await denied(() => payment.collect(afterBooking, randomUUID(), { amount: 1, paymentMethod: 'cash', transactionRef: null, notes: null }), 'PAYMENT_COLLECTION_CLOSED');
  assert.deepEqual((await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows[0], original); assertions++;
  assert.deepEqual((await db.query('select id,amount,status from public.auto_deposits where tenant_id=$1 order by id', [tenant])).rows, sources); assertions++;
  check((await db.query('select id from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1', [recognition])).rows.length === 0, 'Adjustment/reversal remains HELD');
  const failedKey = randomUUID(); let inserted = false;
  const failing: MobilitySqlClient = { query: async (sql, values) => {
    if (inserted && sql.includes('select id,amount from public.auto_deposits')) throw Object.assign(new Error('Injected read-back failure'), { code: 'INJECTED_FAILURE' });
    const result = await db.query(sql, values ? [...values] : undefined);
    if (sql.includes('insert into public.auto_vehicle_sale_settlement_actions')) inserted = true;
    return result;
  } };
  await denied(() => new AutoMoveSettlementService(failing, actor, async () => content).execute(beforeBooking, failedKey, { ...refund, amount: 1 }), 'INJECTED_FAILURE');
  check((await db.query('select id from public.auto_vehicle_sale_settlement_actions where idempotency_key=$1', [failedKey])).rows.length === 0, 'Read-back failure rolls back the refund');
  await denied(() => db.query('update public.auto_vehicle_sale_settlement_actions set amount=1 where id=$1', [first.action.id]), '42501');
  await denied(() => db.query('delete from public.auto_vehicle_sale_settlement_actions where id=$1', [first.action.id]), '42501');
  await denied(() => db.query('insert into public.auto_vehicle_sale_settlement_actions default values'), '42501');
  // The application roles have no UPDATE/DELETE grant; also prove the trigger
  // rejects privileged writers without bypassing or disabling that trigger.
  await db.query('reset role');
  await denied(() => db.query('update public.auto_vehicle_sale_settlement_actions set amount=1 where id=$1', [first.action.id]), 'P0001');
  await denied(() => db.query('delete from public.auto_vehicle_sale_settlement_actions where id=$1', [first.action.id]), 'P0001');
  await denied(() => db.query(`insert into public.auto_vehicle_sale_settlement_actions
    (tenant_id,booking_id,idempotency_key,action_type,source_deposit_id,amount,reason,source_document,request_hash,created_by)
    values($1,$2,$3,'refund',$4,71,'Direct over-refund',$5::jsonb,$6,$7)`,
  [tenant,beforeBooking,randomUUID(),beforeDeposit,JSON.stringify(document),'a'.repeat(64),actor]), 'P0001');
  await context(actor);
  await db.query('savepoint legacy_refund');
  await db.query("update public.auto_bookings set payment_status='refunded' where id=$1",[beforeBooking]);
  await denied(() => service.execute(beforeBooking,randomUUID(),{...refund,amount:1}),'SETTLEMENT_RECONCILIATION_MISMATCH');
  await db.query('rollback to savepoint legacy_refund'); await db.query('release savepoint legacy_refund');
  for (const user of [other, inactive, wrong]) {
    await context(user);
    await denied(() => new AutoMoveSettlementService(db, user, async () => content).state(beforeBooking));
    if (user !== inactive) check((await db.query('select id from public.auto_vehicle_sale_settlement_actions where tenant_id=$1', [tenant])).rows.length === 0, 'Wrong tenant/role cannot read history');
  }
  await context('', 'anon'); await denied(() => db.query('select * from public.auto_vehicle_sale_settlement_actions'), '42501');
  await db.query('reset role'); await db.query("update public.tenants set status='suspended' where id=$1", [tenant]);
  await context(actor); await denied(() => service.state(beforeBooking));
  await db.query('rollback'); transaction = false;
  check((await db.query('select id from public.tenants where id=ANY($1::uuid[])', [[tenant,otherTenant]])).rows.length === 0, 'All fixtures rolled back');
  console.log(`AUTOMOVE_REFUND_CANCEL_RECONCILIATION_REAL_DB=PASS_ROLLBACK_ZERO_FIXTURES assertions=${assertions}`);
}
verify().catch(error => { console.error('Settlement verification failed:', error instanceof Error ? error.message : 'Unknown failure'); process.exitCode = 1; })
  .finally(async () => { if (transaction) await db.query('rollback').catch(() => undefined); await db.end(); });
