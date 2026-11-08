/**
 * Bella Interior OS — Schedule & Dispatch Overview Contracts
 *
 * Source of truth for Schedule & Dispatch Suite (Lịch công việc & Điều phối).
 * All metrics, KPIs, weekly calendar task slots, resource readiness, progress tracking,
 * and dispatch alerts are calculated in the domain/server layer, never on the client UI.
 *
 * @module src/products/bella-interior/domain/schedule-overview.types
 */

export type ScheduleTaskCategory = 'design' | 'workshop' | 'site' | 'handover';
export type ScheduleTaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type ResourceWorkloadStatus = 'working' | 'available' | 'overloaded' | 'unassigned';
export type ScheduleAlertSeverity = 'critical' | 'warning' | 'info';

export interface ScheduleKPIItem {
  readonly value: number;
  readonly label: string;
  readonly trend: string;
  readonly isPositiveTrend: boolean;
}

export interface ScheduleKPIs {
  readonly totalTasks: ScheduleKPIItem;
  readonly completedTasks: ScheduleKPIItem;
  readonly inProgressTasks: ScheduleKPIItem;
  readonly overdueTasks: ScheduleKPIItem;
}

export interface WeeklyTimeSlot {
  readonly slotId: string;
  readonly timeRange: string; // e.g., '08:00 - 10:00'
}

export interface CalendarDayColumn {
  readonly dayOfWeek: string; // 'Thứ 3', 'Thứ 4', ..., 'Thứ 2'
  readonly dateFormatted: string; // '03/11', '04/11', ...
  readonly fullDate: string; // '2026-11-03'
  readonly isToday: boolean;
}

export interface ScheduledCalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly projectName: string;
  readonly assignee: string;
  readonly dayIndex: number; // 0 to 6 (Thứ 3 -> Thứ 2)
  readonly timeSlotId: string;
  readonly category: ScheduleTaskCategory;
  readonly categoryLabel: string;
  readonly badgeBgClass: string;
  readonly badgeBorderClass: string;
  readonly textColorClass: string;
}

export interface ScheduleAttentionAlert {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly actionLabel: string;
  readonly actionClass: string;
  readonly severity: ScheduleAlertSeverity;
}

export interface ResourceCapacitySummary {
  readonly readinessPercentage: number;
  readonly readinessLabel: string;
  readonly workingCount: number;
  readonly availableCount: number;
  readonly overloadedCount: number;
  readonly unassignedCount: number;
}

export interface UpcomingTaskItem {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly projectName: string;
  readonly category: ScheduleTaskCategory;
  readonly categoryLabel: string;
  readonly categoryClass: string;
  readonly assigneeAvatar: string;
}

export interface ProjectScheduleProgressItem {
  readonly id: string;
  readonly projectName: string;
  readonly projectThumbnail: string;
  readonly progressPercent: number;
  readonly statusLabel: string;
  readonly statusBadgeClass: string;
  readonly progressBarClass: string;
}

export interface ScheduleActionSuggestion {
  readonly title: string;
  readonly items: readonly string[];
}

export interface CreateScheduledTaskInput {
  readonly title: string;
  readonly projectName: string;
  readonly assignee: string;
  readonly dayIndex: number;
  readonly timeSlotId: string;
  readonly category: ScheduleTaskCategory;
  readonly priority?: 'normal' | 'urgent';
  readonly notes?: string;
  readonly status?: ScheduleTaskStatus;
}

export interface ScheduleOverviewResponse {
  readonly success: boolean;
  readonly tenantId: string;
  readonly weekRangeLabel: string;
  readonly kpis: ScheduleKPIs;
  readonly timeSlots: readonly WeeklyTimeSlot[];
  readonly days: readonly CalendarDayColumn[];
  readonly calendarEvents: readonly ScheduledCalendarEvent[];
  readonly attentionAlerts: readonly ScheduleAttentionAlert[];
  readonly resourceCapacity: ResourceCapacitySummary;
  readonly upcomingTasks: readonly UpcomingTaskItem[];
  readonly projectProgress: readonly ProjectScheduleProgressItem[];
  readonly actionSuggestions: ScheduleActionSuggestion;
}
