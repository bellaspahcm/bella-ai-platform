import { renderToStaticMarkup } from 'react-dom/server';
import { BellaAutoHeader } from '@/components/bella-auto/BellaAutoHeader';
import BellaAutoAnalyticsDashboard from '@/components/bella-auto/BellaAutoAnalyticsDashboard';
import VehicleInventoryDashboard from '@/components/bella-auto/VehicleInventoryDashboard';
import type { Database } from '@/types/database.types';
import BellaAutoPage from '../page';

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(async () => mockSupabase),
}));
jest.mock('@/components/bella-auto/BellaAutoHeader', () => ({
  BellaAutoHeader: jest.fn(() => null),
}));
jest.mock('@/components/bella-auto/BellaAutoAnalyticsDashboard', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('@/components/bella-auto/VehicleInventoryDashboard', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

// Keep next/navigation and the Mobility summary contract real. Only replace
// Supabase I/O and child views; these tests do not prove database/RLS behavior.
const userId = 'authenticated-auto-user';
const tenantId = 'authenticated-auto-tenant';
type Profile = { tenant_id: string | null; full_name: string | null };
type InventoryRow = Pick<Database['public']['Tables']['auto_vehicles']['Row'], 'status' | 'delivered_at'>;
const mockGetUser = jest.fn<Promise<{ data: { user: { id: string } | null } }>, []>();
const mockProfileSingle = jest.fn<Promise<{ data: Profile | null }>, []>();
const mockTenantSingle = jest.fn<Promise<{ data: { name: string } | null }>, []>();
const mockInventoryReturns = jest.fn<Promise<{
  data: InventoryRow[] | null;
  error: { message: string } | null;
}>, []>();
const mockProfileQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: mockProfileSingle,
};
const mockTenantQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: mockTenantSingle,
};
const mockInventoryQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  returns: mockInventoryReturns,
};
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: jest.fn((table: string) => {
    switch (table) {
      case 'users': return mockProfileQuery;
      case 'tenants': return mockTenantQuery;
      case 'auto_vehicles': return mockInventoryQuery;
      default: throw new Error(`Unexpected table: ${table}`);
    }
  }),
};

describe('Bella Auto dashboard route control', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
    mockProfileSingle.mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Mai Auto' } });
    mockTenantSingle.mockResolvedValue({ data: { name: 'Authenticated Showroom' } });
    mockInventoryReturns.mockResolvedValue({
      data: [
        { status: 'showroom', delivered_at: null },
        { status: 'showroom', delivered_at: null },
        { status: 'warehouse', delivered_at: null },
        { status: 'allocated', delivered_at: null },
        { status: 'delivered', delivered_at: null },
        { status: 'in_transit', delivered_at: null },
      ],
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates the real Next login redirect without querying data or logging a fatal error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(BellaAutoPage()).rejects.toMatchObject({
      message: 'NEXT_REDIRECT',
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });

    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(BellaAutoHeader).not.toHaveBeenCalled();
    expect(BellaAutoAnalyticsDashboard).not.toHaveBeenCalled();
    expect(VehicleInventoryDashboard).not.toHaveBeenCalled();
  });

  it('passes the authenticated profile tenant and Mobility summary to the dashboard views', async () => {
    renderToStaticMarkup(await BellaAutoPage());

    expect(mockProfileQuery.select).toHaveBeenCalledWith('tenant_id, full_name');
    expect(mockProfileQuery.eq).toHaveBeenCalledWith('id', userId);
    expect(mockTenantQuery.eq).toHaveBeenCalledWith('id', tenantId);
    expect(mockInventoryQuery.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(jest.mocked(BellaAutoHeader).mock.calls[0]?.[0]).toEqual({
      monogram: 'MA', fullName: 'Mai Auto', tenantName: 'Authenticated Showroom',
    });
    expect(jest.mocked(BellaAutoAnalyticsDashboard).mock.calls[0]?.[0]).toEqual({
      tenantId,
      inventory: {
        totalVehicles: 6, showroomCount: 2, warehouseCount: 1,
        allocatedCount: 1, deliveredCount: 1,
      },
    });
    expect(jest.mocked(VehicleInventoryDashboard).mock.calls[0]?.[0]).toEqual({ tenantId });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('reports a missing tenant without loading tenant or inventory data', async () => {
    mockProfileSingle.mockResolvedValue({ data: { tenant_id: null, full_name: 'Mai Auto' } });

    const html = renderToStaticMarkup(await BellaAutoPage());

    expect(html).toContain('Không tìm thấy tenant');
    expect(mockSupabase.from.mock.calls).toEqual([['users']]);
    expect(mockTenantSingle).not.toHaveBeenCalled();
    expect(mockInventoryReturns).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('keeps the data error UI when the real Mobility contract rejects an inventory failure', async () => {
    mockInventoryReturns.mockResolvedValue({ data: null, error: { message: 'Inventory unavailable' } });

    const html = renderToStaticMarkup(await BellaAutoPage());

    expect(html).toContain('Lỗi tải Dashboard');
    expect(html).toContain('Mobility.getVehicleInventorySummary: Inventory unavailable');
    expect(errorLog).toHaveBeenCalledWith(
      '[BellaAutoPage] Fatal error:',
      expect.objectContaining({ message: 'Mobility.getVehicleInventorySummary: Inventory unavailable' }),
    );
    expect(BellaAutoHeader).not.toHaveBeenCalled();
    expect(BellaAutoAnalyticsDashboard).not.toHaveBeenCalled();
    expect(VehicleInventoryDashboard).not.toHaveBeenCalled();
  });
});
