/**
 * Bella Interior OS — Project Finance & P&L Domain Types
 *
 * Single Source of Truth for Project Financial Analysis, Revenue Recognition,
 * COGS Breakdown, Cash Flow Trajectory, Debt Ageing, and Real-time Executive Insights.
 * UI components consume these canonical models without local calculation.
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
}

export interface FinanceOverviewKPIs {
  contractRevenue: FinanceKPIItem;
  totalCogs: FinanceKPIItem;
  grossProfit: FinanceKPIItem;
  grossMargin: FinanceKPIItem;
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
}

export interface FinancialPerformanceSection {
  selectedPeriod: '3_months' | '6_months' | '1_year';
  availablePeriods: Array<{ key: '3_months' | '6_months' | '1_year'; label: string }>;
  yAxisLabels: string[];
  bars: FinancialPerformanceBar[];
  legend: Array<{ label: string; color: string }>;
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
}

export interface CogsStructureSection {
  totalCogsFormatted: string;
  centerSublabel: string;
  items: CogsStructureItem[];
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
}
