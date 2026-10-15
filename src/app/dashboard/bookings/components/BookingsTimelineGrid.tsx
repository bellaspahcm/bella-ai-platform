'use client';

import { useRef } from 'react';
import { Clock, Loader2, Plus } from 'lucide-react';

import {
  formatBookingCustomerLabel,
  getKtvFallbackSpecialtyByName,
  getPackageSpecialty,
} from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { KtvSpecialty } from './BookingsSpecialtyFilter';

export type TimelineSession = {
  id: string;
  booking_id: string;
  assigned_date: string;
  assigned_time?: string | null;
  completed_date?: string | null;
  start_time?: string | null;
  created_at?: string | null;
  notes?: string | null;
  session_number?: number | null;
  status?: string | null;
  completed_by_ktv_id?: string | null;
  booking_resource_id?: string | null;
  booking_resource?: {
    id?: string | null;
    name?: string | null;
    resource_type?: string | null;
    status?: string | null;
  } | null;
  bookings?: {
    assigned_ktv_id?: string | null;
    booking_number?: string | null;
    completed_sessions?: number | null;
    total_sessions?: number | null;
    assigned_ktv?: {
      id?: string | null;
      full_name?: string | null;
    } | null;
    customers?: {
      id?: string | null;
      name_mother?: string | null;
      name_baby?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
    full_price?: number | string | null;
    deposit_amount?: number | string | null;
    discount_percent?: number | string | null;
    status?: string | null;
    preferred_time?: string | null;
    start_date?: string | null;
    revenue?: {
      amount?: number | string | null;
      status?: string | null;
      revenue_type?: string | null;
    }[] | null;
    packages?: {
      name?: string | null;
      module_key?: string | null;
      service_category?: string | null;
      requires_resource?: boolean | null;
      default_resource_type?: string | null;
    } | null;
    package_name?: string | null;
  } | null;
};

export type KtvColumn = {
  id: string | null;
  full_name: string;
  role?: string | null;
  isUnassigned?: boolean;
};

type BookingsTimelineGridProps = {
  sessions: TimelineSession[];
  ktvs: KtvColumn[];
  selectedDate: Date;
  ktvSpecialty: KtvSpecialty;
  tenantModuleKey: TenantModuleKey;
  isSyncing: boolean;
  isSameDay: (d1: Date | string, d2: Date | string) => boolean;
  onSessionSelect: (session: TimelineSession) => void;
  onEmptySlotClick: (hour: number) => void;
};

function getSessionCategory(session: TimelineSession, tenantModuleKey: TenantModuleKey): KtvSpecialty {
  return getPackageSpecialty({
    tenantModuleKey,
    packageModuleKey: session.bookings?.packages?.module_key,
    serviceCategory: session.bookings?.packages?.service_category,
    packageName: session.bookings?.packages?.name || session.bookings?.package_name,
  });
}

function getSessionHourBlock(timeStr?: string | null) {
  if (!timeStr) return 9;

  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  return match ? parseInt(match[1], 10) : 9;
}

function checkIfSessionIsLate(session: TimelineSession) {
  if (session.status !== 'scheduled' || !session.assigned_date || !session.assigned_time) {
    return false;
  }
  try {
    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const [year, month, day] = session.assigned_date.split('-').map(Number);
    const [hour, minute] = session.assigned_time.split(':').map(Number);
    const scheduledDateTime = new Date(year, month - 1, day, hour, minute, 0, 0);
    const diffMinutes = (nowVN.getTime() - scheduledDateTime.getTime()) / (1000 * 60);
    return diffMinutes > 15;
  } catch (err: unknown) {
    return false;
  }
}

export function BookingsTimelineGrid({
  sessions,
  ktvs,
  selectedDate,
  ktvSpecialty,
  tenantModuleKey,
  isSyncing,
  isSameDay,
  onSessionSelect,
  onEmptySlotClick,
}: BookingsTimelineGridProps) {
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const getKtvSpecialty = (ktv: KtvColumn): KtvSpecialty => {
    const ktvSessions = sessions.filter((session) => {
      const activeKtvId = session.completed_by_ktv_id || session.bookings?.assigned_ktv_id;
      return activeKtvId === ktv.id && isSameDay(new Date(session.assigned_date), selectedDate);
    });

    if (ktvSessions.length > 0) {
      return getSessionCategory(ktvSessions[0], tenantModuleKey);
    }

    return getKtvFallbackSpecialtyByName(ktv.full_name, tenantModuleKey);
  };

  const filteredKtvs = ktvs.filter((ktv) => ktvSpecialty === 'all' || getKtvSpecialty(ktv) === ktvSpecialty);
  const columns: KtvColumn[] = [
    { id: null, full_name: 'Chưa phân công', role: 'ktv', isUnassigned: true },
    ...filteredKtvs,
  ];
  const hours = Array.from({ length: 13 }, (_, i) => 8 + i);

  return (
    <div className="relative border border-slate-300/80 rounded-[40px] bg-white shadow-xl shadow-slate-100/50 overflow-hidden flex flex-col">
      {isSyncing && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {/* Unified Scroll Container */}
      <div className="flex-1 overflow-auto max-h-[640px] custom-scrollbar">
        <div className="min-w-max flex flex-col">
          {/* Header Row - Sticky top-0 vertically, but scrolls horizontally */}
          <div className="flex bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
            <div className="w-20 md:w-24 border-r border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 tracking-wider select-none">
              Giờ
            </div>

            <div className="flex flex-1 select-none">
              {columns.map((col) => (
                <div
                  key={col.id || 'unassigned'}
                  className="min-w-[200px] md:min-w-[240px] flex-1 py-4 px-6 text-center border-r border-slate-200 flex-shrink-0 flex flex-col items-center justify-center gap-1.5 bg-slate-50"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none ${
                      col.isUnassigned
                        ? 'bg-rose-50 text-rose-500 border-2 border-rose-100 border-dashed animate-pulse'
                        : 'bg-primary text-primary-foreground shadow-inner'
                    }`}
                  >
                    {col.isUnassigned ? '?' : col.full_name[0]}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">{col.full_name}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {col.isUnassigned
                        ? `${sessions.filter((session) => isSameDay(new Date(session.assigned_date), selectedDate) && !(session.completed_by_ktv_id || session.bookings?.assigned_ktv_id)).length} ca`
                        : `${sessions.filter((session) => isSameDay(new Date(session.assigned_date), selectedDate) && (session.completed_by_ktv_id || session.bookings?.assigned_ktv_id) === col.id).length} ca`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex relative">
            <div className="w-20 md:w-24 border-r border-slate-200 flex-shrink-0 bg-white flex flex-col select-none">
              {hours.map((hour) => (
                <div key={hour} className="h-[148px] border-b border-slate-200/80 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-400 tracking-wider bg-slate-50 px-2.5 py-1 rounded-xl">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-1">
              {columns.map((col) => (
                <div
                  key={col.id || 'unassigned'}
                  className="min-w-[200px] md:min-w-[240px] flex-1 flex-shrink-0 border-r border-slate-200 relative bg-slate-50/20"
                >
                  {hours.map((hour) => {
                    const cellSessions = sessions.filter((session) => {
                      const activeKtvId = session.completed_by_ktv_id || session.bookings?.assigned_ktv_id;
                      const isKtvMatch = col.isUnassigned ? !activeKtvId : activeKtvId === col.id;

                      return (
                        isKtvMatch &&
                        isSameDay(new Date(session.assigned_date), selectedDate) &&
                        getSessionHourBlock(session.assigned_time || session.bookings?.preferred_time) === hour
                      );
                    });

                    return (
                      <div
                        key={hour}
                        className="h-[148px] border-b border-slate-200/80 p-2.5 relative flex flex-col justify-start gap-2 group/cell transition-colors hover:bg-slate-50/40"
                      >
                        {cellSessions.length > 0 ? (
                          <div className="flex flex-col gap-2 overflow-y-auto max-h-full custom-scrollbar pr-0.5 z-10">
                            {cellSessions.map((session) => {
                              const isCompleted = session.status === 'completed';
                              const isInProgress = session.status === 'in_progress';
                              const isScheduled = session.status === 'scheduled';
                              const isLate = isScheduled && checkIfSessionIsLate(session);

                              return (
                                <div
                                  key={session.id}
                                  onClick={() => onSessionSelect(session)}
                                  className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md select-none text-left ${
                                    isCompleted
                                      ? 'bg-emerald-50/80 border-emerald-100/80 hover:border-emerald-300 hover:bg-emerald-50'
                                      : isInProgress
                                        ? 'bg-sky-50/80 border-sky-100 hover:border-sky-300 hover:bg-sky-50'
                                        : isLate
                                          ? 'bg-red-50 border-red-200 hover:border-red-400 hover:bg-red-100/60 shadow-sm animate-pulse'
                                          : isScheduled
                                            ? 'bg-primary/5 border-primary/15 hover:border-primary/30 hover:bg-primary/10'
                                            : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                  }`}
                                  data-testid="booking-session-row"
                                  data-session-id={session.id}
                                >
                                  <div className="flex items-center justify-between gap-1.5 mb-1">
                                    <span
                                      data-testid="booking-session-status"
                                      className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        isCompleted
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : isInProgress
                                            ? 'bg-sky-100 text-sky-700'
                                            : isLate
                                              ? 'bg-red-600 text-white animate-bounce'
                                              : isScheduled
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {isCompleted ? 'Xong' : isInProgress ? 'Chạy' : isLate ? 'TRỄ' : 'Sắp'}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5 shrink-0">
                                      <Clock className="w-2.5 h-2.5 text-primary" />
                                      {session.assigned_time || session.bookings?.preferred_time || '09:00'}
                                    </span>
                                  </div>
                                  <h4 className="font-extrabold text-slate-800 text-xs truncate" data-testid="booking-customer-name">
                                    {formatBookingCustomerLabel({
                                      moduleKey: tenantModuleKey,
                                      primaryName: session.bookings?.customers?.name_mother,
                                    })}
                                  </h4>
                                  {session.bookings?.customers?.name_baby && (
                                    <p className="text-[9px] font-bold text-primary truncate">
                                      {formatBookingCustomerLabel({
                                        moduleKey: tenantModuleKey,
                                        primaryName: '',
                                        secondaryName: session.bookings.customers.name_baby,
                                      }).replace(/^.* - /, '')}
                                    </p>
                                  )}
                                  {/* Session progress badge */}
                                  {(session.session_number || session.bookings?.total_sessions) && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                        isCompleted
                                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                          : isLate
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : 'bg-primary/10 text-primary border-primary/20'
                                      }`}>
                                        Buổi {session.session_number ?? '?'}
                                        {session.bookings?.total_sessions
                                          ? `/${session.bookings.total_sessions}`
                                          : ''}
                                      </span>
                                    </div>
                                  )}
                                  <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5" data-testid="booking-package-name">
                                    {session.bookings?.packages?.name || session.bookings?.package_name || 'Liệu trình'}
                                  </p>
                                  {session.booking_resource?.name && (
                                    <p className="text-[9px] font-black text-emerald-700 truncate mt-1">
                                      {session.booking_resource.name}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            onClick={() => onEmptySlotClick(hour)}
                            className="absolute inset-0 rounded-xl m-1 flex items-center justify-center border border-dashed border-transparent hover:border-slate-200 hover:bg-white/70 cursor-pointer group transition-all duration-200 z-0"
                          >
                            <Plus className="w-4 h-4 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
