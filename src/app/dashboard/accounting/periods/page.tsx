'use client';

import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import {
closePeriodAction,
getAccountingPeriods,
previewClosingEntries,
reopenPeriodAction,
} from '@/services/accounting-actions';
import { AnimatePresence,motion } from 'framer-motion';
import {
AlertTriangle,
ArrowRight,
Calendar,
CheckCircle2,
Loader2,
Lock,
RefreshCw,
Settings,
TrendingDown,
TrendingUp,
Unlock,
X
} from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type ClosingPreviewRow = {
  step: number;
  step_name: string;
  description: string;
  debit_account_code: string;
  credit_account_code: string;
  amount: number;
};

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'OPEN' | 'CLOSED';
};

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const stickyBodyCellClassName =
  'bg-inherit';

export default function PeriodsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);

  // Modal state for close-period workflow
  const [activeModalPeriod, setActiveModalPeriod] = useState<Period | null>(null);
  const [previewRows, setPreviewRows] = useState<ClosingPreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getAccountingPeriods();
      setPeriods((data as Period[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching periods:', err);
      toast.error('Không thể tải danh sách kỳ kế toán.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  usePageRefresh(fetchPeriods);

  // ── Step 1: open modal + load preview ────────────────────────────────────
  const handleOpenCloseModal = async (period: Period) => {
    setActiveModalPeriod(period);
    setPreviewRows([]);
    setPreviewLoading(true);
    try {
      const rows = await previewClosingEntries(period.id);
      setPreviewRows((rows as ClosingPreviewRow[]) || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Không thể tải xem trước bút toán kết chuyển.'));
      setActiveModalPeriod(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Step 2: confirm close ────────────────────────────────────────────────
  const handleConfirmClose = async () => {
    if (!activeModalPeriod) return;
    setClosing(true);
    try {
      await closePeriodAction(activeModalPeriod.id);
      toast.success(`✅ Đã đóng kỳ "${activeModalPeriod.name}" và tự động tạo bút toán kết chuyển.`);
      setActiveModalPeriod(null);
      fetchPeriods();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Lỗi khi đóng kỳ kế toán. Hãy kiểm tra lại xem còn bút toán DRAFT nào không.'));
    } finally {
      setClosing(false);
    }
  };

  // ── HQ-only: reopen closed period ────────────────────────────────────────
  const handleReopen = async (period: Period) => {
    if (!window.confirm(`Mở lại kỳ "${period.name}"?\nThao tác này sẽ unlock revenue/expenses/salary trong kỳ và cho phép sửa bút toán. CHỈ HQ Super Admin được phép.`)) return;
    setRefreshing(true);
    try {
      await reopenPeriodAction(period.id);
      toast.success(`Đã mở lại kỳ "${period.name}".`);
      fetchPeriods();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Không thể mở lại kỳ.'));
    } finally {
      setRefreshing(false);
    }
  };

  // Net P&L tính từ preview
  const totalRevenue = previewRows.find((r) => r.step === 1)?.amount || 0;
  const totalExpense = previewRows.find((r) => r.step === 2)?.amount || 0;
  const netPnL = totalRevenue - totalExpense;
  const isProfit = netPnL >= 0;

  return (
    <div className="space-y-8 relative">
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang cập nhật...</span>
        </div>
      )}

      {/* ── INFO HEADER CARD ── */}
      <div className="p-5 md:p-8 bg-white dark:bg-[#1C1B19] rounded-3xl md:rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">
            Nguyên tắc Đóng/Mở kỳ kế toán
          </h4>
          <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 leading-relaxed">
            Mỗi kỳ kế toán được chia theo tháng dương lịch. Khi đóng kỳ, hệ thống tự động:
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> (1) Kết chuyển doanh thu 5xx → 911</strong>,
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> (2) Kết chuyển chi phí 6xx/8xx → 911</strong>,
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> (3) Kết chuyển lãi/lỗ 911 → 421</strong> +
            khoá toàn bộ revenue/expenses/salary của tháng đó. Việc đóng kỳ <strong className="text-amber-600 dark:text-amber-400">chỉ có HQ Super Admin mở lại được</strong>.
          </p>
        </div>
      </div>

      {/* ── PERIODS LIST TABLE ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-3xl md:rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-50 dark:border-[#3E3A35]/30 pb-4">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Danh sách Kỳ kế toán
          </h4>
          <span className="text-xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
            Tổng cộng: <span className="text-slate-900 dark:text-[#EFE9E1] font-black">{periods.length}</span> kỳ
          </span>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : periods.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-extrabold uppercase text-xs tracking-wider">Không tìm thấy kỳ kế toán nào</p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className="bella-data-table min-w-[72rem] whitespace-nowrap">
              <colgroup>
                <col className="w-[18rem]" />
                <col className="w-[13rem]" />
                <col className="w-[13rem]" />
                <col className="w-[14rem]" />
                <col className="w-[14rem]" />
              </colgroup>
              <thead>
                <tr className="text-left bg-slate-50/50 dark:bg-[#11100F]/40 border-b border-slate-100 dark:border-[#3E3A35]/30">
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Kỳ kế toán (Tháng)</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Ngày bắt đầu</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Ngày kết thúc</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Hành động khóa sổ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-[#3E3A35]/20">
                {periods.map((p) => {
                  const isClosed = p.status === 'CLOSED';

                  return (
                    <motion.tr
                      key={p.id}
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.01)' }}
                      className="hover:bg-slate-50/20 dark:hover:bg-[#11100F]/10 transition-colors"
                    >
                      <td className={`${stickyBodyCellClassName} px-6 py-5`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isClosed ? 'bg-slate-100 text-slate-400' : 'bg-pink-50 text-primary dark:bg-primary/5 dark:text-primary'
                          }`}>
                            <Calendar className="w-4 h-4" />
                          </div>
                          <span className="font-mono font-black text-slate-800 dark:text-[#EFE9E1] text-sm">
                            Tháng {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/80 font-mono">
                        {p.start_date}
                      </td>
                      <td className="px-6 py-5 text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/80 font-mono">
                        {p.end_date}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${
                          isClosed
                            ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/20 dark:text-slate-500 border-slate-200/50'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100/50'
                        }`}>
                          {isClosed ? (<><Lock className="w-3 h-3" /> Đã khóa sổ (CLOSED)</>) : (<><Unlock className="w-3 h-3 text-emerald-500" /> Đang mở (OPEN)</>)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {isClosed ? (
                          <button
                            onClick={() => handleReopen(p)}
                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-4xs font-black uppercase tracking-widest transition-all cursor-pointer border border-amber-200/50 active:scale-95"
                            title="Mở lại kỳ này (chỉ HQ Super Admin)"
                          >
                            <Unlock className="w-3 h-3" />
                            Mở lại
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenCloseModal(p)}
                            className="inline-flex items-center gap-1 bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-xl text-3xs font-black uppercase tracking-widest transition-all cursor-pointer border-none active:scale-95"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Khóa sổ kỳ này
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CLOSE PERIOD CONFIRMATION MODAL (Preview + Confirm) ── */}
      <AnimatePresence>
        {activeModalPeriod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !closing && setActiveModalPeriod(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-primary/15 dark:border-[#3E3A35]/50 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal header */}
              <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-slate-100 dark:border-[#3E3A35]/30 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-[#EFE9E1] flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Xem trước Bút toán Kết chuyển
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 break-words">
                    Kỳ kế toán: <strong className="font-mono">Tháng {activeModalPeriod.name}</strong> ({activeModalPeriod.start_date} → {activeModalPeriod.end_date})
                  </p>
                </div>
                <button
                  onClick={() => !closing && setActiveModalPeriod(null)}
                  disabled={closing}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#11100F] hover:bg-slate-200 dark:hover:bg-[#3E3A35] flex items-center justify-center text-slate-500 dark:text-[#CDBCAB] cursor-pointer transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6">
                {previewLoading ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Đang tính số dư các tài khoản 5xx, 6xx, 8xx...</span>
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="py-16 text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-3" />
                    <p className="font-bold text-slate-500">Không có dữ liệu để kết chuyển trong kỳ này.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 3 step preview cards */}
                    {previewRows.map((row) => (
                      <div
                        key={row.step}
                        className="p-4 sm:p-5 rounded-2xl bg-slate-50/40 dark:bg-[#11100F]/40 border border-slate-100 dark:border-[#3E3A35]/30 flex items-start gap-3 sm:gap-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary font-black text-sm shrink-0">
                          {row.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2 gap-2 sm:gap-4">
                            <div>
                              <h5 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1]">{row.step_name}</h5>
                              <p className="text-2xs text-slate-500 dark:text-[#CDBCAB]/70 mt-0.5">{row.description}</p>
                            </div>
                            <span className="font-mono font-black text-base text-slate-900 dark:text-[#EFE9E1] shrink-0">
                              {fmtVND(Number(row.amount))}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#3E3A35]/30">
                            <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-3xs font-black font-mono tracking-wider">
                              Nợ {row.debit_account_code}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-3xs font-black font-mono tracking-wider">
                              Có {row.credit_account_code}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Net P&L summary */}
                    <div className={`p-5 rounded-2xl border-2 ${
                      isProfit
                        ? 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                    } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                      <div className="flex items-center gap-3">
                        {isProfit ? (
                          <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                        )}
                        <div>
                          <h5 className={`text-sm font-black ${isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            Kết quả kinh doanh ròng
                          </h5>
                          <p className="text-2xs text-slate-500 dark:text-[#CDBCAB]/70 mt-0.5">
                            Doanh thu {fmtVND(totalRevenue)} − Chi phí {fmtVND(totalExpense)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-mono font-black text-xl sm:text-2xl ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isProfit ? '+' : '−'}{fmtVND(Math.abs(netPnL))}
                      </span>
                    </div>

                    {/* Warning */}
                    <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                        <p className="font-bold mb-1">Sau khi xác nhận đóng kỳ, hệ thống sẽ:</p>
                        <ul className="space-y-1 text-2xs">
                          <li>• Tự động tạo và POST 3 bút toán kết chuyển ở trên</li>
                          <li>• Khoá toàn bộ <strong>revenue / expenses / salary_records</strong> của tháng (không sửa được nữa)</li>
                          <li>• Cấm tạo bút toán mới trong kỳ này (kể cả qua API)</li>
                          <li>• Chỉ <strong>HQ Super Admin</strong> mới mở lại được</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="px-5 sm:px-8 py-5 border-t border-slate-100 dark:border-[#3E3A35]/30 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  onClick={() => setActiveModalPeriod(null)}
                  disabled={closing}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-100 dark:hover:bg-[#11100F] cursor-pointer transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmClose}
                  disabled={closing || previewLoading || previewRows.length === 0}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                >
                  {closing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang đóng kỳ...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Xác nhận đóng kỳ
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
