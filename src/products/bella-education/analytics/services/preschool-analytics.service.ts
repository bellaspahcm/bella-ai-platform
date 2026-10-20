/**
 * Bella Preschool OS — Preschool Analytics & Executive Aggregation Service (P10)
 * File: src/products/bella-education/analytics/services/preschool-analytics.service.ts
 *
 * Implements the Hybrid Event-Driven Analytics Model:
 * Domain owns truth ➔ Event announces truth changed ➔ Analytics projects truth ➔ Dashboard displays it.
 * Includes DB Reconciliation Fallback for cold-start and rebuilds.
 */

import { PreschoolAnalyticsRepository } from '../repositories/preschool-analytics.repository';
import { 
  ExecutiveDashboardDTO, 
  ClassroomUtilizationDTO 
} from '../domain/preschool-analytics.types';
import { PreschoolDomainEvent } from '../events/preschool-analytics-events';

type EnrollmentStudentRaw = {
  course_id?: string;
  metadata?: Record<string, unknown> | null;
};

function getStudentClassroomId(student: EnrollmentStudentRaw): string | null {
  if (typeof student.course_id === 'string') return student.course_id;

  const metadata = student.metadata;
  const classroomId = metadata?.classroom_id ?? metadata?.classroomId;

  return typeof classroomId === 'string' ? classroomId : null;
}

function normalizeAttendanceStatus(status: string): string {
  return status.trim().toUpperCase();
}

export class PreschoolAnalyticsService {
  private eventLog: PreschoolDomainEvent[] = [];

  constructor(private readonly repo: PreschoolAnalyticsRepository) {}

  /**
   * Receives and processes domain events emitted by P1–P9 domains.
   * Analytics subscriber updates read model / event log without modifying domain truth.
   */
  async handleDomainEvent(event: PreschoolDomainEvent): Promise<void> {
    this.eventLog.push(event);
  }

  /**
   * Computes the complete Executive Dashboard DTO for a given tenant and evaluation date.
   * Uses Hybrid DB Reconciliation Fallback to query canonical domain truth from DB.
   */
  async getExecutiveDashboard(tenantId: string, evaluationDate?: string): Promise<ExecutiveDashboardDTO> {
    const targetDate = evaluationDate || new Date().toISOString().split('T')[0];

    const [
      enrollmentRaw,
      attendanceRaw,
      careRaw,
      learningRaw,
      parentRaw,
      financeRaw,
      workforceRaw,
      facilitiesRaw,
    ] = await Promise.all([
      this.repo.getEnrollmentRawData(tenantId),
      this.repo.getAttendanceRawData(tenantId, targetDate),
      this.repo.getCareSafetyRawData(tenantId, targetDate),
      this.repo.getLearningRawData(tenantId),
      this.repo.getParentEngagementRawData(tenantId),
      this.repo.getFinanceRawData(tenantId, targetDate),
      this.repo.getWorkforceRawData(tenantId, targetDate),
      this.repo.getFacilitiesRawData(tenantId, targetDate),
    ]);

    // 1. Enrollment & Space Utilization (P1/P3)
    const totalEnrolledStudents = enrollmentRaw.enrolledStudents.length;
    const totalClassrooms = enrollmentRaw.classrooms.length;

    const classroomUtilization: ClassroomUtilizationDTO[] = enrollmentRaw.classrooms.map((c) => {
      const currentEnrollment = enrollmentRaw.enrolledStudents.filter(s => getStudentClassroomId(s) === c.id).length;
      const maxCap = c.max_capacity || 25;
      return {
        classId: c.id,
        className: c.name,
        currentEnrollment,
        maxCapacity: maxCap,
        utilizationRate: Math.round((currentEnrollment / maxCap) * 100),
      };
    });

    // 2. Daily Attendance (P3)
    const todayPresentCount = attendanceRaw.filter((attendance) => {
      const status = normalizeAttendanceStatus(attendance.attendance_status);
      return status === 'PRESENT' || status === 'LATE';
    }).length;
    const todayLateCount = attendanceRaw.filter(a => normalizeAttendanceStatus(a.attendance_status) === 'LATE').length;
    const todayAbsentCount = attendanceRaw.filter(a => normalizeAttendanceStatus(a.attendance_status) === 'ABSENT').length;
    const presentVsEnrolledRate = totalEnrolledStudents > 0 
      ? Math.round((todayPresentCount / totalEnrolledStudents) * 100) 
      : 0;

    // 3. Care & Safety Operations (P4)
    const activeHealthIncidents = careRaw.activeIncidents.length;
    const pendingMedicationDoses = careRaw.pendingMedications.length;

    // 4. Learning & Development (P5)
    const draftPortfoliosCount = learningRaw.draftPortfolios.length;
    const pendingMilestoneReviews = learningRaw.pendingObservations.length;

    // 5. Parent Engagement (P6)
    const unacknowledgedNotices = parentRaw.filter((d) => d.notice?.policy_requirement === 'REQUIRES_ACK').length;
    const pendingConsentRequests = parentRaw.filter((d) => d.notice?.policy_requirement === 'REQUIRES_CONSENT').length;

    // 6. Finance & Billing (P7)
    const invoicedGrossTotal = financeRaw.invoices.reduce((sum, inv) => sum + (inv.gross_amount || 0), 0);
    const reconciledCashCollected = financeRaw.reconciliations.reduce((sum, rec) => sum + (rec.allocated_amount || 0), 0);
    const outstandingBalanceTotal = Math.max(0, invoicedGrossTotal - reconciledCashCollected);
    const overdueAccountsCount = financeRaw.invoices.filter(inv => 
      inv.settlement_status !== 'PAID' && inv.due_date && inv.due_date < targetDate
    ).length;

    // 7. Workforce & Scheduling (P8)
    const activeStaffingViolations = workforceRaw.activeViolations.length; // P8 Domain Truth
    const openStaffingExceptions = workforceRaw.openExceptions.length; // Queue

    // 8. Facilities & Maintenance (P9)
    const outOfServiceAssetsCount = facilitiesRaw.unhealthyAssets.length;
    const outOfServiceZonesCount = facilitiesRaw.unhealthyZones.length;
    const overdueScheduleCount = facilitiesRaw.overdueSchedules.length; // P9 Schedule Truth
    const openSafetyExceptions = facilitiesRaw.safetyExceptions.length; // Queue

    const commandCenter = 'getCommandCenterRawData' in this.repo && typeof this.repo.getCommandCenterRawData === 'function'
      ? await this.repo.getCommandCenterRawData(tenantId, targetDate)
      : undefined;

    const recentActivities = 'getRecentActivitiesRawData' in this.repo && typeof this.repo.getRecentActivitiesRawData === 'function'
      ? await this.repo.getRecentActivitiesRawData(tenantId, targetDate)
      : undefined;

    const notices = 'getRecentNoticesRawData' in this.repo && typeof this.repo.getRecentNoticesRawData === 'function'
      ? await this.repo.getRecentNoticesRawData(tenantId, 5)
      : undefined;

    const weeklyMenu = 'getCurrentWeeklyMenuRawData' in this.repo && typeof this.repo.getCurrentWeeklyMenuRawData === 'function'
      ? await this.repo.getCurrentWeeklyMenuRawData(tenantId, targetDate)
      : undefined;

    return {
      tenantId,
      evaluatedAt: new Date().toISOString(),
      enrollment: {
        totalEnrolledStudents,
        totalClassrooms,
        totalTeachers: 24, // Nominal total staff count across center (teachers, caregivers & support staff)
        classroomUtilization,
      },
      attendance: {
        todayPresentCount,
        todayAbsentCount,
        todayLateCount,
        presentVsEnrolledRate,
      },
      careAndSafety: {
        activeHealthIncidents,
        pendingMedicationDoses,
      },
      learning: {
        draftPortfoliosCount,
        pendingMilestoneReviews,
      },
      parentEngagement: {
        unacknowledgedNotices,
        pendingConsentRequests,
      },
      finance: {
        invoicedGrossTotal,
        reconciledCashCollected,
        outstandingBalanceTotal,
        overdueAccountsCount,
      },
      workforce: {
        activeStaffingViolations,
        openStaffingExceptions,
      },
      facilities: {
        outOfServiceAssetsCount,
        outOfServiceZonesCount,
        overdueScheduleCount,
        openSafetyExceptions,
      },
      commandCenter,
      recentActivities,
      notices,
      weeklyMenu,
    };
  }
}
