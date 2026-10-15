'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Flower2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  TrendingUp, 
  AlertCircle,
  AlertTriangle,
  UserCircle, 
  MessageSquare, 
  History, 
  ChevronRight 
} from 'lucide-react';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { resolvePackageName } from '@bella/shared';
import { cn } from '@/lib/utils';;
import { toast } from 'sonner';
import { SessionBooking } from '../types';

interface SessionCardProps {
  booking: SessionBooking;
  idx: number;
  userRole: 'KTV' | 'admin' | '';
  tenantModuleKey: TenantModuleKey | null;
  updatingId: string | null;
  isReusingId: string | null;
  onSelect: () => void;
  onUpdateProgress: (bookingId: string, quickNote: string) => Promise<void>;
  onReusePackage: (bookingId: string, customerName: string) => Promise<void>;
}

export function SessionCard({
  booking,
  idx,
  userRole,
  tenantModuleKey,
  updatingId,
  isReusingId,
  onSelect,
  onUpdateProgress,
  onReusePackage
}: SessionCardProps) {
  const [quickNote, setQuickNote] = useState('');
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  const completedCount = Number(booking.completed_sessions) || 0;
  const totalCount = Number(booking.total_sessions) || 15;
  const progress = (completedCount / Math.max(1, totalCount)) * 100;
  const isUpdating = updatingId === booking.id;
  const isFullyCompleted = completedCount >= totalCount;
  
  const today = new Date().toLocaleDateString('sv-SE');
  const alreadyDoneToday = booking.last_updated_date === today;
  const isScheduledForToday = booking.next_session_date === today;
  const hasKtv = !!booking.assigned_ktv_id;
  // Buổi quá hạn: có lịch nhưng ngày đã qua, admin chưa dời lịch hoặc ghi nhận
  const isOverdue =
    !isFullyCompleted &&
    booking.status !== 'cancelled' &&
    !!booking.next_session_date &&
    booking.next_session_date < today;

  const handleUpdateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // UI Hard Lock: Block if no KTV assigned
    if (!booking.assigned_ktv_id) {
      toast.error('⚠️ Chưa phân công KTV. Vui lòng vào trang Chi tiết khách hàng để phân KTV trước!');
      return;
    }
    
    if (alreadyDoneToday && userRole !== 'admin') {
      toast.warning(`Bạn đã cập nhật ${vocab.workUnit.singular.toLowerCase()} hôm nay rồi. Chỉ Admin mới có quyền điều chỉnh thêm!`);
      return;
    }

    if (!isScheduledForToday && userRole !== 'admin') {
      toast.warning(`Buổi này được hẹn vào ngày ${booking.next_session_date || 'chưa xác định'}. Chỉ có thể cập nhật vào đúng ngày hẹn!`);
      return;
    }

    await onUpdateProgress(booking.id, quickNote);
    setQuickNote(''); // Clear quick note on success
  };

  const handleReuseClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const customerLabel = `${customerLabels.customerPrefix} ${booking.customers?.name_mother || ''}${booking.customers?.name_baby ? ` - ${customerLabels.secondaryPrefix} ${booking.customers.name_baby}` : ''}`;
    await onReusePackage(booking.id, customerLabel);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={onSelect}
      data-testid="session-card"
      data-booking-id={booking.id}
      className="group luxury-card-white customer-card relative flex cursor-pointer flex-col gap-5 rounded-[2rem] border border-slate-100 p-4 transition-all hover:shadow-lg sm:p-6 lg:flex-row lg:items-center lg:gap-8 lg:rounded-[2.5rem]"
    >
      {/* Background blur container with overflow-hidden */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] lg:rounded-[2.5rem]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className={cn(
        "relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover:scale-110 sm:h-16 sm:w-16",
        tenantModuleKey === 'beauty_spa'
          ? "border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white"
          : "border border-pink-100 bg-gradient-to-br from-pink-50 to-white"
      )}>
        <Flower2 className="text-primary w-8 h-8" />
      </div>
      
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <h3 className="max-w-full break-words text-lg font-black tracking-tight text-slate-900 uppercase sm:text-xl">
            {customerLabels.customerPrefix} {booking.customers?.name_mother}
          </h3>
          {booking.customers?.name_baby && (
            <p className="w-full break-words text-sm font-semibold text-primary/80">
              {customerLabels.secondaryPrefix}: {booking.customers.name_baby}
            </p>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn(
              "max-w-full break-words rounded-lg border border-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.05em] text-primary",
              tenantModuleKey === 'beauty_spa' ? "bg-emerald-50" : "bg-rose-50"
            )}>
              {resolvePackageName(booking)}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
              {booking.booking_number}
            </span>
          </div>
          <span className={cn(
            "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
            booking.status === 'cancelled'
              ? 'bg-rose-50 text-rose-600 border-rose-100'
              : isFullyCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-primary/5 text-primary border-primary/10'
          )}>
            {booking.status === 'cancelled' ? 'Đã hủy' : isFullyCompleted ? 'Hoàn thành' : 'Đang thực hiện'}
          </span>
          {/* Badge cảnh báo chưa phân KTV */}
          {!hasKtv && !isFullyCompleted && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
              <AlertCircle className="w-3 h-3" />
              Chưa phân {vocab.worker.short}
            </span>
          )}
          {/* Badge cảnh báo buổi quá hạn — admin chưa dời lịch */}
          {isOverdue && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border bg-red-50 text-red-600 border-red-200 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              Trễ lịch {booking.next_session_date}
            </span>
          )}
        </div>
        
        <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3 text-sm font-bold text-slate-500">
          <div className="flex min-w-0 items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-primary/60" />
            Tiến độ: <span className="text-slate-900 font-black">{completedCount}/{totalCount} buổi</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <Calendar className="h-4 w-4 shrink-0 text-primary/60" />
            Bắt đầu: <span className="text-slate-900 font-black tracking-tighter">{booking.start_date || '---'}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <UserCircle className="h-4 w-4 shrink-0 text-primary/60" />
            {vocab.worker.short}: <span className={cn("font-black", hasKtv ? "text-slate-900" : "text-amber-500")}>
              {booking.assigned_ktv_name || 'Chưa phân công'}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full relative", isFullyCompleted ? 'bg-emerald-500' : 'bg-primary')}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 flex-col justify-center gap-3 border-slate-100 lg:min-w-[280px] lg:items-end lg:border-l lg:pl-8">
        {/* Continuity Context: Show last session's note before the new update */}
        {(() => {
          const completedLogs = (booking.session_logs || [])
            .filter((l) => l.status === 'completed')
            .sort((a, b2) => (b2.session_number || 0) - (a.session_number || 0));
          const lastLog = completedLogs[0];
          if (lastLog && lastLog.notes && !isFullyCompleted && !alreadyDoneToday) {
            return (
              <div className="w-full mb-1 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter">Ghi chú buổi {lastLog.session_number}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-600 line-clamp-2 leading-tight italic">&quot;{lastLog.notes}&quot;</p>
              </div>
            );
          }
          return null;
        })()}
        
        {!isFullyCompleted && !alreadyDoneToday && (
          <div className="relative w-full">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input 
              type="text"
              placeholder="Ghi chú nhanh buổi này..."
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              data-testid="session-quick-note-input"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        )}
        
        {!isFullyCompleted ? (
          !hasKtv ? (
            // Hard Lock UI: Chưa phân KTV
            <div className="w-full flex flex-col gap-2">
              <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-amber-700 sm:px-5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Chưa phân công {vocab.worker.short}</span>
              </div>
              <p className="text-center text-[9px] font-bold text-slate-400 leading-snug">
                Vào <Link href={`/dashboard/customers/${booking.customers?.id}?bookingId=${booking.id}`} className="text-primary hover:underline font-black cursor-pointer underline-offset-2" onClick={(e) => e.stopPropagation()}>Chi tiết khách hàng</Link> để phân {vocab.worker.short} trước khi cập nhật {vocab.workUnit.singular.toLowerCase()}
              </p>
            </div>
          ) : (
            <button 
              onClick={handleUpdateClick}
              disabled={isUpdating}
              data-testid="session-complete-button"
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 sm:px-8",
                (alreadyDoneToday || (!isScheduledForToday && userRole !== 'admin')) 
                  ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed" 
                  : cn(
                      "bg-primary text-primary-foreground dark:shadow-none hover:bg-primary-hover shadow-primary/20"
                    )
              )}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : alreadyDoneToday && userRole !== 'admin' ? (
                <><CheckCircle2 className="w-4 h-4" /> Đã xong hôm nay</>
              ) : !isScheduledForToday && userRole !== 'admin' ? (
                <><Clock className="w-4 h-4" /> Chưa đến ngày ({booking.next_session_date || '---'})</>
              ) : (
                <><ChevronRight className="w-4 h-4" /> Cập nhật buổi {(booking.completed_sessions || 0) + 1}</>
              )}
            </button>
          )
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-widest text-[10px] bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-200 justify-center">
              <CheckCircle2 className="w-4 h-4" /> Đã hoàn tất
            </div>
            <button 
              onClick={handleReuseClick}
              disabled={isReusingId === booking.id}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary-foreground shadow-md transition-all hover:bg-primary-hover active:scale-95 sm:px-6"
            >
              {isReusingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Tái sử dụng gói nhanh
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
