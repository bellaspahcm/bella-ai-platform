-- Owner-approved section7 A+B. Owned T1 only; metadata, no business-row copy. Default ROLLBACK.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('bella.t1_full_scope',true) IS DISTINCT FROM 'APPROVED_SECTION7_AB' OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')) THEN RAISE EXCEPTION 'T1_EMPTY_OWNED_BASELINE_REQUIRED'; END IF; END $$;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- PostgreSQL database dump
--



-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6



SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--




--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;


--
-- Name: edu_attendance_can_read_course(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE v_actor uuid; v_role text; v_product text; v_status text; v_branch uuid; v_count bigint;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' THEN RETURN false; END IF;
 v_actor:=auth.uid();
 IF v_actor IS NULL OR p_tenant_id IS NULL OR p_course_id IS NULL THEN RETURN false; END IF;
 SELECT u.role,t.product_key INTO v_role,v_product FROM public.users u
 JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=v_actor AND u.tenant_id=p_tenant_id AND u.status='active' AND t.status='active';
 IF NOT FOUND OR v_product IS NULL THEN RETURN false; END IF;
 SELECT c.status INTO v_status FROM public.edu_courses c
 WHERE c.id=p_course_id AND c.tenant_id=p_tenant_id;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Universal persisted provider/profile/tenant condition. Do not invent another
 -- Product's role or lifecycle matrix.
 IF v_product <> 'bella_preschool' THEN RETURN true; END IF;
 IF v_role <> 'admin' OR v_status <> 'active' THEN RETURN false; END IF;
 SELECT count(*),(array_agg(a.branch_id))[1] INTO v_count,v_branch
 FROM public.preschool_chain_course_branch_assignments a
 WHERE a.tenant_id=p_tenant_id AND a.course_id=p_course_id;
 IF v_count<>1 OR v_branch IS NULL THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.org_units b
 JOIN public.user_org_unit_access x ON x.org_unit_id=b.id AND x.tenant_id=b.tenant_id
 WHERE b.id=v_branch AND b.tenant_id=p_tenant_id AND b.unit_type='branch'
 AND b.is_active AND x.user_id=v_actor AND x.relationship_id IS NOT NULL);
END;
$$;


--
-- Name: edu_can_access_attendance_enrollment(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_product text;
  v_course uuid;
  v_branch uuid;
  v_binding_count bigint;
BEGIN
  -- PostgreSQL validates SET ROLE membership. This is NOT request.jwt.claim.role,
  -- current_user (the definer), or a caller-controlled custom app GUC.
  IF current_setting('role', true) = 'service_role' THEN RETURN true; END IF;
  IF current_setting('role', true) <> 'authenticated' THEN RETURN false; END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL OR p_school_day IS NULL THEN
    RETURN false;
  END IF;
  SELECT u.role, t.product_key INTO v_role, v_product
  FROM public.users u JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = v_actor AND u.tenant_id = p_tenant_id
    AND u.status = 'active' AND t.status = 'active';
  IF NOT FOUND OR v_product IS NULL THEN RETURN false; END IF;
  SELECT e.course_id INTO v_course FROM public.edu_enrollments e
  JOIN public.edu_courses c ON c.id = e.course_id AND c.tenant_id = e.tenant_id
  WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Non-Preschool Products retain their existing business authorization semantics.
  -- The new universal condition is verified provider subject/current tenant only.
  IF v_product <> 'bella_preschool' THEN RETURN true; END IF;
  -- No authoritative Auth -> teacher Party producer is available: admin_staff held.
  IF v_role <> 'admin' OR p_school_day <> (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c
      ON c.id = e.course_id AND c.tenant_id = e.tenant_id
    WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id AND e.course_id = v_course
      AND e.status = 'active' AND c.status = 'active'
      AND e.enrolled_at < ((p_school_day + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ) THEN RETURN false; END IF;
  SELECT count(*), (array_agg(a.branch_id))[1] INTO v_binding_count, v_branch
  FROM public.preschool_chain_course_branch_assignments a
  WHERE a.tenant_id = p_tenant_id AND a.course_id = v_course;
  IF v_binding_count <> 1 OR v_branch IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.org_units b
    JOIN public.user_org_unit_access a ON a.org_unit_id = b.id AND a.tenant_id = b.tenant_id
    WHERE b.id = v_branch AND b.tenant_id = p_tenant_id AND b.unit_type = 'branch' AND b.is_active
      AND a.user_id = v_actor AND a.relationship_id IS NOT NULL
  );
END;
$$;


--
-- Name: edu_preschool_enroll_student(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_preschool_enroll_student(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    SET lock_timeout TO '5s'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_branch uuid;
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_course public.edu_courses%ROWTYPE;
  v_enrollment public.edu_enrollments%ROWTYPE;
  v_count bigint;
  v_duplicate boolean := false;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_course_id IS NULL OR p_student_party_id IS NULL OR p_guardian_party_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT u.tenant_id INTO v_tenant FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
    WHERE u.id = v_actor AND u.status = 'active' AND u.role = 'admin' FOR SHARE OF u, t;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  -- Lock order: request key -> canonical Student identity -> Course.
  -- A shared Student lock target serializes credit decisions across different Courses.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text || ':' || p_request_id::text, 0));
  PERFORM 1 FROM public.party_parties p WHERE p.id = p_student_party_id AND p.tenant_id = v_tenant
    AND p.party_type = 'person' AND p.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENROLLMENT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant FOR SHARE;
  IF (SELECT count(*) FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.students s WHERE s.party_id = p_student_party_id AND s.tenant_id = v_tenant AND s.academic_status = 'enrolled') THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_course FROM public.edu_courses c WHERE c.id = p_course_id AND c.tenant_id = v_tenant AND c.status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENROLLMENT_COURSE_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.preschool_chain_course_branch_assignments a
    WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id FOR SHARE;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id) <> 1 THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_SCOPE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT a.branch_id INTO v_branch FROM public.preschool_chain_course_branch_assignments a
    JOIN public.org_units b ON b.id = a.branch_id AND b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active
    WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id FOR SHARE OF b;
  IF v_branch IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_org_unit_access a
      WHERE a.user_id = v_actor AND a.tenant_id = v_tenant AND a.org_unit_id = v_branch AND a.relationship_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.party_parties p WHERE p.id = p_guardian_party_id AND p.tenant_id = v_tenant
    AND p.deleted_at IS NULL AND p.id <> p_student_party_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.party_relationships r WHERE r.tenant_id = v_tenant
    AND r.source_party_id = p_guardian_party_id AND r.target_party_id = p_student_party_id
    AND r.relationship_type IN ('guardian_of', 'parent_of') FOR SHARE;
  IF (SELECT count(*) FROM public.party_relationships r WHERE r.tenant_id = v_tenant
      AND r.source_party_id = p_guardian_party_id AND r.target_party_id = p_student_party_id
      AND r.relationship_type IN ('guardian_of', 'parent_of')
      AND (r.active_from IS NULL OR r.active_from <= v_day) AND (r.active_to IS NULL OR r.active_to >= v_day)) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.party_relationships r WHERE r.tenant_id = v_tenant
      AND r.source_party_id = p_guardian_party_id AND r.target_party_id = p_student_party_id AND r.relationship_type = 'guardian_of'
      AND (r.active_from IS NULL OR r.active_from <= v_day) AND (r.active_to IS NULL OR r.active_to >= v_day)) THEN
    RAISE EXCEPTION 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_enrollment FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant AND e.request_id = p_request_id::text;
  IF FOUND THEN
    IF v_enrollment.student_party_id <> p_student_party_id OR v_enrollment.course_id <> p_course_id OR v_enrollment.status <> 'active' THEN
      RAISE EXCEPTION 'ENROLLMENT_REQUEST_CONFLICT' USING ERRCODE = '23505';
    END IF;
    v_duplicate := true;
  ELSE
    IF EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant AND e.student_party_id = p_student_party_id AND e.course_id = p_course_id) THEN
      RAISE EXCEPTION 'ENROLLMENT_ALREADY_EXISTS' USING ERRCODE = '23505';
    END IF;
    IF coalesce(cardinality(v_course.prerequisite_course_codes), 0) <> 0 THEN
      RAISE EXCEPTION 'ENROLLMENT_GOVERNED_PREREQUISITES_UNAVAILABLE' USING ERRCODE = '0A000';
    END IF;
    SELECT count(*) INTO v_count FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant
      AND e.student_party_id = p_student_party_id AND e.status IN ('active', 'pending');
    -- Constitution III.1 + existing engine's 3-credit mapping. Conservative across
    -- all active/pending registrations because this schema has no semester key.
    IF v_count + 1 > 6 OR (v_count + 1) * 3 > 24 THEN
      RAISE EXCEPTION 'ENROLLMENT_CREDIT_LIMIT' USING ERRCODE = '23514';
    END IF;
    IF v_course.current_enrollment IS NULL OR (v_course.max_students IS NOT NULL AND (
        v_course.current_enrollment >= v_course.max_students OR
        (SELECT count(*) FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant
          AND e.course_id = p_course_id AND e.status IN ('active', 'pending')) >= v_course.max_students)) THEN
      RAISE EXCEPTION 'ENROLLMENT_CAPACITY_UNAVAILABLE' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.edu_enrollments(tenant_id, student_party_id, course_id, status, enrolled_at, request_id)
      VALUES(v_tenant, p_student_party_id, p_course_id, 'active', statement_timestamp(), p_request_id::text)
      RETURNING * INTO v_enrollment;
    UPDATE public.edu_courses SET current_enrollment = current_enrollment + 1, updated_at = statement_timestamp()
      WHERE id = p_course_id AND tenant_id = v_tenant;
  END IF;
  RETURN jsonb_build_object('enrollment', jsonb_build_object('id', v_enrollment.id, 'tenantId', v_enrollment.tenant_id,
    'studentPartyId', v_enrollment.student_party_id, 'courseId', v_enrollment.course_id,
    'status', v_enrollment.status, 'enrolledAt', v_enrollment.enrolled_at), 'isDuplicate', v_duplicate);
END
$$;


--
-- Name: edu_preschool_enrollment_candidates(uuid, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_preschool_enrollment_candidates(p_course_id uuid, p_query text, p_limit integer DEFAULT 20, p_cursor uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_branch uuid;
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_ids uuid[];
  v_next uuid;
  v_party record;
  v_guardians jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_prerequisites text[];
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_course_id IS NULL OR p_query IS NULL OR char_length(btrim(p_query)) NOT BETWEEN 2 AND 80
     OR p_query ~ '[[:cntrl:]*]' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'ENROLLMENT_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT u.tenant_id INTO v_tenant FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
    WHERE u.id = v_actor AND u.status = 'active' AND u.role = 'admin';
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'ENROLLMENT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  SELECT c.prerequisite_course_codes INTO v_prerequisites FROM public.edu_courses c
    WHERE c.id = p_course_id AND c.tenant_id = v_tenant AND c.status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'ENROLLMENT_COURSE_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a
      WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id) <> 1 THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_SCOPE_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT a.branch_id INTO v_branch FROM public.preschool_chain_course_branch_assignments a
    JOIN public.org_units b ON b.id = a.branch_id AND b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active
    WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id;
  IF v_branch IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_org_unit_access a
      WHERE a.user_id = v_actor AND a.tenant_id = v_tenant AND a.org_unit_id = v_branch AND a.relationship_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ENROLLMENT_BRANCH_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  -- Governed prerequisite evaluation is outside this narrow SQL capability.
  -- Do not invent a passing threshold or silently accept a prerequisite Course.
  IF coalesce(cardinality(v_prerequisites), 0) <> 0 THEN
    RAISE EXCEPTION 'ENROLLMENT_GOVERNED_PREREQUISITES_UNAVAILABLE' USING ERRCODE = '0A000';
  END IF;
  SELECT array_agg(p.id ORDER BY p.id) INTO v_ids FROM (
    SELECT p.id FROM public.party_parties p WHERE p.tenant_id = v_tenant
      AND p.party_type = 'person' AND p.deleted_at IS NULL AND btrim(p.display_name) <> ''
      AND strpos(lower(p.display_name), lower(btrim(p_query))) > 0
      AND (p_cursor IS NULL OR p.id > p_cursor) ORDER BY p.id LIMIT p_limit + 1
  ) p;
  IF cardinality(v_ids) > p_limit THEN v_next := v_ids[p_limit]; END IF;
  FOR v_party IN SELECT p.id, p.display_name FROM public.party_parties p
    WHERE p.tenant_id = v_tenant AND p.id = ANY(v_ids[1:p_limit]) ORDER BY p.id
  LOOP
    IF (SELECT count(*) FROM public.students s WHERE s.tenant_id = v_tenant AND s.party_id = v_party.id) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.students s WHERE s.tenant_id = v_tenant AND s.party_id = v_party.id AND s.academic_status = 'enrolled')
       OR EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant AND e.student_party_id = v_party.id AND e.course_id = p_course_id)
       -- Complete private counts include pending rows hidden by roster RLS.
       -- Constitution III.1 caps registrations at six; engine maps one to 3 credits.
       -- No term key exists here: count all active/pending, never assume an absent term.
       OR (SELECT count(*) FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant AND e.student_party_id = v_party.id AND e.status IN ('active', 'pending')) >= 6 THEN
      CONTINUE;
    END IF;
    SELECT jsonb_agg(jsonb_build_object('guardianPartyId', g.id, 'guardianLabel', g.display_name) ORDER BY g.id)
      INTO v_guardians FROM public.party_relationships r
      JOIN public.party_parties g ON g.id = r.source_party_id AND g.tenant_id = v_tenant
        AND g.deleted_at IS NULL AND btrim(g.display_name) <> ''
      WHERE r.tenant_id = v_tenant AND r.target_party_id = v_party.id AND r.relationship_type = 'guardian_of'
        AND r.source_party_id <> r.target_party_id
        AND (r.active_from IS NULL OR r.active_from <= v_day) AND (r.active_to IS NULL OR r.active_to >= v_day)
        AND (SELECT count(*) FROM public.party_relationships x WHERE x.tenant_id = v_tenant
          AND x.source_party_id = r.source_party_id AND x.target_party_id = r.target_party_id
          AND x.relationship_type IN ('guardian_of', 'parent_of')
          AND (x.active_from IS NULL OR x.active_from <= v_day) AND (x.active_to IS NULL OR x.active_to >= v_day)) = 1;
    IF jsonb_array_length(coalesce(v_guardians, '[]'::jsonb)) > 100 THEN
      RAISE EXCEPTION 'ENROLLMENT_GUARDIAN_SCOPE_UNAVAILABLE' USING ERRCODE = '54000';
    END IF;
    IF coalesce(jsonb_array_length(v_guardians), 0) > 0 THEN
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'studentPartyId', v_party.id, 'studentLabel', v_party.display_name, 'guardians', v_guardians));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('tenantId', v_tenant, 'courseId', p_course_id, 'candidates', v_candidates, 'nextCursor', v_next);
END
$$;


--
-- Name: edu_preschool_roster_identity(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_preschool_roster_identity(p_course_id uuid, p_school_day date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    SET lock_timeout TO '5s'
    AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid; v_branch uuid; v_roster jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL
 OR p_course_id IS NULL OR p_school_day IS DISTINCT FROM (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT u.tenant_id INTO v_tenant FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=v_actor AND u.status='active' AND u.role='admin' AND t.status='active' AND t.product_key='bella_preschool';
 IF v_tenant IS NULL OR NOT EXISTS(SELECT 1 FROM public.edu_courses c WHERE c.id=p_course_id AND c.tenant_id=v_tenant AND c.status='active')
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a WHERE a.tenant_id=v_tenant AND a.course_id=p_course_id)<>1
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 SELECT a.branch_id INTO v_branch FROM public.preschool_chain_course_branch_assignments a
 JOIN public.org_units b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id AND b.unit_type='branch' AND b.is_active
 WHERE a.tenant_id=v_tenant AND a.course_id=p_course_id;
 IF v_branch IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_org_unit_access a WHERE a.tenant_id=v_tenant AND a.user_id=v_actor
 AND a.org_unit_id=v_branch AND a.relationship_id IS NOT NULL)
 THEN RAISE EXCEPTION 'ROSTER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
 AND ((SELECT count(*) FROM public.students s WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id)<>1
 OR NOT EXISTS(SELECT 1 FROM public.students s JOIN public.party_parties p ON p.id=s.party_id AND p.tenant_id=s.tenant_id
 WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id AND s.academic_status='enrolled'
 AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'')))
 OR EXISTS(SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY e.student_party_id HAVING count(*)<>1)
 THEN RAISE EXCEPTION 'ROSTER_IDENTITY_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('enrollmentId',e.id,'studentId',s.student_id,'studentPartyId',p.id,
 'studentCode',s.student_code,'name',p.display_name,'gender',p.gender,'dob',p.dob,'enrollmentStatus',e.status) ORDER BY e.id),'[]'::jsonb)
 INTO v_roster FROM public.edu_enrollments e
 JOIN public.students s ON s.tenant_id=e.tenant_id AND s.party_id=e.student_party_id
 JOIN public.party_parties p ON p.tenant_id=e.tenant_id AND p.id=e.student_party_id
 WHERE e.tenant_id=v_tenant AND e.course_id=p_course_id AND e.status='active'
 AND e.enrolled_at<((p_school_day+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh');
 RETURN jsonb_build_object('tenantId',v_tenant,'courseId',p_course_id,'schoolDay',p_school_day,'roster',v_roster);
END;
$$;


--
-- Name: edu_set_daily_attendance(uuid, uuid, text, timestamp with time zone, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date) RETURNS TABLE(id uuid, tenant_id uuid, enrollment_id uuid, school_day date, status text, event_id uuid, roll_call_time timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_enrollment_id UUID;
  v_event_id UUID;
  v_state public.edu_attendance_daily_state%ROWTYPE;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE_STATUS' USING ERRCODE = '22023';
  END IF;
  IF p_roll_call_time IS NULL OR NOT isfinite(p_roll_call_time) THEN
    RAISE EXCEPTION 'ROLL_CALL_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_school_day IS NULL OR NOT isfinite(p_school_day) THEN
    RAISE EXCEPTION 'SCHOOL_DAY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF (p_roll_call_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <> p_school_day THEN
    RAISE EXCEPTION 'ATTENDANCE_DAY_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF NOT public.edu_can_access_attendance_enrollment(p_tenant_id, p_enrollment_id, p_school_day) THEN
    RAISE EXCEPTION 'ATTENDANCE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT e.id INTO v_enrollment_id FROM public.edu_enrollments e
  WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id;
  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_ENROLLMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.edu_attendance (tenant_id, enrollment_id, status, roll_call_time)
  VALUES (p_tenant_id, p_enrollment_id, p_status, p_roll_call_time)
  RETURNING edu_attendance.id INTO v_event_id;
  INSERT INTO public.edu_attendance_daily_state (tenant_id, enrollment_id, school_day, status)
  VALUES (p_tenant_id, p_enrollment_id, p_school_day, p_status)
  ON CONFLICT ON CONSTRAINT edu_attendance_daily_state_unique
  DO UPDATE SET status = EXCLUDED.status, updated_at = now()
  RETURNING * INTO v_state;
  RETURN QUERY SELECT v_state.id, v_state.tenant_id, v_state.enrollment_id, v_state.school_day,
    v_state.status, v_event_id, p_roll_call_time, v_state.created_at, v_state.updated_at;
END;
$$;


--
-- Name: get_auth_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_auth_tenant_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT u.tenant_id INTO v_tenant_id
  FROM public.users AS u
  JOIN public.tenants AS t ON t.id = u.tenant_id
  WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active';

  -- NULL would enable legacy policies using NULL as an unrestricted HQ sentinel.
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active canonical identity and tenant required' USING ERRCODE = '42501';
  END IF;
  RETURN v_tenant_id;
END;
$$;


--
-- Name: is_hq_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_hq_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u JOIN public.tenants AS t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() AND u.status = 'active' AND t.status = 'active'
      AND u.role = 'admin' AND t.product_key = 'bella_hq'
  );
$$;


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    current_user_id UUID;
    record_tenant_id UUID;
BEGIN
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    BEGIN
        IF TG_TABLE_NAME = 'tenants' THEN
            IF TG_OP = 'DELETE' THEN
                record_tenant_id := OLD.id;
            ELSE
                record_tenant_id := NEW.id;
            END IF;
        ELSE
            IF TG_OP = 'DELETE' THEN
                record_tenant_id := OLD.tenant_id;
            ELSE
                record_tenant_id := NEW.tenant_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        record_tenant_id := NULL;
    END;

    BEGIN
        INSERT INTO public.audit_logs (
            tenant_id,
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by_id
        ) VALUES (
            record_tenant_id,
            TG_TABLE_NAME,
            COALESCE(NEW.id, OLD.id),
            TG_OP,
            CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
            current_user_id
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'audit_log_event failed for table % op %: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


--
-- Name: preschool_list_school_announcements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_list_school_announcements() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_feed jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT u.tenant_id INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
  WHERE u.id = v_actor AND u.status = 'active' AND lower(btrim(u.role)) = 'admin';
  IF v_tenant IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.org_units b WHERE b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active)
     OR EXISTS (
       SELECT 1 FROM public.org_units b
       WHERE b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active
         AND NOT EXISTS (SELECT 1 FROM public.user_org_unit_access a
           WHERE a.tenant_id = v_tenant AND a.user_id = v_actor AND a.org_unit_id = b.id)
     ) THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title,
    'bodyText', q.body_text, 'publishedAt', q.published_at) ORDER BY q.published_at DESC, q.id DESC), '[]'::jsonb)
    INTO v_feed
  FROM (SELECT a.id, a.title, a.body_text, a.published_at
    FROM public.preschool_school_announcements a WHERE a.tenant_id = v_tenant
    ORDER BY a.published_at DESC, a.id DESC LIMIT 100) q;
  RETURN jsonb_build_object('tenantId', v_tenant, 'announcements', v_feed);
END
$$;


--
-- Name: preschool_portal_daily_read(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_portal_daily_read(p_tenant_id uuid, p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    SET lock_timeout TO '5s'
    AS $$
DECLARE
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_enrollment uuid;
  v_child text;
  v_guardian text;
  v_school text;
  v_course text;
  v_code text;
  v_attendance text;
  v_updated timestamptz;
  v_total bigint;
  v_present bigint;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_course_id IS NULL OR p_student_party_id IS NULL OR p_guardian_party_id IS NULL
     OR p_student_party_id = p_guardian_party_id THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT t.name INTO v_school FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool';
  IF v_school IS NULL THEN RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  SELECT c.title, c.course_code INTO v_course, v_code FROM public.edu_courses c
    WHERE c.tenant_id = p_tenant_id AND c.id = p_course_id AND c.status = 'active';
  IF v_course IS NULL OR (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a
      WHERE a.tenant_id = p_tenant_id AND a.course_id = p_course_id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.preschool_chain_course_branch_assignments a
       JOIN public.org_units b ON b.id = a.branch_id AND b.tenant_id = p_tenant_id AND b.unit_type = 'branch' AND b.is_active
       WHERE a.tenant_id = p_tenant_id AND a.course_id = p_course_id) THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.students s WHERE s.tenant_id = p_tenant_id AND s.party_id = p_student_party_id) <> 1 THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT p.display_name INTO v_child FROM public.students s
    JOIN public.party_parties p ON p.id = s.party_id AND p.tenant_id = s.tenant_id
    WHERE s.tenant_id = p_tenant_id AND s.party_id = p_student_party_id AND s.academic_status = 'enrolled'
      AND p.party_type = 'person' AND p.deleted_at IS NULL AND btrim(p.display_name) <> '';
  SELECT p.display_name INTO v_guardian FROM public.party_parties p
    WHERE p.id = p_guardian_party_id AND p.tenant_id = p_tenant_id AND p.party_type = 'person'
      AND p.deleted_at IS NULL AND btrim(p.display_name) <> '';
  IF v_child IS NULL OR v_guardian IS NULL OR (SELECT count(*) FROM public.party_relationships r
      WHERE r.tenant_id = p_tenant_id AND r.source_party_id = p_guardian_party_id AND r.target_party_id = p_student_party_id
        AND r.relationship_type IN ('guardian_of', 'parent_of')
        AND (r.active_from IS NULL OR r.active_from <= v_day) AND (r.active_to IS NULL OR r.active_to >= v_day)) <> 1
     OR (SELECT count(*) FROM public.edu_enrollments e WHERE e.tenant_id = p_tenant_id AND e.course_id = p_course_id
       AND e.student_party_id = p_student_party_id AND e.status = 'active' AND e.enrolled_at <= statement_timestamp()) <> 1 THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT e.id INTO STRICT v_enrollment FROM public.edu_enrollments e
    WHERE e.tenant_id = p_tenant_id AND e.course_id = p_course_id AND e.student_party_id = p_student_party_id
      AND e.status = 'active' AND e.enrolled_at <= statement_timestamp();
  SELECT a.status, a.updated_at INTO v_attendance, v_updated FROM public.edu_attendance_daily_state a
    WHERE a.tenant_id = p_tenant_id AND a.enrollment_id = v_enrollment AND a.school_day = v_day;
  IF v_attendance IS NOT NULL AND v_attendance NOT IN ('present', 'absent', 'excused') THEN
    RAISE EXCEPTION 'PORTAL_ATTENDANCE_UNAVAILABLE' USING ERRCODE = '22000';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE a.status = 'present') INTO v_total, v_present
    FROM public.edu_enrollments e LEFT JOIN public.edu_attendance_daily_state a
      ON a.tenant_id = e.tenant_id AND a.enrollment_id = e.id AND a.school_day = v_day
    WHERE e.tenant_id = p_tenant_id AND e.course_id = p_course_id AND e.status = 'active'
      AND e.enrolled_at <= statement_timestamp();
  RETURN jsonb_build_object('scope', 'daily_read_v1', 'tenantId', p_tenant_id, 'courseId', p_course_id,
    'studentPartyId', p_student_party_id, 'guardianPartyId', p_guardian_party_id,
    'schoolName', v_school, 'guardianName', v_guardian, 'childName', v_child,
    'courseTitle', v_course, 'courseCode', v_code, 'schoolDay', v_day,
    'attendanceStatus', coalesce(v_attendance, 'unmarked'), 'attendanceUpdatedAt', v_updated,
    'totalClassSize', v_total, 'presentTodayCount', v_present, 'serverTime', statement_timestamp());
END
$$;


--
-- Name: preschool_portal_issuer_context(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_portal_issuer_context(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    SET lock_timeout TO '5s'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_branch uuid;
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_guardians jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_course_id IS NULL OR p_student_party_id IS NULL THEN
    RAISE EXCEPTION 'PORTAL_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT u.tenant_id INTO v_tenant FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
    WHERE u.id = v_actor AND u.status = 'active' AND lower(btrim(u.role)) = 'admin';
  IF v_tenant IS NULL OR NOT EXISTS (SELECT 1 FROM public.edu_courses c
      WHERE c.id = p_course_id AND c.tenant_id = v_tenant AND c.status = 'active') THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments a
      WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id) <> 1 THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT a.branch_id INTO v_branch FROM public.preschool_chain_course_branch_assignments a
    JOIN public.org_units b ON b.id = a.branch_id AND b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active
    WHERE a.tenant_id = v_tenant AND a.course_id = p_course_id;
  IF v_branch IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_org_unit_access a
      WHERE a.tenant_id = v_tenant AND a.user_id = v_actor AND a.org_unit_id = v_branch AND a.relationship_id IS NOT NULL) THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.students s WHERE s.tenant_id = v_tenant AND s.party_id = p_student_party_id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.students s JOIN public.party_parties p ON p.id = s.party_id AND p.tenant_id = s.tenant_id
       WHERE s.tenant_id = v_tenant AND s.party_id = p_student_party_id AND s.academic_status = 'enrolled'
         AND p.party_type = 'person' AND p.deleted_at IS NULL AND btrim(p.display_name) <> '')
     OR (SELECT count(*) FROM public.edu_enrollments e WHERE e.tenant_id = v_tenant AND e.course_id = p_course_id
       AND e.student_party_id = p_student_party_id AND e.status = 'active' AND e.enrolled_at <= statement_timestamp()) <> 1 THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('guardianPartyId', g.id, 'guardianLabel', g.display_name) ORDER BY g.id)
    INTO v_guardians FROM public.party_relationships r
    JOIN public.party_parties g ON g.id = r.source_party_id AND g.tenant_id = v_tenant
      AND g.party_type = 'person' AND g.deleted_at IS NULL AND btrim(g.display_name) <> ''
    WHERE r.tenant_id = v_tenant AND r.target_party_id = p_student_party_id
      AND r.relationship_type IN ('guardian_of', 'parent_of') AND r.source_party_id <> r.target_party_id
      AND (r.active_from IS NULL OR r.active_from <= v_day) AND (r.active_to IS NULL OR r.active_to >= v_day)
      AND (SELECT count(*) FROM public.party_relationships x WHERE x.tenant_id = v_tenant
        AND x.source_party_id = r.source_party_id AND x.target_party_id = p_student_party_id
        AND x.relationship_type IN ('guardian_of', 'parent_of')
        AND (x.active_from IS NULL OR x.active_from <= v_day) AND (x.active_to IS NULL OR x.active_to >= v_day)) = 1;
  IF coalesce(jsonb_array_length(v_guardians), 0) NOT BETWEEN 1 AND 100
     OR (p_guardian_party_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_guardians) g
       WHERE g->>'guardianPartyId' = p_guardian_party_id::text)) THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('tenantId', v_tenant, 'courseId', p_course_id,
    'studentPartyId', p_student_party_id, 'guardians', v_guardians);
END
$$;


--
-- Name: preschool_portal_school_announcements_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_portal_school_announcements_read(p_tenant_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET statement_timeout TO '10s'
    AS $$
DECLARE
  v_feed jsonb;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  -- The Portal route calls this only after the Education-owned daily-read
  -- contract has validated the signed tenant/course/student/guardian binding.
  -- This Product RPC reads only the Product-owned bulletin table.
  IF p_tenant_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id
       AND t.status = 'active' AND t.product_key = 'bella_preschool') THEN
    RAISE EXCEPTION 'PORTAL_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title,
    'bodyText', q.body_text, 'publishedAt', q.published_at) ORDER BY q.published_at DESC, q.id DESC), '[]'::jsonb)
    INTO v_feed
  FROM (SELECT a.id, a.title, a.body_text, a.published_at
    FROM public.preschool_school_announcements a WHERE a.tenant_id = p_tenant_id
    ORDER BY a.published_at DESC, a.id DESC LIMIT 100) q;
  RETURN jsonb_build_object('tenantId', p_tenant_id, 'announcements', v_feed);
END
$$;


--
-- Name: preschool_publish_school_announcement(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_publish_school_announcement(p_request_id uuid, p_title text, p_body_text text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    SET lock_timeout TO '5s'
    SET statement_timeout TO '10s'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_title text := btrim(p_title);
  v_body text := btrim(p_body_text);
  v_item public.preschool_school_announcements;
  v_duplicate boolean := false;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR v_title IS NULL OR length(v_title) NOT BETWEEN 1 AND 200
     OR v_body IS NULL OR length(v_body) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT u.tenant_id INTO v_tenant
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id AND t.status = 'active' AND t.product_key = 'bella_preschool'
  WHERE u.id = v_actor AND u.status = 'active' AND lower(btrim(u.role)) = 'admin';
  IF v_tenant IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.org_units b WHERE b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active)
     OR EXISTS (
       SELECT 1 FROM public.org_units b
       WHERE b.tenant_id = v_tenant AND b.unit_type = 'branch' AND b.is_active
         AND NOT EXISTS (SELECT 1 FROM public.user_org_unit_access a
           WHERE a.tenant_id = v_tenant AND a.user_id = v_actor AND a.org_unit_id = b.id)
     ) THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.preschool_school_announcements (tenant_id, request_id, title, body_text, created_by)
  VALUES (v_tenant, p_request_id, v_title, v_body, v_actor)
  ON CONFLICT (tenant_id, request_id) DO NOTHING
  RETURNING * INTO v_item;
  IF v_item.id IS NULL THEN
    SELECT * INTO v_item FROM public.preschool_school_announcements a
      WHERE a.tenant_id = v_tenant AND a.request_id = p_request_id;
    IF v_item.title IS DISTINCT FROM v_title OR v_item.body_text IS DISTINCT FROM v_body THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_REQUEST_ID_REUSED' USING ERRCODE = '23505';
    END IF;
    v_duplicate := true;
  END IF;

  RETURN jsonb_build_object('id', v_item.id, 'title', v_item.title,
    'bodyText', v_item.body_text, 'publishedAt', v_item.published_at, 'duplicate', v_duplicate);
END
$$;


--
-- Name: preschool_save_care_records(uuid, uuid, date, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE rec jsonb; party_id uuid; v_session_id uuid; stamp timestamptz:=clock_timestamp(); count_saved integer:=0; affected integer;
BEGIN
 IF current_setting('role',true)<>'authenticated' OR auth.uid() IS NULL
 OR p_day IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
 OR NOT EXISTS (SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
 WHERE u.id=auth.uid() AND u.tenant_id=p_tenant_id AND u.status='active' AND u.role='admin'
 AND t.status='active' AND t.product_key='bella_preschool')
 OR NOT public.edu_attendance_can_read_course(p_tenant_id,p_course_id)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_ACCESS_DENIED'; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORDS'; END IF;
 IF jsonb_array_length(p_records)=0 THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_TARGETS_REQUIRED'; END IF;
 -- Validate every field and every target before creating a session or writing.
 FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF jsonb_typeof(rec) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORD'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(rec) AS keys(key) WHERE keys.key NOT IN ('studentPartyId','meal','nap','hygiene','note'))
  OR jsonb_typeof(rec->'studentPartyId') IS DISTINCT FROM 'string'
  OR (rec ? 'note' AND jsonb_typeof(rec->'note') IS DISTINCT FROM 'string')
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_RECORD'; END IF;
  party_id:=(rec->>'studentPartyId')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.edu_enrollments e WHERE e.tenant_id=p_tenant_id
   AND e.course_id=p_course_id AND e.student_party_id=party_id)
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_STUDENT_ACCESS_DENIED'; END IF;
  IF rec ? 'meal' AND rec->'meal'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'meal') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_MEAL'; END IF;
   IF coalesce(rec->'meal'->>'portion','') NOT IN ('ALL','HALF','FEW','NONE')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'meal') AS keys(key) WHERE keys.key NOT IN ('portion','notes'))
   OR (rec->'meal' ? 'notes' AND jsonb_typeof(rec->'meal'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_MEAL'; END IF;
  END IF;
  IF rec ? 'nap' AND rec->'nap'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'nap') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_NAP'; END IF;
   IF coalesce(rec->'nap'->>'quality','') NOT IN ('DEEP','RESTLESS','REFUSED')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'nap') AS keys(key) WHERE keys.key NOT IN ('quality','notes'))
   OR (rec->'nap' ? 'notes' AND jsonb_typeof(rec->'nap'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_NAP'; END IF;
  END IF;
  IF rec ? 'hygiene' AND rec->'hygiene'<>'null'::jsonb THEN
   IF jsonb_typeof(rec->'hygiene') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_HYGIENE'; END IF;
   IF coalesce(rec->'hygiene'->>'type','') NOT IN ('TOILET','DIAPER','BOWEL_MOVEMENT')
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(rec->'hygiene') AS keys(key) WHERE keys.key NOT IN ('type','notes'))
   OR (rec->'hygiene' ? 'notes' AND jsonb_typeof(rec->'hygiene'->'notes') IS DISTINCT FROM 'string')
   THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_INVALID_HYGIENE'; END IF;
  END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (v->>'studentPartyId')::uuid) FROM jsonb_array_elements(p_records) v)<>jsonb_array_length(p_records)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARE_DUPLICATE_TARGET'; END IF;
 INSERT INTO public.edu_daily_care_sessions(tenant_id,class_id,date,status)
 VALUES(p_tenant_id,p_course_id,p_day,'OPEN') ON CONFLICT(tenant_id,class_id,date) DO NOTHING RETURNING id INTO v_session_id;
 IF v_session_id IS NULL THEN
 SELECT s.id INTO STRICT v_session_id FROM public.edu_daily_care_sessions s
 WHERE s.tenant_id=p_tenant_id AND s.class_id=p_course_id AND s.date=p_day;
 END IF;
 FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  INSERT INTO public.edu_daily_care_records AS target(tenant_id,session_id,student_party_id,arrival_status,morning_condition,meal_records,nap_records,hygiene_records,updated_at)
  VALUES(p_tenant_id,v_session_id,(rec->>'studentPartyId')::uuid,'PRESENT',coalesce(rec->>'note',''),
   CASE WHEN rec->'meal' IS NOT NULL AND rec->'meal'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('mealType','LUNCH','portion',rec->'meal'->>'portion','notes',coalesce(rec->'meal'->>'notes',''),'recordedAt',stamp)) ELSE '[]'::jsonb END,
   CASE WHEN rec->'nap' IS NOT NULL AND rec->'nap'<>'null'::jsonb
    THEN jsonb_build_object('quality',rec->'nap'->>'quality','notes',coalesce(rec->'nap'->>'notes',''),'updatedAt',stamp) ELSE '{}'::jsonb END,
   CASE WHEN rec->'hygiene' IS NOT NULL AND rec->'hygiene'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('type',rec->'hygiene'->>'type','notes',coalesce(rec->'hygiene'->>'notes',''),'time',stamp)) ELSE '[]'::jsonb END,stamp)
  ON CONFLICT(session_id,student_party_id) WHERE student_party_id IS NOT NULL
  DO UPDATE SET morning_condition=excluded.morning_condition,meal_records=excluded.meal_records,
   nap_records=excluded.nap_records,hygiene_records=excluded.hygiene_records,updated_at=excluded.updated_at
  WHERE target.tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_WRITE_NOT_CONFIRMED'; END IF;
  count_saved:=count_saved+1;
 END LOOP;
 RETURN jsonb_build_object('savedCount',count_saved,'total',jsonb_array_length(p_records));
END;
$$;


--
-- Name: sync_user_claims_to_auth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_claims_to_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'role', NEW.role,
      'tenant_id', NEW.tenant_id
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: update_persons_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_persons_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_students_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_students_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: edu_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    status text NOT NULL,
    roll_call_time timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT edu_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'excused'::text])))
);


--
-- Name: edu_attendance_daily_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_attendance_daily_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    school_day date NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT edu_attendance_daily_state_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'excused'::text])))
);


--
-- Name: edu_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    course_code text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_students integer,
    current_enrollment integer DEFAULT 0,
    prerequisite_course_codes text[] DEFAULT '{}'::text[],
    CONSTRAINT chk_edu_courses_capacity CHECK (((max_students IS NULL) OR (current_enrollment <= max_students))),
    CONSTRAINT chk_edu_courses_current_enrollment CHECK ((current_enrollment >= 0)),
    CONSTRAINT chk_edu_courses_max_students CHECK (((max_students IS NULL) OR (max_students > 0))),
    CONSTRAINT edu_courses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: edu_daily_care_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_daily_care_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid,
    arrival_status text DEFAULT 'PRESENT'::text,
    arrival_time timestamp with time zone,
    morning_condition text DEFAULT 'GOOD'::text,
    meal_records jsonb DEFAULT '[]'::jsonb NOT NULL,
    hygiene_records jsonb DEFAULT '[]'::jsonb NOT NULL,
    nap_records jsonb DEFAULT '{}'::jsonb NOT NULL,
    health_checks jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_party_id uuid,
    CONSTRAINT edu_daily_care_records_arrival_status_check CHECK ((arrival_status = ANY (ARRAY['PRESENT'::text, 'ABSENT'::text, 'LATE'::text])))
);


--
-- Name: edu_daily_care_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_daily_care_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    class_id uuid NOT NULL,
    date date NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT edu_daily_care_sessions_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'COMPLETED'::text, 'CLOSED'::text])))
);


--
-- Name: edu_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edu_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    student_party_id uuid NOT NULL,
    course_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id text NOT NULL,
    CONSTRAINT edu_enrollments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: org_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    from_id uuid NOT NULL,
    from_type text NOT NULL,
    to_id uuid NOT NULL,
    to_type text NOT NULL,
    rel_type text NOT NULL,
    role text,
    since date,
    until date,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_relationships_from_type_check CHECK ((from_type = ANY (ARRAY['unit'::text, 'person'::text]))),
    CONSTRAINT org_relationships_rel_type_check CHECK ((rel_type = ANY (ARRAY['belongs_to'::text, 'manages'::text, 'participates_in'::text, 'reports_to'::text, 'collaborates_with'::text]))),
    CONSTRAINT org_relationships_to_type_check CHECK ((to_type = ANY (ARRAY['unit'::text, 'person'::text])))
);


--
-- Name: org_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    unit_type text NOT NULL,
    name text NOT NULL,
    code text,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_units_unit_type_check CHECK ((unit_type = ANY (ARRAY['company'::text, 'region'::text, 'branch'::text, 'department'::text, 'team'::text, 'project'::text, 'task_force'::text, 'committee'::text])))
);


--
-- Name: party_parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_type text NOT NULL,
    display_name text NOT NULL,
    legal_name text,
    tax_code text,
    dob date,
    gender text,
    blood_type text,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT party_parties_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT party_parties_party_type_check CHECK ((party_type = ANY (ARRAY['person'::text, 'organization'::text])))
);


--
-- Name: party_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_party_id uuid NOT NULL,
    target_party_id uuid NOT NULL,
    relationship_type text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    active_from date DEFAULT CURRENT_DATE,
    active_to date,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: people_directory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_directory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    person_type text NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT people_directory_person_type_check CHECK ((person_type = ANY (ARRAY['employee'::text, 'broker'::text, 'agency'::text, 'partner'::text, 'consultant'::text, 'contractor'::text])))
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    middle_name text,
    date_of_birth date NOT NULL,
    gender text NOT NULL,
    nationality text,
    identifiers jsonb DEFAULT '[]'::jsonb,
    contacts jsonb DEFAULT '[]'::jsonb,
    addresses jsonb DEFAULT '[]'::jsonb,
    photo_url text,
    preferred_language text DEFAULT 'vi'::text,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT persons_date_of_birth_check CHECK ((date_of_birth <= CURRENT_DATE)),
    CONSTRAINT persons_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer-not-to-say'::text]))),
    CONSTRAINT persons_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'deceased'::text, 'merged'::text])))
);


--
-- Name: preschool_chain_course_branch_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preschool_chain_course_branch_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    course_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preschool_school_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preschool_school_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_id uuid NOT NULL,
    title text NOT NULL,
    body_text text NOT NULL,
    created_by uuid NOT NULL,
    published_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT preschool_school_announcements_body_text_check CHECK (((length(btrim(body_text)) >= 1) AND (length(btrim(body_text)) <= 20000))),
    CONSTRAINT preschool_school_announcements_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    student_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    person_id uuid,
    student_code text NOT NULL,
    academic_status text NOT NULL,
    enrollment_type text NOT NULL,
    program_id text NOT NULL,
    enrollment_date date NOT NULL,
    expected_graduation_date date,
    actual_graduation_date date,
    current_level text,
    gpa numeric(3,2),
    total_credits integer,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relationship text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    party_id uuid,
    CONSTRAINT students_academic_status_check CHECK ((academic_status = ANY (ARRAY['enrolled'::text, 'on_leave'::text, 'graduated'::text, 'dropped_out'::text, 'expelled'::text]))),
    CONSTRAINT students_actual_graduation_check CHECK (((actual_graduation_date IS NULL) OR (actual_graduation_date >= enrollment_date))),
    CONSTRAINT students_enrollment_date_check CHECK ((enrollment_date <= CURRENT_DATE)),
    CONSTRAINT students_enrollment_type_check CHECK ((enrollment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'online'::text, 'hybrid'::text]))),
    CONSTRAINT students_gpa_check CHECK (((gpa >= (0)::numeric) AND (gpa <= 4.0))),
    CONSTRAINT students_graduation_dates_check CHECK (((expected_graduation_date IS NULL) OR (expected_graduation_date > enrollment_date))),
    CONSTRAINT students_total_credits_check CHECK ((total_credits >= 0))
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    parent_tenant_id uuid,
    franchise_agreement_date date,
    royalty_rate numeric,
    contact_name text,
    contact_phone text,
    address text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    zalo_app_id text,
    zalo_secret_key text,
    zalo_oa_id text,
    zalo_access_token text,
    zalo_refresh_token text,
    zalo_token_expires_at timestamp with time zone,
    zalo_template_reminder_id text,
    zalo_template_birthday_id text,
    zalo_auto_scan boolean DEFAULT true,
    email text,
    qr_bank_code text,
    qr_account_number text,
    qr_account_name text,
    salary_config jsonb DEFAULT '{"bonus_4_star": 10000, "bonus_5_star": 50000, "bonus_4_5_star": 30000, "kpi_bonus_amount": 1000000, "kpi_target_sessions": 30}'::jsonb,
    subscription_tier character varying(50) DEFAULT 'free_trial'::character varying,
    subscription_expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    sms_allotment_used integer DEFAULT 0,
    role_permissions jsonb DEFAULT '{"ktv_lead": {"crm": true, "chat": true, "audit": false, "salary": false, "finance": false, "bookings": true, "services": true, "sessions": true, "settings": false, "customers": false, "dashboard": true, "inventory": false, "reconciliation": false}}'::jsonb,
    royalty_type character varying(20) DEFAULT 'percentage'::character varying,
    royalty_fixed_amount numeric(12,2) DEFAULT 0.00,
    internal_clearing_rate numeric(12,2) DEFAULT 150000.00,
    tenant_lat double precision,
    tenant_lon double precision,
    gps_threshold_m integer DEFAULT 200,
    accounting_mode text DEFAULT 'SIMPLE'::text,
    logo_url text,
    enabled_modules jsonb DEFAULT '{"babycare": true, "beauty_spa": false, "student_training": false}'::jsonb NOT NULL,
    brand_theme jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    commission_config jsonb DEFAULT '{}'::jsonb,
    product_key text,
    CONSTRAINT tenants_accounting_mode_check CHECK ((accounting_mode = ANY (ARRAY['SIMPLE'::text, 'PROFESSIONAL'::text]))),
    CONSTRAINT tenants_royalty_type_check CHECK (((royalty_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('percentage'::character varying)::text]))),
    CONSTRAINT tenants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'terminated'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    role text NOT NULL,
    avatar_url text,
    status text DEFAULT 'active'::text,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    base_salary numeric DEFAULT 6000000,
    hire_date date,
    resignation_date date,
    metadata jsonb DEFAULT '{}'::jsonb,
    position_tier text DEFAULT 'junior'::text NOT NULL,
    leave_balance integer DEFAULT 12,
    CONSTRAINT users_position_tier_check CHECK ((position_tier = ANY (ARRAY['junior'::text, 'senior'::text, 'lead'::text]))),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'ktv_lead'::text, 'ktv'::text, 'admin_staff'::text, 'accountant'::text, 'hr'::text, 'student'::text, 'parent'::text])))
);


--
-- Name: user_org_unit_access; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_org_unit_access AS
 WITH RECURSIVE current_context AS (
         SELECT COALESCE(auth.uid(), (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid) AS user_id,
            COALESCE(public.get_auth_tenant_id(), (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::uuid) AS tenant_id
        ), direct_access AS (
         SELECT pd.user_id,
            rel.tenant_id,
            rel.to_id AS org_unit_id,
            rel.to_id AS root_org_unit_id,
            rel.id AS relationship_id,
            rel.rel_type AS access_source
           FROM (((current_context ctx
             JOIN public.people_directory pd ON (((pd.user_id = ctx.user_id) AND (pd.tenant_id = ctx.tenant_id) AND (pd.is_active = true))))
             JOIN public.org_relationships rel ON (((rel.tenant_id = pd.tenant_id) AND (rel.from_id = pd.id) AND (rel.from_type = 'person'::text) AND (rel.to_type = 'unit'::text) AND (rel.rel_type = ANY (ARRAY['belongs_to'::text, 'manages'::text, 'participates_in'::text])) AND ((rel.since IS NULL) OR (rel.since <= CURRENT_DATE)) AND ((rel.until IS NULL) OR (rel.until >= CURRENT_DATE)))))
             JOIN public.org_units ou ON (((ou.id = rel.to_id) AND (ou.tenant_id = rel.tenant_id) AND (ou.is_active = true))))
        ), expanded_access AS (
         SELECT direct_access.user_id,
            direct_access.tenant_id,
            direct_access.org_unit_id,
            direct_access.root_org_unit_id,
            direct_access.relationship_id,
            direct_access.access_source
           FROM direct_access
        UNION
         SELECT ea.user_id,
            child.tenant_id,
            child.id AS org_unit_id,
            ea.root_org_unit_id,
            ea.relationship_id,
            ea.access_source
           FROM (expanded_access ea
             JOIN public.org_units child ON (((child.parent_id = ea.org_unit_id) AND (child.tenant_id = ea.tenant_id) AND (child.is_active = true))))
        ), admin_access AS (
         SELECT u.id AS user_id,
            ou.tenant_id,
            ou.id AS org_unit_id,
            ou.id AS root_org_unit_id,
            NULL::uuid AS relationship_id,
            'tenant_admin'::text AS access_source
           FROM ((current_context ctx
             JOIN public.users u ON (((u.id = ctx.user_id) AND (u.tenant_id = ctx.tenant_id) AND (lower(u.role) = ANY (ARRAY['admin'::text, 'super_admin'::text])))))
             JOIN public.org_units ou ON (((ou.tenant_id = u.tenant_id) AND (ou.is_active = true))))
        )
 SELECT DISTINCT expanded_access.user_id,
    expanded_access.tenant_id,
    expanded_access.org_unit_id,
    expanded_access.root_org_unit_id,
    expanded_access.relationship_id,
    expanded_access.access_source
   FROM expanded_access
UNION
 SELECT DISTINCT admin_access.user_id,
    admin_access.tenant_id,
    admin_access.org_unit_id,
    admin_access.root_org_unit_id,
    admin_access.relationship_id,
    admin_access.access_source
   FROM admin_access;


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: edu_attendance_daily_state edu_attendance_daily_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance_daily_state
    ADD CONSTRAINT edu_attendance_daily_state_pkey PRIMARY KEY (id);


--
-- Name: edu_attendance_daily_state edu_attendance_daily_state_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance_daily_state
    ADD CONSTRAINT edu_attendance_daily_state_unique UNIQUE (tenant_id, enrollment_id, school_day);


--
-- Name: edu_attendance edu_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance
    ADD CONSTRAINT edu_attendance_pkey PRIMARY KEY (id);


--
-- Name: edu_courses edu_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_courses
    ADD CONSTRAINT edu_courses_pkey PRIMARY KEY (id);


--
-- Name: edu_daily_care_records edu_daily_care_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT edu_daily_care_records_pkey PRIMARY KEY (id);


--
-- Name: edu_daily_care_sessions edu_daily_care_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_sessions
    ADD CONSTRAINT edu_daily_care_sessions_pkey PRIMARY KEY (id);


--
-- Name: edu_enrollments edu_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT edu_enrollments_pkey PRIMARY KEY (id);


--
-- Name: org_relationships org_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_relationships
    ADD CONSTRAINT org_relationships_pkey PRIMARY KEY (id);


--
-- Name: org_units org_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT org_units_pkey PRIMARY KEY (id);


--
-- Name: party_parties party_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_parties
    ADD CONSTRAINT party_parties_pkey PRIMARY KEY (id);


--
-- Name: party_relationships party_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationships
    ADD CONSTRAINT party_relationships_pkey PRIMARY KEY (id);


--
-- Name: party_relationships party_relationships_tenant_id_source_party_id_target_party__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationships
    ADD CONSTRAINT party_relationships_tenant_id_source_party_id_target_party__key UNIQUE (tenant_id, source_party_id, target_party_id, relationship_type);


--
-- Name: people_directory people_directory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_directory
    ADD CONSTRAINT people_directory_pkey PRIMARY KEY (id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: preschool_chain_course_branch_assignments preschool_chain_course_branch_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_chain_course_branch_assignments
    ADD CONSTRAINT preschool_chain_course_branch_assignments_pkey PRIMARY KEY (id);


--
-- Name: preschool_school_announcements preschool_school_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_school_announcements
    ADD CONSTRAINT preschool_school_announcements_pkey PRIMARY KEY (id);


--
-- Name: preschool_school_announcements preschool_school_announcements_request_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_school_announcements
    ADD CONSTRAINT preschool_school_announcements_request_unique UNIQUE (tenant_id, request_id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- Name: students students_student_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_code_unique UNIQUE (tenant_id, student_code);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: edu_courses uq_edu_courses_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_courses
    ADD CONSTRAINT uq_edu_courses_code UNIQUE (tenant_id, course_code);


--
-- Name: edu_enrollments uq_edu_enrollments_request_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT uq_edu_enrollments_request_id UNIQUE (tenant_id, request_id);


--
-- Name: edu_enrollments uq_edu_enrollments_student_course; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT uq_edu_enrollments_student_course UNIQUE (tenant_id, student_party_id, course_id);


--
-- Name: org_relationships uq_org_relationship; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_relationships
    ADD CONSTRAINT uq_org_relationship UNIQUE (tenant_id, from_id, to_id, rel_type);


--
-- Name: org_units uq_org_unit_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT uq_org_unit_code UNIQUE (tenant_id, code);


--
-- Name: preschool_chain_course_branch_assignments uq_preschool_chain_course_branch_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_chain_course_branch_assignments
    ADD CONSTRAINT uq_preschool_chain_course_branch_assignment UNIQUE (tenant_id, course_id);


--
-- Name: edu_daily_care_records uq_session_student; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT uq_session_student UNIQUE (session_id, student_id);


--
-- Name: edu_daily_care_sessions uq_tenant_class_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_sessions
    ADD CONSTRAINT uq_tenant_class_date UNIQUE (tenant_id, class_id, date);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_changed_by_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_changed_by_id_idx ON public.audit_logs USING btree (changed_by_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: audit_logs_table_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_table_name_idx ON public.audit_logs USING btree (table_name);


--
-- Name: audit_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_tenant_id_idx ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_daily_care_records_tenant_student_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_care_records_tenant_student_party ON public.edu_daily_care_records USING btree (tenant_id, student_party_id);


--
-- Name: idx_edu_attendance_daily_state_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_attendance_daily_state_enrollment ON public.edu_attendance_daily_state USING btree (enrollment_id);


--
-- Name: idx_edu_attendance_daily_state_tenant_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_attendance_daily_state_tenant_day ON public.edu_attendance_daily_state USING btree (tenant_id, school_day);


--
-- Name: idx_edu_attendance_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_attendance_enrollment ON public.edu_attendance USING btree (enrollment_id);


--
-- Name: idx_edu_attendance_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_attendance_tenant ON public.edu_attendance USING btree (tenant_id);


--
-- Name: idx_edu_courses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_courses_tenant ON public.edu_courses USING btree (tenant_id);


--
-- Name: idx_edu_enrollments_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_enrollments_course ON public.edu_enrollments USING btree (course_id);


--
-- Name: idx_edu_enrollments_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_enrollments_student ON public.edu_enrollments USING btree (student_party_id);


--
-- Name: idx_edu_enrollments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edu_enrollments_tenant ON public.edu_enrollments USING btree (tenant_id);


--
-- Name: idx_org_rel_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_rel_from ON public.org_relationships USING btree (tenant_id, from_id, from_type);


--
-- Name: idx_org_rel_person_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_rel_person_unit ON public.org_relationships USING btree (tenant_id, to_id, rel_type, from_type) WHERE ((from_type = 'person'::text) AND (rel_type = 'belongs_to'::text));


--
-- Name: idx_org_rel_reports_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_rel_reports_to ON public.org_relationships USING btree (tenant_id, from_id, rel_type) WHERE ((rel_type = 'reports_to'::text) AND (from_type = 'person'::text));


--
-- Name: idx_org_rel_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_rel_to ON public.org_relationships USING btree (tenant_id, to_id, to_type);


--
-- Name: idx_org_units_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_parent ON public.org_units USING btree (parent_id) WHERE (is_active = true);


--
-- Name: idx_org_units_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_tenant ON public.org_units USING btree (tenant_id, is_active);


--
-- Name: idx_org_units_type_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_units_type_tenant ON public.org_units USING btree (tenant_id, unit_type, is_active);


--
-- Name: idx_party_parties_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_parties_deleted ON public.party_parties USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_party_parties_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_parties_tenant ON public.party_parties USING btree (tenant_id);


--
-- Name: idx_party_parties_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_parties_type ON public.party_parties USING btree (party_type);


--
-- Name: idx_party_relationships_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_relationships_source ON public.party_relationships USING btree (source_party_id);


--
-- Name: idx_party_relationships_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_relationships_target ON public.party_relationships USING btree (target_party_id);


--
-- Name: idx_people_dir_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_dir_tenant ON public.people_directory USING btree (tenant_id, is_active);


--
-- Name: idx_people_dir_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_dir_type ON public.people_directory USING btree (tenant_id, person_type, is_active);


--
-- Name: idx_people_dir_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_dir_user ON public.people_directory USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_people_dir_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_people_dir_user_tenant ON public.people_directory USING btree (tenant_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_persons_addresses; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_addresses ON public.persons USING gin (addresses);


--
-- Name: idx_persons_contacts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_contacts ON public.persons USING gin (contacts);


--
-- Name: idx_persons_date_of_birth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_date_of_birth ON public.persons USING btree (date_of_birth);


--
-- Name: idx_persons_first_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_first_name ON public.persons USING btree (first_name);


--
-- Name: idx_persons_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_full_name ON public.persons USING btree (first_name, last_name);


--
-- Name: idx_persons_identifiers; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_identifiers ON public.persons USING gin (identifiers);


--
-- Name: idx_persons_last_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_last_name ON public.persons USING btree (last_name);


--
-- Name: idx_persons_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_status ON public.persons USING btree (status);


--
-- Name: idx_persons_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_tenant_id ON public.persons USING btree (tenant_id);


--
-- Name: idx_persons_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_persons_tenant_status ON public.persons USING btree (tenant_id, status);


--
-- Name: idx_preschool_chain_course_branch_assignments_tenant_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_preschool_chain_course_branch_assignments_tenant_branch ON public.preschool_chain_course_branch_assignments USING btree (tenant_id, branch_id);


--
-- Name: idx_students_academic_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_academic_status ON public.students USING btree (academic_status);


--
-- Name: idx_students_enrollment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_enrollment_date ON public.students USING btree (enrollment_date);


--
-- Name: idx_students_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_metadata ON public.students USING gin (metadata);


--
-- Name: idx_students_party_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_party_id ON public.students USING btree (party_id);


--
-- Name: idx_students_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_person_id ON public.students USING btree (person_id);


--
-- Name: idx_students_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_program_id ON public.students USING btree (program_id);


--
-- Name: idx_students_student_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_student_code ON public.students USING btree (student_code);


--
-- Name: idx_students_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_tenant_id ON public.students USING btree (tenant_id);


--
-- Name: idx_students_tenant_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_tenant_program ON public.students USING btree (tenant_id, program_id);


--
-- Name: idx_students_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_tenant_status ON public.students USING btree (tenant_id, academic_status);


--
-- Name: idx_tenants_commission_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_commission_config ON public.tenants USING gin (commission_config);


--
-- Name: idx_tenants_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_id_status ON public.tenants USING btree (id, status);


--
-- Name: idx_tenants_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_metadata_gin ON public.tenants USING gin (metadata);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_hire_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_hire_date ON public.users USING btree (tenant_id, hire_date) WHERE (hire_date IS NOT NULL);


--
-- Name: idx_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_id ON public.users USING btree (id);


--
-- Name: idx_users_position_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_position_tier ON public.users USING btree (tenant_id, position_tier) WHERE (position_tier IS NOT NULL);


--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);


--
-- Name: preschool_school_announcements_feed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX preschool_school_announcements_feed_idx ON public.preschool_school_announcements USING btree (tenant_id, published_at DESC, id DESC);


--
-- Name: uq_daily_care_records_session_student_party; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_daily_care_records_session_student_party ON public.edu_daily_care_records USING btree (session_id, student_party_id) WHERE (student_party_id IS NOT NULL);


--
-- Name: tenants audit_tenants_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_tenants_changes AFTER INSERT OR DELETE OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: users audit_users_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_users_changes AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: users tr_sync_user_claims; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_sync_user_claims AFTER INSERT OR UPDATE OF role, tenant_id ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_claims_to_auth();


--
-- Name: persons trigger_persons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_persons_updated_at BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.update_persons_updated_at();


--
-- Name: students trigger_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_students_updated_at();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: edu_attendance_daily_state edu_attendance_daily_state_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance_daily_state
    ADD CONSTRAINT edu_attendance_daily_state_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT;


--
-- Name: edu_attendance_daily_state edu_attendance_daily_state_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance_daily_state
    ADD CONSTRAINT edu_attendance_daily_state_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: edu_attendance edu_attendance_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance
    ADD CONSTRAINT edu_attendance_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT;


--
-- Name: edu_attendance edu_attendance_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_attendance
    ADD CONSTRAINT edu_attendance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: edu_courses edu_courses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_courses
    ADD CONSTRAINT edu_courses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: edu_daily_care_records edu_daily_care_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT edu_daily_care_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.edu_daily_care_sessions(id) ON DELETE CASCADE;


--
-- Name: edu_daily_care_records edu_daily_care_records_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT edu_daily_care_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: edu_daily_care_records edu_daily_care_records_student_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT edu_daily_care_records_student_party_id_fkey FOREIGN KEY (student_party_id) REFERENCES public.party_parties(id) ON DELETE CASCADE;


--
-- Name: edu_daily_care_records edu_daily_care_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_records
    ADD CONSTRAINT edu_daily_care_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: edu_daily_care_sessions edu_daily_care_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_daily_care_sessions
    ADD CONSTRAINT edu_daily_care_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: edu_enrollments edu_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT edu_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.edu_courses(id) ON DELETE RESTRICT;


--
-- Name: edu_enrollments edu_enrollments_student_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT edu_enrollments_student_party_id_fkey FOREIGN KEY (student_party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT;


--
-- Name: edu_enrollments edu_enrollments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edu_enrollments
    ADD CONSTRAINT edu_enrollments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: org_relationships org_relationships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_relationships
    ADD CONSTRAINT org_relationships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: org_units org_units_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT org_units_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.org_units(id) ON DELETE SET NULL;


--
-- Name: org_units org_units_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_units
    ADD CONSTRAINT org_units_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: party_parties party_parties_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_parties
    ADD CONSTRAINT party_parties_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: party_relationships party_relationships_source_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationships
    ADD CONSTRAINT party_relationships_source_party_id_fkey FOREIGN KEY (source_party_id) REFERENCES public.party_parties(id) ON DELETE CASCADE;


--
-- Name: party_relationships party_relationships_target_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationships
    ADD CONSTRAINT party_relationships_target_party_id_fkey FOREIGN KEY (target_party_id) REFERENCES public.party_parties(id) ON DELETE CASCADE;


--
-- Name: party_relationships party_relationships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationships
    ADD CONSTRAINT party_relationships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: people_directory people_directory_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_directory
    ADD CONSTRAINT people_directory_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: people_directory people_directory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_directory
    ADD CONSTRAINT people_directory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: persons persons_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: preschool_chain_course_branch_assignments preschool_chain_course_branch_assignments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_chain_course_branch_assignments
    ADD CONSTRAINT preschool_chain_course_branch_assignments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.org_units(id) ON DELETE RESTRICT;


--
-- Name: preschool_chain_course_branch_assignments preschool_chain_course_branch_assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_chain_course_branch_assignments
    ADD CONSTRAINT preschool_chain_course_branch_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.edu_courses(id) ON DELETE RESTRICT;


--
-- Name: preschool_chain_course_branch_assignments preschool_chain_course_branch_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_chain_course_branch_assignments
    ADD CONSTRAINT preschool_chain_course_branch_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- Name: preschool_school_announcements preschool_school_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_school_announcements
    ADD CONSTRAINT preschool_school_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: preschool_school_announcements preschool_school_announcements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preschool_school_announcements
    ADD CONSTRAINT preschool_school_announcements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: students students_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT;


--
-- Name: students students_person_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_person_fk FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: students students_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_parent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_parent_tenant_id_fkey FOREIGN KEY (parent_tenant_id) REFERENCES public.tenants(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenants Admin can update their own tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update their own tenant" ON public.tenants FOR UPDATE TO authenticated USING ((id = ( SELECT users.tenant_id
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))) WITH CHECK ((id = ( SELECT users.tenant_id
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));


--
-- Name: users Admins can view all users in tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all users in tenant" ON public.users FOR SELECT USING (((public.current_user_role() = 'admin'::text) AND (tenant_id = public.current_tenant_id())));


--
-- Name: users Admins manage tenant users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tenant users" ON public.users USING (((public.current_user_role() = 'admin'::text) AND (tenant_id = public.current_tenant_id())));


--
-- Name: tenants Tenant read tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant read tenants" ON public.tenants FOR SELECT TO authenticated USING (((public.get_auth_tenant_id() IS NULL) OR (id = public.get_auth_tenant_id())));


--
-- Name: users User tự xem và sửa chính mình; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User tự xem và sửa chính mình" ON public.users TO authenticated USING ((id = auth.uid()));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: users Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants block_rest_api_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_rest_api_access ON public.tenants USING (false) WITH CHECK (false);


--
-- Name: edu_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_attendance_daily_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_attendance_daily_state ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_attendance_daily_state edu_attendance_daily_state_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_attendance_daily_state_tenant_isolation ON public.edu_attendance_daily_state USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
-- Name: edu_attendance edu_attendance_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_attendance_tenant_isolation ON public.edu_attendance USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
-- Name: edu_courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_courses ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_courses edu_courses_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_courses_tenant_isolation ON public.edu_courses USING ((tenant_id = public.get_auth_tenant_id())) WITH CHECK ((tenant_id = public.get_auth_tenant_id()));


--
-- Name: edu_daily_care_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_daily_care_records ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_daily_care_records edu_daily_care_records_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_daily_care_records_service_role ON public.edu_daily_care_records TO service_role USING (true);


--
-- Name: edu_daily_care_records edu_daily_care_records_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_daily_care_records_tenant_isolation ON public.edu_daily_care_records USING ((tenant_id = (( SELECT (auth.jwt() ->> 'tenant_id'::text)))::uuid));


--
-- Name: edu_daily_care_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_daily_care_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_daily_care_sessions edu_daily_care_sessions_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_daily_care_sessions_service_role ON public.edu_daily_care_sessions TO service_role USING (true);


--
-- Name: edu_daily_care_sessions edu_daily_care_sessions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_daily_care_sessions_tenant_isolation ON public.edu_daily_care_sessions USING ((tenant_id = (( SELECT (auth.jwt() ->> 'tenant_id'::text)))::uuid));


--
-- Name: edu_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.edu_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_enrollments edu_enrollments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY edu_enrollments_tenant_isolation ON public.edu_enrollments USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
-- Name: org_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: org_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

--
-- Name: org_units org_units_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_units_admin_write ON public.org_units TO authenticated USING ((public.is_hq_super_admin() OR ((tenant_id = public.get_auth_tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (lower(u.role) = ANY (ARRAY['admin'::text, 'super_admin'::text])))))))) WITH CHECK ((public.is_hq_super_admin() OR ((tenant_id = public.get_auth_tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (lower(u.role) = ANY (ARRAY['admin'::text, 'super_admin'::text]))))))));


--
-- Name: org_units org_units_tenant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_units_tenant_read ON public.org_units FOR SELECT TO authenticated USING ((public.is_hq_super_admin() OR (tenant_id = public.get_auth_tenant_id())));


--
-- Name: party_parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_parties ENABLE ROW LEVEL SECURITY;

--
-- Name: party_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: people_directory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people_directory ENABLE ROW LEVEL SECURITY;

--
-- Name: persons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants platform_active_hq_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_active_hq_tenant_select ON public.tenants FOR SELECT TO authenticated USING (public.is_hq_super_admin());


--
-- Name: tenants platform_active_hq_tenant_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_active_hq_tenant_update ON public.tenants FOR UPDATE TO authenticated USING (public.is_hq_super_admin()) WITH CHECK (public.is_hq_super_admin());


--
-- Name: preschool_chain_course_branch_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preschool_chain_course_branch_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: preschool_chain_course_branch_assignments preschool_chain_course_branch_assignments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY preschool_chain_course_branch_assignments_tenant_isolation ON public.preschool_chain_course_branch_assignments USING ((tenant_id = public.get_auth_tenant_id())) WITH CHECK ((tenant_id = public.get_auth_tenant_id()));


--
-- Name: preschool_school_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preschool_school_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: edu_daily_care_records release_care_edu_daily_care_records_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_records_guard ON public.edu_daily_care_records AS RESTRICTIVE TO authenticated USING (((NOT (( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text)) OR (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date)))))) WITH CHECK (((NOT (( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text)) OR (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date))))));


--
-- Name: edu_daily_care_records release_care_edu_daily_care_records_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_records_insert ON public.edu_daily_care_records FOR INSERT TO authenticated WITH CHECK (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text) AND (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date))))));


--
-- Name: edu_daily_care_records release_care_edu_daily_care_records_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_records_select ON public.edu_daily_care_records FOR SELECT TO authenticated USING (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text) AND (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date))))));


--
-- Name: edu_daily_care_records release_care_edu_daily_care_records_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_records_update ON public.edu_daily_care_records FOR UPDATE TO authenticated USING (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text) AND (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date)))))) WITH CHECK (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_records.tenant_id)) = 'bella_preschool'::text) AND (EXISTS ( SELECT 1
   FROM (public.edu_daily_care_sessions s
     JOIN public.edu_enrollments e ON (((e.tenant_id = s.tenant_id) AND (e.course_id = s.class_id))))
  WHERE ((s.id = edu_daily_care_records.session_id) AND (s.tenant_id = edu_daily_care_records.tenant_id) AND (e.student_party_id = edu_daily_care_records.student_party_id) AND public.edu_can_access_attendance_enrollment(e.tenant_id, e.id, s.date))))));


--
-- Name: edu_daily_care_sessions release_care_edu_daily_care_sessions_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_sessions_guard ON public.edu_daily_care_sessions AS RESTRICTIVE TO authenticated USING (((NOT (( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_sessions.tenant_id)) = 'bella_preschool'::text)) OR ((date = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date) AND public.edu_attendance_can_read_course(tenant_id, class_id)))) WITH CHECK (((NOT (( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_sessions.tenant_id)) = 'bella_preschool'::text)) OR ((date = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date) AND public.edu_attendance_can_read_course(tenant_id, class_id))));


--
-- Name: edu_daily_care_sessions release_care_edu_daily_care_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_sessions_insert ON public.edu_daily_care_sessions FOR INSERT TO authenticated WITH CHECK (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_sessions.tenant_id)) = 'bella_preschool'::text) AND ((date = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date) AND public.edu_attendance_can_read_course(tenant_id, class_id))));


--
-- Name: edu_daily_care_sessions release_care_edu_daily_care_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_care_edu_daily_care_sessions_select ON public.edu_daily_care_sessions FOR SELECT TO authenticated USING (((( SELECT t.product_key
   FROM public.tenants t
  WHERE (t.id = edu_daily_care_sessions.tenant_id)) = 'bella_preschool'::text) AND ((date = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date) AND public.edu_attendance_can_read_course(tenant_id, class_id))));


--
-- Name: edu_enrollments roster_rpc_enrollment_allow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roster_rpc_enrollment_allow ON public.edu_enrollments FOR SELECT TO authenticated USING (((( SELECT tenants.product_key
   FROM public.tenants
  WHERE (tenants.id = edu_enrollments.tenant_id)) = 'bella_preschool'::text) AND public.edu_can_access_attendance_enrollment(tenant_id, id, ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date)));


--
-- Name: edu_enrollments roster_rpc_enrollment_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roster_rpc_enrollment_guard ON public.edu_enrollments AS RESTRICTIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = edu_enrollments.tenant_id) AND (t.product_key IS DISTINCT FROM 'bella_preschool'::text)))) OR public.edu_can_access_attendance_enrollment(tenant_id, id, ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date)));


--
-- Name: edu_attendance_daily_state roster_rpc_state_allow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roster_rpc_state_allow ON public.edu_attendance_daily_state FOR SELECT TO authenticated USING (((( SELECT tenants.product_key
   FROM public.tenants
  WHERE (tenants.id = edu_attendance_daily_state.tenant_id)) = 'bella_preschool'::text) AND public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)));


--
-- Name: edu_attendance_daily_state roster_rpc_state_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roster_rpc_state_guard ON public.edu_attendance_daily_state AS RESTRICTIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.tenants t
  WHERE ((t.id = edu_attendance_daily_state.tenant_id) AND (t.product_key IS DISTINCT FROM 'bella_preschool'::text)))) OR public.edu_can_access_attendance_enrollment(tenant_id, enrollment_id, school_day)));


--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: students students_service_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_service_role ON public.students TO service_role USING (true);


--
-- Name: students students_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_tenant_isolation ON public.students USING ((tenant_id = (( SELECT (auth.jwt() ->> 'tenant_id'::text)))::uuid));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION current_tenant_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_tenant_id() TO service_role;


--
-- Name: FUNCTION current_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_role() TO service_role;


--
-- Name: FUNCTION edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid) TO authenticated;


--
-- Name: FUNCTION edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date) TO authenticated;
GRANT ALL ON FUNCTION public.edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date) TO service_role;


--
-- Name: FUNCTION edu_preschool_enroll_student(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_preschool_enroll_student(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_preschool_enroll_student(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION edu_preschool_enrollment_candidates(p_course_id uuid, p_query text, p_limit integer, p_cursor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_preschool_enrollment_candidates(p_course_id uuid, p_query text, p_limit integer, p_cursor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_preschool_enrollment_candidates(p_course_id uuid, p_query text, p_limit integer, p_cursor uuid) TO authenticated;


--
-- Name: FUNCTION edu_preschool_roster_identity(p_course_id uuid, p_school_day date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_preschool_roster_identity(p_course_id uuid, p_school_day date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_preschool_roster_identity(p_course_id uuid, p_school_day date) TO authenticated;


--
-- Name: FUNCTION edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date) TO authenticated;
GRANT ALL ON FUNCTION public.edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date) TO service_role;


--
-- Name: FUNCTION get_auth_tenant_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_auth_tenant_id() TO service_role;


--
-- Name: FUNCTION is_hq_super_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_hq_super_admin() TO service_role;


--
-- Name: FUNCTION log_audit_event(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_audit_event() TO service_role;


--
-- Name: FUNCTION preschool_list_school_announcements(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_list_school_announcements() FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_list_school_announcements() TO authenticated;


--
-- Name: FUNCTION preschool_portal_daily_read(p_tenant_id uuid, p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_portal_daily_read(p_tenant_id uuid, p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_portal_daily_read(p_tenant_id uuid, p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid) TO service_role;


--
-- Name: FUNCTION preschool_portal_issuer_context(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_portal_issuer_context(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_portal_issuer_context(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid) TO authenticated;


--
-- Name: FUNCTION preschool_portal_school_announcements_read(p_tenant_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_portal_school_announcements_read(p_tenant_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_portal_school_announcements_read(p_tenant_id uuid) TO service_role;


--
-- Name: FUNCTION preschool_publish_school_announcement(p_request_id uuid, p_title text, p_body_text text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_publish_school_announcement(p_request_id uuid, p_title text, p_body_text text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_publish_school_announcement(p_request_id uuid, p_title text, p_body_text text) TO authenticated;


--
-- Name: FUNCTION preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb) TO authenticated;


--
-- Name: FUNCTION sync_user_claims_to_auth(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_user_claims_to_auth() TO service_role;


--
-- Name: FUNCTION update_persons_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_persons_updated_at() TO service_role;


--
-- Name: FUNCTION update_students_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_students_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT ALL ON TABLE public.audit_logs TO anon;


--
-- Name: TABLE edu_attendance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_attendance TO service_role;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.edu_attendance TO authenticated;


--
-- Name: TABLE edu_attendance_daily_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_attendance_daily_state TO service_role;


--
-- Name: COLUMN edu_attendance_daily_state.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tenant_id) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.enrollment_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(enrollment_id) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.school_day; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(school_day) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: COLUMN edu_attendance_daily_state.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.edu_attendance_daily_state TO authenticated;


--
-- Name: TABLE edu_courses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_courses TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.edu_courses TO authenticated;


--
-- Name: TABLE edu_daily_care_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_daily_care_records TO service_role;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.session_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(session_id) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.arrival_status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(arrival_status),UPDATE(arrival_status) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.arrival_time; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(arrival_time),UPDATE(arrival_time) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.morning_condition; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(morning_condition),UPDATE(morning_condition) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.meal_records; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(meal_records),UPDATE(meal_records) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.hygiene_records; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(hygiene_records),UPDATE(hygiene_records) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.nap_records; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(nap_records),UPDATE(nap_records) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(updated_at),UPDATE(updated_at) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: COLUMN edu_daily_care_records.student_party_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(student_party_id) ON TABLE public.edu_daily_care_records TO authenticated;


--
-- Name: TABLE edu_daily_care_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_daily_care_sessions TO service_role;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN,UPDATE ON TABLE public.edu_daily_care_sessions TO authenticated;


--
-- Name: TABLE edu_enrollments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.edu_enrollments TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.edu_enrollments TO authenticated;


--
-- Name: TABLE org_relationships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_relationships TO service_role;
GRANT ALL ON TABLE public.org_relationships TO authenticated;


--
-- Name: TABLE org_units; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_units TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.org_units TO authenticated;


--
-- Name: TABLE party_parties; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.party_parties TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.party_parties TO authenticated;


--
-- Name: TABLE party_relationships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.party_relationships TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.party_relationships TO authenticated;


--
-- Name: TABLE people_directory; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.people_directory TO service_role;
GRANT ALL ON TABLE public.people_directory TO authenticated;


--
-- Name: TABLE persons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.persons TO service_role;
GRANT ALL ON TABLE public.persons TO anon;
GRANT ALL ON TABLE public.persons TO authenticated;


--
-- Name: TABLE preschool_chain_course_branch_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE public.preschool_chain_course_branch_assignments TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN,UPDATE ON TABLE public.preschool_chain_course_branch_assignments TO authenticated;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.preschool_chain_course_branch_assignments TO service_role;


--
-- Name: TABLE students; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.students TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.students TO authenticated;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,MAINTAIN,UPDATE ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE user_org_unit_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_org_unit_access TO authenticated;
GRANT ALL ON TABLE public.user_org_unit_access TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--







--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--







--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--




--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--







--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--







--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--







--
-- PostgreSQL database dump complete
--





SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET search_path=public,extensions;

-- ============================================================================
-- R3 Student Identity Create-Side Completion
-- ============================================================================
-- Purpose:
-- Allow brand-new canonical Party-backed students to be created without
-- manufacturing legacy persons / identity_migration_mapping rows.
--
-- Contract:
-- - party_id remains the canonical Student identity for new writes.
-- - person_id remains as nullable transitional compatibility for legacy rows.
-- - Existing FK and indexes are preserved for legacy read paths.
-- ============================================================================

ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;


-- ============================================================================
-- Education Platform - Courses and Enrollments Tables
-- ============================================================================
-- Migration: 20260810231500_create_courses_and_enrollments
-- Description: Create courses and enrollments tables with FK constraints
--
-- Constitution Compliance:
-- - Law 4: Additive only
-- - Law 11: Strict typing
-- - Law 1: Enrollment references Student + Course
-- ============================================================================

-- Fix: Drop existing tables with wrong schema



-- ============================================================================
-- 1. COURSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  duration_weeks INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT courses_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT courses_course_code_unique UNIQUE (tenant_id, course_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON public.courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_course_code ON public.courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_tenant_isolation') THEN
    CREATE POLICY courses_tenant_isolation ON public.courses FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Trigger
CREATE OR REPLACE FUNCTION update_courses_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_courses_updated_at();

-- ============================================================================
-- 2. ENROLLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_date DATE NOT NULL,
  completion_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'withdrawn', 'failed', 'suspended')),
  grade TEXT,
  grade_points NUMERIC(5,2) CHECK (grade_points >= 0 AND grade_points <= 100),
  grade_status TEXT NOT NULL DEFAULT 'not_graded' CHECK (grade_status IN ('not_graded', 'in_progress', 'graded', 'pass', 'fail')),
  credits_earned INTEGER CHECK (credits_earned >= 0),
  attendance_percentage NUMERIC(5,2) CHECK (attendance_percentage >= 0 AND attendance_percentage <= 100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT enrollments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_fk FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT enrollments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_course_unique UNIQUE (tenant_id, student_id, course_id),
  CONSTRAINT enrollments_dates_check CHECK (completion_date IS NULL OR completion_date >= enrollment_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrollment_date ON public.enrollments(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_status ON public.enrollments(tenant_id, status);

-- RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enrollments' AND policyname = 'enrollments_tenant_isolation') THEN
    CREATE POLICY enrollments_tenant_isolation ON public.enrollments FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Trigger
CREATE OR REPLACE FUNCTION update_enrollments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enrollments_updated_at ON public.enrollments;
CREATE TRIGGER trigger_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION update_enrollments_updated_at();

-- ============================================================================
-- NOTIFY PostgREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END
-- ============================================================================


-- ============================================================================
-- Attendance Table Migration
--
-- Pattern: Inherited from Student/Enrollment/Course migrations
-- Constitution Compliance: Law 4 (Additive migrations only)
-- ============================================================================

-- Create attendances table
CREATE TABLE IF NOT EXISTS public.attendances (
  -- Primary key
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation
  tenant_id UUID NOT NULL,

  -- Foreign keys
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_id UUID,

  -- Session details
  session_date DATE NOT NULL,
  session_number INTEGER,
  session_type TEXT CHECK (session_type IN ('lecture', 'lab', 'tutorial', 'exam', 'workshop', 'seminar')),
  session_duration INTEGER, -- minutes

  -- Attendance tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'late', 'excused', 'pending')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  minutes_late INTEGER CHECK (minutes_late >= 0),

  -- Notes and excuses
  notes TEXT,
  excuse_reason TEXT,
  excuse_document_url TEXT,

  -- Verification
  verified_by UUID, -- User UUID who verified
  verified_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,

  -- Constraints
  CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_course FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_enrollment FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE SET NULL,
  CONSTRAINT check_out_after_check_in CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendances_tenant ON public.attendances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON public.attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course ON public.attendances(course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_enrollment ON public.attendances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendances_session_date ON public.attendances(session_date);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON public.attendances(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendances_student_course ON public.attendances(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course_date ON public.attendances(course_id, session_date);

-- Unique constraint: one attendance record per student per course per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_unique_session
  ON public.attendances(tenant_id, student_id, course_id, session_date, COALESCE(session_number, 0));

-- Enable Row Level Security
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access attendances from their tenant
CREATE POLICY tenant_isolation_policy ON public.attendances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO service_role;

-- Comments
COMMENT ON TABLE public.attendances IS 'Student attendance records for course sessions';
COMMENT ON COLUMN public.attendances.attendance_id IS 'Primary key';
COMMENT ON COLUMN public.attendances.tenant_id IS 'Tenant isolation';
COMMENT ON COLUMN public.attendances.student_id IS 'Foreign key to students table';
COMMENT ON COLUMN public.attendances.course_id IS 'Foreign key to courses table';
COMMENT ON COLUMN public.attendances.enrollment_id IS 'Optional foreign key to enrollments table';
COMMENT ON COLUMN public.attendances.session_date IS 'Date of the course session';
COMMENT ON COLUMN public.attendances.status IS 'Attendance status: present, absent, late, excused, pending';
COMMENT ON COLUMN public.attendances.minutes_late IS 'Minutes late for late arrivals';
COMMENT ON COLUMN public.attendances.verified_by IS 'User UUID who verified attendance';


-- Migration: Create assessments and assessment_results tables (CC-3.1)
-- Date: 2026-08-13

CREATE TABLE IF NOT EXISTS public.assessments (
  assessment_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.courses(course_id) ON DELETE RESTRICT,
  assessment_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('exam', 'quiz', 'assignment', 'project', 'presentation')),
  max_score NUMERIC(5, 2) NOT NULL,
  passing_score NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(5, 2) NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'graded', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT uq_assessments_code UNIQUE (tenant_id, assessment_code)
);

CREATE TABLE IF NOT EXISTS public.assessment_results (
  result_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  score NUMERIC(5, 2),
  grade TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  feedback TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'graded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_results_student UNIQUE (tenant_id, assessment_id, student_id)
);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS assessments_tenant_isolation ON public.assessments;
CREATE POLICY assessments_tenant_isolation ON public.assessments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS assessment_results_tenant_isolation ON public.assessment_results;
CREATE POLICY assessment_results_tenant_isolation ON public.assessment_results
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- Grant privileges for authenticated and service_role
GRANT ALL ON public.assessments TO authenticated, service_role;
GRANT ALL ON public.assessment_results TO authenticated, service_role;


-- ============================================================================
-- Education OS — Teacher Classroom Assignments Canonical Table
-- ============================================================================
-- Migration: 20260813000050_create_teacher_assignments
-- Target: Canonical persistence for TeacherClassroomAssignment aggregate.
-- Eliminates courses.metadata shadow model risk.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  teacher_party_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead_teacher', 'co_teacher', 'assistant', 'substitute')),
  academic_year TEXT NOT NULL,
  effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT teacher_assignments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_teacher_fk FOREIGN KEY (teacher_party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_dates_check CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant ON public.teacher_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_party_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_status ON public.teacher_assignments(status);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup ON public.teacher_assignments(tenant_id, course_id, academic_year, status);

-- Partial Unique Index: Hard Invariant - Max 1 active lead teacher per classroom/course per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lead_teacher_per_course_year
  ON public.teacher_assignments (tenant_id, course_id, academic_year)
  WHERE role = 'lead_teacher' AND status = 'active';

-- Unique Constraint: Prevent identical active teacher assignment (same course, teacher, year, role)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_teacher_course_role_year
  ON public.teacher_assignments (tenant_id, course_id, teacher_party_id, academic_year, role)
  WHERE status = 'active';

-- RLS Enablement & Policies
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_assignments' AND policyname = 'teacher_assignments_tenant_isolation') THEN
    CREATE POLICY teacher_assignments_tenant_isolation ON public.teacher_assignments
      FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID OR tenant_id = (current_setting('app.current_tenant_id', true))::UUID);
  END IF;
END $$;

-- Updated at Trigger
CREATE OR REPLACE FUNCTION update_teacher_assignments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teacher_assignments_updated_at ON public.teacher_assignments;
CREATE TRIGGER trigger_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_teacher_assignments_updated_at();

NOTIFY pgrst, 'reload schema';


CREATE TABLE public.edu_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  score_type TEXT NOT NULL CHECK (score_type IN ('quiz', 'midterm', 'final', 'homework')),
  grade NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(3, 2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);



CREATE INDEX idx_edu_assessments_tenant ON public.edu_assessments(tenant_id); CREATE INDEX idx_edu_assessments_enrollment ON public.edu_assessments(enrollment_id);

ALTER TABLE public.edu_assessments ENABLE ROW LEVEL SECURITY; CREATE POLICY edu_assessments_tenant_isolation ON public.edu_assessments FOR ALL USING(tenant_id=(current_setting('app.current_tenant_id',true))::uuid);

-- =============================================================================
-- Migration: 20260808000012_create_rule_engine_tables.sql
-- Phase D3: Governed Business Rule Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Governance Hierarchy (MUST be respected — D3 CANNOT override above layers):
--   Human Governance (ARB approval)
--     → Frozen Safety Policy (Constitution)
--       → Clinical Safety Engine (CDS/CPOE — Phase C)
--         → Platform Rule Engine (D3)  ← this layer
--           → Business Workflow
--
-- Rule Lifecycle (immutable versioning):
--   DRAFT → REVIEW → APPROVED → ACTIVE → SUSPENDED → RETIRED
--   - ACTIVE rules are immutable: create new version instead of UPDATE
--   - ABSOLUTE severity requires approved_by + approved_at (ARB approval)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. ENUMs
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE platform_rule_status AS ENUM (
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'ACTIVE',
    'SUSPENDED',
    'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_severity AS ENUM (
    'LOW',
    'MODERATE',
    'HIGH',
    'ABSOLUTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_action_type AS ENUM (
    'NOTIFY',
    'WARN',
    'ESCALATE',
    'EXECUTE_WORKFLOW',
    'BLOCK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_eval_outcome AS ENUM (
    'TRIGGERED',
    'NOT_TRIGGERED',
    'SKIPPED_SUSPENDED',
    'SKIPPED_EXPIRED',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. platform_business_rules — versioned, immutable once ACTIVE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_business_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  rule_key        TEXT NOT NULL,       -- stable identifier across versions, e.g. 'VIP_UPGRADE_BOOKING'
  version         TEXT NOT NULL,       -- semver: '1.0.0', '1.1.0'
  domain          platform_rule_domain NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,

  -- Lifecycle
  status          platform_rule_status NOT NULL DEFAULT 'DRAFT',
  severity        platform_rule_severity NOT NULL DEFAULT 'LOW',

  -- Conditions (JSON DSL)
  conditions      JSONB NOT NULL,      -- { operator: 'AND'|'OR', rules: [{field, op, value}] }

  -- Action
  action_type     platform_rule_action_type NOT NULL DEFAULT 'NOTIFY',
  action_params   JSONB NOT NULL DEFAULT '{}',  -- { message, workflowId, escalation_target, etc. }

  -- Governance
  -- ABSOLUTE severity rules: approved_by + approved_at are REQUIRED (enforced by check constraint)
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  effective_from  DATE,
  effective_to    DATE,               -- NULL = indefinite

  -- Audit
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Temporal linkage (D2): each status transition captures a snapshot
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Version uniqueness: one (tenant, rule_key, version) per system
  CONSTRAINT uq_rule_version UNIQUE (tenant_id, rule_key, version),

  -- Governance: ABSOLUTE severity requires ARB approval proof
  CONSTRAINT chk_absolute_requires_approval CHECK (
    severity <> 'ABSOLUTE' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pbr_tenant_domain  ON platform_business_rules(tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_pbr_status         ON platform_business_rules(status);
CREATE INDEX IF NOT EXISTS idx_pbr_rule_key       ON platform_business_rules(tenant_id, rule_key, version);
CREATE INDEX IF NOT EXISTS idx_pbr_active         ON platform_business_rules(tenant_id, domain, status)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_pbr_conditions_gin ON platform_business_rules USING GIN (conditions);

ALTER TABLE platform_business_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pbr_tenant_isolation ON platform_business_rules;
CREATE POLICY pbr_tenant_isolation ON platform_business_rules
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- updated_at trigger
CREATE OR REPLACE FUNCTION platform_rules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pbr_updated_at ON platform_business_rules;
CREATE TRIGGER trg_pbr_updated_at
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_set_updated_at();

-- ⚠️ IMMUTABILITY: ACTIVE rules cannot be modified — must create new version
CREATE OR REPLACE FUNCTION platform_rules_active_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow status transitions (ACTIVE → SUSPENDED, ACTIVE → RETIRED)
  IF OLD.status = 'ACTIVE' AND
     (NEW.conditions IS DISTINCT FROM OLD.conditions OR
      NEW.action_type IS DISTINCT FROM OLD.action_type OR
      NEW.action_params IS DISTINCT FROM OLD.action_params OR
      NEW.severity IS DISTINCT FROM OLD.severity OR
      NEW.domain IS DISTINCT FROM OLD.domain OR
      NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION
      'ACTIVE rule "%" (v%) cannot be modified. Create a new version instead. '
      'Governance Law: immutable rule versioning.',
      OLD.rule_key, OLD.version;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pbr_active_immutability ON platform_business_rules;
CREATE TRIGGER trg_pbr_active_immutability
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_active_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 3. platform_rule_evaluation_log — append-only evaluation audit
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_rule_evaluation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES platform_business_rules(id),
  rule_key        TEXT NOT NULL,
  rule_version    TEXT NOT NULL,

  -- Input context
  context_type    TEXT NOT NULL,       -- e.g. 'spa_booking', 'customer_journey'
  context_id      UUID,
  input_data      JSONB NOT NULL DEFAULT '{}',

  -- Result
  outcome         platform_rule_eval_outcome NOT NULL,
  conditions_met  BOOLEAN NOT NULL DEFAULT FALSE,
  action_taken    TEXT,
  action_result   JSONB,
  error_message   TEXT,

  -- Provenance
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_by    UUID,               -- system actor or user
  correlation_id  UUID,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_prel_tenant_id ON platform_rule_evaluation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prel_rule_id   ON platform_rule_evaluation_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_prel_context   ON platform_rule_evaluation_log(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_prel_eval_at   ON platform_rule_evaluation_log(evaluated_at DESC);

ALTER TABLE platform_rule_evaluation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prel_tenant_isolation ON platform_rule_evaluation_log;
CREATE POLICY prel_tenant_isolation ON platform_rule_evaluation_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- IMMUTABILITY: evaluation log is append-only
CREATE OR REPLACE FUNCTION platform_eval_log_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'platform_rule_evaluation_log is append-only: % is forbidden', TG_OP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_prel_immutability ON platform_rule_evaluation_log;
CREATE TRIGGER trg_prel_immutability
  BEFORE UPDATE OR DELETE ON platform_rule_evaluation_log
  FOR EACH ROW EXECUTE FUNCTION platform_eval_log_immutability_guard();

-- ─────────────────────────────────────────────────────────────────


ALTER TYPE public.platform_rule_domain ADD VALUE IF NOT EXISTS 'education.enrollment';

CREATE TABLE IF NOT EXISTS public.journey_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    journey_type TEXT NOT NULL, -- 'implant_care', 'car_repair', 'buying_process'
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    ai_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_journey_journeys_tenant ON public.journey_journeys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journey_journeys_party ON public.journey_journeys(primary_party_id);



CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    event_category TEXT NOT NULL CHECK (event_category IN ('business', 'audit', 'ai', 'system')),
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL DEFAULT 'v1',
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    aggregate_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    event_hash TEXT NOT NULL,
    reference_table TEXT,
    reference_id UUID,
    summary TEXT NOT NULL,
    ai_insight TEXT,
    event_data JSONB NOT NULL DEFAULT '{}',
    recorded_by UUID REFERENCES public.party_parties(id),
    occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, aggregate_type, aggregate_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_party ON public.timeline_events(primary_party_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_correlation ON public.timeline_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_aggregate ON public.timeline_events(aggregate_type, aggregate_id);

-- Enforce Timeline Immutability (no UPDATE or DELETE at DB level)
CREATE OR REPLACE RULE timeline_events_no_update AS ON UPDATE TO public.timeline_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE timeline_events_no_delete AS ON DELETE TO public.timeline_events DO INSTEAD NOTHING;



ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.journey_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_timeline ON public.timeline_events FOR ALL USING(tenant_id=public.get_auth_tenant_id());
CREATE POLICY tenant_isolation_journeys ON public.journey_journeys FOR ALL USING(tenant_id=public.get_auth_tenant_id());

CREATE OR REPLACE FUNCTION public.edu_enroll_student_v3(
  p_tenant_id UUID,
  p_student_party_id UUID,
  p_course_id UUID,
  p_enrollment_id UUID,
  p_enrolled_at TIMESTAMPTZ,
  p_request_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_max_students INTEGER;
  v_current_enrollment INTEGER;
  v_course_status TEXT;
  v_existing_id UUID;
  v_rows_affected INTEGER;
BEGIN
  -- 1. Pre-lock check for duplicate requests
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 2. Lock course row to ensure concurrent transactional safety
  SELECT status, max_students, current_enrollment
  INTO v_course_status, v_max_students, v_current_enrollment
  FROM public.edu_courses
  WHERE id = p_course_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2.5 Post-lock recheck of request_id (prevents race condition where wait for lock results in capacity error instead of duplicate response)
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 3. Check capacity safely
  IF v_course_status = 'full' OR (v_max_students IS NOT NULL AND v_current_enrollment >= v_max_students) THEN
    RAISE EXCEPTION 'Course capacity exceeded' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Create enrollment record with ON CONFLICT DO NOTHING to handle concurrent race conditions
  INSERT INTO public.edu_enrollments (
    id, tenant_id, student_party_id, course_id, status, enrolled_at, created_at, updated_at, request_id
  ) VALUES (
    p_enrollment_id, p_tenant_id, p_student_party_id, p_course_id, 'active', p_enrolled_at, now(), now(), p_request_id
  ) ON CONFLICT (tenant_id, request_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 5. If conflict occurred, return the duplicate enrollment details
  IF v_rows_affected = 0 THEN
    SELECT id INTO v_existing_id
    FROM public.edu_enrollments
    WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 6. Increment course current enrollment count
  v_current_enrollment := v_current_enrollment + 1;
  UPDATE public.edu_courses
  SET current_enrollment = v_current_enrollment,
      updated_at = now()
  WHERE id = p_course_id AND tenant_id = p_tenant_id;

  RETURN json_build_object('success', true, 'enrollment_id', p_enrollment_id, 'is_duplicate', false);
END;
$$ LANGUAGE plpgsql;


REVOKE ALL ON FUNCTION public.edu_enroll_student_v3(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.edu_enroll_student_v3(uuid,uuid,uuid,uuid,timestamptz,text) TO service_role,authenticated;

REVOKE ALL ON public.courses,public.enrollments,public.attendances,public.assessments,public.assessment_results,public.teacher_assignments,public.edu_assessments,public.platform_business_rules,public.platform_rule_evaluation_log,public.timeline_events,public.journey_journeys FROM anon;
REVOKE TRUNCATE ON public.courses,public.enrollments,public.attendances,public.assessments,public.assessment_results,public.teacher_assignments,public.edu_assessments,public.platform_business_rules,public.platform_rule_evaluation_log,public.timeline_events,public.journey_journeys FROM authenticated;
REVOKE UPDATE,DELETE ON public.timeline_events FROM authenticated;
GRANT SELECT,INSERT ON public.timeline_events TO authenticated;
GRANT ALL ON public.courses,public.enrollments,public.attendances,public.assessments,public.assessment_results,public.teacher_assignments,public.edu_assessments,public.platform_business_rules,public.platform_rule_evaluation_log,public.timeline_events,public.journey_journeys TO service_role;
NOTIFY pgrst,'reload schema';
ROLLBACK;