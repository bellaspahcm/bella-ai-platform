import { CheckCircle2, ClipboardCheck, Package, RefreshCw, ShieldCheck } from 'lucide-react';

import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn, formatNumberWithSeparator } from '@/lib/utils';

import { MONTHS, YEARS } from '../constants';
import type { ReconRow } from '../types';

type InventoryReconciliationPanelProps = {
  reconMonth: number;
  reconYear: number;
  reconRows: ReconRow[];
  reconLoading: boolean;
  reconSaving: boolean;
  setReconMonth: (month: number) => void;
  setReconYear: (year: number) => void;
  updateReconRow: (idx: number, patch: Partial<ReconRow>) => void;
  handleSaveReconciliation: () => void;
};

export function InventoryReconciliationPanel({
  reconMonth,
  reconYear,
  reconRows,
  reconLoading,
  reconSaving,
  setReconMonth,
  setReconYear,
  updateReconRow,
  handleSaveReconciliation,
}: InventoryReconciliationPanelProps) {
  return (
    <div className="bg-white customer-detail-card rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
      <div className="bella-toolbar flex flex-col justify-between gap-4 border-b border-slate-50 p-6 sm:p-8 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-primary w-5 h-5" /> Kiểm kê Tồn Kho Cuối Tháng
          </h3>
          <p className="text-slate-400 text-xs font-semibold mt-1 leading-relaxed">
            Nhập tồn thực tế đếm được vào cột bên phải. Hệ thống tự so với <span className="text-slate-700 font-bold">&quot;Tồn dự kiến&quot;</span> và ghi chênh lệch để đối soát hao hụt.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="grid w-full grid-cols-2 gap-2 md:w-64">
            <PremiumSelect
              value={String(reconMonth)}
              onChange={(val) => setReconMonth(Number(val))}
              options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
            />
            <PremiumSelect
              value={String(reconYear)}
              onChange={(val) => setReconYear(Number(val))}
              options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </div>
      </div>

      {reconLoading ? (
        <div className="p-16 text-center">
          <RefreshCw className="w-8 h-8 mx-auto text-primary animate-spin mb-3" />
          <p className="text-slate-400 text-sm font-bold">Đang tải báo cáo kiểm kê tháng {reconMonth + 1}/{reconYear}...</p>
        </div>
      ) : reconRows.length === 0 ? (
        <div className="p-16 text-center text-slate-400 font-semibold">
          Không có vật tư nào để kiểm kê.
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto overscroll-x-contain custom-scrollbar">
            <table className="bella-data-table min-w-[900px] text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  {['Vật tư', 'Nhập trong tháng', 'Tiêu hao trong tháng', 'Tồn dự kiến', 'Tồn thực tế', 'Chênh lệch', 'Ghi chú'].map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reconRows.map((row, idx) => {
                  const actualNum = row.actual === '' ? null : Number(row.actual);
                  const variance = actualNum === null ? null : actualNum - row.expected;
                  const varianceValue = variance === null ? 0 : variance * row.price_per_unit;
                  return (
                    <tr key={row.item_id} className="hover:bg-slate-50/30 transition-all">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-rose-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 whitespace-nowrap">{row.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{row.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-black text-emerald-600">+{row.nhap}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-black text-rose-500">-{row.tieu_hao}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-sm font-black text-slate-900">{row.expected}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.actual === '' ? '' : row.actual}
                          onFocus={e => e.target.select()}
                          onChange={e => updateReconRow(idx, { actual: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="Đếm tay..."
                          className="w-24 bg-slate-50 px-3 py-2 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {variance === null ? (
                          <span className="text-slate-300 text-xs font-bold">-</span>
                        ) : variance === 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-black">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Khớp sổ
                          </span>
                        ) : (
                          <div>
                            <span className={cn('text-sm font-black', variance > 0 ? 'text-emerald-600' : 'text-amber-600')}>
                              {variance > 0 ? '+' : ''}{variance} {row.unit}
                            </span>
                            {row.price_per_unit > 0 && (
                              <p className={cn('text-[10px] font-bold mt-0.5', variance > 0 ? 'text-emerald-500' : 'text-amber-500')}>
                                ~ {formatNumberWithSeparator(Math.abs(varianceValue))}đ
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={e => updateReconRow(idx, { notes: e.target.value })}
                          placeholder="Nguyên nhân..."
                          className="w-40 bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-xs font-bold text-slate-500 leading-relaxed">
              {(() => {
                const filled = reconRows.filter(r => r.actual !== '').length;
                const mismatch = reconRows.filter(r => r.actual !== '' && Number(r.actual) !== r.expected).length;
                return (
                  <>
                    <span className="text-slate-900">{filled}</span> / {reconRows.length} mặt hàng đã đếm
                    {mismatch > 0 && <span className="ml-3 text-amber-600">{mismatch} mặt hàng lệch sổ</span>}
                  </>
                );
              })()}
            </div>
            <button
              onClick={handleSaveReconciliation}
              disabled={reconSaving || reconRows.every(r => r.actual === '')}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary-hover active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
              {reconSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Lưu Kết Quả Kiểm Kê
            </button>
          </div>
        </>
      )}
    </div>
  );
}
