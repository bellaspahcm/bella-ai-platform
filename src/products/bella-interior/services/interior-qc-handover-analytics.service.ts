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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
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
  PunchSeverityLevel,
  PunchLifecycleStatus,
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
      bannerImageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
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
        assigneeAvatarUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/qc-inspector-avatar.jpg',
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
        assigneeAvatarUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/customers/client-female-2.jpg',
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
        assigneeAvatarUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/handover-signoff.jpg',
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
      imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
    };
  }

  // ─── Full Overview Aggregator ────────────────────────────────────────────

  public static getMockQCHandoverOverview(): QCHandoverOverviewResponse {
    return {
      projectHeader: InteriorQCHandoverAnalyticsService.getProjectHeader(),
      availableProjects: [
        { id: 'NT-2024-001', label: 'The Horizon Residence', code: 'INT-2024-001' },
        { id: 'd450fc00-a593-484f-a8ad-ff8aebf756df', label: 'Aqua Bay Ecopark', code: 'INT-2024-004' },
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

  public static async getDbQCHandoverOverview(
    tenantId: string = 'tenant-bella-interior-001',
    projectId?: string,
    supabaseClient?: SupabaseClient<Database>,
  ): Promise<QCHandoverOverviewResponse> {
    if (!supabaseClient) {
      return this.getMockQCHandoverOverview();
    }

    try {
      // 1. Fetch available projects
      const { data: rawProjects } = await supabaseClient
        .from('interior_projects')
        .select('id, code, name, customer_name, site_address, target_completion_date, status')
        .order('created_at', { ascending: false });

      const projects = Array.isArray(rawProjects) ? rawProjects : [];
      const availableProjects = projects.map((p) => ({
        id: p.id,
        label: `${p.name} (${p.code})`,
        code: p.code,
      }));

      const activeProject = projectId
        ? projects.find((p) => p.id === projectId || p.code === projectId) || projects[0]
        : projects[0];

      // 2. Fetch punch list items
      let query = supabaseClient
        .from('interior_qc_punch_list_items')
        .select(`
          id,
          room_zone_name,
          item_name,
          defect_category,
          description,
          severity,
          assigned_fixer,
          deadline,
          status,
          rectification_note,
          verified_by,
          verified_at,
          created_at,
          project_id,
          interior_projects(id, code, name)
        `)
        .order('created_at', { ascending: false });

      if (projectId && activeProject) {
        query = query.eq('project_id', activeProject.id);
      }

      const { data: rawPunchList } = await query;
      const items = Array.isArray(rawPunchList) ? rawPunchList : [];

      if (items.length === 0) {
        const mock = this.getMockQCHandoverOverview();
        if (availableProjects.length > 0) {
          mock.availableProjects = availableProjects;
        }
        if (activeProject) {
          mock.projectHeader = {
            id: activeProject.id,
            code: activeProject.code,
            name: activeProject.name,
            selectorLabel: activeProject.name,
            location: activeProject.site_address || 'Quận 7, TP. Hồ Chí Minh',
            plannedHandoverDate: activeProject.target_completion_date || '15/10/2026',
            status: activeProject.status || 'ready_for_handover',
            statusLabel: 'Sẵn sàng bàn giao',
            notificationsCount: 0,
          };
          mock.projectInfoCard = {
            title: 'Thông tin dự án',
            projectName: activeProject.name,
            location: activeProject.site_address || 'Việt Nam',
            scheduledDateFormatted: `Ngày nghiệm thu dự kiến: ${activeProject.target_completion_date || 'Theo tiến độ hợp đồng'}`,
          };
        }
        return mock;
      }

      // 3. Map punch list rows
      const now = new Date();
      const rows: PunchListTableRow[] = items.map((it, idx) => {
        const severity: PunchSeverityLevel =
          it.severity === 'critical' || it.severity === 'major' ? it.severity : 'minor';
        const sevLabel = severity === 'critical' ? 'Critical' : severity === 'major' ? 'Major' : 'Minor';
        const sevClass =
          severity === 'critical'
            ? 'bg-red-500 text-white'
            : severity === 'major'
            ? 'bg-amber-500 text-white'
            : 'bg-emerald-500 text-white';

        const status: PunchLifecycleStatus =
          it.status === 'in_progress' || it.status === 'rectified' || it.status === 'verified'
            ? it.status
            : 'open';

        const statusLabel =
          status === 'in_progress'
            ? 'Đang sửa'
            : status === 'rectified'
            ? 'Đã sửa xong'
            : status === 'verified'
            ? 'Đã xác thực'
            : 'Mới mở';

        const statusBadgeClass =
          status === 'in_progress'
            ? 'bg-blue-50 text-blue-600 border border-blue-200'
            : status === 'rectified'
            ? 'bg-purple-50 text-purple-600 border border-purple-200'
            : status === 'verified'
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : 'bg-amber-50 text-amber-600 border border-amber-200';

        let deadlineFormatted = '—';
        let isOverdue = false;
        if (it.deadline) {
          try {
            const d = new Date(it.deadline);
            deadlineFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            if (status !== 'verified' && status !== 'rectified' && d < now) {
              isOverdue = true;
            }
          } catch {
            deadlineFormatted = it.deadline;
          }
        }

        // Category label
        const categoryMap: Record<string, string> = {
          hardware_defect: 'Phụ kiện / Kim khí',
          finishing: 'Sơn & Hoàn thiện',
          structural: 'Kết cấu & Khung',
          furniture_fit: 'Lắp ráp đồ gỗ',
          electrical_coordination: 'Thiết bị điện',
        };
        const catName = categoryMap[it.defect_category || ''] || it.defect_category || 'Nội thất';

        return {
          id: it.id,
          index: idx + 1,
          code: `PL-${it.id.slice(0, 6).toUpperCase()}`,
          zoneArea: it.room_zone_name || 'Phòng khách & Bếp',
          categoryName: catName,
          description: it.description || it.item_name || 'Chỉnh sửa lỗi chi tiết',
          severity,
          severityLabel: sevLabel,
          severityBadgeClass: sevClass,
          assigneeName: it.assigned_fixer || 'Kỹ thuật viên xưởng',
          assigneeTeam: '(Đội hoàn thiện hiện trường)',
          assigneeAvatarUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/handover/qc-inspector-avatar.jpg',
          deadlineDate: it.deadline || '',
          deadlineFormatted,
          isOverdue,
          overdueBadgeLabel: isOverdue ? '> Quá hạn' : undefined,
          status,
          statusLabel,
          statusBadgeClass,
          hasRedAccentBorder: severity === 'critical' && status !== 'verified',
          actionMenuOptions: ['Xem chi tiết', 'Cập nhật tiến độ', 'Xác thực hoàn thành'],
        };
      });

      // 4. Compute KPIs
      const totalCount = rows.length;
      const pendingCount = rows.filter((r) => r.status === 'open' || r.status === 'in_progress').length;
      const verifiedCount = rows.filter((r) => r.status === 'verified').length;
      const overdueCount = rows.filter((r) => r.isOverdue).length;

      const kpis: QCKpis = {
        totalPunchList: {
          rawValue: totalCount,
          formattedValue: totalCount.toString(),
          label: 'Tổng Punch List',
          subLabel: '↑ Hoạt động',
          subLabelClass: 'text-emerald-600 font-medium',
          iconName: 'clipboard-check',
          iconClass: 'text-emerald-600',
          iconBgClass: 'bg-emerald-50',
          cardBgClass: 'bg-white',
          sparklineSvgPath: 'M 0,22 Q 25,6 50,16 T 100,6',
        },
        pendingPunchList: {
          rawValue: pendingCount,
          formattedValue: pendingCount.toString(),
          label: 'Chưa xử lý',
          subLabel: totalCount > 0 ? `${((pendingCount / totalCount) * 100).toFixed(1)}%` : '0%',
          subLabelClass: 'text-amber-500 font-semibold',
          iconName: 'alert-circle',
          iconClass: 'text-amber-500',
          iconBgClass: 'bg-amber-50',
          cardBgClass: 'bg-white',
          sparklineSvgPath: 'M 0,16 Q 30,6 60,24 T 100,10',
        },
        verifiedPunchList: {
          rawValue: verifiedCount,
          formattedValue: verifiedCount.toString(),
          label: 'Đã xác thực',
          subLabel: totalCount > 0 ? `${((verifiedCount / totalCount) * 100).toFixed(1)}%` : '0%',
          subLabelClass: 'text-emerald-600 font-semibold',
          iconName: 'check-circle-2',
          iconClass: 'text-emerald-600',
          iconBgClass: 'bg-emerald-50',
          cardBgClass: 'bg-white',
          sparklineSvgPath: 'M 0,24 Q 25,18 50,8 T 100,4',
        },
        overduePunchList: {
          rawValue: overdueCount,
          formattedValue: overdueCount.toString(),
          label: 'Quá hạn xử lý',
          subLabel: overdueCount > 0 ? 'Cần can thiệp' : 'Đúng hạn',
          subLabelClass: overdueCount > 0 ? 'text-red-500 font-semibold' : 'text-emerald-600 font-medium',
          iconName: 'clock',
          iconClass: overdueCount > 0 ? 'text-red-500' : 'text-emerald-600',
          iconBgClass: overdueCount > 0 ? 'bg-red-50' : 'bg-emerald-50',
          cardBgClass: 'bg-white',
          sparklineSvgPath: 'M 0,20 Q 35,4 70,22 T 100,14',
        },
      };

      // 5. Filter tabs
      const filterTabs: PunchListFilterTab[] = [
        { id: 'all', label: 'Tất cả', count: totalCount, active: true },
        { id: 'open', label: 'Mới mở', count: rows.filter((r) => r.status === 'open').length, active: false },
        { id: 'in_progress', label: 'Đang sửa', count: rows.filter((r) => r.status === 'in_progress').length, active: false },
        { id: 'rectified', label: 'Đã sửa xong', count: rows.filter((r) => r.status === 'rectified').length, active: false },
        { id: 'verified', label: 'Đã xác thực', count: verifiedCount, active: false },
      ];

      // 6. Handover Gate
      const criticalTotal = rows.filter((r) => r.severity === 'critical').length;
      const criticalVerified = rows.filter((r) => r.severity === 'critical' && r.status === 'verified').length;
      const isEligible = (criticalTotal === 0 || criticalVerified === criticalTotal) && pendingCount === 0;

      const handoverGate: HandoverGateDossier = {
        status: isEligible ? 'READY FOR HANDOVER' : (criticalTotal > criticalVerified ? 'CRITICAL_PENDING' : 'INSPECTION_REQUIRED'),
        badgeLabel: isEligible ? 'READY FOR HANDOVER' : 'ĐANG XỬ LÝ PUNCH LIST',
        badgeClass: isEligible ? 'bg-emerald-600 text-white font-bold text-xs' : 'bg-amber-600 text-white font-bold text-xs',
        title: 'Cổng Kiểm Định Nghiệm Thu (Handover Gate)',
        description: isEligible
          ? 'Tất cả hạng mục Critical đã đạt Verified. Đủ điều kiện ký biên bản bàn giao và kích hoạt bảo hành!'
          : `Còn ${pendingCount} hạng mục tồn đọng cần khắc phục trước khi kích hoạt bàn giao chính thức.`,
        criticalVerifiedCount: criticalVerified,
        totalCriticalCount: criticalTotal,
        isEligibleForHandover: isEligible,
        warrantyCertificateButtonLabel: 'Chứng Thư Bảo Hành >',
        bannerImageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
      };

      // 7. Project Header & Info
      const projName = activeProject ? activeProject.name : 'The Horizon Residence';
      const projCode = activeProject ? activeProject.code : 'INT-2024-001';
      const projLoc = (activeProject && activeProject.site_address) ? activeProject.site_address : 'Quận 7, TP. Hồ Chí Minh';

      return {
        projectHeader: {
          id: activeProject ? activeProject.id : 'NT-2024-001',
          code: projCode,
          name: projName,
          selectorLabel: projName,
          location: projLoc,
          plannedHandoverDate: (activeProject && activeProject.target_completion_date) ? activeProject.target_completion_date : '15/10/2026',
          status: isEligible ? 'ready_for_handover' : 'in_progress',
          statusLabel: isEligible ? 'Sẵn sàng bàn giao' : 'Đang nghiệm thu',
          notificationsCount: overdueCount,
        },
        availableProjects: availableProjects.length > 0 ? availableProjects : [
          { id: 'NT-2024-001', label: 'The Horizon Residence', code: 'INT-2024-001' },
        ],
        handoverGate,
        filterTabs,
        kpis,
        table: {
          title: 'Danh Sách Chi Tiết Tồn Đọng Punch List',
          itemsCountLabel: `(${totalCount} hạng mục)`,
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
          rows,
        },
        projectInfoCard: {
          title: 'Thông tin dự án',
          projectName: projName,
          location: projLoc,
          scheduledDateFormatted: `Ngày nghiệm thu: ${(activeProject && activeProject.target_completion_date) ? activeProject.target_completion_date : '15/10/2026'}`,
        },
        qualityRoadmap: this.getQualityRoadmap(),
        commitmentBanner: this.getCommitmentBanner(),
      };
    } catch {
      return this.getMockQCHandoverOverview();
    }
  }

  public static getQCHandoverOverview(): QCHandoverOverviewResponse;
  public static getQCHandoverOverview(
    tenantId: string | undefined,
    projectId: string | undefined,
    supabaseClient: SupabaseClient<Database>
  ): Promise<QCHandoverOverviewResponse>;
  public static getQCHandoverOverview(
    tenantId?: string,
    projectId?: string,
    supabaseClient?: SupabaseClient<Database>
  ): QCHandoverOverviewResponse | Promise<QCHandoverOverviewResponse> {
    if (!supabaseClient) {
      return this.getMockQCHandoverOverview();
    }
    return this.getDbQCHandoverOverview(tenantId, projectId, supabaseClient);
  }
}

