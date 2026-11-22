import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INTERIOR_PERMISSIONS, requiredInteriorPermission } from '../lib/server-context';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261121000050_bella_interior_crm_o4_action_hardening.sql',
);
const crmMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261119090000_interior_crm_customer_persistence.sql',
);

describe('Bella Interior CRM and O4 authorization hardening contract', () => {
  let migrationSql: string;
  let crmMigrationSql: string;

  beforeAll(() => {
    expect(existsSync(migrationPath)).toBe(true);
    migrationSql = readFileSync(migrationPath, 'utf8');
    crmMigrationSql = readFileSync(crmMigrationPath, 'utf8');
  });

  it('uses dedicated CRM actions and does not reuse project creation', () => {
    const request = new Request('https://bella.example/api/interior/crm/customers', { method: 'POST' });
    expect(requiredInteriorPermission(request, null)).toBe(INTERIOR_PERMISSIONS.customerCreate);
    expect(requiredInteriorPermission(request, null)).not.toBe(INTERIOR_PERMISSIONS.projectCreate);

    for (const permission of [
      'interior:customer:create',
      'interior:customer:update',
      'interior:customer:merge',
      'interior:customer_contact:read',
      'interior:customer_contact:create',
      'interior:customer_contact:update',
      'interior:customer_contact:delete',
      'interior:customer_address:read',
      'interior:customer_address:create',
      'interior:customer_address:update',
      'interior:customer_address:delete',
    ]) {
      expect(migrationSql).toContain(`'${permission}'`);
    }

    // Hard delete is strictly prohibited for customer records
    expect(migrationSql).not.toContain("'interior:customer:delete'");
    expect(migrationSql).toContain('DROP POLICY IF EXISTS interior_customers_delete');
  });

  it('keeps tenant guards and checks action permissions on each CRM table operation', () => {
    for (const table of ['interior_customers', 'interior_customer_contacts', 'interior_customer_addresses']) {
      expect(migrationSql).toContain(`DROP POLICY IF EXISTS ${table === 'interior_customers' ? 'interior_customers_select' : `${table}_select`}`);
      expect(migrationSql).toContain(`ON public.${table} TO authenticated`);
    }
    expect(migrationSql).toContain("interior_has_permission('interior:customer:read',tenant_id,NULL,NULL)");
    expect(migrationSql).toContain("interior_has_permission('interior:customer:create',tenant_id,NULL,NULL)");
    expect(migrationSql).toContain("interior_has_permission('interior:customer_contact:update',tenant_id,NULL,NULL)");
    expect(migrationSql).toContain("interior_has_permission('interior:customer_address:delete',tenant_id,NULL,NULL)");
    expect(migrationSql).toContain("interior_has_permission('interior:customer:merge',v_auth_tenant,NULL,NULL)");
    expect(migrationSql).toContain("interior_has_permission('interior:customer:create',v_auth_tenant,NULL,NULL)");
    expect(crmMigrationSql).toContain('CREATE POLICY tenant_isolation_policy');
    expect(migrationSql).not.toContain('DROP POLICY IF EXISTS tenant_isolation_policy');
  });

  it('does not grant authenticated clients approval columns or direct evidence writes', () => {
    expect(migrationSql).toContain('GRANT UPDATE(inspection_result,approval_notes) ON public.interior_acceptance_sessions TO authenticated;');
    expect(migrationSql).not.toContain('GRANT UPDATE(approval_status');
    expect(migrationSql).not.toContain('GRANT INSERT,UPDATE ON public.interior_acceptance_evidence_objects TO authenticated;');
    expect(migrationSql).toContain('GRANT SELECT ON public.interior_acceptance_evidence_objects TO authenticated;');
    expect(migrationSql).toContain("interior_has_permission('interior:acceptance:approve',v_tenant,v_session.project_id,NULL)");
    expect(migrationSql).toContain('ACCEPTANCE_SESSION_ALREADY_DECIDED');
    expect(migrationSql).toContain('interior_acceptance_approval_audit');
  });

  it('validates storage bucket, ownership prefix, object existence and action before recording evidence', () => {
    expect(migrationSql).toContain("p_bucket_id IS DISTINCT FROM 'interior-site-evidence'");
    expect(migrationSql).toContain("interior_user_has_permission(v_actor,'interior:acceptance_evidence:upload',v_tenant,v_session.project_id,NULL)");
    expect(migrationSql).toContain('TO service_role;');
    expect(migrationSql).toContain('FROM storage.objects o WHERE o.bucket_id=p_bucket_id AND o.name=p_storage_path');
    expect(migrationSql).toContain('interior_recalculate_acceptance_documentation');
  });

  it('checks upload limits before parsing, sniffs file bytes and creates the storage path server side', () => {
    const routePath = resolve(
      process.cwd(),
      'src/app/api/interior/delivery/acceptance/sessions/[id]/evidence/route.ts',
    );
    const route = readFileSync(routePath, 'utf8');
    expect(route).toContain('MAX_MULTIPART_REQUEST_BYTES');
    expect(route).toContain('MAX_JSON_REQUEST_BYTES');
    expect(route).toContain('readBoundedRequestBody(request, maxRequestBytes)');
    expect(route).toContain('detectEvidenceMimeType(fileBuffer)');
    expect(route).toContain("const ACCEPTANCE_EVIDENCE_BUCKET = 'interior-site-evidence'");
    expect(route).toContain('randomUUID()}-${fileName}');
    expect(route).not.toContain('payload.storagePath');
    expect(route).not.toContain('payload.bucketId');
  });
});
