BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_truncate,
       has_table_privilege('service_role', c.oid, 'SELECT') AS service_role_select,
       has_table_privilege('service_role', c.oid, 'INSERT') AS service_role_insert,
       has_table_privilege('service_role', c.oid, 'UPDATE') AS service_role_update,
       has_table_privilege('service_role', c.oid, 'DELETE') AS service_role_delete,
       has_table_privilege('service_role', c.oid, 'TRUNCATE') AS service_role_truncate
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'auto_vehicles_history', 'auto_bookings_history',
    'auto_customer_journeys_history', 'hc_temporal_events',
    'hc_temporal_snapshots'
  )
ORDER BY c.relname;
ROLLBACK;
