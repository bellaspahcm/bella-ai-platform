import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, RefreshCw, ShoppingCart, Trash2, Truck, X } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';

import type { InventoryItem, RequestCartItem } from '../types';

type InventoryCreateRequestModalProps = {
  show: boolean;
  items: InventoryItem[];
  requestCart: RequestCartItem[];
  selectedItemIndex: number;
  requestQty: number;
  requestNotes: string;
  submittingOrder: boolean;
  setSelectedItemIndex: (index: number) => void;
  setRequestQty: (qty: number) => void;
  setRequestNotes: (notes: string) => void;
  addToCart: () => void;
  removeFromCart: (index: number) => void;
  submitTransferOrder: () => void;
  onClose: () => void;
};

export function InventoryCreateRequestModal({
  show,
  items,
  requestCart,
  selectedItemIndex,
  requestQty,
  requestNotes,
  submittingOrder,
  setSelectedItemIndex,
  setRequestQty,
  setRequestNotes,
  addToCart,
  removeFromCart,
  submitTransferOrder,
  onClose,
}: InventoryCreateRequestModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-white p-5 shadow-2xl sm:rounded-[3rem] sm:p-10">
            <div className="mb-5 flex flex-shrink-0 items-start justify-between gap-3 sm:mb-6">
              <h3 className="flex min-w-0 items-center gap-2 break-words text-lg font-black text-slate-900 sm:text-xl">
                <Truck className="text-primary w-5 h-5" /> Yêu Cầu Cấp Vật Tư từ HQ
              </h3>
              <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1 sm:space-y-6 sm:pr-2">
              <div className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thêm vật tư vào yêu cầu</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Chọn vật tư trong kho</label>
                    <PremiumSelect
                      value={String(selectedItemIndex)}
                      onChange={(val) => setSelectedItemIndex(Number(val))}
                      options={[
                        { value: '-1', label: '-- Chọn vật tư --' },
                        ...items.map((it, idx) => ({ value: String(idx), label: `${it.name} (${it.sku || 'Không mã SKU'})` })),
                      ]}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex-grow">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Số lượng yêu cầu</label>
                      <input
                        type="number"
                        value={requestQty === 0 ? '' : requestQty}
                        min={1}
                        placeholder="Số lượng"
                        onChange={e => setRequestQty(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm font-bold border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={addToCart} className="bg-primary hover:bg-primary-hover text-primary-foreground font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md">
                        Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5" /> Danh sách cấp vật tư ({requestCart.length})
                </h4>
                {requestCart.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl text-slate-400 text-xs font-semibold italic">
                    Chưa có vật tư nào được chọn.
                  </div>
                ) : (
                  <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                    {requestCart.map((c, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-black text-slate-800">{c.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">{c.sku || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-primary font-black text-sm">x{c.qty} {c.unit}</span>
                          <button onClick={() => removeFromCart(idx)} className="text-rose-500 hover:text-rose-700 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Ghi chú yêu cầu</label>
                <textarea
                  rows={2}
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="VD: Cần gấp phục vụ khách hàng cuối tuần..."
                  className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:pt-6 flex-shrink-0">
              <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
              <button onClick={submitTransferOrder} disabled={submittingOrder || requestCart.length === 0} className="flex-[2] bg-primary text-primary-foreground py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {submittingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Gửi yêu cầu cung ứng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
