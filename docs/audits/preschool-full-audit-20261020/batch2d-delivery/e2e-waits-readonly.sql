BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT jsonb_build_object(
 'environment','canonical isolated E2E bmnbqbcdbuklhopfbopv',
 'sessions',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'pid',a.pid,'role',a.usename,'state',a.state,'wait_type',a.wait_event_type,'wait',a.wait_event,
   'transaction_age_seconds',extract(epoch FROM now()-a.xact_start)::integer,
   'query_age_seconds',extract(epoch FROM now()-a.query_start)::integer,
   'blocked_by',pg_blocking_pids(a.pid),
   'query_class',CASE
     WHEN a.query ILIKE '%pg_advisory%' THEN 'advisory_lock'
     WHEN a.query ILIKE '%auto_bookings%' THEN 'auto_bookings'
     WHEN a.query ILIKE '%auto_vehicles%' THEN 'auto_vehicles'
     WHEN a.query ILIKE '%pg_auth_members%' THEN 'role_metadata'
     WHEN a.query ILIKE '%public.users%' THEN 'identity_users'
     WHEN a.query ILIKE '%public.tenants%' THEN 'identity_tenants'
     ELSE 'other_no_sql_saved' END
 ) ORDER BY a.pid) FROM pg_stat_activity a
 WHERE a.datname=current_database() AND a.pid<>pg_backend_pid()
 AND (a.state<>'idle' OR cardinality(pg_blocking_pids(a.pid))>0)),'[]'::jsonb),
 'scoped_relation_locks',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'pid',l.pid,'relation',c.relname,'mode',l.mode,'granted',l.granted
 ) ORDER BY l.pid,c.relname,l.mode)
 FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('users','tenants','auto_bookings','auto_vehicles') AND l.pid<>pg_backend_pid()),'[]'::jsonb),
 'business_query_text_saved',false,'business_row_contents_saved',false
) AS evidence;
ROLLBACK;
