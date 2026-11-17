-- Align Interior Design revision creation and approval audit actions with canonical audit_logs vocabulary.
-- Keep table_name, tenant_id, record_id, and jsonb old_data/new_data intact while satisfying audit_logs_action_check.

CREATE OR REPLACE FUNCTION public.interior_create_design_revision(
  p_project_id uuid,p_title text,p_version_number integer
)
RETURNS TABLE(status text,reason text,revision_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_revision_id uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF p_project_id IS NULL OR p_version_number IS NULL OR p_version_number<1
    OR p_version_number>10000 OR p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 300 THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_REVISION_INPUT'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_projects p
    WHERE p.id=p_project_id AND p.tenant_id=v_tenant) THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:design:create',v_tenant,p_project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGN_CREATE_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  BEGIN
    INSERT INTO public.interior_design_revisions(
      tenant_id,project_id,version_number,title,status,submitted_by,submitted_by_user_id,submitted_at
    ) VALUES (v_tenant,p_project_id,p_version_number,trim(p_title),'draft',v_actor::text,v_actor,statement_timestamp())
    RETURNING id INTO v_revision_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_NUMBER_ALREADY_EXISTS'::text,NULL::uuid;
    RETURN;
  END;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_design_revisions',v_revision_id,'INSERT',NULL,
    jsonb_build_object('project_id',p_project_id,'version_number',p_version_number,'title',trim(p_title),'status','draft'),
    v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'DESIGN_REVISION_CREATED'::text,v_revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.interior_approve_design_revision(
  p_revision_id uuid,p_approval_notes text DEFAULT NULL
)
RETURNS TABLE(status text,reason text,revision_id uuid,approved_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_revision public.interior_design_revisions%ROWTYPE;
  v_approved_at timestamptz:=statement_timestamp();
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF p_revision_id IS NULL OR (p_approval_notes IS NOT NULL AND length(trim(p_approval_notes))>2000) THEN
    RETURN QUERY SELECT 'DENIED'::text,'INVALID_APPROVAL_INPUT'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  SELECT * INTO v_revision FROM public.interior_design_revisions r
  WHERE r.id=p_revision_id AND r.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_NOT_FOUND'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:design:approve',v_tenant,v_revision.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGN_APPROVAL_PERMISSION_REQUIRED'::text,NULL::uuid,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.status='approved' THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_ALREADY_APPROVED'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.status NOT IN ('draft','in_review','client_review') THEN
    RETURN QUERY SELECT 'DENIED'::text,'REVISION_STATE_NOT_APPROVABLE'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  IF v_revision.submitted_by_user_id IS NOT NULL AND v_revision.submitted_by_user_id=v_actor THEN
    RETURN QUERY SELECT 'DENIED'::text,'DESIGNER_CANNOT_APPROVE_OWN_REVISION'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;
  UPDATE public.interior_design_revisions SET
    status='approved',
    approved_by=v_actor::text,
    approved_at=v_approved_at,
    approved_by_user_id=v_actor,
    change_summary=coalesce(nullif(trim(p_approval_notes),''),v_revision.change_summary,'Approved for production')
  WHERE id=v_revision.id AND tenant_id=v_tenant;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_design_revisions',v_revision.id,'UPDATE',to_jsonb(v_revision),
    jsonb_build_object('id',v_revision.id,'status','approved','approved_by_user_id',v_actor,'approved_at',v_approved_at),
    v_actor,v_approved_at);
  RETURN QUERY SELECT 'COMMITTED'::text,'DESIGN_REVISION_APPROVED'::text,v_revision.id,v_approved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_create_design_revision(uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_create_design_revision(uuid,text,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.interior_approve_design_revision(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_approve_design_revision(uuid,text) TO authenticated;
