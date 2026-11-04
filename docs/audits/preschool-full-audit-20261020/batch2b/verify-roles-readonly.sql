BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object(
 'authenticated_denied',NOT has_function_privilege('authenticated','public.exec_sql(text)','EXECUTE'),
 'anon_denied',NOT has_function_privilege('anon','public.exec_sql(text)','EXECUTE'),
 'service_allowed',has_function_privilege('service_role','public.exec_sql(text)','EXECUTE'),
 'migration_executor_allowed',has_function_privilege('bella_migration_executor','public.exec_sql(text)','EXECUTE')
) AS initial_catalog;
SET LOCAL ROLE authenticated;
DO $denied$ BEGIN
 BEGIN PERFORM public.exec_sql('SELECT 1'); RAISE EXCEPTION 'Unexpected authenticated RPC access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $denied$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $denied$ BEGIN
 BEGIN PERFORM public.exec_sql('SELECT 1'); RAISE EXCEPTION 'Unexpected anon RPC access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $denied$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.exec_sql('SELECT 1');
RESET ROLE;
SELECT jsonb_build_object('result','ACTUAL_ROLE_PROBES_PASS','authenticated_rpc','42501','anon_rpc','42501','service_role_rpc','SELECT1_PASS','business_writes',0,'user_jwt',false) AS evidence;
ROLLBACK;
