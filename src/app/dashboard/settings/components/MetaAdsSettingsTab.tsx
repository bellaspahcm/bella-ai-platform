"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  deleteUnusedMetaAdAccountConnection,
  getMetaAdAccountConnections,
  saveMetaAdAccountConnection,
  syncMetaAdsInsights,
} from "@/services/marketing/meta-ads";
import { getLocalDateString } from '@bella/shared';
import { cn } from '@/lib/utils';;
import { PremiumSelect } from "@/components/ui/PremiumSelect";

type ConnectionsResult = Awaited<ReturnType<typeof getMetaAdAccountConnections>>;
type MetaAdAccountConnection = Extract<ConnectionsResult, { success: true }>["data"][number];

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);

  return {
    dateFrom: getLocalDateString(from),
    dateTo: getLocalDateString(today),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Chưa đồng bộ";
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function MetaAdsSettingsTab() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [connections, setConnections] = useState<MetaAdAccountConnection[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [timezoneName, setTimezoneName] = useState("Asia/Ho_Chi_Minh");
  const [accessToken, setAccessToken] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getMetaAdAccountConnections();
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setConnections(result.data);
      if (!selectedAccountId && result.data[0]) {
        setSelectedAccountId(result.data[0].ad_account_id);
      }
    } catch (error) {
      console.error("Meta Ads connections load failed", error);
      toast.error("Không thể tải cấu hình Meta Ads");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await saveMetaAdAccountConnection({
        adAccountId,
        accountName,
        currency,
        timezoneName,
        accessToken,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Đã lưu cấu hình Meta Ads");
      setAdAccountId("");
      setAccountName("");
      setAccessToken("");
      setSelectedAccountId(result.data.ad_account_id);
      await loadConnections();
    } catch (error) {
      console.error("Meta Ads save failed", error);
      toast.error("Không thể lưu cấu hình Meta Ads");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    const syncAccountId = selectedAccountId || connections[0]?.ad_account_id;
    if (!syncAccountId) {
      toast.error("Chưa có tài khoản quảng cáo để đồng bộ");
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncMetaAdsInsights({
        adAccountId: syncAccountId,
        dateFrom,
        dateTo,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Đã đồng bộ ${result.data.rowsSynced} dòng insight`);
      await loadConnections();
    } catch (error) {
      console.error("Meta Ads sync failed", error);
      toast.error("Không thể đồng bộ Meta Ads");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDelete(connection: MetaAdAccountConnection) {
    if (connection.last_synced_at) {
      toast.error("Tài khoản đã từng đồng bộ nên không xóa trực tiếp");
      return;
    }

    const confirmed = window.confirm(
      `Xóa tài khoản ${connection.account_name || connection.ad_account_id}? Token đã lưu cũng sẽ bị xóa.`,
    );
    if (!confirmed) return;

    setDeletingAccountId(connection.ad_account_id);
    try {
      const result = await deleteUnusedMetaAdAccountConnection({
        adAccountId: connection.ad_account_id,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Đã xóa tài khoản Meta Ads chưa sử dụng");
      if (selectedAccountId === connection.ad_account_id) {
        setSelectedAccountId("");
      }
      await loadConnections();
    } catch (error) {
      console.error("Meta Ads delete failed", error);
      toast.error("Không thể xóa tài khoản Meta Ads");
    } finally {
      setDeletingAccountId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Meta Ads</h2>
            <p className="text-sm font-semibold text-muted-foreground">
              Chi phí quảng cáo và insight được đồng bộ vào ERP theo từng ngày.
            </p>
          </div>
        </div>
        <button
          onClick={loadConnections}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-black text-slate-700 dark:text-slate-300 shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Làm mới
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Cấu hình tài khoản quảng cáo</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Ad Account ID
              </span>
              <input
                value={adAccountId}
                onChange={(event) => setAdAccountId(event.target.value)}
                placeholder="act_123456789 hoặc 123456789"
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Tên hiển thị
              </span>
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Bella Enterprise Ads"
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Tiền tệ
              </span>
              <input
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Múi giờ
              </span>
              <input
                value={timezoneName}
                onChange={(event) => setTimezoneName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Meta Access Token
              </span>
              <input
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                autoComplete="new-password"
                placeholder="Dán token mới nếu cần cập nhật tài khoản này"
                className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold leading-relaxed text-slate-500">
              Token được mã hóa trên server và chỉ hiển thị trạng thái đã lưu, không trả token thật ra giao diện.
            </p>
            <button
              onClick={handleSave}
              disabled={isSaving || !adAccountId.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-md transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu tài khoản
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Đồng bộ thủ công</h3>
          </div>

          <div className="space-y-4">
            <PremiumSelect
              label="Tài khoản"
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              placeholder="Chọn tài khoản"
              options={connections.map((connection) => ({
                value: connection.ad_account_id,
                label: connection.account_name || connection.ad_account_id,
              }))}
              buttonClassName="w-full min-w-0 max-w-full overflow-hidden flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold text-slate-900 dark:text-slate-100 shadow-sm transition hover:border-primary"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Từ ngày
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-black text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Đến ngày
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-black text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
                />
              </label>
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing || !selectedAccountId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-xl shadow-slate-200 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Đồng bộ Meta Ads
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Tài khoản đã cấu hình</h3>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-sm font-bold text-slate-500">
            Chưa có tài khoản quảng cáo nào.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1040px] w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-4">Tài khoản</th>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">Tiền tệ</th>
                  <th className="px-5 py-4">Token</th>
                  <th className="px-5 py-4">Lần sync gần nhất</th>
                  <th className="px-5 py-4 text-right">Trạng thái</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {connections.map((connection) => (
                  <tr key={connection.id} className="text-sm font-bold text-slate-700">
                    <td className="px-5 py-4 whitespace-nowrap">
                      {connection.account_name || "Meta Ads"}
                    </td>
                    <td className="px-5 py-4 font-mono whitespace-nowrap">{connection.ad_account_id}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{connection.currency || "VND"}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {connection.token_last_four
                        ? `Đã lưu ••••${connection.token_last_four}`
                        : "Chưa có token riêng"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">{formatDateTime(connection.last_synced_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black",
                        connection.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500",
                      )}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {connection.is_active ? "Đang dùng" : "Tạm dừng"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(connection)}
                        disabled={!!connection.last_synced_at || deletingAccountId === connection.ad_account_id}
                        title={connection.last_synced_at ? "Tài khoản đã có dữ liệu đồng bộ" : "Xóa tài khoản chưa sử dụng"}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-2 text-xs font-black text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deletingAccountId === connection.ad_account_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Xóa
                      </button>
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
