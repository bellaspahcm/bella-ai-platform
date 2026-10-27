BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT source_ns.nspname AS source_schema,
  source_table.relname AS source_table,
  trigger_row.tgname AS trigger_name,
  trigger_row.tgenabled AS trigger_enabled,
  pg_get_triggerdef(trigger_row.oid) AS trigger_definition,
  function_ns.nspname AS function_schema,
  function_row.proname AS function_name,
  pg_get_userbyid(function_row.proowner) AS function_owner,
  function_row.prosecdef AS security_definer,
  md5(pg_get_functiondef(function_row.oid)) AS function_definition_md5
FROM pg_trigger trigger_row
JOIN pg_class source_table ON source_table.oid = trigger_row.tgrelid
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
JOIN pg_proc function_row ON function_row.oid = trigger_row.tgfoid
JOIN pg_namespace function_ns ON function_ns.oid = function_row.pronamespace
WHERE NOT trigger_row.tgisinternal
  AND source_ns.nspname = 'public'
  AND function_ns.nspname = 'public'
  AND function_row.proname IN (
    'temporal_snapshot_auto_bookings',
    'temporal_snapshot_auto_customer_journeys',
    'temporal_snapshot_auto_vehicles'
  )
ORDER BY source_table.relname, trigger_row.tgname;

ROLLBACK;
