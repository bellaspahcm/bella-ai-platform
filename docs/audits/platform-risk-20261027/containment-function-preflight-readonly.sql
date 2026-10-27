BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Fresh table ACL/RLS/owner and effective browser/server-role privileges.
SELECT n.nspname AS schema_name, c.relname AS table_name,
  c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
  pg_get_userbyid(c.relowner) AS owner_role,
  c.relacl::text AS table_acl,
  md5(coalesce(c.relacl::text, '')) AS table_acl_md5,
  r.role_name,
  has_schema_privilege(r.role_name, n.oid, 'USAGE') AS schema_usage,
  has_table_privilege(r.role_name, c.oid, 'SELECT') AS can_select,
  has_table_privilege(r.role_name, c.oid, 'INSERT') AS can_insert,
  has_table_privilege(r.role_name, c.oid, 'UPDATE') AS can_update,
  has_table_privilege(r.role_name, c.oid, 'DELETE') AS can_delete,
  has_table_privilege(r.role_name, c.oid, 'TRUNCATE') AS can_truncate,
  (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0
    AND NOT a.attisdropped AND a.attacl IS NOT NULL) AS columns_with_explicit_acl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role_name)
WHERE n.nspname = 'public' AND c.relname IN (
  'auto_bookings_history', 'auto_customer_journeys_history', 'auto_vehicles_history',
  'hc_temporal_events', 'hc_temporal_snapshots'
)
ORDER BY c.relname, r.role_name;

-- Find deployed routines whose definitions directly reference any targeted table.
-- Hashes and ACL metadata are retained; routine bodies and business rows are not.
WITH routines AS MATERIALIZED (
  SELECT p.* FROM pg_proc p WHERE p.prokind = 'f'
)
SELECT n.nspname AS schema_name, p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_userbyid(p.proowner) AS owner_role,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  p.proacl::text AS function_acl,
  md5(coalesce(p.proacl::text, '')) AS function_acl_md5,
  md5(pg_get_functiondef(p.oid)) AS definition_md5,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute
FROM routines p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    position('auto_bookings_history' IN lower(pg_get_functiondef(p.oid))) > 0 OR
    position('auto_customer_journeys_history' IN lower(pg_get_functiondef(p.oid))) > 0 OR
    position('auto_vehicles_history' IN lower(pg_get_functiondef(p.oid))) > 0 OR
    position('hc_temporal_events' IN lower(pg_get_functiondef(p.oid))) > 0 OR
    position('hc_temporal_snapshots' IN lower(pg_get_functiondef(p.oid))) > 0
  )
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

ROLLBACK;
