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
      this.supabase.from('edu_fin_invoices').select('id, gross_amount, net_amount, invoice_status, settlement_status, due_date, issued_at, created_at').eq('tenant_id', tenantId).eq('invoice_status', 'ISSUED'),
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
      return [];
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
    return [];
  }

  /**
   * P4.3 Preschool Nutrition: Aggregates weekly menu plan from edu_weekly_menus & edu_weekly_menu_days
   */
  async getCurrentWeeklyMenuRawData(tenantId: string, targetDateStr: string): Promise<PreschoolWeeklyMenuDTO | null> {
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
    return null;
  }
}


