-- Follow only the attendance writer's actual DML boundary; catalog metadata only.
BEGIN TRANSACTION READ ONLY;
WITH relations AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('edu_attendance','edu_attendance_daily_state','edu_enrollments')
)
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'transactionReadOnly',current_setting('transaction_read_only'),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,
   'definition',pg_get_triggerdef(t.oid,true),
   'functionSignature',p.oid::regprocedure::text,'functionDefinition',pg_get_functiondef(p.oid),
   'functionOwner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef)), '[]'::jsonb)
   FROM relations c JOIN pg_trigger t ON t.tgrelid=c.oid
   JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal),
 'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',r.rulename,
   'definition',pg_get_ruledef(r.oid,true))), '[]'::jsonb)
   FROM relations c JOIN pg_rewrite r ON r.ev_class=c.oid),
 'ownerCapabilities',(SELECT jsonb_agg(jsonb_build_object('name',r.rolname,
   'superuser',r.rolsuper,'bypassRls',r.rolbypassrls)) FROM pg_roles r
   WHERE r.oid IN (SELECT relowner FROM relations))
) AS catalog;
ROLLBACK;
