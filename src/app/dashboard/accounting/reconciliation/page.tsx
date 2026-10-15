'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompareArrows,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { getAccountingMode, syncLegacyToLedger, createSalaryAccrualJournals, type ReconciliationRow } from '@/services/accounting-actions';
import { toast } from 'sonner';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { getCachedReconciliationReportForPage } from '@/lib/accounting-subpages-client-cache';
import { useTenantName } from '@/hooks/useTenantName';

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const dateInputClassName =
  'h-11 w-full min-w-[10.75rem] rounded-xl border border-slate-100 bg-slate-50 px-4 pr-10 text-xs font-bold text-slate-800 outline-none [color-scheme:light] dark:border-[#3E3A35]/50 dark:bg-[#11100F] dark:text-[#EFE9E1] dark:[color-scheme:dark]';
const dateLabelClassName =
  'text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest whitespace-nowrap';
const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'w-full min-w-[64rem] border-collapse whitespace-nowrap';
const stickyHeaderCellClassName =
  'bg-slate-50 dark:bg-[#11100F]';
const stickyBodyCellClassName =
  'bg-inherit';

const STATUS_CONFIG = {
  MATCH: {
    label: 'Khớp',
    color: 'emerald',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  MINOR_DIFF: {
    label: 'Lệch nhẹ',
    color: 'amber',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  MAJOR_DIFF: {
    label: 'Lệch lớn',
    color: 'rose',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    icon: XCircle,
  },
};

type PostSyncSummary = {
  syncedRevenueCount: number;
  syncedExpenseCount: number;
  syncedSalaryCount: number;
  totalChecks: number;
  matchCount: number;
  minorDiffCount: number;
  majorDiffCount: number;
  matchRate: number;
  majorDiffLabels: string[];
  checkedFrom: string;
  checkedTo: string;
};

function buildPostSyncSummary(params: {
  rows: ReconciliationRow[];
  syncedRevenueCount: number;
  syncedExpenseCount: number;
  syncedSalaryCount: number;
  checkedFrom: string;
  checkedTo: string;
}): PostSyncSummary {
  const totalChecks = params.rows.length;
  const matchCount = params.rows.filter((row) => row.status === 'MATCH').length;
  const minorDiffCount = params.rows.filter((row) => row.status === 'MINOR_DIFF').length;
  const majorDiffRows = params.rows.filter((row) => row.status === 'MAJOR_DIFF');

  return {
    syncedRevenueCount: params.syncedRevenueCount,
    syncedExpenseCount: params.syncedExpenseCount,
    syncedSalaryCount: params.syncedSalaryCount,
    totalChecks,
    matchCount,
    minorDiffCount,
    majorDiffCount: majorDiffRows.length,
    matchRate: totalChecks > 0 ? (matchCount / totalChecks) * 100 : 0,
    majorDiffLabels: majorDiffRows.map((row) => row.category_label),
    checkedFrom: params.checkedFrom,
    checkedTo: params.checkedTo,
  };
}

export default function ReconciliationPage() {
  const { tenantName } = useTenantName();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [accountingMode, setAccountingMode] = useState<'SIMPLE' | 'PROFESSIONAL'>('SIMPLE');
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [postSyncSummary, setPostSyncSummary] = useState<PostSyncSummary | null>(null);
  const [syncingSalaryAccrual, setSyncingSalaryAccrual] = useState(false);

  // Khởi tạo ngày tháng an toàn sau khi mount ở Client để tránh Hydration Mismatch về múi giờ
  useEffect(() => {
    const d = new Date();
    d.setDate(1);
    const defaultFromDate = d.toISOString().slice(0, 10);
    const defaultToDate = new Date().toISOString().slice(0, 10);
    queueMicrotask(() => {
      setFromDate(defaultFromDate);
      setToDate(defaultToDate);
    });

    // Đọc cấu hình chế độ kế toán
    getAccountingMode()
      .then((mode) => setAccountingMode(mode))
      .catch((err) => {
        console.error('Lỗi khi đọc chế độ kế toán:', err);
        toast.error(getErrorMessage(err, 'Không thể đọc chế độ kế toán hiện tại.'));
      });
  }, []);

  const fetchData = useCallback(async (
    fromStr: string,
    toStr: string,
    options?: { force?: boolean; toastOnError?: boolean }
  ) => {
    if (!fromStr || !toStr) return [];
    setRefreshing(true);
    try {
      const data = await getCachedReconciliationReportForPage(fromStr, toStr, { force: options?.force });
      const nextRows = data || [];
      setRows(nextRows);
      return nextRows;
    } catch (err: unknown) {
      console.error('Error fetching reconciliation:', err);
      if (options?.toastOnError !== false) {
        toast.error(getErrorMessage(err, 'Không thể tải báo cáo đối soát.'));
      }
      throw err;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncLegacyToLedger();
      if (!res.success) {
        toast.warning(res.error || 'Chưa thể bật Professional Core. Kiểm tra tab Sẵn sàng dữ liệu trước khi đồng bộ.');
        return;
      }

      toast.success(`Đồng bộ thành công! Đã hạch toán ${res.syncedRevenueCount} doanh thu, ${res.syncedExpenseCount} chi phí, và ${res.syncedSalaryCount} bảng lương KTV.`);
      setAccountingMode('PROFESSIONAL');
      setShowSyncModal(false);
      if (fromDate && toDate) {
        try {
          const refreshedRows = await fetchData(fromDate, toDate, { force: true, toastOnError: false });
          const summary = buildPostSyncSummary({
            rows: refreshedRows,
            syncedRevenueCount: res.syncedRevenueCount,
            syncedExpenseCount: res.syncedExpenseCount,
            syncedSalaryCount: res.syncedSalaryCount,
            checkedFrom: fromDate,
            checkedTo: toDate,
          });
          setPostSyncSummary(summary);

          if (summary.majorDiffCount > 0) {
            toast.warning(`Đồng bộ xong nhưng còn ${summary.majorDiffCount} chỉ tiêu lệch lớn. Vui lòng xử lý trước khi dùng báo cáo CFO.`);
          } else {
            toast.success('Đối soát sau sync không phát hiện lệch lớn.');
          }
        } catch (reportError: unknown) {
          console.error('Post-sync reconciliation failed:', reportError);
          toast.error(getErrorMessage(reportError, 'Đồng bộ thành công nhưng không tải được báo cáo đối soát sau sync.'));
        }
      }
    } catch (err: unknown) {
      console.error('Error during migration:', err);
      toast.error(getErrorMessage(err, 'Có lỗi xảy ra trong quá trình đồng bộ kế toán.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSalaryAccrual = async () => {
    if (!fromDate || !toDate) {
      toast.warning('Vui lòng chọn kỳ đối soát trước khi đồng bộ bút toán lương.');
      return;
    }
    setSyncingSalaryAccrual(true);
    try {
      const res = await createSalaryAccrualJournals(fromDate, toDate);
      if (res.created === 0 && res.skipped === 0) {
        toast.info('Không có bảng lương nào cần đồng bộ bút toán trong kỳ này.');
      } else {
        toast.success(
          `Đã tạo ${res.created} bút toán lương cố định${
            res.skipped > 0 ? ` (bỏ qua ${res.skipped} bảng lương = 0đ)` : ''
          }.`
        );
        await fetchData(fromDate, toDate, { force: true });
      }
    } catch (err: unknown) {
      console.error('Error syncing salary accrual:', err);
      toast.error(
        err instanceof Error ? err.message : 'Có lỗi khi tạo bút toán lương cố định.'
      );
    } finally {
      setSyncingSalaryAccrual(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate) {
      Promise.resolve()
        .then(() => fetchData(fromDate, toDate))
        .catch(() => undefined);
    }
  }, [fetchData, fromDate, toDate]);

  const handleSoftRefresh = useCallback(async () => {
    await fetchData(fromDate, toDate, { force: true });
  }, [fetchData, fromDate, toDate]);

  usePageRefresh(handleSoftRefresh);

  const totalChecks = rows.length;
  const matchCount = rows.filter((r) => r.status === 'MATCH').length;
  const minorDiffCount = rows.filter((r) => r.status === 'MINOR_DIFF').length;
  const majorDiffCount = rows.filter((r) => r.status === 'MAJOR_DIFF').length;
  const matchRate = totalChecks > 0 ? (matchCount / totalChecks) * 100 : 0;
  const biggestDiff = rows.reduce(
    (max, r) => (Math.abs(r.diff_amount) > Math.abs(max.diff_amount) ? r : max),
    rows[0] || { diff_amount: 0, category_label: '—' } as ReconciliationRow
  );

  return (
    <div className="space-y-8 relative">
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tính đối soát...</span>
        </div>
      )}

      {/* ── INTRO BANNER ── */}
      <div className="p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
          <GitCompareArrows className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">
            Đối soát chéo: Finance cũ ↔ Accounting Ledger
          </h4>
          <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 leading-relaxed">
            So sánh sum doanh thu/chi phí giữa
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> nguồn cũ </strong>
            (bảng <code>revenue</code> + <code>expenses</code> + <code>salary_records</code>) với
            <strong className="text-slate-700 dark:text-[#EFE9E1]"> nguồn mới </strong>
            (sổ cái kế toán <code>journal_entries</code> qua Outbox Pattern). Mục đích: chạy
            song song 1 tháng để verify accounting engine ghi đúng, sau khi match 100% thì
            deprecate UI Finance cũ.
          </p>
          <p className="text-2xs text-amber-700 dark:text-amber-400 mt-2 italic">
            ⓘ Lệch &lt; 1 VND = MATCH · Lệch &lt; 1% = MINOR_DIFF · Lệch ≥ 1% = MAJOR_DIFF cần điều tra.
          </p>
        </div>
      </div>

      {/* ── DUAL-MODE ACCOUNTING BANNER ── */}
      {accountingMode === 'SIMPLE' ? (
        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-[2rem] border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Hệ thống kế toán đang ở chế độ Đơn giản (Legacy Finance)
              </h5>
              <p className="text-3xs font-medium text-amber-700/80 dark:text-amber-400/70 mt-1 max-w-2xl leading-relaxed">
                {tenantName || 'Bella Spa ERP'} hiện vận hành song song sổ sách cũ. Để kích hoạt hạch toán kép chuyên nghiệp chuẩn Thông tư 133, vui lòng click nút bên dưới để tự động đồng bộ lịch sử thu/chi/lương vào sổ cái kế toán mới và chuyển đổi chế độ.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-3xs font-black uppercase tracking-widest transition-all shadow-md shrink-0 self-start md:self-auto cursor-pointer"
          >
            Đồng bộ & Kích hoạt Kế toán Chuyên nghiệp
          </button>
        </div>
      ) : (
        <div className="px-6 py-4 bg-emerald-50/40 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
            <span className="text-3xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              Đã kích hoạt chế độ Kế toán Chuyên nghiệp (Thông tư 133)
            </span>
          </div>
          <button
            onClick={handleSyncSalaryAccrual}
            disabled={syncingSalaryAccrual}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-3xs font-black uppercase tracking-widest transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${syncingSalaryAccrual ? 'animate-spin' : ''}`} />
            {syncingSalaryAccrual ? 'Đang đồng bộ…' : 'Đồng bộ bút toán lương'}
          </button>
        </div>
      )}


      {/* ── FILTER + SUMMARY ── */}
      {postSyncSummary && (
        <div
          className={`rounded-[2rem] border p-6 shadow-sm ${
            postSyncSummary.majorDiffCount > 0
              ? 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
              : 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex items-start gap-3">
              {postSyncSummary.majorDiffCount > 0 ? (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h5 className={`text-xs font-black uppercase tracking-wider ${postSyncSummary.majorDiffCount > 0 ? 'text-rose-800 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                  Kiểm tra sau đồng bộ Professional
                </h5>
                <p className={`mt-1 text-2xs font-semibold leading-relaxed ${postSyncSummary.majorDiffCount > 0 ? 'text-rose-700/80 dark:text-rose-300/80' : 'text-emerald-700/80 dark:text-emerald-300/80'}`}>
                  Kỳ đối soát {postSyncSummary.checkedFrom} → {postSyncSummary.checkedTo}: khớp {postSyncSummary.matchCount}/{postSyncSummary.totalChecks} chỉ tiêu ({postSyncSummary.matchRate.toFixed(0)}%).
                </p>
                {postSyncSummary.majorDiffCount > 0 ? (
                  <p className="mt-2 text-2xs font-bold text-rose-800 dark:text-rose-200">
                    Không nên dùng báo cáo CFO/Professional cho quyết định vận hành cho tới khi xử lý: {postSyncSummary.majorDiffLabels.join(', ')}.
                  </p>
                ) : (
                  <p className="mt-2 text-2xs font-bold text-emerald-800 dark:text-emerald-200">
                    Không phát hiện lệch lớn sau sync. Có thể tiếp tục kiểm tra báo cáo Professional.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[360px]">
              <div className="rounded-2xl bg-white/70 dark:bg-[#11100F]/40 border border-white/70 dark:border-[#3E3A35]/50 p-3">
                <p className="text-[10px] uppercase tracking-wider font-black opacity-60">Doanh thu</p>
                <p className="text-lg font-mono font-black">{postSyncSummary.syncedRevenueCount}</p>
              </div>
              <div className="rounded-2xl bg-white/70 dark:bg-[#11100F]/40 border border-white/70 dark:border-[#3E3A35]/50 p-3">
                <p className="text-[10px] uppercase tracking-wider font-black opacity-60">Chi phí</p>
                <p className="text-lg font-mono font-black">{postSyncSummary.syncedExpenseCount}</p>
              </div>
              <div className="rounded-2xl bg-white/70 dark:bg-[#11100F]/40 border border-white/70 dark:border-[#3E3A35]/50 p-3">
                <p className="text-[10px] uppercase tracking-wider font-black opacity-60">Lương</p>
                <p className="text-lg font-mono font-black">{postSyncSummary.syncedSalaryCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Date filter */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className={`${dateLabelClassName} mb-3`}>Kỳ đối soát</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={dateInputClassName}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={dateInputClassName}
            />
          </div>
        </div>

        {/* Match rate */}
        <div className={`rounded-2xl border p-5 ${matchRate === 100 ? 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : matchRate >= 66 ? 'bg-amber-50/40 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' : 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'}`}>
          <p className="text-3xs font-black uppercase tracking-widest opacity-70 mb-2">Tỷ lệ khớp</p>
          <p className={`text-2xl font-mono font-black ${matchRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : matchRate >= 66 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {matchRate.toFixed(0)}%
          </p>
          <p className="text-3xs text-slate-500 mt-1">
            {matchCount}/{totalChecks} chỉ tiêu
          </p>
        </div>

        {/* Counts */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Phân loại</p>
          <div className="space-y-1 text-2xs">
            <p className="flex items-center justify-between"><span className="text-emerald-600">✓ Khớp</span><strong className="font-mono">{matchCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-amber-600">⚠ Lệch nhẹ</span><strong className="font-mono">{minorDiffCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-rose-600">✕ Lệch lớn</span><strong className="font-mono">{majorDiffCount}</strong></p>
          </div>
        </div>

        {/* Biggest diff */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Lệch lớn nhất</p>
          <p className="text-xs font-bold text-slate-700 dark:text-[#CDBCAB] truncate">{biggestDiff?.category_label || '—'}</p>
          <p className={`text-sm font-mono font-black mt-1 ${Math.abs(biggestDiff?.diff_amount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {fmtVND(biggestDiff?.diff_amount || 0)}
          </p>
        </div>
      </div>

      {/* ── COMPARISON TABLE ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary dark:text-primary" />
          Bảng so sánh chi tiết
        </h4>

        {loading ? (
          <SkeletonTable />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Chưa có dữ liệu đối soát cho kỳ này</p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                  <th className={`${stickyHeaderCellClassName} px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest`}>Chỉ tiêu</th>
                  <th className="px-4 py-4 text-3xs font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest text-right">Nguồn cũ (Legacy)</th>
                  <th className="px-4 py-4 text-3xs font-black text-pink-500 dark:text-pink-400 uppercase tracking-widest text-right">Nguồn mới (Ledger)</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Chênh lệch</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">% lệch</th>
                  <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                {rows.map((row) => {
                  // Chuẩn hóa status và fallback an toàn tránh crash render
                  const statusKey = (row.status || '').toUpperCase() as keyof typeof STATUS_CONFIG;
                  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.MAJOR_DIFF;
                  const StatusIcon = cfg?.icon || XCircle;

                  return (
                    <motion.tr
                      key={row.category}
                      whileHover={{ backgroundColor: 'rgba(244,63,94,0.02)' }}
                      className="transition-colors"
                    >
                      <td className={`${stickyBodyCellClassName} px-4 py-4 font-bold text-slate-900 dark:text-[#EFE9E1]`}>
                        {row.category_label}
                        <p className="text-3xs text-slate-400 font-mono mt-0.5">{row.category}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        {fmtVND(row.legacy_amount)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-pink-700 dark:text-pink-300">
                        {fmtVND(row.ledger_amount)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-black ${Math.abs(Number(row.diff_amount)) < 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {Number(row.diff_amount) > 0 ? '+' : ''}{fmtVND(row.diff_amount)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-bold ${Number(row.diff_percent) === 0 ? 'text-emerald-500' : Number(row.diff_percent) < 1 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {Number(row.diff_percent).toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Action links ── */}
        {majorDiffCount > 0 && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold mb-2">Phát hiện {majorDiffCount} chỉ tiêu lệch lớn (≥1%). Để điều tra:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link
                  href="/dashboard/accounting/journals"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Xem Journal Ledger
                </Link>
                <Link
                  href="/dashboard/finance"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Xem Finance UI cũ
                </Link>
                <Link
                  href="/dashboard/accounting/outbox?status=DEAD"
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-3xs font-black uppercase tracking-widest hover:bg-amber-200 transition-colors"
                >
                  → Outbox DEAD events
                </Link>
              </div>
              <p className="text-3xs mt-3 italic">
                Nguyên nhân thường gặp: outbox event chưa được worker xử lý / journal entry bị CANCELED không-đúng / thiếu COA account cho category mới.
              </p>
            </div>
          </div>
        )}

        {matchRate === 100 && totalChecks > 0 && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              <strong>Khớp 100% trong kỳ này.</strong> Khi duy trì 100% trong 30 ngày liên tiếp,
              có thể deprecate UI Finance cũ và switch hoàn toàn sang Accounting Ledger.
            </p>
          </div>
        )}
      </div>

      {/* ── SYNC & MIGRATION MODAL ── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1B19] rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-2xl p-6 md:p-8 max-w-md w-full relative z-50 animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Kích hoạt Kế toán Chuyên nghiệp
            </h4>
            <div className="space-y-3 text-2xs text-slate-600 dark:text-[#CDBCAB]/80 leading-relaxed font-medium">
              <p>
                Hệ thống sẽ thực hiện các thao tác tự động sau:
              </p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Quét toàn bộ dữ liệu lịch sử các khoản thu, chi và bảng lương KTV đã xác nhận.</li>
                <li>Tự động tạo các bút toán kép hạch toán thẳng vào Sổ Nhật Ký Chung của Sổ Cái mới.</li>
                <li>Kích hoạt chế độ <strong>Kế toán Chuyên nghiệp (Thông tư 133)</strong> cho chi nhánh này.</li>
                <li className="text-amber-600 dark:text-amber-400 font-bold">Khóa đóng băng các màn hình Legacy Finance cũ để ngăn chặn việc nhập liệu trùng lặp.</li>
              </ul>
              <p className="text-3xs italic text-slate-400 mt-2">
                ⓘ Quá trình này được chạy an toàn (Idempotent) nên không lo bị trùng lặp bút toán nếu đồng bộ lại.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={syncing}
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#11100F] border border-slate-200 dark:border-[#3E3A35]/50 hover:bg-slate-200 text-slate-700 dark:text-[#CDBCAB] text-3xs font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                disabled={syncing}
                onClick={handleSync}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-slate-400 disabled:to-slate-400 text-white text-3xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang đồng bộ...
                  </>
                ) : (
                  'Bắt đầu đồng bộ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
