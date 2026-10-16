/**
 * AutoCustomerProvider
 *
 * Provider thực hiện việc đọc, tổng hợp hồ sơ mở rộng (Customer 360) 
 * phục vụ cho ngành công nghiệp Automotive.
 * Cho phép thiết lập thông tin sở thích, quản lý xe đang sở hữu và lịch sử sở hữu.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import {
  getMobilityCustomerOwnershipAggregate,
  listMobilityCustomerOwnedVehicles,
} from '@/platform/mobility/supabase-vehicle-contract';

export interface AutoCustomerProfile {
  customerId: string;
  preferredBrands: string[];
  preferredSegments: string[];
  budgetRange: string | null;
  purchasingPurpose: string | null;
  totalVehiclesOwned: number;
  totalValueSpent: number;
  metadata?: Json;
}

export interface OwnedVehicle {
  ownerRecordId: string;
  vehicleId: string;
  vin: string;
  colorExterior: string;
  modelYear: number;
  variantName?: string;
  modelName?: string;
  brandName?: string;
  ownershipType: string;
  licensePlate: string | null;
  registrationDate: string | null;
  isActive: boolean;
  transferredAt: string | null;
}

export const AutoCustomerProvider = {
  async listCustomers(supabase: SupabaseClient<Database>, tenantId: string, search = '', page = 1) {
    let query = supabase.from('customers').select('id,name_mother,phone,address', { count: 'exact' }).eq('tenant_id', tenantId);
    if (search) query = query.ilike(/^\+?[\d\s-]+$/.test(search) ? 'phone' : 'name_mother', `%${search}%`);
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 50, page * 50 - 1);
    if (error) throw error;
    return { customers: data ?? [], count: count ?? 0, page, pageSize: 50 };
  },
  /**
   * Lấy hồ sơ 360 độ mở rộng của Khách hàng, bao gồm sở thích và danh sách xe sở hữu.
   */
  async getProfile(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    customerId: string
  ): Promise<{ profile: AutoCustomerProfile | null; ownedVehicles: OwnedVehicle[] }> {
    
    // 1. Đọc profile mở rộng
    const { data: profileData, error: profileErr } = await supabase
      .from('auto_customer_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`AutoCustomerProvider.getProfile: ${profileErr.message}`);
    }

    const ownedVehicles = await listMobilityCustomerOwnedVehicles(supabase, {
      tenantId,
      customerId,
    });

    const profile: AutoCustomerProfile | null = profileData ? {
      customerId:         profileData.customer_id,
      preferredBrands:    profileData.preferred_brands ?? [],
      preferredSegments:  profileData.preferred_segments ?? [],
      budgetRange:        profileData.budget_range,
      purchasingPurpose:  profileData.purchasing_purpose,
      totalVehiclesOwned: profileData.total_vehicles_owned,
      totalValueSpent:    Number(profileData.total_value_spent),
      metadata:           profileData.metadata,
    } : null;

    return { profile, ownedVehicles };
  },

  /**
   * Lưu hoặc Cập nhật profile Automotive của Khách hàng
   */
  async upsertProfile(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    profile: Omit<AutoCustomerProfile, 'totalVehiclesOwned' | 'totalValueSpent'>
  ): Promise<void> {
    const { error } = await supabase
      .from('auto_customer_profiles')
      .upsert({
        tenant_id:          tenantId,
        customer_id:        profile.customerId,
        preferred_brands:   profile.preferredBrands,
        preferred_segments: profile.preferredSegments,
        budget_range:       profile.budgetRange,
        purchasing_purpose: profile.purchasingPurpose,
        ...(profile.metadata === undefined ? {} : { metadata: profile.metadata ?? {} }),
        updated_at:         new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,customer_id'
      });

    if (error) {
      throw new Error(`AutoCustomerProvider.upsertProfile: ${error.message}`);
    }
  },

  /**
   * Thêm quyền sở hữu xe cho khách hàng (Liên kết khách hàng - xe)
   */
  async addVehicleOwner(
    supabase: SupabaseClient<Database>,
    input: {
      tenantId: string;
      customerId: string;
      vehicleId: string;
      ownershipType?: string;
      licensePlate?: string;
      registrationDate?: string;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('auto_vehicle_owners')
      .insert({
        tenant_id:         input.tenantId,
        customer_id:       input.customerId,
        vehicle_id:        input.vehicleId,
        ownership_type:    input.ownershipType ?? 'primary',
        license_plate:     input.licensePlate ?? null,
        registration_date: input.registrationDate ?? null,
        is_active:         true,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`AutoCustomerProvider.addVehicleOwner: ${error.message}`);
    }

    // Trigger cập nhật thống kê hồ sơ khách hàng
    await this.recalculateProfileAggregates(supabase, input.tenantId, input.customerId);

    return data.id;
  },

  /**
   * Chuyển nhượng sở hữu xe (đánh dấu sở hữu không còn hoạt động nữa)
   */
  async transferOwnership(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    ownerRecordId: string,
    notes?: string
  ): Promise<void> {
    // Tìm thông tin sở hữu cũ
    const { data: record, error: findErr } = await supabase
      .from('auto_vehicle_owners')
      .select('customer_id')
      .eq('id', ownerRecordId)
      .eq('tenant_id', tenantId)
      .single();

    if (findErr || !record) {
      throw new Error(`AutoCustomerProvider.transferOwnership: Không tìm thấy bản ghi sở hữu.`);
    }

    const { error } = await supabase
      .from('auto_vehicle_owners')
      .update({
        is_active:      false,
        transferred_at: new Date().toISOString(),
        transfer_notes: notes ?? 'Đã chuyển nhượng',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', ownerRecordId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`AutoCustomerProvider.transferOwnership: ${error.message}`);
    }

    // Tính lại aggregates cho khách hàng cũ
    await this.recalculateProfileAggregates(supabase, tenantId, record.customer_id);
  },

  /**
   * Tự động tính toán lại aggregates trong auto_customer_profiles (Atomic helper)
   */
  async recalculateProfileAggregates(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    customerId: string
  ): Promise<void> {
    let aggregate;
    try {
      aggregate = await getMobilityCustomerOwnershipAggregate(supabase, {
        tenantId,
        customerId,
      });
    } catch {
      return;
    }

    await supabase
      .from('auto_customer_profiles')
      .upsert({
        tenant_id:             tenantId,
        customer_id:           customerId,
        total_vehicles_owned:  aggregate.totalVehiclesOwned,
        total_value_spent:     aggregate.totalValueSpent,
        updated_at:            new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,customer_id'
      });
  }
};
