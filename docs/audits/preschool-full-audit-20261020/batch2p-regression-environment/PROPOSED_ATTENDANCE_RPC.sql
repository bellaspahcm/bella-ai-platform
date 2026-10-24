-- PROPOSAL ONLY. NOT EXECUTED. Requires owning approval for a new additive repair migration.
-- Preserve the public signature and all business predicates; qualify only the conflict target.


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
BEGIN
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
    v_state.id,
    v_state.tenant_id,
    v_state.enrollment_id,
    v_state.school_day,
    v_state.status,
    v_event_id,
    p_roll_call_time,
    v_state.created_at,
    v_state.updated_at;
END;
$$;
