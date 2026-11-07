/**
 * Installation & Site Operations Analytics Service Tests
 *
 * Verifies that InteriorInstallationAnalyticsService returns exact data invariants
 * matching the Site Operations executive dashboard mockup.
 * Enforces Zero UI Calculation contract.
 */

import { InteriorInstallationAnalyticsService } from '../services/interior-installation-analytics.service';

describe('InteriorInstallationAnalyticsService', () => {
  describe('getInstallationOverview()', () => {
    it('returns a complete InstallationOverviewResponse', () => {
      const overview = InteriorInstallationAnalyticsService.getInstallationOverview();
      expect(overview).toBeDefined();
      expect(overview.projectHeader).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.overallProgress).toBeDefined();
      expect(overview.rooms).toBeDefined();
      expect(overview.timelineChart).toBeDefined();
      expect(overview.alerts).toBeDefined();
      expect(overview.quickActions).toBeDefined();
    });

    it('returns available projects list for selector', () => {
      const overview = InteriorInstallationAnalyticsService.getInstallationOverview();
      expect(overview.availableProjects.length).toBeGreaterThan(0);
      expect(overview.availableProjects[0].code).toBe('INT-2024-001');
    });
  });

  describe('Project header invariants', () => {
    it('contains Site Operations badge label and Villa Sunrise project', () => {
      const header = InteriorInstallationAnalyticsService.getProjectHeader();
      expect(header.name).toBe('Villa Sunrise Renovation');
      expect(header.code).toBe('INT-2024-001');
      expect(header.badgeLabel).toBe('Site Operations');
      expect(header.status).toBe('installing');
      expect(header.statusLabel).toBe('Đang thi công');
    });
  });

  describe('KPI invariants', () => {
    let kpis: ReturnType<typeof InteriorInstallationAnalyticsService.getKpis>;

    beforeEach(() => {
      kpis = InteriorInstallationAnalyticsService.getKpis();
    });

    it('totalRooms is 4 with two-digit formatted "04"', () => {
      expect(kpis.totalRooms.rawValue).toBe(4);
      expect(kpis.totalRooms.formattedValue).toBe('04');
      expect(kpis.totalRooms.label).toBe('Tổng số phòng');
      expect(kpis.totalRooms.colorClass).toContain('blue');
    });

    it('installingRooms is 2 with two-digit formatted "02"', () => {
      expect(kpis.installingRooms.rawValue).toBe(2);
      expect(kpis.installingRooms.formattedValue).toBe('02');
      expect(kpis.installingRooms.label).toBe('Đang thi công');
    });

    it('completedRooms is 0 with two-digit formatted "00"', () => {
      expect(kpis.completedRooms.rawValue).toBe(0);
      expect(kpis.completedRooms.formattedValue).toBe('00');
      expect(kpis.completedRooms.label).toBe('Hoàn thành');
    });

    it('attentionRooms is 1 with two-digit formatted "01"', () => {
      expect(kpis.attentionRooms.rawValue).toBe(1);
      expect(kpis.attentionRooms.formattedValue).toBe('01');
      expect(kpis.attentionRooms.label).toBe('Cần chú ý');
      expect(kpis.attentionRooms.colorClass).toContain('amber');
    });

    it('all KPI items specify iconBgClass and watermarkType', () => {
      expect(kpis.totalRooms.iconBgClass).toBeTruthy();
      expect(kpis.totalRooms.watermarkType).toBe('home');
      expect(kpis.installingRooms.watermarkType).toBe('circle');
      expect(kpis.completedRooms.watermarkType).toBe('check');
      expect(kpis.attentionRooms.watermarkType).toBe('warning');
    });
  });

  describe('Overall progress invariants', () => {
    it('is exactly 40% with pre-computed formatted value and emerald color', () => {
      const overall = InteriorInstallationAnalyticsService.getOverallProgress();
      expect(overall.progressPercent).toBe(40);
      expect(overall.progressFormatted).toBe('40%');
      expect(overall.progressBarColor).toBe('#10b981');
      expect(overall.title).toBe('Tổng tiến độ dự án');
    });
  });

  describe('Room installation cards invariants', () => {
    let rooms: ReturnType<typeof InteriorInstallationAnalyticsService.getRooms>;

    beforeEach(() => {
      rooms = InteriorInstallationAnalyticsService.getRooms();
    });

    it('returns exactly 4 room cards', () => {
      expect(rooms).toHaveLength(4);
    });

    it('R01_LIVING is at 75% progress with installing status', () => {
      const room = rooms.find((r) => r.code === 'R01_LIVING');
      expect(room).toBeDefined();
      expect(room!.roomName).toBe('Phòng Khách Luxury');
      expect(room!.progressPercent).toBe(75);
      expect(room!.progressFormatted).toBe('75%');
      expect(room!.modulesCount).toBe(6);
      expect(room!.modulesFormatted).toBe('Khối lượng: 6 modules');
      expect(room!.deadlineFormatted).toBe('Hạn: 2026-11-12');
      expect(room!.status).toBe('installing');
      expect(room!.statusLabel).toBe('Đang lắp đặt');
      expect(room!.progressBarColor).toBe('#10b981');
    });

    it('R02_KITCHEN is at 40% progress with installing status and amber bar', () => {
      const room = rooms.find((r) => r.code === 'R02_KITCHEN');
      expect(room).toBeDefined();
      expect(room!.roomName).toBe('Bếp & Phòng Ăn Master');
      expect(room!.progressPercent).toBe(40);
      expect(room!.progressFormatted).toBe('40%');
      expect(room!.modulesCount).toBe(12);
      expect(room!.modulesFormatted).toBe('Khối lượng: 12 modules');
      expect(room!.deadlineFormatted).toBe('Hạn: 2026-11-15');
      expect(room!.status).toBe('installing');
      expect(room!.statusLabel).toBe('Đang lắp đặt');
      expect(room!.progressBarColor).toBe('#f59e0b');
    });

    it('R03_MASTER is at 10% progress with pending status and blue bar', () => {
      const room = rooms.find((r) => r.code === 'R03_MASTER');
      expect(room).toBeDefined();
      expect(room!.roomName).toBe('Phòng Ngủ Master Suite');
      expect(room!.progressPercent).toBe(10);
      expect(room!.progressFormatted).toBe('10%');
      expect(room!.modulesCount).toBe(8);
      expect(room!.status).toBe('pending');
      expect(room!.statusLabel).toBe('Chờ lắp');
      expect(room!.progressBarColor).toBe('#3b82f6');
    });

    it('R04_CLOSET is at 0% progress with pending status and slate bar', () => {
      const room = rooms.find((r) => r.code === 'R04_CLOSET');
      expect(room).toBeDefined();
      expect(room!.roomName).toBe('Phòng Thay Đồ Walk-in Closet');
      expect(room!.progressPercent).toBe(0);
      expect(room!.progressFormatted).toBe('0%');
      expect(room!.modulesCount).toBe(5);
      expect(room!.deadlineFormatted).toBe('Hạn: 2026-11-20');
      expect(room!.status).toBe('pending');
      expect(room!.statusLabel).toBe('Chờ lắp');
    });

    it('all rooms have valid status badges and image URLs', () => {
      rooms.forEach((r) => {
        expect(r.statusBadgeClass).toBeTruthy();
        expect(r.imageUrl).toMatch(/^https:\/\//);
      });
    });
  });

  describe('Timeline Gantt chart invariants', () => {
    let timeline: ReturnType<typeof InteriorInstallationAnalyticsService.getTimelineChart>;

    beforeEach(() => {
      timeline = InteriorInstallationAnalyticsService.getTimelineChart();
    });

    it('returns exactly 7 days columns from 03/11 T2 to 09/11 CN', () => {
      expect(timeline.days).toHaveLength(7);
      expect(timeline.days[0].label).toBe('03/11');
      expect(timeline.days[0].dayOfWeek).toBe('T2');
      expect(timeline.days[6].label).toBe('09/11');
      expect(timeline.days[6].dayOfWeek).toBe('CN');
    });

    it('returns 4 Gantt rows matching the 4 rooms', () => {
      expect(timeline.rows).toHaveLength(4);
      const codes = timeline.rows.map((r) => r.roomCode);
      expect(codes).toEqual(['R01_LIVING', 'R02_KITCHEN', 'R03_MASTER', 'R04_CLOSET']);
    });

    it('R01_LIVING spans 4 days from day 0', () => {
      const row = timeline.rows[0];
      expect(row.startDayIndex).toBe(0);
      expect(row.durationDays).toBe(4);
      expect(row.leftPercent).toBe(0);
      expect(row.widthPercent).toBeCloseTo(57.14, 1);
      expect(row.hasStartMarker).toBe(true);
      expect(row.hasEndMarker).toBe(true);
      expect(row.barColor).toBe('#10b981');
    });

    it('R02_KITCHEN spans 5 days from day 1', () => {
      const row = timeline.rows[1];
      expect(row.startDayIndex).toBe(1);
      expect(row.durationDays).toBe(5);
      expect(row.leftPercent).toBeCloseTo(14.29, 1);
      expect(row.widthPercent).toBeCloseTo(71.43, 1);
      expect(row.barColor).toBe('#f59e0b');
    });

    it('R03_MASTER spans 3 days from day 2', () => {
      const row = timeline.rows[2];
      expect(row.startDayIndex).toBe(2);
      expect(row.durationDays).toBe(3);
      expect(row.leftPercent).toBeCloseTo(28.57, 1);
      expect(row.widthPercent).toBeCloseTo(42.86, 1);
      expect(row.barColor).toBe('#3b82f6');
    });

    it('R04_CLOSET is configured as faint track', () => {
      const row = timeline.rows[3];
      expect(row.isFaintTrack).toBe(true);
      expect(row.hasStartMarker).toBe(false);
      expect(row.hasEndMarker).toBe(false);
    });

    it('all row spans do not exceed 100% width', () => {
      timeline.rows.forEach((r) => {
        expect(r.leftPercent + r.widthPercent).toBeLessThanOrEqual(100.1);
      });
    });
  });

  describe('Alerts invariants', () => {
    let alerts: ReturnType<typeof InteriorInstallationAnalyticsService.getAlerts>;

    beforeEach(() => {
      alerts = InteriorInstallationAnalyticsService.getAlerts();
    });

    it('returns exactly 4 alert/activity items', () => {
      expect(alerts.items).toHaveLength(4);
    });

    it('first alert is warning about R02_KITCHEN delay', () => {
      const item = alerts.items[0];
      expect(item.type).toBe('warning');
      expect(item.message).toContain('R02_KITCHEN');
      expect(item.timeFormatted).toBe('09:30 09/11');
      expect(item.iconType).toBe('alert-triangle');
    });

    it('second alert is QC completion for R01_LIVING', () => {
      const item = alerts.items[1];
      expect(item.type).toBe('success');
      expect(item.message).toContain('Hoàn thành QC');
      expect(item.timeFormatted).toBe('08:45 09/11');
      expect(item.iconType).toBe('check-circle');
    });

    it('third alert is site diary entry', () => {
      const item = alerts.items[2];
      expect(item.type).toBe('note');
      expect(item.message).toContain('nhật ký thi công');
      expect(item.timeFormatted).toBe('16:20 08/11');
    });

    it('fourth alert is site photo update', () => {
      const item = alerts.items[3];
      expect(item.type).toBe('media');
      expect(item.message).toContain('hình ảnh hiện trường');
      expect(item.timeFormatted).toBe('14:10 08/11');
      expect(item.iconType).toBe('image');
    });
  });

  describe('Quick actions invariants', () => {
    let actions: ReturnType<typeof InteriorInstallationAnalyticsService.getQuickActions>;

    beforeEach(() => {
      actions = InteriorInstallationAnalyticsService.getQuickActions();
    });

    it('returns exactly 4 quick action navigation cards', () => {
      expect(actions).toHaveLength(4);
      expect(actions.map((a) => a.title)).toEqual([
        'Lịch Thi Công',
        'QC & Punch List',
        'Báo Cáo Tiến Độ',
        'Nhật Ký Thi Công',
      ]);
    });

    it('all cards have valid route destinations', () => {
      actions.forEach((a) => {
        expect(a.href).toMatch(/^\/dashboard\/interior/);
      });
    });
  });

  describe('Zero UI Calculation Contract', () => {
    it('ensures all display strings, percentages, and styles are pre-computed', () => {
      const overview = InteriorInstallationAnalyticsService.getInstallationOverview();

      // KPIs
      expect(typeof overview.kpis.totalRooms.formattedValue).toBe('string');
      expect(typeof overview.kpis.installingRooms.formattedValue).toBe('string');
      expect(typeof overview.kpis.completedRooms.formattedValue).toBe('string');
      expect(typeof overview.kpis.attentionRooms.formattedValue).toBe('string');

      // Overall Progress
      expect(typeof overview.overallProgress.progressFormatted).toBe('string');

      // Rooms
      overview.rooms.forEach((r) => {
        expect(typeof r.progressFormatted).toBe('string');
        expect(typeof r.modulesFormatted).toBe('string');
        expect(typeof r.deadlineFormatted).toBe('string');
        expect(typeof r.statusLabel).toBe('string');
        expect(typeof r.statusBadgeClass).toBe('string');
        expect(typeof r.progressBarColor).toBe('string');
      });

      // Gantt Timeline
      overview.timelineChart.rows.forEach((row) => {
        expect(typeof row.leftPercent).toBe('number');
        expect(typeof row.widthPercent).toBe('number');
        expect(typeof row.barColor).toBe('string');
        expect(typeof row.barBgClass).toBe('string');
      });
    });
  });
});
