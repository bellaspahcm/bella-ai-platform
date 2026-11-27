// Barrel for accounting server actions. Split from a 1003-LOC monolith (Sprint 1.3).
// Public API is unchanged — all original imports of '@/services/accounting-actions'
// continue to resolve. Types re-exported from the plain ./accounting/types module.

export type {
  OutboxEventWithDiagnostics,
} from '../core/services/accounting/journals';

export type {
  AccountingEventTemplate,
  AccountingBackfillResult,
  AccountingDuplicateJournalReference,
  AccountingHealthAlertKind,
  AccountingHealthAlertNotificationResult,
  AccountingHealthCheck,
  AccountingHealthMetrics,
  AccountingHealthSeverity,
  AccountingHealthStatus,
  AccountingHealthSummary,
  BusinessHealthDatasetCounts,
  BusinessHealthFinding,
  BusinessHealthFindingDetail,
  BusinessHealthFindingSeverity,
  BusinessHealthGroup,
  BusinessHealthRepairAction,
  BusinessHealthRepairResult,
  BusinessHealthSeverity,
  BusinessHealthSummary,
  AccountingReadinessSummary,
  AccountingReviewItem,
  AccountingReviewResolutionStatus,
  AccountingStandardProfile,
  BusinessEventType,
  CreateAccountInput,
  LegacyLedgerSyncPreview,
  ManualJournalInput,
  ProfessionalModeReadinessGate,
  ReconciliationRow,
  SalaryReconciliationRow,
} from '../core/services/accounting/types';

export {
  getAccounts, createAccount, updateAccount, seedTT99ChartOfAccounts,
} from '../core/services/accounting/coa';

export {
  assertLegacyFinanceWriteAllowed,
  getAccountingMode, getLegacyLedgerSyncPreview, getProfessionalModeReadinessGate, updateAccountingMode, syncLegacyToLedger,
} from '../core/services/accounting/mode';

export {
  getJournalEntries, getJournalEntryDetails, reverseJournalEntry,
  getOutboxEvents, replayOutboxEvent, postManualJournalEntry,
} from '../core/services/accounting/journals';

export {
  getAccountingPeriods, previewClosingEntries, closePeriodAction, reopenPeriodAction,
} from '../core/services/accounting/periods';

export {
  getTrialBalanceReport, getIncomeStatementReport, getBalanceSheetReport,
  getAccountLedgerReport, getCashFlowStatementReport,
  getReconciliationReport, getSalaryReconciliationReport,
} from '../core/services/accounting/reports';

export {
  getAccountingEventTemplates,
  getAccountingReviewQueue,
  getAccountingReadinessSummary,
  createAccountingReviewItem,
  resolveAccountingReviewItem,
  runAccountingMetadataBackfill,
  classifyAccountingSourcePreview,
} from '../core/services/accounting/templates';

export {
  getAccountingHealthSummary,
  publishAccountingHealthAlertNotification,
  getMonthClosePreflight,
  assertMonthClosePreflight,
} from '../core/services/accounting/health';

export {
  getBusinessHealthSummary,
  runBusinessHealthRepairAction,
} from '../core/services/accounting/business-health';

export {
  createSalaryAccrualJournals,
} from '../core/services/accounting/salary-accrual';

export type { SalaryAccrualResult } from '../core/services/accounting/salary-accrual';
