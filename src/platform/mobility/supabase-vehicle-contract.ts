import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';
import {
  MOBILITY_AVAILABLE_FOR_SALE_STATUSES,
  type AvailableMobilityVehicle,
} from './domain/types';

type MobilitySupabaseClient = SupabaseClient<Database>;
type AutoVehicleRow = Database['public']['Tables']['auto_vehicles']['Row'];
type AvailableVehicleRow = Pick<AutoVehicleRow, 'id' | 'vin' | 'color_exterior' | 'status'>;

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
