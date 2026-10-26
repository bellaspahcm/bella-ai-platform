-- Education-owned forward package: approved local/E2E repair only.
-- Production execution requires separate release authority and fresh preflight.
-- Reuses the reviewed canonical helpers/read policies; no business-row DML.
-- R1: reject unauthorized callers before resource locks, retain post-wait checks.
-- R2: fail closed on effective inherited column writes as well as table writes.
-- R3: harden direct-write ACL before final read preflight in ONE transaction.
-- Do not edit/repair previous migration history or bulk-apply pending migrations.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

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

  -- Preschool attendance requires an active administrator and today's school day.
  -- Teacher authorization stays closed until a canonical Auth-to-branch confirmation exists.
  IF v_role <> 'admin'
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

REVOKE ALL PRIVILEGES ON FUNCTION public.edu_can_access_attendance_enrollment(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_can_access_attendance_enrollment(uuid, uuid, date)
  TO authenticated, service_role;

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
  v_branch uuid;
  v_roster jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR v_actor IS NULL
    OR p_course_id IS NULL
    OR p_school_day IS DISTINCT FROM (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT u.tenant_id INTO v_tenant
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= statement_timestamp())
    AND u.status = 'active'
    AND u.role = 'admin'
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

REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_roster_identity(uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_roster_identity(uuid, date) TO authenticated;


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

-- Preserve the existing, proven E2E execution roles. Canonical source differs,
-- so establishing these grants in a forward migration needs the owner decision.
REVOKE ALL ON FUNCTION public.edu_can_access_attendance_enrollment(uuid,uuid,date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_can_access_attendance_enrollment(uuid,uuid,date)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)
  TO authenticated, service_role;


-- Containment precedes the final read preflight, including legacy direct grants.
DO $acl$
DECLARE
  service_before jsonb; service_after jsonb;
  select_before jsonb; select_after jsonb;
  writer regprocedure:=to_regprocedure('public.edu_set_daily_attendance(uuid,uuid,text,timestamptz,date)');
BEGIN
  IF writer IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid=writer AND prosecdef
      AND position('edu_can_access_attendance_enrollment' IN prosrc)>0
  ) OR has_function_privilege('anon',writer,'EXECUTE') THEN
    RAISE EXCEPTION 'AUTHORIZED_ATTENDANCE_WRITER_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass) AND relrowsecurity)<>2 THEN
    RAISE EXCEPTION 'ATTENDANCE_RLS_REQUIRED';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('table',c.relname,'insert',has_table_privilege('service_role',c.oid,'INSERT'),
    'update',has_table_privilege('service_role',c.oid,'UPDATE'),'delete',has_table_privilege('service_role',c.oid,'DELETE'),
    'truncate',has_table_privilege('service_role',c.oid,'TRUNCATE')) ORDER BY c.relname)
  INTO service_before FROM pg_class c WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass);
  SELECT jsonb_agg(jsonb_build_object('table',c.relname,'role',r.rolname,'select',has_table_privilege(r.rolname,c.oid,'SELECT')) ORDER BY c.relname,r.rolname)
  INTO select_before FROM pg_class c CROSS JOIN pg_roles r
  WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass) AND r.rolname IN ('anon','authenticated','service_role');

  -- zero-downtime: reviewed-attendance-write-revoke
  REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.edu_attendance,public.edu_attendance_daily_state FROM PUBLIC,anon,authenticated;

  IF EXISTS (
    SELECT 1 FROM pg_class c CROSS JOIN pg_roles r
    WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass)
      AND r.rolname IN ('anon','authenticated')
      AND (has_table_privilege(r.rolname,c.oid,'INSERT') OR has_table_privilege(r.rolname,c.oid,'UPDATE')
        OR has_table_privilege(r.rolname,c.oid,'DELETE') OR has_table_privilege(r.rolname,c.oid,'TRUNCATE')
        OR has_any_column_privilege(r.rolname,c.oid,'INSERT')
        OR has_any_column_privilege(r.rolname,c.oid,'UPDATE'))
  ) THEN RAISE EXCEPTION 'ATTENDANCE_DIRECT_WRITE_PRIVILEGE_REMAINS'; END IF;
  SELECT jsonb_agg(jsonb_build_object('table',c.relname,'insert',has_table_privilege('service_role',c.oid,'INSERT'),
    'update',has_table_privilege('service_role',c.oid,'UPDATE'),'delete',has_table_privilege('service_role',c.oid,'DELETE'),
    'truncate',has_table_privilege('service_role',c.oid,'TRUNCATE')) ORDER BY c.relname)
  INTO service_after FROM pg_class c WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass);
  SELECT jsonb_agg(jsonb_build_object('table',c.relname,'role',r.rolname,'select',has_table_privilege(r.rolname,c.oid,'SELECT')) ORDER BY c.relname,r.rolname)
  INTO select_after FROM pg_class c CROSS JOIN pg_roles r
  WHERE c.oid IN ('public.edu_attendance'::regclass,'public.edu_attendance_daily_state'::regclass) AND r.rolname IN ('anon','authenticated','service_role');
  IF service_after IS DISTINCT FROM service_before OR select_after IS DISTINCT FROM select_before THEN
    RAISE EXCEPTION 'ATTENDANCE_READ_OR_WORKER_PRIVILEGE_CHANGED';
  END IF;
END;
$acl$;

DO $preflight$
DECLARE
  v_access_helper regprocedure := to_regprocedure('public.edu_can_access_attendance_enrollment(uuid,uuid,date)');
  v_roster_rpc regprocedure := to_regprocedure('public.edu_preschool_roster_identity(uuid,date)');
BEGIN
  IF v_access_helper IS NULL OR v_roster_rpc IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_BRANCH_READ_CAPABILITY_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'edu_attendance_daily_state'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_DAILY_STATE_RLS_DISABLED';
  END IF;
  IF has_table_privilege('anon', 'public.edu_attendance_daily_state', 'SELECT')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'INSERT')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.edu_attendance_daily_state', 'DELETE')
    OR has_any_column_privilege('authenticated', 'public.edu_attendance_daily_state', 'INSERT')
    OR has_any_column_privilege('authenticated', 'public.edu_attendance_daily_state', 'UPDATE') THEN
    RAISE EXCEPTION 'ATTENDANCE_DAILY_STATE_ACL_PREFLIGHT_FAILED';
  END IF;
  IF NOT has_function_privilege('authenticated', v_access_helper, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', v_roster_rpc, 'EXECUTE')
    OR has_function_privilege('anon', v_access_helper, 'EXECUTE')
    OR has_function_privilege('anon', v_roster_rpc, 'EXECUTE') THEN
    RAISE EXCEPTION 'ATTENDANCE_BRANCH_READ_RPC_ACL_PREFLIGHT_FAILED';
  END IF;
END;
$preflight$;

GRANT SELECT ON TABLE public.edu_attendance_daily_state TO authenticated;

-- Remove the earlier policy-only candidate, which constrained every Education
-- product. These policies isolate Preschool while preserving the tenant policy
-- for other products and ensuring it cannot bypass Preschool branch scope.
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


COMMIT;
