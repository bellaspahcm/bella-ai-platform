import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getPrimaryClient } from '@/lib/database/read-replica';
import { FinancialReportingService } from '../FinancialReportingService';

jest.mock('@/lib/database/read-replica', () => ({ getPrimaryClient: jest.fn() }));

type Row = Record<string, unknown>;
function clientFixture(overrides: Record<string, readonly Row[]> = {}, errorTable?: string, authenticated = true) {
  const tables: Record<string, readonly Row[]> = {
    users: [{ id: 'actor-a', tenant_id: 'tenant-a', status: 'active' }],
    tenants: [{ id: 'tenant-a', status: 'active' }],
    auto_vehicle_sale_recognitions: [{ id: 'sale-a', tenant_id: 'tenant-a', vehicle_id: 'vehicle-a',
      sale_price_recognized: '1500000000', cost_basis_at_sale: '1000000000',
      recognized_at: '2026-01-01T00:00:00Z', recognized_by_user_id: 'actor-a' }],
    auto_vehicle_sale_recognition_adjustments: [{ id: 'adjust-a', tenant_id: 'tenant-a', recognition_id: 'sale-a',
      sale_price_delta: '-100000000', cost_basis_delta: '50000000' }],
    auto_vehicles: [{ id: 'vehicle-a', tenant_id: 'tenant-a', variant_id: 'variant-a', vin: 'VIN-A', color_exterior: 'White',
      auto_variants: { name: 'Luxury', auto_models: { name: 'Model A' } } }],
    auto_bookings: [{ tenant_id: 'tenant-a', status: 'completed', total_price: 9900000000 }],
    auto_deposits: [{ tenant_id: 'tenant-a', status: 'confirmed', amount: 100000000 }],
    ...overrides,
  };
  const calls: Array<{ table: string; range?: [number, number] }> = [];
  const client = {
    auth: { getUser: jest.fn(async () => ({ data: { user: authenticated ? { id: 'actor-a' } : null }, error: null })) },
    from: (table: string) => {
      let rows = tables[table] ?? [];
      let range: [number, number] | undefined;
      const resolve = () => {
        calls.push({ table, range });
        return { data: range ? rows.slice(range[0], range[1] + 1) : rows, error: table === errorTable ? { message: 'DB unavailable' } : null };
      };
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return builder; },
        in: (field: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[field])); return builder; },
        order: () => builder,
        range: (from: number, to: number) => { range = [from, to]; return builder; },
        returns: () => builder,
        single: async () => { const result = resolve(); return { ...result, data: result.data[0] ?? null }; },
        then: <T, U>(fulfilled?: ((value: ReturnType<typeof resolve>) => T | PromiseLike<T>) | null,
          rejected?: ((reason: unknown) => U | PromiseLike<U>) | null) => Promise.resolve(resolve()).then(fulfilled, rejected),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, calls };
}

describe('authenticated dashboard recognized sales contract', () => {
  beforeEach(() => jest.clearAllMocks());
  const now = new Date('2026-01-15T12:00:00Z');

  it('uses approved recognition snapshots/deltas, not completed bookings, deposits or live vehicle prices', async () => {
    const { client, calls } = clientFixture();
    const data = await FinancialReportingService.getRecognizedSalesDashboard(client, now);
    expect(data.revenueByMonth.map(row => row.month)).toEqual(['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01']);
    expect(data.revenueByMonth[5]).toEqual({ month: '2026-01', revenue: 1400000000, sales: 1 });
    expect(data.topModels).toEqual([{ model: 'Model A', sold: 1, revenue: 1400000000 }]);
    expect(data.summary).toEqual({ revenue: 1400000000, sales: 1, averageSalePrice: 1400000000 });
    expect(calls.map(call => call.table)).not.toEqual(expect.arrayContaining(['auto_bookings', 'auto_deposits', 'auto_sales']));
    expect(getPrimaryClient).not.toHaveBeenCalled();
    expect(await FinancialReportingService.getRecognizedSalesDashboard(client, now)).toEqual(data);
  });

  it('returns verified zero for no recognitions even when booking/deposit data exists', async () => {
    const { client } = clientFixture({ auto_vehicle_sale_recognitions: [] });
    const data = await FinancialReportingService.getRecognizedSalesDashboard(client, now);
    expect(data.revenueByMonth).toHaveLength(6);
    expect(data.revenueByMonth.every(row => row.revenue === 0 && row.sales === 0)).toBe(true);
    expect(data.topModels).toEqual([]);
  });

  it('uses the UTC recognition period, preserves missing display, and never mixes tenants', async () => {
    const { client } = clientFixture({ auto_vehicles: [], auto_vehicle_sale_recognition_adjustments: [],
      auto_vehicle_sale_recognitions: [
        { id: 'sale-1', tenant_id: 'tenant-a', vehicle_id: 'v1', sale_price_recognized: 100,
          cost_basis_at_sale: 20, recognized_at: '2026-01-01T01:00:00+07:00' },
        { id: 'sale-2', tenant_id: 'tenant-a', vehicle_id: 'v2', sale_price_recognized: 200,
          cost_basis_at_sale: 50, recognized_at: '2026-01-01T00:00:00Z' },
        { id: 'sale-3', tenant_id: 'tenant-b', vehicle_id: 'v3', sale_price_recognized: 999,
          cost_basis_at_sale: 1, recognized_at: '2026-01-01T00:00:00Z' },
      ] });
    const data = await FinancialReportingService.getRecognizedSalesDashboard(client, now);
    expect(data.revenueByMonth.slice(4)).toEqual([
      { month: '2025-12', revenue: 100, sales: 1 }, { month: '2026-01', revenue: 200, sales: 1 },
    ]);
    expect(data.topModels).toEqual([{ model: 'Unknown model', sold: 2, revenue: 300 }]);
  });

  it('does not truncate recognitions at the PostgREST page limit', async () => {
    const { client, calls } = clientFixture({ auto_vehicles: [], auto_vehicle_sale_recognition_adjustments: [],
      auto_vehicle_sale_recognitions: Array.from({ length: 1001 }, (_, i) => ({
        id: `sale-${i}`, tenant_id: 'tenant-a', vehicle_id: 'vehicle-a', sale_price_recognized: 1,
        cost_basis_at_sale: 0, recognized_at: '2026-01-01T00:00:00Z',
      })) });
    const data = await FinancialReportingService.getRecognizedSalesDashboard(client, now);
    expect(data.revenueByMonth[5]).toEqual({ month: '2026-01', revenue: 1001, sales: 1001 });
    expect(calls.filter(call => call.table === 'auto_vehicle_sale_recognitions').map(call => call.range))
      .toEqual([[0, 999], [1000, 1999]]);
  });

  it.each([
    ['missing identity', {}, false, 401],
    ['missing profile', { users: [] }, true, 403],
    ['inactive actor', { users: [{ id: 'actor-a', tenant_id: 'tenant-a', status: 'inactive' }] }, true, 403],
    ['missing tenant', { users: [{ id: 'actor-a', tenant_id: null, status: 'active' }] }, true, 403],
    ['inactive tenant', { tenants: [{ id: 'tenant-a', status: 'terminated' }] }, true, 403],
  ] as const)('fails closed for %s', async (_name, overrides, authenticated, status) => {
    const { client, calls } = clientFixture(overrides, undefined, authenticated);
    await expect(FinancialReportingService.getRecognizedSalesDashboard(client, now)).rejects.toMatchObject({ status });
    expect(calls.map(call => call.table)).not.toContain('auto_vehicle_sale_recognitions');
  });

  it.each(['users', 'tenants', 'auto_vehicle_sale_recognitions', 'auto_vehicle_sale_recognition_adjustments', 'auto_vehicles'])
    ('propagates %s errors instead of reporting zero', async table => {
      const { client } = clientFixture({}, table);
      await expect(FinancialReportingService.getRecognizedSalesDashboard(client, now)).rejects.toThrow();
    });

  it.each([null, 'invalid', '9007199254740993', 1.5])('fails closed for invalid canonical amount %s', async amount => {
    const { client } = clientFixture({ auto_vehicle_sale_recognitions: [{
      id: 'invalid-sale', tenant_id: 'tenant-a', vehicle_id: 'vehicle-a', sale_price_recognized: amount,
      cost_basis_at_sale: 0, recognized_at: '2026-01-01T00:00:00Z',
    }] });
    await expect(FinancialReportingService.getRecognizedSalesDashboard(client, now)).rejects.toMatchObject({ status: 503 });
  });
});
