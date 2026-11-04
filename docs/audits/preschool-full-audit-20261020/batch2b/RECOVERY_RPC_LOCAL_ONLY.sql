-- Local recovery demonstration. Restores unsafe client rights; not an approved production rollback.
BEGIN;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO "authenticated","authenticator","bella_developer","cli_login_postgres","dashboard_user","pg_checkpoint","pg_create_subscription","pg_database_owner","pg_execute_server_program","pg_maintain","pg_monitor","pg_read_all_data","pg_read_all_settings","pg_read_all_stats","pg_read_server_files","pg_signal_backend","pg_stat_scan_tables","pg_use_reserved_connections","pg_write_all_data","pg_write_server_files","pgbouncer","supabase_auth_admin","supabase_etl_admin","supabase_privileged_role","supabase_read_only_user","supabase_realtime_admin","supabase_replication_admin","supabase_storage_admin","verification_executor";
ROLLBACK;
