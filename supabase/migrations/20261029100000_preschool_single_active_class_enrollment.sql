-- Preschool permits one active or pending class enrollment per student.
-- The trigger enforces the invariant for every write path, while the RPC keeps
-- the existing authenticated contract and returns a stable unique-conflict code.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    JOIN public.tenants t ON t.id = e.tenant_id
    WHERE t.product_key = 'bella_preschool'
      AND e.status IN ('active', 'pending')
    GROUP BY e.tenant_id, e.student_party_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PRESCHOOL_EXISTING_MULTI_CLASS_ENROLLMENTS_REQUIRE_REVIEW';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.edu_preschool_enrollment_single_active_class_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET lock_timeout TO '5s'
AS $$
DECLARE
  v_product_key text;
BEGIN
  IF NEW.status NOT IN ('active', 'pending') THEN
    RETURN NEW;
  END IF;

  SELECT t.product_key INTO v_product_key
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id
  FOR SHARE;

  IF v_product_key IS DISTINCT FROM 'bella_preschool' THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.party_parties p
  WHERE p.id = NEW.student_party_id
    AND p.tenant_id = NEW.tenant_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    WHERE e.tenant_id = NEW.tenant_id
      AND e.student_party_id = NEW.student_party_id
      AND e.status IN ('active', 'pending')
      AND e.course_id <> NEW.course_id
      AND e.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'ENROLLMENT_ALREADY_IN_ANOTHER_CLASS' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_enrollment_single_active_class_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_edu_enrollments_preschool_single_active_class ON public.edu_enrollments;
CREATE TRIGGER trg_edu_enrollments_preschool_single_active_class
  BEFORE INSERT OR UPDATE OF tenant_id, student_party_id, course_id, status
  ON public.edu_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.edu_preschool_enrollment_single_active_class_guard();

CREATE OR REPLACE FUNCTION public.edu_preschool_enroll_student(
  p_course_id uuid,
  p_student_party_id uuid,
  p_guardian_party_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET statement_timeout TO '10s'
SET lock_timeout TO '5s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_branch uuid;
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_course public.edu_courses%ROWTYPE;
  v_enrollment public.edu_enrollments%ROWTYPE;
  v_count bigint;
  v_duplicate boolean := false;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_course_id IS NULL OR p_student_party_id IS NULL OR p_guardian_party_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT u.tenant_id INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
  WHERE u.id = v_actor AND u.status = 'active' AND u.role = 'admin'
  FOR SHARE OF u, t;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- Lock order: request key -> canonical Student identity -> Course.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || p_request_id::text, 0));
  PERFORM 1 FROM public.party_parties p
  WHERE p.id = p_student_party_id AND p.tenant_id = v_tenant
    AND p.party_type = 'person' AND p.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant FOR SHARE;
  IF (SELECT count(*) FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant AND s.academic_status = 'enrolled') THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_course FROM public.edu_courses c
  WHERE c.id = p_course_id AND c.tenant_id = v_tenant AND c.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_COURSE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.preschool_chain_course_branch_assignments a
  WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id FOR SHARE;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a
      WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id) <> 1 THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_SCOPE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT a.branch_id INTO v_branch
  FROM public.preschool_chain_course_branch_assignments a
  JOIN public.org_units b ON b.id = a.branch_id AND b.tenant_id = v_tenant
    AND b.unit_type = 'branch' AND b.is_active
  WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id
  FOR SHARE OF b;
  IF v_branch IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_org_unit_access a
    WHERE a.user_id = v_actor AND a.tenant_id = v_tenant
      AND a.org_unit_id = v_branch AND a.relationship_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.party_parties p
  WHERE p.id = p_guardian_party_id AND p.tenant_id = v_tenant
    AND p.deleted_at IS NULL AND p.id <> p_student_party_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.party_relationships r
  WHERE r.tenant_id = v_tenant AND r.source_party_id = p_guardian_party_id
    AND r.target_party_id = p_student_party_id
    AND r.relationship_type IN ('guardian_of', 'parent_of')
  FOR SHARE;
  IF (SELECT count(*) FROM public.party_relationships r
      WHERE r.tenant_id = v_tenant AND r.source_party_id = p_guardian_party_id
        AND r.target_party_id = p_student_party_id
        AND r.relationship_type IN ('guardian_of', 'parent_of')
        AND (r.active_from IS NULL OR r.active_from <= v_day)
        AND (r.active_to IS NULL OR r.active_to >= v_day)) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.party_relationships r
      WHERE r.tenant_id = v_tenant AND r.source_party_id = p_guardian_party_id
        AND r.target_party_id = p_student_party_id AND r.relationship_type = 'guardian_of'
        AND (r.active_from IS NULL OR r.active_from <= v_day)
        AND (r.active_to IS NULL OR r.active_to >= v_day)) THEN
    RAISE EXCEPTION 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_enrollment FROM public.edu_enrollments e
  WHERE e.tenant_id = v_tenant AND e.request_id = p_request_id::text;
  IF FOUND THEN
    IF v_enrollment.student_party_id <> p_student_party_id
       OR v_enrollment.course_id <> p_course_id OR v_enrollment.status <> 'active' THEN
      RAISE EXCEPTION 'ENROLLMENT_REQUEST_CONFLICT' USING ERRCODE = '23505';
    END IF;
    v_duplicate := true;
  ELSE
    IF EXISTS (SELECT 1 FROM public.edu_enrollments e
      WHERE e.tenant_id = v_tenant AND e.student_party_id = p_student_party_id
        AND e.course_id = p_course_id) THEN
      RAISE EXCEPTION 'ENROLLMENT_ALREADY_EXISTS' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (SELECT 1 FROM public.edu_enrollments e
      WHERE e.tenant_id = v_tenant AND e.student_party_id = p_student_party_id
        AND e.status IN ('active', 'pending') AND e.course_id <> p_course_id) THEN
      RAISE EXCEPTION 'ENROLLMENT_ALREADY_IN_ANOTHER_CLASS' USING ERRCODE = '23505';
    END IF;
    IF coalesce(cardinality(v_course.prerequisite_course_codes), 0) <> 0 THEN
      RAISE EXCEPTION 'ENROLLMENT_GOVERNED_PREREQUISITES_UNAVAILABLE' USING ERRCODE = '0A000';
    END IF;

    SELECT count(*) INTO v_count FROM public.edu_enrollments e
    WHERE e.tenant_id = v_tenant AND e.student_party_id = p_student_party_id
      AND e.status IN ('active', 'pending');
    IF v_count + 1 > 6 OR (v_count + 1) * 3 > 24 THEN
      RAISE EXCEPTION 'ENROLLMENT_CREDIT_LIMIT' USING ERRCODE = '23514';
    END IF;
    IF v_course.current_enrollment IS NULL OR (v_course.max_students IS NOT NULL AND (
        v_course.current_enrollment >= v_course.max_students
        OR (SELECT count(*) FROM public.edu_enrollments e
          WHERE e.tenant_id = v_tenant AND e.course_id = p_course_id
            AND e.status IN ('active', 'pending')) >= v_course.max_students)) THEN
      RAISE EXCEPTION 'ENROLLMENT_CAPACITY_UNAVAILABLE' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.edu_enrollments(tenant_id, student_party_id, course_id, status, enrolled_at, request_id)
      VALUES(v_tenant, p_student_party_id, p_course_id, 'active', statement_timestamp(), p_request_id::text)
      RETURNING * INTO v_enrollment;
    UPDATE public.edu_courses SET current_enrollment = current_enrollment + 1,
      updated_at = statement_timestamp()
    WHERE id = p_course_id AND tenant_id = v_tenant;
  END IF;

  RETURN jsonb_build_object('enrollment', jsonb_build_object(
    'id', v_enrollment.id, 'tenantId', v_enrollment.tenant_id,
    'studentPartyId', v_enrollment.student_party_id, 'courseId', v_enrollment.course_id,
    'status', v_enrollment.status, 'enrolledAt', v_enrollment.enrolled_at
  ), 'isDuplicate', v_duplicate);
END
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_enroll_student(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_enroll_student(uuid, uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
