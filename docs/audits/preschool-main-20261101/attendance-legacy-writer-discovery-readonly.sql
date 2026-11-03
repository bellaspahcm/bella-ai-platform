-- Catalog/telemetry metadata only. No business rows or raw query/client values returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
 'checkedAt',clock_timestamp(),'transactionReadOnly',current_setting('transaction_read_only'),
 'statisticsRelations',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
 'columns',(SELECT jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
   WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)))
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relname IN ('pg_stat_statements','pg_stat_statements_info')),
 'statisticsSettings',jsonb_build_object('track',current_setting('pg_stat_statements.track',true),
 'trackUtility',current_setting('pg_stat_statements.track_utility',true),
 'save',current_setting('pg_stat_statements.save',true),'auditLog',current_setting('pgaudit.log',true)),
 'directDmlPrivilegeClasses',(SELECT jsonb_agg(jsonb_build_object('roleClass',role_class,'roles',role_count))
   FROM (SELECT CASE WHEN r.rolcanlogin THEN 'LOGIN_ROLE' ELSE 'NON_LOGIN_ROLE' END AS role_class,count(*) AS role_count
     FROM pg_catalog.pg_roles r WHERE has_table_privilege(r.rolname,'public.edu_attendance','INSERT')
       OR has_table_privilege(r.rolname,'public.edu_attendance','UPDATE')
       OR has_table_privilege(r.rolname,'public.edu_attendance','DELETE')
     GROUP BY 1) x),
 'connectionsByRoleClass',(SELECT jsonb_agg(jsonb_build_object('roleClass',role_class,'connections',connection_count))
   FROM (SELECT CASE WHEN usename IN ('postgres','authenticator','supabase_admin') THEN usename ELSE 'other_role' END AS role_class,
     count(*) AS connection_count FROM pg_catalog.pg_stat_activity
     WHERE datname=current_database() GROUP BY 1) x),
 'directEventMutatorFunctions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'securityDefiner',p.prosecdef,'owner',pg_catalog.pg_get_userbyid(p.proowner)))
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f'
   AND p.prosrc ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?edu_attendance([[:space:]]|\()')
) AS discovery;
ROLLBACK;
