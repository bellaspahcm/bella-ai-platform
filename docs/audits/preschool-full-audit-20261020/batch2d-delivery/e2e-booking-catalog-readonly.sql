BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT jsonb_build_object(
 'environment','canonical isolated E2E bmnbqbcdbuklhopfbopv',
 'authenticated_users_select',has_table_privilege('authenticated','public.users','SELECT'),
 'authenticated_users_update',has_table_privilege('authenticated','public.users','UPDATE'),
 'exec_sql_present',to_regprocedure('public.exec_sql(text)') IS NOT NULL,
 'authenticated_exec_sql',CASE WHEN to_regprocedure('public.exec_sql(text)') IS NOT NULL
   THEN has_function_privilege('authenticated',to_regprocedure('public.exec_sql(text)'),'EXECUTE') ELSE NULL END,
 'exec_sql_function_callers',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'function',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'security_definer',p.prosecdef
  ) ORDER BY n.nspname,p.proname,p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname NOT IN('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND p.proname<>'exec_sql' AND p.prosrc ILIKE '%exec_sql%'),'[]'::jsonb),
 'booking_relation_triggers',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'relation',c.relname,'trigger',t.tgname,'function_schema',pn.nspname,
    'function',p.proname,'security_definer',p.prosecdef,
    'mentions_users',p.prosrc ILIKE '%users%',
    'mentions_exec_sql',p.prosrc ILIKE '%exec_sql%'
  ) ORDER BY c.relname,t.tgname)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN(
   'auto_bookings','auto_vehicles','auto_vehicle_status_logs','mobility_domain_events','mobility_command_idempotency')),'[]'::jsonb),
 'business_query_text_saved',false,'business_row_contents_saved',false
) AS evidence;
ROLLBACK;
