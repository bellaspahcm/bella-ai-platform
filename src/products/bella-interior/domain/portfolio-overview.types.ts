/**
 * Bella Interior OS — Portfolio Overview & Management Suite Contracts
 *
 * Source of truth for Project Management Suite (Danh mục Dự án Nội thất).
 * All metrics, KPIs, financial P&L summaries, progress breakdowns, and operational
 * alerts are calculated in the domain/server layer, never on the client UI.
 *
 * @module src/products/bella-interior/domain/portfolio-overview.types
 */

export type ProjectStage = 'design' | 'production' | 'installation' | 'handover';
export type ScheduleHealth = 'on_track' | 'ahead' | 'delayed';
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface PortfolioKPIItem {
  readonly value: number | string;
  readonly trend: string;
  readonly isPositiveTrend: boolean;
  readonly label: string;
}

export interface PortfolioKPIs {
  readonly totalProjects: PortfolioKPIItem;
  readonly inProgress: PortfolioKPIItem;
  readonly delayedRisk: PortfolioKPIItem;
  readonly averageGrossMargin: PortfolioKPIItem;
}

export interface PortfolioProjectItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly customerName: string;
  readonly customerSegment: string;
  readonly leadArchitect: string;
  readonly leadArchitectAvatar: string;
  readonly stage: ProjectStage;
  readonly stageLabel: string;
  readonly stageBadgeClass: string;
  readonly progressPercent: number;
  readonly scheduleStatus: ScheduleHealth;
  readonly scheduleStatusLabel: string;
  readonly scheduleStatusClass: string;
  readonly deadlineDate: string;
  readonly daysRemaining: number;
  readonly daysRemainingLabel: string;
  readonly isDeadlineUrgent: boolean;
  readonly daysRemainingClass: string;
  readonly contractValue: number;
  readonly contractValueFormatted: string;
  readonly grossMarginPercent: number;
  readonly grossMarginFormatted: string;
  readonly nextAction: string;
  readonly imageUrl: string;
}

export interface ProgressOverviewSummary {
  readonly overallProgressPercent: number;
  readonly onTrackPercent: number;
  readonly delayedPercent: number;
  readonly completedPercent: number;
  readonly specialAttentionCount: number;
  readonly specialAttentionNote: string;
}

export interface FinancialOverviewSummary {
  readonly period: string;
  readonly totalContractValue: number;
  readonly totalContractFormatted: string;
  readonly contractGrowthPercent: number;
  readonly collectedAmount: number;
  readonly collectedFormatted: string;
  readonly collectedGrowthPercent: number;
  readonly receivableAmount: number;
  readonly receivableFormatted: string;
  readonly actualProfit: number;
  readonly actualProfitFormatted: string;
  readonly profitGrowthPercent: number;
  readonly averageMarginPercent: number;
  readonly averageMarginFormatted: string;
  readonly averageMarginNote: string;
  readonly costDataReliable?: boolean;
}

export interface CommercialAnalyticsSummary {
  readonly quotationCount: number;
  readonly acceptedQuotationCount: number;
  readonly quotationConversionRate: number;
  readonly totalQuotationValue: number;
  readonly totalContractValue: number;
  readonly collectedAmount: number;
  readonly receivableAmount: number;
  readonly collectionRate: number;
}

export interface DeliveryQualityAnalyticsSummary {
  readonly totalPunchListItems: number;
  readonly openPunchListItems: number;
  readonly criticalErrorsCount: number;
  readonly siteDiaryEntriesCount: number;
  readonly handoverDossiersCount: number;
  readonly clientAcceptedHandoversCount: number;
  readonly qualityPassRate: number;
}

export interface WarrantyAnalyticsSummary {
  readonly activeCertificatesCount: number;
  readonly totalTicketsCount: number;
  readonly openTicketsCount: number;
  readonly resolvedTicketsCount: number;
  readonly resolutionRate: number;
}

export interface ActionAlertItem {
  readonly id: string;
  readonly type: AlertSeverity;
  readonly title: string;
  readonly timeAgo: string;
  readonly relatedProjectId?: string;
  readonly actionUrl?: string;
}

export type BusinessChainPeriodKey = 'this_month' | 'last_month' | 'this_quarter' | 'all';

export interface BusinessChainStageItem {
  readonly key: 'design' | 'commercial' | 'production' | 'handover';
  readonly label: string;
  readonly percent: number;
}

export interface BusinessChainPeriodData {
  readonly periodKey: BusinessChainPeriodKey;
  readonly periodLabel: string;
  readonly stages: BusinessChainStageItem[];
  readonly overallPercent: number;
  readonly statusLabel: string;
}

export interface BusinessChainProgressOverview {
  readonly defaultPeriod: BusinessChainPeriodKey;
  readonly periods: Record<BusinessChainPeriodKey, BusinessChainPeriodData>;
}

export interface PortfolioOverviewResponse {
  readonly kpis: PortfolioKPIs;
  readonly projects: PortfolioProjectItem[];
  readonly progressOverview: ProgressOverviewSummary;
  readonly financialSummary: FinancialOverviewSummary;
  readonly actionAlerts: ActionAlertItem[];
  readonly businessChainProgress?: BusinessChainProgressOverview;
  readonly commercialAnalytics?: CommercialAnalyticsSummary;
  readonly deliveryQualityAnalytics?: DeliveryQualityAnalyticsSummary;
  readonly warrantyAnalytics?: WarrantyAnalyticsSummary;
}
