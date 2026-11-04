BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT jsonb_build_object(
  'database', current_database(),
  'observedQueryRole', current_user,
  'targetRole', (
    SELECT jsonb_build_object(
      'name', r.rolname,
      'canLogin', r.rolcanlogin,
      'superuser', r.rolsuper,
      'bypassRls', r.rolbypassrls,
      'inherit', r.rolinherit,
      'createRole', r.rolcreaterole,
      'createDatabase', r.rolcreatedb,
      'replication', r.rolreplication,
      'connectionLimit', r.rolconnlimit,
      'validUntil', r.rolvaliduntil
    )
    FROM pg_roles r
    WHERE r.rolname = 'bella_migration_executor'
  ),
  'databasePrivileges', jsonb_build_object(
    'connect', has_database_privilege('bella_migration_executor', current_database(), 'CONNECT'),
    'create', has_database_privilege('bella_migration_executor', current_database(), 'CREATE'),
    'temporary', has_database_privilege('bella_migration_executor', current_database(), 'TEMP')
  ),
  'memberships', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'direction', CASE WHEN member.rolname = 'bella_migration_executor' THEN 'executor_is_member_of' ELSE 'role_is_member_of_executor' END,
      'role', granted.rolname,
      'member', member.rolname,
      'adminOption', am.admin_option,
      'grantor', grantor.rolname
    ) ORDER BY granted.rolname, member.rolname), '[]'::jsonb)
    FROM pg_auth_members am
    JOIN pg_roles granted ON granted.oid = am.roleid
    JOIN pg_roles member ON member.oid = am.member
    JOIN pg_roles grantor ON grantor.oid = am.grantor
    WHERE granted.rolname = 'bella_migration_executor'
       OR member.rolname = 'bella_migration_executor'
  ),
  'usableSchemas', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'owner', owner.rolname,
      'usage', has_schema_privilege('bella_migration_executor', n.oid, 'USAGE'),
      'create', has_schema_privilege('bella_migration_executor', n.oid, 'CREATE')
    ) ORDER BY n.nspname), '[]'::jsonb)
    FROM pg_namespace n
    JOIN pg_roles owner ON owner.oid = n.nspowner
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND (has_schema_privilege('bella_migration_executor', n.oid, 'USAGE')
        OR has_schema_privilege('bella_migration_executor', n.oid, 'CREATE'))
  ),
  'tenantKeyRelationsWithEffectivePrivileges', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'relation', c.relname,
      'kind', c.relkind,
      'owner', owner.rolname,
      'rlsEnabled', c.relrowsecurity,
      'rlsForced', c.relforcerowsecurity,
      'tenantKeyColumns', (
        SELECT jsonb_agg(a.attname ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname IN ('tenant_id', 'organization_id', 'org_id', 'branch_id')
      ),
      'select', has_table_privilege('bella_migration_executor', c.oid, 'SELECT'),
      'insert', has_table_privilege('bella_migration_executor', c.oid, 'INSERT'),
      'update', has_table_privilege('bella_migration_executor', c.oid, 'UPDATE'),
      'delete', has_table_privilege('bella_migration_executor', c.oid, 'DELETE'),
      'truncate', has_table_privilege('bella_migration_executor', c.oid, 'TRUNCATE'),
      'references', has_table_privilege('bella_migration_executor', c.oid, 'REFERENCES'),
      'trigger', has_table_privilege('bella_migration_executor', c.oid, 'TRIGGER')
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner ON owner.oid = c.relowner
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname IN ('tenant_id', 'organization_id', 'org_id', 'branch_id')
      )
      AND (
        has_table_privilege('bella_migration_executor', c.oid, 'SELECT')
        OR has_table_privilege('bella_migration_executor', c.oid, 'INSERT')
        OR has_table_privilege('bella_migration_executor', c.oid, 'UPDATE')
        OR has_table_privilege('bella_migration_executor', c.oid, 'DELETE')
        OR has_table_privilege('bella_migration_executor', c.oid, 'TRUNCATE')
        OR has_table_privilege('bella_migration_executor', c.oid, 'REFERENCES')
        OR has_table_privilege('bella_migration_executor', c.oid, 'TRIGGER')
      )
  ),
  'relationPrivilegeCounts', (
    SELECT jsonb_build_object(
      'relationsWithSelect', count(*) FILTER (WHERE has_table_privilege('bella_migration_executor', c.oid, 'SELECT')),
      'relationsWithInsert', count(*) FILTER (WHERE has_table_privilege('bella_migration_executor', c.oid, 'INSERT')),
      'relationsWithUpdate', count(*) FILTER (WHERE has_table_privilege('bella_migration_executor', c.oid, 'UPDATE')),
      'relationsWithDelete', count(*) FILTER (WHERE has_table_privilege('bella_migration_executor', c.oid, 'DELETE')),
      'relationsOwned', count(*) FILTER (WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'bella_migration_executor'))
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ),
  'sequencePrivileges', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'sequence', c.relname,
      'owner', owner.rolname,
      'usage', has_sequence_privilege('bella_migration_executor', c.oid, 'USAGE'),
      'select', has_sequence_privilege('bella_migration_executor', c.oid, 'SELECT'),
      'update', has_sequence_privilege('bella_migration_executor', c.oid, 'UPDATE')
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles owner ON owner.oid = c.relowner
    WHERE c.relkind = 'S'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND (has_sequence_privilege('bella_migration_executor', c.oid, 'USAGE')
        OR has_sequence_privilege('bella_migration_executor', c.oid, 'SELECT')
        OR has_sequence_privilege('bella_migration_executor', c.oid, 'UPDATE'))
  ),
  'executableSecurityDefinerFunctions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'identityArguments', pg_get_function_identity_arguments(p.oid),
      'owner', owner.rolname
    ) ORDER BY n.nspname, p.proname, p.oid), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE p.prosecdef
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND has_function_privilege('bella_migration_executor', p.oid, 'EXECUTE')
  ),
  'defaultPrivilegesGrantedToExecutor', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'owner', owner.rolname,
      'schema', COALESCE(n.nspname, '*'),
      'objectType', d.defaclobjtype,
      'acl', d.defaclacl
    ) ORDER BY owner.rolname, COALESCE(n.nspname, '*'), d.defaclobjtype), '[]'::jsonb)
    FROM pg_default_acl d
    JOIN pg_roles owner ON owner.oid = d.defaclrole
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE d.defaclacl::text LIKE '%bella_migration_executor%'
  ),
  'credentialUsageInCurrentShell', 'Not read by SQL; inspected separately by environment-variable names only'
) AS privileged_role_readonly_evidence;

ROLLBACK;
