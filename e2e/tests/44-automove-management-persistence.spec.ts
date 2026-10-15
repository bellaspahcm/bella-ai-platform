import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

test.use({ trace: 'off', video: 'off' });

// Owner-approved Browser -> API -> DB management persistence contract.
test('AutoMove management: actual customer list, persisted preferences and vehicle intake', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(360_000);
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(new URL(api).hostname).toBe('bmnbqbcdbuklhopfbopv.supabase.co');
  expect(baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)).toBe(true);
  if (!key) throw new Error('Authorized Non-Production Auth configuration is required.');
  const db = new Client(saleChainConnection(process.env.DB_URL || process.env.SUPABASE_DB_URL || '', api));
  const admin = createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenant = randomUUID(), customer = randomUUID();
  const otherTenant = randomUUID(), foreignCustomer = randomUUID();
  const brand = randomUUID(), model = randomUUID(), variant = randomUUID(), vehicle = randomUUID();
  const email = `automove-management-${randomUUID()}@example.test`, password = randomBytes(32).toString('hex');
  const marker = randomUUID().slice(0, 8), customerName = `Readiness customer ${marker}`;
  const vin = randomUUID().replaceAll('-', '').slice(0, 17).toUpperCase();
  const stockVin = randomUUID().replaceAll('-', '').slice(0, 17).toUpperCase();
  let actor: string | undefined, seeded = false;
  const cleanupErrors: string[] = [];
  await db.connect();
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('E2E actor creation failed.');
    actor = created.data.user.id;
    await db.query('begin');
    try {
      await db.query(`insert into public.tenants(id,name,status,enabled_modules)
        values($1,$2,'active','{"bella_auto":true}')`, [tenant, `AutoMove management proof ${marker}`]);
      await db.query(`insert into public.tenants(id,name,status,enabled_modules)
        values($1,$2,'active','{"bella_auto":true}')`, [otherTenant, `AutoMove management isolation ${marker}`]);
      await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status)
        values($1,$2,'Management proof accountant',$3,'accountant','active')
        on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`, [actor, email, tenant]);
      await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,$3,$4)',
        [customer, tenant, customerName, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
      await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,$3,$4)',
        [foreignCustomer, otherTenant, `Foreign customer ${marker}`, randomUUID()]);
      await db.query('insert into public.auto_customer_profiles(tenant_id,customer_id,metadata) values($1,$2,$3)', [tenant,customer,JSON.stringify({ retained: marker })]);
      await db.query('insert into public.auto_brands(id,tenant_id,name) values($1,$2,$3)', [brand, tenant, `Management brand ${marker}`]);
      await db.query('insert into public.auto_models(id,tenant_id,brand_id,name) values($1,$2,$3,$4)', [model, tenant, brand, `Management model ${marker}`]);
      await db.query('insert into public.auto_variants(id,tenant_id,model_id,name,year) values($1,$2,$3,$4,2026)', [variant, tenant, model, `Management variant ${marker}`]);
      await db.query(`insert into public.auto_vehicles(id,tenant_id,variant_id,vin,color_exterior,model_year,status)
        values($1,$2,$3,$4,'White',2026,'showroom')`, [vehicle, tenant, variant, stockVin]);
      await db.query('commit'); seeded = true;
    } catch (error: unknown) { await db.query('rollback'); throw error; }
    await page.goto('/login');
    await page.getByPlaceholder('email', { exact: true }).fill(email);
    await page.locator('input[type="password"]').fill(password);
    const login = page.waitForResponse(response => response.url().startsWith(`${api}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
    expect((await login).status()).toBe(200);
    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    await page.waitForURL('**/dashboard/bella-auto', { timeout: 60_000 });
    await page.goto('/dashboard/bella-auto/customers');
    await expect(page.getByRole('heading', { name: 'Hồ Sơ Khách Hàng 360°', exact: true })).toBeVisible();
    const search = page.getByPlaceholder('Tìm theo tên hoặc SĐT...', { exact: true });
    const customersLoaded=page.waitForResponse(response=>{
      const url=new URL(response.url());
      return url.pathname==='/api/bella-auto/customers'&&url.searchParams.get('q')===customerName;
    },{timeout:60_000});
    await search.fill(customerName);
    const customersResponse=await customersLoaded;
    expect(customersResponse.status()).toBe(200);
    expect((await customersResponse.json()).customers.map((row:{id:string})=>row.id)).toEqual([customer]);
    await expect(page.getByRole('button').filter({ hasText: customerName }),
      'The tenant customer persisted in DB must appear in the actual customer management UI.').toHaveCount(1);
    const customerVisible = await page.getByRole('button').filter({ hasText: customerName }).count();
    await page.screenshot({ path: testInfo.outputPath('customer-search-real-db.png') });
    await search.fill('');
    const preference = `readiness-${marker}`;
    await expect(page.getByPlaceholder('BMW, Porsche, VinFast', { exact: true })).toBeEditable({timeout:60_000});
    await page.getByPlaceholder('BMW, Porsche, VinFast', { exact: true }).fill(preference);
    await page.getByRole('button', { name: 'Lưu Thay Đổi', exact: true }).click();
    await expect(page.getByText('Đã cập nhật sở thích xe của khách hàng!', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('customer-save-success.png') });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hồ Sơ Khách Hàng 360°', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('BMW, Porsche, VinFast', { exact: true }),
      'A successful preference save must survive reload.').toHaveValue(preference,{timeout:60_000});
    const preferenceAfterReload = await page.getByPlaceholder('BMW, Porsche, VinFast', { exact: true }).inputValue();
    const profileRows = (await db.query('select id,preferred_brands,metadata from public.auto_customer_profiles where tenant_id=$1 and customer_id=$2',[tenant,customer])).rows;
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0]).toMatchObject({ preferred_brands: [preference], metadata: { retained: marker } });
    const profileUrl = `/api/bella-auto/customers/${customer}/profile`;
    const preferences = { preferredBrands: [preference], preferredSegments: [], budgetRange: null, purchasingPurpose: null };
    expect((await page.context().request.put(profileUrl,{data:preferences})).status()).toBe(200);
    expect((await db.query('select id from public.auto_customer_profiles where tenant_id=$1 and customer_id=$2',[tenant,customer])).rows).toEqual([{id:profileRows[0].id}]);
    console.log('AUTOMOVE_CUSTOMER_REAL_DATA_PREFERENCES_DB_RELOAD_RETRY_METADATA=PASS');

    await page.route(`**${profileUrl}`, async route => {
      if(route.request().method()==='PUT') await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Injected transport failure'})});
      else await route.continue();
    });
    await page.getByPlaceholder('BMW, Porsche, VinFast',{exact:true}).fill('not-persisted');
    await page.getByRole('button',{name:'Lưu Thay Đổi',exact:true}).click();
    await expect(page.getByRole('alert').filter({hasText:'Không xác minh được thay đổi đã lưu'})).toBeVisible();
    expect((await db.query('select preferred_brands from public.auto_customer_profiles where customer_id=$1',[customer])).rows).toEqual([{preferred_brands:[preference]}]);
    await page.unroute(`**${profileUrl}`);

    await page.goto('/dashboard/bella-auto/vehicles');
    await expect(page.getByText(stockVin, { exact: true })).toBeVisible({ timeout: 60_000 });
    console.log('AUTOMOVE_INVENTORY_CANONICAL_TENANT_DB_UI_READBACK=PASS');
    await page.getByRole('button', { name: 'Nhập Xe Mới', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nhập Xe Mới Vào Kho', exact: true })).toBeVisible();
    const intake=page.getByRole('dialog',{name:'Nhập xe mới',exact:true});
    await intake.getByLabel('Thương hiệu xe',{exact:true}).selectOption(brand);
    await intake.getByLabel('Dòng xe',{exact:true}).selectOption(model);
    await intake.getByLabel('Phiên bản xe',{exact:true}).selectOption(variant);
    await page.getByPlaceholder('WBAHF3C01L7D34567', { exact: true }).fill(vin);
    await page.getByPlaceholder('Alpine White', { exact: true }).fill('White');
    await page.getByPlaceholder('2,439,000,000', { exact: true }).fill('1500000000');
    let loseAcknowledgement=true;
    let completeInterception!: (result:{status:number;body:unknown})=>void;
    const interceptedResult=new Promise<{status:number;body:unknown}>(resolve=>{completeInterception=resolve;});
    await page.route('**/api/bella-auto/vehicles',async route=>{
      if(route.request().method()==='POST'&&loseAcknowledgement){
        loseAcknowledgement=false;
        try{
          const response=await route.fetch({timeout:60_000});
          const result={status:response.status(),body:await response.json()};
          if(response.status()===200)await route.abort('failed');
          else await route.fulfill({response});
          completeInterception(result);
        }catch{
          await route.abort('failed').catch(()=>undefined);
          completeInterception({status:0,body:'Transport failed before acknowledgement'});
        }
      }else await route.continue();
    });
    const firstRequest=page.waitForRequest(request=>request.url().endsWith('/api/bella-auto/vehicles')&&request.method()==='POST');
    await intake.getByRole('button', { name: 'Thêm vào kho', exact: true }).click();
    const initial=await firstRequest;
    expect(await interceptedResult,'Real registration response before injected lost acknowledgement').toMatchObject({status:200});
    await expect(intake.getByRole('alert')).toBeVisible();
    await expect(page.getByText(`Đã thêm xe VIN ${vin} vào kho thành công!`,{exact:true})).toHaveCount(0);
    expect((await db.query('select id from public.auto_vehicles where vin=$1',[vin])).rows).toHaveLength(1);
    const retried=page.waitForResponse(response=>response.url().endsWith('/api/bella-auto/vehicles')&&response.request().method()==='POST');
    await intake.getByRole('button',{name:'Thử lại cùng yêu cầu nhập xe',exact:true}).click();
    const retryResponse=await retried;
    expect(retryResponse.status()).toBe(200);
    expect(retryResponse.request().headers()['idempotency-key']).toBe(initial.headers()['idempotency-key']);
    expect(await retryResponse.json()).toMatchObject({isDuplicate:true,vehicle:{vin,tenantId:tenant,variantId:variant,status:'in_transit'}});
    await expect(page.getByText(`Đã thêm xe VIN ${vin} vào kho thành công!`, { exact: true })).toBeVisible();
    const vehicles = (await db.query('select id,tenant_id,vin from public.auto_vehicles where vin=$1', [vin])).rows;
    await page.screenshot({ path: testInfo.outputPath('vehicle-intake-success-with-db-readback.png') });
    expect(vehicles, 'Successful vehicle intake must persist exactly one vehicle for this tenant.').toHaveLength(1);
    if (vehicles.length) expect(vehicles[0].tenant_id).toBe(tenant);
    await page.reload();
    await expect(page.getByText(vin,{exact:true})).toBeVisible({timeout:60_000});
    const registrationPayload=initial.postDataJSON();
    const postVehicle=(key:string,payload:unknown)=>page.context().request.post('/api/bella-auto/vehicles',{headers:{'Idempotency-Key':key},data:payload});
    const concurrent=await Promise.all([postVehicle(initial.headers()['idempotency-key'],registrationPayload),postVehicle(initial.headers()['idempotency-key'],registrationPayload)]);
    expect(concurrent.map(response=>response.status())).toEqual([200,200]);
    expect((await postVehicle(initial.headers()['idempotency-key'],{...registrationPayload,listPrice:1})).status()).toBe(409);
    expect((await postVehicle(randomUUID(),registrationPayload)).status()).toBe(400);
    for(const relation of ['auto_vehicle_status_logs','mobility_domain_events']){
      const column=relation==='mobility_domain_events'?'entity_id':'vehicle_id';
      expect((await db.query(`select count(*)::int n from public.${relation} where ${column}=$1`,[vehicles[0].id])).rows[0].n).toBe(1);
    }
    expect((await db.query('select count(*)::int n from public.mobility_command_idempotency where tenant_id=$1 and business_key=$2',[tenant,initial.headers()['idempotency-key']])).rows[0].n).toBe(1);
    console.log('AUTOMOVE_INTAKE_REAL_MOBILITY_DB_RELOAD_LOST_ACK_CONCURRENT_RETRY=PASS');

    const foreignUrl=`/api/bella-auto/customers/${foreignCustomer}/profile`;
    expect((await page.context().request.get(foreignUrl)).status()).toBe(404);
    expect((await page.context().request.put(foreignUrl,{data:preferences})).status()).toBe(404);
    expect((await page.context().request.put(profileUrl,{data:{...preferences,tenantId:otherTenant}})).status()).toBe(400);
    try{
      await db.query('update public.users set tenant_id=$2 where id=$1',[actor,otherTenant]);
      expect((await page.context().request.get(profileUrl)).status()).toBe(404);
      expect((await page.context().request.put(profileUrl,{data:preferences})).status()).toBe(404);
      expect((await postVehicle(randomUUID(),{...registrationPayload,vin:stockVin})).status()).toBe(404);
      const listing=await page.context().request.get('/api/bella-auto/customers');
      expect(listing.status()).toBe(200);
      expect((await listing.json()).customers.map((row:{id:string})=>row.id)).toEqual([foreignCustomer]);
      await db.query("update public.users set tenant_id=$2,status='inactive' where id=$1",[actor,tenant]);
      expect((await page.context().request.get(profileUrl)).status()).toBe(403);
      expect((await page.context().request.put(profileUrl,{data:preferences})).status()).toBe(403);
      expect((await postVehicle(randomUUID(),registrationPayload)).status()).toBe(403);
      await db.query("update public.users set status='active' where id=$1",[actor]);
      await db.query("update public.tenants set status='suspended' where id=$1",[tenant]);
      expect((await page.context().request.get('/api/bella-auto/customers')).status()).toBe(403);
      expect((await page.context().request.put(profileUrl,{data:preferences})).status()).toBe(403);
      expect((await postVehicle(randomUUID(),registrationPayload)).status()).toBe(403);
    }finally{
      await db.query("update public.users set tenant_id=$2,status='active' where id=$1",[actor,tenant]);
      await db.query("update public.tenants set status='active' where id=$1",[tenant]);
    }
    expect((await db.query('select preferred_brands,metadata from public.auto_customer_profiles where customer_id=$1',[customer])).rows).toEqual([{preferred_brands:[preference],metadata:{retained:marker}}]);
    expect((await db.query('select id from public.auto_vehicles where vin=$1',[vin])).rows).toHaveLength(1);
    console.log('AUTOMOVE_MANAGEMENT_CROSS_TENANT_INACTIVE_SUSPENDED_NEGATIVE_API=PASS');
    expect((await db.query('select name_mother from public.customers where id=$1 and tenant_id=$2', [customer, tenant])).rows)
      .toEqual([{ name_mother: customerName }]);
    const blockers = { tenant, customer, vin, customerVisible, preferenceAfterReload,
      requestedPreference: preference, vehicleRows: vehicles.length, production: 'NOT_ACCESSED' };
    await testInfo.attach('management-persistence-observations', {
      contentType: 'application/json', body: Buffer.from(JSON.stringify(blockers, null, 2)),
    });
    console.log('AUTOMOVE_MANAGEMENT_PERSISTENCE_OBSERVATIONS', JSON.stringify(blockers));
  } finally {
    if (seeded) {
      try {
        await db.query("update public.users set status='inactive' where id=$1 and tenant_id=$2", [actor, tenant]);
        await db.query("update public.tenants set status='terminated' where id=any($1::uuid[])", [[tenant,otherTenant]]);
      } catch { cleanupErrors.push('Fixture archival failed.'); }
    }
    if (actor) {
      const removed = await admin.auth.admin.deleteUser(actor);
      if (removed.error) cleanupErrors.push('Fixture Auth removal failed.');
    }
    if (seeded) {
      try {
        expect((await db.query('select id from auth.users where id=$1', [actor])).rows).toHaveLength(0);
        expect((await db.query("select id from public.users where id=$1 and status='active'", [actor])).rows).toHaveLength(0);
        expect((await db.query('select status from public.tenants where id=any($1::uuid[])', [[tenant,otherTenant]])).rows).toEqual([{ status: 'terminated' },{ status: 'terminated' }]);
      } catch { cleanupErrors.push('Fixture archival read-back failed.'); }
    }
    await db.end();
    expect(cleanupErrors).toEqual([]);
    console.log('AUTOMOVE_MANAGEMENT_AUTH_REMOVED_TENANT_ARCHIVED_APPEND_ONLY_HISTORY_RETAINED');
  }
});
