/**
 * Bella Preschool OS — Preschool Analytics & Executive Dashboard Domain Types (P10)
 * File: src/products/bella-education/analytics/domain/preschool-analytics.types.ts
 *
 * Provides read-only DTOs for executive dashboard KPI metrics across all 8 preschool domains (P1–P9).
 * Supreme Architectural Law: Analytics owns metrics/projections, NEVER operational truth.
 */

export interface ClassroomUtilizationDTO {
  classId: string;
  className: string;
  currentEnrollment: number;
  maxCapacity: number;
  utilizationRate: number; // (currentEnrollment / maxCapacity) * 100
  color?: string;
}

export interface ExecutiveEnrollmentMetricsDTO {
  totalEnrolledStudents: number;
  totalClassrooms: number;
  totalTeachers: number;
  classroomUtilization: ClassroomUtilizationDTO[];
}

export interface ExecutiveAttendanceMetricsDTO {
  todayPresentCount: number;
  todayAbsentCount: number;
  todayLateCount: number;
  presentVsEnrolledRate: number; // (todayPresentCount / totalEnrolledStudents) * 100
}

export interface ExecutiveCareSafetyMetricsDTO {
  activeHealthIncidents: number; // Status IN ('REPORTED', 'UNDER_OBSERVATION')
  pendingMedicationDoses: number; // Scheduled doses today not administered
}

export interface ExecutiveLearningMetricsDTO {
  draftPortfoliosCount: number; // Portfolios in DRAFT status
  pendingMilestoneReviews: number; // Observations awaiting teacher verification
}

export interface ExecutiveParentEngagementMetricsDTO {
  unacknowledgedNotices: number; // Deliveries with policy REQUIRES_ACK in SENT/READ
  pendingConsentRequests: number; // Deliveries with policy REQUIRES_CONSENT awaiting decision
}

export interface ExecutiveFinanceMetricsDTO {
  invoicedGrossTotal: number; // SUM(gross_amount) WHERE invoice_status = 'ISSUED'
  reconciledCashCollected: number; // SUM(reconciliation_ledger allocated_amount) - PAID Truth
  outstandingBalanceTotal: number; // SUM(gross_amount - allocated_amount) WHERE invoice_status = 'ISSUED'
  overdueAccountsCount: number; // COUNT(invoices WHERE ISSUED AND settlement != PAID AND due_date < today)
}

export interface ExecutiveWorkforceMetricsDTO {
  activeStaffingViolations: number; // P8 Domain Truth (Non-compliant shift ratio / snapshot)
  openStaffingExceptions: number; // Exception Queue (RATIO_SHORTAGE)
}

export interface ExecutiveFacilitiesMetricsDTO {
  outOfServiceAssetsCount: number; // Assets in OUT_OF_SERVICE or UNDER_INSPECTION
  outOfServiceZonesCount: number; // Zones in OUT_OF_SERVICE
  overdueScheduleCount: number; // P9 Schedule Truth (next_due_date < today)
  openSafetyExceptions: number; // Exception Queue (SAFETY_DEFECT)
}

export interface ExecutiveCommandCenterDTO {
  unmarkedAttendanceCount: number;
  leaveRequestsCount: number;
  overdueInvoicesCount: number;
  healthIncidentsCount: number;
  parentRequestsCount: number;
  totalParentsCount: number;
}

export interface ExecutiveDashboardDTO {
  tenantId: string;
  evaluatedAt: string;
  enrollment: ExecutiveEnrollmentMetricsDTO;
  attendance: ExecutiveAttendanceMetricsDTO;
  careAndSafety: ExecutiveCareSafetyMetricsDTO;
  learning: ExecutiveLearningMetricsDTO;
  parentEngagement: ExecutiveParentEngagementMetricsDTO;
  finance: ExecutiveFinanceMetricsDTO;
  workforce: ExecutiveWorkforceMetricsDTO;
  facilities: ExecutiveFacilitiesMetricsDTO;
  commandCenter?: ExecutiveCommandCenterDTO;
}
