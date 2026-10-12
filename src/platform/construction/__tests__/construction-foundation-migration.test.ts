import { readFileSync } from 'fs';
import * as path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261013010000_create_construction_foundation_mvp.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Construction OS Foundation MVP migration shape', () => {
  const foundationTables = [
    'construction_projects',
    'construction_sites',
    'construction_work_packages',
    'construction_boq_lines',
  ];

  it('creates only the approved Construction foundation tables', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSqlWithoutComments).not.toContain('bella_construction');
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
  });

  it('keeps tenant scope and Platform Org Unit access as the authorization anchors', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('REFERENCES public.org_units(id)');
    expect(migrationSql).toContain('public.user_org_unit_access');
    expect(migrationSql).toContain('public.construction_tenant_access_allowed');
    expect(migrationSql).toContain('public.construction_org_unit_access_allowed');
  });

  it('enforces same-tenant Project, Site, Work Package, and BOQ relationships', () => {
    expect(migrationSql).toContain('CONSTRAINT fk_construction_sites_project_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_construction_work_packages_site_tenant');
    expect(migrationSql).toContain('CONSTRAINT fk_construction_work_packages_parent_same_scope');
    expect(migrationSql).toContain('CONSTRAINT fk_construction_boq_lines_work_package_tenant');
  });

  it('preserves MVP invariants without expanding into scheduling, finance, or warehouse flows', () => {
    expect(migrationSql).toContain("CHECK (status IN ('planned', 'in_progress', 'completed', 'archived'))");
    expect(migrationSql).toContain('CHECK (quantity > 0)');
    expect(migrationSql).toContain('CHECK (unit_rate IS NULL OR unit_rate >= 0)');
    expect(migrationSql).toContain('CONSTRAINT uq_construction_boq_lines_number UNIQUE (tenant_id, work_package_id, line_number)');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
    expect(migrationSqlWithoutComments).not.toContain('warehouse_stock');
  });

  it('enables RLS and revokes anon access on every Construction foundation table', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }
  });
});
