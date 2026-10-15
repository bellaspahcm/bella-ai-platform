'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { cn, formatViDate } from '@/lib/utils';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  Users, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useUser } from '@/lib/user-context';
import type { TimelineSession } from '../../bookings/components/BookingsTimelineGrid';

export interface KtvOption {
  id: string;
  full_name: string | null;
  role?: string;
}

export interface TimelineKtvViewProps {
  sessions: TimelineSession[];
  ktvs?: KtvOption[];
  onSelectBooking: (booking: TimelineSession) => void;
  onOpenBookingModal?: () => void;
}

const softTimelineControlClass =
  'border border-transparent bg-white/90 text-slate-700 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-shadow focus:ring-2 focus:ring-primary/15';

function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 9 * 60; // default 09:00
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return 9 * 60;
  return h * 60 + (m || 0);
}

function getAssignedKtvId(session: TimelineSession): string | null {
  return session.bookings?.assigned_ktv_id || null;
}

function getDisplayKtvId(session: TimelineSession): string | null {
  return getAssignedKtvId(session);
}

function getAssignedKtvName(session: TimelineSession): string | null {
  return session.bookings?.assigned_ktv?.full_name || null;
}

function getCustomerName(session: TimelineSession): string {
  return session.bookings?.customers?.name_mother || 'Khách hàng';
}

function getCustomerPhone(session: TimelineSession): string {
  return session.bookings?.customers?.phone || '';
}

function getPackageName(session: TimelineSession): string {
  return session.bookings?.packages?.name || session.bookings?.package_name || 'Liệu trình';
}

export function TimelineKtvView({
  sessions = [],
  ktvs = [],
  onSelectBooking,
  onOpenBookingModal,
}: TimelineKtvViewProps) {
  const { product } = useUser();
  const isBabyCare = product?.productKey === 'bella_babycare';
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTimeStr, setCurrentTimeStr] = useState('12:00');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKtvFilter, setSelectedKtvFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const selectedDateStr = useMemo(() => getLocalDateString(selectedDate), [selectedDate]);
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  // Update current time line live
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Compute 7 days of the week for the date strip centered on selectedDate
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 is Sun, 1 is Mon
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(current);
    monday.setDate(current.getDate() + mondayOffset);

    const days = [];
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = getLocalDateString(d);
      days.push({
        label: labels[i],
        dateNum: d.getDate(),
        dateStr: dStr,
        fullDate: d,
        isActive: dStr === selectedDateStr,
        isToday: dStr === todayStr,
      });
    }
    return days;
  }, [selectedDate, selectedDateStr, todayStr]);

  // Extract unique active KTV list from props & sessions
  const activeKtvs = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    // Add passed KTVs
    ktvs.forEach((k) => {
      if (k.id && k.full_name) {
        map.set(k.id, { id: k.id, name: k.full_name });
      }
    });

    // Add KTVs found in calendar sessions
    sessions.forEach((s) => {
      const ktvId = getDisplayKtvId(s);
      const ktvName = getAssignedKtvName(s);
      if (ktvId && ktvName) {
        map.set(ktvId, { id: ktvId, name: ktvName });
      }
    });

    return Array.from(map.values());
  }, [ktvs, sessions]);

  // Filter sessions relevant to selected date & search query
  const dateSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (s.assigned_date !== selectedDateStr) return false;

      // Filter by KTV
      if (selectedKtvFilter !== 'all') {
        const assignedKtvId = getAssignedKtvId(s);
        const displayKtvId = getDisplayKtvId(s);
        if (selectedKtvFilter === 'unassigned' && assignedKtvId) return false;
        if (selectedKtvFilter !== 'unassigned' && displayKtvId !== selectedKtvFilter) return false;
      }

      // Filter by Status
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'completed' && s.status !== 'completed') return false;
        if (selectedStatusFilter === 'unassigned' && getAssignedKtvId(s)) return false;
        if (selectedStatusFilter === 'in_progress' && (s.status === 'completed' || s.status === 'cancelled')) return false;
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const motherName = getCustomerName(s).toLowerCase();
        const phone = getCustomerPhone(s).toLowerCase();
        const pkgName = getPackageName(s).toLowerCase();
        const bookingNum = (s.bookings?.booking_number || '').toLowerCase();
        const ktvName = (getAssignedKtvName(s) || '').toLowerCase();

        const match = motherName.includes(q) || phone.includes(q) || pkgName.includes(q) || bookingNum.includes(q) || ktvName.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [sessions, selectedDateStr, selectedKtvFilter, selectedStatusFilter, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalToday = dateSessions.length;
    const uniqueCustomers = new Set(dateSessions.map((s) => s.bookings?.customers?.id).filter(Boolean)).size;
    const unassignedCount = dateSessions.filter((s) => !getAssignedKtvId(s)).length;
    const overdueCount = dateSessions.filter((s) => {
      return s.status === 'scheduled' && !!s.assigned_date && s.assigned_date < todayStr;
    }).length;

    const availableHoursPerKtv = 8;
    const totalCapacitySlots = Math.max(1, activeKtvs.length * availableHoursPerKtv);
    const capacityPercent = Math.min(100, Math.round((totalToday / totalCapacitySlots) * 100));

    return { totalToday, uniqueCustomers, unassignedCount, overdueCount, capacityPercent };
  }, [dateSessions, activeKtvs.length, todayStr]);

  const ktvFilterOptions = useMemo(() => [
    { value: 'all', label: `Tất cả KTV (${activeKtvs.length})` },
    { value: 'unassigned', label: `Chưa phân công (${stats.unassignedCount})` },
    ...activeKtvs.map((ktv) => ({ value: ktv.id, label: ktv.name })),
  ], [activeKtvs, stats.unassignedCount]);

  const statusFilterOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'in_progress', label: 'Đang thực hiện' },
    { value: 'completed', label: 'Hoàn thành' },
    { value: 'unassigned', label: 'Chưa phân công' },
  ], []);

  // Group date sessions by KTV (including 'unassigned')
  const sessionsByKtv = useMemo(() => {
    const grouped = new Map<string, TimelineSession[]>();
    grouped.set('unassigned', []);

    activeKtvs.forEach((k) => grouped.set(k.id, []));

    dateSessions.forEach((s) => {
      const key = getDisplayKtvId(s) || 'unassigned';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(s);
    });

    return grouped;
  }, [dateSessions, activeKtvs]);

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00'
  ];

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 1);
    setSelectedDate(next);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  const unassignedList = useMemo(() => {
    return dateSessions.filter((s) => !getAssignedKtvId(s));
  }, [dateSessions]);

  return (
    <div className="space-y-6">
      {/* ── Dynamic Operational KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900 leading-none">{stats.totalToday}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Tổng lịch hôm nay</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900 leading-none">{stats.uniqueCustomers}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Khách hàng</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 leading-none">{stats.capacityPercent}%</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Công suất chung</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-rose-600 leading-none">{stats.unassignedCount}</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Chưa phân công</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-amber-600 leading-none">{stats.overdueCount}</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Lịch trễ</p>
          </div>
        </div>
      </div>

      {/* ── Dynamic Date Navigator & Week Strip ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button onClick={handlePrevDay} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleNextDay} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 capitalize">
              {selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            <p className="text-[9.5px] font-black text-primary uppercase tracking-widest">{isBabyCare ? 'ĐIỀU PHỐI BABYCARE' : 'BEAUTY SPA COORDINATOR'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {weekDays.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDate(day.fullDate)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[42px] py-2 px-3 rounded-xl text-xs font-black transition-all relative",
                day.isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">{day.label}</span>
              <span className="text-sm font-black">{day.dateNum}</span>
              {day.isToday && !day.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1" />
              )}
            </button>
          ))}
          <button 
            onClick={handleTodayClick}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors ml-1 whitespace-nowrap"
          >
            Hôm nay
          </button>
        </div>
      </div>

      {/* ── Dynamic Filters Toolbar ── */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3 flex-wrap">
        <PremiumSelect
          value={selectedKtvFilter}
          onChange={setSelectedKtvFilter}
          options={ktvFilterOptions}
          ariaLabel="Lọc kỹ thuật viên"
          className="w-full md:w-56 space-y-0"
          buttonClassName={cn("h-11 rounded-xl px-4 py-2 text-xs font-bold", softTimelineControlClass)}
          dropdownClassName="min-w-56"
          itemClassName="hover:bg-slate-50"
        />

        <PremiumSelect
          value={selectedStatusFilter}
          onChange={setSelectedStatusFilter}
          options={statusFilterOptions}
          ariaLabel="Lọc trạng thái lịch hẹn"
          className="w-full md:w-48 space-y-0"
          buttonClassName={cn("h-11 rounded-xl px-4 py-2 text-xs font-bold", softTimelineControlClass)}
          dropdownClassName="min-w-48"
          itemClassName="hover:bg-slate-50"
        />

        <div className="relative flex-1 min-w-[200px] w-full md:w-auto ml-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm khách hàng, SĐT, gói dịch vụ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("w-full pl-9 pr-4 py-2 rounded-xl text-xs font-bold", softTimelineControlClass)}
          />
        </div>
      </div>

      {/* ── KTV Timeline Scheduling Board ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-x-auto relative">
        <div className="min-w-[900px] relative">
          {/* Header Columns */}
          <div className={cn("grid border-b border-slate-200 bg-slate-50/80 sticky top-0 z-20", 
            activeKtvs.length === 0 ? "grid-cols-2" : `grid-cols-${Math.min(6, activeKtvs.length + 2)}`
          )}
          style={{ gridTemplateColumns: `100px repeat(${activeKtvs.length + 1}, minmax(220px, 1fr))` }}
          >
            <div className="p-4 border-r border-slate-200 font-black text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Giờ</span>
              <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full">{dateSessions.length} Lịch</span>
            </div>

            {/* Unassigned Column Header */}
            <div className="p-4 border-r border-slate-200 bg-rose-50/40">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-rose-700">Chưa phân công</span>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {stats.unassignedCount}
                </span>
              </div>
              <p className="text-[10px] font-bold text-rose-600 mt-0.5">🔴 {stats.unassignedCount} lịch cần xử lý</p>
            </div>

            {/* KTV Header Columns */}
            {activeKtvs.map((k) => {
              const ktvSessions = sessionsByKtv.get(k.id) || [];
              const count = ktvSessions.length;
              const loadPct = Math.min(100, Math.round((count / 6) * 100));

              return (
                <div key={k.id} className="p-4 border-r border-slate-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-white shadow-sm flex items-center justify-center text-primary font-black text-sm shrink-0">
                    {k.name[0] || 'K'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-xs text-slate-900 truncate">{k.name}</h4>
                    <p className="text-[10px] font-bold text-slate-500 truncate">
                      🟢 08:00 - 17:00 • <span className="text-primary font-black">{count} lịch ({loadPct}%)</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Grid Rows & Absolute Cards */}
          <div className="relative">
            {/* Live Current Time Line (if viewing today) */}
            {selectedDateStr === todayStr && (() => {
              const nowMinutes = parseTimeMinutes(currentTimeStr);
              const gridStartMinutes = 8 * 60; // 08:00
              const gridEndMinutes = 18 * 60 + 30; // 18:30
              if (nowMinutes < gridStartMinutes || nowMinutes > gridEndMinutes) return null;

              const currentTop = Math.floor(((nowMinutes - gridStartMinutes) / 30) * 72);

              return (
                <div
                  style={{ top: `${currentTop}px` }}
                  className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                >
                  <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-r-md shadow-md">
                    {currentTimeStr}
                  </span>
                  <div className="h-0.5 flex-1 bg-rose-500 shadow-sm" />
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 -ml-1 border-2 border-white" />
                </div>
              );
            })()}

            {timeSlots.map((time, idx) => (
              <div 
                key={idx} 
                className="grid border-b border-slate-100 h-[72px]"
                style={{ gridTemplateColumns: `100px repeat(${activeKtvs.length + 1}, minmax(220px, 1fr))` }}
              >
                <div className="p-2 border-r border-slate-200 text-[11px] font-bold text-slate-400 bg-slate-50/40 flex items-start pt-2">
                  {time}
                </div>
                <div className="border-r border-slate-200 bg-slate-50/20" />
                {activeKtvs.map((k) => (
                  <div key={k.id} className="border-r border-slate-200" />
                ))}
              </div>
            ))}

            {/* Dynamic Session Cards rendering onto Timeline Board */}
            {dateSessions.map((session, sIdx) => {
              const ktvId = getDisplayKtvId(session) || 'unassigned';
              const colIndex = ktvId === 'unassigned' ? 0 : activeKtvs.findIndex((k) => k.id === ktvId) + 1;
              if (colIndex < 0) return null;

              const completedCount = Number(session.bookings?.completed_sessions) || 0;
              const totalCount = Number(session.bookings?.total_sessions) || 15;
              const isCompleted = session.status === 'completed';

              // Calculate Y position based on time & duration
              const preferredTime = session.assigned_time || session.bookings?.preferred_time || '09:00';
              const startMinutes = parseTimeMinutes(preferredTime);
              const gridStartMinutes = 8 * 60; // 08:00
              const rowHeight = 72; // height per 30 mins (spacious spacing)
              const topOffset = Math.max(0, Math.floor(((startMinutes - gridStartMinutes) / 30) * rowHeight));

              // Standard care session duration is 60 minutes (2 slots = 144px - 8px margin = 136px)
              const durationMinutes = 60;
              const cardHeight = Math.max(rowHeight - 6, Math.floor((durationMinutes / 30) * rowHeight) - 8);

              const isUnassigned = !getAssignedKtvId(session);
              const totalCols = activeKtvs.length + 1;

              return (
                <div
                  key={session.id}
                  data-session-id={session.id}
                  onClick={() => onSelectBooking(session)}
                  style={{
                    top: `${topOffset}px`,
                    height: `${cardHeight}px`,
                    left: `calc(100px + ${colIndex} * ((100% - 100px) / ${totalCols}) + 4px)`,
                    width: `calc((100% - 100px) / ${totalCols} - 8px)`,
                  }}
                  className={cn(
                    "absolute p-3 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] hover:z-40 border z-10 overflow-hidden flex flex-col justify-between",
                    isUnassigned
                      ? "bg-amber-50 border-2 border-amber-300 text-slate-900"
                      : isCompleted
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-primary text-primary-foreground border-primary hover:bg-primary-hover"
                  )}
                >
                  <div>
                    <div className="flex justify-between items-start text-[10px] font-bold opacity-90">
                      <span>{preferredTime}</span>
                      <span>#{session.bookings?.booking_number || session.booking_id.slice(0, 8)}</span>
                    </div>
                    <h5 className={cn("font-black text-xs mt-1 truncate", isUnassigned ? '!text-slate-900' : isCompleted ? '!text-white' : '!text-primary-foreground')}>
                      {getCustomerName(session)}
                    </h5>
                    <p className="text-[10px] font-medium opacity-80 truncate">{getPackageName(session)}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1 text-[9px] font-black">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md uppercase tracking-wider truncate",
                      isUnassigned ? "bg-amber-200 text-amber-900" : isCompleted ? "bg-white/20 text-white" : "bg-primary-foreground/15 text-primary-foreground"
                    )}>
                      {isUnassigned ? 'Chưa phân KTV' : isCompleted ? 'Hoàn thành' : `Buổi ${completedCount}/${totalCount}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Dynamic Bottom Grid: Unassigned List + KTV Workload Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unassigned List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Lịch chưa phân công ({unassignedList.length})</span>
            </h3>
          </div>

          {unassignedList.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Đã phân công KTV đầy đủ cho tất cả các ca trong ngày!
            </div>
          ) : (
            <div className="space-y-3">
              {unassignedList.map((item) => (
                <div key={item.id} className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black text-amber-900">
                      {item.assigned_date ? formatViDate(item.assigned_date) : '---'}
                    </span>
                    <h4 className="font-black text-sm text-slate-900">{getCustomerName(item)}</h4>
                    <p className="text-xs text-slate-600 font-medium">{getPackageName(item)}</p>
                  </div>
                  <button 
                    onClick={() => onSelectBooking(item)}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-black text-xs rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap"
                  >
                    Phân công KTV
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: KTV Workload Overview */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Phân bổ KTV trong ngày</span>
            </h3>
          </div>

          <div className="space-y-4">
            {activeKtvs.length === 0 ? (
              <p className="text-xs font-bold text-slate-400">Chưa có KTV được phân công.</p>
            ) : (
              activeKtvs.map((k) => {
                const ktvSessions = sessionsByKtv.get(k.id) || [];
                const count = ktvSessions.length;
                const loadPct = Math.min(100, Math.round((count / 6) * 100));

                return (
                  <div key={k.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-slate-900">{k.name}</span>
                      <span className="text-primary">{count} ca ({loadPct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", loadPct > 80 ? "bg-rose-500" : "bg-primary")}
                        style={{ width: `${loadPct}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
