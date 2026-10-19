/**
 * Bella Preschool Finance Identity Cutover V1 — Real DB E2E
 *
 * Proves the minimum canonical identity chain:
 * party_parties.id -> edu_enrollments.student_party_id -> edu_attendance.enrollment_id
 * -> edu_fin_invoices.student_id -> edu_fin_payments.student_id / payer_party_id.
 */

import { createClient } from '@supabase/supabase-js';
import { PreschoolFinanceRepository } from '../../../../src/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '../../../../src/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService } from '../../../../src/products/bella-education/finance/services/invoice-issuance.service';
import { PaymentReconciliationService } from '../../../../src/products/bella-education/finance/services/payment-reconciliation.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Preschool Finance canonical Party identity Real DB E2E', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const studentPartyA = crypto.randomUUID();
  const studentPartyB = crypto.randomUUID();
  const payerPartyA = crypto.randomUUID();
  const payerPartyB = crypto.randomUUID();
  const staffPartyA = crypto.randomUUID();
  const staffPartyB = crypto.randomUUID();

  let repo: PreschoolFinanceRepository;
  let billing: TuitionBillingService;
  let issuance: InvoiceIssuanceService;
  let reconciliation: PaymentReconciliationService;

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    const { error } = await supabase.from('tenants').insert({ id: tenantId, name });
    expect(error).toBeNull();
  }

  async function seedParty(tenantId: string, partyId: string, displayName: string): Promise<void> {
    const { error } = await supabase.from('party_parties').insert({
      id: partyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: displayName,
    });
    expect(error).toBeNull();
  }

  async function seedCourse(tenantId: string): Promise<string> {
    const { data, error } = await supabase.from('edu_courses').insert({
      tenant_id: tenantId,
      course_code: `PRESCHOOL-${tenantId.slice(0, 8)}-${suffix}`,
      title: `Preschool Canonical Identity ${suffix}`,
      status: 'active',
    }).select('id').single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    return data!.id;
  }

  beforeAll(async () => {
    repo = new PreschoolFinanceRepository();
    billing = new TuitionBillingService(repo);
    issuance = new InvoiceIssuanceService(repo);
    reconciliation = new PaymentReconciliationService(repo);

    await seedTenant(tenantA, `Preschool Finance Cutover Tenant A ${suffix}`);
    await seedTenant(tenantB, `Preschool Finance Cutover Tenant B ${suffix}`);
    await seedParty(tenantA, studentPartyA, `Student A ${suffix}`);
    await seedParty(tenantA, payerPartyA, `Payer A ${suffix}`);
    await seedParty(tenantA, staffPartyA, `Staff A ${suffix}`);
    await seedParty(tenantB, studentPartyB, `Student B ${suffix}`);
    await seedParty(tenantB, payerPartyB, `Payer B ${suffix}`);
    await seedParty(tenantB, staffPartyB, `Staff B ${suffix}`);

    // Seed active enrollment for studentPartyB in tenantB so payment recording is allowed
    const courseBId = await seedCourse(tenantB);
    await supabase.from('edu_enrollments').insert({
      tenant_id: tenantB,
      student_party_id: studentPartyB,
      course_id: courseBId,
      status: 'active',
      request_id: `finance-cutover-b-${suffix}`,
    });
  }, 30_000);

  it('persists one Student Party ID across enrollment, attendance, invoice, payment, and tenant isolation checks', async () => {
    const courseId = await seedCourse(tenantA);

    const { data: enrollment, error: enrollmentError } = await supabase.from('edu_enrollments').insert({
      tenant_id: tenantA,
      student_party_id: studentPartyA,
      course_id: courseId,
      status: 'active',
      request_id: `finance-cutover-${suffix}`,
    }).select('id, student_party_id').single();

    expect(enrollmentError).toBeNull();
    expect(enrollment?.student_party_id).toBe(studentPartyA);

    const { data: attendance, error: attendanceError } = await supabase.from('edu_attendance').insert({
      tenant_id: tenantA,
      enrollment_id: enrollment!.id,
      status: 'present',
    }).select('id, enrollment_id').single();

    expect(attendanceError).toBeNull();
    expect(attendance?.enrollment_id).toBe(enrollment!.id);

    await repo.createFeeStructure({
      tenantId: tenantA,
      programId: 'PRESCHOOL',
      feeCode: `TUITION-${suffix}`,
      feeName: `Canonical Tuition ${suffix}`,
      feeType: 'TUITION',
      amount: 1000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isActive: true,
    });

    const period = await repo.createBillingPeriod({
      tenantId: tenantA,
      periodName: `Canonical Period ${suffix}`,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      dueDate: '2026-09-15',
      status: 'ACTIVE',
      createdBy: staffPartyA,
    });

    const draft = await billing.compileDraftInvoice({
      tenantId: tenantA,
      studentId: studentPartyA,
      billingPeriodId: period.id,
      dueDate: '2026-09-15',
      createdBy: staffPartyA,
    });

    const issued = await issuance.issueInvoice(tenantA, draft.id);

    const { data: invoiceBeforeIsolation } = await supabase
      .from('edu_fin_invoices')
      .select('student_id, paid_amount, outstanding_amount, settlement_status')
      .eq('id', issued.id)
      .eq('tenant_id', tenantA)
      .single();

    await expect(
      billing.compileDraftInvoice({
        tenantId: tenantB,
        studentId: studentPartyA,
        billingPeriodId: period.id,
        dueDate: '2026-09-15',
        createdBy: staffPartyB,
      })
    ).rejects.toThrow(/STUDENT_PARTY_TENANT_MISMATCH/);

    await expect(
      reconciliation.recordInboundPayment({
        tenantId: tenantB,
        payerPartyId: payerPartyB,
        studentId: studentPartyA,
        paymentMethod: 'BANK_TRANSFER',
        amount: 1000,
        createdBy: staffPartyB,
      })
    ).rejects.toThrow(/STUDENT_PARTY_TENANT_MISMATCH/);

    await expect(
      reconciliation.recordInboundPayment({
        tenantId: tenantB,
        payerPartyId: payerPartyA,
        studentId: studentPartyB,
        paymentMethod: 'BANK_TRANSFER',
        amount: 1000,
        createdBy: staffPartyB,
      })
    ).rejects.toThrow(/PAYER_PARTY_TENANT_MISMATCH/);

    const paymentB = await reconciliation.recordInboundPayment({
      tenantId: tenantB,
      payerPartyId: payerPartyB,
      studentId: studentPartyB,
      paymentMethod: 'BANK_TRANSFER',
      amount: 1000,
      createdBy: staffPartyB,
    });

    await expect(
      reconciliation.reconcilePaymentToInvoice({
        tenantId: tenantB,
        paymentId: paymentB.id,
        invoiceId: issued.id,
        allocationAmount: 1000,
        reconciledByPartyId: staffPartyB,
      })
    ).rejects.toThrow(/INVOICE_NOT_FOUND_ERROR/);

    const { data: invoiceAfterIsolation } = await supabase
      .from('edu_fin_invoices')
      .select('student_id, paid_amount, outstanding_amount, settlement_status')
      .eq('id', issued.id)
      .eq('tenant_id', tenantA)
      .single();

    expect(invoiceAfterIsolation).toEqual(invoiceBeforeIsolation);

    const paymentA = await reconciliation.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: payerPartyA,
      studentId: studentPartyA,
      paymentMethod: 'BANK_TRANSFER',
      amount: 1000,
      createdBy: staffPartyA,
    });

    await reconciliation.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: paymentA.id,
      invoiceId: issued.id,
      allocationAmount: 1000,
      reconciledByPartyId: staffPartyA,
    });

    const { data: persistedInvoice, error: invoiceError } = await supabase
      .from('edu_fin_invoices')
      .select('student_id, paid_amount, outstanding_amount, settlement_status')
      .eq('id', issued.id)
      .eq('tenant_id', tenantA)
      .single();

    const { data: persistedPayment, error: paymentError } = await supabase
      .from('edu_fin_payments')
      .select('student_id, payer_party_id, amount, allocated_amount, unallocated_amount, status')
      .eq('id', paymentA.id)
      .eq('tenant_id', tenantA)
      .single();

    expect(invoiceError).toBeNull();
    expect(paymentError).toBeNull();
    expect(persistedInvoice?.student_id).toBe(studentPartyA);
    expect(persistedInvoice?.settlement_status).toBe('PAID');
    expect(persistedPayment?.student_id).toBe(studentPartyA);
    expect(persistedPayment?.payer_party_id).toBe(payerPartyA);
    expect(Number(persistedPayment?.allocated_amount)).toBe(1000);
  }, 60_000);
});
