-- Target: Supabase E2E bmnbqbcdbuklhopfbopv only.
-- Removes only the exact approved G1 function. It does not touch data or table security.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

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
DECLARE
  v_oid oid := to_regprocedure('public.preschool_g1_guardians_read(uuid)');
  v_definition text;
  v_owner text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'G1_RECOVERY_FUNCTION_MISSING';
  END IF;
  SELECT pg_get_functiondef(function_row.oid), owner_role.rolname
    INTO v_definition, v_owner
  FROM pg_proc function_row
  JOIN pg_roles owner_role ON owner_role.oid = function_row.proowner
  WHERE function_row.oid = v_oid;
  IF md5(v_definition) <> '1b531ba582bd0f6f49867c66f1b7e088'
    OR v_owner <> 'postgres'
    OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
    OR has_function_privilege('anon', v_oid, 'EXECUTE')
    OR has_function_privilege('service_role', v_oid, 'EXECUTE')
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
    RAISE EXCEPTION 'G1_RECOVERY_FUNCTION_IDENTITY_DRIFT';
  END IF;
END
$preflight$;

DROP FUNCTION public.preschool_g1_guardians_read(uuid) RESTRICT;

DO $postcondition$
BEGIN
  IF to_regprocedure('public.preschool_g1_guardians_read(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'G1_RECOVERY_DROP_FAILED';
  END IF;
END
$postcondition$;

NOTIFY pgrst, 'reload schema';
COMMIT;
