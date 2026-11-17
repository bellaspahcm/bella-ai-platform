import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Interior Design Audit Action Contract', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20261117195500_interior_design_audit_action_vocabulary.sql'
  );
  let migrationSql: string;

  beforeAll(() => {
    migrationSql = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
  });

  it('defines canonical audit actions satisfying audit_logs_action_check', () => {
    // Check that create revision uses canonical 'INSERT' action
    expect(migrationSql).toContain(
      "VALUES(v_tenant,'interior_design_revisions',v_revision_id,'INSERT',NULL,"
    );
    // Check that approve revision uses canonical 'UPDATE' action
    expect(migrationSql).toContain(
      "VALUES(v_tenant,'interior_design_revisions',v_revision.id,'UPDATE',to_jsonb(v_revision),"
    );

    // Verify non-canonical actions are NOT used
    expect(migrationSql).not.toContain(
      "VALUES(v_tenant,'interior_design_revisions',v_revision_id,'CREATE',"
    );
    expect(migrationSql).not.toContain(
      "VALUES(v_tenant,'interior_design_revisions',v_revision.id,'APPROVE',"
    );
  });

  it('preserves Four-Eyes principle in design approval RPC', () => {
    expect(migrationSql).toContain(
      "IF v_revision.submitted_by_user_id IS NOT NULL AND v_revision.submitted_by_user_id=v_actor THEN"
    );
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'DESIGNER_CANNOT_APPROVE_OWN_REVISION'::text"
    );
  });

  it('preserves permission checks for create and approve operations', () => {
    expect(migrationSql).toContain(
      "public.interior_has_permission('interior:design:create',v_tenant,p_project_id,NULL)"
    );
    expect(migrationSql).toContain(
      "public.interior_has_permission('interior:design:approve',v_tenant,v_revision.project_id,NULL)"
    );
  });

  it('preserves status lifecycle guards on revision approval', () => {
    expect(migrationSql).toContain("IF v_revision.status='approved' THEN");
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'REVISION_ALREADY_APPROVED'::text"
    );
    expect(migrationSql).toContain(
      "IF v_revision.status NOT IN ('draft','in_review','client_review') THEN"
    );
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'REVISION_STATE_NOT_APPROVABLE'::text"
    );
  });

  it('grants execute permissions to authenticated role and revokes from public/anon', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.interior_create_design_revision(uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.interior_create_design_revision(uuid,text,integer) TO authenticated;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.interior_approve_design_revision(uuid,text) FROM PUBLIC,anon,authenticated,service_role;'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.interior_approve_design_revision(uuid,text) TO authenticated;'
    );
  });
});
