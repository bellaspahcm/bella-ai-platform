/**
 * Bella Interior OS — Canonical QC, Punch List & Handover Analytics Service
 *
 * Source of Truth for Handover Gate verification, Punch List tracking,
 * 5-stage Quality Roadmap, and warranty readiness.
 * Enforces Zero UI Calculation: All status counts, percentages, overdue flags,
 * badge styles, sparklines, and labels are pre-computed in this service.
 *
 * @module src/products/bella-interior/services/interior-qc-handover-analytics.service
 */

import type {
  QCHandoverOverviewResponse,
  QCHandoverProjectHeader,
  HandoverGateDossier,
  QCKpis,
  QCKpiItem,
  PunchListFilterTab,
  PunchListTableRow,
  QualityRoadmap,
  QualityCommitmentBanner,
} from '../domain/qc-handover-overview.types';

export class InteriorQCHandoverAnalyticsService {
  // ─── Project Header ─────────────────────────────────────────────────────

  public static getProjectHeader(): QCHandoverProjectHeader {
    return {
      id: 'NT-2024-001',
      code: 'INT-2024-001',
      name: 'The Horizon Residence',
      selectorLabel: 'The Horizon Residence',
      location: 'Quận 7, TP. Hồ Chí Minh',
      plannedHandoverDate: '15/10/2026',
      status: 'ready_for_handover',
      statusLabel: 'Sẵn sàng bàn giao',
      notificationsCount: 3,
    };
  }

  // ─── Handover Gate ───────────────────────────────────────────────────────

  public static getHandoverGate(): HandoverGateDossier {
    return {
      status: 'READY FOR HANDOVER',
      badgeLabel: 'READY FOR HANDOVER',
      badgeClass: 'bg-emerald-600 text-white font-bold text-xs',
      title: 'Cổng Kiểm Định Nghiệm Thu (Handover Gate)',
      description: 'Tất cả hạng mục Critical đã đạt Verified. Đủ điều kiện ký biên bản bàn giao và kích hoạt bảo hành!',
      criticalVerifiedCount: 1,
      totalCriticalCount: 1,
      isEligibleForHandover: true,
      warrantyCertificateButtonLabel: 'Chứng Thư Bảo Hành >',
      bannerImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    };
  }

  // ─── Filter Tabs ─────────────────────────────────────────────────────────

  public static getFilterTabs(): PunchListFilterTab[] {
    return [
      { id: 'all', label: 'Tất cả', count: 3, active: true },
      { id: 'open', label: 'Mới mở', count: 1, active: false },
      { id: 'in_progress', label: 'Đang sửa', count: 1, active: false },
      { id: 'rectified', label: 'Đã sửa xong', count: 0, active: false },
      { id: 'verified', label: 'Đã xác thực', count: 1, active: false },
    ];
  }

  // ─── KPIs ────────────────────────────────────────────────────────────────

  public static getKpis(): QCKpis {
    const totalPunchList: QCKpiItem = {
      rawValue: 3,
      formattedValue: '3',
      label: 'Tổng Punch List',
      subLabel: '↑ 0%',
      subLabelClass: 'text-emerald-600 font-medium',
      iconName: 'clipboard-check',
      iconClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-50',
      cardBgClass: 'bg-white',
      sparklineSvgPath: 'M 0,22 Q 25,6 50,16 T 100,6',
    };

    const pendingPunchList: QCKpiItem = {
      rawValue: 1,
      formattedValue: '1',
      label: 'Chưa xử lý',
      subLabel: '33.3%',
      subLabelClass: 'text-amber-500 font-semibold',
      iconName: 'alert-circle',
      iconClass: 'text-amber-500',
      iconBgClass: 'bg-amber-50',
      cardBgClass: 'bg-white',
      sparklineSvgPath: 'M 0,16 Q 30,6 60,24 T 100,10',
    };

    const verifiedPunchList: QCKpiItem = {
      rawValue: 1,
      formattedValue: '1',
      label: 'Đã xác thực',
      subLabel: '33.3%',
      subLabelClass: 'text-emerald-600 font-semibold',
      iconName: 'check-circle',
      iconClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-50',
      cardBgClass: 'bg-white',
      sparklineSvgPath: 'M 0,22 Q 35,24 70,8 T 100,6',
    };

    const overduePunchList: QCKpiItem = {
      rawValue: 1,
      formattedValue: '1',
      label: 'Quá hạn',
      subLabel: '33.3%',
      subLabelClass: 'text-red-500 font-semibold',
      iconName: 'clock',
      iconClass: 'text-red-500',
      iconBgClass: 'bg-red-50',
      cardBgClass: 'bg-white',
      sparklineSvgPath: 'M 0,18 Q 25,8 55,20 T 100,6',
    };

    return {
      totalPunchList,
      pendingPunchList,
      verifiedPunchList,
      overduePunchList,
    };
  }

  // ─── Table Rows ──────────────────────────────────────────────────────────

  public static getTableRows(): PunchListTableRow[] {
    return [
      {
        id: 'pl-001',
        index: 1,
        code: 'PL-001',
        zoneArea: 'Phòng khách',
        categoryName: 'Sơn tường',
        description: 'Vết sơn không đều tại khu vực cửa sổ',
        severity: 'critical',
        severityLabel: 'Critical',
        severityBadgeClass: 'bg-red-500 text-white',
        assigneeName: 'Trần Văn Minh',
        assigneeTeam: '(Đội thi công)',
        assigneeAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        deadlineDate: '2026-10-10',
        deadlineFormatted: '10/10/2026',
        isOverdue: true,
        overdueBadgeLabel: '> Quá hạn',
        status: 'in_progress',
        statusLabel: 'Đang sửa',
        statusBadgeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
        hasRedAccentBorder: true,
        actionMenuOptions: ['Xem chi tiết', 'Cập nhật tiến độ', 'Xác thực hoàn thành'],
      },
      {
        id: 'pl-002',
        index: 2,
        code: 'PL-002',
        zoneArea: 'Phòng ngủ Master',
        categoryName: 'Nội thất gỗ',
        description: 'Cánh tủ bị trầy nhẹ',
        severity: 'major',
        severityLabel: 'Major',
        severityBadgeClass: 'bg-amber-500 text-white',
        assigneeName: 'Nguyễn Thị Hà',
        assigneeTeam: '(Đội sản xuất)',
        assigneeAvatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
        deadlineDate: '2026-10-12',
        deadlineFormatted: '12/10/2026',
        isOverdue: false,
        status: 'verified',
        statusLabel: 'Đã xác thực',
        statusBadgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        hasRedAccentBorder: false,
        actionMenuOptions: ['Xem chi tiết', 'Xem chứng chỉ', 'Lịch sử xác thực'],
      },
      {
        id: 'pl-003',
        index: 3,
        code: 'PL-003',
        zoneArea: 'Bếp',
        categoryName: 'Đá bàn bếp',
        description: 'Mép đá chưa khít',
        severity: 'minor',
        severityLabel: 'Minor',
        severityBadgeClass: 'bg-emerald-500 text-white',
        assigneeName: 'Lê Văn Dũng',
        assigneeTeam: '(Đội thi công)',
        assigneeAvatarUrl: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=120&q=80',
        deadlineDate: '2026-10-14',
        deadlineFormatted: '14/10/2026',
        isOverdue: false,
        status: 'open',
        statusLabel: 'Mới mở',
        statusBadgeClass: 'bg-purple-50 text-purple-600 border border-purple-200',
        hasRedAccentBorder: false,
        actionMenuOptions: ['Xem chi tiết', 'Giao việc', 'Chuyển xử lý'],
      },
    ];
  }

  // ─── Quality Roadmap ─────────────────────────────────────────────────────

  public static getQualityRoadmap(): QualityRoadmap {
    return {
      title: 'Hành trình chất lượng công trình',
      steps: [
        {
          stepNumber: 1,
          name: 'Kiểm định',
          subName: 'Chất lượng',
          status: 'completed',
          circleClass: 'bg-emerald-500 text-white',
          textClass: 'text-slate-700',
        },
        {
          stepNumber: 2,
          name: 'Ghi nhận lỗi',
          subName: '(Punch List)',
          status: 'completed',
          circleClass: 'bg-emerald-500 text-white',
          textClass: 'text-slate-700',
        },
        {
          stepNumber: 3,
          name: 'Khắc phục',
          subName: '(Sửa chữa)',
          status: 'completed',
          circleClass: 'bg-emerald-500 text-white',
          textClass: 'text-slate-700',
        },
        {
          stepNumber: 4,
          name: 'Xác thực',
          subName: '(Verified)',
          status: 'active',
          circleClass: 'bg-emerald-500 text-white ring-4 ring-emerald-100',
          textClass: 'text-emerald-700 font-bold',
        },
        {
          stepNumber: 5,
          name: 'Nghiệm thu',
          subName: '(Bàn giao)',
          status: 'upcoming',
          circleClass: 'bg-slate-300 text-white',
          textClass: 'text-slate-400',
        },
      ],
    };
  }

  // ─── Commitment Banner ───────────────────────────────────────────────────

  public static getCommitmentBanner(): QualityCommitmentBanner {
    return {
      title: 'Chất lượng tạo nên giá trị',
      description: 'Bella Interior cam kết mang đến không gian sống hoàn hảo nhất.',
      iconName: 'shield-check',
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
    };
  }

  // ─── Full Overview Aggregator ────────────────────────────────────────────

  public static getQCHandoverOverview(): QCHandoverOverviewResponse {
    return {
      projectHeader: InteriorQCHandoverAnalyticsService.getProjectHeader(),
      availableProjects: [
        { id: 'NT-2024-001', label: 'The Horizon Residence', code: 'INT-2024-001' },
        { id: 'NT-2024-002', label: 'Sky Garden Apartment', code: 'INT-2024-002' },
        { id: 'NT-2024-003', label: 'Ocean View Villa', code: 'INT-2024-003' },
      ],
      handoverGate: InteriorQCHandoverAnalyticsService.getHandoverGate(),
      filterTabs: InteriorQCHandoverAnalyticsService.getFilterTabs(),
      kpis: InteriorQCHandoverAnalyticsService.getKpis(),
      table: {
        title: 'Danh Sách Chi Tiết Tồn Đọng Punch List',
        itemsCountLabel: '(3 hạng mục)',
        lifecycleGuide: 'Quy trình: Open → In Progress → Rectified → Verified',
        headers: [
          '#',
          'Mã lỗi',
          'Khu vực',
          'Hạng mục',
          'Mô tả',
          'Mức độ',
          'Phụ trách',
          'Hạn xử lý',
          'Trạng thái',
          'Thao tác',
        ],
        rows: InteriorQCHandoverAnalyticsService.getTableRows(),
      },
      projectInfoCard: {
        title: 'Thông tin dự án',
        projectName: 'The Horizon Residence',
        location: 'Quận 7, TP. Hồ Chí Minh',
        scheduledDateFormatted: 'Ngày nghiệm thu dự kiến: 15/10/2026',
      },
      qualityRoadmap: InteriorQCHandoverAnalyticsService.getQualityRoadmap(),
      commitmentBanner: InteriorQCHandoverAnalyticsService.getCommitmentBanner(),
    };
  }
}

