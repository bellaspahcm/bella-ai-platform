BEGIN;

-- Health only needs proof that an SQL function executes. This function has no
-- inputs, reads no tables, and runs with the caller's anon privileges.
CREATE FUNCTION public.platform_health_database_probe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT true;
$$;

REVOKE ALL ON FUNCTION public.platform_health_database_probe()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_health_database_probe() TO anon;

COMMENT ON FUNCTION public.platform_health_database_probe() IS
  'Constant, no-table-read Postgres execution probe for Platform health. Callable only by anon through the Supabase Data API.';

NOTIFY pgrst, 'reload schema';

COMMIT;
