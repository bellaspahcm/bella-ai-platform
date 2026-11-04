-- PREPARED ONLY, NOT EXECUTED by this source review.
-- Verify target separately: lvnvkpyxtuilhrabtlwv (main / Production).
-- Catalog metadata only; invokes no business RPC and reads no business rows.
BEGIN TRANSACTION READ ONLY;
SELECT clock_timestamp() AS observed_at,
       current_database() AS database_name,
       current_user AS executor,
       current_setting('transaction_read_only') AS transaction_read_only,
       coalesce(jsonb_agg(jsonb_build_object(
         'signature', p.oid::regprocedure::text,
         'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
         'definition_md5', md5(pg_catalog.pg_get_functiondef(p.oid)),
         'definition', pg_catalog.pg_get_functiondef(p.oid),
         'owner', pg_catalog.pg_get_userbyid(p.proowner),
         'security_definer', p.prosecdef,
         'volatility', p.provolatile,
         'config', p.proconfig,
         'acl', p.proacl::text,
         'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
         'service_role_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
       ) ORDER BY p.oid), '[]'::jsonb) AS functions
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
  AND p.proname='edu_preschool_student_registry';
ROLLBACK;
