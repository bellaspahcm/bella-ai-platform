BEGIN;

-- Education-owned Preschool registry read contract.
-- The caller identity and tenant come only from the authenticated Platform
-- profile. Results are limited to canonical enrollments assigned to branches
-- the caller can access; no direct table grants are added.
CREATE OR REPLACE FUNCTION public.edu_preschool_student_registry(
  p_query text,
  p_status text,
  p_course_id uuid,
  p_branch_id uuid,
  p_offset integer,
  p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '10s'
SET lock_timeout = '5s'
AS $registry$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_role text;
  v_query text;
  v_status text;
  v_offset integer;
  v_limit integer;
  v_result jsonb;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'authenticated'
    OR v_actor IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_REGISTRY_AUTHENTICATED_ACTOR_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  IF p_query IS NULL OR pg_catalog.char_length(p_query) > 80
    OR p_query ~ '[[:cntrl:]]'
    OR p_status IS NULL OR p_status NOT IN ('all', 'active', 'pending')
    OR p_offset IS NULL OR p_offset < 0 OR p_offset > 100000
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'PRESCHOOL_REGISTRY_INVALID_REQUEST'
      USING ERRCODE = '22023';
  END IF;

  v_query := pg_catalog.btrim(p_query);
  v_status := p_status;
  v_offset := p_offset;
  v_limit := p_limit;

  -- This Platform-owned contract resolves only the signed-in active actor.
  SELECT profile.tenant_id, profile.role
    INTO v_tenant, v_role
  FROM public.platform_current_actor_profile() AS profile;

  IF v_tenant IS NULL OR pg_catalog.lower(v_role) <> 'admin'
    OR NOT EXISTS (
      SELECT 1
      FROM public.tenants AS tenant
      WHERE tenant.id = v_tenant
        AND tenant.status = 'active'
        AND tenant.product_key = 'bella_preschool'
    ) THEN
    RAISE EXCEPTION 'PRESCHOOL_REGISTRY_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  IF p_branch_id IS NOT NULL
    AND NOT public.preschool_branch_access(v_tenant, v_actor, p_branch_id, 'registry') THEN
    RAISE EXCEPTION 'PRESCHOOL_REGISTRY_BRANCH_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  IF p_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.preschool_chain_course_branch_assignments AS assignment
    WHERE assignment.tenant_id = v_tenant
      AND assignment.course_id = p_course_id
      AND (p_branch_id IS NULL OR assignment.branch_id = p_branch_id)
      AND public.preschool_course_assignment_visible(
        v_tenant, p_course_id, assignment.branch_id
      )
  ) THEN
    RAISE EXCEPTION 'PRESCHOOL_REGISTRY_COURSE_ACCESS_DENIED'
      USING ERRCODE = '42501';
  END IF;

  WITH visible_enrollments AS MATERIALIZED (
    SELECT DISTINCT
      student.student_id,
      student.tenant_id,
      student.party_id,
      student.student_code,
      party.display_name AS student_name,
      party.gender,
      party.dob,
      enrollment.id AS enrollment_id,
      course.id AS course_id,
      course.course_code,
      course.title AS course_title,
      enrollment_branch.branch_id,
      branch.name AS branch_name,
      enrollment.status AS enrollment_status
    FROM public.edu_enrollments AS enrollment
    JOIN public.edu_courses AS course
      ON course.id = enrollment.course_id
      AND course.tenant_id = enrollment.tenant_id
    JOIN public.students AS student
      ON student.tenant_id = enrollment.tenant_id
      AND student.party_id = enrollment.student_party_id
    JOIN public.party_parties AS party
      ON party.id = enrollment.student_party_id
      AND party.tenant_id = enrollment.tenant_id
      AND party.party_type = 'person'
      AND party.deleted_at IS NULL
    JOIN public.preschool_chain_enrollment_branch_assignments AS enrollment_branch
      ON enrollment_branch.tenant_id = enrollment.tenant_id
      AND enrollment_branch.enrollment_id = enrollment.id
      AND enrollment_branch.course_id = enrollment.course_id
      AND enrollment_branch.request_id::text = enrollment.request_id
    JOIN public.preschool_chain_course_branch_assignments AS course_branch
      ON course_branch.tenant_id = enrollment.tenant_id
      AND course_branch.course_id = enrollment.course_id
      AND course_branch.branch_id = enrollment_branch.branch_id
    JOIN public.org_units AS branch
      ON branch.id = enrollment_branch.branch_id
      AND branch.tenant_id = enrollment.tenant_id
      AND branch.unit_type = 'branch'
      AND branch.is_active = true
    WHERE enrollment.tenant_id = v_tenant
      AND enrollment.status IN ('active', 'pending')
      AND student.party_id IS NOT NULL
      AND pg_catalog.btrim(student.student_code) <> ''
      AND pg_catalog.btrim(party.display_name) <> ''
      AND public.preschool_enrollment_assignment_visible(
        v_tenant,
        enrollment.id,
        enrollment.course_id,
        enrollment_branch.branch_id,
        enrollment_branch.request_id
      )
  ), filtered_enrollments AS MATERIALIZED (
    SELECT visible.*
    FROM visible_enrollments AS visible
    WHERE (v_status = 'all' OR visible.enrollment_status = v_status)
      AND (p_course_id IS NULL OR visible.course_id = p_course_id)
      AND (p_branch_id IS NULL OR visible.branch_id = p_branch_id)
      AND (
        v_query = ''
        OR pg_catalog.strpos(pg_catalog.lower(visible.student_code), pg_catalog.lower(v_query)) > 0
        OR pg_catalog.strpos(pg_catalog.lower(visible.student_name), pg_catalog.lower(v_query)) > 0
      )
  ), totals AS (
    SELECT
      pg_catalog.count(DISTINCT visible.student_id)::integer AS students,
      pg_catalog.count(DISTINCT visible.student_id)
        FILTER (WHERE visible.enrollment_status = 'active')::integer AS active,
      pg_catalog.count(DISTINCT visible.student_id)
        FILTER (WHERE visible.enrollment_status = 'pending')::integer AS pending
    FROM visible_enrollments AS visible
  ), filtered_total AS (
    SELECT pg_catalog.count(DISTINCT filtered.student_id)::integer AS total
    FROM filtered_enrollments AS filtered
  ), page_students AS (
    SELECT
      filtered.student_id,
      pg_catalog.min(filtered.student_code) AS student_code,
      pg_catalog.min(filtered.student_name) AS student_name
    FROM filtered_enrollments AS filtered
    GROUP BY filtered.student_id
    ORDER BY pg_catalog.min(filtered.student_code),
      pg_catalog.min(filtered.student_name), filtered.student_id
    OFFSET v_offset
    LIMIT v_limit
  ), page_rows AS (
    SELECT
      page.student_code,
      page.student_name,
      page.student_id,
      pg_catalog.jsonb_build_object(
        'id', page.student_id,
        'tenantId', v_tenant,
        'partyId', pg_catalog.min(filtered.party_id::text)::uuid,
        'studentCode', page.student_code,
        'name', page.student_name,
        'gender', pg_catalog.min(filtered.gender),
        'dob', pg_catalog.min(filtered.dob),
        'enrollments', (
          SELECT coalesce(
            pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', item.enrollment_id,
                'courseId', item.course_id,
                'courseCode', item.course_code,
                'courseTitle', item.course_title,
                'branchId', item.branch_id,
                'branchName', item.branch_name,
                'status', item.enrollment_status
              ) ORDER BY item.course_code, item.branch_name, item.enrollment_id
            ),
            '[]'::jsonb
          )
          FROM filtered_enrollments AS item
          WHERE item.student_id = page.student_id
        )
      ) AS student_json
    FROM page_students AS page
    JOIN filtered_enrollments AS filtered
      ON filtered.student_id = page.student_id
    GROUP BY page.student_code, page.student_name, page.student_id
  ), page_data AS (
    SELECT coalesce(
      pg_catalog.jsonb_agg(
        page.student_json
        ORDER BY page.student_code, page.student_name, page.student_id
      ),
      '[]'::jsonb
    ) AS students
    FROM page_rows AS page
  )
  SELECT pg_catalog.jsonb_build_object(
    'tenantId', v_tenant,
    'request', pg_catalog.jsonb_build_object(
      'query', v_query,
      'status', v_status,
      'courseId', p_course_id,
      'branchId', p_branch_id,
      'offset', v_offset,
      'limit', v_limit
    ),
    'totals', pg_catalog.jsonb_build_object(
      'students', totals.students,
      'active', totals.active,
      'pending', totals.pending
    ),
    'filteredTotal', filtered_total.total,
    'nextOffset', CASE
      WHEN v_offset + v_limit < filtered_total.total
        AND v_offset + v_limit <= 100000 THEN v_offset + v_limit
      ELSE NULL
    END,
    'students', page_data.students
  )
  INTO v_result
  FROM totals
  CROSS JOIN filtered_total
  CROSS JOIN page_data;

  RETURN v_result;
END;
$registry$;

REVOKE ALL ON FUNCTION public.edu_preschool_student_registry(text, text, uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_student_registry(text, text, uuid, uuid, integer, integer)
  TO authenticated;

COMMENT ON FUNCTION public.edu_preschool_student_registry(text, text, uuid, uuid, integer, integer) IS
  'Education-owned Preschool student registry. Resolves the signed-in active admin and branch access server-side; returns only canonical active/pending enrollments with valid Preschool branch assignments.';

NOTIFY pgrst, 'reload schema';
COMMIT;
