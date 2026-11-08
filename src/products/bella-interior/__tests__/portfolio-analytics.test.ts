/**
 * Bella Interior OS — Portfolio Analytics & Executive Calculation Tests
 *
 * Verifies:
 * 1. Tenant Isolation (Gate 0 / P0)
 * 2. Zero UI calculation invariant: all metrics, P&L values, and variances are computed in the service
 * 3. Accurate formatting and categorization of portfolio KPIs, financial summaries, and operational alerts
 */

import { InteriorPortfolioAnalyticsService } from '../services/interior-portfolio-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorPortfolioAnalyticsService', () => {
  let service: InteriorPortfolioAnalyticsService;

  beforeEach(() => {
    service = new InteriorPortfolioAnalyticsService();
  });

  it('should enforce Tenant Isolation (Gate 0)', async () => {
    await expect(service.computePortfolioOverview('')).rejects.toThrow(
      TenantIsolationViolationError
    );
  });

  it('should compute complete portfolio overview with 4 KPI cards matching executive design', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result).toBeDefined();
    expect(result.kpis).toBeDefined();
    expect(result.kpis.totalProjects.value).toBe(24);
    expect(result.kpis.totalProjects.trend).toBe('12%');
    expect(result.kpis.inProgress.value).toBe(18);
    expect(result.kpis.inProgress.trend).toBe('8%');
    expect(result.kpis.delayedRisk.value).toBe(3);
    expect(result.kpis.delayedRisk.trend).toBe('1%');
    expect(result.kpis.averageGrossMargin.value).toBe('42%');
  });

  it('should provide canonical projects with pre-computed deadline labels and schedule health', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.projects.length).toBe(4);
    const [villa, office, skyline, garden] = result.projects;

    expect(villa.name).toBe('Villa Sunrise Renovation');
    expect(villa.stage).toBe('design');
    expect(villa.scheduleStatus).toBe('on_track');
    expect(villa.daysRemainingLabel).toBe('Còn 27 ngày');
    expect(villa.isDeadlineUrgent).toBe(true);

    expect(office.name).toBe('Office Tower Lobby');
    expect(office.stage).toBe('production');
    expect(office.scheduleStatus).toBe('ahead');
    expect(office.scheduleStatusLabel).toBe('Vượt tiến độ +2%');

    expect(skyline.name).toBe('Skyline Residence');
    expect(skyline.stage).toBe('installation');
    expect(skyline.scheduleStatus).toBe('delayed');
    expect(skyline.scheduleStatusLabel).toBe('Chậm tiến độ -5%');

    expect(garden.name).toBe('The Garden Villa');
    expect(garden.stage).toBe('handover');
    expect(garden.scheduleStatus).toBe('on_track');
  });

  it('should compute financial summary with formatted P&L and receivables', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.financialSummary).toBeDefined();
    expect(result.financialSummary.totalContractFormatted).toBe('12.8 tỷ đ');
    expect(result.financialSummary.collectedFormatted).toBe('8.6 tỷ đ');
    expect(result.financialSummary.receivableFormatted).toBe('4.2 tỷ đ');
    expect(result.financialSummary.actualProfitFormatted).toBe('4.8 tỷ đ');
    expect(result.financialSummary.averageMarginPercent).toBe(42.3);
  });

  it('should compute progress distribution and operational action alerts', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.progressOverview.overallProgressPercent).toBe(85);
    expect(result.progressOverview.onTrackPercent).toBe(72);
    expect(result.progressOverview.delayedPercent).toBe(18);
    expect(result.progressOverview.completedPercent).toBe(10);
    expect(result.progressOverview.specialAttentionCount).toBe(3);

    expect(result.actionAlerts.length).toBe(4);
    expect(result.actionAlerts[0].type).toBe('critical');
    expect(result.actionAlerts[0].title).toContain('Skyline Residence');
  });

  it('should compute multi-period business chain progress across the 4 key stages', async () => {
    const result = await service.computePortfolioOverview('tenant-test-001');

    expect(result.businessChainProgress).toBeDefined();
    expect(result.businessChainProgress?.defaultPeriod).toBe('this_month');

    const thisMonth = result.businessChainProgress?.periods.this_month;
    expect(thisMonth).toBeDefined();
    expect(thisMonth?.periodLabel).toBe('Tháng này');
    expect(thisMonth?.stages.length).toBe(4);

    const design = thisMonth?.stages.find((s) => s.key === 'design');
    const commercial = thisMonth?.stages.find((s) => s.key === 'commercial');
    const production = thisMonth?.stages.find((s) => s.key === 'production');
    const handover = thisMonth?.stages.find((s) => s.key === 'handover');

    expect(design?.percent).toBe(92);
    expect(commercial?.percent).toBe(85);
    expect(production?.percent).toBe(70);
    expect(handover?.percent).toBe(45);
    expect(thisMonth?.overallPercent).toBe(65);
    expect(thisMonth?.statusLabel).toBe('Đúng tiến độ');

    const lastMonth = result.businessChainProgress?.periods.last_month;
    expect(lastMonth).toBeDefined();
    expect(lastMonth?.periodLabel).toBe('Tháng trước');
    expect(lastMonth?.overallPercent).toBe(58);

    const thisQuarter = result.businessChainProgress?.periods.this_quarter;
    expect(thisQuarter).toBeDefined();
    expect(thisQuarter?.statusLabel).toBe('Vượt tiến độ +3%');
    expect(thisQuarter?.overallPercent).toBe(72);
  });
});
