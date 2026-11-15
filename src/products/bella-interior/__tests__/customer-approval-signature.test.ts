/**
 * Bella Interior OS — Commercial Proposal Phase 4
 * Customer Approval & Digital Signature Tests
 *
 * 8 Architectural Checkpoints:
 *   CP-1: Only customer-facing quotation / unsigned contract states can be submitted for approval
 *   CP-2: Approval token is single-use and tenant-scoped
 *   CP-3: Rejection triggers new quotation version (immutable prior version)
 *   CP-4: Approval record is immutable after recording
 *   CP-5: Multi-tenant isolation — approval belongs to same tenant as subject
 *   CP-6: Domain event interior.quotation.approved.v1 fired after persistence
 *   CP-7: Signature stored as file reference, not inline blob
 *   CP-8: RBAC guards — OWNER/ADMIN/PM send; CLIENT/DESIGNER/GUEST blocked
 */

import { randomUUID } from 'crypto';
import { InMemoryInteriorRepository } from '../repositories/in-memory.repository';
import { InteriorCustomerApprovalService } from '../services/interior-customer-approval.service';
import {
  ApprovalRbacError,
  ApprovalSubjectStatusError,
  ApprovalTokenError,
  ApprovalImmutabilityError,
} from '../services/interior-customer-approval.service';
import type { InteriorQuotation, InteriorContract } from '../domain/commercial-costing/types';
import type { InteriorBOQ } from '../domain/commercial-costing/types';
import type { DesignRevision } from '../domain/design-specification/types';
import type { BaseInteriorDomainEvent } from '../domain/events';

// ─── Test Doubles ─────────────────────────────────────────────────────────────

class PlatformFinanceOutboxAdapter {
  private readonly publishedEvents: BaseInteriorDomainEvent[] = [];

  async publishDomainEvent(event: BaseInteriorDomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async enqueueFinanceMilestone(_payload: unknown): Promise<{ readonly outboxId: string; readonly status: 'queued' }> {
    return { outboxId: randomUUID(), status: 'queued' };
  }

  getPublishedEvents(): BaseInteriorDomainEvent[] {
    return [...this.publishedEvents];
  }

  reset(): void {
    this.publishedEvents.length = 0;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-a-' + randomUUID();
const TENANT_B = 'tenant-b-' + randomUUID();
const PROJECT_ID = randomUUID();

function makeSentQuotation(tenantId: string, overrides: Partial<InteriorQuotation> = {}): InteriorQuotation {
  return {
    id: randomUUID(),
    tenantId,
    projectId: PROJECT_ID,
    boqId: randomUUID(),
    quotationNumber: 'QT-2026-001',
    versionNumber: 1,
    status: 'sent_to_client',
    subtotal: 500_000_000,
    discountAmount: 0,
    vatPercent: 10,
    vatAmount: 50_000_000,
    grandTotal: 550_000_000,
    paymentTerms: '30 days net',
    validityDays: 30,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSignedContract(tenantId: string, overrides: Partial<InteriorContract> = {}): InteriorContract {
  return {
    id: randomUUID(),
    tenantId,
    projectId: PROJECT_ID,
    quotationId: randomUUID(),
    contractNumber: 'CT-2026-001',
    title: 'Interior Fit-out Contract',
    status: 'in_review',
    baselineContractValue: 550_000_000,
    currentContractValue: 550_000_000,
    signedDate: null,
    clientRepresentative: 'Nguyen Van A',
    contractorRepresentative: 'Bella Design Director',
    milestones: [],
    addenda: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bella Interior OS — Commercial Proposal Phase 4 (Customer Approval & Digital Signature)', () => {
  let repo: InMemoryInteriorRepository;
  let outbox: PlatformFinanceOutboxAdapter;
  let svc: InteriorCustomerApprovalService;

  beforeEach(() => {
    repo = new InMemoryInteriorRepository();
    outbox = new PlatformFinanceOutboxAdapter();
    svc = new InteriorCustomerApprovalService(repo, outbox);
  });

  // ─── Checkpoint 1: Subject Status Prerequisite ───────────────────────────────

  describe('Checkpoint 1: Subject Status Prerequisite', () => {
    it('sends a draft quotation to the customer before creating an approval request', async () => {
      const q = makeSentQuotation(TENANT_A, { status: 'draft' });
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          subjectType: 'quotation',
          subjectId: q.id,
          subjectVersionNumber: q.versionNumber,
          clientRepresentative: 'Nguyen Van A',
          clientContact: 'nguyen@example.com',
          actorId: randomUUID(),
          actorName: 'Sales Director',
          userRole: 'admin',
        });

      expect(approval.status).toBe('pending');
      expect((await repo.getQuotation(TENANT_A, q.id))?.status).toBe('sent_to_client');
    });

    it('accepts approval request for a sent_to_client quotation', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        subjectType: 'quotation',
        subjectId: q.id,
        subjectVersionNumber: q.versionNumber,
        clientRepresentative: 'Nguyen Van A',
        clientContact: 'nguyen@example.com',
        actorId: randomUUID(),
        actorName: 'Sales Director',
        userRole: 'admin',
      });

      expect(approval.status).toBe('pending');
      expect(approval.approvalToken).toBeTruthy();
      expect(approval.subjectId).toBe(q.id);
    });

    it('accepts approval request for a contract in in_review status', async () => {
      const c = makeSignedContract(TENANT_A);
      await repo.saveContract(TENANT_A, c);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        subjectType: 'contract',
        subjectId: c.id,
        subjectVersionNumber: 1,
        clientRepresentative: 'Nguyen Van A',
        clientContact: 'nguyen@example.com',
        actorId: randomUUID(),
        actorName: 'PM',
        userRole: 'pm',
      });

      expect(approval.status).toBe('pending');
      expect(approval.subjectType).toBe('contract');
    });

    it('rejects a contract approval request with a different project or quotation version', async () => {
      const c = makeSignedContract(TENANT_A, { quotationVersionNumber: 2 });
      await repo.saveContract(TENANT_A, c);

      await expect(svc.sendApprovalRequest({
        tenantId: TENANT_A,
        projectId: PROJECT_ID,
        subjectType: 'contract',
        subjectId: c.id,
        subjectVersionNumber: 1,
        clientRepresentative: 'Nguyen Van A',
        clientContact: 'nguyen@example.com',
        actorId: randomUUID(),
        actorName: 'PM',
        userRole: 'pm',
      })).rejects.toThrow(ApprovalSubjectStatusError);
    });

    it('rejects approval for a completed contract', async () => {
      const c = makeSignedContract(TENANT_A, { status: 'completed' });
      await repo.saveContract(TENANT_A, c);

      await expect(
        svc.sendApprovalRequest({
          tenantId: TENANT_A,
          projectId: PROJECT_ID,
          subjectType: 'contract',
          subjectId: c.id,
          subjectVersionNumber: 1,
          clientRepresentative: 'Nguyen Van A',
          clientContact: 'nguyen@example.com',
          actorId: randomUUID(),
          actorName: 'PM',
          userRole: 'pm',
        })
      ).rejects.toThrow(ApprovalSubjectStatusError);
    });
  });

  // ─── Checkpoint 2: Single-Use Token ─────────────────────────────────────────

  describe('Checkpoint 2: Single-Use Token & Supersede on New Request', () => {
    it('generates unique token per approval request', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const a1 = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'A', clientContact: 'a@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });
      const a2 = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'A', clientContact: 'a@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      expect(a1.approvalToken).not.toBe(a2.approvalToken);
    });

    it('supersedes prior pending approval when a new request is sent', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const a1 = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'A', clientContact: 'a@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      // Send a second request — first one should become 'superseded'
      await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'A', clientContact: 'a@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      const superseded = await repo.getCustomerApproval(TENANT_A, a1.id);
      expect(superseded?.status).toBe('superseded');
    });
  });

  // ─── Checkpoint 3: Rejection → Revision Workflow ────────────────────────────

  describe('Checkpoint 3: Rejection Records Reason & Publishes Event', () => {
    it('records rejection with reason and publishes interior.quotation.rejected.v1', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'B', clientContact: 'b@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      outbox.reset();
      const rejected = await svc.recordRejection({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        rejectionReason: 'Giá quá cao, đề nghị giảm 5%',
        customerNotes: 'Vui lòng xem xét lại đơn giá tủ bếp',
        actorId: randomUUID(),
        actorName: 'Customer Portal',
        userRole: 'admin',
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Giá quá cao, đề nghị giảm 5%');

      const events = outbox.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('interior.quotation.rejected.v1');
      expect((events[0].payload as Record<string, unknown>).rejectionReason).toBe('Giá quá cao, đề nghị giảm 5%');
    });

    it('requires a non-empty rejection reason', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);
      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'C', clientContact: 'c@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      await expect(
        svc.recordRejection({
          tenantId: TENANT_A,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          rejectionReason: '',
          actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
        })
      ).rejects.toThrow(ApprovalTokenError);
    });
  });

  // ─── Checkpoint 4: Approval Immutability ────────────────────────────────────

  describe('Checkpoint 4: Approval Record Immutability', () => {
    it('prevents re-approval of an already-approved record', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'D', clientContact: 'd@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      await svc.recordApproval({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      // Try to approve again with same token
      await expect(
        svc.recordApproval({
          tenantId: TENANT_A,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
        })
      ).rejects.toThrow(ApprovalImmutabilityError);
    });

    it('prevents rejection of an already-rejected record', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'E', clientContact: 'e@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      await svc.recordRejection({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        rejectionReason: 'Too expensive',
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      await expect(
        svc.recordRejection({
          tenantId: TENANT_A,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          rejectionReason: 'Trying again',
          actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
        })
      ).rejects.toThrow(ApprovalImmutabilityError);
    });

    it('atomically consumes token: concurrent approval requests result in exactly 1 winner and 1 failure', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'Concurrent Tester', clientContact: 'concurrent@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      // Fire 2 concurrent approvals
      const results = await Promise.allSettled([
        svc.recordApproval({
          tenantId: TENANT_A,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          customerNotes: 'Approved by Request 1',
          actorId: randomUUID(), actorName: 'Portal 1', userRole: 'admin',
        }),
        svc.recordApproval({
          tenantId: TENANT_A,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          customerNotes: 'Approved by Request 2',
          actorId: randomUUID(), actorName: 'Portal 2', userRole: 'admin',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ApprovalImmutabilityError);
    });
  });

  // ─── Checkpoint 5: Multi-Tenant Isolation ───────────────────────────────────

  describe('Checkpoint 5: Multi-Tenant Isolation', () => {
    it('blocks tenant B from resolving a token issued to tenant A', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'F', clientContact: 'f@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      // Tenant B tries to use Tenant A's token
      await expect(
        svc.recordApproval({
          tenantId: TENANT_B,
          approvalId: approval.id,
          approvalToken: approval.approvalToken,
          actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
        })
      ).rejects.toThrow(ApprovalTokenError);
    });
  });

  // ─── Checkpoint 6: Event-After-Persistence ──────────────────────────────────

  describe('Checkpoint 6: Domain Event Published After Persistence', () => {
    it('emits interior.quotation.approved.v1 after approval is persisted', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'G', clientContact: 'g@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      outbox.reset();
      await svc.recordApproval({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        customerNotes: 'Đồng ý toàn bộ hạng mục',
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      // Verify persisted before event
      const persisted = await repo.getCustomerApproval(TENANT_A, approval.id);
      expect(persisted?.status).toBe('approved');

      const events = outbox.getPublishedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('interior.quotation.approved.v1');
      expect((events[0].payload as Record<string, unknown>).approvalId).toBe(approval.id);
    });

    it('emits interior.contract.customer_approved.v1 for contract approval', async () => {
      const designRevision: DesignRevision = {
        id: randomUUID(), tenantId: TENANT_A, projectId: PROJECT_ID, versionNumber: 1,
        title: 'Approved revision', status: 'approved', submittedBy: 'designer',
        submittedAt: new Date().toISOString(), assets: [], materialSpecs: [],
      };
      await repo.saveDesignRevision(TENANT_A, designRevision);
      const boq: InteriorBOQ = {
        id: randomUUID(), tenantId: TENANT_A, projectId: PROJECT_ID,
        designRevisionId: designRevision.id, boqNumber: 'BOQ-APPROVAL-1', versionNumber: 1,
        status: 'approved', totalInternalCost: 100, totalClientPrice: 120,
        totalGrossMargin: 20, grossMarginPercent: 16.67, items: [], preparedBy: 'QS',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      await repo.saveBOQ(TENANT_A, boq);
      const quote = makeSentQuotation(TENANT_A, { boqId: boq.id });
      await repo.saveQuotation(TENANT_A, quote);
      const quoteApprovalRequest = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID, subjectType: 'quotation', subjectId: quote.id,
        subjectVersionNumber: quote.versionNumber, clientRepresentative: 'Nguyen Van A',
        clientContact: 'customer@example.com', actorId: 'internal-sales', actorName: 'Sales', userRole: 'pm',
      });
      const quoteApproval = await svc.recordApproval({
        tenantId: TENANT_A, approvalId: quoteApprovalRequest.id,
        approvalToken: quoteApprovalRequest.approvalToken,
        actorId: 'customer-quote', actorName: 'Customer', userRole: 'admin',
      });
      const c = makeSignedContract(TENANT_A, {
        quotationId: quote.id,
        quotationVersionNumber: quote.versionNumber,
        quotationCustomerApprovalId: quoteApproval.id,
        boqId: boq.id,
        boqVersionNumber: boq.versionNumber,
        designRevisionId: designRevision.id,
        designVersionNumber: designRevision.versionNumber,
      });
      await repo.saveContract(TENANT_A, c);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'contract', subjectId: c.id, subjectVersionNumber: 1,
        clientRepresentative: 'H', clientContact: 'h@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });

      outbox.reset();
      await svc.recordApproval({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        signatureReference: {
          storagePath: 'interior/approvals/contract-signature.pdf',
          storageUrl: 'https://storage.example.test/interior/approvals/contract-signature.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1000,
          sha256Hash: 'a'.repeat(64),
        },
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      const events = outbox.getPublishedEvents();
      expect(events[0].eventType).toBe('interior.contract.customer_approved.v1');
      expect(events[1].eventType).toBe('interior.contract.signed.v1');
      expect((await repo.getContract(TENANT_A, c.id))?.status).toBe('signed');
    });
  });

  // ─── Checkpoint 7: Signature as File Reference ──────────────────────────────

  describe('Checkpoint 7: Digital Signature Stored as File Reference Only', () => {
    it('stores signature as a reference (storagePath) — not inline blob', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'I', clientContact: 'i@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      const approved = await svc.recordApproval({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        signatureReference: {
          storagePath: 'interior/approvals/tenant-a/QT-2026-001-signed.pdf',
          storageUrl: 'https://cdn.bella.vn/signed/abc123.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 204_800,
          sha256Hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        },
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      // CP-7: signatureReference is stored as metadata, not raw bytes
      expect(approved.signatureReference).not.toBeNull();
      expect(approved.signatureReference?.storagePath).toBe('interior/approvals/tenant-a/QT-2026-001-signed.pdf');
      expect(approved.signatureReference?.fileSizeBytes).toBe(204_800);
      // No inline blob field — the type itself does not carry binary data
      expect(approved.signatureReference).not.toHaveProperty('blob');
      expect(approved.signatureReference).not.toHaveProperty('data');
    });

    it('records approval summary correctly when signature is present', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      const approval = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'J', clientContact: 'j@x.com',
        actorId: randomUUID(), actorName: 'Admin', userRole: 'admin',
      });

      await svc.recordApproval({
        tenantId: TENANT_A,
        approvalId: approval.id,
        approvalToken: approval.approvalToken,
        signatureReference: {
          storagePath: 'interior/approvals/signed.pdf',
          storageUrl: 'https://cdn.example.com/signed.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 100_000,
          sha256Hash: '0'.repeat(64),
        },
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      const summary = await svc.getApprovalSummary(TENANT_A, 'quotation', q.id);
      expect(summary.currentStatus).toBe('approved');
      expect(summary.hasSignature).toBe(true);
    });
  });

  // ─── Checkpoint 8: RBAC ──────────────────────────────────────────────────────

  describe('Checkpoint 8: Separation of Duties RBAC', () => {
    it.each(['owner', 'admin', 'director', 'pm', 'qs', 'estimator'])(
      'allows %s role to send approval requests',
      async (role) => {
        const q = makeSentQuotation(TENANT_A);
        await repo.saveQuotation(TENANT_A, q);

        const approval = await svc.sendApprovalRequest({
          tenantId: TENANT_A, projectId: PROJECT_ID,
          subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
          clientRepresentative: 'K', clientContact: 'k@x.com',
          actorId: randomUUID(), actorName: role, userRole: role,
        });
        expect(approval.status).toBe('pending');
      }
    );

    it.each(['client', 'designer', 'guest'])(
      'blocks %s role from sending approval requests',
      async (role) => {
        await expect(
          svc.sendApprovalRequest({
            tenantId: TENANT_A, projectId: PROJECT_ID,
            subjectType: 'quotation', subjectId: randomUUID(), subjectVersionNumber: 1,
            clientRepresentative: 'L', clientContact: 'l@x.com',
            actorId: randomUUID(), actorName: role, userRole: role,
          })
        ).rejects.toThrow(ApprovalRbacError);
      }
    );
  });

  // ─── Approval Summary ────────────────────────────────────────────────────────

  describe('Approval Summary', () => {
    it('returns not_sent for a subject with no approval history', async () => {
      const summary = await svc.getApprovalSummary(TENANT_A, 'quotation', randomUUID());
      expect(summary.currentStatus).toBe('not_sent');
      expect(summary.totalRequestsSent).toBe(0);
      expect(summary.hasSignature).toBe(false);
    });

    it('tracks total requests sent over multiple cycles', async () => {
      const q = makeSentQuotation(TENANT_A);
      await repo.saveQuotation(TENANT_A, q);

      // Send, reject, resend, approve
      const a1 = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 1,
        clientRepresentative: 'M', clientContact: 'm@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });
      await svc.recordRejection({
        tenantId: TENANT_A, approvalId: a1.id, approvalToken: a1.approvalToken,
        rejectionReason: 'Need revision',
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      // A new quotation revision is a distinct immutable commercial version.
      await repo.saveQuotation(TENANT_A, { ...q, versionNumber: 2, status: 'sent_to_client' });

      const a2 = await svc.sendApprovalRequest({
        tenantId: TENANT_A, projectId: PROJECT_ID,
        subjectType: 'quotation', subjectId: q.id, subjectVersionNumber: 2,
        clientRepresentative: 'M', clientContact: 'm@x.com',
        actorId: randomUUID(), actorName: 'PM', userRole: 'pm',
      });
      await svc.recordApproval({
        tenantId: TENANT_A, approvalId: a2.id, approvalToken: a2.approvalToken,
        actorId: randomUUID(), actorName: 'Portal', userRole: 'admin',
      });

      const summary = await svc.getApprovalSummary(TENANT_A, 'quotation', q.id);
      expect(summary.totalRequestsSent).toBe(2);
      expect(summary.currentStatus).toBe('approved');
    });
  });
});

