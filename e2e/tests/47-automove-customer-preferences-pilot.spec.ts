import { test as base, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { saleChainConnection } from '../../src/modules/bella-auto/services/AutoMoveSaleChainConnection';
import { openPilotBrowser, openPilotDatabase } from '../../scripts/agent-flow/mvp-pilot-runner.mjs';

const test = base.extend({
  context: async ({}, use) => {
    const browser = await openPilotBrowser(process.env);
    try { await use(browser.context); }
    finally { await browser.cleanup(); }
  },
});

// Canonical management contract: existing AutoCustomerProvider preference fields,
// authenticated tenant-bound API, real persistence/read-back; no new behavior.
test('AutoMove customer preferences persist through actual UI and reload', async ({ page, baseURL }) => {
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  expect(new URL(api).href).toBe('https://bmnbqbcdbuklhopfbopv.supabase.co/');
  expect(new URL(baseURL || '').hostname).toBe('127.0.0.1');
  const candidate = process.env.FACTORY_MVP_CANDIDATE || '';
  expect(candidate).toMatch(/^[a-f0-9]{64}$/);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.FACTORY_MVP_OUTPUT) throw new Error('ENVIRONMENT_NOT_READY');
  const config = saleChainConnection(process.env.DB_URL || '', api);
  const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenant = randomUUID(), foreignTenant = randomUUID(), customer = randomUUID(), foreignCustomer = randomUUID();
  const marker = randomUUID().slice(0, 8), name = `Factory preference proof ${marker}`;
  const email = `automove-pilot-${randomUUID()}@example.test`, password = randomBytes(32).toString('hex');
  const preference = `pilot-${marker}`;
  let actor: string | undefined, seeded = false, completed = false;
  const cleanupErrors: string[] = [];
  const journalPath=resolve(process.env.FACTORY_MVP_OUTPUT,'fixture-journal.json');
  const journal=(phase:string,cleanup='NOT_PROVEN')=>{
    const value={candidate,target:'bmnbqbcdbuklhopfbopv',fixtureTag:marker,tenant,foreignTenant,customer,foreignCustomer,actor:actor||null,phase,cleanup};
    writeFileSync(journalPath+'.tmp',JSON.stringify(value,null,2),{flush:true});
    renameSync(journalPath+'.tmp',journalPath);
  };
  journal('BEFORE_CONNECTION');
  const db = await openPilotDatabase(config);
  try {
    journal('AUTH_CREATE_PENDING');
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata:{bella_factory_pilot:candidate,fixture_tag:marker} });
    if (created.error || !created.data.user) throw new Error('FIXTURE_AUTH_CREATE_FAILED');
    actor = created.data.user.id;
    journal('AUTH_CREATED_BEFORE_DB_MUTATION');
    await db.query('begin');
    try {
      for (const id of [tenant, foreignTenant]) await db.query(`insert into public.tenants(id,name,status,enabled_modules) values($1,$2,'active','{"bella_auto":true}')`, [id, `Factory AutoMove ${marker}`]);
      await db.query(`insert into public.users(id,email,full_name,tenant_id,role,status) values($1,$2,'Factory preference proof',$3,'accountant','active') on conflict(id) do update set tenant_id=excluded.tenant_id,role=excluded.role,status=excluded.status`, [actor, email, tenant]);
      for (const [id, tenantId, label] of [[customer, tenant, name], [foreignCustomer, foreignTenant, `Foreign ${marker}`]]) {
        await db.query('insert into public.customers(id,tenant_id,name_mother,phone) values($1,$2,$3,$4)', [id, tenantId, label, `09${randomBytes(4).readUInt32BE().toString().padStart(8, '0').slice(0, 8)}`]);
        await db.query('insert into public.auto_customer_profiles(tenant_id,customer_id,metadata) values($1,$2,$3)', [tenantId, id, JSON.stringify({ retained: marker })]);
      }
      await db.query('commit'); seeded = true; journal('FIXTURES_COMMITTED');
    } catch (error: unknown) { await db.query('rollback'); throw error; }
    await page.goto('/login');
    await page.getByPlaceholder('email', { exact: true }).fill(email);
    await page.locator('input[type="password"]').fill(password);
    const login = page.waitForResponse(response => response.url().startsWith(`${api}/auth/v1/token`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
    expect((await login).status()).toBe(200);
    await page.waitForURL('**/dashboard/bella-auto');
    await page.goto('/dashboard/bella-auto/customers');
    const list = page.waitForResponse(response => { const url = new URL(response.url()); return url.pathname === '/api/bella-auto/customers' && url.searchParams.get('q') === name; });
    await page.getByPlaceholder('Tìm theo tên hoặc SĐT...', { exact: true }).fill(name);
    const listed = await list; expect(listed.status()).toBe(200);
    expect((await listed.json()).customers.map((row: { id: string }) => row.id)).toEqual([customer]);
    await expect(page.getByRole('button').filter({ hasText: name })).toHaveCount(1);
    const field = page.getByPlaceholder('BMW, Porsche, VinFast', { exact: true });
    await expect(field).toBeEditable(); await field.fill(preference);
    const saved = page.waitForResponse(response => response.url().endsWith(`/api/bella-auto/customers/${customer}/profile`) && response.request().method() === 'PUT');
    journal('BEFORE_UI_PREFERENCE_MUTATION');
    await page.getByRole('button', { name: 'Lưu Thay Đổi', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText('Đã cập nhật sở thích xe của khách hàng!', { exact: true })).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue(preference);
    const fresh = await openPilotDatabase(config);
    try {
      const rows = (await fresh.query('select preferred_brands,metadata from public.auto_customer_profiles where tenant_id=$1 and customer_id=$2', [tenant, customer])).rows;
      expect(rows).toEqual([{ preferred_brands: [preference], metadata: { retained: marker } }]);
    } finally { await fresh.end(); }
    const snapshot = async () => (await db.query('select tenant_id,customer_id,preferred_brands,preferred_segments,budget_range,purchasing_purpose,metadata,updated_at from public.auto_customer_profiles where customer_id=any($1::uuid[]) order by customer_id', [[customer, foreignCustomer]])).rows;
    const beforeDenial = await snapshot();
    const preferences = { preferredBrands: ['must-not-save'], preferredSegments: [], budgetRange: null, purchasingPurpose: null };
    expect((await page.context().request.put(`/api/bella-auto/customers/${foreignCustomer}/profile`, { data: preferences })).status()).toBe(404);
    expect(await snapshot()).toEqual(beforeDenial);
    expect((await page.context().request.put(`/api/bella-auto/customers/${customer}/profile`, { data: { ...preferences, tenantId: foreignTenant } })).status()).toBe(400);
    expect(await snapshot()).toEqual(beforeDenial);
    completed = true;
  } finally {
    journal('CLEANUP_STARTED');
    if (seeded) {
      try {
        await db.query("update public.users set status='inactive' where id=$1 and tenant_id=$2", [actor, tenant]);
        await db.query("update public.tenants set status='terminated' where id=any($1::uuid[])", [[tenant, foreignTenant]]);
      } catch { cleanupErrors.push('FIXTURE_ARCHIVE_FAILED'); }
    }
    if (actor) {
      try { if ((await admin.auth.admin.deleteUser(actor)).error) cleanupErrors.push('FIXTURE_AUTH_REMOVE_FAILED'); }
      catch { cleanupErrors.push('FIXTURE_AUTH_REMOVE_FAILED'); }
    }
    if (seeded) {
      try {
        expect((await db.query('select id from auth.users where id=$1', [actor])).rows).toHaveLength(0);
        expect((await db.query("select id from public.users where id=$1 and status='active'", [actor])).rows).toHaveLength(0);
        expect((await db.query('select status from public.tenants where id=any($1::uuid[])', [[tenant, foreignTenant]])).rows).toEqual([{ status: 'terminated' }, { status: 'terminated' }]);
      } catch { cleanupErrors.push('FIXTURE_CLEANUP_READBACK_FAILED'); }
    }
    await db.end();
    journal('CLEANUP_FINISHED',cleanupErrors.length?'NOT_PROVEN':'AUTH_REMOVED_TENANTS_ARCHIVED');
    expect(cleanupErrors).toEqual([]);
  }
  expect(completed).toBe(true);
  writeFileSync(resolve(process.env.FACTORY_MVP_OUTPUT, 'customer-proof.json'), JSON.stringify({
    candidate, target: 'bmnbqbcdbuklhopfbopv', tenant, customer, persisted: true, reloadReadback: true,
    databaseReadback: true, denialNoMutation: true, invalidInputNoMutation: true,
    cleanup: 'AUTH_REMOVED_TENANTS_ARCHIVED', production: 'NOT_ACCESSED',
  }, null, 2));
});
