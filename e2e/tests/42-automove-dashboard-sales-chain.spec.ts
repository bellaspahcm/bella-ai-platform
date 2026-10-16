import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { continueAutoMoveRc } from '../fixtures/automove-rc-continuation';

// Expectations come from the owner-approved PR #327 contract. All mutations
// under test go through the actual dashboard, Auth, Storage and Next.js APIs.
test.use({ trace: 'off', video: 'off' });

test('AutoMove actual dashboard: login to booking, deposit and explicit recognition', async ({ page, baseURL }, testInfo) => {
  // Includes separate receipt collection, lost acknowledgement and reconciliation.
  test.setTimeout(process.env.AUTOMOVE_RC_SHA ? 720_000 : 480_000);
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DB_URL || process.env.SUPABASE_DB_URL || '';
  expect(new URL(apiUrl).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  if (!publicKey || !adminKey || !dbUrl) throw new Error('Non-Production Auth and DB configuration is required.');
  const db = new Client(saleChainConnection(dbUrl, apiUrl));
  const admin = createClient(apiUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenantId = randomUUID(), otherTenantId = randomUUID(), customerId = randomUUID(), brandId = randomUUID();
  const modelId = randomUUID(), variantId = randomUUID(), vehicleId = randomUUID();
  const periodId = randomUUID();
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
  db.on('error', error => { errors.push(error); });
  await db.connect();
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Temporary E2E Auth actor creation failed.');
    actorId = created.data.user.id;
    await db.query('begin'); transaction = true;
    await db.query(`insert into public.tenants (id,name,status,enabled_modules)
      values ($1,$2,'active','{"bella_auto":true}')`, [tenantId, `AutoMove browser proof ${suffix}`]);
    await db.query(`insert into public.tenants (id,name,status,enabled_modules)
      values ($1,$2,'active','{"bella_auto":true}')`, [otherTenantId, `AutoMove isolation proof ${suffix}`]);
    await db.query(`insert into public.users (id,email,full_name,tenant_id,role,status)
      values ($1,$2,'AutoMove browser accountant',$3,'accountant','active')
      on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`, [actorId, email, tenantId]);
    await db.query('insert into public.customers (id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)', [customerId, tenantId, customerName, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
    await db.query('insert into public.auto_brands (id,tenant_id,name) values ($1,$2,$3)', [brandId, tenantId, brandName]);
    await db.query('insert into public.auto_models (id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [modelId, tenantId, brandId, modelName]);
    await db.query('insert into public.auto_variants (id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [variantId, tenantId, modelId, variantName]);
    await db.query(`insert into public.auto_vehicles (id,tenant_id,variant_id,vin,color_exterior,model_year,list_price,cost_price,status)
      values ($1,$2,$3,$4,'Trắng',2026,9900000000,8800000000,'showroom')`, [vehicleId, tenantId, variantId, vin]);
    await db.query(`insert into public.auto_bookings
      (tenant_id,booking_number,customer_id,variant_id,color_exterior,total_price,deposit_amount,deposit_paid,status,payment_status)
      values($1,$2,$3,$4,'Trắng',9900000000,0,0,'completed','unpaid')`,
      [tenantId,`NEGATIVE-${suffix}`,customerId,variantId]);
    if (process.env.AUTOMOVE_RC_SHA) await db.query(`insert into public.accounting_periods(id,tenant_id,name,start_date,end_date,status)
      values($1,$2,'AutoMove isolated RC period',date_trunc('month',now())::date,(date_trunc('month',now())+interval '1 month'-interval '1 day')::date,'OPEN')`, [periodId,tenantId]);
    await db.query('commit'); transaction = false; seeded = true;

    stage = 'login';
    await page.goto('/login');
    await page.getByPlaceholder('email', { exact: true }).fill(email);
    await page.locator('input[type="password"]').fill(password);
    const login = page.waitForResponse(response => response.url().startsWith(`${apiUrl}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
    expect((await login).status(), 'Real Supabase password authentication must succeed.').toBe(200);
    await page.waitForURL(/\/dashboard(?:\/bella-auto)?(?:[/?#]|$)/, { timeout: 60_000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'mock_user_email' && cookie.value)).toBe(false);
    authenticated = true;

    stage = 'booking dashboard';
    await page.waitForURL('**/dashboard/bella-auto', { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('recognized-sales-current-month')).toContainText('0 VNĐ', { timeout: 60_000 });
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
    const depositOnlyReport = await page.context().request.get('/api/bella-auto/analytics/recognized-sales');
    expect(depositOnlyReport.status()).toBe(200);
    expect((await depositOnlyReport.json()).revenueByMonth.every((month: { revenue: number }) => month.revenue === 0)).toBe(true);
    await row.getByRole('button', { name: `Hồ sơ bán xe ${booking[0].booking_number}`, exact: true }).click();
    const sale = page.getByRole('dialog');
    const sources = Buffer.from('%PDF-1.4\nOwner-approved AutoMove browser financial fixture\n%%EOF\n');
    stage = 'approved snapshot';
    await expect(sale.getByLabel('Giá bán (VND)', { exact: true })).toBeVisible({ timeout:60_000 });
    await sale.getByLabel('Giá bán (VND)', { exact: true }).fill('1500000000');
    await sale.getByLabel('Chiết khấu (VND)', { exact: true }).fill('100000000');
    await sale.getByLabel('Giá vốn (VND)', { exact: true }).fill('1000000000');
    for (const label of ['Chứng từ bán xe', 'Chứng từ giá vốn']) {
      await sale.getByLabel(label, { exact: true }).setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: sources });
      await expect(sale.getByText('Đã tải chứng từ', { exact: true })).toHaveCount(label === 'Chứng từ bán xe' ? 1 : 2);
    }
    const snapshotSaved = page.waitForResponse(response => response.url().endsWith('/sales-chain/snapshot') && response.request().method() === 'POST', { timeout: 60_000 });
    await sale.getByRole('button', { name: 'Lưu hồ sơ nháp', exact: true }).click();
    expect((await snapshotSaved).status()).toBe(200);
    await expect(sale.getByRole('status')).toHaveText('Đã lưu hồ sơ nháp.');
    await sale.getByRole('checkbox', { name: 'Tôi đã kiểm tra chứng từ và xác nhận các giá trị tài chính.' }).check();
    const approved = page.waitForResponse(response => response.url().endsWith('/sales-chain/approve') && response.request().method() === 'POST', { timeout: 60_000 });
    await sale.getByRole('button', { name: 'Duyệt snapshot', exact: true }).click();
    expect((await approved).status()).toBe(200);
    await expect(sale.getByRole('status')).toHaveText('Đã duyệt snapshot tài chính.');
    stage = 'handover';
    const handedOver = page.waitForResponse(response => response.url().endsWith('/sales-chain/handover') && response.request().method() === 'POST', { timeout: 60_000 });
    await sale.getByRole('button', { name: 'Xác nhận bàn giao', exact: true }).click();
    expect((await handedOver).status()).toBe(200);
    await expect(sale.getByRole('status')).toHaveText('Đã lưu bằng chứng bàn giao.');
    expect((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows[0].n).toBe(0);
    const handoverOnlyReport = await page.context().request.get('/api/bella-auto/analytics/recognized-sales');
    expect(handoverOnlyReport.status()).toBe(200);
    expect((await handoverOnlyReport.json()).revenueByMonth.every((month: { revenue: number }) => month.revenue === 0)).toBe(true);
    stage = 'explicit recognition';
    const recognized = page.waitForResponse(response => response.url().endsWith('/sales-chain/recognize') && response.request().method() === 'POST', { timeout: 60_000 });
    await sale.getByRole('button', { name: 'Ghi nhận doanh thu', exact: true }).click();
    expect((await recognized).status()).toBe(200);
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

    stage = 'post-sale collection and lost-response recovery';
    const payments = sale.getByRole('region', { name: 'Thanh toán sau bán', exact: true });
    await expect(payments.getByTestId('settlement-outstanding')).toHaveText('1.300.000.000 VND');
    await payments.getByLabel('Số tiền sau bán (VND)', { exact: true }).fill('300000000');
    await payments.getByLabel('Phương thức thu', { exact: true }).selectOption('bank_transfer');
    await payments.getByLabel('Mã giao dịch', { exact: true }).fill(`sale-bank-${suffix}`);
    const paymentUrl = `/api/bella-auto/bookings/${bookingId}/sale-payments`;
    let loseResponse = true;
    let forwardedPaymentStatus = 0;
    await page.route(`**${paymentUrl}`, async route => {
      if (route.request().method() === 'POST' && loseResponse) {
        loseResponse = false;
        try { forwardedPaymentStatus = (await route.fetch({timeout:60_000})).status(); }
        catch { forwardedPaymentStatus = -1; }
        finally { await route.abort('failed').catch(() => undefined); }
      } else await route.continue();
    });
    const firstRequest = page.waitForRequest(request => request.url().endsWith(paymentUrl) && request.method() === 'POST');
    await payments.getByRole('button', { name: 'Xác nhận thu tiền sau bán', exact: true }).click();
    const paymentRequest = await firstRequest;
    await expect(payments.getByRole('alert')).toBeVisible({timeout:60_000});
    expect(forwardedPaymentStatus).toBe(200);
    await expect(payments.getByRole('status')).toHaveCount(0);
    expect((await db.query('select amount from public.auto_vehicle_sale_payments where booking_id=$1', [bookingId])).rows).toEqual([{ amount: '300000000' }]);
    const retryPayment = page.waitForResponse(response => response.url().endsWith(paymentUrl) && response.request().method() === 'POST');
    await payments.getByRole('button', { name: 'Thử lại cùng yêu cầu thu', exact: true }).click();
    const retriedPayment = await retryPayment;
    expect(retriedPayment.status()).toBe(200);
    expect(retriedPayment.request().headers()['idempotency-key']).toBe(paymentRequest.headers()['idempotency-key']);
    expect(await retriedPayment.json()).toMatchObject({ result: { duplicate: true, state: { outstanding: 1000000000 } } });
    await expect(payments.getByTestId('settlement-paid')).toHaveText('300.000.000 VND');
    await expect(payments.getByRole('list', { name: 'Receipt sau bán' }).getByRole('listitem')).toHaveCount(1);
    const postPayment = (key: string, amount: number, transactionRef: string | null = null) => page.context().request.post(paymentUrl, {
      headers: { 'Idempotency-Key': key }, data: { amount, paymentMethod: transactionRef ? 'bank_transfer' : 'cash', transactionRef, notes: null },
    });
    expect((await page.context().request.post(paymentUrl, { headers: { 'Idempotency-Key': paymentRequest.headers()['idempotency-key'] },
      data: { ...paymentRequest.postDataJSON(), amount: 1 } })).status()).toBe(409);
    expect((await postPayment(randomUUID(), 300000000, `sale-bank-${suffix}`)).status()).toBe(409);
    expect((await postPayment(randomUUID(), 1000000001)).status()).toBe(400);
    stage = 'post-sale concurrent receipt idempotency';
    const concurrentKey = randomUUID();
    const concurrent = await Promise.all([postPayment(concurrentKey, 100000000), postPayment(concurrentKey, 100000000)]);
    expect(concurrent.map(response => response.status())).toEqual([200, 200]);
    expect((await Promise.all(concurrent.map(response => response.json()))).map(payload => payload.result.duplicate).sort()).toEqual([false, true]);
    const independent = await Promise.all([postPayment(randomUUID(), 200000000), postPayment(randomUUID(), 200000000)]);
    expect(independent.map(response => response.status())).toEqual([200, 200]);
    stage = 'post-sale mismatch prevents false success';
    await db.query('update public.auto_bookings set deposit_paid=200000000 where id=$1', [bookingId]);
    await payments.getByRole('button', { name: 'Tải lại thanh toán', exact: true }).click();
    await expect(payments.getByTestId('settlement-reconciliation')).toHaveText('Sai lệch');
    await expect(payments.getByRole('alert')).toContainText('DEPOSIT_RECEIPT_MISMATCH');
    await expect(payments.getByRole('button', { name: 'Xác nhận thu tiền sau bán', exact: true })).toHaveCount(0);
    expect((await postPayment(randomUUID(), 1)).status()).toBe(409);
    expect((await db.query('select count(*)::int n from public.auto_vehicle_sale_payments where booking_id=$1', [bookingId])).rows[0].n).toBe(4);
    await db.query('update public.auto_bookings set deposit_paid=100000000 where id=$1', [bookingId]);
    await payments.getByRole('button', { name: 'Tải lại thanh toán', exact: true }).click();
    await expect(payments.getByTestId('settlement-reconciliation')).toHaveText('Khớp');
    await expect(payments.getByTestId('settlement-outstanding')).toHaveText('500.000.000 VND');
    await payments.getByLabel('Số tiền sau bán (VND)', { exact: true }).fill('500000000');
    await payments.getByRole('button', { name: 'Xác nhận thu tiền sau bán', exact: true }).click();
    await expect(payments.getByTestId('settlement-outstanding')).toHaveText('0 VND');
    await expect(payments.getByTestId('settlement-paid')).toHaveText('1.300.000.000 VND');
    await expect(payments.getByRole('list', { name: 'Receipt sau bán' }).getByRole('listitem')).toHaveCount(5);
    await db.query('update public.auto_bookings set deposit_amount=200000000 where id=$1', [bookingId]);
    const lateDeposit = await page.context().request.post(`/api/bella-auto/bookings/${bookingId}/confirm-deposit`, {
      headers: { 'Idempotency-Key': randomUUID() }, data: { amount: 1, payment_method: 'cash' },
    });
    expect(lateDeposit.status()).toBe(409);
    expect(await lateDeposit.json()).toMatchObject({ code: 'DEPOSIT_EXCEEDS_SALE_BALANCE' });
    expect((await db.query('select deposit_paid from public.auto_bookings where id=$1', [bookingId])).rows[0].deposit_paid).toBe('100000000');
    console.log('AUTOMOVE_COMBINED_COLLECTION_CAP_API=PASS');
    await sale.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Thanh toán sau bán', exact: true }).click();
    const reopenedPayment = page.waitForResponse(response => response.url().endsWith(paymentUrl) && response.request().method() === 'GET', { timeout: 60_000 });
    await row.getByRole('button', { name: `Hồ sơ bán xe ${booking[0].booking_number}`, exact: true }).click();
    const persistedPayment = await reopenedPayment;
    expect(persistedPayment.status()).toBe(200);
    expect(await persistedPayment.json()).toMatchObject({ result: { outstanding: 0, postSaleReceived: 1300000000, status: 'MATCHED' } });
    await expect(payments.getByTestId('settlement-outstanding')).toHaveText('0 VND');
    await payments.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('post-sale-receipts-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await payments.getByTestId('settlement-outstanding').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('post-sale-receipts-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await db.query('select sum(amount)::text total from public.auto_vehicle_sale_payments where booking_id=$1', [bookingId])).rows[0].total).toBe('1300000000');
    expect((await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows).toEqual(ledger);
    console.log('AUTOMOVE_POST_SALE_UI_API_DB_RETRY_CONCURRENCY_RECONCILIATION=PASS');
    await sale.getByRole('button', { name: 'Đóng', exact: true }).click();
    const reportResponse = page.waitForResponse(response => response.url().endsWith('/api/bella-auto/analytics/recognized-sales'));
    await page.goto('/dashboard/bella-auto');
    const report = await reportResponse;
    expect(report.status()).toBe(200);
    expect(report.headers()['cache-control']).toContain('no-store');
    const reportData = await report.json();
    const recognizedMonth = new Date(ledger[0].recognized_at).toISOString().slice(0,7);
    expect(reportData.revenueByMonth.find((month: { month: string }) => month.month === recognizedMonth))
      .toMatchObject({ revenue: 1400000000, sales: 1 });
    expect(reportData.topModels).toEqual([{ model: modelName, sold: 1, revenue: 1400000000 }]);
    await expect(page.getByTestId('recognized-sales-current-month')).toContainText('1.400.000.000 VNĐ', { timeout: 60_000 });
    await expect(page.getByTestId('recognized-sales-total')).toContainText('1.400.000.000 VNĐ');
    await expect(page.getByTestId('recognized-sales-average')).toContainText('1.400.000.000 VNĐ');
    await page.reload();
    await expect(page.getByTestId('recognized-sales-current-month')).toContainText('1.400.000.000 VNĐ', { timeout: 60_000 });
    expect((await db.query('select count(*)::int as n from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows[0].n).toBe(1);
    stage = 'PASS';
    await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('recognized-sales-current-month')).toContainText('1.400.000.000 VNĐ');
    await page.getByTestId('recognized-sales-current-month').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('recognized-sales-mobile.png') });
    console.log('AUTOMOVE_ACTUAL_DASHBOARD_RECOGNIZED_REVENUE_AND_LEDGER_READBACK=PASS');

    stage = 'business transaction authorization';
    // The real Auth session remains unchanged. Current DB authority, not its
    // original JWT tenant/status, must control access to this persisted sale.
    const stateUrl = `/api/bella-auto/sales-chain/state?bookingId=${bookingId}`;
    const recognitionPayload = retryResponse.request().postDataJSON();
    const beforeSecurity = {
      ledger: (await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows,
      receipts: (await db.query('select * from public.auto_vehicle_sale_payments where booking_id=$1 order by id', [bookingId])).rows,
    };
    const relations = ['auto_bookings','auto_deposits','auto_vehicle_sale_financial_snapshots',
      'auto_vehicle_sale_recognitions','auto_vehicle_sale_payments'];
    const databaseVisibility = async (allowed: boolean) => {
      await db.query('begin'); transaction = true;
      try {
        await db.query('set local role authenticated');
        await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actorId]);
        for (const relation of relations) {
          await db.query('savepoint visibility');
          let visible = 0, denied = false;
          try {
            const column = relation === 'auto_bookings' ? 'id' : 'booking_id';
            visible = (await db.query(`select id from public.${relation} where ${column}=$1`, [bookingId])).rows.length;
          } catch (error: unknown) {
            expect(error && typeof error === 'object' && 'code' in error && error.code).toBe('42501');
            denied = true;
          } finally {
            await db.query('rollback to savepoint visibility');
            await db.query('release savepoint visibility');
          }
          if (allowed) expect(visible, `${relation}: own sale must be visible`).toBeGreaterThan(0);
          else expect(denied || visible === 0, `${relation}: forbidden sale must not be visible`).toBe(true);
        }
      } finally { await db.query('rollback'); transaction = false; }
    };
    await databaseVisibility(true);
    const deniedHttp = async (status: number) => {
      for (const path of [stateUrl, paymentUrl]) {
        const response = await page.context().request.get(path);
        expect(response.status(), path).toBe(status);
        const body = await response.json();
        expect(body.error).toBeTruthy();
        expect(body).not.toHaveProperty('result');
      }
      const response = await page.context().request.post('/api/bella-auto/sales-chain/recognize', { data: recognitionPayload });
      expect(response.status()).toBe(status);
      expect(await response.json()).not.toHaveProperty('result');
      const collection = await postPayment(randomUUID(), 1);
      expect(collection.status()).toBe(status);
    };
    try {
      await db.query('update public.users set tenant_id=$2 where id=$1', [actorId, otherTenantId]);
      await databaseVisibility(false); await deniedHttp(404);
      console.log('AUTOMOVE_SAME_AUTH_CROSS_TENANT_DB_API_DENIAL=PASS');
      await db.query("update public.users set tenant_id=$2,status='inactive' where id=$1", [actorId, tenantId]);
      await databaseVisibility(false); await deniedHttp(403);
      console.log('AUTOMOVE_SAME_AUTH_INACTIVE_DB_API_DENIAL=PASS');
      await db.query("update public.users set status='active' where id=$1", [actorId]);
      await db.query("update public.tenants set status='suspended' where id=$1", [tenantId]);
      await databaseVisibility(false); await deniedHttp(403);
      console.log('AUTOMOVE_SAME_AUTH_SUSPENDED_TENANT_DB_API_DENIAL=PASS');
    } finally {
      await db.query("update public.users set tenant_id=$2,status='active' where id=$1", [actorId, tenantId]);
      await db.query("update public.tenants set status='active' where id=$1", [tenantId]);
    }
    await databaseVisibility(true);
    expect((await page.context().request.get(stateUrl)).status()).toBe(200);
    expect(await (await page.context().request.get(paymentUrl)).json()).toMatchObject({ result: { outstanding: 0, status: 'MATCHED' } });
    expect({
      ledger: (await db.query('select * from public.auto_vehicle_sale_recognitions where booking_id=$1', [bookingId])).rows,
      receipts: (await db.query('select * from public.auto_vehicle_sale_payments where booking_id=$1 order by id', [bookingId])).rows,
    }).toEqual(beforeSecurity);
    if (process.env.AUTOMOVE_RC_SHA) await continueAutoMoveRc(page, db, bookingId, booking[0].booking_number, ledger[0].id, testInfo);
    stage = 'PASS';
    await testInfo.attach('business-chain-proof', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      baseline: process.env.AUTOMOVE_RC_SHA || '2652d3b645b89715e4ca970d76b057a94775f7d2', releaseBuildId: process.env.AUTOMOVE_RC_BUILD_ID, tenantId, otherTenantId, bookingId,
      recognitionId: ledger[0].id, recognized: 1400000000, deposit: 100000000, postSalePaid: 1300000000,
      outstanding: 0, receiptCount: 5, reconciliation: 'MATCHED', security: 'PROVEN_ON_NON_PRODUCTION',
      setup: 'Customer/catalog/vehicle are privileged fixtures, not UI-created records', readiness: 'NOT_READY',
    }, null, 2)) });
  } catch (error: unknown) {
    errors.push(error);
    if (authenticated) await page.screenshot({ path: testInfo.outputPath('dashboard-blocker.png') }).catch(() => undefined);
    throw error;
  } finally {
    console.log(`AUTOMOVE_DASHBOARD_STAGE=${stage}`);
    const cleanup = async (operation: () => Promise<unknown>) => {
      try { await operation(); } catch (error: unknown) { errors.push(error); }
    };
    await cleanup(() => page.unrouteAll({behavior:'wait'}));
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
      await cleanup(async () => {
        const teardownDb = new Client(saleChainConnection(dbUrl, apiUrl));
        try {
          await teardownDb.connect();
          await teardownDb.query('begin');
          if (process.env.AUTOMOVE_RC_SHA) await teardownDb.query("update public.accounting_periods set status='CLOSED' where id=$1 and tenant_id=$2", [periodId,tenantId]);
          await teardownDb.query("update public.users set status='inactive' where id=$1 and tenant_id=$2", [actorId, tenantId]);
          await teardownDb.query("update public.tenants set status='terminated' where id=any($1::uuid[])", [[tenantId, otherTenantId]]);
          await teardownDb.query('commit');
        } catch (error: unknown) {
          await teardownDb.query('rollback').catch(() => undefined);
          throw error;
        } finally { await teardownDb.end(); }
      });
    }
    const cleanupActor = actorId;
    if (cleanupActor) await cleanup(async () => {
      const removed = await admin.auth.admin.deleteUser(cleanupActor);
      if (removed.error) throw new Error('E2E Auth cleanup failed.');
    });
    if (seeded) await cleanup(async () => {
      expect((await db.query('select id from auth.users where id=$1', [actorId])).rows).toHaveLength(0);
      expect((await db.query("select id from public.users where id=$1 and status='active'", [actorId])).rows).toHaveLength(0);
      expect((await db.query('select status from public.tenants where id=any($1::uuid[])', [[tenantId, otherTenantId]])).rows)
        .toEqual([{ status: 'terminated' }, { status: 'terminated' }]);
      const files = await admin.storage.from('automove-sale-documents').list(tenantId);
      if (files.error) throw new Error('E2E Storage cleanup read-back failed.');
      expect(files.data).toHaveLength(0);
      console.log('AUTOMOVE_CHAIN_CLEANUP=AUTH_ZERO_ACTIVE_ACTOR_ZERO_DOCUMENTS_ZERO_TWO_ARCHIVED_TENANTS_HISTORY_RETAINED');
    });
    await cleanup(() => db.end());
    if (errors.length > 1 || (errors.length && stage === 'PASS')) throw new AggregateError(errors, 'Dashboard verification/cleanup failed.');
    console.log('AUTOMOVE_DASHBOARD_FIXTURE_AUTH_REMOVED_AND_TENANT_ARCHIVED');
  }
});
