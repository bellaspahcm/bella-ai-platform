-- Metadata only. Explicit external target: lvnvkpyxtuilhrabtlwv.
-- No business table rows, business RPC, DML, DDL, grants or migration execution.
BEGIN TRANSACTION READ ONLY;
WITH names(name) AS (VALUES
 ('tenants'),('users'),('people_directory'),('org_units'),('org_relationships'),
 ('user_org_unit_access'),('party_parties'),('party_auth_links'),
 ('party_identity_link_managers'),('students'),('edu_courses'),('edu_enrollments'),
 ('teacher_assignments'),('preschool_teacher_branch_confirmations'),
 ('preschool_chain_course_branch_assignments'),('edu_attendance'),
 ('edu_attendance_daily_state'),('edu_enrollment_event_records')
), relations AS (
 SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN (SELECT name FROM names)
), functions AS (
 SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
 p.proname ILIKE '%attendance%' OR p.proname IN (
 'edu_preschool_roster_identity','platform_current_actor_profile',
 'platform_current_tenant_presentation','party_resolve_current_auth_link',
 'preschool_branch_access','preschool_teacher_assert_admin'))
), roles AS (
 SELECT oid,rolname,rolsuper,rolbypassrls FROM pg_catalog.pg_roles
 WHERE rolname IN ('anon','authenticated','service_role')
)
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'database',current_database(),'executor',current_user,
 'transactionReadOnly',current_setting('transaction_read_only'),
 'expectedHelpers',(SELECT jsonb_agg(jsonb_build_object('signature',signature,
   'exists',to_regprocedure(signature) IS NOT NULL)) FROM (VALUES
   ('public.preschool_teacher_attendance_courses(date,uuid)'),
   ('public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)')
 ) x(signature)),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,
   'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity,'acl',r.relacl::text,
   'owner',pg_catalog.pg_get_userbyid(r.relowner),
   'viewDefinition',CASE WHEN r.relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(r.oid,true) END)
   ORDER BY r.relname) FROM relations r),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',a.attname,
   'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'acl',a.attacl::text)
   ORDER BY r.relname,a.attnum) FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid
   WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
   'definition',pg_catalog.pg_get_constraintdef(c.oid,true),'validated',c.convalidated)
   ORDER BY r.relname,c.conname) FROM relations r JOIN pg_catalog.pg_constraint c ON c.conrelid=r.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',p.polname,
   'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles::text,
   'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
   'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY r.relname,p.polname)
   FROM relations r JOIN pg_catalog.pg_policy p ON p.polrelid=r.oid),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
   'definitionMd5',md5(pg_catalog.pg_get_functiondef(p.oid)),
   'definition',pg_catalog.pg_get_functiondef(p.oid),'securityDefiner',p.prosecdef,
   'owner',pg_catalog.pg_get_userbyid(p.proowner),'config',p.proconfig,'acl',p.proacl::text)
   ORDER BY p.oid::regprocedure::text) FROM functions p),
 'effectiveExecute',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
   'role',x.rolname,'execute',has_function_privilege(x.rolname,p.oid,'EXECUTE'))
   ORDER BY p.oid::regprocedure::text,x.rolname) FROM functions p CROSS JOIN roles x),
 'effectiveTablePrivileges',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'role',x.rolname,
   'select',has_table_privilege(x.rolname,r.oid,'SELECT'),
   'insert',has_table_privilege(x.rolname,r.oid,'INSERT'),
   'update',has_table_privilege(x.rolname,r.oid,'UPDATE'),
   'delete',has_table_privilege(x.rolname,r.oid,'DELETE')) ORDER BY r.relname,x.rolname)
   FROM relations r CROSS JOIN roles x),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls)) FROM roles)
) AS catalog;
ROLLBACK;
