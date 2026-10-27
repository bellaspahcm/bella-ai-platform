BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT r.rolname AS database_role,
       CASE WHEN s.query ~* 'auto_vehicles' THEN 'auto_vehicles'
            WHEN s.query ~* 'auto_bookings' THEN 'auto_bookings'
            WHEN s.query ~* 'auto_customer_journeys' THEN 'auto_customer_journeys' END AS target,
       CASE WHEN s.query ~* '(^|[^[:alpha:]])UPDATE([^[:alpha:]]|$)' THEN 'update'
            WHEN s.query ~* '(^|[^[:alpha:]])INSERT([^[:alpha:]]|$)' THEN 'insert'
            WHEN s.query ~* '(^|[^[:alpha:]])DELETE([^[:alpha:]]|$)' THEN 'delete'
            WHEN s.query ~* '(^|[^[:alpha:]])SELECT([^[:alpha:]]|$)' THEN 'select'
            ELSE 'other' END AS operation,
       sum(s.calls)::bigint AS calls,
       min(s.stats_since) AS earliest_stats_since,
       max(s.stats_since) AS latest_stats_since
FROM pg_stat_statements s
JOIN pg_roles r ON r.oid = s.userid
WHERE s.query ~* '(auto_vehicles|auto_bookings|auto_customer_journeys)'
GROUP BY r.rolname, target, operation
ORDER BY target, operation, database_role;

ROLLBACK;
