BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
SET LOCAL ROLE authenticated;
DO $positive$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['edu_comm_acknowledgements','edu_comm_consent_responses','edu_comm_deliveries','edu_comm_delivery_attempts','edu_comm_exceptions','edu_comm_notices','edu_comm_responses','edu_comm_sent_snapshots','edu_comm_threads','edu_fac_assets','edu_fac_facilities','edu_fac_inspection_logs','edu_fac_inspection_schedules','edu_fac_maintenance_jobs','edu_fac_out_of_service_logs','edu_fac_zones','edu_fin_billing_periods','edu_fin_fee_structures','edu_fin_invoice_line_items','edu_fin_invoices','edu_fin_payments','edu_fin_receipts','edu_fin_reconciliation_ledger','edu_fin_student_discount_profiles','edu_sched_compliance_snapshots','edu_sched_leave_requests','edu_sched_ratio_policies','edu_sched_shift_assignments','edu_sched_shift_templates','edu_sched_staff_availability','edu_sched_substitutions','students'] LOOP EXECUTE format('SELECT 1 FROM public.%I LIMIT 0',t); END LOOP; PERFORM public.exec_sql('SELECT 1'); END $positive$;
SELECT jsonb_build_object('role',current_user,'tables_read_compiled',32,'constant_select_rpc','PASS','transaction_read_only',current_setting('transaction_read_only'),'user_jwt',false) AS evidence;
RESET ROLE;

ROLLBACK;
