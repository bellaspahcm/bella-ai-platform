'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  Database,
  FileWarning,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAccountingHealthSummary,
  getBusinessHealthSummary,
  publishAccountingHealthAlertNotification,
  runBusinessHealthRepairAction,
  type AccountingHealthCheck,
  type AccountingHealthSeverity,
  type AccountingHealthSummary,
  type BusinessHealthFinding,
  type BusinessHealthGroup,
  type BusinessHealthSeverity,
} from '@/services/accounting-actions';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { cn } from '@/lib/utils';

const SEVERITY_TONE: Record<AccountingHealthSeverity, {
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
}> = {
  healthy: {
    label: 'Sổ khỏe',
    icon: CheckCircle2,
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
  },
  warning: {
    label: 'Có cảnh báo',
    icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
  },
  critical: {
    label: 'Đang bị chặn',
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
  },
};

const CHECK_TONE: Record<AccountingHealthCheck['status'], string> = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  fail: 'bg-rose-50 text-rose-700 border-rose-200',
};

const BUSINESS_SEVERITY_TONE: Record<BusinessHealthSeverity, {
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
}> = {
  healthy: {
    label: 'Dữ liệu sạch',
    icon: CheckCircle2,
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
  },
  warning: {
    label: 'Cần rà soát',
    icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
  },
  critical: {
    label: 'Có lỗi chặn',
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
  },
};

const BUSINESS_GROUP_TONE: Record<BusinessHealthGroup['status'], string> = {
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  fail: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
};

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const stickyBodyCellClassName =
  'bg-white dark:bg-[#1C1B19]';

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatWorkerLastRun(lastRunAt: string | null | undefined, minutes: number | null | undefined) {
  if (!lastRunAt) return 'Chưa có';
  if (minutes === null || minutes === undefined) return 'Chưa rõ';
  if (minutes < 1) return 'Vừa chạy';
  if (minutes < 60) return `${formatNumber(minutes)} phút`;
  return `${formatNumber(Math.floor(minutes / 60))} giờ`;
}

export default function AccountingHealthPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishingWorkerAlert, setPublishingWorkerAlert] = useState(false);
  const [summary, setSummary] = useState<AccountingHealthSummary | null>(null);
  const [businessSummary, setBusinessSummary] = useState<Awaited<ReturnType<typeof getBusinessHealthSummary>> | null>(null);
  const [repairingFindingId, setRepairingFindingId] = useState<string | null>(null);
  const [confirmingRepairFinding, setConfirmingRepairFinding] = useState<BusinessHealthFinding | null>(null);

  const loadData = useCallback(async (monthValue = month) => {
    setRefreshing(true);
    try {
      const [accountingData, businessData] = await Promise.all([
        getAccountingHealthSummary(`${monthValue}-01`),
        getBusinessHealthSummary(`${monthValue}-01`),
      ]);
      setSummary(accountingData);
      setBusinessSummary(businessData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải sức khỏe sổ kế toán.';
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePageRefresh(() => loadData(month));

  const executeRepairFinding = async (finding: BusinessHealthFinding) => {
    if (!finding.repair_action) return;

    setRepairingFindingId(finding.id);
    try {
      const result = await runBusinessHealthRepairAction({
        action: finding.repair_action,
        targetId: finding.repair_target_id,
      });
      toast.success(result.message);
      await loadData(month);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể xử lý nhanh cảnh báo dữ liệu.';
      toast.error(message);
    } finally {
      setRepairingFindingId(null);
      setConfirmingRepairFinding(null);
    }
  };

  const handleRepairFinding = async (finding: BusinessHealthFinding) => {
    if (finding.repair_requires_confirmation) {
      setConfirmingRepairFinding(finding);
      return;
    }

    await executeRepairFinding(finding);
  };

  const handlePublishWorkerAlert = async () => {
    setPublishingWorkerAlert(true);
    try {
      const result = await publishAccountingHealthAlertNotification(`${month}-01`);
      toast.success(result.message);
      await loadData(month);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo thông báo nội bộ cho cảnh báo worker.';
      toast.error(message);
    } finally {
      setPublishingWorkerAlert(false);
    }
  };

  const severity = summary?.severity ?? 'warning';
  const tone = SEVERITY_TONE[severity];
  const StatusIcon = tone.icon;
  const allAttentionChecks = useMemo(
    () => [...(summary?.blockers ?? []), ...(summary?.warnings ?? [])],
    [summary]
  );
  const businessAttentionItems = useMemo(
    () => [...(businessSummary?.blockers ?? []), ...(businessSummary?.warnings ?? [])],
    [businessSummary]
  );
  const failedOutbox = (summary?.metrics.outbox_failed ?? 0) + (summary?.metrics.outbox_dead ?? 0);
  const pendingOutbox = (summary?.metrics.outbox_pending ?? 0) + (summary?.metrics.outbox_processing ?? 0);
  const workerLastRun = formatWorkerLastRun(
    summary?.metrics.worker_last_run_at,
    summary?.metrics.worker_minutes_since_last_run
  );
  const workerHasRisk =
    (summary?.metrics.worker_silent_with_pending ?? 0) > 0 ||
    (summary?.metrics.worker_failed_runs_24h ?? 0) > 0;
  const workerAlertTitle = (summary?.metrics.worker_silent_with_pending ?? 0) > 0
    ? 'Cron kế toán có thể đang im lặng'
    : 'Worker kế toán có lỗi trong 24h';
  const workerAlertMessage = (summary?.metrics.worker_silent_with_pending ?? 0) > 0
    ? `Còn ${formatNumber(pendingOutbox)} sự kiện đang chờ/lỗi nhưng lần chạy worker gần nhất là ${workerLastRun}.`
    : `Có ${formatNumber(summary?.metrics.worker_failed_runs_24h ?? 0)} lần chạy lỗi, tỷ lệ lỗi ${formatNumber(summary?.metrics.worker_failure_rate_24h ?? 0)}%.`;
  const businessSeverity = businessSummary?.severity ?? 'warning';
  const businessTone = BUSINESS_SEVERITY_TONE[businessSeverity];
  const BusinessStatusIcon = businessTone.icon;

  return (
    <div className="space-y-6">
      <section className={cn('rounded-3xl md:rounded-[2rem] border p-5 md:p-8 shadow-sm', tone.bg, tone.border)}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/75 dark:bg-[#11100F]/60 flex items-center justify-center shrink-0">
              <StatusIcon className={cn('w-6 h-6', tone.text)} />
            </div>
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[#CDBCAB]/60">
                Accounting health and month-close preflight
              </p>
              <h2 className="mt-2 text-xl md:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                Sức khỏe sổ kế toán
              </h2>
              <p className="mt-2 max-w-3xl text-xs md:text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                Kiểm tra outbox, bút toán nháp, reference trùng, readiness TT133 và dữ liệu legacy trước khi khóa tháng.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block min-w-0 sm:min-w-[11.5rem]">
              <span className="mb-2 block text-3xs font-black uppercase tracking-widest text-slate-400">Tháng preflight</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-11 w-full min-w-[11.5rem] rounded-xl border border-white/80 dark:border-[#3E3A35] bg-white/90 dark:bg-[#11100F] pl-4 pr-11 text-xs font-black text-slate-800 dark:text-[#EFE9E1] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => loadData(month)}
              disabled={refreshing}
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-4 text-3xs font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Kiểm tra
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {loading ? (
            [1, 2, 3, 4, 5].map((item) => <SkeletonLoader key={item} variant="card" className="h-28" />)
          ) : (
            <>
              <MetricCard
                icon={ShieldCheck}
                label="Preflight khóa tháng"
                value={summary?.can_close_month ? 'PASS' : 'BLOCK'}
                tone={summary?.can_close_month ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}
              />
              <MetricCard
                icon={Activity}
                label="Outbox lỗi"
                value={formatNumber(failedOutbox)}
                tone={failedOutbox > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={Clock}
                label="Worker gần nhất"
                value={workerLastRun}
                tone={workerHasRisk ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={FileWarning}
                label="Bút toán DRAFT"
                value={formatNumber(summary?.metrics.journal_draft ?? 0)}
                tone={(summary?.metrics.journal_draft ?? 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Readiness TT133"
                value={`${summary?.metrics.readiness_score ?? 0}/100`}
                tone={(summary?.metrics.readiness_score ?? 0) >= 95 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}
              />
            </>
          )}
        </div>

        {!loading && workerHasRisk ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-white/85 p-4 shadow-sm dark:border-amber-500/30 dark:bg-[#11100F]/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xs font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
                    Cảnh báo production
                  </p>
                  <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                    {workerAlertTitle}
                  </h3>
                  <p className="mt-1 max-w-3xl text-2xs font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                    {workerAlertMessage} Hệ thống nên phát thông báo nội bộ để admin/HQ xử lý trước khi tiếp tục khóa sổ.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href="/dashboard/accounting/outbox"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-3xs font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-[#1C1B19] dark:text-amber-400 dark:hover:bg-amber-500/10"
                >
                  Xem outbox
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={handlePublishWorkerAlert}
                  disabled={publishingWorkerAlert}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-3xs font-black uppercase tracking-widest text-white hover:bg-amber-700 disabled:opacity-60 dark:bg-amber-500 dark:text-[#11100F] dark:hover:bg-amber-400"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', publishingWorkerAlert && 'animate-spin')} />
                  Gửi thông báo nội bộ
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 mb-6">
          <div className="flex items-start gap-4">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border', businessTone.bg, businessTone.border)}>
              <BusinessStatusIcon className={cn('w-6 h-6', businessTone.text)} />
            </div>
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[#CDBCAB]/60">
                Operational data health
              </p>
              <h3 className="mt-2 text-lg md:text-xl font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                Sức khỏe dữ liệu vận hành
              </h3>
              <p className="mt-2 max-w-3xl text-xs md:text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                Quét các liên kết giữa thanh toán, booking, doanh thu, ca làm, kho, lương và hạch toán để phát hiện dữ liệu lệch trước khi vận hành tiếp.
              </p>
            </div>
          </div>
          <span className={cn('inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border px-4 py-2 text-3xs font-black uppercase tracking-widest', businessTone.text, businessTone.border, businessTone.bg)}>
            <BusinessStatusIcon className="h-3.5 w-3.5" />
            {businessTone.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-24" />)
          ) : (
            <>
              <MetricCard
                icon={ShieldCheck}
                label="Điểm dữ liệu"
                value={`${businessSummary?.score ?? 0}/100`}
                tone={(businessSummary?.score ?? 0) >= 90 ? 'text-emerald-700 dark:text-emerald-400' : (businessSummary?.score ?? 0) >= 70 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}
              />
              <MetricCard
                icon={XCircle}
                label="Lỗi chặn"
                value={formatNumber(businessSummary?.critical_count ?? 0)}
                tone={(businessSummary?.critical_count ?? 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Cảnh báo"
                value={formatNumber(businessSummary?.warning_count ?? 0)}
                tone={(businessSummary?.warning_count ?? 0) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={ListChecks}
                label="Nhóm đã quét"
                value={formatNumber(businessSummary?.checked_groups ?? 0)}
                tone="text-slate-800 dark:text-[#EFE9E1]"
              />
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((item) => <SkeletonLoader key={item} variant="card" className="h-24" />)
          ) : (
            (businessSummary?.groups ?? []).map((group) => (
              <BusinessGroupCard key={group.id} group={group} />
            ))
          )}
        </div>

        <div id="unresolved-findings" className="mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
                Việc cần xử lý
              </h4>
              <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
                Lỗi chặn cần xử lý trước; cảnh báo là dữ liệu cần rà soát hoặc bản ghi lịch sử.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 dark:bg-[#11100F] px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-slate-500 dark:text-[#CDBCAB]/70">
              <Database className="h-3.5 w-3.5" />
              {formatNumber(
                (businessSummary?.dataset_counts.bookings ?? 0) +
                (businessSummary?.dataset_counts.revenue ?? 0) +
                (businessSummary?.dataset_counts.session_logs ?? 0) +
                (businessSummary?.dataset_counts.salary_records ?? 0)
              )} bản ghi lõi
            </span>
          </div>

          {loading ? (
            <SkeletonTable />
          ) : businessAttentionItems.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
                Không phát hiện lỗi dữ liệu vận hành
              </p>
              <p className="mt-1 text-2xs font-medium text-slate-400">Các rule liên module đang sạch tại thời điểm quét.</p>
            </div>
          ) : (
            <div className={tableWrapperClassName}>
              <table className="bella-data-table min-w-[78rem] text-xs whitespace-nowrap">
                <colgroup>
                  <col className="w-[22rem]" />
                  <col className="w-[14rem]" />
                  <col className="w-[10rem]" />
                  <col className="w-[28rem]" />
                  <col className="w-[10rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                    <th className="py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400">Vấn đề</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Nhóm</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Mức độ</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Dữ liệu liên quan</th>
                    <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                  {businessAttentionItems.map((finding) => (
                    <BusinessFindingRow
                      key={finding.id}
                      finding={finding}
                      isRepairing={repairingFindingId === finding.id}
                      onRepair={handleRepairFinding}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
                Blockers và cảnh báo
              </h3>
              <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
                Blocker sẽ chặn khóa tháng; warning cần theo dõi nhưng không tự động khóa sổ.
              </p>
            </div>
            <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-3xs font-black uppercase tracking-widest', tone.text, tone.border, tone.bg)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {tone.label}
            </span>
          </div>

          {loading ? (
            <SkeletonTable />
          ) : allAttentionChecks.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
                Không có blocker hoặc cảnh báo mở
              </p>
              <p className="mt-1 text-2xs font-medium text-slate-400">Có thể tiếp tục khóa tháng sau khi kiểm tra số liệu vận hành.</p>
            </div>
          ) : (
            <div className={tableWrapperClassName}>
              <table className="bella-data-table min-w-[58rem] text-xs whitespace-nowrap">
                <colgroup>
                  <col className="w-[24rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[12rem]" />
                  <col className="w-[8rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                    <th className="py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400">Kiểm tra</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Số lượng</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                    <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                  {allAttentionChecks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
            Tóm tắt vận hành
          </h3>
          <div className="mt-5 space-y-3">
            <SideMetric label="Outbox pending/processing" value={pendingOutbox} />
            <SideMetric label="Worker runs 24h" value={summary?.metrics.worker_runs_24h ?? 0} />
            <SideMetric label="Worker lỗi 24h" value={summary?.metrics.worker_failed_runs_24h ?? 0} />
            <SideMetric label="Tỷ lệ lỗi worker (%)" value={summary?.metrics.worker_failure_rate_24h ?? 0} />
            <SideMetric label="Reference active trùng" value={summary?.metrics.duplicate_active_references ?? 0} />
            <SideMetric label="Thiếu business event" value={summary?.metrics.missing_business_event ?? 0} />
            <SideMetric label="Cần review/posting failed" value={(summary?.metrics.needs_review ?? 0) + (summary?.metrics.posting_failed ?? 0)} />
            <SideMetric label="Legacy cần tạo bút toán" value={summary?.metrics.legacy_journal_entries_to_create ?? 0} />
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-[#11100F] p-4">
            <p className="text-3xs font-black uppercase tracking-widest text-slate-400">Điều kiện preflight</p>
            <ul className="mt-3 space-y-2 text-2xs font-medium text-slate-600 dark:text-[#CDBCAB]/75">
              <li>Không có DEAD/FAILED outbox.</li>
              <li>Worker cron chạy đều khi còn outbox chờ xử lý.</li>
              <li>Không có bút toán DRAFT trong tháng.</li>
              <li>Không có reference nghiệp vụ active bị trùng.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-primary/15 dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              Reference bút toán bị trùng
            </h3>
            <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
              Các reference này phải được đảo/cancel đúng chuẩn trước khi khóa tháng.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/journals"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#3E3A35] px-4 py-2.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#11100F]"
          >
            Nhật ký chung
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (summary?.duplicate_journal_references ?? []).length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
              Không phát hiện reference active bị trùng
            </p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className="bella-data-table min-w-[64rem] text-xs whitespace-nowrap">
              <colgroup>
                <col className="w-[14rem]" />
                <col className="w-[20rem]" />
                <col className="w-[8rem]" />
                <col className="w-[22rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                  <th className="py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400">Reference type</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Reference ID</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Active</th>
                  <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400">Journal IDs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                {(summary?.duplicate_journal_references ?? []).map((reference) => (
                  <tr key={`${reference.reference_type}:${reference.reference_id}`}>
                    <td className={`${stickyBodyCellClassName} py-4 pr-4 font-mono text-2xs font-black text-slate-800 dark:text-[#EFE9E1]`}>{reference.reference_type}</td>
                    <td className="py-4 px-4 font-mono text-3xs font-bold text-slate-500">{reference.reference_id}</td>
                    <td className="py-4 px-4 text-right font-mono font-black text-rose-700">{reference.active_count}</td>
                    <td className="py-4 pl-4 font-mono text-3xs text-slate-500">{reference.entry_ids.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmingRepairFinding ? (
        <RepairConfirmModal
          finding={confirmingRepairFinding}
          isRepairing={repairingFindingId === confirmingRepairFinding.id}
          onCancel={() => setConfirmingRepairFinding(null)}
          onConfirm={() => executeRepairFinding(confirmingRepairFinding)}
        />
      ) : null}
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
    <div className="rounded-[1.5rem] bg-white/80 dark:bg-[#11100F]/50 border border-white/70 dark:border-[#3E3A35]/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-3xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <Icon className={cn('w-5 h-5', tone)} />
      </div>
      <div className={cn('mt-4 text-2xl font-black tracking-tight', tone)}>{value}</div>
    </div>
  );
}

function BusinessGroupCard({ group }: { group: BusinessHealthGroup }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-[#3E3A35]/50 bg-slate-50/70 dark:bg-[#11100F]/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-900 dark:text-[#EFE9E1]">{group.label}</p>
          <p className="mt-1 line-clamp-2 text-3xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/65">
            {group.description}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-4xs font-black uppercase tracking-widest', BUSINESS_GROUP_TONE[group.status])}>
          {group.status === 'pass' ? 'Sạch' : group.status === 'warn' ? 'Rà soát' : 'Lỗi'}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-3xs font-black uppercase tracking-widest">
          <span className={cn(group.critical_count > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400')}>
            {formatNumber(group.critical_count)} lỗi
          </span>
          <span className="text-slate-300">/</span>
          <span className={cn(group.warning_count > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400')}>
            {formatNumber(group.warning_count)} cảnh báo
          </span>
        </div>
        <Link
          href={group.href}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#1C1B19] px-3 py-1.5 text-4xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:text-primary"
        >
          {group.action_label}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function BusinessFindingRow({
  finding,
  isRepairing,
  onRepair,
}: {
  finding: BusinessHealthFinding;
  isRepairing: boolean;
  onRepair: (finding: BusinessHealthFinding) => void;
}) {
  const isCritical = finding.severity === 'critical';
  const tone = isCritical
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <tr>
      <td className={`${stickyBodyCellClassName} py-4 pr-4 min-w-[280px]`}>
        <div className="font-black text-slate-900 dark:text-[#EFE9E1]">{finding.title}</div>
        <div className="mt-1 max-w-[24rem] whitespace-normal text-3xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/60">
          {finding.message}
        </div>
      </td>
      <td className="py-4 px-4 font-bold text-slate-700 dark:text-[#CDBCAB]">{finding.group_label}</td>
      <td className="py-4 px-4">
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-4xs font-black uppercase tracking-widest', tone)}>
          {isCritical ? 'Lỗi chặn' : 'Cảnh báo'}
        </span>
      </td>
      <td className="py-4 px-4">
        {finding.details.length === 0 ? (
          <span className="text-3xs font-bold text-slate-400">-</span>
        ) : (
          <div className="flex max-w-[28rem] flex-wrap gap-1.5 whitespace-normal">
            {finding.details.slice(0, 5).map((detail) => (
              <span
                key={`${finding.id}:${detail.label}:${detail.value}`}
                className="rounded-lg bg-slate-50 dark:bg-[#11100F] px-2 py-1 font-mono text-4xs font-bold text-slate-500 dark:text-[#CDBCAB]/70"
              >
                {detail.label}: {detail.value}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-4 pl-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {finding.repair_action ? (
            <button
              type="button"
              onClick={() => onRepair(finding)}
              disabled={isRepairing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60 "
            >
              <RefreshCw className={cn('w-3 h-3', isRepairing && 'animate-spin')} />
              {finding.repair_label ?? 'Xử lý'}
            </button>
          ) : null}
          <Link
            href={finding.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#11100F] px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:text-primary"
          >
            {finding.repair_action ? 'Mở' : finding.action_label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function RepairConfirmModal({
  finding,
  isRepairing,
  onCancel,
  onConfirm,
}: {
  finding: BusinessHealthFinding;
  isRepairing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-primary/15 bg-white p-6 shadow-2xl dark:border-[#3E3A35] dark:bg-[#1C1B19]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400">
              Xác nhận xử lý dữ liệu
            </p>
            <h4 className="mt-2 text-lg font-black text-slate-950 dark:text-[#EFE9E1]">
              {finding.title}
            </h4>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
              Hệ thống sẽ kiểm tra lại điều kiện trên dữ liệu mới nhất trước khi cập nhật. Nếu ghi audit thất bại, thao tác sẽ rollback.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-[#11100F]">
          <p className="text-3xs font-black uppercase tracking-widest text-slate-400">Dữ liệu sẽ dùng để xác nhận</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {finding.details.length === 0 ? (
              <span className="text-xs font-bold text-slate-500">Không có chi tiết bổ sung.</span>
            ) : (
              finding.details.slice(0, 8).map((detail) => (
                <span
                  key={`${finding.id}:confirm:${detail.label}:${detail.value}`}
                  className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-3xs font-bold text-slate-600 dark:bg-[#1C1B19] dark:text-[#CDBCAB]"
                >
                  {detail.label}: {detail.value}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRepairing}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-3xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-[#3E3A35] dark:text-[#CDBCAB] dark:hover:bg-[#11100F]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRepairing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-3xs font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60 "
          >
            <RefreshCw className={cn('h-4 w-4', isRepairing && 'animate-spin')} />
            {isRepairing ? 'Đang xử lý' : finding.repair_label ?? 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: AccountingHealthCheck }) {
  return (
    <tr>
      <td className={`${stickyBodyCellClassName} py-4 pr-4 min-w-[260px]`}>
        <div className="font-black text-slate-900 dark:text-[#EFE9E1]">{check.label}</div>
        <div className="mt-1 text-3xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/60">{check.message}</div>
      </td>
      <td className="py-4 px-4 text-right font-mono font-black text-slate-700 dark:text-[#CDBCAB]">{formatNumber(check.count)}</td>
      <td className="py-4 px-4">
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-4xs font-black uppercase tracking-widest', CHECK_TONE[check.status])}>
          {check.status}
        </span>
      </td>
      <td className="py-4 pl-4 text-right">
        {check.href ? (
          <Link
            href={check.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#11100F] px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:text-primary"
          >
            Xem
            <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <span className="text-3xs font-bold text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}

function SideMetric({ label, value }: { label: string; value: number }) {
  const isClean = value === 0;
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-[#11100F] px-4 py-3">
      <span className="text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/75">{label}</span>
      <span className={cn('font-mono text-xs font-black', isClean ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
        {formatNumber(value)}
      </span>
    </div>
  );
}
