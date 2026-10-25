-- Target: Supabase E2E bmnbqbcdbuklhopfbopv only.
-- Approved 2026-10-24: one caller-bound G1 guardian read capability.
-- This is an execution artifact, not a Production migration.
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

NOTIFY pgrst, 'reload schema';

-- Technical construction/recovery only: no claim of business/Auth acceptance.
SELECT CASE WHEN md5(pg_get_functiondef('public.preschool_g1_guardians_read(uuid)'::regprocedure))
  = '1b531ba582bd0f6f49867c66f1b7e088' THEN true
  ELSE current_setting('g1.definition_hash_mismatch')::boolean END AS exact_function_hash_pass;
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


SET LOCAL ROLE authenticated;
DO $direct_after$
BEGIN
  IF pg_temp.g1_direct_table_access() IS DISTINCT FROM current_setting('g1.direct_access_before')::jsonb THEN
    RAISE EXCEPTION 'G1_DIRECT_ACCESS_CHANGED';
  END IF;
END
$direct_after$;
RESET ROLE;
SELECT to_regprocedure('public.preschool_g1_guardians_read(uuid)') IS NULL AS recovery_function_absent,
  true AS exact_function_hash_asserted,
  true AS direct_table_denials_preserved;
ROLLBACK;
