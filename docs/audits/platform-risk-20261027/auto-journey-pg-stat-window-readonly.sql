BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT stats_reset, pg_catalog.pg_postmaster_start_time() AS server_started_at
FROM extensions.pg_stat_statements_info;
ROLLBACK;
