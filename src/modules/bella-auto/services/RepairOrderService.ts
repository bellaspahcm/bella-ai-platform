/**
 * Repair Order Service
 * Manages repair orders, job cards, work assignment, and parts/labor tracking
 * 
 * @module bella-auto/services/RepairOrderService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type RepairOrder = Database['public']['Tables']['auto_repair_orders']['Row'];
type RepairOrderInsert = Database['public']['Tables']['auto_repair_orders']['Insert'];
type RepairOrderUpdate = Database['public']['Tables']['auto_repair_orders']['Update'];
type RepairOrderItem = Database['public']['Tables']['auto_repair_order_items']['Row'];
type RepairOrderItemInsert = Database['public']['Tables']['auto_repair_order_items']['Insert'];

export interface CreateRepairOrderData {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  appointmentId?: string;
  orderType: string;
  workDescription: string;
  customerComplaints?: Array<{ complaint: string; severity: string }>;
  mileageIn: number;
  fuelLevel?: string;
  vehicleConditionNotes?: string;
  serviceAdvisorId?: string;
}

export interface RepairOrderLineItem {
  itemType: 'service' | 'part' | 'labor';
  itemCode?: string;
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  laborHours?: number;
  hourlyRate?: number;
  partNumber?: string;
  inventoryItemId?: string;
  isWarrantyCovered?: boolean;
}

export class RepairOrderService {
  /**
   * Create a new repair order
   */
  static async createRepairOrder(
    data: CreateRepairOrderData
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    // Generate order number
    const { data: orderNumber } = await supabase
      .rpc('generate_repair_order_number', { p_tenant_id: data.tenantId });

    if (!orderNumber) {
      throw new Error('Failed to generate repair order number');
    }

    const [
      { data: customer, error: customerError },
      { data: vehicle, error: vehicleError },
    ] = await Promise.all([
      supabase
        .from('customers')
        .select('name_mother, phone')
        .eq('id', data.customerId)
        .eq('tenant_id', data.tenantId)
        .single(),
      supabase
        .from('auto_vehicles')
        .select('model_year, color_exterior, vin')
        .eq('id', data.vehicleId)
        .eq('tenant_id', data.tenantId)
        .single(),
    ]);

    if (customerError || !customer) {
      throw new Error('Customer not found for repair order');
    }
    if (vehicleError || !vehicle) {
      throw new Error('Vehicle not found for repair order');
    }

    const vehicleInfo = [
      vehicle.model_year,
      vehicle.color_exterior,
      vehicle.vin,
    ].filter((part) => part !== null && part !== undefined && part !== '').join(' - ');

    const orderData: RepairOrderInsert = {
      tenant_id: data.tenantId,
      order_number: orderNumber,
      customer_id: data.customerId,
      customer_name: customer.name_mother,
      customer_phone: customer.phone,
      vehicle_id: data.vehicleId,
      vehicle_info: vehicleInfo,
      appointment_id: data.appointmentId,
      order_type: data.orderType,
      work_description: data.workDescription,
      customer_complaints: data.customerComplaints as RepairOrderInsert['customer_complaints'],
      mileage_in: data.mileageIn,
      fuel_level: data.fuelLevel,
      vehicle_condition_notes: data.vehicleConditionNotes,
      service_advisor_id: data.serviceAdvisorId,
      status: 'open',
      opened_at: new Date().toISOString(),
    };

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create repair order: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Add line items to repair order
   */
  static async addLineItems(
    repairOrderId: string,
    tenantId: string,
    items: RepairOrderLineItem[]
  ): Promise<RepairOrderItem[]> {
    const supabase = getPrimaryClient();

    const lineItems: RepairOrderItemInsert[] = items.map(item => ({
      tenant_id: tenantId,
      repair_order_id: repairOrderId,
      item_type: item.itemType,
      item_code: item.itemCode,
      item_name: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percentage: item.discountPercentage || 0,
      labor_hours: item.laborHours,
      hourly_rate: item.hourlyRate,
      part_number: item.partNumber,
      inventory_item_id: item.inventoryItemId,
      is_warranty_covered: item.isWarrantyCovered || false,
      status: 'pending',
    }));

    const { data, error } = await supabase
      .from('auto_repair_order_items')
      .insert(lineItems)
      .select();

    if (error) {
      throw new Error(`Failed to add line items: ${error.message}`);
    }

    // Recalculate order totals
    await this.recalculateOrderTotals(repairOrderId, tenantId);

    return data || [];
  }

  /**
   * Update repair order diagnosis
   */
  static async updateDiagnosis(
    repairOrderId: string,
    tenantId: string,
    data: {
      diagnosisNotes: string;
      requiresApproval?: boolean;
      estimatedLabor?: number;
      estimatedParts?: number;
    }
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const updateData: RepairOrderUpdate = {
      diagnosis_notes: data.diagnosisNotes,
      diagnosed_at: new Date().toISOString(),
      status: 'diagnosed',
      requires_approval: data.requiresApproval || false,
    };

    if (data.estimatedLabor !== undefined) {
      updateData.estimated_labor_cost = data.estimatedLabor;
    }

    if (data.estimatedParts !== undefined) {
      updateData.estimated_parts_cost = data.estimatedParts;
    }

    if (data.estimatedLabor !== undefined && data.estimatedParts !== undefined) {
      updateData.estimated_total = data.estimatedLabor + data.estimatedParts;
    }

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update(updateData)
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update diagnosis: ${error.message}`);
    }

    // Notify customer if approval required
    if (data.requiresApproval) {
      await this.notifyCustomerForApproval(repairOrder);
    }

    return repairOrder;
  }

  /**
   * Approve repair order
   */
  static async approveRepairOrder(
    repairOrderId: string,
    tenantId: string,
    approvedBy: string,
    notes?: string
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        approval_notes: notes,
        customer_approved: true,
        customer_approval_date: new Date().toISOString(),
      })
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve repair order: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Assign technician to repair order
   */
  static async assignTechnician(
    repairOrderId: string,
    tenantId: string,
    technicianId: string,
    isPrimary: boolean = true,
    bayNumber?: string
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const updateData: RepairOrderUpdate = {};

    if (isPrimary) {
      updateData.primary_technician_id = technicianId;
    } else {
      // Add to additional technicians
      const { data: currentOrder } = await supabase
        .from('auto_repair_orders')
        .select('additional_technicians')
        .eq('id', repairOrderId)
        .eq('tenant_id', tenantId)
        .single();

      const additionalTechs = (currentOrder?.additional_technicians as string[]) || [];
      if (!additionalTechs.includes(technicianId)) {
        additionalTechs.push(technicianId);
        updateData.additional_technicians = additionalTechs;
      }
    }

    if (bayNumber) {
      updateData.bay_number = bayNumber;
    }

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update(updateData)
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign technician: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Start work on repair order
   */
  static async startWork(
    repairOrderId: string,
    tenantId: string,
    technicianId: string
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update({
        status: 'in_progress',
        work_started_at: new Date().toISOString(),
      })
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start work: ${error.message}`);
    }

    // Clock in technician
    await this.clockInTechnician(repairOrderId, tenantId, technicianId);

    return repairOrder;
  }

  /**
   * Complete work on repair order
   */
  static async completeWork(
    repairOrderId: string,
    tenantId: string,
    data: {
      technicianId: string;
      technicianNotes?: string;
      actualHours?: number;
    }
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    // Clock out technician
    await this.clockOutTechnician(repairOrderId, tenantId, data.technicianId);

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update({
        status: 'quality_check',
        work_completed_at: new Date().toISOString(),
        technician_notes: data.technicianNotes,
        actual_hours: data.actualHours,
      })
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete work: ${error.message}`);
    }

    // Recalculate actual costs
    await this.recalculateOrderTotals(repairOrderId, tenantId, true);

    return repairOrder;
  }

  /**
   * Quality check repair order
   */
  static async performQualityCheck(
    repairOrderId: string,
    tenantId: string,
    data: {
      passed: boolean;
      checkedBy: string;
      notes?: string;
    }
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const updateData: RepairOrderUpdate = {
      quality_check_passed: data.passed,
      quality_checked_at: new Date().toISOString(),
      quality_checked_by: data.checkedBy,
      quality_check_notes: data.notes,
    };

    if (data.passed) {
      updateData.status = 'completed';
    } else {
      updateData.status = 'in_progress'; // Send back for rework
    }

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update(updateData)
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to perform quality check: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Mark as invoiced
   */
  static async markAsInvoiced(
    repairOrderId: string,
    tenantId: string,
    invoiceId?: string
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update({
        status: 'invoiced',
        invoiced_at: new Date().toISOString(),
      })
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark as invoiced: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Mark as delivered
   */
  static async markAsDelivered(
    repairOrderId: string,
    tenantId: string
  ): Promise<RepairOrder> {
    const supabase = getPrimaryClient();

    const { data: repairOrder, error } = await supabase
      .from('auto_repair_orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark as delivered: ${error.message}`);
    }

    return repairOrder;
  }

  /**
   * Clock in technician
   */
  private static async clockInTechnician(
    repairOrderId: string,
    tenantId: string,
    technicianId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get technician name
    const { data: tech } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', technicianId)
      .eq('tenant_id', tenantId)
      .single();

    await supabase
      .from('auto_technician_time_logs')
      .insert({
        tenant_id: tenantId,
        repair_order_id: repairOrderId,
        technician_id: technicianId,
        technician_name: tech?.full_name,
        clock_in_time: new Date().toISOString(),
      });
  }

  /**
   * Clock out technician
   */
  private static async clockOutTechnician(
    repairOrderId: string,
    tenantId: string,
    technicianId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Find open time log
    const { data: timeLog } = await supabase
      .from('auto_technician_time_logs')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('technician_id', technicianId)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    if (timeLog) {
      await supabase
        .from('auto_technician_time_logs')
        .update({
          clock_out_time: new Date().toISOString(),
        })
        .eq('id', timeLog.id);
    }
  }

  /**
   * Recalculate order totals
   */
  private static async recalculateOrderTotals(
    repairOrderId: string,
    tenantId: string,
    isActual: boolean = false
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get all line items
    const { data: items } = await supabase
      .from('auto_repair_order_items')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('tenant_id', tenantId);

    if (!items || items.length === 0) return;

    let laborCost = 0;
    let partsCost = 0;
    let totalHours = 0;

    for (const item of items) {
      if (item.item_type === 'labor') {
        laborCost += item.total_amount || 0;
        totalHours += item.labor_hours || 0;
      } else if (item.item_type === 'part') {
        partsCost += item.total_amount || 0;
      } else {
        // service items can contribute to both
        laborCost += item.total_amount || 0;
      }
    }

    const total = laborCost + partsCost;

    const updateData: RepairOrderUpdate = {};
    if (isActual) {
      updateData.actual_labor_cost = laborCost;
      updateData.actual_parts_cost = partsCost;
      updateData.actual_total = total;
      updateData.actual_hours = totalHours;
    } else {
      updateData.estimated_labor_cost = laborCost;
      updateData.estimated_parts_cost = partsCost;
      updateData.estimated_total = total;
      updateData.estimated_hours = totalHours;
    }

    await supabase
      .from('auto_repair_orders')
      .update(updateData)
      .eq('id', repairOrderId)
      .eq('tenant_id', tenantId);
  }

  /**
   * Notify customer for approval
   */
  private static async notifyCustomerForApproval(
    repairOrder: RepairOrder
  ): Promise<void> {
    // TODO: Integrate with notification service
    console.log(`[RepairOrder] Notifying customer for approval: ${repairOrder.order_number}`);
  }

  /**
   * Get repair orders by status
   */
  static async getRepairOrdersByStatus(
    tenantId: string,
    status: string,
    limit?: number
  ): Promise<RepairOrder[]> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_repair_orders')
      .select('*, customers(*), auto_vehicles(*)')
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .order('order_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get repair orders: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get technician workload
   */
  static async getTechnicianWorkload(
    tenantId: string,
    technicianId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    activeOrders: number;
    totalHours: number;
    completedOrders: number;
    orders: RepairOrder[];
  }> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_repair_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('primary_technician_id', technicianId);

    if (dateRange) {
      query = query
        .gte('order_date', dateRange.start.toISOString().split('T')[0])
        .lte('order_date', dateRange.end.toISOString().split('T')[0]);
    }

    const { data: orders, error } = await query;

    if (error) {
      throw new Error(`Failed to get technician workload: ${error.message}`);
    }

    if (!orders) {
      return { activeOrders: 0, totalHours: 0, completedOrders: 0, orders: [] };
    }

    const activeOrders = orders.filter(o => 
      o.status && ['open', 'diagnosed', 'approved', 'in_progress', 'quality_check'].includes(o.status)
    ).length;

    const completedOrders = orders.filter(o => 
      o.status && ['completed', 'invoiced', 'delivered'].includes(o.status)
    ).length;

    const totalHours = orders.reduce((sum, o) => sum + (o.actual_hours || 0), 0);

    return {
      activeOrders,
      totalHours,
      completedOrders,
      orders,
    };
  }

  /**
   * Get repair order statistics
   */
  static async getRepairOrderStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    averageCompletionTime: number;
    totalRevenue: number;
  }> {
    const supabase = getPrimaryClient();

    const { data: orders, error } = await supabase
      .from('auto_repair_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('order_date', startDate.toISOString().split('T')[0])
      .lte('order_date', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    if (!orders || orders.length === 0) {
      return {
        total: 0,
        byStatus: {},
        byType: {},
        averageCompletionTime: 0,
        totalRevenue: 0,
      };
    }

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalCompletionTime = 0;
    let completedCount = 0;
    let totalRevenue = 0;

    for (const order of orders) {
      const statusKey = order.status || 'unknown';
      byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
      byType[order.order_type] = (byType[order.order_type] || 0) + 1;

      if (order.actual_total) {
        totalRevenue += Number(order.actual_total);
      }

      if (order.opened_at && order.work_completed_at) {
        const duration = new Date(order.work_completed_at).getTime() - 
                        new Date(order.opened_at).getTime();
        totalCompletionTime += duration;
        completedCount++;
      }
    }

    const averageCompletionTime = completedCount > 0 
      ? totalCompletionTime / completedCount / (1000 * 60 * 60) // hours
      : 0;

    return {
      total: orders.length,
      byStatus,
      byType,
      averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
      totalRevenue,
    };
  }
}
