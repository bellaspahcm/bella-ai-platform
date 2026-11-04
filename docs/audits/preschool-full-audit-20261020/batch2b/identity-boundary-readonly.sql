BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object(
 'table',(SELECT jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force_rls',relforcerowsecurity,'acl',relacl::text) FROM pg_class WHERE oid='public.users'::regclass),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public' AND tablename='users'),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'acl',attacl::text,'authenticated_update',has_column_privilege('authenticated',attrelid,attnum,'UPDATE')) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.users'::regclass AND attnum>0 AND NOT attisdropped),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true),'function',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid='public.users'::regclass AND NOT t.tgisinternal),'[]'::jsonb),
 'rules',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.rulename,'definition',pg_get_ruledef(r.oid,true)) ORDER BY r.rulename) FROM pg_rewrite r WHERE r.ev_class='public.users'::regclass),'[]'::jsonb),
 'identity_helpers',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_auth_tenant_id','is_admin','is_hq_super_admin')),
 'rpc_comment',obj_description(to_regprocedure('public.exec_sql(text)'),'pg_proc')
) AS evidence;
ROLLBACK;
