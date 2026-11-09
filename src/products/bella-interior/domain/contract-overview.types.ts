/**
 * Bella Interior OS — Commercial Contract & Payment Progress Domain Types
 *
 * Single Source of Truth for Contract Lifecycle, Payment Milestones,
 * Revenue Collection, and Workshop Release Gating.
 * UI components consume these canonical models without local calculation.
 *
 * @module src/products/bella-interior/domain/contract-overview.types
 */

export interface ContractProjectHeader {
  projectId: string;
  projectCode: string;
  projectName: string;
  selectorLabel: string;
  clientName: string;
  contractId: string;
  managerName: string;
  managerRole: string;
}

export interface ContractKPIItem {
  rawValue?: number;
  formattedValue: string;
  label: string;
  subtext: string;
  subtextVariant?: 'neutral' | 'success' | 'warning' | 'danger';
  badgeLabel?: string;
  badgeClass?: string;
  iconName: string;
  iconBgClass: string;
}

export interface ContractOverviewKPIs {
  contractAndClient: ContractKPIItem;
  totalContractValue: ContractKPIItem;
  collectedAmount: ContractKPIItem;
  remainingAmount: ContractKPIItem;
  contractStatus: ContractKPIItem;
}

export interface PaymentStepperStep {
  stepNumber: number;
  title: string;
  percentage: number;
  percentageFormatted: string;
  amount: number;
  amountFormatted: string;
  status: 'paid' | 'invoiced' | 'partial' | 'pending';
  badgeText: string;
  badgeVariant: 'success' | 'warning' | 'neutral';
  isCurrent: boolean;
  isCompleted: boolean;
}

export interface PaymentProgressStepper {
  completionPercentage: number;
  completionFormatted: string;
  steps: PaymentStepperStep[];
}

export interface PaymentTransactionRecord {
  id: string;
  transactionDate: string;
  amount: number;
  amountFormatted: string;
  method: string;
  referenceCode: string;
  notes: string;
  proofUrl?: string;
}

export interface MilestoneTableItem {
  id: string;
  milestoneOrder: number;
  phaseName: string;
  percentage: number;
  percentageFormatted: string;
  amount: number;
  amountFormatted: string;
  collectedAmount: number;
  collectedFormatted: string;
  remainingAmount: number;
  remainingFormatted: string;
  dueDate: string;
  dueDateFormatted: string;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  statusLabel: string;
  statusBadgeVariant: 'success' | 'warning' | 'neutral' | 'danger';
  invoiceStatus: 'issued' | 'unissued' | 'adjusted';
  invoiceStatusLabel: string;
  invoiceNumber?: string;
  transactions: PaymentTransactionRecord[];
}

export interface ContractOperationalAlert {
  id: string;
  title: string;
  highlightText: string;
  description: string;
  type: 'warning' | 'danger' | 'info';
  dueInDays: number;
  targetMilestoneId: string;
  amountFormatted: string;
  actionText: string;
}

export interface ContractQuickAction {
  id: string;
  title: string;
  iconName: string;
  actionType: 'modal' | 'download' | 'link';
  modalTarget?: string;
}

export interface ContractMetadataTab {
  clientName: string;
  projectName: string;
  signedDateFormatted: string;
  contractValueFormatted: string;
  executionPeriod: string;
  paymentTerms: string;
  notes: string;
}

export interface ContractAddendumItem {
  id: string;
  code: string;
  title: string;
  valueChange: number;
  valueChangeFormatted: string;
  effectiveDate: string;
  status: 'approved' | 'pending' | 'signed';
  statusLabel: string;
  statusBadgeVariant: 'success' | 'warning';
  fileAttachment?: string;
}

export interface ContractAuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  type: 'finance' | 'legal' | 'production' | 'design';
}

export interface ContractFinancialAnalysisTab {
  estimatedCogs: number;
  estimatedCogsFormatted: string;
  contractValue: number;
  contractValueFormatted: string;
  grossProfitExpected: number;
  grossProfitExpectedFormatted: string;
  grossMarginExpectedPercent: number;
  grossMarginExpectedFormatted: string;
  cashflowSummary: string;
  cashflowStatus: 'positive' | 'neutral' | 'negative';
}

export interface ContractDetailedTabs {
  activeTab: 'info' | 'addenda' | 'audit' | 'analysis';
  info: ContractMetadataTab;
  addenda: ContractAddendumItem[];
  auditLogs: ContractAuditLogItem[];
  financialAnalysis: ContractFinancialAnalysisTab;
}

export interface ProjectSummaryCardData {
  title: string;
  imageUrl: string;
  imageAlt: string;
  progressPercentage: number;
  progressFormatted: string;
  expectedCompletionDate: string;
  completionDateFormatted: string;
}

export interface WorkshopReleaseCriterion {
  id: string;
  label: string;
  satisfied: boolean;
  evidence: string;
}

export interface WorkshopReleaseGating {
  isEligible: boolean;
  statusBadge: string;
  statusText: string;
  criteria: WorkshopReleaseCriterion[];
  releaseConditionsNote: string;
}

export interface ContractOverviewResponse {
  hasContract: boolean;
  /** False when contract data is readable but finance fields are permission-masked. */
  financeAccess?: boolean;
  contractSummary?: {
    contractNumber: string;
    title: string;
    status: string;
    signedDate: string | null;
    clientRepresentative?: string | null;
  };
  workflowCommands?: {
    createContractAvailable: boolean;
    releaseProductionAvailable: boolean;
  };
  header: ContractProjectHeader;
  kpis: ContractOverviewKPIs;
  progressStepper: PaymentProgressStepper;
  milestones: MilestoneTableItem[];
  alerts: ContractOperationalAlert[];
  quickActions: ContractQuickAction[];
  detailedTabs: ContractDetailedTabs;
  projectSummary: ProjectSummaryCardData;
  workshopReleaseGating: WorkshopReleaseGating;
  scheduledAmount?: number;
  scheduledAmountFormatted?: string;
  scheduleVariance?: number;
  scheduleVarianceFormatted?: string;
  netCollected?: number;
  outstandingAmount?: number;
  referenceBOQValue?: number;
  referenceBOQValueFormatted?: string;
}

