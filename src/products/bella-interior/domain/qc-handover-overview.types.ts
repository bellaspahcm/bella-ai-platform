/**
 * Bella Interior OS — Canonical QC, Punch List & Handover Analytics Types
 *
 * Single Source of Truth for Handover Gate verification, Punch List tracking,
 * 5-stage Quality Roadmap, and warranty readiness.
 * Enforces Zero UI Calculation: All status counts, percentages, overdue flags,
 * badge styles, sparklines, and labels are pre-computed in the Domain Service.
 *
 * @module src/products/bella-interior/domain/qc-handover-overview.types
 */

export interface QCHandoverProjectHeader {
  id: string;
  code: string;
  name: string;
  selectorLabel: string;
  location: string;
  plannedHandoverDate: string;
  status: string;
  statusLabel: string;
  notificationsCount: number;
}

export interface HandoverGateDossier {
  status: 'READY FOR HANDOVER' | 'CRITICAL_PENDING' | 'INSPECTION_REQUIRED';
  badgeLabel: string;
  badgeClass: string;
  title: string;
  description: string;
  criticalVerifiedCount: number;
  totalCriticalCount: number;
  isEligibleForHandover: boolean;
  warrantyCertificateButtonLabel: string;
  bannerImageUrl: string;
}

export interface QCKpiItem {
  rawValue: number;
  formattedValue: string;
  label: string;
  subLabel: string;
  subLabelClass: string;
  iconName: string;
  iconClass: string;
  iconBgClass: string;
  cardBgClass: string;
  sparklineSvgPath: string;
}

export interface QCKpis {
  totalPunchList: QCKpiItem;
  pendingPunchList: QCKpiItem;
  verifiedPunchList: QCKpiItem;
  overduePunchList: QCKpiItem;
}

export type PunchSeverityLevel = 'critical' | 'major' | 'minor';
export type PunchLifecycleStatus = 'open' | 'in_progress' | 'rectified' | 'verified';

export interface PunchListFilterTab {
  id: string;
  label: string;
  count: number;
  active: boolean;
}

export interface PunchListTableRow {
  id: string;
  index: number;
  code: string;
  zoneArea: string;
  categoryName: string;
  description: string;
  severity: PunchSeverityLevel;
  severityLabel: string;
  severityBadgeClass: string;
  assigneeName: string;
  assigneeTeam: string;
  assigneeAvatarUrl: string;
  deadlineDate: string;
  deadlineFormatted: string;
  isOverdue: boolean;
  overdueBadgeLabel?: string;
  status: PunchLifecycleStatus;
  statusLabel: string;
  statusBadgeClass: string;
  hasRedAccentBorder: boolean;
  actionMenuOptions: string[];
}

export interface QualityRoadmapStep {
  stepNumber: number;
  name: string;
  subName: string;
  status: 'completed' | 'active' | 'upcoming';
  circleClass: string;
  textClass: string;
}

export interface QualityRoadmap {
  title: string;
  steps: QualityRoadmapStep[];
}

export interface QualityCommitmentBanner {
  title: string;
  description: string;
  iconName: string;
  imageUrl: string;
}

export interface QCHandoverOverviewResponse {
  projectHeader: QCHandoverProjectHeader;
  availableProjects: Array<{ id: string; label: string; code: string }>;
  handoverGate: HandoverGateDossier;
  filterTabs: PunchListFilterTab[];
  kpis: QCKpis;
  table: {
    title: string;
    itemsCountLabel: string;
    lifecycleGuide: string;
    headers: string[];
    rows: PunchListTableRow[];
  };
  projectInfoCard: {
    title: string;
    projectName: string;
    location: string;
    scheduledDateFormatted: string;
  };
  qualityRoadmap: QualityRoadmap;
  commitmentBanner: QualityCommitmentBanner;
}

