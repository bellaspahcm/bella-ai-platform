BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT jsonb_build_object(
  'checkedAt', clock_timestamp(),
  'database', current_database(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'anonPublicSchemaUsage', has_schema_privilege('anon', 'public', 'USAGE'),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'identity', p.oid::regprocedure::text,
      'owner', pg_get_userbyid(p.proowner),
      'language', l.lanname,
      'securityDefiner', p.prosecdef,
      'resultType', pg_get_function_result(p.oid),
      'volatility', p.provolatile,
      'settings', p.proconfig,
      'constantTrueBody', btrim(p.prosrc, E' \t\r\n') IN ('SELECT true;', 'SELECT true'),
      'anonExecute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticatedExecute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'serviceRoleExecute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'definitionMd5', md5(pg_get_functiondef(p.oid))
    ) ORDER BY p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.proname = 'platform_health_database_probe'
      AND p.prokind = 'f'
  ), '[]'::jsonb),
  'ledgerVersions', (
    SELECT COALESCE(jsonb_agg(version ORDER BY version), '[]'::jsonb)
    FROM supabase_migrations.schema_migrations
  )
) AS health_metadata;

ROLLBACK;
