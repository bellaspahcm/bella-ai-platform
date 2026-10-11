import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client, type QueryResultRow } from 'pg';

import type { Database } from '../../src/types/database.types';

const snapshot = {
  tenantId: 'tenant-manufacturing',
  factoryOrgUnitId: 'factory-a',
  generatedAt: '2026-10-11T00:00:00.000Z',
  productionPlans: [],
  productionPlanScheduleSlots: [],
  orders: [
    {
      order: {
        id: 'po-1',
        tenantId: 'tenant-manufacturing',
        factoryOrgUnitId: 'factory-a',
        orderNumber: 'PO-UI-001',
        finishedGoodItemId: 'fg-1',
        targetQuantity: 10,
        uom: 'EA',
        status: 'in_progress',
        lines: [
          {
            id: 'po-line-1',
            tenantId: 'tenant-manufacturing',
            productionOrderId: 'po-1',
            finishedGoodItemId: 'fg-1',
            targetQuantity: 10,
            uom: 'EA',
          },
        ],
        bomRevisionId: 'bom-1',
        createdBy: 'planner-1',
        createdAt: '2026-10-11T00:00:00.000Z',
      },
      materialRequirements: [],
      executions: [],
      qualityDispositions: [],
      operationProgress: [],
      quantities: {
        plannedQuantity: 10,
        actualQuantity: 8,
        acceptedQuantity: 7,
        rejectedQuantity: 1,
        scrapQuantity: 0,
        receivedAcceptedQuantity: 7,
        receivedRejectedQuantity: 1,
        receivedPendingQuantity: 0,
        completedQuantity: 0,
      },
      materialReadiness: 'available',
      requiredOperationCount: 2,
      completedRequiredOperationCount: 1,
      blockedOperationCount: 0,
      openQualityDispositionCount: 0,
      reconciliationStatus: 'pending_routing_completion',
      missingEvidence: ['required_operation_completion_evidence'],
    },
  ],
  workCenters: [],
  routingRevisions: [],
  bomRevisions: [],
};

async function enableLocalDashboardBypass(page: Page) {
  await page.context().addCookies([
    {
      name: 'mock_user_email',
      value: 'admin@medical.vn',
      url: process.env.E2E_BASE_URL || 'http://localhost:3000',
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Manufacturing operational readiness browser surface', () => {
  test('renders the operational snapshot and sends a planner command through the public API route', async ({
    page,
  }) => {
    await enableLocalDashboardBypass(page);

    await page.route('**/api/manufacturing/operational-readiness?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          productKey: 'bella_manufacturing',
          tenantName: 'Bella Manufacturing E2E',
          snapshot,
        }),
      });
    });

    await page.route('**/api/manufacturing/operational-readiness', async (route) => {
      const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
        action?: string;
        payload?: { orderNumber?: string; targetQuantity?: number };
      };
      expect(requestBody.action).toBe('createProductionOrder');
      expect(requestBody.payload?.orderNumber).toBe('PO-UI-002');
      expect(requestBody.payload?.targetQuantity).toBe(12);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          action: requestBody.action,
          result: {
            value: {
              id: 'po-2',
              orderNumber: requestBody.payload?.orderNumber,
            },
            isDuplicate: false,
          },
          snapshot,
        }),
      });
    });

    await page.goto('/dashboard/manufacturing', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('manufacturing-dashboard')).toBeVisible();
    await expect(page.getByTestId('manufacturing-order-count')).toContainText('1');
    await expect(page.getByTestId('manufacturing-order-list')).toContainText('PO-UI-001');
    await expect(page.getByTestId('manufacturing-order-list')).toContainText(
      'pending_routing_completion'
    );

    const productionOrderForm = page.getByTestId('manufacturing-production-order-form');
    await productionOrderForm.getByLabel('Order number').fill('PO-UI-002');
    await productionOrderForm.getByLabel('Finished good').fill('fg-2');
    await productionOrderForm.getByLabel('Quantity').fill('12');
    await productionOrderForm.getByLabel('UOM').fill('EA');
    await productionOrderForm.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByTestId('manufacturing-command-result')).toContainText('PO-UI-002');
  });
});

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;
const REAL_AUTH_MARKER_PREFIX = 'mfg-api-auth';

interface ApiResponse {
  status: number;
  body: unknown;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface SupabaseCookie {
  name: string;
}

interface CountRow extends QueryResultRow {
  count: string;
}

interface AuthFixtureUser {
  id: string;
  email: string;
  password: string;
  tenantId: string;
  role: 'admin' | 'ktv';
  personId?: string;
}

interface ApiAuthFixtures {
  marker: string;
  tenantManufacturing: string;
  tenantDeniedManufacturing: string;
  tenantOtherProduct: string;
  factoryManufacturing: string;
  factoryDeniedTenant: string;
  factoryOtherProduct: string;
  plannerAdmin: AuthFixtureUser;
  unauthorizedStaff: AuthFixtureUser;
  noFactoryStaff: AuthFixtureUser;
  otherProductAdmin: AuthFixtureUser;
}

loadManufacturingApiAuthE2eEnv();

test.describe('Manufacturing operational readiness HTTP API authorization E2E', () => {
  test.describe.configure({ retries: 0 });
  test.skip(
    shouldSkipLocalRealAuthApiE2e(),
    'Canonical Manufacturing Real DB auth env is unavailable locally; CI must run this test without skip.'
  );
  test.setTimeout(180_000);

  let db: Client;
  let supabaseAdmin: SupabaseClient<Database>;
  let fixtures: ApiAuthFixtures;

  test.beforeAll(async () => {
    assertCanonicalRealAuthApiE2eEnv();
    supabaseAdmin = createSupabaseAdminClient();
    db = new Client({ connectionString: getDatabaseUrl(), ssl: sslConfig() });
    await db.connect();
    fixtures = await seedApiAuthFixtures(db, supabaseAdmin);
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    if (db && fixtures && supabaseAdmin) {
      await cleanupApiAuthFixtures(db, supabaseAdmin, fixtures);
    }
    if (db) {
      await db.end();
    }
  });

  test('allows real authenticated Manufacturing tenant user to read snapshot and run a safe command', async ({
    page,
  }) => {
    await loginWithSupabasePassword(page, fixtures.plannerAdmin);
    await expectRealSupabaseSession(page);

    const snapshot = await apiGet(
      page,
      `/api/manufacturing/operational-readiness?factoryOrgUnitId=${fixtures.factoryManufacturing}`
    );
    expect(snapshot.status).toBe(200);
    expect(readRecord(snapshot.body).productKey).toBe('bella_manufacturing');

    const orderNumber = `${fixtures.marker}-PO-AUTH-001`;
    const created = await apiPost(page, '/api/manufacturing/operational-readiness', {
      action: 'createProductionOrder',
      factoryOrgUnitId: fixtures.factoryManufacturing,
      payload: {
        idempotencyKey: `${fixtures.marker}-create-order-001`,
        orderNumber,
        finishedGoodItemId: `${fixtures.marker}-fg`,
        targetQuantity: 3,
        uom: 'EA',
      },
    });

    expect(created.status).toBe(200);
    const result = readRecord(readRecord(created.body).result);
    expect(readRecord(result.value).orderNumber).toBe(orderNumber);
    await expectManufacturingOrderCount(db, fixtures.tenantManufacturing, orderNumber, 1);

    const planNumber = `${fixtures.marker}-PLAN-AUTH-001`;
    const createdPlan = await apiPost(page, '/api/manufacturing/operational-readiness', {
      action: 'createProductionPlan',
      factoryOrgUnitId: fixtures.factoryManufacturing,
      payload: {
        idempotencyKey: `${fixtures.marker}-create-plan-001`,
        planNumber,
        sourceType: 'manual',
        finishedGoodItemId: `${fixtures.marker}-fg`,
        plannedQuantity: 3,
        uom: 'EA',
      },
    });

    expect(createdPlan.status).toBe(200);
    const planResult = readRecord(readRecord(createdPlan.body).result);
    expect(readRecord(planResult.value).planNumber).toBe(planNumber);
    await expectManufacturingPlanCount(db, fixtures.tenantManufacturing, planNumber, 1);
  });

  test('rejects a real authenticated user whose role lacks Manufacturing command permission', async ({
    page,
  }) => {
    await loginWithSupabasePassword(page, fixtures.unauthorizedStaff);
    await expectRealSupabaseSession(page);

    const denied = await apiPost(page, '/api/manufacturing/operational-readiness', {
      action: 'createProductionOrder',
      factoryOrgUnitId: fixtures.factoryManufacturing,
      payload: {
        idempotencyKey: `${fixtures.marker}-ktv-denied-order`,
        orderNumber: `${fixtures.marker}-PO-KTV-DENIED`,
        finishedGoodItemId: `${fixtures.marker}-fg-denied`,
        targetQuantity: 1,
        uom: 'EA',
      },
    });

    expect(denied.status).toBe(403);
    expect(readErrorCode(denied.body)).toBe('MANUFACTURING_AUTHORIZATION_DENIED');
  });

  test('rejects a real authenticated Manufacturing user without factory access', async ({ page }) => {
    await loginWithSupabasePassword(page, fixtures.noFactoryStaff);
    await expectRealSupabaseSession(page);

    const denied = await apiGet(page, '/api/manufacturing/operational-readiness');

    expect(denied.status).toBe(403);
    expect(readErrorCode(denied.body)).toBe('MANUFACTURING_FACTORY_ACCESS_REQUIRED');
  });

  test('rejects an authenticated user from a non-Manufacturing tenant without leaking data', async ({
    page,
  }) => {
    await loginWithSupabasePassword(page, fixtures.otherProductAdmin);
    await expectRealSupabaseSession(page);

    const denied = await apiGet(
      page,
      `/api/manufacturing/operational-readiness?factoryOrgUnitId=${fixtures.factoryOtherProduct}`
    );

    expect(denied.status).toBe(403);
    expect(readErrorCode(denied.body)).toBe('MANUFACTURING_PRODUCT_REQUIRED');
    expect(JSON.stringify(denied.body)).not.toContain(fixtures.factoryManufacturing);
  });

  test('rejects a permitted Manufacturing user when the requested factory belongs to another tenant', async ({
    page,
  }) => {
    await loginWithSupabasePassword(page, fixtures.plannerAdmin);
    await expectRealSupabaseSession(page);

    const denied = await apiPost(page, '/api/manufacturing/operational-readiness', {
      action: 'createProductionOrder',
      factoryOrgUnitId: fixtures.factoryDeniedTenant,
      payload: {
        idempotencyKey: `${fixtures.marker}-cross-tenant-factory`,
        orderNumber: `${fixtures.marker}-PO-CROSS-TENANT`,
        finishedGoodItemId: `${fixtures.marker}-fg-cross-tenant`,
        targetQuantity: 1,
        uom: 'EA',
      },
    });

    expect(denied.status).toBe(403);
    expect(readErrorCode(denied.body)).toBe('MANUFACTURING_AUTHORIZATION_DENIED');
    await expectManufacturingOrderCount(db, fixtures.tenantManufacturing, `${fixtures.marker}-PO-CROSS-TENANT`, 0);
  });
});

async function loginWithSupabasePassword(page: Page, user: AuthFixtureUser): Promise<void> {
  if (!user.email.trim()) {
    throw new Error('Real Supabase login fixture is missing an email address.');
  }
  if (!user.password.trim()) {
    throw new Error('Real Supabase login fixture is missing a password.');
  }

  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.getByRole('button', { name: /đăng nhập ngay|login|sign in/i });
  const authError = page.locator('div').filter({
    hasText:
      /invalid api key|supabase chưa được cấu hình|missing supabase credentials|missing email or phone|invalid login credentials/i,
  });

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await emailInput.fill('');
  await emailInput.pressSequentially(user.email);
  await passwordInput.fill('');
  await passwordInput.pressSequentially(user.password);
  await expect(emailInput).toHaveValue(user.email);
  await expect(passwordInput).toHaveValue(user.password);

  await submitButton.click();
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 30_000 }),
    authError.waitFor({ state: 'visible', timeout: 30_000 }).then(async () => {
      const message = await authError.first().textContent();
      throw new Error(`Real Supabase login failed before Manufacturing API authorization proof: ${message}`);
    }),
  ]);
}

async function expectRealSupabaseSession(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie: SupabaseCookie) => cookie.name === 'mock_user_email')).toBe(false);
  expect(cookies.some((cookie: SupabaseCookie) => /^sb-.+-auth-token/.test(cookie.name))).toBe(true);
}

async function apiGet(page: Page, url: string): Promise<ApiResponse> {
  return page.evaluate(async (pathName) => {
    const response = await fetch(pathName, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return { status: response.status, body: await response.json() };
  }, url);
}

async function apiPost(page: Page, url: string, body: Record<string, unknown>): Promise<ApiResponse> {
  return page.evaluate(
    async ({ pathName, requestBody }) => {
      const response = await fetch(pathName, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      return { status: response.status, body: await response.json() };
    },
    { pathName: url, requestBody: body }
  );
}

async function seedApiAuthFixtures(
  db: Client,
  supabaseAdmin: SupabaseClient<Database>
): Promise<ApiAuthFixtures> {
  const marker = `${REAL_AUTH_MARKER_PREFIX}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const tenantManufacturing = randomUUID();
  const tenantOtherProduct = randomUUID();
  const tenantDeniedManufacturing = randomUUID();
  const factoryManufacturing = randomUUID();
  const factoryDeniedTenant = randomUUID();
  const factoryOtherProduct = randomUUID();

  await seedTenant(db, tenantManufacturing, `${marker} Manufacturing`, 'bella_manufacturing');
  await seedTenant(db, tenantDeniedManufacturing, `${marker} Manufacturing Denied`, 'bella_manufacturing');
  await seedTenant(db, tenantOtherProduct, `${marker} Other Product`, 'bella_babycare');
  await seedFactory(db, tenantManufacturing, factoryManufacturing, `${marker}-factory-a`);
  await seedFactory(db, tenantDeniedManufacturing, factoryDeniedTenant, `${marker}-factory-denied`);
  await seedFactory(db, tenantOtherProduct, factoryOtherProduct, `${marker}-factory-other-product`);

  const plannerAdmin = await seedAuthBackedUser({
    db,
    supabaseAdmin,
    marker,
    label: 'planner-admin',
    tenantId: tenantManufacturing,
    role: 'admin',
    factoryId: factoryManufacturing,
  });
  const unauthorizedStaff = await seedAuthBackedUser({
    db,
    supabaseAdmin,
    marker,
    label: 'unauthorized-ktv',
    tenantId: tenantManufacturing,
    role: 'ktv',
    factoryId: factoryManufacturing,
  });
  const noFactoryStaff = await seedAuthBackedUser({
    db,
    supabaseAdmin,
    marker,
    label: 'no-factory-ktv',
    tenantId: tenantManufacturing,
    role: 'ktv',
  });
  const otherProductAdmin = await seedAuthBackedUser({
    db,
    supabaseAdmin,
    marker,
    label: 'other-product-admin',
    tenantId: tenantOtherProduct,
    role: 'admin',
    factoryId: factoryOtherProduct,
  });

  return {
    marker,
    tenantManufacturing,
    tenantDeniedManufacturing,
    tenantOtherProduct,
    factoryManufacturing,
    factoryDeniedTenant,
    factoryOtherProduct,
    plannerAdmin,
    unauthorizedStaff,
    noFactoryStaff,
    otherProductAdmin,
  };
}

async function seedTenant(
  db: Client,
  tenantId: string,
  name: string,
  productKey: string
): Promise<void> {
  await db.query(
    `
      INSERT INTO public.tenants (id, name, status, enabled_modules, product_key)
      VALUES ($1::uuid, $2, 'active', '{}'::jsonb, $3)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          status = EXCLUDED.status,
          enabled_modules = EXCLUDED.enabled_modules,
          product_key = EXCLUDED.product_key
    `,
    [tenantId, name, productKey]
  );
}

async function seedFactory(db: Client, tenantId: string, factoryId: string, code: string): Promise<void> {
  await db.query(
    `
      INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
      VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"manufacturing-api-auth-e2e","manufacturing_role":"factory"}'::jsonb)
    `,
    [factoryId, tenantId, code, code]
  );
}

async function seedAuthBackedUser(params: {
  db: Client;
  supabaseAdmin: SupabaseClient<Database>;
  marker: string;
  label: string;
  tenantId: string;
  role: 'admin' | 'ktv';
  factoryId?: string;
}): Promise<AuthFixtureUser> {
  const email = `${params.marker}-${params.label}@example.com`;
  const password = `${params.marker}-${params.label}-P@ssw0rd!`;
  const { data, error } = await params.supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user?.id) {
    throw new Error(`Unable to create E2E auth user for ${params.label}`);
  }

  const user: AuthFixtureUser = {
    id: data.user.id,
    email,
    password,
    tenantId: params.tenantId,
    role: params.role,
  };

  await params.db.query(
    `
      INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active')
      ON CONFLICT (id) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          status = EXCLUDED.status
    `,
    [user.id, user.tenantId, user.email, `${params.marker} ${params.label}`, user.role]
  );
  if (params.factoryId) {
    user.personId = randomUUID();
    await params.db.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"manufacturing-api-auth-e2e"}'::jsonb)
      `,
      [user.personId, user.tenantId, user.id, `${params.marker} person ${params.label}`]
    );
    await params.db.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"manufacturing-api-auth-e2e"}'::jsonb)
      `,
      [user.tenantId, user.personId, params.factoryId]
    );
  }

  return user;
}

async function cleanupApiAuthFixtures(
  db: Client,
  supabaseAdmin: SupabaseClient<Database>,
  fixtures: ApiAuthFixtures
): Promise<void> {
  const tenantIds = [
    fixtures.tenantManufacturing,
    fixtures.tenantDeniedManufacturing,
    fixtures.tenantOtherProduct,
  ];
  const userIds = [
    fixtures.plannerAdmin.id,
    fixtures.unauthorizedStaff.id,
    fixtures.noFactoryStaff.id,
    fixtures.otherProductAdmin.id,
  ];
  const personIds = [
    fixtures.plannerAdmin.personId,
    fixtures.unauthorizedStaff.personId,
    fixtures.noFactoryStaff.personId,
    fixtures.otherProductAdmin.personId,
  ].filter((personId): personId is string => Boolean(personId));
  const factoryIds = [
    fixtures.factoryManufacturing,
    fixtures.factoryDeniedTenant,
    fixtures.factoryOtherProduct,
  ];

  await db.query('SET row_security = off');
  await db.query(
    'DELETE FROM public.manufacturing_production_plan_schedule_slots WHERE tenant_id = ANY($1::uuid[])',
    [tenantIds]
  );
  await db.query(
    'DELETE FROM public.manufacturing_production_plans WHERE tenant_id = ANY($1::uuid[])',
    [tenantIds]
  );
  await db.query(
    'DELETE FROM public.manufacturing_command_idempotency WHERE tenant_id = ANY($1::uuid[])',
    [tenantIds]
  );
  await db.query(
    'DELETE FROM public.manufacturing_production_order_lines WHERE tenant_id = ANY($1::uuid[])',
    [tenantIds]
  );
  await db.query(
    'DELETE FROM public.manufacturing_production_orders WHERE tenant_id = ANY($1::uuid[])',
    [tenantIds]
  );
  await db.query('DELETE FROM public.org_relationships WHERE tenant_id = ANY($1::uuid[])', [
    tenantIds,
  ]);
  await db.query('DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])', [personIds]);
  await db.query('DELETE FROM public.org_units WHERE id = ANY($1::uuid[])', [factoryIds]);
  await db.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [userIds]);
  try {
    await db.query('DELETE FROM public.tenants WHERE id = ANY($1::uuid[])', [tenantIds]);
  } catch (error) {
    console.warn(
      `[Manufacturing API auth E2E cleanup] retained tenant shells because public.timeline_events is append-only and may hold tenant FK rows: ${tenantIds.join(', ')}. ${String(error)}`
    );
  }

  for (const userId of userIds) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  }
}

async function expectManufacturingOrderCount(
  db: Client,
  tenantId: string,
  orderNumber: string,
  expected: number
): Promise<void> {
  const result = await db.query<CountRow>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.manufacturing_production_orders
      WHERE tenant_id = $1::uuid AND order_number = $2
    `,
    [tenantId, orderNumber]
  );
  expect(Number(result.rows[0].count)).toBe(expected);
}

async function expectManufacturingPlanCount(
  db: Client,
  tenantId: string,
  planNumber: string,
  expected: number
): Promise<void> {
  const result = await db.query<CountRow>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.manufacturing_production_plans
      WHERE tenant_id = $1::uuid AND plan_number = $2
    `,
    [tenantId, planNumber]
  );
  expect(Number(result.rows[0].count)).toBe(expected);
}

function readRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe('object');
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function readErrorCode(value: unknown): string | undefined {
  return (readRecord(value) as ApiErrorBody).error?.code;
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error('Canonical Supabase E2E admin environment is not configured.');
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function shouldSkipLocalRealAuthApiE2e(): boolean {
  return !process.env.CI && !hasCanonicalRealAuthApiE2eEnv();
}

function hasCanonicalRealAuthApiE2eEnv(): boolean {
  return Boolean(
    getSupabaseUrl() &&
      getSupabasePublicKey() &&
      getSupabaseServiceRoleKey() &&
      isRunnableDbUrl(getDatabaseUrl()) &&
      isAllowedE2eProject() &&
      isAllowedE2eDbUrl(getDatabaseUrl())
  );
}

function assertCanonicalRealAuthApiE2eEnv(): void {
  if (!getSupabaseUrl() || !getSupabasePublicKey() || !getSupabaseServiceRoleKey() || !getDatabaseUrl()) {
    throw new Error('Canonical Manufacturing Real DB auth test environment is missing required Supabase variables.');
  }
  if (!isAllowedE2eProject() || !isAllowedE2eDbUrl(getDatabaseUrl())) {
    throw new Error('Manufacturing API auth E2E must run only against the canonical Bella E2E Supabase project.');
  }
}

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.E2E_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
}

function getSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.E2E_SUPABASE_PUBLISHABLE_KEY ??
    process.env.E2E_SUPABASE_ANON_KEY ??
    ''
  );
}

function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
    ''
  );
}

function getDatabaseUrl(): string {
  return process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_DATABASE_URL ?? process.env.E2E_SUPABASE_DB_URL ?? '';
}

function isAllowedE2eProject(): boolean {
  try {
    return new URL(getSupabaseUrl()).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function isAllowedE2eDbUrl(value: string): boolean {
  return value.toLowerCase().includes(EXPECTED_E2E_PROJECT_REF);
}

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function sslConfig(): { rejectUnauthorized: false } | undefined {
  const dbUrl = getDatabaseUrl();
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function loadManufacturingApiAuthE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(filePath, 'utf8')))) {
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
  mapE2eAliases();
}

function candidateE2eEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    join(tmpdir(), 'bella-spa-e2e.env'),
    resolve(process.cwd(), '.env.e2e'),
    resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
    resolve(process.cwd(), '.env.local'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => resolve(filePath)))];
}

function mapE2eAliases(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.E2E_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.E2E_SUPABASE_URL;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.E2E_SUPABASE_PUBLISHABLE_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.E2E_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.SUPABASE_DB_URL && process.env.E2E_SUPABASE_DB_URL) {
    process.env.SUPABASE_DB_URL = process.env.E2E_SUPABASE_DB_URL;
  }
}

function parseEnv(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2].trim();
    parsed[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
  return parsed;
}
