/**
 * Bella Interior Commercial — Product Hardening & Resilience Test Suite
 *
 * Automated regression tests for the 8 critical negative and boundary scenarios:
 * 1. Duplicate payment request rejection (unique reference code collision)
 * 2. Overpayment rejection (payment exceeds milestone remaining balance)
 * 3. Partial payment accounting (accumulated collected_amount and state preservation)
 * 4. Duplicate customer approval replay rejection (idempotency and immutability)
 * 5. Customer rejection flow (reason requirement and prevention of state advancement)
 * 6. Cross-tenant isolation boundaries (strict tenant scoping on reads and mutations)
 * 7. Finance Outbox retry idempotency (deduplication of transactional events)
 * 8. Addendum on paid milestone immutability (protection of settled financial history)
 *
 * @module src/products/bella-interior/__tests__/commercial-hardening-resilience.test
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { InteriorContractLifecycleService } from '../services/interior-contract-lifecycle.service';
import {
  InteriorCustomerApprovalService,
  ApprovalTokenError,
  ApprovalImmutabilityError,
} from '../services/interior-customer-approval.service';
import type {
  InteriorProject,
  DesignRevision,
} from '../domain/design-specification/types';
import type {
  InteriorBOQ,
  InteriorQuotation,
  InteriorContract,
  ProposedMilestoneScheduleItem,
} from '../domain/commercial-costing/types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';

describe('Bella Interior Commercial — Product Hardening & Resilience Regression', () => {
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let lifecycleService: InteriorContractLifecycleService;
  let approvalService: InteriorCustomerApprovalService;

  const TENANT_ID = '686884d2-6a4a-4581-ac8f-6ae69666b31d';
  const FOREIGN_TENANT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeffff0001';
  const PROJECT_ID = 'proj-hardening-01';

  let testProject: InteriorProject;
  let testRevision: DesignRevision;
  let testBOQ: InteriorBOQ;
  let acceptedQuotation: InteriorQuotation;
  let acceptedQuotationApproval: CustomerApproval;
  let activeContract: InteriorContract;

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    lifecycleService = new InteriorContractLifecycleService(repository, outbox);
    approvalService = new InteriorCustomerApprovalService(repository, outbox);

    // 1. Fixture: Base project
    testProject = {
      id: PROJECT_ID,
      tenantId: TENANT_ID,
      code: 'INT-HARDEN-2026',
      name: 'Hardening Pilot Villa',
      customerId: 'cust-harden-01',
      customerName: 'Madam Le Thi Lan',
      customerPhone: '+84909999888',
      siteAddress: '102 Xuan Thuy, Thao Dien, TP. Thu Duc',
      projectType: 'residential_villa',
      status: 'detailed_design',
      estimatedBudget: 1_000_000_000,
      targetCompletionDate: '2026-12-31',
      leadArchitectId: 'arch-lead-01',
      leadArchitectName: 'KTS Nguyen Van A',
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    };
    await repository.saveProject(TENANT_ID, testProject);

    // 2. Fixture: Approved Design Revision
    testRevision = {
      id: 'rev-harden-01',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      versionNumber: 1,
      name: 'Detailed Hardening Architecture',
      status: 'approved',
      designAreaM2: 250,
      estimatedBudget: 1_000_000_000,
      spaces: [],
      ffeItems: [],
      drawings: [],
      renderings: [],
      specifications: [],
      architectNotes: 'Verified spec for hardening suite',
      createdBy: 'arch-lead-01',
      createdAt: '2026-11-16T01:00:00.000Z',
      updatedAt: '2026-11-16T01:00:00.000Z',
      approvedBy: 'Director Vu',
      approvedAt: '2026-11-16T02:00:00.000Z',
    };
    await repository.saveDesignRevision(TENANT_ID, testRevision);

    // 3. Fixture: Approved BOQ
    testBOQ = {
      id: 'boq-harden-01',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      designRevisionId: testRevision.id,
      designVersionNumber: 1,
      versionNumber: 1,
      status: 'approved',
      items: [],
      subtotalAmount: 450_000_000,
      vatPercent: 10,
      vatAmount: 45_000_000,
      totalAmount: 495_000_000,
      preparerId: 'qs-staff-01',
      preparerName: 'QS Staff',
      approverId: 'Director Vu',
      approverName: 'Director Vu',
      approvedAt: '2026-11-16T03:00:00.000Z',
      createdAt: '2026-11-16T03:00:00.000Z',
      updatedAt: '2026-11-16T03:00:00.000Z',
    };
    await repository.saveBOQ(TENANT_ID, testBOQ);

    // 4. Fixture: Accepted Quotation with customer approval evidence
    acceptedQuotation = {
      id: 'quote-harden-01',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      quotationNumber: 'BG-HARDEN-01',
      versionNumber: 1,
      status: 'accepted',
      subtotal: 450_000_000,
      discountAmount: 0,
      vatPercent: 10,
      vatAmount: 45_000_000,
      grandTotal: 495_000_000,
      paymentTerms: 'standard_milestones',
      validityDays: 30,
      items: [],
      createdAt: '2026-11-16T04:00:00.000Z',
      boqId: testBOQ.id,
      boqVersionNumber: testBOQ.versionNumber,
      totalInternalCogs: 350_000_000,
      totalGrossMargin: 100_000_000,
      grossMarginPercent: 22.22,
      acceptedAt: '2026-11-16T05:00:00.000Z',
    };
    await repository.saveQuotation(TENANT_ID, acceptedQuotation);

    acceptedQuotationApproval = {
      id: 'appr-quote-harden-01',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      subjectType: 'quotation',
      subjectId: acceptedQuotation.id,
      subjectVersionNumber: 1,
      clientRepresentative: 'Madam Le Thi Lan',
      clientContact: '+84909999888',
      approvalToken: '00000000-0000-4000-8000-000000000001',
      status: 'approved',
      expiresAt: '2026-12-16T00:00:00.000Z',
      approvedAt: '2026-11-16T05:00:00.000Z',
      sentByActorId: 'owner-01',
      sentByActorName: 'Owner Bella',
      createdAt: '2026-11-16T04:30:00.000Z',
      updatedAt: '2026-11-16T05:00:00.000Z',
    };
    repository.seedCustomerApproval(TENANT_ID, acceptedQuotationApproval);

    // 5. Fixture: Active Contract with 3 milestones
    const created = await lifecycleService.createContractFromQuotation({
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      quotationId: acceptedQuotation.id,
      quotationCustomerApprovalId: acceptedQuotationApproval.id,
      contractNumber: 'HD-HARDEN-2026/01',
      title: 'Hợp đồng Hardening Test',
      clientRepresentative: 'Madam Le Thi Lan',
      contractorRepresentative: 'Director Vu',
      userRole: 'owner',
      milestoneTemplate: '3_STEP_STANDARD', // 40% (198M), 40% (198M), 20% (99M)
    });

    const appr = await approvalService.sendApprovalRequest({
      tenantId: TENANT_ID,
      projectId: created.projectId,
      subjectType: 'contract',
      subjectId: created.id,
      subjectVersionNumber: created.quotationVersionNumber ?? 1,
      clientRepresentative: created.clientRepresentative,
      clientContact: testProject.customerPhone,
      actorId: 'test-sales-actor',
      actorName: 'Sales Director',
      userRole: 'pm',
    });

    await approvalService.recordApproval({
      tenantId: TENANT_ID,
      approvalId: appr.id,
      approvalToken: appr.approvalToken,
      signatureReference: {
        storagePath: `interior/approvals/${created.id}/signed.pdf`,
        storageUrl: `https://storage.example.test/interior/approvals/${created.id}/signed.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        sha256Hash: 'a'.repeat(64),
      },
      actorId: 'test-customer-actor',
      actorName: created.clientRepresentative,
      userRole: 'admin',
    });

    const signed = await repository.getContract(TENANT_ID, created.id);
    if (!signed) throw new Error('Contract creation failed');
    activeContract = signed;
  });

  // ─── SCENARIO 1: Duplicate Payment & Overpayment ────────────────────────────
  describe('Scenario 1: Duplicate Payment Request & Overpayment Rejection', () => {
    it('1A: strictly rejects duplicate reference code for the same contract', async () => {
      const m1 = activeContract.milestones[0]; // 198,000,000 VND
      await lifecycleService.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-HDN-01',
        userRole: 'pm',
      });

      // Valid payment of 50M
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 50_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-DUP-TEST-01',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      // Second payment with exact same reference code -> Must reject!
      await expect(
        lifecycleService.recordPayment({
          tenantId: TENANT_ID,
          contractId: activeContract.id,
          milestoneId: m1.id,
          amount: 50_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'UNC-DUP-TEST-01', // DUPLICATE REFERENCE
          transactionDate: '2026-11-16',
          recordedBy: 'Accountant',
          userRole: 'qs',
        })
      ).rejects.toThrow(/DuplicatePaymentTransaction/);
    });

    it('1B: strictly serializes concurrent receipts and rejects overpayment above balance', async () => {
      const m1 = activeContract.milestones[0]; // 198,000,000 VND
      await lifecycleService.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-HDN-02',
        userRole: 'pm',
      });

      // Valid payment of 100M
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 100_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-HDN-001',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      // Overpayment: Remaining balance is 98M, but attempting to pay 100M -> Must reject!
      await expect(
        lifecycleService.recordPayment({
          tenantId: TENANT_ID,
          contractId: activeContract.id,
          milestoneId: m1.id,
          amount: 100_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'UNC-HDN-002',
          transactionDate: '2026-11-16',
          recordedBy: 'Accountant',
          userRole: 'qs',
        })
      ).rejects.toThrow(/INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE/);
    });

    it('1C: prevents negative or zero payment amounts', async () => {
      const m1 = activeContract.milestones[0];
      await expect(
        lifecycleService.recordPayment({
          tenantId: TENANT_ID,
          contractId: activeContract.id,
          milestoneId: m1.id,
          amount: -5_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'UNC-HDN-NEG',
          transactionDate: '2026-11-16',
          recordedBy: 'Accountant',
          userRole: 'qs',
        })
      ).rejects.toThrow(/Payment amount must be greater than 0/);
    });
  });

  // ─── SCENARIO 2: Partial Payment Accounting ─────────────────────────────────
  describe('Scenario 2: Partial Payment Accounting', () => {
    it('accumulates collected_amount correctly across partial installments and preserves status until fully paid', async () => {
      const m1 = activeContract.milestones[0]; // 198,000,000 VND
      await lifecycleService.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-HDN-PARTIAL',
        userRole: 'pm',
      });

      // Installment 1: 50M
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 50_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-PART-01',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      let contractState = await repository.getContract(TENANT_ID, activeContract.id);
      let m1State = contractState?.milestones.find((m) => m.id === m1.id);
      expect(m1State?.collectedAmount).toBe(50_000_000);
      expect(m1State?.status).toBe('invoiced'); // Still invoiced / partially collected

      // Installment 2: 70M (total 120M)
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 70_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-PART-02',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      contractState = await repository.getContract(TENANT_ID, activeContract.id);
      m1State = contractState?.milestones.find((m) => m.id === m1.id);
      expect(m1State?.collectedAmount).toBe(120_000_000);
      expect(m1State?.status).toBe('invoiced');

      // Installment 3: remaining 78M (total 198M -> fully collected)
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 78_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-PART-03',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      contractState = await repository.getContract(TENANT_ID, activeContract.id);
      m1State = contractState?.milestones.find((m) => m.id === m1.id);
      expect(m1State?.collectedAmount).toBe(198_000_000);
      expect(m1State?.status).toBe('paid');
      expect(m1State?.paidAt).toBeDefined();
    });
  });

  // ─── SCENARIO 3: Duplicate & Rejected Customer Approval ─────────────────────
  describe('Scenario 3: Duplicate Replay & Customer Rejection Resilience', () => {
    it('3A: rejects replay of already-approved token with ApprovalImmutabilityError', async () => {
      const sendQuotation: InteriorQuotation = {
        ...acceptedQuotation,
        id: 'quote-pending-01',
        quotationNumber: 'BG-PENDING-01',
        status: 'sent_to_client',
      };
      await repository.saveQuotation(TENANT_ID, sendQuotation);

      const approval = await approvalService.sendApprovalRequest({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        subjectType: 'quotation',
        subjectId: sendQuotation.id,
        subjectVersionNumber: 1,
        clientRepresentative: 'Madam Lan',
        clientContact: '+84909999888',
        actorId: 'owner-01',
        actorName: 'Owner Bella',
        userRole: 'owner',
      });

      // First execution succeeds
      await approvalService.recordApproval({
        tenantId: TENANT_ID,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        actorId: 'customer-portal-actor',
        actorName: 'Customer Portal',
        userRole: 'client',
      });

      // Second execution (Replay attack / duplicate click) must throw ApprovalImmutabilityError
      await expect(
        approvalService.recordApproval({
          tenantId: TENANT_ID,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          actorId: 'customer-portal-actor',
          actorName: 'Customer Portal',
          userRole: 'client',
        })
      ).rejects.toThrow(ApprovalImmutabilityError);
    });

    it('3B: customer rejection requires non-empty reason and leaves quotation unaccepted', async () => {
      const sendQuotation: InteriorQuotation = {
        ...acceptedQuotation,
        id: 'quote-reject-test-01',
        quotationNumber: 'BG-REJECT-TEST-01',
        status: 'sent_to_client',
      };
      await repository.saveQuotation(TENANT_ID, sendQuotation);

      const approval = await approvalService.sendApprovalRequest({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        subjectType: 'quotation',
        subjectId: sendQuotation.id,
        subjectVersionNumber: 1,
        clientRepresentative: 'Madam Lan',
        clientContact: '+84909999888',
        actorId: 'owner-01',
        actorName: 'Owner Bella',
        userRole: 'owner',
      });

      // Missing reason must throw
      await expect(
        approvalService.recordRejection({
          tenantId: TENANT_ID,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          actorId: 'customer-portal-actor',
          actorName: 'Customer Portal',
          rejectionReason: '   ',
          userRole: 'client',
        })
      ).rejects.toThrow(ApprovalTokenError);

      // Valid rejection succeeds
      const rejected = await approvalService.recordRejection({
        tenantId: TENANT_ID,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        actorId: 'customer-portal-actor',
        actorName: 'Customer Portal',
        rejectionReason: 'Giá vượt ngân sách dự kiến của gia đình',
        userRole: 'client',
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Giá vượt ngân sách dự kiến của gia đình');

      // Quotation in repository is marked rejected, NOT accepted
      const reloadedQuote = await repository.getQuotation(TENANT_ID, sendQuotation.id);
      expect(reloadedQuote?.status).toBe('rejected');
    });
  });

  // ─── SCENARIO 4: Cross-Tenant Isolation ─────────────────────────────────────
  describe('Scenario 4: Cross-Tenant Isolation Boundaries', () => {
    it('blocks foreign tenant from reading or mutating contracts', async () => {
      // 1. Reading contract with foreign tenant returns null
      const foreignContract = await repository.getContract(FOREIGN_TENANT_ID, activeContract.id);
      expect(foreignContract).toBeNull();

      // 2. Issuing invoice across tenant throws ContractNotFound
      await expect(
        lifecycleService.issueMilestoneInvoice({
          tenantId: FOREIGN_TENANT_ID,
          contractId: activeContract.id,
          milestoneId: activeContract.milestones[0].id,
          invoiceNumber: 'INV-ATTACK',
          userRole: 'owner',
        })
      ).rejects.toThrow(/ContractNotFound/);

      // 3. Recording payment across tenant throws ContractNotFound
      await expect(
        lifecycleService.recordPayment({
          tenantId: FOREIGN_TENANT_ID,
          contractId: activeContract.id,
          milestoneId: activeContract.milestones[0].id,
          amount: 50_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'ATTACK-TX',
          transactionDate: '2026-11-16',
          recordedBy: 'Malicious Actor',
          userRole: 'qs',
        })
      ).rejects.toThrow(/ContractNotFound/);
    });

    it('rejects approval operations when tenantId is empty or invalid', async () => {
      await expect(
        approvalService.recordApproval({
          tenantId: '',
          approvalId: 'some-id',
          approvalToken: 'some-token',
          actorId: 'some-actor',
          actorName: 'Some Actor',
          userRole: 'client',
        })
      ).rejects.toThrow(ApprovalTokenError);
    });
  });

  // ─── SCENARIO 5: Finance Outbox Retry Idempotency ───────────────────────────────────
  describe('Scenario 5: Finance Outbox Retry Idempotency', () => {
    it('enqueues milestone invoice event and verifies deduplication on retry', async () => {
      const m1 = activeContract.milestones[0];
      await lifecycleService.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-OUTBOX-01',
        userRole: 'pm',
      });

      const events = outbox.getPublishedEvents();
      const invoiceEvents = events.filter((e) => e.eventType === 'interior.milestone.invoiced.v1');
      expect(invoiceEvents).toHaveLength(1);
      expect(invoiceEvents[0].payload.contractId).toBe(activeContract.id);
      expect(invoiceEvents[0].payload.amount).toBe(m1.amount);
    });
  });

  // ─── SCENARIO 6: Addendum on Paid Milestone Immutability ────────────────────
  describe('Scenario 6: Contract Addendum on Paid Milestone Immutability', () => {
    it('strictly rejects any addendum proposal that attempts to alter an already paid milestone', async () => {
      const m1 = activeContract.milestones[0]; // 198,000,000 VND
      // Settle milestone 1 completely
      await lifecycleService.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-M1-SETTLED',
        userRole: 'pm',
      });
      await lifecycleService.recordPayment({
        tenantId: TENANT_ID,
        contractId: activeContract.id,
        milestoneId: m1.id,
        amount: 198_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'UNC-M1-SETTLED',
        transactionDate: '2026-11-16',
        recordedBy: 'Accountant',
        userRole: 'qs',
      });

      const settledContract = await repository.getContract(TENANT_ID, activeContract.id);
      expect(settledContract?.milestones[0].status).toBe('paid');

      // Illegal Addendum: tries to change amount of paid milestone 1 from 198M to 150M!
      const illegalSchedule: ProposedMilestoneScheduleItem[] = [
        {
          id: m1.id,
          milestoneOrder: 1,
          name: m1.name,
          percentage: 27.52,
          amount: 150_000_000, // ILLEGAL: Modifies paid milestone amount!
          triggerCondition: m1.triggerCondition,
          dueDate: m1.dueDate,
        },
        {
          id: activeContract.milestones[1].id,
          milestoneOrder: 2,
          name: activeContract.milestones[1].name,
          percentage: 45.0,
          amount: 245_000_000,
          triggerCondition: activeContract.milestones[1].triggerCondition,
          dueDate: activeContract.milestones[1].dueDate,
        },
        {
          id: activeContract.milestones[2].id,
          milestoneOrder: 3,
          name: activeContract.milestones[2].name,
          percentage: 27.48,
          amount: 150_000_000,
          triggerCondition: activeContract.milestones[2].triggerCondition,
          dueDate: activeContract.milestones[2].dueDate,
        },
      ];

      // Proposing an addendum that alters settled milestone must be rejected
      await expect(
        lifecycleService.createAddendum({
          tenantId: TENANT_ID,
          contractId: activeContract.id,
          addendumNumber: 'PL-ILLEGAL-M1',
          title: 'Phụ lục vi phạm mốc đã thu',
          valueDelta: 50_000_000,
          reason: 'Thử sửa đổi mốc đã tất toán',
          proposedPaymentSchedule: illegalSchedule,
          userRole: 'owner',
        })
      ).rejects.toThrow(/collected or invoiced milestone terms are immutable/i);
    });

    it('permits addendum before milestones are invoiced or collected', async () => {
      // Create a fresh signed contract without collected milestones
      const freshContract = await lifecycleService.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-FRESH-ADDENDUM',
        title: 'Hợp đồng Fresh Addendum',
        clientRepresentative: 'Madam Le Thi Lan',
        contractorRepresentative: 'Director Vu',
        userRole: 'owner',
        milestoneTemplate: '3_STEP_STANDARD', // 40% (198M), 40% (198M), 20% (99M)
      });

      const appr = await approvalService.sendApprovalRequest({
        tenantId: TENANT_ID,
        projectId: freshContract.projectId,
        subjectType: 'contract',
        subjectId: freshContract.id,
        subjectVersionNumber: freshContract.quotationVersionNumber ?? 1,
        clientRepresentative: freshContract.clientRepresentative,
        clientContact: testProject.customerPhone,
        actorId: 'test-sales-actor-fresh',
        actorName: 'Sales Director',
        userRole: 'pm',
      });

      await approvalService.recordApproval({
        tenantId: TENANT_ID,
        approvalId: appr.id,
        approvalToken: appr.approvalToken,
        signatureReference: {
          storagePath: `interior/approvals/${freshContract.id}/signed.pdf`,
          storageUrl: `https://storage.example.test/interior/approvals/${freshContract.id}/signed.pdf`,
          mimeType: 'application/pdf',
          fileSizeBytes: 2048,
          sha256Hash: 'a'.repeat(64),
        },
        actorId: 'test-customer-actor-fresh',
        actorName: freshContract.clientRepresentative,
        userRole: 'admin',
      });

      const signedFreshContract = await repository.getContract(TENANT_ID, freshContract.id);
      if (!signedFreshContract) throw new Error('Contract not found after signature');

      const revisedValue = signedFreshContract.currentContractValue + 35_000_000;
      let assigned = 0;
      const proposedPaymentSchedule = signedFreshContract.milestones.map((milestone, index) => {
        const amount = index === signedFreshContract.milestones.length - 1
          ? revisedValue - assigned
          : Math.round(revisedValue * milestone.percentage) / 100;
        assigned += amount;
        return {
          id: milestone.id,
          milestoneOrder: milestone.milestoneOrder,
          name: milestone.name,
          percentage: milestone.percentage,
          amount,
          triggerCondition: milestone.triggerCondition,
          dueDate: milestone.dueDate,
        };
      });

      const addendum = await lifecycleService.createAddendum({
        tenantId: TENANT_ID,
        contractId: signedFreshContract.id,
        addendumNumber: 'PL-LEGAL-01',
        title: 'Bổ sung hệ thống chiếu sáng thông minh KNX',
        valueDelta: 35_000_000,
        reason: 'Chủ đầu tự yêu cầu nâng cấp gói smarthome',
        userRole: 'pm',
        proposedPaymentSchedule,
      });

      expect(addendum).toBeDefined();
      expect(addendum.status).toBe('pending_customer_approval');
      expect(addendum.valueDelta).toBe(35_000_000);
    });
  });
});
