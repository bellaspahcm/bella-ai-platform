-- Owner amendment 2026-10-25: Registry prerequisite plus one synthetic branch-denial fixture; always rollback.
-- Target: isolated transaction on Supabase E2E bmnbqbcdbuklhopfbopv only.
-- Creates and verifies the exact candidate, then always rolls it back.
-- This is a rehearsal artifact, not a Production migration.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

DO $baseline_identity$
DECLARE v_fingerprint text;
BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT md5(system_identifier::text) FROM pg_catalog.pg_control_system())<>'58bbaa6e976181ecccc95a8084ac436a'
 THEN RAISE EXCEPTION 'G1_E2E_IDENTITY_OR_OWNER_MISMATCH';END IF;
WITH dependencies(name, relation_oid) AS (
  VALUES
    ('auth.users', 'auth.users'::regclass),
    ('public.users', 'public.users'::regclass),
    ('public.tenants', 'public.tenants'::regclass),
    ('public.students', 'public.students'::regclass),
    ('public.edu_enrollments', 'public.edu_enrollments'::regclass),
    ('public.edu_enrollment_event_records', 'public.edu_enrollment_event_records'::regclass),
    ('public.edu_enrollment_event_replays', 'public.edu_enrollment_event_replays'::regclass),
    ('public.edu_courses', 'public.edu_courses'::regclass),
    ('public.preschool_chain_course_branch_assignments', 'public.preschool_chain_course_branch_assignments'::regclass),
    ('public.org_units', 'public.org_units'::regclass),
    ('public.people_directory', 'public.people_directory'::regclass),
    ('public.org_relationships', 'public.org_relationships'::regclass),
    ('public.user_org_unit_access', 'public.user_org_unit_access'::regclass),
    ('public.party_parties', 'public.party_parties'::regclass),
    ('public.party_relationships', 'public.party_relationships'::regclass),
    ('public.party_identifiers', 'public.party_identifiers'::regclass),
    ('public.edu_preschool_pickup_authorizations', 'public.edu_preschool_pickup_authorizations'::regclass)
), relation_state AS (
  SELECT jsonb_agg(jsonb_build_object(
    'name', dependencies.name, 'kind', class.relkind, 'owner', owner_role.rolname,
    'acl', coalesce(class.relacl::text, ''), 'rls', class.relrowsecurity,
    'forceRls', class.relforcerowsecurity, 'options', coalesce(class.reloptions::text, ''),
    'view', CASE WHEN class.relkind IN ('v', 'm') THEN pg_get_viewdef(class.oid, true) ELSE NULL END
  ) ORDER BY dependencies.name) value
  FROM dependencies
  JOIN pg_class class ON class.oid = dependencies.relation_oid
  JOIN pg_roles owner_role ON owner_role.oid = class.relowner
), column_state AS (
  SELECT jsonb_agg(jsonb_build_object(
    'relation', dependencies.name, 'position', attribute.attnum, 'name', attribute.attname,
    'type', format_type(attribute.atttypid, attribute.atttypmod), 'notNull', attribute.attnotnull,
    'acl', coalesce(attribute.attacl::text, ''),
    'default', pg_get_expr(default_value.adbin, default_value.adrelid)
  ) ORDER BY dependencies.name, attribute.attnum) value
  FROM dependencies
  JOIN pg_attribute attribute ON attribute.attrelid = dependencies.relation_oid
    AND attribute.attnum > 0 AND NOT attribute.attisdropped
  LEFT JOIN pg_attrdef default_value ON default_value.adrelid = attribute.attrelid
    AND default_value.adnum = attribute.attnum
), constraint_state AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'relation', dependencies.name, 'name', constraint_row.conname,
    'type', constraint_row.contype, 'definition', pg_get_constraintdef(constraint_row.oid, true)
  ) ORDER BY dependencies.name, constraint_row.conname), '[]'::jsonb) value
  FROM dependencies
  JOIN pg_constraint constraint_row ON constraint_row.conrelid = dependencies.relation_oid
), index_state AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'relation', dependencies.name, 'name', index_class.relname,
    'definition', pg_get_indexdef(index_row.indexrelid)
  ) ORDER BY dependencies.name, index_class.relname), '[]'::jsonb) value
  FROM dependencies
  JOIN pg_index index_row ON index_row.indrelid = dependencies.relation_oid
  JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
), policy_state AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'relation', dependencies.name, 'name', policy.polname, 'command', policy.polcmd,
    'permissive', policy.polpermissive, 'roles', policy.polroles::text,
    'using', pg_get_expr(policy.polqual, policy.polrelid),
    'check', pg_get_expr(policy.polwithcheck, policy.polrelid)
  ) ORDER BY dependencies.name, policy.polname), '[]'::jsonb) value
  FROM dependencies
  JOIN pg_policy policy ON policy.polrelid = dependencies.relation_oid
), helper_state AS (
  SELECT jsonb_agg(jsonb_build_object(
    'signature', procedure_row.oid::regprocedure::text, 'owner', owner_role.rolname,
    'securityDefiner', procedure_row.prosecdef, 'volatility', procedure_row.provolatile,
    'config', coalesce(procedure_row.proconfig::text, ''), 'acl', coalesce(procedure_row.proacl::text, ''),
    'definition', pg_get_functiondef(procedure_row.oid)
  ) ORDER BY procedure_row.oid::regprocedure::text) value
  FROM pg_proc procedure_row
  JOIN pg_roles owner_role ON owner_role.oid = procedure_row.proowner
  WHERE procedure_row.oid IN ('auth.uid()'::regprocedure, 'public.get_auth_tenant_id()'::regprocedure)
), trigger_state AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'relation',dependencies.name,'name',trigger_row.tgname,'enabled',trigger_row.tgenabled,
    'definition',pg_get_triggerdef(trigger_row.oid,true),
    'function',pg_get_functiondef(trigger_row.tgfoid),
    'owner',pg_get_userbyid(procedure_row.proowner),'acl',coalesce(procedure_row.proacl::text,''),
    'config',coalesce(procedure_row.proconfig::text,'')
  ) ORDER BY dependencies.name,trigger_row.tgname),'[]'::jsonb) value
  FROM dependencies JOIN pg_trigger trigger_row ON trigger_row.tgrelid=dependencies.relation_oid
    AND NOT trigger_row.tgisinternal
  JOIN pg_proc procedure_row ON procedure_row.oid=trigger_row.tgfoid
), fingerprint AS (
  SELECT md5(jsonb_build_object(
    'relations', relation_state.value, 'columns', column_state.value,
    'constraints', constraint_state.value, 'indexes', index_state.value,
    'policies', policy_state.value, 'helpers', helper_state.value, 'triggers',trigger_state.value
  )::text) value
  FROM relation_state, column_state, constraint_state, index_state, policy_state, helper_state,trigger_state
), expected AS (
  SELECT '9e2a86a83c73256f6ac9bd8572fdf0dd'::text value
)
SELECT fingerprint.value INTO v_fingerprint FROM fingerprint;
 IF v_fingerprint IS DISTINCT FROM '9e2a86a83c73256f6ac9bd8572fdf0dd'
 THEN RAISE EXCEPTION 'G1_DEPENDENCY_FINGERPRINT_MISMATCH';END IF;
END
$baseline_identity$;

DO $preflight$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='preschool_g1_guardians_read') THEN
    RAISE EXCEPTION 'G1_FUNCTION_ALREADY_EXISTS';
  END IF;
  IF to_regclass('auth.users') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.tenants') IS NULL
    OR to_regclass('public.students') IS NULL
    OR to_regclass('public.edu_enrollments') IS NULL
    OR to_regclass('public.edu_courses') IS NULL
    OR to_regclass('public.preschool_chain_course_branch_assignments') IS NULL
    OR to_regclass('public.org_units') IS NULL
    OR to_regclass('public.party_parties') IS NULL
    OR to_regclass('public.party_relationships') IS NULL
    OR to_regclass('public.party_identifiers') IS NULL
    OR to_regclass('public.edu_preschool_pickup_authorizations') IS NULL
    OR to_regclass('public.user_org_unit_access') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('public.get_auth_tenant_id()') IS NULL
  THEN
    RAISE EXCEPTION 'G1_BASELINE_DEPENDENCY_MISSING';
  END IF;
END
$preflight$;


CREATE TEMP TABLE g1_fixture_before ON COMMIT DROP AS SELECT md5(jsonb_build_object('public.org_units',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.org_units x),'public.edu_courses',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_courses x),'public.party_parties',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.party_parties x),'public.students',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.students x),'public.preschool_chain_course_branch_assignments',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.preschool_chain_course_branch_assignments x),'public.edu_enrollments',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_enrollments x),'public.edu_enrollment_event_records',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_enrollment_event_records x))::text) AS value;
DO $registry_pre$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='edu_preschool_student_registry') THEN
    RAISE EXCEPTION 'G1_REGISTRY_ALREADY_PRESENT';
  END IF;
END
$registry_pre$;
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
DO $registry_acl$
DECLARE v_oid oid := 'public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)'::regprocedure;
BEGIN
  IF md5(pg_get_functiondef(v_oid)) IS DISTINCT FROM '8dd5106a6d5ee18e857ffddfefdcd706'
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef AND provolatile='s'
      AND pg_get_userbyid(proowner)='postgres' AND 'search_path=pg_catalog'=ANY(proconfig))
    OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
    OR has_function_privilege('anon',v_oid,'EXECUTE')
    OR has_function_privilege('service_role',v_oid,'EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      WHERE p.oid=v_oid AND acl.privilege_type='EXECUTE'
        AND acl.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticated')))
    OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      WHERE p.oid=v_oid AND acl.grantee=0 AND acl.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'G1_REGISTRY_ACL_INVALID'; END IF;
END
$registry_acl$;



-- Include only within the reviewed E2E transaction.

-- Include only within the reviewed E2E transaction.

-- Include only within the reviewed E2E transaction.

DO $fixture_absence$
BEGIN
 IF EXISTS(SELECT 1 FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.students WHERE id='f1c10004-2026-4000-8000-000000000001'
   OR student_id='f1c10005-2026-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001'
   OR request_id='g1-branch-denial-20261025')
 OR EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'G1_FIXTURE_COLLISION';END IF;
END $fixture_absence$;
DO $fixture_insert$
DECLARE actor record; v_student uuid; v_actor uuid; v_tenant uuid;
BEGIN
 FOR actor IN SELECT u.id,u.tenant_id FROM public.users u
  JOIN public.tenants t ON t.id=u.tenant_id JOIN auth.users a ON a.id=u.id
  WHERE u.status='active' AND lower(u.role)='admin' AND t.status='active' AND t.product_key='bella_preschool'
    AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp())
  ORDER BY u.id
 LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.id::text,'role','authenticated')::text,true);
  SELECT s.student_id INTO v_student FROM public.students s
   JOIN public.edu_enrollments e ON e.tenant_id=s.tenant_id AND e.student_party_id=s.party_id AND e.status IN('active','pending')
   JOIN public.edu_courses c ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
   JOIN public.preschool_chain_course_branch_assignments m ON m.tenant_id=c.tenant_id AND m.course_id=c.id
   JOIN public.org_units b ON b.id=m.branch_id AND b.tenant_id=m.tenant_id AND b.unit_type='branch' AND b.is_active
   JOIN public.user_org_unit_access x ON x.user_id=actor.id AND x.tenant_id=b.tenant_id AND x.org_unit_id=b.id AND x.relationship_id IS NOT NULL
   WHERE s.tenant_id=actor.tenant_id AND s.academic_status='enrolled'
   AND EXISTS(SELECT 1 FROM public.party_relationships r WHERE r.tenant_id=s.tenant_id AND r.target_party_id=s.party_id
     AND r.relationship_type IN('guardian_of','parent_of')
     AND (r.active_from IS NULL OR r.active_from<=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
     AND (r.active_to IS NULL OR r.active_to>=(statement_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
   ORDER BY s.student_id LIMIT 1;
  IF v_student IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.users u JOIN auth.users a ON a.id=u.id
  WHERE u.tenant_id=actor.tenant_id AND u.status='active' AND lower(u.role)<>'admin'
    AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp()))
  AND EXISTS(SELECT 1 FROM public.students fs JOIN public.party_parties fp ON fp.id=fs.party_id
  AND fp.tenant_id=fs.tenant_id AND fp.party_type='person' AND fp.deleted_at IS NULL
  WHERE fs.tenant_id<>actor.tenant_id AND fs.academic_status='enrolled'
    AND (SELECT count(*) FROM public.students ds WHERE ds.tenant_id=fs.tenant_id AND ds.party_id=fs.party_id)=1
    AND EXISTS(SELECT 1 FROM public.edu_enrollments fe JOIN public.edu_courses fc
      ON fc.id=fe.course_id AND fc.tenant_id=fe.tenant_id AND fc.status='active'
      WHERE fe.tenant_id=fs.tenant_id AND fe.student_party_id=fs.party_id AND fe.status IN('active','pending')))
 THEN v_actor:=actor.id;v_tenant:=actor.tenant_id;EXIT;END IF;
 END LOOP;
 PERFORM set_config('g1.fixture_actor',v_actor::text,true);
 PERFORM set_config('g1.fixture_tenant',v_tenant::text,true);
 PERFORM set_config('g1.fixture_positive_student',v_student::text,true);
 PERFORM set_config('g1.fixture_positive_code',
  (SELECT student_code FROM public.students WHERE student_id=v_student),true);
 IF v_actor IS NULL THEN RAISE EXCEPTION 'G1_FIXTURE_AUTHORIZED_CONTEXT_MISSING';END IF;
 INSERT INTO public.org_units(id,tenant_id,unit_type,name,code,is_active,metadata)
 VALUES('f1c10001-2026-4000-8000-000000000001',v_tenant,'branch','G1 Synthetic Denial Branch','G1-DENIAL-20261025',true,'{"g1Fixture":"20261025"}');
 IF EXISTS(SELECT 1 FROM public.user_org_unit_access x WHERE x.user_id=v_actor AND x.tenant_id=v_tenant
  AND x.org_unit_id='f1c10001-2026-4000-8000-000000000001' AND x.relationship_id IS NOT NULL)
 THEN RAISE EXCEPTION 'G1_FIXTURE_BRANCH_IS_ACCESSIBLE';END IF;
 INSERT INTO public.edu_courses(id,tenant_id,course_code,title,status,max_students,current_enrollment)
 VALUES('f1c10002-2026-4000-8000-000000000001',v_tenant,'G1-DENIAL-20261025','G1 Synthetic Denial Class','active',1,1);
 INSERT INTO public.party_parties(id,tenant_id,party_type,display_name,dob,gender)
 VALUES('f1c10003-2026-4000-8000-000000000001',v_tenant,'person','G1 Synthetic Denial Student','2022-01-01','female');
 INSERT INTO public.students(id,student_id,tenant_id,party_id,student_code,academic_status,metadata)
 VALUES('f1c10004-2026-4000-8000-000000000001','f1c10005-2026-4000-8000-000000000001',v_tenant,
 'f1c10003-2026-4000-8000-000000000001','G1-DENIAL-20261025','enrolled','{"g1Fixture":"20261025"}');
 INSERT INTO public.preschool_chain_course_branch_assignments(id,tenant_id,course_id,branch_id,assigned_by)
 VALUES('f1c10007-2026-4000-8000-000000000001',v_tenant,'f1c10002-2026-4000-8000-000000000001',
 'f1c10001-2026-4000-8000-000000000001',v_actor);
 INSERT INTO public.edu_enrollments(id,tenant_id,student_party_id,course_id,status,request_id)
 VALUES('f1c10006-2026-4000-8000-000000000001',v_tenant,'f1c10003-2026-4000-8000-000000000001',
 'f1c10002-2026-4000-8000-000000000001','active','g1-branch-denial-20261025');
END $fixture_insert$;

CREATE FUNCTION pg_temp.g1_direct_table_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $direct$
DECLARE
  v_party text := '00000';
  v_relationship text := '00000';
  v_identifier text := '00000';
  v_pickup text := '00000';
BEGIN
  BEGIN PERFORM display_name FROM public.party_parties LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN v_party := SQLSTATE; END;
  BEGIN PERFORM relationship_type FROM public.party_relationships LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN v_relationship := SQLSTATE; END;
  BEGIN PERFORM identifier_value FROM public.party_identifiers LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN v_identifier := SQLSTATE; END;
  BEGIN PERFORM status FROM public.edu_preschool_pickup_authorizations LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN v_pickup := SQLSTATE; END;
  RETURN jsonb_build_object('party',v_party,'relationships',v_relationship,
    'identifiers',v_identifier,'pickup',v_pickup);
END
$direct$;
DO $direct_claims$
DECLARE v_actor uuid;
BEGIN
  SELECT u.id INTO v_actor FROM public.users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN auth.users a ON a.id=u.id
    WHERE u.status='active' AND lower(u.role)='admin' AND t.status='active'
      AND t.product_key='bella_preschool' AND a.deleted_at IS NULL
      AND (a.banned_until IS NULL OR a.banned_until<=statement_timestamp())
    ORDER BY u.id LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'G1_DIRECT_ACCESS_ACTOR_MISSING'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
END
$direct_claims$;
SET LOCAL ROLE authenticated;
DO $direct_before$
DECLARE v_result jsonb := pg_temp.g1_direct_table_access();
BEGIN
  IF v_result ->> 'relationships' IS DISTINCT FROM '42501'
    OR v_result ->> 'identifiers' IS DISTINCT FROM '42501'
    OR v_result ->> 'pickup' IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'G1_EXPECTED_DIRECT_DENIAL_BASELINE_MISSING';
  END IF;
  PERFORM set_config('g1.direct_access_before',v_result::text,true);
END
$direct_before$;
RESET ROLE;

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

REVOKE ALL ON FUNCTION public.preschool_g1_guardians_read(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preschool_g1_guardians_read(uuid) TO authenticated;
COMMENT ON FUNCTION public.preschool_g1_guardians_read(uuid) IS
  'G1_GUARDIAN_READ_V1: caller-bound Preschool admin read for one authorized Student; guardian relationship and pickup status remain separate.';

DO $postcondition$
DECLARE
  v_oid oid := to_regprocedure('public.preschool_g1_guardians_read(uuid)');
BEGIN
  IF v_oid IS NULL
    OR md5(pg_get_functiondef(v_oid)) IS DISTINCT FROM '1b531ba582bd0f6f49867c66f1b7e088'
    OR EXISTS(SELECT 1 FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      WHERE p.oid=v_oid AND acl.privilege_type='EXECUTE'
        AND acl.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='authenticated')))
    OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
    OR has_function_privilege('anon', v_oid, 'EXECUTE')
    OR has_function_privilege('service_role', v_oid, 'EXECUTE')
    OR NOT EXISTS (
      SELECT 1
      FROM pg_proc function_row
      JOIN pg_roles owner_role ON owner_role.oid = function_row.proowner
      WHERE function_row.oid = v_oid
        AND function_row.prosecdef
        AND function_row.provolatile = 's'
        AND owner_role.rolname = 'postgres'
        AND EXISTS (SELECT 1 FROM unnest(function_row.proconfig) setting WHERE setting = 'TimeZone=Asia/Ho_Chi_Minh')
        AND EXISTS (SELECT 1 FROM unnest(function_row.proconfig) setting WHERE setting = 'statement_timeout=10s')
        AND EXISTS (SELECT 1 FROM unnest(function_row.proconfig) setting WHERE setting = 'lock_timeout=2s')
        AND EXISTS (SELECT 1 FROM unnest(function_row.proconfig) setting WHERE setting = 'search_path=""')
    )
    OR EXISTS (
      SELECT 1
      FROM pg_proc function_row
      CROSS JOIN LATERAL aclexplode(coalesce(
        function_row.proacl,
        acldefault('f', function_row.proowner)
      )) privilege
      WHERE function_row.oid = v_oid
        AND privilege.grantee = 0
        AND privilege.privilege_type = 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'G1_FUNCTION_PRIVILEGE_POSTCONDITION_FAILED';
  END IF;
END
$postcondition$;

SET LOCAL ROLE authenticated;
DO $direct_after$
BEGIN
  IF pg_temp.g1_direct_table_access() IS DISTINCT FROM current_setting('g1.direct_access_before')::jsonb THEN
    RAISE EXCEPTION 'G1_DIRECT_ACCESS_CHANGED';
  END IF;
END
$direct_after$;
RESET ROLE;

CREATE FUNCTION pg_temp.g1_rehearsal_data_fingerprint()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $fingerprint$
  SELECT md5(jsonb_build_object(
    'auth.users', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM auth.users row_value),
    'public.users', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.users row_value),
    'public.tenants', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.tenants row_value),
    'public.students', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.students row_value),
    'public.edu_enrollments', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.edu_enrollments row_value),
    'public.edu_courses', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.edu_courses row_value),
    'public.preschool_chain_course_branch_assignments', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.preschool_chain_course_branch_assignments row_value),
    'public.org_units', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.org_units row_value),
    'public.people_directory', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.people_directory row_value),
    'public.org_relationships', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.org_relationships row_value),
    'public.user_org_unit_access', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.user_org_unit_access row_value),
    'public.party_parties', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.party_parties row_value),
    'public.party_relationships', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.party_relationships row_value),
    'public.party_identifiers', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.party_identifiers row_value),
    'public.edu_preschool_pickup_authorizations', (SELECT coalesce(string_agg(md5(to_jsonb(row_value)::text), '' ORDER BY md5(to_jsonb(row_value)::text)), '') FROM public.edu_preschool_pickup_authorizations row_value)
  )::text);
$fingerprint$;

CREATE TEMP TABLE g1_rehearsal_context (
  actor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  wrong_role_actor_id uuid NOT NULL,
  inaccessible_branch_student_id uuid NOT NULL,
  foreign_student_id uuid NOT NULL,
  before_data_fingerprint text NOT NULL
) ON COMMIT DROP;

DO $fixture$
DECLARE
  candidate record;
  v_student_id uuid;
  v_wrong_role_actor_id uuid;
  v_inaccessible_branch_student_id uuid;
  v_foreign_student_id uuid;
  v_branch_context_missing boolean := false;
  v_role_context_missing boolean := false;
  v_foreign_context_missing boolean := false;
  v_today date := (pg_catalog.timezone('Asia/Ho_Chi_Minh', pg_catalog.statement_timestamp()))::date;
BEGIN
  FOR candidate IN
    SELECT user_row.id, user_row.tenant_id
    FROM public.users user_row
    JOIN public.tenants tenant_row ON tenant_row.id = user_row.tenant_id
    JOIN auth.users auth_user ON auth_user.id = user_row.id
    WHERE user_row.status = 'active'
      AND lower(user_row.role) = 'admin'
      AND tenant_row.status = 'active'
      AND tenant_row.product_key = 'bella_preschool'
      AND auth_user.deleted_at IS NULL
      AND (auth_user.banned_until IS NULL OR auth_user.banned_until <= pg_catalog.statement_timestamp())
    AND user_row.id=current_setting('g1.fixture_actor')::uuid
    ORDER BY user_row.id
  LOOP
    PERFORM set_config('request.jwt.claim.sub', candidate.id::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', candidate.id::text, 'role', 'authenticated')::text,
      true
    );
    v_student_id := NULL;
    SELECT student.student_id
      INTO v_student_id
    FROM public.students student
    JOIN public.edu_enrollments enrollment
      ON enrollment.tenant_id = student.tenant_id
     AND enrollment.student_party_id = student.party_id
     AND enrollment.status IN ('active', 'pending')
    JOIN public.edu_courses course
      ON course.id = enrollment.course_id
     AND course.tenant_id = enrollment.tenant_id
     AND course.status = 'active'
    JOIN public.preschool_chain_course_branch_assignments assignment
      ON assignment.course_id = course.id
     AND assignment.tenant_id = course.tenant_id
    JOIN public.user_org_unit_access access
      ON access.user_id = candidate.id
     AND access.tenant_id = assignment.tenant_id
     AND access.org_unit_id = assignment.branch_id
     AND access.relationship_id IS NOT NULL
    WHERE student.tenant_id = candidate.tenant_id
      AND student.academic_status = 'enrolled'
      AND EXISTS (
        SELECT 1
        FROM public.party_relationships relationship
        WHERE relationship.tenant_id = student.tenant_id
          AND relationship.target_party_id = student.party_id
          AND relationship.relationship_type IN ('guardian_of', 'parent_of')
          AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
          AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)
      )
    ORDER BY student.student_id
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
      SELECT wrong_actor.id
        INTO v_wrong_role_actor_id
      FROM public.users wrong_actor
      JOIN auth.users wrong_auth_user ON wrong_auth_user.id = wrong_actor.id
      WHERE wrong_actor.tenant_id = candidate.tenant_id
        AND wrong_actor.status = 'active'
        AND lower(wrong_actor.role) <> 'admin'
        AND wrong_auth_user.deleted_at IS NULL
        AND (wrong_auth_user.banned_until IS NULL
          OR wrong_auth_user.banned_until <= pg_catalog.statement_timestamp())
      ORDER BY wrong_actor.id
      LIMIT 1;

      SELECT inaccessible_student.student_id
        INTO v_inaccessible_branch_student_id
      FROM public.students inaccessible_student
      JOIN public.edu_enrollments inaccessible_enrollment
        ON inaccessible_enrollment.tenant_id = inaccessible_student.tenant_id
       AND inaccessible_enrollment.student_party_id = inaccessible_student.party_id
       AND inaccessible_enrollment.status IN ('active', 'pending')
      JOIN public.edu_courses inaccessible_course
        ON inaccessible_course.id = inaccessible_enrollment.course_id
       AND inaccessible_course.tenant_id = inaccessible_enrollment.tenant_id
       AND inaccessible_course.status = 'active'
      JOIN public.preschool_chain_course_branch_assignments inaccessible_assignment
        ON inaccessible_assignment.course_id = inaccessible_course.id
       AND inaccessible_assignment.tenant_id = inaccessible_course.tenant_id
      JOIN public.org_units inaccessible_branch
        ON inaccessible_branch.id = inaccessible_assignment.branch_id
       AND inaccessible_branch.tenant_id = inaccessible_assignment.tenant_id
       AND inaccessible_branch.unit_type = 'branch'
       AND inaccessible_branch.is_active
      JOIN public.party_parties inaccessible_party
        ON inaccessible_party.id=inaccessible_student.party_id
       AND inaccessible_party.tenant_id=inaccessible_student.tenant_id
       AND inaccessible_party.party_type='person' AND inaccessible_party.deleted_at IS NULL
      WHERE inaccessible_student.student_id='f1c10005-2026-4000-8000-000000000001'
        AND inaccessible_student.tenant_id = candidate.tenant_id
        AND inaccessible_student.academic_status = 'enrolled'
        AND NOT EXISTS (
          SELECT 1
          FROM public.edu_enrollments other_enrollment
          JOIN public.edu_courses other_course
            ON other_course.id = other_enrollment.course_id
           AND other_course.tenant_id = other_enrollment.tenant_id
           AND other_course.status = 'active'
          JOIN public.preschool_chain_course_branch_assignments other_assignment
            ON other_assignment.course_id = other_course.id
           AND other_assignment.tenant_id = other_course.tenant_id
          JOIN public.org_units other_branch
            ON other_branch.id = other_assignment.branch_id
           AND other_branch.tenant_id = other_assignment.tenant_id
           AND other_branch.unit_type = 'branch' AND other_branch.is_active
          JOIN public.user_org_unit_access other_access
            ON other_access.user_id = candidate.id
           AND other_access.tenant_id = other_branch.tenant_id
           AND other_access.org_unit_id = other_branch.id
           AND other_access.relationship_id IS NOT NULL
          WHERE other_enrollment.tenant_id = inaccessible_student.tenant_id
            AND other_enrollment.student_party_id = inaccessible_student.party_id
            AND other_enrollment.status IN ('active', 'pending')
        )
      ORDER BY inaccessible_student.student_id
      LIMIT 1;

      SELECT foreign_student.student_id
        INTO v_foreign_student_id
      FROM public.students foreign_student
      JOIN public.party_parties foreign_party ON foreign_party.id=foreign_student.party_id
       AND foreign_party.tenant_id=foreign_student.tenant_id
       AND foreign_party.party_type='person' AND foreign_party.deleted_at IS NULL
      WHERE foreign_student.tenant_id <> candidate.tenant_id
        AND foreign_student.academic_status='enrolled'
        AND (SELECT count(*) FROM public.students duplicate
          WHERE duplicate.tenant_id=foreign_student.tenant_id AND duplicate.party_id=foreign_student.party_id)=1
        AND EXISTS(SELECT 1 FROM public.edu_enrollments e JOIN public.edu_courses c
          ON c.id=e.course_id AND c.tenant_id=e.tenant_id AND c.status='active'
          WHERE e.tenant_id=foreign_student.tenant_id AND e.student_party_id=foreign_student.party_id
            AND e.status IN('active','pending'))
      ORDER BY foreign_student.student_id
      LIMIT 1;

      v_role_context_missing := v_wrong_role_actor_id IS NULL;
      v_branch_context_missing := v_inaccessible_branch_student_id IS NULL;
      v_foreign_context_missing := v_foreign_student_id IS NULL;
      IF v_role_context_missing OR v_branch_context_missing OR v_foreign_context_missing THEN
        CONTINUE;
      END IF;
      INSERT INTO g1_rehearsal_context(
        actor_id, student_id, wrong_role_actor_id,
        inaccessible_branch_student_id, foreign_student_id, before_data_fingerprint
      ) VALUES (
        candidate.id, v_student_id, v_wrong_role_actor_id,
        v_inaccessible_branch_student_id, v_foreign_student_id,
        pg_temp.g1_rehearsal_data_fingerprint()
      );
      RETURN;
    END IF;
  END LOOP;
  IF v_branch_context_missing THEN RAISE EXCEPTION 'G1_REHEARSAL_BRANCH_DENIAL_CONTEXT_MISSING'; END IF;
  IF v_role_context_missing THEN RAISE EXCEPTION 'G1_REHEARSAL_WRONG_ROLE_CONTEXT_MISSING'; END IF;
  IF v_foreign_context_missing THEN RAISE EXCEPTION 'G1_REHEARSAL_FOREIGN_TENANT_CONTEXT_MISSING'; END IF;
  RAISE EXCEPTION 'G1_REHEARSAL_AUTHORIZED_CONTEXT_MISSING';
END
$fixture$;

GRANT SELECT ON g1_rehearsal_context TO authenticated;
DO $claims$
DECLARE
  v_actor_id uuid;
BEGIN
  SELECT actor_id INTO v_actor_id FROM g1_rehearsal_context;
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor_id::text, 'role', 'authenticated')::text,
    true
  );
END
$claims$;

SET LOCAL ROLE authenticated;


DO $registry_read$
DECLARE v_page jsonb;v_course uuid;v_denied boolean:=false;
BEGIN
 SELECT e.course_id INTO v_course FROM public.edu_enrollments e JOIN g1_rehearsal_context c
  ON e.student_party_id=(SELECT party_id FROM public.students WHERE student_id=c.student_id)
 WHERE e.status IN('active','pending') AND EXISTS(
  SELECT 1 FROM public.preschool_chain_course_branch_assignments m JOIN public.user_org_unit_access x
   ON x.org_unit_id=m.branch_id AND x.tenant_id=m.tenant_id
  WHERE m.course_id=e.course_id AND m.tenant_id=e.tenant_id AND x.user_id=auth.uid() AND x.relationship_id IS NOT NULL)
 ORDER BY e.id LIMIT 1;
 SELECT public.edu_preschool_student_registry(
  current_setting('g1.fixture_positive_code'),
  'all',v_course,NULL,0,50) INTO v_page;
 IF v_page IS NULL OR (v_page->'totals'->>'students')::integer<1
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'students') item
   WHERE item->>'id'=current_setting('g1.fixture_positive_student')) THEN
  RAISE EXCEPTION 'G1_REGISTRY_POSITIVE_INVALID';END IF;
 -- Exact synthetic class selector proves branch denial regardless of pagination.
 BEGIN
  PERFORM public.edu_preschool_student_registry('', 'all',
    'f1c10002-2026-4000-8000-000000000001',NULL,0,1);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'G1_REGISTRY_SYNTHETIC_BRANCH_NOT_DENIED';END IF;
END $registry_read$;

DO $positive$
DECLARE
  v_page jsonb;
  v_student_id uuid;
BEGIN
  SELECT student_id INTO v_student_id FROM g1_rehearsal_context;
  SELECT public.preschool_g1_guardians_read(v_student_id) INTO v_page;
  IF v_page IS NULL
    OR v_page ->> 'studentId' IS DISTINCT FROM v_student_id::text
    OR v_page ->> 'complete' IS DISTINCT FROM 'true'
    OR jsonb_typeof(v_page -> 'guardians') IS DISTINCT FROM 'array'
    OR (v_page ->> 'guardianCount')::integer <= 0
    OR (v_page ->> 'guardianCount')::integer <> jsonb_array_length(v_page -> 'guardians')
  THEN
    RAISE EXCEPTION 'G1_REHEARSAL_POSITIVE_RESULT_INVALID';
  END IF;
  PERFORM set_config('g1.rehearsal_page', v_page::text, true);
END
$positive$;

DO $negative$
DECLARE
  v_actor_id uuid;
  v_wrong_role_actor_id uuid;
  v_student_id uuid;
  v_inaccessible_branch_student_id uuid;
  v_foreign_student_id uuid;
BEGIN
  BEGIN
    PERFORM public.preschool_g1_guardians_read('00000000-0000-0000-0000-000000000000'::uuid);
    RAISE EXCEPTION 'G1_REHEARSAL_UNKNOWN_STUDENT_NOT_DENIED';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  SELECT actor_id, wrong_role_actor_id, student_id,
         inaccessible_branch_student_id, foreign_student_id
    INTO v_actor_id, v_wrong_role_actor_id, v_student_id,
         v_inaccessible_branch_student_id, v_foreign_student_id
  FROM g1_rehearsal_context;

  BEGIN
    PERFORM public.preschool_g1_guardians_read(v_foreign_student_id);
    RAISE EXCEPTION 'G1_REHEARSAL_FOREIGN_STUDENT_NOT_DENIED';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.preschool_g1_guardians_read(v_inaccessible_branch_student_id);
    RAISE EXCEPTION 'G1_REHEARSAL_BRANCH_STUDENT_NOT_DENIED';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_wrong_role_actor_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_wrong_role_actor_id::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.preschool_g1_guardians_read(v_student_id);
    RAISE EXCEPTION 'G1_REHEARSAL_WRONG_ROLE_NOT_DENIED';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor_id::text, 'role', 'authenticated')::text,
    true
  );
END
$negative$;

RESET ROLE;

DO $independent_readback$
DECLARE
  v_page jsonb := current_setting('g1.rehearsal_page')::jsonb;
  v_tenant uuid;
  v_student_party uuid;
  v_today date := (pg_catalog.timezone('Asia/Ho_Chi_Minh', pg_catalog.statement_timestamp()))::date;
  v_expected_count integer;
  v_mismatch boolean;
BEGIN
  SELECT student.tenant_id, student.party_id INTO v_tenant, v_student_party
  FROM public.students student JOIN g1_rehearsal_context context ON context.student_id = student.student_id;
  IF v_page ->> 'studentPartyId' IS DISTINCT FROM v_student_party::text
    OR v_page ->> 'asOfDate' IS DISTINCT FROM v_today::text THEN
    RAISE EXCEPTION 'G1_REHEARSAL_CANONICAL_IDENTITY_MISMATCH';
  END IF;
  SELECT count(DISTINCT source_party_id) INTO v_expected_count
  FROM public.party_relationships
  WHERE tenant_id = v_tenant AND target_party_id = v_student_party
    AND relationship_type IN ('guardian_of', 'parent_of')
    AND (active_from IS NULL OR active_from <= v_today)
    AND (active_to IS NULL OR active_to >= v_today);
  IF (v_page ->> 'guardianCount')::integer IS DISTINCT FROM v_expected_count THEN
    RAISE EXCEPTION 'G1_REHEARSAL_CANONICAL_COUNT_MISMATCH';
  END IF;
  WITH expected AS (
    SELECT guardian.id, guardian.display_name,
      (SELECT identifier.identifier_value FROM public.party_identifiers identifier
       WHERE identifier.tenant_id = v_tenant AND identifier.party_id = guardian.id
         AND identifier.identifier_type = 'preschool_guardian_phone'
         AND (identifier.issued_at IS NULL OR identifier.issued_at <= v_today)
         AND (identifier.expires_at IS NULL OR identifier.expires_at >= v_today)) phone,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', relationship.id, 'type', relationship.relationship_type,
        'activeFrom', relationship.active_from, 'activeTo', relationship.active_to
       ) ORDER BY relationship.relationship_type, relationship.id)
       FROM public.party_relationships relationship
       WHERE relationship.tenant_id = v_tenant AND relationship.source_party_id = guardian.id
         AND relationship.target_party_id = v_student_party
         AND relationship.relationship_type IN ('guardian_of', 'parent_of')
         AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
         AND (relationship.active_to IS NULL OR relationship.active_to >= v_today)) relationships,
      coalesce((SELECT min(status) FROM public.edu_preschool_pickup_authorizations pickup
       WHERE pickup.tenant_id = v_tenant AND pickup.student_party_id = v_student_party
         AND pickup.guardian_party_id = guardian.id), 'not_recorded') pickup_status
    FROM public.party_parties guardian
    WHERE guardian.tenant_id = v_tenant AND guardian.party_type = 'person'
      AND guardian.deleted_at IS NULL AND EXISTS(
        SELECT 1 FROM public.party_relationships relationship
        WHERE relationship.tenant_id = v_tenant AND relationship.source_party_id = guardian.id
          AND relationship.target_party_id = v_student_party
          AND relationship.relationship_type IN ('guardian_of', 'parent_of')
          AND (relationship.active_from IS NULL OR relationship.active_from <= v_today)
          AND (relationship.active_to IS NULL OR relationship.active_to >= v_today))
  ), actual AS (
    SELECT guardian FROM jsonb_array_elements(v_page -> 'guardians') guardian
  )
  SELECT EXISTS(
    SELECT 1 FROM expected FULL JOIN actual ON actual.guardian ->> 'guardianPartyId' = expected.id::text
    WHERE expected.id IS NULL OR actual.guardian IS NULL
      OR actual.guardian ->> 'displayName' IS DISTINCT FROM expected.display_name
      OR actual.guardian ->> 'phone' IS DISTINCT FROM expected.phone
      OR actual.guardian ->> 'phoneState' IS DISTINCT FROM
        CASE WHEN expected.phone IS NULL THEN 'missing' ELSE 'recorded' END
      OR actual.guardian -> 'relationships' IS DISTINCT FROM expected.relationships
      OR actual.guardian ->> 'pickupStatus' IS DISTINCT FROM expected.pickup_status
  ) INTO v_mismatch;
  IF v_mismatch THEN RAISE EXCEPTION 'G1_REHEARSAL_CANONICAL_GUARDIAN_MISMATCH'; END IF;
END
$independent_readback$;

DO $zero_write$
DECLARE
  v_before text;
BEGIN
  SELECT before_data_fingerprint INTO v_before FROM g1_rehearsal_context;
  IF v_before IS DISTINCT FROM pg_temp.g1_rehearsal_data_fingerprint() THEN
    RAISE EXCEPTION 'G1_REHEARSAL_ZERO_WRITE_FAILED';
  END IF;
END
$zero_write$;

SELECT CASE
    WHEN md5(pg_get_functiondef('public.preschool_g1_guardians_read(uuid)'::regprocedure))
      = '1b531ba582bd0f6f49867c66f1b7e088'
    THEN '1b531ba582bd0f6f49867c66f1b7e088'
    ELSE current_setting('g1.function_definition_hash_mismatch')
  END AS rehearsal_function_definition_md5,
  true AS authorized_read_pass,
  true AS unknown_student_denial_pass,
  true AS wrong_role_denial_pass,
  true AS inaccessible_branch_denial_pass,
  true AS foreign_student_denial_pass,
  true AS direct_table_denials_preserved,
  true AS independent_canonical_readback_pass,
  true AS zero_write_all_dependencies_pass;


-- Exact synthetic fixture cleanup is one atomic statement; no partial autocommit.
DO $fixture_cleanup$
DECLARE v_tenant uuid;v_target record;v_fk record;v_external boolean;v_owned text;v_deleted integer;
BEGIN
 SELECT tenant_id INTO STRICT v_tenant FROM public.students
 WHERE id='f1c10004-2026-4000-8000-000000000001'
  AND student_id='f1c10005-2026-4000-8000-000000000001'
  AND party_id='f1c10003-2026-4000-8000-000000000001'
  AND student_code='G1-DENIAL-20261025' AND academic_status='enrolled'
  AND metadata->>'g1Fixture'='20261025' FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND unit_type='branch' AND is_active AND code='G1-DENIAL-20261025'
  AND metadata->>'g1Fixture'='20261025')
 OR NOT EXISTS(SELECT 1 FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND course_code='G1-DENIAL-20261025' AND title='G1 Synthetic Denial Class'
  AND status='active' AND max_students=1 AND current_enrollment=1)
 OR NOT EXISTS(SELECT 1 FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND party_type='person' AND display_name='G1 Synthetic Denial Student'
  AND dob='2022-01-01' AND gender='female' AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND course_id='f1c10002-2026-4000-8000-000000000001'
  AND branch_id='f1c10001-2026-4000-8000-000000000001')
 OR NOT EXISTS(SELECT 1 FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001'
  AND tenant_id=v_tenant AND student_party_id='f1c10003-2026-4000-8000-000000000001'
  AND course_id='f1c10002-2026-4000-8000-000000000001' AND status='active'
  AND request_id='g1-branch-denial-20261025')
 THEN RAISE EXCEPTION 'G1_FIXTURE_IDENTITY_DRIFT'; END IF;
 IF EXISTS(SELECT 1 FROM public.edu_enrollment_event_records WHERE enrollment_id='f1c10006-2026-4000-8000-000000000001'
  AND (tenant_id<>v_tenant OR request_id<>'g1-branch-denial-20261025' OR replay_state<>'pending'
    OR replay_attempts<>0 OR lease_token IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.edu_enrollment_event_replays r JOIN public.edu_enrollment_event_records e
  ON e.event_id=r.event_id WHERE e.enrollment_id='f1c10006-2026-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'G1_FIXTURE_EVENT_DRIFT_OR_REPLAY'; END IF;
 -- Refuse every unowned FK reference before any delete; do not let CASCADE remove unrelated rows.
 FOR v_target IN SELECT * FROM (VALUES
  ('public.org_units'::regclass,'id','f1c10001-2026-4000-8000-000000000001'::uuid),
  ('public.edu_courses'::regclass,'id','f1c10002-2026-4000-8000-000000000001'::uuid),
  ('public.party_parties'::regclass,'id','f1c10003-2026-4000-8000-000000000001'::uuid),
  ('public.students'::regclass,'id','f1c10004-2026-4000-8000-000000000001'::uuid),
  ('public.students'::regclass,'student_id','f1c10005-2026-4000-8000-000000000001'::uuid),
  ('public.edu_enrollments'::regclass,'id','f1c10006-2026-4000-8000-000000000001'::uuid)
 ) target(relation,key_column,row_id)
 LOOP
  FOR v_fk IN SELECT c.conrelid AS relation,c.conkey,src.attname AS key_column
   FROM pg_constraint c
   JOIN pg_attribute ref ON ref.attrelid=c.confrelid AND ref.attnum=c.confkey[1]
   JOIN pg_attribute src ON src.attrelid=c.conrelid AND src.attnum=c.conkey[1]
   WHERE c.contype='f' AND c.confrelid=v_target.relation AND ref.attname=v_target.key_column
  LOOP
   IF cardinality(v_fk.conkey)<>1 THEN RAISE EXCEPTION 'G1_FIXTURE_COMPOSITE_REFERENCE_REVIEW_REQUIRED';END IF;
   v_owned:=CASE v_fk.relation
    WHEN 'public.students'::regclass THEN 'x.id=''f1c10004-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.edu_enrollments'::regclass THEN 'x.id=''f1c10006-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.preschool_chain_course_branch_assignments'::regclass THEN 'x.id=''f1c10007-2026-4000-8000-000000000001''::uuid'
    WHEN 'public.edu_enrollment_event_records'::regclass THEN 'x.enrollment_id=''f1c10006-2026-4000-8000-000000000001''::uuid AND x.request_id=''g1-branch-denial-20261025'''
    ELSE 'false' END;
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s x WHERE x.%I=$1 AND NOT (%s))',
    v_fk.relation::regclass,v_fk.key_column,v_owned) INTO v_external USING v_target.row_id;
   IF v_external THEN RAISE EXCEPTION 'G1_FIXTURE_EXTERNAL_REFERENCE';END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.org_relationships WHERE from_id IN(
   'f1c10001-2026-4000-8000-000000000001','f1c10003-2026-4000-8000-000000000001')
   OR to_id IN('f1c10001-2026-4000-8000-000000000001','f1c10003-2026-4000-8000-000000000001'))
 THEN RAISE EXCEPTION 'G1_FIXTURE_EXTERNAL_ORG_RELATION';END IF;
 DELETE FROM public.edu_enrollment_event_records WHERE enrollment_id='f1c10006-2026-4000-8000-000000000001'
  AND request_id='g1-branch-denial-20261025';
 DELETE FROM public.edu_enrollments WHERE id='f1c10006-2026-4000-8000-000000000001';
 GET DIAGNOSTICS v_deleted=ROW_COUNT;IF v_deleted<>1 THEN RAISE EXCEPTION 'G1_FIXTURE_ENROLLMENT_CLEANUP';END IF;
 DELETE FROM public.preschool_chain_course_branch_assignments WHERE id='f1c10007-2026-4000-8000-000000000001';
 DELETE FROM public.students WHERE id='f1c10004-2026-4000-8000-000000000001';
 DELETE FROM public.party_parties WHERE id='f1c10003-2026-4000-8000-000000000001';
 DELETE FROM public.edu_courses WHERE id='f1c10002-2026-4000-8000-000000000001';
 DELETE FROM public.org_units WHERE id='f1c10001-2026-4000-8000-000000000001';
END $fixture_cleanup$;

DO $fixture_clean$
DECLARE v_after text;
BEGIN
 SELECT md5(jsonb_build_object('public.org_units',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.org_units x),'public.edu_courses',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_courses x),'public.party_parties',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.party_parties x),'public.students',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.students x),'public.preschool_chain_course_branch_assignments',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.preschool_chain_course_branch_assignments x),'public.edu_enrollments',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_enrollments x),'public.edu_enrollment_event_records',(SELECT coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'') FROM public.edu_enrollment_event_records x))::text) INTO v_after;
 IF v_after IS DISTINCT FROM (SELECT value FROM g1_fixture_before) THEN
  RAISE EXCEPTION 'G1_FIXTURE_RECOVERY_DATA_DRIFT';
 END IF;
END $fixture_clean$;
SELECT true AS strict_business_rehearsal_pass,
 true AS registry_caller_projection_pass,
 true AS exact_fixture_cleanup_pass;

NOTIFY pgrst, 'reload schema';
ROLLBACK;

