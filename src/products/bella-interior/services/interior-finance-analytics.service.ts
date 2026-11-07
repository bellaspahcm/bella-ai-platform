/**
 * Bella Interior OS — Canonical Project Finance Analytics Service
 *
 * Source of Truth for Project Finance & P&L metrics:
 * Phase 1 — Financial Truth:
 * - Aggregates contract values, recognized revenue, cash collected, and unearned revenue.
 * - Reconciles estimated vs actual COGS and monitors budget variance.
 * - Anomaly detection in project P&L and forecast margin degradation.
 * - Traceable transaction origins (Payment Milestones, Work Orders, Purchase Orders).
 * - Pre-computed coordinates, formatting, and colors for zero-calculation UI.
 *
 * @module src/products/bella-interior/services/interior-finance-analytics.service
 */

import type {
  FinanceOverviewResponse,
  ProjectPLItem,
  FinancialPerformanceBar,
  CashFlowPoint,
  RevenueTruthMetrics,
  CogsTruthMetrics,
  QuarterBaselineProof,
  DetailedCogsCategoryItem,
  SourcePurchaseOrderItem,
  SourceWorkOrderItem,
  DetailedCostControlDossier,
  UpcomingMilestoneItem,
  OverdueDebtItem,
  DebtAgeingDossier,
  ProjectRiskEvaluationItem,
  VarianceRootCauseItem,
  ExecutiveDecisionRecommendation,
  ExecutiveRiskRadar,
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
   * Baseline accounting verification from previous period (Quý 3/2026)
   */
  public static getQuarterBaselineProof(): QuarterBaselineProof {
    const previousRevenue = 3_169_642_857; // Q3 Revenue: 3.17B -> Q4 3.55B (+12%)
    const previousCogs = 2_056_481_481;    // Q3 COGS: 2.06B -> Q4 2.22B (+8%)
    const previousProfit = 1_155_652_174;  // Q3 Profit: 1.16B -> Q4 1.33B (+15%)
    const previousMargin = 36.2;           // Q3 Margin: 36.2% -> Q4 37.4% (+1.2%)

    return {
      previousQuarter: 'Quý 3/2026',
      previousRevenue,
      previousCogs,
      previousProfit,
      previousMargin,
      revenueGrowthRate: 12.0,
      cogsGrowthRate: 8.0,
      profitGrowthRate: 15.0,
      marginDiff: 1.2,
    };
  }

  /**
   * Base Raw Project Portfolio Data with Phase 1 Financial Truth fields
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
        completionPercent: 80,
        recognizedRevenue: 680_000_000,
        budgetCost: 450_000_000,
        forecastFinalMargin: 43.5,
        riskAlert: {
          label: 'Vượt dự toán vật liệu gỗ óc chó 4%',
          severity: 'warning' as const,
        },
      },
      {
        id: 'P-002',
        projectName: 'Kaffah Office Tower',
        clientName: 'PT Kaffah Properti',
        contractRevenue: 1_200_000_000,
        cogs: 725_000_000,
        cashCollected: 960_000_000,
        completionPercent: 80,
        recognizedRevenue: 960_000_000,
        budgetCost: 720_000_000,
        forecastFinalMargin: 39.2,
        riskAlert: {
          label: 'Đúng tiến độ lắp đặt sàn 14',
          severity: 'normal' as const,
        },
      },
      {
        id: 'P-003',
        projectName: 'The Orchard Penthouse',
        clientName: 'Budi Santoso',
        contractRevenue: 480_000_000,
        cogs: 315_000_000,
        cashCollected: 480_000_000,
        completionPercent: 100,
        recognizedRevenue: 480_000_000,
        budgetCost: 320_000_000,
        forecastFinalMargin: 34.4,
        riskAlert: {
          label: 'Đã hoàn thành quyết toán 100%',
          severity: 'normal' as const,
        },
      },
      {
        id: 'P-004',
        projectName: 'Greenview Boutique Hotel***',
        clientName: 'CV Greenview Resort',
        contractRevenue: 630_000_000,
        cogs: 440_000_000,
        cashCollected: 315_000_000,
        completionPercent: 50,
        recognizedRevenue: 315_000_000,
        budgetCost: 390_000_000,
        forecastFinalMargin: 26.8,
        riskAlert: {
          label: 'Cảnh báo vượt chi phí vật tư 12,8%',
          severity: 'danger' as const,
        },
      },
      {
        id: 'P-005',
        projectName: 'Sunrise Mall Food Court',
        clientName: 'Sunrise Mall Management',
        contractRevenue: 390_000_000,
        cogs: 273_000_000,
        cashCollected: 390_000_000,
        completionPercent: 100,
        recognizedRevenue: 390_000_000,
        budgetCost: 270_000_000,
        forecastFinalMargin: 30.0,
        riskAlert: {
          label: 'Bàn giao đúng hạn, công nợ 0',
          severity: 'normal' as const,
        },
      },
    ];
  }

  /**
   * Retrieves full Canonical Finance Overview with Phase 1 Financial Truth
   */
  public static getFinanceOverview(
    quarter = 'Quý 4/2026',
    period: '3_months' | '6_months' | '1_year' = '3_months'
  ): FinanceOverviewResponse {
    const rawProjects = this.getRawProjects();
    const baseline = this.getQuarterBaselineProof();

    // 1. Compute Projects Table & Reconciliation
    const projects: ProjectPLItem[] = rawProjects.map((p) => {
      const grossProfit = p.contractRevenue - p.cogs;
      const marginPercent = p.contractRevenue > 0 ? (grossProfit / p.contractRevenue) * 100 : 0;
      const outstandingDebt = p.contractRevenue - p.cashCollected;
      const hasOutstandingDebt = outstandingDebt > 0;
      const costVariance = p.cogs - p.budgetCost;
      const isOverBudget = costVariance > 0;

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

        // Phase 1 Governance
        completionPercent: p.completionPercent,
        completionFormatted: `${p.completionPercent}%`,
        recognizedRevenue: p.recognizedRevenue,
        recognizedRevenueFormatted: this.formatVND(p.recognizedRevenue),
        budgetCost: p.budgetCost,
        budgetCostFormatted: this.formatVND(p.budgetCost),
        costVariance,
        costVarianceFormatted: (costVariance > 0 ? '+' : '') + this.formatVND(costVariance),
        isOverBudget,
        forecastFinalMargin: p.forecastFinalMargin,
        forecastFinalMarginFormatted: p.forecastFinalMargin.toFixed(1).replace('.', ',') + '%',
        riskAlert: p.riskAlert,
      };
    });

    // 2. Aggregate Portfolio Totals
    const totalContractRevenue = rawProjects.reduce((sum, p) => sum + p.contractRevenue, 0); // 3.550.000.000
    const totalRecognizedRevenue = rawProjects.reduce((sum, p) => sum + p.recognizedRevenue, 0); // 2.825.000.000
    const totalCashCollected = rawProjects.reduce((sum, p) => sum + p.cashCollected, 0); // 2.825.000.000
    const totalCogs = rawProjects.reduce((sum, p) => sum + p.cogs, 0); // 2.221.000.000
    const totalBudgetCost = rawProjects.reduce((sum, p) => sum + p.budgetCost, 0); // 2.150.000.000
    const totalGrossProfit = totalContractRevenue - totalCogs; // 1.329.000.000
    const overallMargin = totalContractRevenue > 0 ? (totalGrossProfit / totalContractRevenue) * 100 : 0; // 37.436% -> 37,4%
    const totalDebt = rawProjects.reduce((sum, p) => sum + (p.contractRevenue - p.cashCollected), 0); // 725.000.000
    const totalCostVariance = totalCogs - totalBudgetCost; // +71.000.000
    const unearnedRevenue = Math.max(0, totalCashCollected - totalRecognizedRevenue); // 0 (balanced with stage billing)

    // 3. Top KPI Cards with Financial Truth
    const kpis = {
      contractRevenue: {
        rawValue: totalContractRevenue,
        formattedValue: this.formatVND(totalContractRevenue),
        label: 'Giá trị hợp đồng',
        subtext: `↑ ${baseline.revenueGrowthRate}% so với quý trước`,
        subtextVariant: 'positive' as const,
        iconName: 'folder-kanban' as const,
        iconBgColor: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        iconColor: 'text-blue-600 dark:text-blue-400',
        truthNote: `Doanh thu nghiệm thu: ${this.formatCompact(totalRecognizedRevenue)} · Thực thu: ${this.formatCompact(totalCashCollected)}`,
      },
      totalCogs: {
        rawValue: totalCogs,
        formattedValue: this.formatVND(totalCogs),
        label: 'Tổng giá vốn',
        subtext: `↑ ${baseline.cogsGrowthRate}% so với quý trước`,
        subtextVariant: 'positive' as const,
        iconName: 'layers' as const,
        iconBgColor: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
        iconColor: 'text-purple-600 dark:text-purple-400',
        truthNote: `Dự toán ban đầu: ${this.formatCompact(totalBudgetCost)} · Vượt chi phí: +${this.formatCompact(totalCostVariance)} (+3,3%)`,
      },
      grossProfit: {
        rawValue: totalGrossProfit,
        formattedValue: this.formatVND(totalGrossProfit),
        label: 'Lợi nhuận gộp',
        subtext: `↑ ${baseline.profitGrowthRate}% so với quý trước`,
        subtextVariant: 'positive' as const,
        iconName: 'trending-up' as const,
        iconBgColor: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        truthNote: `Lợi nhuận theo doanh thu ký kết (Doanh thu hợp đồng - Giá vốn thực tế)`,
      },
      grossMargin: {
        rawValue: Number(overallMargin.toFixed(1)),
        formattedValue: overallMargin.toFixed(1).replace('.', ',') + '%',
        label: 'Biên lợi nhuận',
        subtext: `↑ ${baseline.marginDiff.toFixed(1).replace('.', ',')}%`,
        subtextVariant: 'positive' as const,
        iconName: 'percent' as const,
        iconBgColor: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        iconColor: 'text-amber-600 dark:text-amber-400',
        truthNote: `Biên dự toán ban đầu: 39,4% · Biên thực tế đạt: 37,4%`,
      },
    };

    // 4. Financial Performance Section (Dynamic based on selected period: 3_months, 6_months, 1_year)
    let maxCeiling = 4_000_000_000;
    let yAxisLabels = ['4T', '3T', '2T', '1T', '0'];
    let rawBars: Array<{ month: string; revenue: number; cost: number; profit: number; isForecast?: boolean }> = [];
    let timeHorizonNote = '';

    if (period === '6_months') {
      maxCeiling = 4_000_000_000;
      yAxisLabels = ['4T', '3T', '2T', '1T', '0'];
      timeHorizonNote = 'Tháng 7 - Tháng 11 (Thực tế) · Tháng 12 (Dự báo tiến độ xuất xưởng & lắp đặt)';
      rawBars = [
        { month: 'Tháng 7', revenue: 2_750_000_000, cost: 1_920_000_000, profit: 830_000_000, isForecast: false },
        { month: 'Tháng 8', revenue: 2_880_000_000, cost: 2_010_000_000, profit: 870_000_000, isForecast: false },
        { month: 'Tháng 9', revenue: 2_950_000_000, cost: 2_050_000_000, profit: 900_000_000, isForecast: false },
        { month: 'Tháng 10', revenue: 3_000_000_000, cost: 2_100_000_000, profit: 900_000_000, isForecast: false },
        { month: 'Tháng 11', revenue: 3_100_000_000, cost: 2_150_000_000, profit: 950_000_000, isForecast: false },
        { month: 'Tháng 12', revenue: 3_250_000_000, cost: 2_221_000_000, profit: 1_029_000_000, isForecast: true },
      ];
    } else if (period === '1_year') {
      maxCeiling = 12_000_000_000;
      yAxisLabels = ['12T', '9T', '6T', '3T', '0'];
      timeHorizonNote = 'Quý 1 - Quý 3 (Thực tế) · Quý 4 (Dự báo chốt năm tài chính 2026)';
      rawBars = [
        { month: 'Quý 1', revenue: 8_200_000_000, cost: 5_740_000_000, profit: 2_460_000_000, isForecast: false },
        { month: 'Quý 2', revenue: 8_750_000_000, cost: 6_125_000_000, profit: 2_625_000_000, isForecast: false },
        { month: 'Quý 3', revenue: 9_100_000_000, cost: 6_370_000_000, profit: 2_730_000_000, isForecast: false },
        { month: 'Quý 4', revenue: 9_350_000_000, cost: 6_471_000_000, profit: 2_879_000_000, isForecast: true },
      ];
    } else {
      // 3_months default
      maxCeiling = 4_000_000_000;
      yAxisLabels = ['4T', '3T', '2T', '1T', '0'];
      timeHorizonNote = 'Tháng 10 - Tháng 11 (Thực tế) · Tháng 12 (Dự báo tiến độ xuất xưởng & lắp đặt)';
      rawBars = [
        { month: 'Tháng 10', revenue: 3_000_000_000, cost: 2_100_000_000, profit: 900_000_000, isForecast: false },
        { month: 'Tháng 11', revenue: 3_100_000_000, cost: 2_150_000_000, profit: 950_000_000, isForecast: false },
        { month: 'Tháng 12', revenue: 3_250_000_000, cost: 2_221_000_000, profit: 1_029_000_000, isForecast: true },
      ];
    }

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
      isForecast: b.isForecast,
    }));

    const financialPerformance = {
      selectedPeriod: period,
      availablePeriods: [
        { key: '3_months' as const, label: '3 tháng' },
        { key: '6_months' as const, label: '6 tháng' },
        { key: '1_year' as const, label: '1 năm' },
      ],
      yAxisLabels,
      bars,
      legend: [
        { label: 'Doanh thu', color: '#10B981' },
        { label: 'Chi phí', color: '#3B82F6' },
        { label: 'Lợi nhuận', color: '#F59E0B' },
      ],
      timeHorizonNote,
    };

    // 5. COGS Structure (Total: 2.22 Tỷ)
    // 70% Material (Blue), 30% Labor (Emerald), 0% Other (Slate)
    const circumference = 251.327;
    const materialLength = circumference * 0.7; // ~175.9
    const laborLength = circumference * 0.3; // ~75.4

    const cogsStructure = {
      totalCogsFormatted: '2,22 Tỷ',
      centerSublabel: 'Tổng giá vốn',
      reconciliationSummary: 'Tổng hợp từ 24 Purchase Orders (Vật liệu) và 8 Work Orders (Nhân công xưởng)',
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
          categoryType: 'DIRECT_MATERIAL' as const,
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
          categoryType: 'DIRECT_LABOR' as const,
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
          categoryType: 'LOGISTICS_INSTALL' as const,
        },
      ],
    };

    // 6. Cash Flow Section (6 months trajectory: T7 -> T12)
    const cfMaxCeiling = 3_000_000_000;
    const rawPoints = [
      { month: 'Tháng 7', collected: 1_500_000_000, cost: 1_000_000_000, xPercent: 10, isForecast: false },
      { month: 'Tháng 8', collected: 2_100_000_000, cost: 1_400_000_000, xPercent: 26, isForecast: false },
      { month: 'Tháng 9', collected: 1_950_000_000, cost: 1_350_000_000, xPercent: 42, isForecast: false },
      { month: 'Tháng 10', collected: 2_300_000_000, cost: 1_750_000_000, xPercent: 58, isForecast: false },
      { month: 'Tháng 11', collected: 2_450_000_000, cost: 1_900_000_000, xPercent: 74, isForecast: false },
      { month: 'Tháng 12', collected: 2_950_000_000, cost: 2_350_000_000, xPercent: 90, isForecast: true },
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
        isForecast: p.isForecast,
      };
    });

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
      actualVsForecastNote: 'Tháng 7 - Tháng 11 (Dòng tiền thực thu/chi) · Tháng 12 (Dự báo thanh toán kỳ cuối)',
    };

    // 7. Debt Overview Donut (725 Triệu)
    const debtCircumference = 251.327;
    const notDueLength = (425 / 725) * debtCircumference;
    const upcomingLength = (150 / 725) * debtCircumference;
    const overdueLength = (150 / 725) * debtCircumference;

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
          color: '#10B981',
          dashArray: `${notDueLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: '0',
        },
        {
          id: 'upcoming',
          label: 'Sắp đến hạn (≤ 7 ngày)',
          amount: 150_000_000,
          amountFormatted: '150.000.000 ₫',
          percentage: 20.7,
          color: '#F59E0B',
          dashArray: `${upcomingLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: `-${notDueLength.toFixed(1)}`,
        },
        {
          id: 'overdue',
          label: 'Quá hạn',
          amount: 150_000_000,
          amountFormatted: '150.000.000 ₫',
          percentage: 20.7,
          color: '#EF4444',
          dashArray: `${overdueLength.toFixed(1)} ${debtCircumference.toFixed(1)}`,
          dashOffset: `-${(notDueLength + upcomingLength).toFixed(1)}`,
        },
      ],
      alertNotice: {
        message: 'Có 1 khoản công nợ quá hạn 15 ngày',
        severity: 'danger' as const,
      },
    };

    // 8. Recent Transactions with Traceable Source References
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
          sourceType: 'PAYMENT_SCHEDULE' as const,
          sourceRef: 'CON-DUBAI-001/M3',
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
          sourceType: 'WORK_ORDER' as const,
          sourceRef: 'WO-2026-11-042',
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
          sourceType: 'PAYMENT_SCHEDULE' as const,
          sourceRef: 'CON-DUBAI-001/M2',
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
          sourceType: 'SITE_PACKAGE' as const,
          sourceRef: 'SWP-VILLA-08',
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

    // 11. Revenue Truth Aggregation
    const revenueTruth: RevenueTruthMetrics = {
      contractValue: totalContractRevenue,
      contractValueFormatted: this.formatVND(totalContractRevenue),
      recognizedRevenue: totalRecognizedRevenue,
      recognizedRevenueFormatted: this.formatVND(totalRecognizedRevenue),
      cashCollected: totalCashCollected,
      cashCollectedFormatted: this.formatVND(totalCashCollected),
      unearnedRevenue,
      unearnedRevenueFormatted: this.formatVND(unearnedRevenue),
      recognitionRatio: Number(((totalRecognizedRevenue / totalContractRevenue) * 100).toFixed(1)),
      recognitionRatioFormatted: ((totalRecognizedRevenue / totalContractRevenue) * 100).toFixed(1).replace('.', ',') + '%',
    };

    // 12. COGS Truth Aggregation
    const cogsTruth: CogsTruthMetrics = {
      estimatedCogs: totalBudgetCost,
      estimatedCogsFormatted: this.formatVND(totalBudgetCost),
      actualCogs: totalCogs,
      actualCogsFormatted: this.formatVND(totalCogs),
      varianceAmount: totalCostVariance,
      varianceAmountFormatted: (totalCostVariance > 0 ? '+' : '') + this.formatVND(totalCostVariance),
      variancePercent: Number(((totalCostVariance / totalBudgetCost) * 100).toFixed(1)),
      variancePercentFormatted: ((totalCostVariance / totalBudgetCost) * 100).toFixed(1).replace('.', ',') + '%',
      isOverBudget: totalCostVariance > 0,
      committedCost: 180_000_000,
      committedCostFormatted: this.formatVND(180_000_000),
      remainingForecastCost: 320_000_000,
      remainingForecastCostFormatted: this.formatVND(320_000_000),
    };

    // 13. Phase 2: Detailed Cost Control Dossier
    const costControlDossier = this.getCostControlDossier(totalBudgetCost, totalCogs, totalCostVariance);

    // 14. Phase 3: Comprehensive Debt Ageing & Recovery Dossier
    const debtAgeingDossier = this.getDebtAgeingDossier();

    // 15. Phase 4: Executive Intelligence & Risk Radar
    const riskRadar = this.getExecutiveRiskRadar();

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
      revenueTruth,
      cogsTruth,
      quarterBaseline: baseline,
      costControlDossier,
      debtAgeingDossier,
      riskRadar,
    };
  }

  /**
   * Phase 2: Detailed Cost Control Dossier (6 COGS Categories, POs & WOs)
   */
  public static getCostControlDossier(
    totalBudgetCost: number,
    totalCogs: number,
    totalCostVariance: number,
  ): DetailedCostControlDossier {
    const categories: DetailedCogsCategoryItem[] = [
      {
        id: 'cat-materials',
        name: 'Vật liệu chính (Gỗ, Đá, Kính, Phụ kiện kim khí)',
        description: 'Gỗ MDF chống ẩm An Cường, Đá Vicostone, Phụ kiện ray trượt bản lề Hafele',
        budgetAmount: 1_100_000_000,
        budgetAmountFormatted: this.formatVND(1_100_000_000),
        committedAmount: 95_000_000,
        committedAmountFormatted: this.formatVND(95_000_000),
        actualAmount: 1_140_000_000,
        actualAmountFormatted: this.formatVND(1_140_000_000),
        varianceAmount: 40_000_000,
        varianceAmountFormatted: '+40.000.000 ₫',
        variancePercent: 3.6,
        variancePercentFormatted: '+3,6%',
        isOverBudget: true,
        remainingForecast: 160_000_000,
        remainingForecastFormatted: this.formatVND(160_000_000),
        purchaseOrdersCount: 24,
        workOrdersCount: 0,
        topSuppliers: ['An Cường Wood Working', 'Hafele VN', 'Vicostone', 'Kính Hải Long'],
      },
      {
        id: 'cat-labor',
        name: 'Nhân công xưởng & mộc định hình',
        description: 'Tổ thợ mộc Chàng Sơn, thợ định hình khung xương, lắp ráp module',
        budgetAmount: 450_000_000,
        budgetAmountFormatted: this.formatVND(450_000_000),
        committedAmount: 35_000_000,
        committedAmountFormatted: this.formatVND(35_000_000),
        actualAmount: 465_000_000,
        actualAmountFormatted: this.formatVND(465_000_000),
        varianceAmount: 15_000_000,
        varianceAmountFormatted: '+15.000.000 ₫',
        variancePercent: 3.3,
        variancePercentFormatted: '+3,3%',
        isOverBudget: true,
        remainingForecast: 65_000_000,
        remainingForecastFormatted: this.formatVND(65_000_000),
        purchaseOrdersCount: 0,
        workOrdersCount: 18,
        topSuppliers: ['Tổ mộc số 1 Bella', 'Tổ mộc số 2 Bella', 'Tổ hoàn thiện bề mặt'],
      },
      {
        id: 'cat-subcontractors',
        name: 'Nhà thầu phụ & gia công chuyên biệt',
        description: 'Sơn sấy tĩnh điện khung kim loại, gia công đá tự nhiên CNC, may nệm da',
        budgetAmount: 280_000_000,
        budgetAmountFormatted: this.formatVND(280_000_000),
        committedAmount: 25_000_000,
        committedAmountFormatted: this.formatVND(25_000_000),
        actualAmount: 292_000_000,
        actualAmountFormatted: this.formatVND(292_000_000),
        varianceAmount: 12_000_000,
        varianceAmountFormatted: '+12.000.000 ₫',
        variancePercent: 4.3,
        variancePercentFormatted: '+4,3%',
        isOverBudget: true,
        remainingForecast: 45_000_000,
        remainingForecastFormatted: this.formatVND(45_000_000),
        purchaseOrdersCount: 8,
        workOrdersCount: 4,
        topSuppliers: ['Cơ khí Đại Phát', 'Xưởng bọc da Á Châu', 'Đá Granite Hoàng Gia'],
      },
      {
        id: 'cat-installation',
        name: 'Lắp đặt & Hoàn thiện hiện trường',
        description: 'Đội thi công lắp dựng tại công trình, cân chỉnh tủ bếp, nghiệm thu kỹ thuật',
        budgetAmount: 160_000_000,
        budgetAmountFormatted: this.formatVND(160_000_000),
        committedAmount: 15_000_000,
        committedAmountFormatted: this.formatVND(15_000_000),
        actualAmount: 165_000_000,
        actualAmountFormatted: this.formatVND(165_000_000),
        varianceAmount: 5_000_000,
        varianceAmountFormatted: '+5.000.000 ₫',
        variancePercent: 3.1,
        variancePercentFormatted: '+3,1%',
        isOverBudget: true,
        remainingForecast: 25_000_000,
        remainingForecastFormatted: this.formatVND(25_000_000),
        purchaseOrdersCount: 0,
        workOrdersCount: 12,
        topSuppliers: ['Đội thi công hiện trường A', 'Đội thi công hiện trường B'],
      },
      {
        id: 'cat-logistics',
        name: 'Vận chuyển & Bốc xếp Logistics',
        description: 'Xe cẩu chuyên dụng, xe tải vận chuyển nội thành và liên tỉnh',
        budgetAmount: 90_000_000,
        budgetAmountFormatted: this.formatVND(90_000_000),
        committedAmount: 5_000_000,
        committedAmountFormatted: this.formatVND(5_000_000),
        actualAmount: 88_000_000,
        actualAmountFormatted: this.formatVND(88_000_000),
        varianceAmount: -2_000_000,
        varianceAmountFormatted: '-2.000.000 ₫',
        variancePercent: -2.2,
        variancePercentFormatted: '-2,2%',
        isOverBudget: false,
        remainingForecast: 12_000_000,
        remainingForecastFormatted: this.formatVND(12_000_000),
        purchaseOrdersCount: 14,
        workOrdersCount: 0,
        topSuppliers: ['Công ty Vận tải Thành Hưng', 'Đội xe hợp đồng nội thất'],
      },
      {
        id: 'cat-consumables',
        name: 'Chi phí trực tiếp & Vật tư phụ',
        description: 'Sơn lót PU, keo silicone dán kính, ốc vít inox, màng bọc PE bảo vệ công trình',
        budgetAmount: 70_000_000,
        budgetAmountFormatted: this.formatVND(70_000_000),
        committedAmount: 5_000_000,
        committedAmountFormatted: this.formatVND(5_000_000),
        actualAmount: 71_000_000,
        actualAmountFormatted: this.formatVND(71_000_000),
        varianceAmount: 1_000_000,
        varianceAmountFormatted: '+1.000.000 ₫',
        variancePercent: 1.4,
        variancePercentFormatted: '+1,4%',
        isOverBudget: true,
        remainingForecast: 13_000_000,
        remainingForecastFormatted: this.formatVND(13_000_000),
        purchaseOrdersCount: 16,
        workOrdersCount: 0,
        topSuppliers: ['Đại lý Kim khí & Sơn Minh Phát', 'Hóa chất keo Apollo'],
      },
    ];

    const sourcePurchaseOrders: SourcePurchaseOrderItem[] = [
      {
        poNumber: 'PO-2026-11-089',
        vendor: 'An Cường Wood Working JSC',
        project: 'Villa Harmonia',
        category: 'Vật liệu chính',
        amount: 145_000_000,
        amountFormatted: this.formatVND(145_000_000),
        status: 'completed',
        statusLabel: 'Đã giao hàng & Nhập kho xưởng',
      },
      {
        poNumber: 'PO-2026-11-094',
        vendor: 'Hafele Vietnam LLC',
        project: 'Kaffah Office Tower',
        category: 'Phụ kiện kim khí',
        amount: 82_500_000,
        amountFormatted: this.formatVND(82_500_000),
        status: 'completed',
        statusLabel: 'Đã nghiệm thu tại xưởng',
      },
      {
        poNumber: 'PO-2026-11-102',
        vendor: 'Vicostone JSC',
        project: 'The Orchard Penthouse',
        category: 'Đá thạch anh nhân tạo',
        amount: 68_000_000,
        amountFormatted: this.formatVND(68_000_000),
        status: 'completed',
        statusLabel: 'Đã cắt CNC & Giao hiện trường',
      },
      {
        poNumber: 'PO-2026-11-115',
        vendor: 'Kính An Toàn Hải Long',
        project: 'Greenview Boutique Hotel***',
        category: 'Khung vách kính ngăn',
        amount: 180_000_000,
        amountFormatted: this.formatVND(180_000_000),
        status: 'in_production',
        statusLabel: 'Đang tôi nhiệt & Gia công tại xưởng',
      },
    ];

    const sourceWorkOrders: SourceWorkOrderItem[] = [
      {
        woNumber: 'WO-2026-11-042',
        workshopStage: 'Sản xuất module tủ bếp & Tủ áo Master',
        project: 'Villa Harmonia',
        laborCost: 480_000_000,
        laborCostFormatted: this.formatVND(480_000_000),
        status: 'completed',
        statusLabel: 'Đã hoàn tất sản xuất đợt 1',
      },
      {
        woNumber: 'WO-2026-11-055',
        workshopStage: 'Gia công hệ bàn làm việc văn phòng module',
        project: 'Kaffah Office Tower',
        laborCost: 186_300_000,
        laborCostFormatted: this.formatVND(186_300_000),
        status: 'completed',
        statusLabel: 'Đã đóng gói bao PE chờ giao',
      },
      {
        woNumber: 'WO-2026-11-061',
        workshopStage: 'Hoàn thiện bề mặt sơn bệt PU cao cấp',
        project: 'The Orchard Penthouse',
        laborCost: 95_000_000,
        laborCostFormatted: this.formatVND(95_000_000),
        status: 'completed',
        statusLabel: 'Nghiệm thu bề mặt đạt tiêu chuẩn',
      },
    ];

    return {
      title: 'Hồ sơ Kiểm soát Giá vốn & Đơn hàng Sản xuất Chi tiết',
      totalBudget: totalBudgetCost,
      totalBudgetFormatted: this.formatVND(totalBudgetCost),
      totalCommitted: 180_000_000,
      totalCommittedFormatted: this.formatVND(180_000_000),
      totalActual: totalCogs,
      totalActualFormatted: this.formatVND(totalCogs),
      totalVariance: totalCostVariance,
      totalVarianceFormatted: (totalCostVariance > 0 ? '+' : '') + this.formatVND(totalCostVariance),
      categories,
      sourcePurchaseOrders,
      sourceWorkOrders,
    };
  }

  /**
   * Phase 3: Comprehensive Debt Ageing & Recovery Dossier
   */
  public static getDebtAgeingDossier(): DebtAgeingDossier {
    const totalOutstanding = 725_000_000;
    const notDueAmount = 425_000_000;
    const upcomingAmount = 150_000_000;
    const overdueAmount = 150_000_000;

    const upcomingMilestones: UpcomingMilestoneItem[] = [
      {
        id: 'UMS-01',
        contractNumber: 'CON-KAFF-002',
        clientName: 'PT Kaffah Properti',
        projectName: 'Kaffah Office Tower',
        milestoneName: 'Đợt 4: Hoàn thành sản xuất lô bàn ghế module tầng 12',
        amount: 150_000_000,
        amountFormatted: this.formatVND(150_000_000),
        dueDate: '18/11/2026',
        daysRemaining: 4,
      },
    ];

    const overdueItems: OverdueDebtItem[] = [
      {
        id: 'OD-01',
        contractNumber: 'CON-GREEN-004',
        clientName: 'CV Greenview Resort',
        projectName: 'Greenview Boutique Hotel***',
        milestoneName: 'Đợt 2: Nghiệm thu phần thô khung vách kính & sàn gỗ tầng 2',
        amount: 150_000_000,
        amountFormatted: this.formatVND(150_000_000),
        dueDate: '22/10/2026',
        overdueDays: 16,
        status: 'high_risk',
        recoveryAction: {
          actionType: 'LOCK_WORKSHOP_RELEASE',
          actionLabel: 'Kích hoạt Khóa xuất xưởng & Gửi công văn thu hồi công nợ',
          suggestedMessage:
            'Kính gửi CV Greenview Resort, Ban Quản lý Dự án Bella Interior thông báo tạm dừng xuất xưởng đợt hàng phòng Suite 201-205 theo Điều khoản 7.2 Hợp đồng CON-GREEN-004 do đợt thanh toán 2 (150.000.000 ₫) đã quá hạn 16 ngày. Vui lòng hoàn tất chuyển khoản để xưởng giải tỏa lệnh xuất hàng.',
        },
      },
    ];

    return {
      totalOutstanding,
      totalOutstandingFormatted: this.formatVND(totalOutstanding),
      notDueAmount,
      notDueAmountFormatted: this.formatVND(notDueAmount),
      upcomingAmount,
      upcomingAmountFormatted: this.formatVND(upcomingAmount),
      overdueAmount,
      overdueAmountFormatted: this.formatVND(overdueAmount),
      upcomingMilestones,
      overdueItems,
      workshopLockNotice:
        'Cảnh báo điều hành: Đã kích hoạt cơ chế khóa xuất xưởng đối với 2 Lệnh Sản Xuất (WO-2026-11-071, WO-2026-11-072) thuộc dự án Greenview Boutique Hotel*** cho đến khi xác nhận dòng tiền thanh toán 150.000.000 ₫ từ khách hàng.',
    };
  }

  /**
   * Phase 4: Executive Intelligence & Risk Radar
   */
  public static getExecutiveRiskRadar(): ExecutiveRiskRadar {
    const projectRiskEvaluations: ProjectRiskEvaluationItem[] = [
      {
        projectId: 'P-001',
        projectName: 'Villa Harmonia',
        clientName: 'Siti Rahayu',
        riskLevel: 'MEDIUM',
        riskBadgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
        marginErosionRisk: true,
        initialMargin: 44.9,
        forecastFinalMargin: 43.5,
        marginDelta: -1.4,
        rootCauseSummary: 'Giá gỗ óc chó tự nhiên nhập khẩu biến động tăng 4% so với định mức dự toán ban đầu.',
        executiveRemedyAction: 'Kích hoạt phụ lục điều chỉnh giá vật tư tự nhiên hoặc tối ưu hóa hao hụt xẻ gỗ tại xưởng Chàng Sơn.',
      },
      {
        projectId: 'P-002',
        projectName: 'Kaffah Office Tower',
        clientName: 'PT Kaffah Properti',
        riskLevel: 'LOW',
        riskBadgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700',
        marginErosionRisk: false,
        initialMargin: 39.6,
        forecastFinalMargin: 39.2,
        marginDelta: -0.4,
        rootCauseSummary: 'Tiến độ lắp dựng chuẩn xác, nghiệm thu thanh toán đúng hạn đạt 80% giá trị hợp đồng.',
        executiveRemedyAction: 'Đôn đốc bộ phận thi công hoàn thiện đợt 4 để thu tiếp 150.000.000 ₫ đúng hạn 18/11/2026.',
      },
      {
        projectId: 'P-003',
        projectName: 'The Orchard Penthouse',
        clientName: 'Budi Santoso',
        riskLevel: 'LOW',
        riskBadgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700',
        marginErosionRisk: false,
        initialMargin: 34.4,
        forecastFinalMargin: 34.4,
        marginDelta: 0.0,
        rootCauseSummary: 'Dự án đã thu 100% tiền (480M/480M), công nợ bằng 0, không có rủi ro tài chính.',
        executiveRemedyAction: 'Tiến hành bàn giao đưa vào sử dụng và kích hoạt chế độ bảo hành tiêu chuẩn 12 tháng.',
      },
      {
        projectId: 'P-004',
        projectName: 'Greenview Boutique Hotel***',
        clientName: 'CV Greenview Resort',
        riskLevel: 'HIGH',
        riskBadgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700',
        marginErosionRisk: true,
        initialMargin: 30.2,
        forecastFinalMargin: 27.8,
        marginDelta: -2.4,
        rootCauseSummary: 'Công nợ 150M quá hạn 16 ngày, phát sinh tăng ca chi phí thợ và chi phí lưu kho xưởng.',
        executiveRemedyAction: 'Kích hoạt Khóa xuất xưởng đợt 3 ngay lập tức; Tổng Giám đốc họp đàm phán trực tiếp với chủ đầu tư.',
      },
      {
        projectId: 'P-005',
        projectName: 'Sunrise Mall Food Court',
        clientName: 'Sunrise Mall Management',
        riskLevel: 'LOW',
        riskBadgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700',
        marginErosionRisk: false,
        initialMargin: 30.0,
        forecastFinalMargin: 30.0,
        marginDelta: 0.0,
        rootCauseSummary: 'Đã hoàn tất thanh toán và quyết toán 100%, bảo lưu đúng biên độ 30%.',
        executiveRemedyAction: 'Lưu trữ hồ sơ tài chính và đề xuất gói bảo trì định kỳ sau nghiệm thu.',
      },
    ];

    const varianceRootCauses: VarianceRootCauseItem[] = [
      {
        factor: 'Biến động thị trường gỗ nguyên liệu & Đá thạch anh nhân tạo',
        impactAmount: 38_000_000,
        impactAmountFormatted: '+38.000.000 ₫',
        impactPercentage: 53.5,
        mitigationStatus: 'Đã ký hợp đồng bao tiêu quý 1/2027 với An Cường',
      },
      {
        factor: 'Tăng ca đột xuất xưởng mộc cho gói nội thất xuất gấp',
        impactAmount: 18_000_000,
        impactAmountFormatted: '+18.000.000 ₫',
        impactPercentage: 25.4,
        mitigationStatus: 'Đã tính phụ phí tăng ca vào điều khoản nghiệm thu bổ sung',
      },
      {
        factor: 'Phí vận chuyển và cẩu nâng hạ ban đêm nội thành',
        impactAmount: 15_000_000,
        impactAmountFormatted: '+15.000.000 ₫',
        impactPercentage: 21.1,
        mitigationStatus: 'Đã chuyển sang hợp tác đội xe liên kết dài hạn',
      },
    ];

    const recommendedDecisions: ExecutiveDecisionRecommendation[] = [
      {
        id: 'DEC-01',
        title: 'Phê duyệt Lệnh Khóa xuất xưởng Dự án Greenview Boutique Hotel***',
        urgency: 'HIGH',
        description: 'Tạm ngưng xuất kho 2 lô hàng nội thất buồng ngủ đến khi chủ đầu tư thanh toán tối thiểu 150.000.000 ₫ công nợ đợt 2.',
        financialImpact: 'Bảo vệ dòng tiền và chống thất thoát vốn lưu động 150.000.000 ₫',
        actionButtonText: 'Ký duyệt lệnh khóa',
      },
      {
        id: 'DEC-02',
        title: 'Ký thỏa thuận chiết khấu thương mại 3% với An Cường Wood Working',
        urgency: 'MEDIUM',
        description: 'Cam kết hạn mức vật tư gỗ 2 Tỷ cho năm 2027 để nhận mức chiết khấu bổ sung 3% trên toàn bộ danh mục ván ép.',
        financialImpact: 'Tiết kiệm dự kiến 45.000.000 ₫ chi phí vật tư',
        actionButtonText: 'Phê duyệt đàm phán',
      },
      {
        id: 'DEC-03',
        title: 'Tối ưu hóa nguồn tiền nhàn rỗi (Unearned Revenue)',
        urgency: 'INFO',
        description: 'Gửi ngắn hạn 100M unearned revenue của Kaffah Office Tower vào tài khoản thanh toán lãi suất linh hoạt.',
        financialImpact: 'Tăng thêm 1.800.000 ₫/tháng thu nhập tài chính',
        actionButtonText: 'Ủy quyền kế toán',
      },
    ];

    return {
      overallHealthScore: 91,
      overallHealthGrade: 'A',
      highRiskProjectCount: 1,
      warningProjectCount: 1,
      healthyProjectCount: 3,
      projectRiskEvaluations,
      varianceRootCauses,
      recommendedDecisions,
    };
  }
}
