-- Read-only catalog comparison. Run only against the verified Production ref.
-- Results may reveal schema and role configuration. No customer data is returned.
SELECT 'migration' AS kind, version AS name, name AS definition
FROM supabase_migrations.schema_migrations
WHERE version IN ('20261120130000','20261121000050','20261121062202')
ORDER BY version;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN (
 'interior_customers','interior_customer_contacts','interior_customer_addresses',
 'interior_acceptance_campaigns','interior_acceptance_sessions',
 'interior_acceptance_notes','interior_acceptance_evidence_objects',
 'interior_acceptance_approval_audit')
ORDER BY tablename,policyname;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
 'interior_customers','interior_customer_contacts','interior_customer_addresses',
 'interior_acceptance_campaigns','interior_acceptance_sessions',
 'interior_acceptance_notes','interior_acceptance_evidence_objects',
 'interior_acceptance_approval_audit')
ORDER BY c.relname;

SELECT c.relname, a.attname, a.attacl::text
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
 'interior_customers','interior_customer_contacts','interior_customer_addresses',
 'interior_acceptance_campaigns','interior_acceptance_sessions',
 'interior_acceptance_notes','interior_acceptance_evidence_objects')
AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
ORDER BY c.relname,a.attnum;

SELECT c.conrelid::regclass::text AS table_name,c.conname,pg_get_constraintdef(c.oid,true) AS definition
FROM pg_constraint c WHERE c.conrelid IN (
 'public.interior_projects'::regclass,'public.interior_acceptance_campaigns'::regclass,
 'public.interior_acceptance_sessions'::regclass,'public.interior_acceptance_notes'::regclass,
 'public.interior_acceptance_evidence_objects'::regclass)
ORDER BY table_name,c.conname;

SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN (
 'interior_projects','interior_customer_contacts','interior_customer_addresses',
 'interior_acceptance_campaigns','interior_acceptance_sessions',
 'interior_acceptance_notes','interior_acceptance_evidence_objects')
ORDER BY tablename,indexname;

SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN (
 'interior_customers','interior_customer_contacts','interior_customer_addresses',
 'interior_acceptance_campaigns','interior_acceptance_sessions',
 'interior_acceptance_notes','interior_acceptance_evidence_objects')
ORDER BY c.relname,t.tgname;

SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
 p.proacl::text AS acl,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN (
 'interior_execute_customer_merge','interior_generate_customer_code','interior_resolve_project_id',
 'interior_guard_customer_actor_fields','interior_guard_acceptance_session_update',
 'interior_decide_acceptance_session','interior_crm_touch_updated_at',
 'interior_set_primary_contact','interior_set_default_address')
ORDER BY signature;

SELECT rp.role_key,rp.permission_id FROM public.interior_role_permissions rp
WHERE rp.permission_id LIKE 'interior:customer%' OR rp.permission_id LIKE 'interior:acceptance%'
   OR rp.permission_id IN ('interior:delivery:read','interior:delivery:create','interior:delivery:update',
     'interior:qc:read','interior:qc:create','interior:qc:update','interior:handover:approve')
ORDER BY rp.permission_id,rp.role_key;

SELECT 'contact_primary_duplicates' AS check_name, count(*) AS groups FROM (
 SELECT tenant_id,customer_id FROM public.interior_customer_contacts WHERE is_primary GROUP BY tenant_id,customer_id HAVING count(*)>1
) q
UNION ALL
SELECT 'address_default_duplicates',count(*) FROM (
 SELECT tenant_id,customer_id FROM public.interior_customer_addresses WHERE is_default GROUP BY tenant_id,customer_id HAVING count(*)>1
) q
UNION ALL
SELECT 'session_campaign_project_mismatch',count(*) FROM public.interior_acceptance_sessions s
LEFT JOIN public.interior_acceptance_campaigns c ON c.id=s.campaign_id AND c.tenant_id=s.tenant_id
WHERE c.id IS NULL OR c.project_id IS DISTINCT FROM s.project_id;
