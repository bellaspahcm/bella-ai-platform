-- F05 supplemental catalog only: triggers, column privileges, view options.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
WITH names(name) AS (VALUES ('edu_curriculums'),('edu_lesson_plans'),('edu_weekly_menus'),('edu_weekly_menu_days'),('edu_dev_observations'),('edu_dev_observation_students'),('edu_dev_milestone_progress'),('teacher_assignments'),('preschool_teacher_branch_confirmations'),('party_auth_links'),('user_org_unit_access')),
r AS (SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN names x ON x.name=c.relname WHERE n.nspname='public'),
rr AS (SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')),
tr AS (SELECT t.*,r.relname FROM pg_catalog.pg_trigger t JOIN r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal)
SELECT jsonb_pretty(jsonb_build_object(
 'capturedAt',CURRENT_TIMESTAMP,'transactionReadOnly',current_setting('transaction_read_only'),
 'relationOptions',(SELECT jsonb_agg(jsonb_build_object('relation',r.relname,'options',r.reloptions) ORDER BY r.relname) FROM r),
 'columnAcls',(SELECT jsonb_agg(jsonb_build_object('relation',r.relname,'column',a.attname,'acl',a.attacl::text) ORDER BY r.relname,a.attnum) FROM r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid WHERE a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
 'effectiveAnyColumnPrivileges',(SELECT jsonb_agg(jsonb_build_object('relation',r.relname,'role',rr.rolname,'select',has_any_column_privilege(rr.oid,r.oid,'SELECT'),'insert',has_any_column_privilege(rr.oid,r.oid,'INSERT'),'update',has_any_column_privilege(rr.oid,r.oid,'UPDATE')) ORDER BY r.relname,rr.rolname) FROM r CROSS JOIN rr),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('relation',tr.relname,'name',tr.tgname,'enabled',tr.tgenabled,'definition',pg_catalog.pg_get_triggerdef(tr.oid,true),'function',p.oid::regprocedure::text,'functionDefinition',pg_catalog.pg_get_functiondef(p.oid)) ORDER BY tr.relname,tr.tgname) FROM tr JOIN pg_catalog.pg_proc p ON p.oid=tr.tgfoid),
 'helperDefinitions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'definition',pg_catalog.pg_get_functiondef(p.oid)) ORDER BY p.proname,p.oid) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('party_auth_link_context','preschool_course_assignment_visible','preschool_enrollment_assignment_visible')),
 'requiredAttendanceFunctions',jsonb_build_array(jsonb_build_object('signature','public.preschool_teacher_attendance_courses(date,uuid)','exists',to_regprocedure('public.preschool_teacher_attendance_courses(date,uuid)') IS NOT NULL),jsonb_build_object('signature','public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)','exists',to_regprocedure('public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)') IS NOT NULL))
)) AS authorization_supplement;
ROLLBACK;
