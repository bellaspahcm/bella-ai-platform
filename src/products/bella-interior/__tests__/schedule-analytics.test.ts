/**
 * Unit Tests for InteriorScheduleAnalyticsService
 *
 * Verifies tenant isolation, calculation correctness, calendar event mappings,
 * and zero-UI-calculation guarantees.
 */

import { InteriorScheduleAnalyticsService } from '../services/interior-schedule-analytics.service';
import { TenantIsolationViolationError } from '../domain/errors';

describe('InteriorScheduleAnalyticsService', () => {
  const TEST_TENANT = 'tenant-interior-schedule-001';

  it('throws TenantIsolationViolationError when tenantId is empty or whitespace', () => {
    expect(() => InteriorScheduleAnalyticsService.getScheduleOverview('')).toThrow(
      TenantIsolationViolationError,
    );
    expect(() => InteriorScheduleAnalyticsService.getScheduleOverview('   ')).toThrow(
      TenantIsolationViolationError,
    );
  });

  it('returns valid 4 KPIs matching canonical metrics', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.kpis.totalTasks.value).toBe(48);
    expect(overview.kpis.completedTasks.value).toBe(32);
    expect(overview.kpis.inProgressTasks.value).toBe(11);
    expect(overview.kpis.overdueTasks.value).toBe(5);
  });

  it('provides 4 time slots and 7 calendar days', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.timeSlots).toHaveLength(4);
    expect(overview.days).toHaveLength(7);
    expect(overview.days[0].dayOfWeek).toBe('Thứ 3');
    expect(overview.days[6].dayOfWeek).toBe('Thứ 2');
    expect(overview.days[0].isToday).toBe(true);
  });

  it('returns 6 canonical scheduled events with proper category bindings', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.calendarEvents).toHaveLength(6);
    const evt1 = overview.calendarEvents[0];
    expect(evt1.title).toBe('Khảo sát công trình');
    expect(evt1.projectName).toBe('Villa Sunrise');
    expect(evt1.assignee).toBe('KTS. Hoàng Long');
    expect(evt1.dayIndex).toBe(0);
    expect(evt1.timeSlotId).toBe('slot-1');
  });

  it('provides resource capacity breakdown with 78% readiness', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.resourceCapacity.readinessPercentage).toBe(78);
    expect(overview.resourceCapacity.workingCount).toBe(18);
    expect(overview.resourceCapacity.availableCount).toBe(4);
    expect(overview.resourceCapacity.overloadedCount).toBe(2);
    expect(overview.resourceCapacity.unassignedCount).toBe(3);
  });

  it('returns 4 upcoming tasks and 4 project progress bars', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.upcomingTasks).toHaveLength(4);
    expect(overview.upcomingTasks[0].time).toBe('08:00');
    expect(overview.projectProgress).toHaveLength(4);
    expect(overview.projectProgress[0].projectName).toBe('Villa Sunrise Renovation');
    expect(overview.projectProgress[0].progressPercent).toBe(92);
  });

  it('returns 3 action suggestions and 3 attention alerts', () => {
    const overview = InteriorScheduleAnalyticsService.getScheduleOverview(TEST_TENANT);
    expect(overview.attentionAlerts).toHaveLength(3);
    expect(overview.attentionAlerts[0].title).toBe('3 công việc quá hạn');
    expect(overview.actionSuggestions.items).toHaveLength(3);
  });

  describe('Dynamic Task Creation & Canonical Source of Truth Persistence', () => {
    const DYNAMIC_TENANT = 'tenant-dynamic-test-999';

    beforeEach(() => {
      InteriorScheduleAnalyticsService.resetTenantTasks(DYNAMIC_TENANT);
    });

    afterEach(() => {
      InteriorScheduleAnalyticsService.resetTenantTasks(DYNAMIC_TENANT);
    });

    it('creates a new scheduled task and updates intermediate domain state and KPIs', () => {
      const initial = InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT);
      expect(initial.kpis.totalTasks.value).toBe(48);
      expect(initial.calendarEvents).toHaveLength(6);

      const newTask = InteriorScheduleAnalyticsService.createScheduledTask(DYNAMIC_TENANT, {
        title: 'Khảo sát hiện trạng mặt bằng',
        projectName: 'Villa Ciputra',
        assignee: 'KTS. Trần Đăng',
        dayIndex: 2,
        timeSlotId: 'slot-2',
        category: 'design',
      });

      expect(newTask.id).toMatch(/^evt-custom-/);
      expect(newTask.title).toBe('Khảo sát hiện trạng mặt bằng');
      expect(newTask.projectName).toBe('Villa Ciputra');
      expect(newTask.categoryLabel).toBe('Thiết kế');

      // Check updated overview (Source of Truth)
      const updated = InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT);
      expect(updated.kpis.totalTasks.value).toBe(49);
      expect(updated.kpis.inProgressTasks.value).toBe(12);
      expect(updated.calendarEvents).toHaveLength(7);
      expect(updated.calendarEvents.some((e) => e.id === newTask.id)).toBe(true);
    });

    it('enforces validation when creating scheduled tasks', () => {
      expect(() =>
        InteriorScheduleAnalyticsService.createScheduledTask('', {
          title: 'Test',
          projectName: 'P',
          assignee: 'A',
          dayIndex: 0,
          timeSlotId: 'slot-1',
          category: 'site',
        }),
      ).toThrow(TenantIsolationViolationError);

      expect(() =>
        InteriorScheduleAnalyticsService.createScheduledTask(DYNAMIC_TENANT, {
          title: '',
          projectName: 'P',
          assignee: 'A',
          dayIndex: 0,
          timeSlotId: 'slot-1',
          category: 'site',
        }),
      ).toThrow('Task title is required');
    });

    it('completes a task and increases completedTasks count', () => {
      const task = InteriorScheduleAnalyticsService.createScheduledTask(DYNAMIC_TENANT, {
        title: 'Giao hàng đợt 1',
        projectName: 'Duplex Aqua',
        assignee: 'Đội 2',
        dayIndex: 3,
        timeSlotId: 'slot-3',
        category: 'site',
      });

      InteriorScheduleAnalyticsService.completeScheduledTask(DYNAMIC_TENANT, task.id);
      const overview = InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT);
      expect(overview.kpis.completedTasks.value).toBe(33); // 32 + 1
      expect(overview.kpis.inProgressTasks.value).toBe(11); // 11 + 1 - 1
    });

    it('deletes a custom task from the intermediate store', () => {
      const task = InteriorScheduleAnalyticsService.createScheduledTask(DYNAMIC_TENANT, {
        title: 'Họp khẩn',
        projectName: 'Office Tower',
        assignee: 'PM. Mai',
        dayIndex: 1,
        timeSlotId: 'slot-1',
        category: 'design',
      });

      expect(
        InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT).calendarEvents,
      ).toHaveLength(7);

      InteriorScheduleAnalyticsService.deleteScheduledTask(DYNAMIC_TENANT, task.id);
      expect(
        InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT).calendarEvents,
      ).toHaveLength(6);
      expect(
        InteriorScheduleAnalyticsService.getScheduleOverview(DYNAMIC_TENANT).kpis.totalTasks.value,
      ).toBe(48);
    });
  });
});
