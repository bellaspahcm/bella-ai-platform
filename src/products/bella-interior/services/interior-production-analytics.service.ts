/**
 * Bella Interior OS — Canonical Production & Workshop Analytics Service
 *
 * Source of Truth for Platform Manufacturing coordination:
 * - 7-stage cabinetry workshop pipeline tracking
 * - Production KPIs (total/in-production/completed/needs-attention)
 * - Efficiency donut chart (pre-computed SVG dash-array/offset)
 * - Timeline line chart (pre-computed SVG polyline paths)
 * - Production orders table with pre-computed badges & progress bars
 * - Alerts & notifications
 * - Workshop capacity bar charts
 *
 * Enforces Zero UI Calculation — all math, formatting, SVG coordinates,
 * and class names are pre-computed here. The UI is pure render.
 *
 * @module src/products/bella-interior/services/interior-production-analytics.service
 */

import type {
  ProductionOverviewResponse,
  ProductionKpiItem,
  ProductionWorkflowStage,
  ProductionEfficiencyMetrics,
  StageEfficiencyItem,
  ProductionTimelineChart,
  ProductionTimelinePoint,
  ProductionOrderTableRow,
  ProductionFilterTab,
  ProductionAlertItem,
  WorkshopCapacityItem,
  ProductionProjectHeader,
  ProductionArchitectureNotice,
} from '../domain/production-overview.types';

export class InteriorProductionAnalyticsService {
  // ─── SVG Chart Constants ────────────────────────────────────────────────
  private static readonly CHART_WIDTH = 320;
  private static readonly CHART_HEIGHT = 100;
  private static readonly CHART_PAD_X = 20;
  private static readonly CHART_PAD_Y = 10;

  // ─── Donut Constants ────────────────────────────────────────────────────
  private static readonly DONUT_RADIUS = 52;
  private static readonly DONUT_CIRCUMFERENCE = 2 * Math.PI * InteriorProductionAnalyticsService.DONUT_RADIUS; // ≈ 326.73

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Pre-compute sparkline SVG path for a simple upward curve (8 points). */
  private static buildSparkline(values: number[]): string {
    const w = 80;
    const h = 28;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  }

  /** Pre-compute donut dash-array and dash-offset for a percentage fill. */
  private static buildDonut(percent: number): { dashArray: string; dashOffset: string } {
    const filled = (percent / 100) * InteriorProductionAnalyticsService.DONUT_CIRCUMFERENCE;
    const empty = InteriorProductionAnalyticsService.DONUT_CIRCUMFERENCE - filled;
    // Start from top (−90°): offset = circumference * (1 - 0.25) = circumference * 0.75
    const offset = (InteriorProductionAnalyticsService.DONUT_CIRCUMFERENCE * 0.75).toFixed(2);
    return {
      dashArray: `${filled.toFixed(2)} ${empty.toFixed(2)}`,
      dashOffset: offset,
    };
  }

  /** Build an SVG polyline path from (x, y) percentage pairs. */
  private static buildPolylinePath(points: Array<{ x: number; y: number }>): string {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  /** Map a percentage value to a Y coordinate within the chart area. */
  private static percentToY(percent: number, chartH: number, padY: number): number {
    // 0% → bottom, 100% → top
    return padY + ((100 - percent) / 100) * (chartH - 2 * padY);
  }

  /** Map a point index to an X coordinate within the chart area. */
  private static indexToX(index: number, total: number, chartW: number, padX: number): number {
    return padX + (index / (total - 1)) * (chartW - 2 * padX);
  }

  // ─── Project Header ─────────────────────────────────────────────────────

  public static getProjectHeader(): ProductionProjectHeader {
    return {
      id: 'NT-2024-001',
      code: 'NT-2024-001',
      name: 'Villa Sunrise Renovation',
      selectorLabel: 'Villa Sunrise Renovation (NT-2024-001)',
      clientName: 'Nguyễn Thị Mai',
      status: 'in_production',
      statusLabel: 'Đang sản xuất',
    };
  }

  // ─── Architecture Notice ─────────────────────────────────────────────────

  public static getArchitectureNotice(): ProductionArchitectureNotice {
    return {
      title: 'Ủy Quyền Sản Xuất Qua Platform Manufacturing Adapter (Không Duplicate Engine)',
      description:
        'Hệ thống áp dụng đúng mình giới kiến trúc đã xác lập. Interior OS đóng vai trò Client-Ủy quyền yêu cầu sản xuất tới Platform Manufacturing OS. Mọi lệnh sản xuất đang được buộc ràng bởi phiên bản với Approved Design Lock.',
      bridgeBadgeLabel: 'Manufacturing Bridge',
    };
  }

  // ─── KPIs ────────────────────────────────────────────────────────────────

  private static buildKpiItem(
    rawValue: number,
    label: string,
    trendPercent: number,
    trendDirection: 'up' | 'down',
    iconName: string,
    iconClass: string,
    bgClass: string,
    sparklineValues: number[],
  ): ProductionKpiItem {
    const trendSign = trendDirection === 'up' ? '+' : '-';
    const trendColorClass =
      trendDirection === 'up'
        ? label === 'Cần xử lý'
          ? 'text-red-600'
          : 'text-emerald-600'
        : label === 'Cần xử lý'
          ? 'text-emerald-600'
          : 'text-red-600';

    return {
      rawValue,
      formattedValue: rawValue.toString(),
      label,
      trendLabel: `${trendSign}${Math.abs(trendPercent)}% so với kỳ trước`,
      trendDirection,
      trendColorClass,
      iconName,
      iconClass,
      bgClass,
      sparklineSvgPath: InteriorProductionAnalyticsService.buildSparkline(sparklineValues),
    };
  }

  public static getKpis() {
    return {
      totalOrders: InteriorProductionAnalyticsService.buildKpiItem(
        128,
        'Tổng lệnh sản xuất',
        12,
        'up',
        'list-checks',
        'text-blue-600',
        'bg-blue-50',
        [95, 102, 108, 110, 115, 120, 125, 128],
      ),
      inProductionOrders: InteriorProductionAnalyticsService.buildKpiItem(
        46,
        'Đang sản xuất',
        6,
        'up',
        'play-circle',
        'text-green-600',
        'bg-green-50',
        [35, 38, 40, 41, 43, 44, 45, 46],
      ),
      completedOrders: InteriorProductionAnalyticsService.buildKpiItem(
        68,
        'Hoàn thành',
        15,
        'up',
        'check-circle',
        'text-emerald-600',
        'bg-emerald-50',
        [48, 52, 55, 58, 61, 63, 65, 68],
      ),
      needsAttentionOrders: InteriorProductionAnalyticsService.buildKpiItem(
        14,
        'Cần xử lý',
        8,
        'down',
        'alert-triangle',
        'text-amber-600',
        'bg-amber-50',
        [20, 19, 18, 17, 16, 15, 15, 14],
      ),
    };
  }

  // ─── Workflow Stages ─────────────────────────────────────────────────────

  public static getWorkflowStages(): ProductionWorkflowStage[] {
    const stages: Array<{
      key: string;
      label: string;
      status: 'completed' | 'in_progress' | 'pending';
      badge?: string;
      icon: string;
    }> = [
      { key: 'design_lock', label: 'Khóa Thiết Kế', status: 'completed', icon: 'lock' },
      { key: 'cnc_cutting', label: 'Cắt Ván CNC', status: 'completed', icon: 'cpu' },
      { key: 'pur_edge', label: 'Dán Cạnh PUR', status: 'in_progress', badge: 'Đang thực hiện', icon: 'settings' },
      { key: 'frame_assembly', label: 'Lắp Ráp Khung', status: 'pending', icon: 'grid' },
      { key: 'qcs_workshop', label: 'KCS Xưởng', status: 'pending', icon: 'clipboard-check' },
      { key: 'pe_packaging', label: 'Đóng Gói PE', status: 'pending', icon: 'package' },
      { key: 'dispatch', label: 'Xuất Xưởng', status: 'pending', icon: 'truck' },
    ];

    return stages.map((s, i) => ({
      stageNumber: i + 1,
      key: s.key,
      label: s.label,
      status: s.status,
      statusBadge: s.badge,
      iconName: s.icon,
      iconBgClass:
        s.status === 'completed'
          ? 'bg-emerald-500'
          : s.status === 'in_progress'
            ? 'bg-green-600'
            : 'bg-slate-200',
      iconColorClass:
        s.status === 'completed' || s.status === 'in_progress' ? 'text-white' : 'text-slate-400',
      borderClass:
        s.status === 'completed'
          ? 'border-emerald-400'
          : s.status === 'in_progress'
            ? 'border-green-600 ring-2 ring-green-200'
            : 'border-slate-200',
    }));
  }

  // ─── Efficiency Metrics (Donut) ───────────────────────────────────────────

  public static getEfficiencyMetrics(): ProductionEfficiencyMetrics {
    const overall = 82;
    const donut = InteriorProductionAnalyticsService.buildDonut(overall);

    const stageData: Array<{ name: string; pct: number; color: string }> = [
      { name: 'Cắt ván CNC', pct: 90, color: '#2D7A4F' },
      { name: 'Dán cạnh PUR', pct: 75, color: '#059669' },
      { name: 'Lắp ráp khung', pct: 62, color: '#d97706' },
      { name: 'KCS xưởng', pct: 85, color: '#10b981' },
    ];

    const stages: StageEfficiencyItem[] = stageData.map((s) => ({
      stageName: s.name,
      percentage: s.pct,
      percentageFormatted: `${s.pct}%`,
      barColor: s.color,
    }));

    return {
      title: 'Hiệu suất sản xuất',
      overallRate: overall,
      overallRateFormatted: `${overall}%`,
      overallRateLabel: 'Tổng hiệu suất',
      trendLabel: '+5%',
      trendColorClass: 'text-emerald-600',
      donutDashArray: donut.dashArray,
      donutDashOffset: donut.dashOffset,
      stages,
    };
  }

  // ─── Timeline Chart ───────────────────────────────────────────────────────

  public static getTimelineChart(): ProductionTimelineChart {
    const W = InteriorProductionAnalyticsService.CHART_WIDTH;
    const H = InteriorProductionAnalyticsService.CHART_HEIGHT;
    const PAD_X = InteriorProductionAnalyticsService.CHART_PAD_X;
    const PAD_Y = InteriorProductionAnalyticsService.CHART_PAD_Y;

    const dayData: Array<{ day: string; planned: number; actual: number }> = [
      { day: 'T2', planned: 40, actual: 35 },
      { day: 'T3', planned: 50, actual: 45 },
      { day: 'T4', planned: 60, actual: 58 },
      { day: 'T5', planned: 68, actual: 65 },
      { day: 'T6', planned: 75, actual: 72 },
      { day: 'T7', planned: 83, actual: 82 },
      { day: 'CN', planned: 90, actual: 95 },
    ];

    const total = dayData.length;

    const points: ProductionTimelinePoint[] = dayData.map((d, i) => {
      const x = InteriorProductionAnalyticsService.indexToX(i, total, W, PAD_X);
      const yPlanned = InteriorProductionAnalyticsService.percentToY(d.planned, H, PAD_Y);
      const yActual = InteriorProductionAnalyticsService.percentToY(d.actual, H, PAD_Y);
      return {
        dayLabel: d.day,
        plannedPercent: d.planned,
        actualPercent: d.actual,
        plannedPercentFormatted: `${d.planned}%`,
        actualPercentFormatted: `${d.actual}%`,
        xCoord: parseFloat(x.toFixed(1)),
        yPlannedCoord: parseFloat(yPlanned.toFixed(1)),
        yActualCoord: parseFloat(yActual.toFixed(1)),
      };
    });

    const plannedPath = InteriorProductionAnalyticsService.buildPolylinePath(
      points.map((p) => ({ x: p.xCoord, y: p.yPlannedCoord })),
    );
    const actualPath = InteriorProductionAnalyticsService.buildPolylinePath(
      points.map((p) => ({ x: p.xCoord, y: p.yActualCoord })),
    );

    return {
      title: 'Tiến độ sản xuất theo thời gian',
      range: '7 ngày',
      availableRanges: ['7 ngày', '14 ngày', '30 ngày'],
      yAxisLabels: ['100%', '75%', '50%', '25%', '0%'],
      legendPlanned: 'Kế hoạch',
      legendActual: 'Thực tế',
      points,
      plannedSvgPath: plannedPath,
      actualSvgPath: actualPath,
    };
  }

  // ─── Orders Table ─────────────────────────────────────────────────────────

  private static buildOrderRow(
    id: string,
    project: string,
    room: string,
    stage: string,
    progress: number,
    deadline: string,
    status: 'in_production' | 'delayed' | 'warning' | 'on_schedule',
  ): ProductionOrderTableRow {
    const statusConfig: Record<
      string,
      { label: string; badgeClass: string; barColor: string }
    > = {
      in_production: {
        label: 'Đang SX',
        badgeClass: 'bg-green-100 text-green-700',
        barColor: '#2D7A4F',
      },
      delayed: {
        label: 'Trễ hạn',
        badgeClass: 'bg-red-100 text-red-700',
        barColor: '#ef4444',
      },
      warning: {
        label: 'Cảnh báo',
        badgeClass: 'bg-amber-100 text-amber-700',
        barColor: '#f59e0b',
      },
      on_schedule: {
        label: 'Đúng hạn',
        badgeClass: 'bg-blue-100 text-blue-700',
        barColor: '#10b981',
      },
    };
    const cfg = statusConfig[status];
    return {
      id,
      project,
      roomCategory: room,
      currentStageName: stage,
      progressPercent: progress,
      progressFormatted: `${progress}%`,
      progressBarColor: cfg.barColor,
      deadlineFormatted: deadline,
      status,
      statusLabel: cfg.label,
      statusBadgeClass: cfg.badgeClass,
      actionMenuOptions: ['Xem chi tiết', 'Cập nhật tiến độ', 'Xuất báo cáo'],
    };
  }

  public static getOrdersTable() {
    const rows: ProductionOrderTableRow[] = [
      InteriorProductionAnalyticsService.buildOrderRow(
        'SX-2024-1087', 'Villa Sunrise', 'Phòng khách', 'Dán cạnh PUR', 65, '15/11/2024', 'in_production',
      ),
      InteriorProductionAnalyticsService.buildOrderRow(
        'SX-2024-1086', 'Sky Garden', 'Phòng ngủ', 'Lắp ráp khung', 40, '14/11/2024', 'delayed',
      ),
      InteriorProductionAnalyticsService.buildOrderRow(
        'SX-2024-1085', 'Ocean View', 'Bếp', 'KCS xưởng', 80, '13/11/2024', 'warning',
      ),
      InteriorProductionAnalyticsService.buildOrderRow(
        'SX-2024-1084', 'Green Park', 'Phòng ăn', 'Đóng gói PE', 90, '12/11/2024', 'on_schedule',
      ),
      InteriorProductionAnalyticsService.buildOrderRow(
        'SX-2024-1083', 'Garden House', 'Phòng khách', 'Cắt ván CNC', 30, '12/11/2024', 'in_production',
      ),
    ];

    const tabs: ProductionFilterTab[] = [
      { id: 'all', label: 'Tất cả', count: 128, active: true },
      { id: 'in_production', label: 'Đang sản xuất', count: 46, active: false },
      { id: 'delayed', label: 'Chậm tiến độ', count: 14, active: false },
      { id: 'completed', label: 'Hoàn thành', count: 68, active: false },
    ];

    return {
      title: 'Danh sách lệnh sản xuất',
      searchPlaceholder: 'Tìm kiếm mã lệnh, dự án...',
      filterLabel: 'Bộ lọc',
      tabs,
      headers: ['Mã lệnh SX', 'Dự án', 'Hạng mục', 'Công đoạn hiện tại', 'Tiến độ', 'Hạn hoàn thành', 'Trạng thái', 'Thao tác'],
      rows,
    };
  }

  // ─── Alerts ──────────────────────────────────────────────────────────────

  public static getAlerts() {
    const items: ProductionAlertItem[] = [
      {
        id: 'alert-1',
        severity: 'danger',
        message: 'Lệnh SX-2024-1086 trễ tiến độ 1 ngày',
        timeFormatted: '09:30',
        iconType: 'circle-alert',
        iconClass: 'text-red-500',
      },
      {
        id: 'alert-2',
        severity: 'warning',
        message: 'Công đoạn Dán cạnh PUR có tỷ lệ lỗi tăng 5%',
        timeFormatted: '08:45',
        iconType: 'triangle-alert',
        iconClass: 'text-amber-500',
      },
      {
        id: 'alert-3',
        severity: 'info',
        message: 'Đồng bộ dữ liệu thành công từ Interior OS',
        timeFormatted: '08:20',
        iconType: 'info',
        iconClass: 'text-blue-500',
      },
    ];

    return {
      title: 'Cảnh báo & Thông báo',
      viewAllLabel: 'Xem tất cả →',
      items,
    };
  }

  // ─── Workshop Capacities ─────────────────────────────────────────────────

  public static getWorkshopCapacities() {
    const workshops: WorkshopCapacityItem[] = [
      { workshopName: 'Xưởng A', capacityPercent: 92, capacityFormatted: '92%', barColor: '#2D7A4F', heightPercent: 92 },
      { workshopName: 'Xưởng B', capacityPercent: 78, capacityFormatted: '78%', barColor: '#059669', heightPercent: 78 },
      { workshopName: 'Xưởng C', capacityPercent: 85, capacityFormatted: '85%', barColor: '#10b981', heightPercent: 85 },
      { workshopName: 'Xưởng D', capacityPercent: 70, capacityFormatted: '70%', barColor: '#f59e0b', heightPercent: 70 },
    ];

    return {
      title: 'Năng suất theo xưởng',
      detailLabel: 'Xem chi tiết →',
      yAxisLabels: ['100%', '75%', '50%', '25%', '0%'],
      workshops,
    };
  }

  // ─── Main Entry Point ─────────────────────────────────────────────────────

  public static getProductionOverview(): ProductionOverviewResponse {
    return {
      projectHeader: InteriorProductionAnalyticsService.getProjectHeader(),
      availableProjects: [
        { id: 'NT-2024-001', label: 'Villa Sunrise Renovation (NT-2024-001)', code: 'NT-2024-001' },
        { id: 'NT-2024-002', label: 'Sky Garden Apartment (NT-2024-002)', code: 'NT-2024-002' },
        { id: 'NT-2024-003', label: 'Ocean View Villa (NT-2024-003)', code: 'NT-2024-003' },
      ],
      architectureNotice: InteriorProductionAnalyticsService.getArchitectureNotice(),
      kpis: InteriorProductionAnalyticsService.getKpis(),
      workflowStages: InteriorProductionAnalyticsService.getWorkflowStages(),
      efficiencyMetrics: InteriorProductionAnalyticsService.getEfficiencyMetrics(),
      timelineChart: InteriorProductionAnalyticsService.getTimelineChart(),
      ordersTable: InteriorProductionAnalyticsService.getOrdersTable(),
      alerts: InteriorProductionAnalyticsService.getAlerts(),
      workshopCapacities: InteriorProductionAnalyticsService.getWorkshopCapacities(),
    };
  }
}

