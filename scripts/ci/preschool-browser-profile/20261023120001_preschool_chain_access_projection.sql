BEGIN;

CREATE OR REPLACE FUNCTION public.preschool_branch_access(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_action text DEFAULT 'registry'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_role text; v_allowed boolean;
BEGIN
  IF p_actor_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_actor_id) THEN RETURN false; END IF;
  SELECT lower(u.role) INTO v_role FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp());
  IF v_role IS NULL OR (p_action='admission' AND v_role NOT IN ('admin','super_admin'))
    OR (p_action IN ('registry','attendance') AND v_role NOT IN ('admin','super_admin','admin_staff'))
    OR p_action IS NULL OR p_action NOT IN ('admission','registry','attendance') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE id=p_branch_id AND tenant_id=p_tenant_id
    AND unit_type='branch' AND is_active=true) THEN RETURN false; END IF;
  IF auth.role()='service_role' THEN
    -- Service writers accept only current canonical tenant administrators.
    -- Their tenant-wide active-unit scope is the existing Platform admin rule.
    RETURN v_role IN ('admin','super_admin');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_org_unit_access WHERE user_id=auth.uid()
    AND tenant_id=p_tenant_id AND org_unit_id=p_branch_id) INTO v_allowed;
  RETURN v_allowed;
END;
$$;

CREATE OR REPLACE FUNCTION public.preschool_assign_chain(
  p_tenant_id uuid,p_actor_id uuid,p_course_id uuid,p_enrollment_id uuid,p_branch_id uuid,p_request_id uuid
) RETURNS SETOF public.preschool_chain_enrollment_branch_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_course public.preschool_chain_course_branch_assignments%ROWTYPE;
  v_assignment public.preschool_chain_enrollment_branch_assignments%ROWTYPE;
BEGIN
  IF NOT public.preschool_branch_access(p_tenant_id,p_actor_id,p_branch_id,'admission') THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-course:'||p_tenant_id||':'||p_course_id,0));
  IF EXISTS(SELECT 1 FROM public.preschool_admission_operations WHERE tenant_id=p_tenant_id
    AND payload->>'courseId'=p_course_id::text AND branch_id<>p_branch_id) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT'; END IF;
  -- Recheck after a potentially blocking lock and hold live authority rows.
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id JOIN public.org_units b ON b.tenant_id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin') AND b.id=p_branch_id AND b.unit_type='branch' AND b.is_active=true
    FOR SHARE OF u,t,a,b;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  -- Read-only owning canonical relations; no Kernel mutation or authorization grant.
  IF NOT EXISTS(SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id
    JOIN public.students s ON s.party_id=e.student_party_id AND s.tenant_id=e.tenant_id
    JOIN public.party_parties p ON p.id=e.student_party_id AND p.tenant_id=e.tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
    WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id AND e.course_id=p_course_id
      AND e.request_id=p_request_id::text AND e.status IN ('active','pending')) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_course FROM public.preschool_chain_course_branch_assignments
    WHERE tenant_id=p_tenant_id AND course_id=p_course_id FOR UPDATE;
  IF FOUND AND v_course.branch_id<>p_branch_id THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT'; END IF;
  SELECT * INTO v_assignment FROM public.preschool_chain_enrollment_branch_assignments
    WHERE tenant_id=p_tenant_id AND (enrollment_id=p_enrollment_id OR request_id=p_request_id) FOR UPDATE;
  IF FOUND THEN
    IF v_course.id IS NULL THEN RAISE EXCEPTION 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT'; END IF;
    IF v_assignment.enrollment_id<>p_enrollment_id OR v_assignment.course_id<>p_course_id
      OR v_assignment.branch_id<>p_branch_id OR v_assignment.request_id<>p_request_id THEN
      RAISE EXCEPTION 'PRESCHOOL_CHAIN_ASSIGNMENT_CONFLICT'; END IF;
    RETURN NEXT v_assignment; RETURN;
  END IF;
  IF v_course.id IS NULL THEN
    INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id,course_id,branch_id,assigned_by)
      VALUES(p_tenant_id,p_course_id,p_branch_id,p_actor_id);
  END IF;
  INSERT INTO public.preschool_chain_enrollment_branch_assignments(tenant_id,enrollment_id,course_id,branch_id,request_id,assigned_by)
    VALUES(p_tenant_id,p_enrollment_id,p_course_id,p_branch_id,p_request_id,p_actor_id) RETURNING * INTO v_assignment;
  RETURN NEXT v_assignment;
END;
$$;

COMMIT;
