'use client';

import Image from 'next/image';
import { ChevronRight, ClipboardList, Clock, Heart, History, TrendingUp, Calendar, MapPin, CheckCircle2, User, Image as ImageIcon } from 'lucide-react';
import type { CustomerDetailBooking, CustomerDetailSession } from '../types';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { formatViDate } from '@/lib/utils';

export function SessionHistoryPanel({
  activeBooking,
  sortedSessions,
  nextSession,
  isCompleted,
  isReusing,
  onOpenSessions,
  onOpenBookingSessions,
  onReusePackage,
  tenantModuleKey,
  tenantPhone,
}: {
  activeBooking: CustomerDetailBooking | null;
  sortedSessions: CustomerDetailSession[];
  nextSession?: CustomerDetailSession;
  isCompleted: boolean;
  isReusing: boolean;
  onOpenSessions: () => void;
  onOpenBookingSessions: () => void;
  onReusePackage: () => void;
  tenantModuleKey: TenantModuleKey | null;
  tenantPhone?: string;
}) {
  const vocab = useModuleVocabulary(tenantModuleKey);

  // Sample before & after images matching Image 2
  const beforeAfterPhotos = [
    'https://images.unsplash.com/photo-1512290900673-7002fffe9353?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=200&q=80',
  ];
  
  return (
    <div className="space-y-6">
      {/* ── Buổi tiếp theo Card ── */}
      <div className="rounded-[2.5rem] bg-white p-6 sm:p-7 md:p-8 border border-slate-200/80 shadow-lg shadow-slate-200/50">
        <div className="flex items-center justify-between mb-5 pt-1 px-1">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Buổi tiếp theo</span>
          </h3>
          <button
            onClick={onOpenBookingSessions}
            className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
          >
            Thay đổi lịch &gt;
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 sm:p-6 bg-slate-50/80 rounded-2xl border border-slate-100 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-900">
                Buổi số {nextSession?.session_number || 4} / {activeBooking?.total_sessions || 12}
              </p>
              <h4 className="text-sm sm:text-base font-black text-primary">
                {nextSession?.assigned_date ? formatViDate(nextSession.assigned_date) : '27/07/2026'} (Thứ hai)
              </h4>
              <p className="text-xs text-slate-500 font-bold">
                ⏰ {nextSession?.assigned_time || activeBooking?.preferred_time || '08:00 - 09:00'} (60 phút) • 📍 Phòng gội 01
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
            <Image
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
              alt="Staff Avatar"
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div>
              <p className="text-xs font-black text-slate-900">{activeBooking?.assigned_ktv?.full_name || 'KTV Demo Body'}</p>
              <p className="text-[10px] font-bold text-slate-500">Kỹ thuật viên</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onOpenSessions}
            className="bg-primary hover:bg-primary-hover text-primary-foreground font-black text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-primary/20 active:scale-95 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Check-in</span>
          </button>
          <button
            onClick={onOpenBookingSessions}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-5 py-3 rounded-xl transition-colors"
          >
            Đổi lịch
          </button>
          <button
            onClick={onOpenSessions}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-5 py-3 rounded-xl transition-colors"
          >
            Xem chi tiết
          </button>
        </div>
      </div>

      {/* ── Lịch sử chăm sóc (3/12) ── */}
      <div className="rounded-[2.5rem] bg-white p-6 sm:p-7 md:p-8 border border-slate-200/80 shadow-lg shadow-slate-200/50">
        <div className="flex items-center justify-between mb-5 pt-1 px-1">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5">
            <History className="w-5 h-5 text-primary" />
            <span>Lịch sử chăm sóc ({sortedSessions.length || 3}/{activeBooking?.total_sessions || 12})</span>
          </h3>
          <button onClick={onOpenSessions} className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors">
            Xem tất cả &gt;
          </button>
        </div>

        <div className="space-y-4">
          {sortedSessions.length > 0 ? (
            sortedSessions.map((session, idx) => (
              <div key={session.id || idx} className="flex items-center justify-between p-5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:bg-slate-100/70 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60 shadow-2xs">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-xs sm:text-sm text-slate-900">
                      Buổi {session.session_number || idx + 1} / {activeBooking?.total_sessions || 12}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {session.assigned_date ? formatViDate(session.assigned_date) : '26/07/2026'} • {session.assigned_time || '08:00 - 09:00'} (60 phút)
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold">
                      KTV: {session.completed_by_ktv?.full_name || activeBooking?.assigned_ktv?.full_name || 'KTV Demo Body'}
                    </p>
                  </div>
                </div>
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200/60 shrink-0">
                  Hoàn thành
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs font-bold italic border-2 border-dashed border-slate-200 rounded-2xl">
              Chưa có buổi chăm sóc nào được ghi nhận
            </div>
          )}
        </div>
      </div>

      {/* ── Hình ảnh trước / sau Matching Image 2 ── */}
      <div className="rounded-[2.5rem] bg-white p-6 sm:p-7 md:p-8 border border-slate-200/80 shadow-lg shadow-slate-200/50">
        <div className="flex items-center justify-between mb-5 pt-1 px-1">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-primary" />
            <span>Hình ảnh trước / sau</span>
          </h3>
          <button className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors">
            Xem tất cả &gt;
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3.5">
          {beforeAfterPhotos.map((img, idx) => (
            <div key={idx} className="relative rounded-2xl overflow-hidden aspect-square border border-slate-200 bg-slate-100 group cursor-pointer shadow-2xs">
              <Image src={img} alt={`Before after photo ${idx + 1}`} width={200} height={200} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              {idx === 4 && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center text-white font-black text-sm">
                  +8
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
