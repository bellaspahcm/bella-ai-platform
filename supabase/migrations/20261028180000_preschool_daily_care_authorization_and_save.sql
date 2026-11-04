-- Preschool Daily Care: current-caller branch access and atomic UI save.
-- Depends on 20260909000052_p42_daily_care_operations and
-- 20260927040000_preschool_daily_care_canonical_student_party.
-- This does not grant access to the shared DB or Production by itself.

CREATE OR REPLACE FUNCTION public.preschool_daily_care_access_allowed(
  p_tenant_id uuid,
  p_course_id uuid,
  p_school_day date,
  p_student_party_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_tenant_id uuid;
  v_actor_role text;
  v_product_key text;
  v_matching_enrollments bigint;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
    OR p_tenant_id IS NULL OR p_course_id IS NULL OR p_school_day IS NULL THEN
    RETURN false;
  END IF;

  SELECT actor.tenant_id, lower(actor.role)
    INTO v_actor_tenant_id, v_actor_role
  FROM public.platform_current_actor_profile() AS actor
  WHERE actor.id = auth.uid();
  IF NOT FOUND OR v_actor_tenant_id IS DISTINCT FROM p_tenant_id OR v_actor_role IS NULL
    OR v_actor_role NOT IN ('admin', 'admin_staff') THEN
    RETURN false;
  END IF;

  SELECT tenant.product_key
    INTO v_product_key
  FROM public.platform_current_actor_tenant_presentation() AS tenant
  WHERE tenant.tenant_id = v_actor_tenant_id;
  IF NOT FOUND OR v_product_key IS DISTINCT FROM 'bella_preschool'
    OR p_school_day <> (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN false;
  END IF;

  IF p_student_party_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.edu_enrollments AS enrollment
      JOIN public.edu_courses AS course
        ON course.id = enrollment.course_id AND course.tenant_id = enrollment.tenant_id
      JOIN public.preschool_chain_course_branch_assignments AS assignment
        ON assignment.tenant_id = enrollment.tenant_id AND assignment.course_id = enrollment.course_id
      JOIN public.preschool_chain_enrollment_branch_assignments AS binding
        ON binding.tenant_id = enrollment.tenant_id AND binding.enrollment_id = enrollment.id
        AND binding.course_id = enrollment.course_id AND binding.branch_id = assignment.branch_id
        AND binding.request_id::text = enrollment.request_id
      WHERE enrollment.tenant_id = p_tenant_id
        AND enrollment.course_id = p_course_id
        AND enrollment.status = 'active'
        AND course.status = 'active'
        AND enrollment.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND CASE WHEN v_actor_role = 'admin_staff'
          THEN public.preschool_teacher_can_attend_course(p_tenant_id, enrollment.course_id, p_school_day, assignment.branch_id)
          ELSE public.edu_can_access_attendance_enrollment(p_tenant_id, enrollment.id, p_school_day)
        END
    );
  END IF;

  SELECT count(*)
    INTO v_matching_enrollments
  FROM public.edu_enrollments AS enrollment
  JOIN public.edu_courses AS course
    ON course.id = enrollment.course_id AND course.tenant_id = enrollment.tenant_id
  JOIN public.preschool_chain_course_branch_assignments AS assignment
    ON assignment.tenant_id = enrollment.tenant_id AND assignment.course_id = enrollment.course_id
  JOIN public.preschool_chain_enrollment_branch_assignments AS binding
    ON binding.tenant_id = enrollment.tenant_id AND binding.enrollment_id = enrollment.id
    AND binding.course_id = enrollment.course_id AND binding.branch_id = assignment.branch_id
    AND binding.request_id::text = enrollment.request_id
  WHERE enrollment.tenant_id = p_tenant_id
    AND enrollment.course_id = p_course_id
    AND enrollment.student_party_id = p_student_party_id
    AND enrollment.status = 'active'
    AND course.status = 'active'
    AND enrollment.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND CASE WHEN v_actor_role = 'admin_staff'
      THEN public.preschool_teacher_can_attend_course(p_tenant_id, enrollment.course_id, p_school_day, assignment.branch_id)
      ELSE public.edu_can_access_attendance_enrollment(p_tenant_id, enrollment.id, p_school_day)
    END;

  RETURN v_matching_enrollments = 1;
EXCEPTION
  WHEN insufficient_privilege THEN RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.preschool_daily_care_access_allowed(uuid, uuid, date, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_daily_care_access_allowed(uuid, uuid, date, uuid)
  TO authenticated;

ALTER TABLE public.edu_daily_care_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_daily_care_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edu_daily_care_sessions_tenant_isolation ON public.edu_daily_care_sessions;
DROP POLICY IF EXISTS edu_daily_care_records_tenant_isolation ON public.edu_daily_care_records;
DROP POLICY IF EXISTS edu_daily_care_sessions_authorized_select ON public.edu_daily_care_sessions;
DROP POLICY IF EXISTS edu_daily_care_sessions_authorized_insert ON public.edu_daily_care_sessions;
DROP POLICY IF EXISTS edu_daily_care_records_authorized_select ON public.edu_daily_care_records;
DROP POLICY IF EXISTS edu_daily_care_records_authorized_insert ON public.edu_daily_care_records;
DROP POLICY IF EXISTS edu_daily_care_records_authorized_update ON public.edu_daily_care_records;

CREATE POLICY edu_daily_care_sessions_authorized_select
  ON public.edu_daily_care_sessions
  FOR SELECT TO authenticated
  USING (public.preschool_daily_care_access_allowed(tenant_id, class_id, date));

CREATE POLICY edu_daily_care_sessions_authorized_insert
  ON public.edu_daily_care_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.preschool_daily_care_access_allowed(tenant_id, class_id, date));

CREATE POLICY edu_daily_care_records_authorized_select
  ON public.edu_daily_care_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.edu_daily_care_sessions AS session
      WHERE session.id = edu_daily_care_records.session_id
        AND session.tenant_id = edu_daily_care_records.tenant_id
        AND public.preschool_daily_care_access_allowed(
          session.tenant_id, session.class_id, session.date, edu_daily_care_records.student_party_id
        )
    )
  );

CREATE POLICY edu_daily_care_records_authorized_insert
  ON public.edu_daily_care_records
  FOR INSERT TO authenticated
  WITH CHECK (
    student_party_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.edu_daily_care_sessions AS session
      WHERE session.id = edu_daily_care_records.session_id
        AND session.tenant_id = edu_daily_care_records.tenant_id
        AND public.preschool_daily_care_access_allowed(
          session.tenant_id, session.class_id, session.date, edu_daily_care_records.student_party_id
        )
    )
  );

CREATE POLICY edu_daily_care_records_authorized_update
  ON public.edu_daily_care_records
  FOR UPDATE TO authenticated
  USING (
    student_party_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.edu_daily_care_sessions AS session
      WHERE session.id = edu_daily_care_records.session_id
        AND session.tenant_id = edu_daily_care_records.tenant_id
        AND public.preschool_daily_care_access_allowed(
          session.tenant_id, session.class_id, session.date, edu_daily_care_records.student_party_id
        )
    )
  )
  WITH CHECK (
    student_party_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.edu_daily_care_sessions AS session
      WHERE session.id = edu_daily_care_records.session_id
        AND session.tenant_id = edu_daily_care_records.tenant_id
        AND public.preschool_daily_care_access_allowed(
          session.tenant_id, session.class_id, session.date, edu_daily_care_records.student_party_id
        )
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.edu_daily_care_sessions, public.edu_daily_care_records
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.edu_daily_care_sessions TO authenticated;
GRANT SELECT ON TABLE public.edu_daily_care_records TO authenticated;
GRANT INSERT (tenant_id, session_id, student_party_id, arrival_status) ON TABLE public.edu_daily_care_records TO authenticated;
GRANT UPDATE (arrival_status, arrival_time, morning_condition, meal_records, hygiene_records, nap_records, updated_at)
  ON TABLE public.edu_daily_care_records TO authenticated;

CREATE OR REPLACE FUNCTION public.preschool_save_care_records(
  p_tenant_id uuid,
  p_course_id uuid,
  p_day date,
  p_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item jsonb;
  v_party_id uuid;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_count integer;
  v_session_id uuid;
  v_note text;
  v_now timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
    OR p_tenant_id IS NULL OR p_course_id IS NULL OR p_day IS NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_CARE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_records) < 1 OR jsonb_array_length(p_records) > 200 THEN
    RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORDS' USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_records);

  -- Validate every item and authorization before creating any session or record.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_records) AS value LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_item) AS item_key(key)
        WHERE key NOT IN ('studentPartyId', 'meal', 'nap', 'hygiene', 'note')
      )
      OR jsonb_typeof(v_item->'studentPartyId') IS DISTINCT FROM 'string'
      OR (v_item ? 'note' AND jsonb_typeof(v_item->'note') IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORD' USING ERRCODE = '22023';
    END IF;

    v_party_id := NULLIF(btrim(v_item->>'studentPartyId'), '')::uuid;
    IF v_party_id IS NULL OR v_party_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORD' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_party_id);

    IF v_item ? 'meal' AND v_item->'meal' <> 'null'::jsonb THEN
      IF jsonb_typeof(v_item->'meal') IS DISTINCT FROM 'object'
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item->'meal') AS item_key(key) WHERE key NOT IN ('portion', 'notes'))
        OR COALESCE(v_item->'meal'->>'portion', '') NOT IN ('ALL', 'HALF', 'FEW', 'NONE')
        OR (v_item->'meal' ? 'notes' AND jsonb_typeof(v_item->'meal'->'notes') IS DISTINCT FROM 'string') THEN
        RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORD' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_item ? 'nap' AND v_item->'nap' <> 'null'::jsonb THEN
      IF jsonb_typeof(v_item->'nap') IS DISTINCT FROM 'object'
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item->'nap') AS item_key(key) WHERE key NOT IN ('quality', 'notes'))
        OR COALESCE(v_item->'nap'->>'quality', '') NOT IN ('DEEP', 'RESTLESS', 'REFUSED')
        OR (v_item->'nap' ? 'notes' AND jsonb_typeof(v_item->'nap'->'notes') IS DISTINCT FROM 'string') THEN
        RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORD' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_item ? 'hygiene' AND v_item->'hygiene' <> 'null'::jsonb THEN
      IF jsonb_typeof(v_item->'hygiene') IS DISTINCT FROM 'object'
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item->'hygiene') AS item_key(key) WHERE key NOT IN ('type', 'notes'))
        OR COALESCE(v_item->'hygiene'->>'type', '') NOT IN ('TOILET', 'DIAPER', 'BOWEL_MOVEMENT')
        OR (v_item->'hygiene' ? 'notes' AND jsonb_typeof(v_item->'hygiene'->'notes') IS DISTINCT FROM 'string') THEN
        RAISE EXCEPTION 'PRESCHOOL_CARE_INVALID_RECORD' USING ERRCODE = '22023';
      END IF;
    END IF;

    IF NOT public.preschool_daily_care_access_allowed(p_tenant_id, p_course_id, p_day, v_party_id) THEN
      RAISE EXCEPTION 'PRESCHOOL_CARE_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    v_note := COALESCE(v_item->>'note', '');
  END LOOP;

  INSERT INTO public.edu_daily_care_sessions (tenant_id, class_id, date, updated_at)
  VALUES (p_tenant_id, p_course_id, p_day, clock_timestamp())
  ON CONFLICT (tenant_id, class_id, date)
  DO UPDATE SET updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_session_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_records) AS value LOOP
    v_party_id := (v_item->>'studentPartyId')::uuid;
    v_note := COALESCE(v_item->>'note', '');
    v_now := clock_timestamp();

    INSERT INTO public.edu_daily_care_records (
      tenant_id, session_id, student_id, student_party_id, arrival_status,
      morning_condition, meal_records, hygiene_records, nap_records, updated_at
    ) VALUES (
      p_tenant_id, v_session_id, NULL, v_party_id, NULL,
      NULLIF(v_note, ''),
      CASE WHEN v_item->'meal' IS NULL OR v_item->'meal' = 'null'::jsonb THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object(
          'portion', v_item->'meal'->>'portion',
          'notes', COALESCE(v_item->'meal'->>'notes', ''),
          'recordedAt', v_now
        )) END,
      CASE WHEN v_item->'hygiene' IS NULL OR v_item->'hygiene' = 'null'::jsonb THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object(
          'type', v_item->'hygiene'->>'type',
          'notes', COALESCE(v_item->'hygiene'->>'notes', ''),
          'time', v_now
        )) END,
      CASE WHEN v_item->'nap' IS NULL OR v_item->'nap' = 'null'::jsonb THEN '{}'::jsonb
        ELSE jsonb_build_object(
          'quality', v_item->'nap'->>'quality',
          'notes', COALESCE(v_item->'nap'->>'notes', ''),
          'updatedAt', v_now
        ) END,
      v_now
    )
    ON CONFLICT (session_id, student_party_id) WHERE student_party_id IS NOT NULL
    DO UPDATE SET
      morning_condition = EXCLUDED.morning_condition,
      meal_records = EXCLUDED.meal_records,
      hygiene_records = EXCLUDED.hygiene_records,
      nap_records = EXCLUDED.nap_records,
      updated_at = EXCLUDED.updated_at;
  END LOOP;

  RETURN jsonb_build_object('savedCount', v_count, 'total', v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.preschool_save_care_records(uuid, uuid, date, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_save_care_records(uuid, uuid, date, jsonb)
  TO authenticated;
