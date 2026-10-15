'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  PieChart,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { lockMonth, unlockMonth } from '@/services/finance-actions';
import {
  getMonthClosePreflight,
  type AccountingHealthCheck,
  type AccountingHealthSummary,
} from '@/services/accounting-actions';
import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import type { PnLData, ServicePerformance } from './FinancePnLSummary.types';

// Re-export types for backward compatibility
export type { PnLData, ServicePerformance } from './FinancePnLSummary.types';

interface FinancePnLSummaryProps {
  pnl: PnLData | null;
  performance: ServicePerformance[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
}

const monthCloseLinks = [
  { href: '/dashboard/accounting/health', label: 'Health' },
  { href: '/dashboard/accounting/outbox', label: 'Outbox' },
  { href: '/dashboard/accounting/journals', label: 'Journals' },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return 'Không thể kiểm tra preflight khóa tháng.';
}

function formatChecksForConfirmation(checks: AccountingHealthCheck[]) {
  return checks
    .slice(0, 4)
    .map((check) => `- ${check.label}: ${check.message}`)
    .join('\n');
}

export function FinancePnLSummary({ pnl, performance, selectedMonth, onMonthChange: _onMonthChange, onRefresh }: FinancePnLSummaryProps) {
  const vocab = useModuleVocabulary();
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [preflight, setPreflight] = useState<AccountingHealthSummary | null>(null);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  const selectedMonthLabel = selectedMonth.substring(0, 7);

  const loadPreflight = useCallback(async (options?: { showToast?: boolean }) => {
    setIsCheckingPreflight(true);
    setPreflightError(null);

    try {
      const summary = await getMonthClosePreflight(selectedMonth);
      setPreflight(summary);

      if (options?.showToast) {
        if (summary.can_close_month) {
          toast.success('Preflight khóa tháng đạt yêu cầu.');
        } else {
          toast.error(`Preflight còn ${summary.blocker_count} blocker cần xử lý.`);
        }
      }

      return summary;
    } catch (error) {
      const message = getErrorMessage(error);
      setPreflight(null);
      setPreflightError(message);

      if (options?.showToast) {
        toast.error(message);
      }

      return null;
    } finally {
      setIsCheckingPreflight(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (pnl?.is_locked) {
      setPreflight(null);
      setPreflightError(null);
      return;
    }

    void loadPreflight();
  }, [loadPreflight, pnl?.is_locked]);

  const preflightMonthMatches = preflight?.month === selectedMonthLabel;
  const preflightBlockers = preflightMonthMatches ? preflight.blockers : [];
  const preflightWarnings = preflightMonthMatches ? preflight.warnings : [];
  const canLockFromPreflight = preflightMonthMatches && !preflightError && preflight?.can_close_month === true;
  const isLockDisabled = isLocking || isCheckingPreflight || !canLockFromPreflight;

  const preflightStatus = useMemo(() => {
    if (preflightError) {
      return {
        label: 'Không kiểm tra được',
        detail: preflightError,
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: XCircle,
      };
    }

    if (isCheckingPreflight && !preflightMonthMatches) {
      return {
        label: 'Đang kiểm tra',
        detail: `Đang kiểm tra dữ liệu kế toán tháng ${selectedMonthLabel}.`,
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        icon: Activity,
      };
    }

    if (!preflightMonthMatches || !preflight) {
      return {
        label: 'Chưa có kết quả',
        detail: `Cần kiểm tra preflight tháng ${selectedMonthLabel} trước khi chốt sổ.`,
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        icon: RefreshCw,
      };
    }

    if (!preflight.can_close_month) {
      return {
        label: 'Đang bị chặn',
        detail: `${preflight.blocker_count} blocker cần xử lý trước khi chốt sổ tháng.`,
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: XCircle,
      };
    }

    if (preflight.warning_count > 0) {
      return {
        label: 'Có cảnh báo',
        detail: `${preflight.warning_count} cảnh báo, vẫn có thể chốt sau khi xác nhận.`,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
      };
    }

    return {
      label: 'Đủ điều kiện',
      detail: 'Không có blocker kế toán cho tháng này.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }, [isCheckingPreflight, preflight, preflightError, preflightMonthMatches, selectedMonthLabel]);

  const PreflightStatusIcon = preflightStatus.icon;
  const preflightIssues = [
    ...preflightBlockers.map((check) => ({ check, tone: 'blocker' as const })),
    ...preflightWarnings.map((check) => ({ check, tone: 'warning' as const })),
  ];

  const handleLock = async () => {
    const latestPreflight = await loadPreflight();

    if (!latestPreflight) {
      toast.error('Không thể kiểm tra sức khỏe sổ trước khi chốt tháng.');
      return;
    }

    if (!latestPreflight.can_close_month) {
      toast.error(`Chưa thể chốt sổ tháng ${selectedMonthLabel}: còn ${latestPreflight.blocker_count} blocker.`);
      return;
    }

    const warningText = latestPreflight.warnings.length > 0
      ? `\n\nCảnh báo đang mở:\n${formatChecksForConfirmation(latestPreflight.warnings)}`
      : '';

    if (!window.confirm(`Bạn có chắc chắn muốn CHỐT SỔ tháng ${selectedMonthLabel} không?\nSau khi chốt, toàn bộ giao dịch và lương sẽ được khóa để ngăn chặn thay đổi.${warningText}`)) {
      return;
    }

    setIsLocking(true);
    try {
      const result = await lockMonth(selectedMonth);
      if (result.success) {
        toast.success('Tháng đã được chốt sổ thành công!');
        onRefresh();
      } else {
        toast.error(result.error || 'Lỗi khi chốt sổ tháng.');
      }
    } catch (error) {
      console.error('Lock error:', error);
      toast.error(`Lỗi khi chốt sổ tháng: ${getErrorMessage(error)}`);
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!window.confirm(`NGUY HIỂM: Bạn có chắc chắn muốn MỞ KHÓA SỔ tháng ${selectedMonth.substring(0, 7)} không?\n(Chỉ dành cho Admin trong trường hợp khẩn cấp)`)) {
      return;
    }

    setIsUnlocking(true);
    try {
      const result = await unlockMonth(selectedMonth);
      if (result.success) {
        toast.success('Tháng đã được mở khóa thành công!');
        onRefresh();
      } else {
        toast.error(result.error || 'Lỗi khi mở khóa sổ tháng.');
      }
    } catch (error) {
      console.error('Unlock error:', error);
      toast.error(`Lỗi khi mở khóa sổ tháng: ${getErrorMessage(error)}`);
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!pnl) return (
    <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-dashed border-slate-200">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Activity className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-700 font-bold">Chưa có dữ liệu tài chính cho tháng này</p>
      <p className="text-slate-400 text-xs mt-2">Vui lòng thay đổi Tháng/Năm ở thanh công cụ phía trên để xem dữ liệu khác.</p>
    </div>
  );

  return (
    <div className="space-y-8 mb-10">
      {/* Month Selection Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
           <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Chi tiết báo cáo tháng</h3>
           {pnl.is_locked ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-in fade-in zoom-in">
                   <ShieldCheck className="w-3.5 h-3.5" />
                   Số liệu đã chốt
                </span>
                <button 
                  onClick={handleUnlock}
                  disabled={isUnlocking}
                  className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-all disabled:opacity-50"
                >
                  {isUnlocking ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  Mở Khóa (Admin)
                </button>
              </div>
           ) : (
              <button 
                onClick={handleLock}
                disabled={isLockDisabled}
                title={!canLockFromPreflight ? 'Cần preflight kế toán sạch trước khi chốt tháng' : undefined}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all disabled:opacity-50"
              >
                {isLocking || isCheckingPreflight ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                {isCheckingPreflight ? 'Đang kiểm tra' : isLocking ? 'Đang chốt sổ' : 'Chốt sổ tháng'}
              </button>
           )}
        </div>
      </div>

      {!pnl.is_locked && (
        <section
          data-testid="month-close-preflight"
          className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-5 md:p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${preflightStatus.className}`}>
                <PreflightStatusIcon className={`w-5 h-5 ${isCheckingPreflight ? 'animate-spin' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Preflight khóa tháng {selectedMonthLabel}
                  </p>
                  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${preflightStatus.className}`}>
                    {preflightStatus.label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  {preflightStatus.detail}
                </p>
                {preflightMonthMatches && preflight && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest border border-rose-100">
                      {preflight.blocker_count} blocker
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-100">
                      {preflight.warning_count} cảnh báo
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadPreflight({ showToast: true })}
                disabled={isCheckingPreflight}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingPreflight ? 'animate-spin' : ''}`} />
                Kiểm tra lại
              </button>
              {monthCloseLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-white hover:text-slate-900 transition-all"
                >
                  {item.label}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {preflightError ? (
              <div className="lg:col-span-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {preflightError}
              </div>
            ) : preflightIssues.length > 0 ? (
              preflightIssues.slice(0, 4).map(({ check, tone }) => {
                const issueClassName = tone === 'blocker'
                  ? 'border-rose-100 bg-rose-50 text-rose-700'
                  : 'border-amber-100 bg-amber-50 text-amber-700';
                const IssueIcon = tone === 'blocker' ? XCircle : AlertTriangle;
                const content = (
                  <>
                    <IssueIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-xs font-black uppercase tracking-widest">{check.label}</span>
                      <span className="block text-xs font-bold leading-relaxed mt-1">{check.message}</span>
                    </span>
                  </>
                );

                return check.href ? (
                  <Link
                    key={check.id}
                    href={check.href}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 hover:brightness-[0.98] transition-all ${issueClassName}`}
                  >
                    {content}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-auto mt-0.5" />
                  </Link>
                ) : (
                  <div
                    key={check.id}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${issueClassName}`}
                  >
                    {content}
                  </div>
                );
              })
            ) : (
              <div className="lg:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Không có blocker hoặc cảnh báo trọng yếu cho tháng này.
              </div>
            )}
          </div>
        </section>
      )}

      {/* P&L Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Doanh thu ròng</span>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_revenue).toLocaleString()}đ</h4>
          <p className="text-[10px] font-bold text-slate-700 mt-2">Dựa trên các giao dịch đã xác nhận</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Chi phí vận hành</span>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_operating_expenses).toLocaleString()}đ</h4>
          <p className="text-[10px] font-bold text-slate-700 mt-2">Marketing, mặt bằng, điện nước...</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Quỹ lương {vocab.worker.plural}</span>
                {!pnl.is_locked && (
                  <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full w-fit mt-0.5 animate-pulse border border-amber-100">
                    Real-time (Tạm tính)
                  </span>
                )}
              </div>
            </div>
            <h4 className="text-2xl font-black text-slate-900">{Number(pnl.total_ktv_salaries).toLocaleString()}đ</h4>
            <p className="text-[10px] font-bold text-slate-700 mt-2">
              {!pnl.is_locked 
                ? `Cộng dồn hoa hồng ${vocab.workUnit.singular.toLowerCase()} + lương cứng đến nay`
                : "Lương cứng + Hoa hồng + Thưởng (Đã chốt)"}
            </p>
          </div>
          {!pnl.is_locked && (
            <div className="mt-3 text-[9px] text-amber-700 bg-amber-50/30 p-2.5 rounded-xl border border-amber-100/50 leading-relaxed font-semibold">
              ⚠️ Đây là quỹ lương tạm tính tích lũy theo số {vocab.workUnit.plural.toLowerCase()} dịch vụ hoàn thành thực tế hàng ngày, không phải mức chi cố định.
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-primary p-6 rounded-[32px] shadow-lg shadow-primary/20 dark:shadow-none relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-[10px] font-black text-primary-foreground/90 uppercase tracking-widest">Lợi nhuận ròng</span>
            </div>
            <h4 className="text-2xl font-black !text-primary-foreground">{Number(pnl.net_profit).toLocaleString()}đ</h4>
            <div className="flex items-center gap-1 mt-2">
               <span className="text-[10px] font-bold text-primary-foreground/80">Tỷ suất:</span>
               <span className="text-[10px] font-black text-primary-foreground bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                  {pnl.total_revenue > 0 ? ((pnl.net_profit / pnl.total_revenue) * 100).toFixed(1) : 0}%
               </span>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </motion.div>
      </div>

      {/* Service Performance Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-primary" />
            Hiệu quả kinh doanh theo Gói dịch vụ
          </h2>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100">
            Phân tích ROI & Margin
          </span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
          <table className="bella-data-table min-w-[72rem] text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Gói dịch vụ</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Số lượng</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Doanh thu</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Chi phí {vocab.worker.plural}</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Lợi nhuận gộp</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Biên lợi nhuận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {performance.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 font-bold text-slate-900">{item.package_name}</td>
                  <td className="px-8 py-4 font-black text-slate-700 text-center">{item.total_bookings}</td>
                  <td className="px-8 py-4 font-black text-emerald-600">{Number(item.total_revenue).toLocaleString()}đ</td>
                  <td className="px-8 py-4 font-black text-rose-500">{Number(item.total_ktv_cost).toLocaleString()}đ</td>
                  <td className="px-8 py-4 font-black text-slate-900">{Number(item.net_service_profit).toLocaleString()}đ</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${Math.min(100, Math.max(0, item.profit_margin_percent))}%` }}
                          ></div>
                       </div>
                       <span className="text-xs font-black text-slate-900 min-w-[40px] text-right">
                          {Number(item.profit_margin_percent).toFixed(1)}%
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
