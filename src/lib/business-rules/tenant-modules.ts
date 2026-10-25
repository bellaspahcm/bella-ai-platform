import type { Json } from '@/types/database.types';
import { productResolver } from '@/platform/registry/product-resolver';

export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa', 'student_training', 'industrial_cleaning', 'real_estate', 'bella_auto', 'bella_healthcare', 'bella_education'] as const;
export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = ['babycare', 'beauty_spa', 'industrial_cleaning', 'real_estate', 'bella_auto', 'bella_healthcare', 'bella_education'] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
export type TenantPrimaryBusinessModuleKey = (typeof TENANT_PRIMARY_BUSINESS_MODULE_KEYS)[number];

export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

export const TENANT_BRAND_STYLE_PRESETS = ['bella_rose', 'jade_wellness', 'graphite_luxe', 'ocean_clean', 'luxury_navy', 'slate_minimal'] as const;
export const TENANT_BRAND_RADIUS_STYLES = ['soft', 'balanced', 'compact'] as const;
export const TENANT_BRAND_BUTTON_STYLES = ['pill', 'rounded', 'minimal'] as const;
export const TENANT_BRAND_MENU_STYLES = ['comfortable', 'compact'] as const;

export type TenantBrandStylePreset = (typeof TENANT_BRAND_STYLE_PRESETS)[number];
export type TenantBrandRadiusStyle = (typeof TENANT_BRAND_RADIUS_STYLES)[number];
export type TenantBrandButtonStyle = (typeof TENANT_BRAND_BUTTON_STYLES)[number];
export type TenantBrandMenuStyle = (typeof TENANT_BRAND_MENU_STYLES)[number];

export const TENANT_BRAND_FONT_HEADINGS = ['sans', 'serif'] as const;
export type TenantBrandFontHeading = (typeof TENANT_BRAND_FONT_HEADINGS)[number];

export type TenantBrandTheme = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  portalDisplayName: string;
  invoiceDisplayName: string;
  stylePreset: TenantBrandStylePreset;
  radiusStyle: TenantBrandRadiusStyle;
  buttonStyle: TenantBrandButtonStyle;
  menuStyle: TenantBrandMenuStyle;
  /** Heading font: 'serif' for luxury/spa feel, 'sans' for professional/clean */
  fontHeading: TenantBrandFontHeading;
};

export type TenantBrandSurface = 'app' | 'portal' | 'invoice';

export type ResolvedTenantBrandIdentity = TenantBrandTheme & {
  moduleKey: TenantModuleKey;
  displayName: string;
  subtitle: string;
  logoUrl: string;
  primaryHoverColor: string;
  monogram: string;
  isBeautySpa: boolean;
  /** True when the healthcare tenant has hospital_inpatient capability (General Hospital, not just clinic) */
  isHospitalInpatient: boolean;
};

export const DEFAULT_ENABLED_MODULES: TenantEnabledModules = {
  babycare: true,
  beauty_spa: false,
  student_training: false,
  industrial_cleaning: false,
  real_estate: false,
  bella_auto: false,
  bella_healthcare: false,
  bella_education: false,
};

export const DEFAULT_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#A91555',
  accentColor: '#F8A5C2',
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'bella_rose',
  radiusStyle: 'soft',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
  fontHeading: 'serif', // Baby care: warm, premium serif feel
};

export const DEFAULT_BEAUTY_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#074E44',
  accentColor: '#C8A97A',
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'jade_wellness',
  radiusStyle: 'soft',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
  fontHeading: 'serif', // Beauty spa: luxurious serif feel
};

export const DEFAULT_CLEANING_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#1E40AF', // Blue 700 - professional blue
  accentColor: '#3B82F6', // Blue 500 - bright blue accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'ocean_clean',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans', // Industrial: clean, professional sans-serif
};

export const DEFAULT_REAL_ESTATE_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#0F172A', // Slate 900 - clean enterprise navy
  accentColor: '#D97706', // Amber 600 - rich gold accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'luxury_navy',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans',
};

export const DEFAULT_BELLA_AUTO_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#1E40AF', // Blue 700 - Ocean Clean primary (was #0891b2 cyan)
  accentColor: '#3B82F6', // Blue 500 - Ocean Clean accent (was #14b8a6 teal)
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'ocean_clean',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans', // Automotive: clean, professional sans-serif
};

export const DEFAULT_HEALTHCARE_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#0891b2', // Cyan 600 - clinical cyan
  accentColor: '#06b6d4', // Cyan 500
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'ocean_clean',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans', // Clinic: clean, clinical sans-serif
};

export const DEFAULT_EDUCATION_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#334155', // Slate 700 - White & Slate Gray preset primary
  accentColor: '#64748B', // Slate 500 - Slate accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'slate_minimal',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'comfortable',
  fontHeading: 'sans', // Education: modern, readable sans-serif
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const TEXT_LIMITS: Record<keyof TenantBrandTheme, number> = {
  brandName: 80,
  logoUrl: 500,
  primaryColor: 7,
  accentColor: 7,
  portalDisplayName: 100,
  invoiceDisplayName: 100,
  stylePreset: 40,
  radiusStyle: 40,
  buttonStyle: 40,
  menuStyle: 40,
  fontHeading: 10,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanColor(value: unknown, fallback: string) {
  const text = cleanText(value, 7);
  return HEX_COLOR_PATTERN.test(text) ? text.toUpperCase() : fallback;
}

function cleanChoice<T extends readonly string[]>(value: unknown, choices: T, fallback: T[number]): T[number] {
  const text = cleanText(value, 40);
  return choices.includes(text) ? text : fallback;
}

function cleanLogoUrl(value: unknown) {
  const text = cleanText(value, TEXT_LIMITS.logoUrl);
  if (!text) return '';
  if (text.startsWith('/')) return text;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? text : '';
  } catch {
    return '';
  }
}

function darkenHexColor(hex: string) {
  const normalized = cleanColor(hex, DEFAULT_TENANT_BRAND_THEME.primaryColor);
  const value = normalized.slice(1);
  const amount = 0.84;
  const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * amount));
  const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * amount));
  const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * amount));
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export type DynamicThemeTokens = {
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  sidebarBg: string;
  sidebarInnerBg: string;
  sidebarFg: string;
  sidebarMuted: string;
  sidebarBorder: string;
};

export function hexToRelativeLuminance(hex: string): number {
  const normalized = cleanColor(hex, '#074E44');
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function resolveDynamicThemeTokens(brand: Partial<TenantBrandTheme> & { primaryColor?: string; accentColor?: string; stylePreset?: string }): DynamicThemeTokens {
  const preset = brand.stylePreset;
  const primary = cleanColor(brand.primaryColor, '#074E44');
  const accent = cleanColor(brand.accentColor, '#C8A97A');

  const hasCustomPrimary = typeof brand.primaryColor === 'string' && brand.primaryColor.trim().length > 0;

  if (preset === 'jade_wellness' && (!hasCustomPrimary || primary.toUpperCase() === '#074E44')) {
    return {
      primary: '#074E44',
      primaryHover: '#03211D',
      primaryForeground: '#FFFFFF',
      accent: '#C8A97A',
      accentForeground: '#03211D',
      ring: '#074E44',
      sidebarBg: 'linear-gradient(158deg, #03211d 0%, #074e44 48%, #05362f 100%)',
      sidebarInnerBg: 'rgba(3, 33, 29, 0.65)',
      sidebarFg: '#FFFFFF',
      sidebarMuted: '#E8D4A8',
      sidebarBorder: 'rgba(200, 169, 122, 0.28)',
    };
  }

  if (preset === 'luxury_navy' && (!hasCustomPrimary || primary.toUpperCase() === '#1E3A8A')) {
    return {
      primary: '#1E3A8A',
      primaryHover: '#0B192C',
      primaryForeground: '#FFFFFF',
      accent: '#D97706',
      accentForeground: '#FFFFFF',
      ring: '#1E3A8A',
      sidebarBg: 'linear-gradient(158deg, #0b192c 0%, #1e3a8a 52%, #0f172a 100%)',
      sidebarInnerBg: 'rgba(11, 25, 44, 0.65)',
      sidebarFg: '#FFFFFF',
      sidebarMuted: '#FBBF24',
      sidebarBorder: 'rgba(217, 119, 6, 0.28)',
    };
  }

  if (preset === 'ocean_clean' && (!hasCustomPrimary || primary.toUpperCase() === '#1E40AF')) {
    return {
      primary: '#1E40AF',
      primaryHover: '#1D4ED8',
      primaryForeground: '#FFFFFF',
      accent: '#3B82F6',
      accentForeground: '#FFFFFF',
      ring: '#1E40AF',
      sidebarBg: 'linear-gradient(158deg, #1e3a8a 0%, #1e40af 42%, #1e3a8a 100%)',
      sidebarInnerBg: 'rgba(30, 58, 138, 0.65)',
      sidebarFg: '#FFFFFF',
      sidebarMuted: '#60A5FA',
      sidebarBorder: 'rgba(59, 130, 246, 0.28)',
    };
  }

  if (preset === 'graphite_luxe' && (!hasCustomPrimary || primary.toUpperCase() === '#18181B')) {
    return {
      primary: '#18181B',
      primaryHover: '#09090B',
      primaryForeground: '#FFFFFF',
      accent: '#64748B',
      accentForeground: '#FFFFFF',
      ring: '#18181B',
      sidebarBg: 'linear-gradient(158deg, #09090b 0%, #18181b 52%, #27272a 100%)',
      sidebarInnerBg: 'rgba(9, 9, 11, 0.65)',
      sidebarFg: '#FFFFFF',
      sidebarMuted: '#D4D4D8',
      sidebarBorder: 'rgba(161, 161, 170, 0.28)',
    };
  }

  if (preset === 'bella_rose' && (!hasCustomPrimary || primary.toUpperCase() === '#A91555')) {
    return {
      primary: '#A91555',
      primaryHover: '#881337',
      primaryForeground: '#FFFFFF',
      accent: '#F8A5C2',
      accentForeground: '#881337',
      ring: '#A91555',
      sidebarBg: '#FFF0F3',
      sidebarInnerBg: 'rgba(255, 255, 255, 0.75)',
      sidebarFg: '#831843',
      sidebarMuted: '#BE123C',
      sidebarBorder: 'rgba(236, 72, 153, 0.20)',
    };
  }

  if (preset === 'slate_minimal' && (!hasCustomPrimary || primary.toUpperCase() === '#334155')) {
    return {
      primary: '#334155',
      primaryHover: '#1E293B',
      primaryForeground: '#FFFFFF',
      accent: '#64748B',
      accentForeground: '#FFFFFF',
      ring: '#334155',
      sidebarBg: '#F1F5F9',
      sidebarInnerBg: 'rgba(255, 255, 255, 0.80)',
      sidebarFg: '#1E293B',
      sidebarMuted: '#64748B',
      sidebarBorder: 'rgba(51, 65, 85, 0.16)',
    };
  }

  // Truly dynamic resolution for any custom color or new tenant/vertical
  const isDark = hexToRelativeLuminance(primary) < 0.45;
  const hoverColor = darkenHexColor(primary);

  return {
    primary,
    primaryHover: hoverColor,
    primaryForeground: isDark ? '#FFFFFF' : '#0F172A',
    accent,
    accentForeground: isDark ? '#FFFFFF' : '#0F172A',
    ring: primary,
    sidebarBg: isDark
      ? `linear-gradient(158deg, ${darkenHexColor(primary)} 0%, ${primary} 50%, ${darkenHexColor(primary)} 100%)`
      : '#F8FAFC',
    sidebarInnerBg: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.80)',
    sidebarFg: isDark ? '#FFFFFF' : '#0F172A',
    sidebarMuted: accent || (isDark ? '#E2E8F0' : '#64748B'),
    sidebarBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
  };
}

export function applyThemeTokensToRoot(tokens: DynamicThemeTokens) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary', tokens.primary, 'important');
  root.style.setProperty('--primary-hover', tokens.primaryHover, 'important');
  root.style.setProperty('--primary-foreground', tokens.primaryForeground, 'important');
  root.style.setProperty('--accent', tokens.accent, 'important');
  root.style.setProperty('--accent-foreground', tokens.accentForeground, 'important');
  root.style.setProperty('--ring', tokens.ring, 'important');
  root.style.setProperty('--sidebar-bg', tokens.sidebarBg, 'important');
  root.style.setProperty('--sidebar-inner-bg', tokens.sidebarInnerBg, 'important');
  root.style.setProperty('--sidebar-fg', tokens.sidebarFg, 'important');
  root.style.setProperty('--sidebar-muted', tokens.sidebarMuted, 'important');
  root.style.setProperty('--sidebar-border', tokens.sidebarBorder, 'important');
}

function buildMonogram(displayName: string) {
  const words = displayName
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const letters = words.length > 1
    ? `${words[0][0] || ''}${words[1][0] || ''}`
    : (words[0] || 'SP').slice(0, 2);
  return letters.toUpperCase();
}

export function normalizeEnabledModules(value: unknown): TenantEnabledModules {
  if (Array.isArray(value)) {
    return {
      babycare: value.includes('babycare'),
      beauty_spa: value.includes('beauty_spa'),
      student_training: value.includes('student_training'),
      industrial_cleaning: value.includes('industrial_cleaning'),
      real_estate: value.includes('real_estate'),
      bella_auto: value.includes('bella_auto'),
      bella_healthcare: value.includes('bella_healthcare'),
      bella_education: value.includes('bella_education'),
    };
  }

  const source = isPlainRecord(value) ? value : {};
  const hasExplicitModuleConfig = TENANT_MODULE_KEYS.some((moduleKey) => typeof source[moduleKey] === 'boolean');

  if (!hasExplicitModuleConfig) {
    return DEFAULT_ENABLED_MODULES;
  }

  return {
    babycare: typeof source.babycare === 'boolean' ? source.babycare : false,
    beauty_spa: typeof source.beauty_spa === 'boolean' ? source.beauty_spa : false,
    student_training: typeof source.student_training === 'boolean' ? source.student_training : false,
    industrial_cleaning: typeof source.industrial_cleaning === 'boolean' ? source.industrial_cleaning : false,
    real_estate: typeof source.real_estate === 'boolean' ? source.real_estate : false,
    bella_auto: typeof source.bella_auto === 'boolean' ? source.bella_auto : false,
    bella_healthcare: typeof source.bella_healthcare === 'boolean' ? source.bella_healthcare : false,
    bella_education: typeof source.bella_education === 'boolean' ? source.bella_education : false,
  };
}

export function normalizeEnabledModulesForSave(value: unknown): TenantEnabledModules {
  const modules = normalizeEnabledModules(value);
  if (modules.babycare || modules.beauty_spa || modules.industrial_cleaning || modules.real_estate || modules.bella_auto || modules.bella_healthcare || modules.bella_education) return modules;
  return {
    ...modules,
    babycare: true,
  };
}

export function getDefaultTenantModuleKey(value: unknown, tenantName?: string | null): TenantPrimaryBusinessModuleKey {
  const modules = normalizeEnabledModulesForSave(value);
  if (modules.bella_healthcare) return 'bella_healthcare';
  if (modules.bella_education) return 'bella_education';
  if (modules.bella_auto) return 'bella_auto';
  if (modules.real_estate) return 'real_estate';
  if (modules.industrial_cleaning) return 'industrial_cleaning';
  if (modules.beauty_spa) return 'beauty_spa';

  if (tenantName) {
    const lower = tenantName.toLowerCase();
    if (lower.includes('clinic') || lower.includes('dental') || lower.includes('y tế') || lower.includes('nha khoa') || lower.includes('healthcare')) {
      return 'bella_healthcare';
    }
    if (lower.includes('school') || lower.includes('mầm non') || lower.includes('trường') || lower.includes('giáo dục') || lower.includes('preschool') || lower.includes('education')) {
      return 'bella_education';
    }
    if (lower.includes('auto') || lower.includes('ô tô') || lower.includes('xe')) {
      return 'bella_auto';
    }
    if (lower.includes('land') || lower.includes('bđs') || lower.includes('real estate') || lower.includes('bất động sản')) {
      return 'real_estate';
    }
    if (lower.includes('cleaning') || lower.includes('vệ sinh') || lower.includes('sạch')) {
      return 'industrial_cleaning';
    }
    if (lower.includes('beauty') || lower.includes('spa') || lower.includes('thẩm mỹ')) {
      return 'beauty_spa';
    }
  }

  return modules.babycare ? 'babycare' : 'beauty_spa';
}

export function getDefaultTenantBrandThemeForModule(moduleKey: TenantModuleKey): TenantBrandTheme {
  if (moduleKey === 'bella_healthcare') return DEFAULT_HEALTHCARE_TENANT_BRAND_THEME;
  if (moduleKey === 'bella_education') return DEFAULT_EDUCATION_TENANT_BRAND_THEME;
  if (moduleKey === 'bella_auto') return DEFAULT_BELLA_AUTO_TENANT_BRAND_THEME;
  if (moduleKey === 'beauty_spa') return DEFAULT_BEAUTY_TENANT_BRAND_THEME;
  if (moduleKey === 'industrial_cleaning') return DEFAULT_CLEANING_TENANT_BRAND_THEME;
  if (moduleKey === 'real_estate') return DEFAULT_REAL_ESTATE_TENANT_BRAND_THEME;
  return DEFAULT_TENANT_BRAND_THEME;
}

const LEGACY_DEFAULT_PINKS = ['#A91555', '#DB2777', '#F43F5E', '#BE123C', '#E11D48', '#881337', '#FF4081', '#E91E63', '#EC4899', '#C026D3', '#D946EF', '#9F1239'];

export function normalizeTenantBrandThemeForModule(
  value: unknown,
  moduleKey: TenantModuleKey,
): TenantBrandTheme {
  const source = isPlainRecord(value) ? value : {};
  const fallback = getDefaultTenantBrandThemeForModule(moduleKey);

  let rawPrimary = cleanColor(source.primaryColor, fallback.primaryColor);
  let rawAccent = cleanColor(source.accentColor, fallback.accentColor);
  let rawStylePreset = cleanChoice(source.stylePreset, TENANT_BRAND_STYLE_PRESETS, fallback.stylePreset);

  const hasExplicitPrimary = typeof source.primaryColor === 'string' && source.primaryColor.trim().length > 0;
  const hasExplicitPreset = typeof source.stylePreset === 'string' && source.stylePreset.trim().length > 0;

  // Upgrade unconfigured legacy default pink brand theme to target module signature colors ONLY if brandTheme was never explicitly set
  if (!hasExplicitPrimary && !hasExplicitPreset && moduleKey !== 'babycare' && (LEGACY_DEFAULT_PINKS.includes(rawPrimary.toUpperCase()) || rawStylePreset === 'bella_rose')) {
    rawPrimary = fallback.primaryColor;
    rawAccent = fallback.accentColor;
    rawStylePreset = fallback.stylePreset;
  }

  return {
    brandName: cleanText(source.brandName, TEXT_LIMITS.brandName),
    logoUrl: cleanLogoUrl(source.logoUrl),
    primaryColor: rawPrimary,
    accentColor: rawAccent,
    portalDisplayName: cleanText(source.portalDisplayName, TEXT_LIMITS.portalDisplayName),
    invoiceDisplayName: cleanText(source.invoiceDisplayName, TEXT_LIMITS.invoiceDisplayName),
    stylePreset: rawStylePreset,
    radiusStyle: cleanChoice(source.radiusStyle, TENANT_BRAND_RADIUS_STYLES, fallback.radiusStyle),
    buttonStyle: cleanChoice(source.buttonStyle, TENANT_BRAND_BUTTON_STYLES, fallback.buttonStyle),
    menuStyle: cleanChoice(source.menuStyle, TENANT_BRAND_MENU_STYLES, fallback.menuStyle),
    fontHeading: cleanChoice(source.fontHeading, TENANT_BRAND_FONT_HEADINGS, fallback.fontHeading),
  };
}

export function normalizeTenantBrandTheme(value: unknown): TenantBrandTheme {
  return normalizeTenantBrandThemeForModule(value, 'babycare');
}

export function isTenantModuleEnabled(
  modules: unknown,
  moduleKey: TenantModuleKey,
) {
  return normalizeEnabledModules(modules)[moduleKey];
}

export function toTenantModuleJson(value: unknown): Json {
  return normalizeEnabledModulesForSave(value) as unknown as Json;
}

export function toTenantBrandThemeJson(value: unknown): Json {
  return normalizeTenantBrandTheme(value) as unknown as Json;
}

export function toTenantBrandThemeJsonForModule(value: unknown, moduleKey: TenantModuleKey): Json {
  return normalizeTenantBrandThemeForModule(value, moduleKey) as unknown as Json;
}

export function resolveTenantBrandIdentity(input: {
  enabledModules?: unknown;
  brandTheme?: unknown;
  logoUrl?: string | null;
  tenantName?: string | null;
  surface?: TenantBrandSurface;
}): ResolvedTenantBrandIdentity {
  const moduleKey = getDefaultTenantModuleKey(input.enabledModules);
  const theme = normalizeTenantBrandThemeForModule(input.brandTheme, moduleKey);
  const tenantName = cleanText(input.tenantName, TEXT_LIMITS.brandName);
  const explicitLogoUrl = cleanLogoUrl(input.logoUrl);
  const isDental = 
    moduleKey === 'bella_healthcare' && 
    (Boolean((input.enabledModules as Record<string, unknown> | null)?.dental) ||
     Boolean((input.enabledModules as Record<string, unknown> | null)?.product === 'dental') ||
     (input.tenantName && /dental|nha khoa/i.test(input.tenantName)));

  // Brand Identity Priority: CUSTOM BRAND > PRODUCT IDENTITY > NEUTRAL
  // Product Identity will be applied by consumer from UserProvider.product
  const baseDisplayName =
    theme.brandName ||
    (input.surface === 'portal' ? theme.portalDisplayName : '') ||
    (input.surface === 'invoice' ? theme.invoiceDisplayName : '') ||
    'Hệ thống';  // Neutral fallback, NO module-based inference
    
  const portalDisplayName = theme.portalDisplayName || theme.brandName || 'Hệ thống';
  const invoiceDisplayName = theme.invoiceDisplayName || theme.brandName || 'Hệ thống';
  const displayName =
    input.surface === 'portal'
      ? portalDisplayName
      : input.surface === 'invoice'
        ? invoiceDisplayName
        : baseDisplayName;

  const modules = isPlainRecord(input.enabledModules) ? input.enabledModules : {};
  const isHospitalInpatient = moduleKey === 'bella_healthcare' && Boolean(modules.hospital_inpatient);

  return {
    ...theme,
    moduleKey,
    displayName,
    portalDisplayName,
    invoiceDisplayName,
    logoUrl: explicitLogoUrl || theme.logoUrl || (moduleKey === 'babycare' ? '/logo.png' : ''),
    subtitle: 'Management System',  // Neutral fallback, product subtitle will override
    primaryHoverColor: darkenHexColor(theme.primaryColor),
    monogram: buildMonogram(displayName),
    isBeautySpa: moduleKey === 'beauty_spa',
    isHospitalInpatient,
  };
}

/** Authenticated Product identity selects presentation; capability flags never select a Product. */
export function resolveCanonicalTenantBrand(input: Parameters<typeof resolveTenantBrandIdentity>[0] & {
  tenantId: string;
  productKey: unknown;
}): ResolvedTenantBrandIdentity | null {
  if (!input.tenantId || typeof input.productKey !== 'string') return null;
  const resolved = productResolver.tryResolve({ id: input.tenantId, product_key: input.productKey });
  if (!resolved) return null;
  // Healthcare's registered OS capability is called healthcare; its existing
  // presentation module is bella_healthcare. This changes no capability access.
  const candidates = resolved.product.requiredModules.map(key => key === 'healthcare' ? 'bella_healthcare' : key);
  const moduleKey = TENANT_PRIMARY_BUSINESS_MODULE_KEYS.find(key => candidates.includes(key));
  if (!moduleKey) return null;
  const enabledModules = Object.fromEntries(TENANT_PRIMARY_BUSINESS_MODULE_KEYS.map(key => [key, key === moduleKey]));
  const originalModules = isPlainRecord(input.enabledModules) ? input.enabledModules : {};
  const brand = resolveTenantBrandIdentity({ ...input, enabledModules: { ...originalModules, ...enabledModules } });
  const source = isPlainRecord(input.brandTheme) ? input.brandTheme : {};
  if (!cleanText(source.brandName, TEXT_LIMITS.brandName)) {
    brand.displayName = resolved.product.displayName;
    brand.subtitle = resolved.product.subtitle || 'Management System';
    brand.monogram = buildMonogram(brand.displayName);
  }
  return brand;
}

/** One root writer shared by authenticated presentation consumers. */
export function applyCanonicalTenantTheme(brand: Pick<ResolvedTenantBrandIdentity,
  'moduleKey' | 'primaryColor' | 'accentColor' | 'primaryHoverColor' | 'stylePreset' |
  'buttonStyle' | 'menuStyle' | 'radiusStyle' | 'fontHeading' | 'displayName' | 'subtitle'> | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of ['tenantBrandButton', 'tenantBrandMenu', 'tenantBrandRadius', 'tenantBrandPreset']) delete root.dataset[key];
  for (const token of ['--background', '--foreground', '--border', '--input']) root.style.removeProperty(token);
  if (!brand) {
    root.dataset.tenantModule = 'pending';
    applyThemeTokensToRoot(resolveDynamicThemeTokens({ primaryColor: '#334155', accentColor: '#64748B', stylePreset: 'slate_minimal' }));
    root.style.setProperty('--font-heading', 'var(--font-sans), system-ui, sans-serif');
    document.title = 'Bella EIP — Enterprise Platform';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#334155');
    return;
  }
  root.dataset.tenantModule = brand.moduleKey;
  root.dataset.tenantBrandButton = brand.buttonStyle;
  root.dataset.tenantBrandMenu = brand.menuStyle;
  root.dataset.tenantBrandRadius = brand.radiusStyle;
  root.dataset.tenantBrandPreset = brand.stylePreset;
  applyThemeTokensToRoot(resolveDynamicThemeTokens(brand));
  root.style.setProperty('--font-heading', brand.fontHeading === 'serif'
    ? 'var(--font-serif), Georgia, serif' : 'var(--font-sans), system-ui, sans-serif');
  document.title = `${brand.displayName} — ${brand.subtitle}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand.primaryColor);
}
