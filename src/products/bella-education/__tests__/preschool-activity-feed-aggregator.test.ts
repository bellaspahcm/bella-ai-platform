import { describe, expect, it } from '@jest/globals';
import { PreschoolAnalyticsService } from '../analytics/services/preschool-analytics.service';
import type { PreschoolAnalyticsRepository } from '../analytics/repositories/preschool-analytics.repository';
import type { PreschoolActivityItemDTO } from '../analytics/domain/preschool-analytics.types';

const tenantId = 'tenant-preschool-test';

describe('Preschool Activity Feed Aggregator & Executive Analytics', () => {
  it('aggregates cross-module activities into recentActivities in the Executive Dashboard DTO', async () => {
    const mockActivities: PreschoolActivityItemDTO[] = [
      {
        id: 'pickup-1',
        category: 'ATTENDANCE',
        categoryLabel: 'Điểm danh & Đón trả',
        title: 'Bé Nguyễn Minh Anh',
        description: 'Đã đến trường an toàn (Cô Mai đón)',
        timestamp: '2026-10-20T07:32:00Z',
        displayTime: '07:32',
        actorRole: 'Học sinh',
        status: 'Đã đến',
      },
      {
        id: 'act-1',
        category: 'LEARNING',
        categoryLabel: 'Học tập & Trải nghiệm',
        title: 'Lớp Lá 1',
        description: 'Hoàn thành hoạt động: Bé trồng cây',
        timestamp: '2026-10-20T10:15:00Z',
        displayTime: '10:15',
        actorRole: 'Giáo viên',
        status: 'Hoàn thành',
      },
      {
        id: 'fin-1',
        category: 'FINANCE',
        categoryLabel: 'Tài chính & Học phí',
        title: 'Hóa đơn #HP-10-001',
        description: 'Thanh toán học phí thành công: 3.500.000 đ',
        timestamp: '2026-10-20T14:08:00Z',
        displayTime: '14:08',
        actorRole: 'Phụ huynh',
        status: 'Đã thanh toán',
      },
    ];

    const repoStub = {
      async getEnrollmentRawData() {
        return { enrolledStudents: [], classrooms: [] };
      },
      async getAttendanceRawData() {
        return [];
      },
      async getCareSafetyRawData() {
        return { activeIncidents: [], pendingMedications: [] };
      },
      async getLearningRawData() {
        return { draftPortfolios: [], pendingObservations: [] };
      },
      async getParentEngagementRawData() {
        return [];
      },
      async getFinanceRawData() {
        return { invoices: [], reconciliations: [] };
      },
      async getWorkforceRawData() {
        return { activeViolations: [], openExceptions: [] };
      },
      async getFacilitiesRawData() {
        return { unhealthyAssets: [], unhealthyZones: [], overdueSchedules: [], safetyExceptions: [] };
      },
      async getRecentActivitiesRawData(_tId: string, _date: string) {
        return mockActivities;
      },
    } as unknown as PreschoolAnalyticsRepository;

    const service = new PreschoolAnalyticsService(repoStub);
    const dashboard = await service.getExecutiveDashboard(tenantId, '2026-10-20');

    expect(dashboard.recentActivities).toBeDefined();
    expect(dashboard.recentActivities).toHaveLength(3);
    expect(dashboard.recentActivities?.[0].category).toBe('ATTENDANCE');
    expect(dashboard.recentActivities?.[1].category).toBe('LEARNING');
    expect(dashboard.recentActivities?.[2].category).toBe('FINANCE');
  });
});
