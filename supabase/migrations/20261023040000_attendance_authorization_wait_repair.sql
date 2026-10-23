BEGIN;

-- Platform owns canonical branch type/activity and explicit actor access.
CREATE FUNCTION public.platform_assert_active_branch_for_actor(p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_tenant_id IS NULL OR p_actor_id IS NULL OR p_branch_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'PLATFORM_BRANCH_ACTOR_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.org_units ou WHERE ou.id=p_branch_id AND ou.tenant_id=p_tenant_id
    AND ou.unit_type='branch' AND ou.is_active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLATFORM_ACTIVE_BRANCH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_org_unit_access_for_actor(p_tenant_id,p_actor_id) a
    WHERE a.user_id=p_actor_id AND a.tenant_id=p_tenant_id AND a.org_unit_id=p_branch_id
      AND a.relationship_id IS NOT NULL AND a.access_source IN ('belongs_to','manages','participates_in')) THEN
    RAISE EXCEPTION 'PLATFORM_EXPLICIT_BRANCH_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_assert_active_branch_for_actor(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.platform_assert_active_branch_for_actor(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.edu_set_scoped_daily_attendance(
  p_tenant_id uuid,p_actor_id uuid,p_expected_role text,p_branch_id uuid,p_enrollment_id uuid,
  p_course_id uuid,p_student_party_id uuid,p_request_id text,p_status text,p_roll_call_time timestamptz,p_school_day date
) RETURNS TABLE(id uuid,tenant_id uuid,enrollment_id uuid,school_day date,status text,event_id uuid,
  roll_call_time timestamptz,created_at timestamptz,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_enrollment public.edu_enrollments%ROWTYPE; v_role text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'ATTENDANCE_TRUSTED_ACTOR_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_tenant_id IS NULL OR p_branch_id IS NULL OR p_enrollment_id IS NULL OR p_course_id IS NULL
    OR p_student_party_id IS NULL OR p_request_id IS NULL OR p_expected_role IS NULL
    OR p_status IS NULL OR p_status NOT IN ('present','absent','excused')
    OR p_school_day IS NULL OR p_roll_call_time IS NULL
    OR (p_roll_call_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date IS DISTINCT FROM p_school_day THEN
    RAISE EXCEPTION 'ATTENDANCE_SCOPED_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('education-attendance:'||p_tenant_id::text||':'||p_enrollment_id::text||':'||p_school_day::text,0));
  SELECT e.* INTO v_enrollment FROM public.edu_enrollments e
    WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_ENROLLMENT_DENIED' USING ERRCODE='42501'; END IF;
  -- Acquire an existing daily row's write lock before the final authority read.
  -- The common advisory lock serializes absent-row inserts by daily RPC writers.
  PERFORM 1 FROM public.edu_attendance_daily_state s WHERE s.tenant_id=p_tenant_id
    AND s.enrollment_id=p_enrollment_id AND s.school_day=p_school_day FOR UPDATE;
  -- Take all known write/FK waits before current actor/branch validation.
  LOCK TABLE public.edu_attendance,public.edu_attendance_daily_state IN ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.tenants t WHERE t.id=p_tenant_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_CURRENT_TENANT_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM public.platform_assert_active_branch_for_actor(p_tenant_id,p_actor_id,p_branch_id);
  SELECT lower(btrim(u.role)) INTO v_role FROM auth.users a JOIN public.users u ON u.id=a.id
    JOIN public.tenants t ON t.id=u.tenant_id WHERE a.id=p_actor_id AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
    AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active';
  IF v_role IS NULL OR v_role IS DISTINCT FROM lower(btrim(p_expected_role)) THEN
    RAISE EXCEPTION 'ATTENDANCE_CURRENT_ACTOR_ROLE_DENIED' USING ERRCODE='42501';
  END IF;

  IF v_enrollment.course_id IS DISTINCT FROM p_course_id OR v_enrollment.student_party_id IS DISTINCT FROM p_student_party_id
    OR v_enrollment.request_id IS DISTINCT FROM p_request_id
    OR NOT EXISTS(SELECT 1 FROM public.edu_courses c WHERE c.id=p_course_id AND c.tenant_id=p_tenant_id)
    OR NOT EXISTS(SELECT 1 FROM public.party_parties p WHERE p.id=p_student_party_id AND p.tenant_id=p_tenant_id
      AND p.party_type='person' AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'ATTENDANCE_CANONICAL_CONFLICT' USING ERRCODE='23505';
  END IF;
  RETURN QUERY SELECT * FROM public.edu_set_daily_attendance(p_tenant_id,p_enrollment_id,p_status,p_roll_call_time,p_school_day);
END;
$$;

COMMIT;
