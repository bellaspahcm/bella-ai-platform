BEGIN;

-- Product owns action policy and assignment locks. Education owns enrollment
-- reconciliation and final current-authority validation after write waits.
CREATE FUNCTION public.preschool_set_scoped_daily_attendance(
  p_tenant_id uuid,p_actor_id uuid,p_expected_role text,p_branch_id uuid,p_enrollment_id uuid,
  p_course_id uuid,p_student_party_id uuid,p_status text,p_roll_call_time timestamptz,p_school_day date
) RETURNS TABLE(id uuid,tenant_id uuid,enrollment_id uuid,school_day date,status text,event_id uuid,
  roll_call_time timestamptz,created_at timestamptz,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_course public.preschool_chain_course_branch_assignments%ROWTYPE;
  v_assignment public.preschool_chain_enrollment_branch_assignments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL
    OR p_expected_role IS NULL OR lower(btrim(p_expected_role)) NOT IN ('admin','super_admin','admin_staff') THEN
    RAISE EXCEPTION 'PRESCHOOL_ATTENDANCE_ACTION_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT a.* INTO v_course FROM public.preschool_chain_course_branch_assignments a
    WHERE a.tenant_id=p_tenant_id AND a.course_id=p_course_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ATTENDANCE_COURSE_DENIED' USING ERRCODE='42501'; END IF;
  SELECT a.* INTO v_assignment FROM public.preschool_chain_enrollment_branch_assignments a
    WHERE a.tenant_id=p_tenant_id AND a.enrollment_id=p_enrollment_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ATTENDANCE_ENROLLMENT_DENIED' USING ERRCODE='42501'; END IF;
  IF v_assignment.course_id IS DISTINCT FROM p_course_id OR v_assignment.branch_id IS DISTINCT FROM p_branch_id
    OR v_course.branch_id IS DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'PRESCHOOL_ATTENDANCE_CANONICAL_CONFLICT' USING ERRCODE='23505';
  END IF;
  RETURN QUERY SELECT * FROM public.edu_set_scoped_daily_attendance(p_tenant_id,p_actor_id,p_expected_role,p_branch_id,
    p_enrollment_id,p_course_id,p_student_party_id,v_assignment.request_id::text,p_status,p_roll_call_time,p_school_day);
END;
$$;
REVOKE ALL ON FUNCTION public.preschool_set_scoped_daily_attendance(uuid,uuid,text,uuid,uuid,uuid,uuid,text,timestamptz,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_set_scoped_daily_attendance(uuid,uuid,text,uuid,uuid,uuid,uuid,text,timestamptz,date) TO service_role;

COMMIT;
