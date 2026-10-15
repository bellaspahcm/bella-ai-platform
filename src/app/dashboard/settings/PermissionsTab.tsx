"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Save, ShieldAlert, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase-client";
import { getTenantSettings, saveTenantSettings } from "@/services/tenant-actions";
import { clearDashboardClientContextCache } from "@/lib/dashboard-client-context";

const MODULES = [
  { id: "dashboard", label: "Tổng quan (Dashboard)" },
  { id: "customers", label: "Khách hàng" },
  { id: "bookings", label: "Lịch hẹn" },
  { id: "sessions", label: "Thẻ liệu trình / Ca làm" },
  { id: "crm", label: "Chăm sóc khách hàng" },
  { id: "services", label: "Dịch vụ & Sản phẩm" },
  { id: "marketing_ads", label: "Meta Ads" },
  { id: "inventory", label: "Kho hàng" },
  { id: "finance", label: "Tài chính & Thu chi" },
  { id: "reconciliation", label: "Đối soát Tài chính" },
  { id: "salary", label: "Bảng lương" },
  { id: "audit", label: "Nhật ký hệ thống" },
  { id: "settings", label: "Cài đặt" }
] as const;

const ROLES = [
  { id: "ktv_lead", label: "KTV Trưởng" },
  { id: "admin_staff", label: "Lễ tân / Staff" },
  { id: "accountant", label: "Kế toán" },
  { id: "hr", label: "Nhân sự (HR)" },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];
type RoleId = (typeof ROLES)[number]["id"];
type RolePermissions = Record<ModuleId, boolean> & { [moduleId: string]: boolean };
type PermissionsState = Record<RoleId, RolePermissions> & { [roleId: string]: RolePermissions };

const DEFAULT_PERMISSIONS: PermissionsState = {
  ktv_lead: {
    dashboard: true,
    customers: false,
    bookings: true,
    sessions: true,
    crm: false,
    services: true,
    marketing_ads: false,
    inventory: false,
    finance: false,
    reconciliation: false,
    salary: false,
    audit: false,
    settings: false
  },
  admin_staff: {
    dashboard: true,
    customers: true,
    bookings: true,
    sessions: true,
    crm: true,
    services: true,
    marketing_ads: false,
    inventory: true,
    finance: true,
    reconciliation: false,
    salary: false,
    audit: false,
    settings: false
  },
  accountant: {
    dashboard: true,
    customers: false,
    bookings: false,
    sessions: false,
    crm: false,
    services: true,
    marketing_ads: true,
    inventory: true,
    finance: true,
    reconciliation: true,
    salary: true,
    audit: false,
    settings: false
  },
  hr: {
    dashboard: true,
    customers: false,
    bookings: false,
    sessions: true,
    crm: false,
    services: false,
    marketing_ads: false,
    inventory: false,
    finance: false,
    reconciliation: false,
    salary: true,
    audit: false,
    settings: false
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clonePermissions(source: PermissionsState): PermissionsState {
  return {
    ktv_lead: { ...source.ktv_lead },
    admin_staff: { ...source.admin_staff },
    accountant: { ...source.accountant },
    hr: { ...source.hr }
  };
}

function mergePersistedPermissions(current: PermissionsState, persisted: unknown): PermissionsState {
  if (!isRecord(persisted)) return current;

  const next = clonePermissions(current);
  for (const role of ROLES) {
    const rolePermissions = persisted[role.id];
    if (!isRecord(rolePermissions)) continue;

    for (const permissionModule of MODULES) {
      const enabled = rolePermissions[permissionModule.id];
      if (typeof enabled === "boolean") {
        next[role.id][permissionModule.id] = enabled;
      }
    }
  }

  return next;
}

export default function PermissionsTab() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [permissions, setPermissions] = useState<PermissionsState>(DEFAULT_PERMISSIONS);

  const supabase = createClient();

  async function loadPermissions() {
    setIsLoading(true);
    try {
      const data = await getTenantSettings();
      if (data?.role_permissions) {
        setPermissions((prev) => mergePersistedPermissions(prev, data.role_permissions));
      }
    } catch (error) {
      console.error("Error loading permissions", error);
      toast.error("Không thể tải cấu hình phân quyền");
    } finally {
      setIsLoading(false);
    }
  }

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }
    
    setIsAuthenticating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("Phiên đăng nhập không hợp lệ");
        return;
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });
      
      if (error) {
        toast.error("Mật khẩu không chính xác");
      } else {
        setIsAuthenticated(true);
        setPassword("");
        await loadPermissions();
        toast.success("Xác thực thành công");
      }
    } catch {
      toast.error("Lỗi xác thực");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTogglePermission = (roleId: RoleId, moduleId: ModuleId) => {
    setPermissions((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [moduleId]: !prev[roleId][moduleId]
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveTenantSettings({ role_permissions: permissions });
      
      if (res.success) {
        clearDashboardClientContextCache();
        toast.success("Đã lưu cấu hình phân quyền");
      } else {
        toast.error("Lỗi khi lưu: " + res.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu phân quyền");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-2">
            Khu vực bảo mật
          </h2>
          <p className="text-slate-500 font-medium mb-8">
            Phân quyền hệ thống là tính năng nhạy cảm. Vui lòng nhập lại mật khẩu của bạn để tiếp tục.
          </p>
          
          <form onSubmit={handleAuthenticate} className="space-y-4">
            <input
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-center"
            />
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-primary-hover transition-all disabled:opacity-50"
            >
              {isAuthenticating ? "Đang xác minh..." : "Xác nhận truy cập"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bella-toolbar mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Phân quyền truy cập
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">
              Tùy chỉnh quyền xem các module cho từng chức vụ
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Đang lưu..." : "Lưu phân quyền"}
        </button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white bg-white/40 shadow-sm">
        <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
          <table className="bella-data-table min-w-[64rem] text-left">
            <thead>
              <tr className="border-b border-white/50">
                <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50 w-1/3">
                  Module / Tính năng
                </th>
                {ROLES.map(role => (
                  <th key={role.id} className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center border-l border-white/50">
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr>
                  <td colSpan={ROLES.length + 1} className="py-20 text-center">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  </td>
                </tr>
              ) : (
                MODULES.map(module => (
                  <tr key={module.id} className="hover:bg-white/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 bg-slate-50/30">
                      {module.label}
                    </td>
                    {ROLES.map(role => {
                      const hasPermission = permissions[role.id]?.[module.id] ?? false;
                      return (
                        <td key={`${role.id}-${module.id}`} className="px-6 py-4 text-center border-l border-white/50">
                          <button
                            onClick={() => handleTogglePermission(role.id, module.id)}
                            className={cn(
                              "w-12 h-6 rounded-full p-1 transition-all mx-auto cursor-pointer flex items-center relative",
                              hasPermission ? "bg-emerald-500" : "bg-slate-200"
                            )}
                          >
                            <div
                              className={cn(
                                "w-4 h-4 bg-white rounded-full shadow-sm transition-all absolute",
                                hasPermission ? "left-[26px]" : "left-1"
                              )}
                            />
                            {hasPermission && <Check className="w-3 h-3 text-white absolute left-1.5" />}
                            {!hasPermission && <X className="w-3 h-3 text-slate-400 absolute right-1.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl mt-4 flex gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-800">Lưu ý về phân quyền</h4>
          <p className="text-sm text-amber-700/80 mt-1 font-medium leading-relaxed">
            - <strong>Quản trị viên (Admin)</strong> luôn có toàn quyền truy cập tất cả các module.<br/>
            - <strong>Kỹ thuật viên (KTV)</strong> mặc định chỉ được truy cập Dashboard, Lịch hẹn và Thẻ liệu trình của cá nhân.
          </p>
        </div>
      </div>
    </div>
  );
}
