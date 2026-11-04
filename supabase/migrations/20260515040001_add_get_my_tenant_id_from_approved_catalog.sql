-- Restore the exact legacy tenant helper shape selected from the pinned
-- Production catalog snapshot (2026-10-21) for clean migration replay.
-- This is SECURITY INVOKER and only resolves the tenant for auth.uid(); it is
-- not a replacement for get_auth_tenant_id()'s active-identity checks.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$function$;

-- Match the observed catalog ACL: PUBLIC and service_role can execute.
REVOKE ALL ON FUNCTION public.get_my_tenant_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO PUBLIC, service_role;

-- This role exists on the captured Production catalog but is not standard in
-- every disposable Supabase project. Preserve its grant when present.
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bella_migration_executor') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO bella_migration_executor';
  END IF;
END
$grant$;

ALTER FUNCTION public.get_my_tenant_id() OWNER TO postgres;
