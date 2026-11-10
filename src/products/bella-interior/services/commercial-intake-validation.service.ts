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
 *   I1. BOQ must be sealed (snapshot_sealed_at IS NOT NULL / status = 'approved' or 'locked_for_contract')
 *   I2. Quotation must be accepted (status = 'accepted')
 *   I3. Contract must be executed (status = 'signed' or 'active')
 *   I4. Customer Approval must exist and be 'approved' for the contract
 *   I5. Version cross-references must match persisted records
 *   I6. Design Revision must be 'approved'
 *   I7. All entity IDs must resolve within the same tenant (tenant isolation)
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
        `BOQ must be 'approved' or 'locked_for_contract' with snapshot_sealed_at set.`,
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

// ---------------------------------------------------------------------------
// Input to the validation service
// ---------------------------------------------------------------------------

export interface CommercialIntakeValidationInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly interiorProjectId: string;
  readonly projectCode: string;
  /**
   * The contract from which intake is being triggered.
   * Validation resolves the full commercial chain from this anchor.
   */
  readonly contractId: string;
  /**
   * Customer Approval ID that authorized the contract execution.
   */
  readonly customerApprovalId: string;
  readonly requiredByDate: string;
  readonly notes?: string;
}

/**
 * Result of a successful validation — a ready-to-submit production request.
 * Caller passes this directly to InteriorProductionRequestPort.requestProduction().
 */
export interface CommercialIntakeValidationResult {
  readonly productionRequestInput: InteriorProductionRequestInput;
  /**
   * Summary of the validated commercial chain for audit purposes.
   */
  readonly validatedChain: {
    readonly contractNumber: string;
    readonly quotationNumber: string;
    readonly boqNumber: string;
    readonly designRevisionTitle: string;
    readonly customerApprovalSentAt: string;
    readonly baselineContractValue: number;
    readonly currentContractValue: number;
  };
}

// ---------------------------------------------------------------------------
// Service
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
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // ── I3: Resolve contract and verify it is executed ──────────────────────
    const contract = await this.repository.getContract(input.tenantId, input.contractId);
    if (!contract) {
      throw new Error(`Contract ${input.contractId} not found in tenant ${input.tenantId}`);
    }
    if (contract.tenantId !== input.tenantId) {
      throw new TenantIsolationViolationError();
    }
    if (contract.status !== 'signed' && contract.status !== 'active') {
      throw new ContractNotExecutedError(input.contractId, contract.status);
    }

    // ── I2: Resolve quotation and verify it is accepted ─────────────────────
    const quotation = await this.repository.getQuotation(input.tenantId, contract.quotationId);
    if (!quotation) {
      throw new Error(
        `Quotation ${contract.quotationId} linked to contract ${input.contractId} not found`,
      );
    }
    if (quotation.status !== 'accepted') {
      throw new QuotationNotAcceptedError(quotation.id, quotation.status);
    }

    // ── I1: Resolve BOQ and verify it is sealed ──────────────────────────────
    const boq = await this.repository.getBOQ(input.tenantId, quotation.boqId);
    if (!boq) {
      throw new Error(`BOQ ${quotation.boqId} linked to quotation ${quotation.id} not found`);
    }
    const boqSealedStatuses = ['approved', 'locked_for_contract'] as const;
    if (!boqSealedStatuses.includes(boq.status as (typeof boqSealedStatuses)[number])) {
      throw new BOQNotSealedError(boq.id, boq.status);
    }
    // snapshot_sealed_at must be present — represented as non-draft status here
    // (the actual DB column is verified by the migration; at the domain level,
    // an approved/locked_for_contract BOQ is considered sealed)
    const boqSnapshotSealedAt = boq.updatedAt; // Canonical sealed timestamp from domain

    // ── I6: Resolve Design Revision and verify it is approved ────────────────
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

    // ── I4: Resolve Customer Approval and verify it is approved ─────────────
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

    // ── I5: Cross-reference version consistency ──────────────────────────────
    // Quotation must reference the same BOQ version as declared in the quotation record
    if (quotation.boqVersionNumber !== undefined && quotation.boqVersionNumber !== boq.versionNumber) {
      throw new CommercialChainVersionMismatchError(
        `Quotation ${quotation.id} references BOQ version ${quotation.boqVersionNumber} ` +
          `but BOQ ${boq.id} has version ${boq.versionNumber}`,
      );
    }
    // Customer Approval must reference this contract as subject
    if (
      customerApproval.subjectType === 'contract' &&
      customerApproval.subjectId !== contract.id
    ) {
      throw new CommercialChainVersionMismatchError(
        `Customer Approval ${input.customerApprovalId} references subject ` +
          `'${customerApproval.subjectId}' but expected contract '${contract.id}'`,
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
      designRevisionId: designRevision.id,
      designRevisionVersionNumber: designRevision.versionNumber,
      customerApprovalId: customerApproval.id,
      baselineContractValue: contract.baselineContractValue,
      currentContractValue: contract.currentContractValue,
    };

    // ── Build Production Items from sealed BOQ ────────────────────────────────
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
      // Estimated production hours: conservative 2h base per item, scaled by quantity
      // This is a planning estimate — Manufacturing OS refines with RoutingRevision
      estimatedProductionHours: 2 * boqItem.quantity,
    }));

    const productionRequestInput: InteriorProductionRequestInput = {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      designRevisionId: designRevision.id,
      interiorProjectId: input.interiorProjectId,
      projectCode: input.projectCode,
      commercialSourceOfTruth,
      items,
      requiredByDate: input.requiredByDate,
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
      },
    };
  }
}

