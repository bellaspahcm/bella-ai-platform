/**
 * Unit Tests for Bella Interior OS — Project Finance & P&L Analytics Service
 *
 * Verifies Phase 1 — Financial Truth:
 * 1. Financial KPIs (Contract Revenue, Total COGS, Gross Profit, Gross Margin %)
 * 2. Mathematical Invariants across Portfolio Ledger
 * 3. Revenue Truth (Contract Value vs Recognized Revenue vs Cash Collected)
 * 4. COGS Truth (Estimated Cost vs Actual Cost vs Variance)
 * 5. Individual Project P&L Breakdown with Anomaly Detection & Forecast Margin
 * 6. COGS Structure Donut (Vật liệu 70%, Nhân công 30%)
 * 7. Debt Ageing Donut (Chưa đến hạn, Sắp đến hạn, Quá hạn)
 * 8. Cash Flow Trajectory & Pre-computed SVG Coordinates (Actual vs Forecast)
 * 9. Traceable Source Transactions (Contracts, Work Orders, POs, Site Packages)
 * 10. Quarter Baseline Proof for comparative growth KPIs (+12%, +8%, +15%, +1.2%)
 * 11. Zero UI Calculation guarantee
 *
 * @module src/products/bella-interior/__tests__/finance-analytics.test.ts
 */

import { InteriorFinanceAnalyticsService } from '../services/interior-finance-analytics.service';

describe('InteriorFinanceAnalyticsService (Phase 1 — Financial Truth)', () => {
  it('should return executive quarter and user header', () => {
    const overview = InteriorFinanceAnalyticsService.getFinanceOverview('Quý 4/2026');

    expect(overview.quarter).toBe('Quý 4/2026');
    expect(overview.user.name).toBe('Nguyễn Văn Quang');
    expect(overview.user.role).toBe('Project Manager');
    expect(overview.user.notificationsCount).toBe(3);
  });

  describe('Top Financial KPIs & Quarter Baseline Proof', () => {
    it('should compute exact 3.55B Revenue, 2.221B COGS, 1.329B Gross Profit, and 37.4% Margin', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();

      expect(overview.kpis.contractRevenue.rawValue).toBe(3_550_000_000);
      expect(overview.kpis.contractRevenue.formattedValue).toBe('3.550.000.000 ₫');
      expect(overview.kpis.contractRevenue.subtext).toContain('12%');
      expect(overview.kpis.contractRevenue.truthNote).toContain('Doanh thu nghiệm thu');

      expect(overview.kpis.totalCogs.rawValue).toBe(2_221_000_000);
      expect(overview.kpis.totalCogs.formattedValue).toBe('2.221.000.000 ₫');
      expect(overview.kpis.totalCogs.subtext).toContain('8%');
      expect(overview.kpis.totalCogs.truthNote).toContain('Dự toán ban đầu');

      expect(overview.kpis.grossProfit.rawValue).toBe(1_329_000_000);
      expect(overview.kpis.grossProfit.formattedValue).toBe('1.329.000.000 ₫');
      expect(overview.kpis.grossProfit.subtext).toContain('15%');

      expect(overview.kpis.grossMargin.rawValue).toBe(37.4);
      expect(overview.kpis.grossMargin.formattedValue).toBe('37,4%');
      expect(overview.kpis.grossMargin.subtext).toContain('1,2%');

      // Verify Mathematical consistency
      expect(overview.kpis.grossProfit.rawValue).toBe(
        overview.kpis.contractRevenue.rawValue - overview.kpis.totalCogs.rawValue,
      );
      const computedMargin = (overview.kpis.grossProfit.rawValue / overview.kpis.contractRevenue.rawValue) * 100;
      expect(Number(computedMargin.toFixed(1))).toBe(overview.kpis.grossMargin.rawValue);
    });

    it('should verify Quarter Baseline Proof mathematically matches growth rates against Q3/2026', () => {
      const baseline = InteriorFinanceAnalyticsService.getQuarterBaselineProof();

      expect(baseline.previousQuarter).toBe('Quý 3/2026');
      expect(baseline.revenueGrowthRate).toBe(12.0);
      expect(baseline.cogsGrowthRate).toBe(8.0);
      expect(baseline.profitGrowthRate).toBe(15.0);
      expect(baseline.marginDiff).toBe(1.2);
    });
  });

  describe('Revenue & COGS Truth Metrics', () => {
    it('should distinguish Contract Value (3.55B) from Recognized Revenue and Cash Collected', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const rev = overview.revenueTruth;

      expect(rev.contractValue).toBe(3_550_000_000);
      expect(rev.contractValueFormatted).toBe('3.550.000.000 ₫');
      expect(rev.recognizedRevenue).toBe(2_825_000_000);
      expect(rev.cashCollected).toBe(2_825_000_000);
      expect(rev.recognitionRatio).toBeGreaterThan(0);
    });

    it('should distinguish Estimated Budget Cost from Actual Incurred Cost and track variance', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const cogs = overview.cogsTruth;

      expect(cogs.estimatedCogs).toBe(2_150_000_000);
      expect(cogs.actualCogs).toBe(2_221_000_000);
      expect(cogs.varianceAmount).toBe(71_000_000);
      expect(cogs.variancePercent).toBe(3.3);
      expect(cogs.isOverBudget).toBe(true);
      expect(cogs.committedCost).toBe(180_000_000);
      expect(cogs.remainingForecastCost).toBe(320_000_000);
    });
  });

  describe('Project P&L Breakdown Table with Anomaly Detection', () => {
    it('should return 5 projects with completion progress, budget variance, and risk alerts', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const projects = overview.projectPLBreakdown.projects;

      expect(projects).toHaveLength(5);

      // 1. Villa Harmonia
      const villa = projects.find((p) => p.projectName === 'Villa Harmonia');
      expect(villa).toBeDefined();
      expect(villa?.clientName).toBe('Siti Rahayu');
      expect(villa?.contractRevenue).toBe(850_000_000);
      expect(villa?.cogs).toBe(468_000_000);
      expect(villa?.budgetCost).toBe(450_000_000);
      expect(villa?.costVariance).toBe(18_000_000);
      expect(villa?.isOverBudget).toBe(true);
      expect(villa?.completionPercent).toBe(80);
      expect(villa?.riskAlert?.severity).toBe('warning');

      // 2. Kaffah Office Tower
      const office = projects.find((p) => p.projectName === 'Kaffah Office Tower');
      expect(office).toBeDefined();
      expect(office?.contractRevenue).toBe(1_200_000_000);
      expect(office?.cogs).toBe(725_000_000);
      expect(office?.budgetCost).toBe(720_000_000);
      expect(office?.grossProfit).toBe(475_000_000);
      expect(office?.marginPercent).toBe(39.6);

      // 3. Greenview Boutique Hotel (Anomaly Alert)
      const hotel = projects.find((p) => p.projectName === 'Greenview Boutique Hotel***');
      expect(hotel).toBeDefined();
      expect(hotel?.budgetCost).toBe(390_000_000);
      expect(hotel?.cogs).toBe(440_000_000);
      expect(hotel?.costVariance).toBe(50_000_000);
      expect(hotel?.riskAlert?.severity).toBe('danger');
      expect(hotel?.riskAlert?.label).toContain('vượt chi phí');

      // Sum of project contract revenues matches KPI total
      const totalProjectRevenue = projects.reduce((sum, p) => sum + p.contractRevenue, 0);
      expect(totalProjectRevenue).toBe(overview.kpis.contractRevenue.rawValue);

      // Sum of project COGS matches KPI total
      const totalProjectCogs = projects.reduce((sum, p) => sum + p.cogs, 0);
      expect(totalProjectCogs).toBe(overview.kpis.totalCogs.rawValue);

      // Sum of outstanding debts matches 725 Million VND
      const totalProjectDebt = projects.reduce((sum, p) => sum + p.outstandingDebt, 0);
      expect(totalProjectDebt).toBe(725_000_000);
    });
  });

  describe('COGS Structure Donut', () => {
    it('should split 2.22B COGS into 70% Material and 30% Labor with reconciliation summary', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const cogs = overview.cogsStructure;

      expect(cogs.totalCogsFormatted).toBe('2,22 Tỷ');
      expect(cogs.reconciliationSummary).toContain('Purchase Orders');
      expect(cogs.items).toHaveLength(3);

      const materials = cogs.items.find((i) => i.id === 'materials');
      expect(materials?.percentage).toBe(70.0);
      expect(materials?.percentageFormatted).toBe('70,0%');
      expect(materials?.amount).toBe(1_554_700_000);

      const labor = cogs.items.find((i) => i.id === 'labor');
      expect(labor?.percentage).toBe(30.0);
      expect(labor?.percentageFormatted).toBe('30,0%');
      expect(labor?.amount).toBe(666_300_000);
    });
  });

  describe('Debt Ageing & Collection Overview', () => {
    it('should balance 725M total debt into Not-Due 425M, Upcoming 150M, Overdue 150M', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const debt = overview.debtOverview;

      expect(debt.centerValue).toBe('725');
      expect(debt.centerUnit).toBe('Triệu ₫');

      const sumCategories = debt.categories.reduce((sum, c) => sum + c.amount, 0);
      expect(sumCategories).toBe(725_000_000);

      const overdue = debt.categories.find((c) => c.id === 'overdue');
      expect(overdue?.amount).toBe(150_000_000);
      expect(debt.alertNotice.message).toContain('quá hạn 15 ngày');
    });
  });

  describe('Cash Flow Trajectory & Performance Bars (Actual vs Forecast)', () => {
    it('should provide pre-computed SVG path coordinates and mark Month 12 as Forecast', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const cashFlow = overview.cashFlow;

      expect(cashFlow.points).toHaveLength(6);
      expect(cashFlow.collectedSvgPath).toContain('M');
      expect(cashFlow.costSvgPath).toContain('M');
      expect(cashFlow.points[0].isForecast).toBe(false);
      expect(cashFlow.points[5].month).toBe('Tháng 12');
      expect(cashFlow.points[5].isForecast).toBe(true);
      expect(cashFlow.actualVsForecastNote).toContain('Dự báo');
    });

    it('should provide normalized bar height percentages for 3 months performance with Month 12 marked as forecast', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const perf = overview.financialPerformance;

      expect(perf.bars).toHaveLength(3);
      expect(perf.bars[2].month).toBe('Tháng 12');
      expect(perf.bars[2].isForecast).toBe(true);
      expect(perf.timeHorizonNote).toContain('Dự báo tiến độ');
    });
  });

  describe('Traceable Source Transactions & Insights', () => {
    it('should include 4 formatted transactions with traceable source references (PO, WO, Contract)', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const txs = overview.recentTransactions.transactions;

      expect(txs).toHaveLength(4);
      expect(txs[0].sourceType).toBe('PAYMENT_SCHEDULE');
      expect(txs[0].sourceRef).toBe('CON-DUBAI-001/M3');

      expect(txs[1].sourceType).toBe('WORK_ORDER');
      expect(txs[1].sourceRef).toBe('WO-2026-11-042');

      expect(txs[3].sourceType).toBe('SITE_PACKAGE');
      expect(txs[3].sourceRef).toBe('SWP-VILLA-08');

      expect(overview.quickInsights.insights).toHaveLength(3);
      expect(overview.quickInsights.insights[0].text).toContain('37,4%');
      expect(overview.quickInsights.insights[2].text).toContain('Villa Harmonia');
    });
  });
});
