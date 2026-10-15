'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Sparkles,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { getTenantSettings, saveTenantSettings } from '@/services/tenant-actions';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import {
  DEFAULT_ENABLED_MODULES,
  DEFAULT_TENANT_BRAND_THEME,
  applyThemeTokensToRoot,
  getDefaultTenantBrandThemeForModule,
  getDefaultTenantModuleKey,
  hexToRelativeLuminance,
  normalizeEnabledModules,
  normalizeTenantBrandThemeForModule,
  resolveDynamicThemeTokens,
  resolveTenantBrandIdentity,
  type TenantBrandButtonStyle,
  type TenantBrandMenuStyle,
  type TenantBrandRadiusStyle,
  type TenantBrandStylePreset,
  type TenantBrandTheme,
  type TenantEnabledModules,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';
import { cn } from '@/lib/utils';
import { clearDashboardClientContextCache } from '@/lib/dashboard-client-context';

const RUNTIME_BRAND_CACHE_KEY = 'bella.runtime.brand.v1';
const SIDEBAR_BRAND_CACHE_KEY = 'bella.sidebar.brand.v3';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
      {children}
    </span>
  );
}

const brandPresetOptions: Array<{
  value: TenantBrandStylePreset;
  label: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  swatchBg: string;
  swatchPrimary: string;
}> = [
  {
    value: 'slate_minimal',
    label: 'White & Slate Gray',
    description: 'Trắng - Xám hiện đại, tinh tế, đồng bộ hoàn hảo với giao diện viewport.',
    primaryColor: '#334155',
    accentColor: '#64748B',
    swatchBg: '#FFFFFF',
    swatchPrimary: '#334155',
  },
  {
    value: 'ocean_clean',
    label: 'Ocean Clean',
    description: 'Xanh dương chuyên nghiệp, tin cậy, phù hợp Dịch vụ vệ sinh.',
    primaryColor: '#1E40AF',
    accentColor: '#3B82F6',
    swatchBg: '#1E40AF',
    swatchPrimary: '#3B82F6',
  },
  {
    value: 'jade_wellness',
    label: 'Jade Wellness',
    description: 'Xanh ngọc sang trọng, thanh lịch, phù hợp Beauty Spa.',
    primaryColor: '#074E44',
    accentColor: '#C8A97A',
    swatchBg: '#074E44',
    swatchPrimary: '#C8A97A',
  },
  {
    value: 'luxury_navy',
    label: 'Luxury Navy & Gold',
    description: 'Xanh navy quý phái, đẳng cấp, phù hợp Quản lý Bất động sản.',
    primaryColor: '#1E3A8A',
    accentColor: '#D97706',
    swatchBg: '#1E3A8A',
    swatchPrimary: '#D97706',
  },
  {
    value: 'graphite_luxe',
    label: 'Graphite Luxe',
    description: 'Đen xám kim loại, hiện đại, dành cho trung tâm đào tạo & văn phòng.',
    primaryColor: '#18181B',
    accentColor: '#64748B',
    swatchBg: '#18181B',
    swatchPrimary: '#64748B',
  },
  {
    value: 'bella_rose',
    label: 'Soft Rose',
    description: 'Hồng êm dịu, ấm áp, nguyên bản cho dịch vụ Mẹ & Bé.',
    primaryColor: '#A91555',
    accentColor: '#F8A5C2',
    swatchBg: '#FFF0F3',
    swatchPrimary: '#A91555',
  },
];

const radiusOptions: Array<{ value: TenantBrandRadiusStyle; label: string }> = [
  { value: 'soft', label: 'Bo mềm' },
  { value: 'balanced', label: 'Cân bằng' },
  { value: 'compact', label: 'Gọn' },
];

const buttonOptions: Array<{ value: TenantBrandButtonStyle; label: string }> = [
  { value: 'pill', label: 'Pill' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'minimal', label: 'Minimal' },
];

const menuOptions: Array<{ value: TenantBrandMenuStyle; label: string }> = [
  { value: 'comfortable', label: 'Dễ đọc' },
  { value: 'compact', label: 'Gọn' },
];

function hexToRgba(hex: string, alpha: number) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#087F6B';
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyBrandThemePreview(input: {
  tenantId: string;
  enabledModules: TenantEnabledModules;
  brandTheme: TenantBrandTheme;
  logoUrl: string;
  persist?: boolean;
}) {
  if (typeof document === 'undefined') return;

  const brand = resolveTenantBrandIdentity({
    enabledModules: input.enabledModules,
    brandTheme: { ...input.brandTheme, logoUrl: input.logoUrl },
    logoUrl: input.logoUrl,
    tenantName: input.brandTheme.brandName,
    surface: 'app',
  });

  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  root.dataset.tenantModule = brand.moduleKey;
  root.dataset.tenantBrandButton = brand.buttonStyle;
  root.dataset.tenantBrandMenu = brand.menuStyle;
  root.dataset.tenantBrandRadius = brand.radiusStyle;
  root.dataset.tenantBrandPreset = brand.stylePreset || (brand.primaryColor === '#074E44' ? 'jade_wellness' : brand.primaryColor === '#1E3A8A' ? 'luxury_navy' : brand.primaryColor === '#1E40AF' ? 'ocean_clean' : brand.primaryColor === '#18181B' ? 'graphite_luxe' : 'bella_rose');
  const tokens = resolveDynamicThemeTokens(brand);
  applyThemeTokensToRoot(tokens);
  themeMeta?.setAttribute('content', brand.primaryColor);

  if (!input.persist || !input.tenantId) return;

  const serialized = JSON.stringify({
    tenantId: input.tenantId,
    ...brand,
  });

  try {
    window.sessionStorage.setItem(RUNTIME_BRAND_CACHE_KEY, serialized);
    window.localStorage.setItem(SIDEBAR_BRAND_CACHE_KEY, serialized);
  } catch {
    // Brand cache is only a first-paint optimization.
  }

  window.dispatchEvent(new CustomEvent('brand-theme-change', { detail: brand }));
}

function getInitialTenantModuleKey(hookValue: TenantModuleKey | null): TenantModuleKey {
  if (hookValue) return hookValue;
  if (typeof document !== 'undefined') {
    const dsModule = document.documentElement.dataset.tenantModule;
    if (dsModule && dsModule !== 'pending' && dsModule !== 'null') {
      return dsModule as TenantModuleKey;
    }
    try {
      const cached = window.sessionStorage.getItem(RUNTIME_BRAND_CACHE_KEY) || window.localStorage.getItem(SIDEBAR_BRAND_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.moduleKey) return parsed.moduleKey as TenantModuleKey;
      }
    } catch {}
  }
  return 'real_estate';
}

export default function AppearanceTab() {
  const { tenantModuleKey: hookTenantModuleKey } = useTenantModuleKey();
  const activeModuleKey = getInitialTenantModuleKey(hookTenantModuleKey);
  const initialBrandTheme = getDefaultTenantBrandThemeForModule(activeModuleKey);

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandTheme, setBrandTheme] = useState<TenantBrandTheme>(initialBrandTheme);
  const [logoUrl, setLogoUrl] = useState('');
  const [enabledModules, setEnabledModules] = useState<TenantEnabledModules>(() => ({
    ...DEFAULT_ENABLED_MODULES,
    babycare: activeModuleKey === 'babycare',
    beauty_spa: activeModuleKey === 'beauty_spa',
    student_training: activeModuleKey === 'student_training',
    industrial_cleaning: activeModuleKey === 'industrial_cleaning',
    real_estate: activeModuleKey === 'real_estate',
    bella_auto: activeModuleKey === 'bella_auto',
    bella_healthcare: activeModuleKey === 'bella_healthcare',
    bella_education: activeModuleKey === 'bella_education',
  }));
  const [tenantId, setTenantId] = useState('');
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey>(activeModuleKey);
  const [isLoadingTenantConfig, setIsLoadingTenantConfig] = useState(true);
  const [isSavingTenantConfig, setIsSavingTenantConfig] = useState(false);

  useEffect(() => {
    if (hookTenantModuleKey && isLoadingTenantConfig) {
      setTenantModuleKey(hookTenantModuleKey);
      setBrandTheme(getDefaultTenantBrandThemeForModule(hookTenantModuleKey));
    }
  }, [hookTenantModuleKey, isLoadingTenantConfig]);

  useEffect(() => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme);
  }, []);

  const loadTenantDisplayConfig = useCallback(async () => {
    setIsLoadingTenantConfig(true);
    try {
      const tenant = await getTenantSettings();
      if (!tenant) return;

      const nextModuleKey = getDefaultTenantModuleKey(tenant.enabled_modules, tenant.name);
      const normalizedBrandTheme = normalizeTenantBrandThemeForModule(tenant.brand_theme, nextModuleKey);
      setTenantId(tenant.id);
      setBrandTheme(normalizedBrandTheme);
      setLogoUrl(tenant.logo_url || normalizedBrandTheme.logoUrl || '');
      setEnabledModules(normalizeEnabledModules(tenant.enabled_modules));
      setTenantModuleKey(nextModuleKey);
    } catch (error) {
      console.warn('Tenant display config load fallback:', error);
    } finally {
      setIsLoadingTenantConfig(false);
    }
  }, []);

  useEffect(() => {
    loadTenantDisplayConfig();
  }, [loadTenantDisplayConfig]);

  useEffect(() => {
    if (isLoadingTenantConfig || !tenantId) return;
    applyBrandThemePreview({
      tenantId,
      enabledModules,
      brandTheme,
      logoUrl,
      persist: true, // ✅ Persist to storage so hard refresh keeps theme
    });
  }, [brandTheme, enabledModules, isLoadingTenantConfig, logoUrl, tenantId]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme === newTheme) return;

    setTheme(newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      toast.success('Đã kích hoạt chế độ tối Deep Velvet');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Đã kích hoạt giao diện Soft Luxury');
    }

    window.dispatchEvent(new Event('theme-change'));
  };

  const updateBrandTheme = (patch: Partial<TenantBrandTheme>) => {
    const updated = { ...brandTheme, ...patch };
    setBrandTheme(updated);
    
    // Auto-save changes immediately for better UX
    saveTenantSettings({
      brand_theme: normalizeTenantBrandThemeForModule(updated, tenantModuleKey),
    }).then((result) => {
      if (result.success) {
        clearDashboardClientContextCache();
        applyBrandThemePreview({
          tenantId,
          enabledModules,
          brandTheme: updated,
          logoUrl,
          persist: true,
        });
        toast.success('Đã cập nhật giao diện');
      } else {
        toast.error(result.error);
        // Revert on error
        setBrandTheme(brandTheme);
      }
    }).catch((error) => {
      console.error('Auto-save brand theme failed', error);
      toast.error('Không thể lưu tự động');
      setBrandTheme(brandTheme);
    });
  };

  const applyBrandPreset = (preset: (typeof brandPresetOptions)[number]) => {
    updateBrandTheme({
      stylePreset: preset.value,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
    });
  };

  async function handleSaveTenantConfig() {
    setIsSavingTenantConfig(true);
    try {
      const nextBrandTheme = normalizeTenantBrandThemeForModule({
        ...brandTheme,
        logoUrl,
      }, tenantModuleKey);

      const result = await saveTenantSettings({
        logo_url: logoUrl,
        brand_theme: nextBrandTheme,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      clearDashboardClientContextCache();
      setBrandTheme(nextBrandTheme);
      setLogoUrl(nextBrandTheme.logoUrl);
      applyBrandThemePreview({
        tenantId,
        enabledModules,
        brandTheme: nextBrandTheme,
        logoUrl: nextBrandTheme.logoUrl,
        persist: true,
      });
      toast.success('Đã lưu nhận diện thương hiệu');
    } catch (error) {
      console.error('Tenant display config save failed', error);
      toast.error('Không thể lưu cấu hình giao diện chi nhánh');
    } finally {
      setIsSavingTenantConfig(false);
    }
  }

  const activeLightModeStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${brandTheme.primaryColor} 0%, ${brandTheme.accentColor} 100%)`,
    boxShadow: `0 24px 52px ${hexToRgba(brandTheme.primaryColor, 0.22)}`,
  };

  return (
    <div className="space-y-8" data-settings-ui="appearance">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Giao diện & Module</h2>
            <p className="text-sm font-semibold text-muted-foreground">
              Cấu hình phong cách hiển thị, nhận diện thương hiệu và module theo từng doanh nghiệp & chi nhánh.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadTenantDisplayConfig}
          disabled={isLoadingTenantConfig || isSavingTenantConfig}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoadingTenantConfig && 'animate-spin')} />
          Làm mới
        </button>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Chế độ màu hệ thống</h3>
          <p className="text-sm font-semibold text-muted-foreground">
            Tùy chỉnh trải nghiệm sáng/tối cho người đang sử dụng thiết bị này.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            style={theme === 'light' ? activeLightModeStyle : undefined}
            className={cn(
              'relative overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-300',
              theme === 'light'
                ? 'text-white shadow-xl scale-[1.01]'
                : 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
            )}
          >
            <Sun className={cn('absolute right-4 top-4 h-6 w-6', theme === 'light' ? 'text-white/35' : 'text-slate-400')} />
            <h4 className="mb-2 text-xl font-bold">Soft Luxury</h4>
            <p className={cn('text-sm font-medium', theme === 'light' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              Tông màu nhận diện thương hiệu và bề mặt mềm, phù hợp màn hình vận hành ban ngày.
            </p>
            <div className="mt-6">
              {theme === 'light' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đang áp dụng
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-[10px] font-black uppercase dark:bg-slate-800">
                  Kích hoạt
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={cn(
              'relative overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-300',
              theme === 'dark'
                ? 'border border-purple-500/20 bg-gradient-to-br from-purple-950 to-slate-950 text-white shadow-xl shadow-purple-950/50 scale-[1.01]'
                : 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
            )}
          >
            <Moon className={cn('absolute right-4 top-4 h-6 w-6', theme === 'dark' ? 'text-white/35' : 'text-slate-400')} />
            <h4 className="mb-2 text-xl font-bold">Modern Dark</h4>
            <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              Chế độ tối Deep Velvet cho các ca làm việc buổi tối hoặc màn hình lớn.
            </p>
            <div className="mt-6">
              {theme === 'dark' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đang áp dụng
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-[10px] font-black uppercase dark:bg-slate-800">
                  Kích hoạt
                </span>
              )}
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-6 border-t border-slate-200/80 dark:border-slate-800 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Nhận diện thương hiệu riêng</h3>
              <p className="text-sm font-semibold text-muted-foreground">
                Dùng cho mô hình white-label khi bán gói dịch vụ cho doanh nghiệp khác.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveTenantConfig}
            disabled={isLoadingTenantConfig || isSavingTenantConfig}
            style={{
              backgroundColor: brandTheme.primaryColor || 'var(--primary)',
              color: hexToRelativeLuminance(brandTheme.primaryColor || '#074E44') < 0.45 ? '#FFFFFF' : '#0F172A',
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-wider shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSavingTenantConfig ? <Loader2 className="h-4 w-4 animate-spin text-current" /> : <Save className="h-4 w-4 text-current" />}
            <span className="text-current font-black">Lưu cấu hình</span>
          </button>
        </div>

        {isLoadingTenantConfig ? (
          <div className="flex items-center justify-center rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <FieldLabel>Tên thương hiệu</FieldLabel>
                <input
                  value={brandTheme.brandName}
                  onChange={(event) => updateBrandTheme({ brandName: event.target.value })}
                  placeholder={
                    tenantModuleKey === 'real_estate' 
                      ? 'VD: Bella Land Premium' 
                      : tenantModuleKey === 'industrial_cleaning' 
                      ? 'VD: Bella Clean Premium' 
                      : 'VD: Bella Enterprise'
                  }
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Logo URL</FieldLabel>
                <input
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Màu chính</FieldLabel>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <input
                    type="color"
                    value={brandTheme.primaryColor}
                    onChange={(event) => updateBrandTheme({ primaryColor: event.target.value })}
                    className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    aria-label="Màu chính"
                  />
                  <input
                    value={brandTheme.primaryColor}
                    onChange={(event) => updateBrandTheme({ primaryColor: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 outline-none"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <FieldLabel>Màu nhấn</FieldLabel>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <input
                    type="color"
                    value={brandTheme.accentColor}
                    onChange={(event) => updateBrandTheme({ accentColor: event.target.value })}
                    className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    aria-label="Màu nhấn"
                  />
                  <input
                    value={brandTheme.accentColor}
                    onChange={(event) => updateBrandTheme({ accentColor: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 outline-none"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <FieldLabel>Tên hiển thị trên portal</FieldLabel>
                <input
                  value={brandTheme.portalDisplayName}
                  onChange={(event) => updateBrandTheme({ portalDisplayName: event.target.value })}
                  placeholder="Tên khách nhìn thấy khi vào portal"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Tên trên báo giá / hóa đơn</FieldLabel>
                <input
                  value={brandTheme.invoiceDisplayName}
                  onChange={(event) => updateBrandTheme({ invoiceDisplayName: event.target.value })}
                  placeholder="Tên dùng cho báo giá và chứng từ"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>

              <div className="space-y-3 md:col-span-2">
                <FieldLabel>Mẫu nhận diện</FieldLabel>
                <div className="grid gap-3 lg:grid-cols-3">
                  {brandPresetOptions.map((preset) => {
                    const isActive = brandTheme.stylePreset === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => applyBrandPreset(preset)}
                        className={cn(
                          'rounded-2xl p-4 text-left transition-all duration-200',
                          isActive
                            ? 'bella-settings-preset-active border-2 border-primary bg-primary/[0.05] dark:bg-primary/20 shadow-md ring-2 ring-primary/20'
                            : 'border border-slate-200/80 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800',
                        )}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* Base / Background Swatch */}
                            <span
                              className="h-7 w-7 shrink-0 rounded-xl shadow-sm border border-slate-300 dark:border-slate-600"
                              style={{ backgroundColor: preset.swatchBg }}
                              title="Màu nền giao diện"
                            />
                            {/* Primary / Accent Swatch */}
                            <span
                              className="h-7 w-7 shrink-0 rounded-xl shadow-sm border border-slate-300 dark:border-slate-600"
                              style={{ backgroundColor: preset.swatchPrimary }}
                              title="Màu chính & điểm nhấn"
                            />
                          </div>
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 dark:bg-primary/30 px-2.5 py-1 text-[11px] font-black text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              Đang dùng
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{preset.label}</p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">{preset.description}</p>
                      </button>
                    );
                  })}


                </div>
              </div>

              <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldLabel>Bo góc</FieldLabel>
                  <div className="flex rounded-2xl border border-slate-100 bg-slate-50 p-1">
                    {radiusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateBrandTheme({ radiusStyle: option.value })}
                        className={cn(
                          'min-h-10 flex-1 rounded-xl px-3 text-xs font-black transition',
                          brandTheme.radiusStyle === option.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Kiểu nút</FieldLabel>
                  <div className="flex rounded-2xl border border-slate-100 bg-slate-50 p-1">
                    {buttonOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateBrandTheme({ buttonStyle: option.value })}
                        className={cn(
                          'min-h-10 flex-1 rounded-xl px-3 text-xs font-black transition',
                          brandTheme.buttonStyle === option.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Menu</FieldLabel>
                  <div className="flex rounded-2xl border border-slate-100 bg-slate-50 p-1">
                    {menuOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateBrandTheme({ menuStyle: option.value })}
                        className={cn(
                          'min-h-10 flex-1 rounded-xl px-3 text-xs font-black transition',
                          brandTheme.menuStyle === option.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification bar at bottom instead of large sidebar box */}
            {tenantModuleKey !== 'industrial_cleaning' && (
              <div className="mt-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">Module ngành đang cấp cho Doanh nghiệp: </span>
                    <span className="inline-flex flex-wrap items-center gap-2 ml-1 mt-1 lg:mt-0">
                      {enabledModules.real_estate && (
                        <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-black text-white shadow-sm">
                          ✓ Bella Land (Đang bật)
                        </span>
                      )}
                      {enabledModules.industrial_cleaning && (
                        <span className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-black text-white shadow-sm">
                          ✓ Industrial Cleaning (Đang bật)
                        </span>
                      )}
                      {enabledModules.babycare && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 border border-emerald-200/60">
                          ✓ Bella Care / Healthcare (Đang bật)
                        </span>
                      )}
                      {enabledModules.beauty_spa && (
                        <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-black text-primary-foreground shadow-sm">
                          ✓ Beauty Spa (Đang bật)
                        </span>
                      )}
                      {!enabledModules.real_estate && !enabledModules.industrial_cleaning && !enabledModules.babycare && !enabledModules.beauty_spa && (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-black text-slate-600">
                          Mặc định hệ thống
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold lg:text-right max-w-lg leading-relaxed">
                  💡 Module ngành được cấu hình khi setup tenant. Quản trị viên chỉ quản lý vận hành trong ngành đã được cấp và không thể tự chuyển đổi mô hình.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
