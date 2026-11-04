-- ACR-2026-024: composable Education-owned pending -> active contract.
--
-- This is an internal SQL contract for the trusted outer Preschool Admission
-- command. It intentionally has no EXECUTE grant for client roles; the outer
-- command must derive and authorize the authenticated actor/tenant before
-- invoking it in the same PostgreSQL transaction.
--
-- Do not add table grants, RLS policies, or direct Product writes here.

BEGIN;

CREATE FUNCTION public.edu_preschool_activate_pending_enrollment(
  p_tenant_id uuid,
  p_enrollment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_enrollment public.edu_enrollments%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'EDU_PRESCHOOL_ENROLLMENT_INVALID_REQUEST'
      USING ERRCODE = '22023';
  END IF;

  -- The pending row must already have passed Education's creation checks.
  -- Recheck its current tenant, active course, and canonical person identity;
  -- lock only the enrollment row so competing activations serialize.
  SELECT e.*
    INTO v_enrollment
  FROM public.edu_enrollments AS e
  JOIN public.edu_courses AS c
    ON c.id = e.course_id
   AND c.tenant_id = e.tenant_id
   AND c.status = 'active'
  JOIN public.party_parties AS p
    ON p.id = e.student_party_id
   AND p.tenant_id = e.tenant_id
   AND p.party_type = 'person'
   AND p.deleted_at IS NULL
  WHERE e.id = p_enrollment_id
    AND e.tenant_id = p_tenant_id
  FOR UPDATE OF e;

  IF NOT FOUND THEN
    -- Deliberately does not reveal whether another tenant owns the ID.
    RAISE EXCEPTION 'EDU_PRESCHOOL_ENROLLMENT_NOT_FOUND_OR_INELIGIBLE'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_enrollment.status <> 'pending' THEN
    RAISE EXCEPTION 'EDU_PRESCHOOL_ENROLLMENT_STATE_CONFLICT'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.edu_enrollments AS e
     SET status = 'active',
         updated_at = clock_timestamp()
   WHERE e.id = p_enrollment_id
     AND e.tenant_id = p_tenant_id
     AND e.status = 'pending'
  RETURNING e.* INTO v_enrollment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EDU_PRESCHOOL_ENROLLMENT_STATE_CONFLICT'
      USING ERRCODE = '23514';
  END IF;

  -- Course enrollment capacity was accounted for when the pending enrollment
  -- was created by Education; activation must not count it a second time.
  RETURN jsonb_build_object(
    'id', v_enrollment.id,
    'tenantId', v_enrollment.tenant_id,
    'studentPartyId', v_enrollment.student_party_id,
    'courseId', v_enrollment.course_id,
    'status', v_enrollment.status,
    'enrolledAt', v_enrollment.enrolled_at
  );
END;
$function$;

-- Only the function owner (the trusted outer SQL command's execution owner)
-- may invoke this composable boundary. Never expose it to PostgREST client roles.
REVOKE ALL ON FUNCTION public.edu_preschool_activate_pending_enrollment(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.edu_preschool_activate_pending_enrollment(uuid, uuid) IS
  'Education-owned, owner-only SQL contract for activating one existing, eligible Preschool pending enrollment inside the outer Admission transaction. No client role may execute it directly.';

COMMIT;
