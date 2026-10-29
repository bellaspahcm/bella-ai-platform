BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
WITH target AS (SELECT c.* FROM pg_class c WHERE c.oid='public.users'::regclass),
columns AS (
 SELECT a.attnum,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,
 a.attidentity,a.attgenerated,a.attacl::text AS acl,pg_get_expr(ad.adbin,ad.adrelid) AS default_expression
 FROM target t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
), functions AS (
 SELECT DISTINCT p.oid,n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proacl::text AS acl,p.proconfig,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND (p.oid IN(SELECT t.tgfoid FROM pg_trigger t WHERE t.tgrelid='public.users'::regclass AND NOT t.tgisinternal)
 OR (n.nspname='public' AND p.proname IN ('current_user_role','current_tenant_id','get_auth_tenant_id','is_admin','is_hq_super_admin'))
 OR (n.nspname='auth' AND p.proname IN ('uid','jwt')))
), dependent_views AS (
 SELECT DISTINCT n.nspname AS schema,v.relname AS name,v.reloptions,pg_get_userbyid(v.relowner) AS owner,
 has_table_privilege('anon',v.oid,'UPDATE') AS anon_update,has_table_privilege('authenticated',v.oid,'UPDATE') AS authenticated_update,
 has_table_privilege('anon',v.oid,'INSERT') AS anon_insert,has_table_privilege('authenticated',v.oid,'INSERT') AS authenticated_insert,
 has_table_privilege('anon',v.oid,'DELETE') AS anon_delete,has_table_privilege('authenticated',v.oid,'DELETE') AS authenticated_delete,
 pg_get_viewdef(v.oid,true) AS definition
 FROM pg_depend dep JOIN pg_rewrite rw ON rw.oid=dep.objid JOIN pg_class v ON v.oid=rw.ev_class JOIN pg_namespace n ON n.oid=v.relnamespace
 WHERE dep.refobjid='public.users'::regclass AND v.relkind IN('v','m') AND v.oid<>'public.users'::regclass
)
SELECT jsonb_build_object(
 'table',(SELECT jsonb_build_object('name',t.relname,'kind',t.relkind,'owner',pg_get_userbyid(t.relowner),'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'acl',t.relacl::text) FROM target t),
 'grants',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type) FROM target t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a),
 'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY attnum) FROM columns c),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,true)) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid='public.users'::regclass),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('name',i.indexname,'definition',i.indexdef) ORDER BY i.indexname) FROM pg_indexes i WHERE i.schemaname='public' AND i.tablename='users'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public' AND tablename='users'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid='public.users'::regclass AND NOT t.tgisinternal),
 'functions',(SELECT jsonb_agg(to_jsonb(f)-'oid' ORDER BY f.schema,f.name,f.arguments) FROM functions f),
 'views',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY schema,name) FROM dependent_views v),'[]'::jsonb),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'bypass_rls',r.rolbypassrls,'can_login',r.rolcanlogin) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role','postgres')),
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member)) FROM pg_auth_members m WHERE pg_get_userbyid(m.member) IN('anon','authenticated')),'[]'::jsonb),
 'user_referring_definers',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND p.prokind='f' AND p.prosecdef AND (p.prosrc ~* '\musers\M' OR p.prosrc ~* '\mEXECUTE\M')),'[]'::jsonb),
 'schema_grants',(SELECT jsonb_agg(jsonb_build_object('role',r.role,'usage',has_schema_privilege(r.role,'public','USAGE'),'create',has_schema_privilege(r.role,'public','CREATE')) ORDER BY r.role) FROM (VALUES('anon'),('authenticated'),('service_role'))r(role)),
 'defaults',coalesce((SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(a.defaclrole),'namespace',coalesce(n.nspname,''),'type',a.defaclobjtype,'acl',a.defaclacl::text) ORDER BY pg_get_userbyid(a.defaclrole),coalesce(n.nspname,''),a.defaclobjtype) FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace WHERE n.nspname='public' OR a.defaclnamespace=0),'[]'::jsonb)
) AS evidence;

ROLLBACK;
