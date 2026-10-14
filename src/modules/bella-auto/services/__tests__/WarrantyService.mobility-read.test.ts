import type { SupabaseClient } from '@supabase/supabase-js';

import { getPrimaryClient } from '@/lib/database/read-replica';
import type { Database } from '@/types/database.types';
import { WarrantyService } from '../WarrantyService';

jest.mock('@/lib/database/read-replica', () => ({
  getPrimaryClient: jest.fn(),
}));

type Row = Record<string, unknown>;
type TableRows = Record<string, Row[]>;
type QueryFilter = { field: string; value: unknown };
type QueryInFilter = { field: string; values: readonly unknown[] };
type QueryRecord = {
  table: string;
  selection?: string;
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  limitValue?: number;
};
type QueryResult = {
  data: Row[] | null;
  error: { message: string } | null;
};
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (selection: string) => QueryBuilder;
  eq: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, values: readonly unknown[]) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  order: () => QueryBuilder;
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
          in: (field, values) => {
            query.inFilters.push({ field, values });
            return builder;
          },
          limit: (value) => {
            query.limitValue = value;
            return builder;
          },
          order: () => builder,
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
    .filter((row) => query.inFilters.every((filter) => filter.values.includes(row[filter.field])));

  return {
    data: typeof query.limitValue === 'number' ? rows.slice(0, query.limitValue) : rows,
    error: null,
  };
}

function expectTenantScoped(queries: QueryRecord[], tenantId: string): void {
  for (const query of queries) {
    expect(query.filters).toContainEqual({ field: 'tenant_id', value: tenantId });
  }
}

describe('WarrantyService Mobility read contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enriches warranty claim vehicle display through Mobility without dropping missing vehicles', async () => {
    const { client, queries } = makeSupabase({
      auto_warranty_claims: [
        {
          id: 'claim-1',
          tenant_id: 'tenant-a',
          status: 'submitted',
          vehicle_id: 'vehicle-1',
          claim_number: 'WC-001',
        },
        {
          id: 'claim-2',
          tenant_id: 'tenant-a',
          status: 'submitted',
          vehicle_id: 'vehicle-2',
          claim_number: 'WC-002',
        },
        {
          id: 'claim-3',
          tenant_id: 'tenant-a',
          status: 'submitted',
          vehicle_id: 'vehicle-missing',
          claim_number: 'WC-003',
        },
        {
          id: 'claim-other-status',
          tenant_id: 'tenant-a',
          status: 'approved',
          vehicle_id: 'vehicle-1',
          claim_number: 'WC-004',
        },
        {
          id: 'claim-other-tenant',
          tenant_id: 'tenant-b',
          status: 'submitted',
          vehicle_id: 'vehicle-b',
          claim_number: 'WC-005',
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
        {
          id: 'vehicle-2',
          tenant_id: 'tenant-a',
          vin: 'VIN00000000000002',
          color_exterior: 'Black',
          variant_id: 'variant-2',
          auto_variants: {
            name: 'Sport',
            auto_models: { name: 'Series 5' },
          },
        },
        {
          id: 'vehicle-b',
          tenant_id: 'tenant-b',
          vin: 'VIN0000000000000B',
          color_exterior: 'Red',
          variant_id: 'variant-b',
          auto_variants: {
            name: 'Other',
            auto_models: { name: 'Other model' },
          },
        },
      ],
    });
    jest.mocked(getPrimaryClient).mockReturnValue(client);

    const result = await WarrantyService.getClaimsByStatus('tenant-a', 'submitted');
    const claims = result as Array<Row & { auto_vehicles: Row | null }>;

    expect(claims).toHaveLength(3);
    expect(claims[0]?.auto_vehicles).toMatchObject({
      id: 'vehicle-1',
      vin: 'VIN00000000000001',
      color_exterior: 'White',
      variant_id: 'variant-1',
      auto_variants: {
        name: 'Luxury',
        auto_models: { name: 'Series 3' },
      },
    });
    expect(claims[1]?.auto_vehicles).toMatchObject({
      id: 'vehicle-2',
      vin: 'VIN00000000000002',
      color_exterior: 'Black',
    });
    expect(claims[2]?.auto_vehicles).toBeNull();

    expect(queries[0]).toMatchObject({
      table: 'auto_warranty_claims',
      selection: '*, customers(*)',
      filters: [
        { field: 'tenant_id', value: 'tenant-a' },
        { field: 'status', value: 'submitted' },
      ],
    });
    expect(queries[0]?.selection).not.toContain('auto_vehicles');
    expect(queries[1]).toMatchObject({
      table: 'auto_vehicles',
      inFilters: [{ field: 'id', values: ['vehicle-1', 'vehicle-2', 'vehicle-missing'] }],
    });
    expectTenantScoped(queries, 'tenant-a');
  });

  it('preserves pending and inspection wrapper status semantics', async () => {
    const { client, queries } = makeSupabase({
      auto_warranty_claims: [],
      auto_vehicles: [],
    });
    jest.mocked(getPrimaryClient).mockReturnValue(client);

    await WarrantyService.getPendingApprovals('tenant-a');
    await WarrantyService.getClaimsRequiringInspection('tenant-a');

    const claimQueries = queries.filter((query) => query.table === 'auto_warranty_claims');
    expect(claimQueries[0]?.filters).toContainEqual({ field: 'status', value: 'submitted' });
    expect(claimQueries[1]?.filters).toContainEqual({ field: 'status', value: 'under_review' });
    expectTenantScoped(claimQueries, 'tenant-a');
  });
});
