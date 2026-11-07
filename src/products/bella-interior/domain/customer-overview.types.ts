/**
 * Bella Interior OS — Customer & CRM Portfolio Overview Contracts
 *
 * Source of truth for Customer & Investor Management Suite (Khách hàng & Chủ đầu tư).
 * All metrics, KPIs, sales funnel conversions, financial metrics, debt summaries,
 * and operational CRM alerts are calculated in the domain/server layer, never on the client UI.
 *
 * @module src/products/bella-interior/domain/customer-overview.types
 */

export type CustomerType = 'enterprise' | 'individual' | 'organization';
export type CustomerSource = 'referral' | 'marketing' | 'partner' | 'returning' | 'website';
export type CustomerStatus = 'transacting' | 'lead' | 'negotiating' | 're_engagement' | 'vip';
export type CRMAlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface CustomerKPIItem {
  readonly value: number | string;
  readonly label: string;
  readonly trend: string;
  readonly isPositiveTrend: boolean;
}

export interface CustomerKPIs {
  readonly totalCustomers: CustomerKPIItem;
  readonly potentialCustomers: CustomerKPIItem;
  readonly activeTransacting: CustomerKPIItem;
  readonly vipCustomers: CustomerKPIItem;
}

export interface SalesFunnelStep {
  readonly stepNumber: number;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export interface SalesFunnelSummary {
  readonly steps: readonly SalesFunnelStep[];
  readonly conversionRatePercent: number;
  readonly conversionRateTrend: string;
  readonly isConversionPositive: boolean;
  readonly targetAchievementLabel: string;
  readonly targetAchievementSub: string;
}

export interface CustomerMonthlyGrowthPoint {
  readonly month: string; // 'T1', 'T2', ..., 'T12'
  readonly customerCount: number;
  readonly revenueBillion: number;
}

export interface CustomerGrowthChartData {
  readonly timeRangeLabel: string;
  readonly dataPoints: readonly CustomerMonthlyGrowthPoint[];
}

export interface CustomerItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly avatar: string;
  readonly type: CustomerType;
  readonly typeLabel: string;
  readonly typeBadgeClass: string;
  readonly source: CustomerSource;
  readonly sourceLabel: string;
  readonly sourceClass: string;
  readonly managerName: string;
  readonly managerAvatar: string;
  readonly opportunityCount: number;
  readonly projectCount: number;
  readonly totalValue: number;
  readonly totalValueFormatted: string;
  readonly debt: number;
  readonly debtFormatted: string;
  readonly hasDebt: boolean;
  readonly lastInteractionDate: string;
  readonly status: CustomerStatus;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
}

export interface CustomerAlertItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly date: string;
  readonly severity: CRMAlertSeverity;
}

export interface CustomerFinancialSummary {
  readonly totalContractValue: number;
  readonly totalContractValueFormatted: string;
  readonly collected: number;
  readonly collectedFormatted: string;
  readonly receivableDebt: number;
  readonly receivableDebtFormatted: string;
  readonly collectionRatePercent: number;
}

export interface CustomerSourceDistributionItem {
  readonly source: CustomerSource;
  readonly label: string;
  readonly percentage: number;
  readonly color: string;
}

export interface ActionSuggestion {
  readonly title: string;
  readonly description: string;
  readonly ctaLabel: string;
  readonly ctaLink: string;
}

export interface CustomerOverviewResponse {
  readonly success: boolean;
  readonly tenantId: string;
  readonly kpis: CustomerKPIs;
  readonly salesFunnel: SalesFunnelSummary;
  readonly growthChart: CustomerGrowthChartData;
  readonly customers: readonly CustomerItem[];
  readonly alerts: readonly CustomerAlertItem[];
  readonly financialSummary: CustomerFinancialSummary;
  readonly sourceDistribution: readonly CustomerSourceDistributionItem[];
  readonly actionSuggestion: ActionSuggestion;
}
