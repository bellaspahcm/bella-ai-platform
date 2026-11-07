/**
 * BELLA INTERIOR OS — REPORTS & BUSINESS ANALYTICS CANONICAL TYPES
 * 
 * Strict Zero UI Calculation contract. All metrics, chart coordinates, bar heights,
 * donut percentages, status badges, and management alerts are pre-computed server-side.
 */

export interface ReportKpiCard {
  rawValue: number | string;
  formattedValue: string;
  label: string;
  subLabel: string;
  subLabelClass: string;
  iconName: string;
  iconClass: string;
  iconBgClass: string;
  sparklineType?: 'bars' | 'wave' | 'donut' | 'shield';
  percentage?: number;
}

export interface ReportKpis {
  contractValue: ReportKpiCard;
  grossMargin: ReportKpiCard;
  onTimeRate: ReportKpiCard;
  punchListErrors: ReportKpiCard;
}

export interface TrendMonthData {
  monthKey: string;
  monthLabel: string; // e.g. "Tháng 5"
  revenueBillion: number; // e.g. 6.2
  revenueFormatted: string; // "6.2B"
  grossProfitBillion: number; // e.g. 2.3
  grossProfitFormatted: string; // "2.3B"
  marginPercentage: number; // e.g. 37.5
  marginFormatted: string; // "37.5%"
  revenueBarHeightPercent: number; // Pre-calculated relative to max 10B
  profitBarHeightPercent: number; // Pre-calculated relative to max 10B
  marginLineTopPercent: number; // Pre-calculated relative to Y axis
}

export interface BusinessPerformanceTrends {
  title: string;
  yAxisLabels: string[]; // ["10B", "8B", "6B", "4B", "2B", "0"]
  months: TrendMonthData[];
  trendlineSvgPoints: string; // Pre-computed SVG polyline points (e.g. "X,Y ...")
}

export interface CostStructureItem {
  id: string;
  label: string; // "Vật tư", "Nhân công", "Chi phí khác"
  percentage: number; // 40.4, 33.2, 26.4
  percentageFormatted: string; // "40.4%"
  amountBillion: number; // e.g. 3.41
  amountFormatted: string; // "3.41 tỷ"
  color: string; // "#3B82F6", "#10B981", "#F59E0B"
  dotClass: string;
}

export interface CostStructure {
  title: string;
  totalCostFormatted: string; // "8.43 tỷ đ"
  totalCostSublabel: string; // "Tổng chi phí"
  items: CostStructureItem[];
  donutSegments: Array<{
    strokeDasharray: string;
    strokeDashoffset: number;
    color: string;
  }>;
}

export interface ProjectPerformanceRow {
  id: string;
  name: string; // "Villa Ciputra Giai Đoạn 2"
  thumbnailUrl: string;
  contractValueFormatted: string; // "2.45 tỷ đ"
  materialCostFormatted: string; // "980 triệu đ"
  laborCostFormatted: string; // "450 triệu đ"
  collectedFormatted: string; // "1.80 tỷ đ"
  grossMarginFormatted: string; // "41.5%"
  status: 'on_schedule' | 'delayed' | 'warning';
  statusLabel: string; // "Đúng tiến độ"
  statusBadgeClass: string;
  statusDotClass: string;
}

export interface ManagementAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  message: string;
  badgeLabel: string; // "Cần lưu ý", "Theo dõi", "Kiểm tra"
  badgeClass: string;
  iconName: string;
  iconClass: string;
  iconBgClass: string;
}

export interface LifecycleStep {
  stepNumber: number;
  title: string;
  iconName: string;
  status: 'completed' | 'active' | 'upcoming';
  statusClass: string;
  iconClass: string;
}

export interface ReportsOverviewResponse {
  project: {
    id: string;
    code: string;
    name: string;
    thumbnailUrl: string;
  };
  availableProjects: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  filterOptions: {
    timePeriod: string; // "Tháng 10/2026"
    availablePeriods: string[];
    projectFilter: string; // "Tất cả dự án"
    availableProjectFilters: string[];
  };
  kpis: ReportKpis;
  trends: BusinessPerformanceTrends;
  costStructure: CostStructure;
  projectPerformance: ProjectPerformanceRow[];
  managementAlerts: ManagementAlert[];
  lifecycleSteps: LifecycleStep[];
}

