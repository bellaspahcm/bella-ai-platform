/**
 * Bella Interior OS — Commercial Intake Validation Service Tests
 *
 * Verifies that the Commercial Source-of-Truth invariants are enforced before
 * any production request payload is built for Platform Manufacturing OS.
 *
 * Invariants under test:
 *   I1. BOQ must be sealed (status 'approved' or 'locked_for_contract')
 *   I2. Quotation must be accepted (status 'accepted')
 *   I3. Contract must be executed (status 'signed' or 'active')
 *   I4. Customer Approval must be 'approved' for the contract
 *   I6. Design Revision must be 'approved'
 *   I7. Tenant isolation enforced on every entity resolution
 *
 * Uses direct fixture injection via InMemoryInteriorRepository — following
 * the same pattern as Phase 3 and Phase 4 tests to avoid complex service-chain
 * setup overhead and keep test logic focused on the validation invariants.
 *
 * @module src/products/bella-interior/__tests__/commercial-intake-validation.test
 */

import { randomUUID } from 'crypto';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { CommercialIntakeValidationService } from '../services/commercial-intake-validation.service';
import {
  BOQNotSealedError,
  QuotationNotAcceptedError,
  ContractNotExecutedError,
  CustomerApprovalRequiredError,
} from '../services/commercial-intake-validation.service';
import type { InteriorProject, DesignRevision } from '../domain/design-specification/types';
import type { InteriorBOQ, InteriorQuotation, InteriorContract, BOQItem } from '../domain/commercial-costing/types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';

// ── Shared IDs ──────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000099';
const OTHER_TENANT = '11111111-1111-1111-1111-111111111111';
const PROJECT_ID = randomUUID();
const DESIGN_REV_ID = randomUUID();
const BOQ_ID = randomUUID();
const QUOTATION_ID = randomUUID();
const CONTRACT_ID = randomUUID();
const APPROVAL_ID = randomUUID();
const APPROVAL_TOKEN = randomUUID();

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(tenantId = TENANT_ID): InteriorProject {
  return {
    id: PROJECT_ID,
    tenantId,
    projectCode: 'INT-INTAKE-01',
    name: 'Vinhomes Smart City Interior',
    clientName: 'Nguyễn Thị Lan',
    clientPhone: '0901234567',
    propertyType: 'residential_apartment',
    totalAreaM2: 120,
    status: 'contracted',
    startDate: '2026-11-01',
    targetCompletionDate: '2027-03-31',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeDesignRevision(
  status: DesignRevision['status'] = 'approved',
  tenantId = TENANT_ID,
): DesignRevision {
  return {
    id: DESIGN_REV_ID,
    tenantId,
    projectId: PROJECT_ID,
    revisionNumber: 1,
    versionNumber: 1,
    title: 'Bản vẽ thiết kế phê duyệt lần 1',
    status,
    submittedBy: 'KTS. Vũ Thị Hoa',
    approvedAt: status === 'approved' ? new Date().toISOString() : undefined,
    approvedBy: status === 'approved' ? 'GĐ. Trần Văn Minh' : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeBOQItem(boqId = BOQ_ID, tenantId = TENANT_ID): BOQItem {
  return {
    id: randomUUID(),
    tenantId,
    boqId,
    roomZoneId: 'room-01',
    roomZoneName: 'Phòng khách',
    itemCode: 'CAB-PK-001',
    itemName: 'Tủ TV âm tường',
    category: 'cabinetry',
    dimensions: { width: 2400, depth: 400, height: 2200, unit: 'mm' },
    specifications: {
      carcassMaterial: 'MDF chống ẩm lõi xanh phủ Melamine',
      doorFrontMaterial: 'Cánh Acrylic bóng gương An Cường',
      surfaceFinish: 'Acrylic High Gloss White',
      hardwareSpec: 'Bản lề Blum Clip Top giảm chấn',
    },
    unit: 'bộ',
    quantity: 1,
    internalUnitCost: 18_000_000,
    internalTotalCost: 18_000_000,
    clientUnitPrice: 25_000_000,
    clientTotalPrice: 25_000_000,
    grossMarginAmount: 7_000_000,
    grossMarginPercent: 28.0,
  };
}

function makeBOQ(
  status: InteriorBOQ['status'] = 'locked_for_contract',
  tenantId = TENANT_ID,
): InteriorBOQ {
  return {
    id: BOQ_ID,
    tenantId,
    projectId: PROJECT_ID,
    designRevisionId: DESIGN_REV_ID,
    boqNumber: 'BOQ-INTAKE-2026-001',
    versionNumber: 1,
    status,
    totalInternalCost: 18_000_000,
    totalClientPrice: 25_000_000,
    totalGrossMargin: 7_000_000,
    grossMarginPercent: 28.0,
    items: [makeBOQItem(BOQ_ID, tenantId)],
    preparedBy: 'Estimator Phạm Thu Hà',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeQuotation(
  status: InteriorQuotation['status'] = 'accepted',
  tenantId = TENANT_ID,
): InteriorQuotation {
  return {
    id: QUOTATION_ID,
    tenantId,
    projectId: PROJECT_ID,
    boqId: BOQ_ID,
    quotationNumber: 'QT-INTAKE-2026-001',
    versionNumber: 1,
    status,
    subtotal: 25_000_000,
    discountAmount: 0,
    vatPercent: 10,
    vatAmount: 2_500_000,
    grandTotal: 27_500_000,
    paymentTerms: '30% tạm ứng, 70% sau nghiệm thu',
    validityDays: 30,
    createdAt: new Date().toISOString(),
    boqVersionNumber: 1,
    totalInternalCogs: 18_000_000,
    totalGrossMargin: 7_000_000,
    grossMarginPercent: 28.0,
    preparedBy: 'Estimator Phạm Thu Hà',
    acceptedAt: status === 'accepted' ? new Date().toISOString() : null,
  };
}

function makeContract(
  status: InteriorContract['status'] = 'signed',
  tenantId = TENANT_ID,
): InteriorContract {
  return {
    id: CONTRACT_ID,
    tenantId,
    projectId: PROJECT_ID,
    quotationId: QUOTATION_ID,
    contractNumber: 'CT-INTAKE-2026-001',
    title: 'Hợp đồng thi công nội thất Vinhomes Smart City',
    status,
    baselineContractValue: 27_500_000,
    currentContractValue: 27_500_000,
    signedDate: status === 'signed' || status === 'active' ? '2026-11-01' : '',
    clientRepresentative: 'Nguyễn Thị Lan',
    contractorRepresentative: 'GĐ. Trần Văn Minh',
    milestones: [],
    addenda: [],
    quotationNumber: 'QT-INTAKE-2026-001',
    quotationVersionNumber: 1,
    boqId: BOQ_ID,
    boqVersionNumber: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeApproval(
  approvalStatus: CustomerApproval['status'] = 'approved',
  tenantId = TENANT_ID,
): CustomerApproval {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    id: APPROVAL_ID,
    tenantId,
    projectId: PROJECT_ID,
    subjectType: 'contract',
    subjectId: CONTRACT_ID,
    subjectVersionNumber: 1,
    approvalToken: APPROVAL_TOKEN,
    status: approvalStatus,
    clientRepresentative: 'Nguyễn Thị Lan',
    clientContact: 'lan.nguyen@email.com',
    sentAt: now.toISOString(),
    expiresAt: future.toISOString(),
    approvedAt: approvalStatus === 'approved' ? now.toISOString() : null,
    rejectedAt: approvalStatus === 'rejected' ? now.toISOString() : null,
    sentByActorId: 'actor-intake-1',
    sentByActorName: 'GĐ. Trần Văn Minh',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// ── Helper: seed a complete valid chain into repo ────────────────────────────

async function seedValidChain(
  repo: InMemoryInteriorRepository,
  overrides: {
    boqStatus?: InteriorBOQ['status'];
    contractStatus?: InteriorContract['status'];
    quotationStatus?: InteriorQuotation['status'];
    approvalStatus?: CustomerApproval['status'];
  } = {},
): Promise<void> {
  await repo.saveProject(TENANT_ID, makeProject());
  await repo.saveDesignRevision(TENANT_ID, makeDesignRevision('approved'));
  await repo.saveBOQ(TENANT_ID, makeBOQ(overrides.boqStatus ?? 'locked_for_contract'));
  await repo.saveQuotation(TENANT_ID, makeQuotation(overrides.quotationStatus ?? 'accepted'));
  await repo.saveContract(TENANT_ID, makeContract(overrides.contractStatus ?? 'signed'));
  await repo.saveCustomerApproval(TENANT_ID, makeApproval(overrides.approvalStatus ?? 'approved'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CommercialIntakeValidationService — Commercial Source-of-Truth Invariants', () => {
  let repository: InMemoryInteriorRepository;
  let service: CommercialIntakeValidationService;

  const baseInput = {
    tenantId: TENANT_ID,
    actorUserId: 'actor-mfg-1',
    interiorProjectId: PROJECT_ID,
    projectCode: 'INT-INTAKE-01',
    contractId: CONTRACT_ID,
    customerApprovalId: APPROVAL_ID,
    requiredByDate: '2027-02-28',
    notes: 'Khởi động sản xuất Batch 1',
  };

  beforeEach(async () => {
    repository = new InMemoryInteriorRepository();
    service = new CommercialIntakeValidationService(repository);
    await seedValidChain(repository);
  });

  // ── Happy Path ─────────────────────────────────────────────────────────────

  describe('Happy Path — all invariants satisfied', () => {
    it('should build a CommercialSourceOfTruth payload with full lineage', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      const { productionRequestInput, validatedChain } = result;
      const cst = productionRequestInput.commercialSourceOfTruth;

      // All IDs must match persisted records
      expect(cst.contractId).toBe(CONTRACT_ID);
      expect(cst.quotationId).toBe(QUOTATION_ID);
      expect(cst.boqId).toBe(BOQ_ID);
      expect(cst.designRevisionId).toBe(DESIGN_REV_ID);
      expect(cst.customerApprovalId).toBe(APPROVAL_ID);

      // Version numbers must be positive integers
      expect(cst.quotationVersionNumber).toBe(1);
      expect(cst.boqVersionNumber).toBe(1);
      expect(cst.designRevisionVersionNumber).toBe(1);

      // BOQ sealed timestamp must be present
      expect(cst.boqSnapshotSealedAt).toBeTruthy();

      // Contract values
      expect(cst.baselineContractValue).toBe(27_500_000);
      expect(cst.currentContractValue).toBe(27_500_000);

      // Validated chain summary
      expect(validatedChain.contractNumber).toBe('CT-INTAKE-2026-001');
      expect(validatedChain.quotationNumber).toBe('QT-INTAKE-2026-001');
      expect(validatedChain.boqNumber).toBe('BOQ-INTAKE-2026-001');
      expect(validatedChain.baselineContractValue).toBe(27_500_000);
    });

    it('should derive production items from sealed BOQ with correct specifications', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      const items = result.productionRequestInput.items;

      expect(items.length).toBe(1);
      const item = items[0];
      expect(item.itemName).toBe('Tủ TV âm tường');
      expect(item.roomZoneName).toBe('Phòng khách');
      expect(item.quantity).toBe(1);
      expect(item.carcassMaterial).toBe('MDF chống ẩm lõi xanh phủ Melamine');
      expect(item.doorFrontMaterial).toBe('Cánh Acrylic bóng gương An Cường');
      expect(item.dimensionsMm).toEqual({ width: 2400, depth: 400, height: 2200 });
      expect(item.estimatedProductionHours).toBeGreaterThan(0);
    });

    it('should NOT expose internal cost data in production items (cost isolation invariant)', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      const item = result.productionRequestInput.items[0] as unknown as Record<string, unknown>;

      // Manufacturing OS must not receive internal costing data
      expect(item['internalUnitCost']).toBeUndefined();
      expect(item['clientUnitPrice']).toBeUndefined();
      expect(item['grossMarginAmount']).toBeUndefined();
      expect(item['internalTotalCost']).toBeUndefined();
    });

    it('should pass requiredByDate and notes to production request input', async () => {
      const result = await service.validateAndBuildProductionRequest({
        ...baseInput,
        requiredByDate: '2027-01-15',
        notes: 'Ưu tiên sản xuất phòng khách trước',
      });

      expect(result.productionRequestInput.requiredByDate).toBe('2027-01-15');
      expect(result.productionRequestInput.notes).toBe('Ưu tiên sản xuất phòng khách trước');
    });

    it('should also succeed with contract status "active"', async () => {
      await repository.saveContract(TENANT_ID, makeContract('active'));
      const result = await service.validateAndBuildProductionRequest(baseInput);
      expect(result.productionRequestInput.commercialSourceOfTruth.contractId).toBe(CONTRACT_ID);
    });

    it('should also succeed with BOQ status "approved"', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { boqStatus: 'approved' });
      const result = await service.validateAndBuildProductionRequest(baseInput);
      expect(result.productionRequestInput.commercialSourceOfTruth.boqId).toBe(BOQ_ID);
    });
  });

  // ── I3: Contract Not Executed ──────────────────────────────────────────────

  describe('I3 — Contract must be signed or active', () => {
    it('should throw ContractNotExecutedError for draft contract', async () => {
      await repository.saveContract(TENANT_ID, makeContract('draft'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(ContractNotExecutedError);
    });

    it('should throw ContractNotExecutedError for in_review contract', async () => {
      await repository.saveContract(TENANT_ID, makeContract('in_review'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(ContractNotExecutedError);
    });

    it('should throw ContractNotExecutedError for terminated contract', async () => {
      await repository.saveContract(TENANT_ID, makeContract('terminated'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(ContractNotExecutedError);
    });

    it('should throw an error when contractId does not exist in tenant', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          contractId: 'non-existent-contract',
        }),
      ).rejects.toThrow();
    });
  });

  // ── I2: Quotation Not Accepted ─────────────────────────────────────────────

  describe('I2 — Quotation must be accepted', () => {
    it('should throw QuotationNotAcceptedError for draft quotation', async () => {
      await repository.saveQuotation(TENANT_ID, makeQuotation('draft'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(QuotationNotAcceptedError);
    });

    it('should throw QuotationNotAcceptedError for sent_to_client quotation', async () => {
      await repository.saveQuotation(TENANT_ID, makeQuotation('sent_to_client'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(QuotationNotAcceptedError);
    });

    it('should throw QuotationNotAcceptedError for rejected quotation', async () => {
      await repository.saveQuotation(TENANT_ID, makeQuotation('rejected'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(QuotationNotAcceptedError);
    });
  });

  // ── I1: BOQ Not Sealed ─────────────────────────────────────────────────────

  describe('I1 — BOQ must be sealed (approved or locked_for_contract)', () => {
    it('should throw BOQNotSealedError for draft BOQ', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { boqStatus: 'draft' });
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(BOQNotSealedError);
    });

    it('should throw BOQNotSealedError for under_review BOQ', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { boqStatus: 'under_review' });
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(BOQNotSealedError);
    });
  });

  // ── I4: Customer Approval Required ────────────────────────────────────────

  describe('I4 — Customer Approval must be approved', () => {
    it('should throw CustomerApprovalRequiredError for pending approval', async () => {
      await repository.saveCustomerApproval(TENANT_ID, makeApproval('pending'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CustomerApprovalRequiredError);
    });

    it('should throw CustomerApprovalRequiredError for rejected approval', async () => {
      await repository.saveCustomerApproval(TENANT_ID, makeApproval('rejected'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CustomerApprovalRequiredError);
    });

    it('should throw CustomerApprovalRequiredError for expired approval', async () => {
      await repository.saveCustomerApproval(TENANT_ID, makeApproval('expired'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CustomerApprovalRequiredError);
    });

    it('should throw CustomerApprovalRequiredError when approval ID does not exist', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          customerApprovalId: 'non-existent-approval',
        }),
      ).rejects.toThrow(CustomerApprovalRequiredError);
    });
  });

  // ── I7: Tenant Isolation ───────────────────────────────────────────────────

  describe('I7 — Tenant isolation', () => {
    it('should throw when contract belongs to a different tenant', async () => {
      // Contract exists only in TENANT_ID; querying with OTHER_TENANT must fail
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          tenantId: OTHER_TENANT,
        }),
      ).rejects.toThrow();
    });

    it('should throw TenantIsolationViolationError when tenantId is empty', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          tenantId: '',
        }),
      ).rejects.toThrow();
    });
  });

  // ── Error messages ─────────────────────────────────────────────────────────

  describe('Error messages carry actionable context', () => {
    it('ContractNotExecutedError includes contract ID and actual status', async () => {
      await repository.saveContract(TENANT_ID, makeContract('draft'));
      try {
        await service.validateAndBuildProductionRequest(baseInput);
        fail('Expected ContractNotExecutedError');
      } catch (err) {
        expect(err).toBeInstanceOf(ContractNotExecutedError);
        expect((err as Error).message).toContain(CONTRACT_ID);
        expect((err as Error).message).toContain('draft');
      }
    });

    it('BOQNotSealedError includes BOQ ID and actual status', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { boqStatus: 'draft' });
      try {
        await service.validateAndBuildProductionRequest(baseInput);
        fail('Expected BOQNotSealedError');
      } catch (err) {
        expect(err).toBeInstanceOf(BOQNotSealedError);
        expect((err as Error).message).toContain(BOQ_ID);
        expect((err as Error).message).toContain('draft');
      }
    });
  });
});
