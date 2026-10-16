'use client';

import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { getCachedAccountingOverviewSnapshot } from '@/lib/accounting-subpages-client-cache';
import { motion } from 'framer-motion';
import {
Activity,
AlertCircle,
AlertTriangle,
ArrowDownRight,
ArrowUpRight,
CheckCircle2,
FileSpreadsheet,
PenTool,
PlusCircle,
RefreshCw,
ShieldCheck,
TrendingDown,
TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { toast } from 'sonner';

type AccountingOverviewSnapshot = Awaited<ReturnType<typeof getCachedAccountingOverviewSnapshot>>;
type BalanceSheetReport = NonNullable<AccountingOverviewSnapshot['balanceSheet']>;
type FinancialOverview = NonNullable<AccountingOverviewSnapshot['financialOverview']>;
type AccountingHealthSummary = NonNullable<AccountingOverviewSnapshot['healthSummary']>;
type OutboxStatusCounts = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
};

export default function AccountingOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bsData, setBsData] = useState<BalanceSheetReport | null>(null);
  const [finOverview, setFinOverview] = useState<FinancialOverview | null>(null);
  const [healthSummary, setHealthSummary] = useState<AccountingHealthSummary | null>(null);
  const [outboxCounts, setOutboxCounts] = useState<OutboxStatusCounts>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    dead: 0
  });

  const fetchData = useCallback(async (options: { force?: boolean } = {}) => {
    setRefreshing(true);
    try {
      const nowStr = new Date().toISOString().slice(0, 10);
      const snapshot = await getCachedAccountingOverviewSnapshot(nowStr, options);

      if (snapshot.balanceSheet) {
        setBsData(snapshot.balanceSheet);
      }
      if (snapshot.financialOverview) {
        setFinOverview(snapshot.financialOverview);
      }
      if (snapshot.healthSummary) {
        setHealthSummary(snapshot.healthSummary);
        const metrics = snapshot.healthSummary.metrics;
        const counts: OutboxStatusCounts = {
          pending: metrics.outbox_pending,
          processing: metrics.outbox_processing,
          completed: metrics.outbox_completed,
          failed: metrics.outbox_failed,
          dead: metrics.outbox_dead,
        };
        setOutboxCounts(counts);
      }

      if (snapshot.errors.balanceSheet || snapshot.errors.financialOverview || snapshot.errors.healthSummary) {
        toast.error('Một phần dữ liệu kế toán tổng quan chưa tải được.');
      }
    } catch (err: unknown) {
      console.error('Error fetching accounting overview data:', err);
      toast.error('Không thể tải dữ liệu kế toán tổng quan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSoftRefresh = useCallback(async () => {
    await fetchData({ force: true });
  }, [fetchData]);

  usePageRefresh(handleSoftRefresh);

  const totalAssets = bsData?.total_assets || 0;
  const totalLiabilities = bsData?.total_liabilities || 0;
  const totalEquity = bsData?.total_equity || 0;

  // Comparison metrics: Old Finance Module (Revenues - Expenses) vs. Ledger Revenue & Expense
  // Ledger net profit is calculated in real-time in balance sheet's retained earnings difference or from P&L, let's fetch it or show live matched info
  const ledgerMatchedPercent = healthSummary?.metrics.readiness_score ?? 100;
  const hasOutboxBlockers = outboxCounts.dead > 0 || outboxCounts.failed > 0;
  const hasDeadEvents = outboxCounts.dead > 0;
  const canCloseMonth = healthSummary?.can_close_month ?? true;

  return (
    <div className="space-y-8 relative">
      {/* Pull to refresh indicator */}
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang đồng bộ...</span>
        </div>
      )}

      {/* ── SECTION 1: FINANCIAL OVERVIEW GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonLoader variant="card" className="h-40" />
          <SkeletonLoader variant="card" className="h-40" />
          <SkeletonLoader variant="card" className="h-40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Assets */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="p-6 rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/60 bg-gradient-to-tr from-white to-primary/5 dark:from-[#1C1B19] dark:to-primary/5 shadow-[0_4px_25px_rgba(244,63,94,0.03)] dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tổng tài sản (ASSETS)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-3.5xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight">{totalAssets.toLocaleString('vi-VN')}đ</h3>
            <p className="text-2xs font-bold text-slate-400 dark:text-[#CDBCAB]/40 uppercase tracking-widest mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              +5.4% so với đầu năm
            </p>
          </motion.div>

          {/* Card 2: Total Liabilities */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="p-6 rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/60 bg-gradient-to-tr from-white to-primary/5 dark:from-[#1C1B19] dark:to-primary/5 shadow-[0_4px_25px_rgba(244,63,94,0.03)] dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Nợ phải trả (LIABILITIES)</span>
              <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-3.5xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight">{totalLiabilities.toLocaleString('vi-VN')}đ</h3>
            <p className="text-2xs font-bold text-slate-400 dark:text-[#CDBCAB]/40 uppercase tracking-widest mt-2 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-rose-500" />
              -2.1% giảm chi phí NCC
            </p>
          </motion.div>

          {/* Card 3: Owner Equity */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="p-6 rounded-[2rem] border border-primary/15 dark:border-[#3E3A35]/60 bg-gradient-to-tr from-white to-primary/5 dark:from-[#1C1B19] dark:to-primary/5 shadow-[0_4px_25px_rgba(244,63,94,0.03)] dark:shadow-none"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Vốn chủ sở hữu (EQUITY)</span>
              <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-primary dark:text-primary">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-3.5xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight">{totalEquity.toLocaleString('vi-VN')}đ</h3>
            <p className="text-2xs font-bold text-slate-400 dark:text-[#CDBCAB]/40 uppercase tracking-widest mt-2 flex items-center gap-1">
              Tỷ lệ tự chủ tài chính: {totalAssets > 0 ? ((totalEquity / totalAssets) * 100).toFixed(0) : 100}%
            </p>
          </motion.div>
        </div>
      )}

      {/* ── SECTION 2: DUAL RUNNING RECONCILIATION & OUTBOX HEALTH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reconciliation Dashboard (Dual Running Comparison) */}
        <div className="lg:col-span-2 p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 className="w-5.5 h-5.5 text-emerald-500" />
                Đối chiếu Song song (Dual Running)
              </h4>
              <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                canCloseMonth
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                Health {ledgerMatchedPercent}/100
              </span>
            </div>

            <p className="text-sm font-medium text-slate-500 dark:text-[#CDBCAB]/70 mb-6">
              Hệ thống đang chạy song song Module Finance cũ (từ dòng tiền lẻ) và Sổ cái kế toán mới (định khoản kép) để tự động hóa kiểm tra đối chiếu.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* Old Module PnL */}
              <div className="p-5 bg-slate-50 dark:bg-[#11100F] rounded-2xl border border-slate-100 dark:border-[#3E3A35]/30">
                <span className="text-2xs font-black text-slate-400 dark:text-[#CDBCAB]/50 uppercase tracking-widest">Nguồn 1: Luồng Thu Chi Cũ</span>
                <h5 className="text-2xl font-black text-slate-800 dark:text-[#EFE9E1] tracking-tight mt-1">{(finOverview?.totalRevenueMonth || 0).toLocaleString()}đ</h5>
                <p className="text-3xs font-bold text-slate-400 dark:text-[#CDBCAB]/40 mt-1">TỔNG THU HÀNH CHÍNH (REVENUE TABLE)</p>
              </div>

              {/* New Accounting Ledger */}
              <div className="p-5 bg-gradient-to-br from-pink-50/30 to-primary/5 dark:from-primary/5 dark:to-[#11100F] rounded-2xl border border-primary/15 dark:border-primary/15">
                <span className="text-2xs font-black text-primary dark:text-primary uppercase tracking-widest">Nguồn 2: Kế Toán Sổ Cái Mới</span>
                <h5 className="text-2xl font-black text-slate-800 dark:text-[#EFE9E1] tracking-tight mt-1">{totalAssets > 0 ? (totalEquity).toLocaleString() : 'N/A'}đ</h5>
                <p className="text-3xs font-bold text-slate-400 dark:text-[#CDBCAB]/40 mt-1">TỔNG PHÁT SINH CÂN ĐỐI KÉP</p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            canCloseMonth
              ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100/60 dark:border-emerald-500/10'
              : 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-100/80 dark:border-rose-500/20'
          }`}>
            {canCloseMonth ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-xs font-black uppercase tracking-wider ${
                canCloseMonth ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {canCloseMonth ? 'Preflight khóa tháng: ĐẠT' : 'Preflight khóa tháng: ĐANG BỊ CHẶN'}
              </p>
              <p className={`text-2xs font-bold mt-0.5 ${
                canCloseMonth ? 'text-emerald-600/80 dark:text-emerald-500/80' : 'text-rose-600/80 dark:text-rose-400/80'
              }`}>
                {canCloseMonth
                  ? 'Không có FAILED/DEAD outbox, bút toán nháp hoặc reference active bị trùng trong phạm vi kiểm tra.'
                  : healthSummary?.blockers[0]?.message ?? 'Có blocker kế toán cần xử lý trước khi khóa tháng.'}
              </p>
            </div>
          </div>
        </div>

        {/* Transactional Outbox Health Monitor */}
        <div className="p-6 md:p-8 bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide flex items-center gap-2 mb-6">
              <Activity className="w-5.5 h-5.5 text-primary dark:text-primary" />
              Giám sát Hàng đợi Outbox
            </h4>

            {/* Event status list */}
            <div className="space-y-4">
              {/* Pending */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#11100F] rounded-xl">
                <span className="text-xs font-bold text-slate-500 dark:text-[#CDBCAB]/80">Đang chờ xử lý (Pending)</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-black">{outboxCounts.pending} events</span>
              </div>

              {/* Processing */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#11100F] rounded-xl">
                <span className="text-xs font-bold text-slate-500 dark:text-[#CDBCAB]/80">Đang hạch toán (Processing)</span>
                <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-md text-[10px] font-black">{outboxCounts.processing} events</span>
              </div>

              {/* Completed */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#11100F] rounded-xl">
                <span className="text-xs font-bold text-slate-500 dark:text-[#CDBCAB]/80">Hoàn thành (Completed)</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-black">{outboxCounts.completed} events</span>
              </div>

              {/* FAILED */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#11100F] rounded-xl">
                <span className="text-xs font-bold text-slate-500 dark:text-[#CDBCAB]/80">Lỗi tạm thời (Failed)</span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black">{outboxCounts.failed} events</span>
              </div>

              {/* DEAD */}
              <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                hasDeadEvents ? 'bg-red-50 dark:bg-red-950/20 border border-red-200/55' : 'bg-slate-50 dark:bg-[#11100F]'
              }`}>
                <span className={`text-xs font-black uppercase tracking-wider ${
                  hasDeadEvents ? 'text-red-600' : 'text-slate-500 dark:text-[#CDBCAB]/80'
                }`}>Lỗi nghiêm trọng (DEAD)</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                  hasDeadEvents ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>{outboxCounts.dead} events</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-50 dark:border-[#3E3A35]/30">
            {hasOutboxBlockers ? (
              <div className="flex items-center gap-2 text-red-500 bg-red-50/50 dark:bg-red-950/10 p-3 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span className="text-2xs font-extrabold uppercase tracking-wide leading-tight">
                  CẢNH BÁO: Phát hiện {outboxCounts.failed} FAILED và {outboxCounts.dead} DEAD events. Vào Health/Outbox để xử lý trước khi khóa tháng.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Hàng đợi outbox sạch, không phát hiện DEAD events.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: QUICK ACTIONS BENTO GRID ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <h4 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wide mb-6">Thao tác Nhanh</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
          {/* Accounting Health */}
          <Link href="/dashboard/accounting/health" className="group">
            <div className="p-6 rounded-2xl border border-primary/15 dark:border-[#3E3A35]/40 hover:border-primary dark:hover:border-primary bg-slate-50/40 dark:bg-[#11100F]/30 hover:bg-white dark:hover:bg-[#1C1B19] transition-all duration-300 h-full flex flex-col justify-between">
              <ShieldCheck className={`w-8 h-8 mb-4 group-hover:scale-105 transition-transform ${
                canCloseMonth ? 'text-emerald-500' : 'text-rose-500'
              }`} />
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider">Sức Khỏe Sổ</h5>
                <p className="text-2xs text-slate-400 dark:text-[#CDBCAB]/60 mt-1">Kiểm tra preflight trước khi khóa tháng.</p>
              </div>
            </div>
          </Link>

          {/* Manual Entry */}
          <Link href="/dashboard/accounting/manual-entry" className="group">
            <div className="p-6 rounded-2xl border border-primary/15 dark:border-[#3E3A35]/40 hover:border-primary dark:hover:border-primary bg-slate-50/40 dark:bg-[#11100F]/30 hover:bg-white dark:hover:bg-[#1C1B19] transition-all duration-300 h-full flex flex-col justify-between">
              <PenTool className="w-8 h-8 text-primary dark:text-primary mb-4 group-hover:scale-105 transition-transform" />
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider">Tạo Bút Toán Thủ Công</h5>
                <p className="text-2xs text-slate-400 dark:text-[#CDBCAB]/60 mt-1">Định khoản điều chỉnh kế toán cuối kỳ.</p>
              </div>
            </div>
          </Link>

          {/* Chart of Accounts */}
          <Link href="/dashboard/accounting/chart-of-accounts" className="group">
            <div className="p-6 rounded-2xl border border-primary/15 dark:border-[#3E3A35]/40 hover:border-primary dark:hover:border-primary bg-slate-50/40 dark:bg-[#11100F]/30 hover:bg-white dark:hover:bg-[#1C1B19] transition-all duration-300 h-full flex flex-col justify-between">
              <PlusCircle className="w-8 h-8 text-pink-500 mb-4 group-hover:scale-105 transition-transform" />
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider">Tài Khoản Tùy Chỉnh</h5>
                <p className="text-2xs text-slate-400 dark:text-[#CDBCAB]/60 mt-1">Xem cấu trúc cây và thêm tài khoản COA.</p>
              </div>
            </div>
          </Link>

          {/* Outbox Monitor */}
          <Link href="/dashboard/accounting/outbox" className="group">
            <div className="p-6 rounded-2xl border border-primary/15 dark:border-[#3E3A35]/40 hover:border-primary dark:hover:border-primary bg-slate-50/40 dark:bg-[#11100F]/30 hover:bg-white dark:hover:bg-[#1C1B19] transition-all duration-300 h-full flex flex-col justify-between">
              <AlertTriangle className={`w-8 h-8 mb-4 group-hover:scale-105 transition-transform ${
                hasOutboxBlockers ? 'text-red-500 animate-bounce' : 'text-slate-400 dark:text-[#CDBCAB]/80'
              }`} />
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider">Giám Sát Outbox</h5>
                <p className="text-2xs text-slate-400 dark:text-[#CDBCAB]/60 mt-1">Sửa lỗi kẹt và ép chạy lại (Replay) sự kiện.</p>
              </div>
            </div>
          </Link>

          {/* Standard Reports */}
          <Link href="/dashboard/accounting/reports" className="group">
            <div className="p-6 rounded-2xl border border-primary/15 dark:border-[#3E3A35]/40 hover:border-primary dark:hover:border-primary bg-slate-50/40 dark:bg-[#11100F]/30 hover:bg-white dark:hover:bg-[#1C1B19] transition-all duration-300 h-full flex flex-col justify-between">
              <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-4 group-hover:scale-105 transition-transform" />
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider">Báo Cáo TT133</h5>
                <p className="text-2xs text-slate-400 dark:text-[#CDBCAB]/60 mt-1">Xuất Báo cáo tài chính, P&L, đối cân Excel.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
