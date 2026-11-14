import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(process.cwd(), 'supabase/migrations/20261109130000_bella_interior_rbac_scopes.sql');
const migrationSql = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
const commercialEngineMigrationPath = join(process.cwd(), 'supabase/migrations/20261113165251_interior_commercial_transaction_engine.sql');
const commercialEngineMigrationSql = readFileSync(commercialEngineMigrationPath, 'utf8').replace(/\r\n/g, '\n');
const legacyHandoverHardeningSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261114110000_interior_handover_requires_customer_evidence.sql'),
  'utf8',
).replace(/\r\n/g, '\n');
const customerHandoverMigrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261114120000_interior_customer_evidenced_handover.sql'),
  'utf8',
).replace(/\r\n/g, '\n');
const addendumSubjectMigrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261114120100_interior_customer_approval_addendum_subject.sql'),
  'utf8',
).replace(/\r\n/g, '\n');
const customerApprovedAddendumMigrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261114120200_interior_contract_addendum_customer_approval.sql'),
  'utf8',
).replace(/\r\n/g, '\n');

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
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_authorize_customer_list');
    expect(migrationSql).toContain("'customerId',CASE WHEN public.interior_has_permission('interior:customer:read'");
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_authorize_customer_list(uuid)');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_authorize_customer_list(uuid) TO authenticated');
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
    expect(migrationSql).toContain("OR (p_scope_type IN ('BRANCH','PROJECT') AND p_scope_id IS NULL) THEN");
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

  it('routes design revision reads and creation through scoped actor-bound RPCs', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_room_zones(p_project_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_design_revisions(p_project_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_create_design_revision(');
    expect(migrationSql).toContain("public.interior_has_permission('interior:design:read',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain("public.interior_has_permission('interior:design:create',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain("submitted_by_user_id,submitted_at\n    ) VALUES (v_tenant,p_project_id,p_version_number,trim(p_title),'draft',v_actor::text,v_actor");
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_design_revision(uuid,text,integer) TO authenticated');
  });

  it('routes schedule and site diary reads/writes through scoped actor-bound RPCs', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_authorize_schedule_list(p_tenant_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_installation_plans(p_project_id uuid DEFAULT NULL)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_site_diaries(p_project_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_create_site_diary(');
    expect(migrationSql).toContain("public.interior_has_permission('interior:schedule:read',v_tenant");
    expect(migrationSql).toContain("public.interior_has_permission('interior:installation:create',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain('INSERT INTO public.interior_site_diaries(');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) TO authenticated');
  });

  it('separates BOQ create, update, approval, and contract locking permissions at the RPC boundary', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_authorize_boq_save(');
    expect(migrationSql).toContain("v_permission:='interior:boq:create'");
    expect(migrationSql).toContain("v_permission:='interior:boq:update'");
    expect(migrationSql).toContain("v_permission:='interior:boq:approve'");
    expect(migrationSql).toContain("public.interior_has_permission('interior:contract:create'");
    expect(migrationSql).toContain('public.interior_authorize_boq_save(p_tenant_id');
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_authorize_boq_save(uuid,uuid,uuid,text)');
  });

  it('targets only the design revision guard when the existing BOQ RPC also checks project idempotency', () => {
    const original = readFileSync(join(process.cwd(), 'supabase/migrations/20261108153000_harden_interior_boq_production_safety.sql'), 'utf8').replace(/\r\n/g, '\n');
    const match = migrationSql.replace(/\r\n/g, '\n').match(/v_revision_needle text := '((?:''|[^'])*)';/);
    if (!match?.[1]) throw new Error('BOQ revision guard anchor is missing');
    const anchor = match[1].replace(/''/g, "'");
    expect(original.split('AND project_id = v_project_id')).toHaveLength(3);
    expect(original.split(anchor)).toHaveLength(2);
    const patched = original.replace(anchor, `${anchor}\n              AND status = 'approved'`);
    expect(patched).toContain("FROM public.interior_design_revisions\n            WHERE id = (p_boq_header->>'design_revision_id')::UUID\n              AND tenant_id = p_tenant_id\n              AND project_id = v_project_id\n              AND status = 'approved'");
    expect(patched).toContain('FROM public.interior_sync_idempotency\n        WHERE tenant_id = p_tenant_id\n          AND project_id = v_project_id\n          AND idempotency_key = p_idempotency_key');
    expect(migrationSql).toContain("v_revision_replacement text := v_revision_needle || E'\\n              AND status = ''approved'''");
    expect(migrationSql).toContain('Interior BOQ revision guard is ambiguous');
    expect(migrationSql).toContain('Interior BOQ authorization guard is ambiguous');
  });

  it('requires qc:approve for punch-list verification and resolves each item to its project', () => {
    expect(migrationSql).toContain("WHEN 'qc_item' THEN");
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS room_zone_id uuid');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS reported_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_qc_items(p_project_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_read_qc_item(p_item_id uuid)');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_create_qc_item(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_update_qc_item(');
    expect(migrationSql).toContain("CASE WHEN p_status='verified' THEN 'interior:qc:approve' ELSE 'interior:qc:update' END");
    expect(migrationSql).toContain('QC_ITEM_MUST_BE_RECTIFIED_BEFORE_VERIFICATION');
    expect(migrationSql).toContain("VALUES(v_tenant,p_project_id,p_room_zone_id,v_actor,v_room_name");
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_update_qc_item(uuid,text,text) TO authenticated');
  });

  it('persists handover and warranty commands through actor-bound scoped RPCs', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_handover_dossiers');
    expect(migrationSql).toContain("public.interior_has_permission('interior:handover:approve',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain('v_tenant uuid:=public.interior_actor_tenant(); v_actor uuid:=auth.uid()');
    expect(migrationSql).toContain("h.status='completed'");
    expect(migrationSql).toContain("q.severity='critical' AND q.status<>'verified'");
    expect(migrationSql).toContain('created_by_user_id,approved_by_user_id,created_at');
    expect(migrationSql).toContain("'approvedByUserId',v_dossier.approved_by_user_id");
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_warranty_certificates');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_list_warranty_tickets');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_create_warranty_ticket');
    expect(migrationSql).toContain("public.interior_has_permission('interior:warranty:create',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain('reported_by_user_id,reported_by_contact,priority,updated_at');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_handover_dossier(uuid,text) TO authenticated');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_warranty_ticket(uuid,uuid,text,text,text,text) TO authenticated');
    expect(legacyHandoverHardeningSql).toContain(
      'REVOKE ALL ON FUNCTION public.interior_create_handover_dossier(uuid, text)',
    );
    expect(customerHandoverMigrationSql).toContain('CREATE TABLE IF NOT EXISTS public.interior_handover_acceptance_requests');
    expect(customerHandoverMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_request_handover_acceptance');
    expect(customerHandoverMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_read_public_handover_acceptance');
    expect(customerHandoverMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_transition_public_handover_acceptance');
    expect(customerHandoverMigrationSql).toContain('customerAcceptanceRequestId');
    expect(customerHandoverMigrationSql).toContain('customerAcceptanceSignatureSha256');
    expect(customerHandoverMigrationSql).toContain("THEN 'legacy_unverified'");
    expect(customerHandoverMigrationSql).toContain('INTERIOR_HANDOVER_CUSTOMER_EVIDENCE_REQUIRED');
    expect(customerHandoverMigrationSql).toContain("o.bucket_id = 'interior-customer-signatures'");
    expect(customerHandoverMigrationSql).toContain("q.severity IN ('critical', 'major') AND q.status <> 'verified'");
    expect(customerHandoverMigrationSql).toContain('signature_sha256_hash');
    expect(commercialEngineMigrationSql).toContain('FROM public.platform_current_actor_profile() actor');
    expect(customerHandoverMigrationSql).toContain('INTERIOR_HANDOVER_CUSTOMER_CONTACT_REQUIRED');
    expect(customerHandoverMigrationSql).toContain(
      'FROM public.platform_current_actor_profile() actor',
    );
    expect(customerHandoverMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.interior_request_handover_acceptance(UUID, UUID)',
    );
    expect(customerHandoverMigrationSql).toContain(
      'NEW.client_accepted IS DISTINCT FROM OLD.client_accepted',
    );
    expect(customerHandoverMigrationSql).toContain(
      'NEW.status IS DISTINCT FROM OLD.status',
    );
    const handoverTransitionGrant = customerHandoverMigrationSql.slice(
      customerHandoverMigrationSql.indexOf('REVOKE ALL ON FUNCTION public.interior_transition_public_handover_acceptance('),
    );
    expect(handoverTransitionGrant).toContain(') TO service_role;');
    expect(handoverTransitionGrant).not.toContain('TO anon, service_role;');
  });

  it('masks contract finance and customer fields at the scoped read boundary', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.interior_read_contract_project(p_project_id uuid)');
    expect(migrationSql).toContain("public.interior_has_permission('interior:contract:read',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain("v_finance_access:=public.interior_has_permission('interior:finance:read',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain("v_customer_access:=public.interior_has_permission('interior:customer:read',v_tenant,p_project_id,NULL)");
    expect(migrationSql).toContain("'baselineContractValue',CASE WHEN v_finance_access THEN v_contract.baseline_contract_value END");
    expect(migrationSql).toContain("'clientRepresentative',CASE WHEN v_customer_access THEN v_contract.client_representative END");
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_read_contract_project(uuid) TO authenticated');
  });

  it('scopes authenticated approval-token lookup and returns only transition-service fields', () => {
    const start = commercialEngineMigrationSql.indexOf(
      'CREATE OR REPLACE FUNCTION public.interior_read_customer_approval_by_token(',
    );
    const end = commercialEngineMigrationSql.indexOf(
      'CREATE OR REPLACE FUNCTION public.interior_create_customer_approval_request(',
      start,
    );
    const functionSql = commercialEngineMigrationSql.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(functionSql).toContain("'interior:contract:write'");
    expect(functionSql).toContain("'approval_token', p_approval_token");
    expect(functionSql).toContain("'sent_by_actor_id', v_approval.sent_by_actor_id");
    expect(functionSql).not.toContain('to_jsonb(v_approval)');
    expect(functionSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_read_customer_approval_by_token(UUID, UUID)');
  });

  it('binds contract approvals to exact quote lineage and freezes terms while customer review is pending', () => {
    expect(commercialEngineMigrationSql).toContain("OLD.status = 'in_review'");
    expect(commercialEngineMigrationSql).toContain('INTERIOR_CONTRACT_IMMUTABLE_DURING_CUSTOMER_REVIEW');
    expect(commercialEngineMigrationSql).toContain('c.quotation_version_number = NEW.subject_version_number');
    expect(commercialEngineMigrationSql).toContain('c.quotation_version_number = v_approval.subject_version_number');
  });

  it('requires exact customer approval and serialized payment reconciliation for contract addenda', () => {
    expect(addendumSubjectMigrationSql).toContain("ADD VALUE IF NOT EXISTS 'contract_addendum'");
    expect(customerApprovedAddendumMigrationSql).toContain('proposed_payment_schedule JSONB');
    expect(customerApprovedAddendumMigrationSql).toContain('base_contract_value NUMERIC(15, 2)');
    expect(customerApprovedAddendumMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.interior_create_contract_addendum_request(JSONB)\n  TO authenticated",
    );
    expect(customerApprovedAddendumMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.interior_read_public_customer_addendum_approval(UUID, UUID)\n  TO anon",
    );
    expect(customerApprovedAddendumMigrationSql).toContain('d.customer_approval_id = NEW.id');
    expect(customerApprovedAddendumMigrationSql).toContain('v_contract.current_contract_value IS DISTINCT FROM v_addendum.base_contract_value');
    expect(customerApprovedAddendumMigrationSql).toContain('INTERIOR_ADDENDUM_CANNOT_CHANGE_INVOICED_OR_PAID_MILESTONE');
    expect(customerApprovedAddendumMigrationSql).toContain('INTERIOR_ADDENDUM_SCHEDULE_TOTAL_MISMATCH');
    expect(customerApprovedAddendumMigrationSql).toContain('Lock in contract -> addendum -> milestone order');
    expect(customerApprovedAddendumMigrationSql).toContain('FOR UPDATE OF c');
    expect(customerApprovedAddendumMigrationSql).toContain('FOR UPDATE;');
    expect(customerApprovedAddendumMigrationSql).toContain('current_contract_value = c.current_contract_value + v_addendum.value_delta');
    expect(customerApprovedAddendumMigrationSql).toContain('CREATE TRIGGER trg_advance_interior_addendum_after_customer_approval');
    expect(customerApprovedAddendumMigrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.advance_interior_addendum_after_customer_approval()\n  FROM PUBLIC, anon, authenticated, service_role',
    );
  });
});
