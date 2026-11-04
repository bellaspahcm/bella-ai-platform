SELECT evidence - 'memberships' || jsonb_build_object('memberships',(SELECT jsonb_agg(m - 'grantor' ORDER BY m->>'role',m->>'member') FROM jsonb_array_elements(evidence->'memberships') m)) AS evidence FROM (WITH rpc AS (
 SELECT p.oid,n.nspname AS schema,p.proname AS name,
 pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
 p.proacl::text AS acl,p.proconfig,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=to_regprocedure('public.exec_sql(text)')
)
SELECT jsonb_build_object(
 'function',(SELECT to_jsonb(f)-'oid' FROM rpc f),
 'function_grants',coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor)) FROM rpc f JOIN pg_proc p ON p.oid=f.oid CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'bypass_rls',r.rolbypassrls,'login',r.rolcanlogin,'execute',has_function_privilege(r.oid,'public.exec_sql(text)','EXECUTE'),'grant_option',has_function_privilege(r.oid,'public.exec_sql(text)','EXECUTE WITH GRANT OPTION')) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname<>'acl_rehearsal_superuser'),
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor)) FROM pg_auth_members m),'[]'::jsonb),
 'dynamic_candidates',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prokind='f' AND p.prosecdef AND (p.prosrc ~* '\mEXECUTE\M' OR p.proname ~* '(exec.*sql|query.*sql|run.*sql|sql.*exec)')),'[]'::jsonb),
 'incoming_function_references',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'definition',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND p.oid<>to_regprocedure('public.exec_sql(text)') AND n.nspname NOT IN ('pg_catalog','information_schema') AND p.prosrc ILIKE '%exec_sql%'),'[]'::jsonb)
) AS evidence) all_rpc_catalog;
