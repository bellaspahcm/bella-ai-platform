-- Bella Interior RPC least-privilege corrections.

-- Keep the contract evidence fixture callable only by trusted server code.
-- The function body treats a NULL auth.uid() as service-role access, which is
-- also true for anon; API roles must therefore be restricted by EXECUTE ACL.
-- Production executed these two statements directly. The guard permits replay
-- when this production-only fixture is absent; no fixture is created.
DO $migration$
BEGIN
  IF to_regprocedure('public.interior_seed_contract_evidence(uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,uuid,text,numeric,numeric,uuid,text,numeric,numeric)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.interior_seed_contract_evidence(uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,uuid,text,numeric,numeric,uuid,text,numeric,numeric) FROM PUBLIC, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.interior_seed_contract_evidence(uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,uuid,text,numeric,numeric,uuid,text,numeric,numeric) TO service_role;
  END IF;
END;
$migration$;

-- This RPC authenticates the actor and checks tenant-level user-management
-- permission internally. It is intended for authenticated application users.
REVOKE ALL ON FUNCTION public.interior_update_user_status(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.interior_update_user_status(uuid, text, text)
  TO authenticated;

-- This SECURITY DEFINER function is invoked by the customer-delete trigger,
-- not as a public RPC endpoint. Trigger execution does not require API roles
-- to have direct EXECUTE permission on the trigger function.
REVOKE ALL ON FUNCTION public.interior_prevent_customer_hard_delete()
  FROM PUBLIC, anon, authenticated, service_role;
