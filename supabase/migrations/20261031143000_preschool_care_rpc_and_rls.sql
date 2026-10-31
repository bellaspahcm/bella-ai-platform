-- Migration: 20261031143000_preschool_care_rpc_and_rls.sql
-- Scope: Education Care — Define preschool_save_care_records RPC, edu_attendance_can_read_course, and align Care RLS

BEGIN;

-- ─── 1. Canonical course read helper for Preschool Attendance & Care ─────────
CREATE OR REPLACE FUNCTION public.edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_role text;
  v_product text;
  v_status text;
  v_branch uuid;
  v_count bigint;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' THEN
    RETURN false;
  END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL OR p_tenant_id IS NULL OR p_course_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT u.role, t.product_key INTO v_role, v_product
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor AND u.tenant_id = p_tenant_id AND u.status = 'active' AND t.status = 'active';
  IF NOT FOUND OR v_product IS NULL THEN
    RETURN false;
  END IF;
  SELECT c.status INTO v_status
  FROM public.edu_courses c
  WHERE c.id = p_course_id AND c.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_product <> 'bella_preschool' THEN
    RETURN true;
  END IF;
  IF v_role <> 'admin' OR v_status <> 'active' THEN
    RETURN false;
  END IF;
  SELECT count(*), (array_agg(a.branch_id))[1] INTO v_count, v_branch
  FROM public.preschool_chain_course_branch_assignments a
  WHERE a.tenant_id = p_tenant_id AND a.course_id = p_course_id;
  IF v_count <> 1 OR v_branch IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS(
    SELECT 1 FROM public.org_units b
    JOIN public.user_org_unit_access x ON x.org_unit_id = b.id AND x.tenant_id = b.tenant_id
    WHERE b.id = v_branch AND b.tenant_id = p_tenant_id AND b.unit_type = 'branch'
      AND b.is_active = true AND x.user_id = v_actor
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.edu_attendance_can_read_course(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edu_attendance_can_read_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edu_attendance_can_read_course(uuid, uuid) TO service_role;

-- ─── 2. Atomic RPC for daily care record persistence ─────────────────────────
CREATE OR REPLACE FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  rec jsonb;
  party_id uuid;
  v_session_id uuid;
  stamp timestamptz := clock_timestamp();
  count_saved integer := 0;
  affected integer;
BEGIN
  IF current_setting('role', true) <> 'authenticated' OR auth.uid() IS NULL
  OR p_day IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.tenant_id = p_tenant_id AND u.status = 'active' AND u.role = 'admin'
      AND t.status = 'active' AND t.product_key = 'bella_preschool'
  )
  OR NOT public.edu_attendance_can_read_course(p_tenant_id, p_course_id)
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CARE_ACCESS_DENIED';
  END IF;

  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_RECORDS';
  END IF;
  IF jsonb_array_length(p_records) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_TARGETS_REQUIRED';
  END IF;

  -- Validate every field and every target before creating a session or writing.
  FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    IF jsonb_typeof(rec) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_RECORD';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(rec) AS keys(key) WHERE keys.key NOT IN ('studentPartyId','meal','nap','hygiene','note'))
    OR jsonb_typeof(rec->'studentPartyId') IS DISTINCT FROM 'string'
    OR (rec ? 'note' AND jsonb_typeof(rec->'note') IS DISTINCT FROM 'string')
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_RECORD';
    END IF;
    party_id := (rec->>'studentPartyId')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.edu_enrollments e
      WHERE e.tenant_id = p_tenant_id
        AND e.course_id = p_course_id
        AND e.student_party_id = party_id
        AND e.status = 'active'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CARE_STUDENT_ACCESS_DENIED';
    END IF;

    IF rec ? 'meal' AND rec->'meal' IS NOT NULL AND rec->'meal' <> 'null'::jsonb THEN
      IF jsonb_typeof(rec->'meal') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_MEAL';
      END IF;
      IF coalesce(rec->'meal'->>'portion','') NOT IN ('ALL','HALF','FEW','NONE')
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'meal') AS keys(key) WHERE keys.key NOT IN ('portion','notes'))
      OR (rec->'meal' ? 'notes' AND jsonb_typeof(rec->'meal'->'notes') IS DISTINCT FROM 'string')
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_MEAL';
      END IF;
    END IF;

    IF rec ? 'nap' AND rec->'nap' IS NOT NULL AND rec->'nap' <> 'null'::jsonb THEN
      IF jsonb_typeof(rec->'nap') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_NAP';
      END IF;
      IF coalesce(rec->'nap'->>'quality','') NOT IN ('DEEP','RESTLESS','REFUSED')
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'nap') AS keys(key) WHERE keys.key NOT IN ('quality','notes'))
      OR (rec->'nap' ? 'notes' AND jsonb_typeof(rec->'nap'->'notes') IS DISTINCT FROM 'string')
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_NAP';
      END IF;
    END IF;

    IF rec ? 'hygiene' AND rec->'hygiene' IS NOT NULL AND rec->'hygiene' <> 'null'::jsonb THEN
      IF jsonb_typeof(rec->'hygiene') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_HYGIENE';
      END IF;
      IF coalesce(rec->'hygiene'->>'type','') NOT IN ('TOILET','DIAPER','BOWEL_MOVEMENT')
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'hygiene') AS keys(key) WHERE keys.key NOT IN ('type','notes'))
      OR (rec->'hygiene' ? 'notes' AND jsonb_typeof(rec->'hygiene'->'notes') IS DISTINCT FROM 'string')
      THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_INVALID_HYGIENE';
      END IF;
    END IF;
  END LOOP;

  IF (SELECT count(DISTINCT (v->>'studentPartyId')::uuid) FROM jsonb_array_elements(p_records) v) <> jsonb_array_length(p_records) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CARE_DUPLICATE_TARGET';
  END IF;

  INSERT INTO public.edu_daily_care_sessions(tenant_id, class_id, date, status)
  VALUES (p_tenant_id, p_course_id, p_day, 'OPEN')
  ON CONFLICT (tenant_id, class_id, date) DO NOTHING
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    SELECT s.id INTO STRICT v_session_id
    FROM public.edu_daily_care_sessions s
    WHERE s.tenant_id = p_tenant_id AND s.class_id = p_course_id AND s.date = p_day;
  END IF;

  FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    INSERT INTO public.edu_daily_care_records AS target(
      tenant_id, session_id, student_party_id, arrival_status, morning_condition,
      meal_records, nap_records, hygiene_records, updated_at
    )
    VALUES (
      p_tenant_id, v_session_id, (rec->>'studentPartyId')::uuid, 'PRESENT', coalesce(rec->>'note', ''),
      CASE WHEN rec->'meal' IS NOT NULL AND rec->'meal' <> 'null'::jsonb
        THEN jsonb_build_array(jsonb_build_object('mealType', 'LUNCH', 'portion', rec->'meal'->>'portion', 'notes', coalesce(rec->'meal'->>'notes', ''), 'recordedAt', stamp))
        ELSE '[]'::jsonb
      END,
      CASE WHEN rec->'nap' IS NOT NULL AND rec->'nap' <> 'null'::jsonb
        THEN jsonb_build_object('quality', rec->'nap'->>'quality', 'notes', coalesce(rec->'nap'->>'notes', ''), 'updatedAt', stamp)
        ELSE '{}'::jsonb
      END,
      CASE WHEN rec->'hygiene' IS NOT NULL AND rec->'hygiene' <> 'null'::jsonb
        THEN jsonb_build_array(jsonb_build_object('type', rec->'hygiene'->>'type', 'notes', coalesce(rec->'hygiene'->>'notes', ''), 'time', stamp))
        ELSE '[]'::jsonb
      END,
      stamp
    )
    ON CONFLICT (session_id, student_party_id) WHERE student_party_id IS NOT NULL
    DO UPDATE SET
      morning_condition = excluded.morning_condition,
      meal_records = excluded.meal_records,
      nap_records = excluded.nap_records,
      hygiene_records = excluded.hygiene_records,
      updated_at = excluded.updated_at
    WHERE target.tenant_id = p_tenant_id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'CARE_WRITE_NOT_CONFIRMED';
    END IF;
    count_saved := count_saved + 1;
  END LOOP;

  RETURN jsonb_build_object('savedCount', count_saved, 'total', jsonb_array_length(p_records));
END;
$function$;

REVOKE ALL ON FUNCTION public.preschool_save_care_records(uuid, uuid, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preschool_save_care_records(uuid, uuid, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_save_care_records(uuid, uuid, date, jsonb) TO service_role;

-- ─── 3. Reconcile RLS on care tables with canonical get_auth_tenant_id() ──────
DROP POLICY IF EXISTS edu_daily_care_sessions_tenant_isolation ON public.edu_daily_care_sessions;
CREATE POLICY edu_daily_care_sessions_tenant_isolation ON public.edu_daily_care_sessions
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id() OR current_setting('role', true) = 'service_role')
  WITH CHECK (tenant_id = public.get_auth_tenant_id() OR current_setting('role', true) = 'service_role');

DROP POLICY IF EXISTS edu_daily_care_records_tenant_isolation ON public.edu_daily_care_records;
CREATE POLICY edu_daily_care_records_tenant_isolation ON public.edu_daily_care_records
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id() OR current_setting('role', true) = 'service_role')
  WITH CHECK (tenant_id = public.get_auth_tenant_id() OR current_setting('role', true) = 'service_role');

COMMIT;
