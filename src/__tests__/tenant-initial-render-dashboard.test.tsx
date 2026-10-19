/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { productRegistry, type ProductDefinition } from '@/platform/registry/product-registry';
import { getMonthlyPerformance } from '@/core/services/analytics/dashboard-actions';
import { getBeautyDashboardCustomerRatingDistribution, getBeautyDashboardTopTechnicians } from '@/app/dashboard/beauty-dashboard-rating-actions';
import { getDashboardWidgetAlerts } from '@/components/common/dashboard-widget-actions';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockDocumentReplace = jest.fn();
let mockPathname = '/dashboard';
let mockContext: { isLoading: boolean; product: ProductDefinition | null; user: { tenant_id: string; role: string } | null; tenantSettings: { id: string; product_key?: string | null; enabled_modules: Record<string, boolean> } | null };
let mockModule: { tenantModuleKey: string | null; isTenantModuleLoading: boolean; tenantModuleError: string | null };
const mockPrimaryData = jest.fn().mockResolvedValue({ statsData: {}, sessionsData: [], inventorySummary: { totalItems: 0, lowStockCount: 0, totalValue: 0 } });
const mockChannel = jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() }));

jest.mock('@/lib/user-context', () => ({ useUser: () => mockContext }));
jest.mock('@/lib/business-rules/product-presentation-routing', () => ({
  ...jest.requireActual('@/lib/business-rules/product-presentation-routing'),
  replaceDashboardProductDocument: (destination: string) => mockDocumentReplace(destination),
}));
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => mockRouter }));
jest.mock('@/hooks/useTenantModuleKey', () => ({ useTenantModuleKey: () => mockModule }));
jest.mock('@/hooks/useModuleVocabulary', () => ({ useModuleVocabulary: () => ({ worker: { short: 'Nhân viên' } }) }));
jest.mock('@/hooks/usePageRefresh', () => ({ usePageRefresh: jest.fn() }));
jest.mock('@/components/layout/DashboardLoadingShell', () => ({ DashboardRouteLoading: () => <div data-testid="neutral-loading">Đang tải</div> }));
jest.mock('next/dynamic', () => ({ __esModule: true, default: (loader: () => Promise<unknown>) => {
  const name = loader.toString().includes('HaircutDashboardView') ? 'haircut-view'
    : loader.toString().includes('BeautySpaV2DashboardView') ? 'beauty-view' : 'auxiliary-view';
  return function DynamicBoundary() { return <div data-testid={name} />; };
} }));
jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({
  channel: () => mockChannel(), removeChannel: jest.fn(),
}) }));
jest.mock('@/core/services/order', () => ({ completeSession: jest.fn(), saveSessionNote: jest.fn() }));
jest.mock('@/core/services/analytics/dashboard-actions', () => ({ getDashboardPrimaryData: (...args: unknown[]) => mockPrimaryData(...args), getMonthlyPerformance: jest.fn().mockResolvedValue([]) }));
jest.mock('@/app/dashboard/beauty-dashboard-rating-actions', () => ({ getBeautyDashboardCustomerRatingDistribution: jest.fn().mockResolvedValue([]), getBeautyDashboardTopTechnicians: jest.fn().mockResolvedValue([]) }));
jest.mock('@/components/common/dashboard-widget-actions', () => ({ getDashboardWidgetAlerts: jest.fn().mockResolvedValue([]) }));
jest.mock('@/core/services/notification/notification-actions', () => ({ markNotificationAsRead: jest.fn() }));
jest.mock('@/components/common/AdminNotificationBell', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/features/dashboard/KtvPerformanceTable', () => ({ KtvPerformanceTable: () => null }));
jest.mock('@/components/features/dashboard/RevenueChart', () => ({ RevenueChart: () => null }));
jest.mock('@/components/features/dashboard/StatsGrid', () => ({ StatsGrid: () => null }));

describe('root dashboard product dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    mockContext = { isLoading: true, product: null, user: null, tenantSettings: null };
    mockModule = { tenantModuleKey: 'beauty_spa', isTenantModuleLoading: false, tenantModuleError: null };
  });
  function ready(productKey: string) {
    mockContext = { isLoading: false, product: productRegistry.getRequired(productKey), user: { tenant_id: 'current', role: 'admin' }, tenantSettings: { id: 'current', enabled_modules: productKey === 'bella_babycare' ? { babycare: true } : { beauty_spa: true } } };
  }
  function expectNoDashboardWork() {
    expect(mockPrimaryData).not.toHaveBeenCalled();
    expect(getMonthlyPerformance).not.toHaveBeenCalled();
    expect(getBeautyDashboardCustomerRatingDistribution).not.toHaveBeenCalled();
    expect(getBeautyDashboardTopTechnicians).not.toHaveBeenCalled();
    expect(getDashboardWidgetAlerts).not.toHaveBeenCalled();
    expect(mockChannel).not.toHaveBeenCalled();
  }

  it('does not mount a Spa child or fetch its dashboard during delayed product identity', () => {
    const { rerender } = render(<DashboardPage />);
    expect(screen.getByTestId('neutral-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockPrimaryData).not.toHaveBeenCalled();
    ready('bella_preschool');
    rerender(<DashboardPage />);
    expect(mockDocumentReplace).toHaveBeenCalledWith('/dashboard/education');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockPrimaryData).not.toHaveBeenCalled();
  });

  it.each([
    ['bella_preschool', '/dashboard/education'],
    ['bella_english_center', '/dashboard/english-center'],
    ['bella_hospital', '/dashboard/hospital'],
    ['bella_hospitality', '/dashboard/hospitality'],
    ['bella_manufacturing', '/dashboard/manufacturing'],
  ])('keeps %s neutral until navigation to its correct route completes', (key, route) => {
    ready(key);
    render(<DashboardPage />);
    expect(mockDocumentReplace).toHaveBeenCalledWith(route);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('neutral-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockPrimaryData).not.toHaveBeenCalled();
  });

  it.each(['bella_spa', 'bella_babycare', 'bella_nail'])('preserves the ready %s operational dashboard at the root', async key => {
    ready(key);
    mockModule.tenantModuleKey = key === 'bella_babycare' ? 'babycare' : 'beauty_spa';
    render(<DashboardPage />);
    expect(screen.getByTestId('beauty-view')).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockDocumentReplace).not.toHaveBeenCalled();
    await waitFor(() => expect(mockPrimaryData).toHaveBeenCalled());
  });

  it('renders the canonical Haircut root view without an interim Spa view', () => {
    ready('bella_haircut');
    render(<DashboardPage />);
    expect(screen.getByTestId('haircut-view')).toBeInTheDocument();
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not mount root product actions again after pathname reaches the destination', () => {
    ready('bella_preschool');
    mockPathname = '/dashboard/education';
    render(<DashboardPage />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockDocumentReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('neutral-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockPrimaryData).not.toHaveBeenCalled();
  });

  it('shows a neutral error for missing identity and never defaults to Spa', () => {
    mockContext.isLoading = false;
    render(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể xác định sản phẩm');
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockDocumentReplace).not.toHaveBeenCalled();
  });

  it('does not render Spa after module resolution fails for a classified root product', () => {
    ready('bella_babycare');
    mockModule = { tenantModuleKey: null, isTenantModuleLoading: false, tenantModuleError: 'tenant unavailable' };
    render(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải cấu hình sản phẩm');
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expectNoDashboardWork();
  });

  it.each(['bella_babycare', 'bella_spa', 'bella_nail', 'bella_haircut'])('rejects incompatible %s module configuration without data work or a redirect spinner', key => {
    ready(key);
    if (!mockContext.tenantSettings) throw new Error('Missing test context');
    mockContext.tenantSettings.enabled_modules = { bella_education: true };
    mockModule.tenantModuleKey = 'bella_education';
    render(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải cấu hình sản phẩm');
    expect(screen.queryByTestId('beauty-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('haircut-view')).not.toBeInTheDocument();
    expectNoDashboardWork();
  });

  it('rejects a failed hook module even when the validated context retains its previous compatible module', () => {
    ready('bella_spa');
    mockModule = { tenantModuleKey: 'beauty_spa', isTenantModuleLoading: false, tenantModuleError: 'identity refresh failed' };
    render(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải cấu hình sản phẩm');
    expectNoDashboardWork();
  });

  it.each([undefined, null])('redirects the existing AutoMove vertical with key %p without mounting Spa data work', product_key => {
    mockContext = { isLoading: false, product: null, user: { tenant_id: 'auto', role: 'admin' }, tenantSettings: { id: 'auto', product_key, enabled_modules: { bella_auto: true } } };
    const { rerender } = render(<DashboardPage />);
    expect(mockDocumentReplace).toHaveBeenCalledWith('/dashboard/bella-auto');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('neutral-loading')).toBeInTheDocument();
    expectNoDashboardWork();
    mockDocumentReplace.mockClear();
    mockPathname = '/dashboard/bella-auto';
    rerender(<DashboardPage />);
    expect(mockDocumentReplace).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('neutral-loading')).toBeInTheDocument();
    expectNoDashboardWork();
  });

  it.each([
    { id: 'auto', product_key: 'unregistered', enabled_modules: { bella_auto: true } },
    { id: 'other', product_key: null, enabled_modules: { bella_auto: true } },
    { id: 'auto', product_key: null, enabled_modules: { bella_auto: false } },
  ])('rejects unverified AutoMove context %p without navigation or Spa work', tenantSettings => {
    mockContext = { isLoading: false, product: null, user: { tenant_id: 'auto', role: 'admin' }, tenantSettings };
    render(<DashboardPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể xác định sản phẩm');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockDocumentReplace).not.toHaveBeenCalled();
    expectNoDashboardWork();
  });

});
