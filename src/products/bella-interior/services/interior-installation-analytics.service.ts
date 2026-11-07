/**
 * Bella Interior OS — Canonical Site Operations & Installation Analytics Service
 *
 * Source of Truth for Site Operations & Installation Dashboard:
 * - Room-by-room installation status & progress tracking
 * - Top-level KPI counts (Total, Installing, Completed, Attention)
 * - Overall project installation progress (40%)
 * - 7-day Gantt timeline chart with pre-computed span coordinates
 * - Alerts & Recent Activity log
 * - Quick action navigation cards
 *
 * Enforces Zero UI Calculation — all numbers, formatted percentages,
 * Gantt coordinate spans, badge styles, and colors are computed here.
 * The UI component is purely presentational.
 *
 * @module src/products/bella-interior/services/interior-installation-analytics.service
 */

import type {
  InstallationOverviewResponse,
  InstallationProjectHeader,
  InstallationKpis,
  InstallationKpiItem,
  RoomInstallationCard,
  TimelineDayColumn,
  TimelineGanttRow,
  InstallationTimelineChart,
  InstallationAlertActivityItem,
  InstallationQuickActionCard,
} from '../domain/installation-overview.types';

export class InteriorInstallationAnalyticsService {
  // ─── Helpers ────────────────────────────────────────────────────────────

  private static formatTwoDigits(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  // ─── Project Header ─────────────────────────────────────────────────────

  public static getProjectHeader(): InstallationProjectHeader {
    return {
      id: 'NT-2024-001',
      code: 'INT-2024-001',
      name: 'Villa Sunrise Renovation',
      selectorLabel: 'Villa Sunrise Renovation (INT-2024-001)',
      clientName: 'Nguyễn Thị Mai',
      status: 'installing',
      statusLabel: 'Đang thi công',
      badgeLabel: 'Site Operations',
    };
  }

  // ─── KPIs ────────────────────────────────────────────────────────────────

  private static buildKpiItem(
    rawValue: number,
    label: string,
    colorClass: string,
    iconName: string,
    iconBgClass: string,
    watermarkType: string,
  ): InstallationKpiItem {
    return {
      rawValue,
      formattedValue: InteriorInstallationAnalyticsService.formatTwoDigits(rawValue),
      label,
      colorClass,
      iconName,
      iconBgClass,
      cardBgClass: 'bg-white',
      watermarkType,
    };
  }

  public static getKpis(): InstallationKpis {
    return {
      totalRooms: InteriorInstallationAnalyticsService.buildKpiItem(
        4,
        'Tổng số phòng',
        'text-blue-600',
        'home',
        'bg-blue-500 text-white',
        'home',
      ),
      installingRooms: InteriorInstallationAnalyticsService.buildKpiItem(
        2,
        'Đang thi công',
        'text-slate-800',
        'tool',
        'bg-emerald-500 text-white',
        'circle',
      ),
      completedRooms: InteriorInstallationAnalyticsService.buildKpiItem(
        0,
        'Hoàn thành',
        'text-slate-800',
        'check',
        'bg-emerald-500 text-white',
        'check',
      ),
      attentionRooms: InteriorInstallationAnalyticsService.buildKpiItem(
        1,
        'Cần chú ý',
        'text-amber-500',
        'alert-triangle',
        'bg-amber-500 text-white',
        'warning',
      ),
    };
  }

  // ─── Overall Progress ───────────────────────────────────────────────────

  public static getOverallProgress() {
    return {
      title: 'Tổng tiến độ dự án',
      progressPercent: 40,
      progressFormatted: '40%',
      progressBarColor: '#10b981',
    };
  }

  // ─── Room Installation Cards ────────────────────────────────────────────

  public static getRooms(): RoomInstallationCard[] {
    return [
      {
        id: 'room-01',
        code: 'R01_LIVING',
        roomName: 'Phòng Khách Luxury',
        assignee: 'Lê Văn Thắng (Tổ Lắp Đặt 1)',
        progressPercent: 75,
        progressFormatted: '75%',
        progressBarColor: '#10b981',
        modulesCount: 6,
        modulesFormatted: 'Khối lượng: 6 modules',
        deadlineFormatted: 'Hạn: 2026-11-12',
        status: 'installing',
        statusLabel: 'Đang lắp đặt',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'room-02',
        code: 'R02_KITCHEN',
        roomName: 'Bếp & Phòng Ăn Master',
        assignee: 'Nguyễn Văn Hùng (Tổ Lắp Đặt 2)',
        progressPercent: 40,
        progressFormatted: '40%',
        progressBarColor: '#f59e0b',
        modulesCount: 12,
        modulesFormatted: 'Khối lượng: 12 modules',
        deadlineFormatted: 'Hạn: 2026-11-15',
        status: 'installing',
        statusLabel: 'Đang lắp đặt',
        statusBadgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
        imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'room-03',
        code: 'R03_MASTER',
        roomName: 'Phòng Ngủ Master Suite',
        assignee: 'Trần Văn Bình (Tổ Lắp Đặt 1)',
        progressPercent: 10,
        progressFormatted: '10%',
        progressBarColor: '#3b82f6',
        modulesCount: 8,
        modulesFormatted: 'Khối lượng: 8 modules',
        deadlineFormatted: 'Hạn: 2026-11-15',
        status: 'pending',
        statusLabel: 'Chờ lắp',
        statusBadgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        imageUrl: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=600&q=80',
      },
      {
        id: 'room-04',
        code: 'R04_CLOSET',
        roomName: 'Phòng Thay Đồ Walk-in Closet',
        assignee: 'Lê Văn Thắng (Tổ Lắp Đặt 1)',
        progressPercent: 0,
        progressFormatted: '0%',
        progressBarColor: '#94a3b8',
        modulesCount: 5,
        modulesFormatted: 'Khối lượng: 5 modules',
        deadlineFormatted: 'Hạn: 2026-11-20',
        status: 'pending',
        statusLabel: 'Chờ lắp',
        statusBadgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
        imageUrl: 'https://images.unsplash.com/photo-1558997519-83ea9252def8?auto=format&fit=crop&w=600&q=80',
      },
    ];
  }

  // ─── Timeline Gantt Chart ────────────────────────────────────────────────

  public static getTimelineChart(): InstallationTimelineChart {
    const days: TimelineDayColumn[] = [
      { dayNumber: '03', monthNumber: '11', dayOfWeek: 'T2', dateKey: '2026-11-03', label: '03/11' },
      { dayNumber: '04', monthNumber: '11', dayOfWeek: 'T3', dateKey: '2026-11-04', label: '04/11' },
      { dayNumber: '05', monthNumber: '11', dayOfWeek: 'T4', dateKey: '2026-11-05', label: '05/11' },
      { dayNumber: '06', monthNumber: '11', dayOfWeek: 'T5', dateKey: '2026-11-06', label: '06/11' },
      { dayNumber: '07', monthNumber: '11', dayOfWeek: 'T6', dateKey: '2026-11-07', label: '07/11' },
      { dayNumber: '08', monthNumber: '11', dayOfWeek: 'T7', dateKey: '2026-11-08', label: '08/11' },
      { dayNumber: '09', monthNumber: '11', dayOfWeek: 'CN', dateKey: '2026-11-09', label: '09/11' },
    ];

    const totalDays = days.length; // 7

    // Pre-compute percentages for exact CSS grid/absolute placement
    const rows: TimelineGanttRow[] = [
      {
        roomCode: 'R01_LIVING',
        roomName: 'Phòng Khách Luxury',
        startDayIndex: 0,
        durationDays: 4,
        leftPercent: parseFloat(((0 / totalDays) * 100).toFixed(2)),
        widthPercent: parseFloat(((4 / totalDays) * 100).toFixed(2)),
        barColor: '#10b981',
        barBgClass: 'bg-emerald-500',
        hasStartMarker: true,
        hasEndMarker: true,
        isFaintTrack: false,
      },
      {
        roomCode: 'R02_KITCHEN',
        roomName: 'Bếp & Phòng Ăn Master',
        startDayIndex: 1,
        durationDays: 5,
        leftPercent: parseFloat(((1 / totalDays) * 100).toFixed(2)),
        widthPercent: parseFloat(((5 / totalDays) * 100).toFixed(2)),
        barColor: '#f59e0b',
        barBgClass: 'bg-amber-500',
        hasStartMarker: true,
        hasEndMarker: true,
        isFaintTrack: false,
      },
      {
        roomCode: 'R03_MASTER',
        roomName: 'Phòng Ngủ Master Suite',
        startDayIndex: 2,
        durationDays: 3,
        leftPercent: parseFloat(((2 / totalDays) * 100).toFixed(2)),
        widthPercent: parseFloat(((3 / totalDays) * 100).toFixed(2)),
        barColor: '#3b82f6',
        barBgClass: 'bg-blue-500',
        hasStartMarker: true,
        hasEndMarker: true,
        isFaintTrack: false,
      },
      {
        roomCode: 'R04_CLOSET',
        roomName: 'Phòng Thay Đồ Walk-in Closet',
        startDayIndex: 2,
        durationDays: 5,
        leftPercent: parseFloat(((2 / totalDays) * 100).toFixed(2)),
        widthPercent: parseFloat(((5 / totalDays) * 100).toFixed(2)),
        barColor: '#cbd5e1',
        barBgClass: 'bg-slate-300',
        hasStartMarker: false,
        hasEndMarker: false,
        isFaintTrack: true,
      },
    ];

    return {
      title: 'Tiến độ theo thời gian',
      rangeLabel: '7 ngày gần nhất',
      availableRanges: ['7 ngày gần nhất', '14 ngày tới', 'Toàn bộ tiến độ'],
      days,
      rows,
    };
  }

  // ─── Alerts & Recent Activity ────────────────────────────────────────────

  public static getAlerts() {
    const items: InstallationAlertActivityItem[] = [
      {
        id: 'alert-1',
        type: 'warning',
        message: 'Phòng R02_KITCHEN đã chậm tiến độ 5 ngày',
        timeFormatted: '09:30 09/11',
        iconType: 'alert-triangle',
        iconClass: 'text-amber-500',
        iconBgClass: 'bg-amber-50',
      },
      {
        id: 'alert-2',
        type: 'success',
        message: 'Hoàn thành QC hạng mục Tủ bếp - R01_LIVING',
        timeFormatted: '08:45 09/11',
        iconType: 'check-circle',
        iconClass: 'text-blue-500',
        iconBgClass: 'bg-blue-50',
      },
      {
        id: 'alert-3',
        type: 'note',
        message: 'Thêm nhật ký thi công: Hoàn thiện trần thạch cao',
        timeFormatted: '16:20 08/11',
        iconType: 'file-text',
        iconClass: 'text-emerald-500',
        iconBgClass: 'bg-emerald-50',
      },
      {
        id: 'alert-4',
        type: 'media',
        message: 'Cập nhật hình ảnh hiện trường tại R03_MASTER',
        timeFormatted: '14:10 08/11',
        iconType: 'image',
        iconClass: 'text-purple-500',
        iconBgClass: 'bg-purple-50',
      },
    ];

    return {
      title: 'Cảnh báo & Hoạt động gần đây',
      viewAllLabel: 'Xem tất cả →',
      items,
    };
  }

  // ─── Quick Actions ───────────────────────────────────────────────────────

  public static getQuickActions(): InstallationQuickActionCard[] {
    return [
      {
        id: 'action-schedule',
        title: 'Lịch Thi Công',
        actionLabel: 'Xem kế hoạch chi tiết →',
        href: '/dashboard/interior/schedule',
        iconType: 'calendar',
        iconColorClass: 'text-blue-500',
        bgGradientClass: 'from-blue-50/60 to-white',
        borderColorClass: 'border-blue-100',
      },
      {
        id: 'action-qc',
        title: 'QC & Punch List',
        actionLabel: 'Kiểm tra và xử lý lỗi →',
        href: '/dashboard/interior/qc-handover',
        iconType: 'alert-triangle',
        iconColorClass: 'text-amber-500',
        bgGradientClass: 'from-amber-50/60 to-white',
        borderColorClass: 'border-amber-100',
      },
      {
        id: 'action-reports',
        title: 'Báo Cáo Tiến Độ',
        actionLabel: 'Xem báo cáo →',
        href: '/dashboard/interior/reports',
        iconType: 'bar-chart',
        iconColorClass: 'text-emerald-500',
        bgGradientClass: 'from-emerald-50/60 to-white',
        borderColorClass: 'border-emerald-100',
      },
      {
        id: 'action-diary',
        title: 'Nhật Ký Thi Công',
        actionLabel: 'Xem tất cả ảnh →',
        href: '/dashboard/interior/delivery/site-diary',
        iconType: 'image',
        iconColorClass: 'text-purple-500',
        bgGradientClass: 'from-purple-50/60 to-white',
        borderColorClass: 'border-purple-100',
      },
    ];
  }

  // ─── Main Overview Aggregator ────────────────────────────────────────────

  public static getInstallationOverview(): InstallationOverviewResponse {
    return {
      projectHeader: InteriorInstallationAnalyticsService.getProjectHeader(),
      availableProjects: [
        { id: 'NT-2024-001', label: 'Villa Sunrise Renovation (INT-2024-001)', code: 'INT-2024-001' },
        { id: 'NT-2024-002', label: 'Sky Garden Apartment (INT-2024-002)', code: 'INT-2024-002' },
        { id: 'NT-2024-003', label: 'Ocean View Villa (INT-2024-003)', code: 'INT-2024-003' },
      ],
      kpis: InteriorInstallationAnalyticsService.getKpis(),
      overallProgress: InteriorInstallationAnalyticsService.getOverallProgress(),
      rooms: InteriorInstallationAnalyticsService.getRooms(),
      timelineChart: InteriorInstallationAnalyticsService.getTimelineChart(),
      alerts: InteriorInstallationAnalyticsService.getAlerts(),
      quickActions: InteriorInstallationAnalyticsService.getQuickActions(),
    };
  }
}
