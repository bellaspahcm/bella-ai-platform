/**
 * Bella Preschool OS — P10 Analytics & Executive Dashboard Integration Test Suite
 * File: tests/products/bella-education/analytics/p10-analytics-dashboard.integration.test.ts
 *
 * Verifies:
 * 1. Supreme Immutability Law: Calling P10 analytics service MUST NEVER mutate P1–P9 domain state.
 * 2. Work Queue vs Staffing Truth: Resolving RATIO_SHORTAGE in Work Queue WHILE ratio snapshot is non-compliant MUST STILL report staffing violation.
 * 3. Work Queue vs Asset Truth: Resolving SAFETY_DEFECT in Work Queue WHILE asset is OUT_OF_SERVICE MUST STILL report asset unavailable.
 * 4. Work Queue vs Finance Truth: Resolving OVERDUE_PAYMENT_SLA in Work Queue WITHOUT reconciliation ledger entry MUST STILL report outstanding balance.
 * 5. Event-Driven Projection & Dynamic Recalculation across P1, P3, P7, P9 domain changes.
 */

import { createClient } from '@supabase/supabase-js';
import { PreschoolAnalyticsRepository } from '../../../../src/products/bella-education/analytics/repositories/preschool-analytics.repository';
import { PreschoolAnalyticsService } from '../../../../src/products/bella-education/analytics/services/preschool-analytics.service';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('P10 Preschool Analytics & Executive Dashboard Integration Test Suite', () => {
  let tenantId: string;
  let repo: PreschoolAnalyticsRepository;
  let service: PreschoolAnalyticsService;
  const todayStr = new Date().toISOString().split('T')[0];

  beforeEach(async () => {
    tenantId = crypto.randomUUID();
    repo = new PreschoolAnalyticsRepository(supabase);
    service = new PreschoolAnalyticsService(repo);

    await supabase.from('tenants').insert({ id: tenantId, name: `Test Tenant ${tenantId.slice(0, 8)}` });
  });

  async function seedBillingPeriod(): Promise<string> {
    const { data } = await supabase.from('edu_fin_billing_periods').insert({
      tenant_id: tenantId,
      period_name: 'Period Sept 2026',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      due_date: '2026-09-15',
      status: 'ACTIVE',
      created_by: crypto.randomUUID(),
    }).select('id').single();
    return data!.id;
  }

  async function seedStudent(): Promise<string> {
    const studentPartyId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    await supabase.from('party_parties').insert({
      id: studentPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: `Minh Lê ${studentPartyId.slice(0, 8)}`,
    });
    await supabase.from('persons').insert({
      id: personId,
      tenant_id: tenantId,
      first_name: 'Minh',
      last_name: 'Lê',
      date_of_birth: '2022-01-01',
      gender: 'male',
    });
    await supabase.from('students').insert({
      student_id: studentPartyId,
      tenant_id: tenantId,
      person_id: personId,
      student_code: `STU-${studentPartyId.slice(0, 8)}`,
      academic_status: 'enrolled',
      enrollment_type: 'full_time',
      program_id: 'PRESCHOOL',
      enrollment_date: todayStr,
    });

    return studentPartyId;
  }

  async function seedPayer(): Promise<string> {
    const payerPartyId = crypto.randomUUID();
    await supabase.from('party_parties').insert({
      id: payerPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: `P10 Payer ${payerPartyId.slice(0, 8)}`,
    });

    return payerPartyId;
  }

  async function seedShiftTemplate(): Promise<string> {
    const { data } = await supabase.from('edu_sched_shift_templates').insert({
      tenant_id: tenantId,
      name: 'Ca Sáng Mầm Non',
      code: 'SHIFT-MORNING',
      start_time: '07:30:00',
      end_time: '11:30:00',
    }).select('id').single();
    return data!.id;
  }

  it('Invariant 1: Supreme Immutability Law — Calling P10 Analytics Service MUST NEVER mutate domain tables', async () => {
    const initialDash = await service.getExecutiveDashboard(tenantId, todayStr);
    expect(initialDash.tenantId).toBe(tenantId);

    for (let i = 0; i < 5; i++) {
      await service.getExecutiveDashboard(tenantId, todayStr);
    }

    const { data: students } = await supabase.from('edu_students').select('*').eq('tenant_id', tenantId);
    const { data: invoices } = await supabase.from('edu_fin_invoices').select('*').eq('tenant_id', tenantId);
    const { data: exceptions } = await supabase.from('edu_comm_exceptions').select('*').eq('tenant_id', tenantId);

    expect(students || []).toHaveLength(0);
    expect(invoices || []).toHaveLength(0);
    expect(exceptions || []).toHaveLength(0);
  }, 45000);

  it('Invariant 2: Work Queue RESOLVED while staffing still SHORTAGE MUST STILL report active staffing violation', async () => {
    const shiftTemplateId = await seedShiftTemplate();
    const studentId = await seedStudent();

    // 1. Seed P8 non-compliant ratio snapshot (Domain Truth)
    await supabase.from('edu_sched_compliance_snapshots').insert({
      tenant_id: tenantId,
      snapshot_date: todayStr,
      classroom_id: crypto.randomUUID(),
      shift_template_id: shiftTemplateId,
      enrolled_children: 10,
      expected_children: 10,
      present_children: 10,
      required_caregivers: 2,
      assigned_caregivers: 1,
      compliance_state: 'SHORTAGE_VIOLATION',
      shortage_count: 1,
    });

    // 2. Seed RESOLVED exception in Work Queue
    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantId,
      student_id: studentId,
      exception_type: 'RATIO_SHORTAGE',
      severity: 'HIGH',
      assigned_role: 'STAFF_TEACHER',
      status: 'RESOLVED',
    });

    // 3. Query Analytics
    const dash = await service.getExecutiveDashboard(tenantId, todayStr);

    // 4. Assert activeStaffingViolations (P8 Truth) is 1, while openStaffingExceptions (Queue) is 0
    expect(dash.workforce.activeStaffingViolations).toBe(1);
    expect(dash.workforce.openStaffingExceptions).toBe(0);
  }, 45000);

  it('Invariant 3: Work Queue RESOLVED while asset still OUT_OF_SERVICE MUST STILL report asset unavailable', async () => {
    const facId = crypto.randomUUID();
    const zoneId = crypto.randomUUID();
    await supabase.from('edu_fac_facilities').insert({ tenant_id: tenantId, id: facId, name: 'Fac 1', code: 'F1' });
    await supabase.from('edu_fac_zones').insert({ tenant_id: tenantId, id: zoneId, facility_id: facId, name: 'Zone 1', zone_type: 'PLAYGROUND' });

    await supabase.from('edu_fac_assets').insert({
      tenant_id: tenantId,
      zone_id: zoneId,
      name: 'Swing 01',
      asset_category: 'PLAY_EQUIPMENT',
      serial_number: 'AST-01',
      operational_status: 'OUT_OF_SERVICE',
    });

    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantId,
      student_id: await seedStudent(),
      exception_type: 'SAFETY_DEFECT',
      severity: 'CRITICAL',
      assigned_role: 'FACILITIES_MANAGER',
      status: 'RESOLVED',
    });

    const dash = await service.getExecutiveDashboard(tenantId, todayStr);

    expect(dash.facilities.outOfServiceAssetsCount).toBe(1);
    expect(dash.facilities.openSafetyExceptions).toBe(0);
  }, 45000);

  it('Invariant 4: Invoice exception resolved WITHOUT reconciliation MUST STILL report outstanding balance', async () => {
    const periodId = await seedBillingPeriod();
    const studentId = await seedStudent();

    await supabase.from('edu_fin_invoices').insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      student_id: studentId,
      invoice_number: 'INV-TEST-01',
      billing_period_id: periodId,
      gross_amount: 5000000,
      net_amount: 5000000,
      invoice_status: 'ISSUED',
      settlement_status: 'UNPAID',
      due_date: '2026-09-30',
      created_by: crypto.randomUUID(),
    });

    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantId,
      student_id: studentId,
      exception_type: 'OVERDUE_PAYMENT_SLA',
      severity: 'HIGH',
      assigned_role: 'FINANCE_MANAGER',
      status: 'RESOLVED',
    });

    const dash = await service.getExecutiveDashboard(tenantId, todayStr);

    expect(dash.finance.invoicedGrossTotal).toBe(5000000);
    expect(dash.finance.reconciledCashCollected).toBe(0);
    expect(dash.finance.outstandingBalanceTotal).toBe(5000000);
  }, 45000);

  it('Invariant 5: Dynamic Event-Driven & Hybrid Reconciliation across P1, P3, P7, P9 domain changes', async () => {
    const periodId = await seedBillingPeriod();
    const studentId = await seedStudent();
    const payerPartyId = await seedPayer();
    const classId = crypto.randomUUID();

    // Emit domain event for student enrollment
    await service.handleDomainEvent({
      eventId: crypto.randomUUID(),
      tenantId,
      eventType: 'STUDENT_ENROLLED',
      sourceDomain: 'P1_STUDENT',
      entityId: studentId,
      payload: { classroomId: classId },
      timestamp: new Date().toISOString(),
    });

    const invId = crypto.randomUUID();
    await supabase.from('edu_fin_invoices').insert({
      id: invId,
      tenant_id: tenantId,
      student_id: studentId,
      invoice_number: 'INV-DYN-01',
      billing_period_id: periodId,
      gross_amount: 3000000,
      net_amount: 3000000,
      invoice_status: 'ISSUED',
      settlement_status: 'PARTIALLY_PAID',
      due_date: '2026-09-30',
      created_by: crypto.randomUUID(),
    });

    // Seed payment and reconciliation ledger entry
    const paymentId = crypto.randomUUID();
    await supabase.from('edu_fin_payments').insert({
      id: paymentId,
      tenant_id: tenantId,
      payer_party_id: payerPartyId,
      student_id: studentId,
      payment_number: 'PAY-DYN-01',
      amount: 1000000,
      payment_method: 'BANK_TRANSFER',
      status: 'RECONCILED',
      created_by: crypto.randomUUID(),
    });

    await supabase.from('edu_fin_reconciliation_ledger').insert({
      tenant_id: tenantId,
      invoice_id: invId,
      payment_id: paymentId,
      allocated_amount: 1000000,
      reconciled_by_party_id: payerPartyId,
    });

    // Emit domain event for payment reconciliation
    await service.handleDomainEvent({
      eventId: crypto.randomUUID(),
      tenantId,
      eventType: 'PAYMENT_RECONCILED',
      sourceDomain: 'P7_FINANCE',
      entityId: invId,
      payload: { allocatedAmount: 1000000 },
      timestamp: new Date().toISOString(),
    });

    const dash = await service.getExecutiveDashboard(tenantId, todayStr);

    expect(dash.enrollment.totalEnrolledStudents).toBe(1);
    expect(dash.finance.invoicedGrossTotal).toBe(3000000);
    expect(dash.finance.reconciledCashCollected).toBe(1000000);
    expect(dash.finance.outstandingBalanceTotal).toBe(2000000);
  }, 20000);
});
