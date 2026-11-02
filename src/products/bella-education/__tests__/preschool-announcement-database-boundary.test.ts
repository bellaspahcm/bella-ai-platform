import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261101010000_preschool_announcement_database_authorization.sql',
), 'utf8');

describe('Preschool announcement database authorization candidate', () => {
  it('adds a restrictive authenticated INSERT boundary for active Preschool admins with all-branch access', () => {
    expect(migration).toMatch(/CREATE POLICY preschool_announcement_admin_all_branches_insert[\s\S]*?AS RESTRICTIVE[\s\S]*?FOR INSERT[\s\S]*?TO authenticated/i);
    expect(migration).toContain("lower(u.role) = 'admin'");
    expect(migration).toContain("t.product_key = 'bella_preschool'");
    expect(migration).toContain('public.platform_current_actor_org_unit_access()');
    expect(migration).toContain('created_by = auth.uid()');
  });

  it('checks Auth-backed role and all-branch access again in the publication command', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.preschool_publish_school_announcement[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i);
    expect(migration).toContain('FROM auth.users a');
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'authenticated'");
    expect(migration).toContain('public.platform_org_unit_access_for_actor(v_tenant_id, v_actor_id)');
    expect(migration).toContain('FROM PUBLIC, anon, service_role');
  });

  it('returns only same-payload retries and rejects request-id reuse with different content', () => {
    expect(migration).toContain('ON CONFLICT (tenant_id, request_id) DO NOTHING');
    expect(migration).toContain('v_row.title IS DISTINCT FROM trim(p_title)');
    expect(migration).toContain('v_row.body_text IS DISTINCT FROM trim(p_body_text)');
    expect(migration).toContain("'duplicate', NOT v_inserted");
    expect(migration).toContain("'ANNOUNCEMENT_REQUEST_CONFLICT' USING ERRCODE = '23505'");
  });
});
