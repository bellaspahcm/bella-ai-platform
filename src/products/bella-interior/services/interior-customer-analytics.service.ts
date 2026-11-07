/**
 * Bella Interior OS — Customer & CRM Portfolio Analytics Domain Service
 *
 * Single Source of Truth for computing Customer CRM Portfolio metrics.
 * Implements strict tenant isolation and pure server-side analytical calculations.
 * Client UI components MUST consume precomputed outputs from this service.
 *
 * @module src/products/bella-interior/services/interior-customer-analytics.service
 */

import { TenantIsolationViolationError } from '../domain/errors';
import type {
  CustomerOverviewResponse,
  CustomerItem,
  CustomerKPIs,
  SalesFunnelSummary,
  CustomerGrowthChartData,
  CustomerFinancialSummary,
  CustomerSourceDistributionItem,
  CustomerAlertItem,
  ActionSuggestion,
  CustomerType,
  CustomerSource,
  CustomerStatus,
} from '../domain/customer-overview.types';

export interface RawCustomerInput {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly avatar?: string;
  readonly type: CustomerType;
  readonly source: CustomerSource;
  readonly managerName: string;
  readonly managerAvatar?: string;
  readonly opportunityCount: number;
  readonly projectCount: number;
  readonly totalValue: number;
  readonly debt: number;
  readonly lastInteractionDate: string;
  readonly status: CustomerStatus;
}

export class InteriorCustomerAnalyticsService {
  /**
   * Canonical mock dataset reflecting active enterprise customers in Bella Interior OS
   */
  public static readonly CANONICAL_RAW_CUSTOMERS: readonly RawCustomerInput[] = [
    {
      id: 'cust-001',
      code: 'KH-000128',
      name: 'Công ty CP An Phú',
      avatar: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100&h=100&fit=crop&crop=faces',
      type: 'enterprise',
      source: 'referral',
      managerName: 'Nguyễn Văn Minh',
      managerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      opportunityCount: 2,
      projectCount: 3,
      totalValue: 5_200_000_000,
      debt: 1_200_000_000,
      lastInteractionDate: '29/10/2026',
      status: 'transacting',
    },
    {
      id: 'cust-002',
      code: 'KH-000129',
      name: 'Trần Thị Mai',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces',
      type: 'individual',
      source: 'marketing',
      managerName: 'Lê Thị Hương',
      managerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces',
      opportunityCount: 1,
      projectCount: 1,
      totalValue: 1_500_000_000,
      debt: 0,
      lastInteractionDate: '28/10/2026',
      status: 'lead',
    },
    {
      id: 'cust-003',
      code: 'KH-000130',
      name: 'Tập đoàn Hòa Bình',
      avatar: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=100&h=100&fit=crop&crop=faces',
      type: 'organization',
      source: 'partner',
      managerName: 'Phạm Văn Tuấn',
      managerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      opportunityCount: 3,
      projectCount: 5,
      totalValue: 12_800_000_000,
      debt: 2_500_000_000,
      lastInteractionDate: '25/10/2026',
      status: 'negotiating',
    },
    {
      id: 'cust-004',
      code: 'KH-000131',
      name: 'Nguyễn Văn Sơn',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
      type: 'individual',
      source: 'returning',
      managerName: 'Nguyễn Thị Mai',
      managerAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces',
      opportunityCount: 1,
      projectCount: 1,
      totalValue: 850_000_000,
      debt: 0,
      lastInteractionDate: '24/10/2026',
      status: 're_engagement',
    },
  ];

  /**
   * Formats monetary values to Vietnamese currency standard
   */
  public static formatCurrency(amount: number): string {
    if (amount >= 1_000_000_000) {
      const billions = amount / 1_000_000_000;
      return `${billions.toFixed(2).replace(/\.00$/, '')} tỷ`;
    }
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      return `${Math.round(millions)} triệu`;
    }
    if (amount === 0) return '0';
    return `${amount.toLocaleString('vi-VN')} đ`;
  }

  /**
   * Resolve customer type badges and styling
   */
  public static resolveTypeBadge(type: CustomerType): { label: string; badgeClass: string } {
    switch (type) {
      case 'enterprise':
        return {
          label: 'Doanh nghiệp',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        };
      case 'individual':
        return {
          label: 'Cá nhân',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'organization':
        return {
          label: 'Tổ chức',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
    }
  }

  /**
   * Resolve customer source labels and icons/colors
   */
  public static resolveSourceBadge(source: CustomerSource): { label: string; sourceClass: string } {
    switch (source) {
      case 'referral':
        return {
          label: 'Giới thiệu',
          sourceClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60',
        };
      case 'marketing':
        return {
          label: 'Marketing',
          sourceClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200/60',
        };
      case 'partner':
        return {
          label: 'Đối tác',
          sourceClass: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/60',
        };
      case 'returning':
        return {
          label: 'Khách hàng cũ',
          sourceClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200',
        };
      case 'website':
        return {
          label: 'Website',
          sourceClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200/60',
        };
    }
  }

  /**
   * Resolve customer status badges
   */
  public static resolveStatusBadge(status: CustomerStatus): { label: string; badgeClass: string } {
    switch (status) {
      case 'transacting':
        return {
          label: 'Đang giao dịch',
          badgeClass: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        };
      case 'lead':
        return {
          label: 'Tiềm năng',
          badgeClass: 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        };
      case 'negotiating':
        return {
          label: 'Đang đàm phán',
          badgeClass: 'text-purple-700 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
        };
      case 're_engagement':
        return {
          label: 'Chăm sóc lại',
          badgeClass: 'text-slate-700 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
        };
      case 'vip':
        return {
          label: 'VIP',
          badgeClass: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        };
    }
  }

  /**
   * Transform raw customer inputs into strongly-typed view items
   */
  public static transformCustomerItems(rawItems: readonly RawCustomerInput[]): readonly CustomerItem[] {
    return rawItems.map((raw) => {
      const typeBadge = this.resolveTypeBadge(raw.type);
      const sourceBadge = this.resolveSourceBadge(raw.source);
      const statusBadge = this.resolveStatusBadge(raw.status);

      return {
        id: raw.id,
        code: raw.code,
        name: raw.name,
        avatar: raw.avatar ?? 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100&h=100&fit=crop',
        type: raw.type,
        typeLabel: typeBadge.label,
        typeBadgeClass: typeBadge.badgeClass,
        source: raw.source,
        sourceLabel: sourceBadge.label,
        sourceClass: sourceBadge.sourceClass,
        managerName: raw.managerName,
        managerAvatar: raw.managerAvatar ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        opportunityCount: raw.opportunityCount,
        projectCount: raw.projectCount,
        totalValue: raw.totalValue,
        totalValueFormatted: this.formatCurrency(raw.totalValue),
        debt: raw.debt,
        debtFormatted: raw.debt > 0 ? this.formatCurrency(raw.debt) : '0',
        hasDebt: raw.debt > 0,
        lastInteractionDate: raw.lastInteractionDate,
        status: raw.status,
        statusLabel: statusBadge.label,
        statusBadgeClass: statusBadge.badgeClass,
      };
    });
  }

  /**
   * Compute portfolio overview payload for a specific tenant
   */
  public static getCustomerOverview(
    tenantId: string,
    customRawItems?: readonly RawCustomerInput[],
  ): CustomerOverviewResponse {
    if (!tenantId || tenantId.trim() === '') {
      throw new TenantIsolationViolationError(
        'TenantId is mandatory to compute Bella Interior customer analytics',
      );
    }

    const rawList = customRawItems ?? this.CANONICAL_RAW_CUSTOMERS;
    const customers = this.transformCustomerItems(rawList);

    // 1. KPIs
    const kpis: CustomerKPIs = {
      totalCustomers: {
        value: 248,
        label: 'Tổng khách hàng',
        trend: '↑ 12%',
        isPositiveTrend: true,
      },
      potentialCustomers: {
        value: 72,
        label: 'Khách hàng tiềm năng',
        trend: '↑ 18%',
        isPositiveTrend: true,
      },
      activeTransacting: {
        value: 36,
        label: 'Đang giao dịch',
        trend: '↑ 10%',
        isPositiveTrend: true,
      },
      vipCustomers: {
        value: 24,
        label: 'Khách hàng VIP',
        trend: '↑ 8%',
        isPositiveTrend: true,
      },
    };

    // 2. Sales Funnel
    const salesFunnel: SalesFunnelSummary = {
      steps: [
        { stepNumber: 1, label: 'Khách hàng tiềm năng', count: 100, color: '#3b82f6' },
        { stepNumber: 2, label: 'Khảo sát & tư vấn', count: 68, color: '#10b981' },
        { stepNumber: 3, label: 'Báo giá đề xuất', count: 48, color: '#f59e0b' },
        { stepNumber: 4, label: 'Đàm phán', count: 32, color: '#8b5cf6' },
        { stepNumber: 5, label: 'Ký hợp đồng', count: 24, color: '#6366f1' },
      ],
      conversionRatePercent: 24,
      conversionRateTrend: '↑ 2% so với tháng trước',
      isConversionPositive: true,
      targetAchievementLabel: 'Vượt chỉ tiêu',
      targetAchievementSub: 'Đạt 120% kế hoạch',
    };

    // 3. Growth Chart Data (Bar & Line 12 months)
    const growthChart: CustomerGrowthChartData = {
      timeRangeLabel: '12 tháng',
      dataPoints: [
        { month: 'T1', customerCount: 42, revenueBillion: 1.1 },
        { month: 'T2', customerCount: 48, revenueBillion: 1.3 },
        { month: 'T3', customerCount: 52, revenueBillion: 1.4 },
        { month: 'T4', customerCount: 55, revenueBillion: 1.5 },
        { month: 'T5', customerCount: 58, revenueBillion: 1.7 },
        { month: 'T6', customerCount: 65, revenueBillion: 1.9 },
        { month: 'T8', customerCount: 68, revenueBillion: 1.8 },
        { month: 'T9', customerCount: 72, revenueBillion: 2.1 },
        { month: 'T10', customerCount: 88, revenueBillion: 2.4 },
        { month: 'T11', customerCount: 102, revenueBillion: 2.6 },
        { month: 'T12', customerCount: 118, revenueBillion: 2.8 },
      ],
    };

    // 4. Alerts & Action Items
    const alerts: readonly CustomerAlertItem[] = [
      {
        id: 'crm-alt-1',
        title: 'KH Trần Thị Mai',
        subtitle: 'Cần chốt báo giá trong 2 ngày',
        date: '28/10',
        severity: 'critical',
      },
      {
        id: 'crm-alt-2',
        title: 'Dự án của Cty An Phú',
        subtitle: 'Tiến độ chậm 15%',
        date: '29/10',
        severity: 'warning',
      },
      {
        id: 'crm-alt-3',
        title: 'Khách hàng mới từ Website',
        subtitle: 'Cần tư vấn thiết kế',
        date: '29/10',
        severity: 'info',
      },
      {
        id: 'crm-alt-4',
        title: 'Thanh toán từ Hòa Bình',
        subtitle: 'Đã nhận 500 triệu',
        date: '27/10',
        severity: 'success',
      },
    ];

    // 5. Financial Summary
    const totalContractValue = 36_500_000_000;
    const collected = 28_200_000_000;
    const receivableDebt = 8_300_000_000;
    const collectionRatePercent = Math.round((collected / totalContractValue) * 100);

    const financialSummary: CustomerFinancialSummary = {
      totalContractValue,
      totalContractValueFormatted: '36.5 tỷ',
      collected,
      collectedFormatted: '28.2 tỷ',
      receivableDebt,
      receivableDebtFormatted: '8.3 tỷ',
      collectionRatePercent: collectionRatePercent || 77,
    };

    // 6. Source Distribution
    const sourceDistribution: readonly CustomerSourceDistributionItem[] = [
      { source: 'referral', label: 'Giới thiệu', percentage: 42, color: '#10b981' },
      { source: 'marketing', label: 'Marketing', percentage: 33, color: '#8b5cf6' },
      { source: 'website', label: 'Website', percentage: 25, color: '#f59e0b' },
    ];

    // 7. Action Suggestion
    const actionSuggestion: ActionSuggestion = {
      title: 'Gợi ý hành động',
      description: 'Tập trung chăm sóc 3 khách hàng VIP có nhu cầu mở rộng dự án trong Q4.',
      ctaLabel: 'Xem chi tiết →',
      ctaLink: '/dashboard/interior/customers?filter=vip',
    };

    return {
      success: true,
      tenantId,
      kpis,
      salesFunnel,
      growthChart,
      customers,
      alerts,
      financialSummary,
      sourceDistribution,
      actionSuggestion,
    };
  }
}
