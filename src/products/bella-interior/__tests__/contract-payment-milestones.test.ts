/**
 * Bella Interior OS — Commercial Proposal Phase 3: Contract & Payment Milestones Test Suite
 *
 * Verifies all 8 Architectural Checkpoints:
 * 1. Accepted Quotation Prerequisite
 * 2. End-to-End Lineage Traceability (Quotation, Revision, BOQ, Version)
 * 3. Milestone Percentage & Amount Sum Reconciliation (100% Exact)
 * 4. Baseline vs Current Contract Value Separation (Addenda & Variation Orders)
 * 5. Multi-Tenant Isolation & Repository Guards
 * 6. Platform Finance Outbox Event-After-Persistence Publication
 * 7. Milestone Lifecycle, Invoicing, Payment Receipts & Financial Summary
 * 8. Separation of Duties & Canonical RBAC Role Enforcement
 *
 * @module src/products/bella-interior/__tests__/contract-payment-milestones.test
 */

import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { PlatformFinanceOutboxAdapter } from '../adapters/platform-finance-outbox.adapter';
import { InteriorContractLifecycleService } from '../services/interior-contract-lifecycle.service';
import { InteriorCustomerApprovalService } from '../services/interior-customer-approval.service';
import { TenantIsolationViolationError } from '../domain/errors';
import type {
  InteriorProject,
  DesignRevision,
} from '../domain/design-specification/types';
import type {
  InteriorBOQ,
  InteriorQuotation,
  InteriorContract,
} from '../domain/commercial-costing/types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';

describe('Bella Interior OS — Commercial Proposal Phase 3 (Contract & Payment Milestones)', () => {
  let repository: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let service: InteriorContractLifecycleService;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000002';
  const PROJECT_ID = 'proj-luxury-penthouse-01';

  let testProject: InteriorProject;
  let testRevision: DesignRevision;
  let testBOQ: InteriorBOQ;
  let acceptedQuotation: InteriorQuotation;
  let acceptedQuotationApproval: CustomerApproval;
  let draftQuotation: InteriorQuotation;

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    service = new InteriorContractLifecycleService(repository, outbox);

    // Setup base project
    testProject = {
      id: PROJECT_ID,
      tenantId: TENANT_ID,
      code: 'INT-2026-PTH01',
      name: 'Thao Dien Luxury Penthouse',
      customerId: 'customer-pth-01',
      customerName: 'Madam Tran Thi Thu',
      customerPhone: '+84901234567',
      siteAddress: 'Thao Dien, Ho Chi Minh City',
      projectType: 'residential_villa',
      status: 'technical_design',
      estimatedBudget: 148_500_000,
      targetCompletionDate: '2026-08-30',
      leadArchitectId: 'architect-le-01',
      leadArchitectName: 'Lead Architect Le',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveProject(TENANT_ID, testProject);

    // Setup design revision
    testRevision = {
      id: 'rev-pth-v1',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      versionNumber: 1,
      title: 'Detailed Fitout Design V1',
      status: 'approved',
      submittedBy: 'Lead Architect Le',
      submittedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: 'Lead Architect Le',
      assets: [],
      materialSpecs: [],
    };
    await repository.saveDesignRevision(TENANT_ID, testRevision);

    // Setup approved BOQ
    testBOQ = {
      id: 'boq-pth-v1',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      designRevisionId: testRevision.id,
      boqNumber: 'BOQ-PTH01-V1',
      versionNumber: 1,
      status: 'approved',
      totalInternalCost: 100_000_000,
      totalClientPrice: 135_000_000,
      totalGrossMargin: 35_000_000,
      grossMarginPercent: 25.9,
      items: [],
      preparedBy: 'Senior QS Nguyen',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveBOQ(TENANT_ID, testBOQ);

    // Setup accepted quotation (Grand Total: 148,500,000 VND after 10% VAT)
    // Subtotal: 135,000,000 - Discount 0 + VAT 10% (13,500,000) = 148,500,000
    acceptedQuotation = {
      id: 'quot-pth-v1-accepted',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      boqId: testBOQ.id,
      quotationNumber: 'BG-2026-001',
      versionNumber: 1,
      status: 'accepted',
      subtotal: 135_000_000,
      discountAmount: 0,
      vatPercent: 10,
      vatAmount: 13_500_000,
      grandTotal: 148_500_000,
      paymentTerms: '5 đợt thanh toán theo tiến độ',
      validityDays: 30,
      createdAt: new Date().toISOString(),
      boqVersionNumber: 1,
      totalInternalCogs: 100_000_000,
      totalGrossMargin: 35_000_000,
      grossMarginPercent: 25.9,
    };
    await repository.saveQuotation(TENANT_ID, acceptedQuotation);

    acceptedQuotationApproval = {
      id: 'approval-pth-quote-v1', tenantId: TENANT_ID, projectId: PROJECT_ID,
      subjectType: 'quotation', subjectId: acceptedQuotation.id,
      subjectVersionNumber: acceptedQuotation.versionNumber,
      approvalToken: 'approval-token-pth-quote-v1', status: 'approved',
      clientRepresentative: testProject.customerName, clientContact: testProject.customerPhone,
      sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      approvedAt: new Date().toISOString(), sentByActorId: 'actor-sales',
      sentByActorName: 'Sales Director', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    repository.seedCustomerApproval(TENANT_ID, acceptedQuotationApproval);

    // Setup draft quotation
    draftQuotation = {
      id: 'quot-pth-v1-draft',
      tenantId: TENANT_ID,
      projectId: PROJECT_ID,
      boqId: testBOQ.id,
      quotationNumber: 'BG-2026-002',
      versionNumber: 1,
      status: 'draft',
      subtotal: 135_000_000,
      discountAmount: 0,
      vatPercent: 10,
      vatAmount: 13_500_000,
      grandTotal: 148_500_000,
      paymentTerms: 'Tạm tính',
      validityDays: 15,
      createdAt: new Date().toISOString(),
    };
    await repository.saveQuotation(TENANT_ID, draftQuotation);
  });

  const signContractWithCustomerEvidence = async (contract: InteriorContract): Promise<InteriorContract> => {
    const approvalService = new InteriorCustomerApprovalService(repository, outbox);
    const approval = await approvalService.sendApprovalRequest({
      tenantId: TENANT_ID,
      projectId: contract.projectId,
      subjectType: 'contract',
      subjectId: contract.id,
      subjectVersionNumber: contract.quotationVersionNumber ?? 1,
      clientRepresentative: contract.clientRepresentative,
      clientContact: testProject.customerPhone,
      actorId: 'test-sales-actor',
      actorName: 'Sales',
      userRole: 'pm',
    });
    await approvalService.recordApproval({
      tenantId: TENANT_ID,
      approvalId: approval.id,
      approvalToken: approval.approvalToken,
      signatureReference: {
        storagePath: `interior/approvals/${contract.id}/signed.pdf`,
        storageUrl: `https://storage.example.test/interior/approvals/${contract.id}/signed.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256Hash: 'a'.repeat(64),
      },
      actorId: 'test-customer-actor',
      actorName: contract.clientRepresentative,
      userRole: 'admin',
    });
    const signed = await repository.getContract(TENANT_ID, contract.id);
    if (!signed || signed.status !== 'signed' || !signed.customerApprovalId) {
      throw new Error('Customer signature evidence did not advance the contract');
    }
    return signed;
  };

  // ─── CHECKPOINT 1: Accepted Quotation Prerequisite ─────────────────────────
  describe('Checkpoint 1: Accepted Quotation Prerequisite', () => {
    it('rejects contract creation from a draft quotation', async () => {
      await expect(
        service.createContractFromQuotation({
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: draftQuotation.id,
          quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: 'HD-2026-PTH01',
          title: 'Hợp đồng thi công nội thất Penthouse Thảo Điền',
          clientRepresentative: 'Madam Tran Thi Thu',
          contractorRepresentative: 'Director Vu',
          userRole: 'pm',
        })
      ).rejects.toThrow(/ContractQuotationStatusViolation.*must be 'accepted'/);
    });

    it('rejects contract creation from a sent_to_client quotation', async () => {
      const sentQuotation: InteriorQuotation = {
        ...draftQuotation,
        id: 'quot-sent',
        status: 'sent_to_client',
      };
      await repository.saveQuotation(TENANT_ID, sentQuotation);

      await expect(
        service.createContractFromQuotation({
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: sentQuotation.id,
          quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: 'HD-2026-PTH02',
          title: 'Hợp đồng thi công',
          clientRepresentative: 'Madam Tran Thi Thu',
          contractorRepresentative: 'Director Vu',
          userRole: 'owner',
        })
      ).rejects.toThrow(/ContractQuotationStatusViolation/);
    });

    it('successfully creates a contract from an accepted quotation', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-PTH01',
        title: 'Hợp đồng thi công hoàn thiện nội thất Penthouse Thảo Điền',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'pm',
        milestoneTemplate: '5_STEP_DUBAI_CANONICAL',
      });

      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.contractNumber).toBe('HD-2026-PTH01');
      expect(contract.status).toBe('draft');
      expect(contract.signedDate).toBeNull();
      expect(contract.baselineContractValue).toBe(148_500_000);
      expect(contract.currentContractValue).toBe(148_500_000);
    });
  });

  // ─── CHECKPOINT 2: End-to-End Lineage Traceability ────────────────────────
  describe('Checkpoint 2: Traceability & End-to-End Lineage', () => {
    it('captures complete quotation, revision, and BOQ lineage in the contract', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-PTH01',
        title: 'Hợp đồng thi công nội thất',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'admin',
      });

      expect(contract.quotationId).toBe(acceptedQuotation.id);
      expect(contract.quotationNumber).toBe('BG-2026-001');
      expect(contract.quotationVersionNumber).toBe(1);
      expect(contract.boqId).toBe(testBOQ.id);
      expect(contract.boqVersionNumber).toBe(1);

      // A drafted agreement does not yet represent customer signature.
      const updatedProject = await repository.getProject(TENANT_ID, PROJECT_ID);
      expect(updatedProject?.status).toBe('technical_design');
    });
  });

  // ─── CHECKPOINT 3: Milestone Percentage & Amount Sum Reconciliation ────────
  describe('Checkpoint 3: Milestone Percentage & Amount Sum Reconciliation', () => {
    it('validates pre-configured 5_STEP_DUBAI_CANONICAL template reconciles exactly 100% and contract value', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-PTH01',
        title: 'Hợp đồng thi công 5 đợt',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'qs',
        milestoneTemplate: '5_STEP_DUBAI_CANONICAL',
      });

      expect(contract.milestones).toHaveLength(5);

      // Percentage sum must equal 100%
      const totalPercent = contract.milestones.reduce((acc, m) => acc + m.percentage, 0);
      expect(totalPercent).toBe(100);

      // Total milestone amount must equal grand total exactly (148,500,000)
      const totalAmount = contract.milestones.reduce((acc, m) => acc + m.amount, 0);
      expect(totalAmount).toBe(148_500_000);

      // Verify specific milestone amounts:
      // M1 (30%): 44,550,000
      // M2 (20%): 29,700,000
      // M3 (20%): 29,700,000
      // M4 (25%): 37,125,000
      // M5 (5%):   7,425,000
      expect(contract.milestones[0].amount).toBe(44_550_000);
      expect(contract.milestones[1].amount).toBe(29_700_000);
      expect(contract.milestones[2].amount).toBe(29_700_000);
      expect(contract.milestones[3].amount).toBe(37_125_000);
      expect(contract.milestones[4].amount).toBe(7_425_000);
    });

    it('validates 3_STEP_STANDARD and 4_STEP_BALANCED templates sum to 100%', async () => {
      const contract3 = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-3STEP',
        title: 'Hợp đồng 3 đợt',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'owner',
        milestoneTemplate: '3_STEP_STANDARD',
      });
      const sum3 = contract3.milestones.reduce((acc, m) => acc + m.percentage, 0);
      expect(sum3).toBe(100);
      const amt3 = contract3.milestones.reduce((acc, m) => acc + m.amount, 0);
      expect(amt3).toBe(148_500_000);

      const contract4 = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-4STEP',
        title: 'Hợp đồng 4 đợt',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'owner',
        milestoneTemplate: '4_STEP_BALANCED',
      });
      const sum4 = contract4.milestones.reduce((acc, m) => acc + m.percentage, 0);
      expect(sum4).toBe(100);
      const amt4 = contract4.milestones.reduce((acc, m) => acc + m.amount, 0);
      expect(amt4).toBe(148_500_000);
    });

    it('rejects custom milestones when total percentage is not 100%', async () => {
      await expect(
        service.createContractFromQuotation({
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: 'HD-INVALID-PCT',
          title: 'Hợp đồng sai tỷ lệ',
          clientRepresentative: 'Madam Tran Thi Thu',
          contractorRepresentative: 'Director Vu',
          userRole: 'pm',
          customMilestones: [
            { milestoneOrder: 1, name: 'Đợt 1', percentage: 50, triggerCondition: 'Ký HĐ' },
            { milestoneOrder: 2, name: 'Đợt 2', percentage: 40, triggerCondition: 'Giao hàng' },
          ], // Total: 90% (error)
        })
      ).rejects.toThrow(/MilestonePercentageSumError.*must equal exactly 100%/);
    });
  });

  // ─── CHECKPOINT 4: Baseline vs Current Value Separation (Addenda) ─────────
  describe('Checkpoint 4: Baseline vs Current Contract Value Separation (Addenda)', () => {
    it('changes contract value and schedule only after the customer approves the exact addendum', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-PTH01',
        title: 'Hợp đồng gốc',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'director',
      });
      await signContractWithCustomerEvidence(contract);

      expect(contract.baselineContractValue).toBe(148_500_000);
      expect(contract.currentContractValue).toBe(148_500_000);

      const revisedValue = contract.currentContractValue + 35_000_000;
      let assigned = 0;
      const proposedPaymentSchedule = contract.milestones.map((milestone, index) => {
        const amount = index === contract.milestones.length - 1
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
      const addendum = await service.createAddendum({
        tenantId: TENANT_ID,
        contractId: contract.id,
        addendumNumber: 'PL-01',
        title: 'Bổ sung hệ thống chiếu sáng thông minh KNX',
        valueDelta: 35_000_000,
        reason: 'Chủ đầu tư yêu cầu nâng cấp gói smarthome',
        userRole: 'pm',
        proposedPaymentSchedule,
      });

      expect(addendum.status).toBe('pending_customer_approval');
      expect((await repository.getContract(TENANT_ID, contract.id))?.currentContractValue).toBe(148_500_000);
      const approvalService = new InteriorCustomerApprovalService(repository, outbox);
      const approval = await approvalService.sendApprovalRequest({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        subjectType: 'contract_addendum',
        subjectId: addendum.id,
        subjectVersionNumber: 1,
        clientRepresentative: 'Madam Tran Thi Thu',
        clientContact: '+84901234567',
        actorId: 'contract-manager',
        actorName: 'Contract Manager',
        userRole: 'pm',
      });
      await approvalService.recordApproval({
        tenantId: TENANT_ID,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        actorId: 'customer-portal',
        actorName: 'Madam Tran Thi Thu',
        userRole: 'client',
        customerNotes: 'Tôi chấp thuận phụ lục và lịch thanh toán đã gửi.',
      });

      const reloaded = await repository.getContract(TENANT_ID, contract.id);
      expect(reloaded?.baselineContractValue).toBe(148_500_000);
      expect(reloaded?.currentContractValue).toBe(revisedValue);
      expect(reloaded?.addenda).toHaveLength(1);
      expect(reloaded?.addenda[0].customerApprovalId).toBe(approval.id);
      expect(reloaded?.addenda[0].status).toBe('approved');
      expect(reloaded?.milestones.reduce((sum, milestone) => sum + milestone.amount, 0)).toBe(revisedValue);
    });

    it('rejects direct in-place mutation of baselineContractValue on a signed contract', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-IMMUTABLE',
        title: 'Hợp đồng kiểm tra bất biến',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'owner',
      });
      await signContractWithCustomerEvidence(contract);

      // Attempting to save contract with mutated baselineContractValue must be rejected
      const maliciousContract: InteriorContract = {
        ...contract,
        baselineContractValue: 200_000_000, // Direct illegal alteration!
      };

      await expect(repository.saveContract(TENANT_ID, maliciousContract)).rejects.toThrow(
        /Immutability violation.*baseline value is sealed/
      );
    });
  });

  // ─── CHECKPOINT 5: Multi-Tenant Isolation & Repository Guards ──────────────
  describe('Checkpoint 5: Multi-Tenant Isolation & Repository Guards', () => {
    it('throws TenantIsolationViolationError if tenantId is missing', async () => {
      await expect(
        service.createContractFromQuotation({
          tenantId: '',
          projectId: PROJECT_ID,
          quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: 'HD-FAIL',
          title: 'Hợp đồng',
          clientRepresentative: 'Client',
          contractorRepresentative: 'Contractor',
          userRole: 'owner',
        })
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    it('cross-tenant quotation access is strictly blocked', async () => {
      await expect(
        service.createContractFromQuotation({
          tenantId: OTHER_TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: 'HD-CROSS-TENANT',
          title: 'Hợp đồng xâm nhập',
          clientRepresentative: 'Madam Tran',
          contractorRepresentative: 'Director',
          userRole: 'owner',
        })
      ).rejects.toThrow(/QuotationNotFound/);
    });
  });

  // ─── CHECKPOINT 6: Platform Finance Outbox Event Emission ───────────────────
  describe('Checkpoint 6: Platform Finance Outbox Event-After-Persistence Publication', () => {
    it('does not publish a signed event or enqueue finance before customer signature', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-OUTBOX',
        title: 'Hợp đồng Outbox Test',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'pm',
      });

      expect(contract.status).toBe('draft');
      expect(outbox.getPublishedEvents().some((event) => event.eventType === 'interior.contract.signed.v1')).toBe(false);
      expect(outbox.getQueuedFinanceRecords()).toHaveLength(0);
    });

    it('emits interior.milestone.invoiced.v1 when milestone invoice is issued', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-INV',
        title: 'Hợp đồng Hóa đơn',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'pm',
      });
      await signContractWithCustomerEvidence(contract);

      const m1 = contract.milestones[0];
      await service.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: contract.id,
        milestoneId: m1.id,
        invoiceNumber: 'HD-2026-0012',
        userRole: 'qs',
      });

      const queuedEvents = outbox.getPublishedEvents();
      const invoiceEvent = queuedEvents.find((e) => e.eventType === 'interior.milestone.invoiced.v1');
      expect(invoiceEvent).toBeDefined();
      expect(invoiceEvent?.payload.invoiceNumber).toBe('HD-2026-0012');
      expect(invoiceEvent?.payload.amount).toBe(m1.amount);
    });
  });

  // ─── CHECKPOINT 7: Milestone Lifecycle, Payment Receipts & Financial Summary
  describe('Checkpoint 7: Milestone Invoicing, Payment Receipts & Financial Summary', () => {
    it('manages full lifecycle: invoice -> partial payment -> full payment -> completed reconciliation', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-LIFECYCLE',
        title: 'Hợp đồng Thu chi',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'director',
        milestoneTemplate: '3_STEP_STANDARD', // 40% (59.4M) - 40% (59.4M) - 20% (29.7M)
      });
      const signedContract = await signContractWithCustomerEvidence(contract);

      const m1 = signedContract.milestones[0]; // 59,400,000 VND
      expect(m1.amount).toBe(59_400_000);

      // 1. Initial Financial Summary
      let summary = await service.getFinancialSummary(TENANT_ID, contract.id);
      expect(summary.currentContractValue).toBe(148_500_000);
      expect(summary.totalCollectedAmount).toBe(0);
      expect(summary.remainingBalance).toBe(148_500_000);
      expect(summary.collectionPercentage).toBe(0);
      expect(summary.isFullyCollected).toBe(false);

      // 2. Issue invoice for Milestone 1
      const invoicedM1 = await service.issueMilestoneInvoice({
        tenantId: TENANT_ID,
        contractId: contract.id,
        milestoneId: m1.id,
        invoiceNumber: 'INV-2026-0001',
        userRole: 'pm',
      });
      expect(invoicedM1.status).toBe('invoiced');
      expect(invoicedM1.invoiceStatus).toBe('issued');
      expect(invoicedM1.invoiceNumber).toBe('INV-2026-0001');

      // 3. Partial Payment of 30,000,000 VND on Milestone 1
      await service.recordPayment({
        tenantId: TENANT_ID,
        contractId: contract.id,
        milestoneId: m1.id,
        amount: 30_000_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'VCB-TX-98765',
        transactionDate: '2026-03-05',
        recordedBy: 'Accountant Nguyen',
        userRole: 'qs',
      });

      let updatedContract = await repository.getContract(TENANT_ID, contract.id);
      let updatedM1 = updatedContract?.milestones.find((m) => m.id === m1.id);
      expect(updatedM1?.collectedAmount).toBe(30_000_000);
      expect(updatedM1?.status).toBe('invoiced'); // The issued invoice remains open while partially paid.

      // 4. Remaining Payment of 29,400,000 VND to complete Milestone 1
      await service.recordPayment({
        tenantId: TENANT_ID,
        contractId: contract.id,
        milestoneId: m1.id,
        amount: 29_400_000,
        paymentMethod: 'bank_transfer',
        referenceCode: 'VCB-TX-98766',
        transactionDate: '2026-03-08',
        recordedBy: 'Accountant Nguyen',
        userRole: 'owner',
      });

      updatedContract = await repository.getContract(TENANT_ID, contract.id);
      updatedM1 = updatedContract?.milestones.find((m) => m.id === m1.id);
      expect(updatedM1?.collectedAmount).toBe(59_400_000);
      expect(updatedM1?.status).toBe('paid'); // FULLY PAID!
      expect(updatedM1?.paidAt).toBe('2026-03-08');

      // 5. Verify updated Financial Summary
      summary = await service.getFinancialSummary(TENANT_ID, contract.id);
      expect(summary.totalCollectedAmount).toBe(59_400_000);
      expect(summary.remainingBalance).toBe(89_100_000);
      expect(summary.collectionPercentage).toBe(40); // 40.0%
      expect(summary.paidMilestonesCount).toBe(1);
      expect(summary.totalMilestonesCount).toBe(3);
      expect(summary.isFullyCollected).toBe(false);

      // 6. Checkpoint 7B: Reject duplicate payment transaction with identical referenceCode
      await expect(
        service.recordPayment({
          tenantId: TENANT_ID,
          contractId: contract.id,
          milestoneId: m1.id,
          amount: 10_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'vcb-tx-98765', // Case-insensitive duplicate reference code.
          transactionDate: '2026-03-09',
          recordedBy: 'Accountant Nguyen',
          userRole: 'owner',
        })
      ).rejects.toThrow(/DuplicatePaymentTransaction/);
    });

    it('serializes concurrent receipts and rejects payments above a milestone balance', async () => {
      const contract = await service.createContractFromQuotation({
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
        contractNumber: 'HD-2026-PAYMENT-GUARD',
        title: 'Hợp đồng kiểm soát thanh toán',
        clientRepresentative: 'Madam Tran Thi Thu',
        contractorRepresentative: 'Director Vu',
        userRole: 'pm',
        milestoneTemplate: '3_STEP_STANDARD',
      });
      const signedContract = await signContractWithCustomerEvidence(contract);
      const milestone = signedContract.milestones[0];

      const results = await Promise.allSettled([
        service.recordPayment({
          tenantId: TENANT_ID,
          contractId: contract.id,
          milestoneId: milestone.id,
          amount: 1_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: 'RACE-REF-01',
          transactionDate: '2026-03-05',
          recordedBy: 'accountant-1',
          userRole: 'qs',
        }),
        service.recordPayment({
          tenantId: TENANT_ID,
          contractId: contract.id,
          milestoneId: milestone.id,
          amount: 1_000_000,
          paymentMethod: 'bank_transfer',
          referenceCode: ' race-ref-01 ',
          transactionDate: '2026-03-05',
          recordedBy: 'accountant-1',
          userRole: 'qs',
        }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const afterConcurrentInsert = await repository.getContract(TENANT_ID, contract.id);
      expect(afterConcurrentInsert?.milestones[0].collectedAmount).toBe(1_000_000);

      await expect(service.recordPayment({
        tenantId: TENANT_ID,
        contractId: contract.id,
        milestoneId: milestone.id,
        amount: milestone.amount,
        paymentMethod: 'bank_transfer',
        referenceCode: 'OVER-MILESTONE',
        transactionDate: '2026-03-06',
        recordedBy: 'accountant-1',
        userRole: 'qs',
      })).rejects.toThrow(/INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE/);

      const finalContract = await repository.getContract(TENANT_ID, contract.id);
      expect(finalContract?.milestones[0].collectedAmount).toBe(1_000_000);
    });
  });

  // ─── CHECKPOINT 8: Separation of Duties & Canonical RBAC Role Enforcement ─
  describe('Checkpoint 8: Separation of Duties & Canonical RBAC Roles', () => {
    it('authorizes OWNER, ADMIN, DIRECTOR, PM, QS for contract creation', async () => {
      const allowedRoles = ['owner', 'admin', 'director', 'executive', 'pm', 'qs'];
      for (const role of allowedRoles) {
        const contract = await service.createContractFromQuotation({
          tenantId: TENANT_ID,
          projectId: PROJECT_ID,
          quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
          contractNumber: `HD-ROLE-${role.toUpperCase()}`,
          title: `Hợp đồng tạo bởi role ${role}`,
          clientRepresentative: 'Madam Tran',
          contractorRepresentative: 'Director Vu',
          userRole: role,
        });
        expect(contract).toBeDefined();
      }
    });

    it('strictly rejects CLIENT, DESIGNER, and GUEST roles from contract operations', async () => {
      const unauthorizedRoles = ['client', 'designer', 'guest', 'subcontractor'];
      for (const role of unauthorizedRoles) {
        await expect(
          service.createContractFromQuotation({
            tenantId: TENANT_ID,
            projectId: PROJECT_ID,
            quotationId: acceptedQuotation.id,
        quotationCustomerApprovalId: acceptedQuotationApproval.id,
            contractNumber: 'HD-UNAUTH',
            title: 'Hợp đồng bất hợp pháp',
            clientRepresentative: 'Client',
            contractorRepresentative: 'Director',
            userRole: role,
          })
        ).rejects.toThrow(/AuthorizationViolation.*not authorized/);
      }
    });
  });
});
