import { readFileSync } from 'fs';
import path from 'path';

const migrationSql = readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011193000_fix_runtime_submit_financial_intent_schema.sql'
  ),
  'utf8'
);

describe('submit_financial_intent compatibility migration', () => {
  it('writes the current runtime_outbox schema', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.submit_financial_intent');
    expect(migrationSql).toContain('INSERT INTO public.runtime_outbox');
    expect(migrationSql).toContain('id,');
    expect(migrationSql).toContain('correlation_id,');
    expect(migrationSql).not.toContain('outbox_id,\n        tenant_id,\n        intent_type,\n        intent_payload,\n        status');
  });

  it('derives tenant context as the runtime text tenant contract', () => {
    expect(migrationSql).toContain('v_tenant_id TEXT;');
    expect(migrationSql).toContain("NULLIF(auth.jwt() ->> 'tenant_id', '')");
    expect(migrationSql).toContain('public.get_auth_tenant_id()::TEXT');
    expect(migrationSql).not.toContain('v_tenant_id UUID;');
  });

  it('writes the current idempotency and audit schemas without stale columns', () => {
    expect(migrationSql).toContain('INSERT INTO public.runtime_idempotency_registry');
    expect(migrationSql).toContain('expires_at');
    expect(migrationSql).toContain('INSERT INTO public.runtime_audit_log');
    expect(migrationSql).toContain('entity_id,');
    expect(migrationSql).toContain('entity_type,');
    expect(migrationSql).toContain('timestamp');
    expect(migrationSql).not.toContain('created_by');
    expect(migrationSql).not.toContain('actor_id,');
    expect(migrationSql).not.toContain('action,');
  });
});
