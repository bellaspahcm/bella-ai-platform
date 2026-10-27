BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT jsonb_build_object(
  'table', (
    SELECT jsonb_build_object(
      'rls_enabled', c.relrowsecurity,
      'anon_update', has_table_privilege('anon', c.oid, 'UPDATE'),
      'authenticated_update', has_table_privilege('authenticated', c.oid, 'UPDATE'),
      'service_role_update', has_table_privilege('service_role', c.oid, 'UPDATE')
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'auto_customer_journeys'
  ),
  'policies', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', p.policyname, 'command', p.cmd, 'roles', p.roles,
      'using', p.qual, 'with_check', p.with_check
    ) ORDER BY p.policyname), '[]'::jsonb)
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'auto_customer_journeys'
  )
);
ROLLBACK;
