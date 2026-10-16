import { readFileSync } from 'fs';
import * as path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261013120000_create_mobility_os_foundation_contract.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Mobility OS Foundation migration shape', () => {
  const foundationTables = [
    'mobility_domain_events',
    'mobility_command_idempotency',
  ];

  it('creates only the approved Mobility OS control tables', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSqlWithoutComments).not.toContain('CREATE TABLE IF NOT EXISTS public.auto_');
    expect(migrationSqlWithoutComments).not.toContain('bella_mobility');
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
  });

  it('keeps tenant and optional org-unit scope as the authorization anchor', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('org_unit_id UUID REFERENCES public.org_units(id)');
    expect(migrationSql).toContain('public.user_org_unit_access');
    expect(migrationSql).toContain('public.mobility_tenant_access_allowed');
    expect(migrationSql).toContain('p_tenant_id = public.get_auth_tenant_id()');
    expect(migrationSql).toContain('AND auth.uid() IS NOT NULL');
    expect(migrationSqlWithoutComments).not.toContain('public.get_auth_tenant_id() IS NULL');
    expect(migrationSqlWithoutComments).not.toContain("current_setting('app.current_tenant_id'");
    expect(migrationSqlWithoutComments).not.toContain("current_setting('app.current_user_id'");
  });

  it('enables RLS and revokes anon access on Mobility control tables', () => {
    for (const table of foundationTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT ON public.${table} TO authenticated`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO service_role`);
    }
  });

  it('grants only the minimal adapter privileges needed on existing auto_* tables', () => {
    expect(migrationSql).toContain('DROP POLICY IF EXISTS "Tenant view auto_vehicles" ON public.auto_vehicles');
    expect(migrationSql).toContain('CREATE POLICY mobility_auto_vehicles_tenant_access');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS "Tenant view auto_vehicle_status_logs" ON public.auto_vehicle_status_logs');
    expect(migrationSql).toContain('CREATE POLICY mobility_auto_vehicle_status_logs_tenant_access');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS "Tenant view auto_vehicle_owners" ON public.auto_vehicle_owners');
    expect(migrationSql).toContain('CREATE POLICY mobility_auto_vehicle_owners_tenant_access');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS auto_service_history_tenant_isolation ON public.auto_service_history');
    expect(migrationSql).toContain('CREATE POLICY mobility_auto_service_history_tenant_read');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE ON public.auto_vehicles TO authenticated, service_role');
    expect(migrationSql).toContain('GRANT SELECT, INSERT ON public.auto_vehicle_status_logs TO authenticated, service_role');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE ON public.auto_vehicle_owners TO authenticated, service_role');
    expect(migrationSql).toContain('GRANT SELECT ON public.auto_service_history TO authenticated, service_role');

    expect(migrationSqlWithoutComments).not.toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_vehicles');
    expect(migrationSqlWithoutComments).not.toContain('GRANT ALL PRIVILEGES ON public.auto_');
    expect(migrationSqlWithoutComments).not.toContain('GRANT TRIGGER');
    expect(migrationSqlWithoutComments).not.toContain('GRANT TRUNCATE');
    expect(migrationSqlWithoutComments).not.toContain('GRANT REFERENCES');
  });

  it('keeps migration additive and avoids unrelated OS surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('DROP TABLE');
    expect(migrationSqlWithoutComments).not.toContain('ALTER TYPE');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('warehouse_stock');
    expect(migrationSqlWithoutComments).not.toContain('logistics_');
    expect(migrationSqlWithoutComments).not.toContain('finance_');
  });
});
