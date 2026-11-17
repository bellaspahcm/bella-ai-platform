-- Align Interior BOQ approval audit action with canonical audit_logs vocabulary.
-- Keep table_name, tenant_id, record_id, and jsonb old_data/new_data intact while satisfying audit_logs_action_check.

CREATE OR REPLACE FUNCTION public.interior_approve_boq(p_boq_id uuid)
RETURNS TABLE(status text,reason text,boq_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_tenant uuid:=public.interior_actor_tenant();
  v_boq public.interior_boqs%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RETURN QUERY SELECT 'DENIED'::text,'ACTIVE_ACTOR_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  SELECT * INTO v_boq FROM public.interior_boqs b
  WHERE b.id=p_boq_id AND b.tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_NOT_FOUND'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT public.interior_has_permission('interior:boq:approve',v_tenant,v_boq.project_id,NULL) THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_APPROVAL_PERMISSION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  IF v_boq.status NOT IN ('draft','review') OR v_boq.prepared_by_user_id IS NULL
     OR v_boq.prepared_by_user_id=v_actor THEN
    RETURN QUERY SELECT 'DENIED'::text,'BOQ_CREATOR_CANNOT_APPROVE_OR_STATE_NOT_APPROVABLE'::text,NULL::uuid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.interior_design_revisions r
    WHERE r.id=v_boq.design_revision_id AND r.project_id=v_boq.project_id
      AND r.tenant_id=v_tenant AND r.status='approved') THEN
    RETURN QUERY SELECT 'DENIED'::text,'APPROVED_DESIGN_REVISION_REQUIRED'::text,NULL::uuid; RETURN;
  END IF;
  UPDATE public.interior_boqs SET status='approved',approved_by_user_id=v_actor,updated_at=statement_timestamp()
  WHERE id=v_boq.id AND tenant_id=v_tenant;
  INSERT INTO public.audit_logs(tenant_id,table_name,record_id,action,old_data,new_data,changed_by_id,created_at)
  VALUES(v_tenant,'interior_boqs',v_boq.id,'UPDATE',to_jsonb(v_boq),
    jsonb_build_object('id',v_boq.id,'status','approved','approved_by_user_id',v_actor),v_actor,statement_timestamp());
  RETURN QUERY SELECT 'COMMITTED'::text,'BOQ_APPROVED'::text,v_boq.id;
END;
$$;

REVOKE ALL ON FUNCTION public.interior_approve_boq(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.interior_approve_boq(uuid) TO authenticated;
