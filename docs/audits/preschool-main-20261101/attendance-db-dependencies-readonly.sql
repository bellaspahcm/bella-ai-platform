-- Explicit metadata-only target: lvnvkpyxtuilhrabtlwv. No business rows/RPCs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH targets(signature) AS (VALUES
 ('public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)'),
 ('public.preschool_teacher_attendance_courses(date,uuid)'),
 ('public.edu_can_access_attendance_enrollment(uuid,uuid,date)'),
 ('public.edu_preschool_roster_identity(uuid,date)'),
 ('public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)')
), names(name) AS (VALUES
 ('edu_can_access_attendance_enrollment'),('edu_set_daily_attendance'),
 ('edu_preschool_roster_identity'),('preschool_teacher_can_attend_course'),
 ('preschool_teacher_attendance_courses')
), relations AS (
 SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN (
 'tenants','users','org_units','user_org_unit_access','party_parties','party_auth_links',
 'students','edu_courses','edu_enrollments','teacher_assignments',
 'preschool_teacher_branch_confirmations','preschool_chain_course_branch_assignments',
 'preschool_chain_enrollment_branch_assignments','edu_attendance','edu_attendance_daily_state')
), policy_refs AS (
 SELECT p.*,c.relname,n.nspname,pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using_expr,
 pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
), function_refs AS (
 SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f'
 AND (p.oid IN (SELECT to_regprocedure(signature) FROM targets)
 OR p.proname IN ('party_resolve_current_auth_link','edu_set_scoped_daily_attendance',
 'preschool_set_scoped_daily_attendance','platform_current_actor_tenant_presentation')
 OR EXISTS (SELECT 1 FROM names x WHERE position(x.name IN p.prosrc)>0))
)
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),'executor',current_user,'database',current_database(),
 'transactionReadOnly',current_setting('transaction_read_only'),
 'transactionIsolation',current_setting('transaction_isolation'),
 'targets',(SELECT jsonb_agg(jsonb_build_object('signature',signature,'exists',to_regprocedure(signature) IS NOT NULL)) FROM targets),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
 'owner',pg_catalog.pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
 'config',p.proconfig,'acl',p.proacl::text,'definition',pg_catalog.pg_get_functiondef(p.oid),
 'definitionMd5',md5(pg_catalog.pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text) FROM function_refs p),
 'policyReferences',(SELECT jsonb_agg(jsonb_build_object('schema',p.nspname,'table',p.relname,
 'name',p.polname,'permissive',p.polpermissive,'command',p.polcmd,
 'roles',(SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(x) END ORDER BY x) FROM unnest(p.polroles) x),
 'using',p.using_expr,'check',p.check_expr) ORDER BY p.nspname,p.relname,p.polname)
 FROM policy_refs p WHERE EXISTS (SELECT 1 FROM names x WHERE position(x.name IN coalesce(p.using_expr,'')||' '||coalesce(p.check_expr,''))>0)),
 'registeredDependents',(SELECT jsonb_agg(jsonb_build_object('target',t.signature,
 'dependent',pg_catalog.pg_describe_object(d.classid,d.objid,d.objsubid),'type',d.deptype))
 FROM targets t JOIN pg_catalog.pg_depend d ON d.refclassid='pg_proc'::regclass AND d.refobjid=to_regprocedure(t.signature)),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,
 'owner',pg_catalog.pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity,
 'viewDefinition',CASE WHEN r.relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(r.oid,true) END) ORDER BY r.relname) FROM relations r),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',a.attname,
 'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull)
 ORDER BY r.relname,a.attnum) FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
 'definition',pg_catalog.pg_get_constraintdef(c.oid,true),'validated',c.convalidated)
 ORDER BY r.relname,c.conname) FROM relations r JOIN pg_catalog.pg_constraint c ON c.conrelid=r.oid),
 'effectiveExecute',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
 'role',r.rolname,'execute',has_function_privilege(r.rolname,p.oid,'EXECUTE')) ORDER BY p.oid::regprocedure::text,r.rolname)
 FROM function_refs p CROSS JOIN pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')),
 'directAttendancePrivileges',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'role',r.rolname,
 'select',has_table_privilege(r.rolname,c.oid,'SELECT'),'insert',has_table_privilege(r.rolname,c.oid,'INSERT'),
 'update',has_table_privilege(r.rolname,c.oid,'UPDATE'),'delete',has_table_privilege(r.rolname,c.oid,'DELETE'),
 'truncate',has_table_privilege(r.rolname,c.oid,'TRUNCATE'),
 'columnInsert',has_any_column_privilege(r.rolname,c.oid,'INSERT'),
 'columnUpdate',has_any_column_privilege(r.rolname,c.oid,'UPDATE')) ORDER BY c.relname,r.rolname)
 FROM relations c CROSS JOIN pg_catalog.pg_roles r WHERE c.relname IN ('edu_attendance','edu_attendance_daily_state') AND r.rolname IN ('anon','authenticated','service_role'))
) AS catalog;
ROLLBACK;
