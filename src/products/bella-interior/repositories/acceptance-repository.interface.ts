/**
 * Bella Interior OS — Acceptance & Handover Repository Interface
 *
 * All operations require tenantId as the first parameter to enforce Tenant Isolation (Gate 0).
 * Part of Batch O4 (Installation, Acceptance & Handover).
 *
 * @module src/products/bella-interior/repositories
 */

import type {
  AcceptanceCampaign,
  AcceptanceSession,
  AcceptanceNoteItem,
  AcceptanceEvidenceObject,
  AcceptanceApprovalStatus,
  InspectionResult,
} from '../domain/acceptance-handover.types';

export interface IInteriorAcceptanceRepository {
  // Acceptance Campaign Operations
  saveAcceptanceCampaign(tenantId: string, campaign: AcceptanceCampaign): Promise<void>;
  getAcceptanceCampaign(tenantId: string, campaignId: string): Promise<AcceptanceCampaign | null>;
  listAcceptanceCampaigns(tenantId: string, projectId: string): Promise<AcceptanceCampaign[]>;

  // Acceptance Session Operations (Multi-Session Lifecycle)
  createAcceptanceSession(tenantId: string, session: AcceptanceSession): Promise<void>;
  updateAcceptanceInspectionResult(
    tenantId: string,
    sessionId: string,
    inspectionResult: InspectionResult,
    approvalNotes: string | null,
  ): Promise<void>;
  decideAcceptanceSession(input: {
    tenantId: string;
    sessionId: string;
    actorId: string;
    decision: Exclude<AcceptanceApprovalStatus, 'PENDING'>;
    approvalNotes: string | null;
    rejectionReason: string | null;
  }): Promise<AcceptanceSession>;
  getAcceptanceSession(tenantId: string, sessionId: string): Promise<AcceptanceSession | null>;
  listAcceptanceSessions(tenantId: string, campaignId: string): Promise<AcceptanceSession[]>;
  listAcceptanceSessionsByProject(tenantId: string, projectId: string): Promise<AcceptanceSession[]>;

  // Acceptance Notes Operations (7 Categories & Specialized Work Routing)
  saveAcceptanceNote(tenantId: string, note: AcceptanceNoteItem): Promise<void>;
  getAcceptanceNote(tenantId: string, noteId: string): Promise<AcceptanceNoteItem | null>;
  listAcceptanceNotes(tenantId: string, sessionId: string): Promise<AcceptanceNoteItem[]>;

  // Evidence Objects Operations (Immutable Versioning & Server SHA-256)
  saveAcceptanceEvidence(tenantId: string, evidence: AcceptanceEvidenceObject): Promise<AcceptanceEvidenceObject>;
  listAcceptanceEvidence(tenantId: string, sessionId: string): Promise<AcceptanceEvidenceObject[]>;
}
