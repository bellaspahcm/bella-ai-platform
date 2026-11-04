DO $$
DECLARE
  v_party_registration_oid oid := to_regprocedure('public.party_register_or_recover(uuid,uuid,text,jsonb,text,text)');
  v_open_admission_oid oid := to_regprocedure('public.preschool_open_admission(uuid,uuid,uuid,jsonb)');
  v_open_admission_definition text;
  v_enrollment_oid oid := to_regprocedure('public.edu_preschool_enroll_student(uuid,uuid,uuid,uuid)');
  v_enrollment_guard_oid oid := to_regprocedure('public.edu_preschool_enrollment_single_active_class_guard()');
BEGIN
  IF to_regclass('public.party_registration_receipts') IS NULL
    OR to_regclass('public.preschool_admission_operations') IS NULL
    OR to_regclass('public.preschool_admission_student_code_seq') IS NULL
    OR v_party_registration_oid IS NULL OR v_open_admission_oid IS NULL THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_REQUIRED_OBJECT_MISSING';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.party_registration_receipts'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.preschool_admission_operations'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_RLS_NOT_ENABLED';
  END IF;

  IF has_table_privilege('anon','public.party_registration_receipts','SELECT')
    OR has_table_privilege('anon','public.party_registration_receipts','INSERT')
    OR has_table_privilege('anon','public.party_registration_receipts','UPDATE')
    OR has_table_privilege('anon','public.party_registration_receipts','DELETE')
    OR has_table_privilege('anon','public.party_registration_receipts','TRUNCATE')
    OR has_table_privilege('authenticated','public.party_registration_receipts','SELECT')
    OR has_table_privilege('authenticated','public.party_registration_receipts','INSERT')
    OR has_table_privilege('authenticated','public.party_registration_receipts','UPDATE')
    OR has_table_privilege('authenticated','public.party_registration_receipts','DELETE')
    OR has_table_privilege('authenticated','public.party_registration_receipts','TRUNCATE')
    OR NOT has_table_privilege('service_role','public.party_registration_receipts','SELECT') THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_PARTY_RECEIPT_ACL_INVALID';
  END IF;

  IF has_table_privilege('anon','public.preschool_admission_operations','SELECT')
    OR has_table_privilege('anon','public.preschool_admission_operations','INSERT')
    OR has_table_privilege('anon','public.preschool_admission_operations','UPDATE')
    OR has_table_privilege('anon','public.preschool_admission_operations','DELETE')
    OR has_table_privilege('anon','public.preschool_admission_operations','TRUNCATE')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','SELECT')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','INSERT')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','UPDATE')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','DELETE')
    OR has_table_privilege('authenticated','public.preschool_admission_operations','TRUNCATE')
    OR NOT has_table_privilege('service_role','public.preschool_admission_operations','SELECT')
    OR has_sequence_privilege('anon','public.preschool_admission_student_code_seq','USAGE')
    OR has_sequence_privilege('authenticated','public.preschool_admission_student_code_seq','USAGE') THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_OPERATION_ACL_INVALID';
  END IF;

  IF v_enrollment_oid IS NULL OR v_enrollment_guard_oid IS NULL
    OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_enrollment_oid)
    OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_enrollment_guard_oid)
    OR NOT has_function_privilege('authenticated',v_enrollment_oid,'EXECUTE')
    OR has_function_privilege('anon',v_enrollment_oid,'EXECUTE')
    OR has_function_privilege('service_role',v_enrollment_oid,'EXECUTE')
    OR has_function_privilege('anon',v_enrollment_guard_oid,'EXECUTE')
    OR has_function_privilege('authenticated',v_enrollment_guard_oid,'EXECUTE')
    OR has_function_privilege('service_role',v_enrollment_guard_oid,'EXECUTE')
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid=v_enrollment_oid
        AND p.proconfig @> ARRAY['search_path=pg_catalog','statement_timeout=10s','lock_timeout=5s']::text[]
        AND position('ENROLLMENT_ALREADY_IN_ANOTHER_CLASS' IN pg_get_functiondef(p.oid)) > 0
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid=v_enrollment_guard_oid
        AND p.proconfig @> ARRAY['search_path=pg_catalog','lock_timeout=5s']::text[]
        AND position('ENROLLMENT_ALREADY_IN_ANOTHER_CLASS' IN pg_get_functiondef(p.oid)) > 0
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid='public.edu_enrollments'::regclass
        AND t.tgfoid=v_enrollment_guard_oid AND NOT t.tgisinternal
        AND t.tgenabled IN ('O','A') AND pg_get_triggerdef(t.oid) LIKE '%BEFORE INSERT OR UPDATE%'
    ) THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_SINGLE_ACTIVE_CLASS_GUARD_INVALID';
  END IF;

  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_party_registration_oid)
    OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_open_admission_oid)
    OR has_function_privilege('anon',v_party_registration_oid,'EXECUTE')
    OR has_function_privilege('authenticated',v_party_registration_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',v_party_registration_oid,'EXECUTE')
    OR has_function_privilege('anon',v_open_admission_oid,'EXECUTE')
    OR has_function_privilege('authenticated',v_open_admission_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',v_open_admission_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_RPC_ACL_INVALID';
  END IF;

  SELECT pg_get_functiondef(v_open_admission_oid) INTO v_open_admission_definition;
  IF position('a.deleted_at IS NULL' IN v_open_admission_definition)=0
    OR position('a.banned_until' IN v_open_admission_definition)=0
    OR position('lower(u.role)' IN v_open_admission_definition)=0
    OR position('super_admin' IN v_open_admission_definition)=0 THEN
    RAISE EXCEPTION 'ADMISSION_PROFILE_CURRENT_ACTOR_CHECK_MISSING';
  END IF;

  RAISE NOTICE 'PRESCHOOL_ADMISSION_PROFILE_SCHEMA_ACL_RLS_PASS';
END;
$$;

SELECT 'PRESCHOOL_ADMISSION_PROFILE_SCHEMA_ACL_RLS_PASS';
