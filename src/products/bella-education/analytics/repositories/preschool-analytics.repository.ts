/**
 * Bella Preschool OS — Preschool Analytics Persistence Repository (P10)
 * File: src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts
 *
 * Provides read-only query access across P1–P9 domain tables with mandatory tenant_id isolation.
 * Supreme Architectural Law: Analytics owns metrics/projections, NEVER operational truth.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface EnrollmentStudentRaw {
  id?: string;
  course_id?: string;
  student_id?: string;
  student_party_id?: string;
  academic_status?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ClassroomRaw {
  id: string;
  name: string;
  max_capacity: number | null;
}

export interface AttendanceRaw {
  id: string;
  student_id?: string;
  enrollment_id?: string;
  attendance_status: string;
  record_date: string;
}

export interface ParentEngagementDeliveryRaw {
  id: string;
  delivery_status: string;
  notice?: {
    policy_requirement?: string | null;
  } | null;
}

type ParentEngagementNoticeRaw = NonNullable<ParentEngagementDeliveryRaw['notice']>;

function firstParentEngagementNotice(
  notice: ParentEngagementNoticeRaw | ParentEngagementNoticeRaw[] | null
): ParentEngagementDeliveryRaw['notice'] {
  return Array.isArray(notice) ? notice[0] ?? null : notice;
}

export class PreschoolAnalyticsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // 1. Enrollment Metrics (P1/P3)
  async getEnrollmentRawData(tenantId: string): Promise<{
    enrolledStudents: EnrollmentStudentRaw[];
    classrooms: ClassroomRaw[];
  }> {
    const { data: canonicalEnrollments } = await this.supabase
      .from('edu_enrollments')
      .select('id, course_id, student_party_id, status')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'pending']);

    let students: EnrollmentStudentRaw[] = canonicalEnrollments || [];

    if (students.length === 0) {
      const { data: fallbackStudents } = await this.supabase
        .from('students')
        .select('student_id, academic_status, metadata')
        .eq('tenant_id', tenantId)
        .in('academic_status', ['enrolled', 'ENROLLED']);
      if (fallbackStudents) students = fallbackStudents;
    }

    const { data: canonicalCourses } = await this.supabase
      .from('edu_courses')
      .select('id, title, max_students, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    let classrooms: ClassroomRaw[] = (canonicalCourses || []).map((course) => ({
      id: course.id,
      name: course.title ?? course.id,
      max_capacity: course.max_students ?? null,
    }));

    if (classrooms.length === 0) {
      const { data: fallbackRooms } = await this.supabase
        .from('preschool_classrooms')
        .select('id, name, max_capacity')
        .eq('tenant_id', tenantId);
      if (fallbackRooms) classrooms = fallbackRooms;
    }

    return {
      enrolledStudents: students,
      classrooms,
    };
  }

  // 2. Attendance Metrics (P3)
  async getAttendanceRawData(tenantId: string, dateStr: string): Promise<AttendanceRaw[]> {
    const { data: canonicalAttendance } = await this.supabase
      .from('edu_attendance_daily_state')
      .select('id, enrollment_id, status, school_day')
      .eq('tenant_id', tenantId)
      .eq('school_day', dateStr);

    let attendance: AttendanceRaw[] = (canonicalAttendance || []).map((row) => ({
      id: row.id,
      enrollment_id: row.enrollment_id,
      attendance_status: row.status,
      record_date: row.school_day,
    }));

    if (attendance.length === 0) {
      const { data: fallbackAtt } = await this.supabase
        .from('edu_daily_care_records')
        .select('id, student_id, attendance_status, record_date')
        .eq('tenant_id', tenantId)
        .eq('record_date', dateStr);
      if (fallbackAtt) attendance = fallbackAtt;
    }

    return attendance;
  }

  // 3. Care & Safety Metrics (P4)
  async getCareSafetyRawData(tenantId: string, dateStr: string) {
    const [{ data: incidents }, { data: medLogs }] = await Promise.all([
      this.supabase.from('edu_care_health_incidents').select('id, status').eq('tenant_id', tenantId).in('status', ['REPORTED', 'UNDER_OBSERVATION']),
      this.supabase.from('edu_care_medication_logs').select('id, status, scheduled_date').eq('tenant_id', tenantId).eq('scheduled_date', dateStr).eq('status', 'SCHEDULED'),
    ]);

    return {
      activeIncidents: incidents || [],
      pendingMedications: medLogs || [],
    };
  }

  // 4. Learning & Development Metrics (P5)
  async getLearningRawData(tenantId: string) {
    const [{ data: draftPortfolios }, { data: pendingObservations }] = await Promise.all([
      this.supabase.from('edu_dev_portfolio_versions').select('id, status').eq('tenant_id', tenantId).eq('status', 'DRAFT'),
      this.supabase.from('edu_dev_observations').select('id, verification_status').eq('tenant_id', tenantId).eq('verification_status', 'PENDING'),
    ]);

    return {
      draftPortfolios: draftPortfolios || [],
      pendingObservations: pendingObservations || [],
    };
  }

  // 5. Parent Engagement Metrics (P6)
  async getParentEngagementRawData(tenantId: string): Promise<ParentEngagementDeliveryRaw[]> {
    const { data: deliveries } = await this.supabase
      .from('edu_comm_deliveries')
      .select(`
        id, 
        delivery_status, 
        notice:edu_comm_notices!inner(policy_requirement)
      `)
      .eq('tenant_id', tenantId)
      .in('delivery_status', ['SENT', 'READ']);

    return (deliveries || []).map((delivery) => ({
      id: delivery.id,
      delivery_status: delivery.delivery_status,
      notice: firstParentEngagementNotice(delivery.notice),
    }));
  }

  // 6. Finance & Billing Metrics (P7)
  async getFinanceRawData(tenantId: string, dateStr: string) {
    const [{ data: invoices }, { data: reconciliations }] = await Promise.all([
      this.supabase.from('edu_fin_invoices').select('id, gross_amount, net_amount, invoice_status, settlement_status, due_date').eq('tenant_id', tenantId).eq('invoice_status', 'ISSUED'),
      this.supabase.from('edu_fin_reconciliation_ledger').select('id, invoice_id, allocated_amount').eq('tenant_id', tenantId),
    ]);

    return {
      invoices: invoices || [],
      reconciliations: reconciliations || [],
    };
  }

  // 7. Workforce & Scheduling Metrics (P8)
  async getWorkforceRawData(tenantId: string, dateStr: string) {
    const [{ data: nonCompliantSnapshots }, { data: staffingExceptions }] = await Promise.all([
      this.supabase.from('edu_sched_compliance_snapshots').select('id, compliance_state, snapshot_date').eq('tenant_id', tenantId).eq('snapshot_date', dateStr).neq('compliance_state', 'COMPLIANT'),
      this.supabase.from('edu_comm_exceptions').select('id, exception_type, status').eq('tenant_id', tenantId).eq('exception_type', 'RATIO_SHORTAGE').eq('status', 'OPEN'),
    ]);

    return {
      activeViolations: nonCompliantSnapshots || [],
      openExceptions: staffingExceptions || [],
    };
  }

  // 8. Facilities & Maintenance Metrics (P9)
  async getFacilitiesRawData(tenantId: string, dateStr: string) {
    const [{ data: unhealthyAssets }, { data: unhealthyZones }, { data: overdueSchedules }, { data: safetyExceptions }] = await Promise.all([
      this.supabase.from('edu_fac_assets').select('id, operational_status').eq('tenant_id', tenantId).in('operational_status', ['OUT_OF_SERVICE', 'UNDER_INSPECTION']),
      this.supabase.from('edu_fac_zones').select('id, operational_status').eq('tenant_id', tenantId).eq('operational_status', 'OUT_OF_SERVICE'),
      this.supabase.from('edu_fac_inspection_schedules').select('id, next_due_date').eq('tenant_id', tenantId).lt('next_due_date', dateStr),
      this.supabase.from('edu_comm_exceptions').select('id, exception_type, status').eq('tenant_id', tenantId).eq('exception_type', 'SAFETY_DEFECT').eq('status', 'OPEN'),
    ]);

    return {
      unhealthyAssets: unhealthyAssets || [],
      unhealthyZones: unhealthyZones || [],
      overdueSchedules: overdueSchedules || [],
      safetyExceptions: safetyExceptions || [],
    };
  }

  // 9. Command Center Operational Exceptions
  async getCommandCenterRawData(tenantId: string, dateStr: string) {
    const openExceptions = () => this.supabase.from('edu_comm_exceptions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'OPEN');
    const results = await Promise.all([
      openExceptions().eq('exception_type', 'ABSENCE_REQUEST'),
      openExceptions().neq('exception_type', 'ABSENCE_REQUEST')
        .neq('exception_type', 'RATIO_SHORTAGE').neq('exception_type', 'SAFETY_DEFECT'),
      this.supabase.from('edu_health_incidents').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'OPEN'),
      this.supabase.from('edu_fin_invoices').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).neq('settlement_status', 'PAID').lt('due_date', dateStr),
      this.supabase.from('edu_attendance_daily_state').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('school_day', dateStr),
      this.supabase.from('edu_enrollments').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'active'),
      this.supabase.from('party_identifiers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    const counts = results.map(result => {
      if (result.error || result.count === null) throw new Error('COMMAND_CENTER_READ_FAILED: Unable to load attention counts.');
      return result.count;
    });
    const [leaveRequestsCount, parentRequestsCount, healthIncidentsCount, overdueInvoicesCount, markedCount, activeCount, totalParentsCount] = counts;
    return { unmarkedAttendanceCount: Math.max(0, activeCount - markedCount), leaveRequestsCount,
      overdueInvoicesCount, healthIncidentsCount, parentRequestsCount, totalParentsCount };
  }
}
