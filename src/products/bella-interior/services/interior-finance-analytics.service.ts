/**
 * Bella Interior OS — Canonical Project Finance Analytics Service
 *
 * Source of Truth for Project Finance & P&L metrics:
 * - Aggregates contract values, COGS, gross margins, and debt ageing.
 * - Produces pre-computed coordinates, formatting, and colors for zero-calculation UI.
 *
 * @module src/products/bella-interior/services/interior-finance-analytics.service
 */

import type {
  FinanceOverviewResponse,
  ProjectPLItem,
  FinancialPerformanceBar,
  CashFlowPoint,
} from '../domain/finance-overview.types';

export class InteriorFinanceAnalyticsService {
  /**
   * Currency formatter for Vietnamese Dong
   */
  public static formatVND(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
  }

  /**
   * Compact currency formatter (Tỷ, Triệu)
   */
  public static formatCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) {
      return (value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' Tỷ';
    }
    if (Math.abs(value) >= 1_000_000) {
      return (value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' Triệu';
    }
    return this.formatVND(value);
  }

  /**
   * Base Raw Project Portfolio Data matching executive accounting ledger
   */
  private static getRawProjects() {
    return [
      {
        id: 'P-001',
        projectName: 'Villa Harmonia',
        clientName: 'Siti Rahayu',
        contractRevenue: 850_000_000,
        cogs: 468_000_000,
        cashCollected: 680_000_000,
      },
      {
        id: 'P-002',
        projectName: 'Kaffah Office Tower',
        clientName: 'PT Kaffah Properti',
        contractRevenue: 1_200_000_000,
        cogs: 725_000_000,
        cashCollected: 960_000_000,
      },
      {
        id: 'P-003',
        projectName: 'The Orchard Penthouse',
        clientName: 'Budi Santoso',
        contractRevenue: 480_000_000,
        cogs: 315_000_000,
        cashCollected: 480_000_000,
      },
      {
        id: 'P-004',
        projectName: 'Greenview Boutique Hotel***',
        clientName: 'CV Greenview Resort',
        contractRevenue: 630_000_000,
        cogs: 440_000_000,
        cashCollected: 315_000_000,
      },
      {
        id: 'P-005',
        projectName: 'Sunrise Mall Food Court',
        clientName: 'Sunrise Mall Management',
        contractRevenue: 390_000_000,
        cogs: 273_000_000,
        cashCollected: 390_000_000,
      },
    ];
  }

  /**
   * Retrieves full Canonical Finance Overview
   */
  public static getFinanceOverview(quarter = 'Quý 4/2026'): FinanceOverviewResponse {
    const rawProjects = this.getRawProjects();

    // 1. Compute Projects Table
    const projects: ProjectPLItem[] = rawProjects.map((p) => {
      const grossProfit = p.contractRevenue - p.cogs;
      const marginPercent = p.contractRevenue > 0 ? (grossProfit / p.contractRevenue) * 100 : 0;
      const outstandingDebt = p.contractRevenue - p.cashCollected;
      const hasOutstandingDebt = outstandingDebt > 0;

      let marginBadgeVariant: 'high' | 'medium' | 'low' = 'medium';
      let marginBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      if (marginPercent >= 40) {
        marginBadgeVariant = 'high';
        marginBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 font-bold';
      } else if (marginPercent < 32) {
        marginBadgeVariant = 'low';
        marginBadgeClass = 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      }

      return {
        id: p.id,
        projectName: p.projectName,
        clientName: p.clientName,
        contractRevenue: p.contractRevenue,
        contractRevenueFormatted: this.formatVND(p.contractRevenue),
        cogs: p.cogs,
        cogsFormatted: this.formatVND(p.cogs),
        grossProfit,
        grossProfitFormatted: this.formatVND(grossProfit),
        marginPercent: Number(marginPercent.toFixed(1)),
        marginFormatted: marginPercent.toFixed(1).replace('.', ',') + '%',
        marginBadgeVariant,
        marginBadgeClass,
        cashCollected: p.cashCollected,
        cashCollectedFormatted: this.formatVND(p.cashCollected),
        outstandingDebt,
        outstandingDebtFormatted: hasOutstandingDebt ? this.formatVND(outstandingDebt) : '0',
        hasOutstandingDebt,
        debtColorClass: hasOutstandingDebt ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400 dark:text-slate-500',
      };
    });

    // 2. Aggregate Portfolio Totals
    const totalRevenue = rawProjects.reduce((sum, p) => sum + p.contractRevenue, 0); // 3.550.000.000
    const totalCogs = rawProjects.reduce((sum, p) => sum + p.cogs, 0); // 2.221.000.000
    const totalGrossProfit = totalRevenue - totalCogs; // 1.329.000.000
    const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0; // 37.436% -> 37,4%
    const totalDebt = rawProjects.reduce((sum, p) => sum + (p.contractRevenue - p.cashCollected), 0); // 725.000.000

    // 3. Top KPI Cards
    const kpis = {
      contractRevenue: {
        rawValue: totalRevenue,
        formattedValue: this.formatVND(totalRevenue),
        label: 'Giá trị hợp đồng',
        subtext: '↑ 12% so với quý trước',
        subtextVariant: 'positive' as const,
        iconName: 'folder-kanban' as const,
        iconBgColor: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        iconColor: 'text-blue-600 dark:text-blue-400',
      },
      totalCogs: {
        rawValue: totalCogs,
        formattedValue: this.formatVND(totalCogs),
        label: 'Tổng giá vốn',
        subtext: '↑ 8% so với quý trước',
        subtextVariant: 'positive' as const,
        iconName: 'layers' as const,
        iconBgColor: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
        iconColor: 'text-purple-600 dark:text-purple-400',
      },
      grossProfit: {
        rawValue: totalGrossProfit,
        formattedValue: this.formatVND(totalGrossProfit),
        label: 'Lợi nhuận gộp',
        subtext: '↑ 15% so với quý trước',
        subtextVariant: 'positive' as const,
        iconName: 'trending-up' as const,
        iconBgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      },
      grossMargin: {
        rawValue: Number(overallMargin.toFixed(1)),
        formattedValue: overallMargin.toFixed(1).replace('.', ',') + '%',
        label: 'Biên lợi nhuận',
        subtext: '↑ 1,2%',
        subtextVariant: 'positive' as const,
        iconName: 'percent' as const,
        iconBgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        iconColor: 'text-amber-600 dark:text-amber-400',
      },
    };

    // 4. Financial Performance Section (3 months: T10, T11, T12; Max ceiling 4T)
    const maxCeiling = 4_000_000_000;
    const rawBars = [
      { month: 'Tháng 10', revenue: 3_000_000_000, cost: 2_100_000_000, profit: 900_000_000 },
      { month: 'Tháng 11', revenue: 3_100_000_000, cost: 2_150_000_000, profit: 950_000_000 },
      { month: 'Tháng 12', revenue: 3_250_000_000, cost: 2_221_000_000, profit: 1_029_000_000 },
    ];

    const bars: FinancialPerformanceBar[] = rawBars.map((b) => ({
      month: b.month,
      revenue: b.revenue,
      revenueFormatted: this.formatCompact(b.revenue),
      revenueHeightPercent: Math.round((b.revenue / maxCeiling) * 100),
      cost: b.cost,
      costFormatted: this.formatCompact(b.cost),
      costHeightPercent: Math.round((b.cost / maxCeiling) * 100),
      profit: b.profit,
      profitFormatted: this.formatCompact(b.profit),
      profitHeightPercent: Math.round((b.profit / maxCeiling) * 100),
    }));

    const financialPerformance = {
      selectedPeriod: '3_months' as const,
      availablePeriods: [
        { key: '3_months' as const, label: '3 tháng' },
        { key: '6_months' as const, label: '6 tháng' },
        { key: '1_year' as const, label: '1 năm' },
      ],
      yAxisLabels: ['4T', '3T', '2T', '1T', '0'],
      bars,
      legend: [
        { label: 'Doanh thu', color: '#10B981' }, // Emerald
        { label: 'Chi phí', color: '#3B82F6' }, // Blue
        { label: 'Lợi nhuận', color: '#F59E0B' }, // Amber
      ],
    };

    // 5. COGS Structure (Total: 2.22 Tỷ)
    // 70% Material (Blue), 30% Labor (Emerald), 0% Other (Slate)
    // SVG Donut circumference = 2 * PI * 40 = 251.327
    const circumference = 251.327;
    const materialLength = circumference * 0.7; // ~175.9
    const laborLength = circumference * 0.3; // ~75.4

    const cogsStructure = {
      totalCogsFormatted: '2,22 Tỷ',
      centerSublabel: 'Tổng giá vốn',
      items: [
        {
          id: 'materials',
          label: 'Vật liệu',
          percentage: 70.0,
          percentageFormatted: '70,0%',
          amount: 1_554_700_000,
          amountFormatted: '1.554.700.000 ₫',
          color: '#3B82F6',
          dashArray: `${materialLength.toFixed(1)} ${circumference.toFixed(1)}`,
          dashOffset: '0',
        },
        {
          id: 'labor',
          label: 'Nhân công',
          percentage: 30.0,
          percentageFormatted: '30,0%',
          amount: 666_300_000,
          amountFormatted: '666.300.000 ₫',
          color: '#10B981',
          dashArray: `${laborLength.toFixed(1)} ${circumference.toFixed(1)}`,
          dashOffset: `-${materialLength.toFixed(1)}`,
        },
        {
          id: 'other',
          label: 'Khác',
          percentage: 0.0,
          percentageFormatted: '0,0%',
          amount: 0,
          amountFormatted: '0 ₫',
          color: '#94A3B8',
          dashArray: `0 ${circumference.toFixed(1)}`,
          dashOffset: '0',
        },
      ],
    };

    // 6. Cash Flow Section (6 months trajectory: T7 -> T12)
    // Ceiling 3T
    const cfMaxCeiling = 3_000_000_000;
    const rawPoints = [
      { month: 'Tháng 7', collected: 1_500_000_000, cost: 1_000_000_000, xPercent: 10 },
      { month: 'Tháng 8', collected: 2_100_000_000, cost: 1_400_000_000, xPercent: 26 },
      { month: 'Tháng 9', collected: 1_950_000_000, cost: 1_350_000_000, xPercent: 42 },
      { month: 'Tháng 10', collected: 2_300_000_000, cost: 1_750_000_000, xPercent: 58 },
      { month: 'Tháng 11', collected: 2_450_000_000, cost: 1_900_000_000, xPercent: 74 },
      { month: 'Tháng 12', collected: 2_950_000_000, cost: 2_350_000_000, xPercent: 90 },
    ];

    const cashFlowPoints: CashFlowPoint[] = rawPoints.map((p) => {
      const collectedY = 100 - (p.collected / cfMaxCeiling) * 100;
      const costY = 100 - (p.cost / cfMaxCeiling) * 100;
      return {
        month: p.month,
        collected: p.collected,
        collectedFormatted: this.formatCompact(p.collected),
        cost: p.cost,
        costFormatted: this.formatCompact(p.cost),
        xPercent: p.xPercent,
        collectedYPercent: Math.round(collectedY),
        costYPercent: Math.round(costY),
      };
    });

    // Generate smooth SVG path strings for 300x160 viewBox
    // x: 30, 78, 126, 174, 222, 270. y = 140 - (val / 3T) * 110
    const coords = [
      { x: 30, yColl: 140 - (1.5 / 3.0) * 110, yCost: 140 - (1.0 / 3.0) * 110 },
      { x: 78, yColl: 140 - (2.1 / 3.0) * 110, yCost: 140 - (1.4 / 3.0) * 110 },
      { x: 126, yColl: 140 - (1.95 / 3.0) * 110, yCost: 140 - (1.35 / 3.0) * 110 },
      { x: 174, yColl: 140 - (2.3 / 3.0) * 110, yCost: 140 - (1.75 / 3.0) * 110 },
      { x: 222, yColl: 140 - (2.45 / 3.0) * 110, yCost: 140 - (1.9 / 3.0) * 110 },
      { x: 270, yColl: 140 - (2.95 / 3.0) * 110, yCost: 140 - (2.35 / 3.0) * 110 },
    ];

    const collectedSvgPath = coords.reduce((acc, c, idx) => (idx === 0 ? `M ${c.x} ${c.yColl.toFixed(1)}` : `${acc} L ${c.x} ${c.yColl.toFixed(1)}`), '');
    const costSvgPath = coords.reduce((acc, c, idx) => (idx === 0 ? `M ${c.x} ${c.yCost.toFixed(1)}` : `${acc} L ${c.x} ${c.yCost.toFixed(1)}`), '');

    const cashFlow = {
      title: 'Dòng tiền dự án',
      selectedRange: '6 tháng',
      availableRanges: ['3 tháng', '6 tháng', '1 năm'],
      yAxisLabels: ['3T', '2T', '1T', '0'],
      points: cashFlowPoints,
      collectedSvgPath,
      costSvgPath,
      legend: [
        { label: 'Thu tiền', color: '#10B981' },
        { label: 'Chi phí', color: '#3B82F6' },
      ],
    };

    // 7. Debt Overview Donut (725 Triệu: Chưa đến hạn 425M, Sắp đến hạn 150M, Quá hạn 150M)
    const debtCircumference = 251.327;
    const notDueLength = (425 / 725) * debtCircumference; // ~147.3
    const upcomingLength = (150 / 725) * debtCircumference; // ~52.0
    const overdueLength = (150 / 725) * debtCircumference; // ~52.0

    const debtOverview = {
      title: 'Công nợ &amp; Thanh toán',
      centerValue: '725',
      centerUnit: 'Triệu ₫',
      centerLabel: 'Còn phải thu',
      categories: [
        {
          id: 'not_due',
          label: 'Chưa đến hạn',
          amount: 425_000_000,
          amountFormatted: '425.000.000 ₫',
          percentage: 58.6,
          color: '#10B981', // Emerald
          dashArray: `${notDueLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: '0',
        },
        {
          id: 'upcoming',
          label: 'Sắp đến hạn (≤ 7 ngày)',
          amount: 150_000_000,
          amountFormatted: '150.000.000 ₫',
          percentage: 20.7,
          color: '#F59E0B', // Amber
          dashArray: `${upcomingLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: `-${notDueLength.toFixed(1)}`,
        },
        {
          id: 'overdue',
          label: 'Quá hạn',
          amount: 150_000_000,
          amountFormatted: '150.000.000 ₫',
          percentage: 20.7,
          color: '#EF4444', // Red
          dashArray: `${overdueLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: `-${(notDueLength + upcomingLength).toFixed(1)}`,
        },
      ],
      alertNotice: {
        message: 'Có 1 khoản công nợ quá hạn 15 ngày',
        severity: 'danger' as const,
      },
    };

    // 8. Recent Transactions
    const recentTransactions = {
      title: 'Giao dịch gần đây',
      viewAllUrl: '/dashboard/interior/finance/transactions',
      transactions: [
        {
          id: 'TX-101',
          date: '15/11/2026',
          description: 'Khách hàng thanh toán đợt 3',
          amount: 125_400_000,
          amountFormatted: '+125.400.000 ₫',
          type: 'inflow' as const,
          amountColorClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
          badgeLabel: 'Thu tiền',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
        },
        {
          id: 'TX-102',
          date: '10/11/2026',
          description: 'Chi phí sản xuất nội thất',
          amount: -480_000_000,
          amountFormatted: '-480.000.000 ₫',
          type: 'outflow' as const,
          amountColorClass: 'text-rose-600 dark:text-rose-400 font-bold',
          badgeLabel: 'Chi phí',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
        },
        {
          id: 'TX-103',
          date: '05/11/2026',
          description: 'Khách hàng thanh toán đợt 2',
          amount: 83_600_000,
          amountFormatted: '+83.600.000 ₫',
          type: 'inflow' as const,
          amountColorClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
          badgeLabel: 'Thu tiền',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
        },
        {
          id: 'TX-104',
          date: '01/11/2026',
          description: 'Chi phí lắp đặt công trình',
          amount: -62_700_000,
          amountFormatted: '-62.700.000 ₫',
          type: 'outflow' as const,
          amountColorClass: 'text-rose-600 dark:text-rose-400 font-bold',
          badgeLabel: 'Chi phí',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
        },
      ],
    };

    // 9. Quick Insights
    const quickInsights = {
      title: 'Nhận định nhanh',
      insights: [
        {
          id: 'ins-1',
          text: 'Lợi nhuận gộp đạt 37,4%, tăng 1,2% so với quý trước.',
        },
        {
          id: 'ins-2',
          text: 'Công nợ còn phải thu 725 triệu, trong đó có 150 triệu quá hạn.',
        },
        {
          id: 'ins-3',
          text: 'Dự án Villa Harmonia có biên lợi nhuận cao nhất: 44,9%.',
        },
      ],
      actionLabel: 'Xem báo cáo chi tiết →',
      actionUrl: '/dashboard/interior/reports',
    };

    // 10. Footer Banner
    const footerBanner = {
      title: 'Bella Interior',
      subtitle: 'Kiến tạo không gian sống đẳng cấp',
      bgImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    };

    return {
      quarter,
      availableQuarters: ['Quý 4/2026', 'Quý 3/2026', 'Quý 2/2026', 'Quý 1/2026'],
      user: {
        name: 'Nguyễn Văn Quang',
        role: 'Project Manager',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80',
        notificationsCount: 3,
      },
      kpis,
      financialPerformance,
      cogsStructure,
      projectPLBreakdown: {
        title: 'Chi tiết P&L theo dự án',
        detailUrl: '/dashboard/interior/reports',
        headers: ['Dự án', 'Khách hàng', 'Giá trị hợp đồng', 'Giá vốn', 'Lợi nhuận gộp', 'Biên lợi nhuận', 'Đã thu', 'Công nợ'],
        projects,
      },
      cashFlow,
      debtOverview,
      recentTransactions,
      quickInsights,
      footerBanner,
    };
  }
}
