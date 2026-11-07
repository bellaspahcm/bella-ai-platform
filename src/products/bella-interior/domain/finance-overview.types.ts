/**
 * Bella Interior OS — Project Finance & P&L Domain Types (Phase 1 — Financial Truth)
 *
 * Single Source of Truth for Project Financial Analysis:
 * 1. Distinction between Contract Value, Recognized Revenue, and Cash Collected.
 * 2. Distinction between Estimated (Budget) Cost, Actual Cost, and Cost Variance.
 * 3. Project P&L Breakdown with completion progress, forecast margin, and risk alerts.
 * 4. Traceable Source Transactions (Contracts, Work Orders, POs, Site Packages).
 * 5. Time consistency: Actual (Months 7-11) vs Forecast (Month 12).
 * 6. Quarter Baseline Proof for comparative growth KPIs.
 *
 * @module src/products/bella-interior/domain/finance-overview.types
 */

export interface FinanceUserHeader {
  name: string;
  role: string;
  avatarUrl: string;
  notificationsCount: number;
}

export interface FinanceKPIItem {
  rawValue: number;
  formattedValue: string;
  label: string;
  subtext: string;
  subtextVariant: 'positive' | 'negative' | 'neutral';
  iconName: 'folder-kanban' | 'layers' | 'trending-up' | 'percent';
  iconBgColor: string;
  iconColor: string;
  /** Secondary breakdown explaining financial truth behind the metric */
  truthNote?: string;
}

export interface FinanceOverviewKPIs {
  contractRevenue: FinanceKPIItem;
  totalCogs: FinanceKPIItem;
  grossProfit: FinanceKPIItem;
  grossMargin: FinanceKPIItem;
}

export interface RevenueTruthMetrics {
  contractValue: number;
  contractValueFormatted: string;
  recognizedRevenue: number;
  recognizedRevenueFormatted: string;
  cashCollected: number;
  cashCollectedFormatted: string;
  unearnedRevenue: number;
  unearnedRevenueFormatted: string;
  recognitionRatio: number;
  recognitionRatioFormatted: string;
}

export interface CogsTruthMetrics {
  estimatedCogs: number;
  estimatedCogsFormatted: string;
  actualCogs: number;
  actualCogsFormatted: string;
  varianceAmount: number;
  varianceAmountFormatted: string;
  variancePercent: number;
  variancePercentFormatted: string;
  isOverBudget: boolean;
  committedCost: number;
  committedCostFormatted: string;
  remainingForecastCost: number;
  remainingForecastCostFormatted: string;
}

export interface FinancialPerformanceBar {
  month: string;
  revenue: number;
  revenueFormatted: string;
  revenueHeightPercent: number;
  cost: number;
  costFormatted: string;
  costHeightPercent: number;
  profit: number;
  profitFormatted: string;
  profitHeightPercent: number;
  isForecast?: boolean;
}

export interface FinancialPerformanceSection {
  selectedPeriod: '3_months' | '6_months' | '1_year';
  availablePeriods: Array<{ key: '3_months' | '6_months' | '1_year'; label: string }>;
  yAxisLabels: string[];
  bars: FinancialPerformanceBar[];
  legend: Array<{ label: string; color: string }>;
  timeHorizonNote: string;
}

export interface CogsStructureItem {
  id: string;
  label: string;
  percentage: number;
  percentageFormatted: string;
  amount: number;
  amountFormatted: string;
  color: string;
  dashArray: string;
  dashOffset: string;
  categoryType: 'DIRECT_MATERIAL' | 'DIRECT_LABOR' | 'SUBCONTRACTOR' | 'LOGISTICS_INSTALL';
}

export interface CogsStructureSection {
  totalCogsFormatted: string;
  centerSublabel: string;
  items: CogsStructureItem[];
  reconciliationSummary: string;
}

export interface ProjectPLItem {
  id: string;
  projectName: string;
  clientName: string;
  contractRevenue: number;
  contractRevenueFormatted: string;
  cogs: number;
  cogsFormatted: string;
  grossProfit: number;
  grossProfitFormatted: string;
  marginPercent: number;
  marginFormatted: string;
  marginBadgeVariant: 'high' | 'medium' | 'low';
  marginBadgeClass: string;
  cashCollected: number;
  cashCollectedFormatted: string;
  outstandingDebt: number;
  outstandingDebtFormatted: string;
  hasOutstandingDebt: boolean;
  debtColorClass: string;

  // ─── Phase 1: Financial Truth & Project Anomaly Detection ───
  completionPercent: number;
  completionFormatted: string;
  recognizedRevenue: number;
  recognizedRevenueFormatted: string;
  budgetCost: number;
  budgetCostFormatted: string;
  costVariance: number;
  costVarianceFormatted: string;
  isOverBudget: boolean;
  forecastFinalMargin: number;
  forecastFinalMarginFormatted: string;
  riskAlert?: {
    label: string;
    severity: 'normal' | 'warning' | 'danger';
  };
}

export interface ProjectPLBreakdownSection {
  title: string;
  detailUrl: string;
  headers: string[];
  projects: ProjectPLItem[];
}

export interface CashFlowPoint {
  month: string;
  collected: number;
  collectedFormatted: string;
  cost: number;
  costFormatted: string;
  xPercent: number;
  collectedYPercent: number;
  costYPercent: number;
  isForecast?: boolean;
}

export interface CashFlowSection {
  title: string;
  selectedRange: string;
  availableRanges: string[];
  yAxisLabels: string[];
  points: CashFlowPoint[];
  collectedSvgPath: string;
  costSvgPath: string;
  legend: Array<{ label: string; color: string }>;
  actualVsForecastNote: string;
}

export interface DebtAgeingCategory {
  id: string;
  label: string;
  amount: number;
  amountFormatted: string;
  percentage: number;
  color: string;
  dashArray: string;
  dashOffset: string;
}

export interface DebtOverviewSection {
  title: string;
  centerValue: string;
  centerUnit: string;
  centerLabel: string;
  categories: DebtAgeingCategory[];
  alertNotice: {
    message: string;
    severity: 'danger' | 'warning' | 'info';
  };
}

export interface RecentTransactionItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  amountFormatted: string;
  type: 'inflow' | 'outflow';
  amountColorClass: string;
  badgeLabel: string;
  badgeClass: string;

  // ─── Phase 1: Traceable Source References ───
  sourceType: 'PAYMENT_SCHEDULE' | 'PURCHASE_ORDER' | 'WORK_ORDER' | 'SITE_PACKAGE';
  sourceRef: string;
}

export interface RecentTransactionsSection {
  title: string;
  viewAllUrl: string;
  transactions: RecentTransactionItem[];
}

export interface QuickInsightItem {
  id: string;
  text: string;
  highlightText?: string;
}

export interface QuickInsightsSection {
  title: string;
  insights: QuickInsightItem[];
  actionLabel: string;
  actionUrl: string;
}

export interface FinanceFooterBanner {
  title: string;
  subtitle: string;
  bgImageUrl: string;
}

export interface QuarterBaselineProof {
  previousQuarter: string;
  previousRevenue: number;
  previousCogs: number;
  previousProfit: number;
  previousMargin: number;
  revenueGrowthRate: number;
  cogsGrowthRate: number;
  profitGrowthRate: number;
  marginDiff: number;
}

export interface FinanceOverviewResponse {
  quarter: string;
  availableQuarters: string[];
  user: FinanceUserHeader;
  kpis: FinanceOverviewKPIs;
  financialPerformance: FinancialPerformanceSection;
  cogsStructure: CogsStructureSection;
  projectPLBreakdown: ProjectPLBreakdownSection;
  cashFlow: CashFlowSection;
  debtOverview: DebtOverviewSection;
  recentTransactions: RecentTransactionsSection;
  quickInsights: QuickInsightsSection;
  footerBanner: FinanceFooterBanner;

  // ─── Phase 1 Governance Additions ───
  revenueTruth: RevenueTruthMetrics;
  cogsTruth: CogsTruthMetrics;
  quarterBaseline: QuarterBaselineProof;
}
