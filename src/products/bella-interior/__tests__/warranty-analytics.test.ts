import { InteriorWarrantyAnalyticsService } from '../services/interior-warranty-analytics.service';

describe('InteriorWarrantyAnalyticsService', () => {
  describe('getWarrantyOverview()', () => {
    it('returns a complete WarrantyOverviewResponse with valid structure', async () => {
      const response = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(response).toBeDefined();
      expect(response.project).toBeDefined();
      expect(response.kpis).toBeDefined();
      expect(response.certificates).toBeDefined();
      expect(response.calendar).toBeDefined();
      expect(response.roadmap).toBeDefined();
      expect(response.recentActivities).toBeDefined();
    });

    it('returns available projects list for selector', async () => {
      const response = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(response.availableProjects.length).toBeGreaterThanOrEqual(3);
      expect(response.availableProjects[0].name).toBe('The Horizon Residence');
    });
  });

  describe('Project header and alert invariants', () => {
    it('contains The Horizon Residence project details and notification count', async () => {
      const response = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(response.project.code).toBe('INT-2024-001');
      expect(response.project.name).toBe('The Horizon Residence');
      expect(response.project.notificationCount).toBe(3);
    });

    it('contains expiry alert for 1 certificate within 90 days', async () => {
      const response = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(response.expiryAlert.count).toBe(1);
      expect(response.expiryAlert.thresholdDays).toBe(90);
      expect(response.expiryAlert.message).toContain('1 certificate expiring within 90 days');
    });
  });

  describe('6 KPI cards invariants', () => {
    it('totalCertificates is 24 with trend ↑ 2%', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.totalCertificates.rawValue).toBe(24);
      expect(kpis.totalCertificates.formattedValue).toBe('24');
      expect(kpis.totalCertificates.subLabel).toBe('↑ 2%');
    });

    it('activeCertificates is 22 with 91.7%', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.activeCertificates.rawValue).toBe(22);
      expect(kpis.activeCertificates.formattedValue).toBe('22');
      expect(kpis.activeCertificates.percentage).toBe(91.7);
    });

    it('expiringCertificates is 1 with 4.2%', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.expiringCertificates.rawValue).toBe(1);
      expect(kpis.expiringCertificates.formattedValue).toBe('1');
      expect(kpis.expiringCertificates.percentage).toBe(4.2);
    });

    it('expiredCertificates is 1 with 4.2%', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.expiredCertificates.rawValue).toBe(1);
      expect(kpis.expiredCertificates.formattedValue).toBe('1');
      expect(kpis.expiredCertificates.percentage).toBe(4.2);
    });

    it('openTickets is 5 with trend ↑ 1', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.openTickets.rawValue).toBe(5);
      expect(kpis.openTickets.formattedValue).toBe('5');
      expect(kpis.openTickets.subLabel).toBe('↑ 1');
    });

    it('warrantyCost is 68.5M ₫', async () => {
      const { kpis } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(kpis.warrantyCost.formattedValue).toBe('68.5M ₫');
    });
  });

  describe('Warranty certificates table invariants', () => {
    it('returns exactly 5 certificates displayed in mockup', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(certificates).toHaveLength(5);
    });

    it('row 1 is WC-2024-001 (Active)', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const r1 = certificates[0];
      expect(r1.certificateNo).toBe('WC-2024-001');
      expect(r1.project).toBe('The Horizon Residence');
      expect(r1.client).toBe('Trần Minh Anh');
      expect(r1.status).toBe('active');
      expect(r1.statusLabel).toBe('Đang hiệu lực');
    });

    it('row 2 is WC-2024-002 (Expiring soon)', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const r2 = certificates[1];
      expect(r2.certificateNo).toBe('WC-2024-002');
      expect(r2.project).toBe('The Orchard Penthouse');
      expect(r2.status).toBe('expiring_soon');
      expect(r2.statusLabel).toBe('Sắp hết hạn');
    });

    it('row 3 is WC-2023-005 (Expired)', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const r3 = certificates[2];
      expect(r3.certificateNo).toBe('WC-2023-005');
      expect(r3.status).toBe('expired');
      expect(r3.statusLabel).toBe('Đã hết hạn');
    });

    it('row 4 is WC-2022-003 (Expired)', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const r4 = certificates[3];
      expect(r4.certificateNo).toBe('WC-2022-003');
      expect(r4.status).toBe('expired');
    });

    it('row 5 is WC-2024-003 (Active)', async () => {
      const { certificates } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const r5 = certificates[4];
      expect(r5.certificateNo).toBe('WC-2024-003');
      expect(r5.status).toBe('active');
    });
  });

  describe('Calendar invariants', () => {
    it('contains November 2026 month label and 7 days of week', async () => {
      const { calendar } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(calendar.monthLabel).toBe('Tháng 11/2026');
      expect(calendar.daysOfWeek).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    });

    it('highlights Day 12 and marks alerts on Day 19 and Day 21', async () => {
      const { calendar } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      const day12 = calendar.days.find((d) => d && d.dayNumber === 12);
      expect(day12?.isHighlighted).toBe(true);

      const day19 = calendar.days.find((d) => d && d.dayNumber === 19);
      expect(day19?.hasAmberDot).toBe(true);

      const day21 = calendar.days.find((d) => d && d.dayNumber === 21);
      expect(day21?.hasRedDot).toBe(true);
    });
  });

  describe('Roadmap and Activity invariants', () => {
    it('has 5 workflow steps with completed status', async () => {
      const { roadmap } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(roadmap).toHaveLength(5);
      expect(roadmap[0].title).toBe('1. Quản lý Chứng thư');
      expect(roadmap[4].title).toBe('5. Đánh giá Khách hàng');
      roadmap.forEach((step) => {
        expect(step.status).toBe('completed');
      });
    });

    it('has recent activities matching mockup', async () => {
      const { recentActivities } = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(recentActivities).toHaveLength(3);
      expect(recentActivities[0].title).toContain('Ticket #ST-2026-011');
      expect(recentActivities[1].title).toContain('Ticket #ST-2026-010');
      expect(recentActivities[2].title).toContain('WC-2024-002');
    });
  });

  describe('Zero UI Calculation Contract', () => {
    it('ensures all display values, status labels, badge classes, and formatting are pre-computed', async () => {
      const response = await InteriorWarrantyAnalyticsService.getWarrantyOverview();
      expect(response.pagination.displayRange).toBe('Hiển thị 1–5 trong 24 kết quả');
      expect(response.reassuranceBanner.title).toBe('Bảo hành an tâm');
      expect(response.reassuranceBanner.imageUrl).toMatch(/^https?:\/\//);

      // Verify certificate rows have pre-computed classes
      for (const row of response.certificates) {
        expect(typeof row.statusBadgeClass).toBe('string');
        expect(typeof row.statusDotClass).toBe('string');
        expect(typeof row.statusLabel).toBe('string');
      }
    });
  });
});

