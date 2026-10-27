-- PROPOSED / NOT_AUTHORIZED / NOT_READY_FOR_EXECUTION.
-- Exact Production target lvnvkpyxtuilhrabtlwv; not E2E SQL replay.
-- Prepared from fresh read-only Production metadata 2026-10-24T01:28:23.311Z.
-- Source security reconciliation, restore proof and Human GO remain missing.
-- Unconditional hold precedes every DDL statement. There is no apply runner.
BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'; SET LOCAL search_path=pg_catalog,public;
DO $not_authorized$ BEGIN RAISE EXCEPTION 'PRESCHOOL_PRODUCTION_DRAFT_NOT_AUTHORIZED_OR_COMPLETE'; END $not_authorized$;
CREATE TABLE public."preschool_chain_course_branch_assignments" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "tenant_id" uuid NOT NULL,
 "course_id" uuid NOT NULL,
 "branch_id" uuid NOT NULL,
 "assigned_by" uuid,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "preschool_chain_course_branch_assignments_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES org_units(id) ON DELETE RESTRICT,
 CONSTRAINT "preschool_chain_course_branch_assignments_course_id_fkey" FOREIGN KEY (course_id) REFERENCES edu_courses(id) ON DELETE RESTRICT,
 CONSTRAINT "preschool_chain_course_branch_assignments_pkey" PRIMARY KEY (id),
 CONSTRAINT "preschool_chain_course_branch_assignments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
 CONSTRAINT "uq_preschool_chain_course_branch_assignment" UNIQUE (tenant_id, course_id)
);
ALTER TABLE public."preschool_chain_course_branch_assignments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."preschool_chain_course_branch_assignments" FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX idx_preschool_chain_course_branch_assignments_tenant_branch ON public.preschool_chain_course_branch_assignments USING btree (tenant_id, branch_id);
CREATE TABLE public."preschool_school_announcements" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "tenant_id" uuid NOT NULL,
 "request_id" uuid NOT NULL,
 "title" text NOT NULL,
 "body_text" text NOT NULL,
 "created_by" uuid NOT NULL,
 "published_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
 CONSTRAINT "preschool_school_announcements_body_text_check" CHECK (length(btrim(body_text)) >= 1 AND length(btrim(body_text)) <= 20000),
 CONSTRAINT "preschool_school_announcements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id),
 CONSTRAINT "preschool_school_announcements_pkey" PRIMARY KEY (id),
 CONSTRAINT "preschool_school_announcements_request_unique" UNIQUE (tenant_id, request_id),
 CONSTRAINT "preschool_school_announcements_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id),
 CONSTRAINT "preschool_school_announcements_title_check" CHECK (length(btrim(title)) >= 1 AND length(btrim(title)) <= 200)
);
ALTER TABLE public."preschool_school_announcements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."preschool_school_announcements" FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX preschool_school_announcements_feed_idx ON public.preschool_school_announcements USING btree (tenant_id, published_at DESC, id DESC);
CREATE OR REPLACE FUNCTION public.preschool_branch_access(p_tenant_id uuid, p_actor_id uuid, p_branch_id uuid, p_action text DEFAULT 'registry'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_role text; v_allowed boolean;
BEGIN
  IF p_actor_id IS NULL OR (auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_actor_id) THEN RETURN false; END IF;
  SELECT lower(u.role) INTO v_role FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id WHERE u.id=p_actor_id AND u.tenant_id=p_tenant_id
      AND u.status='active' AND t.status='active' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp());
  IF v_role IS NULL OR (p_action='admission' AND v_role NOT IN ('admin','super_admin'))
    OR (p_action IN ('registry','attendance') AND v_role NOT IN ('admin','super_admin','admin_staff'))
    OR p_action IS NULL OR p_action NOT IN ('admission','registry','attendance') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE id=p_branch_id AND tenant_id=p_tenant_id
    AND unit_type='branch' AND is_active=true) THEN RETURN false; END IF;
  IF auth.role()='service_role' THEN
    -- Service writers accept only current canonical tenant administrators.
    -- Their tenant-wide active-unit scope is the existing Platform admin rule.
    RETURN v_role IN ('admin','super_admin');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_org_unit_access WHERE user_id=auth.uid()
    AND tenant_id=p_tenant_id AND org_unit_id=p_branch_id) INTO v_allowed;
  RETURN v_allowed;
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_branch_access(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_branch_access(uuid,uuid,uuid,text) TO service_role,authenticated;
CREATE OR REPLACE FUNCTION public.preschool_course_assignment_visible(p_tenant_id uuid, p_course_id uuid, p_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT public.preschool_branch_access(p_tenant_id,auth.uid(),p_branch_id,'registry')
    AND EXISTS(SELECT 1 FROM public.edu_courses WHERE id=p_course_id AND tenant_id=p_tenant_id);
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_course_assignment_visible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_course_assignment_visible(uuid,uuid,uuid) TO service_role,authenticated;
CREATE OR REPLACE FUNCTION public.edu_attendance_can_read_course(p_tenant_id uuid, p_course_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_attendance_can_read_course(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_attendance_can_read_course(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.edu_can_access_attendance_enrollment(p_tenant_id uuid, p_enrollment_id uuid, p_school_day date)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_can_access_attendance_enrollment(uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_can_access_attendance_enrollment(uuid,uuid,date) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.edu_course_catalog_actor_allowed(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT current_setting('role',true)='authenticated' AND auth.uid() IS NOT NULL
 AND p_tenant_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
  WHERE u.id=auth.uid() AND u.tenant_id=p_tenant_id AND u.status='active'
  AND u.role='admin' AND t.status='active' AND t.product_key='bella_preschool'
 );
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_course_catalog_actor_allowed(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_course_catalog_actor_allowed(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.edu_preschool_enroll_student(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '5s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_enroll_student(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_enroll_student(uuid,uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.edu_preschool_enrollment_candidates(p_course_id uuid, p_query text, p_limit integer DEFAULT 20, p_cursor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_enrollment_candidates(uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_enrollment_candidates(uuid,text,integer,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.edu_preschool_roster_identity(p_course_id uuid, p_school_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '5s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.edu_preschool_roster_identity(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_roster_identity(uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.edu_set_daily_attendance(p_tenant_id uuid, p_enrollment_id uuid, p_status text, p_roll_call_time timestamp with time zone, p_school_day date)
 RETURNS TABLE(id uuid, tenant_id uuid, enrollment_id uuid, school_day date, status text, event_id uuid, roll_call_time timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
-- Preserve existing EXECUTE ACL, including non-application verification/migration roles.
CREATE OR REPLACE FUNCTION public.preschool_list_school_announcements()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_list_school_announcements() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_list_school_announcements() TO authenticated;
CREATE OR REPLACE FUNCTION public.preschool_portal_daily_read(p_tenant_id uuid, p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '5s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_portal_daily_read(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_portal_daily_read(uuid,uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.preschool_portal_issuer_context(p_course_id uuid, p_student_party_id uuid, p_guardian_party_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '5s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_portal_issuer_context(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_portal_issuer_context(uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.preschool_portal_school_announcements_read(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '10s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_portal_school_announcements_read(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_portal_school_announcements_read(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.preschool_publish_school_announcement(p_request_id uuid, p_title text, p_body_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET lock_timeout TO '5s'
 SET statement_timeout TO '10s'
AS $function$
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
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_publish_school_announcement(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_publish_school_announcement(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.preschool_save_care_records(p_tenant_id uuid, p_course_id uuid, p_day date, p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  INSERT INTO public.edu_daily_care_records AS target(tenant_id,session_id,student_party_id,arrival_status,morning_condition,meal_records,nap_records,hygiene_records,updated_at)
  SELECT p_tenant_id,v_session_id,(input.rec->>'studentPartyId')::uuid,'PRESENT',coalesce(input.rec->>'note',''),
   CASE WHEN input.rec->'meal' IS NOT NULL AND input.rec->'meal'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('mealType','LUNCH','portion',input.rec->'meal'->>'portion','notes',coalesce(input.rec->'meal'->>'notes',''),'recordedAt',stamp)) ELSE '[]'::jsonb END,
   CASE WHEN input.rec->'nap' IS NOT NULL AND input.rec->'nap'<>'null'::jsonb
    THEN jsonb_build_object('quality',input.rec->'nap'->>'quality','notes',coalesce(input.rec->'nap'->>'notes',''),'updatedAt',stamp) ELSE '{}'::jsonb END,
   CASE WHEN input.rec->'hygiene' IS NOT NULL AND input.rec->'hygiene'<>'null'::jsonb
    THEN jsonb_build_array(jsonb_build_object('type',input.rec->'hygiene'->>'type','notes',coalesce(input.rec->'hygiene'->>'notes',''),'time',stamp)) ELSE '[]'::jsonb END,stamp
  FROM jsonb_array_elements(p_records) WITH ORDINALITY AS input(rec,ordinal)
  ORDER BY input.ordinal
  ON CONFLICT(session_id,student_party_id) WHERE student_party_id IS NOT NULL
  DO UPDATE SET morning_condition=excluded.morning_condition,meal_records=excluded.meal_records,
   nap_records=excluded.nap_records,hygiene_records=excluded.hygiene_records,updated_at=excluded.updated_at
  WHERE target.tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>jsonb_array_length(p_records) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CARE_WRITE_NOT_CONFIRMED'; END IF;
  count_saved:=affected;
 RETURN jsonb_build_object('savedCount',count_saved,'total',jsonb_array_length(p_records));
END;
$function$;
REVOKE ALL PRIVILEGES ON FUNCTION public.preschool_save_care_records(uuid,uuid,date,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preschool_save_care_records(uuid,uuid,date,jsonb) TO authenticated;
GRANT SELECT ON TABLE public."preschool_chain_course_branch_assignments" TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public."preschool_chain_course_branch_assignments" TO service_role;
CREATE POLICY "preschool_chain_course_branch_select" ON public."preschool_chain_course_branch_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (preschool_course_assignment_visible(tenant_id, course_id, branch_id));
-- STOP: existing-table scoped ACL/RLS reconciliation is a separate unresolved module.
-- No Student legacy columns, audit index, Timeline FK or enrollment event producer is copied from E2E.
ROLLBACK;
