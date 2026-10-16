import { test, expect } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

test.use({ trace: 'off', video: 'off' });
test('actual dashboard: documented adjustment, period denial, retry, reversal and read-back', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(480000);
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '', url = process.env.DB_URL || process.env.SUPABASE_DB_URL || '';
  expect(new URL(api).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!key) throw Error('Non-Production fixture credentials required');
  const admin = createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({ ...saleChainConnection(url, api), query_timeout: 15000 });
  const tenant = randomUUID(), other = randomUUID(), customer = randomUUID(), brand = randomUUID(), model = randomUUID(), variant = randomUUID();
  const vehicle = randomUUID(), booking = randomUUID(), recognition = randomUUID(), snapshot = randomUUID(), handover = randomUUID(), period = randomUUID();
  const email = `automove-adjustment-${randomUUID()}@example.test`, password = randomBytes(32).toString('hex'), number = `ADJUST-${randomUUID().slice(0, 8)}`;
  let actor: string | undefined, seeded = false;
  const proof = Buffer.from('%PDF-1.4\nAccountant approved correction and separate reversal\n%%EOF');
  try {
    await db.connect(); db.on('error', () => undefined);
    const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (auth.error || !auth.data.user) throw Error('Temporary actor creation failed'); actor = auth.data.user.id;
    await db.query('begin');
    // Privileged setup is NOT proof of booking/snapshot/recognition creation UI.
    for (const id of [tenant, other]) await db.query(`insert into public.tenants(id,name,status,enabled_modules) values($1,'AutoMove adjustment browser fixture','active','{"bella_auto":true}')`, [id]);
    await db.query("insert into public.users(id,email,full_name,tenant_id,role,status) values($1,$2,'Adjustment accountant',$3,'accountant','active') on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status", [actor, email, tenant]);
    await db.query("insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,'Adjustment customer',$3)", [customer, tenant, randomUUID()]);
    await db.query("insert into public.auto_brands(id,tenant_id,name) values($1,$2,'Adjustment brand')", [brand, tenant]);
    await db.query("insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,'Adjustment model')", [model, tenant, brand]);
    await db.query("insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,'Adjustment variant',2026)", [variant, tenant, model]);
    await db.query("insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status) values($1,$2,$3,$4,'White',2026,'delivered')", [vehicle, tenant, variant, randomUUID().replaceAll('-', '').slice(0, 17)]);
    await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,vehicle_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
      values($1,$2,$3,$4,$5,'White',$6,1400000000,100000000,100000000,'completed')`, [booking, tenant, customer, vehicle, variant, number]);
    await db.query('update public.auto_vehicles set allocated_to_contract_id=$2 where id=$1', [vehicle, booking]);
    await db.query("insert into public.auto_deposits(tenant_id,booking_id,amount,status,created_by) values($1,$2,100000000,'confirmed',$3)", [tenant, booking, actor]);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    const document = { bucket: 'automove-sale-documents', path: `${tenant}/fixture.pdf`, sha256: createHash('sha256').update(proof).digest('hex') };
    await db.query(`insert into public.auto_vehicle_sale_financial_snapshots(id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,sale_price,cost_basis,sale_document,cost_document,created_by)
      values($1,$2,$3,$4,$5,$6,$7,1400000000,1000000000,$8::jsonb,$8::jsonb,$9)`, [snapshot, tenant, randomUUID(), randomUUID(), booking, vehicle, customer, JSON.stringify(document), actor]);
    await db.query('set local role service_role');
    await db.query("update public.auto_vehicle_sale_financial_snapshots set status='approved',approved_by=$2,approved_at=now() where id=$1", [snapshot, actor]);
    await db.query('reset role');
    await db.query(`insert into public.auto_vehicle_sale_recognitions
      (id,tenant_id,sale_transaction_id,idempotency_key,booking_id,vehicle_id,customer_id,recognized_by_user_id,recognition_basis,
       source_document_type,source_document_id,handover_evidence_ref,accounting_policy_id,accounting_policy_version,sale_price_recognized,cost_basis_at_sale,
       cost_basis_source_type,cost_basis_source_ref,payment_received_total,deposit_received_total,receivable_amount_at_recognition,metadata)
      values($1,$2,$3,$4,$5,$6,$7,$8,'Canonical producer fixture','approved_financial_snapshot',$9,$10,'AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY','1.0.0',1400000000,1000000000,
       'approved_financial_snapshot',$9,100000000,100000000,1300000000,$11::jsonb)`, [recognition, tenant, randomUUID(), randomUUID(), booking, vehicle, customer, actor, snapshot,
      `mobility-status-log://${handover}`, JSON.stringify({ command: 'recognize_vehicle_sale_revenue', snapshotId: snapshot, handoverEvidenceId: handover })]);
    await db.query(`insert into public.accounting_periods(id,tenant_id,name,start_date,end_date,status)
      values($1,$2,'Isolated browser test month',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month'-interval '1 day')::date,'OPEN')`, [period, tenant]);
    await db.query('commit'); seeded = true;
    const originals = (await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows;
    const snapshots = (await db.query('select * from public.auto_vehicle_sale_financial_snapshots where id=$1', [snapshot])).rows;
    await page.goto('/login'); await page.getByPlaceholder('email', { exact: true }).fill(email); await page.locator('input[type=password]').fill(password);
    const login = page.waitForResponse(response => response.url().startsWith(`${api}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click(); expect((await login).status()).toBe(200);
    await page.waitForURL('**/dashboard/bella-auto', { timeout: 60000 }); await page.goto('/dashboard/bella-auto/bookings');
    const open = async () => { await page.getByRole('button', { name: 'Thanh toán sau bán', exact: true }).click();
      await page.getByRole('row').filter({ hasText: number }).getByRole('button', { name: `Hồ sơ bán xe ${number}`, exact: true }).click(); };
    await open();
    const panel = page.getByRole('region', { name: 'Điều chỉnh và đảo ghi nhận', exact: true });
    await expect(panel.getByTestId('adjusted-sale')).toHaveText('1.400.000.000 VND', { timeout: 60000 });
    const upload = async (reason: string) => { await panel.getByLabel('Lý do điều chỉnh', { exact: true }).fill(reason);
      await panel.getByLabel('Chứng từ điều chỉnh', { exact: true }).setInputFiles({ name: 'correction.pdf', mimeType: 'application/pdf', buffer: proof });
      await expect(panel.getByText('Đã tải chứng từ điều chỉnh', { exact: true })).toBeVisible(); await panel.getByRole('checkbox').check(); };
    await panel.getByLabel('Delta (VND)', { exact: true }).fill('-100000000'); await upload('Accountant confirmed sale price correction');
    const endpoint = `/api/bella-auto/bookings/${booking}/recognition-adjustments`;
    let saved: { key: string; data: Record<string, unknown> } | undefined, forwarded = 0;
    await page.route(`**${endpoint}`, async route => {
      if (route.request().method() !== 'POST' || saved) { await route.continue(); return; }
      saved = { key: route.request().headers()['idempotency-key'], data: route.request().postDataJSON() };
      try { forwarded = (await route.fetch({ timeout: 60000 })).status(); } catch { forwarded = -1; } finally { await route.abort('failed').catch(() => undefined); }
    });
    await panel.getByRole('button', { name: 'Xác nhận điều chỉnh', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible({ timeout: 60000 }); expect(forwarded).toBe(200); await page.unroute(`**${endpoint}`);
    const retry = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'POST', { timeout: 60000 });
    await panel.getByRole('button', { name: 'Thử lại cùng yêu cầu điều chỉnh', exact: true }).click();
    const retried = await retry; expect(retried.status()).toBe(200); expect(await retried.json()).toMatchObject({ result: { duplicate: true } });
    if (!saved) throw Error('Original request was not observed');
    expect(retried.request().headers()['idempotency-key']).toBe(saved.key);
    await expect(panel.getByTestId('adjusted-sale')).toHaveText('1.300.000.000 VND');
    const current = await page.request.get(endpoint), body = await current.json();
    const costIntent = { ...saved.data, action: 'cost', delta: 50000000, revision: body.result.revision };
    const post = (key: string, data: Record<string, unknown>) => page.request.post(endpoint, { headers: { 'Idempotency-Key': key }, data, timeout: 60000 });
    const reliable = async (key: string, data: Record<string, unknown>) => { for (let i = 0; i < 3; i++) { const r = await post(key, data); if (r.status() !== 409) return r;
      expect((await r.json()).code).toBe('ADJUSTMENT_RETRY_REQUIRED'); } throw Error('Concurrent request did not resolve'); };
    const costKey = randomUUID(), costs = await Promise.all([reliable(costKey, costIntent), reliable(costKey, costIntent)]);
    expect(costs.map(r => r.status())).toEqual([200, 200]); expect((await Promise.all(costs.map(r => r.json()))).map(r => r.result.duplicate).sort()).toEqual([false, true]);
    await panel.getByRole('button', { name: 'Tải lại điều chỉnh', exact: true }).click(); await expect(panel.getByTestId('adjusted-cost')).toHaveText('1.050.000.000 VND');
    const latest = (await (await page.request.get(endpoint)).json()).result;
    const nextIntent = { ...costIntent, revision: latest.revision };
    await db.query("update public.accounting_periods set status='CLOSED' where id=$1", [period]);
    expect(await (await post(randomUUID(), nextIntent)).json()).toMatchObject({ code: 'ACCOUNTING_PERIOD_NOT_OPEN' });
    expect((await post(saved.key, saved.data)).status()).toBe(200);
    await db.query("update public.accounting_periods set status='OPEN' where id=$1", [period]);
    for (const [field, value, status] of [['status', 'inactive', 403], ['role', 'admin', 403], ['tenant_id', other, 404]] as const) {
      try {
        if (field === 'status') await db.query('update public.users set status=$2 where id=$1', [actor, value]);
        else if (field === 'role') await db.query('update public.users set role=$2 where id=$1', [actor, value]);
        else await db.query('update public.users set tenant_id=$2 where id=$1', [actor, value]);
        expect((await post(randomUUID(), nextIntent)).status()).toBe(status);
      } finally { await db.query("update public.users set status='active',role='accountant',tenant_id=$2 where id=$1", [actor, tenant]); }
    }
    await panel.getByRole('radio', { name: 'Đảo ghi nhận', exact: true }).check(); await upload('Accountant confirmed explicit full reversal');
    await panel.getByRole('button', { name: 'Xác nhận đảo ghi nhận', exact: true }).click();
    await expect(panel.getByTestId('recognition-adjustment-status')).toHaveText('Đã đảo ghi nhận', { timeout: 60000 });
    await expect(panel.getByTestId('adjusted-sale')).toHaveText('0 VND'); await expect(panel.getByTestId('adjusted-cost')).toHaveText('0 VND');
    const revenue = await page.request.get('/api/bella-auto/analytics/recognized-sales'); expect(revenue.status()).toBe(200);
    expect(await revenue.json()).toMatchObject({ summary: { revenue: 0, sales: 0 } });
    const cash = await page.request.get(`/api/bella-auto/bookings/${booking}/sale-payments`); expect(cash.status()).toBe(200);
    expect(await cash.json()).toMatchObject({ result: { status: 'MATCHED', saleAmount: 0, totalReceived: 100000000, outstanding: -100000000, canCollect: false } });
    expect((await db.query('select * from public.auto_vehicle_sale_recognitions where id=$1', [recognition])).rows).toEqual(originals);
    expect((await db.query('select * from public.auto_vehicle_sale_financial_snapshots where id=$1', [snapshot])).rows).toEqual(snapshots);
    expect((await db.query('select status from public.auto_bookings where id=$1', [booking])).rows[0].status).toBe('completed');
    expect((await db.query('select status from public.auto_vehicles where id=$1', [vehicle])).rows[0].status).toBe('delivered');
    expect((await db.query('select id from public.auto_vehicle_sale_settlement_actions where booking_id=$1', [booking])).rows).toHaveLength(0);
    await page.reload(); await open(); await expect(panel.getByTestId('recognition-adjustment-status')).toHaveText('Đã đảo ghi nhận', { timeout: 60000 });
    await expect(panel.getByRole('list', { name: 'Lịch sử điều chỉnh' }).getByRole('listitem')).toHaveCount(3);
    await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath('adjustment-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await panel.scrollIntoViewIfNeeded();
    expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('adjustment-mobile.png') });
    console.log('AUTOMOVE_ADJUSTMENT_ACTUAL_NEXT_BROWSER_API_DB_RETRY_REVERSAL_RELOAD=PASS');
  } finally {
    const failures: unknown[] = [], attempt = async (operation: () => Promise<unknown>) => { try { await operation(); } catch (error: unknown) { failures.push(error); } };
    await attempt(() => page.unrouteAll({ behavior: 'wait' })); await db.query('rollback').catch(() => undefined);
    if (seeded) await attempt(async () => {
      const files = await admin.storage.from('automove-sale-documents').list(tenant);
      if (files.error) throw Error('Storage cleanup listing failed');
      if (files.data.length && (await admin.storage.from('automove-sale-documents').remove(files.data.map(file => `${tenant}/${file.name}`))).error) throw Error('Storage cleanup failed');
    });
    await attempt(async () => {
      const cleanupDb = new Client({ ...saleChainConnection(url, api), query_timeout: 15000 });
      try { await cleanupDb.connect(); await cleanupDb.query('begin');
        await cleanupDb.query("update public.accounting_periods set status='CLOSED' where id=$1", [period]);
        await cleanupDb.query("update public.users set status='inactive',tenant_id=$2 where id=$1", [actor, tenant]);
        await cleanupDb.query("update public.tenants set status='terminated' where id=any($1::uuid[])", [[tenant, other]]); await cleanupDb.query('commit');
      } catch (error: unknown) { await cleanupDb.query('rollback').catch(() => undefined); throw error; } finally { await cleanupDb.end(); }
    });
    const cleanupActor = actor;
    if (cleanupActor) await attempt(async () => { if ((await admin.auth.admin.deleteUser(cleanupActor)).error) throw Error('Auth cleanup failed'); });
    if (seeded) await attempt(async () => { expect((await db.query('select id from auth.users where id=$1', [actor])).rows).toHaveLength(0);
      expect((await db.query("select id from public.users where id=$1 and status='active'", [actor])).rows).toHaveLength(0);
      expect((await db.query("select id from public.tenants where id=any($1::uuid[]) and status<>'terminated'", [[tenant, other]])).rows).toHaveLength(0);
      const files = await admin.storage.from('automove-sale-documents').list(tenant); if (files.error) throw Error('Storage cleanup read-back failed'); expect(files.data).toHaveLength(0);
      console.log('AUTOMOVE_ADJUSTMENT_BROWSER_CLEANUP=AUTH_ZERO_STORAGE_ZERO_INACTIVE_ACTOR_ARCHIVED_TENANTS_HISTORY_RETAINED'); });
    await attempt(() => db.end()); if (failures.length) throw new AggregateError(failures, 'Adjustment fixture cleanup failed');
  }
});
