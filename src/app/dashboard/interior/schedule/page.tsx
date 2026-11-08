'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
} from 'lucide-react';

import type {
  ScheduleOverviewResponse,
  ScheduledCalendarEvent,
  ScheduleTaskCategory,
} from '@/products/bella-interior/domain/schedule-overview.types';

// Canonical initial schedule data matching domain analytics service
const INITIAL_SCHEDULE_OVERVIEW: ScheduleOverviewResponse = {
  success: true,
  tenantId: 'tenant-preloaded',
  weekRangeLabel: '03 - 09/11/2026',
  kpis: {
    totalTasks: {
      value: 48,
      label: 'Tổng công việc',
      trend: '↑ 12%',
      isPositiveTrend: true,
    },
    completedTasks: {
      value: 32,
      label: 'Đã hoàn thành',
      trend: '↑ 8%',
      isPositiveTrend: true,
    },
    inProgressTasks: {
      value: 11,
      label: 'Đang thực hiện',
      trend: '↓ 5%',
      isPositiveTrend: false,
    },
    overdueTasks: {
      value: 5,
      label: 'Quá hạn',
      trend: '↓ 2%',
      isPositiveTrend: false,
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
  calendarEvents: [
    {
      id: 'evt-1',
      title: 'Khảo sát công trình',
      projectName: 'Villa Sunrise',
      assignee: 'KTS. Hoàng Long',
      dayIndex: 0,
      timeSlotId: 'slot-1',
      category: 'design',
      categoryLabel: 'Thiết kế',
      badgeBgClass: 'bg-blue-50/90 dark:bg-blue-950/40',
      badgeBorderClass: 'border-l-4 border-l-blue-500 border-blue-100 dark:border-blue-800',
      textColorClass: 'text-blue-900 dark:text-blue-200',
    },
    {
      id: 'evt-2',
      title: 'Duyệt bản vẽ',
      projectName: 'Office Tower',
      assignee: 'KTS. Lê Hoàng',
      dayIndex: 1,
      timeSlotId: 'slot-2',
      category: 'design',
      categoryLabel: 'Thiết kế',
      badgeBgClass: 'bg-emerald-50/90 dark:bg-emerald-950/40',
      badgeBorderClass: 'border-l-4 border-l-emerald-500 border-emerald-100 dark:border-emerald-800',
      textColorClass: 'text-emerald-900 dark:text-emerald-200',
    },
    {
      id: 'evt-3',
      title: 'Họp khách hàng',
      projectName: 'Skyline Residence',
      assignee: 'PM. Mai',
      dayIndex: 2,
      timeSlotId: 'slot-1',
      category: 'design',
      categoryLabel: 'Thiết kế',
      badgeBgClass: 'bg-amber-50/90 dark:bg-amber-950/40',
      badgeBorderClass: 'border-l-4 border-l-amber-500 border-amber-100 dark:border-amber-800',
      textColorClass: 'text-amber-900 dark:text-amber-200',
    },
    {
      id: 'evt-4',
      title: 'Kiểm tra sản xuất',
      projectName: 'Tủ bếp',
      assignee: 'QĐ. Tuấn',
      dayIndex: 3,
      timeSlotId: 'slot-3',
      category: 'workshop',
      categoryLabel: 'Sản xuất',
      badgeBgClass: 'bg-purple-50/90 dark:bg-purple-950/40',
      badgeBorderClass: 'border-l-4 border-l-purple-500 border-purple-100 dark:border-purple-800',
      textColorClass: 'text-purple-900 dark:text-purple-200',
    },
    {
      id: 'evt-5',
      title: 'Nghiệm thu',
      projectName: 'Duplex Aqua Bay',
      assignee: 'PM. Hùng',
      dayIndex: 4,
      timeSlotId: 'slot-3',
      category: 'handover',
      categoryLabel: 'Nghiệm thu',
      badgeBgClass: 'bg-teal-50/90 dark:bg-teal-950/40',
      badgeBorderClass: 'border-l-4 border-l-teal-500 border-teal-100 dark:border-teal-800',
      textColorClass: 'text-teal-900 dark:text-teal-200',
    },
    {
      id: 'evt-6',
      title: 'Lắp đặt nội thất',
      projectName: 'The Garden Villa',
      assignee: 'Đội 1',
      dayIndex: 6,
      timeSlotId: 'slot-4',
      category: 'site',
      categoryLabel: 'Lắp đặt',
      badgeBgClass: 'bg-sky-50/90 dark:bg-sky-950/40',
      badgeBorderClass: 'border-l-4 border-l-sky-500 border-sky-100 dark:border-sky-800',
      textColorClass: 'text-sky-900 dark:text-sky-200',
    },
  ],
  attentionAlerts: [
    {
      id: 'alt-1',
      title: '3 công việc quá hạn',
      subtitle: 'Cần xử lý ngay',
      actionLabel: 'Quá hạn',
      actionClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
      severity: 'critical',
    },
    {
      id: 'alt-2',
      title: '2 lịch có nguy cơ trùng',
      subtitle: 'Kiểm tra phân công',
      actionLabel: 'Cảnh báo',
      actionClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
      severity: 'warning',
    },
    {
      id: 'alt-3',
      title: '4 nhân sự chưa phân công',
      subtitle: 'Có thể nhận thêm việc',
      actionLabel: 'Cần xử lý',
      actionClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
      severity: 'info',
    },
  ],
  resourceCapacity: {
    readinessPercentage: 78,
    readinessLabel: 'Sẵn sàng làm việc',
    workingCount: 18,
    availableCount: 4,
    overloadedCount: 2,
    unassignedCount: 3,
  },
  upcomingTasks: [
    {
      id: 'up-1',
      time: '08:00',
      title: 'Khảo sát công trình Villa Sunrise',
      projectName: 'Villa Sunrise',
      category: 'design',
      categoryLabel: 'Thiết kế',
      categoryClass: 'bg-blue-50 text-blue-700 border-blue-200',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
    },
    {
      id: 'up-2',
      time: '09:30',
      title: 'Duyệt bản vẽ Office Tower',
      projectName: 'Office Tower',
      category: 'design',
      categoryLabel: 'Thiết kế',
      categoryClass: 'bg-blue-50 text-blue-700 border-blue-200',
      assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop',
    },
    {
      id: 'up-3',
      time: '13:30',
      title: 'Kiểm tra sản xuất Tủ bếp',
      projectName: 'Tủ bếp',
      category: 'workshop',
      categoryLabel: 'Sản xuất',
      categoryClass: 'bg-amber-50 text-amber-700 border-amber-200',
      assigneeAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop',
    },
    {
      id: 'up-4',
      time: '15:00',
      title: 'Nghiệm thu lắp đặt Duplex Aqua Bay',
      projectName: 'Duplex Aqua Bay',
      category: 'site',
      categoryLabel: 'Thi công',
      categoryClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      assigneeAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop',
    },
  ],
  projectProgress: [
    {
      id: 'prog-1',
      projectName: 'Villa Sunrise Renovation',
      projectThumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=100&h=100&fit=crop',
      progressPercent: 92,
      statusLabel: 'Đúng tiến độ',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      progressBarClass: 'bg-cyan-500',
    },
    {
      id: 'prog-2',
      projectName: 'Office Tower Lobby',
      projectThumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&h=100&fit=crop',
      progressPercent: 65,
      statusLabel: 'Chậm tiến độ',
      statusBadgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      progressBarClass: 'bg-cyan-500',
    },
    {
      id: 'prog-3',
      projectName: 'Skyline Residence',
      projectThumbnail: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=100&h=100&fit=crop',
      progressPercent: 80,
      statusLabel: 'Đúng tiến độ',
      statusBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      progressBarClass: 'bg-blue-600',
    },
    {
      id: 'prog-4',
      projectName: 'The Garden Villa',
      projectThumbnail: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=100&h=100&fit=crop',
      progressPercent: 45,
      statusLabel: 'Cần chú ý',
      statusBadgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      progressBarClass: 'bg-rose-500',
    },
  ],
  actionSuggestions: {
    title: 'Gợi ý hành động',
    items: [
      'Ưu tiên xử lý 3 công việc quá hạn (đặc biệt: nghiệm thu Duplex Aqua Bay)',
      'Kiểm tra nguồn lực cho tuần tới (2 lịch có nguy cơ trùng)',
      'Báo cáo tiến độ dự án chậm 15% (Office Tower Lobby)',
    ],
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

export default function SchedulePage() {
  const [data, setData] = useState<ScheduleOverviewResponse>(INITIAL_SCHEDULE_OVERVIEW);
  const [activeTab, setActiveTab] = useState<'week' | 'month' | 'timeline' | 'resource'>('week');
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

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch initial schedule from intermediate API on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchSchedule() {
      try {
        const res = await fetch('/api/interior/schedule');
        if (res.ok) {
          const json: ScheduleOverviewResponse = await res.json();
          if (isMounted && json.success) {
            setData(json);
          }
        }
      } catch {
        // Retain initial state
      }
    }

    fetchSchedule();

    return () => {
      isMounted = false;
    };
  }, []);

  // Open create modal with pre-selected cell
  const handleOpenCreateWithSlot = (dayIdx: number, slotId: string) => {
    setFormDayIndex(dayIdx);
    setFormTimeSlotId(slotId);
    setFormTitle('');
    setFormNotes('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Submit task creation to intermediate API
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setCreateError('Vui lòng nhập tên công việc');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const payload = {
        title: formTitle.trim(),
        projectName: formProject,
        assignee: formAssignee.split(' (')[0],
        category: formCategory,
        dayIndex: formDayIndex,
        timeSlotId: formTimeSlotId,
        priority: formPriority,
        notes: formNotes.trim() || undefined,
      };

      const res = await fetch('/api/interior/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Không thể tạo công việc');
      }

      const resJson = await res.json();
      if (resJson.success && resJson.data?.overview) {
        setData(resJson.data.overview);
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

  // Mark task completed
  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    setIsDetailActionLoading(true);

    try {
      const res = await fetch('/api/interior/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selectedTask.id }),
      });

      if (res.ok) {
        const resJson = await res.json();
        if (resJson.success && resJson.data?.overview) {
          setData(resJson.data.overview);
        }
      }

      setToastMessage(`✅ Đã cập nhật hoàn thành công việc "${selectedTask.title}"!`);
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
      const res = await fetch(`/api/interior/schedule?taskId=${encodeURIComponent(selectedTask.id)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const resJson = await res.json();
        if (resJson.success && resJson.data?.overview) {
          setData(resJson.data.overview);
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

  // Compute week range label based on offset
  const computeWeekRangeLabel = (offset: number) => {
    if (offset === 0) return '03 - 09/11/2026';
    if (offset === -1) return '27/10 - 02/11/2026';
    if (offset === 1) return '10 - 16/11/2026';
    if (offset > 1) return `Tuần +${offset} (T11/2026)`;
    return `Tuần ${offset} (T10/2026)`;
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
          {/* Top user profile header matching mock image */}
          <div className="hidden sm:flex items-center gap-3 pr-2">
            <button
              type="button"
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <Image
                  src={'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces'}
                  alt="Nguyễn Văn Quang"
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nguyễn Văn Quang
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

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

      {/* ─── Row 2: Weekly Schedule Matrix & Attention Sidebar ─── */}
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
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
            </div>
          </div>

          {/* ─── TAB 1: WEEK MATRIX VIEW ─── */}
          {activeTab === 'week' && (
            <div className="overflow-x-auto flex-1 flex flex-col">
              <table className="w-full border-collapse text-left text-xs min-w-[700px] h-full">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-3 text-center font-bold text-[11px] w-28 border-r border-slate-100 dark:border-slate-800">
                      Thời gian
                    </th>
                    {data.days.map((day) => (
                      <th
                        key={day.fullDate}
                        className="py-2 px-2 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0"
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
                  {data.timeSlots.map((slot) => (
                    <tr key={slot.slotId} className="h-[68px]">
                      {/* Time Column */}
                      <td className="py-1.5 px-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-850/30 border-r border-slate-100 dark:border-slate-800 align-middle">
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
                            className="py-1 px-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 align-top relative group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="space-y-1">
                              {eventsInSlot.map((eventInSlot) => (
                                <button
                                  key={eventInSlot.id}
                                  type="button"
                                  onClick={() => setSelectedTask(eventInSlot)}
                                  className={`w-full text-left p-2 rounded-lg border text-[11px] font-medium leading-snug shadow-2xs ${eventInSlot.badgeBgClass} ${eventInSlot.badgeBorderClass} ${eventInSlot.textColorClass} transition-transform hover:scale-[1.02] cursor-pointer block`}
                                >
                                  <div className="flex items-center gap-1 font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current inline-block shrink-0" />
                                    <span className="truncate">{eventInSlot.title}</span>
                                  </div>
                                  <div className="text-[10px] opacity-90 truncate mt-0.5 font-semibold">
                                    {eventInSlot.projectName}
                                  </div>
                                  <div className="text-[9px] opacity-75 truncate mt-0.5 font-mono">
                                    ({eventInSlot.assignee})
                                  </div>
                                </button>
                              ))}

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
                {Array.from({ length: 30 }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isCurrent = dayNum === 3;
                  const hasTasks = [3, 4, 5, 6, 7, 9, 12, 15, 20].includes(dayNum);
                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        setFormDayIndex((dayNum % 7));
                        setIsCreateModalOpen(true);
                      }}
                      className={`min-h-[64px] p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 font-bold'
                          : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{dayNum}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500 text-white font-bold">
                            Hôm nay
                          </span>
                        )}
                      </div>
                      {hasTasks && (
                        <div className="mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                          • {dayNum === 3 ? `${data.calendarEvents.length} việc` : '2 việc'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── TAB 3: TIMELINE (GANTT) VIEW ─── */}
          {activeTab === 'timeline' && (
            <div className="p-4 flex-1 space-y-4">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Tiến độ thực hiện theo giai đoạn dự án (Gantt Tracker)
              </div>
              <div className="space-y-3">
                {data.projectProgress.map((proj) => (
                  <div key={proj.id} className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-900 dark:text-white font-bold">
                        {proj.projectName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${proj.statusBadgeClass}`}>
                        {proj.statusLabel} ({proj.progressPercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${proj.progressBarClass}`}
                        style={{ width: `${proj.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Bắt đầu: 01/10/2026</span>
                      <span>Dự kiến: 30/11/2026</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB 4: RESOURCE VIEW ─── */}
          {activeTab === 'resource' && (
            <div className="p-4 flex-1 space-y-4">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Bảng phân bổ tải công việc nhân sự (Resource Allocation Matrix)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CANONICAL_ASSIGNEES.map((staff, idx) => {
                  const loadPercent = [80, 60, 95, 75, 50, 85, 70, 40][idx] || 70;
                  const isOverloaded = loadPercent >= 90;
                  return (
                    <div key={staff} className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-850/50 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {staff}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Tải công việc: <span className="font-semibold text-slate-700 dark:text-slate-300">{loadPercent}%</span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isOverloaded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${loadPercent}%` }}
                          />
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                        isOverloaded
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOverloaded ? 'Quá tải' : 'Bình thường'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Attention Alerts & Resource Capacity Sidebar (Col 3) */}
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
                  onClick={() => setToastMessage('📌 Đang lọc các công việc cần xử lý khẩn cấp')}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
                >
                  Xem tất cả →
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                {data.attentionAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2"
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
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
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
                  </div>
                ))}
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

      {/* ─── Row 3: Upcoming Tasks, Project Progress & Action Suggestions ─── */}
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

          <div className="mt-3 space-y-2.5">
            {data.upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-2 py-1 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {task.time}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${task.categoryClass}`}
                  >
                    {task.categoryLabel}
                  </span>
                  <div className="relative w-5 h-5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                    <Image
                      src={task.assigneeAvatar}
                      alt={task.title}
                      fill
                      sizes="20px"
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
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
                    <div className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                      <Image
                        src={proj.projectThumbnail}
                        alt={proj.projectName}
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
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
            <div className="flex items-center gap-2 pb-2">
              <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {data.actionSuggestions.title}
              </h2>
            </div>
            <div className="mt-2 space-y-2">
              {data.actionSuggestions.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{item}</span>
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

      {/* ─── MODAL 1: TẠO CÔNG VIỆC MỚI & ĐIỀU PHỐI ─── */}
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

      {/* ─── MODAL 2: CHI TIẾT CÔNG VIỆC & CẬP NHẬT TRẠNG THÁI ─── */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${selectedTask.badgeBgClass} ${selectedTask.textColorClass}`}>
                    {selectedTask.categoryLabel}
                  </span>
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
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  disabled={isDetailActionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đánh dấu hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
