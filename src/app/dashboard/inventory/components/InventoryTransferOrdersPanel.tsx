import { CheckCircle2, ClipboardList, RefreshCw, ShoppingCart } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { InventoryTransferOrder } from '@/services/inventory-transfer-actions';

type InventoryTransferOrdersPanelProps = {
  orders: InventoryTransferOrder[];
  loadingOrders: boolean;
  processingOrderId: string | null;
  onCreateRequest: () => void;
  onCancelOrder: (orderId: string) => void;
  onConfirmReceipt: (orderId: string) => void;
};

const STATUS_LABELS: Record<InventoryTransferOrder['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  shipped: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export function InventoryTransferOrdersPanel({
  orders,
  loadingOrders,
  processingOrderId,
  onCreateRequest,
  onCancelOrder,
  onConfirmReceipt,
}: InventoryTransferOrdersPanelProps) {
  return (
    <div className="bg-white customer-detail-card rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="bella-toolbar flex flex-col gap-4 border-b border-slate-50 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-primary w-5 h-5" /> Danh sách Lệnh chuyển kho
          </h3>
          <p className="text-slate-400 text-xs font-semibold mt-1">Các yêu cầu cấp vật tư gửi lên Tổng bộ HQ.</p>
        </div>
        <button
          onClick={onCreateRequest}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-hover active:scale-95 transition-all shadow-lg"
        >
          <ShoppingCart className="w-4 h-4" /> Tạo Yêu cầu mới
        </button>
      </div>

      <div className="w-full overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="bella-data-table min-w-[850px] text-left">
          <thead>
            <tr className="bg-slate-50/50">
              {['Mã yêu cầu', 'Ngày tạo', 'Chi tiết vật tư', 'Trạng thái', 'Vận chuyển', 'Hành động'].map(h => (
                <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loadingOrders ? (
              <tr>
                <td colSpan={6} className="px-8 py-16 text-center whitespace-nowrap">
                  <RefreshCw className="w-6 h-6 mx-auto text-slate-400 animate-spin mb-2" />
                  <p className="text-slate-400 text-sm font-bold">Đang tải danh sách lệnh chuyển kho...</p>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-semibold whitespace-nowrap">
                  Không có lệnh chuyển kho nào.
                </td>
              </tr>
            ) : orders.map(ord => {
              const isProcessingOrder = processingOrderId === ord.id;
              return (
              <tr key={ord.id} className="hover:bg-slate-50/20 transition-all text-xs font-bold text-slate-600">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono font-black text-slate-800">{ord.order_number}</span>
                  {ord.notes && <p className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[120px]">{ord.notes}</p>}
                </td>
                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                  {new Date(ord.created_at).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-6 py-4 max-w-[200px] whitespace-nowrap">
                  <div className="space-y-1">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-md text-[10px] whitespace-nowrap">
                        <span className="font-black text-slate-700 truncate pr-2 max-w-[110px] whitespace-nowrap">{it.name}</span>
                        <span className="text-primary font-black whitespace-nowrap">x{it.qty} {it.unit}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap',
                      ord.status === 'pending' && 'bg-blue-50 text-blue-500',
                      ord.status === 'approved' && 'bg-indigo-50 text-indigo-500',
                      ord.status === 'shipped' && 'bg-amber-50 text-amber-500 animate-pulse',
                      ord.status === 'completed' && 'bg-emerald-50 text-emerald-500',
                      ord.status === 'cancelled' && 'bg-rose-50 text-rose-500',
                    )}
                  >
                    {STATUS_LABELS[ord.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-[10px] whitespace-nowrap">
                  {ord.shipping_carrier ? (
                    <div className="whitespace-nowrap">
                      <p className="font-black text-slate-800 whitespace-nowrap">{ord.shipping_carrier}</p>
                      <p className="text-slate-400 font-mono mt-0.5 whitespace-nowrap">{ord.tracking_number}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400 whitespace-nowrap">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2 whitespace-nowrap">
                    {ord.status === 'pending' && (
                      <button
                        onClick={() => onCancelOrder(ord.id)}
                        disabled={Boolean(processingOrderId)}
                        className="text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-widest text-[9px] font-black whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessingOrder ? 'Đang hủy...' : 'Hủy đơn'}
                      </button>
                    )}
                    {ord.status === 'shipped' && (
                      <button
                        onClick={() => onConfirmReceipt(ord.id)}
                        disabled={Boolean(processingOrderId)}
                        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl transition-all shadow-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessingOrder ? <RefreshCw className="w-3 h-3 shrink-0 animate-spin" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                        {isProcessingOrder ? 'Đang nhận' : 'Đã Nhận'}
                      </button>
                    )}
                    {ord.status === 'completed' && (
                      <span className="text-emerald-500 flex items-center gap-0.5 text-[10px] font-black uppercase whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Thành công
                      </span>
                    )}
                    {ord.status === 'cancelled' && (
                      <span className="text-slate-400 italic text-[10px] font-medium whitespace-nowrap">
                        {ord.rejection_reason || 'Đã hủy'}
                      </span>
                    )}
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
