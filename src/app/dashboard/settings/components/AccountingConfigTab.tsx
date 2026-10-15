"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAccountingMode,
  getLegacyLedgerSyncPreview,
  getProfessionalModeReadinessGate,
  syncLegacyToLedger,
  updateAccountingMode,
} from "@/services/accounting-actions";
import type { LegacyLedgerSyncPreview, ProfessionalModeReadinessGate } from "@/core/services/accounting/types";
import { getAccountingErrorMessage as getErrorMessage } from "@/lib/accounting-error-message";

type AccountingMode = "SIMPLE" | "PROFESSIONAL";
const EMPTY_SYNC_PREVIEW: LegacyLedgerSyncPreview = {
  pending_revenue_count: 0,
  pending_expense_count: 0,
  pending_salary_count: 0,
  journal_entries_to_create: 0,
  revenue_amount: 0,
  expense_amount: 0,
  salary_amount: 0,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AccountingConfigTab() {
  const [mode, setMode] = useState<AccountingMode>("SIMPLE");
  const [readinessGate, setReadinessGate] = useState<ProfessionalModeReadinessGate | null>(null);
  const [syncPreview, setSyncPreview] = useState<LegacyLedgerSyncPreview>(EMPTY_SYNC_PREVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  async function refreshConfig() {
    const [currentMode, gate, preview] = await Promise.all([
      getAccountingMode(),
      getProfessionalModeReadinessGate(),
      getLegacyLedgerSyncPreview(),
    ]);
    setMode(currentMode);
    setReadinessGate(gate);
    setSyncPreview(preview);
  }

  useEffect(() => {
    async function loadConfig() {
      try {
        await refreshConfig();
      } catch (error) {
        toast.error(getErrorMessage(error, "Không tải được cấu hình kế toán."));
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSync = async () => {
    const message = [
      "Bạn có chắc chắn muốn đồng bộ dữ liệu lịch sử vào Sổ cái và bật Professional Core?",
      "",
      `Dự kiến tạo ${syncPreview.journal_entries_to_create} bút toán:`,
      `- ${syncPreview.pending_revenue_count} dòng doanh thu (${formatCurrency(syncPreview.revenue_amount)})`,
      `- ${syncPreview.pending_expense_count} dòng chi phí (${formatCurrency(syncPreview.expense_amount)})`,
      `- ${syncPreview.pending_salary_count} bảng lương (${formatCurrency(syncPreview.salary_amount)})`,
    ].join("\n");
    if (!confirm(message)) return;

    setIsSyncing(true);
    try {
      const result = await syncLegacyToLedger();
      if (!result.success) {
        toast.warning(result.error || "Chưa thể bật Professional Core. Kiểm tra Sẵn sàng dữ liệu trước khi đồng bộ.");
        await refreshConfig();
        return;
      }

      toast.success(`Đồng bộ thành công: ${result.syncedRevenueCount} doanh thu, ${result.syncedExpenseCount} chi phí, ${result.syncedSalaryCount} bảng lương.`);
      await refreshConfig();
    } catch (error) {
      toast.error(getErrorMessage(error, "Đã xảy ra lỗi trong quá trình đồng bộ."));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleMode = async (newMode: AccountingMode) => {
    setIsUpdating(true);
    try {
      const result = await updateAccountingMode(newMode);
      if (!result.success) {
        toast.warning(result.error || "Chưa thể bật Professional Core. Kiểm tra Sẵn sàng dữ liệu trước khi chuyển chế độ.");
        await refreshConfig();
        return;
      }
      await refreshConfig();
      toast.success(`Đã chuyển sang chế độ ${newMode === "PROFESSIONAL" ? "Professional Core" : "Simple Finance"}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Lỗi khi chuyển đổi chế độ."));
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-bold">Đang tải cấu hình...</p>
      </div>
    );
  }

  const professionalReady = Boolean(readinessGate?.can_enable_professional);
  const hasPendingSync = syncPreview.journal_entries_to_create > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hệ thống Kế toán Song song</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Chuyển đổi giữa Simple Finance và Professional Core theo mức sẵn sàng dữ liệu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "SIMPLE"
              ? "border-primary bg-primary/5 shadow-lg shadow-primary/20 dark:shadow-none"
              : "border-slate-100 bg-white hover:border-pink-200"
          }`}
        >
          {mode === "SIMPLE" && (
            <div className="absolute top-4 right-4 text-primary flex items-center gap-1 font-black text-xs uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Đang kích hoạt
            </div>
          )}
          <h3 className="text-xl font-bold mb-2">Simple Finance</h3>
          <p className="text-muted-foreground font-medium text-sm mb-6">
            Dùng cho vận hành thu chi hằng ngày, không yêu cầu admin/lễ tân hiểu đầy đủ bút toán kép.
          </p>
          <button
            onClick={() => handleToggleMode("SIMPLE")}
            disabled={mode === "SIMPLE" || isUpdating || isSyncing}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "SIMPLE"
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 shadow-md shadow-primary/20 dark:shadow-none"
            }`}
          >
            {isUpdating && mode !== "SIMPLE" ? "Đang chuyển..." : "Chuyển sang Simple"}
          </button>
        </div>

        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "PROFESSIONAL"
              ? "border-primary bg-primary/5 shadow-lg shadow-primary/20 dark:shadow-none"
              : "border-slate-100 bg-white hover:border-pink-200"
          }`}
        >
          {mode === "PROFESSIONAL" && (
            <div className="absolute top-4 right-4 text-primary flex items-center gap-1 font-black text-xs uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Đang kích hoạt
            </div>
          )}
          <h3 className="text-xl font-bold mb-2">Professional Core</h3>
          <p className="text-muted-foreground font-medium text-sm mb-6">
            Sổ cái bút toán kép theo chuẩn cấu hình kế toán. Chỉ bật khi dữ liệu nguồn đã qua kiểm tra readiness.
          </p>

          <div className={`mb-6 rounded-2xl border p-4 ${professionalReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-black text-sm text-slate-900">
                {professionalReady ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                Readiness {readinessGate?.readiness_score ?? 0}/100
              </div>
              <a
                href="/dashboard/accounting/readiness"
                className="text-xs font-black uppercase tracking-wider text-primary hover:underline"
              >
                Xem chi tiết
              </a>
            </div>
            {readinessGate?.blocking_reasons?.length ? (
              <ul className="mt-3 space-y-2 text-xs font-semibold text-amber-900">
                {readinessGate.blocking_reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs font-semibold text-emerald-800">
                Dữ liệu đã đủ điều kiện bật Professional Core.
              </p>
            )}
          </div>

          <button
            onClick={() => handleToggleMode("PROFESSIONAL")}
            disabled={mode === "PROFESSIONAL" || isUpdating || isSyncing || !professionalReady}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "PROFESSIONAL" || !professionalReady
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 shadow-md shadow-primary/20 dark:shadow-none"
            }`}
          >
            {isUpdating && mode !== "PROFESSIONAL" ? "Đang chuyển..." : "Chuyển sang Professional"}
          </button>
        </div>
      </div>

      <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-amber-900 mb-2">Đồng bộ dữ liệu lịch sử vào Sổ cái</h4>
            <p className="text-amber-800/80 text-sm font-medium mb-4">
              Đồng bộ chỉ chạy khi readiness đạt yêu cầu. Nếu còn dòng cần duyệt hoặc lỗi hạch toán, hệ thống sẽ chặn để tránh bật Professional trên dữ liệu chưa chuẩn.
            </p>

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Bút toán</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.journal_entries_to_create}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Doanh thu</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_revenue_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.revenue_amount)}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Chi phí</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_expense_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.expense_amount)}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Bảng lương</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_salary_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.salary_amount)}</p>
              </div>
            </div>

            {!hasPendingSync && professionalReady && mode !== "PROFESSIONAL" && (
              <p className="mb-4 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm font-bold text-emerald-700">
                Không còn dữ liệu lịch sử cần tạo bút toán. Bạn có thể chuyển sang Professional nếu đã kiểm tra báo cáo.
              </p>
            )}

            <button
              onClick={handleSync}
              disabled={isSyncing || isUpdating || !professionalReady || !hasPendingSync}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Đang đồng bộ dữ liệu..." : "Chạy đồng bộ Sổ cái ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
