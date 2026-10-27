BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH targets AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN (
 'users','tenants','org_units','people_directory','org_relationships','user_org_unit_access',
 'preschool_chain_course_branch_assignments','edu_courses','edu_enrollments','party_parties',
 'students','edu_daily_care_sessions','edu_daily_care_records','edu_attendance_daily_state')
), relations AS (
 SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
 has_table_privilege('authenticated',c.oid,'INSERT') AS auth_insert,
 CASE WHEN c.relkind='v' THEN md5(pg_get_viewdef(c.oid,true)) END AS view_fingerprint
 FROM targets c
), policies AS (
 SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname='public' AND tablename IN (SELECT relname FROM targets)
), helpers AS (
 SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef,p.proconfig,md5(pg_get_functiondef(p.oid)) AS fingerprint
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
 AND p.proname IN ('get_auth_tenant_id','is_hq_super_admin','current_tenant_id','current_user_role')
)
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'relations',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.relname) FROM relations r),'[]'::jsonb),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM policies p),'[]'::jsonb),
 'helpers',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.proname,h.arguments) FROM helpers h),'[]'::jsonb)
) AS evidence;
ROLLBACK;
