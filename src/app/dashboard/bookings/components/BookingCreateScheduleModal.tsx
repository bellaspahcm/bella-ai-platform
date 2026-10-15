'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useUser } from '@/lib/user-context';
import { getLocalDateString } from '@bella/shared';;
import type { BookingResourceOption } from './BookingDayDetailModal';

export type BookingOption = {
  id: string;
  customers?: {
    name_mother?: string | null;
  } | null;
  packages?: {
    name?: string | null;
  } | null;
  package_name?: string | null;
};

type TimeRange = {
  start: string;
  end: string;
};

type BookingCreateScheduleModalProps = {
  isOpen: boolean;
  allBookings: BookingOption[];
  bookingResources?: BookingResourceOption[];
  selectedBookingId: string;
  defaultDate: string;
  createTimeRange: TimeRange;
  isUpdating: boolean;
  onClose: () => void;
  onSelectedBookingChange: (bookingId: string) => void;
  onCreateTimeRangeChange: (timeRange: TimeRange) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  tenantModuleKey?: string | null;
};

export function BookingCreateScheduleModal({
  isOpen,
  allBookings,
  bookingResources = [],
  selectedBookingId,
  defaultDate,
  createTimeRange,
  isUpdating,
  onClose,
  onSelectedBookingChange,
  onCreateTimeRangeChange,
  onSubmit,
  tenantModuleKey,
}: BookingCreateScheduleModalProps) {
  const { product } = useUser();
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const isHaircut = product?.productKey === 'bella_haircut';
  const modalTitle = isHaircut ? 'Tạo lịch hẹn mới' : 'Tạo lịch chăm sóc mới';
  const packageFallbackLabel = isHaircut ? 'Gói dịch vụ' : 'Gói liệu trình';
  const resourceLabel = isHaircut ? 'Tài nguyên dịch vụ' : 'Tài nguyên chăm sóc';
  const resourcePlaceholder = isHaircut ? 'Chọn ghế/khu vực/thiết bị...' : 'Chọn giường/phòng/máy...';
  const activeBookingResources = bookingResources.filter((resource) => (
    resource.status === 'available' || resource.status === 'in_use'
  ));

  const showResourceSelection = tenantModuleKey
    ? tenantModuleKey === 'beauty_spa'
    : activeBookingResources.length > 0;

  useEffect(() => {
    if (!isOpen) {
      setSelectedResourceId('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:rounded-[40px] sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between gap-3 sm:mb-8">
              <h3 className="min-w-0 break-words text-xl font-black text-slate-900 sm:text-2xl">{modalTitle}</h3>
              <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form className="space-y-5 sm:space-y-6" onSubmit={onSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Chọn Hợp đồng / Khách hàng
                  </label>
                  <input type="hidden" name="booking_id" value={selectedBookingId} />
                  <PremiumSelect
                    value={selectedBookingId}
                    options={allBookings.map((booking) => ({
                      value: booking.id,
                      label: `${booking.customers?.name_mother} - ${
                        booking.packages?.name || booking.package_name || packageFallbackLabel
                      }`,
                    }))}
                    onChange={onSelectedBookingChange}
                    placeholder="Chọn hợp đồng..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Ngày thực hiện
                    </label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={defaultDate || getLocalDateString()}
                      className="mt-1 w-full rounded-2xl border-none bg-slate-50 px-4 py-4 font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:px-6"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Giờ bắt đầu
                    </label>
                    <input
                      type="time"
                      value={createTimeRange.start}
                      onChange={(event) => onCreateTimeRangeChange({ ...createTimeRange, start: event.target.value })}
                      className="mt-1 w-full rounded-2xl border-none bg-slate-50 px-4 py-4 font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:px-6"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Giờ kết thúc
                    </label>
                    <input
                      type="time"
                      value={createTimeRange.end}
                      onChange={(event) => onCreateTimeRangeChange({ ...createTimeRange, end: event.target.value })}
                      className="mt-1 w-full rounded-2xl border-none bg-slate-50 px-4 py-4 font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:px-6"
                    />
                  </div>
                  {showResourceSelection && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        {resourceLabel}
                      </label>
                      <input type="hidden" name="booking_resource_id" value={selectedResourceId} />
                      <PremiumSelect
                        value={selectedResourceId}
                        options={[
                          { value: '', label: 'Chưa gán tài nguyên' },
                          ...activeBookingResources.map((resource) => ({
                            value: resource.id,
                            label: `${resource.name}${resource.location_note ? ` - ${resource.location_note}` : ''}`,
                          })),
                        ]}
                        onChange={setSelectedResourceId}
                        placeholder={resourcePlaceholder}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ghi chú</label>
                  <textarea
                    name="notes"
                    placeholder="Nhập yêu cầu đặc biệt..."
                    className="mt-1 h-24 w-full resize-none rounded-2xl border-none bg-slate-50 px-4 py-4 font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:px-6"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 bg-primary text-primary-foreground py-4 rounded-2xl font-bold hover:bg-primary-hover transition-all active:scale-95 shadow-lg shadow-primary/20 dark:shadow-none disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Xác nhận lịch hẹn'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
