-- exec_sql is a maintenance helper, never an application-client capability.
-- Preserve the existing owner/service_role/bella_migration_executor grants.
-- The production delta was independently rehearsed and verified in Batch2B.
-- Replaying this migration does not grant new privileges or change its body.
DO $rpc_client_boundary$
DECLARE
  client_role text;
  reviewed_clients text[] := ARRAY[
    'anon', 'authenticated', 'authenticator', 'bella_developer',
    'cli_login_postgres', 'dashboard_user', 'pg_checkpoint',
    'pg_create_subscription', 'pg_database_owner', 'pg_execute_server_program',
    'pg_maintain', 'pg_monitor', 'pg_read_all_data', 'pg_read_all_settings',
    'pg_read_all_stats', 'pg_read_server_files', 'pg_signal_backend',
    'pg_stat_scan_tables', 'pg_use_reserved_connections', 'pg_write_all_data',
    'pg_write_server_files', 'pgbouncer', 'supabase_auth_admin',
    'supabase_etl_admin', 'supabase_privileged_role', 'supabase_read_only_user',
    'supabase_realtime_admin', 'supabase_replication_admin',
    'supabase_storage_admin', 'verification_executor'
  ];
  maintenance_roles text[] := ARRAY['postgres', 'service_role', 'bella_migration_executor'];
BEGIN
  IF to_regprocedure('public.exec_sql(text)') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.exec_sql(text)'::regprocedure
      AND a.grantee <> 0
      AND pg_get_userbyid(a.grantee) <> ALL(maintenance_roles || reviewed_clients)
  ) THEN
    RAISE EXCEPTION 'Unreviewed exec_sql grantee; review before changing privileges';
  END IF;

  REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
  FOREACH client_role IN ARRAY reviewed_clients LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM %I', client_role);
    END IF;
  END LOOP;

  -- Reviewed client roles may inherit one another. Finish all direct revokes first.
  FOREACH client_role IN ARRAY reviewed_clients LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      IF has_function_privilege(client_role, 'public.exec_sql(text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Unreviewed inherited exec_sql privilege for %', client_role;
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.exec_sql(text)'::regprocedure
      AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> ALL(maintenance_roles))
  ) THEN
    RAISE EXCEPTION 'Unexpected exec_sql privileges remain';
  END IF;
END;
$rpc_client_boundary$;
