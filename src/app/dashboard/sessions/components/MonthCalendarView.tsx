'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { cn, formatViDate } from '@/lib/utils';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal, 
  Filter,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import type { TimelineSession } from '../../bookings/components/BookingsTimelineGrid';

export interface MappedAppointment {
  id: string;
  bookingId: string;
  dateStr: string;
  timeStr: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  ktvId: string | null;
  ktvName: string | null;
  status: 'completed' | 'in_progress' | 'confirmed' | 'pending' | 'cancelled';
  rawSession: TimelineSession;
}

function getAppointmentsFromSessions(sessions: TimelineSession[]): MappedAppointment[] {
  return sessions.flatMap((session) => {
    const booking = session.bookings;
    const rawDate = session.assigned_date || session.completed_date || booking?.start_date || session.created_at?.slice(0, 10);
    if (!rawDate) return [];

    const dateStr = rawDate.slice(0, 10);
    const timeStr = session.assigned_time || session.start_time || booking?.preferred_time || '09:00';
    const assignedKtvId = booking?.assigned_ktv_id || null;

    let status: MappedAppointment['status'] = 'confirmed';
    if (session.status === 'completed') status = 'completed';
    else if (session.status === 'in_progress') status = 'in_progress';
    else if (session.status === 'cancelled') status = 'cancelled';
    else if (!assignedKtvId) status = 'pending';

    return [{
      id: session.id,
      bookingId: session.booking_id,
      dateStr,
      timeStr,
      customerName: booking?.customers?.name_mother || 'Khách hàng',
      customerPhone: booking?.customers?.phone || '--',
      serviceName: booking?.packages?.name || booking?.package_name || 'Liệu trình chăm sóc',
      ktvId: assignedKtvId,
      ktvName: booking?.assigned_ktv?.full_name || null,
      status,
      rawSession: session,
    }];
  });
}

export function MonthCalendarView({
  sessions = [],
  onSelectBooking,
  onOpenBookingModal,
}: {
  sessions: TimelineSession[];
  onSelectBooking: (booking: TimelineSession) => void;
  onOpenBookingModal?: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [agendaTab, setAgendaTab] = useState<'all' | 'confirmed' | 'pending' | 'in_progress' | 'completed'>('all');

  // Parse all appointments from real sessions prop
  const allAppointments = useMemo(() => getAppointmentsFromSessions(sessions), [sessions]);

  // Handle Month Navigation
  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setSelectedDateStr(`${y}-${m}-${d}`);
  };

  const currentYear = currentMonth.getFullYear();
  const currentMonthIdx = currentMonth.getMonth(); // 0 - 11

  // Generate Month Heatmap Grid
  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const firstDayOfWeek = (new Date(currentYear, currentMonthIdx, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const prevMonthDaysCount = new Date(currentYear, currentMonthIdx, 0).getDate();

    const cells = [];

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDaysCount - i,
        dateStr: '',
        isOtherMonth: true,
        count: 0,
        cap: 0,
        dotColor: null,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(currentMonthIdx + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      const dayApps = allAppointments.filter(app => app.dateStr === dateStr);
      const count = dayApps.length;
      const dailyCap = 20; // benchmark capacity per day
      const cap = Math.min(100, Math.round((count / dailyCap) * 100));

      let dotColor: string | null = null;
      if (count > 0) {
        if (count <= 3) dotColor = 'bg-emerald-500';
        else if (count <= 7) dotColor = 'bg-blue-500';
        else if (count <= 12) dotColor = 'bg-amber-500';
        else dotColor = 'bg-rose-500';
      }

      cells.push({
        day: d,
        dateStr,
        isOtherMonth: false,
        count,
        cap,
        dotColor,
      });
    }

    // Next month padding to reach 35 or 42 cells
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        dateStr: '',
        isOtherMonth: true,
        count: 0,
        cap: 0,
        dotColor: null,
      });
    }

    return cells;
  }, [currentYear, currentMonthIdx, allAppointments]);

  // Monthly KPIs
  const monthAppointments = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
    return allAppointments.filter(app => app.dateStr.startsWith(prefix));
  }, [allAppointments, currentYear, currentMonthIdx]);

  const monthlyTotalBookings = monthAppointments.length;
  const monthlyUniqueCustomers = useMemo(() => {
    const set = new Set(monthAppointments.map(a => a.customerPhone));
    return set.size;
  }, [monthAppointments]);

  const monthlyAvgCapacity = useMemo(() => {
    if (monthlyTotalBookings === 0) return 0;
    const activeDays = new Set(monthAppointments.map(a => a.dateStr)).size;
    return Math.min(100, Math.round(((monthlyTotalBookings / (activeDays * 20)) * 100)));
  }, [monthlyTotalBookings, monthAppointments]);

  const monthlyUnassignedCount = useMemo(() => {
    return monthAppointments.filter(a => !a.ktvId).length;
  }, [monthAppointments]);

  // Selected Day Appointments & Agenda Items
  const selectedDayApps = useMemo(() => {
    return allAppointments.filter(app => app.dateStr === selectedDateStr);
  }, [allAppointments, selectedDateStr]);

  const agendaFilteredApps = useMemo(() => {
    if (agendaTab === 'all') return selectedDayApps;
    return selectedDayApps.filter(app => app.status === agendaTab);
  }, [selectedDayApps, agendaTab]);

  const confirmedCount = selectedDayApps.filter(a => a.status === 'confirmed').length;
  const pendingCount = selectedDayApps.filter(a => a.status === 'pending').length;
  const inProgressCount = selectedDayApps.filter(a => a.status === 'in_progress').length;
  const completedCount = selectedDayApps.filter(a => a.status === 'completed').length;
  const unassignedDayCount = selectedDayApps.filter(a => !a.ktvId).length;

  // Distribution Widgets for Selected Day
  const serviceDistribution = useMemo(() => {
    if (selectedDayApps.length === 0) return [];
    const map: Record<string, number> = {};
    selectedDayApps.forEach(app => {
      const name = app.serviceName;
      map[name] = (map[name] || 0) + 1;
    });
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];
    return Object.entries(map).map(([service, count], idx) => ({
      service,
      count,
      percent: Math.round((count / selectedDayApps.length) * 100),
      color: colors[idx % colors.length],
    }));
  }, [selectedDayApps]);

  const ktvDistribution = useMemo(() => {
    if (selectedDayApps.length === 0) return [];
    const map: Record<string, number> = {};
    selectedDayApps.forEach(app => {
      const name = app.ktvName || 'Chưa phân công';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([ktvName, count]) => {
      const cap = Math.min(100, Math.round((count / 8) * 100)); // 8 slots max per day per KTV
      return {
        ktvName,
        count,
        cap,
      };
    });
  }, [selectedDayApps]);

  const formattedMonthTitle = `Tháng ${currentMonthIdx + 1} Năm ${currentYear}`;
  const formattedSelectedDate = formatViDate(selectedDateStr);

  return (
    <div className="space-y-6">
      {/* ── Operational Monthly KPI Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{monthlyTotalBookings}</span>
              <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Tất cả</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Tổng lịch ({formattedMonthTitle})</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">{monthlyUniqueCustomers}</span>
              <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Khách</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Khách hàng unique</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 leading-none">{monthlyAvgCapacity}%</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Công suất trung bình</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-rose-600 leading-none">{monthlyUnassignedCount}</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Chưa phân công</p>
          </div>
        </div>
      </div>

      {/* ── Month Navigator & Filter Bar ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-lg font-black text-slate-900">{formattedMonthTitle}</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={goToday}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors"
          >
            Hôm nay
          </button>
          {onOpenBookingModal && (
            <button 
              onClick={onOpenBookingModal}
              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Tạo lịch mới
            </button>
          )}
        </div>
      </div>

      {/* ── Monthly Heatmap Calendar Grid ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">
            <div>THỨ HAI</div>
            <div>THỨ BA</div>
            <div>THỨ TƯ</div>
            <div>THỨ NĂM</div>
            <div>THỨ SÁU</div>
            <div>THỨ BẢY</div>
            <div>CHỦ NHẬT</div>
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarGrid.map((item, idx) => {
              const isSelected = item.dateStr === selectedDateStr && !item.isOtherMonth;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!item.isOtherMonth && item.dateStr) {
                      setSelectedDateStr(item.dateStr);
                    }
                  }}
                  className={cn(
                    "min-h-[84px] p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative",
                    item.isOtherMonth
                      ? "bg-slate-50/40 border-slate-100 text-slate-300 pointer-events-none"
                      : isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-base font-black", isSelected ? "text-primary-foreground" : "text-slate-900")}>
                      {item.day}
                    </span>
                    {item.dotColor && (
                      <span className={cn("w-2 h-2 rounded-full", item.dotColor)} />
                    )}
                  </div>

                  {!item.isOtherMonth && item.count > 0 ? (
                    <div className="space-y-0.5">
                      <p className={cn("text-[10px] font-black", isSelected ? "text-primary-foreground" : "text-slate-700")}>
                        • {item.count} lịch
                      </p>
                      <p className={cn("text-[9px] font-bold", isSelected ? "text-primary-foreground" : "text-primary")}>
                        ● {item.cap}%
                      </p>
                    </div>
                  ) : !item.isOtherMonth ? (
                    <p className={cn("text-[9px] font-medium", isSelected ? "text-primary-foreground" : "text-slate-300")}>
                      Trống
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Lower Daily Agenda & Operational Summary Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Daily Agenda (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">{formattedSelectedDate}</h3>
                {selectedDateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` && (
                  <span className="bg-primary/10 text-primary text-[10px] font-black px-2.5 py-0.5 rounded-full">Hôm nay</span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {selectedDayApps.length} lịch hẹn • {unassignedDayCount > 0 ? <span className="text-rose-600 font-black">🔴 {unassignedDayCount} chưa phân công</span> : <span className="text-emerald-600 font-black">✓ Đã phân công đủ</span>}
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setAgendaTab('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shrink-0",
                agendaTab === 'all' ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Tất cả ({selectedDayApps.length})
            </button>
            <button
              onClick={() => setAgendaTab('confirmed')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shrink-0",
                agendaTab === 'confirmed' ? "bg-primary text-primary-foreground border-primary" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Đã xác nhận ({confirmedCount})
            </button>
            <button
              onClick={() => setAgendaTab('pending')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shrink-0",
                agendaTab === 'pending' ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Chờ xác nhận ({pendingCount})
            </button>
            <button
              onClick={() => setAgendaTab('in_progress')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shrink-0",
                agendaTab === 'in_progress' ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Đang thực hiện ({inProgressCount})
            </button>
            <button
              onClick={() => setAgendaTab('completed')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shrink-0",
                agendaTab === 'completed' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Đã xong ({completedCount})
            </button>
          </div>

          {/* Agenda Table */}
          <div className="overflow-x-auto">
            {agendaFilteredApps.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-500">Không có lịch hẹn cho ngày này</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5 px-3">Giờ</th>
                    <th className="py-2.5 px-3">Khách hàng</th>
                    <th className="py-2.5 px-3">Dịch vụ</th>
                    <th className="py-2.5 px-3">KTV</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {agendaFilteredApps.map((item) => {
                    let statusLabel = 'Đã xác nhận';
                    let statusStyle = 'bg-primary/10 text-primary border-primary/20';

                    if (item.status === 'completed') {
                      statusLabel = 'Đã hoàn thành';
                      statusStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    } else if (item.status === 'in_progress') {
                      statusLabel = 'Đang thực hiện';
                      statusStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                    } else if (item.status === 'pending' || !item.ktvName) {
                      statusLabel = 'Chưa phân công';
                      statusStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                    }

                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => onSelectBooking(item.rawSession)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-3 text-slate-900 whitespace-nowrap font-black">{item.timeStr}</td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-black text-slate-900">{item.customerName}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{item.customerPhone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{item.serviceName}</td>
                        <td className="py-3 px-3 text-slate-800">{item.ktvName || '--'}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 rounded-full text-[9.5px] font-black border", statusStyle)}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBooking(item.rawSession);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Daily Operational Widgets (1/3 width) */}
        <div className="space-y-6">
          {/* Daily Operational Summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <span>Tổng quan trong ngày</span>
            </h3>

            <div className="space-y-2.5 text-xs font-bold">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Tổng lịch hẹn</span>
                <span className="text-slate-900 font-black">{selectedDayApps.length}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng unique</span>
                <span className="text-slate-900 font-black">
                  {new Set(selectedDayApps.map(a => a.customerPhone)).size}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">KTV làm việc</span>
                <span className="text-slate-900 font-black">
                  {new Set(selectedDayApps.filter(a => a.ktvName).map(a => a.ktvName)).size}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Công suất dự kiến</span>
                <span className="text-emerald-600 font-black">
                  {Math.min(100, Math.round((selectedDayApps.length / 20) * 100))}%
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Chưa phân công</span>
                <span className={cn("font-black", unassignedDayCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {unassignedDayCount}
                </span>
              </div>
            </div>
          </div>

          {/* Service Distribution */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span>Phân bổ dịch vụ</span>
            </h3>

            {serviceDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Chưa có dữ liệu cho ngày này</p>
            ) : (
              <div className="space-y-3">
                {serviceDistribution.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                      <span className="truncate max-w-[150px]">{item.service}</span>
                    </span>
                    <span className="text-slate-900 font-black">{item.count} ({item.percent}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KTV Distribution */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Phân bổ theo KTV</span>
            </h3>

            {ktvDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Chưa có dữ liệu KTV cho ngày này</p>
            ) : (
              <div className="space-y-3">
                {ktvDistribution.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-900">{item.ktvName}</span>
                      <span className="text-primary">{item.count} lịch • {item.cap}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full", item.cap >= 80 ? "bg-rose-500" : "bg-primary")}
                        style={{ width: `${item.cap}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
