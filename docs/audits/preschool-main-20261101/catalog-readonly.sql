-- F05 evidence collection only. This is NOT a migration.
-- Run only on the explicitly identified Supabase project.
-- Reads PostgreSQL metadata; does not read business rows or invoke business RPCs.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

WITH target_names(name) AS (VALUES
  ('users'), ('tenants'), ('people_directory'), ('org_units'),
  ('org_relationships'), ('user_org_unit_access'),
  ('party_auth_links'), ('party_identity_link_managers'),
  ('teacher_assignments'), ('preschool_teacher_branch_confirmations'),
  ('courses'), ('edu_courses'), ('preschool_chain_course_branch_assignments'),
  ('edu_curriculums'), ('edu_lesson_plans'),
  ('edu_weekly_menus'), ('edu_weekly_menu_days'),
  ('edu_dev_observations'), ('edu_dev_observation_students'),
  ('edu_dev_milestone_progress')
), relations AS (
  SELECT c.* FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN target_names t ON t.name = c.relname
  WHERE n.nspname = 'public'
), functions AS (
  SELECT p.* FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname IN (
      'get_auth_tenant_id', 'platform_current_actor_profile',
      'platform_current_actor_org_unit_access', 'platform_org_unit_access_for_actor',
      'platform_assert_active_branch_for_actor', 'party_resolve_current_auth_link',
      'preschool_teacher_attendance_courses', 'preschool_teacher_can_attend_course',
      'preschool_teacher_assert_admin', 'preschool_confirm_teacher',
      'edu_assign_preschool_teacher', 'edu_get_preschool_course_teachers'
    )
), runtime_roles AS (
  SELECT oid, rolname, rolsuper, rolinherit, rolbypassrls
  FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
)
SELECT jsonb_pretty(jsonb_build_object(
  'capturedAt', CURRENT_TIMESTAMP,
  'database', current_database(),
  'executor', current_user,
  'transactionReadOnly', current_setting('transaction_read_only'),
  'serverVersion', current_setting('server_version'),
  'presence', (SELECT jsonb_agg(jsonb_build_object(
    'name', t.name, 'exists', r.oid IS NOT NULL
  ) ORDER BY t.name) FROM target_names t LEFT JOIN relations r ON r.relname = t.name),
  'relations', (SELECT jsonb_agg(jsonb_build_object(
    'name', r.relname, 'kind', r.relkind,
    'owner', pg_catalog.pg_get_userbyid(r.relowner),
    'rlsEnabled', r.relrowsecurity, 'rlsForced', r.relforcerowsecurity,
    'acl', r.relacl::text,
    'viewDefinition', CASE WHEN r.relkind IN ('v', 'm')
      THEN pg_catalog.pg_get_viewdef(r.oid, true) ELSE NULL END
  ) ORDER BY r.relname) FROM relations r),
  'columns', (SELECT jsonb_agg(jsonb_build_object(
    'relation', r.relname, 'column', a.attname,
    'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
    'nullable', NOT a.attnotnull
  ) ORDER BY r.relname, a.attnum) FROM relations r
    JOIN pg_catalog.pg_attribute a ON a.attrelid = r.oid
    WHERE a.attnum > 0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_object(
    'relation', r.relname, 'name', k.conname, 'type', k.contype,
    'validated', k.convalidated,
    'definition', pg_catalog.pg_get_constraintdef(k.oid, true)
  ) ORDER BY r.relname, k.conname) FROM relations r
    JOIN pg_catalog.pg_constraint k ON k.conrelid = r.oid),
  'policies', (SELECT jsonb_agg(jsonb_build_object(
    'relation', p.tablename, 'name', p.policyname,
    'permissive', p.permissive, 'roles', p.roles, 'command', p.cmd,
    'using', p.qual, 'withCheck', p.with_check
  ) ORDER BY p.tablename, p.policyname) FROM pg_catalog.pg_policies p
    JOIN target_names t ON t.name = p.tablename WHERE p.schemaname = 'public'),
  'roleCapabilities', (SELECT jsonb_agg(jsonb_build_object(
    'role', x.rolname, 'superuser', x.rolsuper,
    'inherits', x.rolinherit, 'bypassRls', x.rolbypassrls
  ) ORDER BY x.rolname) FROM runtime_roles x),
  'effectiveTablePrivileges', (SELECT jsonb_agg(jsonb_build_object(
    'relation', r.relname, 'role', x.rolname,
    'select', has_table_privilege(x.oid, r.oid, 'SELECT'),
    'insert', has_table_privilege(x.oid, r.oid, 'INSERT'),
    'update', has_table_privilege(x.oid, r.oid, 'UPDATE'),
    'delete', has_table_privilege(x.oid, r.oid, 'DELETE')
  ) ORDER BY r.relname, x.rolname) FROM relations r CROSS JOIN runtime_roles x),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text,
    'owner', pg_catalog.pg_get_userbyid(p.proowner),
    'securityDefiner', p.prosecdef, 'config', p.proconfig, 'acl', p.proacl::text,
    'definition', pg_catalog.pg_get_functiondef(p.oid)
  ) ORDER BY p.proname, p.oid) FROM functions p),
  'effectiveExecutePrivileges', (SELECT jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'role', x.rolname,
    'execute', has_function_privilege(x.oid, p.oid, 'EXECUTE')
  ) ORDER BY p.proname, p.oid, x.rolname) FROM functions p CROSS JOIN runtime_roles x),
  'relatedRpcInventory', (SELECT jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'securityDefiner', p.prosecdef,
    'owner', pg_catalog.pg_get_userbyid(p.proowner), 'acl', p.proacl::text
  ) ORDER BY p.proname, p.oid) FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (p.proname ILIKE '%curriculum%' OR p.proname ILIKE '%lesson_plan%'
        OR p.proname ILIKE '%weekly_menu%' OR p.proname ILIKE '%grade%'
        OR p.proname ILIKE '%assignment%'))
)) AS authorization_catalog;

ROLLBACK;
