-- CANDIDATE ONLY: NOT APPLIED. Keep outside supabase/migrations and release discovery.
-- Expected project: lvnvkpyxtuilhrabtlwv; verify connection externally before any authorized rehearsal.
-- Source base: f1299e3138f3700062a1ed84271db315737b0071.
-- Live metadata checkpoint: 2026-11-01T16:15:25.805582+07:00, REPEATABLE READ READ ONLY.
-- Scope: 2 new helper functions, 3 replacements, 2 existing SELECT policies,
-- and direct-event DML containment. No business-row DML or table/schema creation.
-- Default ending is ROLLBACK. This is NOT a Production execution command.
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE x record; oid_value oid;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'ATTENDANCE_OWNER_REVIEW_REQUIRED'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'ATTENDANCE_READ_COMMITTED_REQUIRED'; END IF;
  FOR x IN SELECT * FROM (VALUES
    ('public.edu_can_access_attendance_enrollment(uuid,uuid,date)','d320d997c656cb1af131ce23a343a0f8','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.edu_preschool_roster_identity(uuid,date)','7eac33bda0e481d1d0693cd1b2f77546','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.edu_set_daily_attendance(uuid,uuid,text,timestamp with time zone,date)','0bd77a772ef098df2f09ba02bd58ec5e','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')
  ) e(signature,expected_md5,expected_acl) LOOP
    oid_value := to_regprocedure(x.signature);
    IF oid_value IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=oid_value
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef AND md5(pg_catalog.pg_get_functiondef(p.oid))=x.expected_md5
      AND p.proacl::text=x.expected_acl) THEN
      RAISE EXCEPTION 'ATTENDANCE_FUNCTION_DRIFT: %',x.signature; END IF;
  END LOOP;
  IF to_regprocedure('public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)') IS NOT NULL
    OR to_regprocedure('public.preschool_teacher_attendance_courses(date,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_HELPER_ALREADY_PRESENT_REVIEW_REQUIRED'; END IF;
  IF to_regprocedure('public.party_resolve_current_auth_link()') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_PARTY_CONTRACT_MISSING'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=to_regprocedure('public.platform_current_actor_tenant_presentation()')
      AND md5(pg_catalog.pg_get_functiondef(p.oid))='85bbf1a94c8ca765e57c3e0fd3505044'
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef)
    OR NOT has_function_privilege('authenticated','public.platform_current_actor_tenant_presentation()','EXECUTE') THEN
    RAISE EXCEPTION 'ATTENDANCE_TENANT_PRESENTATION_CONTRACT_DRIFT'; END IF;
  FOR x IN SELECT * FROM (VALUES
    ('tenants','id','uuid'),
    ('tenants','status','text'),
    ('tenants','product_key','text'),
    ('users','id','uuid'),
    ('users','tenant_id','uuid'),
    ('users','role','text'),
    ('users','status','text'),
    ('edu_courses','id','uuid'),
    ('edu_courses','tenant_id','uuid'),
    ('edu_courses','title','text'),
    ('edu_courses','status','text'),
    ('edu_enrollments','id','uuid'),
    ('edu_enrollments','tenant_id','uuid'),
    ('edu_enrollments','course_id','uuid'),
    ('edu_enrollments','student_party_id','uuid'),
    ('edu_enrollments','status','text'),
    ('edu_enrollments','enrolled_at','timestamp with time zone'),
    ('edu_enrollments','request_id','text'),
    ('org_units','id','uuid'),
    ('org_units','tenant_id','uuid'),
    ('org_units','unit_type','text'),
    ('org_units','is_active','boolean'),
    ('user_org_unit_access','user_id','uuid'),
    ('user_org_unit_access','tenant_id','uuid'),
    ('user_org_unit_access','org_unit_id','uuid'),
    ('user_org_unit_access','relationship_id','uuid'),
    ('party_parties','id','uuid'),
    ('party_parties','tenant_id','uuid'),
    ('party_parties','party_type','text'),
    ('party_parties','deleted_at','timestamp with time zone'),
    ('party_parties','display_name','text'),
    ('party_parties','gender','text'),
    ('party_parties','dob','date'),
    ('students','student_id','uuid'),
    ('students','tenant_id','uuid'),
    ('students','party_id','uuid'),
    ('students','student_code','text'),
    ('students','academic_status','text'),
    ('teacher_assignments','tenant_id','uuid'),
    ('teacher_assignments','teacher_party_id','uuid'),
    ('teacher_assignments','canonical_course_id','uuid'),
    ('teacher_assignments','canonical_teacher_confirmation_id','uuid'),
    ('teacher_assignments','course_id','uuid'),
    ('teacher_assignments','status','text'),
    ('teacher_assignments','effective_start_date','date'),
    ('teacher_assignments','effective_end_date','date'),
    ('preschool_teacher_branch_confirmations','id','uuid'),
    ('preschool_teacher_branch_confirmations','tenant_id','uuid'),
    ('preschool_teacher_branch_confirmations','branch_id','uuid'),
    ('preschool_teacher_branch_confirmations','teacher_party_id','uuid'),
    ('preschool_teacher_branch_confirmations','valid_from','date'),
    ('preschool_teacher_branch_confirmations','valid_to','date'),
    ('preschool_teacher_branch_confirmations','revoked_at','timestamp with time zone'),
    ('preschool_chain_course_branch_assignments','tenant_id','uuid'),
    ('preschool_chain_course_branch_assignments','course_id','uuid'),
    ('preschool_chain_course_branch_assignments','branch_id','uuid'),
    ('preschool_chain_enrollment_branch_assignments','tenant_id','uuid'),
    ('preschool_chain_enrollment_branch_assignments','enrollment_id','uuid'),
    ('preschool_chain_enrollment_branch_assignments','course_id','uuid'),
    ('preschool_chain_enrollment_branch_assignments','branch_id','uuid'),
    ('preschool_chain_enrollment_branch_assignments','request_id','uuid'),
    ('edu_attendance','id','uuid'),
    ('edu_attendance','tenant_id','uuid'),
    ('edu_attendance','enrollment_id','uuid'),
    ('edu_attendance','status','text'),
    ('edu_attendance','roll_call_time','timestamp with time zone'),
    ('edu_attendance_daily_state','id','uuid'),
    ('edu_attendance_daily_state','tenant_id','uuid'),
    ('edu_attendance_daily_state','enrollment_id','uuid'),
    ('edu_attendance_daily_state','school_day','date'),
    ('edu_attendance_daily_state','status','text'),
    ('edu_attendance_daily_state','created_at','timestamp with time zone'),
    ('edu_attendance_daily_state','updated_at','timestamp with time zone')
  ) e(relation_name,column_name,expected_type) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||x.relation_name) AND a.attname=x.column_name
      AND NOT a.attisdropped AND a.attnum>0
      AND pg_catalog.format_type(a.atttypid,a.atttypmod)=x.expected_type) THEN
      RAISE EXCEPTION 'ATTENDANCE_COLUMN_DRIFT: %.%',x.relation_name,x.column_name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM (VALUES('id','uuid'),('deleted_at','timestamp with time zone'),('banned_until','timestamp with time zone')) e(name,expected_type)
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='auth.users'::regclass
      AND a.attname=e.name AND NOT a.attisdropped AND pg_catalog.format_type(a.atttypid,a.atttypmod)=e.expected_type)) THEN
    RAISE EXCEPTION 'ATTENDANCE_AUTH_METADATA_REQUIRED'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class WHERE oid IN ('public.edu_attendance'::regclass,
    'public.edu_attendance_daily_state'::regclass) AND relrowsecurity)<>2 THEN
    RAISE EXCEPTION 'ATTENDANCE_RLS_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.edu_attendance_daily_state'::regclass
    AND conname='edu_attendance_daily_state_unique' AND contype='u' AND convalidated
    AND pg_catalog.pg_get_constraintdef(oid,true)='UNIQUE (tenant_id, enrollment_id, school_day)') THEN
    RAISE EXCEPTION 'ATTENDANCE_DAILY_KEY_DRIFT'; END IF;
  FOR x IN SELECT * FROM (VALUES
    ('roster_rpc_state_allow',true,'((( SELECT t.product_key
   FROM tenants t
  WHERE (t.id = edu_attendance_daily_state.tenant_id)) = ''bella_preschool''::text) AND edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day))'),
    ('roster_rpc_state_guard',false,'((EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.id = edu_attendance_daily_state.tenant_id) AND (t.product_key IS DISTINCT FROM ''bella_preschool''::text)))) OR edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day))')
  ) e(name,permissive,expected_using) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p
      WHERE p.polrelid='public.edu_attendance_daily_state'::regclass AND p.polname=x.name
      AND p.polcmd='r' AND p.polpermissive=x.permissive
      AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')]::oid[]
      AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)=x.expected_using) THEN
      RAISE EXCEPTION 'ATTENDANCE_POLICY_DRIFT: %',x.name; END IF;
  END LOOP;
  -- PL/pgSQL string bodies are not completely represented by pg_depend.
  -- Inspect text references as well; dynamic/external consumers still need review.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_depend d
    WHERE d.refclassid='pg_proc'::regclass AND d.refobjid IN (
      'public.edu_can_access_attendance_enrollment(uuid,uuid,date)'::regprocedure,
      'public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)'::regprocedure,
      'public.edu_preschool_roster_identity(uuid,date)'::regprocedure)
    AND NOT(d.classid='pg_policy'::regclass AND d.objid IN (
      SELECT oid FROM pg_catalog.pg_policy
      WHERE polrelid='public.edu_attendance_daily_state'::regclass
      AND polname IN ('roster_rpc_state_allow','roster_rpc_state_guard')))) THEN
    RAISE EXCEPTION 'ATTENDANCE_REGISTERED_DEPENDENCY_REVIEW_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy p
    WHERE (position('edu_can_access_attendance_enrollment' IN coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid),'')
      ||' '||coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),''))>0)
    AND NOT(p.polrelid='public.edu_attendance_daily_state'::regclass
      AND p.polname IN ('roster_rpc_state_allow','roster_rpc_state_guard'))) THEN
    RAISE EXCEPTION 'ATTENDANCE_FOREIGN_POLICY_DEPENDENCY_REVIEW_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f'
      AND (position('edu_can_access_attendance_enrollment' IN p.prosrc)>0
        OR position('edu_set_daily_attendance' IN p.prosrc)>0
        OR position('edu_preschool_roster_identity' IN p.prosrc)>0)
      AND p.oid NOT IN (
        'public.edu_can_access_attendance_enrollment(uuid,uuid,date)'::regprocedure,
        'public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)'::regprocedure,
        'public.edu_preschool_roster_identity(uuid,date)'::regprocedure,
        'public.edu_set_scoped_daily_attendance(uuid,uuid,text,uuid,uuid,uuid,uuid,text,text,timestamptz,date)'::regprocedure,
        'public.preschool_set_scoped_daily_attendance(uuid,uuid,text,uuid,uuid,uuid,uuid,text,timestamptz,date)'::regprocedure)) THEN
    RAISE EXCEPTION 'ATTENDANCE_FOREIGN_FUNCTION_DEPENDENCY_REVIEW_REQUIRED'; END IF;
  FOR x IN SELECT * FROM (VALUES
    ('edu_attendance','anon',true,true,true,true,false,true,true),
    ('edu_attendance','authenticated',true,true,true,true,false,true,true),
    ('edu_attendance','service_role',true,true,true,true,true,true,true),
    ('edu_attendance_daily_state','anon',false,false,false,false,false,false,false),
    ('edu_attendance_daily_state','authenticated',true,false,false,false,false,false,false),
    ('edu_attendance_daily_state','service_role',true,true,true,true,true,true,true)
  ) e(relation_name,role_name,can_select,can_insert,can_update,can_delete,can_truncate,column_insert,column_update) LOOP
    IF has_table_privilege(x.role_name,'public.'||x.relation_name,'SELECT') IS DISTINCT FROM x.can_select
      OR has_table_privilege(x.role_name,'public.'||x.relation_name,'INSERT') IS DISTINCT FROM x.can_insert
      OR has_table_privilege(x.role_name,'public.'||x.relation_name,'UPDATE') IS DISTINCT FROM x.can_update
      OR has_table_privilege(x.role_name,'public.'||x.relation_name,'DELETE') IS DISTINCT FROM x.can_delete
      OR has_table_privilege(x.role_name,'public.'||x.relation_name,'TRUNCATE') IS DISTINCT FROM x.can_truncate
      OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'INSERT') IS DISTINCT FROM x.column_insert
      OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'UPDATE') IS DISTINCT FROM x.column_update THEN
      RAISE EXCEPTION 'ATTENDANCE_TABLE_ACL_DRIFT: %.%',x.relation_name,x.role_name; END IF;
  END LOOP;
END;
$preflight$;
SELECT jsonb_build_object('checkedAt',clock_timestamp(),'executor',current_user,'database',current_database(),
 'transactionReadOnly',current_setting('transaction_read_only'),'transactionIsolation',current_setting('transaction_isolation'),
 'candidateSha256','af506babfb13da00ae072fcc7802e8c43fa4c0ab1770e73b89d03f2070903922','candidatePreflight','PASS','businessRowsRead',false,'candidateApplied',false) AS preflight;
ROLLBACK;

