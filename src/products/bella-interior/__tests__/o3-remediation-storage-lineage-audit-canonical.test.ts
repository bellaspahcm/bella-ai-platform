import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Interior O3 Remediation: Storage, Lineage, and Audit Canonical Contract', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20261118060000_interior_o3_storage_lineage_and_audit_canonical.sql',
  );

  let migrationSql: string;

  beforeAll(() => {
    expect(existsSync(migrationPath)).toBe(true);
    migrationSql = readFileSync(migrationPath, 'utf8');
  });

  describe('Part 1: Storage Bucket & Access Control Contract', () => {
    it('creates private bucket interior-site-evidence with 10MB limit and safe MIME types', () => {
      expect(migrationSql).toContain("'interior-site-evidence'");
      expect(migrationSql).toMatch(/public\s*=\s*FALSE/i);
      expect(migrationSql).toContain('10485760');
      expect(migrationSql).toContain("'image/jpeg'");
      expect(migrationSql).toContain("'image/png'");
      expect(migrationSql).toContain("'image/webp'");
      expect(migrationSql).toContain("'application/pdf'");
    });

    it('enforces restrictive RLS on storage.objects to prevent direct unauthenticated/unscoped client access', () => {
      expect(migrationSql).toContain('CREATE POLICY interior_site_evidence_no_direct_client_access');
      expect(migrationSql).toContain("ON storage.objects AS RESTRICTIVE");
      expect(migrationSql).toContain("bucket_id <> 'interior-site-evidence'");
    });
  });

  describe('Part 2: Site Diary Additive Lineage Contract', () => {
    it('adds optional production_order_id and plan_id foreign keys to interior_site_diaries', () => {
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS production_order_id UUID NULL REFERENCES public.interior_production_orders(id) ON DELETE SET NULL');
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS plan_id UUID NULL REFERENCES public.interior_site_installation_plans(id) ON DELETE SET NULL');
    });

    it('adds diary_type with check constraint matching canonical site operations', () => {
      expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS diary_type TEXT NOT NULL DEFAULT 'daily_log'");
      expect(migrationSql).toContain('chk_interior_site_diaries_diary_type');
      expect(migrationSql).toContain("'material_receiving'");
      expect(migrationSql).toContain("'installation_progress'");
      expect(migrationSql).toContain("'inspection_qc'");
      expect(migrationSql).toContain("'daily_log'");
    });

    it('creates compound performance indexes for tenant and project lineage', () => {
      expect(migrationSql).toContain('idx_interior_site_diaries_tenant_po');
      expect(migrationSql).toContain('idx_interior_site_diaries_tenant_plan');
    });
  });

  describe('Part 3: Canonical Audit Action & Business Semantics Contract', () => {
    it('interior_create_site_diary uses canonical action INSERT and records business_action CREATE in new_data', () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.interior_create_site_diary(");
      // Must NOT contain 'CREATE' in action column
      expect(migrationSql).toMatch(/INSERT INTO public\.audit_logs\([^)]+\)\s*VALUES\([^)]+'interior_site_diaries',\s*v_entry_id,\s*'INSERT'/);
      expect(migrationSql).toContain("'business_action','CREATE'");
    });

    it('interior_create_qc_item uses canonical action INSERT and records business_action CREATE in new_data', () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.interior_create_qc_item(");
      expect(migrationSql).toMatch(/INSERT INTO public\.audit_logs\([^)]+\)\s*VALUES\([^)]+'interior_qc_punch_list_items',\s*v_item\.id,\s*'INSERT'/);
      expect(migrationSql).toContain("'business_action','CREATE'");
    });

    it('interior_update_qc_item uses canonical action UPDATE and preserves business_action APPROVE for verification', () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.interior_update_qc_item(");
      expect(migrationSql).toMatch(/INSERT INTO public\.audit_logs\([^)]+\)\s*VALUES\([^)]+'interior_qc_punch_list_items',\s*v_item\.id,\s*'UPDATE'/);
      expect(migrationSql).toContain("jsonb_build_object('business_action', CASE WHEN p_status='verified' THEN 'APPROVE' ELSE 'UPDATE' END)");
    });

    it('interior_create_warranty_ticket uses canonical action INSERT and records business_action CREATE in new_data', () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.interior_create_warranty_ticket(");
      expect(migrationSql).toMatch(/INSERT INTO public\.audit_logs\([^)]+\)\s*VALUES\([^)]+'interior_warranty_service_tickets',\s*v_ticket\.id,\s*'INSERT'/);
      expect(migrationSql).toContain("'business_action','CREATE'");
    });

    it('satisfies audit_logs_action_check by ensuring action column strictly receives INSERT or UPDATE', () => {
      // In this migration, audit_logs action parameter (4th value in VALUES) must strictly be 'INSERT' or 'UPDATE'
      const auditLogInserts = migrationSql.match(/INSERT INTO public\.audit_logs[^;]+;/g) || [];
      expect(auditLogInserts.length).toBeGreaterThanOrEqual(4);
      for (const statement of auditLogInserts) {
        // Match the 4th parameter in VALUES(...)
        expect(statement).toMatch(/VALUES\([^,]+,[^,]+,[^,]+,\s*'(INSERT|UPDATE)'/);
        // Ensure action parameter is not a raw non-canonical string or dynamic variable
        expect(statement).not.toMatch(/VALUES\([^,]+,[^,]+,[^,]+,\s*'CREATE'/);
        expect(statement).not.toMatch(/VALUES\([^,]+,[^,]+,[^,]+,\s*'APPROVE'/);
        expect(statement).not.toMatch(/VALUES\([^,]+,[^,]+,[^,]+,\s*v_action/);
      }
    });
  });

  describe('Part 4: Security & Privilege Defense Contract', () => {
    it('secures all four RPCs with SECURITY DEFINER and search_path empty', () => {
      const securityDefinerCount = (migrationSql.match(/SECURITY DEFINER SET search_path=''/g) || []).length;
      expect(securityDefinerCount).toBeGreaterThanOrEqual(4);
    });

    it('revokes public/anon access and explicitly grants execution to authenticated only', () => {
      expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) FROM PUBLIC,anon,authenticated,service_role;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_site_diary(uuid,date,integer,text,text[],text) TO authenticated;');

      expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_qc_item(uuid,uuid,text,text,text,text) TO authenticated;');

      expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_update_qc_item(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_update_qc_item(uuid,text,text) TO authenticated;');

      expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.interior_create_warranty_ticket(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.interior_create_warranty_ticket(uuid,uuid,text,text,text,text) TO authenticated;');
    });
  });
});
