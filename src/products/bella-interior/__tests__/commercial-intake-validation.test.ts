/**
 * Bella Interior OS — Commercial Intake Validation Service Tests
 *
 * Verifies that ALL Commercial Source-of-Truth invariants are enforced before
 * any production request payload is built for Platform Manufacturing OS.
 *
 * Invariants under test (governance checkpoints):
 *   I1. BOQ sealed status (strictly 'locked_for_contract' or 'approved' with snapshot)
 *   I2. Quotation accepted prerequisite
 *   I3. Contract executed (signed / active) prerequisite
 *   I4. Customer Approval version-locked (subjectId, subjectVersionNumber, approvedAt)
 *   I5. Unbroken 4-tier version cross-reference integrity (Contract → Quotation → BOQ → Design)
 *   I6. Design Revision approved prerequisite (Approved Design Lock)
 *   I7. Multi-tenant isolation guarded across all entities
 *   I8. Authorization & Separation of Duties (OWNER, ADMIN, PM, ESTIMATOR_LEAD)
 *   I9. Idempotency guard (duplicate requests with same idempotencyKey / contract scope rejected)
 *   I10. Addendum lineage for contract variation releases
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
  CustomerApprovalVersionMismatchError,
  DesignRevisionNotApprovedError,
  CommercialChainVersionMismatchError,
  UnauthorizedProductionRequestError,
  DuplicateProductionRequestError,
  UnapprovedAddendumError,
} from '../services/commercial-intake-validation.service';
import type { InteriorProject, DesignRevision } from '../domain/design-specification/types';
import type {
  InteriorBOQ,
  InteriorQuotation,
  InteriorContract,
  BOQItem,
  ContractAddendum,
} from '../domain/commercial-costing/types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';
import type { ProductionOrder } from '../domain/manufacturing-install/types';

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
const ADDENDUM_ID = randomUUID();

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
  versionNumber = 1,
): InteriorBOQ {
  return {
    id: BOQ_ID,
    tenantId,
    projectId: PROJECT_ID,
    designRevisionId: DESIGN_REV_ID,
    boqNumber: 'BOQ-INTAKE-2026-001',
    versionNumber,
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
  versionNumber = 1,
  boqVersionNumber = 1,
): InteriorQuotation {
  return {
    id: QUOTATION_ID,
    tenantId,
    projectId: PROJECT_ID,
    boqId: BOQ_ID,
    quotationNumber: 'QT-INTAKE-2026-001',
    versionNumber,
    status,
    subtotal: 25_000_000,
    discountAmount: 0,
    vatPercent: 10,
    vatAmount: 2_500_000,
    grandTotal: 27_500_000,
    paymentTerms: '30% tạm ứng, 70% sau nghiệm thu',
    validityDays: 30,
    createdAt: new Date().toISOString(),
    boqVersionNumber,
    totalInternalCogs: 18_000_000,
    totalGrossMargin: 7_000_000,
    grossMarginPercent: 28.0,
    preparedBy: 'Estimator Phạm Thu Hà',
    acceptedAt: status === 'accepted' ? new Date().toISOString() : null,
  };
}

function makeAddendum(
  id = ADDENDUM_ID,
  approved = true,
): ContractAddendum {
  return {
    id,
    tenantId: TENANT_ID,
    contractId: CONTRACT_ID,
    addendumNumber: 'ADD-INTAKE-001',
    title: 'Bổ sung tủ bếp trên đảo',
    valueDelta: 15_000_000,
    reason: 'Khách yêu cầu thêm công năng đảo bếp',
    approvedAt: approved ? new Date().toISOString() : '',
  };
}

function makeContract(
  status: InteriorContract['status'] = 'signed',
  tenantId = TENANT_ID,
  addenda: ContractAddendum[] = [],
  quotationVersionNumber = 1,
  boqVersionNumber = 1,
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
    addenda,
    quotationNumber: 'QT-INTAKE-2026-001',
    quotationVersionNumber,
    boqId: BOQ_ID,
    boqVersionNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeApproval(
  approvalStatus: CustomerApproval['status'] = 'approved',
  tenantId = TENANT_ID,
  subjectType: CustomerApproval['subjectType'] = 'contract',
  subjectId = CONTRACT_ID,
  subjectVersionNumber = 1,
): CustomerApproval {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    id: APPROVAL_ID,
    tenantId,
    projectId: PROJECT_ID,
    subjectType,
    subjectId,
    subjectVersionNumber,
    approvalToken: APPROVAL_TOKEN,
    status: approvalStatus,
    clientRepresentative: 'Nguyễn Thị Lan',
    clientContact: 'lan.nguyen@email.com',
    sentAt: now.toISOString(),
    expiresAt: future.toISOString(),
    approvedAt: approvalStatus === 'approved' ? now.toISOString() : null,
    rejectedAt: approvalStatus === 'rejected' ? now.toISOString() : null,
    signatureReference: {
      storagePath: 'tenants/t1/signatures/sig-contract-001.png',
      storageUrl: 'https://storage.bella.vn/signatures/sig-001.png',
      mimeType: 'image/png',
      fileSizeBytes: 42100,
      sha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
      uploadedAt: now.toISOString(),
    },
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
    addenda?: ContractAddendum[];
    boqVersionNumber?: number;
    quotationVersionNumber?: number;
    contractQuotationVersionNumber?: number;
    contractBoqVersionNumber?: number;
    approvalSubjectVersionNumber?: number;
    approvalSubjectId?: string;
  } = {},
): Promise<void> {
  const boqVer = overrides.boqVersionNumber ?? 1;
  const quoteVer = overrides.quotationVersionNumber ?? 1;
  const contractQuoteVer = overrides.contractQuotationVersionNumber ?? quoteVer;
  const contractBoqVer = overrides.contractBoqVersionNumber ?? boqVer;

  await repo.saveProject(TENANT_ID, makeProject());
  await repo.saveDesignRevision(TENANT_ID, makeDesignRevision('approved'));
  await repo.saveBOQ(TENANT_ID, makeBOQ(overrides.boqStatus ?? 'locked_for_contract', TENANT_ID, boqVer));
  await repo.saveQuotation(TENANT_ID, makeQuotation(overrides.quotationStatus ?? 'accepted', TENANT_ID, quoteVer, boqVer));
  await repo.saveContract(
    TENANT_ID,
    makeContract(
      overrides.contractStatus ?? 'signed',
      TENANT_ID,
      overrides.addenda ?? [],
      contractQuoteVer,
      contractBoqVer,
    ),
  );
  await repo.saveCustomerApproval(
    TENANT_ID,
    makeApproval(
      overrides.approvalStatus ?? 'approved',
      TENANT_ID,
      'contract',
      overrides.approvalSubjectId ?? CONTRACT_ID,
      overrides.approvalSubjectVersionNumber ?? 1,
    ),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CommercialIntakeValidationService — Complete Invariant Battery', () => {
  let repository: InMemoryInteriorRepository;
  let service: CommercialIntakeValidationService;

  const baseInput = {
    tenantId: TENANT_ID,
    actorUserId: 'pm-nguyen-01',
    userRole: 'PROJECT_MANAGER',
    idempotencyKey: 'idemp-release-001',
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
    it('should build a CommercialSourceOfTruth payload with full lineage and audit metadata', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      const { productionRequestInput, validatedChain } = result;
      const cst = productionRequestInput.commercialSourceOfTruth;

      expect(cst.contractId).toBe(CONTRACT_ID);
      expect(cst.quotationId).toBe(QUOTATION_ID);
      expect(cst.boqId).toBe(BOQ_ID);
      expect(cst.designRevisionId).toBe(DESIGN_REV_ID);
      expect(cst.customerApprovalId).toBe(APPROVAL_ID);

      expect(cst.quotationVersionNumber).toBe(1);
      expect(cst.boqVersionNumber).toBe(1);
      expect(cst.designRevisionVersionNumber).toBe(1);

      expect(cst.boqSealedStatus).toBe('locked_for_contract');
      expect(cst.boqSnapshotSealedAt).toBeTruthy();

      expect(cst.signatureReferenceStoragePath).toBe('tenants/t1/signatures/sig-contract-001.png');
      expect(cst.signatureFileSha256).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef');

      expect(cst.authorizedActorRole).toBe('PROJECT_MANAGER');
      expect(cst.idempotencyKey).toBe('idemp-release-001');

      expect(validatedChain.contractNumber).toBe('CT-INTAKE-2026-001');
      expect(validatedChain.quotationNumber).toBe('QT-INTAKE-2026-001');
    });

    it('should derive production items without exposing internal cost fields (cost isolation)', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      const item = result.productionRequestInput.items[0] as unknown as Record<string, unknown>;

      expect(item['itemName']).toBe('Tủ TV âm tường');
      expect(item['quantity']).toBe(1);
      expect(item['internalUnitCost']).toBeUndefined();
      expect(item['clientUnitPrice']).toBeUndefined();
      expect(item['grossMarginAmount']).toBeUndefined();
    });
  });

  // ── I4 & I5: Version-Locked Approval ────────────────────────────────────────

  describe('I4 & I5 — Version-Locked Customer Approval & Cross-References', () => {
    it('should throw CustomerApprovalVersionMismatchError if approval targets a different version', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      // Customer approval was given for subjectVersionNumber 2, but contract is version 1
      await seedValidChain(repository, { approvalSubjectVersionNumber: 2 });

      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CustomerApprovalVersionMismatchError);
    });

    it('should throw CustomerApprovalVersionMismatchError if approval targets a different contract ID', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { approvalSubjectId: 'wrong-contract-id-999' });

      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CustomerApprovalVersionMismatchError);
    });

    it('should throw CommercialChainVersionMismatchError if contract references wrong quotation version', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      // Contract says quotation version 2, but accepted quotation in DB is version 1
      await seedValidChain(repository, { contractQuotationVersionNumber: 2 });

      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CommercialChainVersionMismatchError);
    });

    it('should throw CommercialChainVersionMismatchError if quotation references wrong BOQ version', async () => {
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      // Quotation was prepared from BOQ version 2, but BOQ is version 1
      const wrongQuotation = makeQuotation('accepted', TENANT_ID, 1, 2);
      await seedValidChain(repository);
      await repository.saveQuotation(TENANT_ID, wrongQuotation);

      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(CommercialChainVersionMismatchError);
    });
  });

  // ── I8: Authorization & Separation of Duties ───────────────────────────────

  describe('I8 — Authorization & Separation of Duties', () => {
    it.each(['OWNER', 'ADMIN', 'PROJECT_MANAGER', 'ESTIMATOR_LEAD', 'interior:production:request'])(
      'should allow authorized role: %s',
      async (role) => {
        const result = await service.validateAndBuildProductionRequest({
          ...baseInput,
          userRole: role,
        });
        expect(result.productionRequestInput.userRole).toBe(role);
      },
    );

    it.each(['CLIENT', 'GUEST', 'DESIGNER', 'VIEWER', '', 'ACCOUNTANT'])(
      'should reject unauthorized role: %s with UnauthorizedProductionRequestError',
      async (unauthorizedRole) => {
        await expect(
          service.validateAndBuildProductionRequest({
            ...baseInput,
            userRole: unauthorizedRole,
          }),
        ).rejects.toThrow(UnauthorizedProductionRequestError);
      },
    );
  });

  // ── I9: Idempotency & Duplicate Order Prevention ────────────────────────────

  describe('I9 — Idempotency & Duplicate Order Guard', () => {
    it('should throw DuplicateProductionRequestError if production order with same idempotency key already exists', async () => {
      const existingOrder: ProductionOrder = {
        id: randomUUID(),
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        designRevisionId: DESIGN_REV_ID,
        boqId: BOQ_ID,
        orderNumber: 'PO-2026-001',
        mode: 'in_house',
        status: 'order_released',
        scheduledStartDate: '2026-12-01',
        scheduledCompletionDate: '2027-01-31',
        workshopManagerName: 'Manager Tran',
        items: [],
        notes: `Initial release [idempotency:idemp-release-001]`,
      };
      await repository.saveProductionOrder(TENANT_ID, existingOrder);

      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(DuplicateProductionRequestError);
    });

    it('should throw DuplicateProductionRequestError if initial release for contract was already made without addendum', async () => {
      const existingOrder: ProductionOrder = {
        id: randomUUID(),
        tenantId: TENANT_ID,
        projectId: PROJECT_ID,
        designRevisionId: DESIGN_REV_ID,
        boqId: BOQ_ID,
        orderNumber: 'PO-2026-001',
        mode: 'in_house',
        status: 'in_production',
        scheduledStartDate: '2026-12-01',
        scheduledCompletionDate: '2027-01-31',
        workshopManagerName: 'Manager Tran',
        items: [],
        notes: `Released under [contract:${CONTRACT_ID}]`,
      };
      await repository.saveProductionOrder(TENANT_ID, existingOrder);

      // Attempting another initial release for the same contract must fail
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          idempotencyKey: 'idemp-release-002-retry',
        }),
      ).rejects.toThrow(DuplicateProductionRequestError);
    });
  });

  // ── I10: Addendum Lineage ──────────────────────────────────────────────────

  describe('I10 — Contract Addendum Lineage', () => {
    it('should accept valid approved addendum and populate lineage in CommercialSourceOfTruth', async () => {
      const approvedAddendum = makeAddendum(ADDENDUM_ID, true);
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { addenda: [approvedAddendum] });

      const result = await service.validateAndBuildProductionRequest({
        ...baseInput,
        addendumId: ADDENDUM_ID,
        idempotencyKey: 'idemp-addendum-001',
      });

      expect(result.productionRequestInput.commercialSourceOfTruth.addendumId).toBe(ADDENDUM_ID);
      expect(result.productionRequestInput.commercialSourceOfTruth.addendumNumber).toBe('ADD-INTAKE-001');
      expect(result.validatedChain.addendumNumber).toBe('ADD-INTAKE-001');
    });

    it('should throw UnapprovedAddendumError if addendum ID does not exist in contract', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          addendumId: 'non-existent-addendum-id',
        }),
      ).rejects.toThrow(UnapprovedAddendumError);
    });

    it('should throw UnapprovedAddendumError if addendum is not yet approved (missing approvedAt)', async () => {
      const unapprovedAddendum = makeAddendum(ADDENDUM_ID, false);
      repository = new InMemoryInteriorRepository();
      service = new CommercialIntakeValidationService(repository);
      await seedValidChain(repository, { addenda: [unapprovedAddendum] });

      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          addendumId: ADDENDUM_ID,
        }),
      ).rejects.toThrow(UnapprovedAddendumError);
    });
  });

  // ── I1: BOQ Sealed Status ──────────────────────────────────────────────────

  describe('I1 — BOQ must be sealed', () => {
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

    it('should succeed with canonical locked_for_contract status', async () => {
      const result = await service.validateAndBuildProductionRequest(baseInput);
      expect(result.productionRequestInput.commercialSourceOfTruth.boqSealedStatus).toBe('locked_for_contract');
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
  });

  // ── I6: Design Revision Not Approved ───────────────────────────────────────

  describe('I6 — Design Revision must be approved', () => {
    it('should throw DesignRevisionNotApprovedError if revision is draft', async () => {
      await repository.saveDesignRevision(TENANT_ID, makeDesignRevision('concept'));
      await expect(service.validateAndBuildProductionRequest(baseInput))
        .rejects.toThrow(DesignRevisionNotApprovedError);
    });
  });

  // ── I7: Multi-Tenant Isolation ─────────────────────────────────────────────

  describe('I7 — Tenant Isolation', () => {
    it('should throw when tenantId is empty', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          tenantId: '',
        }),
      ).rejects.toThrow();
    });

    it('should throw when querying with another tenant ID', async () => {
      await expect(
        service.validateAndBuildProductionRequest({
          ...baseInput,
          tenantId: OTHER_TENANT,
        }),
      ).rejects.toThrow();
    });
  });
});
