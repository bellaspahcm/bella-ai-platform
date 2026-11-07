/**
 * QC & Handover Analytics Service Tests
 *
 * Verifies that InteriorQCHandoverAnalyticsService returns exact data invariants
 * matching the QC, Punch List & Handover Gate executive dashboard mockup.
 * Enforces Zero UI Calculation contract.
 */

import { InteriorQCHandoverAnalyticsService } from '../services/interior-qc-handover-analytics.service';

describe('InteriorQCHandoverAnalyticsService', () => {
  describe('getQCHandoverOverview()', () => {
    it('returns a complete QCHandoverOverviewResponse', () => {
      const overview = InteriorQCHandoverAnalyticsService.getQCHandoverOverview();
      expect(overview).toBeDefined();
      expect(overview.projectHeader).toBeDefined();
      expect(overview.handoverGate).toBeDefined();
      expect(overview.filterTabs).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.table).toBeDefined();
      expect(overview.projectInfoCard).toBeDefined();
      expect(overview.qualityRoadmap).toBeDefined();
      expect(overview.commitmentBanner).toBeDefined();
    });

    it('returns available projects list for selector', () => {
      const overview = InteriorQCHandoverAnalyticsService.getQCHandoverOverview();
      expect(overview.availableProjects.length).toBeGreaterThan(0);
      expect(overview.availableProjects[0].label).toBe('The Horizon Residence');
    });
  });

  describe('Project header invariants', () => {
    it('contains The Horizon Residence project details and notification count', () => {
      const header = InteriorQCHandoverAnalyticsService.getProjectHeader();
      expect(header.name).toBe('The Horizon Residence');
      expect(header.location).toBe('Quận 7, TP. Hồ Chí Minh');
      expect(header.plannedHandoverDate).toBe('15/10/2026');
      expect(header.notificationsCount).toBe(3);
    });
  });

  describe('Handover Gate invariants', () => {
    let gate: ReturnType<typeof InteriorQCHandoverAnalyticsService.getHandoverGate>;

    beforeEach(() => {
      gate = InteriorQCHandoverAnalyticsService.getHandoverGate();
    });

    it('is READY FOR HANDOVER with verified critical items', () => {
      expect(gate.status).toBe('READY FOR HANDOVER');
      expect(gate.badgeLabel).toBe('READY FOR HANDOVER');
      expect(gate.isEligibleForHandover).toBe(true);
      expect(gate.criticalVerifiedCount).toBe(1);
      expect(gate.totalCriticalCount).toBe(1);
    });

    it('contains warranty certificate button label and valid banner image URL', () => {
      expect(gate.warrantyCertificateButtonLabel).toContain('Chứng Thư Bảo Hành');
      expect(gate.bannerImageUrl).toMatch(/^https:\/\//);
    });
  });

  describe('Filter tabs invariants', () => {
    let tabs: ReturnType<typeof InteriorQCHandoverAnalyticsService.getFilterTabs>;

    beforeEach(() => {
      tabs = InteriorQCHandoverAnalyticsService.getFilterTabs();
    });

    it('returns 5 filter tabs matching mockup counts', () => {
      expect(tabs).toHaveLength(5);
      const allTab = tabs.find((t) => t.id === 'all');
      const openTab = tabs.find((t) => t.id === 'open');
      const inProgTab = tabs.find((t) => t.id === 'in_progress');
      const rectifiedTab = tabs.find((t) => t.id === 'rectified');
      const verifiedTab = tabs.find((t) => t.id === 'verified');

      expect(allTab!.count).toBe(3);
      expect(openTab!.count).toBe(1);
      expect(inProgTab!.count).toBe(1);
      expect(rectifiedTab!.count).toBe(0);
      expect(verifiedTab!.count).toBe(1);
    });
  });

  describe('KPI invariants', () => {
    let kpis: ReturnType<typeof InteriorQCHandoverAnalyticsService.getKpis>;

    beforeEach(() => {
      kpis = InteriorQCHandoverAnalyticsService.getKpis();
    });

    it('totalPunchList is 3 with trend ↑ 0%', () => {
      expect(kpis.totalPunchList.rawValue).toBe(3);
      expect(kpis.totalPunchList.formattedValue).toBe('3');
      expect(kpis.totalPunchList.subLabel).toBe('↑ 0%');
      expect(kpis.totalPunchList.sparklineSvgPath).toMatch(/^M /);
    });

    it('pendingPunchList is 1 with subLabel 33.3%', () => {
      expect(kpis.pendingPunchList.rawValue).toBe(1);
      expect(kpis.pendingPunchList.formattedValue).toBe('1');
      expect(kpis.pendingPunchList.subLabel).toBe('33.3%');
      expect(kpis.pendingPunchList.sparklineSvgPath).toMatch(/^M /);
    });

    it('verifiedPunchList is 1 with subLabel 33.3%', () => {
      expect(kpis.verifiedPunchList.rawValue).toBe(1);
      expect(kpis.verifiedPunchList.formattedValue).toBe('1');
      expect(kpis.verifiedPunchList.subLabel).toBe('33.3%');
      expect(kpis.verifiedPunchList.sparklineSvgPath).toMatch(/^M /);
    });

    it('overduePunchList is 1 with subLabel 33.3%', () => {
      expect(kpis.overduePunchList.rawValue).toBe(1);
      expect(kpis.overduePunchList.formattedValue).toBe('1');
      expect(kpis.overduePunchList.subLabel).toBe('33.3%');
      expect(kpis.overduePunchList.sparklineSvgPath).toMatch(/^M /);
    });
  });

  describe('Punch list table rows invariants', () => {
    let rows: ReturnType<typeof InteriorQCHandoverAnalyticsService.getTableRows>;

    beforeEach(() => {
      rows = InteriorQCHandoverAnalyticsService.getTableRows();
    });

    it('returns exactly 3 punch list rows', () => {
      expect(rows).toHaveLength(3);
    });

    it('row 1 is PL-001 (Critical, overdue, red accent border)', () => {
      const row = rows[0];
      expect(row.code).toBe('PL-001');
      expect(row.zoneArea).toBe('Phòng khách');
      expect(row.categoryName).toBe('Sơn tường');
      expect(row.severity).toBe('critical');
      expect(row.severityLabel).toBe('Critical');
      expect(row.isOverdue).toBe(true);
      expect(row.overdueBadgeLabel).toBe('> Quá hạn');
      expect(row.status).toBe('in_progress');
      expect(row.statusLabel).toBe('Đang sửa');
      expect(row.hasRedAccentBorder).toBe(true);
      expect(row.assigneeName).toBe('Trần Văn Minh');
      expect(row.assigneeAvatarUrl).toMatch(/^https:\/\//);
    });

    it('row 2 is PL-002 (Major, verified)', () => {
      const row = rows[1];
      expect(row.code).toBe('PL-002');
      expect(row.zoneArea).toBe('Phòng ngủ Master');
      expect(row.categoryName).toBe('Nội thất gỗ');
      expect(row.severity).toBe('major');
      expect(row.isOverdue).toBe(false);
      expect(row.status).toBe('verified');
      expect(row.statusLabel).toBe('Đang sửa' ? 'Đã xác thực' : row.statusLabel);
      expect(row.hasRedAccentBorder).toBe(false);
      expect(row.assigneeName).toBe('Nguyễn Thị Hà');
    });

    it('row 3 is PL-003 (Minor, open)', () => {
      const row = rows[2];
      expect(row.code).toBe('PL-003');
      expect(row.zoneArea).toBe('Bếp');
      expect(row.categoryName).toBe('Đá bàn bếp');
      expect(row.severity).toBe('minor');
      expect(row.isOverdue).toBe(false);
      expect(row.status).toBe('open');
      expect(row.statusLabel).toBe('Mới mở');
      expect(row.hasRedAccentBorder).toBe(false);
      expect(row.assigneeName).toBe('Lê Văn Dũng');
    });
  });

  describe('Quality Roadmap invariants', () => {
    let roadmap: ReturnType<typeof InteriorQCHandoverAnalyticsService.getQualityRoadmap>;

    beforeEach(() => {
      roadmap = InteriorQCHandoverAnalyticsService.getQualityRoadmap();
    });

    it('has 5 workflow steps', () => {
      expect(roadmap.steps).toHaveLength(5);
    });

    it('steps 1, 2, 3 are completed', () => {
      expect(roadmap.steps[0].status).toBe('completed');
      expect(roadmap.steps[1].status).toBe('completed');
      expect(roadmap.steps[2].status).toBe('completed');
    });

    it('step 4 is active (Xác thực)', () => {
      expect(roadmap.steps[3].stepNumber).toBe(4);
      expect(roadmap.steps[3].name).toBe('Xác thực');
      expect(roadmap.steps[3].status).toBe('active');
    });

    it('step 5 is upcoming (Nghiệm thu)', () => {
      expect(roadmap.steps[4].stepNumber).toBe(5);
      expect(roadmap.steps[4].name).toBe('Nghiệm thu');
      expect(roadmap.steps[4].status).toBe('upcoming');
    });
  });

  describe('Commitment banner invariants', () => {
    it('contains quality commitment title and image URL', () => {
      const banner = InteriorQCHandoverAnalyticsService.getCommitmentBanner();
      expect(banner.title).toBe('Chất lượng tạo nên giá trị');
      expect(banner.imageUrl).toMatch(/^https:\/\//);
    });
  });

  describe('Zero UI Calculation Contract', () => {
    it('ensures all display values, status labels, badge classes, and formatting are pre-computed', () => {
      const overview = InteriorQCHandoverAnalyticsService.getQCHandoverOverview();

      expect(typeof overview.kpis.totalPunchList.formattedValue).toBe('string');
      expect(typeof overview.kpis.pendingPunchList.formattedValue).toBe('string');
      expect(typeof overview.kpis.verifiedPunchList.formattedValue).toBe('string');
      expect(typeof overview.kpis.overduePunchList.formattedValue).toBe('string');

      overview.table.rows.forEach((row) => {
        expect(typeof row.severityBadgeClass).toBe('string');
        expect(typeof row.statusBadgeClass).toBe('string');
        expect(typeof row.deadlineFormatted).toBe('string');
        expect(typeof row.isOverdue).toBe('boolean');
        expect(typeof row.hasRedAccentBorder).toBe('boolean');
      });
    });
  });
});

