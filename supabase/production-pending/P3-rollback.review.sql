-- REVIEW ROLLBACK ONLY. Run only after an explicitly authorized P3 rollback decision.
-- Restores tenant-only O4 policies and broad authenticated table grants. Business/audit rows are never deleted.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P3 rollback requires a role able to restore postgres-owned functions and catalog objects';
  END IF;
  IF to_regprocedure('public.interior_decide_acceptance_session(uuid,text,text,text)') IS NULL
     OR to_regprocedure('public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer)') IS NULL
     OR to_regprocedure('public.interior_user_has_permission(uuid,text,uuid,uuid,uuid)') IS NULL
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (
       'interior_acceptance_campaigns','interior_acceptance_sessions',
       'interior_acceptance_notes','interior_acceptance_evidence_objects'))<>13
     OR EXISTS (WITH expected(tablename,policyname,cmd,permissive) AS (VALUES
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_campaigns','interior_acceptance_campaigns_update','UPDATE','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_sessions','interior_acceptance_sessions_update','UPDATE','PERMISSIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_read','SELECT','PERMISSIVE'),
       ('interior_acceptance_notes','interior_acceptance_notes_create','INSERT','PERMISSIVE'),
       ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_tenant_isolation','ALL','RESTRICTIVE'),
       ('interior_acceptance_evidence_objects','interior_acceptance_evidence_objects_read','SELECT','PERMISSIVE'))
       SELECT 1 FROM expected e LEFT JOIN pg_policies p
         ON p.schemaname='public' AND p.tablename=e.tablename AND p.policyname=e.policyname
       WHERE p.policyname IS NULL OR p.cmd<>e.cmd OR p.permissive<>e.permissive
         OR p.roles::text<>'{authenticated}')
     OR NOT EXISTS (SELECT 1 FROM public.interior_permissions WHERE permission_id='interior:acceptance_evidence:upload')
     OR NOT EXISTS (SELECT 1 FROM public.interior_role_permissions WHERE permission_id='interior:acceptance_evidence:upload') THEN
    RAISE EXCEPTION 'P3 rollback preconditions do not match the reviewed P3 state';
  END IF;
END
$preflight$;

DROP POLICY IF EXISTS interior_acceptance_campaigns_read ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_create ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_update ON public.interior_acceptance_campaigns;
DROP POLICY IF EXISTS interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns;
CREATE POLICY interior_acceptance_campaigns_tenant_isolation ON public.interior_acceptance_campaigns
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_sessions_read ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_create ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_update ON public.interior_acceptance_sessions;
DROP POLICY IF EXISTS interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions;
CREATE POLICY interior_acceptance_sessions_tenant_isolation ON public.interior_acceptance_sessions
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_notes_read ON public.interior_acceptance_notes;
DROP POLICY IF EXISTS interior_acceptance_notes_create ON public.interior_acceptance_notes;
DROP POLICY IF EXISTS interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes;
CREATE POLICY interior_acceptance_notes_tenant_isolation ON public.interior_acceptance_notes
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

DROP POLICY IF EXISTS interior_acceptance_evidence_objects_read ON public.interior_acceptance_evidence_objects;
DROP POLICY IF EXISTS interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects;
CREATE POLICY interior_acceptance_evidence_objects_tenant_isolation ON public.interior_acceptance_evidence_objects
  AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id=public.interior_actor_tenant())
  WITH CHECK (tenant_id=public.interior_actor_tenant());

GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_campaigns TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.interior_acceptance_notes TO authenticated;
GRANT SELECT,INSERT ON TABLE public.interior_acceptance_evidence_objects TO authenticated;
REVOKE INSERT(id,tenant_id,project_id,campaign_code,campaign_name,description,created_by_user_id),
  UPDATE(campaign_name,description) ON TABLE public.interior_acceptance_campaigns FROM authenticated;
REVOKE INSERT(id,tenant_id,campaign_id,project_id,session_code,session_type,inspection_scope,inspection_date,
  recorder_actor_id,customer_representative,customer_contact,related_boq_item_ids,inspection_result),
  UPDATE(inspection_result,approval_notes) ON TABLE public.interior_acceptance_sessions FROM authenticated;
REVOKE INSERT(id,tenant_id,session_id,category,severity,assessment_status,description,related_boq_item_id,
  remediation_plan,assigned_fixer,target_deadline,remediation_status,routed_entity_type,routed_entity_id,created_by_user_id)
  ON TABLE public.interior_acceptance_notes FROM authenticated;

DROP TRIGGER IF EXISTS trg_interior_guard_acceptance_session_update ON public.interior_acceptance_sessions;
DROP FUNCTION IF EXISTS public.interior_guard_acceptance_session_update();
DROP TRIGGER IF EXISTS trg_interior_acceptance_documentation_status ON public.interior_acceptance_evidence_objects;
DROP FUNCTION IF EXISTS public.interior_recalculate_acceptance_documentation();
DROP FUNCTION IF EXISTS public.interior_record_acceptance_evidence(uuid,uuid,uuid,uuid,text,text,text,text,bigint,text,text,integer);
DROP FUNCTION IF EXISTS public.interior_user_has_permission(uuid,text,uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.interior_decide_acceptance_session(uuid,text,text,text);

ALTER TABLE public.interior_acceptance_evidence_objects DROP CONSTRAINT IF EXISTS fk_interior_acceptance_evidence_tenant_session;
ALTER TABLE public.interior_acceptance_notes DROP CONSTRAINT IF EXISTS fk_interior_acceptance_notes_tenant_session;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_tenant_project;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_campaign_project;
ALTER TABLE public.interior_acceptance_sessions DROP CONSTRAINT IF EXISTS fk_interior_acceptance_sessions_tenant_campaign;
ALTER TABLE public.interior_acceptance_campaigns DROP CONSTRAINT IF EXISTS fk_interior_acceptance_campaigns_tenant_project;
DROP INDEX IF EXISTS public.uq_interior_acceptance_sessions_tenant_id_id;
DROP INDEX IF EXISTS public.uq_interior_acceptance_campaigns_tenant_id_project;
DROP INDEX IF EXISTS public.uq_interior_acceptance_campaigns_tenant_id_id;
DROP INDEX IF EXISTS public.uq_interior_projects_tenant_id_id;

-- Restore the captured resolver. No records are rewritten by this rollback.
CREATE OR REPLACE FUNCTION public.interior_resolve_project_id(p_tenant_id uuid, p_resource_key text, p_resource_id uuid DEFAULT NULL::uuid, p_parent_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_project_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN RETURN NULL; END IF;
  IF public.interior_actor_tenant() IS DISTINCT FROM p_tenant_id THEN RETURN NULL; END IF;
  IF p_project_id IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.interior_projects
    WHERE id=p_project_id AND tenant_id=p_tenant_id;
    RETURN v_project_id;
  END IF;
  CASE p_resource_key
    WHEN 'project' THEN
      SELECT id INTO v_project_id FROM public.interior_projects WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'boq' THEN
      SELECT project_id INTO v_project_id FROM public.interior_boqs WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'design_revision' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'boq_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_boqs WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'design_asset' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'design_material' THEN
      SELECT project_id INTO v_project_id FROM public.interior_design_revisions WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'qc_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_qc_punch_list_items WHERE id=p_resource_id AND tenant_id=p_tenant_id;
    WHEN 'payment_milestone' THEN
      SELECT project_id INTO v_project_id FROM public.interior_contracts WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'production_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_production_orders WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    WHEN 'installation_item' THEN
      SELECT project_id INTO v_project_id FROM public.interior_site_installation_plans WHERE id=p_parent_id AND tenant_id=p_tenant_id;
    ELSE
      RETURN NULL;
  END CASE;
  RETURN v_project_id;
END;
$function$;

DELETE FROM public.interior_role_permissions WHERE permission_id IN (
  'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
  'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
  'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
  'interior:acceptance_evidence:upload','interior:acceptance:approve');
DELETE FROM public.interior_permissions WHERE permission_id IN (
  'interior:acceptance_campaign:read','interior:acceptance_campaign:create','interior:acceptance_campaign:update',
  'interior:acceptance_session:read','interior:acceptance_session:create','interior:acceptance_session:update',
  'interior:acceptance_note:read','interior:acceptance_note:create','interior:acceptance_evidence:read',
  'interior:acceptance_evidence:upload','interior:acceptance:approve');

-- Preserve non-empty approval history. The table is dropped only when it has no rows.
DO $preserve_audit$
BEGIN
  IF to_regclass('public.interior_acceptance_approval_audit') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.interior_acceptance_approval_audit) THEN
    DROP TABLE public.interior_acceptance_approval_audit;
  END IF;
END
$preserve_audit$;
COMMIT;
