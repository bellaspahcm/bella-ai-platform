BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

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

ROLLBACK;
