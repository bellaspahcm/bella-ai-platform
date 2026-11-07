/**
 * Bella Interior OS — Canonical Site Operations & Installation Analytics Types
 *
 * Single Source of Truth for Site Operations, room-by-room installation progress,
 * Gantt timeline tracking, QC alerts, and site diary coordination.
 * Enforces Zero UI Calculation: All values, percentages, styles, badge classes,
 * Gantt coordinate spans, and labels are pre-computed in the Canonical Domain Service.
 *
 * @module src/products/bella-interior/domain/installation-overview.types
 */

export interface InstallationProjectHeader {
  id: string;
  code: string;
  name: string;
  selectorLabel: string;
  clientName: string;
  status: string;
  statusLabel: string;
  badgeLabel: string;
}

export interface InstallationKpiItem {
  rawValue: number;
  formattedValue: string;
  label: string;
  colorClass: string;
  iconName: string;
  iconBgClass: string;
  cardBgClass: string;
  watermarkType: string;
}

export interface InstallationKpis {
  totalRooms: InstallationKpiItem;
  installingRooms: InstallationKpiItem;
  completedRooms: InstallationKpiItem;
  attentionRooms: InstallationKpiItem;
}

export type RoomInstallationStatus = 'installing' | 'pending' | 'completed' | 'punch_listed';

export interface RoomInstallationCard {
  id: string;
  code: string;
  roomName: string;
  assignee: string;
  progressPercent: number;
  progressFormatted: string;
  progressBarColor: string;
  modulesCount: number;
  modulesFormatted: string;
  deadlineFormatted: string;
  status: RoomInstallationStatus;
  statusLabel: string;
  statusBadgeClass: string;
  imageUrl: string;
}

export interface TimelineDayColumn {
  dayNumber: string;
  monthNumber: string;
  dayOfWeek: string;
  dateKey: string;
  label: string;
}

export interface TimelineGanttRow {
  roomCode: string;
  roomName: string;
  startDayIndex: number;
  durationDays: number;
  leftPercent: number;
  widthPercent: number;
  barColor: string;
  barBgClass: string;
  hasStartMarker: boolean;
  hasEndMarker: boolean;
  isFaintTrack: boolean;
}

export interface InstallationTimelineChart {
  title: string;
  rangeLabel: string;
  availableRanges: string[];
  days: TimelineDayColumn[];
  rows: TimelineGanttRow[];
}

export type InstallationAlertSeverity = 'warning' | 'success' | 'note' | 'media';

export interface InstallationAlertActivityItem {
  id: string;
  type: InstallationAlertSeverity;
  message: string;
  timeFormatted: string;
  iconType: 'alert-triangle' | 'check-circle' | 'file-text' | 'image';
  iconClass: string;
  iconBgClass: string;
}

export interface InstallationQuickActionCard {
  id: string;
  title: string;
  actionLabel: string;
  href: string;
  iconType: 'calendar' | 'alert-triangle' | 'bar-chart' | 'image';
  iconColorClass: string;
  bgGradientClass: string;
  borderColorClass: string;
}

export interface InstallationOverviewResponse {
  projectHeader: InstallationProjectHeader;
  availableProjects: Array<{ id: string; label: string; code: string }>;
  kpis: InstallationKpis;
  overallProgress: {
    title: string;
    progressPercent: number;
    progressFormatted: string;
    progressBarColor: string;
  };
  rooms: RoomInstallationCard[];
  timelineChart: InstallationTimelineChart;
  alerts: {
    title: string;
    viewAllLabel: string;
    items: InstallationAlertActivityItem[];
  };
  quickActions: InstallationQuickActionCard[];
}
