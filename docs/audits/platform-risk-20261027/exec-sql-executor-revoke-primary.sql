DO $revoke$
DECLARE
  fn_oid oid;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'unexpected database or execution identity';
  END IF;

  SELECT p.oid INTO fn_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='exec_sql' AND p.oid='public.exec_sql(text)'::regprocedure;
  IF fn_oid IS NULL THEN RAISE EXCEPTION 'expected public.exec_sql(text) was not found'; END IF;
  IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=fn_oid) <> 'postgres' THEN
    RAISE EXCEPTION 'unexpected function owner';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn_oid) THEN
    RAISE EXCEPTION 'function security mode changed';
  END IF;
  IF NOT has_function_privilege('postgres', fn_oid, 'EXECUTE') THEN RAISE EXCEPTION 'postgres grant missing'; END IF;
  IF NOT has_function_privilege('service_role', fn_oid, 'EXECUTE') THEN RAISE EXCEPTION 'service_role grant missing'; END IF;
  IF NOT has_function_privilege('bella_migration_executor', fn_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'executor grant already absent; no change applied';
  END IF;
  IF EXISTS (SELECT 1 FROM aclexplode(COALESCE((SELECT proacl FROM pg_proc WHERE oid=fn_oid), acldefault('f',(SELECT proowner FROM pg_proc WHERE oid=fn_oid)))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC has EXECUTE; executor-only revoke would not contain the function';
  END IF;

  REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM bella_migration_executor;

  IF has_function_privilege('bella_migration_executor', fn_oid, 'EXECUTE') THEN RAISE EXCEPTION 'executor still has effective EXECUTE'; END IF;
  IF NOT has_function_privilege('postgres', fn_oid, 'EXECUTE') THEN RAISE EXCEPTION 'postgres EXECUTE was not preserved'; END IF;
  IF NOT has_function_privilege('service_role', fn_oid, 'EXECUTE') THEN RAISE EXCEPTION 'service_role EXECUTE was not preserved'; END IF;
END
$revoke$;
