'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { useUser } from '@/lib/user-context';

type BookingsTimelineDateRibbonProps = {
  selectedDate: Date;
  today: Date;
  moduleKey?: TenantModuleKey | null;
  onSelectedDateChange: (date: Date) => void;
};

function getDaysOfWeek(d: Date) {
  const current = new Date(d);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diff));
  const days = [];

  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }

  return days;
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function BookingsTimelineDateRibbon({
  selectedDate,
  today,
  moduleKey,
  onSelectedDateChange,
}: BookingsTimelineDateRibbonProps) {
  const weekDays = getDaysOfWeek(selectedDate);
  const vocab = useModuleVocabulary();
  const { product } = useUser();
  const isHaircut = product?.productKey === 'bella_haircut';
  const isBabyCare = product?.productKey === 'bella_babycare';
  
  // Dynamic coordinator label based on module
  const coordinatorLabel = isBabyCare ? 'Điều phối BabyCare' : moduleKey == null
    ? 'Điều phối viên'
    : moduleKey === 'industrial_cleaning'
      ? 'Quản lý ca làm việc'
      : moduleKey === 'beauty_spa'
        ? isHaircut ? 'Haircut Shop Coordinator' : 'Beauty Spa Coordinator'
        : 'Bella Spa Coordinator';

  const moveDate = (days: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    onSelectedDateChange(next);
  };

  return (
    <div className="luxury-card-white mb-6 flex flex-col gap-4 rounded-[28px] p-4 select-none md:flex-row md:items-center md:justify-between md:rounded-[32px] md:p-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            type="button"
            onClick={() => moveDate(1)}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="min-w-0">
          <h2 className="break-words text-base font-black capitalize tracking-tight text-slate-900 sm:text-xl">
            {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(selectedDate)}
          </h2>
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            {coordinatorLabel}
          </span>
        </div>
      </div>

      <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar py-2">
        {weekDays.map((date, idx) => {
          const selected = isSameDay(date, selectedDate);
          const dateIsToday = isSameDay(date, today);
          const dayLabel = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectedDateChange(date)}
              className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl transition-all shrink-0 select-none ${
                selected
                  ? 'beauty-date-ribbon-day-active bg-primary text-primary-foreground shadow-md scale-105'
                  : dateIsToday
                    ? 'bg-primary/10 text-primary border border-primary/20 font-extrabold'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 font-bold'
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-widest">{dayLabel}</span>
              <span className="text-sm font-extrabold mt-0.5">{date.getDate()}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelectedDateChange(new Date())}
          className="text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-3 rounded-2xl transition-all ml-2 shrink-0 active:scale-95"
        >
          Hôm nay
        </button>
      </div>
    </div>
  );
}
