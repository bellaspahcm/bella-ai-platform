BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database_name, current_user AS current_user_name, session_user AS session_user_name,
       p.oid::regprocedure AS function_signature, pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proacl AS explicit_acl,
       has_function_privilege('bella_migration_executor', p.oid, 'EXECUTE') AS executor_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       has_function_privilege('postgres', p.oid, 'EXECUTE') AS postgres_execute,
       has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='exec_sql' AND p.oid='public.exec_sql(text)'::regprocedure;
SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname='bella_migration_executor';
COMMIT;
