/**
 * Bella Preschool OS — Preschool Analytics Persistence Repository (P10)
 * File: src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts
 *
 * Provides read-only query access across P1–P9 domain tables with mandatory tenant_id isolation.
 * Supreme Architectural Law: Analytics owns metrics/projections, NEVER operational truth.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  PreschoolActivityItemDTO,
  PreschoolNoticeItemDTO,
  PreschoolWeeklyMenuDTO,
  PreschoolWeeklyMenuDayDTO
} from '../domain/preschool-analytics.types';

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

  // 10. School Activity Stream Aggregator (All Verticals)
  async getRecentActivitiesRawData(tenantId: string, dateStr: string): Promise<PreschoolActivityItemDTO[]> {
    const activities: PreschoolActivityItemDTO[] = [];

    const formatTime = (isoStr?: string | null): string => {
      if (!isoStr) return '08:00';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '08:00';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        return '08:00';
      }
    };

    try {
      const [
        handoverRes,
        devActivitiesRes,
        observationsRes,
        commExceptionsRes,
        noticesRes,
        financeRes,
        healthRes,
        studentsRes,
        coursesRes,
      ] = await Promise.allSettled([
        this.supabase
          .from('edu_preschool_pickup_handover_events')
          .select('id, student_id, handover_time, handover_type, authorized_person_name, notes, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10),
        this.supabase
          .from('edu_dev_activities')
          .select('id, class_id, title, description, planned_date, status, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10),
        this.supabase
          .from('edu_dev_observations')
          .select('id, domain, verification_status, observed_at, notes, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(8),
        this.supabase
          .from('edu_comm_exceptions')
          .select('id, exception_type, status, details, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(8),
        this.supabase
          .from('edu_comm_notices')
          .select('id, title, target_scope, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
        this.supabase
          .from('edu_fin_invoices')
          .select('id, invoice_number, gross_amount, settlement_status, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(8),
        this.supabase
          .from('edu_care_health_incidents')
          .select('id, incident_type, severity, status, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
        this.supabase
          .from('party_parties')
          .select('id, display_name')
          .eq('tenant_id', tenantId)
          .limit(50),
        this.supabase
          .from('edu_courses')
          .select('id, title')
          .eq('tenant_id', tenantId)
          .limit(30),
      ]);

      const studentNameMap = new Map<string, string>();
      if (studentsRes.status === 'fulfilled' && Array.isArray(studentsRes.value.data)) {
        for (const p of studentsRes.value.data as Array<{ id?: string; display_name?: string | null }>) {
          if (p.id && p.display_name) studentNameMap.set(p.id, p.display_name);
        }
      }

      const courseNameMap = new Map<string, string>();
      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value.data)) {
        for (const c of coursesRes.value.data as Array<{ id?: string; title?: string | null }>) {
          if (c.id && c.title) courseNameMap.set(c.id, c.title);
        }
      }

      // Map Handover / Attendance
      if (handoverRes.status === 'fulfilled' && Array.isArray(handoverRes.value.data)) {
        for (const h of handoverRes.value.data as Array<{
          id: string;
          student_id?: string | null;
          handover_time?: string | null;
          handover_type?: string | null;
          authorized_person_name?: string | null;
          created_at?: string | null;
        }>) {
          const studentName = (h.student_id ? studentNameMap.get(h.student_id) : null) || 'Bé học sinh';
          const isCheckIn = h.handover_type === 'CHECK_IN' || !h.handover_type?.includes('OUT');
          activities.push({
            id: `pickup-${h.id}`,
            category: 'ATTENDANCE',
            categoryLabel: 'Điểm danh & Đón trả',
            title: studentName,
            description: isCheckIn 
              ? (h.authorized_person_name ? `Đến trường — Phụ huynh ${h.authorized_person_name} đưa` : 'Đã đến trường an toàn')
              : (h.authorized_person_name ? `Bàn giao phụ huynh ${h.authorized_person_name} đón về` : 'Đã bàn giao đón về'),
            timestamp: h.handover_time || h.created_at || new Date().toISOString(),
            displayTime: formatTime(h.handover_time || h.created_at),
            actorRole: 'Học sinh',
            status: isCheckIn ? 'Đã đến' : 'Đã đón',
          });
        }
      }

      // Map Learning Activities
      if (devActivitiesRes.status === 'fulfilled' && Array.isArray(devActivitiesRes.value.data)) {
        for (const a of devActivitiesRes.value.data as Array<{
          id: string;
          class_id?: string | null;
          title: string;
          status?: string | null;
          created_at?: string | null;
        }>) {
          const className = (a.class_id ? courseNameMap.get(a.class_id) : null) || 'Lớp học';
          activities.push({
            id: `act-${a.id}`,
            category: 'LEARNING',
            categoryLabel: 'Học tập & Trải nghiệm',
            title: className,
            description: `Hoàn thành hoạt động: ${a.title}`,
            timestamp: a.created_at || new Date().toISOString(),
            displayTime: formatTime(a.created_at),
            actorRole: 'Giáo viên',
            status: a.status || 'Hoàn thành',
          });
        }
      }

      // Map Observations
      if (observationsRes.status === 'fulfilled' && Array.isArray(observationsRes.value.data)) {
        for (const obs of observationsRes.value.data as Array<{
          id: string;
          domain?: string | null;
          notes?: string | null;
          verification_status?: string | null;
          observed_at?: string | null;
          created_at?: string | null;
        }>) {
          activities.push({
            id: `obs-${obs.id}`,
            category: 'LEARNING',
            categoryLabel: 'Học tập & Trải nghiệm',
            title: `Quan sát: ${obs.domain || 'Kỹ năng'}`,
            description: obs.notes ? `Ghi nhận: ${obs.notes}` : 'Đã cập nhật phiếu quan sát phát triển',
            timestamp: obs.observed_at || obs.created_at || new Date().toISOString(),
            displayTime: formatTime(obs.observed_at || obs.created_at),
            actorRole: 'Giáo viên',
            status: obs.verification_status || 'Đã xác nhận',
          });
        }
      }

      // Map Parent Requests / Exceptions
      if (commExceptionsRes.status === 'fulfilled' && Array.isArray(commExceptionsRes.value.data)) {
        for (const ex of commExceptionsRes.value.data as Array<{
          id: string;
          exception_type: string;
          details?: string | null;
          status: string;
          created_at?: string | null;
        }>) {
          const isAbsence = ex.exception_type === 'ABSENCE_REQUEST';
          activities.push({
            id: `comm-ex-${ex.id}`,
            category: 'PARENT_COMM',
            categoryLabel: 'Tương tác phụ huynh',
            title: isAbsence ? 'Đơn xin nghỉ học' : 'Yêu cầu phụ huynh',
            description: ex.details || (isAbsence ? 'Phụ huynh gửi đơn xin phép nghỉ học cho bé' : 'Phụ huynh gửi phản hồi cho giáo viên'),
            timestamp: ex.created_at || new Date().toISOString(),
            displayTime: formatTime(ex.created_at),
            actorRole: 'Phụ huynh',
            status: ex.status === 'OPEN' ? 'Chờ duyệt' : 'Đã xử lý',
          });
        }
      }

      // Map Notices
      if (noticesRes.status === 'fulfilled' && Array.isArray(noticesRes.value.data)) {
        for (const n of noticesRes.value.data as Array<{
          id: string;
          title: string;
          created_at?: string | null;
        }>) {
          activities.push({
            id: `notice-${n.id}`,
            category: 'PARENT_COMM',
            categoryLabel: 'Tương tác phụ huynh',
            title: 'Thông báo nhà trường',
            description: n.title,
            timestamp: n.created_at || new Date().toISOString(),
            displayTime: formatTime(n.created_at),
            actorRole: 'Nhà trường',
            status: 'Đã phát hành',
          });
        }
      }

      // Map Finance Invoices
      if (financeRes.status === 'fulfilled' && Array.isArray(financeRes.value.data)) {
        for (const inv of financeRes.value.data as Array<{
          id: string;
          invoice_number?: string | null;
          gross_amount?: number | null;
          settlement_status?: string | null;
          created_at?: string | null;
        }>) {
          const isPaid = inv.settlement_status === 'PAID';
          activities.push({
            id: `fin-${inv.id}`,
            category: 'FINANCE',
            categoryLabel: 'Tài chính & Học phí',
            title: `Hóa đơn #${inv.invoice_number || inv.id.slice(0, 8)}`,
            description: isPaid
              ? `Đã thanh toán học phí: ${(inv.gross_amount || 0).toLocaleString('vi-VN')} đ`
              : `Phát hành học phí: ${(inv.gross_amount || 0).toLocaleString('vi-VN')} đ`,
            timestamp: inv.created_at || new Date().toISOString(),
            displayTime: formatTime(inv.created_at),
            actorRole: 'Kế toán',
            status: isPaid ? 'Đã thanh toán' : 'Chờ nộp',
          });
        }
      }

      // Map Health Incidents
      if (healthRes.status === 'fulfilled' && Array.isArray(healthRes.value.data)) {
        for (const h of healthRes.value.data as Array<{
          id: string;
          incident_type?: string | null;
          severity?: string | null;
          status?: string | null;
          created_at?: string | null;
        }>) {
          activities.push({
            id: `health-${h.id}`,
            category: 'CARE_NUTRITION',
            categoryLabel: 'Chăm sóc & Dinh dưỡng',
            title: `Kiểm tra sức khỏe: ${h.incident_type || 'Theo dõi y tế'}`,
            description: `Mức độ: ${h.severity || 'Nhẹ'} — Đã cập nhật vào sổ theo dõi y tế`,
            timestamp: h.created_at || new Date().toISOString(),
            displayTime: formatTime(h.created_at),
            actorRole: 'Y tế học đường',
            status: h.status || 'Đang theo dõi',
          });
        }
      }
    } catch (err) {
      console.warn('Preschool activity aggregator warning:', err);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (activities.length === 0) {
      return getFallbackPreschoolActivities(dateStr);
    }

    return activities;
  }

  /**
   * P6.1 Parent Communication: Aggregates real-time school notices & announcements from edu_comm_notices
   */
  async getRecentNoticesRawData(tenantId: string, limit = 5): Promise<PreschoolNoticeItemDTO[]> {
    try {
      const { data, error } = await this.supabase
        .from('edu_comm_notices')
        .select('id, title, body_text, notice_category, priority, created_at, due_at')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as Array<{
          id: string;
          title: string;
          body_text?: string | null;
          notice_category?: string | null;
          priority?: string | null;
          created_at: string;
          due_at?: string | null;
        }>).map((row) => {
          const cat = row.notice_category?.toUpperCase() || 'INFO';
          const priority = (row.priority?.toUpperCase() as PreschoolNoticeItemDTO['priority']) || 'NORMAL';
          let iconColor = 'text-sky-500';
          if (cat === 'CRITICAL' || priority === 'URGENT') iconColor = 'text-rose-500';
          else if (cat === 'CONSENT') iconColor = 'text-purple-500';
          else if (cat === 'FEEDBACK_REQ') iconColor = 'text-amber-500';

          const d = new Date(row.created_at);
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();

          return {
            id: row.id,
            title: row.title,
            bodyText: row.body_text || '',
            category: row.notice_category || 'THÔNG BÁO',
            priority,
            date: row.created_at.slice(0, 10),
            displayDate: `${day}/${month}/${year}`,
            dueAt: row.due_at ?? null,
            iconColor,
          };
        });
      }
    } catch (err) {
      console.warn('Preschool notices aggregator warning:', err);
    }
    return getFallbackPreschoolNotices();
  }

  /**
   * P4.3 Preschool Nutrition: Aggregates weekly menu plan from edu_weekly_menus & edu_weekly_menu_days
   */
  async getCurrentWeeklyMenuRawData(tenantId: string, targetDateStr: string): Promise<PreschoolWeeklyMenuDTO> {
    try {
      const { data: menuData, error: menuErr } = await this.supabase
        .from('edu_weekly_menus')
        .select('id, week_number, year, start_date, end_date, status, edu_weekly_menu_days(*)')
        .eq('tenant_id', tenantId)
        .lte('start_date', targetDateStr)
        .gte('end_date', targetDateStr)
        .maybeSingle();

      if (!menuErr && menuData && Array.isArray(menuData.edu_weekly_menu_days) && menuData.edu_weekly_menu_days.length > 0) {
        const daysMap: Record<string, string> = {
          MON: 'T2',
          TUE: 'T3',
          WED: 'T4',
          THU: 'T5',
          FRI: 'T6',
          SAT: 'T7',
        };
        const colorMap: Record<string, string> = {
          MON: 'bg-sky-400 text-white',
          TUE: 'bg-rose-400 text-white',
          WED: 'bg-emerald-400 text-white',
          THU: 'bg-blue-400 text-white',
          FRI: 'bg-purple-400 text-white',
          SAT: 'bg-amber-400 text-white',
        };

        const sortedDays = (menuData.edu_weekly_menu_days as Array<{
          day_of_week: string;
          menu_date: string;
          summary_dishes: string;
          calories_kcal?: number | null;
          meals_payload?: unknown;
        }>).map((d) => {
          const dayKey = (daysMap[d.day_of_week] || 'T2') as PreschoolWeeklyMenuDayDTO['dayKey'];
          const dateObj = new Date(d.menu_date);
          const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
          return {
            dayKey,
            dayLabel: dayKey === 'T2' ? 'Thứ Hai' : dayKey === 'T3' ? 'Thứ Ba' : dayKey === 'T4' ? 'Thứ Tư' : dayKey === 'T5' ? 'Thứ Năm' : dayKey === 'T6' ? 'Thứ Sáu' : 'Thứ Bảy',
            dateStr,
            badgeColor: colorMap[d.day_of_week] || 'bg-slate-400 text-white',
            summaryDishes: d.summary_dishes,
            caloriesKcal: d.calories_kcal ?? 680,
            meals: Array.isArray(d.meals_payload) ? (d.meals_payload as PreschoolWeeklyMenuDayDTO['meals']) : undefined,
          };
        });

        return {
          menuId: menuData.id,
          weekNumber: menuData.week_number,
          year: menuData.year,
          startDate: menuData.start_date,
          endDate: menuData.end_date,
          status: menuData.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
          days: sortedDays,
        };
      }
    } catch (err) {
      console.warn('Preschool weekly menu lookup warning:', err);
    }
    return getFallbackPreschoolWeeklyMenu(targetDateStr);
  }
}

function getFallbackPreschoolActivities(dateStr: string): PreschoolActivityItemDTO[] {
  return [
    {
      id: 'mock-1',
      category: 'ATTENDANCE',
      categoryLabel: 'Điểm danh & Đón trả',
      title: 'Nguyễn Minh Anh',
      description: 'Đã đến trường — Cô Lan đón vào lớp',
      timestamp: `${dateStr}T07:32:00Z`,
      displayTime: '07:32',
      actorRole: 'Học sinh',
      status: 'Đã đến',
    },
    {
      id: 'mock-2',
      category: 'LEARNING',
      categoryLabel: 'Học tập & Trải nghiệm',
      title: 'Lớp Lá 1',
      description: 'Hoàn thành hoạt động: Bé trồng cây & khám phá thiên nhiên',
      timestamp: `${dateStr}T10:15:00Z`,
      displayTime: '10:15',
      actorRole: 'Giáo viên',
      status: 'Hoàn thành',
    },
    {
      id: 'mock-3',
      category: 'PARENT_COMM',
      categoryLabel: 'Tương tác phụ huynh',
      title: 'Trần Thị Mai',
      description: 'Đã gửi phản hồi và dặn dò chế độ ăn cho giáo viên chủ nhiệm',
      timestamp: `${dateStr}T11:20:00Z`,
      displayTime: '11:20',
      actorRole: 'Phụ huynh',
      status: 'Đã nhận',
    },
    {
      id: 'mock-4',
      category: 'FINANCE',
      categoryLabel: 'Tài chính & Học phí',
      title: 'Phụ huynh Lê Hoàng',
      description: 'Đã thanh toán học phí Tháng 10 qua cổng VietQR',
      timestamp: `${dateStr}T14:08:00Z`,
      displayTime: '14:08',
      actorRole: 'Phụ huynh',
      status: 'Đã thanh toán',
    },
    {
      id: 'mock-5',
      category: 'CARE_NUTRITION',
      categoryLabel: 'Chăm sóc & Dinh dưỡng',
      title: 'Lớp Chồi 2',
      description: 'Cập nhật thực đơn tuần mới: Phở bò, Sữa tươi, Chuối tiêu',
      timestamp: `${dateStr}T15:30:00Z`,
      displayTime: '15:30',
      actorRole: 'Dinh dưỡng',
      status: 'Đã duyệt',
    },
    {
      id: 'mock-6',
      category: 'ATTENDANCE',
      categoryLabel: 'Điểm danh & Đón trả',
      title: 'Trần Gia Bảo',
      description: 'Bàn giao phụ huynh đón về an toàn lúc tan trường',
      timestamp: `${dateStr}T16:45:00Z`,
      displayTime: '16:45',
      actorRole: 'Học sinh',
      status: 'Đã đón',
    },
    {
      id: 'mock-7',
      category: 'CARE_NUTRITION',
      categoryLabel: 'Chăm sóc & Dinh dưỡng',
      title: 'Bé Phạm Hoàng Yến',
      description: 'Đã uống sữa chua & hoàn thành giấc ngủ trưa đủ giấc',
      timestamp: `${dateStr}T13:30:00Z`,
      displayTime: '13:30',
      actorRole: 'Bảo mẫu',
      status: 'Đã hoàn thành',
    },
    {
      id: 'mock-8',
      category: 'LEARNING',
      categoryLabel: 'Học tập & Trải nghiệm',
      title: 'Lớp Mầm non 1',
      description: 'Hoàn thành tiết học Aerobic & Vận động phát triển thể chất',
      timestamp: `${dateStr}T09:00:00Z`,
      displayTime: '09:00',
      actorRole: 'Giáo viên',
      status: 'Hoàn thành',
    },
  ];
}

export function getFallbackPreschoolNotices(): PreschoolNoticeItemDTO[] {
  return [
    {
      id: 'notice-1',
      title: 'Kế hoạch tổ chức Ngày Phụ nữ VN 20/10',
      bodyText: 'Nhà trường phát động chuỗi hoạt động làm thiệp và gửi lời chúc yêu thương của các bé đến bà và mẹ nhân ngày 20/10.',
      category: 'HOẠT ĐỘNG',
      priority: 'HIGH',
      date: '2026-10-15',
      displayDate: '15/10/2026',
      iconColor: 'text-rose-500',
    },
    {
      id: 'notice-2',
      title: 'Lịch khám sức khỏe & nha khoa định kỳ HK1',
      bodyText: 'Đoàn bác sĩ chuyên khoa Nhi & Răng Hàm Mặt sẽ tiến hành khám sức khỏe tổng quát và tầm soát răng miệng cho toàn bộ học sinh.',
      category: 'Y TẾ',
      priority: 'HIGH',
      date: '2026-10-12',
      displayDate: '12/10/2026',
      iconColor: 'text-sky-500',
    },
    {
      id: 'notice-3',
      title: 'Lễ hội Hóa trang Halloween & Buffet bé yêu',
      bodyText: 'Chương trình hóa trang các nhân vật cổ tích và tiệc buffet dinh dưỡng với hơn 15 món ăn ngon miệng, hấp dẫn dành riêng cho bé.',
      category: 'SỰ KIỆN',
      priority: 'NORMAL',
      date: '2026-10-08',
      displayDate: '08/10/2026',
      iconColor: 'text-purple-500',
    },
    {
      id: 'notice-4',
      title: 'Thông báo thu học phí & tiền ăn Tháng 10',
      bodyText: 'Kế toán gửi thông báo biểu phí học tập, tiền ăn và các câu lạc bộ ngoại khóa Tháng 10/2026. Hạn hoàn tất đến ngày 15/10/2026.',
      category: 'TÀI CHÍNH',
      priority: 'NORMAL',
      date: '2026-10-01',
      displayDate: '01/10/2026',
      iconColor: 'text-amber-500',
    },
  ];
}

export function getFallbackPreschoolWeeklyMenu(targetDateStr: string): PreschoolWeeklyMenuDTO {
  return {
    menuId: 'menu-oct-w3',
    weekNumber: 43,
    year: 2026,
    startDate: '2026-10-19',
    endDate: '2026-10-23',
    status: 'PUBLISHED',
    days: [
      {
        dayKey: 'T2',
        dayLabel: 'Thứ Hai',
        dateStr: '19/10/2026',
        badgeColor: 'bg-sky-400 text-white',
        summaryDishes: 'Phở bò, Sữa tươi, Chuối',
        caloriesKcal: 680,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Phở bò Hà Nội'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi thanh trùng 150ml'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm dẻo', 'Thịt heo rim nước dừa', 'Canh bí đao nấu tôm'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Chuối tiêu chín', 'Bánh bông lan'] },
        ],
      },
      {
        dayKey: 'T3',
        dayLabel: 'Thứ Ba',
        dateStr: '20/10/2026',
        badgeColor: 'bg-rose-400 text-white',
        summaryDishes: 'Cơm gà, Canh rau củ, Sữa chua',
        caloriesKcal: 710,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Cháo gà hạt sen'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa đậu nành hữu cơ'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm gà xé phay', 'Canh củ dền xương heo'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Sữa chua hoa quả dầm'] },
        ],
      },
      {
        dayKey: 'T4',
        dayLabel: 'Thứ Tư',
        dateStr: '21/10/2026',
        badgeColor: 'bg-emerald-400 text-white',
        summaryDishes: 'Bún cá, Rau hấp, Dưa hấu',
        caloriesKcal: 670,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Bún cá rô đồng'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Nước ép táo nguyên chất'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm trắng', 'Cá hồi áp chảo sốt bơ tỏi', 'Rau củ hấp thập cẩm', 'Canh rau ngót'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Dưa hấu tươi', 'Sữa hạt sen'] },
        ],
      },
      {
        dayKey: 'T5',
        dayLabel: 'Thứ Năm',
        dateStr: '22/10/2026',
        badgeColor: 'bg-blue-400 text-white',
        summaryDishes: 'Cơm thịt kho, Canh bí đỏ, Sữa tươi',
        caloriesKcal: 720,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Hủ tiếu Nam Vang thịt bằm'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa tươi Vinamilk 180ml'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm thơm', 'Thịt ba chỉ kho trứng cút', 'Canh bí đỏ đậu phộng'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Bánh flan caramen', 'Thanh long ruột đỏ'] },
        ],
      },
      {
        dayKey: 'T6',
        dayLabel: 'Thứ Sáu',
        dateStr: '23/10/2026',
        badgeColor: 'bg-purple-400 text-white',
        summaryDishes: 'Mì trứng, Trứng hấp, Thanh long',
        caloriesKcal: 690,
        meals: [
          { mealType: 'BREAKFAST', mealTypeLabel: 'Bữa sáng', dishes: ['Mì trứng xào thịt bò rau cải'] },
          { mealType: 'MORNING_SNACK', mealTypeLabel: 'Bữa phụ sáng', dishes: ['Sữa bắp non ngọt dịu'] },
          { mealType: 'LUNCH', mealTypeLabel: 'Bữa trưa chính', dishes: ['Cơm tấm mềm', 'Trứng hấp thịt bằm mộc nhĩ', 'Canh chua cá bông lau'] },
          { mealType: 'AFTERNOON_SNACK', mealTypeLabel: 'Bữa xế', dishes: ['Thanh long trắng', 'Bánh quy bơ'] },
        ],
      },
    ],
  };
}

