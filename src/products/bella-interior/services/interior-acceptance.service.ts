/**
 * Bella Interior OS — Canonical Acceptance & Handover Service
 *
 * Source of Truth for:
 * 1. Acceptance Campaigns & Multi-Session Lifecycle.
 * 2. Three Independent State Dimensions:
 *    - inspectionResult (ACCEPTED_WITHOUT_ISSUES | ACCEPTED_WITH_REMARKS | PENDING_REMEDIATION)
 *    - approvalStatus (PENDING | APPROVED | REJECTED)
 *    - documentationStatus (NONE | PARTIAL | COMPLETE)
 * 3. 7 Categories of Acceptance Notes & Specialized Work Routing.
 * 4. Immutable Evidence Object Versioning with Server-Side SHA-256 calculation.
 * 5. Manager Approval Gate (interior:handover:approve) without auto-closing open defects.
 * 6. Post-Approval Evidence Supplementation preserving historical approval timestamps.
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID, createHash } from 'crypto';
import {
  TenantIsolationViolationError,
  AcceptanceCampaignNotFoundError,
  AcceptanceSessionNotFoundError,
  AcceptanceEvidenceSizeExceededError,
  AcceptanceInvalidMimeTypeError,
  AcceptanceManagerApprovalPermissionRequiredError,
} from '../domain/errors';
import type {
  AcceptanceCampaign,
  AcceptanceSession,
  AcceptanceNoteItem,
  AcceptanceEvidenceObject,
  AcceptanceSessionType,
  NoteCategory,
  NoteSeverity,
  AssessmentStatus,
  InspectionResult,
  AcceptanceApprovalStatus,
  DocumentationStatus,
  EvidenceCategory,
  RoutedEntityType,
} from '../domain/acceptance-handover.types';
import type { IInteriorAcceptanceRepository } from '../repositories/acceptance-repository.interface';
import type { DeliveryAftercareService } from './delivery-aftercare.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_EVIDENCE_SIZE_BYTES = 10485760; // 10MB

export class InteriorAcceptanceService {
  constructor(
    private readonly repository: IInteriorAcceptanceRepository,
    private readonly aftercareService?: DeliveryAftercareService
  ) {}

  // ─── 1. Acceptance Campaign Lifecycle ───────────────────────────────────────

  async createCampaign(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly campaignCode: string;
    readonly campaignName: string;
    readonly description?: string | null;
    readonly createdByUserId?: string | null;
  }): Promise<AcceptanceCampaign> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const now = new Date().toISOString();
    const campaign: AcceptanceCampaign = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      campaignCode: input.campaignCode,
      campaignName: input.campaignName,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveAcceptanceCampaign(input.tenantId, campaign);
    return campaign;
  }

  async getCampaign(tenantId: string, campaignId: string): Promise<AcceptanceCampaign> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const campaign = await this.repository.getAcceptanceCampaign(tenantId, campaignId);
    if (!campaign) throw new AcceptanceCampaignNotFoundError(campaignId);
    return campaign;
  }

  async listCampaigns(tenantId: string, projectId: string): Promise<AcceptanceCampaign[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listAcceptanceCampaigns(tenantId, projectId);
  }

  // ─── 2. Multi-Session Acceptance Lifecycle ──────────────────────────────────

  async createSession(input: {
    readonly tenantId: string;
    readonly campaignId: string;
    readonly projectId: string;
    readonly sessionCode: string;
    readonly sessionType: AcceptanceSessionType;
    readonly inspectionScope: string;
    readonly inspectionDate: string;
    readonly recorderActorId: string;
    readonly customerRepresentative: string;
    readonly customerContact?: string | null;
    readonly relatedBoqItemIds?: readonly string[];
    readonly inspectionResult?: InspectionResult;
  }): Promise<AcceptanceSession> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const campaign = await this.repository.getAcceptanceCampaign(input.tenantId, input.campaignId);
    if (!campaign || campaign.projectId !== input.projectId) {
      throw new AcceptanceCampaignNotFoundError(input.campaignId);
    }

    const now = new Date().toISOString();
    const session: AcceptanceSession = {
      id: randomUUID(),
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      projectId: input.projectId,
      sessionCode: input.sessionCode,
      sessionType: input.sessionType,
      inspectionScope: input.inspectionScope,
      inspectionDate: input.inspectionDate,
      recorderActorId: input.recorderActorId,
      customerRepresentative: input.customerRepresentative,
      customerContact: input.customerContact ?? null,
      relatedBoqItemIds: input.relatedBoqItemIds ?? [],
      // Three Independent State Dimensions initialized
      inspectionResult: input.inspectionResult ?? 'PENDING_REMEDIATION',
      approvalStatus: 'PENDING',
      documentationStatus: 'NONE',
      approvedByActorId: null,
      approvedAt: null,
      rejectionReason: null,
      approvalNotes: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveAcceptanceSession(input.tenantId, session);
    return session;
  }

  async getSession(tenantId: string, sessionId: string): Promise<AcceptanceSession> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const session = await this.repository.getAcceptanceSession(tenantId, sessionId);
    if (!session) throw new AcceptanceSessionNotFoundError(sessionId);
    return session;
  }

  async listSessions(tenantId: string, campaignId: string): Promise<AcceptanceSession[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listAcceptanceSessions(tenantId, campaignId);
  }

  async listSessionsByProject(tenantId: string, projectId: string): Promise<AcceptanceSession[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listAcceptanceSessionsByProject(tenantId, projectId);
  }

  // ─── 3. Assessment & Zero Defect Recording ──────────────────────────────────

  async recordAcceptanceAssessment(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly inspectionResult: InspectionResult;
    readonly approvalNotes?: string;
  }): Promise<AcceptanceSession> {
    if (!input.tenantId) throw new TenantIsolationViolationError();
    const session = await this.getSession(input.tenantId, input.sessionId);

    const updatedSession: AcceptanceSession = {
      ...session,
      inspectionResult: input.inspectionResult,
      approvalNotes: input.approvalNotes ?? session.approvalNotes,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveAcceptanceSession(input.tenantId, updatedSession);
    return updatedSession;
  }

  // ─── 4. Acceptance Notes with 7 Categories & Work Routing ───────────────────

  async recordAcceptanceNote(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly category: NoteCategory;
    readonly severity: NoteSeverity;
    readonly assessmentStatus: AssessmentStatus;
    readonly description: string;
    readonly relatedBoqItemId?: string | null;
    readonly remediationPlan?: string | null;
    readonly assignedFixer?: string | null;
    readonly targetDeadline?: string | null;
    readonly createdByUserId: string;
  }): Promise<AcceptanceNoteItem> {
    if (!input.tenantId) throw new TenantIsolationViolationError();
    const session = await this.getSession(input.tenantId, input.sessionId);

    let routedEntityType: RoutedEntityType | null = null;
    let routedEntityId: string | null = null;

    // Specialized Downstream Routing
    if (input.category === 'QUALITY_ISSUE' || input.category === 'INSTALLATION_ISSUE') {
      routedEntityType = 'punch_list';
      if (this.aftercareService && (input.severity === 'medium' || input.severity === 'high' || input.severity === 'critical')) {
        try {
          const punchItem = await this.aftercareService.recordPunchListItem({
            tenantId: input.tenantId,
            projectId: session.projectId,
            roomZoneName: session.inspectionScope,
            itemName: input.description.slice(0, 50),
            defectCategory: input.category === 'INSTALLATION_ISSUE' ? 'hardware_defect' : 'scratched_surface',
            description: input.description,
            severity: input.severity === 'critical' ? 'critical' : input.severity === 'high' ? 'major' : 'minor',
            assignedFixer: input.assignedFixer || 'Đội thi công hoàn thiện',
            deadline: input.targetDeadline || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          });
          routedEntityId = punchItem.id;
        } catch {
          // Keep entity type if punch list service error
        }
      }
    } else if (input.category === 'DAMAGE') {
      routedEntityType = 'warranty_ticket';
    } else if (input.category === 'CUSTOMER_REQUEST') {
      routedEntityType = 'change_order';
    } else if (input.category === 'MISSING_ITEM') {
      routedEntityType = 'replenishment';
    } else if (input.category === 'FOLLOW_UP') {
      routedEntityType = 're_inspection';
    } else if (input.category === 'GENERAL_NOTE') {
      routedEntityType = 'crm_note';
    }

    const now = new Date().toISOString();
    const noteItem: AcceptanceNoteItem = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      category: input.category,
      severity: input.severity,
      assessmentStatus: input.assessmentStatus,
      description: input.description,
      relatedBoqItemId: input.relatedBoqItemId ?? null,
      remediationPlan: input.remediationPlan ?? null,
      assignedFixer: input.assignedFixer ?? null,
      targetDeadline: input.targetDeadline ?? null,
      remediationStatus: 'OPEN',
      routedEntityType,
      routedEntityId,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveAcceptanceNote(input.tenantId, noteItem);

    // If severe or required remediation, ensure session reflects issues
    if (input.assessmentStatus === 'DEFECT_REMEDIATION_REQUIRED' && session.inspectionResult === 'ACCEPTED_WITHOUT_ISSUES') {
      const updatedSession: AcceptanceSession = {
        ...session,
        inspectionResult: 'PENDING_REMEDIATION',
        updatedAt: now,
      };
      await this.repository.saveAcceptanceSession(input.tenantId, updatedSession);
    }

    return noteItem;
  }

  async listNotes(tenantId: string, sessionId: string): Promise<AcceptanceNoteItem[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listAcceptanceNotes(tenantId, sessionId);
  }

  // ─── 5. Evidence Upload with Server-Side SHA-256 & Versioning ───────────────

  async registerEvidenceObject(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly noteId?: string | null;
    readonly evidenceCategory: EvidenceCategory;
    readonly bucketId?: string;
    readonly storagePath: string;
    readonly fileName: string;
    readonly fileBuffer: Buffer | Uint8Array;
    readonly mimeType: string;
    readonly uploadedByUserId: string;
  }): Promise<AcceptanceEvidenceObject> {
    if (!input.tenantId) throw new TenantIsolationViolationError();
    const session = await this.getSession(input.tenantId, input.sessionId);

    // 1. Size Validation
    const fileSizeBytes = input.fileBuffer.length;
    if (fileSizeBytes < 1 || fileSizeBytes > MAX_EVIDENCE_SIZE_BYTES) {
      throw new AcceptanceEvidenceSizeExceededError(fileSizeBytes, MAX_EVIDENCE_SIZE_BYTES);
    }

    // 2. MIME Type Validation
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new AcceptanceInvalidMimeTypeError(input.mimeType);
    }

    // 3. Server-Side SHA-256 Calculation (DO NOT trust client hash!)
    const sha256Hash = createHash('sha256').update(input.fileBuffer).digest('hex');

    // 4. Version Calculation (Storage Object Versioning)
    const existingEvidence = await this.repository.listAcceptanceEvidence(input.tenantId, input.sessionId);
    const samePathObjects = existingEvidence.filter((e) => e.storagePath === input.storagePath);
    const version = samePathObjects.length > 0
      ? Math.max(...samePathObjects.map((e) => e.version)) + 1
      : 1;

    const evidence: AcceptanceEvidenceObject = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      noteId: input.noteId ?? null,
      evidenceCategory: input.evidenceCategory,
      bucketId: input.bucketId || 'interior-acceptance-docs',
      storagePath: input.storagePath,
      fileName: input.fileName,
      fileSizeBytes,
      mimeType: input.mimeType,
      sha256Hash,
      version,
      uploadedByUserId: input.uploadedByUserId,
      uploadedAt: new Date().toISOString(),
    };

    await this.repository.saveAcceptanceEvidence(input.tenantId, evidence);

    // 5. Recalculate Documentation Status
    await this.recalculateDocumentationStatus(input.tenantId, session);

    return evidence;
  }

  async listEvidence(tenantId: string, sessionId: string): Promise<AcceptanceEvidenceObject[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    return this.repository.listAcceptanceEvidence(tenantId, sessionId);
  }

  private async recalculateDocumentationStatus(
    tenantId: string,
    session: AcceptanceSession
  ): Promise<DocumentationStatus> {
    const allEvidence = await this.repository.listAcceptanceEvidence(tenantId, session.id);

    const hasSignoff = allEvidence.some((e) => e.evidenceCategory === 'CUSTOMER_SIGNOFF');
    const hasVisual = allEvidence.some(
      (e) => e.evidenceCategory === 'OVERALL' || e.evidenceCategory === 'DETAIL' || e.evidenceCategory === 'COMPLETED_PRODUCT'
    );

    let docStatus: DocumentationStatus = 'NONE';
    if (hasSignoff && hasVisual) {
      docStatus = 'COMPLETE';
    } else if (hasVisual || hasSignoff) {
      docStatus = 'PARTIAL';
    }

    if (session.documentationStatus !== docStatus) {
      const updatedSession: AcceptanceSession = {
        ...session,
        documentationStatus: docStatus,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.saveAcceptanceSession(tenantId, updatedSession);
      return docStatus;
    }

    return session.documentationStatus;
  }

  // ─── 6. Manager Approval Gate (Server-Enforced Authorization) ───────────────

  async approveSession(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly actorId: string;
    readonly actorPermissions: readonly string[];
    readonly decision: 'APPROVED' | 'REJECTED';
    readonly approvalNotes?: string | null;
    readonly rejectionReason?: string | null;
  }): Promise<AcceptanceSession> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // Server-enforced authorization: Must have interior:handover:approve
    if (!input.actorPermissions.includes('interior:handover:approve')) {
      throw new AcceptanceManagerApprovalPermissionRequiredError(input.actorId);
    }

    const session = await this.getSession(input.tenantId, input.sessionId);

    const now = new Date().toISOString();
    const updatedSession: AcceptanceSession = {
      ...session,
      approvalStatus: input.decision,
      approvedByActorId: input.actorId,
      approvedAt: now,
      approvalNotes: input.approvalNotes ?? null,
      rejectionReason: input.decision === 'REJECTED' ? input.rejectionReason ?? null : null,
      updatedAt: now,
      // INVARIANT: documentationStatus is preserved truthfully (APPROVED with NONE/PARTIAL is valid!)
    };

    await this.repository.saveAcceptanceSession(input.tenantId, updatedSession);

    // CRITICAL INVARIANT: Manager approval does NOT automatically close open punch list items or notes.
    // Notes remain in their current remediation status (OPEN / IN_PROGRESS).

    return updatedSession;
  }

  // ─── 7. Post-Approval Evidence Supplementation ──────────────────────────────

  async supplementPostApprovalEvidence(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly noteId?: string | null;
    readonly evidenceCategory: EvidenceCategory;
    readonly bucketId?: string;
    readonly storagePath: string;
    readonly fileName: string;
    readonly fileBuffer: Buffer | Uint8Array;
    readonly mimeType: string;
    readonly uploadedByUserId: string;
  }): Promise<{ evidence: AcceptanceEvidenceObject; session: AcceptanceSession }> {
    const sessionBefore = await this.getSession(input.tenantId, input.sessionId);

    // Register evidence object (calculates server SHA-256, version increment, doc recalculation)
    const evidence = await this.registerEvidenceObject(input);

    const sessionAfter = await this.getSession(input.tenantId, input.sessionId);

    // INVARIANT: Historical approval details remain strictly unchanged!
    if (sessionBefore.approvalStatus === 'APPROVED') {
      if (
        sessionAfter.approvedByActorId !== sessionBefore.approvedByActorId ||
        sessionAfter.approvedAt !== sessionBefore.approvedAt ||
        sessionAfter.approvalStatus !== 'APPROVED'
      ) {
        throw new Error('INVARIANT_VIOLATION: Historical approval state was corrupted during post-approval supplementation');
      }
    }

    return { evidence, session: sessionAfter };
  }
}
