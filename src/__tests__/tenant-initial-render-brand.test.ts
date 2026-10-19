/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import { productRegistry } from '@/platform/registry/product-registry';
import { getDashboardProductDestination, resolveDashboardPresentation, resolveProductBrandPresentation } from '@/lib/business-rules/product-presentation-routing';

// Contract: approved tenant-initial-render spec and Constitution §§8–9.
// Storage is not identity; custom tenant branding wins; unknown stays neutral.
describe('first paint before authenticated tenant identity', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard');
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-tenant-module');
    document.documentElement.removeAttribute('data-tenant-brand-preset');
    document.documentElement.className = '';
    document.title = 'Bella EIP';
  });

  it('executes bootstrap with stale Spa caches without applying their product, color or title', () => {
    const stale = JSON.stringify({ tenantId: 'previous-tenant', moduleKey: 'beauty_spa', primaryColor: '#074E44', stylePreset: 'jade_wellness', displayName: 'Previous Spa' });
    window.sessionStorage.setItem('bella.runtime.brand.v1', stale);
    window.localStorage.setItem('bella.sidebar.brand.v2', stale);
    window.localStorage.setItem('bella.sidebar.brand.v3', stale);
    const source = fs.readFileSync(path.join(process.cwd(), 'public/theme-bootstrap.js'), 'utf8');
    new Function('window', 'document', source)(window, document);
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
    expect(document.documentElement.dataset.tenantBrandPreset).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#334155');
    expect(document.title).toBe('Bella EIP');
  });

  it.each([['', 'rgb(248, 250, 252)'], ['dark', 'rgb(2, 6, 23)']])('paints a neutral %s body with the actual pending CSS', (className, background) => {
    const stylesheet = postcss.parse(fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8'));
    const pendingRules: string[] = [];
    stylesheet.walkRules(rule => {
      if (rule.selector.includes('[data-tenant-module="pending"]')) {
        expect(rule.selectors.every(selector => selector.includes('[data-tenant-module="pending"]'))).toBe(true);
        expect(rule.toString()).not.toMatch(/beauty-|#074e44|#c8a97a|#091A2D/i);
        pendingRules.push(rule.toString());
      }
    });
    const style = document.createElement('style');
    style.textContent = pendingRules.join('\n');
    document.head.append(style);
    document.documentElement.className = className;
    document.documentElement.dataset.tenantModule = 'pending';
    expect(getComputedStyle(document.body).backgroundColor).toBe(background);
    expect(getComputedStyle(document.body).backgroundImage).toBe('');
    style.remove();
  });
});

describe('resolved product presentation', () => {
  it.each([
    ['bella_preschool', '/dashboard/education'],
    ['bella_english_center', '/dashboard/english-center'],
    ['bella_hospital', '/dashboard/hospital'],
    ['bella_hospitality', '/dashboard/hospitality'],
    ['bella_manufacturing', '/dashboard/manufacturing'],
  ])('uses the canonical %s destination and does not redirect again at its target', (productKey, route) => {
    const product = productRegistry.getRequired(productKey);
    expect(getDashboardProductDestination(product, '/dashboard')).toBe(route);
    expect(getDashboardProductDestination(product, `${route}/`)).toBeNull();
  });

  it.each(['bella_haircut', 'bella_babycare', 'bella_spa', 'bella_nail'])('preserves the existing operational %s root', productKey => {
    expect(getDashboardProductDestination(productRegistry.getRequired(productKey), '/dashboard')).toBeNull();
  });

  it('keeps a Preschool custom brand, colors and explicit logo intact', () => {
    const brand = resolveProductBrandPresentation({
      enabled_modules: { bella_education: true }, name: 'Preschool Tenant', logo_url: null,
      brand_theme: { brandName: 'Mầm Non Sao Mai', primaryColor: '#6D28D9', accentColor: '#F59E0B', logoUrl: '/assets/logo.png', fontHeading: 'sans' },
    }, productRegistry.getRequired('bella_preschool'));
    expect(brand).toMatchObject({ moduleKey: 'bella_education', displayName: 'Mầm Non Sao Mai', primaryColor: '#6D28D9', accentColor: '#F59E0B', logoUrl: '/assets/logo.png', fontHeading: 'sans' });
  });

  it.each(['bella_hospitality', 'bella_manufacturing'])('keeps module-free %s neutral without borrowing Cleaning or Spa', productKey => {
    const brand = resolveProductBrandPresentation({ enabled_modules: {}, brand_theme: {}, name: 'Current Tenant' }, productRegistry.getRequired(productKey));
    expect(brand).toMatchObject({ moduleKey: 'pending', primaryColor: '#334155', stylePreset: 'slate_minimal', fontHeading: 'sans', logoUrl: '', isBeautySpa: false });
    expect(brand.displayName).toBe(productKey === 'bella_hospitality' ? 'Bella Hospitality' : 'Bella Manufacturing');
  });

  it.each(['bella_hospitality', 'bella_manufacturing'])('preserves a module-free %s custom brand and logo', productKey => {
    const brand = resolveProductBrandPresentation({ enabled_modules: {}, brand_theme: { brandName: 'Custom Brand', primaryColor: '#6D28D9', logoUrl: '/assets/logo.png', fontHeading: 'serif' } }, productRegistry.getRequired(productKey));
    expect(brand).toMatchObject({ moduleKey: 'pending', displayName: 'Custom Brand', primaryColor: '#6D28D9', logoUrl: '/assets/logo.png', fontHeading: 'serif' });
  });

  it.each([undefined, null, '', '   ', 'invalid'])('keeps invalid neutral brand fields %p from restoring Babycare defaults', value => {
    const brand = resolveProductBrandPresentation({ enabled_modules: {}, brand_theme: { primaryColor: value, accentColor: value, stylePreset: value, fontHeading: value } }, productRegistry.getRequired('bella_hospitality'));
    expect(brand).toMatchObject({ moduleKey: 'pending', primaryColor: '#334155', accentColor: '#94A3B8', stylePreset: 'slate_minimal', fontHeading: 'sans' });
  });

  it('preserves whitespace-padded valid custom choices using canonical trimming', () => {
    const brand = resolveProductBrandPresentation({ enabled_modules: {}, brand_theme: { primaryColor: ' #6D28D9 ', accentColor: ' #F59E0B ', stylePreset: 'ocean_clean ', fontHeading: 'serif ' } }, productRegistry.getRequired('bella_hospitality'));
    expect(brand).toMatchObject({ moduleKey: 'pending', primaryColor: '#6D28D9', accentColor: '#F59E0B', stylePreset: 'ocean_clean', fontHeading: 'serif' });
  });

  it.each([
    [undefined, undefined, ''], ['', '', ''], ['  ', '  ', ''], ['javascript:alert(1)', 'javascript:alert(1)', ''],
    [undefined, '/assets/logo.png', '/assets/logo.png'], [undefined, '/logo.png', '/logo.png'],
    [' /assets/tenant.png ', '/assets/theme.png', '/assets/tenant.png'],
    ['javascript:alert(1)', '/assets/theme.png', '/assets/theme.png'],
  ])('normalizes explicit module-free logos (%p, %p)', (logo_url, logoUrl, expected) => {
    const brand = resolveProductBrandPresentation({ enabled_modules: {}, logo_url, brand_theme: { logoUrl } }, productRegistry.getRequired('bella_hospitality'));
    expect(brand.logoUrl).toBe(expected);
  });

  it.each([
    ['bella_babycare', { babycare: true, beauty_spa: true }, 'babycare'],
    ['bella_preschool', { beauty_spa: true }, 'pending'],
    ['bella_hospitality', { beauty_spa: true }, 'pending'],
    ['bella_manufacturing', { beauty_spa: true }, 'pending'],
    ['bella_hospital', { healthcare: true, hospital_inpatient: true }, 'bella_healthcare'],
  ])('does not inherit unrelated entitled presentation for %s', (productKey, enabled_modules, moduleKey) => {
    const brand = resolveProductBrandPresentation({ enabled_modules, brand_theme: {} }, productRegistry.getRequired(productKey));
    expect(brand.moduleKey).toBe(moduleKey);
    expect(brand.isHospitalInpatient).toBe(productKey === 'bella_hospital');
  });

  it('does not force the unresolved pending body palette on a ready custom preset', () => {
    const stylesheet = postcss.parse(fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8'));
    const rules: string[] = [];
    stylesheet.walkRules(rule => { if (rule.selector.includes('[data-tenant-module="pending"]')) rules.push(rule.toString()); });
    const style = document.createElement('style');
    style.textContent = rules.join('\n');
    document.head.append(style);
    document.documentElement.dataset.tenantModule = 'pending';
    document.documentElement.dataset.tenantBrandPreset = 'graphite_luxe';
    document.body.style.background = '#6D28D9';
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(109, 40, 217)');
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('data-tenant-brand-preset');
    style.remove();
  });
});


describe('existing AutoMove vertical presentation compatibility', () => {
  const tenant = { id: 'auto', enabled_modules: { bella_auto: true }, brand_theme: {} };
  it.each([undefined, null])('uses its existing manifest without creating a Product for key %p', product_key => {
    const presentation = resolveDashboardPresentation({ ...tenant, product_key }, null);
    expect(presentation).toMatchObject({ identityKey: 'auto:vertical:bella_auto', defaultRoute: '/dashboard/bella-auto', brand: { moduleKey: 'bella_auto', displayName: 'Bella Automotive Platform', primaryColor: '#1E40AF' } });
  });
  it('preserves custom AutoMove branding and ignores other enabled module priority', () => {
    const presentation = resolveDashboardPresentation({ ...tenant, enabled_modules: ['babycare', 'bella_auto', 'beauty_spa'], brand_theme: { brandName: 'My Auto', primaryColor: '#6D28D9', logoUrl: '/assets/auto.png' } }, null);
    expect(presentation?.brand).toMatchObject({ moduleKey: 'bella_auto', displayName: 'My Auto', primaryColor: '#6D28D9', logoUrl: '/assets/auto.png' });
  });
  it.each(['unknown-product', '', ' '])('rejects explicit unresolved identity %p despite AutoMove entitlement', product_key => {
    expect(resolveDashboardPresentation({ ...tenant, product_key }, null)).toBeNull();
  });
  it.each([{}, { bella_auto: false }, { bella_auto: 'true' }, { beauty_spa: true }])('rejects absent or non-boolean AutoMove capability %p', enabled_modules => {
    expect(resolveDashboardPresentation({ ...tenant, enabled_modules }, null)).toBeNull();
  });
  it('keeps a registered product ahead of an additional AutoMove capability', () => {
    const product = productRegistry.getRequired('bella_preschool');
    expect(resolveDashboardPresentation({ ...tenant, product_key: product.productKey, enabled_modules: { bella_auto: true, bella_education: true } }, product)).toMatchObject({ identityKey: 'auto:product:bella_preschool', defaultRoute: '/dashboard/education', brand: { moduleKey: 'bella_education' } });
  });
});
