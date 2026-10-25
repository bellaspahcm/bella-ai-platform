-- PROPOSAL ONLY. Not applied to E2E or Production.
-- Product-owned command; no Education/Platform Kernel source replacement.
-- Intended forward file: 20261024010000_preschool_handover_atomic_command.sql
BEGIN;

CREATE FUNCTION public.preschool_record_handover(
  p_tenant_id uuid,p_actor_id uuid,p_student_party_id uuid,
  p_guardian_party_id uuid,p_pickup_authorization_id uuid
) RETURNS SETOF public.edu_preschool_pickup_handover_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_event public.edu_preschool_pickup_handover_events%ROWTYPE;
  v_authorization public.edu_preschool_pickup_authorizations%ROWTYPE;
  v_role text; v_branches uuid[]; v_branch uuid; v_course uuid;
  v_day date; v_start timestamptz; v_end timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_TRUSTED_SERVER_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_tenant_id IS NULL OR p_student_party_id IS NULL OR p_guardian_party_id IS NULL
    OR p_pickup_authorization_id IS NULL OR p_student_party_id=p_guardian_party_id THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_ISOLATION_DENIED' USING ERRCODE='42501';
  END IF;
  -- Serialize even when today's event does not yet exist. The day is derived
  -- from the trusted DB clock, never from browser input or a new operation key.
  v_day:=(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'preschool-handover:'||p_tenant_id::text||':'||p_student_party_id::text,0));
  v_day:=(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_start:=v_day::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end:=(v_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';

  -- Acquire known write/FK waits before the final authority decision.
  LOCK TABLE public.edu_preschool_pickup_handover_events IN ROW EXCLUSIVE MODE;
  SELECT * INTO v_authorization FROM public.edu_preschool_pickup_authorizations a
    WHERE a.id=p_pickup_authorization_id AND a.tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR v_authorization.student_party_id IS DISTINCT FROM p_student_party_id
    OR v_authorization.guardian_party_id IS DISTINCT FROM p_guardian_party_id
    OR v_authorization.status IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND' USING ERRCODE='42501';
  END IF;
  -- Strong parent locks also serialize new enrollment FK inserts. Lock all of
  -- this student's existing enrollments, including ineligible rows, so status
  -- changes cannot introduce a second branch during a later authority wait.
  PERFORM 1 FROM public.party_parties p WHERE p.tenant_id=p_tenant_id
    AND p.id IN (p_student_party_id,p_guardian_party_id) ORDER BY p.id FOR UPDATE;
  IF (SELECT count(*) FROM public.party_parties p WHERE p.tenant_id=p_tenant_id
      AND p.id IN (p_student_party_id,p_guardian_party_id) AND p.party_type='person' AND p.deleted_at IS NULL)<>2 THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_PARTY_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
    AND e.student_party_id=p_student_party_id ORDER BY e.id FOR SHARE;
  -- Reuse assignment writer serialization, then lock course mappings before
  -- enrollment mappings in its established order. No new Platform primitive.
  FOR v_course IN SELECT DISTINCT e.course_id FROM public.edu_enrollments e
    WHERE e.tenant_id=p_tenant_id AND e.student_party_id=p_student_party_id ORDER BY e.course_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('preschool-course:'||p_tenant_id||':'||v_course,0));
  END LOOP;
  PERFORM 1 FROM public.preschool_chain_course_branch_assignments c WHERE c.tenant_id=p_tenant_id
    AND c.course_id IN (SELECT e.course_id FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
      AND e.student_party_id=p_student_party_id) ORDER BY c.course_id FOR SHARE;
  PERFORM 1 FROM public.preschool_chain_enrollment_branch_assignments a WHERE a.tenant_id=p_tenant_id
    AND a.enrollment_id IN (SELECT e.id FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
      AND e.student_party_id=p_student_party_id) ORDER BY a.id FOR SHARE;
  PERFORM 1 FROM public.edu_courses course WHERE course.tenant_id=p_tenant_id
    AND course.id IN (SELECT e.course_id FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
      AND e.student_party_id=p_student_party_id) ORDER BY course.id FOR SHARE;
  -- Do not silently discard an incomplete second enrollment while selecting a
  -- convenient valid branch from another row. Every current enrollment must
  -- reconcile before a student-level handover can have an unambiguous scope.
  IF EXISTS(SELECT 1 FROM public.edu_enrollments e
    LEFT JOIN public.preschool_chain_enrollment_branch_assignments a ON a.enrollment_id=e.id AND a.tenant_id=e.tenant_id
    LEFT JOIN public.preschool_chain_course_branch_assignments c ON c.course_id=e.course_id AND c.tenant_id=e.tenant_id
    LEFT JOIN public.edu_courses course ON course.id=e.course_id AND course.tenant_id=e.tenant_id
    WHERE e.tenant_id=p_tenant_id AND e.student_party_id=p_student_party_id AND e.status IN ('active','pending')
      AND (a.id IS NULL OR c.id IS NULL OR course.id IS NULL OR a.course_id IS DISTINCT FROM e.course_id
        OR a.request_id::text IS DISTINCT FROM e.request_id OR a.branch_id IS DISTINCT FROM c.branch_id)) THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_BRANCH_MAPPING_CONFLICT' USING ERRCODE='23505';
  END IF;
  SELECT array_agg(DISTINCT a.branch_id) INTO v_branches
    FROM public.preschool_chain_enrollment_branch_assignments a
    JOIN public.edu_enrollments e ON e.id=a.enrollment_id AND e.tenant_id=a.tenant_id
    JOIN public.preschool_chain_course_branch_assignments c ON c.course_id=a.course_id AND c.tenant_id=a.tenant_id
    JOIN public.edu_courses course ON course.id=e.course_id AND course.tenant_id=e.tenant_id
    WHERE a.tenant_id=p_tenant_id AND e.student_party_id=p_student_party_id
      AND e.status IN ('active','pending') AND e.course_id=a.course_id AND e.request_id=a.request_id::text
      AND c.branch_id=a.branch_id;
  -- No first-branch/default-campus fallback for missing or ambiguous mapping.
  IF coalesce(array_length(v_branches,1),0)<>1 THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_BRANCH_MAPPING_CONFLICT' USING ERRCODE='23505';
  END IF;
  -- Existing-row recovery can itself wait. Take that lock before authorization.
  IF (SELECT count(*) FROM public.edu_preschool_pickup_handover_events h
    WHERE h.tenant_id=p_tenant_id AND h.student_party_id=p_student_party_id
      AND h.handed_over_at>=v_start AND h.handed_over_at<v_end)>1 THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_HISTORY_REQUIRES_REVIEW' USING ERRCODE='23505';
  END IF;
  SELECT * INTO v_event FROM public.edu_preschool_pickup_handover_events h
    WHERE h.tenant_id=p_tenant_id AND h.student_party_id=p_student_party_id
      AND h.handed_over_at>=v_start AND h.handed_over_at<v_end FOR UPDATE;
  v_branch:=v_branches[1];
  PERFORM 1 FROM public.org_units b WHERE b.id=v_branch AND b.tenant_id=p_tenant_id
    AND b.unit_type='branch' AND b.is_active=true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRESCHOOL_HANDOVER_BRANCH_DENIED' USING ERRCODE='42501'; END IF;
  SELECT lower(btrim(u.role)) INTO v_role FROM public.users u
    JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id
    WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active'
      AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
    FOR SHARE OF u,a,t;
  IF v_role IS NULL OR v_role NOT IN ('admin','super_admin','admin_staff') THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_ACTOR_DENIED' USING ERRCODE='42501';
  END IF;
  -- The existing Platform projection owns access derivation. Preserve the
  -- current handover API's action roles/admin behavior; no Finance policy change.
  IF NOT EXISTS(SELECT 1 FROM public.platform_org_unit_access_for_actor(p_tenant_id,p_actor_id) a
    WHERE a.tenant_id=p_tenant_id AND a.user_id=p_actor_id AND a.org_unit_id=v_branch
      AND ((v_role IN ('admin','super_admin') AND a.access_source='tenant_admin')
        OR (a.relationship_id IS NOT NULL AND a.access_source IN ('belongs_to','manages','participates_in')))) THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_BRANCH_DENIED' USING ERRCODE='42501';
  END IF;

  -- A wait spanning the school-day boundary must restart, not recover yesterday.
  IF (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date IS DISTINCT FROM v_day THEN
    RAISE EXCEPTION 'PRESCHOOL_HANDOVER_DAY_CHANGED_RETRY' USING ERRCODE='40001';
  END IF;
  -- Recovery is authorized exactly like a new command, after the same waits.
  IF v_event.id IS NOT NULL THEN
    IF v_event.guardian_party_id IS DISTINCT FROM p_guardian_party_id
      OR v_event.pickup_authorization_id IS DISTINCT FROM p_pickup_authorization_id THEN
      RAISE EXCEPTION 'STUDENT_ALREADY_HANDED_OVER_TODAY' USING ERRCODE='23505';
    END IF;
    RETURN NEXT v_event; RETURN;
  END IF;
  INSERT INTO public.edu_preschool_pickup_handover_events(
    tenant_id,student_party_id,guardian_party_id,pickup_authorization_id,handed_over_by,handed_over_at)
    VALUES(p_tenant_id,p_student_party_id,p_guardian_party_id,p_pickup_authorization_id,p_actor_id,clock_timestamp())
    RETURNING * INTO v_event;
  RETURN NEXT v_event;
END;
$$;
REVOKE ALL ON FUNCTION public.preschool_record_handover(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preschool_record_handover(uuid,uuid,uuid,uuid,uuid) TO service_role;
COMMIT;
