BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

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

SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_userbyid(p.proowner) AS owner_role,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       COALESCE((SELECT bool_or(a.grantee = 0 AND a.privilege_type = 'EXECUTE')
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a), false) AS public_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname, pg_get_function_identity_arguments(p.oid)) IN (
    ('get_vehicle_as_of', 'p_entity_id uuid, p_as_of_date timestamp with time zone, p_tenant_id uuid'),
    ('get_booking_as_of', 'p_entity_id uuid, p_as_of_date timestamp with time zone, p_tenant_id uuid'),
    ('get_journey_as_of', 'p_entity_id uuid, p_as_of_date timestamp with time zone, p_tenant_id uuid'),
    ('get_temporal_vehicle_inventory', 'p_tenant_id uuid, p_as_of_time timestamp with time zone'),
    ('get_vehicle_status_history', 'p_tenant_id uuid, p_vehicle_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone'),
    ('reconstruct_temporal_state_at', 'p_tenant_id uuid, p_encounter_id uuid, p_target_time timestamp with time zone, p_dimension text')
  )
ORDER BY p.proname;

SELECT p.tablename, p.policyname, p.cmd, p.roles, p.qual, p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    'auto_vehicles_history', 'auto_bookings_history',
    'auto_customer_journeys_history', 'hc_temporal_events',
    'hc_temporal_snapshots'
  )
ORDER BY p.tablename, p.policyname;

SELECT t.tgname AS trigger_name,
       c.relname AS parent_table,
       t.tgenabled AS trigger_enabled,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       md5(p.prosrc) AS function_body_md5
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND t.tgname IN (
    'auto_vehicles_temporal_trigger', 'auto_bookings_temporal_trigger',
    'auto_customer_journeys_temporal_trigger'
  )
ORDER BY t.tgname;

ROLLBACK;
