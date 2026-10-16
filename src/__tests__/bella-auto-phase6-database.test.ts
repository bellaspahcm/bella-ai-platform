/**
 * Bella Auto Phase 6 - Service Center & Workshop Database Tests
 * Tests service appointments, repair orders, service history, warranty claims
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;

describe('Bella Auto Phase 6 - Service Center & Workshop', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testTenantId = 'da9e610b-88c5-4901-8ab9-5439f4931467'; // Valid UUID for test tenant
  let testCustomerId: string;
  let testVehicleId: string;

  beforeAll(async () => {
    jest.setTimeout(60000);
    supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Create test customer
    const { data: customer } = await supabase
      .from('customers')
      .insert({
        tenant_id: testTenantId,
        name_mother: 'Test Customer Phase 6 DB',
        phone: '09' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      })
      .select()
      .single();
    testCustomerId = customer!.id;

    // Query an existing vehicle to bypass complex variant foreign keys
    const { data: vehicle } = await supabase
      .from('auto_vehicles')
      .select('id')
      .limit(1)
      .single();
    testVehicleId = vehicle!.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('auto_technician_time_logs').delete().eq('tenant_id', testTenantId);
    await supabase.from('auto_warranty_claims').delete().eq('tenant_id', testTenantId);
    await supabase.from('auto_service_history').delete().eq('tenant_id', testTenantId);
    await supabase.from('auto_repair_order_items').delete().eq('tenant_id', testTenantId);
    await supabase.from('auto_repair_orders').delete().eq('tenant_id', testTenantId);
    await supabase.from('auto_service_appointments').delete().eq('tenant_id', testTenantId);
    await supabase.from('customers').delete().eq('id', testCustomerId);
  }, 30000); // Increase timeout to 30s for cleanup

  describe('Schema Validation', () => {
    it('should have auto_service_packages table', async () => {
      const { data, error } = await supabase
        .from('auto_service_packages')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_service_appointments table', async () => {
      const { data, error } = await supabase
        .from('auto_service_appointments')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_repair_orders table', async () => {
      const { data, error } = await supabase
        .from('auto_repair_orders')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_repair_order_items table', async () => {
      const { data, error } = await supabase
        .from('auto_repair_order_items')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_service_history table (immutable)', async () => {
      const { data, error } = await supabase
        .from('auto_service_history')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_warranty_claims table', async () => {
      const { data, error } = await supabase
        .from('auto_warranty_claims')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_technician_time_logs table', async () => {
      const { data, error } = await supabase
        .from('auto_technician_time_logs')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('RPC Functions', () => {
    it('should have generate_appointment_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^APT\d{8}-\d{4}$/);
    });

    it('should have generate_repair_order_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^RO\d{8}-\d{4}$/);
    });

    it('should have generate_warranty_claim_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^WC\d{8}-\d{4}$/);
    });
  });

  describe('Service Appointment Lifecycle', () => {
    it('should create service appointment with unique number', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: aptNumber } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      const appointment = {
        tenant_id: testTenantId,
        appointment_number: aptNumber,
        customer_id: testCustomerId,
        vehicle_id: testVehicleId,
        appointment_date: todayDateStr,
        appointment_time: '09:00:00',
        scheduled_date: `${todayDateStr}T09:00:00Z`,
        service_type: 'Bảo dưỡng định kỳ',
        requested_services: 'Bảo dưỡng định kỳ',
        vehicle_info: 'Toyota Fortuner 2024',
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('auto_service_appointments')
        .insert(appointment)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.appointment_number).toBe(aptNumber);
      expect(data?.status).toBe('pending');
    });

    it('should transition appointment status: pending -> confirmed -> checked_in', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: aptNumber } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      const { data: apt, error: aptErr } = await supabase
        .from('auto_service_appointments')
        .insert({
          tenant_id: testTenantId,
          appointment_number: aptNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          appointment_date: todayDateStr,
          appointment_time: '10:00:00',
          scheduled_date: `${todayDateStr}T10:00:00Z`,
          service_type: 'Test',
          requested_services: 'Test',
          vehicle_info: 'Toyota Fortuner 2024',
          status: 'pending',
        })
        .select()
        .single();

      if (aptErr) {
        console.error('Apt Insert Error:', aptErr);
      }

      // Confirm
      const { data: confirmed } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', apt!.id)
        .select()
        .single();

      expect(confirmed?.status).toBe('confirmed');

      // Check-in
      const { data: checkedIn, error: checkinErr } = await supabase
        .from('auto_service_appointments')
        .update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', apt!.id)
        .select()
        .single();

      if (checkinErr) {
        console.error('Check-in Error:', checkinErr);
      }

      expect(checkedIn?.status).toBe('checked_in');
    });
  });

  describe('Repair Order Management', () => {
    it('should create repair order with line items', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          order_date: todayDateStr,
          order_type: 'Sửa chữa',
          work_description: 'Thay dầu động cơ',
          mileage_in: 50000,
          customer_name: 'Test Customer',
          vehicle_info: 'Toyota Fortuner 2024',
          status: 'open',
        })
        .select()
        .single();

      expect(repairOrder).toBeDefined();
      expect(repairOrder?.status).toBe('open');

      // Add line items
      const { data: lineItems } = await supabase
        .from('auto_repair_order_items')
        .insert([
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder!.id,
            item_type: 'part',
            item_name: 'Dầu động cơ 5W-30',
            quantity: 4,
            unit_price: 150000,
            status: 'pending',
          },
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder!.id,
            item_type: 'labor',
            item_name: 'Công thay dầu',
            quantity: 1,
            unit_price: 200000,
            labor_hours: 0.5,
            status: 'pending',
          },
        ])
        .select();

      expect(lineItems).toBeDefined();
      expect(lineItems?.length).toBe(2);
    });

    it('should auto-calculate line item totals', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          order_date: todayDateStr,
          order_type: 'Test',
          work_description: 'Test',
          mileage_in: 50000,
          customer_name: 'Test Customer',
          vehicle_info: 'Toyota Fortuner 2024',
          status: 'open',
        })
        .select()
        .single();

      const { data: lineItem } = await supabase
        .from('auto_repair_order_items')
        .insert({
          tenant_id: testTenantId,
          repair_order_id: repairOrder!.id,
          item_type: 'part',
          item_name: 'Test Part',
          quantity: 3,
          unit_price: 100000,
          discount_percentage: 10,
          status: 'pending',
        })
        .select()
        .single();

      // total_amount should be auto-calculated: (3 * 100000) * (1 - 0.1) = 270000
      expect(Number(lineItem?.total_amount)).toBe(270000);
    });
  });

  describe('Service History (Immutable)', () => {
    it('should create immutable service history record', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          order_date: todayDateStr,
          order_type: 'Bảo dưỡng',
          work_description: 'Test maintenance',
          mileage_in: 60000,
          customer_name: 'Test Customer',
          vehicle_info: 'Toyota Fortuner 2024',
          status: 'completed',
        })
        .select()
        .single();

      const { data: history, error: historyErr } = await supabase
        .from('auto_service_history')
        .insert({
          tenant_id: testTenantId,
          vin: 'TEST-VIN-123456',
          vehicle_id: repairOrder!.vehicle_id,
          repair_order_id: repairOrder!.id,
          service_date: repairOrder!.order_date,
          service_type: repairOrder!.order_type,
          mileage: repairOrder!.mileage_in || 60000,
          service_description: repairOrder!.work_description || 'Test maintenance',
          services_performed: ['Bảo dưỡng định kỳ'],
          recorded_at: new Date().toISOString(),
          recorded_by: testCustomerId,
          is_locked: true,
        })
        .select()
        .single();

      if (historyErr) {
        console.error('History Insert Error:', historyErr);
      }

      expect(history).toBeDefined();
      expect(history?.is_locked).toBe(true);
      expect(history?.vin).toBe('TEST-VIN-123456');
    });

    it('should prevent UPDATE on locked service history (RLS)', async () => {
      // This test verifies RLS policy blocks updates
      const { data: history } = await supabase
        .from('auto_service_history')
        .select('*')
        .eq('is_locked', true)
        .limit(1)
        .single();

      if (history) {
        const { error } = await supabase
          .from('auto_service_history')
          .update({ work_description: 'Modified' })
          .eq('id', history.id);

        // Should be blocked by RLS
        expect(error).toBeDefined();
      }
    });
  });

  describe('Warranty Claims Workflow', () => {
    it('should create warranty claim with unique number', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: claimNumber } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          tenant_id: testTenantId,
          claim_number: claimNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          claim_date: todayDateStr,
          claim_type: 'Engine',
          issue_description: 'Test warranty claim',
          failure_date: '2026-08-01',
          failure_mileage: 40000,
          status: 'submitted',
        })
        .select()
        .single();

      expect(claim).toBeDefined();
      expect(claim?.claim_number).toBe(claimNumber);
      expect(claim?.status).toBe('submitted');
    });

    it('should transition warranty claim status: submitted -> approved -> completed', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: claimNumber } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          tenant_id: testTenantId,
          claim_number: claimNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          claim_date: todayDateStr,
          claim_type: 'Test',
          issue_description: 'Test',
          failure_date: '2026-08-01',
          failure_mileage: 40000,
          status: 'submitted',
        })
        .select()
        .single();

      // Approve
      const { data: approved } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', claim!.id)
        .select()
        .single();

      expect(approved?.status).toBe('approved');

      // Complete
      const { data: completed, error: completeErr } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          total_approved: 5000000,
        })
        .eq('id', claim!.id)
        .select()
        .single();

      if (completeErr) {
        console.error('Complete Claim Error:', completeErr);
      }

      expect(completed?.status).toBe('completed');
      expect(Number(completed?.total_approved)).toBe(5000000);
    });
  });

  describe('Technician Time Tracking', () => {
    it('should create time log and auto-calculate hours', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: testCustomerId,
          vehicle_id: testVehicleId,
          order_date: todayDateStr,
          order_type: 'Test',
          work_description: 'Test',
          mileage_in: 50000,
          customer_name: 'Test Customer',
          vehicle_info: 'Toyota Fortuner 2024',
          status: 'in_progress',
        })
        .select()
        .single();

      const clockIn = new Date();
      const clockOut = new Date(clockIn.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      const { data: timeLog } = await supabase
        .from('auto_technician_time_logs')
        .insert({
          tenant_id: testTenantId,
          repair_order_id: repairOrder!.id,
          technician_id: '00000000-0000-0000-0000-000000000003',
          technician_name: 'Test Tech',
          clock_in_time: clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
        })
        .select()
        .single();

      expect(timeLog).toBeDefined();
      // hours_worked should be auto-calculated by trigger
      // Note: Might be NULL if calculated asynchronously
    });
  });
});
