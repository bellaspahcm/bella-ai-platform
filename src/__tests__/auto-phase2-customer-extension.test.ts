import { describe, it, expect } from '@jest/globals';
import { AutoCustomerProvider } from '@/modules/bella-auto/services/AutoCustomerProvider';

type MockRow = Record<string, unknown>;
type MockDbState = Record<string, MockRow[]>;
type MockChain = {
  eq: (field: string, value: unknown) => MockChain;
  in: (field: string, values: unknown) => MockChain;
  returns: <T>() => MockChain;
  maybeSingle: () => Promise<{ data: MockRow | null; error: null }>;
  single: () => Promise<{ data: MockRow; error: null }>;
  then: (onfulfilled: (value: { data: MockRow[]; error: null; count: number | null }) => unknown) => Promise<unknown>;
};

// Mock SupabaseClient
function makeSupabaseMock(dbState: MockDbState) {
  const makeChain = (table: string) => {
    const chain: MockChain = {
      eq: () => chain,
      in: () => chain,
      returns: () => chain,
      maybeSingle: () => {
        const items = dbState[table] ?? [];
        return Promise.resolve({ data: items[0] ?? null, error: null });
      },
      single: () => {
        const items = dbState[table] ?? [];
        return Promise.resolve({ data: items[0] ?? { id: 'owner-new-id' }, error: null });
      },
      // Cho phép chain.then và giải quyết như Promise nếu select().eq() được gọi mà không có .maybeSingle() hay .single()
      then: (onfulfilled) => {
        const items = dbState[table] ?? [];
        return Promise.resolve({ data: items, error: null, count: items.length }).then(onfulfilled);
      },
    };

    return chain;
  };

  return {
    from: (table: string) => {
      const chain = makeChain(table);

      return {
        select: (_columns: string, options?: { count?: unknown }) => {
          if (options && options.count) {
            // Cho phép chuỗi eq() sau select(..., {count})
            return chain; 
          }
          if (table === 'auto_vehicle_owners') {
            return chain;
          }
          return chain;
        },
        upsert: (payload: MockRow, _options?: unknown) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push(payload);
          return Promise.resolve({ error: null });
        },
        insert: (payload: MockRow) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push({ id: 'owner-new-id', ...payload });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'owner-new-id' }, error: null })
            })
          };
        },
        update: (_payload: MockRow) => {
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null })
            })
          };
        }
      };
    }
  };
}

describe('Phase 2: Customer 360 Extension — Unit Tests', () => {

  it('should get customer automotive profile & owned vehicles', async () => {
    const dbState = {
      auto_customer_profiles: [
        {
          customer_id: 'cust-001',
          tenant_id: 'tenant-001',
          preferred_brands: ['BMW'],
          preferred_segments: ['SUV'],
          budget_range: '3B - 5B',
          purchasing_purpose: 'Family',
          total_vehicles_owned: 1,
          total_value_spent: 2439000000
        }
      ],
      auto_vehicle_owners: [
        {
          id: 'owner-record-1',
          tenant_id: 'tenant-001',
          customer_id: 'cust-001',
          ownership_type: 'primary',
          license_plate: '30K-999.99',
          registration_date: '2026-07-28',
          is_active: true,
          vehicle_id: 'veh-001',
        }
      ],
      auto_vehicles: [
        {
          id: 'veh-001',
          tenant_id: 'tenant-001',
          vin: 'WBAHF3C01L7D34567',
          color_exterior: 'White',
          model_year: 2026,
          variant_id: 'variant-001',
          list_price: 2439000000,
        }
      ],
      auto_variants: [
        {
          id: 'variant-001',
          tenant_id: 'tenant-001',
          name: 'Luxury Line',
          model_id: 'model-001',
        }
      ],
      auto_models: [
        {
          id: 'model-001',
          tenant_id: 'tenant-001',
          name: '3 Series',
          brand_id: 'brand-001',
        }
      ],
      auto_brands: [
        {
          id: 'brand-001',
          tenant_id: 'tenant-001',
          name: 'BMW',
        }
      ]
    };

    const supabase = makeSupabaseMock(dbState);
    const { profile, ownedVehicles } = await AutoCustomerProvider.getProfile(supabase, 'tenant-001', 'cust-001');

    expect(profile).not.toBeNull();
    expect(profile?.customerId).toBe('cust-001');
    expect(profile?.preferredBrands).toContain('BMW');
    expect(ownedVehicles.length).toBe(1);
    expect(ownedVehicles[0].vin).toBe('WBAHF3C01L7D34567');
    expect(ownedVehicles[0].licensePlate).toBe('30K-999.99');
  });

  it('should upsert automotive preference profile', async () => {
    const dbState: MockDbState = { auto_customer_profiles: [] };
    const supabase = makeSupabaseMock(dbState);

    await AutoCustomerProvider.upsertProfile(supabase, 'tenant-001', {
      customerId: 'cust-002',
      preferredBrands: ['Mercedes-Benz'],
      preferredSegments: ['Sedan'],
      budgetRange: '2B - 4B',
      purchasingPurpose: 'Business'
    });

    expect(dbState.auto_customer_profiles.length).toBe(1);
    expect(dbState.auto_customer_profiles[0].preferred_brands).toContain('Mercedes-Benz');
    expect(dbState.auto_customer_profiles[0].customer_id).toBe('cust-002');
  });

  it('should link customer to new owned vehicle', async () => {
    const dbState: MockDbState = { auto_vehicle_owners: [] };
    const supabase = makeSupabaseMock(dbState);

    const recordId = await AutoCustomerProvider.addVehicleOwner(supabase, {
      tenantId: 'tenant-001',
      customerId: 'cust-001',
      vehicleId: 'veh-999',
      ownershipType: 'primary',
      licensePlate: '51K-999.99',
      registrationDate: '2026-08-01'
    });

    expect(recordId).toBe('owner-new-id');
    expect(dbState.auto_vehicle_owners.length).toBe(1);
    expect(dbState.auto_vehicle_owners[0].vehicle_id).toBe('veh-999');
  });
});
