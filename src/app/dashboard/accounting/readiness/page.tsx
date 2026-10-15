'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAccountingEventTemplates,
  getAccountingReadinessSummary,
  getAccountingReviewQueue,
  resolveAccountingReviewItem,
  runAccountingMetadataBackfill,
  type AccountingBackfillResult,
  type AccountingEventTemplate,
  type AccountingReadinessSummary,
  type AccountingReviewItem,
  type AccountingReviewResolutionStatus,
} from '@/services/accounting-actions';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { cn } from '@/lib/utils';

const SOURCE_LABELS: Record<string, { label: string; href: string; note: string }> = {
  revenue: {
    label: 'Doanh thu',
    href: '/dashboard/finance',
    note: 'Tiền cọc, thanh toán còn lại, thu trọn gói.',
  },
  expenses: {
    label: 'Chi phí',
    href: '/dashboard/finance',
    note: 'Chi phí vận hành, lương nhập qua thu chi, vật tư.',
  },
  salary_records: {
    label: 'Bảng lương',
    href: '/dashboard/salary',
    note: 'Lương KTV, thưởng KPI, phạt và hoa hồng.',
  },
  session_logs: {
    label: 'Buổi liệu trình',
    href: '/dashboard/sessions',
    note: 'Buổi đã hoàn thành để ghi nhận doanh thu theo buổi.',
  },
  inventory_logs: {
    label: 'Kho vật tư',
    href: '/dashboard/inventory',
    note: 'Nhập kho, xuất kho và tiêu hao theo buổi.',
  },
};

const SEVERITY_CLASS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const tableClassName = 'w-max min-w-[56rem] border-collapse whitespace-nowrap text-xs';
const reviewTableClassName = 'w-max min-w-[68rem] border-collapse whitespace-nowrap text-xs';
const stickyHeaderCellClassName =
  'bg-white dark:bg-[#1C1B19]';
const stickyBodyCellClassName =
  'bg-inherit';

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function scoreTone(score: number) {
  if (score >= 95) {
    return {
      icon: CheckCircle2,
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      label: 'Sẵn sàng cao',
    };
  }
  if (score >= 80) {
    return {
      icon: AlertTriangle,
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      label: 'Cần rà soát',
    };
  }
  return {
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    label: 'Chưa sẵn sàng',
  };
}

export default function AccountingReadinessPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<AccountingReadinessSummary | null>(null);
  const [reviewItems, setReviewItems] = useState<AccountingReviewItem[]>([]);
  const [templates, setTemplates] = useState<AccountingEventTemplate[]>([]);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [lastBackfillResult, setLastBackfillResult] = useState<AccountingBackfillResult[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [summaryData, queueData, templateData] = await Promise.all([
        getAccountingReadinessSummary(),
        getAccountingReviewQueue({ status: 'NEEDS_REVIEW' }),
        getAccountingEventTemplates('TT133'),
      ]);
      setSummary(summaryData);
      setReviewItems(queueData);
      setTemplates(templateData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải mức sẵn sàng kế toán.';
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolveReviewItem = async (
    reviewItemId: string,
    status: AccountingReviewResolutionStatus
  ) => {
    setResolvingItemId(reviewItemId);
    try {
      const result = await resolveAccountingReviewItem({ reviewItemId, status });
      if (!result.success) {
        toast.error(result.error || 'Không thể xử lý review item.');
        return;
      }
      toast.success(
        status === 'APPROVED_FOR_POSTING'
          ? 'Đã duyệt dòng dữ liệu cho hạch toán.'
          : 'Đã từ chối dòng review kế toán.'
      );
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể xử lý review item.';
      toast.error(message);
    } finally {
      setResolvingItemId(null);
    }
  };

  const handleRunBackfill = async () => {
    setBackfilling(true);
    try {
      const result = await runAccountingMetadataBackfill({ limit: 500 });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setLastBackfillResult(result.data);
      const scanned = result.data.reduce((sum, row) => sum + row.scanned_records, 0);
      const review = result.data.reduce((sum, row) => sum + row.review_created, 0);
      toast.success(`Đã quét ${scanned} dòng dữ liệu cũ. ${review} dòng cần kế toán review.`);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể chạy backfill metadata kế toán.';
      toast.error(message);
    } finally {
      setBackfilling(false);
    }
  };

  const classifiedRate = useMemo(() => {
    if (!summary?.total_records) return 0;
    return (summary.classified_records / summary.total_records) * 100;
  }, [summary]);

  const groupedTemplateCounts = useMemo(() => {
    return templates.reduce<Record<string, number>>((acc, template) => {
      acc[template.source_module] = (acc[template.source_module] || 0) + 1;
      return acc;
    }, {});
  }, [templates]);

  const score = summary?.readiness_score ?? 0;
  const tone = scoreTone(score);
  const ScoreIcon = tone.icon;
  const openReviewCount = (summary?.needs_review ?? 0) + (summary?.posting_failed ?? 0);

  return (
    <div className="space-y-8">
      <section className={cn('rounded-[2rem] border p-6 md:p-8 shadow-sm', tone.bg, tone.border)}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/75 dark:bg-[#11100F]/60 flex items-center justify-center shrink-0">
              <ClipboardCheck className={cn('w-6 h-6', tone.text)} />
            </div>
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[#CDBCAB]/60">
                SIMPLE to PROFESSIONAL readiness
              </p>
              <h2 className="mt-2 text-xl md:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                Sẵn sàng dữ liệu kế toán
              </h2>
              <p className="mt-2 max-w-3xl text-xs md:text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                Kiểm tra dữ liệu SIMPLE đã đủ thông tin để chuyển sang kế toán chuyên nghiệp theo TT133 hay chưa. Lễ tân/admin vẫn nhập liệu đơn giản; các dòng thiếu nghiệp vụ sẽ vào hàng chờ để kế toán xử lý.
              </p>
            </div>
          </div>

          <div className="min-w-[220px] rounded-2xl bg-white/80 dark:bg-[#11100F]/50 border border-white/70 dark:border-[#3E3A35]/50 p-5">
            {loading ? (
              <SkeletonLoader variant="rectangular" className="h-24" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-black uppercase tracking-widest text-slate-400">Điểm sẵn sàng</span>
                  <ScoreIcon className={cn('w-5 h-5', tone.text)} />
                </div>
                <div className={cn('mt-2 text-4xl font-black tracking-tight', tone.text)}>{score}</div>
                <p className={cn('mt-1 text-3xs font-black uppercase tracking-widest', tone.text)}>{tone.label}</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              Backfill dữ liệu lịch sử
            </h3>
            <p className="mt-1 max-w-3xl text-2xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/65">
              Quét dữ liệu cũ chưa có accounting metadata, tự phân loại dòng rõ ràng và đưa dòng thiếu thông tin vào hàng chờ kế toán review. Mỗi lần chạy tối đa 500 dòng để tránh ảnh hưởng vận hành.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunBackfill}
            disabled={backfilling || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-3xs font-black uppercase tracking-widest text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', backfilling && 'animate-spin')} />
            {backfilling ? 'Đang quét...' : 'Chạy backfill'}
          </button>
        </div>

        {lastBackfillResult.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {lastBackfillResult.map((row) => (
              <div key={row.source_table} className="rounded-xl bg-slate-50 dark:bg-[#11100F] px-4 py-3">
                <div className="text-3xs font-black uppercase tracking-widest text-slate-400">
                  {SOURCE_LABELS[row.source_table]?.label ?? row.source_table}
                </div>
                <div className="mt-2 flex items-center justify-between text-2xs font-bold text-slate-600 dark:text-[#CDBCAB]">
                  <span>Quét {row.scanned_records}</span>
                  <span className="text-emerald-600">Map {row.classified_records}</span>
                  <span className="text-amber-600">Review {row.review_created}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-32" />)
        ) : (
          <>
            <MetricCard icon={DatabaseZap} label="Tổng bản ghi" value={summary?.total_records ?? 0} tone="text-slate-900 dark:text-[#EFE9E1]" />
            <MetricCard icon={ShieldCheck} label="Đã phân loại" value={formatPercent(classifiedRate)} tone="text-emerald-700 dark:text-emerald-400" />
            <MetricCard icon={FileWarning} label="Thiếu nghiệp vụ" value={summary?.missing_business_event ?? 0} tone="text-amber-700 dark:text-amber-400" />
            <MetricCard icon={AlertTriangle} label="Cần review" value={openReviewCount} tone="text-rose-700 dark:text-rose-400" />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
                Chất lượng dữ liệu theo nguồn
              </h3>
              <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
                Các dòng có business event sẽ được map vào template TT133.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-3xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-[#3E3A35] dark:text-[#CDBCAB] dark:hover:bg-[#11100F] sm:w-auto"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Tải lại
            </button>
          </div>

          {loading ? (
            <SkeletonTable />
          ) : (
            <div className={tableWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                    <th className={`${stickyHeaderCellClassName} py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400`}>Nguồn</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Tổng</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Đã map</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Thiếu</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Review</th>
                    <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                  {(summary?.rows ?? []).map((row) => {
                    const source = SOURCE_LABELS[row.source_table] ?? {
                      label: row.source_table,
                      href: '/dashboard/accounting',
                      note: 'Nguồn dữ liệu kế toán.',
                    };
                    const rowRate = row.total_records > 0 ? (row.classified_records / row.total_records) * 100 : 100;
                    return (
                      <tr key={row.source_table}>
                        <td className={`${stickyBodyCellClassName} min-w-[220px] py-4 pr-4`}>
                          <div className="font-black text-slate-900 dark:text-[#EFE9E1]">{source.label}</div>
                          <div className="mt-1 text-3xs font-medium text-slate-400">{source.note}</div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-700 dark:text-[#CDBCAB]">{row.total_records}</td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{row.classified_records}</span>
                          <span className="ml-1 text-4xs font-black text-slate-400">({formatPercent(rowRate)})</span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black text-amber-700 dark:text-amber-400">{row.missing_business_event}</td>
                        <td className="py-4 px-4 text-right font-mono font-black text-rose-700 dark:text-rose-400">{row.needs_review + row.posting_failed}</td>
                        <td className="py-4 pl-4 text-right">
                          <Link
                            href={source.href}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#11100F] px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:text-primary"
                          >
                            Xem
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">Template TT133</h3>
          <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
            Bộ quy tắc định khoản mặc định cho các nghiệp vụ SIMPLE.
          </p>

          {loading ? (
            <div className="mt-6 space-y-3">
              <SkeletonLoader variant="rectangular" className="h-12" />
              <SkeletonLoader variant="rectangular" className="h-12" />
              <SkeletonLoader variant="rectangular" className="h-12" />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {Object.entries(groupedTemplateCounts).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-[#11100F] px-4 py-3">
                  <span className="text-2xs font-black uppercase tracking-widest text-slate-500 dark:text-[#CDBCAB]">{source}</span>
                  <span className="font-mono text-xs font-black text-slate-900 dark:text-[#EFE9E1]">{count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-[#11100F] p-4">
            <p className="text-3xs font-black uppercase tracking-widest text-slate-400">Điều kiện bật PROFESSIONAL</p>
            <ul className="mt-3 space-y-2 text-2xs font-medium text-slate-600 dark:text-[#CDBCAB]/75">
              <li>Readiness score tối thiểu 95.</li>
              <li>Không còn dòng thiếu business event.</li>
              <li>Không còn hàng chờ review hoặc posting failed.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              Hàng chờ kế toán review
            </h3>
            <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
              Các dòng này cần CFO/kế toán trưởng bổ sung thông tin trước khi auto-post.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/reconciliation"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-3xs font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            Đối soát
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : reviewItems.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
              Không có dòng đang cần review
            </p>
            <p className="mt-1 text-2xs font-medium text-slate-400">
              Dữ liệu SIMPLE hiện tại không có cảnh báo review đang mở.
            </p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className={reviewTableClassName}>
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                  <th className={`${stickyHeaderCellClassName} py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400`}>Nguồn</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Nghiệp vụ</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Lý do</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Mức độ</th>
                  <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                {reviewItems.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td className={`${stickyBodyCellClassName} py-4 pr-4`}>
                      <div className="font-black text-slate-900 dark:text-[#EFE9E1]">{SOURCE_LABELS[item.source_table]?.label ?? item.source_table}</div>
                      <div className="mt-1 font-mono text-4xs text-slate-400">{item.source_id}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-2xs font-bold text-slate-700 dark:text-[#CDBCAB]">
                      {item.business_event_type ?? 'UNCLASSIFIED'}
                    </td>
                    <td className="min-w-[24rem] px-4 py-4 whitespace-normal">
                      <div className="font-bold text-slate-700 dark:text-[#CDBCAB]">{item.reason_code}</div>
                      <div className="mt-1 text-3xs font-medium text-slate-400">{item.message}</div>
                      {item.missing_fields.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.missing_fields.map((field) => (
                            <span key={field} className="rounded-md bg-amber-50 px-2 py-1 text-4xs font-black uppercase tracking-widest text-amber-700">
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cn('inline-flex rounded-full border px-3 py-1 text-4xs font-black uppercase tracking-widest', SEVERITY_CLASS[item.severity])}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-4 pl-4">
                      <div className="flex min-w-[11rem] justify-end gap-2">
                        <button
                          type="button"
                          disabled={resolvingItemId === item.id}
                          onClick={() => handleResolveReviewItem(item.id, 'APPROVED_FOR_POSTING')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-4xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Duyệt
                        </button>
                        <button
                          type="button"
                          disabled={resolvingItemId === item.id}
                          onClick={() => handleResolveReviewItem(item.id, 'REJECTED')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-4xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" />
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-3xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <Icon className={cn('w-5 h-5', tone)} />
      </div>
      <div className={cn('mt-4 text-2xl font-black tracking-tight', tone)}>{value}</div>
    </div>
  );
}
