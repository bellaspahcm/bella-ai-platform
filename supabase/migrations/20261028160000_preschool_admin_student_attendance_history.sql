-- Current-caller Preschool admin history, scoped to a Registry-visible branch.
BEGIN;
CREATE OR REPLACE FUNCTION public.edu_preschool_admin_student_attendance_history(p_enrollment_id uuid)
RETURNS TABLE(id uuid, tenant_id uuid, enrollment_id uuid, status text, roll_call_time timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
SET statement_timeout = '10s' SET lock_timeout = '5s'
AS $history$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_role text;
  v_status text;
  v_tenant_status text;
  v_course uuid;
  v_branch uuid;
  v_request uuid;
  v_binding_count bigint;
  v_enrollment_created timestamptz;
  v_enrollment_updated timestamptz;
  v_course_created timestamptz;
  v_course_updated timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'authenticated'
     OR v_actor IS NULL OR p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_HISTORY_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT p.tenant_id, p.role, p.status, p.tenant_status
    INTO v_tenant, v_role, v_status, v_tenant_status
    FROM public.platform_current_actor_profile() p WHERE p.id = v_actor;
  IF v_tenant IS NULL OR v_role IS DISTINCT FROM 'admin'
     OR v_status IS DISTINCT FROM 'active' OR v_tenant_status IS DISTINCT FROM 'active'
     OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=v_tenant
       AND t.status='active' AND t.product_key='bella_preschool') THEN
    RAISE EXCEPTION 'PRESCHOOL_HISTORY_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT e.course_id INTO v_course FROM public.edu_enrollments e
    WHERE e.id=p_enrollment_id AND e.tenant_id=v_tenant AND e.status IN ('active','pending');
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_HISTORY_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.count(*), (pg_catalog.array_agg(m.branch_id))[1], (pg_catalog.array_agg(m.request_id))[1],
      (pg_catalog.array_agg(m.created_at))[1], (pg_catalog.array_agg(m.updated_at))[1],
      (pg_catalog.array_agg(c.created_at))[1], (pg_catalog.array_agg(c.updated_at))[1]
    INTO v_binding_count,v_branch,v_request,v_enrollment_created,v_enrollment_updated,v_course_created,v_course_updated
    FROM public.preschool_chain_enrollment_branch_assignments m
    JOIN public.edu_enrollments e ON e.id=m.enrollment_id AND e.tenant_id=m.tenant_id
      AND e.course_id=m.course_id AND e.request_id=m.request_id::text
    JOIN public.preschool_chain_course_branch_assignments c ON c.tenant_id=m.tenant_id
      AND c.course_id=m.course_id AND c.branch_id=m.branch_id
    JOIN public.org_units b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id
      AND b.unit_type='branch' AND b.is_active=true
    WHERE m.tenant_id=v_tenant AND m.enrollment_id=p_enrollment_id AND m.course_id=v_course;
  IF v_binding_count<>1 OR v_branch IS NULL OR v_request IS NULL
    OR (SELECT pg_catalog.count(*) FROM public.preschool_chain_enrollment_branch_assignments m
        WHERE m.tenant_id=v_tenant AND m.enrollment_id=p_enrollment_id) <> 1
    OR (SELECT pg_catalog.count(*) FROM public.preschool_chain_course_branch_assignments c
        WHERE c.tenant_id=v_tenant AND c.course_id=v_course) <> 1
    OR NOT public.preschool_enrollment_assignment_visible(v_tenant,p_enrollment_id,v_course,v_branch,v_request)
  THEN RAISE EXCEPTION 'PRESCHOOL_HISTORY_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  -- Historical events do not carry a branch ID. Do not attribute an event
  -- before the canonical bindings existed, or when a binding was updated.
  IF v_enrollment_created IS NULL OR v_course_created IS NULL
    OR v_enrollment_updated IS DISTINCT FROM v_enrollment_created
    OR v_course_updated IS DISTINCT FROM v_course_created
    OR EXISTS (SELECT 1 FROM public.edu_attendance event
      WHERE event.tenant_id=v_tenant AND event.enrollment_id=p_enrollment_id
        AND event.roll_call_time < GREATEST(v_enrollment_created,v_course_created))
  THEN RAISE EXCEPTION 'PRESCHOOL_HISTORY_BRANCH_PROVENANCE_UNAVAILABLE' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT e.id,e.tenant_id,e.enrollment_id,e.status::text,e.roll_call_time
    FROM public.edu_attendance e WHERE e.tenant_id=v_tenant AND e.enrollment_id=p_enrollment_id
    ORDER BY e.roll_call_time,e.id LIMIT 1000;
END;
$history$;
REVOKE ALL ON FUNCTION public.edu_preschool_admin_student_attendance_history(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_admin_student_attendance_history(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

