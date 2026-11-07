import { InteriorReportsAnalyticsService } from '../services/interior-reports-analytics.service';

describe('InteriorReportsAnalyticsService', () => {
  describe('getReportsOverview() Dossier Structure', () => {
    it('returns a complete ReportsOverviewResponse with valid structure', async () => {
      const response = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(response).toBeDefined();
      expect(response.project).toBeDefined();
      expect(response.availableProjects).toBeDefined();
      expect(response.filterOptions).toBeDefined();
      expect(response.kpis).toBeDefined();
      expect(response.trends).toBeDefined();
      expect(response.costStructure).toBeDefined();
      expect(response.projectPerformance).toBeDefined();
      expect(response.managementAlerts).toBeDefined();
      expect(response.lifecycleSteps).toBeDefined();
    });

    it('returns project selector with The Horizon Residence as default', async () => {
      const response = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(response.project.code).toBe('INT-2024-001');
      expect(response.project.name).toBe('The Horizon Residence');
      expect(response.availableProjects.length).toBeGreaterThanOrEqual(4);
    });

    it('supports switching project id', async () => {
      const response = await InteriorReportsAnalyticsService.getReportsOverview(
        'tenant-bella-interior-001',
        'INT-2024-002'
      );
      expect(response.project.id).toBe('INT-2024-002');
      expect(response.project.name).toBe('Villa Ciputra Giai Đoạn 2');
    });
  });

  describe('4 KPI Cards Invariants (Mockup Exact Match)', () => {
    it('KPI 1: contractValue is 9,28 tỷ đ with +12% monthly growth', async () => {
      const { kpis } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(kpis.contractValue.rawValue).toBe(9280000000);
      expect(kpis.contractValue.formattedValue).toBe('9,28 tỷ đ');
      expect(kpis.contractValue.label).toBe('Tổng giá trị hợp đồng');
      expect(kpis.contractValue.subLabel).toContain('+12%');
      expect(kpis.contractValue.sparklineType).toBe('bars');
    });

    it('KPI 2: grossMargin is 40.7% with target >= 38%', async () => {
      const { kpis } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(kpis.grossMargin.rawValue).toBe(40.7);
      expect(kpis.grossMargin.formattedValue).toBe('40.7%');
      expect(kpis.grossMargin.label).toBe('Biên lợi nhuận gộp TB');
      expect(kpis.grossMargin.subLabel).toContain('38%');
      expect(kpis.grossMargin.sparklineType).toBe('wave');
    });

    it('KPI 3: onTimeRate is 91.6% with 11/12 projects', async () => {
      const { kpis } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(kpis.onTimeRate.rawValue).toBe(91.6);
      expect(kpis.onTimeRate.formattedValue).toBe('91.6%');
      expect(kpis.onTimeRate.label).toBe('Tỷ lệ đúng tiến độ');
      expect(kpis.onTimeRate.subLabel).toBe('11/12 dự án');
      expect(kpis.onTimeRate.sparklineType).toBe('donut');
    });

    it('KPI 4: punchListErrors is 0 critical errors with ISO compliance', async () => {
      const { kpis } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(kpis.punchListErrors.rawValue).toBe(0);
      expect(kpis.punchListErrors.formattedValue).toBe('0 lỗi chí mạng');
      expect(kpis.punchListErrors.label).toBe('Lỗi Punch List');
      expect(kpis.punchListErrors.subLabel).toBe('Đạt chuẩn ISO');
      expect(kpis.punchListErrors.sparklineType).toBe('shield');
    });
  });

  describe('Business Performance Trends (6 Months Dual-Bar & Trendline)', () => {
    it('has 6 chronological months from May to October 2026', async () => {
      const { trends } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(trends.months).toHaveLength(6);
      expect(trends.months[0].monthLabel).toBe('Tháng 5');
      expect(trends.months[5].monthLabel).toBe('Tháng 10');
    });

    it('pre-computes bar heights and margins for Zero UI Calculation', async () => {
      const { trends } = await InteriorReportsAnalyticsService.getReportsOverview();
      const oct = trends.months[5];
      expect(oct.revenueBillion).toBe(9.28);
      expect(oct.revenueFormatted).toBe('9.28B');
      expect(oct.grossProfitFormatted).toBe('3.8B');
      expect(oct.marginFormatted).toBe('40.7%');
      expect(oct.revenueBarHeightPercent).toBe(92.8);
      expect(oct.profitBarHeightPercent).toBe(37.8);
    });

    it('provides valid pre-computed SVG polyline coordinates', async () => {
      const { trends } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(trends.trendlineSvgPoints).toBeTruthy();
      const points = trends.trendlineSvgPoints.split(' ');
      expect(points).toHaveLength(6);
      points.forEach((point) => {
        const [x, y] = point.split(',').map(Number);
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
      });
    });
  });

  describe('Cost Structure & Donut Arc Geometry', () => {
    it('total cost formatted is 8.43 tỷ đ', async () => {
      const { costStructure } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(costStructure.totalCostFormatted).toBe('8.43 tỷ đ');
      expect(costStructure.totalCostSublabel).toBe('Tổng chi phí');
    });

    it('has 3 cost categories that sum exactly to 100%', async () => {
      const { costStructure } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(costStructure.items).toHaveLength(3);
      const sumPercentage = costStructure.items.reduce((acc, it) => acc + it.percentage, 0);
      expect(Math.round(sumPercentage)).toBe(100);
      expect(costStructure.items[0].label).toBe('Vật tư');
      expect(costStructure.items[0].percentageFormatted).toBe('40.4%');
      expect(costStructure.items[1].label).toBe('Nhân công');
      expect(costStructure.items[1].percentageFormatted).toBe('33.2%');
      expect(costStructure.items[2].label).toBe('Chi phí khác');
      expect(costStructure.items[2].percentageFormatted).toBe('26.4%');
    });

    it('provides pre-computed SVG strokeDasharray and offsets for 3 segments', async () => {
      const { costStructure } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(costStructure.donutSegments).toHaveLength(3);
      costStructure.donutSegments.forEach((seg) => {
        expect(seg.strokeDasharray).toContain('238.76');
        expect(seg.color).toMatch(/^#/);
      });
    });
  });

  describe('Project Performance Table', () => {
    it('contains 3 featured projects matching the design', async () => {
      const { projectPerformance } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(projectPerformance).toHaveLength(3);

      const [ciputra, dubai, metropolis] = projectPerformance;
      expect(ciputra.name).toBe('Villa Ciputra Giai Đoạn 2');
      expect(ciputra.contractValueFormatted).toBe('2.45 tỷ đ');
      expect(ciputra.materialCostFormatted).toBe('980 triệu đ');
      expect(ciputra.laborCostFormatted).toBe('450 triệu đ');
      expect(ciputra.collectedFormatted).toBe('1.80 tỷ đ');
      expect(ciputra.grossMarginFormatted).toBe('41.5%');
      expect(ciputra.status).toBe('on_schedule');

      expect(dubai.name).toBe('Dubai Luxury Villa Fitout');
      expect(dubai.contractValueFormatted).toBe('3.78 tỷ đ');
      expect(dubai.grossMarginFormatted).toBe('43.1%');

      expect(metropolis.name).toBe('Penthouse Metropolis L. Giai');
      expect(metropolis.contractValueFormatted).toBe('2.20 tỷ đ');
      expect(metropolis.grossMarginFormatted).toBe('39.8%');
    });
  });

  describe('Management Alerts & Project Lifecycle Steps', () => {
    it('contains 3 priority management alerts with action badges', async () => {
      const { managementAlerts } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(managementAlerts).toHaveLength(3);
      expect(managementAlerts[0].level).toBe('critical');
      expect(managementAlerts[0].badgeLabel).toBe('Cần lưu ý');
      expect(managementAlerts[1].level).toBe('warning');
      expect(managementAlerts[1].badgeLabel).toBe('Theo dõi');
      expect(managementAlerts[2].level).toBe('info');
      expect(managementAlerts[2].badgeLabel).toBe('Kiểm tra');
    });

    it('contains 5 standard project management lifecycle steps', async () => {
      const { lifecycleSteps } = await InteriorReportsAnalyticsService.getReportsOverview();
      expect(lifecycleSteps).toHaveLength(5);
      expect(lifecycleSteps[0].title).toBe('1. Quản lý Chứng thư');
      expect(lifecycleSteps[1].title).toBe('2. Tiếp nhận Yêu cầu DV');
      expect(lifecycleSteps[2].title).toBe('3. Thực hiện Sửa chữa');
      expect(lifecycleSteps[3].title).toBe('4. Xác nhận Hoàn thành');
      expect(lifecycleSteps[4].title).toBe('5. Đánh giá Khách hàng');
    });
  });
});

