import { bellaAutoManifest } from '@/modules/bella-auto/manifest';
import type { ProductDefinition } from '@/platform/registry/product-registry';
import {
  resolveTenantBrandIdentity,
  normalizeTenantBrandTheme,
  applyThemeTokensToRoot,
  resolveDynamicThemeTokens,
  TENANT_BRAND_STYLE_PRESETS,
  TENANT_BRAND_FONT_HEADINGS,
  type ResolvedTenantBrandIdentity,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';

export const HAIRCUT_PRODUCT_KEY = 'bella_haircut';

type ProductPresentationIdentity = Pick<ProductDefinition, 'productKey'> | null | undefined;

export function isHaircutProductPresentation(product: ProductPresentationIdentity): boolean {
  return product?.productKey === HAIRCUT_PRODUCT_KEY;
}

export type ProductBrandPresentation = Omit<ResolvedTenantBrandIdentity, 'moduleKey'> & {
  moduleKey: ResolvedTenantBrandIdentity['moduleKey'] | 'pending';
};

function isEnabled(modules: unknown, key: string): boolean {
  return Array.isArray(modules) ? modules.includes(key)
    : modules !== null && typeof modules === 'object' && Reflect.get(modules, key) === true;
}

/** Product presentation is selected by its registered profile, never entitlement priority. */
export function resolveProductPresentationModule(product: ProductDefinition, modules: unknown): TenantModuleKey | null {
  let expected: TenantModuleKey;
  switch (product.navigationProfile) {
    case 'haircut': case 'spa': case 'nail': expected = 'beauty_spa'; break;
    case 'babycare': expected = 'babycare'; break;
    case 'education': case 'english-center': expected = 'bella_education'; break;
    case 'hospital': expected = 'bella_healthcare'; break;
    default: return null;
  }
  return isEnabled(modules, expected) || (expected === 'bella_healthcare' && isEnabled(modules, 'healthcare')) ? expected : null;
}

/** Adapt live tenant branding only after canonical product resolution. */
export function resolveProductBrandPresentation(tenant: {
  enabled_modules: unknown;
  brand_theme: unknown;
  logo_url?: string | null;
  name?: string | null;
}, product: ProductDefinition): ProductBrandPresentation {
  const moduleKey = resolveProductPresentationModule(product, tenant.enabled_modules);
  const customTheme = tenant.brand_theme !== null && typeof tenant.brand_theme === 'object' && !Array.isArray(tenant.brand_theme)
    ? tenant.brand_theme
    : {};
  const customPreset = 'stylePreset' in customTheme && typeof customTheme.stylePreset === 'string' ? customTheme.stylePreset.trim() : '';
  const customHeading = 'fontHeading' in customTheme && typeof customTheme.fontHeading === 'string' ? customTheme.fontHeading.trim() : '';
  const neutralTheme = {
    ...customTheme,
    primaryColor: 'primaryColor' in customTheme && typeof customTheme.primaryColor === 'string' && /^#[0-9a-f]{6}$/i.test(customTheme.primaryColor.trim()) ? customTheme.primaryColor.trim() : '#334155',
    accentColor: 'accentColor' in customTheme && typeof customTheme.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(customTheme.accentColor.trim()) ? customTheme.accentColor.trim() : '#94A3B8',
    stylePreset: TENANT_BRAND_STYLE_PRESETS.some(preset => preset === customPreset) ? customPreset : 'slate_minimal',
    fontHeading: TENANT_BRAND_FONT_HEADINGS.some(font => font === customHeading) ? customHeading : 'sans',
  };
  const brand = resolveTenantBrandIdentity({
    enabledModules: moduleKey ? { [moduleKey]: true, hospital_inpatient: isEnabled(tenant.enabled_modules, 'hospital_inpatient') } : {},
    brandTheme: moduleKey ? customTheme : neutralTheme,
    logoUrl: tenant.logo_url,
    tenantName: tenant.name,
    surface: 'app',
  });
  if (!brand.brandName) brand.displayName = product.displayName;
  brand.subtitle = product.subtitle || brand.subtitle;

  if (!moduleKey) {
    return {
      ...brand,
      moduleKey: 'pending',
      logoUrl: normalizeTenantBrandTheme({ logoUrl: tenant.logo_url }).logoUrl || normalizeTenantBrandTheme(customTheme).logoUrl,
      isBeautySpa: false,
      isHospitalInpatient: false,
    };
  }
  return brand;
}

type RuntimeBrand = Pick<ProductBrandPresentation, 'moduleKey' | 'buttonStyle' | 'menuStyle' | 'radiusStyle' | 'stylePreset' | 'primaryColor' | 'accentColor' | 'primaryHoverColor' | 'fontHeading' | 'displayName' | 'subtitle'>;

export function resetDashboardPresentation() {
  const root = document.documentElement;
  root.dataset.tenantModule = 'pending';
  for (const key of ['tenantBrandPreset', 'tenantBrandButton', 'tenantBrandMenu', 'tenantBrandRadius']) delete root.dataset[key];
  applyThemeTokensToRoot(resolveDynamicThemeTokens({ primaryColor: '#334155', accentColor: '#94A3B8', stylePreset: 'slate_minimal' }));
  for (const token of ['--background', '--foreground', '--border', '--input', '--font-heading']) root.style.removeProperty(token);
  document.title = 'Bella EIP — Enterprise Platform';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.classList.contains('dark') ? '#020617' : '#f8fafc');
}

export function applyDashboardProductBrand(brand: RuntimeBrand) {
  const root = document.documentElement;
  root.dataset.tenantModule = brand.moduleKey;
  root.dataset.tenantBrandButton = brand.buttonStyle;
  root.dataset.tenantBrandMenu = brand.menuStyle;
  root.dataset.tenantBrandRadius = brand.radiusStyle;
  root.dataset.tenantBrandPreset = brand.stylePreset;
  for (const token of ['--background', '--foreground', '--border', '--input']) root.style.removeProperty(token);
  applyThemeTokensToRoot({ ...resolveDynamicThemeTokens(brand), accent: brand.accentColor });
  root.style.setProperty('--font-heading', brand.fontHeading === 'serif' ? 'var(--font-serif), Georgia, serif' : 'var(--font-sans), system-ui, sans-serif');
  document.title = `${brand.displayName} — ${brand.subtitle}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand.primaryColor);
}

/** Existing Spa/Nail operational dashboards are valid root presentations. */
export function getDashboardProductDestination(product: ProductDefinition, pathname: string): string | null {
  if (product.productKey === 'bella_spa' || product.productKey === 'bella_nail') return null;
  const currentPath = pathname.replace(/\/+$/, '') || '/';
  const defaultPath = product.defaultRoute.replace(/\/+$/, '') || '/';
  const result = currentPath === defaultPath ? null : product.defaultRoute;
  console.log('[getDashboardProductDestination]', { productKey: product.productKey, pathname, currentPath, defaultPath, defaultRoute: product.defaultRoute, result });
  return result;
}


type DashboardPresentationTenant = {
  id: string;
  product_key?: string | null;
  enabled_modules: unknown;
  brand_theme?: unknown;
  logo_url?: string | null;
  name?: string | null;
};

/** Presentation compatibility for the existing module-backed AutoMove vertical.
 * This never resolves or synthesizes ProductIdentity. Callers must verify auth/tenant.
 */
export function resolveDashboardPresentation(
  tenant: DashboardPresentationTenant,
  product: ProductDefinition | null | undefined,
  pathname: string = '/dashboard',
) {
  if (product) {
    return {
      identityKey: `${tenant.id}:product:${product.productKey}`,
      brand: resolveProductBrandPresentation({ ...tenant, brand_theme: tenant.brand_theme }, product),
      defaultRoute: getDashboardProductDestination(product, pathname),
    };
  }
  // An explicit unknown identity must not inherit a module's presentation.
  if (tenant.product_key != null || !isEnabled(tenant.enabled_modules, bellaAutoManifest.key)) return null;
  const brand = resolveTenantBrandIdentity({
    enabledModules: { [bellaAutoManifest.themeKey]: true },
    brandTheme: tenant.brand_theme,
    logoUrl: tenant.logo_url,
    tenantName: tenant.name,
    surface: 'app',
  });
  if (!brand.brandName) brand.displayName = bellaAutoManifest.name;
  return {
    identityKey: `${tenant.id}:vertical:${bellaAutoManifest.key}`,
    brand,
    defaultRoute: bellaAutoManifest.defaultRoute,
  };
}

/** Product entry switches replace the document rather than a pending SPA route. */
export function replaceDashboardProductDocument(destination: string): void {
  window.location.replace(destination);
}
