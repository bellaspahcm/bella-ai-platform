import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import {
  getMobilityVehicleIdentity,
  getMobilityCustomerOwnershipAggregate,
  listMobilityVehicleDisplayByIds,
  listMobilityCustomerOwnedVehicles,
} from '../supabase-vehicle-contract';

type Row = Record<string, unknown>;
type TableRows = Record<string, Row[]>;
type QueryFilter = { field: string; value: unknown };
type QueryInFilter = { field: string; values: readonly unknown[] };
type QueryOptions = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };
type QueryRecord = {
  table: string;
  filters: QueryFilter[];
  inFilters: QueryInFilter[];
  selection?: string;
  options?: QueryOptions;
};
type QueryResult = {
  data: Row[] | null;
  error: { message: string } | null;
  count?: number | null;
};
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (selection: string, options?: QueryOptions) => QueryBuilder;
  eq: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, values: readonly unknown[]) => QueryBuilder;
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
          select: (selection, options) => {
            query.selection = selection;
            query.options = options;
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

  if (query.options?.head) {
    return { data: null, error: null, count: rows.length };
  }

  return { data: rows, error: null, count: rows.length };
}

function expectTenantScoped(queries: QueryRecord[], tenantId: string): void {
  for (const query of queries) {
    expect(query.filters).toContainEqual({ field: 'tenant_id', value: tenantId });
  }
}

describe('Mobility customer ownership Supabase contract', () => {
  it('returns tenant-scoped vehicle identity for warranty and workflow consumers', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicles: [
        { tenant_id: 'tenant-a', id: 'vehicle-1', vin: 'VIN00000000000001' },
        { tenant_id: 'tenant-b', id: 'vehicle-1', vin: 'VIN0000000000000B' },
      ],
    });

    const result = await getMobilityVehicleIdentity(client, {
      tenantId: 'tenant-a',
      vehicleId: 'vehicle-1',
    });

    expect(result).toEqual({
      vehicleId: 'vehicle-1',
      vin: 'VIN00000000000001',
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.table).toBe('auto_vehicles');
    expect(queries[0]?.filters).toEqual([
      { field: 'tenant_id', value: 'tenant-a' },
      { field: 'id', value: 'vehicle-1' },
    ]);
  });

  it('returns null when the tenant-scoped vehicle identity is absent', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicles: [
        { tenant_id: 'tenant-b', id: 'vehicle-1', vin: 'VIN0000000000000B' },
      ],
    });

    const result = await getMobilityVehicleIdentity(client, {
      tenantId: 'tenant-a',
      vehicleId: 'vehicle-1',
    });

    expect(result).toBeNull();
    expectTenantScoped(queries, 'tenant-a');
  });

  it('returns an empty booking vehicle display list without querying vehicles', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicles: [],
    });

    const result = await listMobilityVehicleDisplayByIds(client, {
      tenantId: 'tenant-a',
      vehicleIds: [],
    });

    expect(result).toEqual([]);
    expect(queries).toEqual([]);
  });

  it('maps booking vehicle display data through tenant-scoped Mobility reads', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicles: [
        {
          id: 'vehicle-1',
          tenant_id: 'tenant-a',
          vin: 'VIN00000000000001',
          color_exterior: 'White',
          variant_id: 'variant-1',
          auto_variants: {
            name: 'Luxury',
            auto_models: {
              name: 'Series 3',
            },
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
            auto_models: {
              name: 'Series 5',
            },
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
            auto_models: {
              name: 'Other model',
            },
          },
        },
      ],
    });

    const result = await listMobilityVehicleDisplayByIds(client, {
      tenantId: 'tenant-a',
      vehicleIds: ['vehicle-1', 'vehicle-2', 'vehicle-1'],
    });

    expect(result).toEqual([
      {
        vehicleId: 'vehicle-1',
        vin: 'VIN00000000000001',
        colorExterior: 'White',
        variantId: 'variant-1',
        variantName: 'Luxury',
        modelName: 'Series 3',
      },
      {
        vehicleId: 'vehicle-2',
        vin: 'VIN00000000000002',
        colorExterior: 'Black',
        variantId: 'variant-2',
        variantName: 'Sport',
        modelName: 'Series 5',
      },
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.table).toBe('auto_vehicles');
    expect(queries[0]?.inFilters).toEqual([{ field: 'id', values: ['vehicle-1', 'vehicle-2'] }]);
    expectTenantScoped(queries, 'tenant-a');
  });

  it('returns an empty ownership list without querying vehicle details', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicle_owners: [],
    });

    const result = await listMobilityCustomerOwnedVehicles(client, {
      tenantId: 'tenant-a',
      customerId: 'customer-a',
    });

    expect(result).toEqual([]);
    expect(queries.map((query) => query.table)).toEqual(['auto_vehicle_owners']);
    expectTenantScoped(queries, 'tenant-a');
  });

  it('maps multiple owned vehicles through tenant-scoped Mobility reads', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicle_owners: [
        {
          id: 'owner-1',
          tenant_id: 'tenant-a',
          customer_id: 'customer-a',
          vehicle_id: 'vehicle-1',
          ownership_type: 'primary',
          license_plate: '51A-001.01',
          registration_date: '2026-01-01',
          is_active: true,
          transferred_at: null,
        },
        {
          id: 'owner-2',
          tenant_id: 'tenant-a',
          customer_id: 'customer-a',
          vehicle_id: 'vehicle-2',
          ownership_type: 'user',
          license_plate: null,
          registration_date: null,
          is_active: false,
          transferred_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'owner-other-tenant',
          tenant_id: 'tenant-b',
          customer_id: 'customer-a',
          vehicle_id: 'vehicle-b',
          ownership_type: 'primary',
          license_plate: '51B-001.01',
          registration_date: '2026-01-01',
          is_active: true,
          transferred_at: null,
        },
      ],
      auto_vehicles: [
        {
          id: 'vehicle-1',
          tenant_id: 'tenant-a',
          vin: 'VIN00000000000001',
          color_exterior: 'White',
          model_year: 2026,
          variant_id: 'variant-1',
          created_at: '2026-01-15T00:00:00.000Z',
        },
        {
          id: 'vehicle-2',
          tenant_id: 'tenant-a',
          vin: 'VIN00000000000002',
          color_exterior: 'Black',
          model_year: 2025,
          variant_id: 'variant-2',
          created_at: '2026-02-15T00:00:00.000Z',
        },
        {
          id: 'vehicle-b',
          tenant_id: 'tenant-b',
          vin: 'VIN0000000000000B',
          color_exterior: 'Red',
          model_year: 2026,
          variant_id: 'variant-b',
          created_at: '2026-03-15T00:00:00.000Z',
        },
      ],
      auto_variants: [
        { id: 'variant-1', tenant_id: 'tenant-a', name: 'Luxury', model_id: 'model-1' },
        { id: 'variant-2', tenant_id: 'tenant-a', name: 'Sport', model_id: 'model-2' },
      ],
      auto_models: [
        { id: 'model-1', tenant_id: 'tenant-a', name: 'Series 3', brand_id: 'brand-1' },
        { id: 'model-2', tenant_id: 'tenant-a', name: 'Series 5', brand_id: 'brand-1' },
      ],
      auto_brands: [
        { id: 'brand-1', tenant_id: 'tenant-a', name: 'BMW' },
      ],
    });

    const result = await listMobilityCustomerOwnedVehicles(client, {
      tenantId: 'tenant-a',
      customerId: 'customer-a',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      ownerRecordId: 'owner-1',
      vehicleId: 'vehicle-1',
      vin: 'VIN00000000000001',
      createdAt: '2026-01-15T00:00:00.000Z',
      variantName: 'Luxury',
      modelName: 'Series 3',
      brandName: 'BMW',
      isActive: true,
    });
    expect(result[1]).toMatchObject({
      ownerRecordId: 'owner-2',
      vin: 'VIN00000000000002',
      ownershipType: 'user',
      isActive: false,
    });
    expectTenantScoped(queries, 'tenant-a');
  });

  it('preserves aggregate semantics by counting active ownership rows and summing list_price', async () => {
    const { client, queries } = makeSupabase({
      auto_vehicle_owners: [
        { tenant_id: 'tenant-a', customer_id: 'customer-a', vehicle_id: 'vehicle-1', is_active: true },
        { tenant_id: 'tenant-a', customer_id: 'customer-a', vehicle_id: 'vehicle-2', is_active: true },
        { tenant_id: 'tenant-a', customer_id: 'customer-a', vehicle_id: 'vehicle-3', is_active: false },
        { tenant_id: 'tenant-b', customer_id: 'customer-a', vehicle_id: 'vehicle-b', is_active: true },
      ],
      auto_vehicles: [
        { tenant_id: 'tenant-a', id: 'vehicle-1', list_price: 100 },
        { tenant_id: 'tenant-a', id: 'vehicle-2', list_price: 250 },
        { tenant_id: 'tenant-a', id: 'vehicle-3', list_price: 999 },
        { tenant_id: 'tenant-b', id: 'vehicle-b', list_price: 5000 },
      ],
    });

    const result = await getMobilityCustomerOwnershipAggregate(client, {
      tenantId: 'tenant-a',
      customerId: 'customer-a',
    });

    expect(result).toEqual({
      totalVehiclesOwned: 2,
      totalValueSpent: 350,
    });
    expectTenantScoped(queries, 'tenant-a');
  });
});
