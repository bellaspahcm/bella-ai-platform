BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_booking_as_of', 'get_journey_as_of',
    'get_temporal_vehicle_inventory', 'get_vehicle_as_of',
    'get_vehicle_status_history', 'reconstruct_temporal_state_at'
  )
ORDER BY p.proname;
ROLLBACK;
