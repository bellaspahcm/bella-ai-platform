-- PROPOSAL ONLY. NOT AN APPROVED MIGRATION. NOT EXECUTED.
-- Target: Supabase lvnvkpyxtuilhrabtlwv; owner approval required.
-- Exact scope: 31 Preschool Product tables + shared Platform students table.
-- Purpose: remove direct anonymous privileges only. Authenticated RBAC/RLS remains unresolved.
-- Require fresh catalog equivalence, owner GO, scoped backup and isolated rehearsal first.
-- Do not run against another project or expand this allowlist dynamically.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE ALL PRIVILEGES ON TABLE
  public.edu_comm_acknowledgements,
  public.edu_comm_consent_responses,
  public.edu_comm_deliveries,
  public.edu_comm_delivery_attempts,
  public.edu_comm_exceptions,
  public.edu_comm_notices,
  public.edu_comm_responses,
  public.edu_comm_sent_snapshots,
  public.edu_comm_threads,
  public.edu_fac_assets,
  public.edu_fac_facilities,
  public.edu_fac_inspection_logs,
  public.edu_fac_inspection_schedules,
  public.edu_fac_maintenance_jobs,
  public.edu_fac_out_of_service_logs,
  public.edu_fac_zones,
  public.edu_fin_billing_periods,
  public.edu_fin_fee_structures,
  public.edu_fin_invoice_line_items,
  public.edu_fin_invoices,
  public.edu_fin_payments,
  public.edu_fin_receipts,
  public.edu_fin_reconciliation_ledger,
  public.edu_fin_student_discount_profiles,
  public.edu_sched_compliance_snapshots,
  public.edu_sched_leave_requests,
  public.edu_sched_ratio_policies,
  public.edu_sched_shift_assignments,
  public.edu_sched_shift_templates,
  public.edu_sched_staff_availability,
  public.edu_sched_substitutions,
  public.students
FROM anon;
DO $verification$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['edu_comm_acknowledgements','edu_comm_consent_responses','edu_comm_deliveries','edu_comm_delivery_attempts','edu_comm_exceptions','edu_comm_notices','edu_comm_responses','edu_comm_sent_snapshots','edu_comm_threads','edu_fac_assets','edu_fac_facilities','edu_fac_inspection_logs','edu_fac_inspection_schedules','edu_fac_maintenance_jobs','edu_fac_out_of_service_logs','edu_fac_zones','edu_fin_billing_periods','edu_fin_fee_structures','edu_fin_invoice_line_items','edu_fin_invoices','edu_fin_payments','edu_fin_receipts','edu_fin_reconciliation_ledger','edu_fin_student_discount_profiles','edu_sched_compliance_snapshots','edu_sched_leave_requests','edu_sched_ratio_policies','edu_sched_shift_assignments','edu_sched_shift_templates','edu_sched_staff_availability','edu_sched_substitutions','students']
  LOOP
    IF has_table_privilege('anon',format('public.%I',relation_name),'SELECT')
       OR has_table_privilege('anon',format('public.%I',relation_name),'INSERT')
       OR has_table_privilege('anon',format('public.%I',relation_name),'UPDATE')
       OR has_table_privilege('anon',format('public.%I',relation_name),'DELETE')
       OR has_table_privilege('anon',format('public.%I',relation_name),'TRUNCATE')
       OR has_table_privilege('anon',format('public.%I',relation_name),'REFERENCES')
       OR has_table_privilege('anon',format('public.%I',relation_name),'TRIGGER')
       OR has_table_privilege('anon',format('public.%I',relation_name),'MAINTAIN') THEN
      RAISE EXCEPTION 'Anonymous privileges remain on %',relation_name;
    END IF;
  END LOOP;
END;
$verification$;
-- Rehearsal/default: always roll back. Production COMMIT must be a separately
-- reviewed execution artifact after authorized GO, never a silent edit here.
ROLLBACK;
