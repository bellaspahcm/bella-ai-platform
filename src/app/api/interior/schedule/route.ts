import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInteriorContext } from '@/products/bella-interior/lib/server-context';

import type {
  ScheduleOverviewResponse,
  ScheduledCalendarEvent,
  ScheduleTaskCategory,
  WeeklyTimeSlot,
  CalendarDayColumn,
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

function getCategoryStyle(cat: ScheduleTaskCategory): CategoryStyle {
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
      const style = getCategoryStyle(cat);
      return {
        id: r.id,
        title: r.title,
        projectName: r.project_name,
        assignee: r.assignee_name,
        dayIndex: r.day_index,
        timeSlotId: r.time_slot_id,
        category: cat,
        categoryLabel: style.label,
        badgeBgClass: style.badgeBgClass,
        badgeBorderClass: style.badgeBorderClass,
        textColorClass: style.textColorClass,
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

  const upcoming = rows
    .filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
    .slice(0, 4)
    .map((r) => {
      const cat = r.category as ScheduleTaskCategory;
      const style = getCategoryStyle(cat);
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
      };
    });

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
    projectProgress: [],
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

  const db = ctx.supabase as unknown as SupabaseClient;

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
      .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes')
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

    const rows: ScheduleEventRow[] = (data ?? []) as ScheduleEventRow[];
    const overview = buildOverview(rows, ctx.tenantId, weekStart);

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
      });

    if (insertError) {
      console.error('[schedule/POST] insert error:', insertError.message);
      return NextResponse.json(
        { success: false, error: 'INTERIOR_SCHEDULE_CREATE_FAILED', detail: insertError.message },
        { status: 503 },
      );
    }

    // Return updated overview
    const { data: rows } = await db
      .from('interior_scheduled_events')
      .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes')
      .eq('tenant_id', ctx.tenantId)
      .neq('status', 'cancelled')
      .eq('scheduled_week_start', weekStartStr)
      .order('day_index', { ascending: true });

    const overview = buildOverview((rows ?? []) as ScheduleEventRow[], ctx.tenantId, weekStart);
    return NextResponse.json({ success: true, data: { overview } }, { status: 201 });
  } catch (err) {
    console.error('[schedule/POST] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_CREATE_FAILED' }, { status: 503 });
  }
}

// ════════════════════════════════════════════════════════════════
// PATCH — mark a task completed
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
      .select('id, scheduled_week_start, tenant_id')
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'TASK_NOT_FOUND' }, { status: 404 });
    }

    const { error: updateError } = await db
      .from('interior_scheduled_events')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
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

    const { data: rows } = await db
      .from('interior_scheduled_events')
      .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes')
      .eq('tenant_id', ctx.tenantId)
      .neq('status', 'cancelled')
      .eq('scheduled_week_start', weekStartStr)
      .order('day_index', { ascending: true });

    const overview = buildOverview((rows ?? []) as ScheduleEventRow[], ctx.tenantId, weekStart);
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
    const { data: rows } = await db
      .from('interior_scheduled_events')
      .select('id, project_name, title, category, status, assignee_name, day_index, time_slot_id, priority, scheduled_week_start, notes')
      .eq('tenant_id', ctx.tenantId)
      .neq('status', 'cancelled')
      .eq('scheduled_week_start', weekStartStr)
      .order('day_index', { ascending: true });

    const overview = buildOverview((rows ?? []) as ScheduleEventRow[], ctx.tenantId, weekStart);
    return NextResponse.json({ success: true, data: { overview } });
  } catch (err) {
    console.error('[schedule/DELETE] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'INTERIOR_SCHEDULE_DELETE_FAILED' }, { status: 503 });
  }
}
