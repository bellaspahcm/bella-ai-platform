'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';

const supabase = createClient();
const SCHEDULE_STORAGE_KEY = 'bella_interior_schedule_data_v1';

async function getAuthToken(): Promise<string | undefined> {
  const { data: authData } = await supabase.auth.getSession();
  let token = authData?.session?.access_token;
  if (!token && process.env.NODE_ENV === 'development') {
    try {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: 'demo.interior@bellaspa.vn',
        password: 'password123',
      });
      token = signInData?.session?.access_token;
    } catch {
      // silent
    }
  }
  return token;
}
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Plus,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  CalendarDays,
  GanttChartSquare,
  Users,
  Lightbulb,
  Info,
  X,
  Trash2,
  Check,
  Building,
  User,
  RotateCcw,
  Mail,
  FolderKanban,
  Sparkles,
  FileText,
  History,
  UserCheck,
  Timer,
} from 'lucide-react';
import InteriorUserBar from '@/components/interior/InteriorUserBar';

import type {
  ScheduleOverviewResponse,
  ScheduledCalendarEvent,
  ScheduleTaskCategory,
} from '@/products/bella-interior/domain/schedule-overview.types';

// Fallback skeleton — counts zeroed so real API data is never masked
const INITIAL_SCHEDULE_OVERVIEW: ScheduleOverviewResponse = {
  success: true,
  tenantId: '',
  weekRangeLabel: '...',
  kpis: {
    totalTasks: {
      value: 0,
      label: 'Tổng công việc',
      trend: '↑ 0%',
      isPositiveTrend: true,
    },
    completedTasks: {
      value: 0,
      label: 'Đã hoàn thành',
      trend: '↑ 0%',
      isPositiveTrend: true,
    },
    inProgressTasks: {
      value: 0,
      label: 'Đang thực hiện',
      trend: '→ 0%',
      isPositiveTrend: true,
    },
    overdueTasks: {
      value: 0,
      label: 'Quá hạn',
      trend: '→ 0%',
      isPositiveTrend: true,
    },
  },
  timeSlots: [
    { slotId: 'slot-1', timeRange: '08:00 - 10:00' },
    { slotId: 'slot-2', timeRange: '10:00 - 12:00' },
    { slotId: 'slot-3', timeRange: '13:30 - 15:30' },
    { slotId: 'slot-4', timeRange: '15:30 - 17:30' },
  ],
  days: [
    { dayOfWeek: 'Thứ 3', dateFormatted: '03/11', fullDate: '2026-11-03', isToday: true },
    { dayOfWeek: 'Thứ 4', dateFormatted: '04/11', fullDate: '2026-11-04', isToday: false },
    { dayOfWeek: 'Thứ 5', dateFormatted: '05/11', fullDate: '2026-11-05', isToday: false },
    { dayOfWeek: 'Thứ 6', dateFormatted: '06/11', fullDate: '2026-11-06', isToday: false },
    { dayOfWeek: 'Thứ 7', dateFormatted: '07/11', fullDate: '2026-11-07', isToday: false },
    { dayOfWeek: 'CN', dateFormatted: '08/11', fullDate: '2026-11-08', isToday: false },
    { dayOfWeek: 'Thứ 2', dateFormatted: '09/11', fullDate: '2026-11-09', isToday: false },
  ],
  calendarEvents: [],
  attentionAlerts: [],
  resourceCapacity: {
    readinessPercentage: 0,
    readinessLabel: 'Sẵn sàng làm việc',
    workingCount: 0,
    availableCount: 0,
    overloadedCount: 0,
    unassignedCount: 0,
  },
  upcomingTasks: [],
  projectProgress: [],
  actionSuggestions: {
    title: 'Gợi ý hành động',
    items: [],
  },
};

// Canonical Project list for Task creation
const CANONICAL_PROJECTS = [
  'Villa Sunrise',
  'Office Tower',
  'Skyline Residence',
  'Tủ bếp & Nội thất rời',
  'Duplex Aqua Bay',
  'The Garden Villa',
  'Penthouse Metropolis',
];

// Canonical Assignees
const CANONICAL_ASSIGNEES = [
  'KTS. Hoàng Long (Thiết kế)',
  'KTS. Lê Hoàng (Bản vẽ)',
  'PM. Mai (Quản lý dự án)',
  'QĐ. Tuấn (Sản xuất)',
  'PM. Hùng (Nghiệm thu)',
  'Đội 1 (Lắp đặt)',
  'Đội 2 (Thi công)',
  'Đội 3 (Hoàn thiện)',
];

// Helper to format ISO timestamp for audit log
function formatTimestamp(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ngày ${day}/${month}/${year}`;
  } catch {
    return isoStr;
  }
}

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleOverviewResponse>(INITIAL_SCHEDULE_OVERVIEW);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'week' | 'month' | 'timeline' | 'resource'>('week');
  const [timelineViewMode, setTimelineViewMode] = useState<'daily' | 'stages'>('daily');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Modal State: Create Task
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formProject, setFormProject] = useState(CANONICAL_PROJECTS[0]);
  const [formAssignee, setFormAssignee] = useState(CANONICAL_ASSIGNEES[0]);
  const [formCategory, setFormCategory] = useState<ScheduleTaskCategory>('design');
  const [formDayIndex, setFormDayIndex] = useState<number>(0);
  const [formTimeSlotId, setFormTimeSlotId] = useState<string>('slot-1');
  const [formPriority, setFormPriority] = useState<'normal' | 'urgent'>('normal');
  const [formNotes, setFormNotes] = useState('');

  // Modal State: Task Details
  const [selectedTask, setSelectedTask] = useState<ScheduledCalendarEvent | null>(null);
  const [isDetailActionLoading, setIsDetailActionLoading] = useState(false);

  // Modal State: Attention Alerts Task List
  const [attentionModalFilter, setAttentionModalFilter] = useState<'all' | 'overdue' | 'urgent' | null>(null);

  // Filtered tasks for Attention Alerts Modal
  const todayCol = data?.days ? data.days.findIndex((d) => d.isToday) : -1;
  const attentionFilteredTasks = (data?.calendarEvents ?? []).filter((ev) => {
    const isOverdue =
      ev.status === 'overdue' ||
      (todayCol !== -1 && ev.dayIndex < todayCol && ev.status !== 'completed');
    const isUrgent = ev.priority === 'urgent' && ev.status !== 'completed';

    if (attentionModalFilter === 'overdue') return isOverdue;
    if (attentionModalFilter === 'urgent') return isUrgent;
    if (attentionModalFilter === 'all') return isOverdue || isUrgent || ev.status !== 'completed';
    return false;
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ── Persist to / restore from localStorage ─────────────────────────────
  const saveToStorage = useCallback((overview: ScheduleOverviewResponse) => {
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(overview));
    } catch {
      // storage unavailable
    }
  }, []);

  const setDataAndPersist = useCallback(
    (overview: ScheduleOverviewResponse) => {
      setData(overview);
      saveToStorage(overview);
    },
    [saveToStorage],
  );

  // Restore from localStorage immediately on mount (no flicker on refresh)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ScheduleOverviewResponse;
        if (parsed && parsed.kpis) {
          setData(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Fetch schedule from API ───────────────────────────────────────────
  const fetchSchedule = useCallback(
    async (offset: number) => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/interior/schedule?weekOffset=${offset}`, { headers });
        if (res.ok) {
          const json = await res.json() as { success: boolean; data?: { overview?: ScheduleOverviewResponse } };
          if (json.success && json.data?.overview?.kpis) {
            setDataAndPersist(json.data.overview);
          }
        }
      } catch {
        // Retain cached/initial state
      } finally {
        setIsLoading(false);
      }
    },
    [setDataAndPersist],
  );

  // Fetch on mount + whenever weekOffset changes
  useEffect(() => {
    void fetchSchedule(weekOffset);
  }, [weekOffset, fetchSchedule]);

  // Open create modal with pre-selected cell
  const handleOpenCreateWithSlot = (dayIdx: number, slotId: string) => {
    setFormDayIndex(dayIdx);
    setFormTimeSlotId(slotId);
    setFormTitle('');
    setFormNotes('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Submit task creation to API
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setCreateError('Vui lòng nhập tên công việc');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        title: formTitle.trim(),
        projectName: formProject,
        assignee: formAssignee.split(' (')[0],
        category: formCategory,
        dayIndex: formDayIndex,
        timeSlotId: formTimeSlotId,
        priority: formPriority,
        notes: formNotes.trim() || undefined,
        weekOffset,
      };

      const res = await fetch('/api/interior/schedule', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(errJson.message || 'Không thể tạo công việc');
      }

      const resJson = await res.json() as { success: boolean; data?: { overview?: ScheduleOverviewResponse } };
      if (resJson.success && resJson.data?.overview?.kpis) {
        setDataAndPersist(resJson.data.overview);
      }

      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormNotes('');
      setToastMessage(`✅ Đã tạo và điều phối công việc "${payload.title}" thành công!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi hệ thống';
      setCreateError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark task completed or reopen
  const handleToggleTaskStatus = async (targetStatus?: 'completed' | 'in_progress') => {
    if (!selectedTask) return;
    setIsDetailActionLoading(true);

    const isCurrentCompleted = selectedTask.status === 'completed';
    const nextStatus: 'completed' | 'in_progress' =
      targetStatus || (isCurrentCompleted ? 'in_progress' : 'completed');

    // Optimistic UI update immediately
    const updatedEvents = data.calendarEvents.map((evt) =>
      evt.id === selectedTask.id
        ? {
            ...evt,
            status: nextStatus,
            badgeBgClass:
              nextStatus === 'completed'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/50'
                : evt.category === 'workshop'
                ? 'bg-purple-50/90 dark:bg-purple-950/40'
                : evt.category === 'site'
                ? 'bg-sky-50/90 dark:bg-sky-950/40'
                : evt.category === 'handover'
                ? 'bg-teal-50/90 dark:bg-teal-950/40'
                : 'bg-blue-50/90 dark:bg-blue-950/40',
            badgeBorderClass:
              nextStatus === 'completed'
                ? 'border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-800'
                : evt.category === 'workshop'
                ? 'border-l-4 border-l-purple-500 border-purple-100 dark:border-purple-800'
                : evt.category === 'site'
                ? 'border-l-4 border-l-sky-500 border-sky-100 dark:border-sky-800'
                : evt.category === 'handover'
                ? 'border-l-4 border-l-teal-500 border-teal-100 dark:border-teal-800'
                : 'border-l-4 border-l-blue-500 border-blue-100 dark:border-blue-800',
            textColorClass:
              nextStatus === 'completed'
                ? 'text-emerald-900 dark:text-emerald-200'
                : evt.category === 'workshop'
                ? 'text-purple-900 dark:text-purple-200'
                : evt.category === 'site'
                ? 'text-sky-900 dark:text-sky-200'
                : evt.category === 'handover'
                ? 'text-teal-900 dark:text-teal-200'
                : 'text-blue-900 dark:text-blue-200',
          }
        : evt,
    );

    setSelectedTask((prev) => (prev ? { ...prev, status: nextStatus } : null));
    setDataAndPersist({
      ...data,
      calendarEvents: updatedEvents,
      kpis: {
        ...data.kpis,
        completedTasks: {
          ...data.kpis.completedTasks,
          value:
            nextStatus === 'completed'
              ? data.kpis.completedTasks.value + 1
              : Math.max(0, data.kpis.completedTasks.value - 1),
        },
      },
    });

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/interior/schedule', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ taskId: selectedTask.id, status: nextStatus }),
      });

      if (res.ok) {
        const resJson = (await res.json()) as { success: boolean; data?: { overview?: ScheduleOverviewResponse } };
        if (resJson.success && resJson.data?.overview?.kpis) {
          setDataAndPersist(resJson.data.overview);
        }
      }

      setToastMessage(
        nextStatus === 'completed'
          ? `✅ Đã hoàn thành công việc "${selectedTask.title}"!`
          : `🔄 Đã mở lại công việc "${selectedTask.title}"!`,
      );
      setSelectedTask(null);
    } catch {
      setToastMessage('❌ Không thể cập nhật trạng thái');
    } finally {
      setIsDetailActionLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setIsDetailActionLoading(true);

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/interior/schedule?taskId=${encodeURIComponent(selectedTask.id)}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        const resJson = await res.json() as { success: boolean; data?: { overview?: ScheduleOverviewResponse } };
        if (resJson.success && resJson.data?.overview?.kpis) {
          setDataAndPersist(resJson.data.overview);
        }
      }

      setToastMessage(`🗑️ Đã xóa công việc "${selectedTask.title}" khỏi lịch.`);
      setSelectedTask(null);
    } catch {
      setToastMessage('❌ Không thể xóa công việc');
    } finally {
      setIsDetailActionLoading(false);
    }
  };

  // Week range label comes from API; fallback to computed value
  const computeWeekRangeLabel = (_offset: number) => {
    return data.weekRangeLabel || '...';
  };

  const handleGoToToday = () => {
    setWeekOffset(0);
    void fetchSchedule(0);
    const today = new Date();
    const dayStr = String(today.getDate()).padStart(2, '0');
    const monthStr = String(today.getMonth() + 1).padStart(2, '0');
    const yearStr = today.getFullYear();
    setToastMessage(`📅 Đã chuyển về tuần hiện tại (Hôm nay: ${dayStr}/${monthStr}/${yearStr})`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Toast Notification Banner ─── */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl border border-slate-700/50 dark:border-slate-200 animate-in fade-in slide-in-from-top-4 duration-200 text-xs sm:text-sm font-semibold">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Top Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/interior"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Tổng quan
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Lịch công việc &amp; Điều phối
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Theo dõi lịch làm việc, phân công nhiệm vụ và kiểm soát tiến độ thực hiện
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Top user profile header */}
          <InteriorUserBar />

          <button
            type="button"
            onClick={() => {
              setFormTitle('');
              setFormNotes('');
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Tạo công việc mới
          </button>
        </div>
      </div>

      {/* ─── Row 1: 4 KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng công việc */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {data.kpis.totalTasks.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {data.kpis.totalTasks.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {data.kpis.totalTasks.label}
            </div>
          </div>
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12 L 100 24 L 0 24 Z"
                fill="url(#blue-kpi-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 18 Q 20 8, 40 16 T 80 8 T 100 12"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="blue-kpi-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 2: Đã hoàn thành */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {data.kpis.completedTasks.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {data.kpis.completedTasks.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {data.kpis.completedTasks.label}
            </div>
          </div>
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 19 Q 25 10, 50 14 T 100 6 L 100 24 L 0 24 Z"
                fill="url(#green-kpi-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 19 Q 25 10, 50 14 T 100 6"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="green-kpi-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 3: Đang thực hiện */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {data.kpis.inProgressTasks.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {data.kpis.inProgressTasks.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {data.kpis.inProgressTasks.label}
            </div>
          </div>
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 16 Q 30 18, 55 10 T 100 8 L 100 24 L 0 24 Z"
                fill="url(#amber-kpi-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 16 Q 30 18, 55 10 T 100 8"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="amber-kpi-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* KPI 4: Quá hạn */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {data.kpis.overdueTasks.trend}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {data.kpis.overdueTasks.value}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {data.kpis.overdueTasks.label}
            </div>
          </div>
          <div className="mt-3 h-6 w-full">
            <svg viewBox="0 0 100 24" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0 17 Q 35 15, 60 7 T 100 11 L 100 24 L 0 24 Z"
                fill="url(#rose-kpi-gradient)"
                opacity="0.3"
              />
              <path
                d="M0 17 Q 35 15, 60 7 T 100 11"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="rose-kpi-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Row 2: Weekly Schedule Matrix &amp; Attention Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Weekly Matrix Control Area (Col 9) */}
        <div className="lg:col-span-9 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs flex flex-col justify-between">
          {/* Schedule Navigation Bar */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* View Switchers */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('week')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'week'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Lịch tuần
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Lịch tháng
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GanttChartSquare className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('resource')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resource'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Nguồn lực
              </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Tuần trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{computeWeekRangeLabel(weekOffset)}</span>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Tuần sau"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleGoToToday}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  Đang tải...
                </span>
              )}
            </div>
          </div>

          {/* ─── TAB 1: WEEK MATRIX VIEW ─── */}
          {activeTab === 'week' && (
            <div className="overflow-x-auto flex-1 flex flex-col">
              <table className="w-full border-collapse text-left text-xs min-w-[950px] h-full">
                <thead className="whitespace-nowrap">
                  <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    <th className="py-2.5 px-3 text-center font-bold text-[11px] w-28 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                      Thời gian
                    </th>
                    {data.days.map((day) => (
                      <th
                        key={day.fullDate}
                        className={`py-2 px-2 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 whitespace-nowrap min-w-[120px] transition-colors ${
                          day.isToday ? 'bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-inset ring-orange-400/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-bold text-xs whitespace-nowrap ${day.isToday ? 'text-orange-600 dark:text-orange-400 font-extrabold' : 'text-slate-900 dark:text-white'}`}>
                            {day.dayOfWeek}
                          </span>
                          {day.isToday && (
                            <span className="text-[9px] px-1 py-0.2 rounded-md bg-orange-500 text-white font-extrabold tracking-tight">
                              Hôm nay
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 whitespace-nowrap ${day.isToday ? 'text-orange-500 font-bold' : 'text-slate-400'}`}>
                          {day.dateFormatted}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.timeSlots.map((slot) => (
                    <tr key={slot.slotId} className="h-[68px]">
                      {/* Time Column */}
                      <td className="py-1.5 px-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-850/30 border-r border-slate-100 dark:border-slate-800 align-middle whitespace-nowrap">
                        {slot.timeRange}
                      </td>

                      {/* Day Cells (0 to 6) */}
                      {data.days.map((day, dayIdx) => {
                        const eventsInSlot = data.calendarEvents.filter(
                          (e) => e.dayIndex === dayIdx && e.timeSlotId === slot.slotId,
                        );

                        return (
                          <td
                            key={day.fullDate}
                            className={`py-1 px-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 align-top relative group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                              day.isToday ? 'bg-orange-50/25 dark:bg-orange-950/10' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              {eventsInSlot.map((eventInSlot) => {
                                const isCompleted = eventInSlot.status === 'completed';
                                const isUrgent = eventInSlot.priority === 'urgent';
                                return (
                                  <button
                                    key={eventInSlot.id}
                                    type="button"
                                    onClick={() => setSelectedTask(eventInSlot)}
                                    className={`w-full text-left p-2 rounded-lg border text-[11px] font-medium leading-snug shadow-2xs ${
                                      isCompleted
                                        ? 'bg-emerald-50/95 dark:bg-emerald-950/50 border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                        : isUrgent
                                        ? 'bg-rose-50/95 dark:bg-rose-950/40 border-l-4 border-l-rose-500 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200 ring-1 ring-rose-400/50'
                                        : `${eventInSlot.badgeBgClass} ${eventInSlot.badgeBorderClass} ${eventInSlot.textColorClass}`
                                    } transition-transform hover:scale-[1.02] cursor-pointer block relative`}
                                  >
                                    <div className="flex items-center justify-between gap-1 font-bold">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {isCompleted ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        ) : isUrgent ? (
                                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 animate-bounce" />
                                        ) : (
                                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block shrink-0" />
                                        )}
                                        <span className={`truncate ${isCompleted ? 'line-through opacity-80' : ''} ${isUrgent && !isCompleted ? 'text-rose-700 dark:text-rose-300 font-extrabold' : ''}`}>
                                          {eventInSlot.title}
                                        </span>
                                      </div>
                                      {isCompleted ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-extrabold shrink-0">
                                          Xong
                                        </span>
                                      ) : isUrgent ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold shrink-0 flex items-center gap-0.5 shadow-2xs animate-pulse">
                                          🔥 Khẩn
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-[10px] opacity-90 truncate mt-0.5 font-semibold">
                                      {eventInSlot.projectName}
                                    </div>
                                    <div className="text-[9px] opacity-75 truncate mt-0.5 font-mono">
                                      ({eventInSlot.assignee})
                                    </div>
                                  </button>
                                );
                              })}

                              {/* Hover + Quick Add Button in Empty or Populated Cell */}
                              {eventsInSlot.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreateWithSlot(dayIdx, slot.slotId)}
                                  className="w-full h-12 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-700/60 hover:bg-orange-50/30 dark:hover:bg-orange-950/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                  title={`Thêm công việc vào ${day.dayOfWeek} (${slot.timeRange})`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── TAB 2: MONTH VIEW ─── */}
          {activeTab === 'month' && (
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span>Thứ 2</span>
                <span>Thứ 3</span>
                <span>Thứ 4</span>
                <span>Thứ 5</span>
                <span>Thứ 6</span>
                <span>Thứ 7</span>
                <span>Chủ nhật</span>
              </div>
              <div className="grid grid-cols-7 gap-2 flex-1">
                {(() => {
                  const today = new Date();
                  const currentYear = today.getFullYear();
                  const currentMonth = today.getMonth(); // 0-based
                  const todayDateNum = today.getDate();

                  // 1st of month: get day of week (0=Sun, 1=Mon, ..., 6=Sat)
                  // Grid columns start on Monday (Thứ 2 = 0)
                  const firstDay = new Date(currentYear, currentMonth, 1);
                  const leadingPaddingCount = (firstDay.getDay() + 6) % 7;

                  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

                  const totalCellsNeeded = Math.ceil((leadingPaddingCount + daysInCurrentMonth) / 7) * 7;
                  const trailingPaddingCount = totalCellsNeeded - (leadingPaddingCount + daysInCurrentMonth);

                  // Map task counts by day of month from current calendarEvents
                  const eventsByDayNum = new Map<number, ScheduledCalendarEvent[]>();
                  for (const ev of data.calendarEvents) {
                    const dayCol = data.days[ev.dayIndex];
                    if (dayCol?.fullDate) {
                      const parts = dayCol.fullDate.split('-');
                      if (parts.length === 3) {
                        const evYear = parseInt(parts[0], 10);
                        const evMonth = parseInt(parts[1], 10) - 1;
                        const evDay = parseInt(parts[2], 10);
                        if (evYear === currentYear && evMonth === currentMonth) {
                          const list = eventsByDayNum.get(evDay) || [];
                          list.push(ev);
                          eventsByDayNum.set(evDay, list);
                        }
                      }
                    }
                  }

                  const elements: React.ReactNode[] = [];

                  // 1. Previous month padding cells (muted)
                  for (let p = 0; p < leadingPaddingCount; p++) {
                    const prevDayNum = daysInPrevMonth - leadingPaddingCount + p + 1;
                    elements.push(
                      <div
                        key={`prev-${p}`}
                        className="min-h-[64px] p-2 rounded-xl border border-dashed border-slate-200/50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/30 text-xs text-slate-300 dark:text-slate-600 select-none cursor-default"
                      >
                        <span>{prevDayNum}</span>
                      </div>,
                    );
                  }

                  // 2. Current month active cells
                  for (let d = 1; d <= daysInCurrentMonth; d++) {
                    const isCurrent = d === todayDateNum;
                    const dayEvents = eventsByDayNum.get(d) || [];
                    const taskCount = dayEvents.length;

                    elements.push(
                      <div
                        key={`curr-${d}`}
                        onClick={() => {
                          const matchedDayIndex = data.days.findIndex((col) => {
                            const p = col.fullDate.split('-');
                            return p.length === 3 && parseInt(p[2], 10) === d;
                          });
                          if (matchedDayIndex !== -1) {
                            setFormDayIndex(matchedDayIndex);
                          }
                          setIsCreateModalOpen(true);
                        }}
                        className={`min-h-[64px] p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                          isCurrent
                            ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-bold ring-1 ring-orange-400/50 shadow-xs'
                            : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{d}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500 text-white font-bold">
                              Hôm nay
                            </span>
                          )}
                        </div>
                        {taskCount > 0 && (
                          <div className="mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                            • {taskCount} việc
                          </div>
                        )}
                      </div>,
                    );
                  }

                  // 3. Next month trailing padding cells (muted)
                  for (let t = 0; t < trailingPaddingCount; t++) {
                    const nextDayNum = t + 1;
                    elements.push(
                      <div
                        key={`next-${t}`}
                        className="min-h-[64px] p-2 rounded-xl border border-dashed border-slate-200/50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/30 text-xs text-slate-300 dark:text-slate-600 select-none cursor-default"
                      >
                        <span>{nextDayNum}</span>
                      </div>,
                    );
                  }

                  return elements;
                })()}
              </div>
            </div>
          )}

          {/* ─── TAB 3: TIMELINE (GANTT TRACKER) ─── */}
          {activeTab === 'timeline' && (
            <div className="p-4 flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GanttChartSquare className="w-4 h-4 text-blue-600" />
                    Tiến độ thực hiện theo giai đoạn dự án (Gantt Tracker)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Theo dõi tiến độ theo 4 giai đoạn chuẩn (Thiết kế → Sản xuất → Lắp đặt → Nghiệm thu) hoặc theo lịch làm việc chi tiết hàng ngày
                  </p>
                </div>

                {/* Sub-view switcher */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode('daily')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      timelineViewMode === 'daily'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    📅 Theo Ngày (Tuần này)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode('stages')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      timelineViewMode === 'stages'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    📊 4 Giai đoạn Dự án
                  </button>
                </div>
              </div>

              {/* View 1: Timeline Theo Ngày (Daily View - Ma trận 7 ngày theo Dự án) */}
              {timelineViewMode === 'daily' && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                        <th className="py-2.5 px-3 font-bold text-[11px] w-52 border-r border-slate-100 dark:border-slate-800">
                          Dự án &amp; Người phụ trách
                        </th>
                        {data.days.map((day) => (
                          <th
                            key={day.fullDate}
                            className={`py-2 px-2 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 min-w-[110px] ${
                              day.isToday ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''
                            }`}
                          >
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {day.dayOfWeek}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {day.dateFormatted}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.projectProgress.map((proj) => {
                        // Find events for this project
                        const projectEvents = data.calendarEvents.filter((e) => {
                          const eName = e.projectName?.trim().toLowerCase();
                          const pName = proj.projectName?.trim().toLowerCase();
                          if (!eName || !pName) return false;
                          return eName === pName || eName.includes(pName) || pName.includes(eName);
                        });

                        return (
                          <tr key={proj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
                            <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 align-top">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[190px]">
                                {proj.projectName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {proj.projectCode || proj.leadArchitect || 'KTS. Trưởng'}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${proj.statusBadgeClass}`}>
                                  {proj.statusLabel}
                                </span>
                                {projectEvents.length > 0 && (
                                  <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    {projectEvents.length} việc tuần này
                                  </span>
                                )}
                              </div>
                            </td>

                            {data.days.map((day, dayIdx) => {
                              const dayEvents = projectEvents.filter((e) => e.dayIndex === dayIdx);
                              return (
                                <td
                                  key={day.fullDate}
                                  className={`py-2 px-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 align-top ${
                                    day.isToday ? 'bg-orange-50/20 dark:bg-orange-950/10' : ''
                                  }`}
                                >
                                  {dayEvents.length > 0 ? (
                                    <div className="space-y-1">
                                      {dayEvents.map((e) => {
                                        const isComp = e.status === 'completed';
                                        const isUrgent = e.priority === 'urgent';
                                        return (
                                          <button
                                            key={e.id}
                                            type="button"
                                            onClick={() => setSelectedTask(e)}
                                            className={`w-full text-left p-1.5 rounded-lg border text-[10px] font-medium leading-snug cursor-pointer transition-transform hover:scale-[1.02] ${
                                              isComp
                                                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                : isUrgent
                                                ? 'bg-rose-50/90 border-l-2 border-l-rose-500 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                                                : `${e.badgeBgClass} ${e.badgeBorderClass} ${e.textColorClass}`
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-1 font-bold">
                                              <div className="flex items-center gap-1 min-w-0">
                                                {isComp ? (
                                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                                ) : isUrgent ? (
                                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                                ) : null}
                                                <span className={`truncate ${isComp ? 'line-through' : ''} ${isUrgent && !isComp ? 'text-rose-700 dark:text-rose-300 font-extrabold' : ''}`}>{e.title}</span>
                                              </div>
                                              {isUrgent && !isComp && (
                                                <span className="text-[8px] px-1 py-0.2 rounded bg-rose-600 text-white font-extrabold shrink-0">
                                                  Khẩn
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[9px] opacity-75 truncate font-mono">
                                              {e.assignee}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="h-10 flex items-center justify-center text-slate-300 dark:text-slate-700 text-[10px]">
                                      —
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* View 2: Timeline Theo 4 Giai đoạn Dự án (Stages Gantt) */}
              {timelineViewMode === 'stages' && (
                <div className="space-y-4">
                  {data.projectProgress.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3"
                    >
                      {/* Project Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {proj.projectName}
                            </span>
                            {proj.projectCode && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                {proj.projectCode}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Chủ nhiệm: <span className="font-semibold text-slate-700 dark:text-slate-300">{proj.leadArchitect || 'KTS. Nguyễn Kiến Trúc'}</span> • Giai đoạn: <span className="font-semibold text-blue-600 dark:text-blue-400">{proj.currentStage || 'Thi công'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${proj.statusBadgeClass}`}>
                            {proj.statusLabel} ({proj.progressPercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Overall Progress Bar */}
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${proj.progressBarClass}`}
                          style={{ width: `${proj.progressPercent}%` }}
                        />
                      </div>

                      {/* 4-Stage Gantt Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                        {(proj.stages || [
                          { stageKey: 'design', stageLabel: '1. Khảo sát & Bản vẽ 3D', startDate: 'Tuần 1 - 3', endDate: 'Đã hoàn tất', progressPercent: 100, status: 'completed', colorClass: 'bg-blue-500' },
                          { stageKey: 'workshop', stageLabel: '2. Sản xuất gia công mộc', startDate: 'Tuần 4 - 7', endDate: 'Đang gia công', progressPercent: 75, status: 'in_progress', colorClass: 'bg-purple-500' },
                          { stageKey: 'site', stageLabel: '3. Lắp đặt hoàn thiện', startDate: 'Tuần 8 - 10', endDate: 'Chuẩn bị mặt bằng', progressPercent: 20, status: 'pending', colorClass: 'bg-sky-500' },
                          { stageKey: 'handover', stageLabel: '4. Nghiệm thu & Bàn giao', startDate: 'Tuần 11 - 12', endDate: 'Dự kiến 31/12', progressPercent: 0, status: 'pending', colorClass: 'bg-teal-500' },
                        ]).map((stg) => (
                          <div
                            key={stg.stageKey}
                            className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-slate-800 dark:text-slate-200 truncate">
                                {stg.stageLabel}
                              </span>
                              <span className="text-slate-500 font-mono text-[10px]">
                                {stg.progressPercent}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  stg.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : stg.status === 'in_progress'
                                    ? stg.colorClass
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                style={{ width: `${stg.progressPercent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                              <span>{stg.startDate}</span>
                              <span className="truncate">{stg.endDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <span>Bắt đầu: {proj.startDate || '01/10/2026'}</span>
                        <span>Mục tiêu hoàn thành: {proj.targetEndDate || '31/12/2026'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 4: RESOURCE VIEW ─── */}
          {activeTab === 'resource' && (
            <div className="p-4 flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Bảng phân bổ tải công việc nhân sự (Resource Allocation Matrix)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Phân tích tải công việc thực tế dựa trên các task được điều phối trong tuần, phân biệt tài khoản nhân sự công ty và đội thợ xưởng
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Tối ưu (&lt; 90%)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Quá tải (&gt;= 90%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(data.staffResources || [
                  { id: '1', name: 'KTS. Hoàng Long', roleLabel: 'Kiến trúc sư trưởng', taskCount: 2, loadPercent: 50, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: true },
                  { id: '2', name: 'KTS. Lê Hoàng', roleLabel: 'KTS Bản vẽ triển khai', taskCount: 1, loadPercent: 25, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: true },
                  { id: '3', name: 'PM. Mai', roleLabel: 'Quản lý dự án (PM)', taskCount: 3, loadPercent: 75, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: true },
                  { id: '4', name: 'QĐ. Tuấn', roleLabel: 'Quản đốc sản xuất xưởng', taskCount: 2, loadPercent: 50, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: false },
                  { id: '5', name: 'PM. Hùng', roleLabel: 'Giám sát kỹ thuật & Nghiệm thu', taskCount: 1, loadPercent: 25, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: true },
                  { id: '6', name: 'Đội 1', roleLabel: 'Đội thi công & Lắp đặt công trình', taskCount: 3, loadPercent: 75, isOverloaded: false, statusLabel: 'Bình thường', isRealUser: false },
                  { id: '7', name: 'Đội 2', roleLabel: 'Đội hoàn thiện sơn bả & thạch cao', taskCount: 0, loadPercent: 0, isOverloaded: false, statusLabel: 'Sẵn sàng', isRealUser: false },
                  { id: '8', name: 'Đội 3', roleLabel: 'Đội điện nước MEP & phụ kiện', taskCount: 0, loadPercent: 0, isOverloaded: false, statusLabel: 'Sẵn sàng', isRealUser: false },
                ]).map((staff) => {
                  return (
                    <div
                      key={staff.id}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            staff.isRealUser
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {staff.isRealUser ? <User className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {staff.name}
                              </span>
                              {staff.isRealUser ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                                  <Mail className="w-2.5 h-2.5" />
                                  Tài khoản công ty
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Đội thợ xưởng
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {staff.roleLabel}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${
                            staff.isOverloaded
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                          }`}
                        >
                          {staff.statusLabel}
                        </span>
                      </div>

                      {/* Workload Progress & Task Count */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-500 font-medium">
                            {staff.taskCount > 0 ? (
                              <span className="font-bold text-blue-600 dark:text-blue-400">{staff.taskCount} việc tuần này</span>
                            ) : (
                              <span>Sẵn sàng nhận việc</span>
                            )}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            Tải: {staff.loadPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              staff.isOverloaded
                                ? 'bg-rose-500'
                                : staff.loadPercent >= 70
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${staff.loadPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Attention Alerts &amp; Resource Capacity Sidebar (Col 3) */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-4">
          {/* Card 1: Công việc cần chú ý */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Công việc cần chú ý
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAttentionModalFilter('all')}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
                >
                  Xem tất cả →
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                {data.attentionAlerts.map((alert) => {
                  const filterMode = alert.id.includes('overdue') ? 'overdue' : 'urgent';
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => setAttentionModalFilter(filterMode)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          {alert.severity === 'critical' && (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                          )}
                          {alert.severity === 'warning' && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {alert.severity === 'info' && (
                            <Info className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {alert.title}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {alert.subtitle}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${alert.actionClass}`}
                      >
                        {alert.actionLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Tình hình nhân sự */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Tình hình nhân sự
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('resource')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
              >
                Xem chi tiết →
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              {/* Circular Gauge 78% */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-18 h-18 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500"
                      strokeDasharray={`${data.resourceCapacity.readinessPercentage}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {data.resourceCapacity.readinessPercentage}%
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 text-center">
                  {data.resourceCapacity.readinessLabel}
                </span>
              </div>

              {/* Status Breakdown Legend */}
              <div className="space-y-1.5 flex-1 pl-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Đang làm việc
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.resourceCapacity.workingCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Còn thời gian trống
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.resourceCapacity.availableCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Quá tải
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.resourceCapacity.overloadedCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Chưa phân công
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {data.resourceCapacity.unassignedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Row 3: Upcoming Tasks, Project Progress &amp; Action Suggestions ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
        {/* Card 1: Công việc sắp tới (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Công việc sắp tới
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('week')}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
            >
              Xem tất cả →
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            {data.upcomingTasks.map((task) => {
              // Find the linked calendar event so we can open its detail modal
              const linkedEvent = task.calendarEventId
                ? data.calendarEvents.find((e) => e.id === task.calendarEventId) ?? null
                : null;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    if (linkedEvent) {
                      setSelectedTask(linkedEvent);
                    } else {
                      // No linked event: switch to week tab and scroll
                      setActiveTab('week');
                    }
                  }}
                  className="w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {task.time}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.priority === 'urgent' && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white shadow-2xs animate-pulse">
                        🔥 Khẩn cấp
                      </span>
                    )}
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${task.categoryClass}`}
                    >
                      {task.categoryLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 2: Tiến độ công việc theo dự án (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Tiến độ công việc theo dự án
            </h2>
            <Link
              href="/dashboard/interior/projects"
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              Xem chi tiết →
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            {data.projectProgress.map((proj) => (
              <div key={proj.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 text-slate-500">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]">
                      {proj.projectName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                      {proj.progressPercent}%
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${proj.statusBadgeClass}`}
                    >
                      {proj.statusLabel}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${proj.progressBarClass}`}
                    style={{ width: `${proj.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Gợi ý hành động (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {data.actionSuggestions.title}
              </h2>
            </div>
            <div className="mt-3 space-y-2.5">
              {(data.actionSuggestions.actions ?? data.actionSuggestions.items.map((item, i) => ({
                id: `fallback-${i}`,
                text: item,
                actionLabel: 'Xem',
                actionType: 'switch_tab' as const,
                targetId: undefined as string | undefined,
                badgeColorClass: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
              }))).map((action) => (
                <div key={action.id} className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                      {action.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = 'targetId' in action ? action.targetId : undefined;
                      if (action.actionType === 'switch_tab' && targetId) {
                        setActiveTab(targetId as 'week' | 'month' | 'timeline' | 'resource');
                      } else if (action.actionType === 'open_task' && targetId) {
                        const target = data.calendarEvents.find((e) => e.id === targetId);
                        if (target) setSelectedTask(target);
                        else setActiveTab('week');
                      } else if (action.actionType === 'view_project') {
                        setActiveTab('week');
                      }
                    }}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${action.badgeColorClass ?? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'}`}
                  >
                    {action.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <div className="w-16 h-10">
              <svg viewBox="0 0 60 36" className="w-full h-full text-emerald-500/40">
                <path
                  d="M5 30 L18 24 L32 26 L55 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <rect x="10" y="25" width="4" height="6" rx="1" fill="currentColor" opacity="0.4" />
                <rect x="24" y="20" width="4" height="11" rx="1" fill="currentColor" opacity="0.5" />
                <rect x="38" y="14" width="4" height="17" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="52" y="8" width="4" height="23" rx="1" fill="currentColor" opacity="0.8" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: TẠO CÔNG VIỆC MỚI &amp; ĐIỀU PHỐI ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 my-8 animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Tạo công việc mới &amp; Điều phối
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Phân công nhiệm vụ, đặt lịch và chỉ định nhân sự thực hiện
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {createError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateTask} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề công việc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="VD: Khảo sát hiện trạng mặt bằng, Duyệt Spec vật liệu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dự án liên quan
                  </label>
                  <select
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  >
                    {CANONICAL_PROJECTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Người phụ trách / Đội thợ
                  </label>
                  <select
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  >
                    {CANONICAL_ASSIGNEES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phân loại chuyên môn
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ScheduleTaskCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="design">Thiết kế (KTS)</option>
                    <option value="workshop">Sản xuất (Xưởng)</option>
                    <option value="site">Thi công lắp đặt</option>
                    <option value="handover">Nghiệm thu &amp; Bàn giao</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày thực hiện
                  </label>
                  <select
                    value={formDayIndex}
                    onChange={(e) => setFormDayIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  >
                    {data.days.map((d, i) => (
                      <option key={d.fullDate} value={i}>
                        {d.dayOfWeek} ({d.dateFormatted})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Khung giờ
                  </label>
                  <select
                    value={formTimeSlotId}
                    onChange={(e) => setFormTimeSlotId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  >
                    {data.timeSlots.map((s) => (
                      <option key={s.slotId} value={s.slotId}>
                        {s.timeRange}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mức độ ưu tiên
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={formPriority === 'normal'}
                      onChange={() => setFormPriority('normal')}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Bình thường</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer text-rose-600 font-semibold">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={formPriority === 'urgent'}
                      onChange={() => setFormPriority('urgent')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Khẩn cấp (Cần xử lý ngay)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú / Yêu cầu kỹ thuật
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú chi tiết cho nhân sự thực hiện..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Đang lưu vào hệ thống...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      Tạo &amp; Điều phối công việc
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: CHI TIẾT CÔNG VIỆC &amp; CẬP NHẬT TRẠNG THÁI ─── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${selectedTask.badgeBgClass} ${selectedTask.textColorClass}`}>
                    {selectedTask.categoryLabel}
                  </span>
                  {selectedTask.status === 'completed' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Đã hoàn thành
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Đang thực hiện
                    </span>
                  )}
                  {selectedTask.priority === 'urgent' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      Khẩn cấp (Ưu tiên)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400">
                      Ưu tiên: Bình thường
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {selectedTask.id}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Details Content */}
            <div className="py-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <Building className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Dự án</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedTask.projectName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Người phụ trách</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedTask.assignee}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${selectedTask.priority === 'urgent' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Mức độ ưu tiên</div>
                  <div className={`text-xs font-bold ${selectedTask.priority === 'urgent' ? 'text-rose-600 dark:text-rose-400 flex items-center gap-1.5' : 'text-slate-800 dark:text-slate-200'}`}>
                    {selectedTask.priority === 'urgent' ? (
                      <>
                        <span>Khẩn cấp (Cần xử lý ngay)</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      </>
                    ) : (
                      'Bình thường'
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>Ngày</span>
                  </div>
                  <div className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                    {data.days[selectedTask.dayIndex]?.dayOfWeek || 'Thứ 3'} ({data.days[selectedTask.dayIndex]?.dateFormatted || '03/11'})
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Khung giờ</span>
                  </div>
                  <div className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                    {data.timeSlots.find((s) => s.slotId === selectedTask.timeSlotId)?.timeRange || '08:00 - 10:00'}
                  </div>
                </div>
              </div>

              {/* Ghi chú / Yêu cầu kỹ thuật */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ghi chú / Yêu cầu kỹ thuật</span>
                </div>
                <div className="mt-1.5 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.notes && selectedTask.notes.trim() ? (
                    selectedTask.notes
                  ) : (
                    <span className="italic text-slate-400 dark:text-slate-500">Chưa có ghi chú hoặc yêu cầu kỹ thuật đính kèm.</span>
                  )}
                </div>
              </div>

              {/* Dấu vết thời gian & Hiệu suất thực hiện (Audit Trail & Performance) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Dấu vết thời gian &amp; Lịch sử phê duyệt</span>
                  </div>
                  {selectedTask.executionDuration && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Timer className="w-3 h-3 text-indigo-500" />
                      Lead time: {selectedTask.executionDuration}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Khởi tạo */}
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-500" />
                      <span>Người khởi tạo</span>
                    </div>
                    <div className="mt-0.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                      {selectedTask.createdByName || 'Quản lý dự án'}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      {formatTimestamp(selectedTask.createdAt)}
                    </div>
                  </div>

                  {/* Phê duyệt / Hoàn thành */}
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-500" />
                      <span>Người duyệt hoàn thành</span>
                    </div>
                    <div className="mt-0.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                      {selectedTask.status === 'completed'
                        ? selectedTask.completedByName || 'Quản lý dự án'
                        : '— (Chờ duyệt)'}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                      {selectedTask.completedAt ? formatTimestamp(selectedTask.completedAt) : 'Chưa hoàn thành'}
                    </div>
                  </div>
                </div>

                {/* Nhật ký chuyển bước (Activity Timeline) */}
                {selectedTask.statusHistory && selectedTask.statusHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                      Nhật ký chuyển bước &amp; Xử lý:
                    </div>
                    <div className="space-y-2">
                      {selectedTask.statusHistory.map((h, hIdx) => (
                        <div key={hIdx} className="flex items-start gap-2 text-[11px] leading-tight">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                              h.action === 'completed'
                                ? 'bg-emerald-500'
                                : h.action === 'started'
                                ? 'bg-blue-500'
                                : h.action === 'reopened'
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {h.actorName || 'Quản lý dự án'}{' '}
                                <span className="font-normal text-slate-500 dark:text-slate-400">
                                  (
                                  {h.action === 'created'
                                    ? 'Khởi tạo'
                                    : h.action === 'completed'
                                    ? 'Duyệt hoàn thành'
                                    : h.action === 'started'
                                    ? 'Bắt đầu'
                                    : h.action === 'reopened'
                                    ? 'Mở lại'
                                    : 'Cập nhật'}
                                  )
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatTimestamp(h.timestamp)}
                              </span>
                            </div>
                            {h.note && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {h.note}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={isDetailActionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa khỏi lịch
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Đóng
                </button>

                {selectedTask.status === 'completed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus('in_progress')}
                      disabled={isDetailActionLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                      title="Mở lại công việc sang trạng thái đang thực hiện"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Mở lại việc
                    </button>
                    <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs cursor-default">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã hoàn thành
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleTaskStatus('completed')}
                    disabled={isDetailActionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đánh dấu hoàn thành
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: DANH SÁCH CÔNG VIỆC CẦN CHÚ Ý & KHẨN CẤP ─── */}
      {attentionModalFilter && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Công việc cần chú ý &amp; Điều phối khẩn
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Các đầu việc quá hạn hoặc ưu tiên cao cần giám sát xử lý
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttentionModalFilter(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAttentionModalFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  attentionModalFilter === 'all'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setAttentionModalFilter('overdue')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  attentionModalFilter === 'overdue'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Quá hạn ({data.kpis.overdueTasks.value})
              </button>
              <button
                type="button"
                onClick={() => setAttentionModalFilter('urgent')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  attentionModalFilter === 'urgent'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                🔥 Khẩn cấp (
                {data.calendarEvents.filter((e) => e.priority === 'urgent' && e.status !== 'completed').length}
                )
              </button>
            </div>

            {/* Task List */}
            <div className="py-3 max-h-[380px] overflow-y-auto space-y-2.5">
              {attentionFilteredTasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/80 mb-2" />
                  <p className="text-xs font-medium">Không có công việc nào trong danh mục này.</p>
                </div>
              ) : (
                attentionFilteredTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {t.title}
                        </span>
                        {t.priority === 'urgent' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                            🔥 Khẩn cấp
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-semibold border ${t.badgeBgClass} ${t.textColorClass}`}>
                          {t.categoryLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 truncate">
                          <Building className="w-3 h-3 text-slate-400" />
                          {t.projectName}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <User className="w-3 h-3 text-slate-400" />
                          {t.assignee}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {data.days[t.dayIndex]?.dayOfWeek || 'Lịch tuần'} ({data.days[t.dayIndex]?.dateFormatted})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTask(t);
                        setAttentionModalFilter(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                    >
                      Xử lý việc →
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Hiển thị {attentionFilteredTasks.length} công việc
              </span>
              <button
                type="button"
                onClick={() => setAttentionModalFilter(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
