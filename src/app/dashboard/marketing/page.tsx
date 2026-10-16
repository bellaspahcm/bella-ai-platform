"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  Eye,
  Loader2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  ReceiptText,
  Target,
  Wallet,
} from "lucide-react";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import {
  getMetaAdAccountConnections,
  getMetaAdsDailyInsights,
  recognizeMetaAdsSpendAsExpense,
  syncMetaAdsInsights,
} from "@/services/marketing/meta-ads";
import { formatCurrency, getLocalDateString } from '@bella/shared';
import { cn } from '@/lib/utils';;

type ConnectionsResult = Awaited<ReturnType<typeof getMetaAdAccountConnections>>;
type InsightsResult = Awaited<ReturnType<typeof getMetaAdsDailyInsights>>;
type MetaAdAccountConnection = Extract<ConnectionsResult, { success: true }>["data"][number];
type MetaAdsInsight = Extract<InsightsResult, { success: true }>["data"][number];

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);

  return {
    dateFrom: getLocalDateString(from),
    dateTo: getLocalDateString(today),
  };
}

function asNumber(value: number | string | null | undefined) {
  const numberValue = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getLeadCount(actions: unknown) {
  if (!Array.isArray(actions)) return 0;

  return actions.reduce((total, action) => {
    if (typeof action !== "object" || action === null) return total;
    const record = action as { action_type?: unknown; value?: unknown };
    const actionType = String(record.action_type || "").toLowerCase();
    const value = asNumber(record.value as number | string | null | undefined);

    if (
      actionType === "lead" ||
      actionType.includes("lead") ||
      actionType.includes("complete_registration")
    ) {
      return total + value;
    }

    return total;
  }, 0);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function StatCard(props: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-[2rem] border border-rose-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{props.label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{props.value}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{props.hint}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", props.accent)}>
          <props.icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function MarketingDashboard() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [connections, setConnections] = useState<MetaAdAccountConnection[]>([]);
  const [insights, setInsights] = useState<MetaAdsInsight[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecognizingExpense, setIsRecognizingExpense] = useState(false);

  const accountOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả tài khoản" },
      ...connections.map((connection) => ({
        value: connection.ad_account_id,
        label: connection.account_name || connection.ad_account_id,
      })),
    ],
    [connections],
  );

  const expenseAccountId = useMemo(() => {
    if (selectedAccountId && selectedAccountId !== "all") return selectedAccountId;
    if (connections.length === 1) return connections[0].ad_account_id;
    return "";
  }, [connections, selectedAccountId]);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const connectionResult = await getMetaAdAccountConnections();
      if (!connectionResult.success) {
        toast.error(connectionResult.error);
        setConnections([]);
        setInsights([]);
        return;
      }

      setConnections(connectionResult.data);
      const normalizedAccountId = selectedAccountId === "all" ? null : selectedAccountId || null;
      const insightsResult = await getMetaAdsDailyInsights({
        dateFrom,
        dateTo,
        adAccountId: normalizedAccountId,
      });

      if (!insightsResult.success) {
        toast.error(insightsResult.error);
        setInsights([]);
        return;
      }

      setInsights(insightsResult.data);
    } catch (error) {
      console.error("Meta Ads dashboard load failed", error);
      toast.error("Không thể tải dữ liệu Meta Ads");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateFrom, dateTo, selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePageRefresh(loadData);

  async function handleSync() {
    const syncAccountIds = selectedAccountId && selectedAccountId !== "all"
      ? [selectedAccountId]
      : connections.map((connection) => connection.ad_account_id);

    if (syncAccountIds.length === 0) {
      toast.error("Chưa có tài khoản quảng cáo để đồng bộ");
      return;
    }

    setIsSyncing(true);
    try {
      let rowsSynced = 0;
      const failedAccounts: string[] = [];

      for (const syncAccountId of syncAccountIds) {
        const result = await syncMetaAdsInsights({
          adAccountId: syncAccountId,
          dateFrom,
          dateTo,
        });

        if (!result.success) {
          failedAccounts.push(syncAccountId);
          continue;
        }

        rowsSynced += result.data.rowsSynced;
      }

      if (failedAccounts.length > 0) {
        toast.error(`Có ${failedAccounts.length} tài khoản chưa đồng bộ được`);
      }
      if (rowsSynced > 0 || failedAccounts.length === 0) {
        toast.success(`Đã đồng bộ ${rowsSynced} dòng insight`);
      }
      await loadData();
    } catch (error) {
      console.error("Meta Ads sync failed", error);
      toast.error("Không thể đồng bộ Meta Ads");
    } finally {
      setIsSyncing(false);
    }
  }

  const summary = useMemo(() => {
    const spend = insights.reduce((sum, row) => sum + asNumber(row.spend), 0);
    const impressions = insights.reduce((sum, row) => sum + asNumber(row.impressions), 0);
    const reach = insights.reduce((sum, row) => sum + asNumber(row.reach), 0);
    const clicks = insights.reduce((sum, row) => sum + asNumber(row.clicks), 0);
    const leads = insights.reduce((sum, row) => sum + getLeadCount(row.actions), 0);

    return {
      spend,
      impressions,
      reach,
      clicks,
      leads,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpl: leads > 0 ? spend / leads : 0,
    };
  }, [insights]);

  async function handleRecognizeExpense() {
    if (!expenseAccountId) {
      toast.error("Chọn một tài khoản quảng cáo cụ thể trước khi ghi nhận chi phí");
      return;
    }

    if (summary.spend <= 0) {
      toast.error("Chưa có chi phí Meta Ads đã đồng bộ trong khoảng ngày này");
      return;
    }

    const confirmed = window.confirm(
      `Ghi nhận ${formatCurrency(summary.spend)}đ chi phí Meta Ads vào P&L cho khoảng ${dateFrom} - ${dateTo}?`,
    );
    if (!confirmed) return;

    setIsRecognizingExpense(true);
    try {
      const result = await recognizeMetaAdsSpendAsExpense({
        adAccountId: expenseAccountId,
        dateFrom,
        dateTo,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Đã ghi nhận ${formatCurrency(result.data.amount)}đ chi phí Meta Ads vào Finance`);
    } catch (error) {
      console.error("Meta Ads expense recognition failed", error);
      toast.error("Không thể ghi nhận chi phí Meta Ads");
    } finally {
      setIsRecognizingExpense(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-4 sm:p-6 md:p-10">
      {isRefreshing && (
        <div className="fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-xs font-black text-primary shadow-xl">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Đang làm mới dữ liệu
        </div>
      )}

      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Megaphone className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Marketing Intelligence</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-950 md:text-4xl">
            Meta Ads
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-muted-foreground">
            Theo dõi chi phí quảng cáo, lượt hiển thị, click và lead theo dữ liệu đã đồng bộ.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Làm mới
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing || connections.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-xl shadow-slate-200 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Đồng bộ
          </button>
        </div>
      </div>

      <section className="mb-8 rounded-[2rem] border border-rose-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
          <PremiumSelect
            label="Tài khoản"
            value={selectedAccountId || "all"}
            onChange={(value) => setSelectedAccountId(value === "all" ? "" : value)}
            options={accountOptions}
            buttonClassName="w-full min-w-0 max-w-full overflow-hidden flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-900 shadow-sm transition hover:border-rose-200"
          />
          <label className="space-y-1.5">
            <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">
              Từ ngày
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary"
            />
          </label>
          <label className="space-y-1.5">
            <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">
              Đến ngày
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary"
            />
          </label>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng chi phí"
          value={`${formatCurrency(summary.spend)}đ`}
          hint={`${insights.length} dòng insight`}
          icon={Wallet}
          accent="bg-rose-50 text-primary"
        />
        <StatCard
          label="Lượt tiếp cận"
          value={summary.reach.toLocaleString("vi-VN")}
          hint={`${summary.impressions.toLocaleString("vi-VN")} impressions`}
          icon={Eye}
          accent="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="Clicks"
          value={summary.clicks.toLocaleString("vi-VN")}
          hint={`CTR ${formatPercent(summary.ctr)}`}
          icon={MousePointerClick}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Lead"
          value={summary.leads.toLocaleString("vi-VN")}
          hint={summary.leads > 0 ? `CPL ${formatCurrency(summary.cpl)}đ` : "Chưa có lead"}
          icon={Target}
          accent="bg-emerald-50 text-emerald-600"
        />
      </section>

      <section className="mb-8 rounded-[2rem] border border-rose-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-primary">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Ghi nhận chi phí vào P&L</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
                Chỉ ghi nhận sau khi dữ liệu đã đồng bộ và đang xem một tài khoản cụ thể trong cùng tháng kế toán.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-slate-50 px-5 py-3 text-left sm:text-right">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Chi phí đã sync</p>
              <p className="mt-1 text-xl font-black text-slate-950">{formatCurrency(summary.spend)}đ</p>
            </div>
            <button
              onClick={handleRecognizeExpense}
              disabled={isRecognizingExpense || !expenseAccountId || summary.spend <= 0}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-xl shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isRecognizingExpense ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ReceiptText className="h-4 w-4" />
              )}
              Ghi nhận chi phí
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-rose-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black text-slate-950">Chi tiết insight</h2>
          </div>
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">
            {insights.length.toLocaleString("vi-VN")} dòng
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
          </div>
        ) : insights.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-primary">
              <CalendarDays className="h-8 w-8" />
            </div>
            <p className="text-lg font-black text-slate-900">Chưa có dữ liệu Meta Ads</p>
            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Cấu hình tài khoản quảng cáo trong Cài đặt rồi chạy đồng bộ để xem báo cáo.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.28)]">
            <table className="min-w-[1280px] w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-4 whitespace-nowrap">Ngày</th>
                  <th className="px-5 py-4 whitespace-nowrap">Campaign</th>
                  <th className="px-5 py-4 whitespace-nowrap">Ad set</th>
                  <th className="px-5 py-4 whitespace-nowrap">Ad</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">Chi phí</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">Reach</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">Impressions</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">Clicks</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">CTR</th>
                  <th className="px-5 py-4 text-right whitespace-nowrap">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insights.map((row) => (
                  <tr key={row.id} className="text-sm font-semibold text-slate-700 hover:bg-rose-50/30">
                    <td className="px-5 py-4 font-black whitespace-nowrap">{row.date_start}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="max-w-[260px] truncate font-black text-slate-900" title={row.campaign_name || row.campaign_id}>
                        {row.campaign_name || row.campaign_id || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="max-w-[240px] truncate" title={row.adset_name || row.adset_id}>
                        {row.adset_name || row.adset_id || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="max-w-[240px] truncate" title={row.ad_name || row.ad_id}>
                        {row.ad_name || row.ad_id || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-primary whitespace-nowrap">
                      {formatCurrency(row.spend)}đ
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">{asNumber(row.reach).toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">{asNumber(row.impressions).toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">{asNumber(row.clicks).toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">{formatPercent(asNumber(row.ctr))}</td>
                    <td className="px-5 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                      {getLeadCount(row.actions).toLocaleString("vi-VN")}
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

// Wrap with ErrorBoundary to prevent full page crashes
export default function MarketingDashboardWrapper() {
  return (
    <ErrorBoundary>
      <MarketingDashboard />
    </ErrorBoundary>
  );
}
