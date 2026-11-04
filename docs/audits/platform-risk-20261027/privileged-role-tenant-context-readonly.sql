BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT jsonb_build_object(
  'database', current_database(),
  'tenantContextFunctionAccess', (
    SELECT jsonb_build_object(
      'exists', p.oid IS NOT NULL,
      'owner', owner.rolname,
      'securityDefiner', p.prosecdef,
      'executePublic', EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
      ),
      'executeAnon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'executeAuthenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'executeServiceRole', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'executeExecutor', has_function_privilege('bella_migration_executor', p.oid, 'EXECUTE')
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname = 'set_tenant_context'
      AND pg_get_function_identity_arguments(p.oid) = 'tenant_id uuid'
  ),
  'currentPoliciesReferencingTenantContextGuc', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'policy', policyname,
      'command', cmd,
      'roles', roles,
      'usingReferencesGuc', COALESCE(qual, '') ILIKE '%app.current_tenant_id%',
      'checkReferencesGuc', COALESCE(with_check, '') ILIKE '%app.current_tenant_id%'
    ) ORDER BY schemaname, tablename, policyname), '[]'::jsonb)
    FROM pg_policies
    WHERE COALESCE(qual, '') ILIKE '%app.current_tenant_id%'
       OR COALESCE(with_check, '') ILIKE '%app.current_tenant_id%'
  ),
  'currentPoliciesReferencingTenantContextGucCount', (
    SELECT count(*)
    FROM pg_policies
    WHERE COALESCE(qual, '') ILIKE '%app.current_tenant_id%'
       OR COALESCE(with_check, '') ILIKE '%app.current_tenant_id%'
  )
) AS privileged_role_tenant_context_evidence;

ROLLBACK;
