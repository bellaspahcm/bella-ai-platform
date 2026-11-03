-- F06 Announcement metadata only.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
WITH r AS (SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='edu_announcements'), f AS (SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('preschool_publish_school_announcement','preschool_list_school_announcements')), rr AS (SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role'))
SELECT jsonb_pretty(jsonb_build_object(
'capturedAt',CURRENT_TIMESTAMP,'transactionReadOnly',current_setting('transaction_read_only'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'rls',r.relrowsecurity,'forced',r.relforcerowsecurity,'acl',r.relacl::text)) FROM r),
'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',p.roles,'command',p.cmd,'using',p.qual,'withCheck',p.with_check)) FROM pg_catalog.pg_policies p WHERE p.schemaname='public' AND p.tablename='edu_announcements'),
'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'validated',k.convalidated,'definition',pg_catalog.pg_get_constraintdef(k.oid,true))) FROM pg_catalog.pg_constraint k JOIN r ON r.oid=k.conrelid),
'privileges',(SELECT jsonb_agg(jsonb_build_object('role',rr.rolname,'select',has_table_privilege(rr.oid,r.oid,'SELECT'),'insert',has_table_privilege(rr.oid,r.oid,'INSERT'),'update',has_table_privilege(rr.oid,r.oid,'UPDATE'),'delete',has_table_privilege(rr.oid,r.oid,'DELETE'),'anyColumnSelect',has_any_column_privilege(rr.oid,r.oid,'SELECT'),'anyColumnInsert',has_any_column_privilege(rr.oid,r.oid,'INSERT'),'anyColumnUpdate',has_any_column_privilege(rr.oid,r.oid,'UPDATE'))) FROM r CROSS JOIN rr),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',f.oid::regprocedure::text,'securityDefiner',f.prosecdef,'config',f.proconfig,'acl',f.proacl::text,'definition',pg_catalog.pg_get_functiondef(f.oid))) FROM f),
'execute',(SELECT jsonb_agg(jsonb_build_object('signature',f.oid::regprocedure::text,'role',rr.rolname,'execute',has_function_privilege(rr.oid,f.oid,'EXECUTE'))) FROM f CROSS JOIN rr),
'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),'functionDefinition',pg_catalog.pg_get_functiondef(t.tgfoid))) FROM pg_catalog.pg_trigger t JOIN r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal)
)) AS announcement_catalog;
ROLLBACK;
