import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Interior BOQ Approval Audit Action Contract', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20261117150604_interior_boq_approval_audit_action_canonical.sql'
  );
  let migrationSql: string;

  beforeAll(() => {
    migrationSql = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
  });

  it('defines canonical audit action UPDATE satisfying audit_logs_action_check', () => {
    // Check that BOQ approval uses canonical 'UPDATE' action
    expect(migrationSql).toContain(
      "VALUES(v_tenant,'interior_boqs',v_boq.id,'UPDATE',to_jsonb(v_boq),"
    );

    // Verify non-canonical actions are NOT used
    expect(migrationSql).not.toContain(
      "VALUES(v_tenant,'interior_boqs',v_boq.id,'APPROVE',"
    );
  });

  it('preserves Four-Eyes principle preventing BOQ creator from self-approving', () => {
    expect(migrationSql).toContain(
      "IF v_boq.status NOT IN ('draft','review') OR v_boq.prepared_by_user_id IS NULL\n     OR v_boq.prepared_by_user_id=v_actor THEN"
    );
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'BOQ_CREATOR_CANNOT_APPROVE_OR_STATE_NOT_APPROVABLE'::text,NULL::uuid;"
    );
  });

  it('preserves scoped permission check interior:boq:approve', () => {
    expect(migrationSql).toContain(
      "IF NOT public.interior_has_permission('interior:boq:approve',v_tenant,v_boq.project_id,NULL) THEN"
    );
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'BOQ_APPROVAL_PERMISSION_REQUIRED'::text,NULL::uuid;"
    );
  });

  it('preserves Lineage invariant requiring approved design revision', () => {
    expect(migrationSql).toContain(
      "IF NOT EXISTS (SELECT 1 FROM public.interior_design_revisions r\n    WHERE r.id=v_boq.design_revision_id AND r.project_id=v_boq.project_id\n      AND r.tenant_id=v_tenant AND r.status='approved') THEN"
    );
    expect(migrationSql).toContain(
      "RETURN QUERY SELECT 'DENIED'::text,'APPROVED_DESIGN_REVISION_REQUIRED'::text,NULL::uuid;"
    );
  });

  it('updates BOQ status to approved with approved_by_user_id and updated_at', () => {
    expect(migrationSql).toContain(
      "UPDATE public.interior_boqs SET status='approved',approved_by_user_id=v_actor,updated_at=statement_timestamp()"
    );
  });

  it('grants execute permissions to authenticated role and revokes from public/anon', () => {
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.interior_approve_boq(uuid) FROM PUBLIC,anon,authenticated,service_role;'
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.interior_approve_boq(uuid) TO authenticated;'
    );
  });

  it('enforces SECURITY DEFINER and search_path empty for defensive isolation', () => {
    expect(migrationSql).toContain(
      "LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''"
    );
  });
});
