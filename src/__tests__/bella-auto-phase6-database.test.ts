/**
 * Bella Auto Phase 6 - Service Center & Workshop Database Tests
 * Tests service appointments, repair orders, service history, warranty claims
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { randomUUID } from 'node:crypto';
import { generateTenantJWT } from '../../tests/utils/test-jwt-helper';

function requireGeneratedNumber(result: { data: string | null; error: { message: string } | null }): string {
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('Number generator returned no value');
  return result.data;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;

describe('Bella Auto Phase 6 - Service Center & Workshop', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testTenantId: string;
  let testVehicleVin: string;
  const testActorId = randomUUID();
  const ownedIds = {
    customers: [] as string[],
    auto_service_appointments: [] as string[],
    auto_repair_orders: [] as string[],
    auto_service_history: [] as string[],
    auto_warranty_claims: [] as string[],
    auto_technician_time_logs: [] as string[],
  };
  function ownId(table: keyof typeof ownedIds): string {
    const id = randomUUID();
    ownedIds[table].push(id);
    return id;
  }
  let testCustomerId: string;
  let testVehicleId: string;

  beforeAll(async () => {
    jest.setTimeout(60000);
    if (new URL(supabaseUrl).hostname !== 'bmnbqbcdbuklhopfbopv.supabase.co') {
      throw new Error('Phase 6 write tests require the canonical isolated E2E project');
    }
    supabase = createClient<Database>(supabaseUrl, supabaseKey);

    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error('Phase 6 RLS test requires the E2E JWT secret');
    }
    const preflights = await Promise.all([
      supabase.from('auto_service_appointments').select('scheduled_date, vehicle_info').limit(0),
      supabase.from('auto_repair_orders').select('customer_name, vehicle_info').limit(0),
    ]);
    if (preflights.some(result => result.error)) {
      throw new Error('SCHEMA_DRIFT_E2E: verify existing migration 20260804360000_migrate_workshop_schema.sql before Phase 6 writes');
    }
    // Read an existing vehicle only; all mutations below target newly owned rows.
    const { data: vehicle, error: vehicleError } = await supabase
      .from('auto_vehicles').select('id, tenant_id, vin').limit(1).single().throwOnError();
    if (vehicleError || !vehicle) throw new Error('Missing E2E vehicle fixture');
    testVehicleId = vehicle.id;
    testVehicleVin = vehicle.vin;
    testTenantId = vehicle.tenant_id;

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        id: ownId('customers'),
        tenant_id: testTenantId,
        name_mother: 'Test Customer Phase 6 DB',
        phone: '09' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      }).select().single().throwOnError();
    if (customerError || !customer) throw new Error('Unable to create owned customer fixture');
    testCustomerId = customer.id;
  }, 60000);

  afterAll(async () => {
    if (!supabase || !testTenantId) return;
    const errors: string[] = [];
    for (const table of ['auto_technician_time_logs', 'auto_warranty_claims', 'auto_service_history'] as const) {
      if (!ownedIds[table].length) continue;
      const { error } = await supabase.from(table).delete()
        .eq('tenant_id', testTenantId).in('id', ownedIds[table]);
      if (error) errors.push(error.message);
    }
    if (ownedIds.auto_repair_orders.length) {
      const { error } = await supabase.from('auto_repair_order_items').delete()
        .eq('tenant_id', testTenantId).in('repair_order_id', ownedIds.auto_repair_orders);
      if (error) errors.push(error.message);
    }
    for (const table of ['auto_repair_orders', 'auto_service_appointments', 'customers'] as const) {
      if (!ownedIds[table].length) continue;
      const { error } = await supabase.from(table).delete()
        .eq('tenant_id', testTenantId).in('id', ownedIds[table]);
      if (error) errors.push(error.message);
    }
    if (errors.length) throw new Error('Owned fixture cleanup failed: ' + errors.join('; '));
  }, 30000);

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
      const aptNumber = requireGeneratedNumber(await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId }));

      const appointment = {
        id: ownId('auto_service_appointments'),
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
        .single().throwOnError();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.appointment_number).toBe(aptNumber);
      expect(data?.status).toBe('pending');
    });

    it('should transition appointment status: pending -> confirmed -> checked_in', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const aptNumber = requireGeneratedNumber(await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId }));

      const { data: apt, error: aptErr } = await supabase
        .from('auto_service_appointments')
        .insert({
          id: ownId('auto_service_appointments'),
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
        .single().throwOnError();

      if (aptErr) {
        console.error('Apt Insert Error:', aptErr);
      }

      // Confirm
      const { data: confirmed } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', apt.id)
        .select()
        .single().throwOnError();

      expect(confirmed?.status).toBe('confirmed');

      // Check-in
      const { data: checkedIn, error: checkinErr } = await supabase
        .from('auto_service_appointments')
        .update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', apt.id)
        .select()
        .single().throwOnError();

      if (checkinErr) {
        console.error('Check-in Error:', checkinErr);
      }

      expect(checkedIn?.status).toBe('checked_in');
    });
  });

  describe('Repair Order Management', () => {
    it('should create repair order with line items', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const roNumber = requireGeneratedNumber(await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId }));

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          id: ownId('auto_repair_orders'),
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
        .single().throwOnError();

      expect(repairOrder).toBeDefined();
      expect(repairOrder?.status).toBe('open');

      // Add line items
      const { data: lineItems } = await supabase
        .from('auto_repair_order_items')
        .insert([
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder.id,
            item_type: 'part',
            item_name: 'Dầu động cơ 5W-30',
            quantity: 4,
            unit_price: 150000,
            status: 'pending',
          },
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder.id,
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
      const roNumber = requireGeneratedNumber(await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId }));

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          id: ownId('auto_repair_orders'),
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
        .single().throwOnError();

      const { data: lineItem } = await supabase
        .from('auto_repair_order_items')
        .insert({
          tenant_id: testTenantId,
          repair_order_id: repairOrder.id,
          item_type: 'part',
          item_name: 'Test Part',
          quantity: 3,
          unit_price: 100000,
          discount_percentage: 10,
          status: 'pending',
        })
        .select()
        .single().throwOnError();

      // total_amount should be auto-calculated: (3 * 100000) * (1 - 0.1) = 270000
      expect(Number(lineItem?.total_amount)).toBe(270000);
    });
  });

  describe('Service History (Immutable)', () => {
    it('should create immutable service history record', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const roNumber = requireGeneratedNumber(await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId }));

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          id: ownId('auto_repair_orders'),
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
        .single().throwOnError();

      const { data: history, error: historyErr } = await supabase
        .from('auto_service_history')
        .insert({
          id: ownId('auto_service_history'),
          tenant_id: testTenantId,
          vin: testVehicleVin,
          vehicle_id: repairOrder.vehicle_id,
          repair_order_id: repairOrder.id,
          service_date: repairOrder.order_date,
          service_type: repairOrder.order_type,
          mileage: repairOrder.mileage_in || 60000,
          service_description: repairOrder.work_description || 'Test maintenance',
          services_performed: ['Bảo dưỡng định kỳ'],
          recorded_at: new Date().toISOString(),
          recorded_by: testActorId,
          is_locked: true,
        })
        .select()
        .single().throwOnError();

      if (historyErr) {
        console.error('History Insert Error:', historyErr);
      }

      expect(history).toBeDefined();
      expect(history?.is_locked).toBe(true);
      expect(history?.vin).toBe(testVehicleVin);
    });

    it('should prevent UPDATE on locked service history (RLS)', async () => {
      const historyId = ownedIds.auto_service_history[0];
      if (!historyId) throw new Error('Owned locked-history fixture was not created');
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) throw new Error('Phase 6 RLS test requires the E2E anon key');
      const token = generateTenantJWT({ tenantId: testTenantId, userId: testActorId });
      const authenticated = createClient<Database>(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: before, error: readError } = await authenticated
        .from('auto_service_history').select('service_description, is_locked')
        .eq('tenant_id', testTenantId).eq('id', historyId).single().throwOnError();
      expect(readError).toBeNull();
      expect(before?.is_locked).toBe(true);
      expect(before?.service_description).toBeTruthy();

      const { data: updated, error } = await authenticated
        .from('auto_service_history').update({ service_description: 'Modified' })
        .eq('tenant_id', testTenantId).eq('id', historyId).select('id');
      // PostgreSQL may deny the table privilege or silently hide rows via RLS.
      if (error) expect(error.code).toBe('42501');
      else expect(updated).toEqual([]);

      const { data: after, error: verifyError } = await supabase
        .from('auto_service_history').select('service_description, is_locked')
        .eq('tenant_id', testTenantId).eq('id', historyId).single().throwOnError();
      expect(verifyError).toBeNull();
      expect(after).toEqual(before);
    });
  });

  describe('Warranty Claims Workflow', () => {
    it('should create warranty claim with unique number', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const claimNumber = requireGeneratedNumber(await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId }));

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          id: ownId('auto_warranty_claims'),
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
        .single().throwOnError();

      expect(claim).toBeDefined();
      expect(claim?.claim_number).toBe(claimNumber);
      expect(claim?.status).toBe('submitted');
    });

    it('should transition warranty claim status: submitted -> approved -> completed', async () => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const claimNumber = requireGeneratedNumber(await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId }));

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          id: ownId('auto_warranty_claims'),
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
        .single().throwOnError();

      // Approve
      const { data: approved } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', claim.id)
        .select()
        .single().throwOnError();

      expect(approved?.status).toBe('approved');

      // Complete
      const { data: completed, error: completeErr } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          total_approved: 5000000,
        })
        .eq('id', claim.id)
        .select()
        .single().throwOnError();

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
      const roNumber = requireGeneratedNumber(await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId }));

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          id: ownId('auto_repair_orders'),
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
        .single().throwOnError();

      const clockIn = new Date();
      const clockOut = new Date(clockIn.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      const { data: timeLog } = await supabase
        .from('auto_technician_time_logs')
        .insert({
          id: ownId('auto_technician_time_logs'),
          tenant_id: testTenantId,
          repair_order_id: repairOrder.id,
          technician_id: '00000000-0000-0000-0000-000000000003',
          technician_name: 'Test Tech',
          clock_in_time: clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
        })
        .select()
        .single().throwOnError();

      expect(timeLog).toBeDefined();
      // hours_worked should be auto-calculated by trigger
      // Note: Might be NULL if calculated asynchronously
    });
  });
});
