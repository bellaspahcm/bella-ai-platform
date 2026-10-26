-- Approved teacher Attendance integration: synthetic local/E2E only.
-- Platform identity is consumed through its public self-resolve contract.
-- No business-row DML, direct link-table grant or service-writer expansion.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.preschool_teacher_can_attend_course(
  p_tenant_id uuid, p_course_id uuid, p_school_day date, p_expected_branch uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog AS $teacher_scope$
DECLARE v_identity jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR p_tenant_id IS NULL OR p_course_id IS NULL OR p_expected_branch IS NULL
    OR p_school_day IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    OR NOT EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
      WHERE u.id=auth.uid() AND u.tenant_id=p_tenant_id AND u.role='admin_staff'
        AND u.status='active' AND t.status='active' AND t.product_key='bella_preschool')
  THEN RETURN false; END IF;
  v_identity := public.party_resolve_current_auth_link();
  IF v_identity IS NULL OR v_identity->>'tenantId' IS DISTINCT FROM p_tenant_id::text
    OR v_identity->>'authUserId' IS DISTINCT FROM auth.uid()::text
  THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments m
      WHERE m.tenant_id=p_tenant_id AND m.course_id=p_course_id) <> 1
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.teacher_assignments a
    JOIN public.preschool_teacher_branch_confirmations f
      ON f.id=a.canonical_teacher_confirmation_id AND f.tenant_id=a.tenant_id
      AND f.teacher_party_id=a.teacher_party_id
    JOIN public.edu_courses c ON c.id=a.canonical_course_id AND c.tenant_id=a.tenant_id
    JOIN public.preschool_chain_course_branch_assignments m ON m.course_id=c.id AND m.tenant_id=c.tenant_id
      AND m.branch_id=f.branch_id AND m.branch_id=p_expected_branch
    JOIN public.org_units b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id
      AND b.unit_type='branch' AND b.is_active
    JOIN public.user_org_unit_access x ON x.org_unit_id=b.id AND x.tenant_id=b.tenant_id
      AND x.user_id=auth.uid() AND x.relationship_id IS NOT NULL
    WHERE a.tenant_id=p_tenant_id AND a.canonical_course_id=p_course_id AND a.course_id IS NULL
      AND a.teacher_party_id=(v_identity->>'partyId')::uuid AND a.status='active' AND c.status='active'
      AND a.effective_start_date<=p_school_day
      AND (a.effective_end_date IS NULL OR a.effective_end_date>=p_school_day)
      AND f.revoked_at IS NULL AND f.valid_from<=p_school_day
      AND (f.valid_to IS NULL OR f.valid_to>=p_school_day)
  );
EXCEPTION WHEN insufficient_privilege THEN RETURN false;
END;
$teacher_scope$;
REVOKE ALL ON FUNCTION public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

-- Product-owned self listing; selectors only narrow the resolved caller scope.
CREATE FUNCTION public.preschool_teacher_attendance_courses(p_school_day date,p_branch_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
AS $teacher_courses$
DECLARE v_identity jsonb; v_tenant uuid; v_result jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR p_school_day IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  THEN RAISE EXCEPTION 'ATTENDANCE_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  v_identity := public.party_resolve_current_auth_link();
  IF v_identity IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u
    WHERE u.id=auth.uid() AND u.role='admin_staff' AND u.status='active'
      AND u.tenant_id::text=v_identity->>'tenantId')
  THEN RAISE EXCEPTION 'ATTENDANCE_TEACHER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  v_tenant := (v_identity->>'tenantId')::uuid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'name',c.title,'branchId',m.branch_id)
    ORDER BY c.id),'[]'::jsonb) INTO v_result
  FROM public.edu_courses c JOIN public.preschool_chain_course_branch_assignments m
    ON m.course_id=c.id AND m.tenant_id=c.tenant_id
  WHERE c.tenant_id=v_tenant AND (p_branch_id IS NULL OR m.branch_id=p_branch_id)
    AND public.preschool_teacher_can_attend_course(v_tenant,c.id,p_school_day,m.branch_id);
  RETURN jsonb_build_object('tenantId',v_tenant,'actorId',auth.uid(),'schoolDay',p_school_day,'courses',v_result);
END;
$teacher_courses$;
REVOKE ALL ON FUNCTION public.preschool_teacher_attendance_courses(date,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_teacher_attendance_courses(date,uuid) TO authenticated;

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

  -- Preschool attendance requires a current active actor and today's school day.
  -- Teacher access additionally requires the approved identity/assignment intersection.
  IF v_role NOT IN ('admin','admin_staff')
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

  IF v_role='admin_staff' AND (
    NOT public.preschool_teacher_can_attend_course(p_tenant_id,v_course,p_school_day,v_branch)
    OR (SELECT count(*) FROM public.preschool_chain_enrollment_branch_assignments m
      WHERE m.tenant_id=p_tenant_id AND m.enrollment_id=p_enrollment_id
        AND m.course_id=v_course AND m.branch_id=v_branch
        AND m.request_id::text=(SELECT e.request_id FROM public.edu_enrollments e
          WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id)) <> 1
  ) THEN RETURN false; END IF;
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
  v_role text;
  v_branch uuid;
  v_roster jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR v_actor IS NULL
    OR p_course_id IS NULL
    OR p_school_day IS DISTINCT FROM (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT u.tenant_id,u.role INTO v_tenant,v_role
  FROM auth.users a
  JOIN public.users u ON u.id = a.id
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= statement_timestamp())
    AND u.status = 'active'
    AND u.role IN ('admin','admin_staff')
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

  IF v_role='admin_staff' AND (
    NOT public.preschool_teacher_can_attend_course(v_tenant,p_course_id,p_school_day,v_branch)
    OR EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant
      AND e.course_id=p_course_id AND e.status='active'
      AND e.enrolled_at < ((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND (SELECT count(*) FROM public.preschool_chain_enrollment_branch_assignments m
        WHERE m.tenant_id=v_tenant AND m.enrollment_id=e.id
          AND m.course_id=p_course_id AND m.branch_id=v_branch AND m.request_id::text=e.request_id) <> 1)
  ) THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;

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



COMMIT;
