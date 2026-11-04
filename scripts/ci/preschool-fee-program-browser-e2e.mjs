import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';
import pg from 'pg';

const appUrl = process.env.FEE_E2E_APP_URL;
const apiUrl = process.env.FEE_E2E_SUPABASE_URL;
const dbUrl = process.env.FEE_E2E_DB_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!appUrl || !apiUrl || !dbUrl || !publicKey || !serviceKey) throw new Error('FEE_E2E_CONFIGURATION_REQUIRED');
for (const [url, port] of [[appUrl, '32700'], [apiUrl, '32621'], [dbUrl, '32622']]) {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || parsed.port !== port) throw new Error('REFUSE_NONLOCAL_FEE_E2E_TARGET');
}

const db = new pg.Client({ connectionString: dbUrl });
const authAdmin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tenantA = randomUUID();
const tenantB = randomUUID();
let browser;

async function actor(role, tenantId) {
  const email = `fee-ui-${randomUUID()}@example.test`;
  const password = `F1!${randomUUID()}aA`;
  const created = await authAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('FEE_E2E_CREATE_USER_FAILED');
  await db.query('INSERT INTO public.users(id,tenant_id,email,full_name,role,status) VALUES ($1,$2,$3,$4,$5,$6)',
    [created.data.user.id, tenantId, email, 'Fee UI test actor', role, 'active']);
  const stored = new Map();
  const client = createServerClient(apiUrl, publicKey, { cookies: {
    getAll: () => [...stored].map(([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => stored.set(name, value)),
  } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) throw new Error('FEE_E2E_SIGN_IN_FAILED');
  const context = await browser.newContext();
  await context.addCookies([...stored].map(([name, value]) => ({ name, value, url: appUrl })));
  return context;
}

async function perform(page, button) {
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/education/fee-program') && r.request().method() === 'POST');
  const read = page.waitForResponse((r) => r.url().endsWith('/api/education/fee-program') && r.request().method() === 'GET');
  await button.click();
  const result = await posted;
  assert.equal(result.status(), 200, 'UI write failed');
  assert.equal((await read).status(), 200, 'UI readback failed');
}

async function post(page, body) {
  return page.evaluate(async (payload) => {
    const response = await fetch('/api/education/fee-program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return { status: response.status, json: await response.json() };
  }, body);
}

async function read(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/education/fee-program', { cache: 'no-store' });
    if (!response.ok) throw new Error('FEE_E2E_READ_FAILED');
    return (await response.json()).data;
  });
}

try {
  await db.connect();
  const preflight = await db.query("SELECT (SELECT count(*) FROM public.tenants WHERE name NOT IN ('Fee UI tenant A','Fee UI tenant B'))::int AS unknown_tenants, to_regprocedure('public.platform_current_actor_profile()') IS NOT NULL AS actor_contract, to_regprocedure('public.preschool_fee_program_resolve(uuid,jsonb,jsonb,uuid[])') IS NULL AS resolver_absent");
  assert.deepEqual(preflight.rows[0], { unknown_tenants: 0, actor_contract: true, resolver_absent: true });
  await db.query("INSERT INTO public.tenants(id,name,status,product_key) VALUES ($1,'Fee UI tenant A','active','bella_preschool'),($2,'Fee UI tenant B','active','bella_preschool')", [tenantA, tenantB]);
  browser = await chromium.launch({ headless: true });
  const admin = await actor('admin', tenantA);
  const superAdmin = await actor('super_admin', tenantA);
  const staff = await actor('admin_staff', tenantA);
  const otherTenant = await actor('admin', tenantB);
  const page = await admin.newPage();
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.setDefaultTimeout(30000);
  await page.goto(`${appUrl}/dashboard/education/fee-program`, { waitUntil: 'domcontentloaded' });
  try { await page.getByRole('heading', { name: 'Chương trình phí', exact: true }).waitFor(); }
  catch (error) {
    console.error('FEE_E2E_PAGE_DIAGNOSTIC', JSON.stringify({ pathname: new URL(page.url()).pathname, body: (await page.locator('body').innerText()).slice(0, 400), failedRequests }));
    throw error;
  }
  const feeProgramNav = page.getByRole('link', { name: 'Chương trình phí', exact: true });
  await feeProgramNav.waitFor({ state: 'visible' });
  await feeProgramNav.click();
  await page.getByRole('heading', { name: 'Chương trình phí', exact: true }).waitFor();
  await page.getByLabel('Mã loại phí').waitFor();
  const typeCode = `FEE_${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const typeSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Loại phí cố định' }) });
  const typeForm = typeSection.locator('form').first();
  await typeForm.getByLabel('Mã loại phí').fill(typeCode);
  await typeForm.getByLabel('Tên loại phí').fill('Loại phí kiểm thử');
  await perform(page, typeForm.getByRole('button', { name: 'Tạo loại phí' }));
  const itemSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Khoản phí', exact: true }) });
  await itemSection.getByLabel('Tên khoản phí').fill('Khoản phí kiểm thử');
  await perform(page, itemSection.getByRole('button', { name: 'Tạo khoản phí', exact: true }));
  let current = await read(page);
  const item = current.items.find((row) => row.display_name === 'Khoản phí kiểm thử');
  assert.ok(item);
  await itemSection.getByLabel('Khoản phí', { exact: true }).selectOption(item.id);
  await itemSection.getByLabel('Loại phí', { exact: true }).selectOption(typeCode);
  await itemSection.getByLabel('Số tiền').fill('120000');
  await itemSection.getByLabel('Mã tiền tệ').fill('VND');
  await perform(page, itemSection.getByRole('button', { name: 'Tạo phiên bản phí' }));
  current = await read(page);
  const itemVersion = current.itemVersions.find((row) => row.fee_item_id === item.id);
  assert.ok(itemVersion);
  const programSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Chương trình phí', exact: true }) });
  await programSection.getByLabel('Tên chương trình').fill('Chương trình kiểm thử');
  await perform(page, programSection.getByRole('button', { name: 'Tạo chương trình', exact: true }));
  current = await read(page);
  const program = current.programs.find((row) => row.display_name === 'Chương trình kiểm thử');
  assert.ok(program);
  await programSection.getByLabel('Chương trình', { exact: true }).selectOption(program.id);
  await perform(page, programSection.getByRole('button', { name: 'Tạo phiên bản chương trình' }));
  current = await read(page);
  const version = current.versions.find((row) => row.fee_program_id === program.id);
  assert.ok(version);
  await programSection.getByLabel('Phiên bản nháp').selectOption(version.id);
  await programSection.getByLabel('Phiên bản phí').selectOption(itemVersion.id);
  await perform(page, programSection.getByRole('button', { name: 'Thêm phí vào phiên bản' }));
  const versionCard = page.locator('li').filter({ hasText: version.id });
  await perform(page, versionCard.getByRole('button', { name: 'Publish phiên bản' }));
  await versionCard.getByText('POLICY_PENDING — Chờ cấu hình kỳ thu').waitFor();
  current = await read(page);
  assert.equal(current.versions.find((row) => row.id === version.id).status, 'PUBLISHED');
  assert.equal(current.itemVersions.find((row) => row.id === itemVersion.id).amount, 120000);
  assert.equal((await post(page, { action: 'publish', versionId: version.id })).json.data.duplicate, true);
  assert.equal((await post(page, { action: 'add_item', versionId: version.id, itemVersionId: itemVersion.id })).status, 400);
  assert.equal((await post(page, { action: 'create_type', code: 'BAD', name: 'Bad', tenantId: tenantB })).status, 400);
  const staffPage = await staff.newPage();
  await staffPage.goto(`${appUrl}/dashboard/education/fee-program`, { waitUntil: 'domcontentloaded' });
  assert.equal(await staffPage.getByRole('link', { name: 'Chương trình phí', exact: true }).count(), 0, 'Staff should not see the Fee Program navigation link');
  assert.equal((await post(staffPage, { action: 'create_type', code: 'STAFF', name: 'Staff' })).status, 403);
  const otherPage = await otherTenant.newPage();
  await otherPage.goto(`${appUrl}/dashboard/education/fee-program`, { waitUntil: 'domcontentloaded' });
  assert.equal((await post(otherPage, { action: 'publish', versionId: version.id })).status, 404);
  const superPage = await superAdmin.newPage();
  await superPage.goto(`${appUrl}/dashboard/education/fee-program`, { waitUntil: 'domcontentloaded' });
  await superPage.getByRole('link', { name: 'Chương trình phí', exact: true }).waitFor({ state: 'visible' });
  assert.equal((await post(superPage, { action: 'publish', versionId: version.id })).json.data.duplicate, true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('POLICY_PENDING — Chờ cấu hình kỳ thu').first().waitFor();
  console.log('PASS: Browser Admin create type/item/version/program, publish and reload; Super Admin, Staff, tenant, duplicate and immutable checks.');
} finally {
  await browser?.close();
  await db.end();
}
