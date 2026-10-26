-- Chạy chỉ trên E2E đã duyệt. Mọi fixture và thay đổi policy nằm trong một
-- transaction và được ROLLBACK; không đọc hoặc sửa hồ sơ nghiệp vụ có sẵn.
SELECT set_config('audit.original_allow_policy', EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'edu_attendance_daily_state' AND policyname = 'roster_rpc_state_allow'
)::text, false);
SELECT set_config('audit.original_guard_policy', EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'edu_attendance_daily_state' AND policyname = 'roster_rpc_state_guard'
)::text, false);
SELECT set_config('audit.original_legacy_policy', EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'edu_attendance_daily_state' AND policyname = 'edu_attendance_daily_state_branch_scope'
)::text, false);
SELECT set_config('audit.original_authenticated_select', has_table_privilege(
  'authenticated', 'public.edu_attendance_daily_state', 'SELECT'
)::text, false);
BEGIN;
SAVEPOINT attendance_rls_rehearsal;

DO $fixtures$
DECLARE
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_actor_c uuid := gen_random_uuid();
  v_person_a uuid := gen_random_uuid();
  v_person_b uuid := gen_random_uuid();
  v_person_c uuid := gen_random_uuid();
  v_branch_a uuid := gen_random_uuid();
  v_branch_b uuid := gen_random_uuid();
  v_branch_c uuid := gen_random_uuid();
  v_course_a uuid := gen_random_uuid();
  v_course_b uuid := gen_random_uuid();
  v_course_c uuid := gen_random_uuid();
  v_course_d uuid := gen_random_uuid();
  v_party_a uuid := gen_random_uuid();
  v_party_b uuid := gen_random_uuid();
  v_party_c uuid := gen_random_uuid();
  v_party_d uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();
  v_student_c uuid := gen_random_uuid();
  v_enrollment_a uuid := gen_random_uuid();
  v_enrollment_b uuid := gen_random_uuid();
  v_enrollment_c uuid := gen_random_uuid();
  v_enrollment_d uuid := gen_random_uuid();
  v_day date := (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  PERFORM set_config('audit.tenant_a', v_tenant_a::text, true);
  PERFORM set_config('audit.tenant_b', v_tenant_b::text, true);
  PERFORM set_config('audit.actor_a', v_actor_a::text, true);
  PERFORM set_config('audit.actor_b', v_actor_b::text, true);
  PERFORM set_config('audit.actor_c', v_actor_c::text, true);
  PERFORM set_config('audit.branch_a', v_branch_a::text, true);
  PERFORM set_config('audit.branch_b', v_branch_b::text, true);
  PERFORM set_config('audit.branch_c', v_branch_c::text, true);
  PERFORM set_config('audit.course_a', v_course_a::text, true);
  PERFORM set_config('audit.course_b', v_course_b::text, true);
  PERFORM set_config('audit.course_c', v_course_c::text, true);
  PERFORM set_config('audit.course_d', v_course_d::text, true);
  PERFORM set_config('audit.enrollment_a', v_enrollment_a::text, true);
  PERFORM set_config('audit.enrollment_b', v_enrollment_b::text, true);
  PERFORM set_config('audit.enrollment_c', v_enrollment_c::text, true);
  PERFORM set_config('audit.school_day', v_day::text, true);

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES
    (v_actor_a, 'authenticated', 'authenticated', 'audit-a-' || v_actor_a || '@example.invalid', '', clock_timestamp()),
    (v_actor_b, 'authenticated', 'authenticated', 'audit-b-' || v_actor_b || '@example.invalid', '', clock_timestamp()),
    (v_actor_c, 'authenticated', 'authenticated', 'audit-c-' || v_actor_c || '@example.invalid', '', clock_timestamp());
  INSERT INTO public.tenants (id, name, status, product_key)
  VALUES
    (v_tenant_a, 'Synthetic Attendance Audit A', 'active', 'bella_preschool'),
    (v_tenant_b, 'Synthetic Attendance Audit B', 'active', 'bella_preschool');
  INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
  VALUES
    (v_actor_a, 'profile-a-' || v_actor_a || '@example.invalid', 'Synthetic Admin A', 'admin', 'active', v_tenant_a),
    (v_actor_b, 'profile-b-' || v_actor_b || '@example.invalid', 'Synthetic Admin B', 'admin', 'active', v_tenant_b),
    (v_actor_c, 'profile-c-' || v_actor_c || '@example.invalid', 'Synthetic Staff C', 'admin_staff', 'active', v_tenant_a);
  INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
  VALUES
    (v_branch_a, v_tenant_a, 'branch', 'Synthetic Branch A', 'audit-a-' || v_branch_a, true, '{}'),
    (v_branch_b, v_tenant_a, 'branch', 'Synthetic Branch B', 'audit-b-' || v_branch_b, true, '{}'),
    (v_branch_c, v_tenant_b, 'branch', 'Synthetic Branch C', 'audit-c-' || v_branch_c, true, '{}');
  INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active)
  VALUES
    (v_person_a, v_tenant_a, v_actor_a, 'employee', 'Synthetic Admin A', true),
    (v_person_b, v_tenant_b, v_actor_b, 'employee', 'Synthetic Admin B', true),
    (v_person_c, v_tenant_a, v_actor_c, 'employee', 'Synthetic Staff C', true);
  INSERT INTO public.org_relationships (tenant_id, from_id, from_type, to_id, to_type, rel_type, since)
  VALUES
    (v_tenant_a, v_person_a, 'person', v_branch_a, 'unit', 'manages', CURRENT_DATE),
    (v_tenant_b, v_person_b, 'person', v_branch_c, 'unit', 'manages', CURRENT_DATE),
    (v_tenant_a, v_person_c, 'person', v_branch_a, 'unit', 'manages', CURRENT_DATE);
  INSERT INTO public.edu_courses (id, tenant_id, course_code, title, status, max_students, current_enrollment)
  VALUES
    (v_course_a, v_tenant_a, 'AUDIT-A-' || v_course_a, 'Synthetic Class A', 'active', 10, 1),
    (v_course_b, v_tenant_a, 'AUDIT-B-' || v_course_b, 'Synthetic Class B', 'active', 10, 1),
    (v_course_c, v_tenant_b, 'AUDIT-C-' || v_course_c, 'Synthetic Class C', 'active', 10, 1),
    (v_course_d, v_tenant_a, 'AUDIT-D-' || v_course_d, 'Synthetic Class D', 'active', 10, 1);
  INSERT INTO public.preschool_chain_course_branch_assignments (tenant_id, course_id, branch_id, assigned_by)
  VALUES
    (v_tenant_a, v_course_a, v_branch_a, v_actor_a),
    (v_tenant_a, v_course_b, v_branch_b, v_actor_a),
    (v_tenant_b, v_course_c, v_branch_c, v_actor_b),
    (v_tenant_a, v_course_d, v_branch_a, v_actor_a);
  INSERT INTO public.party_parties (id, tenant_id, party_type, display_name)
  VALUES
    (v_party_a, v_tenant_a, 'person', 'Synthetic Student A'),
    (v_party_b, v_tenant_a, 'person', 'Synthetic Student B'),
    (v_party_c, v_tenant_b, 'person', 'Synthetic Student C'),
    (v_party_d, v_tenant_a, 'person', 'Synthetic Student D without a Student profile');
  INSERT INTO public.students (tenant_id, student_id, party_id, student_code, academic_status, enrollment_type, program_id, enrollment_date)
  VALUES
    (v_tenant_a, v_student_a, v_party_a, 'AUDIT-A', 'enrolled', 'full_time', 'primary', CURRENT_DATE),
    (v_tenant_a, v_student_b, v_party_b, 'AUDIT-B', 'enrolled', 'full_time', 'primary', CURRENT_DATE),
    (v_tenant_b, v_student_c, v_party_c, 'AUDIT-C', 'enrolled', 'full_time', 'primary', CURRENT_DATE);
  INSERT INTO public.edu_enrollments (id, tenant_id, student_party_id, course_id, status, enrolled_at, request_id)
  VALUES
    (v_enrollment_a, v_tenant_a, v_party_a, v_course_a, 'active', clock_timestamp(), 'audit-' || v_enrollment_a),
    (v_enrollment_b, v_tenant_a, v_party_b, v_course_b, 'active', clock_timestamp(), 'audit-' || v_enrollment_b),
    (v_enrollment_c, v_tenant_b, v_party_c, v_course_c, 'active', clock_timestamp(), 'audit-' || v_enrollment_c),
    (v_enrollment_d, v_tenant_a, v_party_d, v_course_d, 'active', clock_timestamp(), 'audit-' || v_enrollment_d);
  INSERT INTO public.edu_attendance_daily_state (tenant_id, enrollment_id, school_day, status)
  VALUES
    (v_tenant_a, v_enrollment_a, v_day, 'present'),
    (v_tenant_a, v_enrollment_b, v_day, 'absent'),
    (v_tenant_b, v_enrollment_c, v_day, 'excused');
END;
$fixtures$;

-- Exercise the migration's exact table ACL and both RLS policies; rollback restores state.
GRANT SELECT ON TABLE public.edu_attendance_daily_state TO authenticated;
DROP POLICY IF EXISTS edu_attendance_daily_state_branch_scope ON public.edu_attendance_daily_state;
DROP POLICY IF EXISTS roster_rpc_state_allow ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_allow
  ON public.edu_attendance_daily_state
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT t.product_key FROM public.tenants t WHERE t.id = edu_attendance_daily_state.tenant_id) = 'bella_preschool'
    AND public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)
  );
DROP POLICY IF EXISTS roster_rpc_state_guard ON public.edu_attendance_daily_state;
CREATE POLICY roster_rpc_state_guard
  ON public.edu_attendance_daily_state
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = edu_attendance_daily_state.tenant_id
        AND t.product_key IS DISTINCT FROM 'bella_preschool'
    )
    OR public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)
  );

DO $rpc_acl$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.edu_preschool_roster_identity(uuid,date)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.edu_preschool_roster_identity(uuid,date)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.edu_can_access_attendance_enrollment(uuid,uuid,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'roster/access RPC execution ACL is not restricted to authenticated users';
  END IF;
END;
$rpc_acl$;

SET LOCAL ROLE authenticated;
DO $assertions$
DECLARE
  v_tenant_a uuid := current_setting('audit.tenant_a')::uuid;
  v_tenant_b uuid := current_setting('audit.tenant_b')::uuid;
  v_day date := current_setting('audit.school_day')::date;
  v_count integer;
  v_roster jsonb;
  v_identity_gap_rejected boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', current_setting('audit.actor_a'), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('audit.actor_a'), 'role', 'authenticated')::text, true);
  -- A mismatched legacy tenant GUC must neither hide A's authorized branch nor
  -- expose tenant B through the old permissive tenant policy.
  PERFORM set_config('app.current_tenant_id', current_setting('audit.tenant_b'), true);
  SELECT count(*) INTO v_count FROM public.edu_attendance_daily_state WHERE tenant_id = v_tenant_a;
  IF v_count <> 1 THEN RAISE EXCEPTION 'actor A branch scope expected 1 row, got %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.edu_attendance_daily_state WHERE tenant_id = v_tenant_b;
  IF v_count <> 0 THEN RAISE EXCEPTION 'actor A read % rows from another tenant through legacy allow-policy', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.user_org_unit_access
    WHERE user_id = current_setting('audit.actor_a')::uuid AND org_unit_id = current_setting('audit.branch_a')::uuid
      AND relationship_id IS NOT NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'actor A canonical branch relationship expected 1 row, got %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.user_org_unit_access
    WHERE user_id = current_setting('audit.actor_a')::uuid AND org_unit_id = current_setting('audit.branch_b')::uuid
      AND relationship_id IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'actor A had an unexpected branch B relationship'; END IF;
  IF NOT public.edu_can_access_attendance_enrollment(v_tenant_a, current_setting('audit.enrollment_a')::uuid, v_day)
    THEN RAISE EXCEPTION 'actor A own branch was denied'; END IF;
  IF public.edu_can_access_attendance_enrollment(v_tenant_a, current_setting('audit.enrollment_b')::uuid, v_day)
    THEN RAISE EXCEPTION 'actor A could access another branch'; END IF;
  IF public.edu_can_access_attendance_enrollment(v_tenant_b, current_setting('audit.enrollment_c')::uuid, v_day)
    THEN RAISE EXCEPTION 'actor A could access another tenant'; END IF;
  v_roster := public.edu_preschool_roster_identity(current_setting('audit.course_a')::uuid, v_day);
  IF jsonb_array_length(v_roster->'roster') <> 1 THEN RAISE EXCEPTION 'actor A roster identity did not resolve'; END IF;
  IF (v_roster->>'tenantId')::uuid <> v_tenant_a
    OR (v_roster->>'courseId')::uuid <> current_setting('audit.course_a')::uuid
    OR v_roster->>'schoolDay' <> v_day::text
    OR NOT ((v_roster->'roster'->0) ?& ARRAY['enrollmentId','studentId','studentPartyId','studentCode','name','gender','dob','enrollmentStatus'])
    OR v_roster->'roster'->0->>'enrollmentStatus' <> 'active' THEN
    RAISE EXCEPTION 'roster RPC did not return the canonical contract shape';
  END IF;
  BEGIN
    PERFORM public.edu_preschool_roster_identity(current_setting('audit.course_d')::uuid, v_day);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_identity_gap_rejected := true;
  END;
  IF NOT v_identity_gap_rejected THEN
    RAISE EXCEPTION 'roster identity gap was not rejected with unavailable-data status';
  END IF;
  BEGIN
    PERFORM public.edu_preschool_roster_identity(current_setting('audit.course_b')::uuid, v_day);
    RAISE EXCEPTION 'actor A accessed another branch roster';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', current_setting('audit.actor_b'), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('audit.actor_b'), 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.edu_attendance_daily_state WHERE tenant_id = v_tenant_b;
  IF v_count <> 1 THEN RAISE EXCEPTION 'actor B own tenant/branch expected 1 row, got %', v_count; END IF;

  PERFORM set_config('request.jwt.claim.sub', current_setting('audit.actor_c'), true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('audit.actor_c'), 'role', 'authenticated')::text, true);
  IF public.edu_can_access_attendance_enrollment(v_tenant_a, current_setting('audit.enrollment_a')::uuid, v_day)
    THEN RAISE EXCEPTION 'admin_staff attendance access was allowed'; END IF;
  SELECT count(*) INTO v_count FROM public.edu_attendance_daily_state WHERE tenant_id = v_tenant_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'admin_staff saw % rows', v_count; END IF;
  IF has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'INSERT')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'DELETE')
    THEN RAISE EXCEPTION 'authenticated has direct write access'; END IF;
END;
$assertions$;

SET LOCAL ROLE anon;
DO $anonymous$
BEGIN
  BEGIN
    PERFORM 1 FROM public.edu_attendance_daily_state LIMIT 1;
    RAISE EXCEPTION 'anonymous SELECT unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anonymous$;

RESET ROLE;
ROLLBACK TO SAVEPOINT attendance_rls_rehearsal;

SELECT json_build_object(
  'policy_state_restored_after_rollback',
    (EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'edu_attendance_daily_state' AND policyname = 'roster_rpc_state_allow'))
      = current_setting('audit.original_allow_policy')::boolean
    AND (EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'edu_attendance_daily_state' AND policyname = 'roster_rpc_state_guard'))
      = current_setting('audit.original_guard_policy')::boolean
    AND (EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'edu_attendance_daily_state' AND policyname = 'edu_attendance_daily_state_branch_scope'))
      = current_setting('audit.original_legacy_policy')::boolean,
  'authenticated_select_acl_restored_after_rollback',
    has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'SELECT')
      = current_setting('audit.original_authenticated_select')::boolean
);

ROLLBACK;
SELECT 'RLS_ASSERTIONS_PASS_AND_TRANSACTION_ROLLED_BACK' AS result;
