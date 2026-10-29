BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
WITH targets AS (
  SELECT c.oid, c.relname, c.relkind, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
    AND (c.relname LIKE 'edu_%' OR c.relname LIKE 'preschool_%'
      OR c.relname IN ('students','courses','users','tenants','party_parties','party_relationships','people_directory','user_org_unit_access','org_units','org_relationships'))
), table_state AS (
  SELECT t.relname AS name, t.relkind AS kind, pg_get_userbyid(t.relowner) AS owner,
    t.relrowsecurity AS rls_enabled, t.relforcerowsecurity AS rls_forced, t.relacl::text AS raw_acl,
    has_table_privilege('anon',t.oid,'SELECT') AS anon_select,
    has_table_privilege('anon',t.oid,'INSERT') AS anon_insert,
    has_table_privilege('anon',t.oid,'UPDATE') AS anon_update,
    has_table_privilege('anon',t.oid,'DELETE') AS anon_delete,
    has_table_privilege('anon',t.oid,'TRUNCATE') AS anon_truncate,
    has_table_privilege('authenticated',t.oid,'SELECT') AS authenticated_select,
    has_table_privilege('authenticated',t.oid,'INSERT') AS authenticated_insert,
    has_table_privilege('authenticated',t.oid,'UPDATE') AS authenticated_update,
    has_table_privilege('authenticated',t.oid,'DELETE') AS authenticated_delete,
    has_table_privilege('authenticated',t.oid,'TRUNCATE') AS authenticated_truncate,
    (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=t.oid) AS policy_count
  FROM targets t
), expanded_acl AS (
  SELECT t.relname AS table_name, pg_get_userbyid(a.grantor) AS grantor,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
    a.privilege_type, a.is_grantable
  FROM targets t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a
), column_acl AS (
  SELECT t.relname AS table_name,a.attname AS column_name,a.attacl::text AS raw_acl
  FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid
  WHERE a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
), helpers AS (
  SELECT p.proname AS name, pg_get_userbyid(p.proowner) AS owner,
    p.prosecdef AS security_definer, p.proconfig AS configuration, p.proacl::text AS raw_acl,
    pg_get_function_identity_arguments(p.oid) AS arguments, pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('get_auth_tenant_id','get_current_tenant_id','get_my_tenant_id','is_admin','is_hq_admin','is_hq_super_admin')
)
SELECT jsonb_build_object(
  'identity',jsonb_build_object('database',current_database(),'execution_role',current_user,'transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version')),
  'tables',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.name) FROM table_state t),'[]'::jsonb),
  'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename IN (SELECT relname FROM targets)),'[]'::jsonb),
  'table_grants',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.table_name,a.grantee,a.privilege_type) FROM expanded_acl a),'[]'::jsonb),
  'column_grants',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.table_name,a.column_name) FROM column_acl a),'[]'::jsonb),
  'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'bypass_rls',r.rolbypassrls,'can_login',r.rolcanlogin) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','authenticator','postgres')),'[]'::jsonb),
  'role_memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'admin_option',m.admin_option)) FROM pg_auth_members m WHERE pg_get_userbyid(m.member) IN ('anon','authenticated','service_role','authenticator')),'[]'::jsonb),
  'schema_grants',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'role',r.role,'usage',has_schema_privilege(r.role,n.oid,'USAGE'),'create',has_schema_privilege(r.role,n.oid,'CREATE'))) FROM pg_namespace n CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role) WHERE n.nspname='public'),'[]'::jsonb),
  'default_acl',coalesce((SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'object_type',d.defaclobjtype,'acl',d.defaclacl::text)) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public' OR d.defaclnamespace=0),'[]'::jsonb),
  'helpers',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.name,h.arguments) FROM helpers h),'[]'::jsonb),
  'views',coalesce((SELECT jsonb_agg(jsonb_build_object('name',t.relname,'definition',pg_get_viewdef(t.oid,true))) FROM targets t WHERE t.relkind='v'),'[]'::jsonb)
) AS evidence;
ROLLBACK;
