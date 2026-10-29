WITH targets AS (
 SELECT c.oid,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['edu_comm_acknowledgements','edu_comm_consent_responses','edu_comm_deliveries','edu_comm_delivery_attempts','edu_comm_exceptions','edu_comm_notices','edu_comm_responses','edu_comm_sent_snapshots','edu_comm_threads','edu_fac_assets','edu_fac_facilities','edu_fac_inspection_logs','edu_fac_inspection_schedules','edu_fac_maintenance_jobs','edu_fac_out_of_service_logs','edu_fac_zones','edu_fin_billing_periods','edu_fin_fee_structures','edu_fin_invoice_line_items','edu_fin_invoices','edu_fin_payments','edu_fin_receipts','edu_fin_reconciliation_ledger','edu_fin_student_discount_profiles','edu_sched_compliance_snapshots','edu_sched_leave_requests','edu_sched_ratio_policies','edu_sched_shift_assignments','edu_sched_shift_templates','edu_sched_staff_availability','edu_sched_substitutions','students'])
), grants AS (
 SELECT t.relname AS table_name,pg_get_userbyid(a.grantor) AS grantor,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
 FROM targets t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a
), cols AS (
 SELECT t.relname AS table_name,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
 a.attnotnull AS not_null,a.attidentity,a.attgenerated,a.attacl::text AS acl,pg_get_expr(ad.adbin,ad.adrelid) AS default_expression
 FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef ad ON ad.adrelid=t.oid AND ad.adnum=a.attnum
), constraints AS (
 SELECT t.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid,true) AS definition
 FROM targets t JOIN pg_constraint c ON c.conrelid=t.oid
), triggers AS (
 SELECT t.relname AS table_name,tr.tgname,pg_get_triggerdef(tr.oid,true) AS definition
 FROM targets t JOIN pg_trigger tr ON tr.tgrelid=t.oid WHERE NOT tr.tgisinternal
), views AS (
 SELECT DISTINCT t.relname AS target,n.nspname AS schema,v.relname AS name,v.reloptions,
 has_table_privilege('anon',v.oid,'SELECT') AS anon_select,pg_get_viewdef(v.oid,true) AS definition
 FROM targets t JOIN pg_depend dep ON dep.refobjid=t.oid JOIN pg_rewrite rw ON rw.oid=dep.objid
 JOIN pg_class v ON v.oid=rw.ev_class JOIN pg_namespace n ON n.oid=v.relnamespace WHERE v.relkind IN ('v','m') AND v.oid<>t.oid
), functions AS (
 SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proacl::text AS acl,p.proconfig,
 pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND ((n.nspname='public' AND (p.proname IN ('get_auth_tenant_id','get_my_tenant_id','is_admin','is_hq_admin','is_hq_super_admin','fn_check_sent_snapshot_immutable','fn_check_invoice_line_items_immutable','fn_check_invoice_immutable','update_students_updated_at') OR EXISTS(SELECT 1 FROM targets t WHERE position(t.relname IN lower(p.prosrc))>0))) OR (n.nspname='auth' AND p.proname IN ('jwt','uid')))
)
SELECT jsonb_build_object(
 'tables',coalesce((SELECT jsonb_agg(jsonb_build_object('name',t.relname,'kind',t.relkind,'owner',pg_get_userbyid(t.relowner),'rls_enabled',t.relrowsecurity,'rls_forced',t.relforcerowsecurity) ORDER BY t.relname) FROM targets t),'[]'::jsonb),
 'grants',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_name,g.grantee,g.privilege_type,g.grantor) FROM grants g),'[]'::jsonb),
 'columns',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.name) FROM cols c),'[]'::jsonb),
 'constraints',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.conname) FROM constraints c),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_name,t.tgname) FROM triggers t),'[]'::jsonb),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename IN (SELECT relname FROM targets)),'[]'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.schema,f.name,f.arguments) FROM functions f),'[]'::jsonb),
 'views',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.target,v.schema,v.name) FROM views v),'[]'::jsonb),
 'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'bypass_rls',r.rolbypassrls,'can_login',r.rolcanlogin) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','authenticator','postgres')),'[]'::jsonb),
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'admin_option',m.admin_option) ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member)) FROM pg_auth_members m WHERE pg_get_userbyid(m.member) IN ('anon','authenticated','service_role','authenticator')),'[]'::jsonb),
 'schema_grants',coalesce((SELECT jsonb_agg(jsonb_build_object('role',r.role,'usage',has_schema_privilege(r.role,'public','USAGE'),'create',has_schema_privilege(r.role,'public','CREATE')) ORDER BY r.role) FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role)),'[]'::jsonb),
 'defaults',coalesce((SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(a.defaclrole),'namespace',coalesce(n.nspname,''),'object_type',a.defaclobjtype,'acl',a.defaclacl::text) ORDER BY pg_get_userbyid(a.defaclrole),coalesce(n.nspname,''),a.defaclobjtype) FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace WHERE n.nspname='public' OR a.defaclnamespace=0),'[]'::jsonb)
) AS evidence;
