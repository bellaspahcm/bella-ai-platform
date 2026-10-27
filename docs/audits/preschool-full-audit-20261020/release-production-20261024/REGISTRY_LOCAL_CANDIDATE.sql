-- APPROVED Non-Production only, 2026-10-24. Default rehearsal ROLLBACK.
-- Runner must pin the owned local C target and existing security fingerprints first.
-- This is NOT an executable Production package.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $prerequisite$
BEGIN
 IF to_regclass('public.preschool_chain_course_branch_assignments') IS NULL THEN
  CREATE TABLE public.preschool_chain_course_branch_assignments (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
   course_id uuid NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
   branch_id uuid NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
   assigned_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
   CONSTRAINT uq_preschool_chain_course_branch_assignment UNIQUE(tenant_id,course_id));
  ALTER TABLE public.preschool_chain_course_branch_assignments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.preschool_chain_course_branch_assignments FROM PUBLIC,anon,authenticated,service_role;
  CREATE INDEX idx_preschool_chain_course_branch_assignments_tenant_branch
   ON public.preschool_chain_course_branch_assignments(tenant_id,branch_id);
 END IF;
END $prerequisite$;
-- This exact Product-owned prerequisite is read-only to callers; shared-table ACLs/policies are untouched.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.preschool_chain_course_branch_assignments FROM PUBLIC,anon,authenticated;
DO $mapping_guard$
DECLARE v_column text;
BEGIN
 FOR v_column IN SELECT attname FROM pg_attribute WHERE attrelid='public.preschool_chain_course_branch_assignments'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.preschool_chain_course_branch_assignments FROM PUBLIC,anon,authenticated',v_column,v_column,v_column);
 END LOOP;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.preschool_chain_course_branch_assignments'::regclass)
 OR EXISTS(SELECT 1 FROM (VALUES('anon'),('authenticated')) r(name)
  CROSS JOIN (VALUES('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
  WHERE has_table_privilege(r.name,'public.preschool_chain_course_branch_assignments',p.privilege))
 OR has_any_column_privilege('anon','public.preschool_chain_course_branch_assignments','INSERT,UPDATE,REFERENCES')
 OR has_any_column_privilege('authenticated','public.preschool_chain_course_branch_assignments','INSERT,UPDATE,REFERENCES')
 THEN RAISE EXCEPTION 'REGISTRY_MAPPING_NOT_READ_ONLY' USING ERRCODE='42501';END IF;
END $mapping_guard$;
-- CREATE, not REPLACE: unexpected prior capability aborts the whole transaction.
CREATE FUNCTION public.edu_preschool_student_registry(
 p_query text DEFAULT '',p_status text DEFAULT 'all',p_course_id uuid DEFAULT NULL,
 p_branch_id uuid DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='pg_catalog' SET statement_timeout='10s' SET lock_timeout='2s'
AS $registry$
DECLARE v_actor uuid:=auth.uid();v_tenant uuid;v_branches uuid[];v_query text:=btrim(p_query);v_result jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR v_actor IS NULL
 THEN RAISE EXCEPTION 'REGISTRY_ACCESS_DENIED' USING ERRCODE='42501';END IF;
 SELECT u.tenant_id INTO v_tenant FROM public.users u
 JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
 WHERE u.id=v_actor AND u.status='active' AND u.role='admin' AND t.status='active'
 AND t.product_key='bella_preschool' AND a.deleted_at IS NULL
 AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp());
 IF v_tenant IS NULL THEN RAISE EXCEPTION 'REGISTRY_ACCESS_DENIED' USING ERRCODE='42501';END IF;
 IF p_query IS NULL OR char_length(v_query)>80 OR v_query ~ '[[:cntrl:]]'
 OR p_status IS NULL OR p_status NOT IN('all','active','pending')
 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 OR p_limit IS NULL OR p_limit<1 OR p_limit>50
 THEN RAISE EXCEPTION 'REGISTRY_INVALID_REQUEST' USING ERRCODE='22023';END IF;
 SELECT array_agg(DISTINCT b.id) INTO v_branches FROM public.org_units b
 JOIN public.user_org_unit_access x ON x.org_unit_id=b.id AND x.tenant_id=b.tenant_id
 WHERE b.tenant_id=v_tenant AND b.unit_type='branch' AND b.is_active
 AND x.user_id=v_actor AND x.relationship_id IS NOT NULL;
 IF coalesce(cardinality(v_branches),0)=0 OR (p_branch_id IS NOT NULL AND NOT p_branch_id=ANY(v_branches))
 THEN RAISE EXCEPTION 'REGISTRY_BRANCH_ACCESS_DENIED' USING ERRCODE='42501';END IF;
 IF p_course_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.edu_courses c JOIN public.preschool_chain_course_branch_assignments a
  ON a.tenant_id=c.tenant_id AND a.course_id=c.id
  WHERE c.tenant_id=v_tenant AND c.id=p_course_id AND c.status='active'
  AND a.branch_id=ANY(v_branches) AND (p_branch_id IS NULL OR a.branch_id=p_branch_id))
 THEN RAISE EXCEPTION 'REGISTRY_COURSE_ACCESS_DENIED' USING ERRCODE='42501';END IF;
 -- Unassigned existing enrollments must not become a successful empty or partial school registry.
 IF EXISTS(SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c
  ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
  WHERE e.tenant_id=v_tenant AND e.status IN('active','pending') AND (p_course_id IS NULL OR c.id=p_course_id)
  AND NOT EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments a JOIN public.org_units b
   ON b.id=a.branch_id AND b.tenant_id=a.tenant_id AND b.unit_type='branch' AND b.is_active
   WHERE a.tenant_id=e.tenant_id AND a.course_id=e.course_id))
 THEN RAISE EXCEPTION 'REGISTRY_CONFIGURATION_UNAVAILABLE' USING ERRCODE='55000';END IF;
 -- An authorized identity join failure is unavailable data, never a fabricated empty list.
 IF EXISTS(SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c
  ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
  JOIN public.preschool_chain_course_branch_assignments a ON a.tenant_id=e.tenant_id AND a.course_id=e.course_id
  WHERE e.tenant_id=v_tenant AND e.status IN('active','pending') AND a.branch_id=ANY(v_branches)
  AND (p_branch_id IS NULL OR a.branch_id=p_branch_id) AND (p_course_id IS NULL OR c.id=p_course_id)
  AND ((SELECT count(*) FROM public.students s WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id)<>1
   OR NOT EXISTS(SELECT 1 FROM public.students s JOIN public.party_parties p ON p.id=s.party_id AND p.tenant_id=s.tenant_id
    WHERE s.tenant_id=v_tenant AND s.party_id=e.student_party_id AND s.academic_status='enrolled'
    AND p.party_type='person' AND p.deleted_at IS NULL AND btrim(p.display_name)<>'')))
 THEN RAISE EXCEPTION 'REGISTRY_IDENTITY_UNAVAILABLE' USING ERRCODE='42501';END IF;
 WITH allowed_enrollments AS (
  SELECT e.id,e.student_party_id,e.status,c.id course_id,c.course_code,c.title,a.branch_id,b.name branch_name
  FROM public.edu_enrollments e JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
  JOIN public.preschool_chain_course_branch_assignments a ON a.course_id=c.id AND a.tenant_id=c.tenant_id
  JOIN public.org_units b ON b.id=a.branch_id AND b.tenant_id=a.tenant_id AND b.unit_type='branch' AND b.is_active
  WHERE e.tenant_id=v_tenant AND e.status IN('active','pending') AND b.id=ANY(v_branches)
  AND (p_branch_id IS NULL OR b.id=p_branch_id) AND (p_course_id IS NULL OR c.id=p_course_id)
 ), students AS (
  SELECT s.student_id,s.party_id,s.student_code,p.display_name,p.gender,p.dob,
   bool_or(e.status='active') has_active,bool_or(e.status='pending') has_pending,
   jsonb_build_object('id',s.student_id,'tenantId',v_tenant,'partyId',s.party_id,'studentCode',s.student_code,
    'name',p.display_name,'gender',p.gender,'dob',p.dob,
    'enrollments',jsonb_agg(jsonb_build_object('id',e.id,'courseId',e.course_id,'courseCode',e.course_code,
     'courseTitle',e.title,'branchId',e.branch_id,'branchName',e.branch_name,'status',e.status) ORDER BY e.id)) data
  FROM allowed_enrollments e JOIN public.students s ON s.tenant_id=v_tenant AND s.party_id=e.student_party_id
  JOIN public.party_parties p ON p.tenant_id=s.tenant_id AND p.id=s.party_id
  GROUP BY s.student_id,s.party_id,s.student_code,p.display_name,p.gender,p.dob
 ), matched AS (
  SELECT * FROM students WHERE (p_status='all' OR (p_status='active' AND has_active) OR (p_status='pending' AND has_pending))
  AND (v_query='' OR strpos(lower(display_name),lower(v_query))>0 OR strpos(lower(student_code),lower(v_query))>0)
 ), page AS (SELECT student_id,data FROM matched ORDER BY student_id OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('tenantId',v_tenant,'request',jsonb_build_object('query',v_query,'status',p_status,
  'courseId',p_course_id,'branchId',p_branch_id,'offset',p_offset,'limit',p_limit),
  'totals',(SELECT jsonb_build_object('students',count(*),'active',count(*) FILTER(WHERE has_active),
   'pending',count(*) FILTER(WHERE has_pending)) FROM students),
  'filteredTotal',(SELECT count(*) FROM matched),
  'nextOffset',CASE WHEN p_offset::bigint+p_limit<(SELECT count(*) FROM matched) AND p_offset+p_limit<=100000 THEN p_offset+p_limit ELSE NULL END,
  'students',(SELECT coalesce(jsonb_agg(data ORDER BY student_id),'[]'::jsonb) FROM page)) INTO v_result;
 RETURN v_result;
END $registry$;
REVOKE ALL ON FUNCTION public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer) TO authenticated;
ROLLBACK;
