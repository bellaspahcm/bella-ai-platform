BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT jsonb_build_object(
  'database', current_database(),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'identityArguments', pg_get_function_identity_arguments(p.oid),
      'owner', owner.rolname,
      'securityDefiner', p.prosecdef,
      'configuration', p.proconfig,
      'executorCanExecute', has_function_privilege('bella_migration_executor', p.oid, 'EXECUTE'),
      'definition', pg_get_functiondef(p.oid)
    ) ORDER BY p.proname, p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname IN ('exec_sql', 'set_tenant_context')
  ), '[]'::jsonb)
) AS privileged_role_function_definitions;

ROLLBACK;
