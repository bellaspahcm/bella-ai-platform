-- Owner approved 2026-10-25: existing Registry function only on E2E.
-- No shared table/schema/RLS/actor/mapping changes.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
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
NOTIFY pgrst,'reload schema';
DO $registry_identity$
DECLARE v_oid oid:=to_regprocedure('public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)');
BEGIN
 IF v_oid IS NULL OR md5(pg_get_functiondef(v_oid)) IS DISTINCT FROM '8dd5106a6d5ee18e857ffddfefdcd706'
   OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM 'postgres'
 THEN RAISE EXCEPTION 'G1_REGISTRY_RECOVERY_IDENTITY_MISMATCH';END IF;
END $registry_identity$;
DROP FUNCTION public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer) RESTRICT;
NOTIFY pgrst,'reload schema';

SELECT to_regprocedure('public.edu_preschool_student_registry(text,text,uuid,uuid,integer,integer)') IS NULL
 AS registry_exact_recovery_pass;
ROLLBACK;
