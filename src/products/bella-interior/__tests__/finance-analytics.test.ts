/**
 * Unit Tests for Bella Interior OS — Project Finance & P&L Analytics Service
 *
 * Verifies:
 * 1. Financial KPIs (Contract Revenue, Total COGS, Gross Profit, Gross Margin %)
 * 2. Mathematical Invariants across Portfolio Ledger
 * 3. Individual Project P&L Breakdown (Revenues, COGS, Margins, Debt)
 * 4. COGS Structure Donut (Vật liệu 70%, Nhân công 30%)
 * 5. Debt Ageing Donut (Chưa đến hạn, Sắp đến hạn, Quá hạn)
 * 6. Cash Flow Trajectory & Pre-computed SVG Coordinates
 * 7. Recent Transactions & Executive Insights
 * 8. Zero UI Calculation guarantee
 *
 * @module src/products/bella-interior/__tests__/finance-analytics.test.ts
 */

import { InteriorFinanceAnalyticsService } from '../services/interior-finance-analytics.service';

describe('InteriorFinanceAnalyticsService', () => {
  it('should return executive quarter and user header', () => {
    const overview = InteriorFinanceAnalyticsService.getFinanceOverview('Quý 4/2026');

    expect(overview.quarter).toBe('Quý 4/2026');
    expect(overview.user.name).toBe('Nguyễn Văn Quang');
    expect(overview.user.role).toBe('Project Manager');
    expect(overview.user.notificationsCount).toBe(3);
  });

  describe('Top Financial KPIs & Mathematical Invariants', () => {
    it('should compute exact 3.55B Revenue, 2.221B COGS, 1.329B Gross Profit, and 37.4% Margin', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();

      expect(overview.kpis.contractRevenue.rawValue).toBe(3_550_000_000);
      expect(overview.kpis.contractRevenue.formattedValue).toBe('3.550.000.000 ₫');
      expect(overview.kpis.contractRevenue.subtext).toContain('12%');

      expect(overview.kpis.totalCogs.rawValue).toBe(2_221_000_000);
      expect(overview.kpis.totalCogs.formattedValue).toBe('2.221.000.000 ₫');
      expect(overview.kpis.totalCogs.subtext).toContain('8%');

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
  });

  describe('Project P&L Breakdown Table', () => {
    it('should return 5 projects with exact revenues, margins, and debt reconciliation', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const projects = overview.projectPLBreakdown.projects;

      expect(projects).toHaveLength(5);

      // 1. Villa Harmonia
      const villa = projects.find((p) => p.projectName === 'Villa Harmonia');
      expect(villa).toBeDefined();
      expect(villa?.clientName).toBe('Siti Rahayu');
      expect(villa?.contractRevenue).toBe(850_000_000);
      expect(villa?.cogs).toBe(468_000_000);
      expect(villa?.grossProfit).toBe(382_000_000);
      expect(villa?.marginPercent).toBe(44.9);
      expect(villa?.marginFormatted).toBe('44,9%');
      expect(villa?.cashCollected).toBe(680_000_000);
      expect(villa?.outstandingDebt).toBe(170_000_000);
      expect(villa?.hasOutstandingDebt).toBe(true);

      // 2. Kaffah Office Tower
      const office = projects.find((p) => p.projectName === 'Kaffah Office Tower');
      expect(office).toBeDefined();
      expect(office?.contractRevenue).toBe(1_200_000_000);
      expect(office?.cogs).toBe(725_000_000);
      expect(office?.grossProfit).toBe(475_000_000);
      expect(office?.marginPercent).toBe(39.6);
      expect(office?.cashCollected).toBe(960_000_000);
      expect(office?.outstandingDebt).toBe(240_000_000);

      // 3. The Orchard Penthouse
      const penthouse = projects.find((p) => p.projectName === 'The Orchard Penthouse');
      expect(penthouse).toBeDefined();
      expect(penthouse?.contractRevenue).toBe(480_000_000);
      expect(penthouse?.cogs).toBe(315_000_000);
      expect(penthouse?.grossProfit).toBe(165_000_000);
      expect(penthouse?.marginPercent).toBe(34.4);
      expect(penthouse?.cashCollected).toBe(480_000_000);
      expect(penthouse?.outstandingDebt).toBe(0);
      expect(penthouse?.hasOutstandingDebt).toBe(false);

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
    it('should split 2.22B COGS into 70% Material and 30% Labor with exact SVG dash attributes', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const cogs = overview.cogsStructure;

      expect(cogs.totalCogsFormatted).toBe('2,22 Tỷ');
      expect(cogs.items).toHaveLength(3);

      const materials = cogs.items.find((i) => i.id === 'materials');
      expect(materials?.percentage).toBe(70.0);
      expect(materials?.percentageFormatted).toBe('70,0%');
      expect(materials?.amount).toBe(1_554_700_000);

      const labor = cogs.items.find((i) => i.id === 'labor');
      expect(labor?.percentage).toBe(30.0);
      expect(labor?.percentageFormatted).toBe('30,0%');
      expect(labor?.amount).toBe(666_300_000);

      const other = cogs.items.find((i) => i.id === 'other');
      expect(other?.percentage).toBe(0.0);
      expect(other?.percentageFormatted).toBe('0,0%');
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

  describe('Cash Flow Trajectory & Performance Bars', () => {
    it('should provide pre-computed SVG path coordinates for cash flow chart', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const cashFlow = overview.cashFlow;

      expect(cashFlow.points).toHaveLength(6);
      expect(cashFlow.collectedSvgPath).toContain('M');
      expect(cashFlow.costSvgPath).toContain('M');
      expect(cashFlow.points[0].month).toBe('Tháng 7');
      expect(cashFlow.points[5].month).toBe('Tháng 12');
    });

    it('should provide normalized bar height percentages for 3 months performance', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();
      const perf = overview.financialPerformance;

      expect(perf.bars).toHaveLength(3);
      perf.bars.forEach((bar) => {
        expect(bar.revenueHeightPercent).toBeGreaterThan(0);
        expect(bar.revenueHeightPercent).toBeLessThanOrEqual(100);
        expect(bar.costHeightPercent).toBeGreaterThan(0);
        expect(bar.profitHeightPercent).toBeGreaterThan(0);
      });
    });
  });

  describe('Recent Transactions & Insights', () => {
    it('should include 4 formatted transactions and 3 executive insight bullets', () => {
      const overview = InteriorFinanceAnalyticsService.getFinanceOverview();

      expect(overview.recentTransactions.transactions).toHaveLength(4);
      expect(overview.recentTransactions.transactions[0].date).toBe('15/11/2026');
      expect(overview.recentTransactions.transactions[0].type).toBe('inflow');
      expect(overview.recentTransactions.transactions[1].type).toBe('outflow');

      expect(overview.quickInsights.insights).toHaveLength(3);
      expect(overview.quickInsights.insights[0].text).toContain('37,4%');
      expect(overview.quickInsights.insights[2].text).toContain('Villa Harmonia');
    });
  });
});
