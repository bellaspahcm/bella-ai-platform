/** @jest-environment jsdom */

import { act, render, screen, waitFor } from '@testing-library/react';
import { DashboardAuthorizedShell } from '@/components/layout/DashboardLoadingShell';
import { TenantContextProvider } from '@/core/providers/TenantContextProvider';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { UserProvider } from '@/lib/user-context';
import * as UserContextModule from '@/lib/user-context';
import { productRegistry } from '@/platform/registry/product-registry';
import DashboardLayout from '@/app/dashboard/layout';
import { useLayoutEffect, type ReactNode } from 'react';

const mockGetUser = jest.fn();
const mockGetSettings = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockContextOverride: ReturnType<typeof UserContextModule.useUser> | null = null;
let mockObservedContext: ReturnType<typeof UserContextModule.useUser> | null = null;
jest.mock('@/lib/user-context', () => {
  const actual = jest.requireActual<typeof import('@/lib/user-context')>('@/lib/user-context');
  return { ...actual, useUser: () => {
    const context = actual.useUser();
    mockObservedContext = context;
    return mockContextOverride || context;
  } };
});
jest.mock('@/lib/dashboard-client-context', () => ({
  getCachedCurrentUser: () => mockGetUser(),
  getCachedTenantSettings: () => mockGetSettings(),
  clearDashboardClientContextCache: jest.fn(),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams(), useRouter: () => mockRouter }));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/common/ThemeToggle', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/common/AdminNotificationBell', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout/BeautyRuntimeBranchSelector', () => ({ BeautyRuntimeBranchSelector: () => null }));
jest.mock('@/components/common/TenantBrandLogo', () => ({ TenantBrandLogo: ({ logoUrl }: { logoUrl: string }) => <span data-testid="brand-logo" data-logo={logoUrl} /> }));
jest.mock('@/lib/utils/theme-upgrade', () => ({ needsThemeUpgrade: () => false }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const preschool = { id: 'current-preschool', product_key: 'bella_preschool', enabled_modules: { bella_education: true }, brand_theme: {}, logo_url: null, name: 'Preschool' };
const user = { id: 'user', tenant_id: 'current-preschool', role: 'admin', full_name: 'Current Admin' };

describe('authenticated shell and sidebar first render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextOverride = null;
    mockGetUser.mockResolvedValue(user);
    mockGetSettings.mockResolvedValue(preschool);
    window.history.replaceState({}, '', '/dashboard');
    document.documentElement.dataset.tenantModule = 'pending';
    document.documentElement.removeAttribute('data-tenant-brand-preset');
    document.documentElement.removeAttribute('style');
    const stale = JSON.stringify({ tenantId: 'old-spa', displayName: 'Wrong Spa', moduleKey: 'beauty_spa', primaryColor: '#074E44' });
    window.sessionStorage.setItem('bella.runtime.brand.v1', stale);
    window.localStorage.setItem('bella.sidebar.brand.v3', stale);
  });

  it('does not mount product children or menus while the live identity is delayed', async () => {
    const userResponse = deferred<unknown>();
    const tenantResponse = deferred<unknown>();
    mockGetUser.mockReturnValue(userResponse.promise);
    mockGetSettings.mockReturnValue(tenantResponse.promise);
    const childMounted = jest.fn();
    function Child() { childMounted(); return <div>Ready Product Content</div>; }
    render(<UserProvider><DashboardAuthorizedShell><Child /></DashboardAuthorizedShell></UserProvider>);
    expect(childMounted).not.toHaveBeenCalled();
    expect(screen.queryByText('Wrong Spa')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await act(async () => { userResponse.resolve(user); });
    expect(childMounted).not.toHaveBeenCalled();
    await act(async () => { tenantResponse.resolve(preschool); });
    await waitFor(() => expect(screen.getAllByText('Bella Preschool').length).toBeGreaterThan(0));
    expect(screen.getByText('Ready Product Content')).toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
    expect(screen.queryByText('Wrong Spa')).not.toBeInTheDocument();
  });

  it('clears the previous root theme before delayed auth on client navigation from login', async () => {
    const userResponse = deferred<unknown>();
    mockGetUser.mockReturnValue(userResponse.promise);
    document.documentElement.dataset.tenantModule = 'beauty_spa';
    document.documentElement.dataset.tenantBrandPreset = 'jade_wellness';
    document.documentElement.style.setProperty('--primary', '#074E44', 'important');
    document.documentElement.style.setProperty('--sidebar-bg', '#074E44', 'important');
    document.title = 'Wrong Spa — Management System';
    render(<DashboardLayout><div>Ready Dashboard</div></DashboardLayout>);
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
    expect(document.documentElement.dataset.tenantBrandPreset).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#334155');
    expect(document.documentElement.style.getPropertyPriority('--primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--sidebar-bg')).not.toContain('#074E44');
    expect(document.title).toBe('Bella EIP — Enterprise Platform');
    expect(screen.queryByText('Ready Dashboard')).not.toBeInTheDocument();
    await act(async () => { userResponse.resolve(user); });
    expect(await screen.findByText('Ready Dashboard')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.tenantModule).toBe('bella_education'));
  });

  it.each([
    null,
    { ...preschool, product_key: null },
    { ...preschool, product_key: 'unknown-product' },
    { ...preschool, id: 'another-tenant' },
  ])('keeps an error neutral without mounting product children for %p', async settings => {
    mockGetSettings.mockResolvedValue(settings);
    render(<UserProvider><DashboardAuthorizedShell><div>Wrong Content</div></DashboardAuthorizedShell></UserProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác định cấu hình sản phẩm');
    expect(screen.queryByText('Wrong Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
  });

  it('renders and applies the current custom brand rather than the previous tenant cache', async () => {
    mockGetSettings.mockResolvedValue({ ...preschool, brand_theme: { brandName: 'Mầm Non Sao Mai', primaryColor: '#6D28D9', accentColor: '#F59E0B', logoUrl: '/assets/logo.png' } });
    render(<UserProvider><DashboardAuthorizedShell><div>Ready</div></DashboardAuthorizedShell></UserProvider>);
    await waitFor(() => expect(screen.getAllByText('Mầm Non Sao Mai').length).toBeGreaterThan(0));
    expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#6D28D9');
    screen.getAllByTestId('brand-logo').forEach(logo => expect(logo).toHaveAttribute('data-logo', '/assets/logo.png'));
  });

  it.each(['bella_hospitality', 'bella_manufacturing'])('shows a module-free %s brand with no inherited product menu', async productKey => {
    mockGetSettings.mockResolvedValue({ ...preschool, product_key: productKey, enabled_modules: {}, brand_theme: { brandName: 'Current Custom Brand', primaryColor: '#6D28D9', logoUrl: '/assets/logo.png' } });
    render(<UserProvider><DashboardAuthorizedShell><div>Product Specific Page</div></DashboardAuthorizedShell></UserProvider>);
    await waitFor(() => expect(screen.getAllByText('Current Custom Brand').length).toBeGreaterThan(0));
    expect(screen.getByText('Product Specific Page')).toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#6D28D9');
    expect(document.querySelector('nav a')).toBeNull();
    expect(screen.queryByText('Wrong Spa')).not.toBeInTheDocument();
  });

  it('uses the validated provider snapshot even if a redundant second request would never finish', async () => {
    mockGetUser.mockResolvedValueOnce(user).mockReturnValue(new Promise(() => {}));
    mockGetSettings.mockResolvedValueOnce(preschool).mockReturnValue(new Promise(() => {}));
    render(<UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>);
    await waitFor(() => expect(screen.getAllByText('Bella Preschool').length).toBeGreaterThan(0));
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('resets stale theme/title for loading, invalid identity and tenant changes while the shell stays mounted', async () => {
    const element = <UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>;
    try {
      const { rerender } = render(element);
      await waitFor(() => expect(document.title).toBe('Bella Preschool — Preschool Management'));
      if (!mockObservedContext) throw new Error('Provider snapshot missing');
      const readyContext = mockObservedContext;
      mockContextOverride = { ...readyContext, isLoading: true };
      rerender(<UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>);
      expect(document.documentElement.dataset.tenantModule).toBe('pending');
      expect(document.documentElement.dataset.tenantBrandPreset).toBeUndefined();
      expect(document.title).toBe('Bella EIP — Enterprise Platform');
      expect(screen.queryByText('Current Page')).not.toBeInTheDocument();
      mockContextOverride = readyContext;
      rerender(<UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>);
      expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
      mockContextOverride = { ...readyContext, product: null };
      rerender(<UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(document.title).toBe('Bella EIP — Enterprise Platform');
      if (!readyContext.user || !readyContext.tenantSettings) throw new Error('Ready identity missing');
      mockContextOverride = {
        ...readyContext,
        product: productRegistry.getRequired('bella_babycare'),
        user: { ...readyContext.user, tenant_id: 'next-tenant' },
        tenantSettings: { ...readyContext.tenantSettings, id: 'next-tenant', product_key: 'bella_babycare', enabled_modules: { babycare: true, beauty_spa: true }, brand_theme: {} },
      };
      rerender(<UserProvider><DashboardAuthorizedShell><div>Current Page</div></DashboardAuthorizedShell></UserProvider>);
      expect(document.documentElement.dataset.tenantModule).toBe('babycare');
      expect(document.title).toBe('Bella Mommy Baby Care — Mommy & Baby Care Management');
    } finally { mockContextOverride = null; }
  });

  it('reapplies the ready custom brand to an embedded shell with no sidebar', async () => {
    window.history.replaceState({}, '', '/dashboard?embedded=true');
    mockGetSettings.mockResolvedValue({ ...preschool, brand_theme: { brandName: 'Embedded School', primaryColor: '#6D28D9' } });
    render(<UserProvider><DashboardAuthorizedShell><div>Embedded Product</div></DashboardAuthorizedShell></UserProvider>);
    expect(await screen.findByText('Embedded Product')).toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#6D28D9');
    expect(document.title).toBe('Embedded School — Preschool Management');
    expect(document.querySelector('aside')).toBeNull();
  });

  it('preserves explicit accent with a preset primary before embedded product first paint', async () => {
    window.history.replaceState({}, '', '/dashboard?embedded=true');
    mockGetSettings.mockResolvedValue({ ...preschool, brand_theme: { primaryColor: '#334155', accentColor: '#F59E0B', stylePreset: 'slate_minimal' } });
    const paints: string[] = [];
    const readyFrames: FrameRequestCallback[] = [];
    const frameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { readyFrames.push(callback); return readyFrames.length; });
    function EmbeddedProduct() {
      useLayoutEffect(() => {
        requestAnimationFrame(() => paints.push(document.documentElement.style.getPropertyValue('--accent')));
      }, []);
      return <div>Embedded Custom Accent</div>;
    }
    try {
      render(<UserProvider><DashboardAuthorizedShell><EmbeddedProduct /></DashboardAuthorizedShell></UserProvider>);
      expect(await screen.findByText('Embedded Custom Accent')).toBeInTheDocument();
      readyFrames.forEach(callback => callback(0));
      expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#334155');
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#F59E0B');
      expect(paints).toEqual(['#F59E0B']);
    } finally { frameSpy.mockRestore(); }
  });
});


describe('authenticated AutoMove vertical shell', () => {
  const autoTenant = { id: 'auto', product_key: null, enabled_modules: { bella_auto: true }, brand_theme: {}, name: 'Auto tenant', logo_url: null };
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextOverride = null;
    mockGetUser.mockResolvedValue({ ...user, tenant_id: 'auto' });
    mockGetSettings.mockResolvedValue(autoTenant);
    window.history.replaceState({}, '', '/dashboard');
    document.documentElement.removeAttribute('style');
    document.documentElement.dataset.tenantModule = 'pending';
    const stale = JSON.stringify({ tenantId: 'old-spa', displayName: 'Wrong Spa', moduleKey: 'beauty_spa', primaryColor: '#074E44' });
    window.sessionStorage.setItem('bella.runtime.brand.v1', stale);
    window.localStorage.setItem('bella.sidebar.brand.v3', stale);
  });

  it.each([undefined, null])('waits for auth and tenant then mounts the real AutoMove sidebar with product key %p', async product_key => {
    const settingsResponse = deferred<unknown>();
    mockGetSettings.mockReturnValue(settingsResponse.promise);
    render(<UserProvider><DashboardAuthorizedShell><div>AutoMove Content</div></DashboardAuthorizedShell></UserProvider>);
    expect(screen.queryByText('AutoMove Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Wrong Spa')).not.toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
    await act(async () => { settingsResponse.resolve({ ...autoTenant, product_key }); });
    expect(await screen.findByText('AutoMove Content')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Kho Xe' })).toHaveAttribute('href', '/dashboard/bella-auto/vehicles');
    expect(screen.getByRole('link', { name: 'Trung tâm' })).toHaveAttribute('href', '/dashboard/bella-auto');
    expect(document.documentElement.dataset.tenantModule).toBe('bella_auto');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#1E40AF');
    expect(mockObservedContext?.product).toBeNull();
    expect(screen.queryByText('Wrong Spa')).not.toBeInTheDocument();
  });

  it.each([
    { ...autoTenant, product_key: 'unregistered' },
    { ...autoTenant, id: 'another-tenant' },
    { ...autoTenant, enabled_modules: { bella_auto: false } },
  ])('keeps invalid AutoMove identity %p neutral and does not mount children', async tenant => {
    mockGetSettings.mockResolvedValue(tenant);
    render(<UserProvider><DashboardAuthorizedShell><div>AutoMove Content</div></DashboardAuthorizedShell></UserProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xác định cấu hình sản phẩm');
    expect(screen.queryByText('AutoMove Content')).not.toBeInTheDocument();
    expect(document.querySelector('aside')).toBeNull();
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
  });

  it('retains registered Preschool presentation even with AutoMove also enabled', async () => {
    mockGetSettings.mockResolvedValue({ ...autoTenant, product_key: 'bella_preschool', enabled_modules: { bella_auto: true, bella_education: true } });
    render(<UserProvider><DashboardAuthorizedShell><div>Registered Product</div></DashboardAuthorizedShell></UserProvider>);
    expect(await screen.findByText('Registered Product')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Bella Preschool').length).toBeGreaterThan(0));
    expect(screen.queryByRole('link', { name: 'Kho Xe' })).not.toBeInTheDocument();
    expect(document.documentElement.dataset.tenantModule).toBe('bella_education');
  });
});

describe('tenant context theme ownership', () => {
  function ContextChild() {
    const tenant = useTenantContext();
    return <div>Context: {tenant.tenantId}</div>;
  }
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it.each([200, 401])('requires verified context (%i) and keeps unknown Product presentation neutral', async status => {
    window.history.replaceState({}, '', '/dashboard/education');
    document.documentElement.dataset.tenantModule = 'pending';
    global.fetch = jest.fn().mockResolvedValue({ status, ok: status === 200, json: async () => ({
      tenantId: 'context-preschool', tenantName: 'Controlled school', enabledModules: ['beauty_spa'],
      subscriptionPlan: 'basic', featureFlags: {}, settings: {},
    }) });
    render(<TenantContextProvider><ContextChild /></TenantContextProvider>);
    if (status === 200) expect(await screen.findByText('Context: context-preschool')).toBeInTheDocument();
    else {
      expect(await screen.findByText('Lỗi tải cấu hình')).toBeInTheDocument();
      expect(screen.queryByText(/Context:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/dev-tenant/)).not.toBeInTheDocument();
    }
    expect(global.fetch).toHaveBeenCalledWith('/api/tenant/context', expect.objectContaining({ credentials: 'same-origin', method: 'GET' }));
    expect(document.documentElement.dataset.tenantModule).toBe('pending');
  });
});
