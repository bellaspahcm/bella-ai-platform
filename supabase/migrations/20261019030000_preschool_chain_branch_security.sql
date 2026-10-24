-- Product access/integrity only. No Platform projection or Kernel grant changes.
CREATE OR REPLACE FUNCTION public.preschool_branch_access(
  p_tenant_id uuid,p_actor_id uuid,p_branch_id uuid,p_action text DEFAULT 'registry'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_role text; v_allowed boolean;
BEGIN
  IF p_actor_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_actor_id) THEN RETURN false; END IF;
  SELECT lower(u.role) INTO v_role FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND u.status='active' AND t.status='active';
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
REVOKE ALL ON FUNCTION public.preschool_branch_access(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preschool_branch_access(uuid,uuid,uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.preschool_course_assignment_visible(p_tenant_id uuid,p_course_id uuid,p_branch_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.preschool_branch_access(p_tenant_id,auth.uid(),p_branch_id,'registry')
    AND EXISTS(SELECT 1 FROM public.edu_courses WHERE id=p_course_id AND tenant_id=p_tenant_id);
$$;
CREATE OR REPLACE FUNCTION public.preschool_enrollment_assignment_visible(p_tenant_id uuid,p_enrollment_id uuid,p_course_id uuid,p_branch_id uuid,p_request_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT public.preschool_branch_access(p_tenant_id,auth.uid(),p_branch_id,'registry') AND EXISTS(
    SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id
    JOIN public.students s ON s.party_id=e.student_party_id AND s.tenant_id=e.tenant_id
    JOIN public.party_parties p ON p.id=e.student_party_id AND p.tenant_id=e.tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
    JOIN public.preschool_chain_course_branch_assignments a ON a.tenant_id=e.tenant_id AND a.course_id=e.course_id
    WHERE e.id=p_enrollment_id AND e.tenant_id=p_tenant_id AND e.course_id=p_course_id
      AND e.request_id=p_request_id::text AND a.branch_id=p_branch_id);
$$;
REVOKE ALL ON FUNCTION public.preschool_course_assignment_visible(uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.preschool_enrollment_assignment_visible(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preschool_course_assignment_visible(uuid,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_enrollment_assignment_visible(uuid,uuid,uuid,uuid,uuid) TO authenticated,service_role;

DROP POLICY IF EXISTS preschool_chain_course_branch_assignments_tenant_isolation ON public.preschool_chain_course_branch_assignments;
DROP POLICY IF EXISTS preschool_chain_enrollment_branch_assignments_tenant_isolation ON public.preschool_chain_enrollment_branch_assignments;
DROP POLICY IF EXISTS preschool_chain_course_branch_select ON public.preschool_chain_course_branch_assignments;
DROP POLICY IF EXISTS preschool_chain_enrollment_branch_select ON public.preschool_chain_enrollment_branch_assignments;
CREATE POLICY preschool_chain_course_branch_select ON public.preschool_chain_course_branch_assignments FOR SELECT TO authenticated
  USING(public.preschool_course_assignment_visible(tenant_id,course_id,branch_id));
CREATE POLICY preschool_chain_enrollment_branch_select ON public.preschool_chain_enrollment_branch_assignments FOR SELECT TO authenticated
  USING(public.preschool_enrollment_assignment_visible(tenant_id,enrollment_id,course_id,branch_id,request_id));
REVOKE INSERT,UPDATE,DELETE ON public.preschool_chain_course_branch_assignments,public.preschool_chain_enrollment_branch_assignments FROM authenticated,anon;
GRANT SELECT ON public.preschool_chain_course_branch_assignments,public.preschool_chain_enrollment_branch_assignments TO authenticated,service_role;

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
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active'
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
REVOKE ALL ON FUNCTION public.preschool_assign_chain(uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_assign_chain(uuid,uuid,uuid,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.preschool_admission_pickup(
  p_tenant_id uuid,p_actor_id uuid,p_student_party_id uuid,p_guardian_party_id uuid,p_normalized_phone text
) RETURNS SETOF public.edu_preschool_pickup_authorizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_relation public.party_relationships%ROWTYPE; v_auth public.edu_preschool_pickup_authorizations%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND lower(u.role) IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  IF p_student_party_id=p_guardian_party_id OR NOT EXISTS(SELECT 1 FROM public.party_parties WHERE id=p_student_party_id
    AND tenant_id=p_tenant_id AND party_type='person' AND deleted_at IS NULL) OR NOT EXISTS(
      SELECT 1 FROM public.party_identifiers i JOIN public.party_parties p ON p.id=i.party_id
      WHERE i.tenant_id=p_tenant_id AND p.tenant_id=p_tenant_id AND p.party_type='person' AND p.deleted_at IS NULL
        AND i.party_id=p_guardian_party_id AND i.identifier_type='preschool_guardian_phone' AND i.identifier_value=p_normalized_phone) THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_CANONICAL_IDENTITY_CONFLICT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-pickup:'||p_tenant_id||':'||p_student_party_id||':'||p_guardian_party_id,0));
  SELECT * INTO v_relation FROM public.party_relationships WHERE tenant_id=p_tenant_id
    AND source_party_id=p_guardian_party_id AND target_party_id=p_student_party_id AND relationship_type='guardian_of' FOR UPDATE;
  IF NOT FOUND OR (v_relation.active_from IS NOT NULL AND v_relation.active_from>CURRENT_DATE)
    OR (v_relation.active_to IS NOT NULL AND v_relation.active_to<CURRENT_DATE) THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_RELATIONSHIP_NOT_ACTIVE'; END IF;
  -- Lock every prior authorization, including revoked rows. Concurrent revocation
  -- either precedes this check or waits until this admission step commits.
  PERFORM 1 FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id FOR UPDATE;
  PERFORM 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active'
      AND lower(u.role) IN ('admin','super_admin') FOR SHARE OF u,t,a;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_auth FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id AND status='authorized';
  IF FOUND THEN RETURN NEXT v_auth; RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.edu_preschool_pickup_authorizations WHERE tenant_id=p_tenant_id
    AND student_party_id=p_student_party_id AND guardian_party_id=p_guardian_party_id AND status='revoked') THEN
    RAISE EXCEPTION 'PRESCHOOL_GUARDIAN_AUTHORIZATION_REVOKED'; END IF;
  INSERT INTO public.edu_preschool_pickup_authorizations(tenant_id,student_party_id,guardian_party_id,status)
    VALUES(p_tenant_id,p_student_party_id,p_guardian_party_id,'authorized') RETURNING * INTO v_auth;
  RETURN NEXT v_auth;
END;
$$;
REVOKE ALL ON FUNCTION public.preschool_admission_pickup(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_admission_pickup(uuid,uuid,uuid,uuid,text) TO service_role;
