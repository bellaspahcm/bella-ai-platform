/**
 * BELLA INTERIOR OS — WARRANTY & AFTERCARE CANONICAL TYPES
 * 
 * Strict Zero UI Calculation contract. All metrics, badge classes, status labels,
 * dates, calendar highlights, and roadmap steps are pre-computed server-side.
 */

export type WarrantyCertificateStatus = 'active' | 'expiring_soon' | 'expired';

export interface WarrantyCertificateRow {
  index: number;
  certificateNo: string;
  project: string;
  client: string;
  handoverDate: string;
  warrantyStartDate: string;
  warrantyExpires: string;
  coverage: string;
  status: WarrantyCertificateStatus;
  statusLabel: string;
  statusBadgeClass: string;
  statusDotClass: string;
}

export interface WarrantyKpiCard {
  rawValue: number;
  formattedValue: string;
  label: string;
  subLabel: string;
  subLabelClass: string;
  iconName: string;
  iconClass: string;
  iconBgClass: string;
  cardBgClass: string;
  previewType?: 'chart' | 'donut' | 'clock' | 'calendar' | 'headset' | 'bars';
  percentage?: number;
}

export interface WarrantyKpis {
  totalCertificates: WarrantyKpiCard;
  activeCertificates: WarrantyKpiCard;
  expiringCertificates: WarrantyKpiCard;
  expiredCertificates: WarrantyKpiCard;
  openTickets: WarrantyKpiCard;
  warrantyCost: WarrantyKpiCard;
}

export interface WarrantyExpiryAlert {
  count: number;
  thresholdDays: number;
  message: string;
  linkText: string;
  linkHref: string;
}

export interface WarrantyCalendarDay {
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  isHighlighted?: boolean;
  hasAmberDot?: boolean;
  hasRedDot?: boolean;
  eventDescription?: string;
}

export interface WarrantyCalendarData {
  monthLabel: string; // e.g. "Tháng 11/2026"
  daysOfWeek: string[]; // ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
  days: (WarrantyCalendarDay | null)[];
}

export interface WarrantyRoadmapStep {
  stepNumber: number;
  title: string;
  iconName: string;
  status: 'completed' | 'active' | 'upcoming';
  statusClass: string;
  iconClass: string;
}

export interface WarrantyRecentActivity {
  id: string;
  type: 'ticket_created' | 'ticket_resolved' | 'certificate_expiring';
  title: string;
  timeAgo: string;
  iconName?: string;
  iconClass?: string;
  avatarUrl?: string;
}

export interface WarrantyOverviewResponse {
  project: {
    id: string;
    code: string;
    name: string;
    thumbnailUrl: string;
    notificationCount: number;
  };
  availableProjects: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  expiryAlert: WarrantyExpiryAlert;
  kpis: WarrantyKpis;
  activeTab: 'certificates' | 'tickets';
  certificates: WarrantyCertificateRow[];
  totalCertificatesCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    displayRange: string;
  };
  filterOptions: {
    projects: string[];
    clients: string[];
    statuses: Array<{ value: string; label: string }>;
    dateRangeLabel: string;
  };
  reassuranceBanner: {
    title: string;
    subtitle: string;
    buttonText: string;
    buttonHref: string;
    imageUrl: string;
  };
  calendar: WarrantyCalendarData;
  roadmap: WarrantyRoadmapStep[];
  recentActivities: WarrantyRecentActivity[];
}

