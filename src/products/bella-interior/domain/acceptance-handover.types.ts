/**
 * Bella Interior OS — Acceptance & Handover Domain Types
 *
 * Architecture Baseline: v2.0 (Approved 18/11/2026)
 * Implementation Batch: O4
 *
 * Implements:
 * 1. Acceptance Campaigns & Multi-Session Lifecycle.
 * 2. Three Independent State Dimensions:
 *    - Inspection Result (ACCEPTED_WITHOUT_ISSUES | ACCEPTED_WITH_REMARKS | PENDING_REMEDIATION)
 *    - Approval Status (PENDING | APPROVED | REJECTED)
 *    - Documentation Status (NONE | PARTIAL | COMPLETE)
 * 3. Seven Categories of Acceptance Notes & Specialized Work Routing.
 * 4. Immutable Evidence Object Versioning (StorageObjectRef) with Server SHA-256.
 * 5. Independent Remediation Lifecycle (OPEN -> IN_PROGRESS -> READY_FOR_REINSPECTION -> VERIFIED -> CLOSED).
 *
 * @module src/products/bella-interior/domain
 */

// ─── 1. State Dimensions ──────────────────────────────────────────────────────

export type InspectionResult =
  | 'ACCEPTED_WITHOUT_ISSUES'
  | 'ACCEPTED_WITH_REMARKS'
  | 'PENDING_REMEDIATION';

export type AcceptanceApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export type DocumentationStatus =
  | 'NONE'
  | 'PARTIAL'
  | 'COMPLETE';

export type AcceptanceSessionType =
  | 'ROOM_BY_ROOM'
  | 'ITEM_BASED'
  | 'DELIVERY_BATCH'
  | 'POST_REMEDIATION'
  | 'FINAL_HANDOVER';

export type NoteCategory =
  | 'QUALITY_ISSUE'
  | 'INSTALLATION_ISSUE'
  | 'CUSTOMER_REQUEST'
  | 'MISSING_ITEM'
  | 'DAMAGE'
  | 'FOLLOW_UP'
  | 'GENERAL_NOTE';

export type NoteSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AssessmentStatus =
  | 'NO_ISSUES'
  | 'MINOR_MONITORING'
  | 'DEFECT_REMEDIATION_REQUIRED'
  | 'INCOMPLETE_ITEMS';

export type RemediationStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY_FOR_REINSPECTION'
  | 'VERIFIED'
  | 'CLOSED';

export type EvidenceCategory =
  | 'OVERALL'
  | 'DETAIL'
  | 'COMPLETED_PRODUCT'
  | 'CUSTOMER_SIGNOFF'
  | 'REMEDIATION_PROOF';

export type RoutedEntityType =
  | 'punch_list'
  | 'warranty_ticket'
  | 'replenishment'
  | 'change_order'
  | 're_inspection'
  | 'crm_note';

// ─── 2. Domain Entities ───────────────────────────────────────────────────────

export interface AcceptanceCampaign {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaignCode: string;
  readonly campaignName: string;
  readonly description?: string | null;
  readonly createdByUserId?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AcceptanceSession {
  readonly id: string;
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
  readonly relatedBoqItemIds: readonly string[];
  readonly inspectionResult: InspectionResult;
  readonly approvalStatus: AcceptanceApprovalStatus;
  readonly documentationStatus: DocumentationStatus;
  readonly approvedByActorId?: string | null;
  readonly approvedAt?: string | null;
  readonly rejectionReason?: string | null;
  readonly approvalNotes?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AcceptanceNoteItem {
  readonly id: string;
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
  readonly remediationStatus: RemediationStatus;
  readonly routedEntityType?: RoutedEntityType | null;
  readonly routedEntityId?: string | null;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AcceptanceEvidenceObject {
  readonly id: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly noteId?: string | null;
  readonly evidenceCategory: EvidenceCategory;
  readonly bucketId: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly mimeType: string;
  readonly sha256Hash: string;
  readonly version: number;
  readonly uploadedByUserId: string;
  readonly uploadedAt: string;
}

// ─── 3. Invariant & Validation Guards ─────────────────────────────────────────

export function isZeroDefectAssessment(assessment: AssessmentStatus): boolean {
  return assessment === 'NO_ISSUES';
}

export function canApproveSessionWithDocumentation(
  approval: AcceptanceApprovalStatus,
  documentation: DocumentationStatus
): boolean {
  // CRITICAL INVARIANT: Documentation status NEVER blocks manager approval by itself
  if (approval === 'APPROVED') {
    return ['NONE', 'PARTIAL', 'COMPLETE'].includes(documentation);
  }
  return true;
}

export function isRemediationClosed(status: RemediationStatus): boolean {
  return status === 'CLOSED';
}

export function doesApprovalCloseRemediation(
  approval: AcceptanceApprovalStatus,
  currentRemediation: RemediationStatus
): RemediationStatus {
  // CRITICAL INVARIANT: Manager approval NEVER auto-closes defect / punch list remediation
  if (approval === 'APPROVED') {
    return currentRemediation; // Remains unchanged!
  }
  return currentRemediation;
}
