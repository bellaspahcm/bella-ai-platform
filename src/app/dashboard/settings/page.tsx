"use client";
// Version: 1.3.0 - Refactored Component & Strict Types

import { Suspense, useCallback, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Save,
  ChevronRight,
  Sparkles,
  Loader2,
  Bell,
  Palette,
  Shield,
  Coins,
  Lock,
  CreditCard,
  Receipt,
  KeyRound,
  Calculator,
  Megaphone,
  Brain,
  MonitorDot,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { saveTenantSettings } from "@/services/tenant-actions";
import { usePageRefresh } from "@/hooks/usePageRefresh";
import { cn } from "@/lib/utils";
import { TenantGeneralSettings } from "@/types/domain";
import { useTenantModuleKey } from "@/hooks/useTenantModuleKey";
import { useUser } from "@/lib/user-context";
import {
  clearDashboardClientContextCache,
  getCachedTenantSettings,
} from "@/lib/dashboard-client-context";

import GeneralSettingsTab from "./components/GeneralSettingsTab";
import SalaryConfigTab from "./components/SalaryConfigTab";
import StaffManagementTab from "./components/StaffManagementTab";
import PermissionsTab from "./PermissionsTab";
import NotificationsTab from "./components/NotificationsTab";
import AppearanceTab from "./components/AppearanceTab";
import SubscriptionTab from "./components/SubscriptionTab";
import HqBillingTab from "./components/HqBillingTab";
import SecurityTab from "./components/SecurityTab";
import AccountingConfigTab from "./components/AccountingConfigTab";
import PromotionsTab from "./components/PromotionsTab";
import MetaAdsSettingsTab from "./components/MetaAdsSettingsTab";
import CommissionSettingsTab from "./components/CommissionSettingsTab";

const TABS = [
  { type: "header", label: "Doanh nghiệp & Giao diện" },
  { id: "general", label: "Thông tin chung", icon: Store },
  { id: "appearance", label: "Giao diện & Module", icon: Palette },
  { id: "subscription", label: "Gói dịch vụ (SaaS)", icon: CreditCard },
  { id: "hq-billing", label: "Hóa đơn HQ (Royalty)", icon: Receipt },

  { type: "header", label: "Vận hành & Tài chính" },
  { id: "salary", label: "Lương & Thưởng", icon: Coins },
  { id: "commission", label: "Hoa hồng & Chiết khấu", icon: Sparkles },
  { id: "accounting", label: "Chế độ Kế toán", icon: Calculator },
  { id: "promotions", label: "Khuyến mãi", icon: Sparkles },
  { id: "meta-ads", label: "Meta Ads", icon: Megaphone },

  { type: "header", label: "Bảo mật & Phân quyền" },
  { id: "staff", label: "Nhân sự & Quyền", icon: Shield },
  { id: "permissions", label: "Phân quyền", icon: Lock },
  { id: "security", label: "Bảo mật & Mật khẩu", icon: KeyRound },
  { id: "notifications", label: "Thông báo", icon: Bell },

  { type: "header", label: "Giám sát & Tích hợp" },
  { id: "rules", label: "Quy tắc nghiệp vụ", icon: Brain },
  { id: "partners", label: "API Partners", icon: KeyRound },
  { id: "system-monitor", label: "Trung tâm Giám sát", icon: MonitorDot },
  { id: "audit-logs", label: "Nhật ký hệ thống", icon: History },
] as const;

type TabItem = (typeof TABS)[number];
type SettingsTabId = Extract<TabItem, { id: string }>["id"];

const DEFAULT_SETTINGS_TAB: SettingsTabId = "general";

function isSettingsTabId(value: string | null): value is SettingsTabId {
  return TABS.some((tab) => "id" in tab && tab.id === value);
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    isSettingsTabId(initialTab) ? initialTab : DEFAULT_SETTINGS_TAB
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const { product } = useUser();
  const settingsBrandName = product?.displayName ?? "Bella";
  const { tenantModuleKey } = useTenantModuleKey();
  const isHealthcare = tenantModuleKey === "bella_healthcare";

  const visibleTabs = useMemo(() => {
    return TABS.map((tab) => {
      if ("type" in tab && tab.type === "header") {
        return tab;
      }
      const normalTab = tab as Extract<TabItem, { id: string }>;
      if (isHealthcare) {
        if (
          normalTab.id === "hq-billing" ||
          normalTab.id === "promotions" ||
          normalTab.id === "meta-ads"
        ) {
          return null;
        }
        if (normalTab.id === "general") {
          return { ...normalTab, label: "Thông tin bệnh viện" };
        }
        if (normalTab.id === "salary") {
          return { ...normalTab, label: "Thù lao trực & Lương" };
        }
        if (normalTab.id === "commission") {
          return { ...normalTab, label: "Định mức kỹ thuật lâm sàng" };
        }
      }
      return normalTab;
    }).filter(Boolean) as TabItem[];
  }, [isHealthcare]);

  const [generalSettings, setGeneralSettings] = useState<TenantGeneralSettings>({
    name: "",
    phone: "",
    email: "",
    address: "",
    qr_bank_code: "",
    qr_account_number: "",
    qr_account_name: "",
    salary_config: {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000,
    }
  });

  const loadSettings = useCallback(async (options: { force?: boolean } = {}) => {
    setIsLoadingSettings(true);
    try {
      const data = await getCachedTenantSettings(options);
      if (data) {
        const sc = (data.salary_config ?? {}) as Record<string, unknown>;
        setGeneralSettings({
          name: data.name || "",
          phone: data.contact_phone || "",
          email: data.email || "",
          address: data.address || "",
          qr_bank_code: data.qr_bank_code || "",
          qr_account_number: data.qr_account_number || "",
          qr_account_name: data.qr_account_name || "",
          salary_config: {
            bonus_5_star: Number(sc.bonus_5_star ?? 50000),
            bonus_4_5_star: Number(sc.bonus_4_5_star ?? 30000),
            bonus_4_star: Number(sc.bonus_4_star ?? 10000),
            kpi_target_sessions: Number(sc.kpi_target_sessions ?? 30),
            kpi_bonus_amount: Number(sc.kpi_bonus_amount ?? 1000000),
            penalty_late_per_day: sc.penalty_late_per_day !== undefined ? Number(sc.penalty_late_per_day) : undefined,
            penalty_absent_per_day: sc.penalty_absent_per_day !== undefined ? Number(sc.penalty_absent_per_day) : undefined,
            auto_consume_inventory: sc.auto_consume_inventory !== undefined ? !!sc.auto_consume_inventory : undefined,
            conflict_detection: (() => {
              const cd = sc.conflict_detection as Record<string, unknown> | undefined;
              return {
                detectKtvConflicts: cd?.detectKtvConflicts !== false, // always default true
                detectRoomConflicts: cd?.detectRoomConflicts !== false,
                detectEquipmentConflicts: cd?.detectEquipmentConflicts !== false,
                detectCustomerDoubleBooking: cd?.detectCustomerDoubleBooking !== false,
              };
            })(),
          }
        });
      }
    } catch (err: unknown) {
      console.error("Error loading settings:", err);
      toast.error("Không thể tải thông tin cấu hình");
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const nextTab = isSettingsTabId(tabFromUrl) ? tabFromUrl : DEFAULT_SETTINGS_TAB;
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
  }, [searchParams]);

  const [iframeHeight, setIframeHeight] = useState('1200px');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize-iframe') {
        setIframeHeight(`${event.data.height}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    setIframeHeight('1200px');
  }, [activeTab]);

  usePageRefresh(() => loadSettings({ force: true }));

  const handleTabChange = useCallback(
    (tabId: SettingsTabId) => {
      setActiveTab(tabId);

      const params = new URLSearchParams(searchParams.toString());
      if (tabId === DEFAULT_SETTINGS_TAB) {
        params.delete("tab");
      } else {
        params.set("tab", tabId);
      }

      const query = params.toString();
      const nextPath = query ? `/dashboard/settings?${query}` : "/dashboard/settings";
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath !== currentPath) {
        router.replace(nextPath, { scroll: false });
      }
    },
    [router, searchParams]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveTenantSettings(generalSettings);
      if (res.success) {
        clearDashboardClientContextCache();
        toast.success("Đã lưu cấu hình thành công!");
      } else {
        toast.error("Lỗi khi lưu: " + res.error);
      }
    } catch (err: unknown) {
      toast.error("Đã xảy ra lỗi khi lưu cấu hình!");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">
            Cài đặt
          </h1>
          <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Cấu hình hệ thống {settingsBrandName}
          </p>
        </div>
        {activeTab === "general" && (
          <button
            onClick={handleSave}
            disabled={isSaving || isLoadingSettings}
            className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-primary/25 dark:shadow-none active:scale-95 uppercase tracking-wider disabled:opacity-50 disabled:grayscale"
          >
            {isSaving ? (
              <Sparkles className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-1.5 bg-white/40 dark:bg-[#1C1B19]/40 p-4 rounded-[2.5rem] border border-slate-200/40 dark:border-[#3E3A35]/40 h-fit">
          {visibleTabs.map((tab, idx) => {
            if ("type" in tab && tab.type === "header") {
              return (
                <div
                  key={`header-${idx}`}
                  className="px-5 pt-4 pb-2 text-[10px] font-extrabold text-primary/70 dark:text-primary/75 uppercase tracking-[0.2em] relative z-10 select-none pointer-events-none mt-4 first:mt-0"
                >
                  {tab.label}
                </div>
              );
            }

            // Normal tab button
            const normalTab = tab as Extract<TabItem, { id: string }>;
            const isTabActive = activeTab === normalTab.id;
            const Icon = normalTab.icon;

            return (
              <button
                key={normalTab.id}
                onClick={() => handleTabChange(normalTab.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 font-bold group text-left border",
                  isTabActive
                    ? "bg-white dark:bg-slate-800/80 text-primary shadow-md border-primary/30"
                    : "text-muted-foreground hover:bg-white/60 hover:text-primary border-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform group-hover:scale-105",
                    isTabActive
                      ? "text-primary dark:text-primary"
                      : "text-slate-400 group-hover:text-primary dark:group-hover:text-primary",
                  )}
                />
                <span className="text-sm">{normalTab.label}</span>
                {isTabActive && (
                  <ChevronRight className="ml-auto w-4 h-4 text-primary dark:text-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === "rules" || activeTab === "system-monitor" || activeTab === "audit-logs" || activeTab === "partners" ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                {activeTab === "rules" && (
                  <iframe
                    src="/dashboard/rules?embedded=true"
                    style={{ height: iframeHeight }}
                    className="w-full border border-slate-200/50 dark:border-[#3E3A35]/50 rounded-[2.5rem] bg-slate-50 dark:bg-[#11100F] shadow-xl overflow-hidden"
                    scrolling="no"
                  />
                )}
                {activeTab === "system-monitor" && (
                  <iframe
                    src="/dashboard/system-monitor?embedded=true"
                    className="w-full h-[85vh] border-0 bg-transparent overflow-hidden"
                  />
                )}
                {activeTab === "audit-logs" && (
                  <iframe
                    src="/dashboard/audit?embedded=true"
                    className="w-full h-[85vh] border-0 bg-transparent overflow-hidden"
                  />
                )}
                {activeTab === "partners" && (
                  <iframe
                    src="/dashboard/admin/partners?embedded=true"
                    style={{ height: iframeHeight }}
                    className="w-full border-0 bg-transparent overflow-hidden"
                    scrolling="no"
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[3rem] p-10 shadow-lg border border-slate-200/60 dark:border-slate-800 h-full"
              >
                {activeTab === "general" && (
                  <GeneralSettingsTab
                    generalSettings={generalSettings}
                    setGeneralSettings={setGeneralSettings}
                    isLoadingSettings={isLoadingSettings}
                  />
                )}

                {activeTab === "subscription" && (
                  <SubscriptionTab />
                )}

                {activeTab === "hq-billing" && (
                  <HqBillingTab />
                )}

                {activeTab === "meta-ads" && (
                  <MetaAdsSettingsTab />
                )}

                {activeTab === "salary" && (
                  <SalaryConfigTab
                    generalSettings={generalSettings}
                    setGeneralSettings={setGeneralSettings}
                  />
                )}

                {activeTab === "commission" && (
                  <CommissionSettingsTab />
                )}

                {activeTab === "accounting" && (
                  <AccountingConfigTab />
                )}

                {activeTab === "staff" && (
                  <StaffManagementTab />
                )}

                {activeTab === "permissions" && (
                  <PermissionsTab />
                )}

                {activeTab === "security" && (
                  <SecurityTab />
                )}

                {activeTab === "notifications" && (
                  <NotificationsTab />
                )}

                {activeTab === "appearance" && (
                  <AppearanceTab />
                )}

                {activeTab === "promotions" && (
                  <PromotionsTab />
                )}


              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background/30">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
