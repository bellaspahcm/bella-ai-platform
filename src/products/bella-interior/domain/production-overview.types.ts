/**
 * Bella Interior OS — Canonical Production & Workshop Analytics Types
 *
 * Single Source of Truth for Platform Manufacturing coordination,
 * 7-stage cabinetry workshop pipeline, and production capacity analytics.
 * Enforces Zero UI Calculation: All values, percentages, SVG coordinates,
 * badge styles, and labels are computed server-side in the Canonical Domain Service.
 *
 * @module src/products/bella-interior/domain/production-overview.types
 */

export interface ProductionProjectHeader {
  id: string;
  code: string;
  name: string;
  selectorLabel: string;
  clientName: string;
  status: string;
  statusLabel: string;
}

export interface ProductionArchitectureNotice {
  title: string;
  description: string;
  bridgeBadgeLabel: string;
  documentationUrl?: string;
}

export interface ProductionKpiItem {
  rawValue: number;
  formattedValue: string;
  label: string;
  trendLabel: string;
  trendDirection: 'up' | 'down';
  trendColorClass: string;
  iconName: string;
  iconClass: string;
  bgClass: string;
  sparklineSvgPath: string;
}

export interface ProductionKpis {
  totalOrders: ProductionKpiItem;
  inProductionOrders: ProductionKpiItem;
  completedOrders: ProductionKpiItem;
  needsAttentionOrders: ProductionKpiItem;
}

export interface ProductionWorkflowStage {
  stageNumber: number;
  key: string;
  label: string;
  status: 'completed' | 'in_progress' | 'pending';
  statusBadge?: string;
  iconName: string;
  iconBgClass: string;
  iconColorClass: string;
  borderClass: string;
}

export interface StageEfficiencyItem {
  stageName: string;
  percentage: number;
  percentageFormatted: string;
  barColor: string;
}

export interface ProductionEfficiencyMetrics {
  title: string;
  overallRate: number;
  overallRateFormatted: string;
  overallRateLabel: string;
  trendLabel: string;
  trendColorClass: string;
  donutDashArray: string;
  donutDashOffset: string;
  stages: StageEfficiencyItem[];
}

export interface ProductionTimelinePoint {
  dayLabel: string;
  plannedPercent: number;
  actualPercent: number;
  plannedPercentFormatted: string;
  actualPercentFormatted: string;
  xCoord: number;
  yPlannedCoord: number;
  yActualCoord: number;
}

export interface ProductionTimelineChart {
  title: string;
  range: string;
  availableRanges: string[];
  yAxisLabels: string[];
  legendPlanned: string;
  legendActual: string;
  points: ProductionTimelinePoint[];
  plannedSvgPath: string;
  actualSvgPath: string;
}

export type ProductionOrderStatus = 'in_production' | 'delayed' | 'warning' | 'on_schedule';

export interface ProductionOrderTableRow {
  id: string;
  project: string;
  roomCategory: string;
  currentStageName: string;
  progressPercent: number;
  progressFormatted: string;
  progressBarColor: string;
  deadlineFormatted: string;
  status: ProductionOrderStatus;
  statusLabel: string;
  statusBadgeClass: string;
  actionMenuOptions: string[];
}

export interface ProductionFilterTab {
  id: string;
  label: string;
  count: number;
  active: boolean;
}

export interface ProductionAlertItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  message: string;
  timeFormatted: string;
  iconType: 'circle-alert' | 'triangle-alert' | 'info';
  iconClass: string;
}

export interface WorkshopCapacityItem {
  workshopName: string;
  capacityPercent: number;
  capacityFormatted: string;
  barColor: string;
  heightPercent: number;
}

export interface ProductionOverviewResponse {
  projectHeader: ProductionProjectHeader;
  availableProjects: Array<{ id: string; label: string; code: string }>;
  architectureNotice: ProductionArchitectureNotice;
  kpis: ProductionKpis;
  workflowStages: ProductionWorkflowStage[];
  efficiencyMetrics: ProductionEfficiencyMetrics;
  timelineChart: ProductionTimelineChart;
  ordersTable: {
    title: string;
    searchPlaceholder: string;
    filterLabel: string;
    tabs: ProductionFilterTab[];
    headers: string[];
    rows: ProductionOrderTableRow[];
  };
  alerts: {
    title: string;
    viewAllLabel: string;
    items: ProductionAlertItem[];
  };
  workshopCapacities: {
    title: string;
    detailLabel: string;
    yAxisLabels: string[];
    workshops: WorkshopCapacityItem[];
  };
}

