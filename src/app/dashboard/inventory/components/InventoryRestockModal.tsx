import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightLeft, RefreshCw, ShieldCheck } from 'lucide-react';

import type { InventoryItem } from '../types';

type InventoryRestockModalProps = {
  target: InventoryItem | null;
  restockAmt: number;
  submitting: boolean;
  setRestockAmt: (amount: number) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function InventoryRestockModal({
  target,
  restockAmt,
  submitting,
  setRestockAmt,
  onClose,
  onSubmit,
}: InventoryRestockModalProps) {
  return (
    <AnimatePresence>
      {target && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-10 max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:rounded-[3rem] sm:p-10"
          >
            <div className="mb-6 text-center sm:mb-8">
              <div className="w-16 h-16 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-slate-600">
                <ArrowRightLeft className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Điều Chỉnh Tồn Kho</h3>
              <p className="text-slate-500 text-sm mt-1">{target.name}</p>
              <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 mt-4 text-[10px] text-amber-600 font-bold uppercase tracking-wider text-center">
                Chỉ dùng để hiệu chỉnh hao hụt thực tế cục bộ.
              </div>
            </div>
            <div className="mb-6 space-y-4 sm:mb-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                  Số lượng điều chỉnh tăng ({target.unit})
                </label>
                <input
                  type="number"
                  value={restockAmt === 0 ? '' : restockAmt}
                  min={1}
                  placeholder="0"
                  onFocus={e => e.target.select()}
                  onChange={e => setRestockAmt(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full bg-slate-50 rounded-2xl p-4 text-xl font-black text-center outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase">Tồn kho mới</span>
                <span className="font-black text-emerald-500 text-lg">
                  {Number(target.stock_level) + restockAmt} {target.unit}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
              <button
                onClick={onSubmit}
                disabled={submitting || restockAmt <= 0}
                className="flex-[2] bg-primary text-primary-foreground py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Lưu thay đổi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
