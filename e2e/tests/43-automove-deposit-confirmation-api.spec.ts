import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

test.use({ trace: 'off', video: 'off' });

test('AutoMove deposit API: sequential retries, concurrent requests and independent payments', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(new URL(apiUrl).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  if (!adminKey || !process.env.DB_URL) throw new Error('Authorized E2E configuration is required.');
  const db = new Client(saleChainConnection(process.env.DB_URL, apiUrl));
  const admin = createClient(apiUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenantId = randomUUID(), customerId = randomUUID(), brandId = randomUUID(), modelId = randomUUID(), variantId = randomUUID();
  const fullBooking = randomUUID(), partialBooking = randomUUID();
  const concurrentBooking = randomUUID(), independentBooking = randomUUID(), cappedBooking = randomUUID();
  const fullKey = randomUUID(), partialKey = randomUUID();
  const marker = randomUUID().slice(0, 8), email = `automove-deposit-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('hex');
  let actorId: string | undefined, seeded = false, transaction = false;
  const errors: unknown[] = [];
  let stage = 'fixture';
  await db.connect();
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Temporary Auth actor creation failed.');
    actorId = created.data.user.id;
    await db.query('begin'); transaction = true;
    await db.query("insert into public.tenants(id,name,status,enabled_modules) values ($1,$2,'active','{\"bella_auto\":true}')", [tenantId, `AutoMove deposit proof ${marker}`]);
    await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
      values ($1,$2,'AutoMove deposit accountant',$3,'accountant','active')
      on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`, [actorId, email, tenantId]);
    await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values ($1,$2,$3,$4)', [customerId, tenantId, `Deposit customer ${marker}`, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
    await db.query('insert into public.auto_brands(id,tenant_id,name) values ($1,$2,$3)', [brandId, tenantId, `Deposit brand ${marker}`]);
    await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values ($1,$2,$3,$4)', [modelId, tenantId, brandId, `Deposit model ${marker}`]);
    await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values ($1,$2,$3,$4,2026)', [variantId, tenantId, modelId, `Deposit variant ${marker}`]);
    for (const [id, suffix] of [[fullBooking, 'full'], [partialBooking, 'partial'], [concurrentBooking, 'concurrent'],
      [independentBooking, 'independent'], [cappedBooking, 'capped']]) {
      await db.query(`insert into public.auto_bookings(id,tenant_id,customer_id,variant_id,color_exterior,booking_number,total_price,deposit_amount,deposit_paid,status)
        values ($1,$2,$3,$4,'White',$5,1500000000,100000000,0,'pending_deposit')`, [id, tenantId, customerId, variantId, `DEPOSIT-${marker}-${suffix}`]);
    }
    await db.query('commit'); transaction = false; seeded = true;
    stage = 'real login';
    await page.goto('/login');
    await page.getByPlaceholder('email', { exact: true }).fill(email);
    await page.locator('input[type="password"]').fill(password);
    const auth = page.waitForResponse(response => response.url().startsWith(`${apiUrl}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
    expect((await auth).status()).toBe(200);
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    expect((await page.context().cookies()).some(cookie => cookie.name === 'mock_user_email' && cookie.value)).toBe(false);
    const post = (id: string, payload: unknown, key?: string) => page.context().request.post(`/api/bella-auto/bookings/${id}/confirm-deposit`, {
      data: payload, ...(key ? { headers: { 'Idempotency-Key': key } } : {}),
    });
    const read = async (id: string) => ({
      booking: (await db.query('select id,tenant_id,deposit_paid,payment_status,status from public.auto_bookings where id=$1', [id])).rows[0],
      receipts: (await db.query('select id,tenant_id,booking_id,amount,status,created_by,confirmed_by,confirmed_at,transaction_ref from public.auto_deposits where booking_id=$1 order by created_at,id', [id])).rows,
    });
    stage = 'full confirmation';
    const fullRequest = { amount: 100000000, payment_method: 'cash', transaction_ref: `deposit-full-${marker}`, notes: 'API proof' };
    expect((await post(fullBooking, fullRequest)).status()).toBe(400);
    expect((await read(fullBooking)).receipts).toHaveLength(0);
    const full = await post(fullBooking, fullRequest, fullKey);
    expect(full.status()).toBe(200);
    const result = await full.json();
    const persisted = await read(fullBooking);
    expect(persisted.booking).toMatchObject({ id: fullBooking, tenant_id: tenantId, deposit_paid: '100000000', payment_status: 'fully_paid', status: 'pending_deposit' });
    expect(persisted.receipts).toHaveLength(1);
    expect(persisted.receipts[0]).toMatchObject({ id: result.data.deposit_id, booking_id: fullBooking, tenant_id: tenantId,
      amount: '100000000', status: 'confirmed', created_by: actorId, confirmed_by: actorId, transaction_ref: fullRequest.transaction_ref });
    expect(persisted.receipts[0].confirmed_at).toBeTruthy();
    console.log('DEPOSIT_API_CONFIRMED_BOOKING_TENANT_ACTOR_PAYMENT_STATUS=PASS');
    expect(result.data.deposit_id).toBe(fullKey);
    const fullRetry = await post(fullBooking, fullRequest, fullKey);
    expect(fullRetry.status()).toBe(200);
    expect(await fullRetry.json()).toMatchObject({ isDuplicate: true, data: { deposit_id: fullKey } });
    expect(await read(fullBooking)).toEqual(persisted);
    console.log('DEPOSIT_FULL_RETRY=PASS_IDEMPOTENT_REPLAY');
    stage = 'partial confirmation and retry';
    const partialRequest = { amount: 30000000, payment_method: 'cash', transaction_ref: `deposit-partial-${marker}`, notes: 'Identical HTTP retry proof' };
    expect((await post(partialBooking, partialRequest, partialKey)).status()).toBe(200);
    const partial = await read(partialBooking);
    expect(partial.booking).toMatchObject({ deposit_paid: '30000000', payment_status: 'partially_paid', status: 'pending_deposit' });
    expect(partial.receipts).toHaveLength(1);
    console.log('DEPOSIT_PARTIAL_CONFIRMATION=PASS');
    const partialRetry = await post(partialBooking, partialRequest, partialKey);
    expect(partialRetry.status()).toBe(200);
    expect(await partialRetry.json()).toMatchObject({ isDuplicate: true, data: { deposit_id: partialKey } });
    const afterRetry = await read(partialBooking);
    console.log(`DEPOSIT_PARTIAL_RETRY_READ_BACK=${JSON.stringify({ httpStatus: partialRetry.status(), receiptCount: afterRetry.receipts.length,
      depositPaid: afterRetry.booking.deposit_paid, repeatedReference: afterRetry.receipts.map(receipt => receipt.transaction_ref) })}`);
    // Owner-requested retry safety: identical confirmation must not count cash twice.
    expect(afterRetry.receipts, 'An identical partial-payment retry must not create a second receipt.').toHaveLength(1);
    expect(afterRetry.booking.deposit_paid).toBe('30000000');
    expect(afterRetry).toEqual(partial);
    expect((await post(partialBooking, { ...partialRequest, amount: 1 }, partialKey)).status()).toBe(409);
    expect((await post(fullBooking, partialRequest, partialKey)).status()).toBe(409);
    expect(await read(partialBooking)).toEqual(partial);
    console.log('DEPOSIT_SEQUENTIAL_RETRY_AND_CHANGED_PAYLOAD_DENIAL=PASS');

    stage = 'concurrent same key';
    const concurrentKey = randomUUID();
    const cash = { amount: 20000000, payment_method: 'cash', notes: 'Independent cash intent' };
    const sameKey = await Promise.all([post(concurrentBooking, cash, concurrentKey), post(concurrentBooking, cash, concurrentKey)]);
    expect(sameKey.map(response => response.status())).toEqual([200, 200]);
    const sameResults = await Promise.all(sameKey.map(response => response.json()));
    expect(sameResults.map(response => response.data.deposit_id)).toEqual([concurrentKey, concurrentKey]);
    expect(sameResults.map(response => response.isDuplicate).sort()).toEqual([false, true]);
    const concurrent = await read(concurrentBooking);
    expect(concurrent.receipts).toHaveLength(1); expect(concurrent.booking.deposit_paid).toBe('20000000');
    console.log('DEPOSIT_CONCURRENT_SAME_KEY_ONE_RECEIPT_ONE_CREDIT=PASS');

    stage = 'independent intents';
    const independentKey = randomUUID();
    expect((await post(partialBooking, partialRequest, independentKey)).status()).toBe(200);
    const independent = await read(partialBooking);
    expect(independent.receipts).toHaveLength(2); expect(independent.booking.deposit_paid).toBe('60000000');
    expect(independent.receipts.map(receipt => receipt.id).sort()).toEqual([partialKey, independentKey].sort());
    const oldReplay = await post(partialBooking, partialRequest, partialKey);
    expect(await oldReplay.json()).toMatchObject({ isDuplicate: true, data: { deposit_id: partialKey, new_deposit_paid: 60000000 } });
    expect(await read(partialBooking)).toEqual(independent);
    const cashKeys = [randomUUID(), randomUUID()];
    const independentCalls = await Promise.all(cashKeys.map(key => post(independentBooking, cash, key)));
    expect(independentCalls.map(response => response.status())).toEqual([200, 200]);
    const independentConcurrent = await read(independentBooking);
    expect(independentConcurrent.receipts).toHaveLength(2); expect(independentConcurrent.booking.deposit_paid).toBe('40000000');
    expect(independentConcurrent.receipts.map(receipt => receipt.id).sort()).toEqual([...cashKeys].sort());
    console.log('DEPOSIT_INDEPENDENT_EQUAL_AMOUNT_KEYS_SEQUENTIAL_AND_CONCURRENT=PASS');

    stage = 'concurrent overpayment guard';
    const cappedCalls = await Promise.all([post(cappedBooking, { ...cash, amount: 70000000 }, randomUUID()),
      post(cappedBooking, { ...cash, amount: 70000000 }, randomUUID())]);
    expect(cappedCalls.map(response => response.status()).sort()).toEqual([200, 400]);
    const capped = await read(cappedBooking);
    expect(capped.receipts).toHaveLength(1); expect(capped.booking.deposit_paid).toBe('70000000');
    console.log('DEPOSIT_CONCURRENT_OVERPAYMENT_NO_PARTIAL_WRITE=PASS');
    stage = 'PASS';
  } catch (error: unknown) { errors.push(error); throw error; }
  finally {
    console.log(`DEPOSIT_API_VERIFICATION_STAGE=${stage}`);
    const clean = async (operation: () => Promise<unknown>) => { try { await operation(); } catch (error: unknown) { errors.push(error); } };
    await clean(() => page.close());
    if (transaction) await clean(() => db.query('rollback'));
    if (seeded) {
      await clean(() => db.query("update public.users set status='inactive' where id=$1 and tenant_id=$2", [actorId, tenantId]));
      await clean(() => db.query("update public.tenants set status='terminated' where id=$1", [tenantId]));
    }
    if (actorId) await clean(async () => { const removed = await admin.auth.admin.deleteUser(actorId!); if (removed.error) throw new Error('E2E Auth cleanup failed.'); });
    await clean(() => db.end());
    if (errors.length > 1 || (errors.length && stage === 'PASS')) throw new AggregateError(errors, 'Deposit proof/cleanup failed.');
    console.log('DEPOSIT_API_FIXTURE_AUTH_REMOVED_AND_TENANT_ARCHIVED');
  }
});
