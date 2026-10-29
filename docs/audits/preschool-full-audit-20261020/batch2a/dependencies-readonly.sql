BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
WITH approved(name) AS (VALUES ('edu_comm_acknowledgements'),('edu_comm_consent_responses'),('edu_comm_deliveries'),('edu_comm_delivery_attempts'),('edu_comm_exceptions'),('edu_comm_notices'),('edu_comm_responses'),('edu_comm_sent_snapshots'),('edu_comm_threads'),('edu_fac_assets'),('edu_fac_facilities'),('edu_fac_inspection_logs'),('edu_fac_inspection_schedules'),('edu_fac_maintenance_jobs'),('edu_fac_out_of_service_logs'),('edu_fac_zones'),('edu_fin_billing_periods'),('edu_fin_fee_structures'),('edu_fin_invoice_line_items'),('edu_fin_invoices'),('edu_fin_payments'),('edu_fin_receipts'),('edu_fin_reconciliation_ledger'),('edu_fin_student_discount_profiles'),('edu_sched_compliance_snapshots'),('edu_sched_leave_requests'),('edu_sched_ratio_policies'),('edu_sched_shift_assignments'),('edu_sched_shift_templates'),('edu_sched_staff_availability'),('edu_sched_substitutions'),('students')), targets AS (
 SELECT c.oid,c.relname,c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions
 FROM approved a JOIN pg_class c ON c.oid=to_regclass('public.'||a.name)
), dependent_views AS (
 SELECT DISTINCT t.relname AS target,n.nspname AS view_schema,v.relname AS view_name,
 pg_get_userbyid(v.relowner) AS owner,v.reloptions,
 has_table_privilege('anon',v.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',v.oid,'SELECT') AS authenticated_select,
 pg_get_viewdef(v.oid,true) AS definition
 FROM targets t JOIN pg_depend dep ON dep.refobjid=t.oid
 JOIN pg_rewrite rw ON rw.oid=dep.objid JOIN pg_class v ON v.oid=rw.ev_class
 JOIN pg_namespace n ON n.oid=v.relnamespace WHERE v.relkind IN ('v','m') AND v.oid<>t.oid
), routines AS (
 SELECT p.oid,n.nspname AS schema,p.proname AS name,p.prosecdef AS security_definer,
 pg_get_function_identity_arguments(p.oid) AS arguments,p.proconfig,p.proacl::text AS acl,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND EXISTS(SELECT 1 FROM approved a WHERE position(a.name in lower(p.prosrc))>0)
), columns AS (
 SELECT t.relname AS table_name,a.attnum,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
 a.attnotnull AS not_null,a.attidentity,a.attgenerated,a.attacl::text AS acl,
 pg_get_expr(ad.adbin,ad.adrelid) AS default_expression
 FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef ad ON ad.adrelid=t.oid AND ad.adnum=a.attnum
), constraints AS (
 SELECT t.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid,true) AS definition,
 CASE WHEN c.confrelid<>0 THEN c.confrelid::regclass::text ELSE NULL END AS referenced_relation
 FROM targets t JOIN pg_constraint c ON c.conrelid=t.oid
), triggers AS (
 SELECT t.relname AS table_name,tr.tgname,pg_get_triggerdef(tr.oid,true) AS definition,
 tr.tgfoid::regprocedure::text AS function_name
 FROM targets t JOIN pg_trigger tr ON tr.tgrelid=t.oid WHERE NOT tr.tgisinternal
)
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'target_count',(SELECT count(*) FROM targets),
 'columns',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.attnum) FROM columns c),'[]'::jsonb),
 'constraints',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.conname) FROM constraints c),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.tgname) FROM triggers c),'[]'::jsonb),
 'dependent_views',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.target,v.view_schema,v.view_name) FROM dependent_views v),'[]'::jsonb),
 'referencing_functions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.name,r.arguments) FROM routines r),'[]'::jsonb)
) AS evidence;
ROLLBACK;
