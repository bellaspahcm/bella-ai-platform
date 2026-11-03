-- CANDIDATE ONLY: NOT APPLIED. Keep outside supabase/migrations and release discovery.
-- Expected project: lvnvkpyxtuilhrabtlwv; verify connection externally before any authorized rehearsal.
-- Source base: f1299e3138f3700062a1ed84271db315737b0071.
-- Live metadata checkpoint: 2026-11-01T16:15:25.805582+07:00, REPEATABLE READ READ ONLY.
-- Scope: 2 new helper functions, 3 replacements, 2 existing SELECT policies,
-- and direct-event DML containment. No business-row DML or table/schema creation.
-- Default ending is ROLLBACK. This is NOT a Production execution command.
BEGIN;
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

-- Source: supabase/migrations/20261026183000_integrate_preschool_teacher_attendance.sql; normalized SHA256 922e28ec5e81c1bd618b9885671fec6a7064701482e2ad4a3d7f98a8383ba447
CREATE FUNCTION public.preschool_teacher_can_attend_course(
  p_tenant_id uuid, p_course_id uuid, p_school_day date, p_expected_branch uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog AS $teacher_scope$
DECLARE v_identity jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR p_tenant_id IS NULL OR p_course_id IS NULL OR p_expected_branch IS NULL
    OR p_school_day IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    OR NOT EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
      WHERE u.id=auth.uid() AND u.tenant_id=p_tenant_id AND u.role='admin_staff'
        AND u.status='active' AND t.status='active' AND t.product_key='bella_preschool')
  THEN RETURN false; END IF;
  v_identity := public.party_resolve_current_auth_link();
  IF v_identity IS NULL OR v_identity->>'tenantId' IS DISTINCT FROM p_tenant_id::text
    OR v_identity->>'authUserId' IS DISTINCT FROM auth.uid()::text
  THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments m
      WHERE m.tenant_id=p_tenant_id AND m.course_id=p_course_id) <> 1
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.teacher_assignments a
    JOIN public.preschool_teacher_branch_confirmations f
      ON f.id=a.canonical_teacher_confirmation_id AND f.tenant_id=a.tenant_id
      AND f.teacher_party_id=a.teacher_party_id
    JOIN public.edu_courses c ON c.id=a.canonical_course_id AND c.tenant_id=a.tenant_id
    JOIN public.preschool_chain_course_branch_assignments m ON m.course_id=c.id AND m.tenant_id=c.tenant_id
      AND m.branch_id=f.branch_id AND m.branch_id=p_expected_branch
    JOIN public.org_units b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id
      AND b.unit_type='branch' AND b.is_active
    JOIN public.user_org_unit_access x ON x.org_unit_id=b.id AND x.tenant_id=b.tenant_id
      AND x.user_id=auth.uid() AND x.relationship_id IS NOT NULL
    WHERE a.tenant_id=p_tenant_id AND a.canonical_course_id=p_course_id AND a.course_id IS NULL
      AND a.teacher_party_id=(v_identity->>'partyId')::uuid AND a.status='active' AND c.status='active'
      AND a.effective_start_date<=p_school_day
      AND (a.effective_end_date IS NULL OR a.effective_end_date>=p_school_day)
      AND f.revoked_at IS NULL AND f.valid_from<=p_school_day
      AND (f.valid_to IS NULL OR f.valid_to>=p_school_day)
  );
EXCEPTION WHEN insufficient_privilege THEN RETURN false;
END;
$teacher_scope$;
REVOKE ALL ON FUNCTION public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Source: supabase/migrations/20261026183000_integrate_preschool_teacher_attendance.sql; normalized SHA256 922e28ec5e81c1bd618b9885671fec6a7064701482e2ad4a3d7f98a8383ba447
CREATE FUNCTION public.preschool_teacher_attendance_courses(p_school_day date,p_branch_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $teacher_courses$
DECLARE v_identity jsonb; v_tenant uuid; v_result jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR p_school_day IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  THEN RAISE EXCEPTION 'ATTENDANCE_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  v_identity := public.party_resolve_current_auth_link();
  IF v_identity IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u
    WHERE u.id=auth.uid() AND u.role='admin_staff' AND u.status='active'
      AND u.tenant_id::text=v_identity->>'tenantId')
  THEN RAISE EXCEPTION 'ATTENDANCE_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  v_tenant := (v_identity->>'tenantId')::uuid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'name',c.title,'branchId',m.branch_id)
    ORDER BY c.id),'[]'::jsonb) INTO v_result
  FROM public.edu_courses c JOIN public.preschool_chain_course_branch_assignments m
    ON m.course_id=c.id AND m.tenant_id=c.tenant_id
  WHERE c.tenant_id=v_tenant AND (p_branch_id IS NULL OR m.branch_id=p_branch_id)
    AND public.preschool_teacher_can_attend_course(v_tenant,c.id,p_school_day,m.branch_id);
  RETURN jsonb_build_object('tenantId',v_tenant,'actorId',auth.uid(),'schoolDay',p_school_day,'courses',v_result);
END;
$teacher_courses$;
REVOKE ALL ON FUNCTION public.preschool_teacher_attendance_courses(date,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_teacher_attendance_courses(date,uuid) TO authenticated;

-- Source: supabase/migrations/20261026183000_integrate_preschool_teacher_attendance.sql; normalized SHA256 922e28ec5e81c1bd618b9885671fec6a7064701482e2ad4a3d7f98a8383ba447
CREATE OR REPLACE FUNCTION public.edu_can_access_attendance_enrollment(
  p_tenant_id uuid,
  p_enrollment_id uuid,
  p_school_day date
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $attendance_access$
DECLARE
  v_actor uuid;
  v_role text;
  v_product text;
  v_course uuid;
  v_branch uuid;
  v_binding_count bigint;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN true; END IF;
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;

  v_actor := auth.uid();
  IF v_actor IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL OR p_school_day IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role, t.product_key INTO v_role, v_product
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor
    AND u.tenant_id = p_tenant_id
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= clock_timestamp())
    AND u.status = 'active'
    AND t.status = 'active';
  IF NOT FOUND OR v_product IS NULL THEN RETURN false; END IF;

  SELECT e.course_id INTO v_course
  FROM public.edu_enrollments e
  JOIN public.edu_courses c ON c.id = e.course_id AND c.tenant_id = e.tenant_id
  WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Preserve existing tenant-scoped behavior for other Education products.
  IF v_product <> 'bella_preschool' THEN RETURN true; END IF;

  -- Preschool attendance requires a current active actor and today's school day.
  -- Teacher access additionally requires the approved identity/assignment intersection.
  IF v_role NOT IN ('admin','admin_staff')
    OR p_school_day <> (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    JOIN public.edu_courses c ON c.id = e.course_id AND c.tenant_id = e.tenant_id
    WHERE e.id = p_enrollment_id
      AND e.tenant_id = p_tenant_id
      AND e.course_id = v_course
      AND e.status = 'active'
      AND c.status = 'active'
      AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ) THEN RETURN false; END IF;

  SELECT count(*), (array_agg(a.branch_id))[1]
  INTO v_binding_count, v_branch
  FROM public.preschool_chain_course_branch_assignments a
  WHERE a.tenant_id = p_tenant_id AND a.course_id = v_course;
  IF v_binding_count <> 1 OR v_branch IS NULL THEN RETURN false; END IF;

  IF v_role='admin_staff' AND (
    NOT public.preschool_teacher_can_attend_course(p_tenant_id,v_course,p_school_day,v_branch)
    OR (SELECT count(*) FROM public.preschool_chain_enrollment_branch_assignments m
      WHERE m.tenant_id=p_tenant_id AND m.enrollment_id=p_enrollment_id
        AND m.course_id=v_course AND m.branch_id=v_branch
        AND m.request_id::text=(SELECT e.request_id FROM public.edu_enrollments e
          WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id)) <> 1
  ) THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.org_units b
    JOIN public.user_org_unit_access a ON a.org_unit_id = b.id AND a.tenant_id = b.tenant_id
    WHERE b.id = v_branch
      AND b.tenant_id = p_tenant_id
      AND b.unit_type = 'branch'
      AND b.is_active
      AND a.user_id = v_actor
      AND a.relationship_id IS NOT NULL
  );
END;
$attendance_access$;
-- Existing function EXECUTE ACL is preserved by CREATE OR REPLACE.

-- Source: supabase/migrations/20261026183000_integrate_preschool_teacher_attendance.sql; normalized SHA256 922e28ec5e81c1bd618b9885671fec6a7064701482e2ad4a3d7f98a8383ba447
CREATE OR REPLACE FUNCTION public.edu_preschool_roster_identity(
  p_course_id uuid,
  p_school_day date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
SET statement_timeout = '10s'
SET lock_timeout = '5s'
AS $roster_identity$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_role text;
  v_branch uuid;
  v_roster jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR v_actor IS NULL
    OR p_course_id IS NULL
    OR p_school_day IS DISTINCT FROM (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT u.tenant_id,u.role INTO v_tenant,v_role
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= statement_timestamp())
    AND u.status = 'active'
    AND u.role IN ('admin','admin_staff')
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool';

  IF v_tenant IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.edu_courses c
    WHERE c.id = p_course_id AND c.tenant_id = v_tenant AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a
      WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id) <> 1 THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT a.branch_id INTO v_branch
  FROM public.preschool_chain_course_branch_assignments a
  JOIN public.org_units b
    ON b.id = a.branch_id
    AND b.tenant_id = a.tenant_id
    AND b.unit_type = 'branch'
    AND b.is_active
  WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id;

  IF v_branch IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_org_unit_access a
    WHERE a.tenant_id = v_tenant
      AND a.user_id = v_actor
      AND a.org_unit_id = v_branch
      AND a.relationship_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_role='admin_staff' AND (
    NOT public.preschool_teacher_can_attend_course(v_tenant,p_course_id,p_school_day,v_branch)
    OR EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant
      AND e.course_id=p_course_id AND e.status='active'
      AND e.enrolled_at < ((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND (SELECT count(*) FROM public.preschool_chain_enrollment_branch_assignments m
        WHERE m.tenant_id=v_tenant AND m.enrollment_id=e.id
          AND m.course_id=p_course_id AND m.branch_id=v_branch AND m.request_id::text=e.request_id) <> 1)
  ) THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    WHERE e.tenant_id = v_tenant
      AND e.course_id = p_course_id
      AND e.status = 'active'
      AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND (
        (SELECT count(*) FROM public.students s
         WHERE s.tenant_id = v_tenant AND s.party_id = e.student_party_id) <> 1
        OR NOT EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.party_parties p ON p.id = s.party_id AND p.tenant_id = s.tenant_id
          WHERE s.tenant_id = v_tenant
            AND s.party_id = e.student_party_id
            AND s.academic_status = 'enrolled'
            AND p.party_type = 'person'
            AND p.deleted_at IS NULL
            AND btrim(p.display_name) <> ''
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    WHERE e.tenant_id = v_tenant
      AND e.course_id = p_course_id
      AND e.status = 'active'
      AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY e.student_party_id
    HAVING count(*) <> 1
  ) THEN
    -- A data-integrity gap is unavailable data, not an authorization denial.
    RAISE EXCEPTION 'ROSTER_IDENTITY_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'enrollmentId', e.id,
    'studentId', s.student_id,
    'studentPartyId', p.id,
    'studentCode', s.student_code,
    'name', p.display_name,
    'gender', p.gender,
    'dob', p.dob,
    'enrollmentStatus', e.status
  ) ORDER BY e.id), '[]'::jsonb)
  INTO v_roster
  FROM public.edu_enrollments e
  JOIN public.students s ON s.tenant_id = e.tenant_id AND s.party_id = e.student_party_id
  JOIN public.party_parties p ON p.tenant_id = e.tenant_id AND p.id = e.student_party_id
  WHERE e.tenant_id = v_tenant
    AND e.course_id = p_course_id
    AND e.status = 'active'
    AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh');

  RETURN jsonb_build_object(
    'tenantId', v_tenant,
    'courseId', p_course_id,
    'schoolDay', p_school_day,
    'roster', v_roster
  );
END;
$roster_identity$;
-- Existing function EXECUTE ACL is preserved by CREATE OR REPLACE.

-- Source: supabase/migrations/20261026152000_harden_education_attendance_access.sql; normalized SHA256 a85d051fe618caac3ee89413acbce33a7909bba1fdcb9ce7632789e2589e9399
CREATE OR REPLACE FUNCTION public.edu_set_daily_attendance(
  p_tenant_id uuid, p_enrollment_id uuid, p_status text,
  p_roll_call_time timestamptz, p_school_day date
) RETURNS TABLE(
  id uuid, tenant_id uuid, enrollment_id uuid, school_day date, status text,
  event_id uuid, roll_call_time timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $attendance_command$
DECLARE
  v_event_id uuid;
  v_state public.edu_attendance_daily_state%ROWTYPE;
BEGIN
  IF current_setting('role', true) NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  -- A fresh authority read after a wait must observe committed revocation.
  -- Snapshot isolation is deliberately outside this proposed command contract.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'ATTENDANCE_READ_COMMITTED_REQUIRED' USING ERRCODE = '40001';
  END IF;
  IF p_tenant_id IS NULL OR p_enrollment_id IS NULL OR p_status IS NULL
    OR p_status NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE_STATUS' USING ERRCODE = '22023';
  END IF;
  IF p_roll_call_time IS NULL OR NOT isfinite(p_roll_call_time) THEN
    RAISE EXCEPTION 'ROLL_CALL_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_school_day IS NULL OR NOT isfinite(p_school_day) THEN
    RAISE EXCEPTION 'SCHOOL_DAY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF (p_roll_call_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <> p_school_day THEN
    RAISE EXCEPTION 'ATTENDANCE_DAY_MISMATCH' USING ERRCODE = '22023';
  END IF;

  -- Reject unauthorized callers before acquiring resource locks. Keep the
  -- post-wait authority checks below to observe committed revocation.
  IF NOT public.edu_can_access_attendance_enrollment(p_tenant_id, p_enrollment_id, p_school_day) THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'education-attendance:' || p_tenant_id::text || ':' || p_enrollment_id::text || ':' || p_school_day::text, 0));
  PERFORM 1 FROM public.edu_enrollments e
    WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id FOR SHARE;
  IF NOT FOUND THEN
    IF current_setting('role', true) = 'service_role' THEN
      RAISE EXCEPTION 'ATTENDANCE_ENROLLMENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.edu_attendance_daily_state s
    WHERE s.tenant_id = p_tenant_id AND s.enrollment_id = p_enrollment_id
      AND s.school_day = p_school_day FOR UPDATE;
  LOCK TABLE public.edu_attendance, public.edu_attendance_daily_state IN ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.tenants t WHERE t.id = p_tenant_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- VOLATILE predicate obtains current snapshots after the known write/FK waits.
  -- Service callers retain responsibility at the approved scoped command boundary.
  IF NOT public.edu_can_access_attendance_enrollment(p_tenant_id, p_enrollment_id, p_school_day) THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.edu_attendance(tenant_id, enrollment_id, status, roll_call_time)
    VALUES(p_tenant_id, p_enrollment_id, p_status, p_roll_call_time)
    RETURNING edu_attendance.id INTO v_event_id;
  INSERT INTO public.edu_attendance_daily_state(tenant_id, enrollment_id, school_day, status)
    VALUES(p_tenant_id, p_enrollment_id, p_school_day, p_status)
    ON CONFLICT ON CONSTRAINT edu_attendance_daily_state_unique
    DO UPDATE SET status = EXCLUDED.status, updated_at = now()
    RETURNING * INTO v_state;
  -- Recheck authenticated authority after an upsert wait as well. A privileged
  -- direct writer need not participate in the command's advisory lock.
  IF current_setting('role', true) = 'authenticated'
    AND NOT public.edu_can_access_attendance_enrollment(p_tenant_id, p_enrollment_id, p_school_day) THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT v_state.id, v_state.tenant_id, v_state.enrollment_id,
    v_state.school_day, v_state.status, v_event_id, p_roll_call_time,
    v_state.created_at, v_state.updated_at;
END;
$attendance_command$;
-- Existing function EXECUTE ACL is preserved by CREATE OR REPLACE.

-- Preserve existing policy name, role, command and permissive/restrictive mode.
ALTER POLICY roster_rpc_state_allow ON public.edu_attendance_daily_state
  USING (public.edu_can_access_attendance_enrollment(tenant_id,enrollment_id,school_day));
ALTER POLICY roster_rpc_state_guard ON public.edu_attendance_daily_state
  USING (public.edu_can_access_attendance_enrollment(tenant_id,enrollment_id,school_day));

-- Source-equivalent containment; no SELECT or service_role grant change.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.edu_attendance FROM PUBLIC,anon,authenticated;

DO $postflight$
DECLARE x record; oid_value oid;
BEGIN
  FOR x IN SELECT * FROM (VALUES
    ('public.edu_can_access_attendance_enrollment(uuid,uuid,date)','d320d997c656cb1af131ce23a343a0f8','{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.edu_preschool_roster_identity(uuid,date)','7eac33bda0e481d1d0693cd1b2f77546','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.edu_set_daily_attendance(uuid,uuid,text,timestamp with time zone,date)','0bd77a772ef098df2f09ba02bd58ec5e','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')
  ) e(signature,old_md5,expected_acl) LOOP
    oid_value:=to_regprocedure(x.signature);
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=oid_value
      AND pg_catalog.pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proacl::text=x.expected_acl) THEN
      RAISE EXCEPTION 'ATTENDANCE_EXISTING_FUNCTION_ACL_CHANGED: %',x.signature; END IF;
  END LOOP;
  IF NOT has_function_privilege('authenticated','public.preschool_teacher_attendance_courses(date,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.preschool_teacher_attendance_courses(date,uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.preschool_teacher_attendance_courses(date,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'ATTENDANCE_NEW_HELPER_ACL_INVALID'; END IF;
  FOR x IN SELECT * FROM (VALUES
    ('edu_attendance','anon',true,true,true,true,false,true,true),
    ('edu_attendance','authenticated',true,true,true,true,false,true,true),
    ('edu_attendance','service_role',true,true,true,true,true,true,true),
    ('edu_attendance_daily_state','anon',false,false,false,false,false,false,false),
    ('edu_attendance_daily_state','authenticated',true,false,false,false,false,false,false),
    ('edu_attendance_daily_state','service_role',true,true,true,true,true,true,true)
  ) e(relation_name,role_name,can_select,can_insert,can_update,can_delete,can_truncate,column_insert,column_update) LOOP
    IF has_table_privilege(x.role_name,'public.'||x.relation_name,'SELECT') IS DISTINCT FROM x.can_select THEN
      RAISE EXCEPTION 'ATTENDANCE_READ_PRIVILEGE_CHANGED'; END IF;
    IF x.role_name='service_role' THEN
      IF has_table_privilege(x.role_name,'public.'||x.relation_name,'INSERT') IS DISTINCT FROM x.can_insert
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'UPDATE') IS DISTINCT FROM x.can_update
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'DELETE') IS DISTINCT FROM x.can_delete
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'TRUNCATE') IS DISTINCT FROM x.can_truncate
        OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'INSERT') IS DISTINCT FROM x.column_insert
        OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'UPDATE') IS DISTINCT FROM x.column_update THEN
        RAISE EXCEPTION 'ATTENDANCE_WORKER_PRIVILEGE_CHANGED'; END IF;
    ELSE
      IF has_table_privilege(x.role_name,'public.'||x.relation_name,'INSERT')
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'UPDATE')
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'DELETE')
        OR has_table_privilege(x.role_name,'public.'||x.relation_name,'TRUNCATE')
        OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'INSERT')
        OR has_any_column_privilege(x.role_name,'public.'||x.relation_name,'UPDATE') THEN
        RAISE EXCEPTION 'ATTENDANCE_DIRECT_WRITE_PRIVILEGE_REMAINS'; END IF;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policy p
    WHERE p.polrelid='public.edu_attendance_daily_state'::regclass
      AND p.polname IN ('roster_rpc_state_allow','roster_rpc_state_guard')
      AND replace(pg_catalog.pg_get_expr(p.polqual,p.polrelid),'public.','')
        ='edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)')<>2 THEN
    RAISE EXCEPTION 'ATTENDANCE_STATE_PREDICATE_INVALID'; END IF;
END;
$postflight$;

-- Review/rehearsal candidate only. A separately reviewed cutover must decide COMMIT.
ROLLBACK;

