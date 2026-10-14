import type { SupabaseClient } from '@supabase/supabase-js';

import { getPrimaryClient } from '@/lib/database/read-replica';
import type { Database } from '@/types/database.types';
import { FinancialReportingService } from '../FinancialReportingService';

jest.mock('@/lib/database/read-replica', () => ({
  getPrimaryClient: jest.fn(),
}));

type Row = Record<string, unknown>;
type TableRows = Record<string, Row[]>;
type QueryFilter = { field: string; value: unknown };
type QueryInFilter = { field: string; values: readonly unknown[] };
type QueryRangeFilter = { field: string; value: unknown; operator: 'gte' | 'lte' };
type QueryRecord = {
  table: string;
  selection?: string;
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  rangeFilters: QueryRangeFilter[];
  orderBy?: { field: string; ascending?: boolean };
};
type QueryResult = {
  data: Row[] | null;
  error: { message: string } | null;
};
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (selection: string) => QueryBuilder;
  eq: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, values: readonly unknown[]) => QueryBuilder;
  order: (field: string, options?: { ascending?: boolean }) => QueryBuilder;
  returns: () => QueryBuilder;
};

function makeSupabase(tables: TableRows): {
  client: SupabaseClient<Database>;
  queries: QueryRecord[];
} {
  const queries: QueryRecord[] = [];

  return {
    queries,
    client: {
      from: (table: string) => {
        const query: QueryRecord = {
          table,
          filters: [],
          inFilters: [],
          rangeFilters: [],
        };

        const builder: QueryBuilder = {
          select: (selection) => {
            query.selection = selection;
            return builder;
          },
          eq: (field, value) => {
            query.filters.push({ field, value });
            return builder;
          },
          gte: (field, value) => {
            query.rangeFilters.push({ field, value, operator: 'gte' });
            return builder;
          },
          lte: (field, value) => {
            query.rangeFilters.push({ field, value, operator: 'lte' });
            return builder;
          },
          in: (field, values) => {
            query.inFilters.push({ field, values });
            return builder;
          },
          order: (field, options) => {
            query.orderBy = { field, ascending: options?.ascending };
            return builder;
          },
          returns: () => builder,
          then: (onfulfilled, onrejected) => {
            queries.push(query);
            return Promise.resolve(resolveQuery(tables, query)).then(onfulfilled, onrejected);
          },
        };

        return builder;
      },
    } as unknown as SupabaseClient<Database>,
  };
}

function resolveQuery(tables: TableRows, query: QueryRecord): QueryResult {
  const rows = (tables[query.table] ?? [])
    .filter((row) => query.filters.every((filter) => row[filter.field] === filter.value))
    .filter((row) => query.inFilters.every((filter) => filter.values.includes(row[filter.field])))
    .filter((row) => query.rangeFilters.every((filter) => {
      const value = row[filter.field];
      if (typeof value !== 'string' || typeof filter.value !== 'string') return true;
      return filter.operator === 'gte'
        ? value >= filter.value
        : value <= filter.value;
    }));

  return {
    data: query.orderBy ? sortRows(rows, query.orderBy) : rows,
    error: null,
  };
}

function sortRows(
  rows: Row[],
  orderBy: { field: string; ascending?: boolean }
): Row[] {
  return [...rows].sort((left, right) => {
    const leftValue = String(left[orderBy.field] ?? '');
    const rightValue = String(right[orderBy.field] ?? '');
    return orderBy.ascending === false
      ? rightValue.localeCompare(leftValue)
      : leftValue.localeCompare(rightValue);
  });
}

function expectNoAutoSalesQuery(queries: QueryRecord[]): void {
  expect(queries.map((query) => query.table)).not.toContain('auto_sales');
}

describe('FinancialReportingService recognized vehicle sales reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads vehicle profit margins from recognition snapshots and preserves missing display rows', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicle_sale_recognitions: [
        recognitionRow({
          id: 'recognition-1',
          vehicle_id: 'vehicle-1',
          sale_price_recognized: '1500000000',
          cost_basis_at_sale: '1000000000',
          recognized_at: '2026-10-10T09:00:00.000Z',
          recognized_by_user_id: 'accountant-1',
        }),
        recognitionRow({
          id: 'recognition-2',
          vehicle_id: 'vehicle-missing-display',
          sale_price_recognized: 800000000,
          cost_basis_at_sale: 700000000,
          recognized_at: '2026-10-11T09:00:00.000Z',
          recognized_by_user_id: null,
        }),
        recognitionRow({
          id: 'recognition-other-tenant',
          tenant_id: 'tenant-b',
          vehicle_id: 'vehicle-b',
          sale_price_recognized: 2000000000,
          cost_basis_at_sale: 1200000000,
        }),
      ],
      auto_vehicle_sale_recognition_adjustments: [
        {
          tenant_id: 'tenant-a',
          recognition_id: 'recognition-1',
          sale_price_delta: '-100000000',
          cost_basis_delta: '50000000',
        },
        {
          tenant_id: 'tenant-b',
          recognition_id: 'recognition-other-tenant',
          sale_price_delta: 999999999,
          cost_basis_delta: 999999999,
        },
      ],
      auto_vehicles: [
        {
          id: 'vehicle-1',
          tenant_id: 'tenant-a',
          vin: 'VIN00000000000001',
          color_exterior: 'White',
          variant_id: 'variant-1',
          auto_variants: {
            name: 'Luxury',
            auto_models: { name: 'Series 3' },
          },
        },
      ],
    });
    jest.mocked(getPrimaryClient).mockReturnValue(client);

    const margins = await FinancialReportingService.getVehicleProfitMargins('tenant-a', {
      start: '2026-10-01',
      end: '2026-10-31',
    });

    expect(margins).toEqual([
      expect.objectContaining({
        saleId: 'recognition-2',
        vehicleId: 'vehicle-missing-display',
        vehicleMake: 'Unknown',
        vehicleModel: 'vehicle-missing-display',
        salePrice: 800000000,
        costPrice: 700000000,
        grossProfit: 100000000,
        salesperson: 'Unknown',
      }),
      expect.objectContaining({
        saleId: 'recognition-1',
        vehicleId: 'vehicle-1',
        vehicleMake: 'Series 3',
        vehicleModel: 'Luxury',
        salePrice: 1400000000,
        costPrice: 1050000000,
        grossProfit: 350000000,
        salesperson: 'accountant-1',
      }),
    ]);
    expect(queries[0]).toMatchObject({
      table: 'auto_vehicle_sale_recognitions',
      filters: [{ field: 'tenant_id', value: 'tenant-a' }],
      rangeFilters: [
        { field: 'recognized_at', value: '2026-10-01', operator: 'gte' },
        { field: 'recognized_at', value: '2026-10-31', operator: 'lte' },
      ],
    });
    expect(queries[1]).toMatchObject({
      table: 'auto_vehicle_sale_recognition_adjustments',
      filters: [{ field: 'tenant_id', value: 'tenant-a' }],
    });
    expect(queries[1]?.inFilters[0]).toMatchObject({ field: 'recognition_id' });
    expect(queries[1]?.inFilters[0]?.values).toEqual(expect.arrayContaining([
      'recognition-1',
      'recognition-2',
    ]));
    expect(queries[2]).toMatchObject({
      table: 'auto_vehicles',
      filters: [{ field: 'tenant_id', value: 'tenant-a' }],
    });
    expect(queries[2]?.inFilters[0]).toMatchObject({ field: 'id' });
    expect(queries[2]?.inFilters[0]?.values).toEqual(expect.arrayContaining([
      'vehicle-1',
      'vehicle-missing-display',
    ]));
    expectNoAutoSalesQuery(queries);
  });

  it('derives vehicle sales revenue and financial metrics from recognized sales only', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicle_sale_recognitions: [
        recognitionRow({
          id: 'recognition-1',
          vehicle_id: 'vehicle-1',
          sale_price_recognized: 1000000000,
          cost_basis_at_sale: 600000000,
        }),
        recognitionRow({
          id: 'recognition-2',
          vehicle_id: 'vehicle-2',
          sale_price_recognized: 500000000,
          cost_basis_at_sale: 400000000,
        }),
      ],
      auto_vehicle_sale_recognition_adjustments: [],
      auto_vehicles: [],
      auto_repair_orders: [],
      auto_loan_applications: [],
      auto_insurance_policies: [],
      auto_trade_in_appraisals: [],
      expenses: [{ tenant_id: 'tenant-a', status: 'approved', amount: 100000000 }],
    });
    jest.mocked(getPrimaryClient).mockReturnValue(client);

    const breakdown = await FinancialReportingService.getRevenueBreakdown('tenant-a');
    const metrics = await FinancialReportingService.getFinancialMetrics('tenant-a');

    expect(breakdown.vehicleSales).toBe(1500000000);
    expect(breakdown.totalRevenue).toBe(1500000000);
    expect(metrics.vehiclesSold).toBe(2);
    expect(metrics.totalCost).toBe(1000000000);
    expect(metrics.grossProfit).toBe(500000000);
    expect(metrics.averageVehiclePrice).toBe(750000000);
    expect(metrics.averageProfitPerVehicle).toBe(250000000);
    expectNoAutoSalesQuery(queries);
  });

  it('keeps vehicle sales commission excluded until a canonical commission source exists', async () => {
    const { client, queries } = makeSupabase({
      auto_loan_applications: [
        {
          tenant_id: 'tenant-a',
          status: 'approved',
          referral_commission_amount: 5000000,
          commission_paid: true,
        },
      ],
      auto_insurance_policies: [
        {
          tenant_id: 'tenant-a',
          status: 'active',
          referral_commission_amount: 2000000,
          commission_paid: false,
        },
      ],
    });
    jest.mocked(getPrimaryClient).mockReturnValue(client);

    const commission = await FinancialReportingService.getCommissionBreakdown('tenant-a');

    expect(commission.vehicleSalesCommission).toBe(0);
    expect(commission.loanReferralCommission).toBe(5000000);
    expect(commission.insuranceReferralCommission).toBe(2000000);
    expect(commission.totalCommission).toBe(7000000);
    expectNoAutoSalesQuery(queries);
  });
});

function recognitionRow(overrides: Partial<Row>): Row {
  return {
    id: 'recognition-default',
    tenant_id: 'tenant-a',
    vehicle_id: 'vehicle-default',
    sale_price_recognized: 0,
    cost_basis_at_sale: 0,
    recognized_at: '2026-10-10T09:00:00.000Z',
    recognized_by_user_id: null,
    ...overrides,
  };
}
