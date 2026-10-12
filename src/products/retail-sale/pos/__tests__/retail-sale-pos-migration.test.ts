import { readFileSync } from 'fs';
import path from 'path';

const migrationSql = readFileSync(
  path.resolve(__dirname, '../../../../../supabase/migrations/20261012010000_create_retail_sale_pos_mvp.sql'),
  'utf8'
);
const realDbE2eSource = readFileSync(
  path.resolve(__dirname, 'retail-sale-pos-real-db.e2e.test.ts'),
  'utf8'
);

describe('Retail Sale POS MVP migration', () => {
  it('creates Retail-owned sale header and item tables with branch/store identity', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.retail_pos_sales');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.retail_pos_sale_items');
    expect(migrationSql).toContain('branch_id UUID NOT NULL');
    expect(migrationSql).toContain('store_id UUID NOT NULL');
    expect(migrationSql).toContain('logistics_item_id UUID NOT NULL');
    expect(migrationSql).toContain('logistics_location_id UUID NOT NULL');
  });

  it('enforces tenant-scoped sale idempotency without using Beauty product_sales', () => {
    expect(migrationSql).toContain('UNIQUE (tenant_id, business_operation, idempotency_key)');
    expect(migrationSql).toContain("DEFAULT 'retail_pos.confirm_sale'");
    expect(migrationSql).not.toContain('product_sales');
  });

  it('keeps access tenant-scoped through RLS policies', () => {
    expect(migrationSql).toContain('ALTER TABLE public.retail_pos_sales ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE public.retail_pos_sale_items ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain("auth.jwt() ->> 'tenant_id'");
    expect(migrationSql).toContain('public.get_auth_tenant_id()::text');
  });
}
);

describe('Retail Sale POS real DB E2E executor configuration', () => {
  it('uses only the explicit canonical test executor URL', () => {
    expect(realDbE2eSource).toContain('process.env.DATABASE_EXECUTOR_URL_TEST');
    expect(realDbE2eSource).toContain('DATABASE_EXECUTOR_URL_TEST is required');
    expect(realDbE2eSource).toContain("EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv'");
    expect(realDbE2eSource).not.toContain('process.env.DATABASE_EXECUTOR_URL ||');
    expect(realDbE2eSource).not.toContain('process.env.DB_URL ||');
    expect(realDbE2eSource).not.toContain('process.env.DATABASE_URL ||');
    expect(realDbE2eSource).not.toContain('parsed.DATABASE_EXECUTOR_URL ||');
    expect(realDbE2eSource).not.toContain('parsed.DATABASE_EXECUTOR_URL ??');
    expect(realDbE2eSource).not.toContain('process.env.E2E_SUPABASE_DB_URL = parsed.DATABASE_EXECUTOR_URL');
  });

  it('does not apply migrations inside the real DB E2E run', () => {
    expect(realDbE2eSource).toContain('assertRequiredRetailSaleE2eSchema(admin)');
    expect(realDbE2eSource).not.toContain("admin.query(readFileSync(path.resolve(process.cwd(), 'supabase/migrations'");
  });
});
