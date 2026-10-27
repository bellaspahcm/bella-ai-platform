\set ON_ERROR_STOP on
DO $$
DECLARE
  v_count integer;
  v_local smallint;
  v_remote smallint;
BEGIN
  IF to_regclass('public.courses') IS NULL OR to_regclass('public.edu_courses') IS NULL
    OR to_regclass('public.students') IS NULL OR to_regclass('public.teacher_assignments') IS NULL
    OR to_regclass('public.preschool_teacher_branch_confirmations') IS NULL
    OR to_regclass('public.party_auth_links') IS NULL
    OR to_regclass('public.party_identity_link_managers') IS NULL
    OR to_regclass('public.preschool_admission_operations') IS NULL
    OR to_regclass('public.edu_attendance') IS NULL
    OR to_regclass('public.edu_attendance_daily_state') IS NULL
    OR to_regclass('public.preschool_chain_course_branch_assignments') IS NULL
    OR to_regclass('public.preschool_chain_enrollment_branch_assignments') IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_REQUIRED_RELATION_MISSING';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.courses'::regclass
       AND attname='course_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped)
    OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.courses'::regclass
       AND attname='id' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.edu_courses'::regclass
       AND attname='id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_COURSE_IDENTITY_PROFILE_MISMATCH';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.students'::regclass
       AND attname='party_id' AND atttypid='uuid'::regtype AND NOT attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_constraint c
       WHERE c.conrelid='public.students'::regclass AND c.confrelid='public.party_parties'::regclass
         AND c.conname='students_party_id_fkey' AND c.contype='f' AND c.confdeltype='r' AND c.convalidated)
    OR to_regclass('public.idx_students_party_id') IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_STUDENT_PARTY_PROJECTION_MISMATCH';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.edu_enrollments'::regclass
       AND attname='request_id' AND atttypid='text'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.edu_enrollments'::regclass
       AND conname='uq_edu_enrollments_request_id' AND contype='u') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ENROLLMENT_REQUEST_ID_CONTRACT_MISMATCH';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM pg_type t
       JOIN pg_namespace n ON n.oid=t.typnamespace
       JOIN pg_enum e ON e.enumtypid=t.oid
       WHERE n.nspname='public' AND t.typname='platform_rule_domain'
         AND e.enumlabel='education.enrollment'
     ) OR to_regclass('public.platform_business_rules') IS NOT NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_RULE_DOMAIN_PROJECTION_MISMATCH';
  END IF;

  SELECT attnum INTO v_local FROM pg_attribute WHERE attrelid='public.teacher_assignments'::regclass
    AND attname='course_id' AND NOT attisdropped;
  SELECT attnum INTO v_remote FROM pg_attribute WHERE attrelid='public.courses'::regclass
    AND attname='course_id' AND NOT attisdropped;
  IF v_local IS NULL OR v_remote IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.teacher_assignments'::regclass
      AND c.confrelid='public.courses'::regclass AND c.contype='f'
      AND c.conkey=ARRAY[v_local] AND c.confkey=ARRAY[v_remote] AND c.convalidated
  ) THEN RAISE EXCEPTION 'PRESCHOOL_PROFILE_LEGACY_TEACHER_FK_MISMATCH'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.teacher_assignments'::regclass
       AND attname='canonical_course_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.teacher_assignments'::regclass
       AND attname='canonical_teacher_confirmation_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.teacher_assignments'::regclass
       AND conname='teacher_assignments_one_course_identity' AND contype='c')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.teacher_assignments'::regclass
       AND conname='teacher_assignments_canonical_confirmation_required' AND contype='c')
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.teacher_assignments'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.teacher_assignments'::regclass
       AND polname='teacher_assignments_canonical_private' AND polpermissive IS FALSE) THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_CANONICAL_TEACHER_SCHEMA_MISMATCH';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.edu_attendance_daily_state'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.edu_attendance_daily_state'::regclass
       AND polname='edu_attendance_daily_state_tenant_isolation')
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.edu_attendance_daily_state'::regclass
       AND polname='roster_rpc_state_allow')
    OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.edu_attendance_daily_state'::regclass
       AND polname='roster_rpc_state_guard') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ATTENDANCE_STATE_RLS_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policy p
  WHERE p.polrelid='public.edu_attendance_daily_state'::regclass
    AND p.polname IN ('roster_rpc_state_allow','roster_rpc_state_guard')
    AND pg_get_expr(p.polqual,p.polrelid) LIKE '%edu_can_access_attendance_enrollment%'
    AND pg_get_expr(p.polqual,p.polrelid) NOT LIKE '%tenants%';
  IF v_count<>2 THEN RAISE EXCEPTION 'PRESCHOOL_PROFILE_ATTENDANCE_RLS_HELPER_CONTRACT_MISMATCH'; END IF;

  IF has_table_privilege('anon','public.edu_attendance','INSERT')
    OR has_table_privilege('anon','public.edu_attendance','UPDATE')
    OR has_table_privilege('anon','public.edu_attendance','DELETE')
    OR has_table_privilege('anon','public.edu_attendance','TRUNCATE')
    OR has_table_privilege('authenticated','public.edu_attendance','INSERT')
    OR has_table_privilege('authenticated','public.edu_attendance','UPDATE')
    OR has_table_privilege('authenticated','public.edu_attendance','DELETE')
    OR has_table_privilege('authenticated','public.edu_attendance','TRUNCATE')
    OR has_table_privilege('anon','public.edu_attendance_daily_state','INSERT')
    OR has_table_privilege('anon','public.edu_attendance_daily_state','UPDATE')
    OR has_table_privilege('anon','public.edu_attendance_daily_state','DELETE')
    OR has_table_privilege('anon','public.edu_attendance_daily_state','TRUNCATE')
    OR has_table_privilege('authenticated','public.edu_attendance_daily_state','INSERT')
    OR has_table_privilege('authenticated','public.edu_attendance_daily_state','UPDATE')
    OR has_table_privilege('authenticated','public.edu_attendance_daily_state','DELETE')
    OR has_table_privilege('authenticated','public.edu_attendance_daily_state','TRUNCATE') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ATTENDANCE_DIRECT_WRITE_ACL_MISMATCH';
  END IF;

  IF NOT has_table_privilege('authenticated','public.edu_attendance_daily_state','SELECT') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ATTENDANCE_READ_ACL_MISSING';
  END IF;

  IF NOT has_table_privilege('service_role','public.tenants','SELECT')
    OR has_table_privilege('authenticated','public.tenants','SELECT')
    OR has_table_privilege('authenticated','public.users','SELECT') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_TRUSTED_TENANT_READ_ACL_MISMATCH';
  END IF;

  IF to_regprocedure('public.platform_current_actor_tenant_presentation()') IS NULL
    OR NOT has_function_privilege('authenticated','public.platform_current_actor_tenant_presentation()','EXECUTE')
    OR has_function_privilege('anon','public.platform_current_actor_tenant_presentation()','EXECUTE')
    OR has_function_privilege('service_role','public.platform_current_actor_tenant_presentation()','EXECUTE')
    OR NOT has_table_privilege('service_role','public.tenants','SELECT')
    OR has_table_privilege('authenticated','public.tenants','SELECT') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ACTOR_TENANT_PRESENTATION_ACL_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.platform_current_actor_tenant_presentation()'::regprocedure
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND p.proargnames = ARRAY['tenant_id','tenant_status','name','product_key','enabled_modules','brand_theme','logo_url']::text[]
      AND pg_get_function_result(p.oid) = 'TABLE(tenant_id uuid, tenant_status text, name text, product_key text, enabled_modules jsonb, brand_theme jsonb, logo_url text)'
      AND pg_get_functiondef(p.oid) LIKE '%WHERE a.id = auth.uid()%'
      AND pg_get_functiondef(p.oid) NOT LIKE '%p_tenant_id%'
  ) THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ACTOR_TENANT_PRESENTATION_SCOPE_MISMATCH';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.tenants'::regclass AND attname='product_key' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.tenants'::regclass AND attname='enabled_modules' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.tenants'::regclass AND attname='brand_theme' AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.tenants'::regclass AND attname='logo_url' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_TENANT_PRESENTATION_COLUMNS_MISSING';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.preschool_admission_operations'::regclass AND relrowsecurity)
    OR has_table_privilege('authenticated','public.preschool_admission_operations','SELECT')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','INSERT')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','UPDATE')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','DELETE')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','TRUNCATE')
    OR NOT has_table_privilege('service_role','public.preschool_admission_operations','SELECT')
    OR has_sequence_privilege('authenticated','public.preschool_admission_student_code_seq','USAGE')
    OR has_sequence_privilege('authenticated','public.preschool_admission_student_code_seq','SELECT') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_ADMISSION_OPERATION_ACL_MISMATCH';
  END IF;

  IF to_regprocedure('public.party_confirm_auth_link(uuid,uuid,uuid,timestamptz,timestamptz,text)') IS NULL
    OR to_regprocedure('public.party_revoke_auth_link(uuid,text)') IS NULL
    OR to_regprocedure('public.party_resolve_current_auth_link()') IS NULL
    OR to_regprocedure('public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)') IS NULL
    OR to_regprocedure('public.preschool_teacher_attendance_courses(date,uuid)') IS NULL
    OR to_regprocedure('public.edu_can_access_attendance_enrollment(uuid,uuid,date)') IS NULL
    OR to_regprocedure('public.edu_preschool_roster_identity(uuid,date)') IS NULL
    OR to_regprocedure('public.edu_set_daily_attendance(uuid,uuid,text,timestamp with time zone,date)') IS NULL
    OR to_regprocedure('public.platform_assert_active_branch_for_actor(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_REQUIRED_RPC_MISSING';
  END IF;

  IF NOT has_function_privilege('authenticated','public.party_confirm_auth_link(uuid,uuid,uuid,timestamptz,timestamptz,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.party_revoke_auth_link(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.party_resolve_current_auth_link()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.preschool_teacher_attendance_courses(date,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.edu_preschool_roster_identity(uuid,date)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.edu_can_access_attendance_enrollment(uuid,uuid,date)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.edu_set_daily_attendance(uuid,uuid,text,timestamp with time zone,date)','EXECUTE')
    OR has_function_privilege('authenticated','public.platform_assert_active_branch_for_actor(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_RPC_ACL_MISMATCH';
  END IF;

  IF has_function_privilege('authenticated','public.preschool_assign_chain(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.preschool_assign_chain(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.preschool_branch_access(uuid,uuid,uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.preschool_branch_access(uuid,uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'PRESCHOOL_PROFILE_CHAIN_ASSIGNMENT_RPC_ACL_MISMATCH';
  END IF;

  SELECT count(*) INTO v_count FROM public.students;
  IF v_count <> 0 THEN RAISE EXCEPTION 'PRESCHOOL_PROFILE_MUST_NOT_IMPORT_STUDENT_ROWS'; END IF;
  IF to_regclass('public.identity_migration_mapping') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.identity_migration_mapping' INTO v_count;
    IF v_count <> 0 THEN RAISE EXCEPTION 'PRESCHOOL_PROFILE_MUST_NOT_CREATE_IDENTITY_MAPPINGS'; END IF;
  END IF;
END $$;

SELECT 'PRESCHOOL_PROFILE_SCHEMA_ACL_RLS_PASS' AS result;
