/**
 * Bella Interior OS — Customer Approval & Digital Signature Types
 *
 * Phase 4: Manages customer-facing approval lifecycle for quotations and contracts.
 * Approval records are immutable once recorded.
 *
 * @module src/products/bella-interior/domain/commercial-costing/approval
 */

// ─── Approval Status ──────────────────────────────────────────────────────────

/**
 * Status of a customer approval request.
 *
 * - 'pending'    : Sent to customer, awaiting response
 * - 'approved'   : Customer has approved the quotation/contract
 * - 'rejected'   : Customer has rejected with reason; triggers new revision
 * - 'expired'    : Approval token expired without response
 * - 'superseded' : A new version was issued, this approval request is void
 */
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'superseded';

/**
 * The subject of an approval request — quotation or contract.
 */
export type ApprovalSubjectType = 'quotation' | 'contract';

// ─── Signature Reference ──────────────────────────────────────────────────────

/**
 * Reference to a stored signature file.
 * Signature data is stored externally (Supabase Storage / S3 reference).
 * NOT stored as inline blob.
 */
export interface SignatureReference {
  /** Storage bucket path / object key */
  readonly storagePath: string;
  /** Public or signed URL for retrieval */
  readonly storageUrl: string;
  /** MIME type of the signature file (e.g. image/png, application/pdf) */
  readonly mimeType: string;
  /** File size in bytes */
  readonly fileSizeBytes: number;
  /** SHA-256 hash of the file for integrity verification */
  readonly sha256Hash: string;
  /** Timestamp when the file was uploaded (ISO-8601) */
  readonly uploadedAt: string;
}

// ─── Customer Approval Record ─────────────────────────────────────────────────

/**
 * Immutable record of a customer approval or rejection.
 * Created once; must not be mutated after `status` leaves 'pending'.
 */
export interface CustomerApproval {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;

  /** Subject type: 'quotation' or 'contract' */
  readonly subjectType: ApprovalSubjectType;
  /** ID of the quotation or contract being approved */
  readonly subjectId: string;
  /** Quotation/contract version number at the time of this approval request */
  readonly subjectVersionNumber: number;

  /** Single-use, tenant-scoped approval token sent to customer */
  readonly approvalToken: string;

  readonly status: ApprovalStatus;

  /** Name of the customer representative */
  readonly clientRepresentative: string;
  /** Contact channel used (email address / phone) */
  readonly clientContact: string;

  /** ISO-8601 — when approval request was dispatched */
  readonly sentAt: string;
  /** ISO-8601 — when the token expires (default: sentAt + validityDays) */
  readonly expiresAt: string;

  /** ISO-8601 — when customer approved (null if not yet approved) */
  readonly approvedAt?: string | null;
  /** ISO-8601 — when customer rejected (null if not yet rejected) */
  readonly rejectedAt?: string | null;

  /** Customer's rejection reason (required when status = 'rejected') */
  readonly rejectionReason?: string | null;
  /** Customer's optional notes / comments on approval */
  readonly customerNotes?: string | null;

  /** Reference to uploaded signature file (populated after approval) */
  readonly signatureReference?: SignatureReference | null;

  /** Internal actor who sent the approval request */
  readonly sentByActorId: string;
  readonly sentByActorName: string;

  /** ISO-8601 — record creation timestamp */
  readonly createdAt: string;
  /** ISO-8601 — last update timestamp */
  readonly updatedAt: string;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Input to dispatch an approval request to the customer.
 */
export interface SendApprovalRequestInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly subjectType: ApprovalSubjectType;
  readonly subjectId: string;
  /** Version number of the quotation/contract at time of dispatch */
  readonly subjectVersionNumber: number;
  readonly clientRepresentative: string;
  readonly clientContact: string;
  /**
   * Days the approval token remains valid.
   * Default: 14 days for quotations, 30 days for contracts.
   */
  readonly validityDays?: number;
  /** Internal actor sending the request */
  readonly actorId: string;
  readonly actorName: string;
  readonly userRole: string;
}

/**
 * Input to record a customer approval (approved path).
 */
export interface RecordApprovalInput {
  readonly tenantId: string;
  readonly approvalId: string;
  readonly approvalToken: string;
  /** Customer notes / confirmation message */
  readonly customerNotes?: string;
  /**
   * Optional signature reference — if the customer uploads a signed document.
   * Omit if no digital signature is provided in this flow.
   */
  readonly signatureReference?: Omit<SignatureReference, 'uploadedAt'>;
  readonly actorId: string;
  readonly actorName: string;
  readonly userRole: string;
}

/**
 * Input to record a customer rejection.
 */
export interface RecordRejectionInput {
  readonly tenantId: string;
  readonly approvalId: string;
  readonly approvalToken: string;
  /** Mandatory reason for rejection */
  readonly rejectionReason: string;
  readonly customerNotes?: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly userRole: string;
}

/**
 * Input to supersede all pending approvals for a subject
 * (called automatically when a new quotation version is issued).
 */
export interface SupersedeApprovalsInput {
  readonly tenantId: string;
  readonly subjectType: ApprovalSubjectType;
  readonly subjectId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly actorName: string;
}

// ─── Approval Summary ─────────────────────────────────────────────────────────

/**
 * Summary of approval history for a given subject (quotation or contract).
 */
export interface ApprovalSummary {
  readonly subjectType: ApprovalSubjectType;
  readonly subjectId: string;
  readonly currentStatus: ApprovalStatus | 'not_sent';
  readonly totalRequestsSent: number;
  readonly lastSentAt?: string;
  readonly approvedAt?: string;
  readonly rejectedAt?: string;
  readonly rejectionReason?: string;
  readonly hasSignature: boolean;
}

