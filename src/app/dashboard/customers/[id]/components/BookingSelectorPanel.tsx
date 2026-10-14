'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { CustomerDetailBooking } from '../types';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { Sparkles, Trash2, Calendar, ChevronRight } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  'active': { label: 'Đang thực hiện', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  'in_progress': { label: 'Đang thực hiện', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  'booked': { label: 'Đã đặt', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  'deposit_pending': { label: 'Chờ bắt đầu', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  'completed': { label: 'Hoàn thành', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
  'cancelled': { label: 'Đã hủy', bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
};

export function getStatusDisplay(status: string) {
  return STATUS_LABELS[status] || { label: status, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500' };
}

export function BookingSelectorPanel({
  bookings,
  activeBooking,
  onSelectBooking,
  onDeleteBooking,
  tenantModuleKey,
  userRole,
  selectedBookingIds,
  onToggleBookingSelection,
  isCombineMode,
  onToggleCombineMode,
  isBabyCare = false,
}: {
  bookings: CustomerDetailBooking[];
  activeBooking: CustomerDetailBooking | null;
  onSelectBooking: (booking: CustomerDetailBooking) => void;
  onDeleteBooking?: (bookingId: string) => void;
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  selectedBookingIds?: Set<string>;
  onToggleBookingSelection?: (id: string) => void;
  isCombineMode?: boolean;
  onToggleCombineMode?: () => void;
  isBabyCare?: boolean;
}) {
  const vocab = useModuleVocabulary(tenantModuleKey);
  const visibleBookings = bookings;
  const selectedCount = selectedBookingIds?.size ?? 0;

  return (
    <div className="relative mb-6 overflow-hidden rounded-[2rem] bg-white p-5 border border-slate-200/80 shadow-md shadow-slate-200/40">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight">
            Chọn đơn dịch vụ đang xem
          </h3>
          {userRole === 'admin' && visibleBookings.length >= 2 && onToggleCombineMode && (
            <button
              onClick={onToggleCombineMode}
              className={cn(
                'ml-2 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all border',
                isCombineMode
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/15'
                  : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
              )}
            >
              {isCombineMode ? '✓ Đang gộp' : '⊞ Chọn gộp'}
            </button>
          )}
        </div>

        {!isBabyCare && <button className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
          Quản lý tất cả dịch vụ <ChevronRight className="w-3.5 h-3.5" />
        </button>}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleBookings.length > 0 ? (
          visibleBookings.map((b) => {
            const statusDisplay = getStatusDisplay(b.status || '');
            const isActive = activeBooking?.id === b.id;
            const isSelected = selectedBookingIds?.has(b.id) ?? false;
            const completed = b.completed_sessions || 0;
            const total = isBabyCare ? b.total_sessions ?? 0 : b.total_sessions || 12;
            const percent = Math.min(100, Math.round((completed / Math.max(1, total)) * 100));

            return (
              <div
                key={b.id}
                onClick={() => {
                  if (isCombineMode && onToggleBookingSelection) {
                    onToggleBookingSelection(b.id);
                  } else {
                    onSelectBooking(b);
                  }
                }}
                className={cn(
                  "relative cursor-pointer rounded-2xl border p-4 transition-all flex items-start gap-4 shadow-sm hover:shadow-md",
                  isActive
                    ? "beauty-customer-theme-card text-primary-foreground border-transparent shadow-xl"
                    : isSelected
                    ? "bg-primary/10 border-primary/40 text-slate-900 ring-2 ring-primary/25"
                    : "bg-slate-50/60 text-slate-900 border-slate-200 hover:bg-white hover:border-slate-300"
                )}
              >
                {/* Package Thumbnail */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-slate-200 relative border border-slate-200">
                  <Image
                    src={isBabyCare ? '/logo.png' : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80'}
                    alt={b.package_name || 'Service Package'}
                    width={80}
                    height={80}
                    className={cn("w-full h-full", isBabyCare ? 'object-contain bg-white p-2' : 'object-cover')}
                  />
                </div>

                {/* Info Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={cn("font-black text-sm line-clamp-1", isActive ? "beauty-customer-theme-title" : "text-slate-900")}>
                      {b.package_name || (b.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Gói lẻ')}
                    </h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border",
                      statusDisplay.bg, statusDisplay.text
                    )}>
                      {statusDisplay.label}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={isActive ? "beauty-customer-theme-muted font-bold" : "text-slate-500 font-bold"}>
                        {completed}/{total} buổi
                      </span>
                      <span className={isActive ? "beauty-customer-theme-accent font-black" : "text-emerald-600 font-black"}>
                        {percent}%
                      </span>
                    </div>
                    <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isActive ? "beauty-customer-theme-progress-track" : "bg-slate-200")}>
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", isActive ? "beauty-customer-theme-progress-fill" : "bg-emerald-500")}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates / Deposit info */}
                  <div className="flex items-center gap-2 text-[10px] font-medium pt-0.5 flex-wrap">
                    <span className={isActive ? "beauty-customer-theme-muted" : "text-slate-500"}>
                      📅 Bắt đầu: {b.start_date ? new Date(b.start_date).toLocaleDateString('vi-VN') : '--/--/----'}
                    </span>
                    {(isBabyCare ? (b.deposit_amount ?? 0) > 0 : b.deposit_amount && b.deposit_amount > 0) && (
                      <span className={isActive ? "beauty-customer-theme-accent font-bold" : "text-amber-600 font-bold"}>
                        • {isBabyCare ? 'Cọc cần thu' : 'Cọc'}: {(b.deposit_amount ?? 0).toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button for admin */}
                {!isCombineMode && userRole === 'admin' && onDeleteBooking && b.status === 'cancelled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Xác nhận xóa gói "${b.package_name || 'Gói lẻ'}"?`)) {
                        onDeleteBooking(b.id);
                      }
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa gói"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Khách hàng chưa đăng ký gói dịch vụ nào
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
