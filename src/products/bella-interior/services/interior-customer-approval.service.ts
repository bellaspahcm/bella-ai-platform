/**
 * Bella Interior OS — Customer Approval & Digital Signature Service
 *
 * Phase 4: Manages customer-facing approval lifecycle:
 *   1. Send approval request to customer (Quotation or Contract)
 *   2. Record customer approval with optional digital signature reference
 *   3. Record customer rejection — triggers revision workflow
 *   4. Supersede stale pending approvals on new version issuance
 *
 * Architectural Checkpoints:
 *   CP-1: Only sent_to_client / signed items can be submitted for approval
 *   CP-2: Approval token is single-use and tenant-scoped
 *   CP-3: Rejection triggers new quotation version (immutable prior version)
 *   CP-4: Approval record is immutable after recording
 *   CP-5: Multi-tenant isolation — approval belongs to same tenant as subject
 *   CP-6: Domain event interior.quotation.approved.v1 fired after persistence
 *   CP-7: Signature stored as file reference, not inline blob
 *   CP-8: RBAC guards — OWNER/ADMIN/DIRECTOR/PM send; CLIENT read-only
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID } from 'crypto';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';
import type {
  CustomerApproval,
  ApprovalSummary,
  SendApprovalRequestInput,
  RecordApprovalInput,
  RecordRejectionInput,
  SupersedeApprovalsInput,
  SignatureReference,
} from '../domain/commercial-costing/approval.types';

// ─── RBAC ─────────────────────────────────────────────────────────────────────

/** Roles that may send approval requests and manage the approval lifecycle */
const SEND_APPROVAL_ROLES = new Set(['owner', 'admin', 'director', 'pm', 'qs', 'estimator']);

/** Roles that are strictly blocked from sending/managing approvals (read-only) */
const BLOCKED_APPROVAL_ROLES = new Set(['client', 'designer', 'guest']);

// ─── Default Validity ──────────────────────────────────────────────────────────

const DEFAULT_VALIDITY_DAYS_QUOTATION = 14;
const DEFAULT_VALIDITY_DAYS_CONTRACT = 30;

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ApprovalRbacError extends Error {
  constructor(role: string) {
    super(`APPROVAL_RBAC_DENIED: role '${role}' is not authorized to manage customer approvals`);
    this.name = 'ApprovalRbacError';
  }
}

export class ApprovalSubjectStatusError extends Error {
  constructor(message: string) {
    super(`APPROVAL_SUBJECT_STATUS_ERROR: ${message}`);
    this.name = 'ApprovalSubjectStatusError';
  }
}

export class ApprovalTokenError extends Error {
  constructor(message: string) {
    super(`APPROVAL_TOKEN_ERROR: ${message}`);
    this.name = 'ApprovalTokenError';
  }
}

export class ApprovalImmutabilityError extends Error {
  constructor(approvalId: string, currentStatus: string) {
    super(`APPROVAL_IMMUTABILITY: approval '${approvalId}' already has status '${currentStatus}' and cannot be changed`);
    this.name = 'ApprovalImmutabilityError';
  }
}

export class ApprovalTenantIsolationError extends Error {
  constructor() {
    super('APPROVAL_TENANT_ISOLATION: approval token belongs to a different tenant');
    this.name = 'ApprovalTenantIsolationError';
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class InteriorCustomerApprovalService {
  constructor(
    private readonly repo: IInteriorRepository,
    private readonly outbox: InteriorOutboxPort,
  ) {}

  // ─── CP-8: RBAC Guard ───────────────────────────────────────────────────────

  private guardSendRole(userRole: string): void {
    const role = userRole.toLowerCase();
    if (BLOCKED_APPROVAL_ROLES.has(role) || !SEND_APPROVAL_ROLES.has(role)) {
      throw new ApprovalRbacError(userRole);
    }
  }

  // ─── CP-1 & CP-2: Send Approval Request ────────────────────────────────────

  /**
   * Dispatch an approval request to the customer for a quotation or contract.
   *
   * CP-1: Verifies the subject is in a sendable state:
   *       - Quotation: must be in 'sent_to_client' or 'negotiating' status
   *       - Contract:  must be in 'in_review' or 'draft' status
   * CP-2: Generates a single-use, tenant-scoped UUID approval token.
   * CP-5: Tenant isolation — subject tenantId must match input tenantId.
   */
  async sendApprovalRequest(input: SendApprovalRequestInput): Promise<CustomerApproval> {
    // CP-8: RBAC
    this.guardSendRole(input.userRole);

    // CP-1: Verify subject is in a sendable state
    const quotation = input.subjectType === 'quotation'
      ? await this.repo.getQuotation(input.tenantId, input.subjectId)
      : null;
    if (input.subjectType === 'quotation') {
      if (!quotation) {
        throw new ApprovalSubjectStatusError(`quotation '${input.subjectId}' not found`);
      }
      // CP-5: Tenant isolation
      if (quotation.tenantId !== input.tenantId) {
        throw new ApprovalTenantIsolationError();
      }
      if (quotation.projectId !== input.projectId || quotation.versionNumber !== input.subjectVersionNumber) {
        throw new ApprovalSubjectStatusError('quotation project or version does not match the approval request');
      }
      if (quotation.status !== 'draft' && quotation.status !== 'sent_to_client' && quotation.status !== 'negotiating') {
        throw new ApprovalSubjectStatusError(
          `quotation must be draft, sent_to_client, or negotiating to request approval; current: '${quotation.status}'`
        );
      }
    } else if (input.subjectType === 'contract') {
      const contract = await this.repo.getContractForCustomerApproval(input.tenantId, input.subjectId);
      if (!contract) {
        throw new ApprovalSubjectStatusError(`contract '${input.subjectId}' not found`);
      }
      // CP-5: Tenant isolation
      if (contract.tenantId !== input.tenantId) {
        throw new ApprovalTenantIsolationError();
      }
      if (contract.projectId !== input.projectId
        || contract.quotationVersionNumber !== input.subjectVersionNumber) {
        throw new ApprovalSubjectStatusError('contract project or quotation lineage does not match the approval request');
      }
      if (contract.status !== 'draft' && contract.status !== 'in_review') {
        throw new ApprovalSubjectStatusError(
          `contract must be 'draft' or 'in_review' to request approval; current: '${contract.status}'`
        );
      }
    } else {
      const addendum = await this.repo.getContractAddendumForCustomerApproval(input.tenantId, input.subjectId);
      if (!addendum) {
        throw new ApprovalSubjectStatusError(`contract addendum '${input.subjectId}' not found`);
      }
      if (addendum.tenantId !== input.tenantId || addendum.projectId !== input.projectId
        || addendum.versionNumber !== input.subjectVersionNumber
        || addendum.status !== 'pending_customer_approval'
        || addendum.customerApprovalId !== null) {
        throw new ApprovalSubjectStatusError('contract addendum changed or already has a customer approval request');
      }
    }

    const now = new Date();
    const validityDays = input.validityDays ??
      (input.subjectType === 'quotation' ? DEFAULT_VALIDITY_DAYS_QUOTATION : DEFAULT_VALIDITY_DAYS_CONTRACT);
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) {
      throw new ApprovalTokenError('approval validity must be an integer from 1 to 365 days');
    }
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    // CP-2: Single-use, tenant-scoped token
    const approvalToken = randomUUID();

    const approval: CustomerApproval = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectVersionNumber: input.subjectVersionNumber,
      approvalToken,
      status: 'pending',
      clientRepresentative: input.clientRepresentative,
      clientContact: input.clientContact,
      sentAt: now.toISOString(),
      expiresAt,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      customerNotes: null,
      signatureReference: null,
      sentByActorId: input.actorId,
      sentByActorName: input.actorName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // CP-6: Persist first, then publish event (Event-After-Persistence)
    await this.repo.saveCustomerApproval(input.tenantId, approval);

    if (input.subjectType === 'quotation') {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: input.subjectId,
        eventType: 'interior.quotation.approval_sent.v1',
        occurredAt: now.toISOString(),
        actorId: input.actorId,
        actorName: input.actorName,
        payload: {
          projectId: input.projectId,
          quotationId: input.subjectId,
          approvalId: approval.id,
          versionNumber: input.subjectVersionNumber,
          clientRepresentative: input.clientRepresentative,
          expiresAt,
        },
      });
    } else if (input.subjectType === 'contract') {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: input.subjectId,
        eventType: 'interior.contract.approval_sent.v1',
        occurredAt: now.toISOString(),
        actorId: input.actorId,
        actorName: input.actorName,
        payload: {
          projectId: input.projectId,
          contractId: input.subjectId,
          approvalId: approval.id,
          clientRepresentative: input.clientRepresentative,
          expiresAt,
        },
      });
    } else {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: input.subjectId,
        eventType: 'interior.contract.addendum.approval_sent.v1',
        occurredAt: now.toISOString(),
        actorId: input.actorId,
        actorName: input.actorName,
        payload: {
          projectId: input.projectId,
          addendumId: input.subjectId,
          approvalId: approval.id,
          versionNumber: input.subjectVersionNumber,
          clientRepresentative: input.clientRepresentative,
          expiresAt,
        },
      });
    }

    return approval;
  }

  // ─── CP-2, CP-4, CP-6, CP-7: Record Approval ───────────────────────────────

  /**
   * Record customer approval of the quotation/contract.
   *
   * CP-2: Token is validated — single use; must match tenant.
   * CP-4: Approval record is immutable once it leaves 'pending'.
   * CP-7: Optional signature stored as file reference (StorageReference), not blob.
   * CP-6: `interior.quotation.approved.v1` or `interior.contract.customer_approved.v1` fired after persist.
   */
  async recordApproval(input: RecordApprovalInput): Promise<CustomerApproval> {
    // CP-8: RBAC (internal actors record on behalf of system/customer portal)
    // Note: approval recording can also be triggered by customer portal (no internal role check needed
    // when token is validated). We allow any role here because the token IS the authorization.
    // Internal staff can also record on behalf with appropriate role.

    const approval = await this.repo.getCustomerApprovalByToken(input.tenantId, input.approvalToken);

    // CP-2: Token validation
    if (!approval) {
      throw new ApprovalTokenError('approval token not found or belongs to a different tenant');
    }
    if (approval.id !== input.approvalId) {
      throw new ApprovalTokenError('approval id does not match the supplied customer token');
    }
    if (approval.approvalToken !== input.approvalToken) {
      throw new ApprovalTokenError('approval token mismatch');
    }
    if (approval.sentByActorId === input.actorId) {
      throw new ApprovalTokenError('the actor who sent the request cannot record the customer decision');
    }

    // CP-4: Immutability — cannot change a non-pending approval
    if (approval.status !== 'pending') {
      throw new ApprovalImmutabilityError(approval.id, approval.status);
    }

    const quotation = approval.subjectType === 'quotation'
      ? await this.repo.getQuotation(input.tenantId, approval.subjectId)
      : null;
    const contract = approval.subjectType === 'contract'
      ? await this.repo.getContract(input.tenantId, approval.subjectId)
      : null;
    const addendum = approval.subjectType === 'contract_addendum'
      ? await this.repo.getContractAddendumForCustomerApproval(input.tenantId, approval.subjectId)
      : null;
    if (approval.subjectType === 'quotation'
      && (!quotation || quotation.versionNumber !== approval.subjectVersionNumber
        || (quotation.status !== 'sent_to_client' && quotation.status !== 'negotiating'))) {
      throw new ApprovalSubjectStatusError('quotation version changed or is no longer awaiting customer approval');
    }
    if (approval.subjectType === 'contract'
      && (!contract || (contract.status !== 'draft' && contract.status !== 'in_review'))) {
      throw new ApprovalSubjectStatusError('contract is no longer awaiting customer signature');
    }
    if (approval.subjectType === 'contract_addendum'
      && (!addendum || addendum.projectId !== approval.projectId
        || addendum.status !== 'pending_customer_approval'
        || addendum.customerApprovalId !== approval.id)) {
      throw new ApprovalSubjectStatusError('contract addendum is no longer awaiting customer approval');
    }

    // Check token expiry
    if (new Date(approval.expiresAt) < new Date()) {
      throw new ApprovalTokenError(`approval token expired at ${approval.expiresAt}`);
    }

    const now = new Date().toISOString();

    // CP-7: Signature stored as reference only
    const signatureReference: SignatureReference | null = input.signatureReference
      ? { ...input.signatureReference, uploadedAt: now }
      : null;
    if (approval.subjectType === 'contract'
      && (!signatureReference
        || !/^[0-9a-f]{64}$/i.test(signatureReference.sha256Hash)
        || !signatureReference.storagePath.trim()
        || signatureReference.fileSizeBytes <= 0)) {
      throw new ApprovalTokenError('A valid customer signature file reference and SHA-256 are required to sign a contract.');
    }

    const updated: CustomerApproval = {
      ...approval,
      status: 'approved',
      approvedAt: now,
      customerNotes: input.customerNotes ?? null,
      signatureReference,
      updatedAt: now,
    };

    // CP-4: Atomic conditional update guard (WHERE status = 'pending' AND expires_at > now())
    const transitioned = await this.repo.transitionCustomerApproval(input.tenantId, approval.id, updated);
    if (!transitioned) {
      const latest = await this.repo.getCustomerApproval(input.tenantId, approval.id);
      if (latest && latest.status !== 'pending') {
        throw new ApprovalImmutabilityError(approval.id, latest.status);
      }
      throw new ApprovalTokenError(`Atomic token consumption failed: token already consumed or expired for approval '${approval.id}'`);
    }

    // The database trigger advances the exact quotation/contract/project in the
    // same transaction as the conditional single-use token update.

    const eventType = updated.subjectType === 'quotation'
      ? 'interior.quotation.approved.v1'
      : updated.subjectType === 'contract'
        ? 'interior.contract.customer_approved.v1'
        : 'interior.contract.addendum.approved.v1';

    await this.outbox.publishDomainEvent({
      id: randomUUID(),
      tenantId: input.tenantId,
      aggregateType: 'interior_contract',
      aggregateId: updated.subjectId,
      eventType,
      occurredAt: now,
      actorId: input.actorId,
      actorName: input.actorName,
      payload: {
        projectId: updated.projectId,
        ...(updated.subjectType === 'quotation'
          ? { quotationId: updated.subjectId, versionNumber: updated.subjectVersionNumber }
          : updated.subjectType === 'contract'
            ? { contractId: updated.subjectId }
            : { addendumId: updated.subjectId, versionNumber: updated.subjectVersionNumber }),
        approvalId: updated.id,
        clientRepresentative: updated.clientRepresentative,
        hasSignature: signatureReference !== null,
      },
    });

    if (updated.subjectType === 'contract' && contract) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.contract.signed.v1',
        occurredAt: now,
        actorId: input.actorId,
        actorName: input.actorName,
        payload: {
          projectId: contract.projectId,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          baselineContractValue: contract.baselineContractValue,
          quotationId: contract.quotationId,
          approvalId: updated.id,
          signatureSha256: signatureReference?.sha256Hash,
        },
      });

      const firstMilestone = contract.milestones
        .slice()
        .sort((left, right) => left.milestoneOrder - right.milestoneOrder)[0];
      if (firstMilestone) {
        await this.outbox.enqueueFinanceMilestone({
          tenantId: input.tenantId,
          projectId: contract.projectId,
          contractId: contract.id,
          milestoneOrder: firstMilestone.milestoneOrder,
          milestoneName: firstMilestone.name,
          amount: firstMilestone.amount,
          currency: 'VND',
          clientName: contract.clientRepresentative,
          occurredAt: now,
        });
      }
    }

    return updated;
  }

  // ─── CP-3: Record Rejection ─────────────────────────────────────────────────

  /**
   * Record customer rejection of the quotation/contract.
   *
   * CP-3: Rejection is recorded; a new quotation revision MUST be issued
   *       by the commercial team (this service records the rejection; the
   *       Quotation Margin Service handles the fork/revision).
   * CP-4: Approval record is immutable once rejected.
   * CP-6: `interior.quotation.rejected.v1` fired after persist.
   */
  async recordRejection(input: RecordRejectionInput): Promise<CustomerApproval> {
    if (!input.rejectionReason.trim()) {
      throw new ApprovalTokenError('rejectionReason is required when recording a rejection');
    }

    const approval = await this.repo.getCustomerApprovalByToken(input.tenantId, input.approvalToken);

    if (!approval) {
      throw new ApprovalTokenError('approval token not found or belongs to a different tenant');
    }
    if (approval.id !== input.approvalId) {
      throw new ApprovalTokenError('approval id does not match the supplied customer token');
    }
    if (approval.sentByActorId === input.actorId) {
      throw new ApprovalTokenError('the actor who sent the request cannot record the customer decision');
    }

    // CP-4: Immutability
    if (approval.status !== 'pending') {
      throw new ApprovalImmutabilityError(approval.id, approval.status);
    }

    const now = new Date().toISOString();

    const updated: CustomerApproval = {
      ...approval,
      status: 'rejected',
      rejectedAt: now,
      rejectionReason: input.rejectionReason,
      customerNotes: input.customerNotes ?? null,
      updatedAt: now,
    };

    // CP-4: Atomic conditional update guard (WHERE status = 'pending' AND expires_at > now())
    const transitioned = await this.repo.transitionCustomerApproval(input.tenantId, approval.id, updated);
    if (!transitioned) {
      const latest = await this.repo.getCustomerApproval(input.tenantId, approval.id);
      if (latest && latest.status !== 'pending') {
        throw new ApprovalImmutabilityError(approval.id, latest.status);
      }
      throw new ApprovalTokenError(`Atomic token consumption failed: token already consumed or expired for approval '${approval.id}'`);
    }

    // Rejections are explicit domain events; no commercial value changes on rejection.
    if (updated.subjectType === 'quotation' || updated.subjectType === 'contract_addendum') {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: updated.subjectId,
        eventType: updated.subjectType === 'quotation'
          ? 'interior.quotation.rejected.v1'
          : 'interior.contract.addendum.rejected.v1',
        occurredAt: now,
        actorId: input.actorId,
        actorName: input.actorName,
        payload: {
          projectId: updated.projectId,
          ...(updated.subjectType === 'quotation'
            ? { quotationId: updated.subjectId, versionNumber: updated.subjectVersionNumber }
            : { addendumId: updated.subjectId }),
          approvalId: updated.id,
          versionNumber: updated.subjectVersionNumber,
          rejectionReason: input.rejectionReason,
        },
      });
    }

    return updated;
  }

  // ─── Supersede Pending Approvals ────────────────────────────────────────────

  /**
   * Supersede all pending approval requests for a subject.
   * Called automatically when a new quotation version is issued.
   */
  async supersedePendingApprovals(input: SupersedeApprovalsInput): Promise<void> {
    await this.repo.supersedePendingApprovals(
      input.tenantId,
      input.subjectId,
      input.reason
    );
  }

  // ─── Approval Summary ───────────────────────────────────────────────────────

  /**
   * Returns an approval summary for a subject (quotation or contract).
   * Used by overview screens to display approval status.
   */
  async getApprovalSummary(
    tenantId: string,
    subjectType: 'quotation' | 'contract' | 'contract_addendum',
    subjectId: string
  ): Promise<ApprovalSummary> {
    const approvals = await this.repo.listCustomerApprovals(tenantId, subjectId);

    if (approvals.length === 0) {
      return {
        subjectType,
        subjectId,
        currentStatus: 'not_sent',
        totalRequestsSent: 0,
        hasSignature: false,
      };
    }

    // Most recent approval is last in sorted list
    const latest = approvals[approvals.length - 1];

    return {
      subjectType,
      subjectId,
      currentStatus: latest.status,
      totalRequestsSent: approvals.length,
      lastSentAt: latest.sentAt,
      approvedAt: latest.approvedAt ?? undefined,
      rejectedAt: latest.rejectedAt ?? undefined,
      rejectionReason: latest.rejectionReason ?? undefined,
      hasSignature: latest.signatureReference !== null && latest.signatureReference !== undefined,
    };
  }
}

