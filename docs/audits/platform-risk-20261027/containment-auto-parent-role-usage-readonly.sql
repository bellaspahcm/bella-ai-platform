BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT r.rolname AS database_role,
       CASE
         WHEN s.query ~* 'UPDATE\s+(ONLY\s+)?("?public"?\.)?"?auto_vehicles"?' THEN 'auto_vehicles_update'
         WHEN s.query ~* 'UPDATE\s+(ONLY\s+)?("?public"?\.)?"?auto_bookings"?' THEN 'auto_bookings_update'
         WHEN s.query ~* 'UPDATE\s+(ONLY\s+)?("?public"?\.)?"?auto_customer_journeys"?' THEN 'auto_customer_journeys_update'
       END AS parent_update,
       sum(s.calls)::bigint AS calls,
       min(s.stats_since) AS earliest_stats_since,
       max(s.stats_since) AS latest_stats_since
FROM pg_stat_statements s
JOIN pg_roles r ON r.oid = s.userid
WHERE s.query ~* '^\s*UPDATE\s+(ONLY\s+)?("?public"?\.)?"?auto_(vehicles|bookings|customer_journeys)"?'
GROUP BY r.rolname, parent_update
ORDER BY parent_update, database_role;

ROLLBACK;
