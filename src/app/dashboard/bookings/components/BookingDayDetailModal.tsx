'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Package,
  Printer,
  QrCode,
  TrendingUp,
  Users,
  X,
  XCircle,
  RotateCcw,
} from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { ServiceItemsTable } from '@/components/bookings/ServiceItemsTable';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import { useServiceItems } from '../hooks/useServiceItems';
import type { BookingInvoicePrintLog } from '@/core/services/order/invoice-print-actions';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useUser } from '@/lib/user-context';

export type KtvOption = {
  id: string;
  full_name: string;
};

export type SessionHistoryItem = {
  id: string;
  status?: string | null;
  session_number?: number | null;
  completed_date?: string | null;
  assigned_date?: string | null;
  notes?: string | null;
};

export type BookingResourceOption = {
  id: string;
  name: string;
  resource_type?: string | null;
  status?: string | null;
  location_note?: string | null;
};

export type BookingModalData = {
  id: string;
  date: Date;
  dateString?: string;
  customer?: string;
  ktv?: string;
  ktvId?: string;
  originalKtvId?: string | null;
  location?: string;
  package?: string;
  sessionNumber?: number;
  completedSessions?: number;
  totalSessions?: number;
  status?: string;
  contractDetail?: string;
  bookingId: string;
  time?: string;
  originalStatus?: string;
  originalDateString?: string;
  contractId?: string;
  sessionCount?: string;
  bookingResourceId?: string | null;
  bookingResourceName?: string | null;
  bookingResourceType?: string | null;
  packageRequiresResource?: boolean | null;
  packageDefaultResourceType?: string | null;
};

type BookingDayDetailModalProps = {
  isOpen: boolean;
  modalData: BookingModalData | null;
  ktvs: KtvOption[];
  bookingResources?: BookingResourceOption[];
  sessionHistory: SessionHistoryItem[];
  invoicePrintLogs: BookingInvoicePrintLog[];
  isLoadingInvoicePrintLogs: boolean;
  isPrintingInvoice: boolean;
  isUpdating: boolean;
  tenantId?: string; // Added for service items fetching
  onClose: () => void;
  onModalDataChange: (modalData: BookingModalData) => void;
  onOpenQrModal: (bookingId: string) => void;
  onPrintInvoice: () => void;
  onVoidInvoice: () => void;
  onSave: () => void;
  tenantModuleKey?: string | null;
};

export function BookingDayDetailModal({
  isOpen,
  modalData,
  ktvs,
  bookingResources = [],
  sessionHistory,
  invoicePrintLogs,
  isLoadingInvoicePrintLogs,
  isPrintingInvoice,
  isUpdating,
  tenantId,
  onClose,
  onModalDataChange,
  onOpenQrModal,
  onPrintInvoice,
  onVoidInvoice,
  onSave,
  tenantModuleKey,
}: BookingDayDetailModalProps) {
  const vocab = useModuleVocabulary();
  const { product } = useUser();
  const router = useRouter();
  const { serviceItems, isLoadingServiceItems, fetchServiceItems } = useServiceItems();
  const isHaircut = product?.productKey === 'bella_haircut';
  const timeLabel = isHaircut ? 'Giờ thực hiện' : 'Giờ chăm sóc';
  const resourceLabel = isHaircut ? 'Tài nguyên dịch vụ' : 'Tài nguyên chăm sóc';
  const resourcePlaceholder = isHaircut ? 'Chọn ghế/khu vực/thiết bị...' : 'Chọn giường/phòng/máy...';
  const serviceNoteLabel = isHaircut ? 'Nội dung dịch vụ hôm nay' : 'Nội dung chăm sóc hôm nay';

  useScrollLock(isOpen);
  
  // Fetch service items when modal opens with booking data
  useEffect(() => {
    if (isOpen && modalData?.bookingId && tenantId) {
      void fetchServiceItems(modalData.bookingId, tenantId);
    }
  }, [isOpen, modalData?.bookingId, tenantId, fetchServiceItems]);
  
  const completedHistory = modalData
    ? sessionHistory.filter((session) => session.status === 'completed' && session.id !== modalData.id)
    : [];

  const updateModalData = (updates: Partial<BookingModalData>) => {
    if (!modalData) return;
    onModalDataChange({ ...modalData, ...updates });
  };
  const defaultResourceType = modalData?.packageDefaultResourceType || null;
  const resourceOptions = bookingResources
    .filter((resource) => (
      resource.status === 'available'
      || resource.status === 'in_use'
      || resource.id === modalData?.bookingResourceId
    ))
    .map((resource) => ({
      value: resource.id,
      label: `${resource.name}${resource.location_note ? ` - ${resource.location_note}` : ''}`,
    }));
  const matchingResourceOptions = defaultResourceType
    ? resourceOptions.filter((option) => {
      const resource = bookingResources.find((item) => item.id === option.value);
      return resource?.resource_type === defaultResourceType || option.value === modalData?.bookingResourceId;
    })
    : resourceOptions;
  const visibleResourceOptions = matchingResourceOptions.length > 0 ? matchingResourceOptions : resourceOptions;
  const showResourceSelection = tenantModuleKey
    ? tenantModuleKey === 'beauty_spa'
    : visibleResourceOptions.length > 0;
  const formatLogTime = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  };
  const formatLogMoney = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);

  return (
    <AnimatePresence>
      {isOpen && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-[40px]"
          >
            <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-3 sm:mb-8">
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Chi tiết lịch hẹn</h3>
                  <p className="text-rose-500 font-bold mt-1">
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(modalData.date)}
                  </p>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6">
                  <div className="flex items-center gap-3 mb-4 text-slate-400">
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Nhân sự & Khách hàng</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-400 font-bold mb-1">Khách hàng</p>
                      <p className="break-words font-bold text-slate-900">{modalData.customer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold mb-2 ml-1">{vocab.worker.singular}</p>
                      <PremiumSelect
                        value={modalData.ktvId || ''}
                        options={[
                          { value: '', label: 'Chưa phân công' },
                          ...ktvs.map((ktv) => ({ value: ktv.id, label: ktv.full_name })),
                        ]}
                        onChange={(value) => {
                          const ktvName = ktvs.find((ktv) => ktv.id === value)?.full_name || 'Chưa phân công';
                          updateModalData({ ktvId: value, ktv: ktvName });
                        }}
                        placeholder={`Chọn ${vocab.worker.singular.toLowerCase()}...`}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6">
                  <div className="flex items-center gap-3 mb-4 text-slate-400">
                    <Clock className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Thời gian & Địa điểm</span>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Ngày (Dời lịch)</p>
                        <input
                          type="date"
                          value={modalData.dateString || ''}
                          onChange={(event) => updateModalData({ dateString: event.target.value })}
                          className="w-full rounded-xl border-none bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">{timeLabel}</p>
                        <input
                          type="time"
                          value={modalData.time || ''}
                          onChange={(event) => updateModalData({ time: event.target.value })}
                          className="w-full rounded-xl border-none bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                     {showResourceSelection && (
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-2 ml-1">
                          {resourceLabel}
                        </p>
                        <PremiumSelect
                          value={modalData.bookingResourceId || ''}
                          options={[
                            { value: '', label: 'Chưa gán tài nguyên' },
                            ...visibleResourceOptions,
                          ]}
                          onChange={(value) => {
                            const resource = bookingResources.find((item) => item.id === value);
                            updateModalData({
                              bookingResourceId: value || null,
                              bookingResourceName: resource?.name || null,
                              bookingResourceType: resource?.resource_type || null,
                            });
                          }}
                          placeholder={resourcePlaceholder}
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400 font-bold mb-1">Địa chỉ</p>
                      <p className="break-words text-sm font-bold leading-relaxed text-slate-900">{modalData.location}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-rose-100 bg-rose-50/50 p-4 sm:rounded-[32px] sm:p-6">
                  <div className="flex items-center gap-3 mb-4 text-rose-400">
                    <Package className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Gói dịch vụ</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-rose-400 font-bold mb-1">Liệu trình</p>
                      <p className="break-words font-bold text-slate-900">
                        {modalData.package} (Buổi {modalData.sessionNumber})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-rose-400 font-bold mb-1">Số lượng buổi</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <p className="font-bold text-slate-900">
                          {modalData.completedSessions}/{modalData.totalSessions} buổi
                        </p>
                        <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                ((modalData.completedSessions || 0) / (modalData.totalSessions || 15)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6">
                  <div className="flex items-center gap-3 mb-4 text-slate-500">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Trạng thái hiện tại
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-bold mb-2">Cập nhật trạng thái</p>
                      <PremiumSelect
                        value={modalData.status || 'scheduled'}
                        options={[
                          { value: 'scheduled', label: 'Sắp tới', icon: <Clock className="w-4 h-4" /> },
                          { value: 'in_progress', label: 'Đang thực hiện', icon: <TrendingUp className="w-4 h-4" /> },
                          { value: 'completed', label: 'Hoàn thành', icon: <CheckCircle2 className="w-4 h-4" /> },
                          { value: 'cancelled', label: 'Đã hủy', icon: <XCircle className="w-4 h-4" /> },
                        ]}
                        onChange={(value) => updateModalData({ status: value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Service Items Section - Commission System (Task 13) */}
                <ServiceItemsTable
                  items={serviceItems}
                  isLoading={isLoadingServiceItems}
                  showEditButton={true}
                  onEditClick={() => {
                    // Navigate to service items management page (Task 10)
                    if (modalData?.bookingId) {
                      onClose(); // Close modal first for smooth transition
                      router.push(`/dashboard/bookings/${modalData.bookingId}/services`);
                    }
                  }}
                  className="md:col-span-2"
                />

                <div className="space-y-4 md:col-span-2 sm:space-y-6">
                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6">
                    <div className="flex items-center gap-3 mb-4 text-slate-400">
                      <History className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Lịch sử {vocab.workUnit.singular.toLowerCase()} trước</span>
                    </div>
                    <div className="space-y-3 max-h-[150px] overflow-auto pr-2 custom-scrollbar">
                      {completedHistory.length > 0 ? (
                        completedHistory.map((session) => (
                          <div key={session.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black text-primary uppercase tracking-tighter">
                                Buổi {session.session_number}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {new Date(session.completed_date || session.assigned_date || '').toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-bold italic leading-relaxed">
                              &quot;{session.notes || 'Không có ghi chú'}&quot;
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">
                            Chưa có lịch sử hoàn thành
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 sm:rounded-[32px] sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-slate-400">
                        <Printer className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Lịch sử in bill</span>
                      </div>
                      {isLoadingInvoicePrintLogs && (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-3 max-h-[180px] overflow-auto pr-2 custom-scrollbar">
                      {invoicePrintLogs.length > 0 ? (
                        invoicePrintLogs.map((log) => {
                          const isVoided = Boolean(log.voided_at);
                          const isReprint = log.print_type === 'reprint' || log.print_count > 1;
                          return (
                            <div key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="break-words font-mono text-xs font-black text-slate-900">
                                    {log.invoice_number}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                                    In lần {log.print_count} · {formatLogTime(log.created_at)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                                    isVoided ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {isVoided ? 'Đã hủy' : 'Hiệu lực'}
                                  </span>
                                  {isReprint && (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-600">
                                      In lại
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-slate-500 sm:grid-cols-2">
                                <p>Người in: {log.printed_by_user?.full_name || '—'}</p>
                                <p className="sm:text-right">Còn thu: {formatLogMoney(log.amount_due)}</p>
                                {log.voided_at && (
                                  <>
                                    <p>Người hủy: {log.voided_by_user?.full_name || '—'}</p>
                                    <p className="sm:text-right">Hủy lúc: {formatLogTime(log.voided_at)}</p>
                                  </>
                                )}
                              </div>
                              {log.reason && (
                                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold leading-relaxed text-amber-700">
                                  Lý do in lại: {log.reason}
                                </p>
                              )}
                              {log.void_reason && (
                                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold leading-relaxed text-red-600">
                                  Lý do hủy: {log.void_reason}
                                </p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center">
                          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">
                            Chưa có lịch sử in bill
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border-2 border-primary/10 bg-white p-4 shadow-2xl shadow-primary/5 sm:rounded-[40px] sm:p-8">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 text-primary">
                        <MessageSquare className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">{serviceNoteLabel}</span>
                      </div>
                      {modalData.status === 'in_progress' && (
                        <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">
                          Đang thực hiện
                        </span>
                      )}
                    </div>
                    <textarea
                      className="w-full h-32 p-5 bg-slate-50 rounded-[24px] border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 placeholder:text-slate-300 resize-none transition-all text-sm shadow-inner"
                      placeholder="Khách hàng hôm nay thế nào? Ghi chú các kỹ thuật đã thực hiện để lần sau nắm thông tin..."
                      value={modalData.contractDetail}
                      onChange={(event) => updateModalData({ contractDetail: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 sm:mt-8">
                {/* Row 1: Invoice & Payment Actions */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    onClick={onPrintInvoice}
                    disabled={isPrintingInvoice}
                    className="bg-primary text-primary-foreground py-3.5 rounded-2xl font-bold hover:bg-primary-hover transition-all active:scale-95 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:active:scale-100 text-sm"
                  >
                    {isPrintingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span>{isPrintingInvoice ? 'Đang chuẩn bị...' : 'In hóa đơn'}</span>
                  </button>
                  <button
                    onClick={onVoidInvoice}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100/70 py-3.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Hủy bill</span>
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenQrModal(modalData.bookingId);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 border border-rose-100/50 py-3.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Thanh toán VietQR</span>
                  </button>
                </div>

                {/* Row 2: Save & Close */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={onSave}
                    disabled={isUpdating}
                    className="bg-primary text-primary-foreground py-4 rounded-2xl font-black hover:bg-primary-hover transition-all active:scale-95 shadow-lg shadow-primary/20 dark:shadow-none disabled:opacity-50 text-sm uppercase tracking-wider flex items-center justify-center"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Lưu thay đổi'}
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all active:scale-95 text-sm uppercase tracking-wider"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
