'use client';

import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, LayoutGrid, Loader2, QrCode } from 'lucide-react';

import {
  formatBookingCustomerLabel,
  getTenantModulePresentation,
} from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { TimelineSession } from './BookingsTimelineGrid';

type BookingsDayTimelineListProps = {
  sessions: TimelineSession[];
  selectedDate: Date;
  tenantModuleKey: TenantModuleKey;
  isSyncing: boolean;
  isSameDay: (d1: Date | string, d2: Date | string) => boolean;
  onSessionSelect: (session: TimelineSession) => void;
  onQrClick: (bookingId: string) => void;
  onCareClick: (session: TimelineSession) => void;
};

export function BookingsDayTimelineList({
  sessions,
  selectedDate,
  tenantModuleKey,
  isSyncing,
  isSameDay,
  onSessionSelect,
  onQrClick,
  onCareClick,
}: BookingsDayTimelineListProps) {
  const customerLabels = getTenantModulePresentation(tenantModuleKey);
  const daySessions = sessions
    .filter((session) => isSameDay(new Date(session.assigned_date || 0), selectedDate))
    .sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime());

  return (
    <div id="bookings-timeline" className="space-y-4 scroll-mt-8">
      {isSyncing && sessions.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
        </div>
      ) : daySessions.length > 0 ? (
        daySessions.map((session, idx) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative pl-6 group sm:pl-8"
          >
            <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-slate-100 group-last:bottom-1/2" />
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
                session.status === 'completed'
                  ? 'bg-emerald-500'
                  : session.status === 'in_progress'
                    ? 'bg-blue-500'
                    : session.status === 'scheduled'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
              }`}
            />

            <div
              onClick={() => onSessionSelect(session)}
              className="luxury-card-white flex cursor-pointer flex-col gap-4 rounded-3xl p-4 transition-all hover:border-primary/20 hover:shadow-xl sm:p-6 lg:flex-row lg:items-center lg:gap-6"
              data-testid="booking-session-row"
              data-session-id={session.id}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-1.5 text-slate-900 font-black">
                    <Clock className="w-4 h-4 text-rose-500" />
                    {session.assigned_time || session.bookings?.preferred_time || '09:00 - 11:00'}
                  </div>
                  <span
                    data-testid="booking-session-status"
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      session.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600'
                        : session.status === 'scheduled'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    {session.status === 'completed'
                      ? 'Hoàn thành'
                      : session.status === 'scheduled'
                        ? 'Sắp tới'
                        : 'Khác'}
                  </span>
                </div>

                <h3 className="mb-1 break-words text-lg font-extrabold text-slate-900 sm:text-xl" data-testid="booking-customer-name">
                  {formatBookingCustomerLabel({
                    moduleKey: tenantModuleKey,
                    primaryName: session.bookings?.customers?.name_mother,
                  })}
                </h3>
                {session.bookings?.customers?.name_baby && (
                  <p className="mb-2 break-words text-sm font-semibold text-primary/80">
                    {customerLabels.secondaryPrefix}: {session.bookings.customers.name_baby}
                  </p>
                )}
                <p className="flex min-w-0 items-start gap-2 text-sm font-bold text-slate-500">
                  <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  <span className="break-words" data-testid="booking-package-name">{session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình'}</span>
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-3 border-slate-100 lg:items-end lg:border-l lg:pl-8">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 text-left lg:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Kỹ thuật viên</p>
                    <p className="break-words font-bold text-slate-900" data-testid="booking-assigned-staff">
                      {session.bookings?.assigned_ktv?.full_name || 'Chưa phân công'}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                    {session.bookings?.assigned_ktv?.full_name?.[0] || 'K'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onQrClick(session.booking_id);
                    }}
                    className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center border border-rose-100/50 active:scale-95"
                    title="Thanh toán VietQR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSessionSelect(session);
                    }}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-600 transition-colors"
                  >
                    Dời lịch
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCareClick(session);
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shadow-lg shadow-primary/20 dark:shadow-none"
                  >
                    Chăm sóc
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/50 p-8 text-center sm:rounded-[32px] sm:p-12">
          <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold">Không có lịch hẹn nào cho ngày này</p>
        </div>
      )}
    </div>
  );
}
