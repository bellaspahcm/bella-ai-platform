import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResult, type QueryResultRow } from 'pg';

import { createWarehousePostgresStockOutPorts } from '@/platform/logistics/warehouse/postgres-stock-out-ports';
import { WarehouseStockOutCanonicalFacade } from '@/platform/logistics/warehouse/stock-out-canonical.facade';
import { PostgresRetailSaleFinancePort } from '../retail-sale-finance.postgres-port';
import { PostgresRetailSaleRepository } from '../retail-sale-pos.postgres-repository';
import { RetailSalePosService, type RetailSalePosCommand } from '../retail-sale-pos.service';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadRetailSaleE2eEnv();

const dbUrl = process.env.DATABASE_EXECUTOR_URL_TEST?.trim() ?? '';
const dbConfigError = validateRetailSaleE2eDbConfig(dbUrl);

class AuthenticatedRetailSqlClient {
  private configured = false;

  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    if (sql.trim().toUpperCase() === 'BEGIN') {
      await this.client.query('BEGIN');
      await this.applyLocalContext();
      return emptyResult<Row>();
    }
    if (sql.trim().toUpperCase() === 'COMMIT') {
      const result = await this.client.query<Row>('COMMIT');
      this.configured = false;
      return result;
    }
    if (sql.trim().toUpperCase() === 'ROLLBACK') {
      const result = await this.client.query<Row>('ROLLBACK');
      this.configured = false;
      return result;
    }
    await this.ensureSessionContext();
    return this.client.query<Row>(sql, values ? [...values] : undefined);
  }

  private async ensureSessionContext(): Promise<void> {
    if (this.configured) return;
    await this.client.query('SET ROLE authenticated');
    await this.client.query('SET row_security = on');
    await this.applySessionContext();
    this.configured = true;
  }

  private async applyLocalContext(): Promise<void> {
    await this.client.query('SET LOCAL ROLE authenticated');
    await this.client.query('SET LOCAL row_security = on');
    await this.client.query(
      `
        SELECT
          set_config('app.current_user_id', $1, TRUE),
          set_config('app.current_tenant_id', $2, TRUE),
          set_config('request.jwt.claim.sub', $1, TRUE),
          set_config('request.jwt.claim.role', 'authenticated', TRUE),
          set_config('request.jwt.claim.tenant_id', $2, TRUE),
          set_config('request.jwt.claims', $3, TRUE)
      `,
      [this.context.userId, this.context.tenantId, jwtClaims(this.context)]
    );
  }

  private async applySessionContext(): Promise<void> {
    await this.client.query(
      `
        SELECT
          set_config('app.current_user_id', $1, FALSE),
          set_config('app.current_tenant_id', $2, FALSE),
          set_config('request.jwt.claim.sub', $1, FALSE),
          set_config('request.jwt.claim.role', 'authenticated', FALSE),
          set_config('request.jwt.claim.tenant_id', $2, FALSE),
          set_config('request.jwt.claims', $3, FALSE)
      `,
      [this.context.userId, this.context.tenantId, jwtClaims(this.context)]
    );
  }
}

type CountRow = QueryResultRow & { count: string };
type SchemaReadinessRow = QueryResultRow & {
  retail_sales_exists: boolean;
  retail_items_exists: boolean;
  logistics_idempotency_exists: boolean;
  submit_financial_intent_exists: boolean;
};

function jwtClaims(context: { userId: string; tenantId: string }): string {
  return JSON.stringify({
    sub: context.userId,
    role: 'authenticated',
    tenant_id: context.tenantId,
    app_metadata: {
      tenant_id: context.tenantId,
      role: 'authenticated',
    },
  });
}

describe('Retail Sale POS MVP canonical E2E DB flow', () => {
  jest.setTimeout(180_000);

  const marker = `retail-pos-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    branchA: randomUUID(),
    branchB: randomUUID(),
    storeA: randomUUID(),
    productA: randomUUID(),
    itemA: randomUUID(),
    locationA: randomUUID(),
  };

  let admin: Client;
  let setupError: Error | null = null;

  beforeAll(async () => {
    if (dbConfigError) {
      throw dbConfigError;
    }
    try {
      admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
      await admin.connect();
      await assertRequiredRetailSaleE2eSchema(admin);
      await seedTenant(ids.tenantA, `${marker} Tenant A`);
      await seedTenant(ids.tenantB, `${marker} Tenant B`);
      await seedRuntimeTenant(ids.tenantA, `${marker} Tenant A`);
      await seedRuntimeTenant(ids.tenantB, `${marker} Tenant B`);
      await seedUser(ids.userA, ids.tenantA, `${marker}-a@example.com`);
      await seedUser(ids.userB, ids.tenantB, `${marker}-b@example.com`);
      await seedLogisticsItem();
      await seedLogisticsLocation();
      await seedInventory(10);
    } catch (error) {
      setupError = error instanceof Error ? error : new Error(String(error));
      throw setupError;
    }
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      if (!setupError) {
        await cleanupFixtures();
      }
    } finally {
      await admin.end().catch(() => undefined);
    }
  });

  it('confirms one sale, deducts stock, writes Finance intent, blocks cross-tenant read, and deduplicates retry', async () => {
    if (setupError) {
      throw setupError;
    }
    const serviceClient = await createService(ids.userA, ids.tenantA);
    const tenantBClient = await createService(ids.userB, ids.tenantB);
    try {
      const first = await serviceClient.service.confirmSale(command());
      const duplicate = await serviceClient.service.confirmSale(command());

      if (!first.ok) {
        throw new Error(`${first.error.code}: ${first.error.message}`);
      }
      if (!duplicate.ok) {
        throw new Error(`${duplicate.error.code}: ${duplicate.error.message}`);
      }
      expect(first.ok).toBe(true);
      expect(duplicate.ok).toBe(true);

      expect(first.value.isDuplicate).toBe(false);
      expect(duplicate.value.isDuplicate).toBe(true);
      expect(duplicate.value.sale.id).toBe(first.value.sale.id);
      expect(duplicate.value.stockOut.lines[0].movement.id).toBe(first.value.stockOut.lines[0].movement.id);
      expect(duplicate.value.financeIntent.outboxId).toBe(first.value.financeIntent.outboxId);

      await expectInventoryOnHand(8);
      await expectRetailSaleCount(ids.tenantA, 1);
      await expectMovementCount(1);
      await expectFinanceOutboxCount(ids.tenantA, 1);

      await expect(
        tenantBClient.service.confirmSale({
          ...command(),
          tenantId: ids.tenantB,
          branchId: ids.branchB,
          storeId: randomUUID(),
          actorId: ids.userB,
          saleNumber: `${marker}-tenant-b-sale`,
        })
      ).resolves.toMatchObject({ ok: false });

      await expectCrossTenantReadReturnsEmpty(tenantBClient.client, first.value.sale.id);
    } finally {
      await serviceClient.client.end();
      await tenantBClient.client.end();
    }
  });

  async function createService(userId: string, tenantId: string): Promise<{
    client: Client;
    service: RetailSalePosService;
  }> {
    const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const authClient = new AuthenticatedRetailSqlClient(client, { userId, tenantId });
    return {
      client,
      service: new RetailSalePosService({
        repository: new PostgresRetailSaleRepository(authClient),
        stockOut: new WarehouseStockOutCanonicalFacade(
          createWarehousePostgresStockOutPorts(authClient)
        ),
        finance: new PostgresRetailSaleFinancePort(authClient),
      }),
    };
  }

  function command(): RetailSalePosCommand {
    return {
      tenantId: ids.tenantA,
      branchId: ids.branchA,
      storeId: ids.storeA,
      actorId: ids.userA,
      idempotencyKey: `${marker}-idem`,
      saleNumber: `${marker}-sale`,
      paymentMethod: 'cash',
      occurredAt: new Date('2026-10-12T09:00:00.000Z'),
      currency: 'VND',
      subtotal: 200000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 200000,
      lines: [{
        productId: ids.productA,
        sku: `${marker}-SKU`,
        warehouseSkuId: `${marker}-warehouse-sku`,
        warehouseBinId: `${marker}-bin`,
        itemId: ids.itemA,
        locationId: ids.locationA,
        quantity: 2,
        unitOfMeasure: 'EA',
        unitPrice: 100000,
        discountAmount: 0,
        lineTotal: 200000,
        lotNumber: `${marker}-lot`,
        unitCost: 40000,
      }],
    };
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.tenants (id, name, status, enabled_modules)
        VALUES ($1::uuid, $2, 'active', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [tenantId, name]
    );
  }

  async function seedRuntimeTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.runtime_tenant_registry (tenant_id, tenant_name, is_active, metadata)
        VALUES ($1, $2, TRUE, '{}'::jsonb)
        ON CONFLICT (tenant_id) DO UPDATE
        SET tenant_name = EXCLUDED.tenant_name,
            is_active = EXCLUDED.is_active,
            metadata = EXCLUDED.metadata
      `,
      [tenantId, name]
    );
  }

  async function seedUser(userId: string, tenantId: string, email: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          $1::uuid,
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [userId, email]
    );
    await admin.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'admin', 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [userId, tenantId, email, `${marker} Operator`]
    );
  }

  async function seedLogisticsItem(): Promise<void> {
    const columns = await tableColumns('logistics', 'items');
    await insertRow('logistics.items', buildInsertRow(columns, {
      id: ids.itemA,
      tenant_id: ids.tenantA,
      sku_code: `${marker}-SKU`,
      name: `${marker} Item`,
      type: 'GOODS',
      category: 'RAW_MATERIAL',
      base_uom: 'EA',
      lot_tracked: true,
      serial_tracked: false,
      expiry_tracked: false,
      status: 'ACTIVE',
      created_by: ids.userA,
      updated_by: ids.userA,
    }), 'id');
  }

  async function seedLogisticsLocation(): Promise<void> {
    const columns = await tableColumns('logistics', 'locations');
    await insertRow('logistics.locations', buildInsertRow(columns, {
      id: ids.locationA,
      tenant_id: ids.tenantA,
      location_code: `${marker}-LOC`,
      code: `${marker}-LOC`,
      name: `${marker} Location`,
      location_type: 'WAREHOUSE',
      status: 'ACTIVE',
      created_by: ids.userA,
      updated_by: ids.userA,
    }), 'id');
  }

  async function seedInventory(quantity: number): Promise<void> {
    const columns = await tableColumns('logistics', 'inventory');
    await insertRow('logistics.inventory', buildInsertRow(columns, {
      tenant_id: ids.tenantA,
      item_id: ids.itemA,
      location_id: ids.locationA,
      location_type: 'WAREHOUSE',
      quantity_on_hand: quantity,
      quantity_reserved: 0,
      lot_number: `${marker}-lot`,
      serial_number: null,
      status: 'AVAILABLE',
      created_by: ids.userA,
      updated_by: ids.userA,
    }));
  }

  async function tableColumns(schema: string, table: string): Promise<TableColumn[]> {
    const result = await admin.query<TableColumn>(
      `
        SELECT column_name, data_type, udt_name, is_nullable, column_default, is_generated
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
      [schema, table]
    );
    return result.rows;
  }

  async function insertRow(
    tableName: string,
    row: Record<string, unknown>,
    conflictColumn?: string
  ): Promise<void> {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const conflict = conflictColumn ? ` ON CONFLICT (${conflictColumn}) DO NOTHING` : '';
    await admin.query(
      `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ${conflict}
      `,
      columns.map((column) => row[column])
    );
  }

  async function expectInventoryOnHand(expected: number): Promise<void> {
    const result = await admin.query<QueryResultRow & { quantity_on_hand: string | number }>(
      `
        SELECT quantity_on_hand
        FROM logistics.inventory
        WHERE tenant_id = $1::uuid
          AND item_id = $2::uuid
          AND location_id = $3::uuid
          AND lot_number = $4
      `,
      [ids.tenantA, ids.itemA, ids.locationA, `${marker}-lot`]
    );
    expect(Number(result.rows[0].quantity_on_hand)).toBe(expected);
  }

  async function expectRetailSaleCount(tenantId: string, expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.retail_pos_sales WHERE tenant_id = $1::uuid',
      [tenantId]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectMovementCount(expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM logistics.inventory_movements
        WHERE tenant_id = $1::uuid
          AND item_id = $2::uuid
          AND reason = 'sale'
      `,
      [ids.tenantA, ids.itemA]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectFinanceOutboxCount(tenantId: string, expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.runtime_outbox
        WHERE tenant_id = $1
          AND intent_type = 'REVENUE_RECOGNIZED'
      `,
      [tenantId]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectCrossTenantReadReturnsEmpty(client: Client, saleId: string): Promise<void> {
    const result = await client.query<CountRow>(
      'SELECT COUNT(*)::text AS count FROM public.retail_pos_sales WHERE id = $1::uuid',
      [saleId]
    );
    expect(Number(result.rows[0].count)).toBe(0);
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM public.runtime_audit_log WHERE tenant_id IN ($1, $2)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM public.runtime_idempotency_registry WHERE tenant_id IN ($1, $2)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM public.runtime_outbox WHERE tenant_id IN ($1, $2)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM public.runtime_tenant_registry WHERE tenant_id IN ($1, $2)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM public.retail_pos_sale_items WHERE tenant_id IN ($1::uuid, $2::uuid)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM public.retail_pos_sales WHERE tenant_id IN ($1::uuid, $2::uuid)', [ids.tenantA, ids.tenantB]);
    await admin.query('DELETE FROM logistics.stock_out_idempotency WHERE tenant_id = $1::uuid', [ids.tenantA]);
    await admin.query('DELETE FROM logistics.inventory_movements WHERE tenant_id = $1::uuid AND item_id = $2::uuid', [ids.tenantA, ids.itemA]);
    await admin.query('DELETE FROM logistics.traceability WHERE tenant_id = $1::uuid AND item_id = $2::uuid', [ids.tenantA, ids.itemA]);
    await admin.query('DELETE FROM logistics.inventory WHERE tenant_id = $1::uuid AND item_id = $2::uuid', [ids.tenantA, ids.itemA]);
    await admin.query('DELETE FROM logistics.locations WHERE tenant_id = $1::uuid AND id = $2::uuid', [ids.tenantA, ids.locationA]);
    await admin.query('DELETE FROM logistics.items WHERE tenant_id = $1::uuid AND id = $2::uuid', [ids.tenantA, ids.itemA]);
    await admin.query('DELETE FROM public.users WHERE id IN ($1::uuid, $2::uuid)', [ids.userA, ids.userB]);
    await admin.query('DELETE FROM public.tenants WHERE id IN ($1::uuid, $2::uuid)', [ids.tenantA, ids.tenantB]).catch(() => undefined);
  }
});

interface TableColumn extends QueryResultRow {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_generated: 'ALWAYS' | 'NEVER';
}

function buildInsertRow(
  columns: TableColumn[],
  provided: Record<string, unknown>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.is_generated === 'ALWAYS') continue;
    if (column.column_name in provided) {
      row[column.column_name] = provided[column.column_name];
    } else if (column.is_nullable === 'NO' && !column.column_default) {
      row[column.column_name] = fallbackValue(column);
    }
  }
  return row;
}

function fallbackValue(column: TableColumn): unknown {
  if (column.udt_name === 'uuid') return randomUUID();
  if (column.data_type.includes('timestamp')) return new Date();
  if (column.data_type === 'boolean') return true;
  if (column.data_type === 'jsonb' || column.data_type === 'json') return {};
  if (column.data_type === 'integer' || column.data_type === 'numeric') return 0;
  return `${column.column_name}-test`;
}

async function assertRequiredRetailSaleE2eSchema(client: Client): Promise<void> {
  const result = await client.query<SchemaReadinessRow>(
    `
      SELECT
        to_regclass('public.retail_pos_sales') IS NOT NULL AS retail_sales_exists,
        to_regclass('public.retail_pos_sale_items') IS NOT NULL AS retail_items_exists,
        to_regclass('logistics.stock_out_idempotency') IS NOT NULL AS logistics_idempotency_exists,
        to_regprocedure('public.submit_financial_intent(text,text,jsonb)') IS NOT NULL AS submit_financial_intent_exists
    `
  );
  const row = result.rows[0];
  const missing: string[] = [];
  if (!row.retail_sales_exists) missing.push('public.retail_pos_sales');
  if (!row.retail_items_exists) missing.push('public.retail_pos_sale_items');
  if (!row.logistics_idempotency_exists) missing.push('logistics.stock_out_idempotency');
  if (!row.submit_financial_intent_exists) missing.push('public.submit_financial_intent(text,text,jsonb)');
  if (missing.length > 0) {
    throw new Error(
      `Retail Sale Real DB E2E schema is not ready. Apply approved migrations first. Missing: ${missing.join(', ')}`
    );
  }
}

function loadRetailSaleE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    if (path.basename(filePath) === '.env.e2e') {
      if (parsed.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.E2E_SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (parsed.DATABASE_EXECUTOR_URL_TEST && !process.env.DATABASE_EXECUTOR_URL_TEST?.trim()) {
        process.env.DATABASE_EXECUTOR_URL_TEST = parsed.DATABASE_EXECUTOR_URL_TEST;
      }
    }
    for (const [key, value] of Object.entries(parsed)) {
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
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve('D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => path.resolve(filePath)))];
}

function mapE2eAliases(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.E2E_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.E2E_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  }
}

function isAllowedE2eProject(): boolean {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  try {
    return new URL(supabaseUrl).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function validateRetailSaleE2eDbConfig(value: string): Error | null {
  if (!value) {
    return new Error(
      'DATABASE_EXECUTOR_URL_TEST is required for Retail Sale Real DB E2E. No fallback to shared executor URLs is allowed.'
    );
  }
  if (!isAllowedE2eProject()) {
    return new Error(
      `Retail Sale Real DB E2E requires canonical Supabase project ${EXPECTED_E2E_PROJECT_REF}.`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return new Error('DATABASE_EXECUTOR_URL_TEST must be a valid PostgreSQL URL.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return new Error('DATABASE_EXECUTOR_URL_TEST must use a PostgreSQL protocol.');
  }
  if (!parsed.hostname || parsed.hostname === 'base') {
    return new Error('DATABASE_EXECUTOR_URL_TEST must include a concrete PostgreSQL host.');
  }
  if (resolveSupabaseProjectRef(parsed) !== EXPECTED_E2E_PROJECT_REF) {
    return new Error(
      `DATABASE_EXECUTOR_URL_TEST must target canonical E2E project ${EXPECTED_E2E_PROJECT_REF}.`
    );
  }

  return null;
}

function resolveSupabaseProjectRef(parsed: URL): string | null {
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === EXPECTED_E2E_SUPABASE_HOST) return EXPECTED_E2E_PROJECT_REF;
  if (hostname === `db.${EXPECTED_E2E_SUPABASE_HOST}`) return EXPECTED_E2E_PROJECT_REF;

  const username = decodeURIComponent(parsed.username);
  const poolerUserMatch = /^postgres\.([a-z0-9]+)$/i.exec(username);
  return poolerUserMatch?.[1].toLowerCase() ?? null;
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function emptyResult<Row extends QueryResultRow>(): QueryResult<Row> {
  return {
    command: '',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  };
}
