import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

// Expectations come from the owner-approved PR #327 contract. All mutations
// under test go through the actual dashboard, Auth, Storage and Next.js APIs.
test.use({ trace: 'off', video: 'off' });

test('AutoMove actual dashboard: login to booking, deposit and explicit recognition', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || '';
  expect(new URL(apiUrl).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  if (!publicKey || !adminKey || !dbUrl) throw new Error('Non-Production Auth and DB configuration is required.');
  const db = new Client(saleChainConnection(dbUrl, apiUrl));
  const admin = createClient(apiUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenantId = randomUUID(), customerId = randomUUID(), brandId = randomUUID();
  const modelId = randomUUID(), variantId = randomUUID(), vehicleId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const email = `automove-dashboard-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  const customerName = `AutoMove browser customer ${suffix}`;
  const brandName = `Browser brand ${suffix}`, modelName = `Browser model ${suffix}`, variantName = `Browser variant ${suffix}`;
  const vin = randomUUID().replaceAll('-', '').slice(0, 17).toUpperCase();
  let actorId: string | undefined;
  let seeded = false;
  let transaction = false;
  let authenticated = false;
  let stage = 'fixture';
  const errors: unknown[] = [];
  await db.connect();
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Temporary E2E Auth actor creation failed.');
    actorId = created.data.user.id;
    await db.query('begin'); transaction = true;
    await db.query(`insert into public.tenants (id,name,status,enabled_modules)
      values ($1,$2,'active','{"bella_auto":true}')`, [tenantId, `AutoMove browser proof ${suffix}`]);
    await db.query(`insert into public.users (id,email,full_name,tenant_id,role,status)
      values ($1,$2,'AutoMove browser accountant',$3,'accountant','active')
      on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`, [actorId, email, tenantId]);
    await db.query('insert into public.customers (id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)', [customerId, tenantId, customerName, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
    await db.query('insert into public.auto_brands (id,tenant_id,name) values ($1,$2,$3)', [brandId, tenantId, brandName]);
    await db.query('insert into public.auto_models (id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [modelId, tenantId, brandId, modelName]);
    await db.query('insert into public.auto_variants (id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [variantId, tenantId, modelId, variantName]);
    await db.query(`insert into public.auto_vehicles (id,tenant_id,variant_id,vin,color_exterior,model_year,list_price,cost_price,status)
      values ($1,$2,$3,$4,'Trắng',2026,9900000000,8800000000,'showroom')`, [vehicleId, tenantId, variantId, vin]);
    await db.query('commit'); transaction = false; seeded = true;

    stage = 'login';
    await page.goto('/login');
    await page.getByPlaceholder('email', { exact: true }).fill(email);
    await page.locator('input[type="password"]').fill(password);
    const login = page.waitForResponse(response => response.url().startsWith(`${apiUrl}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
    expect((await login).status(), 'Real Supabase password authentication must succeed.').toBe(200);
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'mock_user_email' && cookie.value)).toBe(false);
    authenticated = true;

    stage = 'booking dashboard';
    await page.waitForURL('**/dashboard/bella-auto', { timeout: 60_000, waitUntil: 'domcontentloaded' });
    const bookingNavigation = page.getByRole('link', { name: 'Booking & Đặt Cọc', exact: true });
    await expect(bookingNavigation).toBeVisible();
    await bookingNavigation.click();
    await page.waitForURL('**/dashboard/bella-auto/bookings');
    await expect(page.getByRole('heading', { name: 'Quản Lý Booking & Đặt Cọc', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tạo Booking Mới', exact: true }).click();
    const modal = page.getByRole('dialog');
    stage = 'customer search API';
    const search = page.waitForResponse(response => response.url().includes('/api/bella-auto/customers/search?'));
    await modal.getByPlaceholder('Nhập số điện thoại hoặc tên...').fill(customerName);
    const searchResult = await search;
    expect(searchResult.status(), 'Authenticated customer search must use the real tenant session.').toBe(200);
    await modal.getByRole('button').filter({ hasText: customerName }).click();
    stage = 'brand catalog API';
    // Cold Next.js compilation must finish before asserting real catalog data.
    const brands = page.waitForResponse(response => response.url().endsWith('/api/bella-auto/vehicles/brands'), { timeout: 60_000 });
    await modal.getByRole('button', { name: 'Tiếp Theo', exact: true }).click();
    const brandResponse = await brands;
    expect(brandResponse.status()).toBe(200);
    expect(await brandResponse.json()).toMatchObject({ brands: [{ id: brandId, name: brandName }] });
    stage = 'model catalog API';
    const models = page.waitForResponse(response => response.url().includes('/api/bella-auto/vehicles/models?'), { timeout: 60_000 });
    await modal.getByRole('button', { name: brandName, exact: true }).click();
    const modelResponse = await models;
    expect(modelResponse.status(), 'Model catalog must match the canonical E2E schema.').toBe(200);
    expect(await modelResponse.json()).toMatchObject({ models: [{ id: modelId, name: modelName }] });
    stage = 'variant catalog API';
    const variants = page.waitForResponse(response => response.url().includes('/api/bella-auto/vehicles/variants?'), { timeout: 60_000 });
    await modal.getByRole('button').filter({ hasText: modelName }).click();
    const variantResponse = await variants;
    expect(variantResponse.status(), 'Variant catalog must not invent financial fields.').toBe(200);
    expect(await variantResponse.json()).toMatchObject({ variants: [{ id: variantId, name: variantName, year: 2026 }] });
    await modal.getByRole('button').filter({ hasText: variantName }).click();
    await expect(modal.getByText('Năm 2026', { exact: true })).toBeVisible();
    await modal.getByRole('button', { name: 'Trắng', exact: true }).click();
    await modal.getByRole('button').filter({ hasText: vin }).click();
    await modal.getByRole('button', { name: 'Tiếp Theo', exact: true }).click();
    stage = 'agreed booking price';
    await expect(modal.getByPlaceholder('850,000,000', { exact: true })).toHaveValue('');
    await expect(modal.getByText(/Giá niêm yết/)).toHaveCount(0);
    await modal.getByPlaceholder('850,000,000', { exact: true }).fill('1500000000');
    await modal.getByPlaceholder('50,000,000', { exact: true }).fill('100000000');
    await modal.getByRole('button', { name: 'Tiếp Theo', exact: true }).click();
    stage = 'booking persistence';
    const bookingResponse = page.waitForResponse(response => response.url().endsWith('/api/bella-auto/bookings') && response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Tạo Booking', exact: true }).click();
    const createdBookingResponse = await bookingResponse;
    expect(createdBookingResponse.status()).toBe(200);
    const booking = (await db.query('select * from public.auto_bookings where tenant_id=$1 and vehicle_id=$2', [tenantId, vehicleId])).rows;
    expect(booking).toHaveLength(1);
    const bookingId: string = booking[0].id;
    expect((await db.query('select allocated_to_contract_id from public.auto_vehicles where id=$1', [vehicleId])).rows[0].allocated_to_contract_id).toBe(bookingId);
    const submission = createdBookingResponse.request();
    const retryKey = submission.headers()['idempotency-key'];
    expect(retryKey).toBe(bookingId);
    for (let attempt = 0; attempt < 2; attempt++) {
      const retry = await page.context().request.post('/api/bella-auto/bookings', {
        headers: { 'Idempotency-Key': retryKey }, data: submission.postDataJSON(),
      });
      expect(retry.status()).toBe(200);
      expect(await retry.json()).toMatchObject({ isDuplicate: true, booking: { id: bookingId } });
    }
    expect((await db.query('select id from public.auto_bookings where tenant_id=$1 and vehicle_id=$2', [tenantId, vehicleId])).rows).toHaveLength(1);
    expect((await db.query("select id from public.auto_vehicle_status_logs where vehicle_id=$1 and to_status='allocated'", [vehicleId])).rows).toHaveLength(1);
    console.log('AUTOMOVE_DASHBOARD_BOOKING_ALLOCATION_AND_RETRY=PASS');
    const row = page.getByRole('row').filter({ hasText: booking[0].booking_number });

    stage = 'deposit';
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept('100000000');
      else await dialog.accept();
    });
    const depositResponse = page.waitForResponse(response => response.url().endsWith(`/bookings/${bookingId}/confirm-deposit`), { timeout: 60_000 });
    await row.getByRole('button', { name: 'Xác Nhận Cọc', exact: true }).click();
    const confirmedDeposit = await depositResponse;
    expect(confirmedDeposit.status()).toBe(200);
    expect((await confirmedDeposit.json()).data.deposit_id).toBe(confirmedDeposit.request().headers()['idempotency-key']);
    const deposits = (await db.query('select amount,status from public.auto_deposits where booking_id=$1', [bookingId])).rows;
    expect(deposits).toHaveLength(1);
    expect(Number(deposits[0].amount)).toBe(100000000);
    expect(deposits[0].status).toBe('confirmed');
    await row.getByRole('button', { name: `Hồ sơ bán xe ${booking[0].booking_number}`, exact: true }).click();
    const sale = page.getByRole('dialog');
    const sources = Buffer.from('%PDF-1.4\nOwner-approved AutoMove browser financial fixture\n%%EOF\n');
    stage = 'approved snapshot';
    await sale.getByLabel('Giá bán (VND)', { exact: true }).fill('1500000000');
    await sale.getByLabel('Chiết khấu (VND)', { exact: true }).fill('100000000');
    await sale.getByLabel('Giá vốn (VND)', { exact: true }).fill('1000000000');
    for (const label of ['Chứng từ bán xe', 'Chứng từ giá vốn']) {
      await sale.getByLabel(label, { exact: true }).setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: sources });
      await expect(sale.getByText('Đã tải chứng từ', { exact: true })).toHaveCount(label === 'Chứng từ bán xe' ? 1 : 2);
    }
    await sale.getByRole('button', { name: 'Lưu hồ sơ nháp', exact: true }).click();
    await expect(sale.getByRole('status')).toHaveText('Đã lưu hồ sơ nháp.');
    await sale.getByRole('checkbox').check();
    await sale.getByRole('button', { name: 'Duyệt snapshot', exact: true }).click();
    await expect(sale.getByRole('status')).toHaveText('Đã duyệt snapshot tài chính.');
    stage = 'handover';
    await sale.getByRole('button', { name: 'Xác nhận bàn giao', exact: true }).click();
    await expect(sale.getByRole('status')).toHaveText('Đã lưu bằng chứng bàn giao.');
    expect((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows[0].n).toBe(0);
    stage = 'explicit recognition';
    await sale.getByRole('button', { name: 'Ghi nhận doanh thu', exact: true }).click();
    await expect(sale.getByRole('status')).toHaveText('Đã ghi nhận doanh thu bán xe.');
    const recognitionRetry = page.waitForResponse(response => response.url().endsWith('/api/bella-auto/sales-chain/recognize') && response.request().method() === 'POST');
    await sale.getByRole('button', { name: 'Ghi nhận doanh thu', exact: true }).click();
    const retryResponse = await recognitionRetry;
    expect(retryResponse.status()).toBe(200);
    expect(await retryResponse.json()).toMatchObject({ result: { status: 'idempotent' } });
    await expect(sale.getByRole('status')).toHaveText('Đã ghi nhận doanh thu bán xe.');
    const ledger = (await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows;
    expect(ledger).toHaveLength(1);
    expect(Number(ledger[0].sale_price_recognized)).toBe(1400000000);
    expect(Number(ledger[0].cost_basis_at_sale)).toBe(1000000000);
    expect(Number(ledger[0].payment_received_total)).toBe(100000000);
    expect(Number(ledger[0].receivable_amount_at_recognition)).toBe(1300000000);
    stage = 'PASS';
    await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png') });
  } catch (error: unknown) {
    errors.push(error);
    if (authenticated) await page.screenshot({ path: testInfo.outputPath('dashboard-blocker.png') }).catch(() => undefined);
    throw error;
  } finally {
    console.log(`AUTOMOVE_DASHBOARD_STAGE=${stage}`);
    const cleanup = async (operation: () => Promise<unknown>) => {
      try { await operation(); } catch (error: unknown) { errors.push(error); }
    };
    await cleanup(() => page.close());
    if (transaction) await cleanup(() => db.query('rollback'));
    if (seeded) {
      await cleanup(async () => {
        const files = await admin.storage.from('automove-sale-documents').list(tenantId);
        if (files.error) throw new Error('E2E document listing failed.');
        if (files.data.length) {
          const removed = await admin.storage.from('automove-sale-documents').remove(files.data.map(file => `${tenantId}/${file.name}`));
          if (removed.error) throw new Error('E2E document cleanup failed.');
        }
      });
      // Preserve append-only test history. Revoke fixture authority instead of
      // disabling financial guards or deleting approved accounting records.
      await cleanup(() => db.query("update public.users set status='inactive' where id=$1 and tenant_id=$2", [actorId, tenantId]));
      await cleanup(() => db.query("update public.tenants set status='terminated' where id=$1", [tenantId]));
    }
    if (actorId) await cleanup(async () => {
      const removed = await admin.auth.admin.deleteUser(actorId);
      if (removed.error) throw new Error('E2E Auth cleanup failed.');
    });
    await cleanup(() => db.end());
    if (errors.length > 1 || (errors.length && stage === 'PASS')) throw new AggregateError(errors, 'Dashboard verification/cleanup failed.');
    console.log('AUTOMOVE_DASHBOARD_FIXTURE_AUTH_REMOVED_AND_TENANT_ARCHIVED');
  }
});
