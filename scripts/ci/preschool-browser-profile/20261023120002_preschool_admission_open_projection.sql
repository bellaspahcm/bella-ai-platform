BEGIN;
CREATE OR REPLACE FUNCTION public.preschool_open_admission(
  p_tenant_id uuid,p_actor_id uuid,p_operation_key uuid,p_payload jsonb DEFAULT NULL
) RETURNS SETOF public.preschool_admission_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_operation public.preschool_admission_operations%ROWTYPE;
  v_branch_id uuid;
  v_course_id uuid;
  v_code text;
BEGIN
  IF p_operation_key IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN auth.users a ON a.id=u.id
    JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin')
  ) THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-admission:'||p_tenant_id||':'||p_operation_key,0));
  SELECT * INTO v_operation FROM public.preschool_admission_operations
    WHERE tenant_id=p_tenant_id AND operation_key=p_operation_key;
  IF FOUND THEN
    PERFORM 1 FROM public.users u JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id
      WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
        AND lower(u.role) IN ('admin','super_admin') FOR SHARE OF u,t,a;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501'; END IF;
    IF v_operation.actor_id<>p_actor_id THEN
      RAISE EXCEPTION 'PRESCHOOL_ADMISSION_ACTOR_DENIED' USING ERRCODE='42501';
    END IF;
    IF p_payload IS NOT NULL AND v_operation.payload<>p_payload THEN
      RAISE EXCEPTION 'PRESCHOOL_ADMISSION_PAYLOAD_CONFLICT' USING ERRCODE='P0001';
    END IF;
    RETURN NEXT v_operation; RETURN;
  END IF;
  IF p_payload IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION 'PRESCHOOL_ADMISSION_INVALID_PAYLOAD' USING ERRCODE='22023';
  END IF;
  v_branch_id := (p_payload->>'branchId')::uuid;
  v_course_id := (p_payload->>'courseId')::uuid;
  IF v_course_id IS NULL THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_INVALID_PAYLOAD' USING ERRCODE='22023'; END IF;
  -- The immutable Product intent reserves the course/branch before any Party,
  -- Student or enrollment write. Competing branches fail without academic residue.
  -- Assignment uses this same course lock; no new Kernel query or reservation table.
  PERFORM pg_advisory_xact_lock(hashtextextended('preschool-course:'||p_tenant_id||':'||v_course_id,0));
  IF EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments
      WHERE tenant_id=p_tenant_id AND course_id=v_course_id AND branch_id<>v_branch_id)
    OR EXISTS(SELECT 1 FROM public.preschool_admission_operations
      WHERE tenant_id=p_tenant_id AND payload->>'courseId'=v_course_id::text AND branch_id<>v_branch_id) THEN
    RAISE EXCEPTION 'PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT' USING ERRCODE='P0001';
  END IF;
  IF v_branch_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.org_units WHERE id=v_branch_id AND tenant_id=p_tenant_id
      AND unit_type='branch' AND is_active=true
  ) THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_BRANCH_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.users u JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id
    JOIN public.org_units b ON b.tenant_id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
      AND lower(u.role) IN ('admin','super_admin') AND b.id=v_branch_id AND b.unit_type='branch' AND b.is_active=true
    FOR SHARE OF u,t,a,b;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_ADMISSION_BRANCH_DENIED' USING ERRCODE='42501'; END IF;
  -- Allocate once in the Product namespace. The Student public contract owns
  -- uniqueness; an external code collision fails closed without reallocating.
  v_code := 'EDU-'||extract(year FROM now() AT TIME ZONE 'UTC')::text||'-'||nextval('public.preschool_admission_student_code_seq')::text;
  INSERT INTO public.preschool_admission_operations(tenant_id,operation_key,actor_id,branch_id,payload,student_code)
    VALUES(p_tenant_id,p_operation_key,p_actor_id,v_branch_id,p_payload,v_code)
    RETURNING * INTO v_operation;
  RETURN NEXT v_operation;
END;
$$;

COMMIT;
