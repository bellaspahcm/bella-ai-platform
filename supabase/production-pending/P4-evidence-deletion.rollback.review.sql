-- REVIEW ONLY. Roll back the matching application release as part of the same decision.
-- Preserve request/event records and already deleted objects. This is not data recovery.
BEGIN;
DO $$
BEGIN
  IF current_user<>'postgres' AND NOT pg_has_role(current_user,'postgres','MEMBER') THEN
    RAISE EXCEPTION 'P4 rollback requires access to postgres-owned objects';
  END IF;
  IF to_regclass('public.interior_evidence_deletion_requests') IS NULL
     OR to_regclass('public.interior_evidence_deletion_events') IS NULL
     OR to_regprocedure('public.interior_request_evidence_deletion(text,uuid,uuid,text,text,text,boolean)') IS NULL
     OR to_regprocedure('public.interior_prepare_evidence_deletion(uuid,uuid,boolean)') IS NULL
     OR to_regprocedure('public.interior_finish_evidence_deletion(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'P4 rollback objects differ from reviewed state';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_evidence_deletion_requests WHERE status IN ('DELETE_PENDING','DELETE_FAILED')) THEN
    RAISE EXCEPTION 'Reconcile pending and failed evidence deletion requests before rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interior_user_permission_grants WHERE permission_id='interior:evidence:delete')
     OR EXISTS (SELECT 1 FROM public.interior_role_permissions WHERE permission_id='interior:evidence:delete' AND role_key NOT IN ('OWNER','ADMIN')) THEN
    RAISE EXCEPTION 'P4 delete permission has additional grants; reconcile before rollback';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.interior_request_evidence_deletion(text,uuid,uuid,text,text,text,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.interior_list_evidence_deletion_requests(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.interior_prepare_evidence_deletion(uuid,uuid,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.interior_fail_evidence_deletion(uuid,uuid,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.interior_finish_evidence_deletion(uuid,uuid) FROM authenticated;
DROP TRIGGER IF EXISTS trg_interior_evidence_deletion_guard_o3 ON public.interior_site_diaries;
DROP TRIGGER IF EXISTS trg_interior_evidence_deletion_guard_o4 ON public.interior_acceptance_evidence_objects;
DELETE FROM public.interior_role_permissions WHERE permission_id='interior:evidence:delete' AND role_key IN ('OWNER','ADMIN');
DELETE FROM public.interior_permissions WHERE permission_id='interior:evidence:delete';
-- Tables, event history and disabled function definitions remain for audit.
COMMIT;
