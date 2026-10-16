'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightLeft, CheckCircle2, X } from 'lucide-react';

import type { OrphanedRevenue } from '../types';
import { formatNumberishCurrency } from '../utils';

type AllocateRevenueModalProps = {
  isOpen: boolean;
  selectedOrphan: OrphanedRevenue | null;
  targetBookingId: string;
  isAllocating: boolean;
  onClose: () => void;
  onTargetBookingIdChange: (value: string) => void;
  onConfirm: () => void;
};

export function AllocateRevenueModal({
  isOpen,
  selectedOrphan,
  targetBookingId,
  isAllocating,
  onClose,
  onTargetBookingIdChange,
  onConfirm,
}: AllocateRevenueModalProps) {
  return (
    <AnimatePresence>
      {isOpen && selectedOrphan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900">Phân Bổ Tiền Treo</h3>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tiền đang treo</p>
                <p className="text-3xl font-black text-amber-600 mb-2">{formatNumberishCurrency(selectedOrphan.amount)}</p>
                {selectedOrphan.notes && (
                  <p className="text-xs text-slate-600 font-medium italic border-l-2 border-amber-200 pl-2">
                    Ghi chú: {selectedOrphan.notes}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Nhập Booking ID cần phân bổ vào
                </label>
                <input
                  type="text"
                  value={targetBookingId}
                  onChange={(event) => onTargetBookingIdChange(event.target.value)}
                  placeholder="VD: 123e4567-e89b-12d3..."
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  Lưu ý: Bạn có thể vào màn hình Hồ sơ khách hàng hoặc Bookings để copy chính xác ID của Booking.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onConfirm}
                  disabled={isAllocating || !targetBookingId.trim()}
                  className="w-full bg-primary hover:bg-primary-hover text-primary-foreground py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isAllocating ? 'Đang Xử Lý...' : 'Xác Nhận Phân Bổ'}
                  {!isAllocating && <CheckCircle2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
