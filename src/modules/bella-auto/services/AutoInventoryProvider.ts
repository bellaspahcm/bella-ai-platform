/**
 * AutoInventoryProvider
 *
 * Provider chuyên biệt cho ngành ô tô. Cung cấp thống kê tồn kho xe
 * theo status, variant, và showroom. Tích hợp với VehicleStatusMachineService
 * để thực hiện nhập/xuất/điều chuyển xe.
 *
 * Kiến trúc: Provider-based, stateless. Read-side inventory/lifecycle access
 * đi qua Mobility OS public contract; write-side legacy paths được giữ nguyên
 * cho batch idempotency/write-semantics riêng.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getMobilityVehicleInventorySummary,
  listMobilityVehicleInventory,
  listMobilityVehicleStatusHistory,
} from '@/platform/mobility/supabase-vehicle-contract';
import {
  VehicleStatusMachineService,
  type VehicleStatus,
  type TransitionVehicleInput,
} from './VehicleStatusMachineService';

export interface VehicleInventorySummary {
  totalVehicles: number;
  byStatus: Record<VehicleStatus, number>;
  availableForSale: number; // warehouse + showroom
  allocated: number;
  inTransit: number;
  deliveredThisMonth: number;
}

export interface VehicleInventoryItem {
  id: string;
  vin: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  colorExterior: string;
  colorInterior: string | null;
  modelYear: number;
  listPrice: number;
  costPrice: number;
  status: VehicleStatus;
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

export interface AddVehicleInput {
  tenantId: string;
  variantId: string;
  vin: string;
  chassisNumber?: string;
  engineNumber?: string;
  colorExterior: string;
  colorInterior?: string;
  modelYear: number;
  listPrice: number;
  costPrice?: number;
  locationNote?: string;
  expectedArrivalDate?: string;
  importDeclarationNumber?: string;
  metadata?: Record<string, unknown>;
}

export const AutoInventoryProvider = {
  /**
   * Lấy tổng quan tồn kho của tenant.
   */
  async getSummary(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<VehicleInventorySummary> {
    return getMobilityVehicleInventorySummary(supabase, { tenantId });
  },

  /**
   * Danh sách xe có filter và join catalog.
   */
  async listVehicles(
    supabase: SupabaseClient,
    tenantId: string,
    filters?: {
      status?: VehicleStatus;
      variantId?: string;
      search?: string;
    }
  ): Promise<VehicleInventoryItem[]> {
    return listMobilityVehicleInventory(supabase, {
      tenantId,
      status: filters?.status,
      variantId: filters?.variantId,
      search: filters?.search,
    });
  },

  /**
   * Thêm xe mới vào kho (status khởi đầu = 'in_transit').
   */
  async addVehicle(
    supabase: SupabaseClient,
    input: AddVehicleInput
  ): Promise<{ id: string; vin: string }> {
    const { data, error } = await supabase
      .from('auto_vehicles')
      .insert({
        tenant_id:                input.tenantId,
        variant_id:               input.variantId,
        vin:                      input.vin.toUpperCase(),
        chassis_number:           input.chassisNumber ?? null,
        engine_number:            input.engineNumber ?? null,
        color_exterior:           input.colorExterior,
        color_interior:           input.colorInterior ?? null,
        model_year:               input.modelYear,
        list_price:               input.listPrice,
        cost_price:               input.costPrice ?? 0,
        status:                   'in_transit',
        location_note:            input.locationNote ?? null,
        expected_arrival_date:    input.expectedArrivalDate ?? null,
        import_declaration_number: input.importDeclarationNumber ?? null,
        metadata:                 input.metadata ?? {},
      })
      .select('id, vin')
      .single();

    if (error) throw new Error(`AutoInventoryProvider.addVehicle: ${error.message}`);
    return { id: data.id, vin: data.vin };
  },

  /**
   * Chuyển trạng thái xe — delegate sang VehicleStatusMachineService.
   */
  async transition(
    supabase: SupabaseClient,
    input: TransitionVehicleInput
  ) {
    return VehicleStatusMachineService.transition(supabase, input);
  },

  /**
   * Lấy lịch sử trạng thái của một xe.
   */
  async getStatusHistory(
    supabase: SupabaseClient,
    tenantId: string,
    vehicleId: string
  ) {
    const history = await listMobilityVehicleStatusHistory(supabase, { tenantId, vehicleId });
    return history.map((entry) => ({
      id: entry.id,
      from_status: entry.fromStatus ?? null,
      to_status: entry.toStatus,
      reason: entry.reason,
      created_at: entry.createdAt,
      changed_by_user_id: entry.changedByUserId,
    }));
  },
};
