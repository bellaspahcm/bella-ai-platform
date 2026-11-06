import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261106042111_onboard_manufacturing_tenant_without_demo_data.sql',
  ),
  'utf8',
);

describe('Manufacturing tenant onboarding migration', () => {
  it('creates a Manufacturing tenant and initial branch without BabyCare demo records', () => {
    expect(migration).toContain('public.onboard_manufacturing_tenant');
    expect(migration).toContain("'bella_manufacturing'");
    expect(migration).toContain("'manufacturing', TRUE");
    expect(migration).toContain("'babycare', FALSE");
    expect(migration).toContain('unit_type,');
    expect(migration).toContain("'branch'");

    expect(migration).not.toContain('public.packages');
    expect(migration).not.toContain('public.customers');
    expect(migration).not.toContain('public.bookings');
    expect(migration).not.toContain('seed_default_coa');
    expect(migration).not.toContain('ensure_open_period');
  });

  it('uses the server-created admin identity and restricts RPC execution', () => {
    expect(migration).toContain('INSERT INTO public.users (id, email, full_name, role, status, tenant_id)');
    expect(migration).toContain('VALUES (p_admin_id, BTRIM(p_admin_email), BTRIM(p_admin_name)');
    expect(migration).toContain("'admin', 'active', v_tenant_id");
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
  });
});
