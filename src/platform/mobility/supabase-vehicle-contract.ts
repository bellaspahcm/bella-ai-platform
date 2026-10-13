import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import {
  MOBILITY_AVAILABLE_FOR_SALE_STATUSES,
  type AvailableMobilityVehicle,
  type MobilityVehicleStatus,
} from './domain/types';

type MobilitySupabaseClient = SupabaseClient<Database>;
type AutoVehicleRow = Database['public']['Tables']['auto_vehicles']['Row'];
type AutoVehicleStatusLogRow = Database['public']['Tables']['auto_vehicle_status_logs']['Row'];
type AvailableVehicleRow = Pick<AutoVehicleRow, 'id' | 'vin' | 'color_exterior' | 'status'>;
type InventorySummaryRow = Pick<AutoVehicleRow, 'status' | 'delivered_at'>;
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
