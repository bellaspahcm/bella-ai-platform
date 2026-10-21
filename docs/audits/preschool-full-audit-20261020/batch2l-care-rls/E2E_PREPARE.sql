-- REVIEW CANDIDATE: requires independent owner scope before execution.
-- BELLA_CARE_E2E_MANIFEST: {"projectRef":"bmnbqbcdbuklhopfbopv","existingRelations":["edu_courses","edu_enrollments","party_parties"],"newRelations":["edu_attendance_daily_state","edu_daily_care_sessions","edu_daily_care_records"],"policies":{"edu_courses":["e2e_care_course_select_allow","e2e_care_course_select_guard"],"edu_enrollments":["e2e_care_enrollment_select_allow","e2e_care_enrollment_select_guard"],"party_parties":["e2e_care_party_select_allow","e2e_care_party_select_guard"]}}
-- E2E-only experiment, never a Production migration or historical migration replay.
-- Target: bmnbqbcdbuklhopfbopv; baseline: 4a7a855e3472dcfd86649b18f27671ccbe7188a1.
-- The executor MUST bind API URL, DB host/user/project and source bytes to that
-- target before connecting. The wrapper GUC below is an assertion, not identity
-- proof or owner approval. The executor owns BEGIN / COMMIT / ROLLBACK and must
-- snapshot/recover preexisting ACLs/policies independently. No transaction is
-- committed here. HTTP/PostgREST proof requires separately approved committed
-- visibility; rollback-only rehearsal is not HTTP acceptance.
--
-- Mutation allowlist (exactly six public relations):
--   Existing: edu_courses, edu_enrollments, party_parties -- SELECT ACL + two
--   experiment SELECT policies each; original policies are retained unchanged.
--   New: edu_daily_care_sessions, edu_daily_care_records,
--   edu_attendance_daily_state -- existing schema definitions + scoped policies.
-- Read dependencies only: users, tenants, org_units, user_org_unit_access,
-- preschool_chain_course_branch_assignments, students, get_auth_tenant_id/auth.uid.
-- No parent digests, helpers/functions, RPCs, migration-history rows, business
-- DML/backfill, schema grants, default-ACL changes, membership or role changes.
--
-- Schema sources (final existing shape, not new business semantics):
-- 20260909000052_p42_daily_care_operations.sql:11-37 (session/record definitions).
-- 20260927040000_preschool_daily_care_canonical_student_party.sql:14-28
--   (nullable legacy student_id, Party FK and indexes; retain both identities).
-- 20260926003000_education_daily_attendance_state.sql:4-22 (table/indexes only).
-- Matrix: docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md:19-55.
-- Fresh preflight.json proves students.student_id + students_student_id_unique.
-- Do not run the destructive historical students migration or enrollment RPC
-- migration/backfill merely to make this experiment executable.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $care_e2e_prepare$
DECLARE
  target_name text;
  policy_target record;
  column_name text;
  shared_policies_before jsonb;
  shared_policies_after jsonb;
  service_acl_before jsonb;
  service_acl_after jsonb;
  service_effective_before jsonb;
  service_effective_after jsonb;
  shared_tables constant text[] := ARRAY[
    'edu_courses', 'edu_enrollments', 'party_parties'
  ];
  new_tables constant text[] := ARRAY[
    'edu_daily_care_sessions', 'edu_daily_care_records', 'edu_attendance_daily_state'
  ];
  shared_policy_names constant text[] := ARRAY[
    'e2e_care_course_select_allow', 'e2e_care_course_select_guard',
    'e2e_care_enrollment_select_allow', 'e2e_care_enrollment_select_guard',
    'e2e_care_party_select_allow', 'e2e_care_party_select_guard'
  ];
  record_insert_columns constant text[] := ARRAY[
    'tenant_id', 'session_id', 'student_party_id', 'arrival_status', 'arrival_time',
    'morning_condition', 'meal_records', 'hygiene_records', 'nap_records', 'updated_at'
  ];
  record_update_columns constant text[] := ARRAY[
    'arrival_status', 'arrival_time', 'morning_condition', 'meal_records',
    'hygiene_records', 'nap_records', 'updated_at'
  ];
  today_expression constant text :=
    $today$(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date$today$;
  -- This template is expanded only while preparing fixed policy DDL. It does
  -- not create a callable helper, privileged reader, view, or DEFINER function.
  actor_template constant text := $actor$
    %1$s.tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.users actor_profile
      JOIN public.tenants actor_tenant ON actor_tenant.id = actor_profile.tenant_id
      WHERE actor_profile.id = auth.uid()
        AND actor_profile.tenant_id = %1$s.tenant_id
        AND actor_profile.status = 'active'
        AND lower(btrim(actor_profile.role)) = 'admin'
        AND actor_tenant.status = 'active'
        AND actor_tenant.product_key = 'bella_preschool'
    )
  $actor$;
  course_scope text;
  enrollment_scope text;
  party_scope text;
  session_scope text;
  record_scope text;
  attendance_scope text;
BEGIN
  IF current_setting('app.bella_e2e_project_ref', true)
       IS DISTINCT FROM 'bmnbqbcdbuklhopfbopv' THEN
    RAISE EXCEPTION 'CARE_E2E_TARGET_WRAPPER_ASSERTION_REQUIRED';
  END IF;

  -- Abort on source-baseline drift rather than adapting schema or controls.
  FOREACH target_name IN ARRAY new_tables LOOP
    IF to_regclass(format('public.%I', target_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'CARE_E2E_NEW_RELATION_ALREADY_EXISTS: %', target_name;
    END IF;
  END LOOP;
  FOREACH target_name IN ARRAY ARRAY[
    'edu_courses', 'edu_enrollments', 'party_parties', 'students', 'users',
    'tenants', 'org_units', 'user_org_unit_access',
    'preschool_chain_course_branch_assignments'
  ] LOOP
    IF to_regclass(format('public.%I', target_name)) IS NULL THEN
      RAISE EXCEPTION 'CARE_E2E_READ_DEPENDENCY_MISSING: %', target_name;
    END IF;
  END LOOP;
  IF to_regprocedure('public.get_auth_tenant_id()') IS NULL
      OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'CARE_E2E_EXISTING_AUTH_HELPER_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN ('anon', 'authenticated') AND (rolsuper OR rolbypassrls)
  ) OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) <> 2 THEN
    RAISE EXCEPTION 'CARE_E2E_CLIENT_ROLE_BASELINE_UNSAFE';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index student_index
    JOIN pg_class student_table ON student_table.oid = student_index.indrelid
    JOIN pg_namespace student_schema ON student_schema.oid = student_table.relnamespace
    JOIN pg_attribute student_column ON student_column.attrelid = student_table.oid
      AND student_column.attname = 'student_id' AND NOT student_column.attisdropped
    WHERE student_schema.nspname = 'public' AND student_table.relname = 'students'
      AND student_column.atttypid = 'uuid'::regtype
      AND student_index.indisunique AND student_index.indisvalid
      AND student_index.indisready AND student_index.indpred IS NULL
      AND student_index.indexprs IS NULL AND student_index.indnkeyatts = 1
      AND student_index.indkey[0] = student_column.attnum
  ) THEN
    RAISE EXCEPTION 'CARE_E2E_LEGACY_STUDENT_UNIQUE_REFERENCE_NOT_PROVEN';
  END IF;

  -- Lock only the three existing mutation targets; no data is changed.
  LOCK TABLE public.edu_courses, public.edu_enrollments, public.party_parties
    IN SHARE ROW EXCLUSIVE MODE;
  FOREACH target_name IN ARRAY shared_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class relation
      WHERE relation.oid = to_regclass(format('public.%I', target_name))
        AND relation.relkind = 'r' AND relation.relrowsecurity
        AND NOT relation.relforcerowsecurity
        AND relation.relacl::text =
          '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
    ) OR has_table_privilege('authenticated', format('public.%I', target_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('authenticated', format('public.%I', target_name),
        'SELECT,INSERT,UPDATE,REFERENCES')
      OR has_table_privilege('anon', format('public.%I', target_name),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege('anon', format('public.%I', target_name),
        'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'CARE_E2E_SHARED_ACL_BASELINE_CHANGED: %', target_name;
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'tablename', tablename, 'policyname', policyname, 'permissive', permissive,
    'roles', roles::text, 'cmd', cmd, 'qual', qual, 'with_check', with_check
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  INTO shared_policies_before
  FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(shared_tables);
  IF shared_policies_before IS DISTINCT FROM $baseline$[
    {"tablename":"edu_courses","policyname":"edu_courses_tenant_isolation",
     "permissive":"PERMISSIVE","roles":"{public}","cmd":"ALL",
     "qual":"(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)","with_check":null},
    {"tablename":"edu_enrollments","policyname":"edu_enrollments_tenant_isolation",
     "permissive":"PERMISSIVE","roles":"{public}","cmd":"ALL",
     "qual":"(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)","with_check":null},
    {"tablename":"party_parties","policyname":"tenant_isolation_parties",
     "permissive":"PERMISSIVE","roles":"{public}","cmd":"ALL",
     "qual":"(tenant_id = get_auth_tenant_id())","with_check":null}
  ]$baseline$::jsonb THEN
    RAISE EXCEPTION 'CARE_E2E_SHARED_POLICY_BASELINE_CHANGED';
  END IF;

  -- Existing final schema: no legacy Student alteration or compatibility alias.
  CREATE TABLE public.edu_daily_care_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id uuid NOT NULL,
    date date NOT NULL,
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COMPLETED', 'CLOSED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_class_date UNIQUE (tenant_id, class_id, date)
  );
  CREATE TABLE public.edu_daily_care_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES public.edu_daily_care_sessions(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(student_id) ON DELETE CASCADE,
    arrival_status text DEFAULT 'PRESENT' CHECK (arrival_status IN ('PRESENT', 'ABSENT', 'LATE')),
    arrival_time timestamptz,
    morning_condition text DEFAULT 'GOOD',
    meal_records jsonb NOT NULL DEFAULT '[]'::jsonb,
    hygiene_records jsonb NOT NULL DEFAULT '[]'::jsonb,
    nap_records jsonb NOT NULL DEFAULT '{}'::jsonb,
    health_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    student_party_id uuid REFERENCES public.party_parties(id) ON DELETE CASCADE,
    CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
  );
  CREATE UNIQUE INDEX uq_daily_care_records_session_student_party
    ON public.edu_daily_care_records(session_id, student_party_id)
    WHERE student_party_id IS NOT NULL;
  CREATE INDEX idx_daily_care_records_tenant_student_party
    ON public.edu_daily_care_records(tenant_id, student_party_id);
  COMMENT ON COLUMN public.edu_daily_care_records.student_party_id IS
    'Canonical Preschool Daily Care student identity: public.party_parties.id.';
  CREATE TABLE public.edu_attendance_daily_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    enrollment_id uuid NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
    school_day date NOT NULL,
    status text NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT edu_attendance_daily_state_unique UNIQUE (tenant_id, enrollment_id, school_day)
  );
  CREATE INDEX idx_edu_attendance_daily_state_tenant_day
    ON public.edu_attendance_daily_state(tenant_id, school_day);
  CREATE INDEX idx_edu_attendance_daily_state_enrollment
    ON public.edu_attendance_daily_state(enrollment_id);

  -- Preserve whatever service-role defaults actually exist; add no service grant.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', relation.relname, 'grantor', acl.grantor, 'grantee', acl.grantee,
    'privilege', acl.privilege_type, 'grantable', acl.is_grantable
  ) ORDER BY relation.relname, acl.grantor, acl.privilege_type), '[]'::jsonb)
  INTO service_acl_before
  FROM pg_class relation
  CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
  WHERE relation.relnamespace = 'public'::regnamespace AND relation.relname = ANY(new_tables)
    AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role');

  SELECT jsonb_agg(jsonb_build_object(
    'table', relation.relname,
    'select', has_table_privilege('service_role', relation.oid, 'SELECT'),
    'insert', has_table_privilege('service_role', relation.oid, 'INSERT'),
    'update', has_table_privilege('service_role', relation.oid, 'UPDATE'),
    'delete', has_table_privilege('service_role', relation.oid, 'DELETE'),
    'truncate', has_table_privilege('service_role', relation.oid, 'TRUNCATE'),
    'references', has_table_privilege('service_role', relation.oid, 'REFERENCES'),
    'trigger', has_table_privilege('service_role', relation.oid, 'TRIGGER'),
    'maintain', CASE WHEN current_setting('server_version_num')::integer >= 170000
      THEN has_table_privilege('service_role', relation.oid, 'MAINTAIN') ELSE false END,
    'column_select', has_any_column_privilege('service_role', relation.oid, 'SELECT'),
    'column_insert', has_any_column_privilege('service_role', relation.oid, 'INSERT'),
    'column_update', has_any_column_privilege('service_role', relation.oid, 'UPDATE'),
    'column_references', has_any_column_privilege('service_role', relation.oid, 'REFERENCES')
  ) ORDER BY relation.relname) INTO service_effective_before
  FROM pg_class relation WHERE relation.relnamespace = 'public'::regnamespace
    AND relation.relname = ANY(new_tables);

  ALTER TABLE public.edu_daily_care_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.edu_daily_care_records ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.edu_attendance_daily_state ENABLE ROW LEVEL SECURITY;
  -- Revoke inherited/default client grants only on relations just created above.
  -- Existing shared ACLs are never revoked or widened beyond authenticated SELECT.
  REVOKE ALL PRIVILEGES ON TABLE public.edu_daily_care_sessions,
    public.edu_daily_care_records, public.edu_attendance_daily_state
    FROM PUBLIC, anon, authenticated;

  -- Acyclic RLS dependencies: Course -> Platform projection; Enrollment -> Course;
  -- Party -> Enrollment; Session -> Course; Record -> Session + Enrollment;
  -- Attendance -> Enrollment. No policy reads its own table recursively.
  course_scope := format(actor_template, 'edu_courses') || $course$
    AND edu_courses.status = 'active'
    AND (SELECT count(*) FROM public.preschool_chain_course_branch_assignments binding_count
      WHERE binding_count.tenant_id = edu_courses.tenant_id
        AND binding_count.course_id = edu_courses.id) = 1
    AND EXISTS (
      SELECT 1
      FROM public.preschool_chain_course_branch_assignments binding
      JOIN public.org_units branch ON branch.id = binding.branch_id
        AND branch.tenant_id = binding.tenant_id
      JOIN public.user_org_unit_access branch_access
        ON branch_access.org_unit_id = branch.id
        AND branch_access.tenant_id = binding.tenant_id
      WHERE binding.tenant_id = edu_courses.tenant_id
        AND binding.course_id = edu_courses.id
        AND branch.unit_type = 'branch' AND branch.is_active IS TRUE
        AND branch_access.user_id = auth.uid()
    )
  $course$;
  enrollment_scope := format(actor_template, 'edu_enrollments') || format($enrollment$
    AND edu_enrollments.status = 'active'
    AND edu_enrollments.enrolled_at <=
      ((%s + time '23:59:59.999') AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND EXISTS (
      SELECT 1 FROM public.edu_courses eligible_course
      WHERE eligible_course.id = edu_enrollments.course_id
        AND eligible_course.tenant_id = edu_enrollments.tenant_id
        AND eligible_course.status = 'active'
    )
  $enrollment$, today_expression);
  party_scope := format(actor_template, 'party_parties') || $party$
    AND EXISTS (
      SELECT 1 FROM public.edu_enrollments eligible_enrollment
      WHERE eligible_enrollment.student_party_id = party_parties.id
        AND eligible_enrollment.tenant_id = party_parties.tenant_id
        AND eligible_enrollment.status = 'active'
    )
  $party$;
  session_scope := format(actor_template, 'edu_daily_care_sessions') || format($session$
    AND edu_daily_care_sessions.date = %s
    AND EXISTS (
      SELECT 1 FROM public.edu_courses eligible_course
      WHERE eligible_course.id = edu_daily_care_sessions.class_id
        AND eligible_course.tenant_id = edu_daily_care_sessions.tenant_id
        AND eligible_course.status = 'active'
    )
  $session$, today_expression);
  record_scope := format(actor_template, 'edu_daily_care_records') || format($record$
    AND edu_daily_care_records.student_party_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.edu_daily_care_sessions eligible_session
      JOIN public.edu_enrollments eligible_enrollment
        ON eligible_enrollment.course_id = eligible_session.class_id
        AND eligible_enrollment.tenant_id = eligible_session.tenant_id
      WHERE eligible_session.id = edu_daily_care_records.session_id
        AND eligible_session.tenant_id = edu_daily_care_records.tenant_id
        AND eligible_session.date = %s
        AND eligible_enrollment.student_party_id = edu_daily_care_records.student_party_id
        AND eligible_enrollment.status = 'active'
    )
  $record$, today_expression);
  attendance_scope := format(actor_template, 'edu_attendance_daily_state') || format($attendance$
    AND edu_attendance_daily_state.school_day = %s
    AND EXISTS (
      SELECT 1 FROM public.edu_enrollments eligible_enrollment
      WHERE eligible_enrollment.id = edu_attendance_daily_state.enrollment_id
        AND eligible_enrollment.tenant_id = edu_attendance_daily_state.tenant_id
        AND eligible_enrollment.status = 'active'
    )
  $attendance$, today_expression);

  -- A permissive SELECT supplies the new live-Auth path. The matching restrictive
  -- guard intersects every original permissive policy, including old GUC paths.
  -- Teachers remain denied until the authoritative Auth -> teacher mapping exists.
  FOR policy_target IN
    SELECT * FROM (VALUES
      ('edu_courses', 'e2e_care_course_select_allow', 'e2e_care_course_select_guard', course_scope),
      ('edu_enrollments', 'e2e_care_enrollment_select_allow', 'e2e_care_enrollment_select_guard', enrollment_scope),
      ('party_parties', 'e2e_care_party_select_allow', 'e2e_care_party_select_guard', party_scope)
    ) AS allowlist(table_name, allow_name, guard_name, predicate)
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (%s)',
      policy_target.allow_name, policy_target.table_name, policy_target.predicate);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
      policy_target.guard_name, policy_target.table_name, policy_target.predicate);
  END LOOP;
  EXECUTE format('CREATE POLICY e2e_care_session_select ON public.edu_daily_care_sessions FOR SELECT TO authenticated USING (%s)', session_scope);
  EXECUTE format('CREATE POLICY e2e_care_session_insert ON public.edu_daily_care_sessions FOR INSERT TO authenticated WITH CHECK (%s)', session_scope);
  EXECUTE format('CREATE POLICY e2e_care_record_select ON public.edu_daily_care_records FOR SELECT TO authenticated USING (%s)', record_scope);
  EXECUTE format('CREATE POLICY e2e_care_record_insert ON public.edu_daily_care_records FOR INSERT TO authenticated WITH CHECK (%s)', record_scope);
  EXECUTE format('CREATE POLICY e2e_care_record_update ON public.edu_daily_care_records FOR UPDATE TO authenticated USING (%1$s) WITH CHECK (%1$s)', record_scope);
  EXECUTE format('CREATE POLICY e2e_care_attendance_select ON public.edu_attendance_daily_state FOR SELECT TO authenticated USING (%s)', attendance_scope);

  GRANT SELECT ON TABLE public.edu_courses, public.edu_enrollments,
    public.party_parties, public.edu_attendance_daily_state TO authenticated;
  GRANT SELECT, INSERT ON TABLE public.edu_daily_care_sessions TO authenticated;
  GRANT SELECT ON TABLE public.edu_daily_care_records TO authenticated;
  GRANT INSERT (tenant_id, session_id, student_party_id, arrival_status, arrival_time,
    morning_condition, meal_records, hygiene_records, nap_records, updated_at)
    ON TABLE public.edu_daily_care_records TO authenticated;
  GRANT UPDATE (arrival_status, arrival_time, morning_condition, meal_records,
    hygiene_records, nap_records, updated_at)
    ON TABLE public.edu_daily_care_records TO authenticated;

  -- Definition/ACL assertions are preparation evidence only, not real Auth proof.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'tablename', tablename, 'policyname', policyname, 'permissive', permissive,
    'roles', roles::text, 'cmd', cmd, 'qual', qual, 'with_check', with_check
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  INTO shared_policies_after
  FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(shared_tables)
    AND NOT (policyname = ANY(shared_policy_names));
  IF shared_policies_after IS DISTINCT FROM shared_policies_before THEN
    RAISE EXCEPTION 'CARE_E2E_ORIGINAL_SHARED_POLICIES_CHANGED';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND tablename = ANY(shared_tables) AND policyname = ANY(shared_policy_names)
      AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]) <> 6 THEN
    RAISE EXCEPTION 'CARE_E2E_SHARED_SELECT_POLICY_COUNT_INVALID';
  END IF;
  FOREACH target_name IN ARRAY shared_tables || new_tables LOOP
    IF NOT has_table_privilege('authenticated', format('public.%I', target_name), 'SELECT')
        OR has_table_privilege('anon', format('public.%I', target_name),
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege('anon', format('public.%I', target_name),
          'SELECT,INSERT,UPDATE,REFERENCES')
        OR NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = to_regclass(format('public.%I', target_name))) THEN
      RAISE EXCEPTION 'CARE_E2E_SELECT_RLS_OR_ANON_ACL_INVALID: %', target_name;
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', target_name),
        'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'CARE_E2E_UNEXPECTED_AUTH_TABLE_WRITE: %', target_name;
    END IF;
    IF target_name <> 'edu_daily_care_sessions'
        AND has_table_privilege('authenticated', format('public.%I', target_name), 'INSERT') THEN
      RAISE EXCEPTION 'CARE_E2E_UNEXPECTED_AUTH_TABLE_INSERT: %', target_name;
    END IF;
    IF target_name NOT IN ('edu_daily_care_sessions', 'edu_daily_care_records')
        AND has_any_column_privilege('authenticated', format('public.%I', target_name),
          'INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'CARE_E2E_UNEXPECTED_AUTH_COLUMN_WRITE: %', target_name;
    END IF;
    IF current_setting('server_version_num')::integer >= 170000 THEN
      IF has_table_privilege('anon', format('public.%I', target_name), 'MAINTAIN')
          OR has_table_privilege('authenticated', format('public.%I', target_name), 'MAINTAIN') THEN
        RAISE EXCEPTION 'CARE_E2E_UNEXPECTED_CLIENT_MAINTAIN: %', target_name;
      END IF;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('authenticated', 'public.edu_daily_care_sessions', 'INSERT') THEN
    RAISE EXCEPTION 'CARE_E2E_SESSION_INSERT_GRANT_MISSING';
  END IF;
  FOR column_name IN SELECT attname::text FROM pg_attribute
    WHERE attrelid = 'public.edu_daily_care_records'::regclass
      AND attnum > 0 AND NOT attisdropped
  LOOP
    IF has_column_privilege('authenticated', 'public.edu_daily_care_records', column_name, 'INSERT')
         IS DISTINCT FROM (column_name = ANY(record_insert_columns))
        OR has_column_privilege('authenticated', 'public.edu_daily_care_records', column_name, 'UPDATE')
         IS DISTINCT FROM (column_name = ANY(record_update_columns))
        OR has_column_privilege('authenticated', 'public.edu_daily_care_records', column_name, 'REFERENCES') THEN
      RAISE EXCEPTION 'CARE_E2E_RECORD_COLUMN_ACL_INVALID: %', column_name;
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', relation.relname, 'grantor', acl.grantor, 'grantee', acl.grantee,
    'privilege', acl.privilege_type, 'grantable', acl.is_grantable
  ) ORDER BY relation.relname, acl.grantor, acl.privilege_type), '[]'::jsonb)
  INTO service_acl_after
  FROM pg_class relation
  CROSS JOIN LATERAL aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
  WHERE relation.relnamespace = 'public'::regnamespace AND relation.relname = ANY(new_tables)
    AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role');
  IF service_acl_after IS DISTINCT FROM service_acl_before THEN
    RAISE EXCEPTION 'CARE_E2E_SERVICE_DEFAULT_ACL_CHANGED';
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'table', relation.relname,
    'select', has_table_privilege('service_role', relation.oid, 'SELECT'),
    'insert', has_table_privilege('service_role', relation.oid, 'INSERT'),
    'update', has_table_privilege('service_role', relation.oid, 'UPDATE'),
    'delete', has_table_privilege('service_role', relation.oid, 'DELETE'),
    'truncate', has_table_privilege('service_role', relation.oid, 'TRUNCATE'),
    'references', has_table_privilege('service_role', relation.oid, 'REFERENCES'),
    'trigger', has_table_privilege('service_role', relation.oid, 'TRIGGER'),
    'maintain', CASE WHEN current_setting('server_version_num')::integer >= 170000
      THEN has_table_privilege('service_role', relation.oid, 'MAINTAIN') ELSE false END,
    'column_select', has_any_column_privilege('service_role', relation.oid, 'SELECT'),
    'column_insert', has_any_column_privilege('service_role', relation.oid, 'INSERT'),
    'column_update', has_any_column_privilege('service_role', relation.oid, 'UPDATE'),
    'column_references', has_any_column_privilege('service_role', relation.oid, 'REFERENCES')
  ) ORDER BY relation.relname) INTO service_effective_after
  FROM pg_class relation WHERE relation.relnamespace = 'public'::regnamespace
    AND relation.relname = ANY(new_tables);
  IF service_effective_after IS DISTINCT FROM service_effective_before THEN
    RAISE EXCEPTION 'CARE_E2E_EFFECTIVE_SERVICE_PRIVILEGES_CHANGED';
  END IF;
END
$care_e2e_prepare$;

-- Recovery is separately owned: remove exactly the twelve named experiment
-- policies and reverse the three shared authenticated SELECT grants, under a
-- checked expected-post-state guard. Restore full captured preexisting metadata;
-- do not overwrite concurrent changes or guess grantors/default ACLs. New tables
-- and fixture rows have their own explicit cleanup/recovery scope; never DROP
-- CASCADE or erase preexisting business data. Do not claim the original absent
-- schema fingerprint is restored while newly created relations remain present.
-- Executor must refresh PostgREST schema after its approved commit, then prove
-- real positive/negative Auth paths independently of these catalog assertions.
