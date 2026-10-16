import { readFileSync } from 'fs';
import * as path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261012030000_create_agriculture_os_foundation.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Agriculture OS Foundation migration shape', () => {
  const foundationTables = [
    'agriculture_farms',
    'agriculture_plots',
    'agriculture_crop_cycles',
    'agriculture_crop_cycle_events',
    'agriculture_crop_activities',
    'agriculture_material_usage_evidence',
    'agriculture_harvest_evidence',
    'agriculture_domain_events',
    'agriculture_command_idempotency',
  ];

  it('creates only Agriculture OS foundation tables for the approved scope', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSqlWithoutComments).not.toContain('bella_agriculture');
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
  });

  it('keeps tenant scope and Platform organization access as the authorization anchor', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('REFERENCES public.org_units(id)');
    expect(migrationSql).toContain('public.user_org_unit_access');
    expect(migrationSql).toContain('public.agriculture_org_unit_access_allowed');
  });

  it('enforces same-tenant Farm, Plot, and Crop Cycle relationships', () => {
    expect(migrationSql).toContain('CONSTRAINT fk_agriculture_plots_farm_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_agriculture_crop_cycles_plot_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_agriculture_crop_activities_cycle_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_agriculture_material_usage_cycle_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_agriculture_harvest_cycle_tenant');
  });

  it('preserves approved domain invariants without blocking overlapping Crop Cycles', () => {
    expect(migrationSql).toContain("CHECK (status IN ('planned', 'active', 'completed', 'cancelled'))");
    expect(migrationSql).toContain('CHECK (quantity >= 0)');
    expect(migrationSql).toContain('CONSTRAINT uq_agriculture_crop_cycle_code UNIQUE (tenant_id, plot_id, cycle_code)');
    expect(migrationSqlWithoutComments).not.toContain('EXCLUDE USING');
    expect(migrationSqlWithoutComments).not.toContain('no_overlap');
  });

  it('enables RLS and revokes anon access on every Agriculture foundation table', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }
  });

  it('does not introduce Logistics or Finance mutation surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
    expect(migrationSqlWithoutComments).not.toContain('warehouse_stock');
  });
});
