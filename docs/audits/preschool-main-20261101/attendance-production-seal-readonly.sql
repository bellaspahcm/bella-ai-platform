-- Coherent final snapshot of the identified attendance execution boundary.
-- Catalog metadata only; no business function invocation or row access.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH relations AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('edu_enrollments','edu_attendance','edu_attendance_daily_state')
), functions AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN (
 'edu_set_daily_attendance','edu_can_access_attendance_enrollment','edu_preschool_roster_identity',
 'preschool_teacher_attendance_courses','preschool_teacher_can_attend_course',
 'platform_current_actor_tenant_presentation','party_resolve_current_auth_link')
)
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'transactionReadOnly',current_setting('transaction_read_only'),
 'isolation',current_setting('transaction_isolation'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
   'definitionMd5',md5(pg_get_functiondef(p.oid)),'definition',pg_get_functiondef(p.oid),
   'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
   'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'ownerBypassRls',(SELECT rolbypassrls FROM pg_roles WHERE oid=p.proowner),
   'ownerSuperuser',(SELECT rolsuper FROM pg_roles WHERE oid=p.proowner))) FROM functions p),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'owner',pg_get_userbyid(r.relowner),
   'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity)) FROM relations r),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,
   'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true),
   'functionDefinition',pg_get_functiondef(t.tgfoid))), '[]'::jsonb)
   FROM relations r JOIN pg_trigger t ON t.tgrelid=r.oid WHERE NOT t.tgisinternal),
 'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',r.relname,'definition',pg_get_ruledef(w.oid,true))), '[]'::jsonb)
   FROM relations r JOIN pg_rewrite w ON w.ev_class=r.oid),
 'statePolicies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'permissive',p.polpermissive,
   'command',p.polcmd,'roles',(SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x) END) FROM unnest(p.polroles) x),
   'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)))
   FROM relations r JOIN pg_policy p ON p.polrelid=r.oid WHERE r.relname='edu_attendance_daily_state')
) AS catalog;
ROLLBACK;
