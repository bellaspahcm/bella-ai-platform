-- Candidate only: derived from approved G1 E2E function; adds canonical enrollment-branch binding.
BEGIN;
CREATE FUNCTION public.preschool_g1_guardians_read(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET TimeZone = 'Asia/Ho_Chi_Minh'
SET statement_timeout = '10s'
SET lock_timeout = '2s'
AS $g1$
DECLARE
  -- G1_GUARDIAN_READ_V1: recovery identity marker.
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_student_party uuid;
  v_today date := (pg_catalog.timezone('Asia/Ho_Chi_Minh', pg_catalog.statement_timestamp()))::date;
  v_guardian_count integer;
  v_result jsonb;
BEGIN
  IF p_student_id IS NULL
    OR current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR v_actor IS NULL
  THEN
    RAISE EXCEPTION 'G1_GUARDIAN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT u.tenant_id
    INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  JOIN auth.users a ON a.id = u.id
  WHERE u.id = v_actor
    AND u.status = 'active'
    AND lower(u.role) = 'admin'
    AND t.status = 'active'
    AND t.product_key = 'bella_preschool'
    AND a.deleted_at IS NULL
    AND (a.banned_until IS NULL OR a.banned_until <= pg_catalog.statement_timestamp());

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'G1_GUARDIAN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT s.party_id
    INTO v_student_party
  FROM public.students s
  JOIN public.party_parties student_party
    ON student_party.id = s.party_id
   AND student_party.tenant_id = s.tenant_id
   AND student_party.party_type = 'person'
   AND student_party.deleted_at IS NULL
  WHERE s.student_id = p_student_id
    AND s.tenant_id = v_tenant
    AND s.academic_status = 'enrolled'
    AND EXISTS (
      SELECT 1
      FROM public.edu_enrollments e
      JOIN public.edu_courses c
        ON c.id = e.course_id
       AND c.tenant_id = e.tenant_id
       AND c.status = 'active'
      JOIN public.preschool_chain_course_branch_assignments assignment
        ON assignment.course_id = c.id
       AND assignment.tenant_id = c.tenant_id
      JOIN public.preschool_chain_enrollment_branch_assignments enrollment_binding
        ON enrollment_binding.tenant_id = e.tenant_id
       AND enrollment_binding.enrollment_id = e.id
       AND enrollment_binding.course_id = e.course_id
       AND enrollment_binding.branch_id = assignment.branch_id
       AND enrollment_binding.request_id::text = e.request_id
      JOIN public.org_units branch
        ON branch.id = assignment.branch_id
       AND branch.tenant_id = assignment.tenant_id
       AND branch.unit_type = 'branch'
       AND branch.is_active
      JOIN public.user_org_unit_access access
        ON access.user_id = v_actor
       AND access.tenant_id = branch.tenant_id
       AND access.org_unit_id = branch.id
       AND access.relationship_id IS NOT NULL
      WHERE e.tenant_id = s.tenant_id
        AND e.student_party_id = s.party_id
        AND e.status IN ('active', 'pending')
    );

  IF v_student_party IS NULL THEN
    RAISE EXCEPTION 'G1_GUARDIAN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.students s
      WHERE s.tenant_id = v_tenant AND s.party_id = v_student_party) <> 1 THEN
    RAISE EXCEPTION 'G1_GUARDIAN_IDENTITY_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.edu_enrollments e
    JOIN public.edu_courses c
      ON c.id = e.course_id
     AND c.tenant_id = e.tenant_id
     AND c.status = 'active'
    WHERE e.tenant_id = v_tenant
      AND e.student_party_id = v_student_party
      AND e.status IN ('active', 'pending')
      AND NOT EXISTS (
        SELECT 1
        FROM public.preschool_chain_course_branch_assignments assignment
        JOIN public.preschool_chain_enrollment_branch_assignments enrollment_binding
          ON enrollment_binding.tenant_id = e.tenant_id
         AND enrollment_binding.enrollment_id = e.id
         AND enrollment_binding.course_id = e.course_id
         AND enrollment_binding.branch_id = assignment.branch_id
         AND enrollment_binding.request_id::text = e.request_id
        JOIN public.org_units assigned_branch
          ON assigned_branch.id = assignment.branch_id
         AND assigned_branch.tenant_id = assignment.tenant_id
         AND assigned_branch.unit_type = 'branch' AND assigned_branch.is_active
        WHERE assignment.tenant_id = e.tenant_id
          AND assignment.course_id = e.course_id
      )
  ) THEN
    RAISE EXCEPTION 'G1_GUARDIAN_CONFIGURATION_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  WITH current_relationships AS (
    SELECT relationship.id, relationship.source_party_id, relationship.relationship_type,
      relationship.active_from, relationship.active_to
    FROM public.party_relationships relationship
    WHERE relationship.tenant_id = v_tenant
      AND relationship.target_party_id = v_student_party
      AND relationship.relationship_type IN ('guardian_of', 'parent_of')
      AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
      AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
  )
  SELECT count(DISTINCT source_party_id)
    INTO v_guardian_count
  FROM current_relationships;

  IF v_guardian_count > 50 THEN
    RAISE EXCEPTION 'G1_GUARDIAN_RESULT_LIMIT_EXCEEDED' USING ERRCODE = '54000';
  END IF;

  IF EXISTS (
    WITH current_relationships AS (
      SELECT relationship.source_party_id
      FROM public.party_relationships relationship
      WHERE relationship.tenant_id = v_tenant
        AND relationship.target_party_id = v_student_party
        AND relationship.relationship_type IN ('guardian_of', 'parent_of')
        AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
        AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
    )
    SELECT 1
    FROM current_relationships relationship
    LEFT JOIN public.party_parties guardian
      ON guardian.id = relationship.source_party_id
     AND guardian.tenant_id = v_tenant
     AND guardian.party_type = 'person'
     AND guardian.deleted_at IS NULL
    WHERE guardian.id IS NULL OR btrim(guardian.display_name) = ''
      OR guardian.id = v_student_party
  ) THEN
    RAISE EXCEPTION 'G1_GUARDIAN_IDENTITY_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    WITH current_guardians AS (
      SELECT DISTINCT relationship.source_party_id
      FROM public.party_relationships relationship
      WHERE relationship.tenant_id = v_tenant
        AND relationship.target_party_id = v_student_party
        AND relationship.relationship_type IN ('guardian_of', 'parent_of')
        AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
        AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
    )
    SELECT 1
    FROM current_guardians guardian
    WHERE (
      SELECT count(*)
      FROM public.party_identifiers identifier
      WHERE identifier.tenant_id = v_tenant
        AND identifier.party_id = guardian.source_party_id
        AND identifier.identifier_type = 'preschool_guardian_phone'
        AND (identifier.issued_at IS NULL OR identifier.issued_at <= v_today)
        AND (identifier.expires_at IS NULL OR identifier.expires_at >= v_today)
    ) > 1
      OR EXISTS (
        SELECT 1
        FROM public.party_identifiers identifier
        WHERE identifier.tenant_id = v_tenant
          AND identifier.party_id = guardian.source_party_id
          AND identifier.identifier_type = 'preschool_guardian_phone'
          AND (identifier.issued_at IS NULL OR identifier.issued_at <= v_today)
          AND (identifier.expires_at IS NULL OR identifier.expires_at >= v_today)
          AND btrim(identifier.identifier_value) = ''
      )
  ) THEN
    RAISE EXCEPTION 'G1_GUARDIAN_PHONE_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    WITH current_guardians AS (
      SELECT DISTINCT relationship.source_party_id
      FROM public.party_relationships relationship
      WHERE relationship.tenant_id = v_tenant
        AND relationship.target_party_id = v_student_party
        AND relationship.relationship_type IN ('guardian_of', 'parent_of')
        AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
        AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
    )
    SELECT 1
    FROM current_guardians guardian
    WHERE (
      SELECT count(DISTINCT pickup.status)
      FROM public.edu_preschool_pickup_authorizations pickup
      WHERE pickup.tenant_id = v_tenant
        AND pickup.student_party_id = v_student_party
        AND pickup.guardian_party_id = guardian.source_party_id
    ) > 1
      OR EXISTS (
        SELECT 1
        FROM public.edu_preschool_pickup_authorizations pickup
        WHERE pickup.tenant_id = v_tenant
          AND pickup.student_party_id = v_student_party
          AND pickup.guardian_party_id = guardian.source_party_id
          AND (pickup.status IS NULL OR pickup.status NOT IN ('authorized', 'revoked'))
      )
  ) THEN
    RAISE EXCEPTION 'G1_GUARDIAN_PICKUP_UNAVAILABLE' USING ERRCODE = '55000';
  END IF;

  WITH current_relationships AS (
    SELECT relationship.id, relationship.source_party_id, relationship.relationship_type,
      relationship.active_from, relationship.active_to
    FROM public.party_relationships relationship
    WHERE relationship.tenant_id = v_tenant
      AND relationship.target_party_id = v_student_party
      AND relationship.relationship_type IN ('guardian_of', 'parent_of')
      AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
      AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
  ), current_guardians AS (
    SELECT DISTINCT relationship.source_party_id
    FROM current_relationships relationship
  )
  SELECT jsonb_build_object(
    'studentId', p_student_id,
    'studentPartyId', v_student_party,
    'asOfDate', v_today,
    'complete', true,
    'guardianCount', v_guardian_count,
    'guardians', coalesce(jsonb_agg(
      jsonb_build_object(
        'guardianPartyId', guardian.id,
        'displayName', guardian.display_name,
        'phone', phone.identifier_value,
        'phoneState', CASE WHEN phone.identifier_value IS NULL THEN 'missing' ELSE 'recorded' END,
        'relationships', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', relationship.id,
            'type', relationship.relationship_type,
            'activeFrom', relationship.active_from,
            'activeTo', relationship.active_to
          ) ORDER BY relationship.relationship_type, relationship.id)
          FROM current_relationships relationship
          WHERE relationship.source_party_id = guardian.id
        ),
        'pickupStatus', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.edu_preschool_pickup_authorizations pickup
            WHERE pickup.tenant_id = v_tenant
              AND pickup.student_party_id = v_student_party
              AND pickup.guardian_party_id = guardian.id
              AND pickup.status = 'authorized'
          ) THEN 'authorized'
          WHEN EXISTS (
            SELECT 1 FROM public.edu_preschool_pickup_authorizations pickup
            WHERE pickup.tenant_id = v_tenant
              AND pickup.student_party_id = v_student_party
              AND pickup.guardian_party_id = guardian.id
              AND pickup.status = 'revoked'
          ) THEN 'revoked'
          ELSE 'not_recorded'
        END
      ) ORDER BY guardian.id
    ) FILTER (WHERE guardian.id IS NOT NULL), '[]'::jsonb)
  )
  INTO v_result
  FROM current_guardians current_guardian
  JOIN public.party_parties guardian
    ON guardian.id = current_guardian.source_party_id
   AND guardian.tenant_id = v_tenant
   AND guardian.party_type = 'person'
   AND guardian.deleted_at IS NULL
  LEFT JOIN public.party_identifiers phone
    ON phone.tenant_id = v_tenant
   AND phone.party_id = guardian.id
   AND phone.identifier_type = 'preschool_guardian_phone'
   AND (phone.issued_at IS NULL OR phone.issued_at <= v_today)
   AND (phone.expires_at IS NULL OR phone.expires_at >= v_today);

  RETURN v_result;
END
$g1$;
REVOKE ALL ON FUNCTION public.preschool_g1_guardians_read(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_g1_guardians_read(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

