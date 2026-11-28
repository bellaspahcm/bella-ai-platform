-- Bella Interior: close the production-only fixture RPC from all API roles.
-- This helper creates approved contract evidence and disables business guards;
-- it must never be exposed to client roles through PostgREST. A later migration
-- restores execution only for the trusted service_role.
-- Production executed the REVOKE directly. This existence guard makes replay
-- possible on installations where the production-only fixture never existed.
DO $migration$
BEGIN
  IF to_regprocedure('public.interior_seed_contract_evidence(uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,uuid,text,numeric,numeric,uuid,text,numeric,numeric)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.interior_seed_contract_evidence(uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,text,text,uuid,text,numeric,numeric,uuid,text,numeric,numeric) FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END;
$migration$;
