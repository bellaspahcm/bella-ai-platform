// Shared accounting domain types. Plain module (no 'use server') so it can be
// imported by both server-action sub-modules and client components.

export interface CreateAccountInput {
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parent_id?: string | null;
}

export interface ManualJournalInput {
  entry_date?: string;
  description: string;
  lines: {
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    branch_id?: string | null;
    ktv_id?: string | null;
    cost_center_id?: string | null;
  }[];
}

export interface ReconciliationRow {
  category: string;
  category_label: string;
  legacy_amount: number;
  ledger_amount: number;
  diff_amount: number;
  diff_percent: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF';
}

export interface SalaryReconciliationRow {
  ktv_id: string;
  ktv_name: string;
  legacy_base_salary: number;
  legacy_session_bonus: number;
  legacy_kpi_bonus: number;
  legacy_deductions: number;
  legacy_product_sales_commission?: number;
  legacy_total: number;
  legacy_status: string;
  ai_base_salary: number;
  ai_session_bonus: number;
  ai_kpi_bonus: number;
  ai_deductions: number;
  ai_product_sales_commission?: number;
  ai_total: number;
  diff_total: number | null;
  diff_percent: number | null;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'PENDING_LEGACY' | 'NO_LEGACY';
}

export type AccountingStandardProfile = 'TT133' | 'TT200' | 'TT99';

export type BusinessEventType =
  | 'CUSTOMER_DEPOSIT'
  | 'CUSTOMER_REMAINING_PAYMENT'
  | 'CUSTOMER_FULL_PAYMENT'
  | 'SESSION_REVENUE_RECOGNIZED'
  | 'REFUND_TO_CUSTOMER'
  | 'EXPENSE_RENT'
  | 'EXPENSE_UTILITIES'
  | 'EXPENSE_MARKETING'
  | 'EXPENSE_MATERIALS'
  | 'EXPENSE_SALARY'
  | 'EXPENSE_OTHER'
  | 'INVENTORY_PURCHASE'
  | 'INVENTORY_CONSUMED'
  | 'SALARY_ACCRUAL'
  | 'SALARY_PAYMENT'
  | 'KTV_COMMISSION_ACCRUAL'
  | 'INTER_BRANCH_CLEARING'
  | 'FRANCHISE_ROYALTY';

export type AccountingReviewStatus =
  | 'AUTO_POSTED'
  | 'NEEDS_REVIEW'
  | 'APPROVED_FOR_POSTING'
  | 'REJECTED'
  | 'POSTING_FAILED';

export type AccountingReviewResolutionStatus = 'APPROVED_FOR_POSTING' | 'REJECTED';

export type AccountingSourceTable =
  | 'revenue'
  | 'expenses'
  | 'salary_records'
  | 'session_logs'
  | 'inventory_logs'
  | 'franchise_royalty_invoices'
  | 'inter_branch_clearing';

export interface AccountingTemplateLine {
  side: 'DEBIT' | 'CREDIT';
  account_code: string;
  amount_source: string;
  optional?: boolean;
}

export interface AccountingEventTemplate {
  id: string;
  tenant_id: string | null;
  standard_profile: AccountingStandardProfile;
  business_event_type: BusinessEventType;
  template_name: string;
  description: string | null;
  source_module: string;
  template_lines: AccountingTemplateLine[];
  required_fields: string[];
  auto_post_allowed: boolean;
  requires_review: boolean;
  is_system: boolean;
  is_active: boolean;
}

export interface AccountingReviewItem {
  id: string;
  tenant_id: string;
  business_event_type: BusinessEventType | null;
  source_table: AccountingSourceTable | string;
  source_id: string;
  status: AccountingReviewStatus;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason_code: string;
  message: string;
  missing_fields: string[];
  suggested_template_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountingReadinessRow {
  source_table: string;
  total_records: number;
  classified_records: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
}

export interface AccountingReadinessSummary {
  rows: AccountingReadinessRow[];
  total_records: number;
  classified_records: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
  readiness_score: number;
  can_enable_professional: boolean;
}

export interface ProfessionalModeReadinessGate extends AccountingReadinessSummary {
  blocking_reasons: string[];
}

export interface LegacyLedgerSyncPreview {
  pending_revenue_count: number;
  pending_expense_count: number;
  pending_salary_count: number;
  journal_entries_to_create: number;
  revenue_amount: number;
  expense_amount: number;
  salary_amount: number;
}

export interface AccountingBackfillResult {
  source_table: string;
  scanned_records: number;
  classified_records: number;
  review_created: number;
}

export type AccountingBackfillActionResult =
  | { success: true; data: AccountingBackfillResult[] }
  | { success: false; error: string };

export type AccountingHealthStatus = 'pass' | 'warn' | 'fail';

export type AccountingHealthSeverity = 'healthy' | 'warning' | 'critical';

export interface AccountingHealthCheck {
  id: string;
  label: string;
  status: AccountingHealthStatus;
  count: number;
  message: string;
  href?: string;
}

export interface AccountingDuplicateJournalReference {
  reference_type: string;
  reference_id: string;
  active_count: number;
  entry_ids: string[];
}

export interface AccountingHealthMetrics {
  outbox_pending: number;
  outbox_processing: number;
  outbox_completed: number;
  outbox_failed: number;
  outbox_dead: number;
  journal_draft: number;
  journal_posted: number;
  journal_canceled: number;
  duplicate_active_references: number;
  readiness_score: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
  legacy_pending_revenue: number;
  legacy_pending_expense: number;
  legacy_pending_salary: number;
  legacy_journal_entries_to_create: number;
  worker_last_run_at: string | null;
  worker_minutes_since_last_run: number | null;
  worker_runs_24h: number;
  worker_failed_runs_24h: number;
  worker_failure_rate_24h: number;
  worker_silent_with_pending: number;
}

export interface AccountingHealthSummary {
  generated_at: string;
  month: string | null;
  severity: AccountingHealthSeverity;
  can_close_month: boolean;
  blocker_count: number;
  warning_count: number;
  metrics: AccountingHealthMetrics;
  checks: AccountingHealthCheck[];
  blockers: AccountingHealthCheck[];
  warnings: AccountingHealthCheck[];
  duplicate_journal_references: AccountingDuplicateJournalReference[];
}

export type AccountingHealthAlertKind =
  | 'worker_silent_with_pending'
  | 'worker_failed_runs_24h';

export interface AccountingHealthAlertNotificationResult {
  success: true;
  created: boolean;
  notification_id: string | null;
  alert_kind: AccountingHealthAlertKind | null;
  message: string;
}

export type BusinessHealthSeverity = 'healthy' | 'warning' | 'critical';

export type BusinessHealthFindingSeverity = 'critical' | 'warning';

export type BusinessHealthRepairAction =
  | 'replay_outbox'
  | 'run_metadata_backfill'
  | 'sync_paid_deposit_booking_status'
  | 'sync_booking_completed_sessions'
  | 'create_missing_inventory_consumption'
  | 'enqueue_missing_session_done_accounting'
  | 'enqueue_missing_inventory_consumed_accounting'
  | 'enqueue_missing_package_sale_accounting'
  | 'enqueue_missing_salary_paid_accounting';

export interface BusinessHealthFindingDetail {
  label: string;
  value: string;
}

export interface BusinessHealthFinding {
  id: string;
  group: string;
  group_label: string;
  severity: BusinessHealthFindingSeverity;
  code: string;
  title: string;
  message: string;
  action_label: string;
  href: string;
  details: BusinessHealthFindingDetail[];
  repair_action?: BusinessHealthRepairAction;
  repair_target_id?: string;
  repair_label?: string;
  repair_requires_confirmation?: boolean;
}

export interface BusinessHealthGroup {
  id: string;
  label: string;
  description: string;
  status: AccountingHealthStatus;
  critical_count: number;
  warning_count: number;
  checked_count: number;
  href: string;
  action_label: string;
}

export interface BusinessHealthDatasetCounts {
  bookings: number;
  revenue: number;
  session_logs: number;
  salary_records: number;
  packages: number;
  package_materials: number;
  inventory_items: number;
  inventory_logs: number;
  journal_entries: number;
  journal_lines: number;
  accounting_outbox: number;
}

export interface BusinessHealthSummary {
  generated_at: string;
  month: string;
  severity: BusinessHealthSeverity;
  score: number;
  checked_groups: number;
  critical_count: number;
  warning_count: number;
  can_operate_cleanly: boolean;
  dataset_counts: BusinessHealthDatasetCounts;
  groups: BusinessHealthGroup[];
  findings: BusinessHealthFinding[];
  blockers: BusinessHealthFinding[];
  warnings: BusinessHealthFinding[];
}

export interface BusinessHealthRepairResult {
  success: true;
  action: BusinessHealthRepairAction;
  message: string;
}
