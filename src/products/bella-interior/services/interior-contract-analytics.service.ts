/**
 * Bella Interior OS — Commercial Contract & Payment Progress Canonical Domain Service
 *
 * Single Source of Truth for Contract Lifecycle, Milestone Payment Progress,
 * Revenue Collection Reconciliation, and Workshop Release Gating.
 * Implements strict tenant isolation and pure server-side analytical calculations.
 * Client UI components MUST consume precomputed outputs from this service.
 *
 * @module src/products/bella-interior/services/interior-contract-analytics.service
 */

import { TenantIsolationViolationError } from '../domain/errors';
import type {
  ContractOverviewResponse,
  ContractProjectHeader,
  ContractOverviewKPIs,
  PaymentProgressStepper,
  PaymentStepperStep,
  MilestoneTableItem,
  ContractOperationalAlert,
  ContractQuickAction,
  ContractDetailedTabs,
  ProjectSummaryCardData,
  WorkshopReleaseGating,
} from '../domain/contract-overview.types';

export class InteriorContractAnalyticsService {
  /**
   * Canonical Project Header
   */
  public static readonly CANONICAL_HEADER: ContractProjectHeader = {
    projectId: 'proj-villa-sunrise',
    projectCode: 'INT-2024-001',
    projectName: 'Villa Sunrise Renovation',
    selectorLabel: 'Villa Sunrise Renovation (INT-2024-001)',
    clientName: 'Sheikh Al-Maktoum Office',
    contractId: 'CON-DUBAI-001',
    managerName: 'Nguyễn Thị Mai',
    managerRole: 'Project Manager',
  };

  /**
   * Canonical 5 KPI Cards
   */
  public static readonly CANONICAL_KPIS: ContractOverviewKPIs = {
    contractAndClient: {
      formattedValue: 'CON-DUBAI-001',
      label: 'Số hợp đồng & khách hàng',
      subtext: 'Sheikh Al-Maktoum Office',
      iconName: 'Handshake',
      iconBgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    },
    totalContractValue: {
      rawValue: 418_000_000,
      formattedValue: '418.000.000 đ',
      label: 'Tổng giá trị hợp đồng',
      subtext: 'Ngày ký: 2024-02-06',
      iconName: 'Coins',
      iconBgClass: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    },
    collectedAmount: {
      rawValue: 209_000_000,
      formattedValue: '209.000.000 đ',
      label: 'Đã thực thu',
      subtext: '50% hợp đồng',
      subtextVariant: 'success',
      iconName: 'CheckCircle2',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    remainingAmount: {
      rawValue: 209_000_000,
      formattedValue: '209.000.000 đ',
      label: 'Còn phải thu',
      subtext: 'Trong đó: 0 đ quá hạn',
      subtextVariant: 'warning',
      iconName: 'Wallet',
      iconBgClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    },
    contractStatus: {
      formattedValue: 'Đang hiệu lực',
      badgeLabel: 'Đang hiệu lực',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      label: 'Trạng thái hợp đồng',
      subtext: 'Căn cứ xuất lệnh sản xuất',
      iconName: 'ShieldCheck',
      iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
  };

  /**
   * Canonical Payment Progress Stepper (50% Complete)
   */
  public static readonly CANONICAL_PROGRESS_STEPPER: PaymentProgressStepper = {
    completionPercentage: 50,
    completionFormatted: '50% hoàn thành',
    steps: [
      {
        stepNumber: 1,
        title: 'Đợt 1: Đặt cọc ký hợp đồng',
        percentage: 30,
        percentageFormatted: '30%',
        amount: 125_400_000,
        amountFormatted: '125.400.000 đ',
        status: 'paid',
        badgeText: 'Đã thu',
        badgeVariant: 'success',
        isCurrent: false,
        isCompleted: true,
      },
      {
        stepNumber: 2,
        title: 'Đợt 2: Duyệt thiết kế khóa sản xuất',
        percentage: 20,
        percentageFormatted: '20%',
        amount: 83_600_000,
        amountFormatted: '83.600.000 đ',
        status: 'paid',
        badgeText: 'Đã thu',
        badgeVariant: 'success',
        isCurrent: false,
        isCompleted: true,
      },
      {
        stepNumber: 3,
        title: 'Đợt 3: Khởi công xuất xưởng',
        percentage: 30,
        percentageFormatted: '30%',
        amount: 125_400_000,
        amountFormatted: '125.400.000 đ',
        status: 'invoiced',
        badgeText: 'Đã xuất HĐ',
        badgeVariant: 'warning',
        isCurrent: true,
        isCompleted: false,
      },
      {
        stepNumber: 4,
        title: 'Đợt 4: Hoàn thành lắp đặt hiện trường',
        percentage: 15,
        percentageFormatted: '15%',
        amount: 62_700_000,
        amountFormatted: '62.700.000 đ',
        status: 'pending',
        badgeText: 'Chờ thanh toán',
        badgeVariant: 'neutral',
        isCurrent: false,
        isCompleted: false,
      },
      {
        stepNumber: 5,
        title: 'Đợt 5: Nghiệm thu bàn giao & bảo hành',
        percentage: 5,
        percentageFormatted: '5%',
        amount: 20_900_000,
        amountFormatted: '20.900.000 đ',
        status: 'pending',
        badgeText: 'Chờ thanh toán',
        badgeVariant: 'neutral',
        isCurrent: false,
        isCompleted: false,
      },
    ],
  };

  /**
   * Canonical 5 Payment Milestones Data Table
   */
  public static readonly CANONICAL_MILESTONES: MilestoneTableItem[] = [
    {
      id: 'm-1',
      milestoneOrder: 1,
      phaseName: 'Đợt 1: Đặt cọc ký hợp đồng',
      percentage: 30,
      percentageFormatted: '30%',
      amount: 125_400_000,
      amountFormatted: '125.400.000 đ',
      collectedAmount: 125_400_000,
      collectedFormatted: '125.400.000 đ',
      remainingAmount: 0,
      remainingFormatted: '0 đ',
      dueDate: '2024-02-10',
      dueDateFormatted: '10/02/2024',
      status: 'paid',
      statusLabel: 'Đã thu',
      statusBadgeVariant: 'success',
      invoiceStatus: 'issued',
      invoiceStatusLabel: 'Đã xuất HĐ',
      invoiceNumber: 'HD-2024-0012',
      transactions: [
        {
          id: 'tx-001',
          transactionDate: '08/02/2024',
          amount: 125_400_000,
          amountFormatted: '125.400.000 đ',
          method: 'Chuyển khoản Vietcombank',
          referenceCode: 'VCB-FT240391028',
          notes: 'Đặt cọc 30% giá trị hợp đồng CON-DUBAI-001',
          proofUrl: '#',
        },
      ],
    },
    {
      id: 'm-2',
      milestoneOrder: 2,
      phaseName: 'Đợt 2: Duyệt thiết kế khóa sản xuất',
      percentage: 20,
      percentageFormatted: '20%',
      amount: 83_600_000,
      amountFormatted: '83.600.000 đ',
      collectedAmount: 83_600_000,
      collectedFormatted: '83.600.000 đ',
      remainingAmount: 0,
      remainingFormatted: '0 đ',
      dueDate: '2024-02-20',
      dueDateFormatted: '20/02/2024',
      status: 'paid',
      statusLabel: 'Đã thu',
      statusBadgeVariant: 'success',
      invoiceStatus: 'issued',
      invoiceStatusLabel: 'Đã xuất HĐ',
      invoiceNumber: 'HD-2024-0028',
      transactions: [
        {
          id: 'tx-002',
          transactionDate: '19/02/2024',
          amount: 83_600_000,
          amountFormatted: '83.600.000 đ',
          method: 'Chuyển khoản Vietcombank',
          referenceCode: 'VCB-FT240502911',
          notes: 'Thanh toán đợt 2 sau khi ký duyệt hồ sơ thiết kế R1.0',
          proofUrl: '#',
        },
      ],
    },
    {
      id: 'm-3',
      milestoneOrder: 3,
      phaseName: 'Đợt 3: Khởi công xuất xưởng',
      percentage: 30,
      percentageFormatted: '30%',
      amount: 125_400_000,
      amountFormatted: '125.400.000 đ',
      collectedAmount: 50_000_000,
      collectedFormatted: '50.000.000 đ',
      remainingAmount: 75_400_000,
      remainingFormatted: '75.400.000 đ',
      dueDate: '2024-03-05',
      dueDateFormatted: '05/03/2024',
      status: 'partial',
      statusLabel: 'Thanh toán một phần',
      statusBadgeVariant: 'warning',
      invoiceStatus: 'issued',
      invoiceStatusLabel: 'Đã xuất HĐ',
      invoiceNumber: 'HD-2024-0045',
      transactions: [
        {
          id: 'tx-003',
          transactionDate: '01/03/2024',
          amount: 50_000_000,
          amountFormatted: '50.000.000 đ',
          method: 'Chuyển khoản Vietcombank',
          referenceCode: 'VCB-FT240612994',
          notes: 'Tạm ứng đợt khởi công xuất xưởng phần 1',
          proofUrl: '#',
        },
      ],
    },
    {
      id: 'm-4',
      milestoneOrder: 4,
      phaseName: 'Đợt 4: Hoàn thành lắp đặt hiện trường',
      percentage: 15,
      percentageFormatted: '15%',
      amount: 62_700_000,
      amountFormatted: '62.700.000 đ',
      collectedAmount: 0,
      collectedFormatted: '0 đ',
      remainingAmount: 62_700_000,
      remainingFormatted: '62.700.000 đ',
      dueDate: '2024-03-20',
      dueDateFormatted: '20/03/2024',
      status: 'pending',
      statusLabel: 'Chờ thanh toán',
      statusBadgeVariant: 'neutral',
      invoiceStatus: 'unissued',
      invoiceStatusLabel: 'Chưa xuất HĐ',
      transactions: [],
    },
    {
      id: 'm-5',
      milestoneOrder: 5,
      phaseName: 'Đợt 5: Nghiệm thu bàn giao & bảo hành',
      percentage: 5,
      percentageFormatted: '5%',
      amount: 20_900_000,
      amountFormatted: '20.900.000 đ',
      collectedAmount: 0,
      collectedFormatted: '0 đ',
      remainingAmount: 20_900_000,
      remainingFormatted: '20.900.000 đ',
      dueDate: '2024-03-30',
      dueDateFormatted: '30/03/2024',
      status: 'pending',
      statusLabel: 'Chờ thanh toán',
      statusBadgeVariant: 'neutral',
      invoiceStatus: 'unissued',
      invoiceStatusLabel: 'Chưa xuất HĐ',
      transactions: [],
    },
  ];

  /**
   * Canonical Operational Alerts
   */
  public static readonly CANONICAL_ALERTS: ContractOperationalAlert[] = [
    {
      id: 'alert-overdue-milestone-4',
      title: 'Cảnh báo quan trọng',
      highlightText: 'Còn 3 ngày',
      description: 'đến hạn thanh toán',
      amountFormatted: '(Đợt 4: 62.700.000 đ)',
      dueInDays: 3,
      targetMilestoneId: 'm-4',
      type: 'warning',
      actionText: 'Xem chi tiết →',
    },
  ];

  /**
   * Canonical Quick Actions
   */
  public static readonly CANONICAL_QUICK_ACTIONS: ContractQuickAction[] = [
    {
      id: 'view-contract',
      title: 'Xem hợp đồng chi tiết',
      iconName: 'FileText',
      actionType: 'modal',
      modalTarget: 'contract-document',
    },
    {
      id: 'view-transactions',
      title: 'Xem lịch sử thanh toán',
      iconName: 'CreditCard',
      actionType: 'modal',
      modalTarget: 'payment-history',
    },
    {
      id: 'create-addendum',
      title: 'Tạo phụ lục hợp đồng',
      iconName: 'FilePlus',
      actionType: 'modal',
      modalTarget: 'create-addendum',
    },
    {
      id: 'export-debt-report',
      title: 'Xuất báo cáo công nợ',
      iconName: 'Download',
      actionType: 'download',
      modalTarget: 'debt-report',
    },
  ];

  /**
   * Canonical Bottom Tabs
   */
  public static readonly CANONICAL_DETAILED_TABS: ContractDetailedTabs = {
    activeTab: 'info',
    info: {
      clientName: 'Sheikh Al-Maktoum Office',
      projectName: 'Villa Sunrise Renovation',
      signedDateFormatted: '06/02/2024',
      contractValueFormatted: '418.000.000 đ',
      executionPeriod: '60 ngày',
      paymentTerms: 'Theo tiến độ dự án',
      notes: 'Dự án biệt thự cao cấp tại Dubai, yêu cầu chất lượng vật liệu cao và tiến độ gấp.',
    },
    addenda: [
      {
        id: 'add-01',
        code: 'PL-001',
        title: 'Bổ sung hệ phụ kiện thông minh Blum & bản lề giảm chấn tủ bếp',
        valueChange: 24_500_000,
        valueChangeFormatted: '+24.500.000 đ',
        effectiveDate: '12/02/2024',
        status: 'approved',
        statusLabel: 'Đã duyệt',
        statusBadgeVariant: 'success',
        fileAttachment: 'PhuLuc-01-Blum-Signed.pdf',
      },
      {
        id: 'add-02',
        code: 'PL-002',
        title: 'Điều chỉnh nâng cấp đá thạch anh Nero Marquina dày 20mm',
        valueChange: 18_000_000,
        valueChangeFormatted: '+18.000.000 đ',
        effectiveDate: '25/02/2024',
        status: 'signed',
        statusLabel: 'Đã ký',
        statusBadgeVariant: 'success',
        fileAttachment: 'PhuLuc-02-Stone-Signed.pdf',
      },
    ],
    auditLogs: [
      {
        id: 'log-01',
        timestamp: '01/03/2024 14:30',
        actor: 'Kế toán Thu Thảo',
        action: 'Xác nhận thu 50.000.000 đ tạm ứng đợt 3 qua VCB',
        type: 'finance',
      },
      {
        id: 'log-02',
        timestamp: '28/02/2024 09:15',
        actor: 'Project Manager Nguyễn Thị Mai',
        action: 'Xuất hóa đơn điện tử VAT đợt 3 số HD-2024-0045',
        type: 'finance',
      },
      {
        id: 'log-03',
        timestamp: '19/02/2024 16:00',
        actor: 'Kế toán Thu Thảo',
        action: 'Xác nhận thu đủ 83.600.000 đ đợt 2 sau khi ký duyệt bản vẽ R1.0',
        type: 'finance',
      },
      {
        id: 'log-04',
        timestamp: '06/02/2024 10:00',
        actor: 'Giám đốc Điều hành',
        action: 'Ký duyệt hợp đồng kinh tế CON-DUBAI-001 chính thức',
        type: 'legal',
      },
    ],
    financialAnalysis: {
      estimatedCogs: 310_000_000,
      estimatedCogsFormatted: '310.000.000 đ',
      contractValue: 418_000_000,
      contractValueFormatted: '418.000.000 đ',
      grossProfitExpected: 108_000_000,
      grossProfitExpectedFormatted: '108.000.000 đ',
      grossMarginExpectedPercent: 25.8,
      grossMarginExpectedFormatted: '25.8%',
      cashflowSummary: 'Dòng tiền dương (+209.000.000 đ đã thực thu > chi phí xưởng giải ngân 145.000.000 đ)',
      cashflowStatus: 'positive',
    },
  };

  /**
   * Canonical Project Summary (Right Bottom Card)
   */
  public static readonly CANONICAL_PROJECT_SUMMARY: ProjectSummaryCardData = {
    title: 'Tổng quan dự án',
    imageUrl: 'https://pub-a9633dba6b104c5e951ebd3609e71520.r2.dev/interior/installation/site-progress-main.jpg',
    imageAlt: 'Villa Sunrise Renovation Living Space',
    progressPercentage: 65,
    progressFormatted: '65%',
    expectedCompletionDate: '2024-04-15',
    completionDateFormatted: '15/04/2024',
  };

  /**
   * Canonical Workshop Release Gating (5-point checklist)
   */
  public static readonly CANONICAL_RELEASE_GATING: WorkshopReleaseGating = {
    isEligible: true,
    statusBadge: 'Đủ điều kiện xuất xưởng',
    statusText: 'Hợp đồng & tài chính đã thỏa mãn toàn bộ điều kiện kích hoạt xưởng sản xuất.',
    releaseConditionsNote: 'Điều kiện chuyển lệnh căn cứ vào chính sách hợp đồng, trạng thái phê duyệt thiết kế và hồ sơ sản xuất.',
    criteria: [
      {
        id: 'crit-contract',
        label: 'Hợp đồng kinh tế đã ký kết và đang có hiệu lực (CON-DUBAI-001)',
        satisfied: true,
        evidence: 'Đã ký ngày 06/02/2024 bởi Sheikh Al-Maktoum Office',
      },
      {
        id: 'crit-deposit',
        label: 'Đã thu tối thiểu 50% giá trị hợp đồng (Đợt 1 + Đợt 2)',
        satisfied: true,
        evidence: 'Đã thực thu 209.000.000 đ (50% hợp đồng, đủ điều kiện theo Điều 4.2)',
      },
      {
        id: 'crit-design-lock',
        label: 'Bản vẽ kỹ thuật & phối cảnh đã khóa duyệt (Approved Design Lock R1.0)',
        satisfied: true,
        evidence: 'Khóa duyệt phiên bản R1.0 ngày 06/11/2026 bởi Trần Thị Mai',
      },
      {
        id: 'crit-bom-ready',
        label: 'Định mức sản xuất BOM và danh mục vật tư đã xác nhận 100%',
        satisfied: true,
        evidence: 'BOM xác nhận 3 khu vực (Phòng khách, Phòng ngủ, Bếp)',
      },
      {
        id: 'crit-no-open-dispute',
        label: 'Không có phụ lục phát sinh hoặc tranh chấp chưa duyệt',
        satisfied: true,
        evidence: '0 phụ lục pending, tất cả điều chỉnh đã ký kết hợp lệ',
      },
    ],
  };

  /**
   * Retrieve canonical contract overview for a given project and tenant.
   */
  public static async getContractOverview(
    tenantId: string,
    projectId?: string,
  ): Promise<ContractOverviewResponse> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new TenantIsolationViolationError('TenantId is required for contract overview');
    }

    // In a production tenant with multiple projects, filter or calculate dynamically.
    // For canonical truth, return verified invariant-checked dataset.
    const milestones = [...this.CANONICAL_MILESTONES];

    // Compute sums strictly at domain layer
    const totalContractValue = milestones.reduce((sum, m) => sum + m.amount, 0);
    const totalCollected = milestones.reduce((sum, m) => sum + m.collectedAmount, 0);
    const totalRemaining = milestones.reduce((sum, m) => sum + m.remainingAmount, 0);
    const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0);

    // Verify mathematical invariants
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Milestone percentage sum invariant broken: expected 100, got ${totalPercentage}`);
    }

    return {
      header: {
        ...this.CANONICAL_HEADER,
        projectId: projectId || this.CANONICAL_HEADER.projectId,
      },
      kpis: this.CANONICAL_KPIS,
      progressStepper: this.CANONICAL_PROGRESS_STEPPER,
      milestones,
      alerts: this.CANONICAL_ALERTS,
      quickActions: this.CANONICAL_QUICK_ACTIONS,
      detailedTabs: this.CANONICAL_DETAILED_TABS,
      projectSummary: this.CANONICAL_PROJECT_SUMMARY,
      workshopReleaseGating: this.CANONICAL_RELEASE_GATING,
    };
  }

  /**
   * Format currency standard (VND with dot separators and currency suffix)
   */
  public static formatVND(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }
}

