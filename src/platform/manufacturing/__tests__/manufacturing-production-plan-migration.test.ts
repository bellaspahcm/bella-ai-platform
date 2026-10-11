import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261011050000_create_manufacturing_production_plan_mvp.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing production plan migration shape', () => {
  const planTables = [
    'manufacturing_production_plans',
    'manufacturing_production_plan_schedule_slots',
  ];

  it('creates only Manufacturing-owned production plan tables', () => {
    for (const table of planTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSql).not.toContain('manufacturing_mrp_optimizer');
    expect(migrationSql).not.toContain('manufacturing_factory_eip');
    expect(migrationSql).not.toContain('manufacturing_wip');
    expect(migrationSql).not.toContain('manufacturing_production_costs');
  });

  it('keeps demand, readiness, approval, schedule, and order link inside Manufacturing ownership', () => {
    expect(migrationSql).toContain("source_type IN ('sales_order', 'manual')");
    expect(migrationSql).toContain("status IN ('draft', 'planned', 'pending_approval', 'approved', 'rejected', 'cancelled', 'released')");
    expect(migrationSql).toContain("material_readiness_status IN ('not_calculated', 'not_checked', 'available', 'shortage', 'not_proven')");
    expect(migrationSql).toContain('material_requirements JSONB NOT NULL DEFAULT');
    expect(migrationSql).toContain('linked_production_order_id UUID');
    expect(migrationSql).toContain('fk_manufacturing_production_plans_order_tenant');
  });

  it('ties schedule slots to routing operations and protects active work center shifts', () => {
    expect(migrationSql).toContain('fk_manufacturing_plan_schedule_slots_plan_tenant');
    expect(migrationSql).toContain('fk_manufacturing_plan_schedule_slots_plan_factory');
    expect(migrationSql).toContain('fk_manufacturing_plan_schedule_slots_operation_tenant');
    expect(migrationSql).toContain('fk_manufacturing_plan_schedule_slots_work_center_tenant');
    expect(migrationSql).toContain('uq_manufacturing_plan_schedule_active_work_center_shift');
    expect(migrationSql).toContain("WHERE status IN ('planned', 'released')");
  });

  it('enables factory RLS and authenticated grants for every production plan table', () => {
    for (const table of planTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }
    expect(migrationSql).toContain('public.manufacturing_factory_access_allowed');
  });

  it('does not introduce Logistics mutation, Finance posting, ProductRegistry, or EIP surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('CREATE TABLE IF NOT EXISTS logistics.');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
    expect(migrationSqlWithoutComments).not.toContain('factory_eip');
  });
});
