'use client';

import { Calendar, ClipboardList, History, Loader2, MapPin, User } from 'lucide-react';
import { formatViDate } from '@/lib/utils';
import { getBabyCareSessionSummary } from '../babycare-customer-view';
import type { CustomerDetailBooking } from '../types';

export function BabyCareSessionPanel({
  activeBooking,
  customerAddress,
  isCompleted,
  isReusing,
  onOpenSessions,
  onOpenBookingSessions,
  onReusePackage,
}: {
  activeBooking: CustomerDetailBooking | null;
  customerAddress?: string | null;
  isCompleted: boolean;
  isReusing: boolean;
  onOpenSessions: () => void;
  onOpenBookingSessions: () => void;
  onReusePackage: () => void;
}) {
  const { nextSession, completed } = getBabyCareSessionSummary(activeBooking);
  const location = nextSession?.address || customerAddress;

  return (
    <div className="space-y-6">
      <section className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-primary shrink-0" /> Buổi tiếp theo
          </h3>
          {activeBooking && <button onClick={onOpenBookingSessions} className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg">Mở lịch chăm sóc</button>}
        </div>
        {nextSession ? (
          <div className="space-y-4 text-sm text-slate-600">
            <p className="font-black text-slate-900">Buổi số {nextSession.session_number} / {activeBooking?.total_sessions ?? 0}</p>
            <p className="font-bold text-primary">
              {nextSession.assigned_date ? formatViDate(nextSession.assigned_date) : 'Chưa xếp ngày'}
              {' · '}{nextSession.assigned_time?.slice(0, 5) || 'Chưa xếp giờ'}
              {nextSession.standard_duration != null && nextSession.standard_duration > 0 && ` (${nextSession.standard_duration} phút)`}
            </p>
            <p className="flex items-start gap-2 min-w-0"><MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary" /><span className="break-words min-w-0">{location || 'Chưa cập nhật địa chỉ chăm sóc'}</span></p>
            <p className="flex items-center gap-2"><User className="w-4 h-4 text-primary shrink-0" />KTV: {nextSession.completed_by_ktv?.full_name || activeBooking?.assigned_ktv?.full_name || 'Chưa phân công'}</p>
          </div>
        ) : <p className="text-sm text-slate-500">{activeBooking ? 'Chưa có buổi chăm sóc được xếp lịch.' : 'Chưa có gói chăm sóc.'}</p>}
      </section>

      <section className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5"><History className="w-5 h-5 text-primary shrink-0" />Lịch sử chăm sóc ({completed.length})</h3>
          {activeBooking && <button onClick={onOpenSessions} className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg">Xem lịch sử</button>}
        </div>
        {completed.length ? <div className="divide-y divide-slate-100">
          {completed.map(session => (
            <div key={session.id} className="py-4 flex items-start gap-3 text-xs">
              <ClipboardList className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0 space-y-1 break-words">
                <p className="font-black text-slate-900">Buổi {session.session_number} / {activeBooking?.total_sessions ?? 0}</p>
                <p className="text-slate-600">{session.completed_date || session.assigned_date ? formatViDate(session.completed_date || session.assigned_date) : 'Chưa ghi nhận ngày'}{session.assigned_time && ` · ${session.assigned_time.slice(0, 5)}`}{session.actual_duration != null && session.actual_duration > 0 && ` (${session.actual_duration} phút)`}</p>
                <p className="text-slate-600">KTV thực hiện: {session.completed_by_ktv?.full_name || 'Chưa ghi nhận'}</p>
                {session.notes && <p className="text-slate-500 whitespace-pre-wrap">{session.notes}</p>}
              </div>
              <span className="ml-auto text-emerald-700 font-bold shrink-0">Hoàn thành</span>
            </div>
          ))}
        </div> : <p className="text-sm text-slate-500">Chưa có buổi chăm sóc hoàn thành.</p>}
        {isCompleted && activeBooking && <button disabled={isReusing} onClick={onReusePackage} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {isReusing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}Đăng ký lại gói
        </button>}
      </section>
    </div>
  );
}
