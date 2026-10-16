import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import { FinancialReportingService, RecognizedSalesReadError } from '../src/modules/bella-auto/services/FinancialReportingService';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

// No DDL or policy provisioning: the deployed non-Production schema is a prerequisite.
for (const path of [process.env.E2E_ENV_FILE, resolve('.env.e2e')]) {
  if (path && existsSync(path)) dotenv.config({ path, quiet: true, override: false });
}
const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || '';
if (new URL(api).hostname !== 'bmnbqbcdbuklhopfbopv.supabase.co' || !key || !adminKey) {
  throw new Error('Canonical non-Production Auth and database credentials are required.');
}
const db = new Client(saleChainConnection(dbUrl, api));
const admin = createClient<Database>(api, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const actors: string[] = [], tenants: string[] = [];
const errors: unknown[] = [];
let transaction = false;
db.on('error', error => errors.push(error));
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function seed(label: string, amount: number) {
  const password = randomBytes(32).toString('hex');
  const email = `automove-dashboard-read-${randomUUID()}@example.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!created.error && created.data.user, 'E2E Auth creation failed');
  const actor = created.data.user.id;
  actors.push(actor);
  const tenant = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
  const vehicle = randomUUID(), customer = randomUUID(), recognition = randomUUID();
  tenants.push(tenant);
  await db.query('begin'); transaction = true;
  await db.query("insert into public.tenants(id,name,status) values($1,$2,'active')", [tenant, `AutoMove dashboard read ${label}`]);
  await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
    values($1,$2,'Dashboard read accountant',$3,'accountant','active')
    on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status='active'`, [actor,email,tenant]);
  await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,$3,$4)',
    [customer,tenant,`Dashboard read ${label}`,randomBytes(8).toString('hex')]);
  await db.query('insert into public.auto_brands(id,tenant_id,name) values($1,$2,$3)', [brand,tenant,`Read brand ${label}`]);
  await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,$4)', [model,tenant,brand,`Read model ${label}`]);
  await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,$4,2026)', [variant,tenant,model,`Read variant ${label}`]);
  await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status,list_price,cost_price)
    values($1,$2,$3,$4,'White',2026,'delivered',9900000000,8800000000)`, [vehicle,tenant,variant,randomUUID().replaceAll('-','').slice(0,17)]);
  const currentMonth = new Date().toISOString().slice(0,7);
  for (const [id, recognizedAt] of [[recognition,`${currentMonth}-01T00:00:00Z`],[randomUUID(),'2020-01-01T00:00:00Z']]) {
    await db.query(`insert into public.auto_vehicle_sale_recognitions
      (id,tenant_id,sale_transaction_id,idempotency_key,vehicle_id,customer_id,recognized_by_user_id,recognized_at,
       recognition_basis,source_document_type,source_document_id,handover_evidence_ref,accounting_policy_id,
       accounting_policy_version,sale_price_recognized,cost_basis_at_sale,cost_basis_source_type,cost_basis_source_ref)
      values($1,$2,$3,$4,$5,$6,$7,$8,'owner-approved reporting fixture','approved_financial_snapshot',$9,$10,
       'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',$11,1000000000,'approved_financial_snapshot',$9)`,
      [id,tenant,randomUUID(),`dashboard-read-${id}`,vehicle,customer,actor,recognizedAt,randomUUID(),`handover://${id}`,amount]);
  }
  await db.query(`insert into public.auto_vehicle_sale_recognition_adjustments
    (tenant_id,recognition_id,adjustment_type,idempotency_key,reason,evidence_ref,accounting_policy_id,
     accounting_policy_version,sale_price_delta,cost_basis_delta)
    values($1,$2,'sale_revenue_adjusted',$3,'Approved fixture price correction',$4,
     'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',-100000000,50000000)`,
    [tenant,recognition,`dashboard-adjust-${recognition}`,`source://${recognition}`]);
  await db.query('commit'); transaction = false;
  const client = createClient<Database>(api, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert(!signedIn.error && signedIn.data.user?.id === actor, 'Real password authentication failed');
  return { client, tenant, actor, recognition, vehicle };
}

async function main() {
  await db.connect();
  const policy = await db.query(`select 1 from public.policy_registry where policy_id=
    'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY' and version='1.0.0' and status='active' and is_active=true`);
  assert(policy.rowCount === 1, 'Existing approved accounting policy v1 is required; no provisioning is permitted');
  const a = await seed('A',1500000000), b = await seed('B',2000000000);
  const data = await FinancialReportingService.getRecognizedSalesDashboard(a.client);
  assert(data.revenueByMonth[5].revenue === 1400000000 && data.revenueByMonth[5].sales === 1,
    'Actual service must use current-period recognition plus approved adjustment');
  assert(data.topModels[0].revenue === 2900000000 && data.topModels[0].sold === 2,
    'All-time top models must retain historical recognitions outside the monthly window');
  assert(data.summary.revenue === 2900000000 && data.summary.sales === 2 && data.summary.averageSalePrice === 1450000000,
    'Executive counters must use the same canonical recognition source');
  const ledger = await db.query(`select r.sale_price_recognized + coalesce(sum(a.sale_price_delta),0) as revenue
    from public.auto_vehicle_sale_recognitions r left join public.auto_vehicle_sale_recognition_adjustments a
    on a.recognition_id=r.id where r.id=$1 group by r.id`,[a.recognition]);
  assert(Number(ledger.rows[0].revenue) === data.revenueByMonth[5].revenue, 'Independent ledger read-back mismatch');
  await db.query('update public.auto_vehicles set cost_price=7777777777 where id=$1',[a.vehicle]);
  assert(JSON.stringify(await FinancialReportingService.getRecognizedSalesDashboard(a.client)) === JSON.stringify(data),
    'Repeated reads or changed current vehicle prices must not change recognized sales');
  const other = await FinancialReportingService.getRecognizedSalesDashboard(b.client);
  assert(other.revenueByMonth[5].revenue === 1900000000, 'Tenant B must only include its own records');
  const { data: { session } } = await b.client.auth.getSession();
  assert(session, 'Authenticated RLS probe requires a real session');
  const probe = await fetch(`${api}/rest/v1/auto_vehicle_sale_recognitions?select=id&tenant_id=eq.${a.tenant}`, {
    headers: { apikey: key!, Authorization: `Bearer ${session.access_token}` },
  });
  const forbidden: unknown = await probe.json();
  assert(probe.ok && Array.isArray(forbidden) && forbidden.length === 0, 'Authenticated RLS must independently deny cross-tenant rows');
  const anonymous = createClient<Database>(api,key!,{auth:{persistSession:false}});
  await FinancialReportingService.getRecognizedSalesDashboard(anonymous).then(
    () => { throw new Error('Anonymous service call unexpectedly succeeded'); },
    (error: unknown) => assert(error instanceof RecognizedSalesReadError && error.status === 401,'Anonymous request must be unauthenticated, not zero revenue'));
  await db.query("update public.users set status='inactive' where id=$1",[a.actor]);
  await FinancialReportingService.getRecognizedSalesDashboard(a.client).then(
    () => { throw new Error('Inactive actor unexpectedly succeeded'); },
    (error: unknown) => assert(error instanceof RecognizedSalesReadError && error.status === 403,'Inactive actor must fail closed'));
  await db.query("update public.tenants set status='terminated' where id=$1",[b.tenant]);
  await FinancialReportingService.getRecognizedSalesDashboard(b.client).then(
    () => { throw new Error('Inactive tenant unexpectedly succeeded'); },
    (error: unknown) => assert(error instanceof RecognizedSalesReadError && error.status === 403,'Inactive tenant must be denied, not a configuration failure'));
  console.log('AUTOMOVE_DASHBOARD_ACTUAL_AUTHENTICATED_SERVICE_AND_LEDGER_READBACK=PASS');
  console.log('AUTOMOVE_DASHBOARD_TENANT_RLS_RETRY_PERIOD_AND_INACTIVE_DENIAL=PASS');
}

main().catch(error => { errors.push(error); }).finally(async () => {
  if (transaction) await db.query('rollback').catch(error => errors.push(error));
  // Never delete or unlock append-only financial history. Archive only our fixtures.
  if (tenants.length) {
    const cleanup = new Client(saleChainConnection(dbUrl,api));
    try {
      await cleanup.connect();
      await cleanup.query("update public.users set status='inactive' where id=any($1::uuid[])",[actors]);
      await cleanup.query("update public.tenants set status='terminated' where id=any($1::uuid[])",[tenants]);
    } catch (error) { errors.push(error); }
    finally { await cleanup.end().catch(error => errors.push(error)); }
  }
  for (const id of actors) {
    try {
      const removed = await admin.auth.admin.deleteUser(id);
      if (removed.error) errors.push(new Error('E2E Auth cleanup failed'));
    } catch (error) { errors.push(error); }
  }
  await db.end().catch(error => errors.push(error));
  if (errors.length) {
    console.error('AutoMove dashboard verification failed:', ...errors.map(error => error instanceof Error ? error.message : 'Unknown failure'));
    process.exitCode = 1;
  } else console.log('AUTOMOVE_DASHBOARD_FIXTURE_AUTH_REMOVED_AND_HISTORY_ARCHIVED=PASS');
});
