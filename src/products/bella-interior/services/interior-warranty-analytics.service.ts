import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  WarrantyOverviewResponse,
  WarrantyCertificateRow,
  WarrantyKpis,
  WarrantyCalendarDay,
  WarrantyRoadmapStep,
  WarrantyRecentActivity,
  WarrantyCertificateStatus,
} from '../domain/warranty-overview.types';

// ─── Status helpers ───────────────────────────────────────────────────────────

function computeCertStatus(expirationDate: string): WarrantyCertificateStatus {
  const remaining = new Date(expirationDate).getTime() - Date.now();
  if (remaining < 0) return 'expired';
  if (remaining < 90 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'active';
}

function statusLabel(s: WarrantyCertificateStatus): string {
  return s === 'active' ? 'Đang hiệu lực' : s === 'expiring_soon' ? 'Sắp hết hạn' : 'Đã hết hạn';
}

function statusBadgeClass(s: WarrantyCertificateStatus): string {
  return s === 'active'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : s === 'expiring_soon'
    ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-slate-100 text-slate-600 border border-slate-200';
}

function statusDotClass(s: WarrantyCertificateStatus): string {
  return s === 'active'
    ? 'bg-emerald-500'
    : s === 'expiring_soon'
    ? 'bg-amber-500'
    : 'border border-slate-400 bg-transparent';
}

function formatDateVn(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

type DbCertRow = {
  id?: unknown;
  certificate_number?: unknown;
  customer_name?: unknown;
  effective_date?: unknown;
  expiration_date?: unknown;
  terms_summary?: unknown;
  project_id?: unknown;
};

type DbTicketRow = {
  id?: unknown;
  status?: unknown;
  ticket_number?: unknown;
};

/**
 * BELLA INTERIOR OS — WARRANTY & AFTERCARE CANONICAL DOMAIN SERVICE
 *
 * Pre-computes all statistics, calendar layout, badge classes,
 * overdue warnings, and roadmap stages on the server.
 * Uses real Supabase RPC data when a client is provided,
 * and canonical baseline mockup as offline fallback.
 */
export class InteriorWarrantyAnalyticsService {
  /**
   * Retrieves the comprehensive Warranty & Aftercare dashboard dossier.
   */
  public static async getWarrantyOverview(
    tenantId: string = 'tenant-bella-interior-001',
    projectId?: string,
    supabaseClient?: SupabaseClient<Database>,
  ): Promise<WarrantyOverviewResponse> {
    if (!supabaseClient) {
      return this.getMockWarrantyOverview(projectId);
    }

    // ── 1. Fetch real certificates and tickets via RBAC RPCs ──────────────
    type RpcFn = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    const rpcClient = (supabaseClient as unknown as { rpc: RpcFn }).rpc.bind(supabaseClient as unknown as { rpc: RpcFn });

    const [certRpc, ticketRpc] = await Promise.all([
      rpcClient('interior_list_warranty_certificates', { p_project_id: projectId ?? null }),
      rpcClient('interior_list_warranty_tickets', { p_project_id: projectId ?? null }),
    ]);

    const rawCerts: DbCertRow[] = Array.isArray(certRpc.data) ? (certRpc.data as DbCertRow[]) : [];
    const rawTickets: DbTicketRow[] = Array.isArray(ticketRpc.data) ? (ticketRpc.data as DbTicketRow[]) : [];

    // ── 2. Map certificates to domain rows ───────────────────────────────
    const certificates: WarrantyCertificateRow[] = rawCerts
      .filter((c) => typeof c.certificate_number === 'string' && typeof c.effective_date === 'string' && typeof c.expiration_date === 'string')
      .map((c, i) => {
        const expiry = String(c.expiration_date);
        const s = computeCertStatus(expiry);
        return {
          index: i + 1,
          certificateNo: String(c.certificate_number),
          project: typeof c.project_id === 'string' ? c.project_id : '—',
          client: typeof c.customer_name === 'string' ? c.customer_name : '—',
          handoverDate: formatDateVn(String(c.effective_date)),
          warrantyStartDate: formatDateVn(String(c.effective_date)),
          warrantyExpires: formatDateVn(expiry),
          coverage: typeof c.terms_summary === 'string' ? c.terms_summary : 'Nội thất tổng thể',
          status: s,
          statusLabel: statusLabel(s),
          statusBadgeClass: statusBadgeClass(s),
          statusDotClass: statusDotClass(s),
        };
      });

    // ── 3. KPI computation from real data ────────────────────────────────
    const total = certificates.length;
    const active = certificates.filter((c) => c.status === 'active').length;
    const expiring = certificates.filter((c) => c.status === 'expiring_soon').length;
    const expired = certificates.filter((c) => c.status === 'expired').length;
    const openTickets = rawTickets.filter(
      (t) => typeof t.status === 'string' && !['resolved', 'closed'].includes(t.status),
    ).length;
    const activePct = total > 0 ? Math.round((active / total) * 1000) / 10 : 0;
    const expiringPct = total > 0 ? Math.round((expiring / total) * 1000) / 10 : 0;
    const expiredPct = total > 0 ? Math.round((expired / total) * 1000) / 10 : 0;

    const kpis: WarrantyKpis = {
      totalCertificates: {
        rawValue: total,
        formattedValue: String(total),
        label: 'Tổng Chứng Thư',
        subLabel: `${total} chứng thư`,
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'file-text',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        cardBgClass: 'bg-white',
        previewType: 'chart',
      },
      activeCertificates: {
        rawValue: active,
        formattedValue: String(active),
        label: 'Đang Hiệu Lực',
        subLabel: `${activePct}%`,
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'check-circle',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        cardBgClass: 'bg-white',
        previewType: 'donut',
        percentage: activePct,
      },
      expiringCertificates: {
        rawValue: expiring,
        formattedValue: String(expiring),
        label: 'Sắp Hết Hạn (≤ 90 ngày)',
        subLabel: `${expiringPct}%`,
        subLabelClass: 'text-amber-500 font-semibold',
        iconName: 'clock',
        iconClass: 'text-amber-500',
        iconBgClass: 'bg-amber-50',
        cardBgClass: 'bg-white',
        previewType: 'clock',
        percentage: expiringPct,
      },
      expiredCertificates: {
        rawValue: expired,
        formattedValue: String(expired),
        label: 'Đã Hết Hạn',
        subLabel: `${expiredPct}%`,
        subLabelClass: 'text-slate-500 font-semibold',
        iconName: 'clock-rewind',
        iconClass: 'text-slate-500',
        iconBgClass: 'bg-slate-50',
        cardBgClass: 'bg-white',
        previewType: 'calendar',
        percentage: expiredPct,
      },
      openTickets: {
        rawValue: openTickets,
        formattedValue: String(openTickets),
        label: 'Ticket Đang Mở',
        subLabel: `${rawTickets.length} tổng`,
        subLabelClass: 'text-sky-600 font-semibold',
        iconName: 'headset',
        iconClass: 'text-sky-600',
        iconBgClass: 'bg-sky-50',
        cardBgClass: 'bg-white',
        previewType: 'headset',
      },
      warrantyCost: {
        rawValue: 0,
        formattedValue: '—',
        label: 'Chi Phí Bảo Hành',
        subLabel: 'Chưa hạch toán',
        subLabelClass: 'text-slate-500 font-semibold',
        iconName: 'dollar-sign',
        iconClass: 'text-slate-500',
        iconBgClass: 'bg-slate-50',
        cardBgClass: 'bg-white',
        previewType: 'bars',
      },
    };

    // ── 4. Build calendar for current month ─────────────────────────────
    const now = new Date();
    const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const calendarDays: (WarrantyCalendarDay | null)[] = Array(startOffset).fill(null);
    const expiringDays = new Set<number>();
    certificates.forEach((c) => {
      if (c.status === 'expiring_soon') {
        try {
          const parts = c.warrantyExpires.split('/');
          if (parts.length === 3) {
            const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
              expiringDays.add(d.getDate());
            }
          }
        } catch { /* ignore */ }
      }
    });
    for (let d = 1; d <= daysInMonth; d++) {
      calendarDays.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday: d === now.getDate(),
        isHighlighted: d === now.getDate(),
        hasAmberDot: expiringDays.has(d),
      });
    }

    // ── 5. Static roadmap ────────────────────────────────────────────────
    const roadmap: WarrantyRoadmapStep[] = [
      { stepNumber: 1, title: '1. Quản lý Chứng thư', iconName: 'file-text', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 2, title: '2. Tiếp nhận Yêu cầu DV', iconName: 'headset', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 3, title: '3. Thực hiện Sửa chữa', iconName: 'wrench', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 4, title: '4. Xác nhận Hoàn thành', iconName: 'check-circle', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 5, title: '5. Đánh giá Khách hàng', iconName: 'star', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
    ];

    // ── 6. Recent activities from real tickets ────────────────────────────
    const recentActivities: WarrantyRecentActivity[] = rawTickets
      .slice(0, 5)
      .map((t, i) => {
        const isResolved = typeof t.status === 'string' && ['resolved', 'closed'].includes(t.status);
        return {
          id: `ACT-${String(i + 1).padStart(3, '0')}`,
          type: isResolved ? ('ticket_resolved' as const) : ('ticket_created' as const),
          title: isResolved
            ? `Đã hoàn tất xử lý Ticket #${typeof t.ticket_number === 'string' ? t.ticket_number : i + 1}`
            : `Ticket bảo hành mới được tạo`,
          timeAgo: 'Gần đây',
          iconName: isResolved ? 'check-circle' : undefined,
          iconClass: isResolved ? 'text-emerald-500' : undefined,
        };
      });
    if (recentActivities.length === 0 && expiring > 0) {
      recentActivities.push({
        id: 'ACT-EXPIRY',
        type: 'certificate_expiring',
        title: `${expiring} chứng thư sắp hết hạn trong 90 ngày`,
        timeAgo: 'Hiện tại',
        iconName: 'calendar',
        iconClass: 'text-amber-500',
      });
    }

    // ── 7. Project info ──────────────────────────────────────────────────
    const projectName = typeof projectId === 'string' ? projectId : tenantId;
    const projectInfo = { id: projectName, code: projectName, name: projectName };

    // ── 8. Filter options from real certificate data ──────────────────────
    const uniqueProjects = ['Tất cả dự án', ...Array.from(new Set(certificates.map((c) => c.project).filter(Boolean)))];
    const uniqueClients = ['Tất cả khách hàng', ...Array.from(new Set(certificates.map((c) => c.client).filter((c) => c !== '—')))];

    return {
      project: {
        id: projectInfo.id,
        code: projectInfo.code,
        name: projectInfo.name,
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
        notificationCount: expiring,
      },
      availableProjects: [projectInfo],
      expiryAlert: {
        count: expiring,
        thresholdDays: 90,
        message: expiring > 0
          ? `${expiring} chứng thư sắp hết hạn trong 90 ngày`
          : 'Không có chứng thư sắp hết hạn',
        linkText: 'Xem chi tiết →',
        linkHref: '#certificates-expiring',
      },
      kpis,
      activeTab: 'certificates',
      certificates,
      totalCertificatesCount: total,
      pagination: {
        currentPage: 1,
        totalPages: Math.max(1, Math.ceil(total / 10)),
        pageSize: 10,
        totalItems: total,
        displayRange: total > 0 ? `Hiển thị 1–${Math.min(total, 10)} trong ${total} kết quả` : 'Chưa có chứng thư',
      },
      filterOptions: {
        projects: uniqueProjects,
        clients: uniqueClients,
        statuses: [
          { value: 'all', label: 'Tất cả trạng thái' },
          { value: 'active', label: 'Đang hiệu lực' },
          { value: 'expiring_soon', label: 'Sắp hết hạn' },
          { value: 'expired', label: 'Đã hết hạn' },
        ],
        dateRangeLabel: `Thời gian: thực tế từ DB (${total} chứng thư)`,
      },
      reassuranceBanner: {
        title: 'Bảo hành an tâm',
        subtitle: 'Đồng hành cùng khách hàng sau bàn giao',
        buttonText: 'Tìm hiểu thêm →',
        buttonHref: '#learn-more-warranty',
        imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
      },
      calendar: {
        monthLabel,
        daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        days: calendarDays,
      },
      roadmap,
      recentActivities,
    };
  }

  /**
   * Canonical offline baseline mockup for unit tests and zero-UI calculation contract.
   */
  private static getMockWarrantyOverview(projectId?: string): WarrantyOverviewResponse {
    const activeProjectId = projectId || 'INT-2024-001';

    const availableProjects = [
      { id: 'INT-2024-001', code: 'INT-2024-001', name: 'The Horizon Residence' },
      { id: 'INT-2024-002', code: 'INT-2024-002', name: 'The Orchard Penthouse' },
      { id: 'INT-2023-005', code: 'INT-2023-005', name: 'Sunrise Mall Food Court' },
      { id: 'INT-2022-003', code: 'INT-2022-003', name: 'Kaffah Headquarters' },
      { id: 'INT-2024-003', code: 'INT-2024-003', name: 'Greenview Boutique Hotel' },
    ];

    const currentProject = availableProjects.find((p) => p.id === activeProjectId) || availableProjects[0];

    const kpis: WarrantyKpis = {
      totalCertificates: {
        rawValue: 24,
        formattedValue: '24',
        label: 'Tổng Chứng Thư',
        subLabel: '↑ 2%',
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'file-text',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        cardBgClass: 'bg-white',
        previewType: 'chart',
      },
      activeCertificates: {
        rawValue: 22,
        formattedValue: '22',
        label: 'Đang Hiệu Lực',
        subLabel: '91.7%',
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'check-circle',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        cardBgClass: 'bg-white',
        previewType: 'donut',
        percentage: 91.7,
      },
      expiringCertificates: {
        rawValue: 1,
        formattedValue: '1',
        label: 'Sắp Hết Hạn (≤ 90 ngày)',
        subLabel: '4.2%',
        subLabelClass: 'text-amber-500 font-semibold',
        iconName: 'clock',
        iconClass: 'text-amber-500',
        iconBgClass: 'bg-amber-50',
        cardBgClass: 'bg-white',
        previewType: 'clock',
        percentage: 4.2,
      },
      expiredCertificates: {
        rawValue: 1,
        formattedValue: '1',
        label: 'Đã Hết Hạn',
        subLabel: '4.2%',
        subLabelClass: 'text-slate-500 font-semibold',
        iconName: 'clock-rewind',
        iconClass: 'text-slate-500',
        iconBgClass: 'bg-slate-50',
        cardBgClass: 'bg-white',
        previewType: 'calendar',
        percentage: 4.2,
      },
      openTickets: {
        rawValue: 5,
        formattedValue: '5',
        label: 'Ticket Đang Mở',
        subLabel: '↑ 1',
        subLabelClass: 'text-sky-600 font-semibold',
        iconName: 'headset',
        iconClass: 'text-sky-600',
        iconBgClass: 'bg-sky-50',
        cardBgClass: 'bg-white',
        previewType: 'headset',
      },
      warrantyCost: {
        rawValue: 68500000,
        formattedValue: '68.5M ₫',
        label: 'Chi Phí Bảo Hành',
        subLabel: 'Tối ưu định mức',
        subLabelClass: 'text-emerald-600 font-semibold',
        iconName: 'dollar-sign',
        iconClass: 'text-emerald-600',
        iconBgClass: 'bg-emerald-50',
        cardBgClass: 'bg-white',
        previewType: 'bars',
      },
    };

    const certificates: WarrantyCertificateRow[] = [
      {
        index: 1,
        certificateNo: 'WC-2024-001',
        project: 'The Horizon Residence',
        client: 'Trần Minh Anh',
        handoverDate: '15/03/2024',
        warrantyStartDate: '15/03/2024',
        warrantyExpires: '15/03/2026',
        coverage: 'Nội thất tổng thể',
        status: 'active',
        statusLabel: 'Đang hiệu lực',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        statusDotClass: 'bg-emerald-500',
      },
      {
        index: 2,
        certificateNo: 'WC-2024-002',
        project: 'The Orchard Penthouse',
        client: 'Bùi Sang',
        handoverDate: '01/07/2024',
        warrantyStartDate: '01/07/2024',
        warrantyExpires: '01/07/2026',
        coverage: 'Nội thất & Thiết bị',
        status: 'expiring_soon',
        statusLabel: 'Sắp hết hạn',
        statusBadgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
        statusDotClass: 'bg-amber-500',
      },
      {
        index: 3,
        certificateNo: 'WC-2023-005',
        project: 'Sunrise Mall Food Court',
        client: 'Sunrise Mall Management',
        handoverDate: '20/11/2023',
        warrantyStartDate: '20/11/2023',
        warrantyExpires: '20/11/2025',
        coverage: 'Nội thất & Thiết bị',
        status: 'expired',
        statusLabel: 'Đã hết hạn',
        statusBadgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
        statusDotClass: 'border border-slate-400 bg-transparent',
      },
      {
        index: 4,
        certificateNo: 'WC-2022-003',
        project: 'Kaffah Headquarters',
        client: 'PT Kaffah Properti',
        handoverDate: '10/05/2022',
        warrantyStartDate: '10/05/2022',
        warrantyExpires: '10/05/2024',
        coverage: 'Văn phòng & Nội thất',
        status: 'expired',
        statusLabel: 'Đã hết hạn',
        statusBadgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
        statusDotClass: 'border border-slate-400 bg-transparent',
      },
      {
        index: 5,
        certificateNo: 'WC-2024-003',
        project: 'Greenview Boutique Hotel',
        client: 'CV Greenview Resort',
        handoverDate: '05/09/2024',
        warrantyStartDate: '05/09/2024',
        warrantyExpires: '05/09/2026',
        coverage: 'Nội thất & Trang trí',
        status: 'active',
        statusLabel: 'Đang hiệu lực',
        statusBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        statusDotClass: 'bg-emerald-500',
      },
    ];

    const calendarDays: (WarrantyCalendarDay | null)[] = [
      null, null, null, null, null, null,
      { dayNumber: 1, isCurrentMonth: true },
      { dayNumber: 2, isCurrentMonth: true },
      { dayNumber: 3, isCurrentMonth: true },
      { dayNumber: 4, isCurrentMonth: true },
      { dayNumber: 5, isCurrentMonth: true },
      { dayNumber: 6, isCurrentMonth: true },
      { dayNumber: 7, isCurrentMonth: true },
      { dayNumber: 8, isCurrentMonth: true },
      { dayNumber: 9, isCurrentMonth: true },
      { dayNumber: 10, isCurrentMonth: true },
      { dayNumber: 11, isCurrentMonth: true },
      { dayNumber: 12, isCurrentMonth: true, isHighlighted: true, isToday: true, eventDescription: 'Lịch bảo trì định kỳ' },
      { dayNumber: 13, isCurrentMonth: true },
      { dayNumber: 14, isCurrentMonth: true },
      { dayNumber: 15, isCurrentMonth: true },
      { dayNumber: 16, isCurrentMonth: true },
      { dayNumber: 17, isCurrentMonth: true },
      { dayNumber: 18, isCurrentMonth: true },
      { dayNumber: 19, isCurrentMonth: true, hasAmberDot: true, eventDescription: 'Nhắc hẹn bảo hành The Orchard Penthouse' },
      { dayNumber: 20, isCurrentMonth: true },
      { dayNumber: 21, isCurrentMonth: true, hasRedDot: true, eventDescription: 'Hạn kiểm định kỹ thuật khẩn cấp' },
      { dayNumber: 22, isCurrentMonth: true },
    ];

    const roadmap: WarrantyRoadmapStep[] = [
      { stepNumber: 1, title: '1. Quản lý Chứng thư', iconName: 'file-text', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 2, title: '2. Tiếp nhận Yêu cầu DV', iconName: 'headset', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 3, title: '3. Thực hiện Sửa chữa', iconName: 'wrench', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 4, title: '4. Xác nhận Hoàn thành', iconName: 'check-circle', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
      { stepNumber: 5, title: '5. Đánh giá Khách hàng', iconName: 'star', status: 'completed', statusClass: 'text-emerald-700 font-semibold', iconClass: 'bg-emerald-600 text-white' },
    ];

    const recentActivities: WarrantyRecentActivity[] = [
      {
        id: 'ACT-001',
        type: 'ticket_created',
        title: 'Nguyễn Thị Mai đã tạo Ticket #ST-2026-011',
        timeAgo: '2 giờ trước',
        avatarUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/customers/client-female-1.jpg',
      },
      {
        id: 'ACT-002',
        type: 'ticket_resolved',
        title: 'Đã hoàn tất xử lý Ticket #ST-2026-010',
        timeAgo: '3 giờ trước',
        iconName: 'check-circle',
        iconClass: 'text-emerald-500',
      },
      {
        id: 'ACT-003',
        type: 'certificate_expiring',
        title: 'Chứng thư WC-2024-002 sắp hết hạn (trong 30 ngày)',
        timeAgo: '1 ngày trước',
        iconName: 'calendar',
        iconClass: 'text-amber-500',
      },
    ];

    return {
      project: {
        id: currentProject.id,
        code: currentProject.code,
        name: currentProject.name,
        thumbnailUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
        notificationCount: 3,
      },
      availableProjects,
      expiryAlert: {
        count: 1,
        thresholdDays: 90,
        message: '1 certificate expiring within 90 days',
        linkText: 'Xem chi tiết →',
        linkHref: '#certificates-expiring',
      },
      kpis,
      activeTab: 'certificates',
      certificates,
      totalCertificatesCount: 24,
      pagination: {
        currentPage: 1,
        totalPages: 5,
        pageSize: 5,
        totalItems: 24,
        displayRange: 'Hiển thị 1–5 trong 24 kết quả',
      },
      filterOptions: {
        projects: ['Tất cả dự án', 'The Horizon Residence', 'The Orchard Penthouse', 'Sunrise Mall Food Court', 'Kaffah Headquarters', 'Greenview Boutique Hotel'],
        clients: ['Tất cả khách hàng', 'Trần Minh Anh', 'Bùi Sang', 'Sunrise Mall Management', 'PT Kaffah Properti', 'CV Greenview Resort'],
        statuses: [
          { value: 'all', label: 'Tất cả trạng thái' },
          { value: 'active', label: 'Đang hiệu lực' },
          { value: 'expiring_soon', label: 'Sắp hết hạn' },
          { value: 'expired', label: 'Đã hết hạn' },
        ],
        dateRangeLabel: 'Thời gian: 01/01/2024 – 31/12/2026',
      },
      reassuranceBanner: {
        title: 'Bảo hành an tâm',
        subtitle: 'Đồng hành cùng khách hàng sau bàn giao',
        buttonText: 'Tìm hiểu thêm →',
        buttonHref: '#learn-more-warranty',
        imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/finance/financial-report-cover.jpg',
      },
      calendar: {
        monthLabel: 'Tháng 11/2026',
        daysOfWeek: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
        days: calendarDays,
      },
      roadmap,
      recentActivities,
    };
  }
}
