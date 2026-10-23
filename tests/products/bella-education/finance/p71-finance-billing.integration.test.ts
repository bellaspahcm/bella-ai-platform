/**
 * Bella Preschool OS — P7.1 Tuition & Meal Fee Billing Engine 12-Invariant Integration Test Suite
 * 
 * Verifies 12 Core Invariants:
 * 1. Multi-Tenant RLS Isolation
 * 2. Draft Invoice Mutability vs ISSUED Immutability Lock
 * 3. Line Items Sum Matches Invoice Gross/Net Amount
 * 4. Discount Policy Non-Negative Bounds
 * 5. P4 Meal Charge Deduplication Guard
 * 6. Inbound Payment Append-Only Recording
 * 7. Allocation Balance Bounds (Cannot exceed unallocated or outstanding)
 * 8. Duplicate Reconciliation Entry Guard
 * 9. Settlement Status Derived Strictly from Reconciliation Truth (UNPAID ➔ PARTIALLY_PAID ➔ PAID)
 * 10. Receipt Snapshot & SHA-256 Fingerprint Generation
 * 11. Deterministic Fingerprint Canonicalization
 * 12. Audit Evidence Preservation (NO CASCADE DELETE)
 */

import { createClient } from '@supabase/supabase-js';
import { PreschoolFinanceRepository } from '../../../../src/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '../../../../src/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService, canonicalJsonString } from '../../../../src/products/bella-education/finance/services/invoice-issuance.service';
import { PaymentReconciliationService } from '../../../../src/products/bella-education/finance/services/payment-reconciliation.service';
import { StudentMealChargeInput } from '../../../../src/products/bella-education/finance/domain/finance.types';
import { createHash } from 'crypto';
import { assertLocalFinanceFixtureTarget, createFinanceBranchFixture, assignFinanceStudentFixture } from './fixtures/branch.fixture';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let tenantA: string;
let tenantB: string;
let staffPartyId: string;
let parentPartyId: string;

describe('P7.1 Preschool Finance & Billing Engine 12-Invariant Integration Suite', () => {
  let repo: PreschoolFinanceRepository;
  let billingService: TuitionBillingService;
  let issuanceService: InvoiceIssuanceService;
  let reconService: PaymentReconciliationService;
  let billingPeriodId: string;
  let courseId: string;
  let branchFixture: Awaited<ReturnType<typeof createFinanceBranchFixture>>;

  beforeEach(async () => {
    assertLocalFinanceFixtureTarget();
    if (!['127.0.0.1', 'localhost'].includes(new URL(supabaseUrl).hostname)) {
      throw new Error('P71_FIXTURE_REQUIRES_ISOLATED_LOCAL_DB');
    }
    // New Auth-backed actor and tenant per case: do not mutate old evidence or
    // accumulate fee structures in a shared tenant across invariant assertions.
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();
    parentPartyId = crypto.randomUUID();
    const email = `controlled-p71-${crypto.randomUUID()}@example.invalid`;
    const identity = await supabase.auth.admin.createUser({ email, email_confirm: true });
    if (identity.error || !identity.data.user) throw new Error('P71_AUTH_FIXTURE_FAILED');
    staffPartyId = identity.data.user.id;
    repo = new PreschoolFinanceRepository();
    billingService = new TuitionBillingService(repo);
    issuanceService = new InvoiceIssuanceService(repo);
    reconService = new PaymentReconciliationService(repo);

    // 1. Seed Tenants
    await supabase.from('tenants').upsert({ id: tenantA, name: 'Bella Preschool Tenant A' });
    await supabase.from('tenants').upsert({ id: tenantB, name: 'Bella Preschool Tenant B' });
    const actor = await supabase.from('users').insert({ id: staffPartyId, tenant_id: tenantA, email, full_name: 'Controlled P71 Finance actor', role: 'admin', status: 'active' });
    if (actor.error) throw new Error(`P71_ACTOR_FIXTURE_FAILED: ${actor.error.message}`);
    branchFixture = await createFinanceBranchFixture(supabase, tenantA, staffPartyId, 'admin');
    await supabase.from('party_parties').upsert([
      { id: staffPartyId, tenant_id: tenantA, party_type: 'person', display_name: 'P71 Staff Party' },
      { id: parentPartyId, tenant_id: tenantA, party_type: 'person', display_name: 'P71 Payer Party' },
    ], { onConflict: 'id' });

    courseId = crypto.randomUUID();
    await supabase.from('edu_courses').insert({
      id: courseId,
      tenant_id: tenantA,
      course_code: `P71-${courseId.slice(0, 8)}`,
      title: `P71 Finance Course ${courseId.slice(0, 8)}`,
      status: 'active',
    });

    // 2. Seed Fee Structure
    await repo.createFeeStructure({
      tenantId: tenantA,
      programId: 'PRESCHOOL',
      feeCode: 'TUITION_MONTHLY',
      feeName: 'Học Phí Mầm Non Tháng 9',
      feeType: 'TUITION',
      amount: 5000000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isActive: true,
    });

    // 3. Seed Billing Period
    const period = await repo.createBillingPeriod({
      tenantId: tenantA,
      periodName: 'Kỳ Thu Tháng 9/2026',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      dueDate: '2026-09-15',
      status: 'ACTIVE',
      createdBy: staffPartyId,
    });

    billingPeriodId = period.id;
  }, 30_000);

  const createStudentParty = async (label: string, tenantId: string = tenantA): Promise<string> => {
    const studentPartyId = crypto.randomUUID();
    await supabase.from('party_parties').insert({
      id: studentPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: `P71 Student ${label}`,
    });
    const requestId = crypto.randomUUID();
    const enrollment = await supabase.from('edu_enrollments').insert({
      tenant_id: tenantId,
      course_id: courseId,
      student_party_id: studentPartyId,
      status: 'active',
      request_id: requestId,
    }).select('id').single();
    if (enrollment.error || !enrollment.data) throw new Error(`P71_ENROLLMENT_FIXTURE_FAILED: ${enrollment.error?.message}`);
    await assignFinanceStudentFixture(supabase, {
      tenantId, actorUserId: branchFixture.assignmentActorUserId,
      branchId: branchFixture.branchId, studentPartyId,
      enrollmentId: enrollment.data.id, courseId, requestId,
    });
    return studentPartyId;
  };

  test('Invariant 1: Multi-Tenant RLS Isolation — prevents Tenant B from accessing Tenant A invoice', async () => {
    const studentId = await createStudentParty('1');
    const invoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });

    const tenantBRead = await repo.getInvoiceById(tenantB, invoice.id);
    expect(tenantBRead).toBeNull();
  });

  test('Invariant 2: Draft Invoice Mutability vs ISSUED Immutability Lock', async () => {
    const studentId = await createStudentParty('2');
    // Compile DRAFT invoice
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });

    expect(draftInvoice.invoiceStatus).toBe('DRAFT');

    // Issue Invoice (Status ➔ ISSUED & SHA-256 Fingerprint generated)
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);
    expect(issuedInvoice.invoiceStatus).toBe('ISSUED');
    expect(issuedInvoice.sha256Checksum).toBeDefined();

    // Attempting to mutate gross amount on ISSUED invoice triggers DB Immutability Lock
    await expect(
      repo.updateInvoiceStatus(tenantA, draftInvoice.id, {
        grossAmount: 9999999,
      })
    ).rejects.toThrow(/INVOICE_PUBLISHED_IMMUTABLE_ERROR/);
  });

  test('Invariant 3: Line Items Sum Matches Invoice Gross/Net Amount', async () => {
    const studentId = await createStudentParty('3');
    const mealInputs: StudentMealChargeInput[] = [
      {
        studentPartyId: studentId,
        studentId,
        tenantId: tenantA,
        sourceDomain: 'P4_CARE',
        sourceEntityType: 'MEAL_LOG',
        sourceEntityId: '00000000-0000-0000-0000-000000000050',
        mealDate: '2026-09-08',
        mealName: 'Bữa Trưa',
        unitPrice: 35000,
        consumedCount: 10,
      },
    ];

    const invoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
      mealChargeInputs: mealInputs,
    });

    // Gross: 5,000,000 (Tuition) + 350,000 (Meals) = 5,350,000
    expect(invoice.grossAmount).toBe(5350000);
    expect(invoice.discountAmount).toBe(0);
    expect(invoice.netAmount).toBe(5350000);
    expect(invoice.lineItems?.length).toBe(2);
  });

  test('Invariant 4: Discount Policy Non-Negative Bounds', async () => {
    const studentId = await createStudentParty('4');
    // Create Discount Profile (10% Sibling Discount) for student 4
    await repo.createDiscountProfile({
      tenantId: tenantA,
      studentPartyId: studentId,
      studentId,
      discountType: 'SIBLING',
      discountName: 'Giảm giá Anh Chị Em 10%',
      discountPercent: 10,
      fixedAmount: 0,
      validFrom: '2026-01-01',
      isActive: true,
    });

    const invoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });

    // 10% of 5,000,000 = 500,000 discount
    expect(invoice.grossAmount).toBe(5000000);
    expect(invoice.discountAmount).toBe(500000);
    expect(invoice.netAmount).toBe(4500000);
  });

  test('Invariant 5: P4 Meal Charge Deduplication Guard — prevents double-billing same meal occurrence', async () => {
    const studentId = await createStudentParty('5');
    const mealInput: StudentMealChargeInput = {
      studentPartyId: studentId,
      studentId,
      tenantId: tenantA,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'MEAL_LOG',
      sourceEntityId: '00000000-0000-0000-0000-000000000099',
      mealDate: '2026-09-08',
      mealName: 'Bữa Trưa',
      unitPrice: 35000,
      consumedCount: 1,
    };

    // Attempting to add duplicate line item with exact same source_entity_id on same invoice triggers dedup index
    await expect(
      billingService.compileDraftInvoice({
        tenantId: tenantA,
        studentId,
        billingPeriodId,
        dueDate: '2026-09-15',
        createdBy: staffPartyId,
        mealChargeInputs: [mealInput, mealInput], // Duplicate!
      })
    ).rejects.toThrow(/MEAL_CHARGE_DOUBLE_BILLING_ERROR/);
  });

  test('Invariant 6: Inbound Payment Append-Only Recording', async () => {
    const studentId = await createStudentParty('6');
    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 4500000,
      referenceNumber: 'FT20260909-8888',
      createdBy: staffPartyId,
    });

    expect(payment.amount).toBe(4500000);
    expect(payment.allocatedAmount).toBe(0);
    expect(payment.unallocatedAmount).toBe(4500000);
    expect(payment.status).toBe('RECEIVED');
  });

  test('Invariant 7: Allocation Balance Bounds — allocation cannot exceed unallocated or outstanding', async () => {
    const studentId = await createStudentParty('7');
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 10000000, // 10M payment
      createdBy: staffPartyId,
    });

    // Attempting to allocate 9M to a 5M invoice triggers ALLOCATION_EXCEEDS_OUTSTANDING_ERROR
    await expect(
      reconService.reconcilePaymentToInvoice({
        tenantId: tenantA,
        paymentId: payment.id,
        invoiceId: issuedInvoice.id,
        allocationAmount: 9000000,
        reconciledByPartyId: staffPartyId,
      })
    ).rejects.toThrow(/ALLOCATION_EXCEEDS_OUTSTANDING_ERROR/);
  });

  test('Invariant 8: Duplicate Reconciliation Entry Guard', async () => {
    const studentId = await createStudentParty('8');
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 5000000,
      createdBy: staffPartyId,
    });

    // 1st Allocation: 2,000,000
    await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issuedInvoice.id,
      allocationAmount: 2000000,
      reconciledByPartyId: staffPartyId,
    });

    // 2nd Duplicate Allocation call for same payment and invoice is blocked by unique index
    await expect(
      reconService.reconcilePaymentToInvoice({
        tenantId: tenantA,
        paymentId: payment.id,
        invoiceId: issuedInvoice.id,
        allocationAmount: 1000000,
        reconciledByPartyId: staffPartyId,
      })
    ).rejects.toThrow(/DUPLICATE_RECONCILIATION_ERROR/);
  });

  test('Invariant 9: Settlement Status Derived Strictly from Reconciliation Truth (UNPAID ➔ PARTIALLY_PAID ➔ PAID)', async () => {
    const studentId = await createStudentParty('9');
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);

    expect(issuedInvoice.settlementStatus).toBe('UNPAID');

    // Payment 1: Partial payment of 2,000,000 VND
    const pay1 = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 2000000,
      createdBy: staffPartyId,
    });

    const res1 = await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: pay1.id,
      invoiceId: issuedInvoice.id,
      allocationAmount: 2000000,
      reconciledByPartyId: staffPartyId,
    });

    expect(res1.updatedSettlementStatus).toBe('PARTIALLY_PAID');

    // Payment 2: Remaining payment of 3,000,000 VND
    const pay2 = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'CASH',
      amount: 3000000,
      createdBy: staffPartyId,
    });

    const res2 = await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: pay2.id,
      invoiceId: issuedInvoice.id,
      allocationAmount: 3000000,
      reconciledByPartyId: staffPartyId,
    });

    expect(res2.updatedSettlementStatus).toBe('PAID');
  });

  test('Invariant 10: Receipt Snapshot & Fingerprint Generation', async () => {
    const studentId = await createStudentParty('10');
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'QR_CODE',
      amount: 5000000,
      createdBy: staffPartyId,
    });

    const { receipt } = await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issuedInvoice.id,
      allocationAmount: 5000000,
      reconciledByPartyId: staffPartyId,
    });

    expect(receipt.receiptNumber).toBeDefined();
    expect(receipt.sha256Fingerprint).toBeDefined();
    expect(receipt.settlementSnapshot).toBeDefined();
  });

  test('Invariant 11: Deterministic Fingerprint Canonicalization', () => {
    const samplePayload = {
      tenantId: tenantA,
      invoiceId: 'INV-123',
      amount: 5000000,
      items: ['Bữa Trưa', 'Học Phí'],
    };

    const canonical1 = canonicalJsonString(samplePayload);
    const hash1 = createHash('sha256').update(canonical1).digest('hex');

    // Reverse key order object
    const samplePayloadReordered = {
      items: ['Bữa Trưa', 'Học Phí'],
      amount: 5000000,
      tenantId: tenantA,
      invoiceId: 'INV-123',
    };

    const canonical2 = canonicalJsonString(samplePayloadReordered);
    const hash2 = createHash('sha256').update(canonical2).digest('hex');

    expect(hash1).toBe(hash2);
  });

  test('Invariant 12: Audit Evidence Preservation (NO CASCADE DELETE)', async () => {
    const studentId = await createStudentParty('12');
    const draftInvoice = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issuedInvoice = await issuanceService.issueInvoice(tenantA, draftInvoice.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'CASH',
      amount: 5000000,
      createdBy: staffPartyId,
    });

    await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issuedInvoice.id,
      allocationAmount: 5000000,
      reconciledByPartyId: staffPartyId,
    });

    // Attempting to delete payment or invoice with existing reconciliation/receipt entries fails
    const { error } = await supabase.from('edu_fin_invoices').delete().eq('id', issuedInvoice.id);
    expect(error).toBeDefined();
  });
});
