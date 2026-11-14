/**
 * Bella Interior OS — Commercial Intake Validation Service
 *
 * Guards the boundary between Commercial Proposal (Phases 1–4) and
 * Manufacturing OS Downstream Intake. Validates that ALL Commercial
 * Source-of-Truth invariants are satisfied before constructing a
 * production request payload.
 *
 * ARCHITECTURAL BOUNDARY:
 *   This service DOES NOT create Production Orders — it validates that
 *   Interior OS has a complete, consistent commercial chain before delegating
 *   to Platform Manufacturing OS via InteriorProductionRequestPort.
 *
 * INVARIANTS ENFORCED:
 *   I1. BOQ must be approved/locked and its immutable snapshot must be sealed
 *   I2. Quotation must be accepted (status = 'accepted') and match contract
 *   I3. Contract must be executed (status = 'signed' or 'active')
 *   I4. Customer Approval must be 'approved' for the exact contract & version (not another revision)
 *   I5. Unbroken 4-tier version cross-references: Contract → Quotation → BOQ → Design
 *   I6. Design Revision must be 'approved'
 *   I7. Multi-Tenant Isolation guarded on all entity lookups
 *   I8. Authorization & Separation of Duties: requesting actor must hold authorized role
 *   I9. Idempotency: duplicate requests with identical idempotencyKey/release scope rejected
 *   I10. Addendum Lineage: variation order releases must reference approved addendum
 *
 * @module src/products/bella-interior/services/commercial-intake-validation.service
 */

import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type {
  CommercialSourceOfTruth,
  FurnitureProductionItem,
  InteriorProductionRequestInput,
} from '../ports/interior-production-request.port';
import { TenantIsolationViolationError } from '../domain/errors';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Thrown when the BOQ has not been sealed before triggering production.
 * Manufacturing MUST NOT consume a draft or under-review BOQ.
 */
export class BOQNotSealedError extends Error {
  constructor(boqId: string, boqStatus: string) {
    super(
      `BOQ ${boqId} is not sealed for production intake (status: '${boqStatus}'). ` +
        `BOQ must be approved or locked with a sealed snapshot.`,
    );
    this.name = 'BOQNotSealedError';
  }
}

/**
 * Thrown when the Quotation has not been accepted by the customer.
 */
export class QuotationNotAcceptedError extends Error {
  constructor(quotationId: string, quotationStatus: string) {
    super(
      `Quotation ${quotationId} is not accepted (status: '${quotationStatus}'). ` +
        `Only accepted quotations may trigger production.`,
    );
    this.name = 'QuotationNotAcceptedError';
  }
}

/**
 * Thrown when the Contract has not been executed (signed/active).
 */
export class ContractNotExecutedError extends Error {
  constructor(contractId: string, contractStatus: string) {
    super(
      `Contract ${contractId} is not executed (status: '${contractStatus}'). ` +
        `Only signed or active contracts may trigger production.`,
    );
    this.name = 'ContractNotExecutedError';
  }
}

/**
 * Thrown when no approved Customer Approval record exists for the contract.
 */
export class CustomerApprovalRequiredError extends Error {
  constructor(contractId: string, approvalId: string) {
    super(
      `No approved Customer Approval found for contract '${contractId}' ` +
        `(approval ID: '${approvalId}'). Customer must approve before production can begin.`,
    );
    this.name = 'CustomerApprovalRequiredError';
  }
}

/**
 * Thrown when Customer Approval is for a different subject or different version.
 */
export class CustomerApprovalVersionMismatchError extends Error {
  constructor(message: string) {
    super(`Customer Approval version mismatch: ${message}`);
    this.name = 'CustomerApprovalVersionMismatchError';
  }
}

/**
 * Thrown when the Design Revision referenced by the BOQ is not approved.
 */
export class DesignRevisionNotApprovedError extends Error {
  constructor(revisionId: string, revisionStatus: string) {
    super(
      `Design Revision ${revisionId} is not approved (status: '${revisionStatus}'). ` +
        `Approved Design Lock violation — production requires an approved revision.`,
    );
    this.name = 'DesignRevisionNotApprovedError';
  }
}

/**
 * Thrown when Commercial chain version cross-references are inconsistent.
 */
export class CommercialChainVersionMismatchError extends Error {
  constructor(message: string) {
    super(`Commercial Source-of-Truth version mismatch: ${message}`);
    this.name = 'CommercialChainVersionMismatchError';
  }
}

/**
 * Thrown when the actor does not hold the required authorization role.
 */
export class UnauthorizedProductionRequestError extends Error {
  constructor(userRole: string, actorId: string) {
    super(
      `Actor '${actorId}' with role '${userRole}' is not authorized to issue production requests. ` +
        `Required roles: OWNER, ADMIN, PROJECT_MANAGER, ESTIMATOR_LEAD, or 'interior:production:request'.`,
    );
    this.name = 'UnauthorizedProductionRequestError';
  }
}

/**
 * Thrown when a duplicate production request is detected with the same idempotency key.
 */
export class DuplicateProductionRequestError extends Error {
  constructor(idempotencyKey: string) {
    super(
      `Duplicate production request detected for idempotency key '${idempotencyKey}'. ` +
        `A production order has already been issued for this scope.`,
    );
    this.name = 'DuplicateProductionRequestError';
  }
}

/**
 * Thrown when an addendum reference is invalid or unapproved.
 */
export class UnapprovedAddendumError extends Error {
  constructor(addendumId: string, reason: string) {
    super(`Contract addendum '${addendumId}' is not valid for production release: ${reason}`);
    this.name = 'UnapprovedAddendumError';
  }
}

// ---------------------------------------------------------------------------
// Authorized Roles
// ---------------------------------------------------------------------------

const AUTHORIZED_PRODUCTION_ROLES = new Set([
  'OWNER',
  'ADMIN',
  'PROJECT_MANAGER',
  'ESTIMATOR_LEAD',
  'interior:production:request',
]);

// ---------------------------------------------------------------------------
// Input / Output Types
// ---------------------------------------------------------------------------

export interface CommercialIntakeValidationInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  /** Role of the requesting actor for RBAC verification (I8) */
  readonly userRole: string;
  /** Unique idempotency key to prevent double-click / duplicate production orders (I9) */
  readonly idempotencyKey: string;
  readonly interiorProjectId: string;
  readonly projectCode: string;
  /** Anchor contract ID */
  readonly contractId: string;
  /** Customer Approval ID that authorized the contract execution */
  readonly customerApprovalId: string;
  readonly requiredByDate: string;
  /** Optional reference to approved contract addendum for variation releases (I10) */
  readonly addendumId?: string;
  readonly notes?: string;
}

export interface CommercialIntakeValidationResult {
  readonly productionRequestInput: InteriorProductionRequestInput;
  readonly validatedChain: {
    readonly contractNumber: string;
    readonly quotationNumber: string;
    readonly boqNumber: string;
    readonly designRevisionTitle: string;
    readonly customerApprovalSentAt: string;
    readonly baselineContractValue: number;
    readonly currentContractValue: number;
    readonly addendumNumber?: string;
  };
}

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class CommercialIntakeValidationService {
  constructor(private readonly repository: IInteriorRepository) {}

  /**
   * Validates the full Commercial Source-of-Truth chain and builds a
   * ready-to-submit InteriorProductionRequestInput.
   *
   * Throws a typed domain error if any invariant is violated.
   * Returns the validated payload if all invariants pass.
   */
  async validateAndBuildProductionRequest(
    input: CommercialIntakeValidationInput,
  ): Promise<CommercialIntakeValidationResult> {
    // ── I7: Tenant Isolation Guard ──────────────────────────────────────────
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // ── I8: Authorization / Separation of Duties Guard ─────────────────────
    if (!input.userRole || !AUTHORIZED_PRODUCTION_ROLES.has(input.userRole)) {
      throw new UnauthorizedProductionRequestError(input.userRole || 'NONE', input.actorUserId);
    }

    // ── I9: Idempotency Guard (Check duplicate orders) ─────────────────────
    if (!input.idempotencyKey) {
      throw new Error('idempotencyKey is required for production intake validation');
    }
    const existingOrders = await this.repository.listProductionOrders(
      input.tenantId,
      input.interiorProjectId,
    );
    const isDuplicate = existingOrders.some((order) => {
      // Check if order notes record this exact idempotency key
      const matchesKey = order.notes?.includes(`[idempotency:${input.idempotencyKey}]`);
      // Or check if same contract has already been released without addendum
      const matchesContractScope =
        !input.addendumId &&
        order.notes?.includes(`[contract:${input.contractId}]`) &&
        order.status !== 'cancelled';
      return matchesKey || matchesContractScope;
    });
    if (isDuplicate) {
      throw new DuplicateProductionRequestError(input.idempotencyKey);
    }

    // ── I3: Resolve Contract and verify execution state ─────────────────────
    const contract = await this.repository.getContract(input.tenantId, input.contractId);
    if (!contract) {
      throw new Error(`Contract ${input.contractId} not found in tenant ${input.tenantId}`);
    }
    if (contract.tenantId !== input.tenantId) {
      throw new TenantIsolationViolationError();
    }
    const project = await this.repository.getProject(input.tenantId, input.interiorProjectId);
    if (!project || project.id !== contract.projectId || project.code !== input.projectCode) {
      throw new CommercialChainVersionMismatchError('project identity/code does not match the contract release scope');
    }
    if (contract.status !== 'signed' && contract.status !== 'active') {
      throw new ContractNotExecutedError(input.contractId, contract.status);
    }

    // ── I10: Addendum Lineage (if variation release) ────────────────────────
    let matchedAddendumNumber: string | undefined;
    let matchedAddendumApprovalId: string | undefined;
    if (input.addendumId) {
      const addendum = contract.addenda?.find((a) => a.id === input.addendumId);
      if (!addendum) {
        throw new UnapprovedAddendumError(
          input.addendumId,
          `Addendum '${input.addendumId}' not found in contract '${contract.id}'`,
        );
      }
      if (addendum.status !== 'approved' || !addendum.approvedAt || !addendum.customerApprovalId) {
        throw new UnapprovedAddendumError(
          input.addendumId,
          `Addendum '${addendum.addendumNumber}' is missing customer approval evidence`,
        );
      }
      const addendumApproval = await this.repository.getCustomerApproval(input.tenantId, addendum.customerApprovalId);
      if (!addendumApproval || addendumApproval.tenantId !== input.tenantId
        || addendumApproval.projectId !== project.id
        || addendumApproval.subjectType !== 'contract_addendum'
        || addendumApproval.subjectId !== addendum.id
        || addendumApproval.subjectVersionNumber !== 1
        || addendumApproval.status !== 'approved' || !addendumApproval.approvedAt) {
        throw new UnapprovedAddendumError(
          input.addendumId,
          `Addendum '${addendum.addendumNumber}' does not reference its exact approved customer evidence`,
        );
      }
      matchedAddendumNumber = addendum.addendumNumber;
      matchedAddendumApprovalId = addendumApproval.id;
    }

    // ── I2: Resolve Quotation and verify acceptance ─────────────────────────
    const quotation = await this.repository.getQuotation(input.tenantId, contract.quotationId);
    if (!quotation) {
      throw new Error(
        `Quotation ${contract.quotationId} linked to contract ${input.contractId} not found`,
      );
    }
    if (quotation.status !== 'accepted') {
      throw new QuotationNotAcceptedError(quotation.id, quotation.status);
    }
    if (quotation.projectId !== project.id || contract.projectId !== project.id) {
      throw new CommercialChainVersionMismatchError('contract and accepted quotation must belong to the requested project');
    }
    if (contract.quotationVersionNumber !== quotation.versionNumber
      || !contract.boqId || contract.boqId !== quotation.boqId
      || contract.boqVersionNumber == null || quotation.boqVersionNumber == null
      || contract.boqVersionNumber !== quotation.boqVersionNumber) {
      throw new CommercialChainVersionMismatchError('contract must capture the exact accepted quotation and BOQ versions');
    }

    const quotationApprovalId = contract.quotationCustomerApprovalId;
    if (!quotationApprovalId) {
      throw new CustomerApprovalRequiredError(contract.id, 'quotation-approval-missing');
    }
    const quotationApproval = await this.repository.getCustomerApproval(input.tenantId, quotationApprovalId);
    if (!quotationApproval || quotationApproval.tenantId !== input.tenantId
      || quotationApproval.projectId !== project.id
      || quotationApproval.subjectType !== 'quotation'
      || quotationApproval.subjectId !== quotation.id
      || quotationApproval.subjectVersionNumber !== quotation.versionNumber
      || quotationApproval.status !== 'approved' || !quotationApproval.approvedAt) {
      throw new CustomerApprovalVersionMismatchError('contract quotation approval must prove the exact accepted quotation version');
    }

    // ── I1: Resolve BOQ and verify sealed status ────────────────────────────
    const boq = await this.repository.getBOQ(input.tenantId, contract.boqId ?? quotation.boqId);
    if (!boq) {
      throw new Error(`BOQ ${quotation.boqId} linked to quotation ${quotation.id} not found`);
    }
    // Approved and locked BOQs are eligible only when the persisted snapshot
    // has its own seal timestamp; updated_at is not a substitute for sealing.
    if (
      (boq.status !== 'locked_for_contract' && boq.status !== 'approved') ||
      !boq.snapshotSealedAt
    ) {
      throw new BOQNotSealedError(boq.id, boq.status);
    }
    const boqSnapshotSealedAt = boq.snapshotSealedAt;

    // ── I6: Resolve Design Revision and verify approval ─────────────────────
    const designRevision = await this.repository.getDesignRevision(
      input.tenantId,
      boq.designRevisionId,
    );
    if (!designRevision) {
      throw new Error(
        `Design Revision ${boq.designRevisionId} linked to BOQ ${boq.id} not found`,
      );
    }
    if (designRevision.status !== 'approved') {
      throw new DesignRevisionNotApprovedError(designRevision.id, designRevision.status);
    }

    // ── I4: Resolve Customer Approval and verify approval state ────────────
    const customerApproval = await this.repository.getCustomerApproval(
      input.tenantId,
      input.customerApprovalId,
    );
    if (!customerApproval || customerApproval.status !== 'approved') {
      throw new CustomerApprovalRequiredError(input.contractId, input.customerApprovalId);
    }
    if (customerApproval.tenantId !== input.tenantId) {
      throw new TenantIsolationViolationError();
    }
    if (!customerApproval.approvedAt) {
      throw new CustomerApprovalRequiredError(input.contractId, input.customerApprovalId);
    }

    // ── I4 & I5: Version-Locked Approval & Cross-Reference Integrity ────────
    // 1. Approval subject must match Contract (or Quotation)
    if (customerApproval.subjectType === 'contract') {
      if (contract.customerApprovalId !== customerApproval.id
        || customerApproval.projectId !== project.id
        || customerApproval.subjectId !== contract.id) {
        throw new CustomerApprovalVersionMismatchError(
          `Customer Approval ${input.customerApprovalId} is not the exact signature evidence stored on contract '${contract.id}'`,
        );
      }
      // Subject version must match contract formation version (1 for initial execution)
      const expectedSubjectVersion = 1;
      if (customerApproval.subjectVersionNumber !== expectedSubjectVersion) {
        throw new CustomerApprovalVersionMismatchError(
          `Customer Approval version ${customerApproval.subjectVersionNumber} does not match ` +
            `contract execution version ${expectedSubjectVersion}`,
        );
      }
      const signature = customerApproval.signatureReference;
      if (!signature || !signature.storagePath.trim() || signature.fileSizeBytes <= 0
        || !/^[0-9a-f]{64}$/i.test(signature.sha256Hash)) {
        throw new CustomerApprovalVersionMismatchError('contract signature evidence is incomplete or has an invalid checksum');
      }
    } else {
      throw new CustomerApprovalVersionMismatchError('production release requires the approved customer signature for the exact contract');
    }

    // 2. Quotation version cross-reference to BOQ
    if (quotation.boqVersionNumber !== boq.versionNumber || contract.boqVersionNumber !== boq.versionNumber) {
      throw new CommercialChainVersionMismatchError(
        `Quotation ${quotation.id} references BOQ version ${quotation.boqVersionNumber} ` +
          `but BOQ ${boq.id} has version ${boq.versionNumber}`,
      );
    }

    // 3. Contract cross-reference to Quotation version
    if (contract.quotationVersionNumber !== quotation.versionNumber) {
      throw new CommercialChainVersionMismatchError(
        `Contract ${contract.id} references Quotation version ${contract.quotationVersionNumber} ` +
          `but accepted Quotation is version ${quotation.versionNumber}`,
      );
    }

    // 4. Contract cross-reference to BOQ version
    if (contract.designRevisionId !== designRevision.id
      || contract.designVersionNumber !== designRevision.versionNumber) {
      throw new CommercialChainVersionMismatchError(
        `Contract ${contract.id} does not reference the exact sealed BOQ design revision/version`,
      );
    }

    // ── Build Commercial Source-of-Truth ─────────────────────────────────────
    const commercialSourceOfTruth: CommercialSourceOfTruth = {
      contractId: contract.id,
      quotationId: quotation.id,
      quotationVersionNumber: quotation.versionNumber,
      boqId: boq.id,
      boqVersionNumber: boq.versionNumber,
      boqSnapshotSealedAt,
      boqSealedStatus: boq.status,
      designRevisionId: designRevision.id,
      designRevisionVersionNumber: designRevision.versionNumber,
      customerApprovalId: customerApproval.id,
      signatureReferenceStoragePath: customerApproval.signatureReference?.storagePath,
      signatureFileSha256: customerApproval.signatureReference?.sha256Hash,
      baselineContractValue: contract.baselineContractValue,
      currentContractValue: contract.currentContractValue,
      authorizedActorRole: input.userRole,
      idempotencyKey: input.idempotencyKey,
      addendumId: input.addendumId,
      addendumNumber: matchedAddendumNumber,
      addendumCustomerApprovalId: matchedAddendumApprovalId,
    };

    // ── Build Production Items (Derived without internal cost fields) ────────
    const items: FurnitureProductionItem[] = boq.items.map((boqItem) => ({
      boqItemId: boqItem.id,
      itemName: boqItem.itemName,
      roomZoneName: boqItem.roomZoneName,
      quantity: boqItem.quantity,
      unit: boqItem.unit,
      carcassMaterial: boqItem.specifications.carcassMaterial,
      doorFrontMaterial: boqItem.specifications.doorFrontMaterial,
      surfaceFinish: boqItem.specifications.surfaceFinish,
      hardwareSpec: boqItem.specifications.hardwareSpec,
      dimensionsMm: {
        width: boqItem.dimensions.width,
        depth: boqItem.dimensions.depth,
        height: boqItem.dimensions.height,
      },
      estimatedProductionHours: 2 * boqItem.quantity,
    }));

    const productionRequestInput: InteriorProductionRequestInput = {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      userRole: input.userRole,
      idempotencyKey: input.idempotencyKey,
      designRevisionId: designRevision.id,
      interiorProjectId: input.interiorProjectId,
      projectCode: input.projectCode,
      commercialSourceOfTruth,
      items,
      requiredByDate: input.requiredByDate,
      addendumId: input.addendumId,
      notes: input.notes,
    };

    return {
      productionRequestInput,
      validatedChain: {
        contractNumber: contract.contractNumber,
        quotationNumber: quotation.quotationNumber,
        boqNumber: boq.boqNumber,
        designRevisionTitle: designRevision.title,
        customerApprovalSentAt: customerApproval.sentAt,
        baselineContractValue: contract.baselineContractValue,
        currentContractValue: contract.currentContractValue,
        addendumNumber: matchedAddendumNumber,
      },
    };
  }
}
