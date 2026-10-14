'use client';

import Image from 'next/image';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { Calendar, ChevronRight, FileText, Image as ImageIcon, Loader2, MessageCircle, MoreHorizontal, Share2, Sparkles, User } from 'lucide-react';
import type { CustomerDetailBooking, KtvOption } from '../types';
import { getStatusDisplay } from './BookingSelectorPanel';

export function ActiveBookingPanel({
  activeBooking,
  ktvs,
  tenantModuleKey,
  userRole,
  isDepositOnly,
  activeDepositAmount,
  activeNetPrice,
  isExportingQuotation,
  isExportingCombinedQuotation,
  isUpdatingKtv,
  isCombineMode,
  selectedBookingIds,
  onOpenBooking,
  onPayRemaining,
  onOpenZalo,
  onSharePortal,
  onExportQuotation,
  onExportContract,
  onEditBooking,
  onUpdateKtv,
  onOpenBookingSessions,
  onExportCombinedQuotation,
  onShareCombinedPortal,
  isBabyCare = false,
}: {
  activeBooking: CustomerDetailBooking | null;
  ktvs: KtvOption[];
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  isDepositOnly: boolean;
  activeDepositAmount: number;
  activeNetPrice: number;
  isExportingQuotation: boolean;
  isExportingCombinedQuotation?: boolean;
  isUpdatingKtv: boolean;
  isCombineMode?: boolean;
  selectedBookingIds?: Set<string>;
  onOpenBooking: () => void;
  onPayRemaining: (amount: number) => void;
  onOpenZalo: () => void;
  onSharePortal: () => void | Promise<void>;
  onExportQuotation: () => void | Promise<void>;
  onExportContract: () => void;
  onEditBooking: () => void;
  onUpdateKtv: (ktvId: string) => void;
  onOpenBookingSessions: () => void;
  onExportCombinedQuotation?: () => void | Promise<void>;
  onShareCombinedPortal?: () => void | Promise<void>;
  isBabyCare?: boolean;
}) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  const paymentState = activeBooking
    ? calculateBookingPaymentState({
        fullPrice: activeBooking.full_price,
        discountPercent: activeBooking.discount_percent,
        depositAmount: activeBooking.deposit_amount,
        bookingStatus: activeBooking.status,
        revenues: activeBooking.revenue,
      })
    : null;
  const remainingBalance = paymentState?.remainingDebt || 0;
  const completedSessions = activeBooking?.completed_sessions || 0;
  const totalSessions = isBabyCare ? activeBooking?.total_sessions ?? 0 : activeBooking?.total_sessions || 12;
  const progressPercent = Math.min(100, Math.round((completedSessions / Math.max(1, totalSessions)) * 100));
  const displayedFullPrice = activeBooking?.full_price ?? 0;
  const displayedPaidAmount = paymentState?.totalPaid ?? 0;
  const bookingStatus = getStatusDisplay(activeBooking?.status || 'Chưa cập nhật');

  // Mock AI KTV recommendation list matching Image 2
  const aiKtvs = isBabyCare ? [] : [
    {
      id: ktvs[0]?.id || 'ktv-1',
      name: ktvs[0]?.full_name || 'KTV Demo Body',
      title: 'Kỹ thuật viên',
      score: 100,
      scoreColor: 'bg-emerald-100 text-emerald-700',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      skillScore: '22/25',
      loadScore: '17/20',
      favScore: '9/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[0]?.id || 'ktv-1'),
    },
    {
      id: ktvs[1]?.id || 'ktv-2',
      name: ktvs[1]?.full_name || 'KTV Demo Facial',
      title: 'Kỹ thuật viên',
      score: 80.5,
      scoreColor: 'bg-blue-100 text-blue-700',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
      skillScore: '18/25',
      loadScore: '14/20',
      favScore: '7/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[1]?.id || 'ktv-2'),
    },
    {
      id: ktvs[2]?.id || 'ktv-3',
      name: ktvs[2]?.full_name || 'KTV Demo An',
      title: 'Kỹ thuật viên',
      score: 72,
      scoreColor: 'bg-slate-100 text-slate-700',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=200&q=80',
      skillScore: '16/25',
      loadScore: '12/20',
      favScore: '7/10',
      isSelected: activeBooking?.assigned_ktv_id === (ktvs[2]?.id || 'ktv-3'),
    },
  ];

  if (isBabyCare && !activeBooking) return (
    <div className="mb-6 rounded-2xl bg-white border border-slate-200 p-6 text-sm text-slate-500">
      <p>Khách hàng chưa có gói chăm sóc.</p>
      <button onClick={onOpenBooking} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Calendar className="w-4 h-4" />Đăng ký gói chăm sóc</button>
    </div>
  );

  return (
    <div className="space-y-6 mb-6">
      {/* ── Theme-aware Active Package Card ── */}
      <div className="beauty-customer-theme-card beauty-customer-theme-hero-card relative overflow-hidden rounded-[2.5rem] p-6 text-primary-foreground shadow-2xl border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
          {/* Header left */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="beauty-customer-theme-media-frame w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden bg-white/15 border">
              <Image
                src={isBabyCare ? '/logo.png' : 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80'}
                alt={isBabyCare ? 'Bella BabyCare' : 'Package Thumbnail'}
                width={80}
                height={80}
                className={cn("w-full h-full", isBabyCare ? 'object-contain bg-white p-2' : 'object-cover')}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="beauty-customer-theme-accent text-[10px] font-black uppercase tracking-widest">
                  GÓI DỊCH VỤ HIỆN TẠI
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase border", isBabyCare ? `${bookingStatus.bg} ${bookingStatus.text}` : 'bg-emerald-500/20 !text-emerald-300 border-emerald-500/30')}>
                  {isBabyCare ? bookingStatus.label : 'Đang thực hiện'}
                </span>
                <span className="beauty-customer-theme-muted text-[10px] font-medium">
                  • Bắt đầu: {activeBooking?.start_date ? new Date(activeBooking.start_date).toLocaleDateString('vi-VN') : isBabyCare ? 'Chưa xếp ngày' : '24/07/2026'}
                </span>
              </div>
              <h2 className="beauty-customer-theme-title text-xl sm:text-2xl font-black leading-tight">
                {activeBooking?.packages?.name || activeBooking?.package_name || (isBabyCare ? 'Gói chăm sóc' : 'Gội Đầu Dưỡng Sinh Demo')}
              </h2>
            </div>
          </div>

          {/* Progress Widget (Right Box) */}
          <div className="beauty-customer-theme-panel backdrop-blur-md rounded-2xl p-4 min-w-[200px] w-full lg:w-auto">
            <div className="flex justify-between items-center text-xs font-black mb-1">
              <span className="beauty-customer-theme-muted uppercase text-[10px] tracking-wider">TIẾN ĐỘ</span>
              <span className="beauty-customer-theme-title">{completedSessions} / {totalSessions} buổi</span>
            </div>
            <div className="beauty-customer-theme-progress-track h-2 w-full rounded-full overflow-hidden mb-1">
              <div
                className="beauty-customer-theme-progress-fill h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="beauty-customer-theme-accent text-[10px] text-right font-bold">{progressPercent}% hoàn thành</p>
          </div>
        </div>

        {/* 4 Metric Pills Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="beauty-customer-theme-panel rounded-2xl p-3">
            <p className="beauty-customer-theme-muted text-[9px] font-bold uppercase mb-0.5">Giá gói</p>
            <p className="beauty-customer-theme-title font-black text-base">{formatNumberWithSeparator(displayedFullPrice)}đ</p>
          </div>
          <div className="beauty-customer-theme-panel rounded-2xl p-3">
            <p className="beauty-customer-theme-muted text-[9px] font-bold uppercase mb-0.5">Đã thanh toán</p>
            <p className="beauty-customer-theme-accent font-black text-base">{formatNumberWithSeparator(displayedPaidAmount)}đ</p>
          </div>
          <div className="beauty-customer-theme-panel rounded-2xl p-3">
            <p className="beauty-customer-theme-muted text-[9px] font-bold uppercase mb-0.5">Còn lại</p>
            <p className="beauty-customer-theme-title font-black text-base">{remainingBalance > 0 ? `${formatNumberWithSeparator(remainingBalance)}đ` : '0đ'}</p>
          </div>
          <div className="beauty-customer-theme-panel rounded-2xl p-3">
            <p className="beauty-customer-theme-muted text-[9px] font-bold uppercase mb-0.5">Ngày kết thúc dự kiến</p>
            <p className="beauty-customer-theme-title font-black text-base">{isBabyCare ? activeBooking?.end_date ? new Date(activeBooking.end_date).toLocaleDateString('vi-VN') : 'Chưa xếp ngày' : '15/09/2026'}</p>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="beauty-customer-theme-divider flex items-center gap-3 flex-wrap pt-2 border-t">
          <button
            onClick={onOpenBookingSessions}
            className="beauty-customer-theme-accent-cta flex-1 sm:flex-initial font-black text-xs px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>Đặt lịch buổi tiếp theo</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onEditBooking}
              className="beauty-customer-theme-ghost-button px-4 py-3 font-bold text-xs rounded-xl border transition-colors"
            >
              Sửa dịch vụ
            </button>
          )}

          <button
            onClick={onExportQuotation}
            disabled={isExportingQuotation}
            className="beauty-customer-theme-ghost-button px-4 py-3 font-bold text-xs rounded-xl border transition-colors flex items-center gap-1.5"
          >
            {isExportingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            Xuất báo giá
          </button>

          {userRole === 'admin' && !isBabyCare && (
            <button
              onClick={onExportContract}
              className="beauty-customer-theme-ghost-button px-4 py-3 font-bold text-xs rounded-xl border transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Xuất hợp đồng
            </button>
          )}

          {isBabyCare && userRole === 'admin' && remainingBalance > 0 && <button onClick={() => onPayRemaining(remainingBalance)} className="beauty-customer-theme-ghost-button px-4 py-3 font-bold text-xs rounded-xl border transition-colors">Ghi nhận thanh toán</button>}
          {!isBabyCare && <button className="beauty-customer-theme-ghost-button p-3 rounded-xl border transition-colors ml-auto">
            <MoreHorizontal className="w-4 h-4" />
          </button>}
        </div>
      </div>

      {/* ── AI ĐỀ XUẤT KTV PHÙ HỢP Matching Image 2 ── */}
      {isBabyCare && userRole === 'admin' && activeBooking && (
        <div className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" />KTV phụ trách</h3>
          <PremiumSelect
            ariaLabel="KTV phụ trách"
            value={activeBooking.assigned_ktv_id || ''}
            options={ktvs.map(ktv => ({ value: ktv.id, label: ktv.full_name || 'Chưa cập nhật tên' }))}
            placeholder={activeBooking.assigned_ktv?.full_name || 'Chưa phân công'}
            onChange={onUpdateKtv}
            disabled={isUpdatingKtv || ktvs.length === 0}
          />
          {ktvs.length === 0 && <p className="mt-3 text-xs text-slate-500">Chưa có KTV trong danh sách phân công.</p>}
        </div>
      )}
      {!isBabyCare && userRole === 'admin' && (
        <div className="rounded-[2.5rem] bg-white p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                AI ĐỀ XUẤT KTV PHÙ HỢP
              </h3>
            </div>
            <button className="text-xs font-bold text-blue-600 hover:underline">
              Giải thích đánh giá &gt;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiKtvs.map((ktv) => (
              <div
                key={ktv.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all relative space-y-3",
                  ktv.isSelected
                    ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-200"
                    : "border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md"
                )}
              >
                {/* Header info */}
                <div className="flex items-center gap-3">
                  <Image
                    src={ktv.avatar}
                    alt={ktv.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-xs text-slate-900 truncate">{ktv.name}</h4>
                    <p className="text-[10px] text-slate-500">{ktv.title}</p>
                  </div>
                  <span className={cn("px-2 py-1 rounded-full text-xs font-black shadow-sm", ktv.scoreColor)}>
                    {ktv.score}
                  </span>
                </div>

                {/* Score breakdown bars */}
                <div className="space-y-1.5 text-[10px] font-medium text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Độ phù hợp kỹ năng</span>
                    <span className="font-bold text-slate-800">{ktv.skillScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                  </div>

                  <div className="flex justify-between items-center pt-0.5">
                    <span>Độ trống ca (cân bằng tải)</span>
                    <span className="font-bold text-slate-800">{ktv.loadScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '80%' }} />
                  </div>

                  <div className="flex justify-between items-center pt-0.5">
                    <span>Khách quen & yêu thích</span>
                    <span className="font-bold text-slate-800">{ktv.favScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '90%' }} />
                  </div>
                </div>

                {/* Select button */}
                <button
                  onClick={() => onUpdateKtv(ktv.id)}
                  disabled={isUpdatingKtv}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95",
                    ktv.isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                      : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {ktv.isSelected ? '✓ Đã chọn KTV này' : 'Chọn KTV'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
