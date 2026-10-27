BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT jsonb_build_object(
  'database', current_database(),
  'currentUser', current_user,
  'sessionUser', session_user,
  'activeSessions', (
    SELECT jsonb_build_object(
      'count', count(*),
      'active', count(*) FILTER (WHERE state = 'active'),
      'idle', count(*) FILTER (WHERE state = 'idle'),
      'idleInTransaction', count(*) FILTER (WHERE state LIKE 'idle in transaction%'),
      'applicationNames', COALESCE(jsonb_agg(DISTINCT application_name) FILTER (WHERE application_name IS NOT NULL), '[]'::jsonb),
      'oldestBackendStart', min(backend_start)
    )
    FROM pg_stat_activity
    WHERE usename = 'bella_migration_executor'
      AND pid <> pg_backend_pid()
  ),
  'statementStats', (
    SELECT jsonb_build_object(
      'statsResetAt', i.stats_reset,
      'trackingMode', current_setting('pg_stat_statements.track', true),
      'trackUtility', current_setting('pg_stat_statements.track_utility', true),
      'normalizedStatementCount', count(s.queryid),
      'totalCalls', COALESCE(sum(s.calls), 0),
      'callsClassifiedAsDmlOrDdl', COALESCE(sum(s.calls) FILTER (
        WHERE s.query ~* '^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|DO|CALL)'
      ), 0),
      'firstStatsSince', min(s.stats_since),
      'lastStatsSince', max(s.stats_since)
    )
    FROM extensions.pg_stat_statements_info i
    LEFT JOIN extensions.pg_stat_statements s
      ON s.userid = (SELECT oid FROM pg_roles WHERE rolname = 'bella_migration_executor')
    GROUP BY i.stats_reset
  ),
  'ownedRelations', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'relation', c.relname,
      'kind', c.relkind,
      'rlsEnabled', c.relrowsecurity,
      'rlsForced', c.relforcerowsecurity
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'bella_migration_executor')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
  ),
  'ownedFunctions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'identityArguments', pg_get_function_identity_arguments(p.oid),
      'securityDefiner', p.prosecdef,
      'configuration', p.proconfig,
      'acl', p.proacl
    ) ORDER BY n.nspname, p.proname, p.oid), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'bella_migration_executor')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ),
  'maintenanceFunctions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'identityArguments', pg_get_function_identity_arguments(p.oid),
      'owner', owner.rolname,
      'securityDefiner', p.prosecdef,
      'configuration', p.proconfig,
      'acl', p.proacl,
      'executorCanExecute', has_function_privilege('bella_migration_executor', p.oid, 'EXECUTE')
    ) ORDER BY n.nspname, p.proname, p.oid), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles owner ON owner.oid = p.proowner
    WHERE p.proname IN ('exec_sql', 'set_tenant_context')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  )
) AS privileged_role_runtime_evidence;

ROLLBACK;
