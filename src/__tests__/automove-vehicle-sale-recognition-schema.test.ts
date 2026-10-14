import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261014010000_create_automove_vehicle_sale_recognition_ledgers.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');

describe('AutoMove vehicle sale recognition additive schema migration', () => {
  it('creates only the two approved additive ledger tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognitions');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.auto_vehicle_sale_recognition_adjustments');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.auto_sales');
    expect(migrationSql).not.toContain('public.journal_entries');
    expect(migrationSql).not.toContain('public.accounting_outbox');
    expect(migrationSql).not.toContain('PACKAGE_SALE');
  });

  it('persists policy version, immutable financial snapshots, and idempotency keys', () => {
    expect(migrationSql).toContain('accounting_policy_id TEXT NOT NULL');
    expect(migrationSql).toContain('accounting_policy_version TEXT NOT NULL');
    expect(migrationSql).toContain('sale_price_recognized NUMERIC(18,0) NOT NULL');
    expect(migrationSql).toContain('cost_basis_at_sale NUMERIC(18,0) NOT NULL');
    expect(migrationSql).toContain('UNIQUE (tenant_id, sale_transaction_id)');
    expect(migrationSql).toContain('UNIQUE (tenant_id, idempotency_key)');
    expect(migrationSql).toContain('REFERENCES public.policy_registry(policy_id, version)');
  });

  it('protects both ledgers as append-only at database level', () => {
    expect(migrationSql).toContain('prevent_auto_vehicle_sale_ledger_mutation');
    expect(migrationSql).toContain('BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognitions');
    expect(migrationSql).toContain('BEFORE UPDATE OR DELETE ON public.auto_vehicle_sale_recognition_adjustments');
    expect(migrationSql).toContain('AutoMove vehicle sale recognition ledgers are append-only.');
  });

  it('validates tenant consistency for referenced source records', () => {
    expect(migrationSql).toContain('validate_auto_vehicle_sale_recognition_tenant');
    expect(migrationSql).toContain('FROM public.auto_vehicles');
    expect(migrationSql).toContain('FROM public.customers');
    expect(migrationSql).toContain('FROM public.auto_bookings');
    expect(migrationSql).toContain('validate_auto_vehicle_sale_adjustment_tenant');
    expect(migrationSql).toContain('FROM public.auto_vehicle_sale_recognitions');
  });

  it('uses strict RLS and minimum authenticated grants', () => {
    expect(migrationSql).toContain('ALTER TABLE public.auto_vehicle_sale_recognitions ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE public.auto_vehicle_sale_recognition_adjustments ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('USING (tenant_id = public.get_auth_tenant_id())');
    expect(migrationSql).not.toContain('WITH CHECK (tenant_id = public.get_auth_tenant_id())');
    expect(migrationSql).not.toContain('public.get_auth_tenant_id() IS NULL OR');
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.auto_vehicle_sale_recognitions TO authenticated');
    expect(migrationSql).toContain('GRANT SELECT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO authenticated');
    expect(migrationSql).not.toContain('FOR INSERT TO authenticated');
    expect(migrationSql).not.toContain('INSERT ON TABLE public.auto_vehicle_sale_recognitions TO authenticated');
    expect(migrationSql).not.toContain('INSERT ON TABLE public.auto_vehicle_sale_recognition_adjustments TO authenticated');
    expect(migrationSql).not.toMatch(/GRANT\s+ALL\s+ON\s+TABLE\s+public\.auto_vehicle_sale_recognitions\s+TO\s+authenticated/i);
    expect(migrationSql).not.toMatch(/GRANT\s+ALL\s+ON\s+TABLE\s+public\.auto_vehicle_sale_recognition_adjustments\s+TO\s+authenticated/i);
    expect(migrationSql).not.toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE/i);
  });
});
