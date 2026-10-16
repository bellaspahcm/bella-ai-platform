import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import {
  MOBILITY_AVAILABLE_FOR_SALE_STATUSES,
  type AvailableMobilityVehicle,
  type MobilityVehicleStatus,
} from './domain/types';

type MobilitySupabaseClient = SupabaseClient<Database>;
type AutoVehicleRow = Database['public']['Tables']['auto_vehicles']['Row'];
type AutoVehicleOwnerRow = Database['public']['Tables']['auto_vehicle_owners']['Row'];
type AutoVehicleStatusLogRow = Database['public']['Tables']['auto_vehicle_status_logs']['Row'];
type AutoVariantRow = Database['public']['Tables']['auto_variants']['Row'];
type AutoModelRow = Database['public']['Tables']['auto_models']['Row'];
type AutoBrandRow = Database['public']['Tables']['auto_brands']['Row'];
type AvailableVehicleRow = Pick<AutoVehicleRow, 'id' | 'vin' | 'color_exterior' | 'status'>;
type InventorySummaryRow = Pick<AutoVehicleRow, 'status' | 'delivered_at'>;
type VehicleIdentityRow = Pick<AutoVehicleRow, 'id' | 'vin'>;
type VehicleDisplayRow = Pick<AutoVehicleRow, 'id' | 'vin' | 'color_exterior' | 'variant_id'> & {
  auto_variants: {
    name: string | null;
    auto_models: {
      name: string | null;
    } | null;
  } | null;
};
type CustomerVehicleOwnerRow = Pick<
  AutoVehicleOwnerRow,
  | 'id'
  | 'vehicle_id'
  | 'ownership_type'
  | 'license_plate'
  | 'registration_date'
  | 'is_active'
  | 'transferred_at'
>;
type CustomerOwnedVehicleRow = Pick<
  AutoVehicleRow,
  'id' | 'vin' | 'color_exterior' | 'model_year' | 'variant_id' | 'created_at'
>;
type CustomerOwnedVehiclePriceRow = Pick<AutoVehicleRow, 'list_price'>;
type CustomerVehicleVariantRow = Pick<AutoVariantRow, 'id' | 'name' | 'model_id'>;
type CustomerVehicleModelRow = Pick<AutoModelRow, 'id' | 'name' | 'brand_id'>;
type CustomerVehicleBrandRow = Pick<AutoBrandRow, 'id' | 'name'>;
type InventoryVehicleRow = Pick<
  AutoVehicleRow,
  | 'id'
  | 'vin'
  | 'chassis_number'
  | 'engine_number'
  | 'color_exterior'
  | 'color_interior'
  | 'model_year'
  | 'list_price'
  | 'cost_price'
  | 'status'
  | 'location_note'
  | 'expected_arrival_date'
  | 'actual_arrival_date'
  | 'variant_id'
  | 'created_at'
  | 'updated_at'
> & {
  auto_variants: {
    name: string | null;
    auto_models: {
      name: string | null;
      auto_brands: {
        name: string | null;
      } | null;
    } | null;
  } | null;
};
type StatusHistoryRow = Pick<
  AutoVehicleStatusLogRow,
  'id' | 'from_status' | 'to_status' | 'reason' | 'created_at' | 'changed_by_user_id'
>;

export interface MobilityVehicleInventorySummary {
  totalVehicles: number;
  byStatus: Record<MobilityVehicleStatus, number>;
  availableForSale: number;
  allocated: number;
  inTransit: number;
  deliveredThisMonth: number;
}

export interface MobilityVehicleInventoryItem {
  id: string;
  vin: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  colorExterior: string;
  colorInterior: string | null;
  modelYear: number;
  listPrice: number;
  costPrice: number;
  status: MobilityVehicleStatus;
  locationNote: string | null;
  expectedArrivalDate: string | null;
  actualArrivalDate: string | null;
  variantId: string;
  variantName?: string;
  modelName?: string;
  brandName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MobilityVehicleInventoryPage {
  vehicles: MobilityVehicleInventoryItem[];
  totalCount: number;
}

export interface MobilityVehicleStatusHistoryEntry {
  id: string;
  fromStatus?: MobilityVehicleStatus;
  toStatus: MobilityVehicleStatus;
  reason: string | null;
  createdAt: string;
  changedByUserId: string | null;
}

export interface MobilityVehicleIdentity {
  vehicleId: string;
  vin: string;
}

export interface MobilityVehicleDisplay {
  vehicleId: string;
  vin: string;
  colorExterior: string;
  variantId: string;
  variantName?: string;
  modelName?: string;
}

export interface MobilityCustomerOwnedVehicle {
  ownerRecordId: string;
  vehicleId: string;
  vin: string;
  colorExterior: string;
  modelYear: number;
  createdAt: string;
  variantName?: string;
  modelName?: string;
  brandName?: string;
  ownershipType: string;
  licensePlate: string | null;
  registrationDate: string | null;
  isActive: boolean;
  transferredAt: string | null;
}

export interface MobilityCustomerOwnershipAggregate {
  totalVehiclesOwned: number;
  totalValueSpent: number;
}

const EMPTY_STATUS_COUNTS: Record<MobilityVehicleStatus, number> = {
  in_transit: 0,
  warehouse: 0,
  showroom: 0,
  allocated: 0,
  delivered: 0,
  returned: 0,
  scrapped: 0,
};

export async function listAvailableVehiclesForVariant(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    variantId: string;
    colorExterior?: string;
  }
): Promise<AvailableMobilityVehicle[]> {
  let query = supabase
    .from('auto_vehicles')
    .select('id, vin, color_exterior, status')
    .eq('tenant_id', input.tenantId)
    .eq('variant_id', input.variantId)
    .in('status', [...MOBILITY_AVAILABLE_FOR_SALE_STATUSES]);

  if (input.colorExterior) {
    query = query.eq('color_exterior', input.colorExterior);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .returns<AvailableVehicleRow[]>();

  if (error) {
    throw new Error(`Mobility.listAvailableVehiclesForVariant: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    vin: row.vin,
    colorExterior: row.color_exterior,
    status: row.status,
  }));
}

export async function getMobilityVehicleInventorySummary(
  supabase: MobilitySupabaseClient,
  input: { tenantId: string }
): Promise<MobilityVehicleInventorySummary> {
  const { data, error } = await supabase
    .from('auto_vehicles')
    .select('status, delivered_at')
    .eq('tenant_id', input.tenantId)
    .returns<InventorySummaryRow[]>();

  if (error) {
    throw new Error(`Mobility.getVehicleInventorySummary: ${error.message}`);
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const byStatus = { ...EMPTY_STATUS_COUNTS };
  let deliveredThisMonth = 0;

  for (const row of data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.status === 'delivered' && row.delivered_at && row.delivered_at >= startOfMonth) {
      deliveredThisMonth++;
    }
  }

  return {
    totalVehicles: (data ?? []).length,
    byStatus,
    availableForSale: byStatus.warehouse + byStatus.showroom,
    allocated: byStatus.allocated,
    inTransit: byStatus.in_transit,
    deliveredThisMonth,
  };
}

export async function listMobilityVehicleInventory(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    status?: MobilityVehicleStatus;
    variantId?: string;
    search?: string;
  }
): Promise<MobilityVehicleInventoryItem[]> {
  let query = supabase
    .from('auto_vehicles')
    .select(`
      id, vin, chassis_number, engine_number,
      color_exterior, color_interior, model_year,
      list_price, cost_price, status, location_note,
      expected_arrival_date, actual_arrival_date,
      variant_id, created_at, updated_at,
      auto_variants!inner(name, model_id,
        auto_models!inner(name, brand_id,
          auto_brands!inner(name)
        )
      )
    `)
    .eq('tenant_id', input.tenantId)
    .order('created_at', { ascending: false });

  if (input.status) query = query.eq('status', input.status);
  if (input.variantId) query = query.eq('variant_id', input.variantId);
  if (input.search) {
    query = query.or(`vin.ilike.%${input.search}%,color_exterior.ilike.%${input.search}%`);
  }

  const { data, error } = await query.returns<InventoryVehicleRow[]>();
  if (error) {
    throw new Error(`Mobility.listVehicleInventory: ${error.message}`);
  }

  return (data ?? []).map(mapInventoryVehicle);
}

export async function listMobilityVehicleInventoryPage(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    status?: MobilityVehicleStatus;
    search?: string;
    page: number;
    pageSize: number;
  }
): Promise<MobilityVehicleInventoryPage> {
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, input.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('auto_vehicles')
    .select(`
      id, vin, chassis_number, engine_number,
      color_exterior, color_interior, model_year,
      list_price, cost_price, status, location_note,
      expected_arrival_date, actual_arrival_date,
      variant_id, created_at, updated_at,
      auto_variants!inner(name, model_id,
        auto_models!inner(name, brand_id,
          auto_brands!inner(name)
        )
      )
    `, { count: 'planned' })
    .eq('tenant_id', input.tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (input.status) {
    query = query.eq('status', input.status);
  }

  if (input.search) {
    query = query.or(`vin.ilike.%${input.search}%,location_note.ilike.%${input.search}%`);
  }

  const { data, error, count } = await query.returns<InventoryVehicleRow[]>();
  if (error) {
    throw new Error(`Mobility.listVehicleInventoryPage: ${error.message}`);
  }

  return {
    vehicles: (data ?? []).map(mapInventoryVehicle),
    totalCount: count ?? (data ?? []).length,
  };
}

export async function listMobilityVehicleStatusHistory(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    vehicleId: string;
  }
): Promise<MobilityVehicleStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('auto_vehicle_status_logs')
    .select('id, from_status, to_status, reason, created_at, changed_by_user_id')
    .eq('tenant_id', input.tenantId)
    .eq('vehicle_id', input.vehicleId)
    .order('created_at', { ascending: true })
    .returns<StatusHistoryRow[]>();

  if (error) {
    throw new Error(`Mobility.listVehicleStatusHistory: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    reason: row.reason,
    createdAt: row.created_at,
    changedByUserId: row.changed_by_user_id,
  }));
}

export async function getMobilityVehicleIdentity(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    vehicleId: string;
  }
): Promise<MobilityVehicleIdentity | null> {
  const { data, error } = await supabase
    .from('auto_vehicles')
    .select('id, vin')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.vehicleId)
    .returns<VehicleIdentityRow[]>();

  if (error) {
    throw new Error(`Mobility.getVehicleIdentity: ${error.message}`);
  }

  const row = (data ?? [])[0];
  if (!row) return null;

  return {
    vehicleId: row.id,
    vin: row.vin,
  };
}

export async function listMobilityVehicleDisplayByIds(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    vehicleIds: readonly string[];
  }
): Promise<MobilityVehicleDisplay[]> {
  const vehicleIds = unique([...input.vehicleIds]);
  if (vehicleIds.length === 0) return [];

  const { data, error } = await supabase
    .from('auto_vehicles')
    .select(`
      id, vin, color_exterior, variant_id,
      auto_variants!inner(name,
        auto_models!inner(name)
      )
    `)
    .eq('tenant_id', input.tenantId)
    .in('id', vehicleIds)
    .returns<VehicleDisplayRow[]>();

  if (error) {
    throw new Error(`Mobility.listVehicleDisplayByIds: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    vehicleId: row.id,
    vin: row.vin,
    colorExterior: row.color_exterior,
    variantId: row.variant_id,
    variantName: row.auto_variants?.name ?? undefined,
    modelName: row.auto_variants?.auto_models?.name ?? undefined,
  }));
}

export async function listMobilityCustomerOwnedVehicles(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    customerId: string;
  }
): Promise<MobilityCustomerOwnedVehicle[]> {
  const { data: ownersData, error: ownersError } = await supabase
    .from('auto_vehicle_owners')
    .select('id, vehicle_id, ownership_type, license_plate, registration_date, is_active, transferred_at')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .returns<CustomerVehicleOwnerRow[]>();

  if (ownersError) {
    throw new Error(`Mobility.listCustomerOwnedVehicles: ${ownersError.message}`);
  }

  const vehicleIds = unique((ownersData ?? []).map((row) => row.vehicle_id));
  const { data: vehiclesData, error: vehiclesError } = vehicleIds.length > 0
    ? await supabase
      .from('auto_vehicles')
      .select('id, vin, color_exterior, model_year, variant_id, created_at')
      .eq('tenant_id', input.tenantId)
      .in('id', vehicleIds)
      .returns<CustomerOwnedVehicleRow[]>()
    : { data: [] as CustomerOwnedVehicleRow[], error: null };

  if (vehiclesError) {
    throw new Error(`Mobility.listCustomerOwnedVehicles: ${vehiclesError.message}`);
  }

  const variantIds = unique((vehiclesData ?? []).map((row) => row.variant_id));
  const { data: variantsData, error: variantsError } = variantIds.length > 0
    ? await supabase
      .from('auto_variants')
      .select('id, name, model_id')
      .eq('tenant_id', input.tenantId)
      .in('id', variantIds)
      .returns<CustomerVehicleVariantRow[]>()
    : { data: [] as CustomerVehicleVariantRow[], error: null };

  if (variantsError) {
    throw new Error(`Mobility.listCustomerOwnedVehicles: ${variantsError.message}`);
  }

  const modelIds = unique((variantsData ?? []).map((row) => row.model_id));
  const { data: modelsData, error: modelsError } = modelIds.length > 0
    ? await supabase
      .from('auto_models')
      .select('id, name, brand_id')
      .eq('tenant_id', input.tenantId)
      .in('id', modelIds)
      .returns<CustomerVehicleModelRow[]>()
    : { data: [] as CustomerVehicleModelRow[], error: null };

  if (modelsError) {
    throw new Error(`Mobility.listCustomerOwnedVehicles: ${modelsError.message}`);
  }

  const brandIds = unique((modelsData ?? []).map((row) => row.brand_id));
  const { data: brandsData, error: brandsError } = brandIds.length > 0
    ? await supabase
      .from('auto_brands')
      .select('id, name')
      .eq('tenant_id', input.tenantId)
      .in('id', brandIds)
      .returns<CustomerVehicleBrandRow[]>()
    : { data: [] as CustomerVehicleBrandRow[], error: null };

  if (brandsError) {
    throw new Error(`Mobility.listCustomerOwnedVehicles: ${brandsError.message}`);
  }

  const vehiclesById = new Map((vehiclesData ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const variantsById = new Map((variantsData ?? []).map((variant) => [variant.id, variant]));
  const modelsById = new Map((modelsData ?? []).map((model) => [model.id, model]));
  const brandsById = new Map((brandsData ?? []).map((brand) => [brand.id, brand]));

  return (ownersData ?? []).flatMap((owner) => {
    const vehicle = vehiclesById.get(owner.vehicle_id);
    if (!vehicle) return [];

    const variant = variantsById.get(vehicle.variant_id);
    const model = variant ? modelsById.get(variant.model_id) : undefined;
    const brand = model ? brandsById.get(model.brand_id) : undefined;

    return [{
      ownerRecordId: owner.id,
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      colorExterior: vehicle.color_exterior,
      modelYear: vehicle.model_year,
      createdAt: vehicle.created_at,
      variantName: variant?.name,
      modelName: model?.name,
      brandName: brand?.name,
      ownershipType: owner.ownership_type,
      licensePlate: owner.license_plate,
      registrationDate: owner.registration_date,
      isActive: owner.is_active,
      transferredAt: owner.transferred_at,
    }];
  });
}

export async function getMobilityCustomerOwnershipAggregate(
  supabase: MobilitySupabaseClient,
  input: {
    tenantId: string;
    customerId: string;
  }
): Promise<MobilityCustomerOwnershipAggregate> {
  const { count, error: countError } = await supabase
    .from('auto_vehicle_owners')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .eq('is_active', true);

  if (countError) {
    throw new Error(`Mobility.getCustomerOwnershipAggregate: ${countError.message}`);
  }

  const { data: activeOwners, error: activeOwnersError } = await supabase
    .from('auto_vehicle_owners')
    .select('vehicle_id')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .eq('is_active', true)
    .returns<Pick<AutoVehicleOwnerRow, 'vehicle_id'>[]>();

  if (activeOwnersError) {
    throw new Error(`Mobility.getCustomerOwnershipAggregate: ${activeOwnersError.message}`);
  }

  const activeVehicleIds = unique((activeOwners ?? []).map((row) => row.vehicle_id));
  const { data: priceData, error: priceError } = activeVehicleIds.length > 0
    ? await supabase
      .from('auto_vehicles')
      .select('list_price')
      .eq('tenant_id', input.tenantId)
      .in('id', activeVehicleIds)
      .returns<CustomerOwnedVehiclePriceRow[]>()
    : { data: [] as CustomerOwnedVehiclePriceRow[], error: null };

  if (priceError) {
    throw new Error(`Mobility.getCustomerOwnershipAggregate: ${priceError.message}`);
  }

  return {
    totalVehiclesOwned: count ?? 0,
    totalValueSpent: (priceData ?? []).reduce((total, row) => total + Number(row.list_price), 0),
  };
}

function mapInventoryVehicle(row: InventoryVehicleRow): MobilityVehicleInventoryItem {
  return {
    id: row.id,
    vin: row.vin,
    chassisNumber: row.chassis_number,
    engineNumber: row.engine_number,
    colorExterior: row.color_exterior,
    colorInterior: row.color_interior,
    modelYear: row.model_year,
    listPrice: Number(row.list_price),
    costPrice: Number(row.cost_price),
    status: row.status,
    locationNote: row.location_note,
    expectedArrivalDate: row.expected_arrival_date,
    actualArrivalDate: row.actual_arrival_date,
    variantId: row.variant_id,
    variantName: row.auto_variants?.name ?? undefined,
    modelName: row.auto_variants?.auto_models?.name ?? undefined,
    brandName: row.auto_variants?.auto_models?.auto_brands?.name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
