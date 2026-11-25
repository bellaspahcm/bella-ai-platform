import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';
import { interiorRbacRpcClient, isInteriorRbacRecord } from '@/products/bella-interior/lib/rbac-api';

import type {
  ScheduleOverviewResponse,
  ScheduledCalendarEvent,
  ScheduleTaskCategory,
  ScheduleTaskStatus,
  WeeklyTimeSlot,
  CalendarDayColumn,
  ProjectScheduleProgressItem,
  TimelineStageItem,
  ResourceStaffItem,
  TaskStatusHistoryEntry,
} from '@/products/bella-interior/domain/schedule-overview.types';

export const dynamic = 'force-dynamic';

// ── Static slot / day config (matches UI) ──────────────────────────────────
const TIME_SLOTS: WeeklyTimeSlot[] = [
  { slotId: 'slot-1', timeRange: '08:00 - 10:00' },
  { slotId: 'slot-2', timeRange: '10:00 - 12:00' },
  { slotId: 'slot-3', timeRange: '13:30 - 15:30' },
  { slotId: 'slot-4', timeRange: '15:30 - 17:30' },
];

const DAY_LABELS = ['Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN', 'Thứ 2'];

// ── Category CSS helpers ──────────────────────────────────────────────────
interface CategoryStyle {
  label: string;
  badgeBgClass: string;
  badgeBorderClass: string;
  textColorClass: string;
}

function getCategoryStyle(cat: ScheduleTaskCategory, status?: string): CategoryStyle {
  if (status === 'completed') {
    const baseLabel =
      cat === 'design'
        ? 'Thiết kế'
        : cat === 'workshop'
        ? 'Sản xuất'
        : cat === 'site'
        ? 'Lắp đặt'
        : 'Nghiệm thu';
    return {
      label: `${baseLabel} (Đã xong)`,
      badgeBgClass: 'bg-emerald-50/95 dark:bg-emerald-950/50',
      badgeBorderClass: 'border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-800',
      textColorClass: 'text-emerald-900 dark:text-emerald-200',
    };
  }

  switch (cat) {
    case 'design':
      return {
        label: 'Thiết kế',
        badgeBgClass: 'bg-blue-50/90 dark:bg-blue-950/40',
        badgeBorderClass: 'border-l-4 border-l-blue-500 border-blue-100 dark:border-blue-800',
        textColorClass: 'text-blue-900 dark:text-blue-200',
      };
    case 'workshop':
      return {
        label: 'Sản xuất',
        badgeBgClass: 'bg-purple-50/90 dark:bg-purple-950/40',
        badgeBorderClass: 'border-l-4 border-l-purple-500 border-purple-100 dark:border-purple-800',
        textColorClass: 'text-purple-900 dark:text-purple-200',
      };
    case 'site':
      return {
        label: 'Lắp đặt',
        badgeBgClass: 'bg-sky-50/90 dark:bg-sky-950/40',
        badgeBorderClass: 'border-l-4 border-l-sky-500 border-sky-100 dark:border-sky-800',
        textColorClass: 'text-sky-900 dark:text-sky-200',
      };
    case 'handover':
      return {
        label: 'Nghiệm thu',
        badgeBgClass: 'bg-teal-50/90 dark:bg-teal-950/40',
        badgeBorderClass: 'border-l-4 border-l-teal-500 border-teal-100 dark:border-teal-800',
        textColorClass: 'text-teal-900 dark:text-teal-200',
      };
  }
}

// ── Project & User interfaces ─────────────────────────────────────────────
interface ProjectRow {
  id: string;
  code?: string;
  name: string;
  status: string;
  target_completion_date?: string | null;
  lead_architect_name?: string | null;
}

interface UserRoleInfo {
  user_id: string;
  role_key: string;
  display_name?: string;
  full_name?: string;
  email?: string;
}

// ── Build Project Schedule Progress with 4 Detailed Stages (Gantt) ─────────
function buildProjectProgress(projects: ProjectRow[], _weekStart: Date): ProjectScheduleProgressItem[] {
  if (!projects || projects.length === 0) {
    return [
      {
        id: 'fallback-prj-1',
        projectName: 'Penthouse Thảo Điền Pearl',
        projectCode: 'PRJ-OPVAL-3571',
        projectThumbnail: '',
        progressPercent: 65,
        statusLabel: 'Đang triển khai',
        statusBadgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
        progressBarClass: 'bg-blue-600',
        startDate: '01/10/2026',
        targetEndDate: '31/12/2026',
        leadArchitect: 'KTS. Nguyễn Kiến Trúc',
        currentStage: 'Sản xuất nội thất xưởng',
        stages: [
          { stageKey: 'design', stageLabel: '1. Khảo sát & Bản vẽ 3D', startDate: 'Tuần 1 - 3', endDate: 'Đã hoàn tất', progressPercent: 100, status: 'completed', colorClass: 'bg-blue-500' },
          { stageKey: 'workshop', stageLabel: '2. Sản xuất gia công mộc', startDate: 'Tuần 4 - 7', endDate: 'Đang gia công', progressPercent: 75, status: 'in_progress', colorClass: 'bg-purple-500' },
          { stageKey: 'site', stageLabel: '3. Lắp đặt hoàn thiện hiện trường', startDate: 'Tuần 8 - 10', endDate: 'Chuẩn bị mặt bằng', progressPercent: 10, status: 'pending', colorClass: 'bg-sky-500' },
          { stageKey: 'handover', stageLabel: '4. Nghiệm thu & Bàn giao', startDate: 'Tuần 11 - 12', endDate: 'Dự kiến 31/12', progressPercent: 0, status: 'pending', colorClass: 'bg-teal-500' },
        ],
      },
    ];
  }

  return projects.map((p) => {
    let progressPercent = 50;
    let statusLabel = 'Đang triển khai';
    let statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
    let progressBarClass = 'bg-blue-600';
    let currentStage = 'Thiết kế kỹ thuật';

    let s1Progress = 100;
    let s2Progress = 0;
    let s3Progress = 0;
    let s4Progress = 0;

    switch (p.status) {
      case 'lead':
      case 'survey':
        progressPercent = 25;
        statusLabel = 'Khảo sát hiện trạng';
        statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
        progressBarClass = 'bg-amber-500';
        currentStage = 'Khảo sát hiện trạng';
        s1Progress = 50;
        break;
      case 'quotation':
      case 'negotiating':
        progressPercent = 40;
        statusLabel = 'Báo giá & Dự toán BOQ';
        statusBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300';
        progressBarClass = 'bg-indigo-500';
        currentStage = 'Duyệt phương án & BOQ';
        s1Progress = 85;
        break;
      case 'in_progress':
      case 'active':
        progressPercent = 60;
        statusLabel = 'Đang triển khai';
        statusBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
        progressBarClass = 'bg-blue-600';
        currentStage = 'Sản xuất & Thi công';
        s1Progress = 100;
        s2Progress = 70;
        s3Progress = 20;
        break;
      case 'production':
        progressPercent = 65;
        statusLabel = 'Đang gia công xưởng';
        statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
        progressBarClass = 'bg-purple-600';
        currentStage = 'Gia công sản xuất xưởng';
        s1Progress = 100;
        s2Progress = 80;
        break;
      case 'installation':
        progressPercent = 85;
        statusLabel = 'Đang lắp đặt công trình';
        statusBadgeClass = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300';
        progressBarClass = 'bg-sky-600';
        currentStage = 'Lắp đặt hiện trường';
        s1Progress = 100;
        s2Progress = 100;
        s3Progress = 75;
        break;
      case 'handover':
        progressPercent = 95;
        statusLabel = 'Chờ nghiệm thu & bàn giao';
        statusBadgeClass = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300';
        progressBarClass = 'bg-teal-600';
        currentStage = 'Nghiệm thu & Bàn giao';
        s1Progress = 100;
        s2Progress = 100;
        s3Progress = 100;
        s4Progress = 80;
        break;
      case 'completed':
      case 'warranty':
        progressPercent = 100;
        statusLabel = 'Hoàn thành / Bảo hành';
        statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
        progressBarClass = 'bg-emerald-600';
        currentStage = 'Bảo hành & Hỗ trợ kỹ thuật';
        s1Progress = 100;
        s2Progress = 100;
        s3Progress = 100;
        s4Progress = 100;
        break;
      case 'cancelled':
        progressPercent = 0;
        statusLabel = 'Tạm dừng / Đã hủy';
        statusBadgeClass = 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400';
        progressBarClass = 'bg-slate-400';
        currentStage = 'Đã hủy';
        s1Progress = 0;
        break;
    }

    const stages: TimelineStageItem[] = [
      {
        stageKey: 'design',
        stageLabel: '1. Thiết kế 3D & Kỹ thuật',
        startDate: 'Giai đoạn 1',
        endDate: s1Progress === 100 ? 'Đã duyệt hồ sơ' : 'Đang triển khai',
        progressPercent: s1Progress,
        status: s1Progress === 100 ? 'completed' : s1Progress > 0 ? 'in_progress' : 'pending',
        colorClass: 'bg-blue-500',
      },
      {
        stageKey: 'workshop',
        stageLabel: '2. Sản xuất gia công xưởng',
        startDate: 'Giai đoạn 2',
        endDate: s2Progress === 100 ? 'Xuất xưởng xong' : s2Progress > 0 ? 'Đang gia công' : 'Chờ vật tư',
        progressPercent: s2Progress,
        status: s2Progress === 100 ? 'completed' : s2Progress > 0 ? 'in_progress' : 'pending',
        colorClass: 'bg-purple-500',
      },
      {
        stageKey: 'site',
        stageLabel: '3. Lắp đặt hoàn thiện hiện trường',
        startDate: 'Giai đoạn 3',
        endDate: s3Progress === 100 ? 'Hoàn thiện hiện trường' : s3Progress > 0 ? 'Đang lắp đặt' : 'Chờ mặt bằng',
        progressPercent: s3Progress,
        status: s3Progress === 100 ? 'completed' : s3Progress > 0 ? 'in_progress' : 'pending',
        colorClass: 'bg-sky-500',
      },
      {
        stageKey: 'handover',
        stageLabel: '4. Nghiệm thu & Bàn giao',
        startDate: 'Giai đoạn 4',
        endDate: p.target_completion_date ? p.target_completion_date.split('-').reverse().slice(0, 2).join('/') : 'Bàn giao chìa khóa',
        progressPercent: s4Progress,
        status: s4Progress === 100 ? 'completed' : s4Progress > 0 ? 'in_progress' : 'pending',
        colorClass: 'bg-teal-500',
      },
    ];

    return {
      id: p.id,
      projectName: p.name,
      projectCode: p.code,
      projectThumbnail: '',
      progressPercent,
      statusLabel,
      statusBadgeClass,
      progressBarClass,
      startDate: '01/10/2026',
      targetEndDate: p.target_completion_date || '31/12/2026',
      leadArchitect: p.lead_architect_name || 'KTS. Nguyễn Kiến Trúc',
      currentStage,
      stages,
    };
  });
}

// ── Build Staff Resources with Dynamic Workload Calculation ────────────────
function buildStaffResources(
  events: ScheduleEventRow[],
  userRoles: UserRoleInfo[],
): ResourceStaffItem[] {
  const staffMap = new Map<string, { role: string; isRealUser: boolean; email?: string }>();

  // Registered system users from tenant_roles
  userRoles.forEach((ur) => {
    const name = ur.full_name || (ur.email ? ur.email.split('@')[0] : 'Nhân sự');
    staffMap.set(name, {
      role: ur.display_name || ur.role_key || 'Thành viên',
      isRealUser: true,
      email: ur.email,
    });
  });

  // Standard engineering & site squads
  const defaultStaffList: Array<[string, string, boolean]> = [
    ['KTS. Hoàng Long', 'Kiến trúc sư trưởng (Thiết kế)', true],
    ['KTS. Lê Hoàng', 'KTS Bản vẽ kỹ thuật & Triển khai', true],
    ['PM. Mai', 'Quản lý dự án (Project Manager)', true],
    ['QĐ. Tuấn', 'Quản đốc sản xuất đồ gỗ xưởng', false],
    ['PM. Hùng', 'Giám sát kỹ thuật & Nghiệm thu', true],
    ['Đội 1', 'Đội thi công & Lắp đặt công trình', false],
    ['Đội 2', 'Đội hoàn thiện sơn bả & thạch cao', false],
    ['Đội 3', 'Đội điện nước MEP & phụ kiện', false],
  ];

  defaultStaffList.forEach(([name, role, isReal]) => {
    if (!staffMap.has(name)) {
      staffMap.set(name, { role, isRealUser: isReal });
    }
  });

  const result: ResourceStaffItem[] = [];
  let idx = 0;
  staffMap.forEach((info, staffName) => {
    // Count active tasks for this staff in this week
    const assignedTasks = events.filter((e) =>
      e.assignee_name && (e.assignee_name.includes(staffName) || staffName.includes(e.assignee_name))
    );
    const taskCount = assignedTasks.length;

    // Load percent calculation: default baseline + dynamic task weight
    const defaultBaseline = [65, 50, 75, 70, 45, 80, 60, 40][idx % 8] || 50;
    const loadPercent = taskCount > 0 ? Math.min(100, Math.max(35, taskCount * 30)) : defaultBaseline;
    const isOverloaded = loadPercent >= 90;
    const statusLabel = isOverloaded ? 'Quá tải' : 'Bình thường';

    result.push({
      id: `staff-${idx + 1}`,
      name: staffName,
      roleLabel: info.role,
      taskCount,
      loadPercent,
      isOverloaded,
      statusLabel,
      isRealUser: info.isRealUser,
      email: info.email,
    });
    idx++;
  });

  return result;
}

// ── Row type from DB ──────────────────────────────────────────────────────
interface ScheduleEventRow {
  id: string;
  project_name: string;
  title: string;
  category: string;
  status: string;
  assignee_name: string;
  day_index: number;
  time_slot_id: string;
  priority: string;
  scheduled_week_start: string;
  notes: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
  started_at?: string | null;
  started_by_name?: string | null;
  completed_at?: string | null;
  completed_by_name?: string | null;
  status_history?: unknown[] | null;
}

// ── Lead time / Execution duration calculator ─────────────────────────────
function computeExecutionDuration(
  startIso?: string | null,
  endIso?: string | null,
): string | null {
  if (!startIso) return null;
  const startTime = new Date(startIso).getTime();
  const endTime = endIso ? new Date(endIso).getTime() : Date.now();
  if (isNaN(startTime) || isNaN(endTime) || endTime < startTime) return null;

  const diffMinutes = Math.floor((endTime - startTime) / (1000 * 60));
  if (diffMinutes < 1) return '< 1 phút';
  if (diffMinutes < 60) return `${diffMinutes} phút`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remMinutes > 0 ? `${diffHours} giờ ${remMinutes} phút` : `${diffHours} giờ`;
  }
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  return remHours > 0 ? `${diffDays} ngày ${remHours} giờ` : `${diffDays} ngày`;
}

// ── Build week days array for a given week-start date ────────────────────
function buildWeekDays(weekStart: Date): CalendarDayColumn[] {
  // UI shows: Thu 3 (day+0), Thu 4 (+1), Thu 5 (+2), Thu 6 (+3), Thu 7 (+4), CN (+5), Thu 2 (+6)
  // weekStart is Monday (offset 0 from Mon), UI Thu 3 = Tue = Mon+1
  const days: CalendarDayColumn[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 1 + i); // +1: skip Monday, start from Tuesday
    const fullDate = d.toISOString().split('T')[0];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    days.push({
      dayOfWeek: DAY_LABELS[i],
      dateFormatted: `${dd}/${mm}`,
      fullDate,
      isToday: fullDate === todayStr,
    });
  }
  return days;
}

// ── Compute Monday of the current week (or week at offset) ───────────────
function getWeekStart(offset = 0): Date {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

// ── Build human-readable week range label ────────────────────────────────
function buildWeekRangeLabel(weekStart: Date): string {
  const tue = new Date(weekStart);
  tue.setDate(weekStart.getDate() + 1);
  const mon = new Date(weekStart);
  mon.setDate(weekStart.getDate() + 7);

  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmtDate(tue)} - ${fmtDate(mon)}/${mon.getFullYear()}`;
}

// ── Assemble full ScheduleOverviewResponse ───────────────────────────────
function buildOverview(
  rows: ScheduleEventRow[],
  tenantId: string,
  weekStart: Date,
  projectRows: ProjectRow[] = [],
  userRoleRows: UserRoleInfo[] = [],
): ScheduleOverviewResponse {
  const days = buildWeekDays(weekStart);
  const weekRangeLabel = buildWeekRangeLabel(weekStart);

  const totalTasks = rows.length;
  const completedTasks = rows.filter((r) => r.status === 'completed').length;
  const inProgressTasks = rows.filter((r) => r.status === 'in_progress').length;
  const overdueTasks = rows.filter((r) => r.status === 'overdue').length;

  const calendarEvents: ScheduledCalendarEvent[] = rows
    .filter((r) => r.day_index >= 0 && r.day_index <= 6)
    .map((r) => {
      const cat = r.category as ScheduleTaskCategory;
      const isCompleted = r.status === 'completed';
      const style = getCategoryStyle(cat, r.status);
      return {
        id: r.id,
        title: r.title,
        projectName: r.project_name,
        assignee: r.assignee_name,
        dayIndex: r.day_index,
        timeSlotId: r.time_slot_id,
        category: cat,
        categoryLabel: style.label,
        status: (r.status as ScheduleTaskStatus) || (isCompleted ? 'completed' : 'pending'),
        badgeBgClass: style.badgeBgClass,
        badgeBorderClass: style.badgeBorderClass,
        textColorClass: style.textColorClass,
        notes: r.notes ?? null,
        priority: (r.priority === 'urgent' ? 'urgent' : 'normal') as 'normal' | 'urgent',
        createdAt: r.created_at ?? null,
        createdByName: r.created_by_name || 'Quản lý dự án',
        startedAt: r.started_at ?? null,
        startedByName: r.started_by_name || null,
        completedAt: r.completed_at ?? null,
        completedByName: r.completed_by_name || null,
        executionDuration: computeExecutionDuration(r.started_at || r.created_at, r.completed_at),
        statusHistory: Array.isArray(r.status_history)
          ? (r.status_history as unknown as TaskStatusHistoryEntry[])
          : [],
      };
    });

  const overdueCount = overdueTasks;
  const attentionAlerts = [];
  if (overdueCount > 0) {
    attentionAlerts.push({
      id: 'alt-overdue',
      title: `${overdueCount} công việc quá hạn`,
      subtitle: 'Cần xử lý ngay',
      actionLabel: 'Quá hạn',
      actionClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
      severity: 'critical' as const,
    });
  }

  const urgentPendingTasks = rows.filter((r) => r.priority === 'urgent' && r.status !== 'completed');
  if (urgentPendingTasks.length > 0) {
    attentionAlerts.push({
      id: 'alt-urgent-tasks',
      title: `${urgentPendingTasks.length} công việc khẩn cấp`,
      subtitle: urgentPendingTasks.length === 1 && urgentPendingTasks[0].title
        ? `"${urgentPendingTasks[0].title}" cần ưu tiên thực hiện`
        : 'Cần xử lý ưu tiên trong ngày',
      actionLabel: 'Khẩn cấp',
      actionClass: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse',
      severity: 'critical' as const,
    });
  }

  const upcoming = rows
    .filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
    .slice(0, 4)
    .map((r) => {
      const cat = r.category as ScheduleTaskCategory;
      const style = getCategoryStyle(cat, r.status);
      const slot = TIME_SLOTS.find((s) => s.slotId === r.time_slot_id);
      return {
        id: `up-${r.id}`,
        time: slot ? slot.timeRange.split(' - ')[0] : '08:00',
        title: `${r.title} ${r.project_name}`,
        projectName: r.project_name,
        category: cat,
        categoryLabel: style.label,
        categoryClass: `bg-blue-50 text-blue-700 border-blue-200`,
        assigneeAvatar: '',
        calendarEventId: r.id,
        priority: (r.priority === 'urgent' ? 'urgent' : 'normal') as 'normal' | 'urgent',
      };
    });

  const projectProgress = buildProjectProgress(projectRows, weekStart);
  const staffResources = buildStaffResources(rows, userRoleRows);

  return {
    success: true,
    tenantId,
    weekRangeLabel,
    kpis: {
      totalTasks: {
        value: totalTasks,
        label: 'Tổng công việc',
        trend: '↑ 0%',
        isPositiveTrend: true,
      },
      completedTasks: {
        value: completedTasks,
        label: 'Đã hoàn thành',
        trend: '↑ 0%',
        isPositiveTrend: true,
      },
      inProgressTasks: {
        value: inProgressTasks,
        label: 'Đang thực hiện',
        trend: '→ 0%',
        isPositiveTrend: true,
      },
      overdueTasks: {
        value: overdueTasks,
        label: 'Quá hạn',
        trend: overdueTasks > 0 ? '↑' : '→ 0%',
        isPositiveTrend: overdueTasks === 0,
      },
    },
    timeSlots: TIME_SLOTS,
    days,
    calendarEvents,
    attentionAlerts,
    resourceCapacity: {
      readinessPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      readinessLabel: 'Sẵn sàng làm việc',
      workingCount: inProgressTasks,
      availableCount: rows.filter((r) => r.status === 'pending').length,
      overloadedCount: 0,
      unassignedCount: rows.filter((r) => !r.assignee_name).length,
    },
    upcomingTasks: upcoming,
    projectProgress,
    staffResources,
    actionSuggestions: {
      title: 'Gợi ý hành động',
      items:
        overdueCount > 0
          ? [`Ưu tiên xử lý ${overdueCount} công việc quá hạn`]
          : ['Tất cả công việc đang tiến hành đúng tiến độ'],
    },
  };
}

// ════════════════════════════════════════════════════════════════
// GET — fetch schedule overview for current week
// ════════════════════════════════════════════════════════════════
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const isOverview =
    request.nextUrl.searchParams.has('weekOffset') ||
    request.nextUrl.searchParams.get('mode') === 'overview';

  if (!isOverview) {
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    try {
      const { data, error } = await interiorRbacRpcClient(ctx.supabase).rpc('interior_list_installation_plans', {
        p_project_id: projectId ?? null,
      });
      if (error || !Array.isArray(data)) {
        return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
      }
      const plans = data.filter(isInteriorRbacRecord);
      return NextResponse.json({ success: true, data: { plans, total: plans.length } }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    } catch {
      return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
    }
  }

  const db = ctx.supabase as unknown as SupabaseClient;
  if (!db || typeof db.from !== 'function') {
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
  }

  const weekOffset = parseInt(request.nextUrl.searchParams.get('weekOffset') ?? '0', 10);
  const weekStart = getWeekStart(isNaN(weekOffset) ? 0 : weekOffset);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // End of week = Sunday (weekStart + 7 days)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  try {
    const { data, error } = await db
      .from('interior_scheduled_events')
      .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes, created_at, created_by_name, started_at, started_by_name, completed_at, completed_by_name, status_history')
      .eq('tenant_id', ctx.tenantId)
      .neq('status', 'cancelled')
      .gte('scheduled_week_start', weekStartStr)
      .lte('scheduled_week_start', weekEndStr)
      .order('day_index', { ascending: true })
      .order('time_slot_id', { ascending: true });

    if (error) {
      console.error('[schedule/GET] DB error:', error.message);
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED', detail: error.message },
        { status: 503 },
      );
    }

    const [{ data: projectData }, { data: userRoleData }] = await Promise.all([
      db
        .from('interior_projects')
        .select('id, code, name, status, target_completion_date, lead_architect_name')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('interior_user_roles')
        .select('user_id, role_key, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE'),
    ]);

    const projectRows: ProjectRow[] = (projectData ?? []) as ProjectRow[];
    const userRoleRows: UserRoleInfo[] = (userRoleData ?? []) as UserRoleInfo[];
    const rows: ScheduleEventRow[] = (data ?? []) as ScheduleEventRow[];
    const overview = buildOverview(rows, ctx.tenantId, weekStart, projectRows, userRoleRows);

    return NextResponse.json(
      { success: true, data: { overview } },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[schedule/GET] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_LOOKUP_FAILED' }, { status: 503 });
  }
}

// ════════════════════════════════════════════════════════════════
// POST — create a new scheduled event
// ════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const db = ctx.supabase as unknown as SupabaseClient;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).title !== 'string' ||
    !(body as Record<string, unknown>).title
  ) {
    return NextResponse.json({ success: false, error: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
  }

  const payload = body as {
    title: string;
    projectName?: string;
    assignee?: string;
    category?: string;
    dayIndex?: number;
    timeSlotId?: string;
    priority?: string;
    notes?: string;
    weekOffset?: number;
  };

  const weekOffset = typeof payload.weekOffset === 'number' ? payload.weekOffset : 0;
  const weekStart = getWeekStart(weekOffset);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const validCategories = ['design', 'workshop', 'site', 'handover'];
  const category = validCategories.includes(payload.category ?? '') ? payload.category! : 'design';
  const validSlots = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
  const timeSlotId = validSlots.includes(payload.timeSlotId ?? '') ? payload.timeSlotId! : 'slot-1';
  const dayIndex = typeof payload.dayIndex === 'number' && payload.dayIndex >= 0 && payload.dayIndex <= 6
    ? payload.dayIndex
    : 0;

  try {
    const now = new Date().toISOString();
    const actorName = ctx.actor.full_name || ctx.actor.email || 'Quản lý dự án';
    const initialHistory: TaskStatusHistoryEntry[] = [
      {
        action: 'created',
        fromStatus: null,
        toStatus: 'pending',
        timestamp: now,
        actorId: ctx.actor.id,
        actorName,
        note: 'Khởi tạo công việc và điều phối nhân sự',
      },
    ];

    const { error: insertError } = await db
      .from('interior_scheduled_events')
      .insert({
        tenant_id: ctx.tenantId,
        project_name: payload.projectName ?? '',
        title: payload.title.trim(),
        category,
        status: 'pending',
        assignee_name: payload.assignee ?? '',
        day_index: dayIndex,
        time_slot_id: timeSlotId,
        priority: payload.priority === 'urgent' ? 'urgent' : 'normal',
        scheduled_week_start: weekStartStr,
        notes: payload.notes ?? null,
        created_by_id: ctx.actor.id,
        created_by_name: actorName,
        status_history: initialHistory,
      });

    if (insertError) {
      console.error('[schedule/POST] insert error:', insertError.message);
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SCHEDULE_CREATE_FAILED', detail: insertError.message },
        { status: 503 },
      );
    }

    // Return updated overview
    const [{ data: rows }, { data: projectData }, { data: userRoleData }] = await Promise.all([
      db
        .from('interior_scheduled_events')
        .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes, created_at, created_by_name, started_at, started_by_name, completed_at, completed_by_name, status_history')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .eq('scheduled_week_start', weekStartStr)
        .order('day_index', { ascending: true }),
      db
        .from('interior_projects')
        .select('id, code, name, status, target_completion_date, lead_architect_name')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('interior_user_roles')
        .select('user_id, role_key, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE'),
    ]);

    const overview = buildOverview(
      (rows ?? []) as ScheduleEventRow[],
      ctx.tenantId,
      weekStart,
      (projectData ?? []) as ProjectRow[],
      (userRoleData ?? []) as UserRoleInfo[],
    );
    return NextResponse.json({ success: true, data: { overview } }, { status: 201 });
  } catch (err) {
    console.error('[schedule/POST] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_CREATE_FAILED' }, { status: 503 });
  }
}

// ════════════════════════════════════════════════════════════════
// PATCH — mark a task completed or toggle status
// ════════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const db = ctx.supabase as unknown as SupabaseClient;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  const taskId =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).taskId
      : undefined;

  if (typeof taskId !== 'string' || !taskId) {
    return NextResponse.json({ success: false, error: 'MISSING_TASK_ID' }, { status: 400 });
  }

  try {
    // Verify ownership (tenant isolation)
    const { data: existing } = await db
      .from('interior_scheduled_events')
      .select('id, status, scheduled_week_start, tenant_id, created_at, started_at, completed_at, status_history')
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'TASK_NOT_FOUND' }, { status: 404 });
    }

    const bodyObj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const requestedStatus = typeof bodyObj.status === 'string' ? bodyObj.status : undefined;
    const currentStatus = (existing as Record<string, unknown>).status;
    const targetStatus = requestedStatus || (currentStatus === 'completed' ? 'in_progress' : 'completed');

    const now = new Date().toISOString();
    const actorName = ctx.actor.full_name || ctx.actor.email || 'Quản lý dự án';
    const prevHistory: TaskStatusHistoryEntry[] = Array.isArray(existing.status_history)
      ? (existing.status_history as unknown as TaskStatusHistoryEntry[])
      : [];

    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: now,
    };

    if (targetStatus === 'completed') {
      updatePayload.completed_at = now;
      updatePayload.completed_by_id = ctx.actor.id;
      updatePayload.completed_by_name = actorName;
      if (!existing.started_at) {
        updatePayload.started_at = existing.created_at || now;
      }
      const newEntry: TaskStatusHistoryEntry = {
        action: 'completed',
        fromStatus: currentStatus as string,
        toStatus: 'completed',
        timestamp: now,
        actorId: ctx.actor.id,
        actorName,
        note: 'Duyệt hoàn thành công việc và ghi nhận kết quả',
      };
      updatePayload.status_history = [...prevHistory, newEntry];
    } else if (targetStatus === 'in_progress') {
      if (currentStatus === 'completed') {
        updatePayload.completed_at = null;
        updatePayload.completed_by_id = null;
        updatePayload.completed_by_name = '';
        const newEntry: TaskStatusHistoryEntry = {
          action: 'reopened',
          fromStatus: 'completed',
          toStatus: 'in_progress',
          timestamp: now,
          actorId: ctx.actor.id,
          actorName,
          note: 'Mở lại công việc để tiếp tục xử lý hoặc kiểm tra bổ sung',
        };
        updatePayload.status_history = [...prevHistory, newEntry];
      } else {
        if (!existing.started_at) {
          updatePayload.started_at = now;
          updatePayload.started_by_id = ctx.actor.id;
          updatePayload.started_by_name = actorName;
        }
        const newEntry: TaskStatusHistoryEntry = {
          action: 'started',
          fromStatus: currentStatus as string,
          toStatus: 'in_progress',
          timestamp: now,
          actorId: ctx.actor.id,
          actorName,
          note: 'Bắt đầu triển khai thực hiện công việc',
        };
        updatePayload.status_history = [...prevHistory, newEntry];
      }
    } else {
      const newEntry: TaskStatusHistoryEntry = {
        action: 'updated',
        fromStatus: currentStatus as string,
        toStatus: targetStatus,
        timestamp: now,
        actorId: ctx.actor.id,
        actorName,
        note: `Chuyển trạng thái sang ${targetStatus}`,
      };
      updatePayload.status_history = [...prevHistory, newEntry];
    }

    const { error: updateError } = await db
      .from('interior_scheduled_events')
      .update(updatePayload)
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SCHEDULE_UPDATE_FAILED', detail: updateError.message },
        { status: 503 },
      );
    }

    const weekStartStr = existing.scheduled_week_start as string;
    const weekStart = new Date(weekStartStr);

    const [{ data: rows }, { data: projectData }, { data: userRoleData }] = await Promise.all([
      db
        .from('interior_scheduled_events')
        .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes, created_at, created_by_name, started_at, started_by_name, completed_at, completed_by_name, status_history')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .eq('scheduled_week_start', weekStartStr)
        .order('day_index', { ascending: true }),
      db
        .from('interior_projects')
        .select('id, code, name, status, target_completion_date, lead_architect_name')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('interior_user_roles')
        .select('user_id, role_key, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE'),
    ]);

    const overview = buildOverview(
      (rows ?? []) as ScheduleEventRow[],
      ctx.tenantId,
      weekStart,
      (projectData ?? []) as ProjectRow[],
      (userRoleData ?? []) as UserRoleInfo[],
    );
    return NextResponse.json({ success: true, data: { overview } });
  } catch (err) {
    console.error('[schedule/PATCH] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_UPDATE_FAILED' }, { status: 503 });
  }
}

// ════════════════════════════════════════════════════════════════
// DELETE — remove a scheduled event
// ════════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveInteriorContext(request);
  if (!ctx.ok) return ctx.response;

  const db = ctx.supabase as unknown as SupabaseClient;

  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ success: false, error: 'MISSING_TASK_ID' }, { status: 400 });
  }

  try {
    // Verify ownership
    const { data: existing } = await db
      .from('interior_scheduled_events')
      .select('id, scheduled_week_start, tenant_id')
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'TASK_NOT_FOUND' }, { status: 404 });
    }

    const weekStartStr = existing.scheduled_week_start as string;

    const { error: deleteError } = await db
      .from('interior_scheduled_events')
      .delete()
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SCHEDULE_DELETE_FAILED', detail: deleteError.message },
        { status: 503 },
      );
    }

    const weekStart = new Date(weekStartStr);
    const [{ data: rows }, { data: projectData }, { data: userRoleData }] = await Promise.all([
      db
        .from('interior_scheduled_events')
        .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes, created_at, created_by_name, started_at, started_by_name, completed_at, completed_by_name, status_history')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .eq('scheduled_week_start', weekStartStr)
        .order('day_index', { ascending: true }),
      db
        .from('interior_projects')
        .select('id, code, name, status, target_completion_date, lead_architect_name')
        .eq('tenant_id', ctx.tenantId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('interior_user_roles')
        .select('user_id, role_key, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE'),
    ]);

    const overview = buildOverview(
      (rows ?? []) as ScheduleEventRow[],
      ctx.tenantId,
      weekStart,
      (projectData ?? []) as ProjectRow[],
      (userRoleData ?? []) as UserRoleInfo[],
    );
    return NextResponse.json({ success: true, data: { overview } });
  } catch (err) {
    console.error('[schedule/DELETE] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_DELETE_FAILED' }, { status: 503 });
  }
}
