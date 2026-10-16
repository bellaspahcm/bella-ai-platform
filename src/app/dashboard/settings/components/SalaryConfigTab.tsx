'use client';
// Version: 2.0.0 - Configuration-Driven Payroll System

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Coins, Award, Calendar, Star, Save, Loader2, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { parseIntegerInput, parseDecimalInput } from '@/lib/utils';
import {
  loadKPIConfig,
  saveKPIConfig,
  loadAttendanceConfig,
  saveAttendanceConfig,
  loadRatingConfig,
  saveRatingConfig,
  loadCommissionConfig,
  saveCommissionConfig,
} from '@/services/payroll-config-actions';
import type { TenantGeneralSettings } from '@/types/domain';
import type {
  KPIThresholdConfig,
  AttendanceConfig,
  RatingThresholdConfig,
  KPIConfig,
  RatingConfig,
} from '@/types/payroll-config';

interface SalaryConfigTabProps {
  generalSettings: TenantGeneralSettings;
  setGeneralSettings: (settings: TenantGeneralSettings) => void;
}

function getConfigPrimitive(value: unknown): string | number | null | undefined {
  return typeof value === 'string' || typeof value === 'number' || value === null || value === undefined
    ? value
    : undefined;
}

export default function SalaryConfigTab({
  generalSettings,
  setGeneralSettings,
}: SalaryConfigTabProps) {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // KPI Config
  const [kpiEnabled, setKpiEnabled] = useState(false);
  const [kpiStrategy, setKpiStrategy] = useState<'threshold' | 'linear' | 'tier'>('threshold');
  const [kpiTarget, setKpiTarget] = useState(30);
  const [kpiBonus, setKpiBonus] = useState(1000000);
  // For linear strategy
  const [kpiRatePerSession, setKpiRatePerSession] = useState(50000);
  // For tier strategy
  const [kpiTiers, setKpiTiers] = useState<Array<{ min: number; max: number; bonus: number }>>([
    { min: 0, max: 29, bonus: 0 },
    { min: 30, max: 49, bonus: 1000000 },
    { min: 50, max: 999, bonus: 2000000 }
  ]);

  // Attendance Config
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [attendanceStrategy, setAttendanceStrategy] = useState<'late_deduction' | 'absent_deduction' | 'combined'>('combined');
  const [latePenalty, setLatePenalty] = useState(50000);
  const [absentPenalty, setAbsentPenalty] = useState(200000);
  const [lateGracePeriod, setLateGracePeriod] = useState(15);

  // Rating Config
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [ratingStrategy, setRatingStrategy] = useState<'threshold' | 'linear' | 'tier'>('threshold');
  const [minRating, setMinRating] = useState(4.5);
  const [ratingBonus, setRatingBonus] = useState(50000);
  // For linear strategy
  const [ratingRatePerStar, setRatingRatePerStar] = useState(10000);
  // For tier strategy
  const [ratingTiers, setRatingTiers] = useState<Array<{ min: number; max: number; bonus: number }>>([
    { min: 4.0, max: 4.4, bonus: 30000 },
    { min: 4.5, max: 4.9, bonus: 50000 },
    { min: 5.0, max: 5.0, bonus: 100000 }
  ]);

  // Commission Config
  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [commissionStrategy, setCommissionStrategy] = useState<'fixed' | 'tier' | 'percentage' | 'service' | 'product_sales' | 'total_revenue'>('fixed');
  // For fixed strategy
  const [commissionRate, setCommissionRate] = useState(120000);
  const [commissionMinSessions, setCommissionMinSessions] = useState(0);
  // For tier strategy
  const [commissionTiers, setCommissionTiers] = useState<Array<{ min: number; max: number; rate: number }>>([
    { min: 0, max: 10, rate: 100000 },
    { min: 11, max: 20, rate: 120000 },
    { min: 21, max: 999, rate: 150000 }
  ]);
  // For percentage strategy
  const [commissionPercentage, setCommissionPercentage] = useState(15);
  const [commissionMinRevenue, setCommissionMinRevenue] = useState(0);
  // For service strategy
  const [commissionServiceRates, setCommissionServiceRates] = useState<Record<string, number>>({
    'massage': 150000,
    'facial': 100000,
    'waxing': 80000
  });
  // For product_sales strategy
  const [productSalesPercentage, setProductSalesPercentage] = useState(15);
  const [productSalesMinSales, setProductSalesMinSales] = useState(0);
  // For total_revenue strategy
  const [totalRevenuePercentage, setTotalRevenuePercentage] = useState(10);
  const [totalRevenueMinRevenue, setTotalRevenueMinRevenue] = useState(0);
  const [serviceWeight, setServiceWeight] = useState(1.0);
  const [productWeight, setProductWeight] = useState(1.0);

  // Legacy fallback: Load from generalSettings.salary_config if new config not available
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get tenantId from session/context
  useEffect(() => {
    async function fetchTenantId() {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          
          if (profile?.tenant_id) {
            setTenantId(profile.tenant_id);
          }
        }
      } catch (error) {
        console.error('[SalaryConfigTab] Error fetching tenantId:', error);
      }
    }
    fetchTenantId();
  }, []);

  // Load configurations
  useEffect(() => {
    if (!tenantId) return;

    async function loadConfigs() {
      setIsLoading(true);
      try {
        // Load KPI
        const kpiResult = await loadKPIConfig(tenantId!);
        if (kpiResult.success && kpiResult.data) {
          setKpiEnabled(kpiResult.data.enabled);
          setKpiStrategy(kpiResult.data.strategy as 'threshold' | 'linear' | 'tier' || 'threshold');
          const config = kpiResult.data.config as unknown as Record<string, unknown>;
          
          if (kpiResult.data.strategy === 'threshold') {
            setKpiTarget(Number(config.target) || 30);
            setKpiBonus(Number(config.bonus) || 1000000);
          } else if (kpiResult.data.strategy === 'linear') {
            setKpiRatePerSession(Number(config.ratePerSession) || 50000);
          } else if (kpiResult.data.strategy === 'tier') {
            setKpiTiers((config.tiers as Array<{ min: number; max: number; bonus: number }>) || kpiTiers);
          }
        } else {
          // Fallback to legacy generalSettings
          setKpiTarget(generalSettings.salary_config?.kpi_target_sessions || 30);
          setKpiBonus(generalSettings.salary_config?.kpi_bonus_amount || 1000000);
        }

        // Load Attendance
        const attendanceResult = await loadAttendanceConfig(tenantId!);
        if (attendanceResult.success && attendanceResult.data) {
          setAttendanceEnabled(attendanceResult.data.enabled);
          const config = attendanceResult.data.config as AttendanceConfig;
          setLatePenalty(config.latePenalty || 50000);
          setAbsentPenalty(config.absentPenalty || 200000);
          setLateGracePeriod(config.lateGracePeriod || 15);
        } else {
          // Fallback to legacy generalSettings
          setLatePenalty(generalSettings.salary_config?.penalty_late_per_day || 50000);
          setAbsentPenalty(generalSettings.salary_config?.penalty_absent_per_day || 200000);
        }

        // Load Rating
        const ratingResult = await loadRatingConfig(tenantId!);
        if (ratingResult.success && ratingResult.data) {
          setRatingEnabled(ratingResult.data.enabled);
          const config = ratingResult.data.config as RatingThresholdConfig;
          setMinRating(config.minRating || 4.5);
          setRatingBonus(config.bonus || 50000);
        } else {
          // Fallback to legacy generalSettings
          setRatingBonus(generalSettings.salary_config?.bonus_5_star || 50000);
        }

        // Load Commission
        const commissionResult = await loadCommissionConfig(tenantId!);
        if (commissionResult.success && commissionResult.data) {
          setCommissionEnabled(commissionResult.data.enabled);
          setCommissionStrategy(commissionResult.data.strategy as typeof commissionStrategy || 'fixed');
          const config = commissionResult.data.config as Record<string, unknown>;
          
          if (commissionResult.data.strategy === 'fixed') {
            setCommissionRate(parseIntegerInput(getConfigPrimitive(config.rate), { fallback: 120000 }));
            setCommissionMinSessions(parseIntegerInput(getConfigPrimitive(config.minSessions)));
          } else if (commissionResult.data.strategy === 'tier') {
            setCommissionTiers((config.tiers as Array<{ min: number; max: number; rate: number }>) || commissionTiers);
          } else if (commissionResult.data.strategy === 'percentage') {
            setCommissionPercentage(parseIntegerInput(getConfigPrimitive(config.percentage), { fallback: 15 }));
            setCommissionMinRevenue(parseIntegerInput(getConfigPrimitive(config.minRevenue)));
          } else if (commissionResult.data.strategy === 'service') {
            setCommissionServiceRates((config.rates as Record<string, number>) || commissionServiceRates);
          } else if (commissionResult.data.strategy === 'product_sales') {
            setProductSalesPercentage(parseIntegerInput(getConfigPrimitive(config.percentage), { fallback: 15 }));
            setProductSalesMinSales(parseIntegerInput(getConfigPrimitive(config.minSales)));
          } else if (commissionResult.data.strategy === 'total_revenue') {
            setTotalRevenuePercentage(parseIntegerInput(getConfigPrimitive(config.percentage), { fallback: 10 }));
            setTotalRevenueMinRevenue(parseIntegerInput(getConfigPrimitive(config.minRevenue)));
            setServiceWeight(parseDecimalInput(getConfigPrimitive(config.serviceWeight), { fallback: 1.0 }));
            setProductWeight(parseDecimalInput(getConfigPrimitive(config.productWeight), { fallback: 1.0 }));
          }
        } else {
          // Default to fixed strategy if no config
          setCommissionEnabled(true);
          setCommissionRate(120000);
        }
      } catch (error) {
        console.error('[SalaryConfigTab] Error loading configs:', error);
        toast.error('Không thể tải cấu hình lương');
      } finally {
        setIsLoading(false);
      }
    }

    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]); // Removed generalSettings.salary_config to prevent re-load after save

  // Save configurations
  const handleSave = async () => {
    if (!tenantId) {
      toast.error('Không tìm thấy tenant ID');
      return;
    }

    setIsSaving(true);
    try {
      // Save KPI
      let kpiConfig: Record<string, unknown> = {};
      if (kpiStrategy === 'threshold') {
        kpiConfig = { target: kpiTarget, bonus: kpiBonus, metric: 'sessions' };
      } else if (kpiStrategy === 'linear') {
        kpiConfig = { ratePerSession: kpiRatePerSession, metric: 'sessions' };
      } else if (kpiStrategy === 'tier') {
        kpiConfig = { tiers: kpiTiers, metric: 'sessions' };
      }
      
      const kpiResult = await saveKPIConfig(
        tenantId,
        kpiEnabled,
        kpiStrategy,
        kpiConfig as unknown as KPIConfig
      );
      if (!kpiResult.success) {
        throw new Error(`KPI: ${kpiResult.error}`);
      }

      // Save Attendance
      const attendanceResult = await saveAttendanceConfig(
        tenantId,
        attendanceEnabled,
        attendanceStrategy,
        {
          latePenalty,
          absentPenalty,
          lateGracePeriod,
        }
      );
      if (!attendanceResult.success) {
        throw new Error(`Attendance: ${attendanceResult.error}`);
      }

      // Save Rating
      let ratingConfig: Record<string, unknown> = {};
      if (ratingStrategy === 'threshold') {
        ratingConfig = { minRating, bonus: ratingBonus };
      } else if (ratingStrategy === 'linear') {
        ratingConfig = { ratePerStar: ratingRatePerStar };
      } else if (ratingStrategy === 'tier') {
        ratingConfig = { tiers: ratingTiers };
      }
      
      const ratingResult = await saveRatingConfig(
        tenantId,
        ratingEnabled,
        ratingStrategy,
        ratingConfig as unknown as RatingConfig
      );
      if (!ratingResult.success) {
        throw new Error(`Rating: ${ratingResult.error}`);
      }

      // Save Commission
      let commissionConfig: Record<string, unknown> = {};
      if (commissionStrategy === 'fixed') {
        commissionConfig = { rate: commissionRate, minSessions: commissionMinSessions };
      } else if (commissionStrategy === 'tier') {
        commissionConfig = { tiers: commissionTiers };
      } else if (commissionStrategy === 'percentage') {
        commissionConfig = { percentage: commissionPercentage, minRevenue: commissionMinRevenue };
      } else if (commissionStrategy === 'service') {
        commissionConfig = { rates: commissionServiceRates };
      } else if (commissionStrategy === 'product_sales') {
        commissionConfig = { percentage: productSalesPercentage, minSales: productSalesMinSales };
      } else if (commissionStrategy === 'total_revenue') {
        commissionConfig = { 
          percentage: totalRevenuePercentage, 
          minRevenue: totalRevenueMinRevenue,
          serviceWeight,
          productWeight
        };
      }
      
      const commissionResult = await saveCommissionConfig(
        tenantId,
        commissionEnabled,
        commissionStrategy,
        commissionConfig
      );
      if (!commissionResult.success) {
        throw new Error(`Commission: ${commissionResult.error}`);
      }

      // Also update legacy generalSettings for backward compatibility
      setGeneralSettings({
        ...generalSettings,
        salary_config: {
          ...generalSettings.salary_config,
          kpi_target_sessions: kpiTarget,
          kpi_bonus_amount: kpiBonus,
          penalty_late_per_day: latePenalty,
          penalty_absent_per_day: absentPenalty,
          bonus_5_star: ratingBonus,
          bonus_4_5_star: Math.round(ratingBonus * 0.6),
          bonus_4_star: Math.round(ratingBonus * 0.2),
        },
      });

      toast.success('Đã lưu cấu hình lương thành công!');
    } catch (error: unknown) {
      console.error('[SalaryConfigTab] Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  // Input helpers

  const parseFloatInput = (value: string, { min = 0, max = 5, decimals = 1 } = {}) => {
    const num = parseFloat(value);
    if (isNaN(num)) return min;
    return Math.min(Math.max(Number(num.toFixed(decimals)), min), max);
  };

  if (isLoading && !tenantId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">
          Lương & Thưởng
        </h2>
        <p className="text-sm text-slate-500 dark:text-[#CDBCAB] mt-2 font-medium">
          Cấu hình các chính sách tính lương, thưởng KPI, phạt kỷ luật và thưởng chất lượng dịch vụ.
        </p>
      </div>

      {/* KPI Bonus Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 dark:bg-primary/5 rounded-2xl flex items-center justify-center">
              <Award className="w-6 h-6 text-primary dark:text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Thưởng KPI
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đạt mục tiêu ca làm việc → Nhận thưởng
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={kpiEnabled}
              onChange={(e) => setKpiEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 border border-slate-400/20 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Strategy Selector */}
        <div>
          <PremiumSelect
            label="Chiến lược tính thưởng"
            value={kpiStrategy}
            onChange={(value) => setKpiStrategy(value as 'threshold' | 'linear' | 'tier')}
            disabled={!kpiEnabled}
            options={[
              { 
                value: 'threshold', 
                label: 'Ngưỡng đơn (đạt X ca → nhận Y thưởng)',
                icon: <Target className="w-4 h-4" />
              },
              { 
                value: 'linear', 
                label: 'Tuyến tính (mỗi ca thêm → +Z đồng)',
                icon: <TrendingUp className="w-4 h-4" />
              },
              { 
                value: 'tier', 
                label: 'Bậc thang (nhiều mức 20/30/40 ca)',
                icon: <BarChart3 className="w-4 h-4" />
              }
            ]}
            placeholder="Chọn chiến lược..."
          />
        </div>

        {/* Conditional forms based on strategy */}
        {kpiStrategy === 'threshold' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Mục tiêu (số ca)
              </label>
              <input
                type="number"
                value={kpiTarget}
                onChange={(e) => setKpiTarget(parseIntegerInput(e.target.value, { min: 1, max: 500 }))}
                disabled={!kpiEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Thưởng (VNĐ)
              </label>
              <input
                type="number"
                value={kpiBonus}
                onChange={(e) => setKpiBonus(parseIntegerInput(e.target.value, { min: 0 }))}
                disabled={!kpiEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {kpiStrategy === 'linear' && (
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Thưởng mỗi ca (VNĐ)
            </label>
            <input
              type="number"
              value={kpiRatePerSession}
              onChange={(e) => setKpiRatePerSession(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!kpiEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Ví dụ: 50000 (50k mỗi ca)"
            />
          </div>
        )}

        {kpiStrategy === 'tier' && (
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Các mức thưởng theo bậc
            </label>
            {kpiTiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Từ ca</label>
                  <input
                    type="number"
                    value={tier.min}
                    onChange={(e) => {
                      const newTiers = [...kpiTiers];
                      newTiers[index].min = parseIntegerInput(e.target.value, { min: 0, max: 999 });
                      setKpiTiers(newTiers);
                    }}
                    disabled={!kpiEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Đến ca</label>
                  <input
                    type="number"
                    value={tier.max}
                    onChange={(e) => {
                      const newTiers = [...kpiTiers];
                      newTiers[index].max = parseIntegerInput(e.target.value, { min: 0, max: 999 });
                      setKpiTiers(newTiers);
                    }}
                    disabled={!kpiEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Thưởng (VNĐ)</label>
                  <input
                    type="number"
                    value={tier.bonus}
                    onChange={(e) => {
                      const newTiers = [...kpiTiers];
                      newTiers[index].bonus = parseIntegerInput(e.target.value, { min: 0 });
                      setKpiTiers(newTiers);
                    }}
                    disabled={!kpiEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={() => {
                    const newTiers = kpiTiers.filter((_, i) => i !== index);
                    setKpiTiers(newTiers);
                  }}
                  disabled={!kpiEnabled || kpiTiers.length <= 1}
                  className="h-12 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#EFE9E1] font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const lastTier = kpiTiers[kpiTiers.length - 1];
                const newMin = lastTier.max + 1;
                setKpiTiers([...kpiTiers, { min: newMin, max: newMin + 9, bonus: 0 }]);
              }}
              disabled={!kpiEnabled}
              className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] font-bold hover:border-primary dark:hover:border-primary hover:text-primary dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Thêm mức thưởng
            </button>
          </div>
        )}

        {!kpiEnabled && (
          <div className="bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
            ⚠️ Thưởng KPI hiện đang <strong>tắt</strong>. Nhân sự sẽ không nhận thưởng khi đạt mục tiêu.
          </div>
        )}
      </section>

      {/* Attendance Penalties Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-primary/5 rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-rose-500 dark:text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Phạt Kỷ Luật
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đi trễ, Vắng mặt → Trừ lương
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={attendanceEnabled}
              onChange={(e) => setAttendanceEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 border border-slate-400/20 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-primary/5"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Phạt đi trễ (VNĐ)
            </label>
            <input
              type="number"
              value={latePenalty}
              onChange={(e) => setLatePenalty(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Phạt vắng (VNĐ)
            </label>
            <input
              type="number"
              value={absentPenalty}
              onChange={(e) => setAbsentPenalty(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Dung sai (phút)
            </label>
            <input
              type="number"
              value={lateGracePeriod}
              onChange={(e) => setLateGracePeriod(parseIntegerInput(e.target.value, { min: 0, max: 60 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!attendanceEnabled && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-primary/15 rounded-xl px-4 py-3 text-xs text-rose-600 dark:text-[#EFE9E1] font-medium">
            ⚠️ Phạt kỷ luật hiện đang <strong>tắt</strong>. Hệ thống sẽ không tự động trừ lương khi nhân sự đi trễ hoặc vắng mặt.
          </div>
        )}
      </section>

      {/* Rating Bonus Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-primary/20 rounded-2xl flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-500 dark:text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Thưởng Chất Lượng
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đánh giá khách hàng cao → Nhận thưởng
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={ratingEnabled}
              onChange={(e) => setRatingEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 border border-slate-400/20 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500 dark:peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Strategy Selector */}
        <div>
          <PremiumSelect
            label="Chiến lược tính thưởng"
            value={ratingStrategy}
            onChange={(value) => setRatingStrategy(value as 'threshold' | 'linear' | 'tier')}
            disabled={!ratingEnabled}
            options={[
              { 
                value: 'threshold', 
                label: 'Ngưỡng đơn (≥ X sao → nhận Y thưởng)',
                icon: <Target className="w-4 h-4" />
              },
              { 
                value: 'linear', 
                label: 'Tuyến tính (mỗi 0.1 sao thêm → +Z đồng)',
                icon: <TrendingUp className="w-4 h-4" />
              },
              { 
                value: 'tier', 
                label: 'Bậc thang (4.0-4.4 / 4.5-4.9 / 5.0)',
                icon: <BarChart3 className="w-4 h-4" />
              }
            ]}
            placeholder="Chọn chiến lược..."
          />
        </div>

        {/* Conditional forms based on strategy */}
        {ratingStrategy === 'threshold' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Đánh giá tối thiểu (⭐)
              </label>
              <input
                type="number"
                step="0.1"
                value={minRating}
                onChange={(e) => setMinRating(parseFloatInput(e.target.value, { min: 0, max: 5 }))}
                disabled={!ratingEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Thưởng (VNĐ)
              </label>
              <input
                type="number"
                value={ratingBonus}
                onChange={(e) => setRatingBonus(parseIntegerInput(e.target.value, { min: 0 }))}
                disabled={!ratingEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {ratingStrategy === 'linear' && (
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Thưởng mỗi 0.1 sao (VNĐ)
            </label>
            <input
              type="number"
              value={ratingRatePerStar}
              onChange={(e) => setRatingRatePerStar(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!ratingEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Ví dụ: 10000 (10k mỗi 0.1 sao)"
            />
          </div>
        )}

        {ratingStrategy === 'tier' && (
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Các mức thưởng theo đánh giá
            </label>
            {ratingTiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Từ (⭐)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tier.min}
                    onChange={(e) => {
                      const newTiers = [...ratingTiers];
                      newTiers[index].min = parseFloatInput(e.target.value, { min: 0, max: 5 });
                      setRatingTiers(newTiers);
                    }}
                    disabled={!ratingEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Đến (⭐)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tier.max}
                    onChange={(e) => {
                      const newTiers = [...ratingTiers];
                      newTiers[index].max = parseFloatInput(e.target.value, { min: 0, max: 5 });
                      setRatingTiers(newTiers);
                    }}
                    disabled={!ratingEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Thưởng (VNĐ)</label>
                  <input
                    type="number"
                    value={tier.bonus}
                    onChange={(e) => {
                      const newTiers = [...ratingTiers];
                      newTiers[index].bonus = parseIntegerInput(e.target.value, { min: 0 });
                      setRatingTiers(newTiers);
                    }}
                    disabled={!ratingEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={() => {
                    const newTiers = ratingTiers.filter((_, i) => i !== index);
                    setRatingTiers(newTiers);
                  }}
                  disabled={!ratingEnabled || ratingTiers.length <= 1}
                  className="h-12 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#EFE9E1] font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const lastTier = ratingTiers[ratingTiers.length - 1];
                const newMin = Math.min(lastTier.max + 0.1, 5);
                setRatingTiers([...ratingTiers, { min: newMin, max: 5.0, bonus: 0 }]);
              }}
              disabled={!ratingEnabled}
              className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] font-bold hover:border-amber-500 dark:hover:border-primary hover:text-amber-500 dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Thêm mức đánh giá
            </button>
          </div>
        )}

        {!ratingEnabled && (
          <div className="bg-amber-50 dark:bg-primary/20 border border-amber-100 dark:border-primary rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-[#EFE9E1] font-medium">
            ⚠️ Thưởng chất lượng hiện đang <strong>tắt</strong>. Nhân sự sẽ không nhận thưởng khi có đánh giá cao.
          </div>
        )}
      </section>

      {/* Commission Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-[#2E5D3E]/30 rounded-2xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-emerald-600 dark:text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Hoa Hồng Ca
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Làm ca → Nhận hoa hồng theo chiến lược
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={commissionEnabled}
              onChange={(e) => setCommissionEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 border border-slate-400/20 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Strategy Selector */}
        <div>
          <PremiumSelect
            label="Chiến lược tính hoa hồng"
            value={commissionStrategy}
            onChange={(value) => setCommissionStrategy(value as typeof commissionStrategy)}
            disabled={!commissionEnabled}
            options={[
              { 
                value: 'fixed', 
                label: 'Cố định (mỗi ca cố định X đồng)',
                icon: <Coins className="w-4 h-4" />
              },
              { 
                value: 'tier', 
                label: 'Bậc thang (0-10ca→100k, 11-20ca→120k)',
                icon: <BarChart3 className="w-4 h-4" />
              },
              { 
                value: 'percentage', 
                label: 'Phần trăm doanh thu (% giá trị booking)',
                icon: <TrendingUp className="w-4 h-4" />
              },
              { 
                value: 'service', 
                label: 'Theo dịch vụ (massage→150k, facial→100k)',
                icon: <Target className="w-4 h-4" />
              },
              { 
                value: 'product_sales', 
                label: 'Phần trăm bán hàng (% doanh số mỹ phẩm)',
                icon: <Coins className="w-4 h-4" />
              },
              { 
                value: 'total_revenue', 
                label: 'Tổng doanh thu (% dịch vụ + bán hàng)',
                icon: <TrendingUp className="w-4 h-4" />
              }
            ]}
            placeholder="Chọn chiến lược..."
          />
        </div>

        {/* Conditional forms based on strategy */}
        {commissionStrategy === 'fixed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Hoa hồng mỗi ca (VNĐ)
              </label>
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseIntegerInput(e.target.value, { min: 0 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 120000"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Số ca tối thiểu (không bắt buộc)
              </label>
              <input
                type="number"
                value={commissionMinSessions}
                onChange={(e) => setCommissionMinSessions(parseIntegerInput(e.target.value, { min: 0, max: 100 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 0 (không giới hạn)"
              />
            </div>
          </div>
        )}

        {commissionStrategy === 'tier' && (
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Các mức hoa hồng theo số ca
            </label>
            {commissionTiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Từ ca</label>
                  <input
                    type="number"
                    value={tier.min}
                    onChange={(e) => {
                      const newTiers = [...commissionTiers];
                      newTiers[index].min = parseIntegerInput(e.target.value, { min: 0, max: 999 });
                      setCommissionTiers(newTiers);
                    }}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Đến ca</label>
                  <input
                    type="number"
                    value={tier.max}
                    onChange={(e) => {
                      const newTiers = [...commissionTiers];
                      newTiers[index].max = parseIntegerInput(e.target.value, { min: 0, max: 999 });
                      setCommissionTiers(newTiers);
                    }}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Hoa hồng (VNĐ)</label>
                  <input
                    type="number"
                    value={tier.rate}
                    onChange={(e) => {
                      const newTiers = [...commissionTiers];
                      newTiers[index].rate = parseIntegerInput(e.target.value, { min: 0 });
                      setCommissionTiers(newTiers);
                    }}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={() => {
                    const newTiers = commissionTiers.filter((_, i) => i !== index);
                    setCommissionTiers(newTiers);
                  }}
                  disabled={!commissionEnabled || commissionTiers.length <= 1}
                  className="h-12 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#EFE9E1] font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const lastTier = commissionTiers[commissionTiers.length - 1];
                const newMin = lastTier.max + 1;
                setCommissionTiers([...commissionTiers, { min: newMin, max: newMin + 9, rate: 0 }]);
              }}
              disabled={!commissionEnabled}
              className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] font-bold hover:border-emerald-600 dark:hover:border-[#2E5D3E] hover:text-emerald-600 dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Thêm mức hoa hồng
            </button>
          </div>
        )}

        {commissionStrategy === 'percentage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Phần trăm doanh thu (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(parseFloatInput(e.target.value, { min: 0, max: 100, decimals: 1 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 15 (15% doanh thu)"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Doanh thu tối thiểu (VNĐ, không bắt buộc)
              </label>
              <input
                type="number"
                value={commissionMinRevenue}
                onChange={(e) => setCommissionMinRevenue(parseIntegerInput(e.target.value, { min: 0 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 0 (không giới hạn)"
              />
            </div>
          </div>
        )}

        {commissionStrategy === 'service' && (
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Hoa hồng theo loại dịch vụ
            </label>
            {Object.entries(commissionServiceRates).map(([serviceKey, rate]) => (
              <div key={serviceKey} className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-1">
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Loại dịch vụ</label>
                  <input
                    type="text"
                    value={serviceKey}
                    onChange={(e) => {
                      const newRates = { ...commissionServiceRates };
                      delete newRates[serviceKey];
                      newRates[e.target.value] = rate;
                      setCommissionServiceRates(newRates);
                    }}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                    placeholder="massage, facial..."
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-slate-500 dark:text-[#CDBCAB] mb-2 block">Hoa hồng (VNĐ)</label>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => {
                      const newRates = { ...commissionServiceRates };
                      newRates[serviceKey] = parseIntegerInput(e.target.value, { min: 0 });
                      setCommissionServiceRates(newRates);
                    }}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={() => {
                    const newRates = { ...commissionServiceRates };
                    delete newRates[serviceKey];
                    setCommissionServiceRates(newRates);
                  }}
                  disabled={!commissionEnabled || Object.keys(commissionServiceRates).length <= 1}
                  className="h-12 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#EFE9E1] font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newKey = `service_${Object.keys(commissionServiceRates).length + 1}`;
                setCommissionServiceRates({ ...commissionServiceRates, [newKey]: 100000 });
              }}
              disabled={!commissionEnabled}
              className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3E3A35] text-slate-600 dark:text-[#CDBCAB] font-bold hover:border-emerald-600 dark:hover:border-[#2E5D3E] hover:text-emerald-600 dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Thêm dịch vụ
            </button>
          </div>
        )}

        {commissionStrategy === 'product_sales' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Phần trăm doanh số bán mỹ phẩm (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={productSalesPercentage}
                onChange={(e) => setProductSalesPercentage(parseFloatInput(e.target.value, { min: 0, max: 100, decimals: 1 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 10 (10% doanh số bán hàng)"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                Doanh số tối thiểu (VNĐ, không bắt buộc)
              </label>
              <input
                type="number"
                value={productSalesMinSales}
                onChange={(e) => setProductSalesMinSales(parseIntegerInput(e.target.value, { min: 0 }))}
                disabled={!commissionEnabled}
                className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ví dụ: 0 (không giới hạn)"
              />
            </div>
          </div>
        )}

        {commissionStrategy === 'total_revenue' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                  Phần trăm tổng doanh thu (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={totalRevenuePercentage}
                  onChange={(e) => setTotalRevenuePercentage(parseFloatInput(e.target.value, { min: 0, max: 100, decimals: 1 }))}
                  disabled={!commissionEnabled}
                  className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ví dụ: 12 (12% tổng doanh thu)"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
                  Doanh thu tối thiểu (VNĐ, không bắt buộc)
                </label>
                <input
                  type="number"
                  value={totalRevenueMinRevenue}
                  onChange={(e) => setTotalRevenueMinRevenue(parseIntegerInput(e.target.value, { min: 0 }))}
                  disabled={!commissionEnabled}
                  className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ví dụ: 0 (không giới hạn)"
                />
              </div>
            </div>

            {/* Weight configuration (optional advanced feature) */}
            <div className="bg-blue-50 dark:bg-[#11100F] border-2 border-blue-100 dark:border-[#3E3A35] rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-black">💡</span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-blue-800 dark:text-[#EFE9E1] mb-1">Tùy chỉnh trọng số (nâng cao)</h4>
                  <p className="text-xs text-blue-600 dark:text-[#CDBCAB] leading-relaxed">
                    Điều chỉnh trọng số để ưu tiên doanh thu dịch vụ hoặc bán hàng. Mặc định: cả hai đồng đều (1.0).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-blue-700 dark:text-[#CDBCAB] mb-2 block">
                    Trọng số dịch vụ
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={serviceWeight}
                    onChange={(e) => setServiceWeight(parseFloatInput(e.target.value, { min: 0, max: 10, decimals: 1 }))}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-blue-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                    placeholder="1.0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-blue-700 dark:text-[#CDBCAB] mb-2 block">
                    Trọng số bán hàng
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={productWeight}
                    onChange={(e) => setProductWeight(parseFloatInput(e.target.value, { min: 0, max: 10, decimals: 1 }))}
                    disabled={!commissionEnabled}
                    className="w-full h-12 rounded-xl border-2 border-blue-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 text-sm font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors disabled:opacity-50"
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {!commissionEnabled && (
          <div className="bg-emerald-50 dark:bg-[#2E5D3E]/20 border border-emerald-100 dark:border-[#2E5D3E] rounded-xl px-4 py-3 text-xs text-emerald-700 dark:text-[#EFE9E1] font-medium">
            ⚠️ Hoa hồng ca hiện đang <strong>tắt</strong>. Nhân sự sẽ không nhận hoa hồng khi làm ca.
          </div>
        )}
      </section>

      {/* Save Button (shown at bottom for convenience) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || !tenantId}
          className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-primary/25 dark:shadow-none active:scale-95 uppercase tracking-wider disabled:opacity-50 disabled:grayscale"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
        </button>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 dark:bg-[#11100F] border border-blue-100 dark:border-[#3E3A35] rounded-2xl px-6 py-4">
        <p className="text-xs text-blue-700 dark:text-[#CDBCAB] font-medium leading-relaxed">
          💡 <strong>Lưu ý:</strong> Các thay đổi sẽ áp dụng cho kỳ lương hiện tại và các kỳ tiếp theo. 
          Bảng lương đã chốt (finalized) sẽ không bị ảnh hưởng.
        </p>
      </div>
    </div>
  );
}
