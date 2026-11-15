-- Keep the BOQ authorization trigger aligned with the snapshot-seal exception.
-- All other fields stay immutable while an approved/locked BOQ is sealed.
CREATE OR REPLACE FUNCTION public.interior_guard_boq_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AuthorizationViolation: authenticated Interior actor is required for BOQ writes';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.prepared_by_user_id:=auth.uid();
    NEW.approved_by_user_id:=NULL;
    IF NEW.status IN ('approved','locked_for_contract') THEN
      RAISE EXCEPTION 'AuthorizationViolation: BOQ must be drafted before separate approval or contract locking';
    END IF;
    RETURN NEW;
  END IF;
  NEW.prepared_by_user_id:=OLD.prepared_by_user_id;
  NEW.approved_by_user_id:=OLD.approved_by_user_id;
  IF OLD.status IN ('approved','locked_for_contract')
     AND OLD.snapshot_sealed_at IS NULL
     AND NEW.snapshot_sealed_at IS NOT NULL
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND (to_jsonb(NEW) - 'snapshot_sealed_at' - 'updated_at')
         = (to_jsonb(OLD) - 'snapshot_sealed_at' - 'updated_at') THEN
    RETURN NEW;
  END IF;
  IF OLD.status='locked_for_contract' THEN
    RAISE EXCEPTION 'AuthorizationViolation: locked BOQ is immutable';
  END IF;
  IF OLD.status='approved' AND NEW.status IS DISTINCT FROM 'locked_for_contract' THEN
    RAISE EXCEPTION 'AuthorizationViolation: approved BOQ can only be locked for a contract';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='approved' THEN
    IF auth.uid() IS NULL OR OLD.prepared_by_user_id IS NULL OR OLD.prepared_by_user_id=auth.uid()
       OR NOT public.interior_has_permission('interior:boq:approve',NEW.tenant_id,NEW.project_id,NULL) THEN
      RAISE EXCEPTION 'AuthorizationViolation: BOQ approver must have separate approval permission and differ from preparer';
    END IF;
    NEW.approved_by_user_id:=auth.uid();
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='locked_for_contract' THEN
    IF OLD.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'AuthorizationViolation: only an approved BOQ can be locked for a contract';
    END IF;
    IF NOT (
      public.interior_has_permission('interior:contract:create',NEW.tenant_id,NEW.project_id,NULL)
      OR public.interior_has_permission('interior:contract:update',NEW.tenant_id,NEW.project_id,NULL)
    ) THEN RAISE EXCEPTION 'AuthorizationViolation: contract action required to lock approved BOQ'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
