BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL ROLE anon;
SELECT 'auto_bookings_history' AS table_name,
  count(*) AS visible_rows, count(DISTINCT tenant_id) AS distinct_tenants,
  count(*) FILTER (WHERE tenant_id IS NULL) AS null_tenant_rows,
  current_user AS exercised_role, current_setting('transaction_read_only') AS read_only
FROM public.auto_bookings_history
UNION ALL
SELECT 'auto_customer_journeys_history', count(*), count(DISTINCT tenant_id),
  count(*) FILTER (WHERE tenant_id IS NULL), current_user, current_setting('transaction_read_only')
FROM public.auto_customer_journeys_history
UNION ALL
SELECT 'hc_temporal_events', count(*), count(DISTINCT tenant_id),
  count(*) FILTER (WHERE tenant_id IS NULL), current_user, current_setting('transaction_read_only')
FROM public.hc_temporal_events;
ROLLBACK;
