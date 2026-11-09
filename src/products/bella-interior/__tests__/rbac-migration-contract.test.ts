import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(process.cwd(), 'supabase/migrations/20261109130000_bella_interior_rbac_scopes.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

function explicitRolePermissions(): Map<string, Set<string>> {
  const seedStart = migrationSql.indexOf('INSERT INTO public.interior_role_permissions(role_key,permission_id) VALUES');
  const seedEnd = migrationSql.indexOf('ON CONFLICT DO NOTHING;', seedStart);
  if (seedStart < 0 || seedEnd < 0) throw new Error('Role permission seed block is missing');
  const seed = migrationSql.slice(seedStart, seedEnd);
  const rows = [...seed.matchAll(/\('([A-Z_]+)','(interior:[a-z_]+:[a-z_]+)'\)/g)];
  const roles = new Map<string, Set<string>>();
  for (const row of rows) {
    const role = row[1];
    const permission = row[2];
    if (!role || !permission) continue;
    const permissions = roles.get(role) ?? new Set<string>();
    permissions.add(permission);
    roles.set(role, permissions);
  }
  return roles;
}

describe('Bella Interior RBAC migration contract', () => {
  const roles = explicitRolePermissions();

  it('registers every existing Interior permission identifier in the Product catalog', () => {
    const contextSource = readFileSync(join(process.cwd(), 'src/products/bella-interior/lib/server-context.ts'), 'utf8');
    const constantBlock = contextSource.slice(
      contextSource.indexOf('export const INTERIOR_PERMISSIONS'),
      contextSource.indexOf('} as const;'),
    );
    const existingPermissionIds = new Set(
      [...constantBlock.matchAll(/:\s*'(interior:[^']+)'/g)].map((match) => match[1]),
    );
    const catalogBlockStart = migrationSql.indexOf('INSERT INTO public.interior_permissions');
    const catalogBlockEnd = migrationSql.indexOf('INSERT INTO public.interior_role_permissions', catalogBlockStart);
    const catalogBlock = migrationSql.slice(catalogBlockStart, catalogBlockEnd);
    const seededPermissionIds = new Set(
      [...catalogBlock.matchAll(/\('(interior:[^']+)'\s*,/g)].map((match) => match[1]),
    );

    expect(existingPermissionIds.size).toBe(65);
    expect([...existingPermissionIds].filter((permission) => !seededPermissionIds.has(permission))).toEqual([]);
    expect(roles.size + 1).toBe(12);
  });

  it('seeds every official business role without reducing the model to generic user/admin', () => {
    expect([...roles.keys()].sort()).toEqual([
      'ACCOUNTANT','ADMIN','DESIGNER','EXECUTIVE','PM','PRODUCTION_MANAGER',
      'QC','QS','SALES','SITE_MANAGER','WARRANTY',
    ]);
    expect(migrationSql).toContain("SELECT 'OWNER', permission_id FROM public.interior_permissions");
    expect(migrationSql).toContain("('OWNER','Chủ doanh nghiệp'");
  });

  it('matches the official role matrix for operational and high-risk actions', () => {
    const has = (role: string, permission: string) => roles.get(role)?.has(`interior:${permission}`) === true;

    expect(has('SALES', 'contract:create')).toBe(true);
    expect(has('SALES', 'production:create')).toBe(false);
    expect(has('DESIGNER', 'design:update')).toBe(true);
    expect(has('DESIGNER', 'installation:read')).toBe(true);
    expect(has('DESIGNER', 'finance:read')).toBe(false);
    expect(has('QS', 'boq:update')).toBe(true);
    expect(has('QS', 'contract:create')).toBe(true);
    expect(has('PM', 'boq:approve')).toBe(true);
    expect(has('PM', 'handover:approve')).toBe(true);
    expect(has('PM', 'production_order:release')).toBe(true);
    expect(has('PM', 'production:execute')).toBe(false);
    expect(has('SITE_MANAGER', 'installation:update')).toBe(true);
    expect(has('SITE_MANAGER', 'finance:read')).toBe(false);
    expect(has('PRODUCTION_MANAGER', 'production:execute')).toBe(true);
    expect(has('PRODUCTION_MANAGER', 'production_order:release')).toBe(false);
    expect(has('QC', 'qc:approve')).toBe(true);
    expect(has('QC', 'handover:approve')).toBe(false);
    expect(has('ACCOUNTANT', 'payment:record')).toBe(true);
    expect(has('ACCOUNTANT', 'qc:read')).toBe(true);
    expect(has('ACCOUNTANT', 'payment:approve')).toBe(false);
    expect(has('ACCOUNTANT', 'payment:refund')).toBe(false);
    expect(has('WARRANTY', 'warranty:close')).toBe(true);
    expect(has('EXECUTIVE', 'reports:read')).toBe(true);
    expect(has('EXECUTIVE', 'project:update')).toBe(false);

    const forbiddenForAdmin = [
      'design:approve','boq:approve','contract:approve','contract:sign','contract:amend',
      'payment:record','payment:approve','payment:refund','production:execute',
      'production_order:release','qc:approve','handover:approve','warranty:close',
    ];
    for (const permission of forbiddenForAdmin) {
      expect(has('ADMIN', permission)).toBe(false);
    }
  });

  it('keeps sensitive approval and execution actions separate from ordinary updates', () => {
    expect(roles.get('PM')?.has('interior:boq:approve')).toBe(true);
    expect(roles.get('PM')?.has('interior:handover:approve')).toBe(true);
    expect(roles.get('PM')?.has('interior:production_order:release')).toBe(true);
    expect(roles.get('QC')?.has('interior:qc:approve')).toBe(true);
    expect(roles.get('QC')?.has('interior:production:execute')).toBe(false);
    expect(roles.get('PRODUCTION_MANAGER')?.has('interior:production:execute')).toBe(true);
    expect(roles.get('PRODUCTION_MANAGER')?.has('interior:production_order:release')).toBe(false);
    expect(roles.get('ACCOUNTANT')?.has('interior:payment:record')).toBe(true);
    expect(roles.get('ACCOUNTANT')?.has('interior:payment:approve')).toBe(false);
    expect(roles.get('ACCOUNTANT')?.has('interior:payment:refund')).toBe(false);
    expect(roles.get('WARRANTY')?.has('interior:warranty:close')).toBe(true);
    expect(roles.get('WARRANTY')?.has('interior:qc:read')).toBe(true);
  });

  it('denies implicit broad access from project/branch/self assignments and filters project lists', () => {
    expect(migrationSql).toContain("WHEN 'BRANCH' THEN (v_branch_id IS NOT NULL AND ur.scope_id=v_branch_id)");
    expect(migrationSql).toContain("WHEN 'PROJECT' THEN (p_project_id IS NOT NULL AND ur.scope_id=p_project_id)");
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_authorize_project_list');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_projects()');
    expect(migrationSql).toContain('AND public.interior_has_permission(\'interior:project:read\',v_tenant,p.id,p.branch_id)');
    expect(migrationSql).toContain('p_tenant_id IS DISTINCT FROM v_actor_tenant');
    expect(migrationSql).toContain('WHERE actor.id = auth.uid()');
    expect(migrationSql).toContain("ur.tenant_id=p_tenant_id AND ur.user_id=v_user AND ur.status='ACTIVE'");
    expect(migrationSql).toContain("g.tenant_id=p_tenant_id AND g.user_id=v_user");
    expect(migrationSql).toContain("a.project_id=p_project_id AND a.status='ACTIVE'");
    expect(migrationSql).toContain("au.deleted_at IS NULL");
  });

  it('protects role assignment lifecycle and retains deny-by-default table grants', () => {
    expect(migrationSql).toContain("p_role_key='OWNER' AND p_scope_type<>'TENANT'");
    expect(migrationSql).toContain("p_target_user_id=v_actor");
    expect(migrationSql).toContain("interior_has_permission('interior:roles:assign',p_tenant_id,NULL,NULL)");
    expect(migrationSql).toContain('REVOKE ALL ON public.interior_roles,public.interior_permissions,public.interior_role_permissions');
    expect(migrationSql).toContain("CREATE POLICY interior_rbac_select ON public.%I AS PERMISSIVE FOR SELECT TO authenticated");
    expect(migrationSql).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\.interior_/i);
  });

  it('fails closed for expired auth identities and makes approved BOQs immutable except for authorized contract locking', () => {
    expect(migrationSql).toContain('au.deleted_at IS NULL');
    expect(migrationSql).toContain('(au.banned_until IS NULL OR au.banned_until <= now())');
    expect(migrationSql).toContain("IF auth.uid() IS NULL THEN\n    RAISE EXCEPTION 'AuthorizationViolation: authenticated Interior actor is required for BOQ writes';");
    expect(migrationSql).toContain("NEW.status IN ('approved','locked_for_contract')");
    expect(migrationSql).toContain("OLD.status='approved' AND NEW.status IS DISTINCT FROM 'locked_for_contract'");
    expect(migrationSql).toContain("interior_has_permission('interior:contract:create',NEW.tenant_id,NEW.project_id,NULL)");
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_approve_design_revision');
    expect(migrationSql).toContain("interior_has_permission('interior:design:approve',v_tenant,v_revision.project_id,NULL)");
    expect(migrationSql).toContain("IF v_revision.status='approved' THEN");
    expect(migrationSql).toContain("audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)");
    expect(migrationSql).not.toMatch(/au\.banned_until\s*>\s*now\(\)/i);
    expect(migrationSql).toContain("(p_scope_type IN ('TENANT','SELF') AND p_scope_id IS NOT NULL)");
    expect(migrationSql).toContain('PERFORM 1 FROM public.tenants t WHERE t.id=v_tenant FOR UPDATE');
  });
});
