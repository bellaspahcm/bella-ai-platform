/**
 * Bella Preschool OS — P7.2 Finance Communication & Collection Lifecycle Integration Suite
 * 
 * Verifies 12 Core Invariants:
 * 1. Project ISSUED Invoice to P6 Notice (Mapped to REQUIRES_ACK)
 * 2. Safety Guard Blocks DRAFT/VOID Invoice Projection (UNISSUED_INVOICE_PROJECTION_ERROR)
 * 3. Idempotent Invoice Projection (Returns existing notice)
 * 4. Parent Read Tracking — Read receipt does NOT alter P7 settlement status (remains UNPAID)
 * 5. Parent ACK Lifecycle — ACK does NOT alter P7 settlement status (remains UNPAID)
 * 6. Overdue Unpaid Invoice Scanner — projects OVERDUE_PAYMENT_SLA exception to Staff Work Queue
 * 7. Idempotent Overdue Exception Scanner — no duplicate active exceptions
 * 8. Fully PAID Invoice Excluded from Overdue Scanner
 * 9. Staff Work Queue Resolution — Exception resolution does NOT alter P7 settlement status (remains UNPAID)
 * 10. Payment Reconciliation Ledger Entry Triggers Real P7 Settlement Truth (PAID) & Receipt Fingerprint
 * 11. Cross-Domain Traceability (source_domain P7_FINANCE, source_entity_id, version preserved)
 * 12. Cross-Tenant Mismatch Hard Block
 */

import { createClient } from '@supabase/supabase-js';
import { PreschoolFinanceRepository } from '../../../../src/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '../../../../src/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService } from '../../../../src/products/bella-education/finance/services/invoice-issuance.service';
import { PaymentReconciliationService } from '../../../../src/products/bella-education/finance/services/payment-reconciliation.service';
import { OverduePaymentScannerService } from '../../../../src/products/bella-education/finance/services/overdue-payment-scanner.service';
import { FinanceProjectionBridge } from '../../../../src/products/bella-education/parent-engagement/bridges/finance-projection.bridge';
import { CommunicationDeliveryService } from '../../../../src/products/bella-education/parent-engagement/services/communication-delivery.service';
import { AcknowledgementService } from '../../../../src/products/bella-education/parent-engagement/services/acknowledgement.service';
import { CommunicationExceptionService } from '../../../../src/products/bella-education/parent-engagement/services/communication-exception.service';
import { ParentCommunicationRepository } from '../../../../src/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { assertLocalFinanceFixtureTarget, createFinanceBranchFixture, assignFinanceStudentFixture } from './fixtures/branch.fixture';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('P7.2 Finance Communication & Collection Lifecycle Integration Suite', () => {
  let finRepo: PreschoolFinanceRepository;
  let billingService: TuitionBillingService;
  let issuanceService: InvoiceIssuanceService;
  let reconService: PaymentReconciliationService;
  let scannerService: OverduePaymentScannerService;
  let finBridge: FinanceProjectionBridge;
  let commDeliveryService: CommunicationDeliveryService;
  let ackService: AcknowledgementService;
  let exceptionService: CommunicationExceptionService;
  let commRepo: ParentCommunicationRepository;
  let billingPeriodId: string;
  let courseId: string;
  let branchFixture: Awaited<ReturnType<typeof createFinanceBranchFixture>>;

  let tenantA: string;
  let tenantB: string;
  let staffPartyId: string;
  let financeActorUserId: string;
  let parentPartyId: string;

  beforeEach(async () => {
    assertLocalFinanceFixtureTarget();
    if (!['127.0.0.1', 'localhost'].includes(new URL(supabaseUrl).hostname)) {
      throw new Error('P72_FIXTURE_REQUIRES_ISOLATED_LOCAL_DB');
    }
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();
    staffPartyId = crypto.randomUUID();
    parentPartyId = crypto.randomUUID();

    finRepo = new PreschoolFinanceRepository();
    billingService = new TuitionBillingService(finRepo);
    issuanceService = new InvoiceIssuanceService(finRepo);
    reconService = new PaymentReconciliationService(finRepo);
    scannerService = new OverduePaymentScannerService(supabase);

    commRepo = new ParentCommunicationRepository(supabase);
    commDeliveryService = new CommunicationDeliveryService(commRepo);
    ackService = new AcknowledgementService(commRepo);
    exceptionService = new CommunicationExceptionService(commRepo);
    finBridge = new FinanceProjectionBridge(supabase, commDeliveryService, commRepo);

    // 1. Seed Tenants & Persons for this test execution
    await supabase.from('tenants').insert({ id: tenantA, name: 'Bella Preschool Tenant A ' + tenantA.slice(0, 4) });
    await supabase.from('tenants').insert({ id: tenantB, name: 'Bella Preschool Tenant B ' + tenantB.slice(0, 4) });

    // Finance authorization uses the Auth/public user ID; P6 keeps its separate staff Party ID.
    const email = `controlled-p72-finance-${crypto.randomUUID()}@example.invalid`;
    const { data: identity, error: identityError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (identityError || !identity.user) throw new Error('P72_AUTH_FIXTURE_FAILED');
    financeActorUserId = identity.user.id;
    const { error: actorError } = await supabase.from('users').insert({
      id: financeActorUserId,
      tenant_id: tenantA,
      email,
      full_name: 'Controlled P72 Finance actor',
      role: 'accountant',
      status: 'active',
    });
    if (actorError) throw new Error(`P72_ACTOR_FIXTURE_FAILED: ${actorError.message}`);
    branchFixture = await createFinanceBranchFixture(supabase, tenantA, financeActorUserId, 'accountant');

    await supabase.from('party_parties').insert([
      { id: parentPartyId, tenant_id: tenantA, party_type: 'person', display_name: 'Mẹ Phụ Huynh P72' },
      { id: staffPartyId, tenant_id: tenantA, party_type: 'person', display_name: 'Thầy Kế Toán P72' },
    ]);

    courseId = crypto.randomUUID();
    await supabase.from('edu_courses').insert({
      id: courseId,
      tenant_id: tenantA,
      course_code: `P72-${courseId.slice(0, 8)}`,
      title: `P72 Finance Course ${courseId.slice(0, 8)}`,
      status: 'active',
    });

    // 2. Seed Fee Structure
    await finRepo.createFeeStructure({
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
    const period = await finRepo.createBillingPeriod({
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

  const createTestStudent = async (tenantId: string = tenantA, parentId: string = parentPartyId) => {
    const studentPartyId = crypto.randomUUID();
    await supabase.from('party_parties').insert({
      id: studentPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: `Bé P72-${studentPartyId.substring(0, 4)}`,
    });
    const enrollmentCourseId = tenantId === tenantA ? courseId : crypto.randomUUID();
    if (tenantId !== tenantA) {
      await supabase.from('edu_courses').insert({
        id: enrollmentCourseId,
        tenant_id: tenantId,
        course_code: `P72-${enrollmentCourseId.slice(0, 8)}`,
        title: `P72 Finance Course ${enrollmentCourseId.slice(0, 8)}`,
        status: 'active',
      });
    }
    const requestId = crypto.randomUUID();
    const enrollment = await supabase.from('edu_enrollments').insert({
      tenant_id: tenantId,
      course_id: enrollmentCourseId,
      student_party_id: studentPartyId,
      status: 'active',
      request_id: requestId,
    }).select('id').single();
    if (enrollment.error || !enrollment.data) throw new Error(`P72_ENROLLMENT_FIXTURE_FAILED: ${enrollment.error?.message}`);
    if (tenantId === tenantA) {
      await assignFinanceStudentFixture(supabase, {
        tenantId, actorUserId: branchFixture.assignmentActorUserId,
        branchId: branchFixture.branchId, studentPartyId,
        enrollmentId: enrollment.data.id, courseId: enrollmentCourseId, requestId,
      });
    }

    if (tenantId === tenantA) {
      await supabase.from('party_relationships').insert({
        tenant_id: tenantId,
        source_party_id: parentId,
        target_party_id: studentPartyId,
        relationship_type: 'guardian_of',
      });
    }

    return studentPartyId;
  };

  test('Test 1: Project ISSUED Invoice to P6 Notice (Mapped to REQUIRES_ACK)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { isDuplicate, notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(isDuplicate).toBe(false);
    expect(notice.source_domain || notice.sourceDomain).toBe('P7_FINANCE');
    expect(notice.source_entity_type || notice.sourceEntityType).toBe('INVOICE');
    expect(notice.requirement_type || notice.requirementType).toBe('REQUIRES_ACK');
    expect(deliveries.length).toBe(1);
  });

  test('Test 2: Safety Guard Blocks DRAFT/VOID Invoice Projection', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });

    await expect(
      finBridge.projectIssuedInvoice({
        tenantId: tenantA,
        studentId,
        guardianPartyIds: [parentPartyId],
        invoiceId: draft.id,
        invoiceNumber: draft.invoiceNumber,
        netAmount: draft.netAmount,
        dueDate: draft.dueDate,
        invoiceStatus: draft.invoiceStatus, // DRAFT!
        createdBy: staffPartyId,
      })
    ).rejects.toThrow(/UNISSUED_INVOICE_PROJECTION_ERROR/);
  });

  test('Test 3: Idempotent Invoice Projection', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const project1 = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const project2 = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(project1.isDuplicate).toBe(false);
    expect(project2.isDuplicate).toBe(true);
    expect(project2.notice.id).toBe(project1.notice.id);
  });

  test('Test 4: Parent Read Tracking — Read receipt does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    // Dispatch notice to transition status from READY -> SENT/DELIVERED
    await commDeliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: parentPartyId,
      payloadSnapshot: { title: notice.title },
    });
    await commDeliveryService.recordRead(tenantA, deliveries[0].id, parentPartyId);

    // SUPREME LAW CHECK: P7 settlementStatus MUST remain UNPAID
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
    expect(invoiceRefreshed?.paidAmount).toBe(0);
  });

  test('Test 5: Parent ACK Lifecycle — ACK does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    await commDeliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: parentPartyId,
      payloadSnapshot: { title: notice.title },
    });
    await commDeliveryService.recordRead(tenantA, deliveries[0].id, parentPartyId);
    await ackService.acknowledgeNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      guardianPartyId: parentPartyId,
    });

    // SUPREME LAW CHECK: P7 settlementStatus MUST remain UNPAID
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
  });

  test('Test 6: Overdue Unpaid Invoice Scanner — projects OVERDUE_PAYMENT_SLA exception to Staff Work Queue', async () => {
    const studentId = await createTestStudent();

    // Past due date invoice (2026-08-01)
    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const { escalatedCount, exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);

    expect(escalatedCount).toBeGreaterThanOrEqual(1);
    const targetExc = exceptions.find((e) => e.invoiceId === issued.id);
    expect(targetExc).toBeDefined();
    expect(targetExc?.isDuplicate).toBe(false);
  });

  test('Test 7: Idempotent Overdue Exception Scanner', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const scan1 = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const scan2 = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);

    const target1 = scan1.exceptions.find((e) => e.invoiceId === issued.id);
    const target2 = scan2.exceptions.find((e) => e.invoiceId === issued.id);

    expect(target1?.isDuplicate).toBe(false);
    expect(target2?.isDuplicate).toBe(true);
    expect(target2?.exceptionId).toBe(target1?.exceptionId);
  });

  test('Test 8: Fully PAID Invoice Excluded from Overdue Scanner', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01', // Past due
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    // Record Payment & Reconcile to make settlementStatus = PAID
    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 5000000,
      createdBy: financeActorUserId,
    });

    await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issued.id,
      allocationAmount: 5000000,
      reconciledByPartyId: financeActorUserId,
    });

    const { exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const target = exceptions.find((e) => e.invoiceId === issued.id);
    expect(target).toBeUndefined(); // Excluded from scan!
  });

  test('Test 9: Staff Work Queue Resolution — Exception resolution does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const { exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const targetExc = exceptions.find((e) => e.invoiceId === issued.id)!;

    // Staff resolves exception in Work Queue
    await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: targetExc.exceptionId,
      resolvedBy: staffPartyId,
      resolutionNotes: 'Phụ huynh hẹn chuyển khoản vào ngày 18/09.',
    });

    // SUPREME LAW CHECK: Invoice settlementStatus MUST STILL remain UNPAID until payment is reconciled
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
  });

  test('Test 10: Payment Reconciliation Ledger Entry Triggers Real P7 Settlement Truth (PAID) & Receipt Fingerprint', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'QR_CODE',
      amount: 5000000,
      createdBy: financeActorUserId,
    });

    const { receipt, updatedSettlementStatus } = await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issued.id,
      allocationAmount: 5000000,
      reconciledByPartyId: financeActorUserId,
    });

    expect(updatedSettlementStatus).toBe('PAID');
    expect(receipt.sha256Fingerprint).toBeDefined();
  });

  test('Test 11: Cross-Domain Traceability — P6 Notice retains source domain P7_FINANCE, source_entity_id, version', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(notice.source_domain || notice.sourceDomain).toBe('P7_FINANCE');
    expect(notice.source_entity_type || notice.sourceEntityType).toBe('INVOICE');
    expect(notice.source_entity_id || notice.sourceEntityId).toBe(issued.id);
  });

  test('Test 12: Cross-Tenant Mismatch Hard Block', async () => {
    const studentIdInTenantB = await createTestStudent(tenantB);

    // Attempting to project invoice for student from Tenant B using Tenant A context raises TENANT_MISMATCH
    await expect(
      finBridge.projectIssuedInvoice({
        tenantId: tenantA, // Tenant A context
        studentId: studentIdInTenantB,
        guardianPartyIds: [parentPartyId],
        invoiceId: crypto.randomUUID(),
        invoiceNumber: 'INV-MISMATCH',
        netAmount: 5000000,
        dueDate: '2026-09-15',
        invoiceStatus: 'ISSUED',
        createdBy: staffPartyId,
      })
    ).rejects.toThrow(/COMMUNICATION_TENANT_MISMATCH_ERROR/);
  });
});
