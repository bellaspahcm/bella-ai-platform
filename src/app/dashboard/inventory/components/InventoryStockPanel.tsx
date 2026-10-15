import { ArrowRightLeft, Package, PlusCircle, Search, Truck } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn, formatNumberWithSeparator } from '@/lib/utils';

import type { InventoryItem, RequestCartItem, StockFilter } from '../types';

type InventoryStockPanelProps = {
  items: InventoryItem[];
  filteredItems: InventoryItem[];
  lowCount: number;
  search: string;
  stockFilter: StockFilter;
  setSearch: (value: string) => void;
  setStockFilter: (value: StockFilter) => void;
  setShowAdd: (show: boolean) => void;
  setRestockTarget: (item: InventoryItem | null) => void;
  setRestockAmt: (amount: number) => void;
  setRequestCart: (items: RequestCartItem[]) => void;
  setShowCreateRequest: (show: boolean) => void;
};

export function InventoryStockPanel({
  items,
  filteredItems,
  lowCount,
  search,
  stockFilter,
  setSearch,
  setStockFilter,
  setShowAdd,
  setRestockTarget,
  setRestockAmt,
  setRequestCart,
  setShowCreateRequest,
}: InventoryStockPanelProps) {
  return (
    <div className="overflow-hidden customer-detail-card rounded-[2rem] border border-slate-100 bg-white shadow-xl sm:rounded-[3rem]">
      <div className="flex flex-col gap-3 border-b border-slate-50 p-4 sm:p-8">
        <div className="bella-toolbar flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 flex-grow lg:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm vật tư, SKU, danh mục..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <PremiumSelect
              value={stockFilter}
              onChange={(val) => setStockFilter(val === 'low' || val === 'ok' ? val : 'all')}
              options={[
                { value: 'all', label: `Tất cả (${items.length})` },
                { value: 'low', label: `Sắp hết (${lowCount})` },
                { value: 'ok', label: `Còn hàng (${items.length - lowCount})` },
              ]}
              className="w-full sm:w-52"
            />
            <button
              onClick={() => setShowAdd(true)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:bg-primary-hover active:scale-95 sm:whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" /> Thêm Vật Tư
            </button>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="bella-data-table min-w-[850px] text-left">
          <thead>
            <tr className="bg-slate-50/50">
              {['Vật tư', 'SKU', 'Tồn kho', 'Đơn giá', 'Hành động'].map(h => (
                <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.length === 0 ? (
              <tr><td colSpan={5} className="px-8 py-16 text-center text-slate-400 font-semibold whitespace-nowrap">Không có vật tư nào</td></tr>
            ) : filteredItems.map(item => {
              const isLow = Number(item.stock_level) <= Number(item.min_stock_level);
              const pct = Math.min(100, (Number(item.stock_level) / (Number(item.min_stock_level) * 3)) * 100);
              return (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', isLow ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-primary')}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 whitespace-nowrap">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">{item.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">{item.sku || 'N/A'}</span>
                  </td>
                  <td className="px-8 py-5 min-w-[160px] whitespace-nowrap">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-end gap-4">
                        <p className={cn('text-sm font-black whitespace-nowrap', isLow ? 'text-amber-500' : 'text-slate-900')}>
                          {item.stock_level} <span className="text-[10px] text-slate-400">{item.unit}</span>
                        </p>
                        {isLow && <span className="text-[8px] font-black text-amber-500 uppercase whitespace-nowrap">Sắp hết!</span>}
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full transition-all duration-700', isLow ? 'bg-amber-400' : 'bg-primary')} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <p className="text-sm font-black text-slate-700 whitespace-nowrap">{formatNumberWithSeparator(item.price_per_unit)}đ</p>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex gap-3 whitespace-nowrap sm:gap-4">
                      <button
                        onClick={() => {
                          setRestockTarget(item);
                          setRestockAmt(0);
                        }}
                        className="flex items-center gap-1.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:text-slate-800 transition-colors whitespace-nowrap"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" /> Điều chỉnh
                      </button>
                      <button
                        onClick={() => {
                          setRequestCart([{ name: item.name, sku: item.sku || '', qty: 10, unit: item.unit }]);
                          setShowCreateRequest(true);
                        }}
                        className="flex items-center gap-1.5 text-primary font-black text-[10px] uppercase tracking-widest hover:underline transition-all whitespace-nowrap"
                      >
                        <Truck className="w-3.5 h-3.5 shrink-0" /> Yêu cầu cấp
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
