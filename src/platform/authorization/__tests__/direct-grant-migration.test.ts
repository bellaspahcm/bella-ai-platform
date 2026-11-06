import { readFileSync } from 'fs';
import * as path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261104135713_platform_action_authorization_direct_grants.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

describe('Platform Action Authorization migration contract', () => {
  it('adds a direct grant store and append-only audit with tenant RLS', () => {
    expect(migration).toContain('CREATE TABLE public.platform_direct_user_action_grants');
    expect(migration).toContain('CREATE TABLE public.platform_direct_user_action_grant_audit');
    expect(migration).toContain('ALTER TABLE public.platform_direct_user_action_grants ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.platform_direct_user_action_grant_audit ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain("actor.role = 'admin'");
    expect(migration).toContain('actor.tenant_id = platform_direct_user_action_grants.tenant_id');
  });

  it('derives action checks from Auth context, direct grants, and the trusted Org Unit projection', () => {
    expect(migration).toContain('FUNCTION public.platform_authorize_action(');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('grant_row.user_id = v_actor_id');
    expect(migration).toContain('platform_current_actor_org_unit_access()');
    expect(migration).toContain("grant_row.scope_type = 'ORG_UNIT'");
    expect(migration).toContain("grant_row.scope_type = 'TENANT'");
  });

  it('writes grant audit from a database trigger in the grant transaction', () => {
    expect(migration).toContain('FUNCTION private.audit_platform_direct_action_grant()');
    expect(migration).toContain('AFTER INSERT OR UPDATE ON public.platform_direct_user_action_grants');
    expect(migration).toContain('INSERT INTO public.platform_direct_user_action_grant_audit');
    expect(migration).toContain("WHEN OTHERS THEN\n      RETURN QUERY SELECT 'UNAVAILABLE'::text, 'PERSISTENCE_FAILED'");
  });

  it('restricts grants to the five existing Construction permissions and trusted scopes', () => {
    expect(migration).toContain("CHECK (permission_id IN (");
    expect(migration).toContain('INSERT INTO public.platform_direct_user_action_grants (\n      user_id, tenant_id, permission_id, scope_type, org_unit_id\n    )');
    expect(migration).toContain('FROM public.platform_current_actor_org_unit_access() access');
    expect(migration).not.toContain('FROM public.platform_org_unit_access_for_actor(');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.construction_tenant_access_allowed(');
    expect(migration).toContain('WHERE actor.id = auth.uid()\n        AND actor.tenant_id = p_tenant_id');
    expect(migration).not.toContain('current_setting(\'app.current_tenant_id\'');
  });

  it('removes service-role access and grants only authenticated Construction CRUD without delete', () => {
    expect(migration).toContain(
      'REVOKE ALL ON public.construction_projects, public.construction_sites,\n  public.construction_work_packages, public.construction_boq_lines\n  FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.construction_projects TO authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.construction_sites TO authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.construction_work_packages TO authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.construction_boq_lines TO authenticated');
    expect(migration).not.toContain('TO authenticated, service_role');

    const orgUnitResolver = migration.indexOf('CREATE OR REPLACE FUNCTION public.construction_org_unit_access_allowed(');
    const firstActionPolicy = migration.indexOf('CREATE POLICY construction_projects_action_read');
    expect(orgUnitResolver).toBeGreaterThan(-1);
    expect(firstActionPolicy).toBeGreaterThan(orgUnitResolver);
  });

  it('restricts the exposed consumer functions to authenticated callers and preserves the five Construction IDs', () => {
    for (const functionName of [
      'platform_authorize_action',
      'platform_grant_direct_user_action',
      'platform_revoke_direct_user_action',
      'construction_create_project',
      'construction_create_site',
      'construction_create_work_package',
      'construction_create_boq_line',
      'construction_list_projects',
      'construction_list_sites',
      'construction_list_work_packages',
      'construction_list_boq_lines',
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`);
    }

    for (const permission of [
      'construction:foundation:read',
      'construction:project:write',
      'construction:site:write',
      'construction:work_package:write',
      'construction:boq:write',
    ]) {
      expect(migration).toContain(permission);
    }

    expect(migration).not.toContain('platform_owner_auth_user_id');
    expect(migration).not.toContain('tenants.role_permissions');
    expect(migration).not.toContain('UPDATE public.users');
  });
});
