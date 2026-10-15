'use client';

import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { getCachedSalaryReconciliationReportForPage } from '@/lib/accounting-subpages-client-cache';
import { type SalaryReconciliationRow } from '@/services/accounting-actions';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
AlertTriangle,
CheckCircle2,
ChevronDown,
ChevronRight,
Clock,
HelpCircle,
RefreshCw,
Users,
XCircle,
} from 'lucide-react';
import { useCallback,useEffect,useState,Fragment } from 'react';
import { toast } from 'sonner';
import { getAccountingErrorMessage as getErrorMessage } from '@/lib/accounting-error-message';
import { hasSalaryLegacyReconciliationRecord } from '@/lib/business-rules/salary';
import { usePageRefresh } from '@/hooks/usePageRefresh';

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(n) || 0);

const monthInputClassName =
  'h-11 w-full min-w-[10.75rem] rounded-xl border border-slate-100 bg-slate-50 px-4 pr-10 text-xs font-bold text-slate-800 outline-none [color-scheme:light] dark:border-[#3E3A35]/50 dark:bg-[#11100F] dark:text-[#EFE9E1] dark:[color-scheme:dark]';
const filterLabelClassName =
  'text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest whitespace-nowrap';
const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'w-full min-w-[58rem] border-collapse whitespace-nowrap';
const stickyHeaderCellClassName =
  'bg-slate-50 dark:bg-[#11100F]';
const stickyBodyCellClassName =
  'bg-inherit';

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; icon: LucideIcon }> = {
  MATCH: {
    label: 'Khớp',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  MINOR_DIFF: {
    label: 'Lệch nhẹ',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  MAJOR_DIFF: {
    label: 'Lệch lớn',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    icon: XCircle,
  },
  PENDING_LEGACY: {
    label: 'Chưa chốt lương',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    border: 'border-slate-200 dark:border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-400',
    icon: Clock,
  },
};

export default function SalaryReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<SalaryReconciliationRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const toggleRowExpanded = useCallback((ktvId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ktvId)) {
        next.delete(ktvId);
      } else {
        next.add(ktvId);
      }
      return next;
    });
  }, []);

  const fetchData = useCallback(async (options: { force?: boolean } = {}) => {
    setRefreshing(true);
    try {
      const data = await getCachedSalaryReconciliationReportForPage(monthYear, options);
      setRows(data || []);
    } catch (err: unknown) {
      console.error('Error fetching salary reconciliation:', err);
      toast.error(getErrorMessage(err, 'Không thể tải báo cáo đối soát lương.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSoftRefresh = useCallback(async () => {
    await fetchData({ force: true });
  }, [fetchData]);

  usePageRefresh(handleSoftRefresh);

  const hasLegacyRecord = useCallback((row: SalaryReconciliationRow) => (
    hasSalaryLegacyReconciliationRecord({
      status: row.status,
      legacyStatus: row.legacy_status,
    })
  ), []);
  const reconciledRows = rows.filter(hasLegacyRecord);
  const matchCount = rows.filter((r) => r.status === 'MATCH').length;
  const minorCount = rows.filter((r) => r.status === 'MINOR_DIFF').length;
  const majorCount = rows.filter((r) => r.status === 'MAJOR_DIFF').length;
  const pendingCount = rows.filter((r) => !hasLegacyRecord(r)).length;
  const reconciledTotal = reconciledRows.length;
  const matchRate = reconciledTotal > 0 ? (matchCount / reconciledTotal) * 100 : 0;
  const totalAi = reconciledRows.reduce((s, r) => s + Number(r.ai_total || 0), 0);
  const totalLegacy = reconciledRows.reduce((s, r) => s + Number(r.legacy_total || 0), 0);
  const totalDiff = reconciledRows.reduce((s, r) => s + Number(r.diff_total || 0), 0);
  const totalDiffAbs = reconciledRows.reduce((s, r) => s + Math.abs(Number(r.diff_total || 0)), 0);

  return (
    <div className="space-y-8 relative">
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tính đối soát lương...</span>
        </div>
      )}

      {/* INTRO */}
      <div className="p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-primary/5 flex items-center justify-center text-primary dark:text-primary shrink-0">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider">
            Đối soát lương KTV: Legacy ↔ AI Computed
          </h4>
          <p className="text-xs font-medium text-slate-500 dark:text-[#CDBCAB]/70 mt-1 leading-relaxed">
            So sánh per-KTV giữa <strong>salary_records cũ</strong> (admin nhập thủ công) với
            <strong> calculate_ktv_salary_sheet</strong> (AI tự tính realtime: pro-rata công + hoa hồng + thưởng sao + KPI − khấu trừ).
            Detect drift trước khi switch hoàn toàn sang AI.
          </p>
          <p className="text-2xs text-amber-700 dark:text-amber-400 mt-2 italic">
            ⓘ Lệch &lt; 5,000đ hoặc &lt; 1% = MATCH · Lệch &lt; 5% = MINOR_DIFF · Lệch ≥ 5% = MAJOR_DIFF cần điều tra.
          </p>
        </div>
      </div>

      {/* FILTER + SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className={`${filterLabelClassName} mb-3`}>Tháng đối soát</p>
          <div className="grid grid-cols-1">
            <input
              type="month"
              value={monthYear.slice(0, 7)}
              onChange={(e) => setMonthYear(`${e.target.value}-01`)}
              className={monthInputClassName}
            />
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${matchRate === 100 ? 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : matchRate >= 66 ? 'bg-amber-50/40 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' : 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'}`}>
          <p className="text-3xs font-black uppercase tracking-widest opacity-70 mb-2">Tỷ lệ khớp</p>
          <p className={`text-2xl font-mono font-black ${matchRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : matchRate >= 66 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {reconciledTotal > 0 ? `${matchRate.toFixed(0)}%` : '—'}
          </p>
          <p className="text-3xs text-slate-500 mt-1">{matchCount}/{reconciledTotal} KTV đã chốt</p>
        </div>

        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Phân loại</p>
          <div className="space-y-1 text-2xs">
            <p className="flex items-center justify-between"><span className="text-emerald-600">✓ Khớp</span><strong className="font-mono">{matchCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-amber-600">⚠ Lệch nhẹ</span><strong className="font-mono">{minorCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-rose-600">✕ Lệch lớn</span><strong className="font-mono">{majorCount}</strong></p>
            <p className="flex items-center justify-between"><span className="text-slate-500">⏳ Chưa có legacy</span><strong className="font-mono">{pendingCount}</strong></p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1B19] rounded-2xl border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
          <p className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest mb-2">Tổng chênh lệch</p>
          <p className={`text-sm font-mono font-black mt-1 ${totalDiffAbs < 5000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {totalDiff >= 0 ? '+' : ''}{fmtVND(totalDiff)}
          </p>
          <p className="text-3xs text-slate-400 mt-1">Legacy − AI</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary dark:text-primary" />
          Bảng so sánh chi tiết per-KTV
        </h4>

        {loading ? (
          <SkeletonTable />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Chưa có dữ liệu đối soát lương cho tháng này</p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                  <th className={`${stickyHeaderCellClassName} px-3 py-3 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest`}>KTV</th>
                  <th className="px-3 py-3 text-3xs font-black text-blue-500 uppercase tracking-widest text-right">Legacy</th>
                  <th className="px-3 py-3 text-3xs font-black text-pink-500 uppercase tracking-widest text-right">AI</th>
                  <th className="px-3 py-3 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Chênh lệch</th>
                  <th className="px-3 py-3 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">% lệch</th>
                  <th className="px-3 py-3 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                {rows.map((row) => {
                  const rowHasLegacyRecord = hasLegacyRecord(row);
                  const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.PENDING_LEGACY;
                  const StatusIcon = cfg.icon;
                  const diffTotal = Number(row.diff_total || 0);
                  const diffPercent = row.diff_percent === null || row.diff_percent === undefined
                    ? null
                    : Number(row.diff_percent);
                  const isExpanded = expandedRows.has(row.ktv_id);
                  
                  return (
                    <Fragment key={row.ktv_id}>
                      {/* Main row */}
                      <motion.tr
                        key={row.ktv_id}
                        whileHover={{ backgroundColor: 'rgba(244,63,94,0.02)' }}
                        className="transition-colors cursor-pointer"
                        onClick={() => toggleRowExpanded(row.ktv_id)}
                      >
                        <td className={`${stickyBodyCellClassName} px-3 py-3 font-bold text-slate-900 dark:text-[#EFE9E1]`}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-primary dark:text-primary" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              {row.ktv_name}
                              <p className="text-3xs text-slate-400 mt-0.5">Status: {row.legacy_status}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                          {fmtVND(row.legacy_total)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-pink-700 dark:text-pink-300">
                          {fmtVND(row.ai_total)}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-black ${!rowHasLegacyRecord ? 'text-slate-400' : Math.abs(diffTotal) < 5000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {rowHasLegacyRecord ? `${diffTotal > 0 ? '+' : ''}${fmtVND(diffTotal)}` : '—'}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-bold ${!rowHasLegacyRecord ? 'text-slate-400' : diffPercent !== null && diffPercent < 5 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {rowHasLegacyRecord && diffPercent !== null ? `${diffPercent.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-4xs font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                      </motion.tr>
                      
                      {/* Expandable breakdown row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 dark:bg-[#11100F]/20">
                          <td colSpan={6} className="px-3 py-4">
                            <div className="grid grid-cols-2 gap-6 pl-8">
                              {/* Legacy breakdown */}
                              <div>
                                <h5 className="text-3xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  Kế toán chốt (Legacy)
                                </h5>
                                <div className="space-y-2 text-2xs">
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">Lương cơ bản</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.legacy_base_salary)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">Hoa hồng ca</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.legacy_session_bonus)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">KPI bonus</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.legacy_kpi_bonus)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                                      <span className="text-xs">⭐</span>
                                      Hoa hồng bán hàng
                                    </span>
                                    <span className="font-mono font-black text-amber-800 dark:text-amber-300">{fmtVND(row.legacy_product_sales_commission ?? 0)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/30">
                                    <span className="text-rose-600 dark:text-rose-400">Khấu trừ</span>
                                    <span className="font-mono font-bold text-rose-700 dark:text-rose-300">-{fmtVND(row.legacy_deductions)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-2 px-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg border-2 border-blue-300 dark:border-blue-500/40 mt-3">
                                    <span className="font-black text-blue-800 dark:text-blue-300 uppercase text-xs">Tổng</span>
                                    <span className="font-mono font-black text-blue-900 dark:text-blue-200 text-sm">{fmtVND(row.legacy_total)}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* AI breakdown */}
                              <div>
                                <h5 className="text-3xs font-black text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                                  AI tính (Computed)
                                </h5>
                                <div className="space-y-2 text-2xs">
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">Lương cơ bản</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.ai_base_salary)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">Hoa hồng ca</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.ai_session_bonus)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-[#1C1B19] rounded-lg border border-slate-100 dark:border-[#3E3A35]/30">
                                    <span className="text-slate-600 dark:text-[#CDBCAB]/70">KPI bonus</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">{fmtVND(row.ai_kpi_bonus)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                                      <span className="text-xs">⭐</span>
                                      Hoa hồng bán hàng
                                    </span>
                                    <span className="font-mono font-black text-amber-800 dark:text-amber-300">{fmtVND(row.ai_product_sales_commission ?? 0)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 px-3 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/30">
                                    <span className="text-rose-600 dark:text-rose-400">Khấu trừ</span>
                                    <span className="font-mono font-bold text-rose-700 dark:text-rose-300">-{fmtVND(row.ai_deductions)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-2 px-3 bg-pink-100 dark:bg-pink-500/20 rounded-lg border-2 border-pink-300 dark:border-pink-500/40 mt-3">
                                    <span className="font-black text-pink-800 dark:text-pink-300 uppercase text-xs">Tổng</span>
                                    <span className="font-mono font-black text-pink-900 dark:text-pink-200 text-sm">{fmtVND(row.ai_total)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-[#3E3A35]/40 bg-slate-50/40 dark:bg-[#11100F]/40 font-black">
                  <td className={`${stickyBodyCellClassName} px-3 py-4 text-xs uppercase tracking-widest text-slate-900 dark:text-[#EFE9E1]`}>Tổng cộng</td>
                  <td className="px-3 py-4 text-right font-mono text-sm text-blue-700 dark:text-blue-300">{fmtVND(totalLegacy)}</td>
                  <td className="px-3 py-4 text-right font-mono text-sm text-pink-700 dark:text-pink-300">{fmtVND(totalAi)}</td>
                  <td className={`px-3 py-4 text-right font-mono text-sm ${totalDiffAbs < 5000 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {totalDiff >= 0 ? '+' : ''}{fmtVND(totalDiff)}
                  </td>
                  <td colSpan={2} className="px-3 py-4 text-right font-mono text-3xs text-slate-500">
                    {totalAi > 0 ? `${((Math.abs(totalDiff) / totalAi) * 100).toFixed(2)}% diff` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
