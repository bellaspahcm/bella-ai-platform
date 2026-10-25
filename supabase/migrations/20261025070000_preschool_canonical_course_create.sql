-- DRAFT FOR HUMAN REVIEW ONLY. Not in supabase/migrations; not approved/applied.
-- ACR: ../ACR-DRAFT.md, human approved scoped implementation 2026-10-25.
-- No legacy courses write, table grant expansion, backfill or global control change.
BEGIN;

CREATE TABLE public.preschool_course_create_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  operation_key uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  course_code text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, operation_key),
  UNIQUE (course_id)
);
ALTER TABLE public.preschool_course_create_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.preschool_course_create_receipts FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE public.preschool_course_create_receipts IS
  'Preschool Product operation identity only. Course data remains in edu_courses. No direct caller writes/reads.';

CREATE FUNCTION public.edu_create_preschool_course(
  p_tenant_id uuid, p_actor_id uuid, p_operation_key uuid, p_course_id uuid,
  p_branch_id uuid, p_course_code text, p_title text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_receipt public.preschool_course_create_receipts%ROWTYPE;
  v_course public.edu_courses%ROWTYPE;
BEGIN
  -- Only an authenticated API's trusted server client may dispatch this command.
  -- Service authority is constrained again against live Auth/profile/Product/branch.
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'CANONICAL_COURSE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_operation_key IS NULL OR p_course_id IS NULL OR p_branch_id IS NULL
    OR p_course_code IS NULL OR p_title IS NULL OR length(p_course_code) NOT BETWEEN 1 AND 80
    OR length(p_title) NOT BETWEEN 1 AND 200 OR p_course_code <> upper(btrim(p_course_code))
    OR p_title <> btrim(p_title) OR btrim(p_course_code) = '' OR btrim(p_title) = ''
    OR p_course_code ~ '[[:cntrl:]]' OR p_title ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'CANONICAL_COURSE_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  -- Serialize identical operations before reading prior success or touching data.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'preschool-course-create:' || p_tenant_id::text || ':' || p_operation_key::text, 0));

  -- This check happens after the possible wait and holds current authority rows.
  PERFORM 1 FROM public.users u JOIN auth.users a ON a.id = u.id
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = p_actor_id AND u.tenant_id = p_tenant_id AND u.status = 'active'
      AND lower(u.role) = 'admin' AND t.status = 'active' AND t.product_key = 'bella_preschool'
      AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until <= clock_timestamp())
    FOR SHARE OF u, a, t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANONICAL_COURSE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  -- Existing Platform public assertion: active branch + explicit current access.
  -- No duplicate org projection or tenant_admin-only allowance is introduced.
  PERFORM public.platform_assert_active_branch_for_actor(p_tenant_id, p_actor_id, p_branch_id);

  SELECT * INTO v_receipt FROM public.preschool_course_create_receipts
    WHERE tenant_id = p_tenant_id AND operation_key = p_operation_key FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.actor_id <> p_actor_id OR v_receipt.branch_id <> p_branch_id
      OR v_receipt.course_code <> p_course_code OR v_receipt.title <> p_title THEN
      RAISE EXCEPTION 'CANONICAL_COURSE_CONFLICT' USING ERRCODE = '23505';
    END IF;
    -- A later rename/archive/remap cannot masquerade as the original request.
    SELECT * INTO v_course FROM public.edu_courses
      WHERE id = v_receipt.course_id AND tenant_id = p_tenant_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CANONICAL_COURSE_CONFLICT' USING ERRCODE = '23505';
    END IF;
    IF v_course.course_code <> p_course_code OR v_course.title <> p_title OR v_course.status <> 'active'
      OR NOT EXISTS (SELECT 1 FROM public.preschool_chain_course_branch_assignments b
        WHERE b.tenant_id = p_tenant_id AND b.course_id = v_course.id AND b.branch_id = p_branch_id) THEN
      RAISE EXCEPTION 'CANONICAL_COURSE_CONFLICT' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.edu_courses(id, tenant_id, course_code, title, status,
      max_students, current_enrollment, prerequisite_course_codes)
      VALUES(p_course_id, p_tenant_id, p_course_code, p_title, 'active', NULL, 0, ARRAY[]::text[])
      RETURNING * INTO v_course;
    INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id, course_id, branch_id, assigned_by)
      VALUES(p_tenant_id, v_course.id, p_branch_id, p_actor_id);
    INSERT INTO public.preschool_course_create_receipts(tenant_id, operation_key, actor_id, course_id, branch_id, course_code, title)
      VALUES(p_tenant_id, p_operation_key, p_actor_id, v_course.id, p_branch_id, p_course_code, p_title);
  END IF;

  -- Inserts/replay reads may wait on concurrent transactions. Recheck current
  -- branch authority after the last such operation; failure rolls back all writes.
  PERFORM public.platform_assert_active_branch_for_actor(p_tenant_id, p_actor_id, p_branch_id);

  RETURN pg_catalog.jsonb_build_object('id', v_course.id, 'tenantId', p_tenant_id,
    'courseCode', v_course.course_code, 'title', v_course.title, 'status', v_course.status,
    'branchId', p_branch_id, 'operationKey', p_operation_key);
END;
$$;

REVOKE ALL ON FUNCTION public.edu_create_preschool_course(uuid, uuid, uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_create_preschool_course(uuid, uuid, uuid, uuid, uuid, text, text) TO service_role;
COMMENT ON FUNCTION public.edu_create_preschool_course(uuid, uuid, uuid, uuid, uuid, text, text) IS
  'Approved canonical command design. Live admin/Product/explicit branch, atomic course+mapping+receipt, retry identity, no legacy dual-write.';

NOTIFY pgrst, 'reload schema';
COMMIT;
