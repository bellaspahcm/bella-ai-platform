'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type CalendarSession = {
  assigned_date?: string | null;
};

type BookingsMonthCalendarProps = {
  currentMonth: Date;
  monthDays: Date[];
  selectedDate: Date;
  today: Date;
  sessions: CalendarSession[];
  isSyncing: boolean;
  onCurrentMonthChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
};

const dayLabels = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function formatDateHeader(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getLocalDateString(d: Date | string) {
  if (typeof d === 'string') return d.split('T')[0];

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function isSameDay(d1: Date | string, d2: Date | string) {
  return getLocalDateString(d1) === getLocalDateString(d2);
}

function isSameMonth(d1: Date, d2: Date) {
  return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

export function BookingsMonthCalendar({
  currentMonth,
  monthDays,
  selectedDate,
  today,
  sessions,
  isSyncing,
  onCurrentMonthChange,
  onSelectedDateChange,
}: BookingsMonthCalendarProps) {
  const moveMonth = (months: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + months);
    onCurrentMonthChange(next);
  };

  const selectToday = () => {
    const next = new Date();
    onCurrentMonthChange(next);
    onSelectedDateChange(next);
  };

  const selectDate = (date: Date) => {
    onSelectedDateChange(date);

    setTimeout(() => {
      document.getElementById('bookings-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="luxury-card-white p-8 rounded-[40px] overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
            {formatDateHeader(currentMonth)}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectToday}
            className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
          >
            Hôm nay
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-4">
        {dayLabels.map((day) => (
          <div key={day} className="text-center">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {day}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden relative">
        {isSyncing && sessions.length === 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}
        {monthDays.map((date, i) => {
          const dateIsToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const daySessions = sessions.filter(
            (session) => session.assigned_date && isSameDay(new Date(session.assigned_date), date),
          );

          return (
            <div
              key={i}
              onClick={() => selectDate(date)}
              className={`min-h-[100px] p-3 bg-white transition-all cursor-pointer group hover:bg-slate-50/80 relative select-none ${
                !isCurrentMonth ? 'opacity-40' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`flex items-center justify-center w-8 h-8 text-sm font-bold rounded-xl transition-all ${
                    isSelected
                      ? 'beauty-calendar-day-active bg-primary text-primary-foreground shadow-lg shadow-primary/20 dark:shadow-none'
                      : dateIsToday
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-slate-600 group-hover:text-slate-900'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dateIsToday && <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
              </div>

              {daySessions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '100%' }} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 truncate">
                    {daySessions.length} Lịch hẹn
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
