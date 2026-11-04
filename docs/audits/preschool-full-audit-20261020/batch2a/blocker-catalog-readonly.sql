BEGIN READ ONLY;
SELECT jsonb_build_object('project_role',current_user,'transaction_read_only',current_setting('transaction_read_only'),
 'function',jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'owner_bypass_rls',(SELECT rolbypassrls FROM pg_roles WHERE oid=p.proowner),
 'security_definer',p.prosecdef,'raw_acl',p.proacl::text,'configuration',p.proconfig,
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
 'definition',pg_get_functiondef(p.oid))) AS evidence
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='exec_sql' AND pg_get_function_identity_arguments(p.oid)='sql_query text';
ROLLBACK;
