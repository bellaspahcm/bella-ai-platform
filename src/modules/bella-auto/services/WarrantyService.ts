/**
 * Warranty Service
 * Manages warranty claims, validation, and approval workflow
 * 
 * @module bella-auto/services/WarrantyService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import {
  getMobilityVehicleIdentity,
  listMobilityVehicleDisplayByIds,
  type MobilityVehicleDisplay,
} from '@/platform/mobility/supabase-vehicle-contract';
import { Database } from '@/types/database.types';

type WarrantyClaim = Database['public']['Tables']['auto_warranty_claims']['Row'];
type WarrantyClaimInsert = Database['public']['Tables']['auto_warranty_claims']['Insert'];
type WarrantyClaimUpdate = Database['public']['Tables']['auto_warranty_claims']['Update'];

type RuntimeWarrantyClaimUpdate = WarrantyClaimUpdate & {
  actual_repair_cost?: number | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  completed_at?: string | null;
  completion_notes?: string | null;
  estimated_repair_cost?: number | null;
  inspection_completed_date?: string | null;
  inspection_findings?: string | null;
  inspection_notes?: string | null;
  inspection_photos?: string[] | null;
  inspection_scheduled_date?: string | null;
  inspector_assigned?: string | null;
};

type WarrantyClaimWithRuntimeCost = WarrantyClaim & {
  actual_repair_cost?: number | null;
};
type WarrantyClaimVehicleDisplay = {
  id: string;
  vin: string;
  color_exterior: string;
  variant_id: string;
  auto_variants: {
    name: string | null;
    auto_models: {
      name: string | null;
    } | null;
  } | null;
};
type WarrantyClaimListRow = WarrantyClaim & {
  customers?: unknown;
  auto_vehicles?: WarrantyClaimVehicleDisplay | null;
};

interface RuntimeMutation<Row> extends PromiseLike<{ data: Row | null; error: { message: string } | null }> {
  eq(column: string, value: unknown): RuntimeMutation<Row>;
  select(columns?: string): RuntimeSelection<Row>;
}

interface RuntimeSelection<Row> {
  single(): PromiseLike<{ data: Row; error: { message: string } | null }>;
}

interface RuntimeWarrantyTable {
  update(values: RuntimeWarrantyClaimUpdate): RuntimeMutation<WarrantyClaim>;
}

interface RuntimeWarrantyClient {
  from(table: 'auto_warranty_claims'): RuntimeWarrantyTable;
}

function runtimeWarrantyClient(client: unknown): RuntimeWarrantyClient {
  return client as RuntimeWarrantyClient;
}

interface RuntimeWarrantySaleQuery {
  eq(column: string, value: unknown): RuntimeWarrantySaleQuery;
  single(): PromiseLike<{ data: AutoSaleWarrantyInfo | null; error: { message: string } | null }>;
}

interface RuntimeWarrantySaleTable {
  select(columns: string): RuntimeWarrantySaleQuery;
}

interface RuntimeWarrantySaleClient {
  from(table: 'auto_sales'): RuntimeWarrantySaleTable;
}

function runtimeWarrantySaleClient(client: unknown): RuntimeWarrantySaleClient {
  return client as RuntimeWarrantySaleClient;
}

interface AutoSaleWarrantyInfo {
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  warranty_mileage_limit?: number | null;
  sale_date?: string | null;
}

export interface CreateWarrantyClaimData {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  repairOrderId?: string;
  claimType: string;
  failureDescription: string;
  failureDate: Date;
  mileageAtFailure: number;
  affectedParts?: Array<{ partName: string; partNumber?: string; quantity: number }>;
  customerComplaints?: string;
  submittedBy: string;
}

export interface WarrantyValidationResult {
  isValid: boolean;
  reason?: string;
  warrantyCoverage?: {
    type: string;
    startDate: string;
    endDate: string;
    mileageLimit?: number;
  };
}

export class WarrantyService {
  /**
   * Create a new warranty claim
   */
  static async createWarrantyClaim(
    data: CreateWarrantyClaimData
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    // Generate claim number
    const { data: claimNumber } = await supabase
      .rpc('generate_warranty_claim_number', { p_tenant_id: data.tenantId });

    if (!claimNumber) {
      throw new Error('Failed to generate warranty claim number');
    }

    // Validate warranty coverage
    const validation = await this.validateWarrantyCoverage(
      data.tenantId,
      data.vehicleId,
      data.failureDate,
      data.mileageAtFailure
    );

    if (!validation.isValid) {
      throw new Error(`Warranty validation failed: ${validation.reason}`);
    }

    const claimData: WarrantyClaimInsert = {
      tenant_id: data.tenantId,
      claim_number: claimNumber,
      customer_id: data.customerId,
      vehicle_id: data.vehicleId,
      repair_order_id: data.repairOrderId,
      claim_type: data.claimType,
      issue_description: data.failureDescription,
      failure_date: data.failureDate.toISOString().split('T')[0],
      failure_mileage: data.mileageAtFailure,
      parts_covered: data.affectedParts?.map((part) => ({
        partName: part.partName,
        ...(part.partNumber ? { partNumber: part.partNumber } : {}),
        quantity: part.quantity,
      })) ?? [],
      created_by: data.submittedBy,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
    };

    const { data: claim, error } = await supabase
      .from('auto_warranty_claims')
      .insert(claimData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create warranty claim: ${error.message}`);
    }

    return claim;
  }

  /**
   * Validate warranty coverage
   */
  static async validateWarrantyCoverage(
    tenantId: string,
    vehicleId: string,
    failureDate: Date,
    mileage: number
  ): Promise<WarrantyValidationResult> {
    const supabase = getPrimaryClient();

    const vehicle = await getMobilityVehicleIdentity(supabase, { tenantId, vehicleId });

    if (!vehicle) {
      return {
        isValid: false,
        reason: 'Vehicle not found or no sale record',
      };
    }

    const { data: sale, error: saleError } = await runtimeWarrantySaleClient(supabase)
      .from('auto_sales')
      .select('sale_date, warranty_start_date, warranty_end_date, warranty_mileage_limit')
      .eq('vehicle_id', vehicle.vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    if (saleError || !sale) {
      return {
        isValid: false,
        reason: 'Vehicle not found or no sale record',
      };
    }

    // Check if warranty exists
    if (!sale?.warranty_start_date || !sale?.warranty_end_date) {
      return {
        isValid: false,
        reason: 'No warranty information found for this vehicle',
      };
    }

    // Check date range
    const failureDateStr = failureDate.toISOString().split('T')[0];
    if (failureDateStr < sale.warranty_start_date || failureDateStr > sale.warranty_end_date) {
      return {
        isValid: false,
        reason: `Warranty expired. Coverage period: ${sale.warranty_start_date} to ${sale.warranty_end_date}`,
        warrantyCoverage: {
          type: 'Standard Warranty',
          startDate: sale.warranty_start_date,
          endDate: sale.warranty_end_date,
          mileageLimit: sale.warranty_mileage_limit ?? undefined,
        },
      };
    }

    // Check mileage limit
    if (sale.warranty_mileage_limit && mileage > sale.warranty_mileage_limit) {
      return {
        isValid: false,
        reason: `Mileage exceeds warranty limit (${sale.warranty_mileage_limit} km). Current: ${mileage} km`,
        warrantyCoverage: {
          type: 'Standard Warranty',
          startDate: sale.warranty_start_date,
          endDate: sale.warranty_end_date,
          mileageLimit: sale.warranty_mileage_limit ?? undefined,
        },
      };
    }

    return {
      isValid: true,
      warrantyCoverage: {
        type: 'Standard Warranty',
        startDate: sale.warranty_start_date,
        endDate: sale.warranty_end_date,
        mileageLimit: sale.warranty_mileage_limit ?? undefined,
      },
    };
  }

  /**
   * Review warranty claim (internal)
   */
  static async reviewClaim(
    claimId: string,
    tenantId: string,
    data: {
      reviewedBy: string;
      reviewNotes: string;
      decision: 'approved' | 'requires_inspection' | 'rejected';
    }
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const updateData: WarrantyClaimUpdate = {
      reviewed_by: data.reviewedBy,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: data.reviewNotes,
    };

    if (data.decision === 'approved') {
      updateData.status = 'approved';
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = data.reviewedBy;
    } else if (data.decision === 'requires_inspection') {
      updateData.status = 'under_review';
    } else {
      updateData.status = 'rejected';
      updateData.denial_reason = data.reviewNotes;
    }

    const { data: claim, error } = await runtimeWarrantyClient(supabase)
      .from('auto_warranty_claims')
      .update(updateData)
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to review claim: ${error.message}`);
    }

    // Notify customer
    await this.notifyCustomerOfDecision(claim);

    return claim;
  }

  /**
   * Schedule inspection for warranty claim
   */
  static async scheduleInspection(
    claimId: string,
    tenantId: string,
    data: {
      inspectorId: string;
      scheduledDate: Date;
      notes?: string;
    }
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const updateData: RuntimeWarrantyClaimUpdate = {
      status: 'inspection_scheduled',
      inspector_assigned: data.inspectorId,
      inspection_scheduled_date: data.scheduledDate.toISOString().split('T')[0],
      inspection_notes: data.notes,
    };

    const { data: claim, error } = await runtimeWarrantyClient(supabase)
      .from('auto_warranty_claims')
      .update(updateData)
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to schedule inspection: ${error.message}`);
    }

    return claim;
  }

  /**
   * Complete inspection
   */
  static async completeInspection(
    claimId: string,
    tenantId: string,
    data: {
      inspectorId: string;
      findings: string;
      recommendation: 'approve' | 'reject';
      estimatedRepairCost?: number;
      photos?: string[];
    }
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const updateData: RuntimeWarrantyClaimUpdate = {
      inspection_completed_date: new Date().toISOString().split('T')[0],
      inspection_findings: data.findings,
      inspection_photos: data.photos,
      estimated_repair_cost: data.estimatedRepairCost,
    };

    if (data.recommendation === 'approve') {
      updateData.status = 'approved';
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = data.inspectorId;
    } else {
      updateData.status = 'rejected';
      updateData.denial_reason = data.findings;
    }

    const { data: claim, error } = await runtimeWarrantyClient(supabase)
      .from('auto_warranty_claims')
      .update(updateData)
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete inspection: ${error.message}`);
    }

    await this.notifyCustomerOfDecision(claim);

    return claim;
  }

  /**
   * Link warranty claim to repair order
   */
  static async linkToRepairOrder(
    claimId: string,
    tenantId: string,
    repairOrderId: string
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const { data: claim, error } = await supabase
      .from('auto_warranty_claims')
      .update({
        repair_order_id: repairOrderId,
        status: 'repair_in_progress',
      })
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link to repair order: ${error.message}`);
    }

    // Update repair order to mark as warranty work
    await supabase
      .from('auto_repair_orders')
      .update({
        is_warranty_work: true,
        warranty_claim_id: claimId,
      })
      .eq('id', repairOrderId);

    return claim;
  }

  /**
   * Complete warranty claim (after repair)
   */
  static async completeClaim(
    claimId: string,
    tenantId: string,
    data: {
      actualRepairCost: number;
      completedBy: string;
      completionNotes?: string;
    }
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const updateData: RuntimeWarrantyClaimUpdate = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_repair_cost: data.actualRepairCost,
      completion_notes: data.completionNotes,
    };

    const { data: claim, error } = await runtimeWarrantyClient(supabase)
      .from('auto_warranty_claims')
      .update(updateData)
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete claim: ${error.message}`);
    }

    return claim;
  }

  /**
   * Cancel warranty claim
   */
  static async cancelClaim(
    claimId: string,
    tenantId: string,
    reason: string,
    cancelledBy: string
  ): Promise<WarrantyClaim> {
    const supabase = getPrimaryClient();

    const updateData: RuntimeWarrantyClaimUpdate = {
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
    };

    const { data: claim, error } = await runtimeWarrantyClient(supabase)
      .from('auto_warranty_claims')
      .update(updateData)
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel claim: ${error.message}`);
    }

    return claim;
  }

  /**
   * Get warranty claims by status
   */
  static async getClaimsByStatus(
    tenantId: string,
    status: string,
    limit?: number
  ): Promise<WarrantyClaim[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_warranty_claims')
      .select('*, customers(*)')
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .order('submitted_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get claims: ${error.message}`);
    }

    const claims: WarrantyClaimListRow[] = data || [];
    const vehicleIds = uniqueStrings(claims.map((claim) => claim.vehicle_id));
    const vehicles = await listMobilityVehicleDisplayByIds(supabase, { tenantId, vehicleIds });
    const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));

    return claims.map((claim) => ({
      ...claim,
      auto_vehicles: toWarrantyClaimVehicleDisplay(vehiclesById.get(claim.vehicle_id)),
    }));
  }

  /**
   * Get warranty claims for vehicle
   */
  static async getClaimsForVehicle(
    tenantId: string,
    vehicleId: string
  ): Promise<WarrantyClaim[]> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_warranty_claims')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get vehicle claims: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get warranty claim statistics
   */
  static async getWarrantyStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    approvalRate: number;
    averageRepairCost: number;
    totalWarrantyCost: number;
  }> {
    const supabase = getPrimaryClient();

    const { data: claims, error } = await supabase
      .from('auto_warranty_claims')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    if (!claims || claims.length === 0) {
      return {
        total: 0,
        byStatus: {},
        byType: {},
        approvalRate: 0,
        averageRepairCost: 0,
        totalWarrantyCost: 0,
      };
    }

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let approvedCount = 0;
    let totalCost = 0;
    let completedCount = 0;

    const claimRows: WarrantyClaimWithRuntimeCost[] = claims;

    for (const claim of claimRows) {
      if (claim.status) {
        byStatus[claim.status] = (byStatus[claim.status] || 0) + 1;
      }
      byType[claim.claim_type] = (byType[claim.claim_type] || 0) + 1;

      if (claim.status === 'approved' || claim.status === 'completed') {
        approvedCount++;
      }

      if (claim.actual_repair_cost) {
        totalCost += Number(claim.actual_repair_cost);
        completedCount++;
      }
    }

    const approvalRate = claims.length > 0 ? (approvedCount / claims.length) * 100 : 0;
    const averageRepairCost = completedCount > 0 ? totalCost / completedCount : 0;

    return {
      total: claims.length,
      byStatus,
      byType,
      approvalRate: Math.round(approvalRate * 10) / 10,
      averageRepairCost: Math.round(averageRepairCost),
      totalWarrantyCost: totalCost,
    };
  }

  /**
   * Notify customer of warranty decision
   */
  private static async notifyCustomerOfDecision(
    claim: WarrantyClaim
  ): Promise<void> {
    // TODO: Integrate with notification service
    console.log(`[Warranty] Notifying customer of decision: ${claim.claim_number} - ${claim.status}`);
  }

  /**
   * Get pending approvals (for dashboard)
   */
  static async getPendingApprovals(
    tenantId: string
  ): Promise<WarrantyClaim[]> {
    return this.getClaimsByStatus(tenantId, 'submitted');
  }

  /**
   * Get claims requiring inspection
   */
  static async getClaimsRequiringInspection(
    tenantId: string
  ): Promise<WarrantyClaim[]> {
    return this.getClaimsByStatus(tenantId, 'under_review');
  }
}

function toWarrantyClaimVehicleDisplay(
  vehicle: MobilityVehicleDisplay | undefined
): WarrantyClaimVehicleDisplay | null {
  if (!vehicle) return null;

  return {
    id: vehicle.vehicleId,
    vin: vehicle.vin,
    color_exterior: vehicle.colorExterior,
    variant_id: vehicle.variantId,
    auto_variants: {
      name: vehicle.variantName ?? null,
      auto_models: vehicle.modelName
        ? {
            name: vehicle.modelName,
          }
        : null,
    },
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
