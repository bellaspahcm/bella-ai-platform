'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, DollarSign, X } from 'lucide-react';

import { formatMoneyInput } from '@bella/shared';
import { cn } from '@/lib/utils';;

import type { DebtAlert, PaymentMethod } from '../types';
import { formatNumberishCurrency } from '../utils';

type DebtPaymentModalProps = {
  isOpen: boolean;
  selectedDebt: DebtAlert | null;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  isPaying: boolean;
  onClose: () => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onConfirm: () => void;
};

export function DebtPaymentModal({
  isOpen,
  selectedDebt,
  paymentAmount,
  paymentMethod,
  isPaying,
  onClose,
  onPaymentAmountChange,
  onPaymentMethodChange,
  onConfirm,
}: DebtPaymentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && selectedDebt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900">Thu Nợ Khách Hàng</h3>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Khách hàng</p>
                    <p className="text-sm font-black text-slate-900 mb-2">{selectedDebt.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mã Booking</p>
                    <p className="text-sm font-mono font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-lg border border-slate-200">
                      {selectedDebt.booking_id?.split('-')[0]?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-3">Gói Dịch Vụ</p>
                <p className="text-sm font-black text-slate-600">{selectedDebt.package_name || 'Chưa cập nhật tên gói'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Số tiền thu (VNĐ)
                </label>
                <input
                  type="text"
                  value={formatMoneyInput(paymentAmount)}
                  onChange={(event) => onPaymentAmountChange(event.target.value)}
                  placeholder="VD: 5,000,000"
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black focus:ring-2 focus:ring-primary/20 outline-none transition-all text-rose-600"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  Mặc định là số tiền khách còn nợ: <strong className="text-rose-500">{formatNumberishCurrency(selectedDebt.debt)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onPaymentMethodChange('bank_transfer')}
                    className={cn(
                      'py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center',
                      paymentMethod === 'bank_transfer'
                        ? 'bg-primary text-primary-foreground border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    Chuyển khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => onPaymentMethodChange('cash')}
                    className={cn(
                      'py-3.5 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-center',
                      paymentMethod === 'cash'
                        ? 'bg-primary text-primary-foreground border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    Tiền mặt
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onConfirm}
                  disabled={isPaying || !paymentAmount}
                  className="w-full bg-primary hover:bg-primary-hover text-primary-foreground py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-primary/20 dark:shadow-none"
                >
                  {isPaying ? 'Đang Xử Lý...' : 'Xác Nhận Thu Nợ'}
                  {!isPaying && <CheckCircle2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
