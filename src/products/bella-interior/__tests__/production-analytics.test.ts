/**
 * Production Analytics Service Tests
 *
 * Verifies that InteriorProductionAnalyticsService returns exact data invariants
 * matching the executive dashboard mockup. Enforces Zero UI Calculation contract.
 */
import { InteriorProductionAnalyticsService } from '../services/interior-production-analytics.service';

describe('InteriorProductionAnalyticsService', () => {
  describe('getProductionOverview()', () => {
    it('returns a complete ProductionOverviewResponse', () => {
      const overview = InteriorProductionAnalyticsService.getProductionOverview();
      expect(overview).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.workflowStages).toBeDefined();
      expect(overview.efficiencyMetrics).toBeDefined();
      expect(overview.timelineChart).toBeDefined();
      expect(overview.ordersTable).toBeDefined();
      expect(overview.alerts).toBeDefined();
      expect(overview.workshopCapacities).toBeDefined();
    });
  });

  describe('KPI invariants', () => {
    let kpis: ReturnType<typeof InteriorProductionAnalyticsService.getKpis>;

    beforeEach(() => {
      kpis = InteriorProductionAnalyticsService.getKpis();
    });

    it('totalOrders is 128', () => {
      expect(kpis.totalOrders.rawValue).toBe(128);
      expect(kpis.totalOrders.formattedValue).toBe('128');
    });

    it('inProductionOrders is 46', () => {
      expect(kpis.inProductionOrders.rawValue).toBe(46);
      expect(kpis.inProductionOrders.formattedValue).toBe('46');
    });

    it('completedOrders is 68', () => {
      expect(kpis.completedOrders.rawValue).toBe(68);
      expect(kpis.completedOrders.formattedValue).toBe('68');
    });

    it('needsAttentionOrders is 14', () => {
      expect(kpis.needsAttentionOrders.rawValue).toBe(14);
      expect(kpis.needsAttentionOrders.formattedValue).toBe('14');
    });

    it('totalOrders trend is up +12%', () => {
      expect(kpis.totalOrders.trendDirection).toBe('up');
      expect(kpis.totalOrders.trendLabel).toContain('12%');
    });

    it('needsAttentionOrders trend is down (good — emerald because fewer problems)', () => {
      expect(kpis.needsAttentionOrders.trendDirection).toBe('down');
      // Cần xử lý going DOWN is GOOD → emerald (fewer problems is positive)
      expect(kpis.needsAttentionOrders.trendColorClass).toContain('emerald');
    });

    it('all KPI items have sparkline SVG paths', () => {
      expect(kpis.totalOrders.sparklineSvgPath).toMatch(/^M /);
      expect(kpis.inProductionOrders.sparklineSvgPath).toMatch(/^M /);
      expect(kpis.completedOrders.sparklineSvgPath).toMatch(/^M /);
      expect(kpis.needsAttentionOrders.sparklineSvgPath).toMatch(/^M /);
    });
  });

  describe('Workflow stages invariants', () => {
    let stages: ReturnType<typeof InteriorProductionAnalyticsService.getWorkflowStages>;

    beforeEach(() => {
      stages = InteriorProductionAnalyticsService.getWorkflowStages();
    });

    it('returns exactly 7 workflow stages', () => {
      expect(stages).toHaveLength(7);
    });

    it('stages are numbered 1–7', () => {
      stages.forEach((s, i) => {
        expect(s.stageNumber).toBe(i + 1);
      });
    });

    it('stages 1 and 2 are completed', () => {
      expect(stages[0].status).toBe('completed');
      expect(stages[1].status).toBe('completed');
    });

    it('stage 3 (Dán Cạnh PUR) is in_progress with badge', () => {
      expect(stages[2].status).toBe('in_progress');
      expect(stages[2].statusBadge).toBeDefined();
      expect(stages[2].statusBadge).toContain('Đang');
    });

    it('stages 4–7 are pending', () => {
      for (let i = 3; i < 7; i++) {
        expect(stages[i].status).toBe('pending');
      }
    });

    it('stage keys are unique', () => {
      const keys = stages.map((s) => s.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(7);
    });
  });

  describe('Efficiency metrics invariants', () => {
    let metrics: ReturnType<typeof InteriorProductionAnalyticsService.getEfficiencyMetrics>;

    beforeEach(() => {
      metrics = InteriorProductionAnalyticsService.getEfficiencyMetrics();
    });

    it('overall rate is 82%', () => {
      expect(metrics.overallRate).toBe(82);
      expect(metrics.overallRateFormatted).toBe('82%');
    });

    it('returns 4 stage efficiency items', () => {
      expect(metrics.stages).toHaveLength(4);
    });

    it('Cắt ván CNC efficiency is 90%', () => {
      const cnc = metrics.stages.find((s) => s.stageName.includes('CNC'));
      expect(cnc).toBeDefined();
      expect(cnc!.percentage).toBe(90);
    });

    it('Lắp ráp khung efficiency is 62% (lowest)', () => {
      const frame = metrics.stages.find((s) => s.stageName.includes('khung'));
      expect(frame).toBeDefined();
      expect(frame!.percentage).toBe(62);
    });

    it('donutDashArray is a valid SVG stroke-dasharray string', () => {
      expect(metrics.donutDashArray).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?$/);
    });

    it('donutDashOffset is a numeric string', () => {
      expect(parseFloat(metrics.donutDashOffset)).toBeGreaterThan(0);
    });
  });

  describe('Timeline chart invariants', () => {
    let chart: ReturnType<typeof InteriorProductionAnalyticsService.getTimelineChart>;

    beforeEach(() => {
      chart = InteriorProductionAnalyticsService.getTimelineChart();
    });

    it('returns 7 data points (T2 through CN)', () => {
      expect(chart.points).toHaveLength(7);
    });

    it('day labels are T2, T3, T4, T5, T6, T7, CN', () => {
      const labels = chart.points.map((p) => p.dayLabel);
      expect(labels).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    });

    it('planned and actual SVG paths start with M', () => {
      expect(chart.plannedSvgPath).toMatch(/^M /);
      expect(chart.actualSvgPath).toMatch(/^M /);
    });

    it('all points have pre-formatted percentage strings', () => {
      chart.points.forEach((p) => {
        expect(p.plannedPercentFormatted).toMatch(/^\d+%$/);
        expect(p.actualPercentFormatted).toMatch(/^\d+%$/);
      });
    });

    it('all points have valid SVG coordinates (numbers)', () => {
      chart.points.forEach((p) => {
        expect(typeof p.xCoord).toBe('number');
        expect(typeof p.yPlannedCoord).toBe('number');
        expect(typeof p.yActualCoord).toBe('number');
      });
    });
  });

  describe('Orders table invariants', () => {
    let table: ReturnType<typeof InteriorProductionAnalyticsService.getOrdersTable>;

    beforeEach(() => {
      table = InteriorProductionAnalyticsService.getOrdersTable();
    });

    it('returns 5 order rows', () => {
      expect(table.rows).toHaveLength(5);
    });

    it('tabs total count equals 128', () => {
      const allTab = table.tabs.find((t) => t.id === 'all');
      expect(allTab).toBeDefined();
      expect(allTab!.count).toBe(128);
    });

    it('tabs in_production count equals 46', () => {
      const tab = table.tabs.find((t) => t.id === 'in_production');
      expect(tab!.count).toBe(46);
    });

    it('tabs delayed count equals 14', () => {
      const tab = table.tabs.find((t) => t.id === 'delayed');
      expect(tab!.count).toBe(14);
    });

    it('tabs completed count equals 68', () => {
      const tab = table.tabs.find((t) => t.id === 'completed');
      expect(tab!.count).toBe(68);
    });

    it('first row is SX-2024-1087 with status in_production', () => {
      expect(table.rows[0].id).toBe('SX-2024-1087');
      expect(table.rows[0].status).toBe('in_production');
    });

    it('second row SX-2024-1086 is delayed', () => {
      expect(table.rows[1].id).toBe('SX-2024-1086');
      expect(table.rows[1].status).toBe('delayed');
    });

    it('third row SX-2024-1085 has warning status', () => {
      expect(table.rows[2].id).toBe('SX-2024-1085');
      expect(table.rows[2].status).toBe('warning');
    });

    it('all rows have pre-computed statusBadgeClass (no raw status in UI)', () => {
      table.rows.forEach((row) => {
        expect(row.statusBadgeClass).toBeTruthy();
        expect(row.statusBadgeClass).toMatch(/bg-/);
      });
    });

    it('all rows have pre-formatted progressFormatted (%)', () => {
      table.rows.forEach((row) => {
        expect(row.progressFormatted).toMatch(/^\d+%$/);
      });
    });

    it('all rows have progressBarColor hex strings', () => {
      table.rows.forEach((row) => {
        expect(row.progressBarColor).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('headers array has 8 columns', () => {
      expect(table.headers).toHaveLength(8);
    });
  });

  describe('Alerts invariants', () => {
    let alertData: ReturnType<typeof InteriorProductionAnalyticsService.getAlerts>;

    beforeEach(() => {
      alertData = InteriorProductionAnalyticsService.getAlerts();
    });

    it('returns 3 alert items', () => {
      expect(alertData.items).toHaveLength(3);
    });

    it('first alert is danger severity', () => {
      expect(alertData.items[0].severity).toBe('danger');
    });

    it('second alert is warning severity', () => {
      expect(alertData.items[1].severity).toBe('warning');
    });

    it('third alert is info severity', () => {
      expect(alertData.items[2].severity).toBe('info');
    });

    it('all alerts have timeFormatted strings', () => {
      alertData.items.forEach((a) => {
        expect(a.timeFormatted).toMatch(/^\d{2}:\d{2}$/);
      });
    });
  });

  describe('Workshop capacities invariants', () => {
    let capacities: ReturnType<typeof InteriorProductionAnalyticsService.getWorkshopCapacities>;

    beforeEach(() => {
      capacities = InteriorProductionAnalyticsService.getWorkshopCapacities();
    });

    it('returns 4 workshops', () => {
      expect(capacities.workshops).toHaveLength(4);
    });

    it('Xưởng A capacity is 92%', () => {
      const ws = capacities.workshops.find((w) => w.workshopName === 'Xưởng A');
      expect(ws).toBeDefined();
      expect(ws!.capacityPercent).toBe(92);
      expect(ws!.capacityFormatted).toBe('92%');
    });

    it('Xưởng B capacity is 78%', () => {
      const ws = capacities.workshops.find((w) => w.workshopName === 'Xưởng B');
      expect(ws!.capacityPercent).toBe(78);
    });

    it('Xưởng C capacity is 85%', () => {
      const ws = capacities.workshops.find((w) => w.workshopName === 'Xưởng C');
      expect(ws!.capacityPercent).toBe(85);
    });

    it('Xưởng D capacity is 70% (lowest)', () => {
      const ws = capacities.workshops.find((w) => w.workshopName === 'Xưởng D');
      expect(ws!.capacityPercent).toBe(70);
    });

    it('all workshops have barColor hex strings', () => {
      capacities.workshops.forEach((ws) => {
        expect(ws.barColor).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('heightPercent equals capacityPercent (pre-computed bar height)', () => {
      capacities.workshops.forEach((ws) => {
        expect(ws.heightPercent).toBe(ws.capacityPercent);
      });
    });
  });

  describe('Zero UI Calculation contract', () => {
    it('all formatted values are pre-computed strings, not raw numbers exposed for UI math', () => {
      const overview = InteriorProductionAnalyticsService.getProductionOverview();
      // KPIs: formattedValue must be a string
      expect(typeof overview.kpis.totalOrders.formattedValue).toBe('string');
      // Efficiency: formatted
      expect(typeof overview.efficiencyMetrics.overallRateFormatted).toBe('string');
      // Timeline: each point has pre-formatted values
      overview.timelineChart.points.forEach((p) => {
        expect(typeof p.plannedPercentFormatted).toBe('string');
        expect(typeof p.actualPercentFormatted).toBe('string');
      });
      // Orders: progressFormatted
      overview.ordersTable.rows.forEach((row) => {
        expect(typeof row.progressFormatted).toBe('string');
        expect(typeof row.statusLabel).toBe('string');
        expect(typeof row.statusBadgeClass).toBe('string');
      });
    });
  });

  describe('Architecture notice', () => {
    it('contains Manufacturing Bridge badge label', () => {
      const notice = InteriorProductionAnalyticsService.getArchitectureNotice();
      expect(notice.bridgeBadgeLabel).toBeTruthy();
      expect(notice.title).toContain('Ủy Quyền Sản Xuất');
    });
  });
});
