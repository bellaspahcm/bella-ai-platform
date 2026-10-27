BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (
  'auto_vehicles', 'auto_bookings', 'auto_customer_journeys',
  'auto_vehicles_history', 'auto_bookings_history', 'auto_customer_journeys_history',
  'hc_temporal_events', 'hc_temporal_snapshots'
)
ORDER BY tablename, policyname;

ROLLBACK;
