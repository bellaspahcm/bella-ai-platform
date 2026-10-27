BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT p.tablename, p.policyname, p.cmd, p.roles, p.qual, p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    'auto_vehicles_history', 'auto_bookings_history',
    'auto_customer_journeys_history', 'hc_temporal_events',
    'hc_temporal_snapshots'
  )
ORDER BY p.tablename, p.policyname;
ROLLBACK;
