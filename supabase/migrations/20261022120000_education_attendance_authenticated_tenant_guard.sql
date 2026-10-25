BEGIN;

-- Education Attendance security fix: bind authenticated calls to the active
-- Auth-backed canonical profile tenant before validation, lookup, or writes.
-- Keep the public RPC signature, grants, event history, and daily-state behavior.
CREATE OR REPLACE FUNCTION public.edu_set_daily_attendance(
  p_tenant_id UUID,
  p_enrollment_id UUID,
  p_status TEXT,
  p_roll_call_time TIMESTAMPTZ,
  p_school_day DATE
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  enrollment_id UUID,
  school_day DATE,
  status TEXT,
  event_id UUID,
  roll_call_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_event_id UUID;
  v_state public.edu_attendance_daily_state%ROWTYPE;
  v_actor_tenant_id UUID;
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'ATTENDANCE_ACTOR_DENIED: Signed-in actor required.' USING ERRCODE = '42501';
    END IF;

    SELECT u.tenant_id
    INTO v_actor_tenant_id
    FROM auth.users a
    JOIN public.users u ON u.id = a.id
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE a.id = auth.uid()
      AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until <= now())
      AND u.status = 'active'
      AND t.status = 'active';

    IF v_actor_tenant_id IS NULL OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'ATTENDANCE_ACTOR_TENANT_DENIED: Active actor tenant must match request tenant.' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'ATTENDANCE_ACTOR_DENIED: Authenticated actor or trusted server required.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE_STATUS: %', p_status USING ERRCODE = '22023';
  END IF;

  IF p_roll_call_time IS NULL THEN
    RAISE EXCEPTION 'ROLL_CALL_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_school_day IS NULL THEN
    RAISE EXCEPTION 'SCHOOL_DAY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT e.id
  INTO v_enrollment_id
  FROM public.edu_enrollments e
  WHERE e.id = p_enrollment_id
    AND e.tenant_id = p_tenant_id;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % not found for tenant %', p_enrollment_id, p_tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.edu_attendance (
    tenant_id,
    enrollment_id,
    status,
    roll_call_time
  )
  VALUES (
    p_tenant_id,
    p_enrollment_id,
    p_status,
    p_roll_call_time
  )
  RETURNING edu_attendance.id INTO v_event_id;

  INSERT INTO public.edu_attendance_daily_state (
    tenant_id,
    enrollment_id,
    school_day,
    status
  )
  VALUES (
    p_tenant_id,
    p_enrollment_id,
    p_school_day,
    p_status
  )
  ON CONFLICT ON CONSTRAINT edu_attendance_daily_state_unique
  DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING * INTO v_state;

  RETURN QUERY SELECT
    v_state.id AS id,
    v_state.tenant_id AS tenant_id,
    v_state.enrollment_id AS enrollment_id,
    v_state.school_day AS school_day,
    v_state.status AS status,
    v_event_id AS event_id,
    p_roll_call_time AS roll_call_time,
    v_state.created_at AS created_at,
    v_state.updated_at AS updated_at;
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL; assert this migration does not
-- alter grants. The authenticated and service_role grant remains unchanged.

COMMIT;
