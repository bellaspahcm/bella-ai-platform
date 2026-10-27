-- Target ONLY lvnvkpyxtuilhrabtlwv; owner approved integration and Production registry/mapping in current chat.
-- Default ROLLBACK. Runner must verify protected backup, isolated restore, reviewed hashes,
-- exact source/security/business fingerprints, real rehearsal/recovery before COMMIT.
BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='20s';SET LOCAL idle_in_transaction_session_timeout='30s';SET LOCAL search_path=pg_catalog,public;
CREATE TEMP TABLE registry_before ON COMMIT DROP AS SELECT (SELECT md5(coalesce((SELECT string_agg(to_jsonb(s)::text,'|' ORDER BY student_id) FROM public.students s WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')||coalesce((SELECT string_agg(to_jsonb(e)::text,'|' ORDER BY id) FROM public.edu_enrollments e WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')||coalesce((SELECT string_agg(to_jsonb(p)::text,'|' ORDER BY id) FROM public.party_parties p WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')) AS hash) business,(SELECT md5(
coalesce((SELECT string_agg(ROW(c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner),c.relacl::text)::text,'|' ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname NOT IN('preschool_chain_course_branch_assignments','preschool_chain_course_branch_assignments_pkey','uq_preschool_chain_course_branch_assignment','idx_preschool_chain_course_branch_assignments_tenant_branch')),'')||
coalesce((SELECT string_agg(ROW(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text)::text,'|' ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relname NOT IN('preschool_chain_course_branch_assignments','preschool_chain_course_branch_assignments_pkey','uq_preschool_chain_course_branch_assignment','idx_preschool_chain_course_branch_assignments_tenant_branch')),'')||
coalesce((SELECT string_agg(ROW(p.polrelid::regclass::text,p.polname,p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(p.polroles) r ORDER BY r),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))::text,'|' ORDER BY p.polrelid::regclass::text,p.polname) FROM pg_policy p),'')||
coalesce((SELECT string_agg(ROW(p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text)::text,'|' ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname<>'edu_preschool_student_registry'),'')||
coalesce((SELECT string_agg(ROW(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option)::text,'|' ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor)) FROM pg_auth_members m WHERE pg_get_userbyid(m.member) NOT LIKE 'bella_restore_%' AND pg_get_userbyid(m.grantor) NOT LIKE 'bella_restore_%'),'')||
coalesce((SELECT string_agg(ROW(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,d.defaclacl::text)::text,'|' ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),'')
) AS hash) security;
DO $baseline$ BEGIN
IF to_regclass('public.preschool_chain_course_branch_assignments') IS NOT NULL OR to_regprocedure('public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)') IS NOT NULL THEN RAISE EXCEPTION 'REGISTRY_BASELINE_DRIFT';END IF;
IF (SELECT count(*) FROM public.users u JOIN auth.users a ON a.id=u.id JOIN public.tenants t ON t.id=u.tenant_id WHERE u.id='ad6899c2-4b9d-49af-acb3-69e2e1d11447' AND u.tenant_id='ed100000-0000-0000-0000-000000000001' AND u.role='admin' AND u.status='active' AND t.status='active' AND t.product_key='bella_preschool' AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now()))<>1 THEN RAISE EXCEPTION 'REGISTRY_OPERATOR_DRIFT';END IF;
IF EXISTS(SELECT 1 FROM public.org_units WHERE tenant_id='ed100000-0000-0000-0000-000000000001' AND (unit_type='branch' OR code='AD-CS01')) OR EXISTS(SELECT 1 FROM public.people_directory WHERE tenant_id='ed100000-0000-0000-0000-000000000001' AND user_id='ad6899c2-4b9d-49af-acb3-69e2e1d11447') THEN RAISE EXCEPTION 'REGISTRY_CONFIGURATION_DRIFT';END IF;
IF (SELECT jsonb_agg(id ORDER BY id) FROM public.edu_courses WHERE tenant_id='ed100000-0000-0000-0000-000000000001' AND status='active') IS DISTINCT FROM '["ed100000-c001-0000-0000-000000000001","ed100000-c002-0000-0000-000000000002","ed100000-c003-0000-0000-000000000003","ed100000-c004-0000-0000-000000000004","ed100000-c005-0000-0000-000000000005","ed100000-c006-0000-0000-000000000006","ed100000-c007-0000-0000-000000000007","ed100000-c008-0000-0000-000000000008"]'::jsonb THEN RAISE EXCEPTION 'REGISTRY_COURSE_DRIFT';END IF;
END $baseline$;
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

INSERT INTO public.org_units(id,tenant_id,unit_type,name,code,is_active,metadata) VALUES('341b519a-6206-4b50-94c5-9fe9ef71a1fc','ed100000-0000-0000-0000-000000000001','branch','Cơ sở chính Ánh Dương','AD-CS01',true,jsonb_build_object('registryPackage','20261024'));
INSERT INTO public.people_directory(id,tenant_id,user_id,person_type,display_name,is_active,metadata) VALUES('1f6ee2f2-1a69-423a-b659-41d2639e3ec6','ed100000-0000-0000-0000-000000000001','ad6899c2-4b9d-49af-acb3-69e2e1d11447','employee','Quản Trị Viên Mầm Non',true,jsonb_build_object('registryPackage','20261024'));
INSERT INTO public.org_relationships(id,tenant_id,from_id,from_type,to_id,to_type,rel_type,since,metadata) VALUES('4bff4932-38d0-4677-bcac-0d123a09ce4c','ed100000-0000-0000-0000-000000000001','1f6ee2f2-1a69-423a-b659-41d2639e3ec6','person','341b519a-6206-4b50-94c5-9fe9ef71a1fc','unit','manages',CURRENT_DATE,jsonb_build_object('registryPackage','20261024'));
INSERT INTO public.preschool_chain_course_branch_assignments(tenant_id,course_id,branch_id,assigned_by) SELECT 'ed100000-0000-0000-0000-000000000001',id,'341b519a-6206-4b50-94c5-9fe9ef71a1fc','ad6899c2-4b9d-49af-acb3-69e2e1d11447' FROM public.edu_courses WHERE tenant_id='ed100000-0000-0000-0000-000000000001' AND id IN('ed100000-c001-0000-0000-000000000001','ed100000-c002-0000-0000-000000000002','ed100000-c003-0000-0000-000000000003','ed100000-c004-0000-0000-000000000004','ed100000-c005-0000-0000-000000000005','ed100000-c006-0000-0000-000000000006','ed100000-c007-0000-0000-000000000007','ed100000-c008-0000-0000-000000000008');
DO $post$ BEGIN
IF (SELECT md5(coalesce((SELECT string_agg(to_jsonb(s)::text,'|' ORDER BY student_id) FROM public.students s WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')||coalesce((SELECT string_agg(to_jsonb(e)::text,'|' ORDER BY id) FROM public.edu_enrollments e WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')||coalesce((SELECT string_agg(to_jsonb(p)::text,'|' ORDER BY id) FROM public.party_parties p WHERE tenant_id='ed100000-0000-0000-0000-000000000001'),'')) AS hash) IS DISTINCT FROM (SELECT business FROM registry_before) THEN RAISE EXCEPTION 'REGISTRY_BUSINESS_ROW_CHANGED';END IF;
IF (SELECT md5(
coalesce((SELECT string_agg(ROW(c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner),c.relacl::text)::text,'|' ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname NOT IN('preschool_chain_course_branch_assignments','preschool_chain_course_branch_assignments_pkey','uq_preschool_chain_course_branch_assignment','idx_preschool_chain_course_branch_assignments_tenant_branch')),'')||
coalesce((SELECT string_agg(ROW(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text)::text,'|' ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relname NOT IN('preschool_chain_course_branch_assignments','preschool_chain_course_branch_assignments_pkey','uq_preschool_chain_course_branch_assignment','idx_preschool_chain_course_branch_assignments_tenant_branch')),'')||
coalesce((SELECT string_agg(ROW(p.polrelid::regclass::text,p.polname,p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(p.polroles) r ORDER BY r),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))::text,'|' ORDER BY p.polrelid::regclass::text,p.polname) FROM pg_policy p),'')||
coalesce((SELECT string_agg(ROW(p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proacl::text)::text,'|' ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname<>'edu_preschool_student_registry'),'')||
coalesce((SELECT string_agg(ROW(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option)::text,'|' ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor)) FROM pg_auth_members m WHERE pg_get_userbyid(m.member) NOT LIKE 'bella_restore_%' AND pg_get_userbyid(m.grantor) NOT LIKE 'bella_restore_%'),'')||
coalesce((SELECT string_agg(ROW(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,d.defaclacl::text)::text,'|' ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),'')
) AS hash) IS DISTINCT FROM (SELECT security FROM registry_before) THEN RAISE EXCEPTION 'REGISTRY_SHARED_SECURITY_CHANGED';END IF;
IF (SELECT count(*) FROM public.preschool_chain_course_branch_assignments WHERE tenant_id='ed100000-0000-0000-0000-000000000001' AND branch_id='341b519a-6206-4b50-94c5-9fe9ef71a1fc')<>8 THEN RAISE EXCEPTION 'REGISTRY_MAPPING_INCOMPLETE';END IF;
IF NOT has_function_privilege('authenticated','public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)','EXECUTE') OR has_function_privilege('anon','public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'REGISTRY_EXECUTE_ACL';END IF;
END $post$;
NOTIFY pgrst,'reload schema';
ROLLBACK;
