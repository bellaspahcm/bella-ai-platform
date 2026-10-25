-- Education-owned scoped reconciliation approved for Non-Production, 24 October 2026.
-- Reconciles the proven E2E authenticated contract with the existing scoped
-- Preschool server command; preserve existing history.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.edu_can_access_attendance_enrollment(
  p_tenant_id uuid, p_enrollment_id uuid, p_school_day date
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $attendance_access$
DECLARE
  v_actor uuid;
  v_role text;
  v_product text;
  v_course uuid;
  v_branch uuid;
  v_binding_count bigint;
BEGIN
  -- PostgreSQL validates SET ROLE membership. This is NOT request.jwt.claim.role,
  -- current_user (the definer), or a caller-controlled custom app GUC.
  IF current_setting('role', true) = 'service_role' THEN RETURN true; END IF;
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL OR p_school_day IS NULL THEN
    RETURN false;
  END IF;
  SELECT u.role, t.product_key INTO v_role, v_product
  FROM auth.users a JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor AND u.tenant_id = p_tenant_id
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= clock_timestamp())
    AND u.status = 'active' AND t.status = 'active';
  IF NOT FOUND OR v_product IS NULL THEN RETURN false; END IF;
  SELECT e.course_id INTO v_course FROM public.edu_enrollments e
  JOIN public.edu_courses c ON c.id = e.course_id AND c.tenant_id = e.tenant_id
  WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Non-Preschool Products retain their existing business authorization semantics.
  -- The new universal condition is verified provider subject/current tenant only.
  IF v_product <> 'bella_preschool' THEN RETURN true; END IF;
  -- No authoritative Auth -> teacher Party producer is available: admin_staff held.
  IF v_role <> 'admin' OR p_school_day <> (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c
      ON c.id = e.course_id AND c.tenant_id = e.tenant_id
    WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id AND e.course_id = v_course
      AND e.status = 'active' AND c.status = 'active'
      AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ) THEN RETURN false; END IF;
  SELECT count(*), (array_agg(a.branch_id))[1] INTO v_binding_count, v_branch
  FROM public.preschool_chain_course_branch_assignments a
  WHERE a.tenant_id = p_tenant_id AND a.course_id = v_course;
  IF v_binding_count <> 1 OR v_branch IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.org_units b
    JOIN public.user_org_unit_access a ON a.org_unit_id = b.id AND a.tenant_id = b.tenant_id
    WHERE b.id = v_branch AND b.tenant_id = p_tenant_id AND b.unit_type = 'branch' AND b.is_active
      AND a.user_id = v_actor AND a.relationship_id IS NOT NULL
  );
END;
$attendance_access$;

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

COMMIT;
