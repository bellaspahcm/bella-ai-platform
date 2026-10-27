BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_build_object(
  'observed_at', clock_timestamp(),
  'read_only', current_setting('transaction_read_only'),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'tenant_row_count', (SELECT count(*) FROM public.tenants),
  'migrations', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'version', version, 'name', name, 'statement_count', cardinality(statements),
    'statements_md5', md5(array_to_string(statements, E'\n'))
  ) ORDER BY version), '[]'::jsonb) FROM supabase_migrations.schema_migrations),
  'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', c.relname, 'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity,
    'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
    'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
    'columns', (SELECT jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull)
      ORDER BY a.attnum) FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
  ) ORDER BY c.relname), '[]'::jsonb)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')),
  'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname), '[]'::jsonb)
    FROM pg_policies p WHERE schemaname = 'public'),
  'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'result', pg_get_function_result(p.oid), 'security_definer', p.prosecdef,
    'definition_md5', md5(pg_get_functiondef(p.oid)),
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) ORDER BY p.proname, p.oid), '[]'::jsonb)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p'))
) AS catalog;
ROLLBACK;
