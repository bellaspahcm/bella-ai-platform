BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT r.rolname AS database_role,
       CASE
         WHEN s.query ~* 'temporal_snapshot_auto_(vehicles|bookings|customer_journeys)' THEN 'auto_history_trigger_parent_update'
         WHEN s.query ~* 'auto_(vehicles|bookings|customer_journeys)_history' THEN 'auto_history_table_or_rpc'
         WHEN s.query ~* 'reconstruct_temporal_state_at' THEN 'h9_reconstruction_rpc'
         WHEN s.query ~* 'hc_temporal_(events|snapshots)' THEN 'h9_temporal_table'
         ELSE 'other_target'
       END AS target_path,
       sum(s.calls)::bigint AS calls,
       min(s.stats_since) AS earliest_stats_since,
       max(s.stats_since) AS latest_stats_since
FROM pg_stat_statements s
JOIN pg_roles r ON r.oid = s.userid
WHERE s.query ~* '(temporal_snapshot_auto_(vehicles|bookings|customer_journeys)|auto_(vehicles|bookings|customer_journeys)_history|reconstruct_temporal_state_at|hc_temporal_(events|snapshots))'
GROUP BY r.rolname, target_path
ORDER BY target_path, database_role;

ROLLBACK;
