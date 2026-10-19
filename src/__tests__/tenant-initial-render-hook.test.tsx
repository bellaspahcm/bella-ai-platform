/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';

const mockGetSettings = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/lib/dashboard-client-context', () => ({ getCachedTenantSettings: () => mockGetSettings(), getCachedCurrentUser: () => mockGetUser() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('live tenant module presentation', () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockGetUser.mockReset().mockResolvedValue({ id: 'user', tenant_id: 'preschool' });
    window.sessionStorage.setItem('bella.runtime.brand.v1', JSON.stringify({ tenantId: 'old-spa', moduleKey: 'beauty_spa' }));
    window.localStorage.setItem('bella.sidebar.brand.v3', JSON.stringify({ tenantId: 'old-spa', moduleKey: 'beauty_spa' }));
  });

  it.each([undefined, { forceFresh: true }])('keeps slow identity neutral despite another tenant cache (%p)', async options => {
    const response = deferred<unknown>();
    mockGetSettings.mockReturnValue(response.promise);
    const { result } = renderHook(() => useTenantModuleKey(options));
    expect(result.current.tenantModuleKey).toBeNull();
    expect(result.current.isTenantModuleLoading).toBe(true);
    await act(async () => { response.resolve({ id: 'preschool', product_key: 'bella_preschool', enabled_modules: { bella_education: true } }); });
    expect(result.current.tenantModuleKey).toBe('bella_education');
    expect(result.current.tenantModuleError).toBeNull();
  });

  it.each([
    null,
    { id: 'missing-product', product_key: null, enabled_modules: { beauty_spa: true } },
    { id: 'unknown-product', product_key: 'unregistered', enabled_modules: { beauty_spa: true } },
    { id: 'empty-settings', product_key: 'bella_preschool', enabled_modules: {} },
  ])('does not convert incomplete identity %p to Spa', async tenant => {
    mockGetSettings.mockResolvedValue(tenant);
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.isTenantModuleLoading).toBe(false));
    expect(result.current.tenantModuleKey).toBeNull();
    expect(result.current.tenantModuleError).toBeTruthy();
  });

  it('clears the previous key when a subsequent live identity request fails', async () => {
    mockGetSettings.mockResolvedValueOnce({ id: 'preschool', product_key: 'bella_preschool', enabled_modules: { bella_education: true } });
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.tenantModuleKey).toBe('bella_education'));
    mockGetSettings.mockRejectedValueOnce(new Error('tenant request failed'));
    await act(async () => { await result.current.refreshTenantModuleKey(); });
    expect(result.current.tenantModuleKey).toBeNull();
    expect(result.current.tenantModuleError).toBe('tenant request failed');
  });

  it('preserves the ready module while refreshing the same authenticated tenant', async () => {
    const tenant = { id: 'preschool', product_key: 'bella_preschool', enabled_modules: { bella_education: true } };
    mockGetSettings.mockResolvedValueOnce(tenant);
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.tenantModuleKey).toBe('bella_education'));
    const refreshed = deferred<unknown>();
    mockGetSettings.mockReturnValueOnce(refreshed.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = result.current.refreshTenantModuleKey(); });
    expect(result.current.tenantModuleKey).toBe('bella_education');
    expect(result.current.isTenantModuleLoading).toBe(false);
    await act(async () => { refreshed.resolve(tenant); await refresh; });
    expect(result.current.tenantModuleKey).toBe('bella_education');
  });

  it('rejects a cached settings tenant that does not match the authenticated user', async () => {
    mockGetSettings.mockResolvedValue({ id: 'another-tenant', product_key: 'bella_spa', enabled_modules: { beauty_spa: true } });
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.isTenantModuleLoading).toBe(false));
    expect(result.current.tenantModuleKey).toBeNull();
    expect(result.current.tenantModuleError).toBeTruthy();
  });

  it('clears the previous presentation immediately after detecting an authenticated tenant switch', async () => {
    mockGetSettings.mockResolvedValueOnce({ id: 'preschool', product_key: 'bella_preschool', enabled_modules: { bella_education: true } });
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.tenantModuleKey).toBe('bella_education'));
    mockGetUser.mockResolvedValueOnce({ id: 'other-user', tenant_id: 'next-tenant' });
    const nextSettings = deferred<unknown>();
    mockGetSettings.mockReturnValueOnce(nextSettings.promise);
    let refresh!: Promise<void>;
    await act(async () => { refresh = result.current.refreshTenantModuleKey(); });
    expect(result.current.tenantModuleKey).toBeNull();
    expect(result.current.isTenantModuleLoading).toBe(true);
    await act(async () => { nextSettings.resolve({ id: 'next-tenant', product_key: 'bella_babycare', enabled_modules: { babycare: true, beauty_spa: true } }); await refresh; });
    expect(result.current.tenantModuleKey).toBe('babycare');
  });

  it.each([
    ['bella_preschool', { beauty_spa: true }, null],
    ['bella_babycare', { babycare: true, beauty_spa: true }, 'babycare'],
    ['bella_hospital', { healthcare: true }, 'bella_healthcare'],
  ])('reconciles %s presentation with its registered profile', async (product_key, enabled_modules, expected) => {
    mockGetSettings.mockResolvedValue({ id: 'preschool', product_key, enabled_modules });
    const { result } = renderHook(() => useTenantModuleKey());
    await waitFor(() => expect(result.current.isTenantModuleLoading).toBe(false));
    expect(result.current.tenantModuleKey).toBe(expected);
  });
});
