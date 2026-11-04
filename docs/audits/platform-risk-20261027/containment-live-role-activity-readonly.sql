BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT usename AS database_role, application_name, state, backend_type, count(*) AS sessions
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY usename, application_name, state, backend_type
ORDER BY database_role, application_name, state, backend_type;

SELECT e.extname, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_stat_statements';

ROLLBACK;
