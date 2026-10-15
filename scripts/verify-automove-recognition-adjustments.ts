import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { AutoMoveRecognitionAdjustmentService } from '../src/modules/bella-auto/services/AutoMoveRecognitionAdjustmentService';
import { AutoMoveSalePaymentService } from '../src/modules/bella-auto/services/AutoMoveSalePaymentService';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
assert.equal(new URL(api).hostname, 'bmnbqbcdbuklhopfbopv.supabase.co');
const config = { ...saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api), query_timeout: 15000 };
const db = new Client(config), closer = new Client(config);
const tenant = randomUUID(), other = randomUUID(), actor = randomUUID(), sourcePeriod = randomUUID(), currentPeriod = randomUUID();
const customer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID(), vehicle = randomUUID(), booking = randomUUID(), deposit = randomUUID(), recognition = randomUUID(), snapshot = randomUUID(), handover = randomUUID();
const content = new TextEncoder().encode('Accountant approved AutoMove correction');
const document = { bucket: 'automove-sale-documents', path: `${tenant}/correction.pdf`, sha256: createHash('sha256').update(content).digest('hex') };
let transaction = false, header = false, assertions = 0, downloadsAvailable = true;
const check = (value: unknown) => { assert.ok(value, `Runtime assertion ${assertions + 1} failed`); assertions++; };
async function auth() { await db.query('set local role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actor]); }
async function denied(operation: () => Promise<unknown>, code: string) {
  await db.query('savepoint denial'); let failure: unknown;
  try { await operation(); } catch (error: unknown) { failure = error; }
  await db.query('rollback to savepoint denial'); await db.query('release savepoint denial');
  const actual = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : 'NO_REJECTION';
  assert.equal(actual, code, `Runtime denial ${assertions + 1}`); assertions++;
}
async function run() {
  await db.connect(); await closer.connect(); db.on('error', () => undefined); closer.on('error', () => undefined);
  await db.query('begin'); transaction = true;
  for (const id of [tenant, other]) await db.query("insert into public.tenants(id,name,status) values($1,'AutoMove adjustment isolated proof','active')", [id]);
  await db.query("insert into auth.users(id,email,role,aud) values($1,$2,'authenticated','authenticated')", [actor, `${actor}@example.test`]);
  await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values($1,$2,'Adjustment proof',$3,'accountant','active')", [actor, `${actor}@example.test`, tenant]);
  await db.query(`insert into public.accounting_periods(id,tenant_id,name,start_date,end_date,status) values
    ($1,$3,'Original test month',(date_trunc('month',now())-interval '1 month')::date,(date_trunc('month',now())-interval '1 day')::date,'OPEN'),
    ($2,$3,'Current test month',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month'-interval '1 day')::date,'OPEN')`, [sourcePeriod, currentPeriod, tenant]);
  await db.query('commit'); transaction = false; header = true;
  await db.query('begin isolation level serializable'); transaction = true;
  await db.query("insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,'Adjustment customer',$3)", [customer, tenant, randomUUID()]);
  await db.query("insert into public.auto_brands(id,tenant_id,name) values($1,$2,'Adjustment brand')", [brand, tenant]);
  await db.query("insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,'Adjustment model')", [model, tenant, brand]);
  await db.query("insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,'Adjustment variant',2026)", [variant, tenant, model]);
  await db.query("insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status) values($1,$2,$3,$4,'White',2026,'delivered')", [vehicle, tenant, variant, randomUUID().replaceAll('-', '').slice(0, 17)]);
  await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
    values($1,$2,$3,$4,$5,'White',$6,1400000000,100000000,100000000,'completed')`, [booking, tenant, customer, vehicle, variant, randomUUID()]);
  await db.query("insert into public.auto_deposits(id,tenant_id,booking_id,amount,status,created_by) values($1,$2,$3,100000000,'confirmed',$4)", [deposit, tenant, booking, actor]);
  await db.query(`insert into public.auto_vehicle_sale_recognitions
    (id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,recognized_by_user_id,recognized_at,recognition_basis,
     source_document_type,source_document_id,handover_evidence_ref,accounting_policy_id,accounting_policy_version,sale_price_recognized,cost_basis_at_sale,
     cost_basis_source_type,cost_basis_source_ref,payment_received_total,deposit_received_total,receivable_amount_at_recognition,metadata)
    values($1,$2,$3,$4,$5,$6,$7,$8,date_trunc('month',now())-interval '1 month'+interval '14 days','Declared canonical producer fixture',
     'approved_financial_snapshot',$9,$10,'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1400000000,1000000000,
     'approved_financial_snapshot',$9,100000000,100000000,1300000000,$11::jsonb)`,
  [recognition, tenant, randomUUID(), randomUUID(), booking, vehicle, customer, actor, snapshot, `mobility-status-log://${handover}`,
    JSON.stringify({ command: 'recognize_vehicle_sale_revenue', snapshotId: snapshot, handoverEvidenceId: handover })]);
  const original = (await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows;
  const receipt = (await db.query('select * from public.auto_deposits where id=$1', [deposit])).rows;
  await auth();
  const service = new AutoMoveRecognitionAdjustmentService(db, actor, async () => { if (!downloadsAvailable) throw Error('Removed test document'); return content; });
  const intent = async (action: 'price' | 'cost' | 'reverse' = 'price', delta = -100000000) => ({ action, ...(action === 'reverse' ? {} : { delta }),
    revision: (await service.state(booking)).revision, reason: 'Accountant confirmed correction', document, confirmed: true });
  const key = randomUUID(), firstIntent = await intent();
  const first = await service.execute(booking, key, firstIntent);
  check(!first.duplicate && first.state.salePrice === 1300000000 && first.entry.periodId === sourcePeriod);
  check(first.state.costBasis === 1000000000 && first.state.policyVersion === '1.0.0');
  await closer.query('begin'); await closer.query("set local lock_timeout='250ms'");
  let closeError: unknown; try { await closer.query("update public.accounting_periods set status='CLOSED' where id=$1", [sourcePeriod]); } catch (error: unknown) { closeError = error; }
  await closer.query('rollback'); check(!!closeError && typeof closeError === 'object' && 'code' in closeError && closeError.code === '55P03');
  console.log('AUTOMOVE_ADJUSTMENT_CONCURRENT_PERIOD_CLOSE_BLOCKED=PASS');
  await denied(() => service.execute(booking, key, { ...firstIntent, delta: -1 }), 'ADJUSTMENT_KEY_CONFLICT');
  await denied(() => service.execute(booking, randomUUID(), firstIntent), 'ADJUSTMENT_STALE_REVIEW');
  await denied(async () => service.execute(booking, randomUUID(), { ...await intent(), delta: -1300000001 }), 'ADJUSTMENT_NEGATIVE_TOTAL');
  await denied(async () => service.execute(booking, randomUUID(), { ...await intent(), confirmed: false }), 'ADJUSTMENT_INVALID_INTENT');
  await denied(async () => service.execute(booking, randomUUID(), { ...await intent(), document: { ...document, sha256: '0'.repeat(64) } }), 'ADJUSTMENT_DOCUMENT_INVALID');
  await denied(async () => service.execute(booking, randomUUID(), { ...await intent(), document: { ...document, path: `${other}/wrong.pdf` } }), 'ADJUSTMENT_DOCUMENT_TENANT');
  for (const id of [sourcePeriod, currentPeriod]) {
    await db.query('savepoint closed_period'); await db.query('reset role'); await db.query("update public.accounting_periods set status='CLOSED' where id=$1", [id]); await auth();
    await denied(async () => service.execute(booking, randomUUID(), await intent()), 'ACCOUNTING_PERIOD_NOT_OPEN');
    downloadsAvailable = false; check((await service.execute(booking, key, firstIntent)).duplicate); downloadsAvailable = true;
    await db.query('rollback to savepoint closed_period'); await db.query('release savepoint closed_period');
  }
  await db.query('savepoint overlap'); await db.query('reset role');
  await db.query("insert into public.accounting_periods(tenant_id,name,start_date,end_date,status) select tenant_id,'Overlap test',start_date,end_date,'OPEN' from public.accounting_periods where id=$1", [sourcePeriod]); await auth();
  await denied(async () => service.execute(booking, randomUUID(), await intent()), 'ACCOUNTING_PERIOD_MISSING_OR_AMBIGUOUS');
  await db.query('rollback to savepoint overlap'); await db.query('release savepoint overlap');
  for (const [field, value, expected] of [['status', 'inactive', '42501'], ['role', 'admin', 'ADJUSTMENT_FORBIDDEN'], ['tenant_id', other, 'ADJUSTMENT_NOT_FOUND']]) {
    await db.query('savepoint authority'); await db.query('reset role');
    if (field === 'tenant_id') await db.query('update public.users set tenant_id=$2 where id=$1', [actor, value]);
    else if (field === 'role') await db.query('update public.users set role=$2 where id=$1', [actor, value]);
    else await db.query('update public.users set status=$2 where id=$1', [actor, value]);
    await auth(); await denied(() => service.state(booking), expected); await db.query('rollback to savepoint authority'); await db.query('release savepoint authority');
  }
  await db.query('savepoint suspended'); await db.query('reset role'); await db.query("update public.tenants set status='suspended' where id=$1", [tenant]); await auth();
  await denied(() => service.execute(booking, key, firstIntent), '42501'); await db.query('rollback to savepoint suspended'); await db.query('release savepoint suspended');
  let inserted = false;
  const fault = new AutoMoveRecognitionAdjustmentService({ query: async (sql, values) => {
    const result = await db.query(sql, values); if (sql.startsWith('insert into public.auto_vehicle_sale_recognition_adjustments')) inserted = true;
    return inserted && sql.includes('order by created_at,id') ? { rows: [] } : result;
  } }, actor, async () => content);
  await denied(async () => fault.execute(booking, randomUUID(), await intent('cost', 50000000)), 'ADJUSTMENT_READBACK_MISMATCH');
  check((await service.state(booking)).entries.length === 1);
  const cost = await service.execute(booking, randomUUID(), await intent('cost', 50000000)); check(cost.state.costBasis === 1050000000);
  const reversalKey = randomUUID(), reversal = await intent('reverse');
  const reversed = await service.execute(booking, reversalKey, reversal);
  check(reversed.state.reversed && reversed.state.salePrice === 0 && reversed.state.costBasis === 0 && reversed.state.entries.length === 3);
  check((await service.execute(booking, reversalKey, reversal)).duplicate);
  await denied(async () => service.execute(booking, randomUUID(), await intent()), 'ADJUSTMENT_ALREADY_REVERSED');
  const cash = await new AutoMoveSalePaymentService(db, actor).state(booking);
  check(cash.status === 'MATCHED' && cash.totalReceived === 100000000 && cash.saleAmount === 0 && cash.outstanding === -100000000 && !cash.canCollect);
  check((await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows.map(row => JSON.stringify(row)).join() === original.map(row => JSON.stringify(row)).join());
  check((await db.query('select * from public.auto_deposits where id=$1', [deposit])).rows.map(row => JSON.stringify(row)).join() === receipt.map(row => JSON.stringify(row)).join());
  check((await db.query('select status from public.auto_bookings where id=$1', [booking])).rows[0].status === 'completed');
  check((await db.query('select status from public.auto_vehicles where id=$1', [vehicle])).rows[0].status === 'delivered');
  await denied(() => db.query('update public.auto_vehicle_sale_recognition_adjustments set reason=$2 where recognition_id=$1', [recognition, 'bad']), '42501');
  await db.query('reset role');
  await denied(() => db.query('delete from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1', [recognition]), 'P0001');
  await db.query('rollback'); transaction = false;
  check((await db.query('select id from public.auto_vehicle_sale_recognition_adjustments where recognition_id=$1', [recognition])).rows.length === 0);
  check((await db.query('select id from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows.length === 0);
  console.log(`AUTOMOVE_RECOGNITION_ADJUSTMENT_REAL_DB=PASS_ROLLBACK_ZERO_LEDGER_FIXTURES assertions=${assertions}`);
}
run().catch(error => { console.error(error instanceof Error ? error.stack : 'Adjustment verification failed'); process.exitCode = 1; }).finally(async () => {
  try {
    if (transaction) await db.query('rollback');
    if (header) {
      await db.query('begin'); await db.query('delete from public.accounting_periods where id=any($1::uuid[])', [[sourcePeriod, currentPeriod]]);
      await db.query("update public.users set status='inactive' where id=$1", [actor]); await db.query('delete from auth.users where id=$1', [actor]);
      await db.query("update public.tenants set status='terminated' where id=any($1::uuid[])", [[tenant, other]]); await db.query('commit');
      assert.equal((await db.query('select id from public.accounting_periods where id=any($1::uuid[])', [[sourcePeriod, currentPeriod]])).rows.length, 0);
      assert.equal((await db.query('select id from auth.users where id=$1', [actor])).rows.length, 0);
      assert.equal((await db.query("select id from public.users where id=$1 and status='active'", [actor])).rows.length, 0);
      assert.equal((await db.query("select id from public.tenants where id=any($1::uuid[]) and status<>'terminated'", [[tenant, other]])).rows.length, 0);
      console.log('AUTOMOVE_ADJUSTMENT_CLEANUP=PERIODS_REMOVED_AUTH_ZERO_INACTIVE_PROFILE_ARCHIVED_TENANTS');
    }
  } catch (error: unknown) {
    await db.query('rollback').catch(() => undefined); process.exitCode = 1;
    console.error(error instanceof Error ? error.stack : 'Adjustment cleanup failed');
  } finally { try { await closer.end(); } finally { await db.end(); } }
});
