"use client";

import React from "react";
import { Store, Phone, Mail, MapPin, Camera, Database } from "lucide-react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { TenantGeneralSettings, DEFAULT_CONFLICT_DETECTION_CONFIG } from "@/types/domain";
import OverbookingConfigSection from "./OverbookingConfigSection";
import { useTenantModuleKey } from "@/hooks/useTenantModuleKey";
import { useUser } from "@/lib/user-context";

const POPULAR_BANKS = [
  { code: "MB", name: "MB Bank (Ngân hàng Quân Đội)" },
  { code: "VCB", name: "Vietcombank (Ngoại Thương Việt Nam)" },
  { code: "CTG", name: "VietinBank (Công Thương Việt Nam)" },
  { code: "BIDV", name: "BIDV (Đầu tư và Phát triển)" },
  { code: "TCB", name: "Techcombank (Kỹ Thương Việt Nam)" },
  { code: "ACB", name: "ACB (Á Châu)" },
  { code: "STB", name: "Sacombank (Sài Gòn Thương Tín)" },
  { code: "VPB", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { code: "TPB", name: "TPBank (Tiên Phong)" },
];

interface GeneralSettingsTabProps {
  generalSettings: TenantGeneralSettings;
  setGeneralSettings: React.Dispatch<React.SetStateAction<TenantGeneralSettings>>;
  isLoadingSettings: boolean;
}

export default function GeneralSettingsTab({
  generalSettings,
  setGeneralSettings,
  isLoadingSettings,
}: GeneralSettingsTabProps) {
  const { tenantModuleKey } = useTenantModuleKey();
  const { product } = useUser();
  const isHaircut = product?.productKey === "bella_haircut";
  const isRealEstate = tenantModuleKey === "real_estate";
  const isIndustrialCleaning = tenantModuleKey === "industrial_cleaning";
  const isBellaAuto = tenantModuleKey === "bella_auto";
  const isBellaHealthcare = tenantModuleKey === "bella_healthcare";

  if (isLoadingSettings) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-bold">
          Đang tải thông tin cấu hình...
        </p>
      </div>
    );
  }

  const titleText = isHaircut
    ? "Thông tin Haircut Shop"
    : isRealEstate
    ? "Thông tin Doanh nghiệp" 
    : isBellaAuto
    ? "Thông tin Showroom"
    : isIndustrialCleaning 
    ? "Thông tin Công ty" 
    : isBellaHealthcare
    ? "Thông tin Bệnh viện"
    : "Thông tin Spa";

  const subtitleText = isRealEstate
    ? "Cấu hình thông tin cơ bản hiển thị trên hợp đồng, hóa đơn và hệ thống"
    : isBellaAuto
    ? "Cấu hình thông tin cơ bản hiển thị trên hóa đơn và hệ thống"
    : "Cấu hình thông tin cơ bản hiển thị trên hóa đơn và hệ thống";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {titleText}
          </h2>
          <p className="text-sm text-muted-foreground font-semibold">
            {subtitleText}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Store className="w-4 h-4" /> Tên thương hiệu
            </label>
            <input
              type="text"
              value={generalSettings.name}
              onChange={(e) => setGeneralSettings({ ...generalSettings, name: e.target.value })}
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Phone className="w-4 h-4" /> Hotline
            </label>
            <input
              type="text"
              value={generalSettings.phone}
              onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email liên hệ
            </label>
            <input
              type="email"
              value={generalSettings.email}
              onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Địa chỉ trụ sở
            </label>
            <textarea
              value={generalSettings.address}
              onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
              rows={4}
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold resize-none"
            />
          </div>
          <div className="p-6 bg-white/40 dark:bg-slate-800/40 rounded-[2rem] border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="font-black text-foreground">
                Logo thương hiệu
              </p>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                PNG, JPG tối đa 5MB
              </p>
            </div>
            <button className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-primary-foreground transition-all group">
              <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* VietQR Bank Configuration */}
      <div className="mt-8 pt-8 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Cấu hình thanh toán VietQR động
            </h3>
            <p className="text-sm text-muted-foreground font-semibold">
              Tài khoản ngân hàng nhận tiền cọc/thanh toán và đối soát tự động
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              Ngân hàng thụ hưởng
            </label>
            <PremiumSelect
              value={generalSettings.qr_bank_code || ""}
              onChange={(value) => setGeneralSettings({ ...generalSettings, qr_bank_code: value })}
              options={POPULAR_BANKS.map((bank) => ({ value: bank.code, label: bank.name }))}
              placeholder="-- Chọn ngân hàng --"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              Số tài khoản
            </label>
            <input
              type="text"
              value={generalSettings.qr_account_number}
              onChange={(e) => setGeneralSettings({ ...generalSettings, qr_account_number: e.target.value.replace(/\s+/g, "") })}
              placeholder="Nhập số tài khoản"
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              Tên chủ tài khoản
            </label>
            <input
              type="text"
              value={generalSettings.qr_account_name}
              onChange={(e) => setGeneralSettings({ ...generalSettings, qr_account_name: e.target.value.toUpperCase() })}
              placeholder="VD: NGUYEN VAN A"
              className="w-full px-6 py-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
            />
          </div>
        </div>
      </div>

      {/* Advanced Conflict Detection Toggles */}
      {!isRealEstate && (
        <OverbookingConfigSection
          config={(generalSettings.salary_config.conflict_detection as unknown as import('@/types/domain').ConflictDetectionConfig) ?? DEFAULT_CONFLICT_DETECTION_CONFIG}
          onChange={(updatedCd) =>
            setGeneralSettings({
              ...generalSettings,
              salary_config: {
                ...generalSettings.salary_config,
                conflict_detection: updatedCd as unknown as import('@/types/database.types').Json,
              },
            })
          }
        />
      )}
    </div>
  );
}
