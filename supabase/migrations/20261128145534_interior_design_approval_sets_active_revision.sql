-- Keep the approved revision, project active pointer, and both audit records atomic.
-- Historical pointers are intentionally not backfilled by this migration.

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
  v_project public.interior_projects%ROWTYPE;
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

  SELECT * INTO v_project FROM public.interior_projects p
  WHERE p.id=v_revision.project_id AND p.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'PROJECT_NOT_FOUND'::text,v_revision.id,NULL::timestamptz; RETURN;
  END IF;

  UPDATE public.interior_design_revisions SET
    status='approved',
    approved_by=v_actor::text,
    approved_at=v_approved_at,
    approved_by_user_id=v_actor,
    change_summary=coalesce(nullif(trim(p_approval_notes),''),v_revision.change_summary,'Approved for production')
  WHERE id=v_revision.id AND tenant_id=v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interior design revision approval update failed';
  END IF;
  UPDATE public.interior_projects SET
    active_approved_revision_id=v_revision.id,
    updated_at=v_approved_at
  WHERE id=v_project.id AND tenant_id=v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interior active revision pointer update failed';
  END IF;

  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_design_revisions',v_revision.id,'UPDATE',to_jsonb(v_revision),
    jsonb_build_object('id',v_revision.id,'status','approved','approved_by',v_actor::text,
      'approved_by_user_id',v_actor,'approved_at',v_approved_at,
      'change_summary',coalesce(nullif(trim(p_approval_notes),''),v_revision.change_summary,'Approved for production')),
    v_actor,v_approved_at);
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_projects',v_project.id,'UPDATE',to_jsonb(v_project),
    jsonb_build_object('id',v_project.id,'active_approved_revision_id',v_revision.id,'updated_at',v_approved_at),
    v_actor,v_approved_at);
  RETURN QUERY SELECT 'COMMITTED'::text,'DESIGN_REVISION_APPROVED'::text,v_revision.id,v_approved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_approve_design_revision(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_approve_design_revision(uuid,text) TO authenticated;

-- Include active-pointer state in the same read snapshot as revision status/assets.
CREATE OR REPLACE FUNCTION public.interior_list_design_revisions(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project are required';
  END IF;
  IF NOT public.interior_has_permission('interior:design:read',v_tenant,p_project_id,NULL) THEN
    RAISE EXCEPTION 'AuthorizationViolation: scoped design read is required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'tenantId',r.tenant_id,'projectId',r.project_id,'versionNumber',r.version_number,
    'title',r.title,'status',r.status,'changeSummary',r.change_summary,'submittedBy',r.submitted_by,
    'submittedAt',r.submitted_at,'approvedBy',r.approved_by,'approvedAt',r.approved_at,
    'clientSignoffName',r.client_signoff_name,'clientSignoffDate',r.client_signoff_date,
    'isActiveRevision',r.id=p.active_approved_revision_id,
    'assets',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'tenantId',a.tenant_id,'revisionId',a.revision_id,'type',a.asset_type,
      'title',a.title,'fileUrl',a.file_url,'roomZoneId',a.room_zone_id,'notes',a.notes,'createdAt',a.created_at
    ) ORDER BY a.created_at,a.id) FROM public.interior_design_assets a
      WHERE a.tenant_id=v_tenant AND a.revision_id=r.id),'[]'::jsonb),
    'materialSpecs',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'tenantId',m.tenant_id,'revisionId',m.revision_id,'itemCategory',m.item_category,
      'brand',m.brand,'code',m.code,'name',m.name,'colorTone',m.color_tone,
      'specDescription',m.spec_description,'approvedForUse',m.approved_for_use
    ) ORDER BY m.created_at,m.id) FROM public.interior_design_material_specs m
      WHERE m.tenant_id=v_tenant AND m.revision_id=r.id),'[]'::jsonb)
  ) ORDER BY r.version_number),'[]'::jsonb)
  INTO v_result
  FROM public.interior_design_revisions r
  JOIN public.interior_projects p ON p.id=r.project_id AND p.tenant_id=r.tenant_id
  WHERE r.tenant_id=v_tenant AND r.project_id=p_project_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_list_design_revisions(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_list_design_revisions(uuid) TO authenticated;

-- Dashboard portfolio rows use one authorization-aware statement/snapshot for all projects.
CREATE OR REPLACE FUNCTION public.interior_list_design_portfolio_summaries(p_project_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tenant uuid:=public.interior_actor_tenant(); v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR p_project_ids IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: active Interior tenant and project ids are required';
  END IF;
  IF cardinality(p_project_ids)=0 THEN RETURN '[]'::jsonb; END IF;

  WITH visible_projects AS (
    SELECT p.id,p.active_approved_revision_id,p.branch_id,
      public.interior_has_permission('interior:design:read',v_tenant,p.id,p.branch_id) AS can_read_design
    FROM public.interior_projects p
    WHERE p.tenant_id=v_tenant AND p.id=ANY(p_project_ids)
      AND public.interior_has_permission('interior:project:read',v_tenant,p.id,p.branch_id)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'projectId',p.id,
    'canReadDesign',p.can_read_design,
    'revisions',CASE WHEN p.can_read_design THEN coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',r.id,'projectId',r.project_id,'versionNumber',r.version_number,'status',r.status,
        'isActiveRevision',r.id=p.active_approved_revision_id,
        'assets',coalesce((SELECT jsonb_agg(jsonb_build_object(
          'tenantId',a.tenant_id,'revisionId',a.revision_id,'type',a.asset_type,'fileUrl',a.file_url
        ) ORDER BY a.created_at,a.id) FROM public.interior_design_assets a
          WHERE a.tenant_id=v_tenant AND a.revision_id=r.id
            AND nullif(trim(a.file_url),'') IS NOT NULL),'[]'::jsonb)
      ) ORDER BY r.version_number)
      FROM public.interior_design_revisions r
      WHERE r.tenant_id=v_tenant AND r.project_id=p.id
    ),'[]'::jsonb) ELSE '[]'::jsonb END
  ) ORDER BY p.id),'[]'::jsonb)
  INTO v_result FROM visible_projects p;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_list_design_portfolio_summaries(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_list_design_portfolio_summaries(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
