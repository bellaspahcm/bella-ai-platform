import {
  ReportsOverviewResponse,
  ReportKpis,
  BusinessPerformanceTrends,
  CostStructure,
  ProjectPerformanceRow,
  ManagementAlert,
  LifecycleStep,
} from '../domain/reports-overview.types';

/**
 * BELLA INTERIOR OS — REPORTS & BUSINESS ANALYTICS CANONICAL DOMAIN SERVICE
 * 
 * Pre-computes all KPI values, historical multi-month trends, dual-bar chart heights,
 * donut segment math, project profitability rows, and management alert states on the server.
 * Ensures Zero UI Calculation and provides a single canonical source of truth.
 */
export class InteriorReportsAnalyticsService {
  /**
   * Retrieves the comprehensive Project Reports & Executive Analytics dossier.
   */
  public static async getReportsOverview(
    tenantId: string = 'tenant-bella-interior-001',
    projectId?: string,
    period?: string
  ): Promise<ReportsOverviewResponse> {
    const activeProjectId = projectId || 'INT-2024-001';
    const activePeriod = period || 'Tháng 10/2026';

    // 1. Projects metadata
    const availableProjects = [
      { id: 'INT-2024-001', code: 'INT-2024-001', name: 'The Horizon Residence' },
      { id: 'INT-2024-002', code: 'INT-2024-002', name: 'Villa Ciputra Giai Đoạn 2' },
      { id: 'INT-2024-003', code: 'INT-2024-003', name: 'Dubai Luxury Villa Fitout' },
      { id: 'INT-2024-004', code: 'INT-2024-004', name: 'Penthouse Metropolis Liễu Giai' },
      { id: 'INT-2024-005', code: 'INT-2024-005', name: 'Villa Harmony' },
    ];

    const currentProject = availableProjects.find((p) => p.id === activeProjectId) || availableProjects[0];

    // 2. Pre-computed 4 KPI cards matching mockup 1:1
    const kpis: ReportKpis = {
      contractValue: {
        rawValue: 9280000000,
        formattedValue: '9,28 tỷ đ',
        label: 'Tổng giá trị hợp đồng',
        subLabel: '↑ +12% so với tháng trước',
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'coins',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        sparklineType: 'bars',
      },
      grossMargin: {
        rawValue: 40.7,
        formattedValue: '40.7%',
        label: 'Biên lợi nhuận gộp TB',
        subLabel: 'Mục tiêu ≥ 38%',
        subLabelClass: 'text-slate-500 font-medium',
        iconName: 'percent',
        iconClass: 'text-sky-600',
        iconBgClass: 'bg-sky-50',
        sparklineType: 'wave',
      },
      onTimeRate: {
        rawValue: 91.6,
        formattedValue: '91.6%',
        label: 'Tỷ lệ đúng tiến độ',
        subLabel: '11/12 dự án',
        subLabelClass: 'text-slate-500 font-medium',
        iconName: 'check-circle',
        iconClass: 'text-amber-500',
        iconBgClass: 'bg-amber-50',
        sparklineType: 'donut',
        percentage: 91.6,
      },
      punchListErrors: {
        rawValue: 0,
        formattedValue: '0 lỗi chí mạng',
        label: 'Lỗi Punch List',
        subLabel: 'Đạt chuẩn ISO',
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'shield-check',
        iconClass: 'text-purple-600',
        iconBgClass: 'bg-purple-50',
        sparklineType: 'shield',
      },
    };

    // 3. 6-Month Business Performance Trends (Tháng 5 -> Tháng 10)
    // Pre-calculated bar heights relative to max scale 10B
    const trends: BusinessPerformanceTrends = {
      title: 'Xu hướng hiệu quả kinh doanh',
      yAxisLabels: ['10B', '8B', '6B', '4B', '2B', '0'],
      months: [
        {
          monthKey: '2026-05',
          monthLabel: 'Tháng 5',
          revenueBillion: 6.2,
          revenueFormatted: '6.2B',
          grossProfitBillion: 2.3,
          grossProfitFormatted: '2.3B',
          marginPercentage: 37.5,
          marginFormatted: '37.5%',
          revenueBarHeightPercent: 62.0,
          profitBarHeightPercent: 23.0,
          marginLineTopPercent: 62.5, // 100 - 37.5
        },
        {
          monthKey: '2026-06',
          monthLabel: 'Tháng 6',
          revenueBillion: 6.8,
          revenueFormatted: '6.8B',
          grossProfitBillion: 2.6,
          grossProfitFormatted: '2.6B',
          marginPercentage: 38.9,
          marginFormatted: '38.9%',
          revenueBarHeightPercent: 68.0,
          profitBarHeightPercent: 26.0,
          marginLineTopPercent: 61.1,
        },
        {
          monthKey: '2026-07',
          monthLabel: 'Tháng 7',
          revenueBillion: 7.1,
          revenueFormatted: '7.1B',
          grossProfitBillion: 2.8,
          grossProfitFormatted: '2.8B',
          marginPercentage: 39.8,
          marginFormatted: '39.8%',
          revenueBarHeightPercent: 71.0,
          profitBarHeightPercent: 28.0,
          marginLineTopPercent: 60.2,
        },
        {
          monthKey: '2026-08',
          monthLabel: 'Tháng 8',
          revenueBillion: 7.5,
          revenueFormatted: '7.5B',
          grossProfitBillion: 3.0,
          grossProfitFormatted: '3.0B',
          marginPercentage: 40.2,
          marginFormatted: '40.2%',
          revenueBarHeightPercent: 75.0,
          profitBarHeightPercent: 30.0,
          marginLineTopPercent: 59.8,
        },
        {
          monthKey: '2026-09',
          monthLabel: 'Tháng 9',
          revenueBillion: 8.1,
          revenueFormatted: '8.1B',
          grossProfitBillion: 3.3,
          grossProfitFormatted: '3.3B',
          marginPercentage: 41.0,
          marginFormatted: '41.0%',
          revenueBarHeightPercent: 81.0,
          profitBarHeightPercent: 33.0,
          marginLineTopPercent: 59.0,
        },
        {
          monthKey: '2026-10',
          monthLabel: 'Tháng 10',
          revenueBillion: 9.28,
          revenueFormatted: '9.28B',
          grossProfitBillion: 3.78,
          grossProfitFormatted: '3.8B',
          marginPercentage: 40.7,
          marginFormatted: '40.7%',
          revenueBarHeightPercent: 92.8,
          profitBarHeightPercent: 37.8,
          marginLineTopPercent: 59.3,
        },
      ],
      // Pre-computed normalized SVG polyline coordinates for 500x200 viewBox
      trendlineSvgPoints: '42,125 125,118 208,112 291,108 374,103 458,105',
    };

    // 4. Cost Structure (Donut)
    // Circumference = 2 * PI * 38 ≈ 238.76
    // Segment 1 (Vật tư 40.4%): length = 96.46
    // Segment 2 (Nhân công 33.2%): length = 79.27
    // Segment 3 (Chi phí khác 26.4%): length = 63.03
    const costStructure: CostStructure = {
      title: 'Cơ cấu chi phí',
      totalCostFormatted: '8.43 tỷ đ',
      totalCostSublabel: 'Tổng chi phí',
      items: [
        {
          id: 'materials',
          label: 'Vật tư',
          percentage: 40.4,
          percentageFormatted: '40.4%',
          amountBillion: 3.41,
          amountFormatted: '3.41 tỷ',
          color: '#3B82F6',
          dotClass: 'bg-blue-500',
        },
        {
          id: 'labor',
          label: 'Nhân công',
          percentage: 33.2,
          percentageFormatted: '33.2%',
          amountBillion: 2.80,
          amountFormatted: '2.80 tỷ',
          color: '#10B981',
          dotClass: 'bg-emerald-500',
        },
        {
          id: 'other',
          label: 'Chi phí khác',
          percentage: 26.4,
          percentageFormatted: '26.4%',
          amountBillion: 2.22,
          amountFormatted: '2.22 tỷ',
          color: '#F59E0B',
          dotClass: 'bg-amber-500',
        },
      ],
      donutSegments: [
        {
          strokeDasharray: '96.46 238.76',
          strokeDashoffset: 0,
          color: '#3B82F6',
        },
        {
          strokeDasharray: '79.27 238.76',
          strokeDashoffset: -96.46,
          color: '#10B981',
        },
        {
          strokeDasharray: '63.03 238.76',
          strokeDashoffset: -175.73,
          color: '#F59E0B',
        },
      ],
    };

    // 5. Project Performance Table (3 featured projects matching mockup)
    const projectPerformance: ProjectPerformanceRow[] = [
      {
        id: 'PRJ-CIPUTRA',
        name: 'Villa Ciputra Giai Đoạn 2',
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/villa-sunrise-renovation.jpg',
        contractValueFormatted: '2.45 tỷ đ',
        materialCostFormatted: '980 triệu đ',
        laborCostFormatted: '450 triệu đ',
        collectedFormatted: '1.80 tỷ đ',
        grossMarginFormatted: '41.5%',
        status: 'on_schedule',
        statusLabel: 'Đúng tiến độ',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        statusDotClass: 'bg-emerald-500',
      },
      {
        id: 'PRJ-DUBAI',
        name: 'Dubai Luxury Villa Fitout',
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/office-tower-lobby.jpg',
        contractValueFormatted: '3.78 tỷ đ',
        materialCostFormatted: '1.51 tỷ đ',
        laborCostFormatted: '640 triệu đ',
        collectedFormatted: '3.00 tỷ đ',
        grossMarginFormatted: '43.1%',
        status: 'on_schedule',
        statusLabel: 'Đúng tiến độ',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        statusDotClass: 'bg-emerald-500',
      },
      {
        id: 'PRJ-METROPOLIS',
        name: 'Penthouse Metropolis L. Giai',
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/projects/skyline-residence.jpg',
        contractValueFormatted: '2.20 tỷ đ',
        materialCostFormatted: '920 triệu đ',
        laborCostFormatted: '405 triệu đ',
        collectedFormatted: '2.20 tỷ đ',
        grossMarginFormatted: '39.8%',
        status: 'on_schedule',
        statusLabel: 'Đúng tiến độ',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        statusDotClass: 'bg-emerald-500',
      },
    ];

    // 6. Management Alerts
    const managementAlerts: ManagementAlert[] = [
      {
        id: 'ALERT-01',
        level: 'critical',
        message: 'Dự án Villa Harmony có biên lợi nhuận chỉ 28.5%',
        badgeLabel: 'Cần lưu ý',
        badgeClass: 'bg-red-50 text-red-600 border border-red-200',
        iconName: 'alert-circle',
        iconClass: 'text-red-500',
        iconBgClass: 'bg-red-100',
      },
      {
        id: 'ALERT-02',
        level: 'warning',
        message: '1 chứng thư bảo hành sắp hết hạn (trong 30 ngày)',
        badgeLabel: 'Theo dõi',
        badgeClass: 'bg-amber-50 text-amber-600 border border-amber-200',
        iconName: 'clock',
        iconClass: 'text-amber-500',
        iconBgClass: 'bg-amber-100',
      },
      {
        id: 'ALERT-03',
        level: 'info',
        message: 'Dự án The Orchard trễ tiến độ 3 ngày',
        badgeLabel: 'Kiểm tra',
        badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
        iconName: 'info',
        iconClass: 'text-blue-500',
        iconBgClass: 'bg-blue-100',
      },
    ];

    // 7. Project Management Lifecycle Steps
    const lifecycleSteps: LifecycleStep[] = [
      {
        stepNumber: 1,
        title: '1. Quản lý Chứng thư',
        iconName: 'file-text',
        status: 'completed',
        statusClass: 'text-emerald-700 font-semibold',
        iconClass: 'bg-emerald-600 text-white',
      },
      {
        stepNumber: 2,
        title: '2. Tiếp nhận Yêu cầu DV',
        iconName: 'headset',
        status: 'completed',
        statusClass: 'text-emerald-700 font-semibold',
        iconClass: 'bg-emerald-600 text-white',
      },
      {
        stepNumber: 3,
        title: '3. Thực hiện Sửa chữa',
        iconName: 'wrench',
        status: 'completed',
        statusClass: 'text-emerald-700 font-semibold',
        iconClass: 'bg-emerald-600 text-white',
      },
      {
        stepNumber: 4,
        title: '4. Xác nhận Hoàn thành',
        iconName: 'check-circle',
        status: 'completed',
        statusClass: 'text-emerald-700 font-semibold',
        iconClass: 'bg-emerald-600 text-white',
      },
      {
        stepNumber: 5,
        title: '5. Đánh giá Khách hàng',
        iconName: 'bar-chart',
        status: 'completed',
        statusClass: 'text-emerald-700 font-semibold',
        iconClass: 'bg-emerald-600 text-white',
      },
    ];

    return {
      project: {
        id: currentProject.id,
        code: currentProject.code,
        name: currentProject.name,
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
      },
      availableProjects,
      filterOptions: {
        timePeriod: activePeriod,
        availablePeriods: ['Tháng 10/2026', 'Tháng 09/2026', 'Tháng 08/2026', 'Quý 3/2026', 'Năm 2026'],
        projectFilter: 'Tất cả dự án',
        availableProjectFilters: ['Tất cả dự án', 'Villa Ciputra Giai Đoạn 2', 'Dubai Luxury Villa Fitout', 'Penthouse Metropolis Liễu Giai', 'Villa Harmony'],
      },
      kpis,
      trends,
      costStructure,
      projectPerformance,
      managementAlerts,
      lifecycleSteps,
    };
  }
}

