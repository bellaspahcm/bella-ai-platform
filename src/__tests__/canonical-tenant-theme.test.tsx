/** @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import vm from 'vm';
import { resolveCanonicalTenantBrand, applyCanonicalTenantTheme } from '@/lib/business-rules/tenant-modules';
import { TenantContextProvider } from '@/core/providers/TenantContextProvider';

const input = { tenantId: 'tenant-a', productKey: 'bella_preschool', enabledModules: { babycare: true, beauty_spa: true },
  tenantName: 'A misleading Spa name' };
const config = (productKey: string | null = 'bella_preschool') => ({ tenantId: 'tenant-a', tenantName: 'Trusted School',
  enabledModules: ['babycare'], subscriptionPlan: 'basic', featureFlags: {}, settings: { productKey } });
const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  document.documentElement.removeAttribute('style');
  document.documentElement.dataset.tenantModule = 'beauty_spa';
});
afterEach(() => { cleanup(); global.fetch = originalFetch; });

it('uses canonical Preschool identity despite conflicting names, routes or module flags', () => {
  const brand = resolveCanonicalTenantBrand(input);
  expect(brand).toMatchObject({ moduleKey: 'bella_education', displayName: 'Bella Preschool', primaryColor: '#334155' });
  applyCanonicalTenantTheme(brand);
  expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
});

it.each([
  ['bella_babycare', 'babycare'], ['bella_haircut', 'beauty_spa'], ['bella_nail', 'beauty_spa'],
  ['bella_spa', 'beauty_spa'], ['bella_english_center', 'bella_education'], ['bella_hospital', 'bella_healthcare'],
])('retains registered %s presentation through canonical module capability', (productKey, moduleKey) => {
  expect(resolveCanonicalTenantBrand({ ...input, productKey })).toMatchObject({ moduleKey });
});

it.each([null, undefined, '', 'unknown-product'])('does not infer identity from modules or names when key is %s', productKey => {
  expect(resolveCanonicalTenantBrand({ ...input, productKey })).toBeNull();
  applyCanonicalTenantTheme(null);
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#334155');
});

it('preserves configured custom brand, colours, logo and typography', () => {
  const brand = resolveCanonicalTenantBrand({ ...input, logoUrl: 'https://example.test/logo.png',
    brandTheme: { brandName: 'My School', primaryColor: '#6D28D9', accentColor: '#F59E0B',
      fontHeading: 'serif', stylePreset: 'graphite_luxe', buttonStyle: 'pill' } });
  expect(brand).toMatchObject({ moduleKey: 'bella_education', displayName: 'My School', primaryColor: '#6D28D9',
    accentColor: '#F59E0B', logoUrl: 'https://example.test/logo.png', fontHeading: 'serif', buttonStyle: 'pill' });
});

it('clears previous tenant attributes and colours while identity is pending', () => {
  applyCanonicalTenantTheme(resolveCanonicalTenantBrand({ ...input, productKey: 'bella_spa' }));
  expect(document.documentElement.dataset.tenantBrandPreset).toBeDefined();
  applyCanonicalTenantTheme(null);
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
  expect(document.documentElement.dataset.tenantBrandPreset).toBeUndefined();
  expect(document.title).toBe('Bella EIP — Enterprise Platform');
});

it('bootstrap ignores stale local/session brand caches before authentication', () => {
  const root = { dataset: {} as Record<string, string>, style: { setProperty: jest.fn() } };
  const storage = { getItem: jest.fn(() => JSON.stringify({ moduleKey: 'beauty_spa', primaryColor: '#FF0000' })) };
  vm.runInNewContext(readFileSync('public/theme-bootstrap.js', 'utf8'), {
    window: { location: { pathname: '/dashboard/education/finance' }, localStorage: storage, sessionStorage: storage },
    document: { documentElement: root, querySelector: () => ({ setAttribute: jest.fn() }) },
  });
  expect(root.dataset.tenantModule).toBe('pending');
  expect(storage.getItem).not.toHaveBeenCalled();
});

it('provider stays neutral until verified context arrives, then uses canonical Product identity', async () => {
  let resolveResponse: (value: object) => void = () => { throw new Error('not initialized'); };
  fetchMock.mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
  render(<TenantContextProvider><div>Verified content</div></TenantContextProvider>);
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
  expect(screen.queryByText('Verified content')).toBeNull();
  await act(async () => resolveResponse({ ok: true, json: async () => config() }));
  await screen.findByText('Verified content');
  await waitFor(() => expect(document.documentElement.dataset.tenantModule).toBe('bella_education'));
});

it('provider shows a neutral error on failed context instead of fabricating a dev tenant', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500 });
  render(<TenantContextProvider><div>Unverified content</div></TenantContextProvider>);
  await screen.findByText('Lỗi tải cấu hình');
  expect(screen.queryByText('Unverified content')).toBeNull();
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
});

it('a tenant without classification can render context but keeps a neutral theme', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => config(null) });
  render(<TenantContextProvider><div>Unclassified content</div></TenantContextProvider>);
  await screen.findByText('Unclassified content');
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
});

it('provider rejects null settings rather than throwing during theme resolution', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...config(), settings: null }) });
  render(<TenantContextProvider><div>Invalid content</div></TenantContextProvider>);
  await screen.findByText('Lỗi tải cấu hình');
  expect(screen.queryByText('Invalid content')).toBeNull();
  expect(document.documentElement.dataset.tenantModule).toBe('pending');
});

it('an obsolete provider response cannot overwrite the current tenant after navigation', async () => {
  let obsolete: (value: object) => void = () => { throw new Error('not initialized'); };
  fetchMock.mockReturnValueOnce(new Promise(resolve => { obsolete = resolve; }));
  const first = render(<TenantContextProvider><div>Old content</div></TenantContextProvider>);
  first.unmount();
  fetchMock.mockResolvedValue({ ok: true, json: async () => config() });
  render(<TenantContextProvider><div>Current content</div></TenantContextProvider>);
  await screen.findByText('Current content');
  await act(async () => obsolete({ ok: true, json: async () => config('bella_spa') }));
  expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
});
