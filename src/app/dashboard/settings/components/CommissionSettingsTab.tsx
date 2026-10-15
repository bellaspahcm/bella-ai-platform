'use client';

/**
 * @fileoverview Commission Settings Tab - Admin configuration for commission defaults
 * @module app/dashboard/settings/components/CommissionSettingsTab
 * 
 * MVP implementation: Basic commission config UI for Beauty Spa module
 * Allows admin to configure:
 * - Service commission defaults (fixed amount OR percentage)
 * - Product sales commission defaults (fixed amount OR percentage)
 * - Position tier multipliers (junior/senior/lead)
 * - Seniority bonus rates (0-1y, 1-3y, 3-5y, 5+y)
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, DollarSign, Percent, Users, Clock, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { saveTenantSettings, getTenantSettings } from '@/services/tenant-actions';
import { clearDashboardClientContextCache } from '@/lib/dashboard-client-context';
import { cn } from '@/lib/utils';
import type { CommissionConfig } from '@/lib/business-rules/commission';
import { DEFAULT_COMMISSION_CONFIG } from '@/lib/business-rules/commission';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { Json } from '@/types/database.types';

import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';

interface CommissionSettingsTabProps {
  className?: string;
}

type CommissionType = 'fixed' | 'percentage';

export default function CommissionSettingsTab({ className }: CommissionSettingsTabProps) {
  const { tenantModuleKey } = useTenantModuleKey();
  const isHealthcare = tenantModuleKey === 'bella_healthcare';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Service commission defaults
  const [serviceType, setServiceType] = useState<CommissionType>('fixed');
  const [serviceValue, setServiceValue] = useState<string>('150000');

  // Product sales commission defaults
  const [productType, setProductType] = useState<CommissionType>('percentage');
  const [productValue, setProductValue] = useState<string>('10');

  // Position multipliers
  const [juniorMultiplier, setJuniorMultiplier] = useState<string>('1.0');
  const [seniorMultiplier, setSeniorMultiplier] = useState<string>('1.2');
  const [leadMultiplier, setLeadMultiplier] = useState<string>('1.5');

  // Seniority bonus rates
  const [seniority0to1, setSeniority0to1] = useState<string>('0');
  const [seniority1to3, setSeniority1to3] = useState<string>('5');
  const [seniority3to5, setSeniority3to5] = useState<string>('10');
  const [seniority5plus, setSeniority5plus] = useState<string>('15');

  const loadCommissionConfig = async () => {
    setIsLoading(true);
    try {
      const settings = await getTenantSettings();
      const config = (settings as Record<string, unknown>)?.commission_config as CommissionConfig | null;

      if (config) {
        // Service commission
        if (config.service_commission_default) {
          setServiceType(config.service_commission_default.type);
          setServiceValue(String(config.service_commission_default.value));
        }

        // Product sales commission
        if (config.product_sales_commission_default) {
          setProductType(config.product_sales_commission_default.type);
          setProductValue(String(config.product_sales_commission_default.value));
        }

        // Position multipliers
        if (config.position_multipliers) {
          setJuniorMultiplier(String(config.position_multipliers.junior));
          setSeniorMultiplier(String(config.position_multipliers.senior));
          setLeadMultiplier(String(config.position_multipliers.lead));
        }

        // Seniority bonus rates
        if (config.seniority_bonus_rates) {
          setSeniority0to1(String(config.seniority_bonus_rates['0_to_1_year'] * 100));
          setSeniority1to3(String(config.seniority_bonus_rates['1_to_3_years'] * 100));
          setSeniority3to5(String(config.seniority_bonus_rates['3_to_5_years'] * 100));
          setSeniority5plus(String(config.seniority_bonus_rates['5_plus_years'] * 100));
        }
      }
    } catch (error) {
      console.error('Error loading commission config:', error);
      toast.error('Không thể tải cấu hình hoa hồng');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommissionConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const commissionConfig: CommissionConfig = {
        service_commission_default: {
          type: serviceType,
          value: Number(serviceValue),
        },
        product_sales_commission_default: {
          type: productType,
          value: Number(productValue),
        },
        position_multipliers: {
          junior: Number(juniorMultiplier),
          senior: Number(seniorMultiplier),
          lead: Number(leadMultiplier),
        },
        seniority_bonus_rates: {
          '0_to_1_year': Number(seniority0to1) / 100,
          '1_to_3_years': Number(seniority1to3) / 100,
          '3_to_5_years': Number(seniority3to5) / 100,
          '5_plus_years': Number(seniority5plus) / 100,
        },
      };

      const res = await saveTenantSettings({ commission_config: commissionConfig as unknown as Json });
      if (res.success) {
        clearDashboardClientContextCache();
        toast.success('Đã lưu cấu hình hoa hồng');
      } else {
        toast.error('Lỗi khi lưu cấu hình: ' + res.error);
      }
    } catch (error) {
      console.error('Error saving commission config:', error);
      toast.error('Lỗi khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {isHealthcare ? 'Cấu hình hoa hồng & thủ thuật' : 'Cấu hình hoa hồng'}
            </h2>
            <p className="text-sm font-semibold text-muted-foreground">
              {isHealthcare 
                ? 'Thiết lập mức hoa hồng mặc định cho dịch vụ khám, thủ thuật & dược phẩm'
                : 'Thiết lập mức hoa hồng mặc định cho hoạt động dịch vụ & bán hàng'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu cấu hình
            </>
          )}
        </button>
      </div>

      {/* Service Commission Section */}
      <div className="relative z-40 border border-slate-100/70 bg-white/60 p-6 rounded-[2rem] shadow-sm backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100/50">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
              {isHealthcare ? 'Hoa hồng khám & thủ thuật' : 'Hoa hồng dịch vụ & tư vấn'}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {isHealthcare
                ? 'Cấu hình mức hoa hồng mặc định cho từng lượt khám & thủ thuật y tế'
                : 'Cấu hình mức hoa hồng mặc định cho các dịch vụ & giao dịch'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Loại hoa hồng
            </label>
            <PremiumSelect
              value={serviceType}
              onChange={(val) => setServiceType(val as CommissionType)}
              options={[
                { value: 'fixed', label: 'Số tiền cố định (VND)' },
                { value: 'percentage', label: 'Phần trăm (%)' },
              ]}
              placeholder="Chọn loại hoa hồng"
              dropdownClassName="shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-slate-200/80"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Giá trị
            </label>
            <div className="relative">
              <input
                type="number"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-14 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                placeholder={serviceType === 'fixed' ? '150000' : '10'}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                {serviceType === 'fixed' ? 'đ' : '%'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2">
          Ví dụ: {serviceType === 'fixed' 
            ? `${Number(serviceValue).toLocaleString('vi-VN')}đ mỗi giao dịch` 
            : `${serviceValue}% trên giá trị hợp đồng / dịch vụ`}
        </p>
      </div>

      {/* Product Sales Commission Section */}
      <div className="relative z-30 border border-slate-100/70 bg-white/60 p-6 rounded-[2rem] shadow-sm backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100/50">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
              {isHealthcare ? 'Hoa hồng kê đơn & vật tư y tế' : 'Hoa hồng bán hàng & sản phẩm'}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {isHealthcare
                ? 'Cấu hình mức hoa hồng mặc định cho việc bán dược phẩm & vật tư y tế'
                : 'Cấu hình mức hoa hồng mặc định cho việc bán hàng & sản phẩm'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Loại hoa hồng
            </label>
            <PremiumSelect
              value={productType}
              onChange={(val) => setProductType(val as CommissionType)}
              options={[
                { value: 'fixed', label: 'Số tiền cố định (VND)' },
                { value: 'percentage', label: 'Phần trăm (%)' },
              ]}
              placeholder="Chọn loại hoa hồng"
              dropdownClassName="shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-slate-200/80"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Giá trị
            </label>
            <div className="relative">
              <input
                type="number"
                value={productValue}
                onChange={(e) => setProductValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-14 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                placeholder={productType === 'fixed' ? '50000' : '10'}
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                {productType === 'fixed' ? 'đ' : '%'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2">
          Ví dụ: {productType === 'fixed' 
            ? `${Number(productValue).toLocaleString('vi-VN')}đ mỗi sản phẩm` 
            : `${productValue}% trên doanh số bán hàng`}
        </p>
      </div>

      {/* Position Multipliers Section */}
      <div className="relative z-20 border border-slate-100/70 bg-white/60 p-6 rounded-[2rem] shadow-sm backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100/50">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">Hệ số vị trí</h3>
            <p className="text-xs text-slate-500 font-semibold">Điều chỉnh hệ số nhân hoa hồng dựa theo cấp bậc chức vụ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Junior (Nhân viên mới)
            </label>
            <input
              type="number"
              step="0.1"
              value={juniorMultiplier}
              onChange={(e) => setJuniorMultiplier(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Senior (Chính thức)
            </label>
            <input
              type="number"
              step="0.1"
              value={seniorMultiplier}
              onChange={(e) => setSeniorMultiplier(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              Lead (Trưởng ca)
            </label>
            <input
              type="number"
              step="0.1"
              value={leadMultiplier}
              onChange={(e) => setLeadMultiplier(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2">
          Hệ số nhân hoa hồng theo vị trí. Junior: {juniorMultiplier}x, Senior: {seniorMultiplier}x (+{Math.round((Number(seniorMultiplier) - 1) * 100)}%), Lead: {leadMultiplier}x (+{Math.round((Number(leadMultiplier) - 1) * 100)}%)
        </p>
      </div>

      {/* Seniority Bonus Section */}
      <div className="relative z-10 border border-slate-100/70 bg-white/60 p-6 rounded-[2rem] shadow-sm backdrop-blur-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100/50">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">Thưởng thâm niên (%)</h3>
            <p className="text-xs text-slate-500 font-semibold">Tự động cộng thưởng theo thời gian làm việc</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              0-1 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority0to1}
                onChange={(e) => setSeniority0to1(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              1-3 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority1to3}
                onChange={(e) => setSeniority1to3(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              3-5 năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority3to5}
                onChange={(e) => setSeniority3to5(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              5+ năm
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                value={seniority5plus}
                onChange={(e) => setSeniority5plus(e.target.value)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-3.5 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</span>
            </div>
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-2">
          Thưởng thâm niên tính trên lương cơ bản. Áp dụng tự động theo số năm làm việc của nhân sự.
        </p>
      </div>
    </div>
  );
}
